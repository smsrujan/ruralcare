export interface PatientProfile {
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
  avatarUrl: string;
  allergies: string[];
  chronicConditions: string[];
  medicalRecords: {
    id: string;
    date: string;
    title: string;
    titleKn?: string;
    doctor: string;
    facility: string;
    summary: string;
    summaryKn?: string;
  }[];
}

export interface DoctorAccountProfile {
  id: string;
  registrationNumber: string;
  fullName: string;
  specialization: string;
  qualifications: string;
  experienceYears: number;
  hospital: string;
  timings: string;
  phone: string;
  email: string;
  location: string;
  availableToday: boolean;
  photoUrl: string;
}

export interface Doctor {
  id: string;
  name: string;
  specialization: string;
  qualifications: string;
  experienceYears: number;
  hospital: string;
  timings: string;
  phone: string;
  location: string;
  distanceKm: number;
  availableToday: boolean;
  languages: string[];
  photoUrl: string;
  consultationSlots: string[];
}

export type AppointmentStatus = 'Pending' | 'Accepted' | 'Rejected' | 'Cancelled';

export interface Appointment {
  id: string;
  doctorId: string;
  doctorName: string;
  patientName?: string;
  specialization: string;
  hospital: string;
  date: string;
  timeSlot: string;
  reason: string;
  status: AppointmentStatus;
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
  doctorId: string;
  doctorName: string;
  patientName?: string;
  specialization: string;
  status: 'Active' | 'Requested' | 'Completed';
  lastUpdated: string;
  messages: ChatMessage[];
}

export interface HealthcareService {
  id: string;
  category:
    | 'Nearby Hospitals'
    | 'Pharmacy Services'
    | 'Ambulance Services'
    | 'Laboratory Services'
    | 'Health Camps'
    | 'Vaccination Information'
    | 'Government Healthcare Schemes'
    | 'Health Awareness';
  title: string;
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
  triggeredAt: string;
  locationLabel: string;
  coordinates: string | null;
  locationStatus: 'Shared' | 'Unavailable';
  contactNotified: string;
  status: 'Logged Locally (Demo)' | 'Location Permission Required';
  notes: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  titleKn?: string;
  message: string;
  messageKn?: string;
  time: string;
  timeKn?: string;
  read: boolean;
  domainRoute: string;
}

export const DEMO_CREDENTIALS = {
  email: 'patient@ruralcare.in',
  mobile: '9876543210',
  password: 'RuralCare@123',
};

export const DOCTOR_DEMO_CREDENTIALS = {
  email: 'doctor@ruralcare.in',
  mobile: '9415022310',
  password: 'Doctor@123',
};

export const DEFAULT_DOCTOR_PROFILE: DoctorAccountProfile = {
  id: 'doc-1',
  registrationNumber: 'RC-DOC-001',
  fullName: 'Dr. Ananya Rao',
  specialization: 'General Physician',
  qualifications: 'MBBS, MD',
  experienceYears: 11,
  hospital: 'RuralCare Community Hospital',
  timings: 'Mon–Sat · 09:00 AM – 02:00 PM',
  phone: '9415022310',
  email: 'doctor@ruralcare.in',
  location: 'Block Road, Sitapur',
  availableToday: true,
  photoUrl: '/src/assets/images/doctor_portrait_female_1795000484950.jpg',
};

export const DEFAULT_PATIENT_PROFILE: PatientProfile = {
  healthId: 'RC-SDCH-4821',
  fullName: 'Ramesh Kumar Verma',
  dateOfBirth: '1988-05-14',
  age: 38,
  gender: 'Male',
  mobileNumber: '9876543210',
  email: 'patient@ruralcare.in',
  village: 'Chandrapur',
  district: 'Sitapur',
  state: 'Uttar Pradesh',
  address: 'House No. 42, Near Primary School, Gram Panchayat Chandrapur',
  pinCode: '261001',
  bloodGroup: 'B+',
  emergencyContactName: 'Sunita Verma (Spouse)',
  emergencyContactNumber: '9823411220',
  avatarUrl: '/src/assets/images/patient_avatar_default_1795000484576.jpg',
  allergies: ['Penicillin', 'Dust pollen'],
  chronicConditions: ['Mild Hypertension (controlled)'],
  medicalRecords: [
    {
      id: 'rec-1',
      date: '2026-10-12',
      title: 'Annual Blood Pressure & Blood Sugar Screening',
      titleKn: 'ವಾರ್ಷಿಕ ರಕ್ತದೊತ್ತಡ ಮತ್ತು ರಕ್ತದ ಸಕ್ಕರೆ ತಪಾಸಣೆ',
      doctor: 'Dr. Priya Sharma',
      facility: 'Sitapur Community Health Center',
      summary: 'BP 128/82 mmHg. Fasting glucose 96 mg/dL. Advised low-salt diet and regular morning walk.',
      summaryKn: 'ರಕ್ತದೊತ್ತಡ 128/82 mmHg. ಸಕ್ಕರೆ ಪ್ರಮಾಣ 96 mg/dL. ಕಡಿಮೆ ಉಪ್ಪಿನ ಆಹಾರ ಮತ್ತು ಬೆಳಗಿನ ನಡಿಗೆ ಸೂಚಿಸಲಾಗಿದೆ.',
    },
    {
      id: 'rec-2',
      date: '2026-07-04',
      title: 'Seasonal Fever & CBC Checkup',
      titleKn: 'ಜ್ವರ ಮತ್ತು ರಕ್ತ ಪರೀಕ್ಷೆ (CBC)',
      doctor: 'Dr. Arvind Deshmukh',
      facility: 'Gramin Jan Seva Clinic',
      summary: 'Viral pyrexia resolved after 3 days of paracetamol and oral hydration.',
      summaryKn: '3 ದಿನಗಳ ಪ್ಯಾರಾಸಿಟಮಾಲ್ ಮತ್ತು ದ್ರವಾಹಾರದ ನಂತರ ಜ್ವರ ಕಡಿಮೆಯಾಗಿದೆ.',
    },
    {
      id: 'rec-3',
      date: '2026-02-19',
      title: 'Tetanus Booster Immunization',
      titleKn: 'ಟಿಟಾನಸ್ (TT) ಲಸಿಕೆ',
      doctor: 'Dr. Meera Nair',
      facility: 'Chandrapur Primary Health Sub-Center',
      summary: 'Routine Td booster administered cleanly; next due in 10 years.',
      summaryKn: 'ನಿಯಮಿತ Td ಬೂಸ್ಟರ್ ಲಸಿಕೆ ನೀಡಲಾಗಿದೆ; ಮುಂದಿನದು 10 ವರ್ಷಗಳಲ್ಲಿ.',
    },
  ],
};

export const SAMPLE_DOCTORS: Doctor[] = [
  {
    id: 'doc-1',
    name: 'Dr. Priya Sharma',
    specialization: 'General Medicine',
    qualifications: 'MBBS, MD (General Medicine)',
    experienceYears: 11,
    hospital: 'Sitapur Community Health Center',
    timings: 'Mon–Sat · 09:00 AM – 02:00 PM',
    phone: '+91 94150 22310',
    location: 'Block Road, Sitapur',
    distanceKm: 4.2,
    availableToday: true,
    languages: ['Hindi', 'English', 'Kannada'],
    photoUrl: '/src/assets/images/doctor_portrait_female_1795000484950.jpg',
    consultationSlots: ['09:30 AM', '10:30 AM', '11:30 AM', '01:00 PM'],
  },
  {
    id: 'doc-2',
    name: 'Dr. Arvind Deshmukh',
    specialization: 'Cardiology & Chronic Care',
    qualifications: 'MBBS, MD, DNB (Cardiology)',
    experienceYears: 18,
    hospital: 'District Rural Referral Hospital',
    timings: 'Mon–Fri · 10:00 AM – 04:00 PM',
    phone: '+91 94150 88421',
    location: 'Civil Lines, Sitapur',
    distanceKm: 9.5,
    availableToday: true,
    languages: ['Hindi', 'Marathi', 'English'],
    photoUrl: '/src/assets/images/doctor_portrait_male_senior_1795000486585.jpg',
    consultationSlots: ['10:00 AM', '11:00 AM', '02:30 PM', '03:30 PM'],
  },
  {
    id: 'doc-3',
    name: 'Dr. Meera Nair',
    specialization: 'Pediatrics & Maternal Health',
    qualifications: 'MBBS, DCH (Pediatrics)',
    experienceYears: 8,
    hospital: 'Chandrapur Primary Health Center',
    timings: 'Mon–Sat · 08:30 AM – 01:30 PM',
    phone: '+91 94152 67109',
    location: 'Chandrapur Bazaar',
    distanceKm: 1.8,
    availableToday: true,
    languages: ['Hindi', 'English', 'Kannada'],
    photoUrl: '/src/assets/images/doctor_portrait_pediatrician_1795000486638.jpg',
    consultationSlots: ['09:00 AM', '10:00 AM', '12:00 PM', '01:00 PM'],
  },
  {
    id: 'doc-4',
    name: 'Dr. Rajeshwar Kulkarni',
    specialization: 'Orthopedics & Trauma',
    qualifications: 'MBBS, MS (Orthopedics)',
    experienceYears: 15,
    hospital: 'District Rural Referral Hospital',
    timings: 'Tue, Thu, Sat · 11:00 AM – 05:00 PM',
    phone: '+91 94154 33902',
    location: 'Hospital Crossing, Sitapur',
    distanceKm: 10.1,
    availableToday: false,
    languages: ['Hindi', 'Kannada', 'English'],
    photoUrl: '/src/assets/images/doctor_portrait_male_senior_1795000486585.jpg',
    consultationSlots: ['11:30 AM', '12:30 PM', '03:00 PM', '04:00 PM'],
  },
  {
    id: 'doc-5',
    name: 'Dr. Ananya Chatterjee',
    specialization: 'Gynecology & Obstetrics',
    qualifications: 'MBBS, MS (OBG)',
    experienceYears: 10,
    hospital: 'Maa Sharda Rural Maternity Unit',
    timings: 'Mon–Sat · 09:30 AM – 03:30 PM',
    phone: '+91 94159 10294',
    location: 'Laharpur Road, Sitapur',
    distanceKm: 6.4,
    availableToday: true,
    languages: ['Hindi', 'Bengali', 'English'],
    photoUrl: '/src/assets/images/doctor_portrait_female_1795000484950.jpg',
    consultationSlots: ['09:30 AM', '11:00 AM', '01:30 PM', '02:45 PM'],
  },
];

export const INITIAL_APPOINTMENTS: Appointment[] = [
  {
    id: 'apt-101',
    doctorId: 'doc-1',
    doctorName: 'Dr. Priya Sharma',
    patientName: 'Ramesh Kumar Verma',
    specialization: 'General Medicine',
    hospital: 'Sitapur Community Health Center',
    date: '2026-11-21',
    timeSlot: '10:30 AM',
    reason: 'Routine blood pressure follow-up',
    status: 'Accepted',
    createdAt: '2026-11-16',
  },
  {
    id: 'apt-102',
    doctorId: 'doc-3',
    doctorName: 'Dr. Meera Nair',
    patientName: 'Ramesh Kumar Verma',
    specialization: 'Pediatrics & Maternal Health',
    hospital: 'Chandrapur Primary Health Center',
    date: '2026-11-24',
    timeSlot: '09:00 AM',
    reason: 'Child immunization schedule review',
    status: 'Pending',
    createdAt: '2026-11-17',
  },
  {
    id: 'apt-103',
    doctorId: 'doc-4',
    doctorName: 'Dr. Rajeshwar Kulkarni',
    patientName: 'Ramesh Kumar Verma',
    specialization: 'Orthopedics & Trauma',
    hospital: 'District Rural Referral Hospital',
    date: '2026-11-05',
    timeSlot: '12:30 PM',
    reason: 'Right knee joint stiffness consultation',
    status: 'Rejected',
    createdAt: '2026-11-02',
  },
];

export const INITIAL_CONSULTATIONS: ConsultationThread[] = [
  {
    id: 'thread-1',
    doctorId: 'doc-1',
    doctorName: 'Dr. Priya Sharma',
    patientName: 'Ramesh Kumar Verma',
    specialization: 'General Medicine',
    status: 'Active',
    lastUpdated: 'Today, 09:45 AM',
    messages: [
      {
        id: 'm-1',
        sender: 'patient',
        text: 'Namaste Doctor, I checked my blood pressure at the village sub-center today. It was 132/84.',
        timestamp: '09:32 AM',
      },
      {
        id: 'm-2',
        sender: 'doctor',
        text: 'Namaste Ramesh ji. That reading is stable. Please continue your morning tablet after breakfast and reduce extra salt in meals.',
        timestamp: '09:45 AM',
      },
    ],
  },
  {
    id: 'thread-2',
    doctorId: 'doc-3',
    doctorName: 'Dr. Meera Nair',
    patientName: 'Ramesh Kumar Verma',
    specialization: 'Pediatrics & Maternal Health',
    status: 'Completed',
    lastUpdated: '12 Nov 2026',
    messages: [
      {
        id: 'm-3',
        sender: 'patient',
        text: 'When is the next polio & vitamin A camp at Chandrapur PHC?',
        timestamp: '12 Nov, 11:10 AM',
      },
      {
        id: 'm-4',
        sender: 'doctor',
        text: 'The next camp is scheduled on Friday, 27 Nov from 9 AM to 2 PM at Chandrapur PHC.',
        timestamp: '12 Nov, 11:25 AM',
      },
    ],
  },
];

export const HEALTHCARE_SERVICES: HealthcareService[] = [
  {
    id: 'srv-1',
    category: 'Nearby Hospitals',
    title: 'Sitapur Community Health Center (CHC)',
    facilityName: '24x7 Rural Emergency & General Wards',
    facilityNameKn: '24x7 ಗ್ರಾಮೀಣ ತುರ್ತು ಮತ್ತು ಸಾಮಾನ್ಯ ವಾರ್ಡ್‌ಗಳು',
    distance: '4.2 km away',
    distanceKn: '4.2 ಕಿ.ಮೀ ದೂರ',
    timings: 'Open 24 Hours',
    timingsKn: '24 ಗಂಟೆಗಳು ತೆರೆದಿರುತ್ತದೆ',
    contact: '05862-240112',
    description: '30-bed government community hospital with maternity ward, X-ray, and emergency stabilization unit.',
    descriptionKn: 'ಹೆರಿಗೆ ವಾರ್ಡ್, ಎಕ್ಸ್-ರೇ ಮತ್ತು ತುರ್ತು ಚಿಕಿತ್ಸಾ ಘಟಕವನ್ನು ಹೊಂದಿರುವ 30 ಹಾಸಿಗೆಗಳ ಸರ್ಕಾರಿ ಸಮುದಾಯ ಆಸ್ಪತ್ರೆ.',
    highlights: ['24/7 Casualty', 'Free Generic Medicines', 'Maternal Care'],
    highlightsKn: ['24/7 ತುರ್ತು ಚಿಕಿತ್ಸೆ', 'ಉಚಿತ ಜನರಿಕ್ ಔಷಧಿಗಳು', 'ತಾಯಿ ಆರೈಕೆ'],
  },
  {
    id: 'srv-2',
    category: 'Pharmacy Services',
    title: 'Jan Aushadhi Rural Kendra',
    facilityName: 'Affordable Generic Pharmacy',
    facilityNameKn: 'ಕಡಿಮೆ ದರದ ಜನರಿಕ್ ಔಷಧಾಲಯ',
    distance: '1.5 km away',
    distanceKn: '1.5 ಕಿ.ಮೀ ದೂರ',
    timings: '08:00 AM – 09:00 PM',
    timingsKn: 'ಬೆಳಿಗ್ಗೆ 08:00 – ರಾತ್ರಿ 09:00',
    contact: '+91 94156 11203',
    description: 'Subsidized essential medicines, ORS packets, insulin storage, and blood pressure strips.',
    descriptionKn: 'ರಿಯಾಯಿತಿ ದರದಲ್ಲಿ ಅಗತ್ಯ ಔಷಧಿಗಳು, ORS ಪ್ಯಾಕೆಟ್‌ಗಳು, ಇನ್ಸುಲಿನ್ ಮತ್ತು ರಕ್ತದೊತ್ತಡ ತಪಾಸಣಾ ಪಟ್ಟಿಗಳು ಲಭ್ಯ.',
    highlights: ['Up to 70% Lower Cost', 'Cold-Chain Insulin', 'Prescription Refills'],
    highlightsKn: ['70% ವರೆಗೆ ಕಡಿಮೆ ದರ', 'ಇನ್ಸುಲಿನ್ ಲಭ್ಯ', 'ಔಷಧಿ ಮರುಪೂರಣ'],
  },
  {
    id: 'srv-3',
    category: 'Ambulance Services',
    title: '108 & 102 Rural Ambulance Network',
    facilityName: 'Emergency & Maternal Transport',
    facilityNameKn: 'ತುರ್ತು ಮತ್ತು ಹೆರಿಗೆ ಸಾರಿಗೆ ಸೇವೆ',
    distance: 'Average arrival: 14 mins',
    distanceKn: 'ಸರಾಸರಿ ಆಗಮನ: 14 ನಿಮಿಷ',
    timings: '24x7 Toll-Free Dispatch',
    timingsKn: '24x7 ಉಚಿತ ಸೇವೆ',
    contact: '108 / 102',
    description: 'Free GPS-dispatched ambulance equipped with oxygen support for trauma, cardiac, and pregnancy emergencies.',
    descriptionKn: 'ಅಪಘಾತ, ಹೃದಯ ಸಮಸ್ಯೆ ಮತ್ತು ಗರ್ಭಿಣಿಯರ ತುರ್ತು ಪರಿಸ್ಥಿತಿಗಳಿಗೆ ಆಮ್ಲಜನಕ ಸೌಲಭ್ಯವಿರುವ ಉಚಿತ ಆಂಬ್ಯುಲೆನ್ಸ್.',
    highlights: ['108 Emergency Trauma', '102 Mother & Infant', 'Oxygen Equipped'],
    highlightsKn: ['108 ತುರ್ತು ಆಂಬ್ಯುಲೆನ್ಸ್', '102 ತಾಯಿ ಮತ್ತು ಶಿಶು', 'ಆಮ್ಲಜನಕ ಸೌಲಭ್ಯ'],
  },
  {
    id: 'srv-4',
    category: 'Laboratory Services',
    title: 'Gramin Diagnostic & Pathology Center',
    facilityName: 'Blood, Urine & Malaria/Dengue Tests',
    facilityNameKn: 'ರಕ್ತ, ಮೂತ್ರ ಮತ್ತು ಮಲೇರಿಯಾ/ಡೆಂಗ್ಯೂ ಪರೀಕ್ಷೆಗಳು',
    distance: '3.8 km away',
    distanceKn: '3.8 ಕಿ.ಮೀ ದೂರ',
    timings: '07:00 AM – 05:00 PM',
    timingsKn: 'ಬೆಳಿಗ್ಗೆ 07:00 – ಸಂಜೆ 05:00',
    contact: '+91 94158 44120',
    description: 'Same-day reports for CBC, blood glucose, lipid profile, thyroid, and rapid fever panels.',
    descriptionKn: 'ರಕ್ತ ಪರೀಕ್ಷೆ, ಸಕ್ಕರೆ ಪ್ರಮಾಣ, ಥೈರಾಯ್ಡ್ ಮತ್ತು ಜ್ವರದ ಪರೀಕ್ಷೆಗಳ ವರದಿಗಳು ಅದೇ ದಿನ ಲಭ್ಯ.',
    highlights: ['Same-Day SMS Report', 'Free BPL Tests', 'Home Sample Option'],
    highlightsKn: ['ಅದೇ ದಿನ SMS ವರದಿ', 'BPL ಉಚಿತ ಪರೀಕ್ಷೆ', 'ಮನೆ ಮಾದರಿ ಸಂಗ್ರಹ'],
  },
  {
    id: 'srv-5',
    category: 'Health Camps',
    title: 'Monthly Panchayat Mobile Health Camp',
    facilityName: 'Eye Screening, Dental & BP Checkup',
    facilityNameKn: 'ಕಣ್ಣಿನ ತಪಾಸಣೆ, ದಂತ ಮತ್ತು ಬಿಪಿ ತಪಾಸಣೆ',
    distance: 'Chandrapur Panchayat Bhavan',
    distanceKn: 'ಚಂದ್ರಾಪುರ ಪಂಚಾಯತ್ ಭವನ',
    timings: '27 Nov 2026 · 09:00 AM – 03:00 PM',
    timingsKn: '27 ನವೆಂಬರ್ 2026 · ಬೆಳಿಗ್ಗೆ 09:00 – ಮಧ್ಯಾಹ್ನ 03:00',
    contact: '+91 94150 22310',
    description: 'Free doctor consultation, cataract screening, and spectacle distribution organized by District Health Office.',
    descriptionKn: 'ಜಿಲ್ಲಾ ಆರೋಗ್ಯ ಕಚೇರಿಯಿಂದ ಉಚಿತ ವೈದ್ಯರ ತಪಾಸಣೆ, ಕಣ್ಣಿನ ಪೊರೆ ಪರೀಕ್ಷೆ ಮತ್ತು ಕನ್ನಡಕ ವಿತರಣೆ.',
    highlights: ['Free Eye Checkup', 'Free Blood Sugar Test', 'On-Spot Referral'],
    highlightsKn: ['ಉಚಿತ ಕಣ್ಣಿನ ತಪಾಸಣೆ', 'ಉಚಿತ ಸಕ್ಕರೆ ಪರೀಕ್ಷೆ', 'ತಕ್ಷಣದ ಶಿಫಾರಸು'],
  },
  {
    id: 'srv-6',
    category: 'Vaccination Information',
    title: 'Mission Indradhanush Immunization Drive',
    facilityName: 'Childhood & Maternal Vaccines',
    facilityNameKn: 'ಮಕ್ಕಳು ಮತ್ತು ಗರ್ಭಿಣಿಯರ ಲಸಿಕಾ ಅಭಿಯಾನ',
    distance: '1.8 km (Chandrapur Sub-Center)',
    distanceKn: '1.8 ಕಿ.ಮೀ (ಚಂದ್ರಾಪುರ ಉಪಕೇಂದ್ರ)',
    timings: 'Every Wednesday & Saturday · 09:00 AM – 01:00 PM',
    timingsKn: 'ಪ್ರತಿ ಬುಧವಾರ ಮತ್ತು ಶನಿವಾರ · ಬೆಳಿಗ್ಗೆ 09:00 – 01:00',
    contact: 'ASHA: +91 98390 11245',
    description: 'Free BCG, Polio, DPT, Measles-Rubella, Hepatitis-B, and Tetanus toxoid vaccinations.',
    descriptionKn: 'ಉಚಿತ ಬಿಸಿಜಿ, ಪೋಲಿಯೋ, ಡಿಪಿಟಿ, ದಡಾರ-ರುಬೆಲ್ಲಾ, ಹೆಪಟೈಟಿಸ್-ಬಿ ಮತ್ತು ಟಿಟಿ ಲಸಿಕೆಗಳು.',
    highlights: ['Free Immunization Card', 'Zero Cost', 'ASHA Follow-Up'],
    highlightsKn: ['ಉಚಿತ ಲಸಿಕೆ ಕಾರ್ಡ್', 'ಸಂಪೂರ್ಣ ಉಚಿತ', 'ಆಶಾ ಕಾರ್ಯಕರ್ತರ ನೆರವು'],
  },
  {
    id: 'srv-7',
    category: 'Government Healthcare Schemes',
    title: 'Ayushman Bharat (PM-JAY) Helpdesk',
    facilityName: 'Up to ₹5 Lakh Annual Cashless Coverage',
    facilityNameKn: 'ವರ್ಷಕ್ಕೆ ₹5 ಲಕ್ಷದವರೆಗೆ ನಗದು ರಹಿತ ಚಿಕಿತ್ಸೆ',
    distance: '4.2 km (CHC Helpdesk Counter 2)',
    distanceKn: '4.2 ಕಿ.ಮೀ (ಸಮುದಾಯ ಆರೋಗ್ಯ ಕೇಂದ್ರ)',
    timings: 'Mon–Sat · 10:00 AM – 04:00 PM',
    timingsKn: 'ಸೋಮ–ಶನಿ · ಬೆಳಿಗ್ಗೆ 10:00 – ಸಂಜೆ 04:00',
    contact: '14555 (Toll-Free)',
    description: 'Check family eligibility, generate e-KYC golden card, and get cashless hospitalization support.',
    descriptionKn: 'ಕುಟುಂಬದ ಅರ್ಹತೆ ಪರಿಶೀಲಿಸಿ, ಆಯುಷ್ಮಾನ್ ಕಾರ್ಡ್ ಪಡೆಯಿರಿ ಮತ್ತು ನಗದು ರಹಿತ ಆಸ್ಪತ್ರೆ ಚಿಕಿತ್ಸೆ ಪಡೆಯಿರಿ.',
    highlights: ['₹5L Family Cover', 'Cashless Secondary Care', 'Zero Enrollment Fee'],
    highlightsKn: ['₹5 ಲಕ್ಷ ಕುಟುಂಬ ವಿಮೆ', 'ನಗದು ರಹಿತ ಚಿಕಿತ್ಸೆ', 'ಉಚಿತ ನೋಂದಣಿ'],
  },
  {
    id: 'srv-8',
    category: 'Health Awareness',
    title: 'Clean Water, Vector Control & Nutrition Guide',
    facilityName: 'Rural Community Preventive Care',
    facilityNameKn: 'ಗ್ರಾಮೀಣ ಸಮುದಾಯ ರೋಗ ತಡೆಗಟ್ಟುವ ಮಾಹಿತಿ',
    distance: 'Available Online & Village Center',
    distanceKn: 'ಆನ್‌ಲೈನ್ ಮತ್ತು ಗ್ರಾಮ ಕೇಂದ್ರದಲ್ಲಿ ಲಭ್ಯ',
    timings: 'Updated Weekly',
    timingsKn: 'ವಾರಕ್ಕೊಮ್ಮೆ ನವೀಕರಿಸಲಾಗುತ್ತದೆ',
    contact: '104 Health Helpline',
    description: 'Practical seasonal guidance on dengue prevention, safe drinking water chlorination, and iron-rich diets.',
    descriptionKn: 'ಡೆಂಗ್ಯೂ ತಡೆಗಟ್ಟುವಿಕೆ, ಶುದ್ಧ ಕುಡಿಯುವ ನೀರು ಮತ್ತು ಕಬ್ಬಿಣಾಂಶಯುಕ್ತ ಪೌಷ್ಟಿಕ ಆಹಾರದ ಕುರಿತು ಸರಳ ಮಾರ್ಗದರ್ಶನ.',
    highlights: ['Monsoon Fever Guide', 'ORS Preparation', 'Maternal Nutrition'],
    highlightsKn: ['ಮಳೆಗಾಲದ ಜ್ವರ ಎಚ್ಚರಿಕೆ', 'ORS ತಯಾರಿಸುವ ವಿಧಾನ', 'ತಾಯಂದಿರ ಪೋಷಣೆ'],
  },
];

export const INITIAL_EMERGENCY_HISTORY: EmergencyEvent[] = [
  {
    id: 'emg-1',
    triggeredAt: '2026-09-18 · 06:42 PM',
    locationLabel: 'Chandrapur Main Road, Sitapur',
    coordinates: '27.5612° N, 80.6820° E',
    locationStatus: 'Shared',
    contactNotified: 'Sunita Verma (+91 9823411220)',
    status: 'Logged Locally (Demo)',
    notes: 'Test drill completed with family emergency contact verification.',
  },
];

export const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'notif-1',
    title: 'Appointment Confirmed',
    titleKn: 'ಅಪಾಯಿಂಟ್ಮೆಂಟ್ ದೃಢೀಕರಿಸಲಾಗಿದೆ',
    message: 'Dr. Priya Sharma accepted your follow-up appointment for 21 Nov at 10:30 AM.',
    messageKn: 'Dr. Priya Sharma ಅವರು ನವೆಂಬರ್ 21 ಬೆಳಿಗ್ಗೆ 10:30 ಕ್ಕೆ ನಿಮ್ಮ ಅಪಾಯಿಂಟ್ಮೆಂಟ್ ಅನ್ನು ಸ್ವೀಕರಿಸಿದ್ದಾರೆ.',
    time: '2 hours ago',
    timeKn: '2 ಗಂಟೆಗಳ ಹಿಂದೆ',
    read: false,
    domainRoute: '/appointments',
  },
  {
    id: 'notif-2',
    title: 'Mobile Health Camp Nearby',
    titleKn: 'ಹತ್ತಿರದಲ್ಲಿ ಆರೋಗ್ಯ ಶಿಬಿರ',
    message: 'Free eye and blood pressure screening at Chandrapur Panchayat Bhavan on 27 Nov.',
    messageKn: 'ನವೆಂಬರ್ 27 ರಂದು ಚಂದ್ರಾಪುರ ಪಂಚಾಯತ್ ಭವನದಲ್ಲಿ ಉಚಿತ ಕಣ್ಣಿನ ಮತ್ತು ಬಿಪಿ ತಪಾಸಣೆ ಶಿಬಿರ.',
    time: 'Yesterday',
    timeKn: 'ನಿನ್ನೆ',
    read: false,
    domainRoute: '/services',
  },
  {
    id: 'notif-3',
    title: 'Doctor Reply Received',
    titleKn: 'ವೈದ್ಯರಿಂದ ಉತ್ತರ ಬಂದಿದೆ',
    message: 'Dr. Priya Sharma replied to your blood pressure reading update.',
    messageKn: 'Dr. Priya Sharma ಅವರು ನಿಮ್ಮ ರಕ್ತದೊತ್ತಡದ ವರದಿಗೆ ಉತ್ತರಿಸಿದ್ದಾರೆ.',
    time: '2 days ago',
    timeKn: '2 ದಿನಗಳ ಹಿಂದೆ',
    read: true,
    domainRoute: '/connect-doctor',
  },
];
