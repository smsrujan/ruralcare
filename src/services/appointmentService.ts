import { requireSupabase } from '../lib/supabaseClient';
import { logSupabaseError, mapAppointmentRow } from '../utils/supabaseMappers';
import type {
  Appointment,
  AppointmentStatus,
  ConsultationType,
} from '../types/ruralcare';

export async function fetchPatientAppointments(patientId: string): Promise<Appointment[]> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('appointments')
    .select(`
      *,
      doctor_profiles ( full_name, specialization, hospital_name )
    `)
    .eq('patient_id', patientId)
    .order('appointment_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(logSupabaseError('Load appointments', error, 'appointments'));
  }

  return (data ?? []).map(mapAppointmentRow);
}

export async function fetchDoctorAppointments(doctorProfileId: string): Promise<Appointment[]> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('appointments')
    .select(`
      *,
      doctor_profiles ( full_name, specialization, hospital_name ),
      profiles ( full_name, health_id, village, mobile_number )
    `)
    .eq('doctor_id', doctorProfileId)
    .order('appointment_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(logSupabaseError('Load appointments', error, 'appointments'));
  }

  return (data ?? []).map(mapAppointmentRow);
}

export async function bookAppointmentInSupabase(input: {
  doctorId: string;
  appointmentDate: string;
  appointmentTime: string;
  consultationType: ConsultationType;
  patientMessage: string;
}): Promise<Appointment> {
  const supabase = requireSupabase();

  const { data, error } = await supabase.rpc('book_appointment_atomic', {
    p_doctor_id: input.doctorId,
    p_appointment_date: input.appointmentDate,
    p_appointment_time: input.appointmentTime,
    p_consultation_type: input.consultationType,
    p_patient_message: input.patientMessage.trim(),
  });

  if (error) {
    throw new Error(logSupabaseError('Book appointment', error, 'appointments'));
  }

  // Re-fetch with doctor join for full display info
  const { data: fullRow, error: fetchErr } = await supabase
    .from('appointments')
    .select(`
      *,
      doctor_profiles ( full_name, specialization, hospital_name )
    `)
    .eq('id', data.id)
    .single();

  if (fetchErr) {
    logSupabaseError('Fetch booked appointment join', fetchErr, 'appointments');
    return mapAppointmentRow(data);
  }

  return mapAppointmentRow(fullRow);
}

export async function updateAppointmentStatusInSupabase(
  appointmentId: string,
  nextStatus: AppointmentStatus,
  rejectionReason?: string
): Promise<Appointment> {
  const supabase = requireSupabase();

  const { data, error } = await supabase.rpc('update_appointment_status_secure', {
    p_appointment_id: appointmentId,
    p_next_status: nextStatus,
    p_rejection_reason: rejectionReason ?? null,
  });

  if (error) {
    throw new Error(logSupabaseError('Update appointment status', error, 'appointments'));
  }

  const { data: fullRow, error: fetchErr } = await supabase
    .from('appointments')
    .select(`
      *,
      doctor_profiles ( full_name, specialization, hospital_name ),
      profiles ( full_name, health_id, village, mobile_number )
    `)
    .eq('id', data.id)
    .single();

  if (fetchErr) {
    logSupabaseError('Fetch updated appointment join', fetchErr, 'appointments');
    return mapAppointmentRow(data);
  }

  return mapAppointmentRow(fullRow);
}
