import { requireSupabase } from '../lib/supabaseClient';
import {
  logSupabaseError,
  mapAvailabilityRow,
  mapDoctorRowToDirectoryDoctor,
} from '../utils/supabaseMappers';
import type { Doctor, DoctorAvailabilitySlot } from '../types/ruralcare';

export interface VerifiedDoctorsResult {
  doctors: Doctor[];
  errors: string[];
}

export async function fetchVerifiedDoctorsResilient(): Promise<VerifiedDoctorsResult> {
  const supabase = requireSupabase();
  const errors: string[] = [];

  const { data: doctorRows, error: docErr } = await supabase
    .from('doctor_profiles')
    .select('*')
    .eq('verification_status', 'Approved')
    .eq('is_active', true)
    .order('full_name', { ascending: true });

  if (docErr) {
    errors.push(logSupabaseError('Load doctor_profiles', docErr, 'doctor_profiles'));
    return { doctors: [], errors };
  }

  const { data: availRows, error: availErr } = await supabase
    .from('doctor_availability')
    .select('*')
    .order('available_day', { ascending: true })
    .order('start_time', { ascending: true });

  if (availErr) {
    errors.push(logSupabaseError('Load doctor_availability', availErr, 'doctor_availability'));
  }

  const availByDoctor = new Map<string, DoctorAvailabilitySlot[]>();
  for (const row of availRows ?? []) {
    const mapped = mapAvailabilityRow(row);
    const list = availByDoctor.get(mapped.doctorId) ?? [];
    list.push(mapped);
    availByDoctor.set(mapped.doctorId, list);
  }

  const doctors = (doctorRows ?? []).map((row) =>
    mapDoctorRowToDirectoryDoctor(row, availByDoctor.get(String(row.id)) ?? [])
  );

  return { doctors, errors };
}

export async function fetchVerifiedDoctorsFromSupabase(): Promise<Doctor[]> {
  const result = await fetchVerifiedDoctorsResilient();
  if (result.errors.length > 0 && result.doctors.length === 0) {
    throw new Error(result.errors[0]);
  }
  return result.doctors;
}

export async function fetchDoctorOwnAvailability(
  doctorId: string
): Promise<DoctorAvailabilitySlot[]> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('doctor_availability')
    .select('*')
    .eq('doctor_id', doctorId)
    .order('available_date', { ascending: true, nullsFirst: false })
    .order('start_time', { ascending: true });

  if (error) {
    throw new Error(logSupabaseError('Load doctor_availability', error, 'doctor_availability'));
  }

  return (data ?? []).map(mapAvailabilityRow);
}

export async function createDoctorAvailabilitySlot(
  doctorId: string,
  input: {
    availableDate: string | null;
    availableDay: string;
    startTime: string;
    endTime: string;
    slotLabel: string;
    status: 'Available' | 'Unavailable';
  }
): Promise<DoctorAvailabilitySlot> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('doctor_availability')
    .insert({
      doctor_id: doctorId,
      available_date: input.availableDate || null,
      available_day: input.availableDay,
      start_time: input.startTime,
      end_time: input.endTime,
      slot_label: input.slotLabel.trim(),
      status: input.status,
    })
    .select('*')
    .single();

  if (error) {
    throw new Error(logSupabaseError('Insert doctor_availability', error, 'doctor_availability'));
  }

  return mapAvailabilityRow(data);
}

export async function updateDoctorAvailabilityStatus(
  slotId: string,
  status: 'Available' | 'Unavailable'
): Promise<DoctorAvailabilitySlot> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('doctor_availability')
    .update({ status })
    .eq('id', slotId)
    .select('*')
    .single();

  if (error) {
    throw new Error(logSupabaseError('Update doctor_availability', error, 'doctor_availability'));
  }

  return mapAvailabilityRow(data);
}

export async function deleteDoctorAvailabilitySlot(slotId: string): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase.from('doctor_availability').delete().eq('id', slotId);
  if (error) {
    throw new Error(logSupabaseError('Delete doctor_availability', error, 'doctor_availability'));
  }
}
