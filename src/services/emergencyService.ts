import { requireSupabase } from '../lib/supabaseClient';
import { logSupabaseError, mapEmergencyRow } from '../utils/supabaseMappers';
import type { EmergencyEvent } from '../types/ruralcare';

export async function fetchEmergencyAlertsForPatient(
  patientId: string
): Promise<EmergencyEvent[]> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('emergency_alerts')
    .select('*')
    .eq('patient_id', patientId)
    .order('alert_timestamp', { ascending: false });

  if (error) {
    throw new Error(logSupabaseError('Load emergency_alerts', error, 'emergency_alerts'));
  }
  return (data ?? []).map(mapEmergencyRow);
}

export async function fetchEmergencyAlertsForDoctor(): Promise<EmergencyEvent[]> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('emergency_alerts')
    .select(`
      *,
      profiles ( full_name, village, district, blood_group )
    `)
    .order('alert_timestamp', { ascending: false });

  if (error) {
    throw new Error(logSupabaseError('Load emergency_alerts', error, 'emergency_alerts'));
  }
  return (data ?? []).map(mapEmergencyRow);
}

export async function createEmergencyAlertInSupabase(input: {
  patientId: string;
  emergencyContactName: string;
  emergencyContactNumber: string;
  emergencyDescription: string;
  locationLabel: string;
  latitude: number | null;
  longitude: number | null;
  locationSharingStatus: 'Shared' | 'Unavailable';
}): Promise<EmergencyEvent> {
  const supabase = requireSupabase();

  const { data, error } = await supabase
    .from('emergency_alerts')
    .insert({
      patient_id: input.patientId,
      emergency_contact_name: input.emergencyContactName,
      emergency_contact_number: input.emergencyContactNumber,
      emergency_description: input.emergencyDescription.trim(),
      location_label: input.locationLabel,
      gps_latitude: input.latitude,
      gps_longitude: input.longitude,
      location_sharing_status: input.locationSharingStatus,
      emergency_status: 'Logged',
    })
    .select('*')
    .single();

  if (error) {
    throw new Error(logSupabaseError('Insert emergency_alerts', error, 'emergency_alerts'));
  }

  const { error: notifErr } = await supabase.from('notifications').insert({
    user_id: input.patientId,
    title: 'Emergency Alert Saved',
    title_kn: 'ತುರ್ತು ಎಚ್ಚರಿಕೆ ದಾಖಲಿಸಲಾಗಿದೆ',
    message: `${input.locationLabel} · Status: Logged in RuralCare database.`,
    message_kn: `${input.locationLabel} · RuralCare ಡೇಟಾಬೇಸ್‌ನಲ್ಲಿ ದಾಖಲಿಸಲಾಗಿದೆ.`,
    notification_type: 'emergency',
    domain_route: '/emergency',
  });
  if (notifErr) {
    logSupabaseError('Insert emergency notification', notifErr, 'notifications');
  }

  return mapEmergencyRow(data);
}

export async function updateEmergencyAlertStatusInSupabase(
  alertId: string,
  nextStatus: 'Acknowledged' | 'Resolved',
  doctorProfileId: string,
  patientId?: string
): Promise<EmergencyEvent> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('emergency_alerts')
    .update({
      emergency_status: nextStatus,
      acknowledged_by_doctor_id: doctorProfileId,
    })
    .eq('id', alertId)
    .select(`
      *,
      profiles ( full_name, village, district, blood_group )
    `)
    .single();

  if (error) {
    throw new Error(logSupabaseError('Update emergency_alerts', error, 'emergency_alerts'));
  }

  if (patientId) {
    const { error: notifErr } = await supabase.from('notifications').insert({
      user_id: patientId,
      title: `Emergency Alert ${nextStatus}`,
      title_kn: `ತುರ್ತು ಎಚ್ಚರಿಕೆ ಸ್ಥಿತಿ: ${nextStatus}`,
      message: `A RuralCare physician marked your emergency alert as ${nextStatus}.`,
      message_kn: `RuralCare ವೈದ್ಯರು ನಿಮ್ಮ ತುರ್ತು ಎಚ್ಚರಿಕೆಯನ್ನು ${nextStatus} ಎಂದು ಗುರುತಿಸಿದ್ದಾರೆ.`,
      notification_type: 'emergency',
      domain_route: '/emergency',
    });
    if (notifErr) {
      logSupabaseError('Insert emergency status notification', notifErr, 'notifications');
    }
  }

  return mapEmergencyRow(data);
}
