import { requireSupabase, SUPABASE_CONFIG_ERROR } from '../lib/supabaseClient';
import { calculateAgeFromDob, normalizeMobile } from '../utils/validation';
import { generateDemoHealthId } from '../utils/healthUtils';
import {
  buildPatientProfileUpsertPayload,
  extractSupabaseErrorMessage,
  formatSupabaseDatabaseError,
  logSupabaseError,
  mapDoctorRowToAccount,
  mapProfileRowToPatient,
  mapSupabaseAuthErrorKey,
  type PatientProfileInsertRow,
} from '../utils/supabaseMappers';
export { buildPatientProfileUpsertPayload, type PatientProfileInsertRow };
import type {
  DoctorAccountProfile,
  DoctorRegisterPayload,
  PatientProfile,
  RegisterPayload,
  UserRole,
} from '../types/ruralcare';

export interface AuthOutcome {
  ok: boolean;
  role?: UserRole;
  userId?: string;
  errorKey?: string;
  errorMessage?: string;
}

export interface RegisterOutcome {
  ok: boolean;
  healthId?: string;
  requiresEmailConfirmation?: boolean;
  errorKey?: string;
  errorMessage?: string;
}

async function ensurePatientProfileAndCardFromMetadata(
  user: {
    id: string;
    email?: string | null;
    user_metadata?: Record<string, unknown>;
  }
): Promise<Record<string, unknown> | null> {
  const supabase = requireSupabase();
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  if (meta.signup_intent === 'doctor') {
    return null;
  }

  const fullName =
    String(meta.full_name ?? '').trim() ||
    String(user.email ?? 'Patient').split('@')[0] ||
    'RuralCare Patient';
  const district = String(meta.district ?? '').trim();
  const village = String(meta.village ?? '').trim();
  const bloodGroup = String(meta.blood_group ?? '').trim();
  const healthId =
    String(meta.health_id ?? '').trim() || generateDemoHealthId(fullName, district || 'IN');
  const rawAge = meta.age != null ? Number(meta.age) : null;
  const age =
    rawAge !== null && Number.isFinite(rawAge)
      ? rawAge
      : meta.date_of_birth
      ? calculateAgeFromDob(String(meta.date_of_birth)) ?? 25
      : null;

  const profilePayload = buildPatientProfileUpsertPayload(user.id, healthId, {
    fullName,
    dateOfBirth: meta.date_of_birth ? String(meta.date_of_birth) : null,
    age,
    gender: String(meta.gender ?? ''),
    email: String(user.email ?? ''),
    mobileNumber: String(meta.mobile_number ?? ''),
    village,
    district,
    state: String(meta.state ?? ''),
    fullAddress: String(meta.full_address ?? ''),
    pinCode: String(meta.pin_code ?? ''),
    bloodGroup,
    emergencyContactName: String(meta.emergency_contact_name ?? ''),
    emergencyContactNumber: String(meta.emergency_contact_number ?? ''),
  });

  const { data: insertedProfile, error: insertErr } = await supabase
    .from('profiles')
    .upsert(profilePayload, { onConflict: 'id' })
    .select('*')
    .single();

  if (insertErr) {
    throw insertErr;
  }

  const { error: cardErr } = await supabase.from('health_cards').upsert(
    {
      patient_id: user.id,
      health_id: String(insertedProfile.health_id ?? healthId),
      qr_payload: `${String(insertedProfile.health_id ?? healthId)}|${fullName}|${bloodGroup}|${village},${district}`,
      status: 'Active',
    },
    { onConflict: 'patient_id' }
  );

  if (cardErr) {
    throw cardErr;
  }

  return insertedProfile;
}

export async function signInPatientWithSupabase(
  identifier: string,
  password: string
): Promise<AuthOutcome> {
  try {
    const supabase = requireSupabase();
    let emailToUse = identifier.trim().toLowerCase();

    if (!emailToUse.includes('@')) {
      const cleanPhone = normalizeMobile(emailToUse);
      const { data: resolvedEmail, error: rpcError } = await supabase.rpc(
        'resolve_login_email_by_mobile',
        { p_mobile: cleanPhone }
      );
      if (rpcError) {
        return {
          ok: false,
          errorKey: 'supabase.profileFetchError',
          errorMessage: rpcError.message,
        };
      }
      if (!resolvedEmail) {
        return { ok: false, errorKey: 'supabase.mobileLookupNotFound' };
      }
      emailToUse = String(resolvedEmail).toLowerCase();
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: emailToUse,
      password,
    });

    if (error || !data.user) {
      const msg = error?.message ?? 'Invalid login credentials';
      return {
        ok: false,
        errorKey: mapSupabaseAuthErrorKey(msg),
        errorMessage: msg,
      };
    }

    const [profileRes, doctorRes, docReqRes] = await Promise.all([
      supabase.from('profiles').select('id, role').eq('id', data.user.id).maybeSingle(),
      supabase.from('doctor_profiles').select('id').eq('user_id', data.user.id).maybeSingle(),
      supabase
        .from('doctor_registration_requests')
        .select('id, status')
        .eq('user_id', data.user.id)
        .maybeSingle(),
    ]);

    if (profileRes.error) {
      await supabase.auth.signOut();
      return {
        ok: false,
        errorKey: 'supabase.profileFetchError',
        errorMessage: formatSupabaseDatabaseError(profileRes.error, 'profiles'),
      };
    }

    const signupIntent = data.user.user_metadata?.signup_intent;
    const isDoctorAccount =
      profileRes.data?.role === 'doctor' ||
      signupIntent === 'doctor' ||
      Boolean(doctorRes.data) ||
      Boolean(docReqRes.data);

    if (isDoctorAccount) {
      await supabase.auth.signOut();
      return {
        ok: false,
        errorKey: 'supabase.useDoctorLoginPortal',
      };
    }

    if (!profileRes.data) {
      try {
        await ensurePatientProfileAndCardFromMetadata(data.user);
      } catch (provisionErr) {
        const msg = formatSupabaseDatabaseError(provisionErr, 'profiles');
        await supabase.auth.signOut();
        return {
          ok: false,
          errorKey: 'supabase.profileSaveFailed',
          errorMessage: msg,
        };
      }
    }

    return {
      ok: true,
      role: 'patient',
      userId: data.user.id,
    };
  } catch (err) {
    const msg = extractSupabaseErrorMessage(err, SUPABASE_CONFIG_ERROR);
    return { ok: false, errorKey: mapSupabaseAuthErrorKey(msg), errorMessage: msg };
  }
}

export async function signInDoctorWithSupabase(
  email: string,
  password: string
): Promise<AuthOutcome> {
  try {
    const supabase = requireSupabase();
    const cleanEmail = email.trim().toLowerCase();

    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (error || !data.user) {
      const msg = error?.message ?? 'Invalid login credentials';
      return {
        ok: false,
        errorKey: mapSupabaseAuthErrorKey(msg),
        errorMessage: msg,
      };
    }

    const [profileRes, doctorRes] = await Promise.all([
      supabase.from('profiles').select('id, role').eq('id', data.user.id).maybeSingle(),
      supabase
        .from('doctor_profiles')
        .select('id, verification_status, is_active')
        .eq('user_id', data.user.id)
        .maybeSingle(),
    ]);

    if (profileRes.error) {
      await supabase.auth.signOut();
      return {
        ok: false,
        errorKey: 'supabase.profileFetchError',
        errorMessage: formatSupabaseDatabaseError(profileRes.error, 'profiles'),
      };
    }

    if (doctorRes.error) {
      await supabase.auth.signOut();
      return {
        ok: false,
        errorKey: 'supabase.profileFetchError',
        errorMessage: formatSupabaseDatabaseError(doctorRes.error, 'doctor_profiles'),
      };
    }

    // Ensure doctor profile and profile role are approved and active
    const meta = (data.user.user_metadata ?? {}) as Record<string, unknown>;
    const fullName = String(meta.full_name ?? email.split('@')[0] ?? 'Doctor');
    const regNum = String(meta.medical_registration_number ?? `DOC-${data.user.id.slice(0, 8)}`);

    if (!doctorRes.data) {
      await supabase.from('doctor_profiles').upsert(
        {
          user_id: data.user.id,
          doctor_code: `RC-DOC-${data.user.id.replace(/-/g, '').slice(0, 6).toUpperCase()}`,
          registration_number: regNum,
          full_name: fullName,
          email: cleanEmail,
          mobile_number: String(meta.mobile_number ?? ''),
          qualification: String(meta.qualification ?? 'MBBS'),
          specialization: String(meta.specialization ?? 'General Physician'),
          experience_years: Number(meta.experience_years ?? 0),
          hospital_name: String(meta.hospital_name ?? 'Rural Clinic'),
          hospital_address: String(meta.hospital_address ?? ''),
          district: String(meta.district ?? ''),
          location: String(meta.hospital_address ?? ''),
          verification_status: 'Approved',
          is_active: true,
        },
        { onConflict: 'user_id' }
      );
    } else if (doctorRes.data.verification_status !== 'Approved' || !doctorRes.data.is_active) {
      await supabase
        .from('doctor_profiles')
        .update({ verification_status: 'Approved', is_active: true })
        .eq('user_id', data.user.id);
    }

    if (profileRes.data?.role !== 'doctor') {
      await supabase
        .from('profiles')
        .update({ role: 'doctor' })
        .eq('id', data.user.id);
    }

    return {
      ok: true,
      role: 'doctor',
      userId: data.user.id,
    };
  } catch (err) {
    const msg = extractSupabaseErrorMessage(err, SUPABASE_CONFIG_ERROR);
    return { ok: false, errorKey: mapSupabaseAuthErrorKey(msg), errorMessage: msg };
  }
}

export async function signUpPatientWithSupabase(
  payload: RegisterPayload
): Promise<RegisterOutcome> {
  try {
    const supabase = requireSupabase();
    const cleanEmail = payload.email.trim().toLowerCase();
    const cleanMobile = normalizeMobile(payload.mobileNumber);
    const cleanEmergencyMobile = normalizeMobile(payload.emergencyContactNumber);
    const age = calculateAgeFromDob(payload.dateOfBirth) ?? 25;
    const healthId = generateDemoHealthId(payload.fullName, payload.district);

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password: payload.password,
      options: {
        data: {
          signup_intent: 'patient',
          role: 'patient',
          health_id: healthId,
          full_name: payload.fullName.trim(),
          date_of_birth: payload.dateOfBirth,
          age,
          gender: payload.gender,
          mobile_number: cleanMobile,
          village: payload.village.trim(),
          district: payload.district.trim(),
          state: payload.state.trim(),
          full_address: payload.fullAddress.trim(),
          pin_code: payload.pinCode.trim(),
          blood_group: payload.bloodGroup,
          emergency_contact_name: payload.emergencyContactName.trim(),
          emergency_contact_number: cleanEmergencyMobile,
        },
      },
    });

    if (error || !data.user) {
      const rawMsg = error ? extractSupabaseErrorMessage(error, 'Signup failed') : 'Signup failed';
      const msg = rawMsg.toLowerCase().includes('database error saving new user')
        ? `${rawMsg} — Your Supabase auth.users trigger failed while writing to public.profiles. Run SQL migration 005_complete_ruralcare_tables_rls_and_seed.sql in Supabase SQL Editor.`
        : rawMsg;
      return {
        ok: false,
        errorKey: mapSupabaseAuthErrorKey(rawMsg),
        errorMessage: msg,
      };
    }

    if (!data.user.id) {
      return {
        ok: false,
        errorKey: 'supabase.profileSaveFailed',
        errorMessage: 'Supabase Auth created the account without returning a user UUID.',
      };
    }

    // Supabase returns empty identities if the email is already registered when email confirmation is enabled
    if (Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      return {
        ok: false,
        errorKey: 'supabase.emailAlreadyRegistered',
      };
    }

    // Ensure an active session is available immediately without requiring an email link
    let activeSession = data.session;
    if (!activeSession) {
      const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: payload.password,
      });
      if (signInErr) {
        const signInMsg = extractSupabaseErrorMessage(signInErr, 'Direct sign-in after registration failed');
        return {
          ok: false,
          errorKey: mapSupabaseAuthErrorKey(signInMsg),
          errorMessage: signInMsg,
        };
      }
      activeSession = signInData.session;
    }

    if (activeSession) {
      const { data: existing, error: existingErr } = await supabase
        .from('profiles')
        .select('id, health_id')
        .eq('id', data.user.id)
        .maybeSingle();

      if (existingErr) {
        return {
          ok: false,
          errorKey: 'supabase.profileSaveFailed',
          errorMessage: formatSupabaseDatabaseError(existingErr, 'profiles'),
        };
      }

      const resolvedHealthId = existing?.health_id ? String(existing.health_id) : healthId;
      const profilePayload = buildPatientProfileUpsertPayload(data.user.id, resolvedHealthId, {
        fullName: payload.fullName,
        dateOfBirth: payload.dateOfBirth,
        age,
        gender: payload.gender,
        email: cleanEmail,
        mobileNumber: cleanMobile,
        village: payload.village,
        district: payload.district,
        state: payload.state,
        fullAddress: payload.fullAddress,
        pinCode: payload.pinCode,
        bloodGroup: payload.bloodGroup,
        emergencyContactName: payload.emergencyContactName,
        emergencyContactNumber: cleanEmergencyMobile,
      });

      const { error: upsertProfileErr } = await supabase
        .from('profiles')
        .upsert(profilePayload, { onConflict: 'id' });

      if (upsertProfileErr) {
        return {
          ok: false,
          errorKey: 'supabase.profileSaveFailed',
          errorMessage: formatSupabaseDatabaseError(upsertProfileErr, 'profiles'),
        };
      }

      const { error: healthCardErr } = await supabase.from('health_cards').upsert(
        {
          patient_id: data.user.id,
          health_id: resolvedHealthId,
          qr_payload: `${resolvedHealthId}|${payload.fullName.trim()}|${payload.bloodGroup}|${payload.village.trim()},${payload.district.trim()}`,
          status: 'Active',
        },
        { onConflict: 'patient_id' }
      );

      if (healthCardErr) {
        return {
          ok: false,
          errorKey: 'supabase.profileSaveFailed',
          errorMessage: formatSupabaseDatabaseError(healthCardErr, 'health_cards'),
        };
      }

      return {
        ok: true,
        healthId: resolvedHealthId,
        requiresEmailConfirmation: false,
      };
    }

    return {
      ok: true,
      healthId,
      requiresEmailConfirmation: false,
    };
  } catch (err) {
    const msg = formatSupabaseDatabaseError(err, 'profiles');
    return { ok: false, errorKey: mapSupabaseAuthErrorKey(msg), errorMessage: msg };
  }
}

export async function signUpDoctorRequestWithSupabase(
  payload: DoctorRegisterPayload
): Promise<RegisterOutcome> {
  try {
    const supabase = requireSupabase();
    const cleanEmail = payload.email.trim().toLowerCase();
    const cleanMobile = normalizeMobile(payload.mobileNumber);

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password: payload.password,
      options: {
        data: {
          signup_intent: 'doctor',
          role: 'doctor',
          full_name: payload.fullName.trim(),
          mobile_number: cleanMobile,
          medical_registration_number: payload.medicalRegistrationNumber.trim(),
          qualification: payload.qualification.trim(),
          specialization: payload.specialization.trim(),
          experience_years: payload.experienceYears,
          hospital_name: payload.hospitalName.trim(),
          hospital_address: payload.hospitalAddress.trim(),
          district: payload.district.trim(),
        },
      },
    });

    if (error || !data.user) {
      const msg = error?.message ?? 'Signup failed';
      return {
        ok: false,
        errorKey: mapSupabaseAuthErrorKey(msg),
        errorMessage: msg,
      };
    }

    if (Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      return {
        ok: false,
        errorKey: 'supabase.emailAlreadyRegistered',
      };
    }

    let activeSession = data.session;
    if (!activeSession) {
      const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: payload.password,
      });
      if (signInErr) {
        const signInMsg = extractSupabaseErrorMessage(signInErr, 'Direct sign-in after registration failed');
        return {
          ok: false,
          errorKey: mapSupabaseAuthErrorKey(signInMsg),
          errorMessage: signInMsg,
        };
      }
      activeSession = signInData.session;
    }

    if (data.user.id) {
      await supabase.from('doctor_registration_requests').upsert(
        {
          user_id: data.user.id,
          full_name: payload.fullName.trim(),
          email: cleanEmail,
          mobile_number: cleanMobile,
          medical_registration_number: payload.medicalRegistrationNumber.trim(),
          qualification: payload.qualification.trim(),
          specialization: payload.specialization.trim(),
          experience_years: payload.experienceYears,
          hospital_name: payload.hospitalName.trim(),
          hospital_address: payload.hospitalAddress.trim(),
          status: 'Approved',
        },
        { onConflict: 'user_id' }
      );

      await supabase.from('doctor_profiles').upsert(
        {
          user_id: data.user.id,
          doctor_code: `RC-DOC-${data.user.id.replace(/-/g, '').slice(0, 6).toUpperCase()}`,
          registration_number: payload.medicalRegistrationNumber.trim(),
          full_name: payload.fullName.trim(),
          email: cleanEmail,
          mobile_number: cleanMobile,
          qualification: payload.qualification.trim(),
          specialization: payload.specialization.trim(),
          experience_years: payload.experienceYears,
          hospital_name: payload.hospitalName.trim(),
          hospital_address: payload.hospitalAddress.trim(),
          district: payload.district.trim(),
          location: payload.hospitalAddress.trim(),
          verification_status: 'Approved',
          is_active: true,
        },
        { onConflict: 'user_id' }
      );

      await supabase.from('profiles').upsert(
        {
          id: data.user.id,
          role: 'doctor',
          full_name: payload.fullName.trim(),
          email: cleanEmail,
          mobile_number: cleanMobile,
          district: payload.district.trim(),
        },
        { onConflict: 'id' }
      );
    }

    return {
      ok: true,
      requiresEmailConfirmation: false,
    };
  } catch (err) {
    const msg = formatSupabaseDatabaseError(err, 'doctor_profiles');
    return { ok: false, errorKey: mapSupabaseAuthErrorKey(msg), errorMessage: msg };
  }
}

export async function sendSupabasePasswordReset(
  email: string,
  redirectPath: string
): Promise<{ ok: boolean; errorKey?: string; errorMessage?: string }> {
  try {
    const supabase = requireSupabase();
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}${redirectPath}`,
    });

    if (error) {
      return {
        ok: false,
        errorKey: mapSupabaseAuthErrorKey(error.message),
        errorMessage: error.message,
      };
    }

    return { ok: true };
  } catch (err) {
    const msg = extractSupabaseErrorMessage(err, SUPABASE_CONFIG_ERROR);
    return { ok: false, errorKey: mapSupabaseAuthErrorKey(msg), errorMessage: msg };
  }
}

export async function signOutFromSupabase(): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw error;
  }
}

export async function resolveAuthenticatedAccount(userId: string): Promise<{
  role: UserRole;
  patient: PatientProfile | null;
  doctorAccount: DoctorAccountProfile | null;
  doctorVerified: boolean;
}> {
  const supabase = requireSupabase();

  const [authUserRes, profileRes, doctorRes, docReqRes] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
    supabase.from('doctor_profiles').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('doctor_registration_requests').select('id, status').eq('user_id', userId).maybeSingle(),
  ]);

  if (profileRes.error) {
    throw new Error(logSupabaseError('Load profiles', profileRes.error, 'profiles'));
  }
  if (doctorRes.error) {
    throw new Error(logSupabaseError('Load doctor_profiles', doctorRes.error, 'doctor_profiles'));
  }
  if (docReqRes.error) {
    logSupabaseError(
      'Load doctor_registration_requests',
      docReqRes.error,
      'doctor_registration_requests'
    );
  }

  let profileRow = profileRes.data;
  let doctorRow = doctorRes.data;
  const authUser = authUserRes.data.user;
  const signupIntent = authUser?.user_metadata?.signup_intent;
  const isDoctorAccount =
    profileRow?.role === 'doctor' ||
    signupIntent === 'doctor' ||
    Boolean(doctorRow) ||
    Boolean(docReqRes.data);

  if (isDoctorAccount) {
    if (!doctorRow && authUser) {
      const meta = (authUser.user_metadata ?? {}) as Record<string, unknown>;
      const fullName = String(meta.full_name ?? authUser.email?.split('@')[0] ?? 'Doctor');
      const regNum = String(meta.medical_registration_number ?? `DOC-${userId.slice(0, 8)}`);
      const { data: insertedDoc } = await supabase
        .from('doctor_profiles')
        .upsert(
          {
            user_id: userId,
            doctor_code: `RC-DOC-${userId.replace(/-/g, '').slice(0, 6).toUpperCase()}`,
            registration_number: regNum,
            full_name: fullName,
            email: String(authUser.email ?? ''),
            mobile_number: String(meta.mobile_number ?? ''),
            qualification: String(meta.qualification ?? 'MBBS'),
            specialization: String(meta.specialization ?? 'General Physician'),
            experience_years: Number(meta.experience_years ?? 0),
            hospital_name: String(meta.hospital_name ?? 'Rural Clinic'),
            hospital_address: String(meta.hospital_address ?? ''),
            district: String(meta.district ?? ''),
            location: String(meta.hospital_address ?? ''),
            verification_status: 'Approved',
            is_active: true,
          },
          { onConflict: 'user_id' }
        )
        .select('*')
        .maybeSingle();
      if (insertedDoc) {
        doctorRow = insertedDoc;
      }
    }

    if (profileRow && profileRow.role !== 'doctor') {
      await supabase.from('profiles').update({ role: 'doctor' }).eq('id', userId);
    }

    let signedPhotoUrl: string | undefined;
    if (doctorRow?.photo_path) {
      const { data: signed } = await supabase.storage
        .from('patient-avatars')
        .createSignedUrl(String(doctorRow.photo_path), 3600);
      signedPhotoUrl = signed?.signedUrl;
    }

    return {
      role: 'doctor',
      patient: null,
      doctorAccount: doctorRow ? mapDoctorRowToAccount(doctorRow, signedPhotoUrl) : null,
      doctorVerified: true,
    };
  }

  if (!profileRow && authUser) {
    profileRow = await ensurePatientProfileAndCardFromMetadata(authUser);
  }

  if (!profileRow) {
    return {
      role: 'patient',
      patient: null,
      doctorAccount: null,
      doctorVerified: false,
    };
  }

  let avatarSignedUrl: string | undefined;
  if (profileRow.avatar_path) {
    const { data: signed } = await supabase.storage
      .from('patient-avatars')
      .createSignedUrl(String(profileRow.avatar_path), 3600);
    avatarSignedUrl = signed?.signedUrl;
  }

  return {
    role: 'patient',
    patient: mapProfileRowToPatient(profileRow, { avatarUrl: avatarSignedUrl }),
    doctorAccount: null,
    doctorVerified: false,
  };
}
