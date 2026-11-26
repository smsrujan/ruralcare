import { normalizeMobile } from './validation';
import type {
  Appointment,
  AppointmentStatus,
  ConsultationThread,
  ConsultationType,
  DiagnosticReportItem,
  Doctor,
  DoctorAccountProfile,
  DoctorAvailabilitySlot,
  DoctorVerificationStatus,
  EmergencyEvent,
  HealthcareService,
  MedicalRecordItem,
  NotificationItem,
  PatientProfile,
  ServiceCategory,
} from '../types/ruralcare';

export const DEFAULT_PATIENT_AVATAR = '/src/assets/images/patient_avatar_default_1795000484576.jpg';
export const DEFAULT_DOCTOR_AVATAR = '/src/assets/images/doctor_portrait_female_1795000484950.jpg';

const DEFAULT_SLOTS = ['09:30 AM', '10:30 AM', '11:30 AM', '01:00 PM'];

export function normalizeSupabaseUrl(rawUrl: string | undefined): string {
  const trimmed = (rawUrl ?? '').trim();
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return '';
    }
    const cleanPath = parsed.pathname.replace(/\/+$/, '');
    if (
      cleanPath === '' ||
      cleanPath === '/rest/v1' ||
      cleanPath === '/auth/v1' ||
      cleanPath === '/storage/v1' ||
      cleanPath.startsWith('/rest/v1/') ||
      cleanPath.startsWith('/auth/v1/') ||
      cleanPath.startsWith('/storage/v1/')
    ) {
      return parsed.origin;
    }
    return `${parsed.origin}${cleanPath}`;
  } catch {
    return '';
  }
}

export function extractSupabaseErrorMessage(err: unknown, fallback = 'Unexpected error'): string {
  if (err instanceof Error && err.message.trim()) {
    return err.message.trim();
  }
  if (err && typeof err === 'object') {
    const rec = err as Record<string, unknown>;
    const message = typeof rec.message === 'string' ? rec.message.trim() : '';
    const details = typeof rec.details === 'string' ? rec.details.trim() : '';
    const hint = typeof rec.hint === 'string' ? rec.hint.trim() : '';
    const code = typeof rec.code === 'string' ? rec.code.trim() : '';

    if (message) {
      const parts = [code ? `[${code}] ${message}` : message];
      if (details && !message.includes(details)) parts.push(details);
      if (hint && !message.includes(hint)) parts.push(`Hint: ${hint}`);
      return parts.join(' — ');
    }
  }
  if (typeof err === 'string' && err.trim()) {
    return err.trim();
  }
  return fallback;
}

export function formatSupabaseDatabaseError(err: unknown, tableHint = 'profiles'): string {
  const base = extractSupabaseErrorMessage(err, 'Database operation failed');
  const lower = base.toLowerCase();
  if (lower.includes('run sql migration 005_') || lower.includes('check supabase rls policies on')) {
    return base;
  }

  const code =
    err && typeof err === 'object' && typeof (err as Record<string, unknown>).code === 'string'
      ? String((err as Record<string, unknown>).code).trim()
      : '';

  if (
    code === '42703' ||
    code === 'PGRST204' ||
    (lower.includes('column') && lower.includes('does not exist')) ||
    (lower.includes('could not find the') && lower.includes('column'))
  ) {
    return `${base} — Run SQL migration 005_complete_ruralcare_tables_rls_and_seed.sql (or 004) in Supabase SQL Editor to add missing ${tableHint} columns.`;
  }

  if (code === 'PGRST205' || (lower.includes('could not find the table') && lower.includes('schema cache'))) {
    return `${base} — Missing table (${tableHint}). Run SQL migration 005_complete_ruralcare_tables_rls_and_seed.sql in Supabase SQL Editor.`;
  }

  if (code === 'PGRST200' || lower.includes('could not find a relationship')) {
    return `${base} — Missing foreign-key relationship on ${tableHint}. Run SQL migration 005_complete_ruralcare_tables_rls_and_seed.sql and reload PostgREST schema cache.`;
  }

  if (code === '42501' || lower.includes('row-level security')) {
    return `${base} — Check Supabase RLS policies on ${tableHint} for authenticated users.`;
  }

  return base;
}

const LOGGED_PREFIX_RE = /^(Load|Insert|Update|Delete|Book|Lookup|Upload|Sign|Fetch)\s[^:]+:\s/;

export function logSupabaseError(operation: string, err: unknown, tableHint = 'profiles'): string {
  if (err instanceof Error && LOGGED_PREFIX_RE.test(err.message)) {
    return err.message;
  }
  const rec = err && typeof err === 'object' ? (err as Record<string, unknown>) : {};
  const code = typeof rec.code === 'string' ? rec.code.trim() : '';
  const message = err instanceof Error ? err.message : rec.message ?? String(err);
  const lowerMsg = String(message).toLowerCase();
  const isReadMissingTable =
    operation.startsWith('Load ') &&
    (code === 'PGRST205' ||
      (lowerMsg.includes('could not find the table') && lowerMsg.includes('schema cache')));

  const payload = {
    table: tableHint,
    code: rec.code ?? null,
    message,
    details: rec.details ?? null,
    hint: rec.hint ?? null,
  };

  if (isReadMissingTable) {
    console.warn(`[RuralCare Supabase Migration Needed] ${operation}`, payload);
  } else {
    console.error(`[RuralCare Supabase Error] ${operation}`, payload);
  }

  return `${operation}: ${formatSupabaseDatabaseError(err, tableHint)}`;
}

export interface PatientProfileInsertRow {
  id: string;
  role: 'patient';
  health_id: string;
  full_name: string;
  date_of_birth: string | null;
  age: number | null;
  gender: string;
  email: string;
  mobile_number: string;
  village: string;
  district: string;
  state: string;
  full_address: string;
  pin_code: string;
  blood_group: string;
  emergency_contact_name: string;
  emergency_contact_number: string;
}

export function buildPatientProfileUpsertPayload(
  userId: string,
  healthId: string,
  fields: {
    fullName: string;
    dateOfBirth: string | null;
    age: number | null;
    gender: string;
    email: string;
    mobileNumber: string;
    village: string;
    district: string;
    state: string;
    fullAddress: string;
    pinCode: string;
    bloodGroup: string;
    emergencyContactName: string;
    emergencyContactNumber: string;
  }
): PatientProfileInsertRow {
  if (!userId.trim()) {
    throw new Error('Authenticated user UUID is missing; cannot save patient profile.');
  }

  return {
    id: userId.trim(),
    role: 'patient',
    health_id: healthId.trim(),
    full_name: fields.fullName.trim(),
    date_of_birth: fields.dateOfBirth || null,
    age: fields.age,
    gender: fields.gender.trim(),
    email: fields.email.trim().toLowerCase(),
    mobile_number: normalizeMobile(fields.mobileNumber),
    village: fields.village.trim(),
    district: fields.district.trim(),
    state: fields.state.trim(),
    full_address: fields.fullAddress.trim(),
    pin_code: fields.pinCode.trim(),
    blood_group: fields.bloodGroup.trim(),
    emergency_contact_name: fields.emergencyContactName.trim(),
    emergency_contact_number: normalizeMobile(fields.emergencyContactNumber),
  };
}

export function mapSupabaseAuthErrorKey(message: string): string | undefined {
  const lower = (message || '').toLowerCase();
  if (lower.includes('failed to fetch') || lower.includes('networkerror') || lower.includes('network')) {
    return 'supabase.networkError';
  }
  if (lower.includes('missing') || lower.includes('not configured')) {
    return 'supabase.missingConfig';
  }
  if (lower.includes('invalid login credentials') || lower.includes('invalid credentials')) {
    return 'supabase.invalidCredentials';
  }
  if (lower.includes('email not confirmed')) {
    return 'supabase.emailNotConfirmed';
  }
  if (lower.includes('already registered') || lower.includes('already exists') || lower.includes('duplicate')) {
    return 'supabase.emailAlreadyRegistered';
  }
  if (lower.includes('rate limit') || lower.includes('too many requests')) {
    return 'supabase.rateLimited';
  }
  return undefined;
}

export function resolveAuthErrorMessage(
  outcome: { errorKey?: string; errorMessage?: string },
  t: (key: string) => string,
  fallbackKey: string
): string {
  const rawMessage = outcome.errorMessage?.trim();
  const key = outcome.errorKey;

  if (key === 'supabase.profileFetchError' || key === 'supabase.profileSaveFailed') {
    const translated = t(key);
    return rawMessage ? `${translated} (${rawMessage})` : translated;
  }

  if (key && key !== 'supabase.genericAuthError') {
    return t(key);
  }

  if (rawMessage) {
    return rawMessage;
  }

  return t(fallbackKey);
}

export function formatRelativeTimeLabel(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return isoDate;
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hr ago`;
  return date.toISOString().slice(0, 10);
}

export function mapProfileRowToPatient(
  row: Record<string, unknown>,
  options?: {
    avatarUrl?: string;
    allergies?: string[];
    chronicConditions?: string[];
    medicalRecords?: MedicalRecordItem[];
    diagnosticReports?: DiagnosticReportItem[];
  }
): PatientProfile {
  return {
    id: String(row.id ?? ''),
    healthId: String(row.health_id ?? ''),
    fullName: String(row.full_name ?? ''),
    dateOfBirth: String(row.date_of_birth ?? ''),
    age: Number(row.age ?? 0),
    gender: String(row.gender ?? ''),
    mobileNumber: String(row.mobile_number ?? ''),
    email: String(row.email ?? ''),
    village: String(row.village ?? ''),
    district: String(row.district ?? ''),
    state: String(row.state ?? ''),
    address: String(row.full_address ?? ''),
    pinCode: String(row.pin_code ?? ''),
    bloodGroup: String(row.blood_group ?? ''),
    emergencyContactName: String(row.emergency_contact_name ?? ''),
    emergencyContactNumber: String(row.emergency_contact_number ?? ''),
    avatarPath: (row.avatar_path as string | null) ?? null,
    avatarUrl: options?.avatarUrl || DEFAULT_PATIENT_AVATAR,
    allergies: options?.allergies ?? [],
    chronicConditions: options?.chronicConditions ?? [],
    medicalRecords: options?.medicalRecords ?? [],
    diagnosticReports: options?.diagnosticReports ?? [],
  };
}

export function mapDoctorRowToAccount(
  row: Record<string, unknown>,
  signedPhotoUrl?: string
): DoctorAccountProfile {
  return {
    id: String(row.id ?? ''),
    userId: row.user_id ? String(row.user_id) : undefined,
    doctorCode: String(row.doctor_code ?? ''),
    registrationNumber: String(row.registration_number ?? row.doctor_code ?? ''),
    fullName: String(row.full_name ?? ''),
    specialization: String(row.specialization ?? ''),
    qualifications: String(row.qualification ?? ''),
    experienceYears: Number(row.experience_years ?? 0),
    hospital: String(row.hospital_name ?? ''),
    hospitalAddress: String(row.hospital_address ?? ''),
    district: String(row.district ?? ''),
    timings: String(row.available_timings ?? ''),
    phone: String(row.mobile_number ?? ''),
    email: String(row.email ?? ''),
    location: String(row.location ?? row.hospital_address ?? ''),
    consultationFee: row.consultation_fee != null ? Number(row.consultation_fee) : undefined,
    availableDays: Array.isArray(row.available_days)
      ? (row.available_days as string[])
      : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    availableToday: Boolean(row.available_today),
    verificationStatus: (row.verification_status as DoctorVerificationStatus) ?? 'Pending Verification',
    isActive: Boolean(row.is_active),
    photoPath: (row.photo_path as string | null) ?? null,
    photoUrl: signedPhotoUrl || (row.photo_url ? String(row.photo_url) : DEFAULT_DOCTOR_AVATAR),
  };
}

export function mapDoctorRowToDirectoryDoctor(
  row: Record<string, unknown>,
  availabilityRows: DoctorAvailabilitySlot[] = []
): Doctor {
  const openSlots = availabilityRows
    .filter((a) => a.status === 'Available')
    .map((a) => a.slotLabel);

  return {
    id: String(row.id ?? ''),
    userId: row.user_id ? String(row.user_id) : null,
    doctorCode: String(row.doctor_code ?? ''),
    name: String(row.full_name ?? ''),
    email: String(row.email ?? ''),
    specialization: String(row.specialization ?? ''),
    qualifications: String(row.qualification ?? ''),
    experienceYears: Number(row.experience_years ?? 0),
    hospital: String(row.hospital_name ?? ''),
    hospitalAddress: String(row.hospital_address ?? ''),
    district: String(row.district ?? ''),
    timings: String(row.available_timings ?? ''),
    phone: String(row.mobile_number ?? ''),
    location: String(row.location ?? row.hospital_address ?? ''),
    distanceKm: Number(row.distance_km ?? 5.0),
    consultationFee: row.consultation_fee != null ? Number(row.consultation_fee) : undefined,
    availableDays: Array.isArray(row.available_days) ? (row.available_days as string[]) : [],
    availableToday: Boolean(row.available_today),
    verificationStatus: (row.verification_status as DoctorVerificationStatus) ?? 'Pending Verification',
    isActive: Boolean(row.is_active),
    languages: Array.isArray(row.languages) ? (row.languages as string[]) : ['English', 'Kannada'],
    photoUrl: row.photo_url ? String(row.photo_url) : DEFAULT_DOCTOR_AVATAR,
    consultationSlots: openSlots.length > 0 ? Array.from(new Set(openSlots)) : DEFAULT_SLOTS,
    availabilityRows,
  };
}

export function mapAvailabilityRow(row: Record<string, unknown>): DoctorAvailabilitySlot {
  return {
    id: String(row.id ?? ''),
    doctorId: String(row.doctor_id ?? ''),
    availableDate: row.available_date ? String(row.available_date) : null,
    availableDay: String(row.available_day ?? ''),
    startTime: String(row.start_time ?? ''),
    endTime: String(row.end_time ?? ''),
    slotLabel: String(row.slot_label ?? ''),
    status: row.status === 'Unavailable' ? 'Unavailable' : 'Available',
  };
}

export function mapAppointmentRow(row: Record<string, unknown>): Appointment {
  const doc = (row.doctor_profiles as Record<string, unknown> | null) ?? null;
  const pat = (row.profiles as Record<string, unknown> | null) ?? null;
  return {
    id: String(row.id ?? ''),
    patientId: row.patient_id ? String(row.patient_id) : undefined,
    doctorId: String(row.doctor_id ?? ''),
    doctorName: doc?.full_name ? String(doc.full_name) : String(row.doctor_name ?? 'Doctor'),
    patientName: pat?.full_name ? String(pat.full_name) : undefined,
    patientHealthId: pat?.health_id ? String(pat.health_id) : undefined,
    patientVillage: pat?.village ? String(pat.village) : undefined,
    patientMobile: pat?.mobile_number ? String(pat.mobile_number) : undefined,
    specialization: doc?.specialization ? String(doc.specialization) : String(row.specialization ?? ''),
    hospital: doc?.hospital_name ? String(doc.hospital_name) : String(row.hospital ?? ''),
    date: String(row.appointment_date ?? ''),
    timeSlot: String(row.appointment_time ?? ''),
    consultationType:
      row.consultation_type === 'Teleconsultation'
        ? 'Teleconsultation'
        : ('In-Person' as ConsultationType),
    reason: String(row.patient_message ?? ''),
    status: (row.status as AppointmentStatus) ?? 'Pending',
    rejectionReason: row.rejection_reason ? String(row.rejection_reason) : null,
    createdAt: row.created_at ? String(row.created_at).slice(0, 10) : '',
  };
}

export function mapMedicalRecordRow(row: Record<string, unknown>): MedicalRecordItem {
  return {
    id: String(row.id ?? ''),
    patientId: row.patient_id ? String(row.patient_id) : undefined,
    recordedByDoctorId: row.recorded_by_doctor_id ? String(row.recorded_by_doctor_id) : null,
    date: String(row.record_date ?? ''),
    title: String(row.title ?? ''),
    titleKn: row.title_kn ? String(row.title_kn) : undefined,
    doctor: String(row.doctor_name ?? ''),
    facility: String(row.facility_name ?? ''),
    summary: String(row.summary ?? ''),
    summaryKn: row.summary_kn ? String(row.summary_kn) : undefined,
    recordType: row.record_type ? String(row.record_type) : undefined,
  };
}

export function mapDiagnosticReportRow(row: Record<string, unknown>): DiagnosticReportItem {
  return {
    id: String(row.id ?? ''),
    patientId: String(row.patient_id ?? ''),
    laboratoryName: String(row.laboratory_name ?? ''),
    testName: String(row.test_name ?? ''),
    testDate: String(row.test_date ?? ''),
    reportDate: row.report_date ? String(row.report_date) : null,
    reportFilePath: row.report_file_path ? String(row.report_file_path) : null,
    fileName: row.file_name ? String(row.file_name) : null,
    reportStatus:
      (row.report_status as DiagnosticReportItem['reportStatus']) ?? 'Ready',
    notes: row.notes ? String(row.notes) : undefined,
    createdAt: row.created_at ? String(row.created_at).slice(0, 10) : '',
  };
}

export function mapServiceRow(row: Record<string, unknown>): HealthcareService {
  return {
    id: String(row.id ?? ''),
    category: row.category as ServiceCategory,
    title: String(row.title ?? ''),
    titleKn: row.title_kn ? String(row.title_kn) : undefined,
    facilityName: String(row.facility_name ?? ''),
    facilityNameKn: row.facility_name_kn ? String(row.facility_name_kn) : String(row.facility_name ?? ''),
    distance: String(row.distance ?? ''),
    distanceKn: row.distance_kn ? String(row.distance_kn) : String(row.distance ?? ''),
    timings: String(row.timings ?? ''),
    timingsKn: row.timings_kn ? String(row.timings_kn) : String(row.timings ?? ''),
    contact: String(row.contact ?? ''),
    description: String(row.description ?? ''),
    descriptionKn: row.description_kn ? String(row.description_kn) : String(row.description ?? ''),
    highlights: Array.isArray(row.highlights) ? (row.highlights as string[]) : [],
    highlightsKn: Array.isArray(row.highlights_kn)
      ? (row.highlights_kn as string[])
      : Array.isArray(row.highlights)
      ? (row.highlights as string[])
      : [],
  };
}

export function mapEmergencyRow(row: Record<string, unknown>): EmergencyEvent {
  const lat = row.gps_latitude != null ? Number(row.gps_latitude) : null;
  const lon = row.gps_longitude != null ? Number(row.gps_longitude) : null;
  const pat = (row.profiles as Record<string, unknown> | null) ?? null;
  const ts = row.alert_timestamp ? String(row.alert_timestamp) : String(row.created_at ?? '');
  const formattedTs = ts
    ? `${ts.slice(0, 10)} · ${new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : '';

  return {
    id: String(row.id ?? ''),
    patientId: row.patient_id ? String(row.patient_id) : undefined,
    patientName: pat?.full_name ? String(pat.full_name) : undefined,
    patientVillage: pat?.village ? String(pat.village) : undefined,
    patientBloodGroup: pat?.blood_group ? String(pat.blood_group) : undefined,
    triggeredAt: formattedTs,
    locationLabel: String(row.location_label ?? ''),
    latitude: lat,
    longitude: lon,
    coordinates:
      lat !== null && lon !== null ? `${lat.toFixed(4)}°, ${lon.toFixed(4)}°` : null,
    locationStatus: row.location_sharing_status === 'Shared' ? 'Shared' : 'Unavailable',
    contactNotified: `${String(row.emergency_contact_name ?? '')} (${String(
      row.emergency_contact_number ?? ''
    )})`,
    status: (row.emergency_status as EmergencyEvent['status']) ?? 'Logged',
    notes: String(row.emergency_description ?? ''),
  };
}

export function mapNotificationRow(row: Record<string, unknown>): NotificationItem {
  const created = String(row.created_at ?? '');
  return {
    id: String(row.id ?? ''),
    userId: row.user_id ? String(row.user_id) : undefined,
    title: String(row.title ?? ''),
    titleKn: row.title_kn ? String(row.title_kn) : undefined,
    message: String(row.message ?? ''),
    messageKn: row.message_kn ? String(row.message_kn) : undefined,
    notificationType: String(row.notification_type ?? 'general'),
    time: formatRelativeTimeLabel(created),
    read: Boolean(row.is_read),
    domainRoute: String(row.domain_route ?? '/dashboard'),
    createdAt: created,
  };
}

export function mapConnectionRowToThread(
  row: Record<string, unknown>,
  messagesRows: Record<string, unknown>[]
): ConsultationThread {
  const doc = (row.doctor_profiles as Record<string, unknown> | null) ?? null;
  const pat = (row.profiles as Record<string, unknown> | null) ?? null;

  return {
    id: String(row.id ?? ''),
    patientId: row.patient_id ? String(row.patient_id) : undefined,
    doctorId: String(row.doctor_id ?? ''),
    doctorName: doc?.full_name ? String(doc.full_name) : 'Doctor',
    patientName: pat?.full_name ? String(pat.full_name) : undefined,
    specialization: doc?.specialization ? String(doc.specialization) : '',
    status: (row.status as ConsultationThread['status']) ?? 'Pending',
    lastUpdated: formatRelativeTimeLabel(String(row.last_message_at ?? row.updated_at ?? '')),
    messages: messagesRows.map((m) => ({
      id: String(m.id ?? ''),
      sender: m.sender_role === 'doctor' ? 'doctor' : 'patient',
      text: String(m.message_text ?? ''),
      timestamp: formatRelativeTimeLabel(String(m.created_at ?? '')),
    })),
  };
}

export function isAppointmentSlotTaken(
  existingAppointments: Pick<Appointment, 'doctorId' | 'date' | 'timeSlot' | 'status'>[],
  doctorId: string,
  date: string,
  timeSlot: string
): boolean {
  return existingAppointments.some(
    (apt) =>
      apt.doctorId === doctorId &&
      apt.date === date &&
      apt.timeSlot === timeSlot &&
      (apt.status === 'Pending' || apt.status === 'Accepted')
  );
}

export function filterDoctorsDirectory(
  doctors: Doctor[],
  options: {
    searchQuery: string;
    specialization: string;
    district?: string;
    maxDistanceKm?: number | null;
    onlyAvailableToday?: boolean;
  }
): Doctor[] {
  const q = options.searchQuery.trim().toLowerCase();
  return doctors.filter((doc) => {
    const matchesQuery =
      !q ||
      doc.name.toLowerCase().includes(q) ||
      doc.specialization.toLowerCase().includes(q) ||
      doc.hospital.toLowerCase().includes(q) ||
      doc.district.toLowerCase().includes(q) ||
      doc.location.toLowerCase().includes(q);
    const matchesSpec =
      !options.specialization ||
      options.specialization === 'All' ||
      doc.specialization === options.specialization;
    const matchesDist =
      !options.district ||
      options.district === 'All' ||
      doc.district.toLowerCase() === options.district.toLowerCase();
    const matchesKm =
      options.maxDistanceKm == null || doc.distanceKm <= options.maxDistanceKm;
    const matchesAvail = !options.onlyAvailableToday || doc.availableToday;

    return matchesQuery && matchesSpec && matchesDist && matchesKm && matchesAvail;
  });
}

export function computePatientDashboardStats(input: {
  appointments: Pick<Appointment, 'status'>[];
  doctors: Pick<Doctor, 'availableToday'>[];
  consultations: Pick<ConsultationThread, 'status'>[];
  notifications: Pick<NotificationItem, 'read'>[];
}): {
  upcomingAppointmentsCount: number;
  availableDoctorsCount: number;
  activeConsultationsCount: number;
  unreadNotificationsCount: number;
} {
  return {
    upcomingAppointmentsCount: input.appointments.filter(
      (a) => a.status === 'Pending' || a.status === 'Accepted'
    ).length,
    availableDoctorsCount: input.doctors.filter((d) => d.availableToday).length,
    activeConsultationsCount: input.consultations.filter(
      (c) => c.status === 'Pending' || c.status === 'Accepted'
    ).length,
    unreadNotificationsCount: input.notifications.filter((n) => !n.read).length,
  };
}

export function computeDoctorDashboardStats(input: {
  appointments: Pick<Appointment, 'status'>[];
  consultations: Pick<ConsultationThread, 'status'>[];
  authorizedPatientsCount: number;
}): {
  pendingAppointmentsCount: number;
  acceptedAppointmentsCount: number;
  completedConsultationsCount: number;
  authorizedPatientsCount: number;
} {
  return {
    pendingAppointmentsCount: input.appointments.filter((a) => a.status === 'Pending').length,
    acceptedAppointmentsCount: input.appointments.filter((a) => a.status === 'Accepted').length,
    completedConsultationsCount: input.consultations.filter((c) => c.status === 'Completed').length,
    authorizedPatientsCount: input.authorizedPatientsCount,
  };
}

