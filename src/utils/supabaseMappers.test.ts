import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPatientProfileUpsertPayload,
  computeDoctorDashboardStats,
  computePatientDashboardStats,
  extractSupabaseErrorMessage,
  filterDoctorsDirectory,
  formatSupabaseDatabaseError,
  isAppointmentSlotTaken,
  logSupabaseError,
  mapAppointmentRow,
  mapDoctorRowToAccount,
  mapEmergencyRow,
  mapProfileRowToPatient,
  mapSupabaseAuthErrorKey,
  normalizeSupabaseUrl,
  resolveAuthErrorMessage,
} from './supabaseMappers';
import { validateDoctorRegistrationForm } from './validation';

test('normalizeSupabaseUrl strips /rest/v1, /auth/v1, and trailing slashes', () => {
  assert.equal(
    normalizeSupabaseUrl('https://ujzajmmxepbcqwrqkyba.supabase.co/rest/v1/'),
    'https://ujzajmmxepbcqwrqkyba.supabase.co'
  );
  assert.equal(
    normalizeSupabaseUrl('https://ujzajmmxepbcqwrqkyba.supabase.co/'),
    'https://ujzajmmxepbcqwrqkyba.supabase.co'
  );
  assert.equal(normalizeSupabaseUrl('not-a-url'), '');
});

test('mapSupabaseAuthErrorKey maps known errors and leaves custom Supabase messages unmasked', () => {
  assert.equal(mapSupabaseAuthErrorKey('Failed to fetch'), 'supabase.networkError');
  assert.equal(mapSupabaseAuthErrorKey('Invalid login credentials'), 'supabase.invalidCredentials');
  assert.equal(mapSupabaseAuthErrorKey('User already registered'), 'supabase.emailAlreadyRegistered');
  assert.equal(mapSupabaseAuthErrorKey('Email not confirmed'), 'supabase.emailNotConfirmed');
  assert.equal(mapSupabaseAuthErrorKey('Email address "foo@example.com" is invalid'), undefined);
  assert.equal(mapSupabaseAuthErrorKey('Database error saving new user'), undefined);
});

test('resolveAuthErrorMessage preserves actual Supabase error message when no specific translation applies', () => {
  const mockT = (k: string) => ({
    'supabase.invalidCredentials': 'Translated invalid credentials',
    'supabase.profileSaveFailed': 'Profile save failed',
    'supabase.genericAuthError': 'Authentication failed. Please verify your details and try again.',
    'common.errorGeneric': 'Something went wrong',
  }[k] ?? k);

  assert.equal(
    resolveAuthErrorMessage(
      { errorKey: undefined, errorMessage: 'Email address "foo@example.com" is invalid' },
      mockT,
      'common.errorGeneric'
    ),
    'Email address "foo@example.com" is invalid'
  );
  assert.equal(
    resolveAuthErrorMessage(
      { errorKey: 'supabase.genericAuthError', errorMessage: 'Password should be at least 6 characters.' },
      mockT,
      'common.errorGeneric'
    ),
    'Password should be at least 6 characters.'
  );
  assert.equal(
    resolveAuthErrorMessage(
      { errorKey: 'supabase.profileSaveFailed', errorMessage: 'duplicate key value violates unique constraint' },
      mockT,
      'common.errorGeneric'
    ),
    'Profile save failed (duplicate key value violates unique constraint)'
  );
  assert.equal(
    resolveAuthErrorMessage(
      { errorKey: 'supabase.invalidCredentials', errorMessage: 'Invalid login credentials' },
      mockT,
      'common.errorGeneric'
    ),
    'Translated invalid credentials'
  );
});

test('mapProfileRowToPatient maps snake_case database columns to PatientProfile', () => {
  const patient = mapProfileRowToPatient({
    id: 'uuid-123',
    health_id: 'RC-SIAN-1024',
    full_name: 'Anita Devi',
    date_of_birth: '1990-02-10',
    age: 36,
    gender: 'Female',
    mobile_number: '9876543210',
    email: 'anita@ruralcare.in',
    village: 'Chandrapur',
    district: 'Sitapur',
    state: 'Uttar Pradesh',
    full_address: 'Ward 4',
    pin_code: '261001',
    blood_group: 'O+',
    emergency_contact_name: 'Rohan',
    emergency_contact_number: '9876500000',
  });

  assert.equal(patient.id, 'uuid-123');
  assert.equal(patient.healthId, 'RC-SIAN-1024');
  assert.equal(patient.fullName, 'Anita Devi');
  assert.equal(patient.district, 'Sitapur');
  assert.equal(patient.bloodGroup, 'O+');
});

test('mapDoctorRowToAccount preserves verification status and active flag', () => {
  const doc = mapDoctorRowToAccount({
    id: 'doc-uuid',
    user_id: 'user-uuid',
    doctor_code: 'RC-DOC-001',
    registration_number: 'RC-DOC-001',
    full_name: 'Dr. Ananya Rao',
    specialization: 'General Physician',
    qualification: 'MBBS, MD',
    experience_years: 11,
    hospital_name: 'RuralCare Community Hospital',
    hospital_address: 'Block Road',
    district: 'Sitapur',
    mobile_number: '9415022310',
    email: 'doctor@ruralcare.in',
    verification_status: 'Pending Verification',
    is_active: false,
    available_today: true,
  });

  assert.equal(doc.verificationStatus, 'Pending Verification');
  assert.equal(doc.isActive, false);
  assert.equal(doc.fullName, 'Dr. Ananya Rao');
});

test('isAppointmentSlotTaken blocks active Pending/Accepted slots and frees Cancelled/Rejected slots', () => {
  const existing = [
    { doctorId: 'd1', date: '2026-12-01', timeSlot: '10:30 AM', status: 'Pending' as const },
    { doctorId: 'd1', date: '2026-12-01', timeSlot: '11:30 AM', status: 'Cancelled' as const },
    { doctorId: 'd1', date: '2026-12-01', timeSlot: '01:00 PM', status: 'Rejected' as const },
  ];

  assert.equal(isAppointmentSlotTaken(existing, 'd1', '2026-12-01', '10:30 AM'), true);
  assert.equal(isAppointmentSlotTaken(existing, 'd1', '2026-12-01', '11:30 AM'), false);
  assert.equal(isAppointmentSlotTaken(existing, 'd1', '2026-12-01', '01:00 PM'), false);
  assert.equal(isAppointmentSlotTaken(existing, 'd2', '2026-12-01', '10:30 AM'), false);
});

test('filterDoctorsDirectory filters by district, specialization, and availability', () => {
  const doctors = [
    {
      id: 'd1',
      name: 'Dr. Ananya Rao',
      specialization: 'General Physician',
      qualifications: 'MBBS, MD',
      experienceYears: 10,
      hospital: 'RuralCare Community Hospital',
      district: 'Sitapur',
      timings: '09:00 AM',
      phone: '9415022310',
      location: 'Sitapur',
      distanceKm: 4,
      availableDays: ['Mon'],
      availableToday: true,
      verificationStatus: 'Approved' as const,
      isActive: true,
      languages: ['English', 'Kannada'],
      photoUrl: '',
      consultationSlots: ['09:30 AM'],
    },
    {
      id: 'd2',
      name: 'Dr. Ravi Hegde',
      specialization: 'Pediatrics',
      qualifications: 'MBBS, DCH',
      experienceYears: 7,
      hospital: 'Mandya CHC',
      district: 'Mandya',
      timings: '10:00 AM',
      phone: '9415022311',
      location: 'Mandya',
      distanceKm: 12,
      availableDays: ['Tue'],
      availableToday: false,
      verificationStatus: 'Approved' as const,
      isActive: true,
      languages: ['Kannada'],
      photoUrl: '',
      consultationSlots: ['10:30 AM'],
    },
  ];

  assert.equal(filterDoctorsDirectory(doctors, { searchQuery: '', specialization: 'All', district: 'Mandya' }).length, 1);
  assert.equal(filterDoctorsDirectory(doctors, { searchQuery: '', specialization: 'All', onlyAvailableToday: true }).length, 1);
  assert.equal(filterDoctorsDirectory(doctors, { searchQuery: 'Ananya', specialization: 'All' }).length, 1);
});

test('mapEmergencyRow handles missing GPS without generating fake coordinates', () => {
  const withoutGps = mapEmergencyRow({
    id: 'e1',
    patient_id: 'p1',
    emergency_contact_name: 'Sunita',
    emergency_contact_number: '9823411220',
    emergency_description: 'Chest pain',
    location_label: 'Chandrapur',
    gps_latitude: null,
    gps_longitude: null,
    location_sharing_status: 'Unavailable',
    emergency_status: 'Logged',
    alert_timestamp: '2026-11-18T10:00:00Z',
  });
  assert.equal(withoutGps.coordinates, null);
  assert.equal(withoutGps.locationStatus, 'Unavailable');

  const withGps = mapEmergencyRow({
    id: 'e2',
    patient_id: 'p1',
    emergency_contact_name: 'Sunita',
    emergency_contact_number: '9823411220',
    emergency_description: 'High fever',
    location_label: 'Chandrapur',
    gps_latitude: 12.9716,
    gps_longitude: 77.5946,
    location_sharing_status: 'Shared',
    emergency_status: 'Acknowledged',
    alert_timestamp: '2026-11-18T10:00:00Z',
  });
  assert.equal(withGps.coordinates, '12.9716°, 77.5946°');
  assert.equal(withGps.status, 'Acknowledged');
});

test('mapAppointmentRow maps rejection reason and consultation type', () => {
  const apt = mapAppointmentRow({
    id: 'a1',
    doctor_id: 'd1',
    appointment_date: '2026-12-01',
    appointment_time: '10:30 AM',
    consultation_type: 'Teleconsultation',
    patient_message: 'Follow-up',
    status: 'Rejected',
    rejection_reason: 'Doctor on emergency duty',
    doctor_profiles: { full_name: 'Dr. Ananya Rao', specialization: 'General Physician', hospital_name: 'CHC' },
    profiles: { full_name: 'Ramesh', health_id: 'RC-1' },
  });
  assert.equal(apt.consultationType, 'Teleconsultation');
  assert.equal(apt.rejectionReason, 'Doctor on emergency duty');
  assert.equal(apt.patientName, 'Ramesh');
});

test('validateDoctorRegistrationForm requires valid medical registration and strong password', () => {
  const errors = validateDoctorRegistrationForm({
    fullName: 'Dr. Kavya',
    email: 'invalid',
    mobileNumber: '123',
    medicalRegistrationNumber: '12',
    qualification: '',
    specialization: '',
    experienceYears: '',
    hospitalName: '',
    hospitalAddress: '',
    district: '',
    password: 'weak',
    confirmPassword: 'different',
  });
  assert.ok(errors.email);
  assert.ok(errors.mobileNumber);
  assert.ok(errors.medicalRegistrationNumber);
  assert.ok(errors.qualification);
  assert.ok(errors.password);
  assert.ok(errors.confirmPassword);
});

test('extractSupabaseErrorMessage and formatSupabaseDatabaseError surface PostgreSQL schema/RLS errors clearly', () => {
  const missingColErr = { code: '42703', message: 'column profiles.health_id does not exist' };
  assert.equal(
    extractSupabaseErrorMessage(missingColErr),
    '[42703] column profiles.health_id does not exist'
  );
  assert.match(
    formatSupabaseDatabaseError(missingColErr, 'profiles'),
    /005_complete_ruralcare_tables_rls_and_seed\.sql/
  );

  const missingTableErr = {
    code: 'PGRST205',
    message: "Could not find the table 'public.health_cards' in the schema cache",
  };
  assert.match(
    formatSupabaseDatabaseError(missingTableErr, 'health_cards'),
    /Missing table \(health_cards\).*005_complete_ruralcare_tables_rls_and_seed\.sql/
  );

  const missingFkErr = {
    code: 'PGRST200',
    message: "Could not find a relationship between 'appointments' and 'doctor_profiles'",
  };
  assert.match(
    formatSupabaseDatabaseError(missingFkErr, 'appointments'),
    /Missing foreign-key relationship on appointments/
  );

  const rlsErr = {
    code: '42501',
    message: 'new row violates row-level security policy for table "profiles"',
  };
  assert.match(
    formatSupabaseDatabaseError(rlsErr, 'profiles'),
    /Check Supabase RLS policies on profiles/
  );

  const origWarn = console.warn;
  const origError = console.error;
  const warns: unknown[][] = [];
  const errs: unknown[][] = [];
  console.warn = (...args: unknown[]) => warns.push(args);
  console.error = (...args: unknown[]) => errs.push(args);
  try {
    const loggedMessage = logSupabaseError('Load appointments', missingTableErr, 'appointments');
    assert.match(loggedMessage, /^Load appointments: \[PGRST205\]/);
    assert.equal(warns.length, 1);
    assert.equal(errs.length, 0);

    const rlsLogged = logSupabaseError('Update profiles', rlsErr, 'profiles');
    assert.match(rlsLogged, /^Update profiles: \[42501\]/);
    assert.equal(errs.length, 1);
  } finally {
    console.warn = origWarn;
    console.error = origError;
  }
});

test('buildPatientProfileUpsertPayload includes authenticated UUID and all 17 profiles columns', () => {
  assert.throws(() =>
    buildPatientProfileUpsertPayload('   ', 'RC-SIAN-1001', {
      fullName: 'Anita Devi',
      dateOfBirth: '1992-05-14',
      age: 34,
      gender: 'Female',
      email: 'Anita@Example.com',
      mobileNumber: '+91 9876543210',
      village: 'Chandrapur',
      district: 'Sitapur',
      state: 'Karnataka',
      fullAddress: 'Ward 2',
      pinCode: '560001',
      bloodGroup: 'O+',
      emergencyContactName: 'Rohan',
      emergencyContactNumber: '9876500000',
    })
  );

  const row = buildPatientProfileUpsertPayload('11111111-2222-3333-4444-555555555555', 'RC-SIAN-1001', {
    fullName: ' Anita Devi ',
    dateOfBirth: '1992-05-14',
    age: 34,
    gender: 'Female',
    email: ' Anita@Example.com ',
    mobileNumber: '+91 9876543210',
    village: ' Chandrapur ',
    district: ' Sitapur ',
    state: ' Karnataka ',
    fullAddress: ' Ward 2 ',
    pinCode: ' 560001 ',
    bloodGroup: 'O+',
    emergencyContactName: ' Rohan ',
    emergencyContactNumber: '09876500000',
  });

  assert.equal(row.id, '11111111-2222-3333-4444-555555555555');
  assert.equal(row.role, 'patient');
  assert.equal(row.health_id, 'RC-SIAN-1001');
  assert.equal(row.email, 'anita@example.com');
  assert.equal(row.mobile_number, '9876543210');
  assert.equal(row.emergency_contact_number, '9876500000');
  assert.deepEqual(Object.keys(row).sort(), [
    'age',
    'blood_group',
    'date_of_birth',
    'district',
    'email',
    'emergency_contact_name',
    'emergency_contact_number',
    'full_address',
    'full_name',
    'gender',
    'health_id',
    'id',
    'mobile_number',
    'pin_code',
    'role',
    'state',
    'village',
  ]);
});

test('computePatientDashboardStats excludes Rejected, Cancelled, and Completed consultations from active count', () => {
  const stats = computePatientDashboardStats({
    appointments: [
      { status: 'Pending' },
      { status: 'Accepted' },
      { status: 'Completed' },
      { status: 'Cancelled' },
    ],
    doctors: [
      { availableToday: true },
      { availableToday: false },
      { availableToday: true },
    ],
    consultations: [
      { status: 'Pending' },
      { status: 'Accepted' },
      { status: 'Rejected' },
      { status: 'Cancelled' },
      { status: 'Completed' },
    ],
    notifications: [{ read: false }, { read: true }, { read: false }],
  });

  assert.equal(stats.upcomingAppointmentsCount, 2);
  assert.equal(stats.availableDoctorsCount, 2);
  assert.equal(stats.activeConsultationsCount, 2);
  assert.equal(stats.unreadNotificationsCount, 2);
});

test('computeDoctorDashboardStats summarizes pending, accepted, completed, and authorized patients', () => {
  const stats = computeDoctorDashboardStats({
    appointments: [
      { status: 'Pending' },
      { status: 'Pending' },
      { status: 'Accepted' },
      { status: 'Rejected' },
    ],
    consultations: [
      { status: 'Accepted' },
      { status: 'Completed' },
      { status: 'Completed' },
    ],
    authorizedPatientsCount: 3,
  });

  assert.equal(stats.pendingAppointmentsCount, 2);
  assert.equal(stats.acceptedAppointmentsCount, 1);
  assert.equal(stats.completedConsultationsCount, 2);
  assert.equal(stats.authorizedPatientsCount, 3);
});


