import { requireSupabase } from '../lib/supabaseClient';
import {
  logSupabaseError,
  mapDoctorRowToAccount,
  mapProfileRowToPatient,
} from '../utils/supabaseMappers';
import type { DoctorAccountProfile, PatientProfile } from '../types/ruralcare';

export async function updatePatientProfileInSupabase(
  patientId: string,
  updates: Partial<PatientProfile>
): Promise<PatientProfile> {
  const supabase = requireSupabase();

  const dbPayload: Record<string, unknown> = {};
  if (updates.fullName !== undefined) dbPayload.full_name = updates.fullName.trim();
  if (updates.age !== undefined) dbPayload.age = updates.age;
  if (updates.dateOfBirth !== undefined) dbPayload.date_of_birth = updates.dateOfBirth || null;
  if (updates.gender !== undefined) dbPayload.gender = updates.gender;
  if (updates.mobileNumber !== undefined) dbPayload.mobile_number = updates.mobileNumber.trim();
  if (updates.village !== undefined) dbPayload.village = updates.village.trim();
  if (updates.district !== undefined) dbPayload.district = updates.district.trim();
  if (updates.state !== undefined) dbPayload.state = updates.state.trim();
  if (updates.address !== undefined) dbPayload.full_address = updates.address.trim();
  if (updates.pinCode !== undefined) dbPayload.pin_code = updates.pinCode.trim();
  if (updates.bloodGroup !== undefined) dbPayload.blood_group = updates.bloodGroup;
  if (updates.emergencyContactName !== undefined) {
    dbPayload.emergency_contact_name = updates.emergencyContactName.trim();
  }
  if (updates.emergencyContactNumber !== undefined) {
    dbPayload.emergency_contact_number = updates.emergencyContactNumber.trim();
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(dbPayload)
    .eq('id', patientId)
    .select('*')
    .single();

  if (error) {
    throw new Error(logSupabaseError('Update profiles', error, 'profiles'));
  }

  let avatarSignedUrl: string | undefined;
  if (data.avatar_path) {
    const { data: signed } = await supabase.storage
      .from('patient-avatars')
      .createSignedUrl(String(data.avatar_path), 3600);
    avatarSignedUrl = signed?.signedUrl;
  }

  return mapProfileRowToPatient(data, { avatarUrl: avatarSignedUrl });
}

export async function uploadProfileAvatarInSupabase(
  userId: string,
  file: File,
  role: 'patient' | 'doctor',
  doctorProfileId?: string
): Promise<{ path: string; signedUrl: string }> {
  const supabase = requireSupabase();
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  const storagePath = `${userId}/avatar-${Date.now()}.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from('patient-avatars')
    .upload(storagePath, file, {
      cacheControl: '3600',
      upsert: true,
    });

  if (uploadErr) {
    throw new Error(logSupabaseError('Upload profile avatar', uploadErr, 'storage.objects'));
  }

  if (role === 'doctor' && doctorProfileId) {
    const { error: updateErr } = await supabase
      .from('doctor_profiles')
      .update({ photo_path: storagePath })
      .eq('id', doctorProfileId);
    if (updateErr) {
      throw new Error(logSupabaseError('Update doctor_profiles avatar', updateErr, 'doctor_profiles'));
    }
  } else {
    const { error: updateErr } = await supabase
      .from('profiles')
      .update({ avatar_path: storagePath })
      .eq('id', userId);
    if (updateErr) {
      throw new Error(logSupabaseError('Update profiles avatar', updateErr, 'profiles'));
    }
  }

  const { data: signed, error: signErr } = await supabase.storage
    .from('patient-avatars')
    .createSignedUrl(storagePath, 3600);

  if (signErr || !signed?.signedUrl) {
    throw new Error(
      logSupabaseError(
        'Sign profile avatar URL',
        signErr ?? new Error('Unable to generate signed avatar URL'),
        'storage.objects'
      )
    );
  }

  return { path: storagePath, signedUrl: signed.signedUrl };
}

export async function updateDoctorProfileInSupabase(
  doctorProfileId: string,
  updates: Partial<DoctorAccountProfile>
): Promise<DoctorAccountProfile> {
  const supabase = requireSupabase();

  const dbPayload: Record<string, unknown> = {};
  if (updates.hospital !== undefined) dbPayload.hospital_name = updates.hospital.trim();
  if (updates.hospitalAddress !== undefined) dbPayload.hospital_address = updates.hospitalAddress.trim();
  if (updates.district !== undefined) dbPayload.district = updates.district.trim();
  if (updates.timings !== undefined) dbPayload.available_timings = updates.timings.trim();
  if (updates.phone !== undefined) dbPayload.mobile_number = updates.phone.trim();
  if (updates.location !== undefined) dbPayload.location = updates.location.trim();
  if (updates.availableToday !== undefined) dbPayload.available_today = updates.availableToday;
  if (updates.availableDays !== undefined) dbPayload.available_days = updates.availableDays;
  if (updates.consultationFee !== undefined) dbPayload.consultation_fee = updates.consultationFee;

  const { data, error } = await supabase
    .from('doctor_profiles')
    .update(dbPayload)
    .eq('id', doctorProfileId)
    .select('*')
    .single();

  if (error) {
    throw new Error(logSupabaseError('Update doctor_profiles', error, 'doctor_profiles'));
  }

  let signedPhotoUrl: string | undefined;
  if (data.photo_path) {
    const { data: signed } = await supabase.storage
      .from('patient-avatars')
      .createSignedUrl(String(data.photo_path), 3600);
    signedPhotoUrl = signed?.signedUrl;
  }

  return mapDoctorRowToAccount(data, signedPhotoUrl);
}

export async function fetchAuthorizedPatientsForDoctor(): Promise<PatientProfile[]> {
  const supabase = requireSupabase();
  // RLS on profiles restricts doctors strictly to patients they have appointments, connections, or active emergencies with
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'patient')
    .order('full_name', { ascending: true });

  if (error) {
    throw new Error(logSupabaseError('Load authorized patient profiles', error, 'profiles'));
  }

  return (data ?? []).map((row) => mapProfileRowToPatient(row));
}
