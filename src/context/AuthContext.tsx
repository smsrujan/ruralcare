import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { isSupabaseConfigured, supabase, SUPABASE_CONFIG_ERROR } from '../lib/supabaseClient';
import {
  resolveAuthenticatedAccount,
  signInDoctorWithSupabase,
  signInPatientWithSupabase,
  signOutFromSupabase,
  signUpDoctorRequestWithSupabase,
  signUpPatientWithSupabase,
  type AuthOutcome,
  type RegisterOutcome,
} from '../services/authService';
import {
  fetchAuthorizedPatientsForDoctor,
  updateDoctorProfileInSupabase,
  updatePatientProfileInSupabase,
  uploadProfileAvatarInSupabase,
} from '../services/profileService';
import {
  fetchDoctorOwnAvailability,
  fetchVerifiedDoctorsResilient,
  createDoctorAvailabilitySlot,
  deleteDoctorAvailabilitySlot,
  updateDoctorAvailabilityStatus,
} from '../services/doctorService';
import {
  addPatientAllergy,
  addPatientMedicalRecord,
  deletePatientAllergy,
  fetchPatientHealthBundleResilient,
  getDiagnosticReportSignedUrl,
  updatePatientMedicalRecord,
  uploadDiagnosticReport,
} from '../services/healthRecordService';
import {
  bookAppointmentInSupabase,
  fetchDoctorAppointments,
  fetchPatientAppointments,
  updateAppointmentStatusInSupabase,
} from '../services/appointmentService';
import {
  fetchConnectionsForDoctor,
  fetchConnectionsForPatient,
  sendConnectionMessageInSupabase,
  updateConnectionStatusInSupabase,
} from '../services/connectionService';
import { fetchHealthcareServicesFromSupabase } from '../services/servicesDirectoryService';
import {
  createEmergencyAlertInSupabase,
  fetchEmergencyAlertsForDoctor,
  fetchEmergencyAlertsForPatient,
  updateEmergencyAlertStatusInSupabase,
} from '../services/emergencyService';
import {
  fetchUserNotificationsFromSupabase,
  markAllNotificationsReadInSupabase,
  markNotificationReadInSupabase,
} from '../services/notificationService';
import {
  DEFAULT_DOCTOR_AVATAR,
  DEFAULT_PATIENT_AVATAR,
  extractSupabaseErrorMessage,
  logSupabaseError,
} from '../utils/supabaseMappers';
import type {
  Appointment,
  AppointmentStatus,
  ConnectionStatus,
  ConsultationThread,
  ConsultationType,
  DiagnosticReportItem,
  Doctor,
  DoctorAccountProfile,
  DoctorAvailabilitySlot,
  DoctorRegisterPayload,
  EmergencyEvent,
  HealthcareService,
  MedicalRecordItem,
  NotificationItem,
  PatientProfile,
  RegisterPayload,
  UserRole,
} from '../types/ruralcare';

export type { UserRole };

const EMPTY_PATIENT: PatientProfile = {
  id: '',
  healthId: '—',
  fullName: '',
  dateOfBirth: '',
  age: 0,
  gender: '',
  mobileNumber: '',
  email: '',
  village: '',
  district: '',
  state: '',
  address: '',
  pinCode: '',
  bloodGroup: '',
  emergencyContactName: '',
  emergencyContactNumber: '',
  avatarPath: null,
  avatarUrl: DEFAULT_PATIENT_AVATAR,
  allergies: [],
  allergyRecords: [],
  chronicConditions: [],
  medicalRecords: [],
  diagnosticReports: [],
};

const EMPTY_DOCTOR_ACCOUNT: DoctorAccountProfile = {
  id: '',
  registrationNumber: '—',
  fullName: '',
  specialization: '',
  qualifications: '',
  experienceYears: 0,
  hospital: '',
  hospitalAddress: '',
  district: '',
  timings: '',
  phone: '',
  email: '',
  location: '',
  availableDays: [],
  availableToday: false,
  verificationStatus: 'Pending Verification',
  isActive: false,
  photoUrl: DEFAULT_DOCTOR_AVATAR,
};

interface AuthContextValue {
  isSupabaseReady: boolean;
  supabaseConfigError: string | null;
  authLoading: boolean;
  dataLoading: boolean;
  dataError: string | null;
  isAuthenticated: boolean;
  justLoggedOut: boolean;
  clearJustLoggedOut: () => void;
  userId: string | null;
  userRole: UserRole;
  doctorVerified: boolean;
  patient: PatientProfile;
  doctorAccount: DoctorAccountProfile;
  authorizedPatients: PatientProfile[];
  doctors: Doctor[];
  doctorAvailability: DoctorAvailabilitySlot[];
  services: HealthcareService[];
  appointments: Appointment[];
  consultations: ConsultationThread[];
  emergencies: EmergencyEvent[];
  notifications: NotificationItem[];
  login: (
    identifier: string,
    password: string,
    rememberMe: boolean,
    role?: UserRole
  ) => Promise<AuthOutcome>;
  register: (payload: RegisterPayload) => Promise<RegisterOutcome>;
  registerDoctorRequest: (payload: DoctorRegisterPayload) => Promise<RegisterOutcome>;
  logout: () => Promise<void>;
  refreshAllData: () => Promise<void>;
  updatePatientProfile: (updated: Partial<PatientProfile>) => Promise<void>;
  uploadAvatar: (file: File) => Promise<string>;
  updateDoctorProfile: (updated: Partial<DoctorAccountProfile>) => Promise<void>;
  addAvailabilitySlot: (input: {
    availableDate: string | null;
    availableDay: string;
    startTime: string;
    endTime: string;
    slotLabel: string;
    status: 'Available' | 'Unavailable';
  }) => Promise<DoctorAvailabilitySlot>;
  toggleAvailabilitySlot: (slotId: string, nextStatus: 'Available' | 'Unavailable') => Promise<void>;
  removeAvailabilitySlot: (slotId: string) => Promise<void>;
  bookAppointment: (input: {
    doctorId: string;
    date: string;
    timeSlot: string;
    consultationType: ConsultationType;
    reason: string;
  }) => Promise<Appointment>;
  updateAppointmentStatus: (
    appointmentId: string,
    status: AppointmentStatus,
    rejectionReason?: string
  ) => Promise<void>;
  sendConsultationMessage: (
    doctorId: string,
    patientId: string,
    text: string,
    sender?: 'patient' | 'doctor',
    doctorUserId?: string | null,
    doctorName?: string
  ) => Promise<void>;
  updateConnectionStatus: (
    connectionId: string,
    nextStatus: ConnectionStatus,
    patientId?: string
  ) => Promise<void>;
  fetchPatientHealthRecordsForView: (targetPatientId: string) => Promise<PatientProfile | null>;
  addMedicalRecord: (input: {
    patientId: string;
    recordDate: string;
    title: string;
    doctorName: string;
    facilityName: string;
    summary: string;
  }) => Promise<MedicalRecordItem>;
  updateMedicalRecord: (
    recordId: string,
    updates: { title?: string; summary?: string; facilityName?: string }
  ) => Promise<MedicalRecordItem>;
  addAllergy: (input: {
    patientId: string;
    name: string;
    category: 'Allergy' | 'Chronic Condition';
    severity: 'Mild' | 'Moderate' | 'Severe';
    notes?: string;
  }) => Promise<void>;
  removeAllergy: (allergyId: string) => Promise<void>;
  uploadDiagnosticReportFile: (input: {
    patientId: string;
    laboratoryName: string;
    testName: string;
    testDate: string;
    reportDate?: string;
    notes?: string;
    file?: File | null;
  }) => Promise<DiagnosticReportItem>;
  getReportDownloadUrl: (filePath: string) => Promise<string>;
  logEmergencyEvent: (input: {
    emergencyDescription: string;
    locationLabel: string;
    latitude: number | null;
    longitude: number | null;
    locationSharingStatus: 'Shared' | 'Unavailable';
  }) => Promise<EmergencyEvent>;
  updateEmergencyStatus: (
    alertId: string,
    nextStatus: 'Acknowledged' | 'Resolved',
    patientId?: string
  ) => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [dataLoading, setDataLoading] = useState<boolean>(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [justLoggedOut, setJustLoggedOut] = useState(false);
  const authFlowInFlightRef = useRef(false);

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<UserRole>('patient');
  const [doctorVerified, setDoctorVerified] = useState(false);

  const [patient, setPatient] = useState<PatientProfile>(EMPTY_PATIENT);
  const [doctorAccount, setDoctorAccount] = useState<DoctorAccountProfile>(EMPTY_DOCTOR_ACCOUNT);
  const [authorizedPatients, setAuthorizedPatients] = useState<PatientProfile[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [doctorAvailability, setDoctorAvailability] = useState<DoctorAvailabilitySlot[]>([]);
  const [services, setServices] = useState<HealthcareService[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [consultations, setConsultations] = useState<ConsultationThread[]>([]);
  const [emergencies, setEmergencies] = useState<EmergencyEvent[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const resetAuthenticatedState = useCallback(() => {
    setIsAuthenticated(false);
    setUserId(null);
    setUserRole('patient');
    setDoctorVerified(false);
    setPatient(EMPTY_PATIENT);
    setDoctorAccount(EMPTY_DOCTOR_ACCOUNT);
    setAuthorizedPatients([]);
    setDoctorAvailability([]);
    setAppointments([]);
    setConsultations([]);
    setEmergencies([]);
    setNotifications([]);
  }, []);

  const loadDomainDataForUser = useCallback(
    async (uid: string) => {
      if (!isSupabaseConfigured) {
        setDataError(SUPABASE_CONFIG_ERROR);
        return;
      }

      setDataLoading(true);
      setDataError(null);
      const failures: string[] = [];

      const loadSlice = async <T,>(
        label: string,
        tableHint: string,
        fallback: T,
        fn: () => Promise<T>
      ): Promise<T> => {
        try {
          return await fn();
        } catch (err) {
          failures.push(logSupabaseError(label, err, tableHint));
          return fallback;
        }
      };

      try {
        const identity = await resolveAuthenticatedAccount(uid);

        // Enforce verification rule: unverified doctors cannot keep an active doctor session
        if (identity.role === 'doctor' && !identity.doctorVerified) {
          await signOutFromSupabase();
          resetAuthenticatedState();
          setDataError('Doctor account is awaiting admin verification.');
          return;
        }

        setUserId(uid);
        setUserRole(identity.role);
        setDoctorVerified(identity.doctorVerified);
        setIsAuthenticated(true);

        // Immediately hydrate primary identity so the dashboard never goes blank if secondary tables fail
        if (identity.role === 'doctor' && identity.doctorAccount) {
          setDoctorAccount(identity.doctorAccount);
        } else {
          setPatient(identity.patient ?? { ...EMPTY_PATIENT, id: uid });
        }

        const [doctorsRes, serviceList, notifList] = await Promise.all([
          loadSlice('Load doctors', 'doctor_profiles', { doctors: [], errors: [] }, () =>
            fetchVerifiedDoctorsResilient()
          ),
          loadSlice('Load healthcare_services', 'healthcare_services', [], () =>
            fetchHealthcareServicesFromSupabase()
          ),
          loadSlice('Load notifications', 'notifications', [], () =>
            fetchUserNotificationsFromSupabase(uid)
          ),
        ]);

        if (doctorsRes.errors.length > 0) {
          failures.push(...doctorsRes.errors);
        }
        setDoctors(doctorsRes.doctors);
        setServices(serviceList);
        setNotifications(notifList);

        if (identity.role === 'doctor' && identity.doctorAccount) {
          const docId = identity.doctorAccount.id;
          const [docApts, docConns, docEmgs, docAvail, authPats] = await Promise.all([
            loadSlice('Load doctor appointments', 'appointments', [], () =>
              fetchDoctorAppointments(docId)
            ),
            loadSlice('Load doctor connections', 'doctor_patient_connections', [], () =>
              fetchConnectionsForDoctor(docId)
            ),
            loadSlice('Load emergency_alerts', 'emergency_alerts', [], () =>
              fetchEmergencyAlertsForDoctor()
            ),
            loadSlice('Load doctor_availability', 'doctor_availability', [], () =>
              fetchDoctorOwnAvailability(docId)
            ),
            loadSlice('Load authorized patients', 'profiles', [], () =>
              fetchAuthorizedPatientsForDoctor()
            ),
          ]);
          setAppointments(docApts);
          setConsultations(docConns);
          setEmergencies(docEmgs);
          setDoctorAvailability(docAvail);
          setAuthorizedPatients(authPats);

          if (authPats[0]) {
            const firstRes = await loadSlice(
              'Load featured patient records',
              'health_cards',
              {
                bundle: {
                  healthId: null,
                  qrPayload: null,
                  allergies: [],
                  medicalRecords: [],
                  diagnosticReports: [],
                },
                errors: [],
              },
              () => fetchPatientHealthBundleResilient(authPats[0].id)
            );
            if (firstRes.errors.length > 0) {
              failures.push(...firstRes.errors);
            }
            const firstBundle = firstRes.bundle;
            setPatient({
              ...authPats[0],
              allergies: firstBundle.allergies
                .filter((a) => a.category === 'Allergy')
                .map((a) => a.name),
              allergyRecords: firstBundle.allergies,
              chronicConditions: firstBundle.allergies
                .filter((a) => a.category === 'Chronic Condition')
                .map((a) => a.name),
              medicalRecords: firstBundle.medicalRecords,
              diagnosticReports: firstBundle.diagnosticReports,
            });
          } else {
            setPatient(EMPTY_PATIENT);
          }
        } else {
          const basePatient = identity.patient ?? { ...EMPTY_PATIENT, id: uid };
          const emptyBundle = {
            bundle: {
              healthId: null,
              qrPayload: null,
              allergies: [],
              medicalRecords: [],
              diagnosticReports: [],
            },
            errors: [],
          };

          const [healthRes, patApts, patConns, patEmgs] = await Promise.all([
            loadSlice('Load patient health bundle', 'health_cards', emptyBundle, () =>
              fetchPatientHealthBundleResilient(uid)
            ),
            loadSlice('Load patient appointments', 'appointments', [], () =>
              fetchPatientAppointments(uid)
            ),
            loadSlice('Load patient connections', 'doctor_patient_connections', [], () =>
              fetchConnectionsForPatient(uid)
            ),
            loadSlice('Load patient emergency alerts', 'emergency_alerts', [], () =>
              fetchEmergencyAlertsForPatient(uid)
            ),
          ]);

          if (healthRes.errors.length > 0) {
            failures.push(...healthRes.errors);
          }
          const healthBundle = healthRes.bundle;

          setPatient({
            ...basePatient,
            healthId: healthBundle.healthId || basePatient.healthId,
            allergies: healthBundle.allergies
              .filter((a) => a.category === 'Allergy')
              .map((a) => a.name),
            allergyRecords: healthBundle.allergies,
            chronicConditions: healthBundle.allergies
              .filter((a) => a.category === 'Chronic Condition')
              .map((a) => a.name),
            medicalRecords: healthBundle.medicalRecords,
            diagnosticReports: healthBundle.diagnosticReports,
          });
          setAppointments(patApts);
          setConsultations(patConns);
          setEmergencies(patEmgs);
        }

        if (failures.length > 0) {
          const uniqueFailures = Array.from(new Set(failures));
          setDataError(uniqueFailures.join(' | '));
        }
      } catch (err) {
        const msg = logSupabaseError('Load RuralCare user account', err, 'profiles');
        setDataError(extractSupabaseErrorMessage(err, msg));
      } finally {
        setDataLoading(false);
      }
    },
    [resetAuthenticatedState]
  );

  // Restore Supabase session on initial mount / browser refresh & subscribe to auth state changes
  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }

    let active = true;

    supabase.auth
      .getSession()
      .then(async ({ data, error }) => {
        if (!active) return;
        if (error || !data.session?.user) {
          resetAuthenticatedState();
          setAuthLoading(false);
          return;
        }
        await loadDomainDataForUser(data.session.user.id);
        if (active) setAuthLoading(false);
      })
      .catch(() => {
        if (active) {
          resetAuthenticatedState();
          setAuthLoading(false);
        }
      });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === 'SIGNED_OUT' || !session?.user) {
        if (!authFlowInFlightRef.current) {
          resetAuthenticatedState();
          setAuthLoading(false);
        }
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (!authFlowInFlightRef.current) {
          void loadDomainDataForUser(session.user.id);
        }
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [loadDomainDataForUser, resetAuthenticatedState]);

  // Supabase Realtime subscriptions for live appointments, chat messages, notifications, emergencies
  useEffect(() => {
    const client = supabase;
    if (!client || !isAuthenticated || !userId) return;

    const channel = client
      .channel(`ruralcare-live-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments' },
        () => {
          if (userRole === 'doctor' && doctorAccount.id) {
            void fetchDoctorAppointments(doctorAccount.id)
              .then(setAppointments)
              .catch((err) => logSupabaseError('Realtime appointments sync', err, 'appointments'));
          } else {
            void fetchPatientAppointments(userId)
              .then(setAppointments)
              .catch((err) => logSupabaseError('Realtime appointments sync', err, 'appointments'));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'consultation_messages' },
        () => {
          if (userRole === 'doctor' && doctorAccount.id) {
            void fetchConnectionsForDoctor(doctorAccount.id)
              .then(setConsultations)
              .catch((err) =>
                logSupabaseError('Realtime messages sync', err, 'consultation_messages')
              );
          } else {
            void fetchConnectionsForPatient(userId)
              .then(setConsultations)
              .catch((err) =>
                logSupabaseError('Realtime messages sync', err, 'consultation_messages')
              );
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'doctor_patient_connections' },
        () => {
          if (userRole === 'doctor' && doctorAccount.id) {
            void fetchConnectionsForDoctor(doctorAccount.id)
              .then(setConsultations)
              .catch((err) =>
                logSupabaseError('Realtime connections sync', err, 'doctor_patient_connections')
              );
          } else {
            void fetchConnectionsForPatient(userId)
              .then(setConsultations)
              .catch((err) =>
                logSupabaseError('Realtime connections sync', err, 'doctor_patient_connections')
              );
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        () => {
          void fetchUserNotificationsFromSupabase(userId)
            .then(setNotifications)
            .catch((err) => logSupabaseError('Realtime notifications sync', err, 'notifications'));
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'emergency_alerts' },
        () => {
          if (userRole === 'doctor') {
            void fetchEmergencyAlertsForDoctor()
              .then(setEmergencies)
              .catch((err) => logSupabaseError('Realtime emergency sync', err, 'emergency_alerts'));
          } else {
            void fetchEmergencyAlertsForPatient(userId)
              .then(setEmergencies)
              .catch((err) => logSupabaseError('Realtime emergency sync', err, 'emergency_alerts'));
          }
        }
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [isAuthenticated, userId, userRole, doctorAccount.id]);

  const refreshAllData = useCallback(async () => {
    if (userId) {
      await loadDomainDataForUser(userId);
    }
  }, [userId, loadDomainDataForUser]);

  const login = useCallback(
    async (
      identifier: string,
      password: string,
      _rememberMe: boolean,
      role: UserRole = 'patient'
    ): Promise<AuthOutcome> => {
      authFlowInFlightRef.current = true;
      try {
        const outcome =
          role === 'doctor'
            ? await signInDoctorWithSupabase(identifier, password)
            : await signInPatientWithSupabase(identifier, password);

        if (outcome.ok && outcome.userId) {
          setJustLoggedOut(false);
          await loadDomainDataForUser(outcome.userId);
        }
        return outcome;
      } finally {
        authFlowInFlightRef.current = false;
      }
    },
    [loadDomainDataForUser]
  );

  const register = useCallback(
    async (payload: RegisterPayload): Promise<RegisterOutcome> => {
      authFlowInFlightRef.current = true;
      try {
        const res = await signUpPatientWithSupabase(payload);
        if (res.ok && !res.requiresEmailConfirmation && supabase) {
          const { data } = await supabase.auth.getSession();
          if (data.session?.user) {
            await loadDomainDataForUser(data.session.user.id);
          }
        }
        return res;
      } finally {
        authFlowInFlightRef.current = false;
      }
    },
    [loadDomainDataForUser]
  );

  const registerDoctorRequest = useCallback(
    async (payload: DoctorRegisterPayload): Promise<RegisterOutcome> => {
      authFlowInFlightRef.current = true;
      try {
        const res = await signUpDoctorRequestWithSupabase(payload);
        if (res.ok && !res.requiresEmailConfirmation && supabase) {
          const { data } = await supabase.auth.getSession();
          if (data.session?.user) {
            await loadDomainDataForUser(data.session.user.id);
          }
        }
        return res;
      } finally {
        authFlowInFlightRef.current = false;
      }
    },
    [loadDomainDataForUser]
  );

  const clearJustLoggedOut = useCallback(() => {
    setJustLoggedOut(false);
  }, []);

  const logout = useCallback(async () => {
    try {
      if (supabase) {
        await signOutFromSupabase();
      }
    } finally {
      setJustLoggedOut(true);
      resetAuthenticatedState();
    }
  }, [resetAuthenticatedState]);

  const updatePatientProfile = useCallback(
    async (updated: Partial<PatientProfile>) => {
      if (!userId) throw new Error('Not authenticated');
      const saved = await updatePatientProfileInSupabase(userId, updated);
      setPatient((prev) => ({
        ...prev,
        ...saved,
        allergies: prev.allergies,
        allergyRecords: prev.allergyRecords,
        chronicConditions: prev.chronicConditions,
        medicalRecords: prev.medicalRecords,
        diagnosticReports: prev.diagnosticReports,
      }));
    },
    [userId]
  );

  const uploadAvatar = useCallback(
    async (file: File) => {
      if (!userId) throw new Error('Not authenticated');
      const res = await uploadProfileAvatarInSupabase(
        userId,
        file,
        userRole,
        userRole === 'doctor' ? doctorAccount.id : undefined
      );
      if (userRole === 'doctor') {
        setDoctorAccount((prev) => ({ ...prev, photoPath: res.path, photoUrl: res.signedUrl }));
      } else {
        setPatient((prev) => ({ ...prev, avatarPath: res.path, avatarUrl: res.signedUrl }));
      }
      return res.signedUrl;
    },
    [userId, userRole, doctorAccount.id]
  );

  const updateDoctorProfile = useCallback(
    async (updated: Partial<DoctorAccountProfile>) => {
      if (!doctorAccount.id) throw new Error('Doctor profile not loaded');
      const saved = await updateDoctorProfileInSupabase(doctorAccount.id, updated);
      setDoctorAccount(saved);
      const { doctors: refreshedDocs } = await fetchVerifiedDoctorsResilient();
      setDoctors(refreshedDocs);
    },
    [doctorAccount.id]
  );

  const addAvailabilitySlot = useCallback(
    async (input: {
      availableDate: string | null;
      availableDay: string;
      startTime: string;
      endTime: string;
      slotLabel: string;
      status: 'Available' | 'Unavailable';
    }) => {
      if (!doctorAccount.id) throw new Error('Doctor profile not loaded');
      const created = await createDoctorAvailabilitySlot(doctorAccount.id, input);
      setDoctorAvailability((prev) => [...prev, created]);
      return created;
    },
    [doctorAccount.id]
  );

  const toggleAvailabilitySlot = useCallback(
    async (slotId: string, nextStatus: 'Available' | 'Unavailable') => {
      const updated = await updateDoctorAvailabilityStatus(slotId, nextStatus);
      setDoctorAvailability((prev) => prev.map((s) => (s.id === slotId ? updated : s)));
    },
    []
  );

  const removeAvailabilitySlot = useCallback(async (slotId: string) => {
    await deleteDoctorAvailabilitySlot(slotId);
    setDoctorAvailability((prev) => prev.filter((s) => s.id !== slotId));
  }, []);

  const bookAppointment = useCallback(
    async (input: {
      doctorId: string;
      date: string;
      timeSlot: string;
      consultationType: ConsultationType;
      reason: string;
    }) => {
      const created = await bookAppointmentInSupabase({
        doctorId: input.doctorId,
        appointmentDate: input.date,
        appointmentTime: input.timeSlot,
        consultationType: input.consultationType,
        patientMessage: input.reason,
      });
      setAppointments((prev) => [created, ...prev]);
      if (userId) {
        const notifs = await fetchUserNotificationsFromSupabase(userId);
        setNotifications(notifs);
      }
      return created;
    },
    [userId]
  );

  const updateAppointmentStatus = useCallback(
    async (appointmentId: string, status: AppointmentStatus, rejectionReason?: string) => {
      const updated = await updateAppointmentStatusInSupabase(
        appointmentId,
        status,
        rejectionReason
      );
      setAppointments((prev) => prev.map((a) => (a.id === appointmentId ? updated : a)));
      if (userId) {
        const notifs = await fetchUserNotificationsFromSupabase(userId);
        setNotifications(notifs);
      }
    },
    [userId]
  );

  const sendConsultationMessage = useCallback(
    async (
      doctorId: string,
      patientId: string,
      text: string,
      sender: 'patient' | 'doctor' = 'patient',
      doctorUserId?: string | null,
      _doctorName?: string
    ) => {
      if (!userId) throw new Error('Not authenticated');
      await sendConnectionMessageInSupabase({
        patientId,
        doctorId,
        senderId: userId,
        senderRole: sender,
        text,
        doctorUserId,
        patientName: patient.fullName,
      });
      const threads =
        userRole === 'doctor' && doctorAccount.id
          ? await fetchConnectionsForDoctor(doctorAccount.id)
          : await fetchConnectionsForPatient(userId);
      setConsultations(threads);
    },
    [userId, userRole, doctorAccount.id, patient.fullName]
  );

  const updateConnectionStatus = useCallback(
    async (connectionId: string, nextStatus: ConnectionStatus, patientId?: string) => {
      await updateConnectionStatusInSupabase(
        connectionId,
        nextStatus,
        patientId,
        doctorAccount.fullName
      );
      const threads =
        userRole === 'doctor' && doctorAccount.id
          ? await fetchConnectionsForDoctor(doctorAccount.id)
          : userId
          ? await fetchConnectionsForPatient(userId)
          : [];
      setConsultations(threads);
    },
    [userRole, doctorAccount.id, doctorAccount.fullName, userId]
  );

  const fetchPatientHealthRecordsForView = useCallback(
    async (targetPatientId: string): Promise<PatientProfile | null> => {
      const base =
        targetPatientId === patient.id
          ? patient
          : authorizedPatients.find((p) => p.id === targetPatientId);
      if (!base) return null;
      const { bundle } = await fetchPatientHealthBundleResilient(targetPatientId);
      return {
        ...base,
        healthId: bundle.healthId || base.healthId,
        allergies: bundle.allergies.filter((a) => a.category === 'Allergy').map((a) => a.name),
        allergyRecords: bundle.allergies,
        chronicConditions: bundle.allergies
          .filter((a) => a.category === 'Chronic Condition')
          .map((a) => a.name),
        medicalRecords: bundle.medicalRecords,
        diagnosticReports: bundle.diagnosticReports,
      };
    },
    [patient, authorizedPatients]
  );

  const addMedicalRecord = useCallback(
    async (input: {
      patientId: string;
      recordDate: string;
      title: string;
      doctorName: string;
      facilityName: string;
      summary: string;
    }) => {
      const created = await addPatientMedicalRecord({
        ...input,
        recordedByDoctorId: userRole === 'doctor' ? doctorAccount.id : null,
      });
      if (input.patientId === patient.id) {
        setPatient((prev) => ({
          ...prev,
          medicalRecords: [created, ...prev.medicalRecords],
        }));
      }
      return created;
    },
    [userRole, doctorAccount.id, patient.id]
  );

  const updateMedicalRecord = useCallback(
    async (
      recordId: string,
      updates: { title?: string; summary?: string; facilityName?: string }
    ) => {
      const updated = await updatePatientMedicalRecord(recordId, updates);
      setPatient((prev) => ({
        ...prev,
        medicalRecords: prev.medicalRecords.map((r) => (r.id === recordId ? updated : r)),
      }));
      return updated;
    },
    []
  );

  const addAllergy = useCallback(
    async (input: {
      patientId: string;
      name: string;
      category: 'Allergy' | 'Chronic Condition';
      severity: 'Mild' | 'Moderate' | 'Severe';
      notes?: string;
    }) => {
      const created = await addPatientAllergy(input);
      setPatient((prev) => {
        const nextRecords = [created, ...(prev.allergyRecords ?? [])];
        return {
          ...prev,
          allergyRecords: nextRecords,
          allergies: nextRecords.filter((a) => a.category === 'Allergy').map((a) => a.name),
          chronicConditions: nextRecords
            .filter((a) => a.category === 'Chronic Condition')
            .map((a) => a.name),
        };
      });
    },
    []
  );

  const removeAllergy = useCallback(async (allergyId: string) => {
    await deletePatientAllergy(allergyId);
    setPatient((prev) => {
      const nextRecords = (prev.allergyRecords ?? []).filter((a) => a.id !== allergyId);
      return {
        ...prev,
        allergyRecords: nextRecords,
        allergies: nextRecords.filter((a) => a.category === 'Allergy').map((a) => a.name),
        chronicConditions: nextRecords
          .filter((a) => a.category === 'Chronic Condition')
          .map((a) => a.name),
      };
    });
  }, []);

  const uploadDiagnosticReportFile = useCallback(
    async (input: {
      patientId: string;
      laboratoryName: string;
      testName: string;
      testDate: string;
      reportDate?: string;
      notes?: string;
      file?: File | null;
    }) => {
      if (!userId) throw new Error('Not authenticated');
      const created = await uploadDiagnosticReport({
        ...input,
        uploadedBy: userId,
      });
      if (input.patientId === patient.id) {
        setPatient((prev) => ({
          ...prev,
          diagnosticReports: [created, ...(prev.diagnosticReports ?? [])],
        }));
      }
      return created;
    },
    [userId, patient.id]
  );

  const getReportDownloadUrl = useCallback(async (filePath: string) => {
    return getDiagnosticReportSignedUrl(filePath);
  }, []);

  const logEmergencyEvent = useCallback(
    async (input: {
      emergencyDescription: string;
      locationLabel: string;
      latitude: number | null;
      longitude: number | null;
      locationSharingStatus: 'Shared' | 'Unavailable';
    }) => {
      if (!userId) throw new Error('Not authenticated');
      const created = await createEmergencyAlertInSupabase({
        patientId: userId,
        emergencyContactName: patient.emergencyContactName || 'Primary Contact',
        emergencyContactNumber: patient.emergencyContactNumber || patient.mobileNumber || '108',
        emergencyDescription: input.emergencyDescription,
        locationLabel: input.locationLabel,
        latitude: input.latitude,
        longitude: input.longitude,
        locationSharingStatus: input.locationSharingStatus,
      });
      setEmergencies((prev) => [created, ...prev]);
      const notifs = await fetchUserNotificationsFromSupabase(userId);
      setNotifications(notifs);
      return created;
    },
    [userId, patient.emergencyContactName, patient.emergencyContactNumber, patient.mobileNumber]
  );

  const updateEmergencyStatus = useCallback(
    async (alertId: string, nextStatus: 'Acknowledged' | 'Resolved', patientId?: string) => {
      if (!doctorAccount.id) throw new Error('Verified doctor profile required');
      const updated = await updateEmergencyAlertStatusInSupabase(
        alertId,
        nextStatus,
        doctorAccount.id,
        patientId
      );
      setEmergencies((prev) => prev.map((e) => (e.id === alertId ? updated : e)));
    },
    [doctorAccount.id]
  );

  const markNotificationRead = useCallback(async (id: string) => {
    await markNotificationReadInSupabase(id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const markAllNotificationsRead = useCallback(async () => {
    if (!userId) return;
    await markAllNotificationsReadInSupabase(userId);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, [userId]);

  return (
    <AuthContext.Provider
      value={{
        isSupabaseReady: isSupabaseConfigured,
        supabaseConfigError: isSupabaseConfigured ? null : SUPABASE_CONFIG_ERROR,
        authLoading,
        dataLoading,
        dataError,
        isAuthenticated,
        justLoggedOut,
        clearJustLoggedOut,
        userId,
        userRole,
        doctorVerified,
        patient,
        doctorAccount,
        authorizedPatients,
        doctors,
        doctorAvailability,
        services,
        appointments,
        consultations,
        emergencies,
        notifications,
        login,
        register,
        registerDoctorRequest,
        logout,
        refreshAllData,
        updatePatientProfile,
        uploadAvatar,
        updateDoctorProfile,
        addAvailabilitySlot,
        toggleAvailabilitySlot,
        removeAvailabilitySlot,
        bookAppointment,
        updateAppointmentStatus,
        sendConsultationMessage,
        updateConnectionStatus,
        fetchPatientHealthRecordsForView,
        addMedicalRecord,
        updateMedicalRecord,
        addAllergy,
        removeAllergy,
        uploadDiagnosticReportFile,
        getReportDownloadUrl,
        logEmergencyEvent,
        updateEmergencyStatus,
        markNotificationRead,
        markAllNotificationsRead,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
