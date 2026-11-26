import { requireSupabase } from '../lib/supabaseClient';
import { logSupabaseError, mapConnectionRowToThread } from '../utils/supabaseMappers';
import type { ConnectionStatus, ConsultationThread } from '../types/ruralcare';

async function loadMessagesForConnections(
  connectionIds: string[]
): Promise<Map<string, Record<string, unknown>[]>> {
  const map = new Map<string, Record<string, unknown>[]>();
  if (connectionIds.length === 0) return map;

  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('consultation_messages')
    .select('*')
    .in('connection_id', connectionIds)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(
      logSupabaseError('Load consultation_messages', error, 'consultation_messages')
    );
  }

  for (const row of data ?? []) {
    const cid = String(row.connection_id);
    const list = map.get(cid) ?? [];
    list.push(row);
    map.set(cid, list);
  }
  return map;
}

export async function fetchConnectionsForPatient(patientId: string): Promise<ConsultationThread[]> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('doctor_patient_connections')
    .select(`
      *,
      doctor_profiles ( full_name, specialization )
    `)
    .eq('patient_id', patientId)
    .order('last_message_at', { ascending: false });

  if (error) {
    throw new Error(
      logSupabaseError(
        'Load doctor_patient_connections',
        error,
        'doctor_patient_connections'
      )
    );
  }
  const rows = data ?? [];
  const messagesByConn = await loadMessagesForConnections(rows.map((r) => String(r.id)));
  return rows.map((row) => mapConnectionRowToThread(row, messagesByConn.get(String(row.id)) ?? []));
}

export async function fetchConnectionsForDoctor(
  doctorProfileId: string
): Promise<ConsultationThread[]> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('doctor_patient_connections')
    .select(`
      *,
      doctor_profiles ( full_name, specialization ),
      profiles ( full_name, village, district, health_id )
    `)
    .eq('doctor_id', doctorProfileId)
    .order('last_message_at', { ascending: false });

  if (error) {
    throw new Error(
      logSupabaseError(
        'Load doctor_patient_connections',
        error,
        'doctor_patient_connections'
      )
    );
  }
  const rows = data ?? [];
  const messagesByConn = await loadMessagesForConnections(rows.map((r) => String(r.id)));
  return rows.map((row) => mapConnectionRowToThread(row, messagesByConn.get(String(row.id)) ?? []));
}

export async function sendConnectionMessageInSupabase(input: {
  patientId: string;
  doctorId: string;
  senderId: string;
  senderRole: 'patient' | 'doctor';
  text: string;
  doctorUserId?: string | null;
  patientName?: string;
  doctorName?: string;
}): Promise<string> {
  const supabase = requireSupabase();
  const trimmed = input.text.trim();
  if (!trimmed) throw new Error('Message text is required');

  const { data: existingConn, error: connSelectErr } = await supabase
    .from('doctor_patient_connections')
    .select('*')
    .eq('patient_id', input.patientId)
    .eq('doctor_id', input.doctorId)
    .maybeSingle();

  if (connSelectErr) {
    throw new Error(
      logSupabaseError(
        'Lookup doctor_patient_connections',
        connSelectErr,
        'doctor_patient_connections'
      )
    );
  }

  let conn = existingConn;

  if (!conn) {
    if (input.senderRole !== 'patient') {
      throw new Error('Only a patient can initiate a new consultation request');
    }
    const { data: created, error: createErr } = await supabase
      .from('doctor_patient_connections')
      .insert({
        patient_id: input.patientId,
        doctor_id: input.doctorId,
        status: 'Pending',
        request_note: trimmed,
        last_message_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (createErr) {
      throw new Error(
        logSupabaseError(
          'Insert doctor_patient_connections',
          createErr,
          'doctor_patient_connections'
        )
      );
    }
    conn = created;

    if (input.doctorUserId) {
      const { error: notifErr } = await supabase.from('notifications').insert({
        user_id: input.doctorUserId,
        title: 'New Doctor Connection Request',
        title_kn: 'ಹೊಸ ವೈದ್ಯರ ಸಂಪರ್ಕ ವಿನಂತಿ',
        message: `${input.patientName ?? 'A patient'} sent a consultation request.`,
        message_kn: `${input.patientName ?? 'ರೋಗಿ'} ಸಮಾಲೋಚನೆ ವಿನಂತಿಯನ್ನು ಕಳುಹಿಸಿದ್ದಾರೆ.`,
        notification_type: 'connection',
        domain_route: '/connect-doctor',
      });
      if (notifErr) {
        logSupabaseError('Insert connection notification', notifErr, 'notifications');
      }
    }
  } else {
    const { error: touchErr } = await supabase
      .from('doctor_patient_connections')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conn.id);

    if (touchErr) {
      throw new Error(
        logSupabaseError(
          'Update doctor_patient_connections',
          touchErr,
          'doctor_patient_connections'
        )
      );
    }
  }

  const { error: msgErr } = await supabase.from('consultation_messages').insert({
    connection_id: conn.id,
    sender_id: input.senderId,
    sender_role: input.senderRole,
    message_text: trimmed,
  });

  if (msgErr) {
    throw new Error(
      logSupabaseError('Insert consultation_messages', msgErr, 'consultation_messages')
    );
  }

  return String(conn.id);
}

export async function updateConnectionStatusInSupabase(
  connectionId: string,
  nextStatus: ConnectionStatus,
  patientId?: string,
  doctorName?: string
): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from('doctor_patient_connections')
    .update({ status: nextStatus })
    .eq('id', connectionId);

  if (error) {
    throw new Error(
      logSupabaseError('Update doctor_patient_connections', error, 'doctor_patient_connections')
    );
  }

  if (patientId && (nextStatus === 'Accepted' || nextStatus === 'Rejected')) {
    const { error: notifErr } = await supabase.from('notifications').insert({
      user_id: patientId,
      title: `Consultation Request ${nextStatus}`,
      title_kn: `ಸಮಾಲೋಚನೆ ವಿನಂತಿ: ${nextStatus}`,
      message: `${doctorName ?? 'Doctor'} marked your connection request as ${nextStatus}.`,
      message_kn: `${doctorName ?? 'ವೈದ್ಯರು'} ನಿಮ್ಮ ಸಂಪರ್ಕ ವಿನಂತಿಯನ್ನು ${nextStatus} ಎಂದು ಗುರುತಿಸಿದ್ದಾರೆ.`,
      notification_type: 'connection',
      domain_route: '/connect-doctor',
    });
    if (notifErr) {
      logSupabaseError('Insert connection status notification', notifErr, 'notifications');
    }
  }
}
