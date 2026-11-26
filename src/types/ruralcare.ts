export type UserRole = 'patient' | 'doctor';

export type DoctorVerificationStatus =
  | 'Pending Verification'
  | 'Approved'
  | 'Rejected'
  | 'Suspended';

export type AppointmentStatus =
  | 'Pending'
  | 'Accepted'
  | 'Rejected'
  | 'Cancelled'
  | 'Completed';

export type ConsultationType = 'In-Person' | 'Teleconsultation';

export type ConnectionStatus =
  | 'Pending'
  | 'Accepted'
  | 'Rejected'
  | 'Cancelled'
  | 'Completed';

export interface MedicalRecordItem {
  id: string;
  patientId?: string;
  recordedByDoctorId?: string | null;
  date: string;
  title: string;
  titleKn?: string;
  doctor: string;
  facility: string;
  summary: string;
  summaryKn?: string;
  recordType?: string;
}

export interface AllergyItem {
  id: string;
  name: string;
  category: 'Allergy' | 'Chronic Condition';
  severity: 'Mild' | 'Moderate' | 'Severe';
  notes?: string;
}

export interface DiagnosticReportItem {
  id: string;
  patientId: string;
  laboratoryName: string;
  testName: string;
  testDate: string;
  reportDate: string | null;
  reportFilePath: string | null;
  fileName: string | null;
  reportStatus: 'Pending' | 'Processing' | 'Ready' | 'Reviewed';
  notes?: string;
  createdAt: string;
}

export interface PatientProfile {
  id: string;
  healthId: string;
  fullName: string;
  dateOfBirth: string;
  age: number;
  gender: string;
  mobileNumber: string;
  email: string;
  village: string;
  district: string;
  state: string;
  address: string;
  pinCode: string;
  bloodGroup: string;
  emergencyContactName: string;
  emergencyContactNumber: string;
  avatarPath?: string | null;
  avatarUrl: string;
  allergies: string[];
  allergyRecords?: AllergyItem[];
  chronicConditions: string[];
  medicalRecords: MedicalRecordItem[];
  diagnosticReports?: DiagnosticReportItem[];
}

export interface DoctorAvailabilitySlot {
  id: string;
  doctorId: string;
  availableDate: string | null;
  availableDay: string;
  startTime: string;
  endTime: string;
  slotLabel: string;
  status: 'Available' | 'Unavailable';
}

export interface DoctorAccountProfile {
  id: string;
  userId?: string;
  registrationNumber: string;
  doctorCode?: string;
  fullName: string;
  specialization: string;
  qualifications: string;
  experienceYears: number;
  hospital: string;
  hospitalAddress: string;
  district: string;
  timings: string;
  phone: string;
  email: string;
  location: string;
  consultationFee?: number;
  availableDays: string[];
  availableToday: boolean;
  verificationStatus: DoctorVerificationStatus;
  isActive: boolean;
  photoPath?: string | null;
  photoUrl: string;
}

export interface Doctor {
  id: string;
  userId?: string | null;
  doctorCode?: string;
  name: string;
  email?: string;
  specialization: string;
  qualifications: string;
  experienceYears: number;
  hospital: string;
  hospitalAddress?: string;
  district: string;
  timings: string;
  phone: string;
  location: string;
  distanceKm: number;
  consultationFee?: number;
  availableDays: string[];
  availableToday: boolean;
  verificationStatus: DoctorVerificationStatus;
  isActive: boolean;
  languages: string[];
  photoUrl: string;
  consultationSlots: string[];
  availabilityRows?: DoctorAvailabilitySlot[];
}

export interface Appointment {
  id: string;
  patientId?: string;
  doctorId: string;
  doctorName: string;
  patientName?: string;
  patientHealthId?: string;
  patientVillage?: string;
  patientMobile?: string;
  specialization: string;
  hospital: string;
  date: string;
  timeSlot: string;
  consultationType: ConsultationType;
  reason: string;
  status: AppointmentStatus;
  rejectionReason?: string | null;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  sender: 'patient' | 'doctor';
  text: string;
  timestamp: string;
}

export interface ConsultationThread {
  id: string;
  patientId?: string;
  doctorId: string;
  doctorName: string;
  patientName?: string;
  specialization: string;
  status: ConnectionStatus;
  lastUpdated: string;
  messages: ChatMessage[];
}

export type ServiceCategory =
  | 'Nearby Hospitals'
  | 'Pharmacy Services'
  | 'Ambulance Services'
  | 'Laboratory Services'
  | 'Health Camps'
  | 'Vaccination Information'
  | 'Government Healthcare Schemes'
  | 'Health Awareness';

export interface HealthcareService {
  id: string;
  category: ServiceCategory;
  title: string;
  titleKn?: string;
  facilityName: string;
  facilityNameKn: string;
  distance: string;
  distanceKn: string;
  timings: string;
  timingsKn: string;
  contact: string;
  description: string;
  descriptionKn: string;
  highlights: string[];
  highlightsKn: string[];
}

export interface EmergencyEvent {
  id: string;
  patientId?: string;
  patientName?: string;
  patientVillage?: string;
  patientBloodGroup?: string;
  triggeredAt: string;
  locationLabel: string;
  latitude: number | null;
  longitude: number | null;
  coordinates: string | null;
  locationStatus: 'Shared' | 'Unavailable';
  contactNotified: string;
  status: 'Logged' | 'Acknowledged' | 'Resolved';
  notes: string;
}

export interface NotificationItem {
  id: string;
  userId?: string;
  title: string;
  titleKn?: string;
  message: string;
  messageKn?: string;
  notificationType: string;
  time: string;
  timeKn?: string;
  read: boolean;
  domainRoute: string;
  createdAt?: string;
}

export interface RegisterPayload {
  fullName: string;
  dateOfBirth: string;
  gender: string;
  mobileNumber: string;
  email: string;
  password: string;
  village: string;
  district: string;
  state: string;
  fullAddress: string;
  pinCode: string;
  bloodGroup: string;
  emergencyContactName: string;
  emergencyContactNumber: string;
}

export interface DoctorRegisterPayload {
  fullName: string;
  email: string;
  mobileNumber: string;
  medicalRegistrationNumber: string;
  qualification: string;
  specialization: string;
  experienceYears: number;
  hospitalName: string;
  hospitalAddress: string;
  district: string;
  password: string;
}
