import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateAgeFromDob,
  validateEmail,
  validateLoginIdentifier,
  validatePasswordStrength,
  validateRegistrationForm,
  validateProfileEdit,
} from './validation';
import {
  generateDemoHealthId,
  filterDoctors,
  updateAppointmentStatusList,
  generateQrMatrix,
} from './healthUtils';
import type { Appointment, Doctor } from '../types/ruralcare';

const TEST_DOCTORS: Doctor[] = [
  {
    id: 'doc-1',
    name: 'Dr. Priya Nair',
    specialization: 'General Medicine',
    qualifications: 'MBBS, MD',
    experienceYears: 9,
    hospital: 'Sitapur Community Health Center',
    district: 'Sitapur',
    timings: '09:00 AM - 02:00 PM',
    phone: '9876500001',
    location: 'Chandrapur',
    distanceKm: 3.5,
    availableDays: ['Mon', 'Tue', 'Wed'],
    availableToday: true,
    verificationStatus: 'Approved',
    isActive: true,
    languages: ['English', 'Kannada'],
    photoUrl: '',
    consultationSlots: ['09:30 AM', '10:30 AM'],
  },
  {
    id: 'doc-2',
    name: 'Dr. Ramesh Gowda',
    specialization: 'Orthopedics',
    qualifications: 'MBBS, MS',
    experienceYears: 12,
    hospital: 'District Hospital',
    district: 'Mandya',
    timings: '10:00 AM - 04:00 PM',
    phone: '9876500002',
    location: 'Mandya Town',
    distanceKm: 4.8,
    availableDays: ['Mon', 'Thu'],
    availableToday: true,
    verificationStatus: 'Approved',
    isActive: true,
    languages: ['English', 'Kannada'],
    photoUrl: '',
    consultationSlots: ['10:30 AM'],
  },
  {
    id: 'doc-3',
    name: 'Dr. Kavita Hegde',
    specialization: 'Pediatrics & Maternal Health',
    qualifications: 'MBBS, DCH',
    experienceYears: 7,
    hospital: 'Rural Maternal Care Center',
    district: 'Mysuru',
    timings: '09:00 AM - 01:00 PM',
    phone: '9876500003',
    location: 'Hunsur',
    distanceKm: 9.2,
    availableDays: ['Tue', 'Fri'],
    availableToday: false,
    verificationStatus: 'Approved',
    isActive: true,
    languages: ['English', 'Kannada'],
    photoUrl: '',
    consultationSlots: ['11:30 AM'],
  },
];

const TEST_APPOINTMENTS: Appointment[] = [
  {
    id: 'apt-101',
    doctorId: 'doc-1',
    doctorName: 'Dr. Priya Nair',
    specialization: 'General Medicine',
    hospital: 'Sitapur Community Health Center',
    date: '2026-11-20',
    timeSlot: '09:30 AM',
    consultationType: 'In-Person',
    reason: 'Fever',
    status: 'Accepted',
    createdAt: '2026-11-18',
  },
  {
    id: 'apt-102',
    doctorId: 'doc-2',
    doctorName: 'Dr. Ramesh Gowda',
    specialization: 'Orthopedics',
    hospital: 'District Hospital',
    date: '2026-11-21',
    timeSlot: '10:30 AM',
    consultationType: 'In-Person',
    reason: 'Knee pain',
    status: 'Pending',
    createdAt: '2026-11-18',
  },
];

test('calculateAgeFromDob computes exact age considering birthday month/day', () => {
  const ref = new Date('2026-11-18T00:00:00');
  assert.equal(calculateAgeFromDob('1988-05-14', ref), 38);
  assert.equal(calculateAgeFromDob('1988-12-01', ref), 37);
  assert.equal(calculateAgeFromDob('2030-01-01', ref), null);
  assert.equal(calculateAgeFromDob('', ref), null);
});

test('validateLoginIdentifier accepts valid email and 10-digit Indian mobile', () => {
  assert.equal(validateLoginIdentifier('patient@ruralcare.in'), null);
  assert.equal(validateLoginIdentifier('9876543210'), null);
  assert.equal(validateLoginIdentifier('+91 9876543210'), null);
  assert.ok(validateLoginIdentifier('') !== null);
  assert.ok(validateLoginIdentifier('invalid-email@') !== null);
  assert.ok(validateLoginIdentifier('12345') !== null);
});

test('validateEmail accepts valid doctor emails and rejects invalid formats', () => {
  assert.equal(validateEmail('doctor@ruralcare.in'), true);
  assert.equal(validateEmail('ananya.rao@hospital.org'), true);
  assert.equal(validateEmail(''), false);
  assert.equal(validateEmail('9415022310'), false);
  assert.equal(validateEmail('doctor@'), false);
});

test('validatePasswordStrength enforces 8+ chars with upper, lower, digit, special', () => {
  assert.equal(validatePasswordStrength('RuralCare@123'), null);
  assert.ok(validatePasswordStrength('short1!') !== null);
  assert.ok(validatePasswordStrength('ruralcare@123') !== null);
  assert.ok(validatePasswordStrength('RURALCARE@123') !== null);
  assert.ok(validatePasswordStrength('RuralCare@abc') !== null);
  assert.ok(validatePasswordStrength('RuralCare1234') !== null);
});

test('validateRegistrationForm returns field-level errors when invalid and empty object when valid', () => {
  const ref = new Date('2026-11-18T00:00:00');
  const invalidErrors = validateRegistrationForm(
    {
      fullName: '',
      dateOfBirth: '',
      gender: '',
      mobileNumber: '123',
      email: 'bad',
      password: 'weak',
      confirmPassword: 'other',
      village: '',
      district: '',
      state: '',
      fullAddress: '',
      pinCode: '12',
      bloodGroup: '',
      emergencyContactName: '',
      emergencyContactNumber: '999',
    },
    ref
  );
  assert.ok(invalidErrors.fullName);
  assert.ok(invalidErrors.dateOfBirth);
  assert.ok(invalidErrors.mobileNumber);
  assert.ok(invalidErrors.email);
  assert.ok(invalidErrors.password);
  assert.ok(invalidErrors.confirmPassword);
  assert.ok(invalidErrors.village);
  assert.ok(invalidErrors.district);
  assert.ok(invalidErrors.pinCode);
  assert.ok(invalidErrors.bloodGroup);
  assert.ok(invalidErrors.emergencyContactNumber);

  const validErrors = validateRegistrationForm(
    {
      fullName: 'Anita Devi',
      dateOfBirth: '1994-03-10',
      gender: 'Female',
      mobileNumber: '9876512345',
      email: 'anita@village.in',
      password: 'RuralCare@123',
      confirmPassword: 'RuralCare@123',
      village: 'Rampur',
      district: 'Sitapur',
      state: 'Uttar Pradesh',
      fullAddress: 'Near Panchayat Well, Rampur',
      pinCode: '261001',
      bloodGroup: 'O+',
      emergencyContactName: 'Mohan Lal',
      emergencyContactNumber: '9811122334',
    },
    ref
  );
  assert.deepEqual(validErrors, {});
});

test('validateProfileEdit validates editable profile fields cleanly', () => {
  const errs = validateProfileEdit({
    fullName: 'Ramesh Kumar',
    age: 38,
    gender: 'Male',
    mobileNumber: '9876543210',
    village: 'Chandrapur',
    district: 'Sitapur',
    address: 'House 42',
    bloodGroup: 'B+',
    emergencyContactName: 'Sunita',
    emergencyContactNumber: '9823411220',
  });
  assert.deepEqual(errs, {});
});

test('generateDemoHealthId creates formatted Health ID', () => {
  assert.equal(generateDemoHealthId('Anita Devi', 'Sitapur', 5042), 'RC-SIAN-5042');
});

test('filterDoctors filters by query, specialization, and distance', () => {
  const byName = filterDoctors(TEST_DOCTORS, 'Priya', 'All');
  assert.equal(byName.length, 1);
  assert.equal(byName[0].id, 'doc-1');

  const bySpec = filterDoctors(TEST_DOCTORS, '', 'Pediatrics & Maternal Health');
  assert.equal(bySpec.length, 1);
  assert.equal(bySpec[0].id, 'doc-3');

  const nearby = filterDoctors(TEST_DOCTORS, '', 'All', 5);
  assert.equal(nearby.length, 2);
});

test('updateAppointmentStatusList updates only the targeted appointment', () => {
  const updated = updateAppointmentStatusList(TEST_APPOINTMENTS, 'apt-102', 'Cancelled');
  assert.equal(updated.find((a) => a.id === 'apt-102')?.status, 'Cancelled');
  assert.equal(updated.find((a) => a.id === 'apt-101')?.status, 'Accepted');
});

test('generateQrMatrix returns deterministic 21x21 matrix with corner finder markers', () => {
  const m1 = generateQrMatrix('RC-SDCH-4821');
  const m2 = generateQrMatrix('RC-SDCH-4821');
  assert.equal(m1.length, 21);
  assert.equal(m1[0].length, 21);
  assert.deepEqual(m1, m2);
  // Top-left corner of finder pattern is true
  assert.equal(m1[0][0], true);
  assert.equal(m1[1][1], false);
  assert.equal(m1[3][3], true);
});

test('validateLoginIdentifier supports custom translator callback for Kannada messages', () => {
  const knMock = (key: string) =>
    key === 'validation.enterIdentifier'
      ? 'ದಯವಿಟ್ಟು ನಿಮ್ಮ ನೋಂದಾಯಿತ ಇಮೇಲ್ ವಿಳಾಸ ಅಥವಾ 10 ಅಂಕಿಯ ಮೊಬೈಲ್ ಸಂಖ್ಯೆಯನ್ನು ನಮೂದಿಸಿ.'
      : key;
  assert.equal(
    validateLoginIdentifier('', knMock),
    'ದಯವಿಟ್ಟು ನಿಮ್ಮ ನೋಂದಾಯಿತ ಇಮೇಲ್ ವಿಳಾಸ ಅಥವಾ 10 ಅಂಕಿಯ ಮೊಬೈಲ್ ಸಂಖ್ಯೆಯನ್ನು ನಮೂದಿಸಿ.'
  );
});
