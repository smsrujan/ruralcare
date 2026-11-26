import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  User,
  CreditCard,
  Stethoscope,
  MessageSquareHeart,
  HeartPulse,
  CalendarCheck,
  AlertTriangle,
  Bell,
  ArrowRight,
  MapPin,
  Phone,
  Users,
  CheckCircle2,
  Hourglass,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { DashboardCard } from '../components/DashboardCard';
import { HealthCard } from '../components/HealthCard';
import {
  computePatientDashboardStats,
  extractSupabaseErrorMessage,
} from '../utils/supabaseMappers';

export const Dashboard: React.FC = () => {
  const {
    userRole,
    patient,
    doctorAccount,
    authorizedPatients,
    doctors,
    services,
    updateDoctorProfile,
    appointments,
    updateAppointmentStatus,
    notifications,
    consultations,
  } = useAuth();
  const { language } = useLanguage();
  const { t } = useTranslation();

  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const quickDomainLinks = [
    { label: t('nav.myProfile'), path: '/profile', icon: User, desc: t('dashboard.domainDesc.profile') },
    { label: t('nav.healthCard'), path: '/health-card', icon: CreditCard, desc: t('dashboard.domainDesc.healthCard') },
    { label: t('nav.doctorDetails'), path: '/doctors', icon: Stethoscope, desc: t('dashboard.domainDesc.doctors') },
    { label: t('nav.connectDoctor'), path: '/connect-doctor', icon: MessageSquareHeart, desc: t('dashboard.domainDesc.connectDoctor') },
    { label: t('nav.services'), path: '/services', icon: HeartPulse, desc: t('dashboard.domainDesc.services') },
    { label: t('nav.appointments'), path: '/appointments', icon: CalendarCheck, desc: t('dashboard.domainDesc.appointments') },
    { label: t('nav.emergency'), path: '/emergency', icon: AlertTriangle, desc: t('dashboard.domainDesc.emergency') },
  ];

  // DOCTOR DASHBOARD VIEW
  if (userRole === 'doctor') {
    const pendingRequests = appointments.filter((a) => a.status === 'Pending');
    const acceptedAppointments = appointments.filter((a) => a.status === 'Accepted');
    const completedConsultations = consultations.filter((c) => c.status === 'Completed').length;
    const featuredPatient = authorizedPatients[0] ?? null;

    const handleToggleAvailability = async () => {
      if (actionBusyId) return;
      setActionError(null);
      setActionBusyId('toggle-avail');
      try {
        await updateDoctorProfile({ availableToday: !doctorAccount.availableToday });
      } catch (err) {
        setActionError(extractSupabaseErrorMessage(err, t('common.errorGeneric')));
      } finally {
        setActionBusyId(null);
      }
    };

    const handleDoctorDecision = async (aptId: string, status: 'Accepted' | 'Rejected') => {
      if (actionBusyId) return;
      setActionError(null);
      setActionBusyId(aptId);
      try {
        await updateAppointmentStatus(aptId, status);
      } catch (err) {
        setActionError(extractSupabaseErrorMessage(err, t('common.errorGeneric')));
      } finally {
        setActionBusyId(null);
      }
    };

    return (
      <div className="space-y-6">
        {actionError && (
          <div
            role="alert"
            className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-[#DC2626] flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{actionError}</span>
          </div>
        )}

        {/* Doctor Welcome + Professional Profile Header */}
        <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <img
                src={doctorAccount.photoUrl}
                alt={doctorAccount.fullName}
                referrerPolicy="no-referrer"
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover object-top border border-slate-200 shrink-0 bg-slate-100"
              />
              <div className="space-y-1 min-w-0">
                <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 text-balance">
                  {t('doctorDashboard.welcomeDoctor', { name: doctorAccount.fullName })}
                </h1>
                <p className="text-sm text-slate-600">{t('doctorDashboard.subtitle')}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <button
                type="button"
                disabled={actionBusyId === 'toggle-avail'}
                onClick={() => void handleToggleAvailability()}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors min-h-[44px] disabled:opacity-70 ${
                  doctorAccount.availableToday
                    ? 'bg-[#198754] hover:bg-[#146c43] text-white'
                    : 'bg-slate-200 hover:bg-slate-300 text-slate-800'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>
                  {doctorAccount.availableToday ? t('common.available') : t('common.unavailable')}
                </span>
              </button>

              <Link
                to="/appointments"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-sm font-semibold transition-colors min-h-[44px]"
              >
                <CalendarCheck className="w-4 h-4 shrink-0 text-[#198754]" aria-hidden="true" />
                <span>{t('doctorDashboard.manageAppointments')}</span>
              </Link>
            </div>
          </div>

          {/* Doctor Professional Credentials Grid */}
          <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-4 border-t border-slate-100 text-sm">
            <div className="p-3 rounded-xl bg-[#F5F7FA]">
              <dt className="text-xs text-slate-500">{t('doctors.doctorName')}</dt>
              <dd className="font-semibold text-slate-900 mt-0.5">{doctorAccount.fullName}</dd>
            </div>
            <div className="p-3 rounded-xl bg-[#F5F7FA]">
              <dt className="text-xs text-slate-500">{t('doctorDashboard.doctorId')}</dt>
              <dd className="font-mono font-semibold text-[#198754] mt-0.5">
                {doctorAccount.registrationNumber}
              </dd>
            </div>
            <div className="p-3 rounded-xl bg-[#F5F7FA]">
              <dt className="text-xs text-slate-500">{t('profile.specialization')}</dt>
              <dd className="font-semibold text-slate-900 mt-0.5">{doctorAccount.specialization}</dd>
            </div>
            <div className="p-3 rounded-xl bg-[#F5F7FA]">
              <dt className="text-xs text-slate-500">{t('profile.qualification')}</dt>
              <dd className="font-semibold text-slate-900 mt-0.5">{doctorAccount.qualifications}</dd>
            </div>
            <div className="p-3 rounded-xl bg-[#F5F7FA] sm:col-span-2">
              <dt className="text-xs text-slate-500">{t('profile.hospitalName')}</dt>
              <dd className="font-semibold text-slate-900 mt-0.5">{doctorAccount.hospital}</dd>
            </div>
            <div className="p-3 rounded-xl bg-[#F5F7FA]">
              <dt className="text-xs text-slate-500">{t('profile.experience')}</dt>
              <dd className="font-semibold text-slate-900 tabular-nums mt-0.5">
                {t('doctorDashboard.yearsExperience', { years: doctorAccount.experienceYears })}
              </dd>
            </div>
            <div className="p-3 rounded-xl bg-[#F5F7FA]">
              <dt className="text-xs text-slate-500">{t('doctorDashboard.availabilityStatus')}</dt>
              <dd
                className={`font-semibold mt-0.5 ${
                  doctorAccount.availableToday ? 'text-[#198754]' : 'text-amber-700'
                }`}
              >
                {doctorAccount.availableToday ? t('common.available') : t('common.unavailable')}
              </dd>
            </div>
          </dl>
        </section>

        {/* Doctor Metrics Row */}
        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
          <DashboardCard
            title={t('doctorDashboard.totalPatients')}
            value={String(authorizedPatients.length)}
            subtitle={t('doctorDashboard.registeredPatient')}
            icon={Users}
            to="/health-card"
            actionLabel={t('doctorDashboard.viewHealthCard')}
            accent="green"
          />
          <DashboardCard
            title={t('doctorDashboard.todaysAppointments')}
            value={String(appointments.length)}
            subtitle={t('doctorDashboard.manageAppointments')}
            icon={CalendarCheck}
            to="/appointments"
            actionLabel={t('dashboard.manage')}
            accent="blue"
          />
          <DashboardCard
            title={t('doctorDashboard.pendingRequests')}
            value={String(pendingRequests.length)}
            subtitle={t('common.pending')}
            icon={Hourglass}
            to="/appointments"
            actionLabel={t('common.viewAll')}
            accent="red"
          />
          <DashboardCard
            title={t('doctorDashboard.acceptedAppointments')}
            value={String(acceptedAppointments.length)}
            subtitle={t('common.accepted')}
            icon={CheckCircle2}
            to="/appointments"
            actionLabel={t('common.viewAll')}
            accent="green"
          />
          <DashboardCard
            title={t('doctorDashboard.completedConsultations')}
            value={String(completedConsultations)}
            subtitle={t('doctorDashboard.consultationHistory')}
            icon={MessageSquareHeart}
            to="/connect-doctor"
            actionLabel={t('dashboard.openChat')}
            accent="blue"
          />
        </section>

        {/* Manage Appointments + Patient Details */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-lg font-bold text-slate-900">
                {t('doctorDashboard.manageAppointments')}
              </h2>
              <Link
                to="/appointments"
                className="text-sm font-semibold text-[#198754] hover:underline whitespace-nowrap"
              >
                {t('common.viewAll')}
              </Link>
            </div>

            {pendingRequests.length === 0 ? (
              <p className="text-sm text-slate-500 py-4">{t('doctorDashboard.noPendingRequests')}</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {pendingRequests.map((apt) => (
                  <div
                    key={apt.id}
                    className="py-3.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900">
                        {apt.patientName ?? t('doctorDashboard.registeredPatient')} · {apt.date} ({apt.timeSlot})
                      </p>
                      <p className="text-xs text-slate-600 mt-0.5">{apt.reason}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={actionBusyId === apt.id}
                        onClick={() => void handleDoctorDecision(apt.id, 'Accepted')}
                        className="px-3.5 py-1.5 rounded-lg bg-[#198754] hover:bg-[#146c43] disabled:opacity-60 text-white text-xs font-semibold min-h-[36px]"
                      >
                        {t('common.accept')}
                      </button>
                      <button
                        type="button"
                        disabled={actionBusyId === apt.id}
                        onClick={() => void handleDoctorDecision(apt.id, 'Rejected')}
                        className="px-3.5 py-1.5 rounded-lg border border-red-200 text-[#DC2626] hover:bg-red-50 disabled:opacity-60 text-xs font-semibold min-h-[36px]"
                      >
                        {t('common.reject')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-lg font-bold text-slate-900">
                {t('doctorDashboard.patientDetails')}
              </h2>
              <Link
                to="/health-card"
                className="text-sm font-semibold text-[#198754] hover:underline whitespace-nowrap"
              >
                {t('doctorDashboard.viewHealthCard')}
              </Link>
            </div>
            {featuredPatient ? (
              <dl className="divide-y divide-slate-100 text-sm">
                <div className="py-2 flex justify-between gap-4">
                  <dt className="text-slate-500">{t('profile.fullName')}</dt>
                  <dd className="font-semibold text-slate-900 text-right">{featuredPatient.fullName}</dd>
                </div>
                <div className="py-2 flex justify-between gap-4">
                  <dt className="text-slate-500">{t('common.healthId')}</dt>
                  <dd className="font-mono text-[#198754] font-semibold text-right">{featuredPatient.healthId}</dd>
                </div>
                <div className="py-2 flex justify-between gap-4">
                  <dt className="text-slate-500">{t('profile.bloodGroup')}</dt>
                  <dd className="font-bold text-[#DC2626] text-right">{featuredPatient.bloodGroup || '—'}</dd>
                </div>
                <div className="py-2 flex justify-between gap-4">
                  <dt className="text-slate-500">{t('profile.village')}</dt>
                  <dd className="font-medium text-slate-900 text-right">
                    {[featuredPatient.village, featuredPatient.district].filter(Boolean).join(', ') || '—'}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-slate-500 py-3">
                {t('doctorDashboard.noAuthorizedPatients')}
              </p>
            )}

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
              <Link
                to="/connect-doctor"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0D6EFD] hover:underline"
              >
                <MessageSquareHeart className="w-4 h-4" aria-hidden="true" />
                <span>{t('doctorDashboard.consultationHistory')}</span>
              </Link>
              <span className="text-xs text-slate-500 tabular-nums">
                {consultations.length}
              </span>
            </div>
          </div>
        </section>

        {/* Quick Access to all 8 Domains */}
        <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900">
              {t('dashboard.quickAccessTitle')}
            </h2>
            <p className="text-sm text-slate-600">{t('dashboard.quickAccessDesc')}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {quickDomainLinks.map((item) => {
              const Icon = item.icon;
              const isEmergency = item.path === '/emergency';
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`p-4 rounded-xl border transition-colors flex items-start gap-3 ${
                    isEmergency
                      ? 'border-red-200 bg-red-50/40 hover:bg-red-50'
                      : 'border-slate-200 bg-[#F5F7FA]/50 hover:bg-slate-50'
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      isEmergency ? 'bg-[#DC2626] text-white' : 'bg-emerald-50 text-[#198754]'
                    }`}
                  >
                    <Icon className="w-4 h-4" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 leading-snug">{item.label}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
                  </div>
                </Link>
              );
            })}

            <Link
              to="/doctor-dashboard"
              className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 transition-colors flex items-start gap-3"
            >
              <div className="w-9 h-9 rounded-lg bg-[#198754] text-white flex items-center justify-center shrink-0">
                <HeartPulse className="w-4 h-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 leading-snug">
                  {t('nav.dashboard')}
                </p>
                <p className="text-xs text-slate-600 mt-0.5">{t('dashboard.domainDesc.dashboard')}</p>
              </div>
            </Link>
          </div>
        </section>
      </div>
    );
  }

  // PATIENT DASHBOARD VIEW
  const upcomingAppointments = appointments.filter(
    (a) => a.status === 'Pending' || a.status === 'Accepted'
  );
  const patientStats = computePatientDashboardStats({
    appointments,
    doctors,
    consultations,
    notifications,
  });
  const unreadNotifs = notifications.filter((n) => !n.read);

  return (
    <div className="space-y-6">
      {/* Page Header + Emergency Quick Access */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 text-balance">
            {t('dashboard.welcome')}
          </h1>
          <p className="text-sm sm:text-base text-slate-600">
            {t('dashboard.hello')}, <strong className="text-slate-900">{patient.fullName || '—'}</strong>
            {[patient.village, patient.district].filter(Boolean).length > 0
              ? ` · ${[patient.village, patient.district].filter(Boolean).join(', ')}`
              : ''}{' '}
            · {t('common.healthId')}{' '}
            <span className="font-mono text-slate-800">{patient.healthId}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <Link
            to="/appointments"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#198754] hover:bg-[#146c43] text-white text-sm font-semibold transition-colors whitespace-nowrap min-h-[44px]"
          >
            <CalendarCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{t('dashboard.bookAppointment')}</span>
          </Link>
          <Link
            to="/emergency"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#DC2626] hover:bg-red-700 text-white text-sm font-semibold transition-colors whitespace-nowrap min-h-[44px]"
          >
            <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{t('common.quickSos')}</span>
          </Link>
        </div>
      </section>

      {/* Summary KPI Row */}
      <section aria-label="Patient Overview Metrics" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <DashboardCard
          title={t('dashboard.upcomingAppointments')}
          value={String(upcomingAppointments.length)}
          subtitle={
            upcomingAppointments[0]
              ? `${t('dashboard.nextLabel')}: ${upcomingAppointments[0].date}`
              : t('dashboard.noPendingVisits')
          }
          icon={CalendarCheck}
          to="/appointments"
          actionLabel={t('dashboard.manage')}
          accent="green"
        />
        <DashboardCard
          title={t('dashboard.availableDoctorsToday')}
          value={String(patientStats.availableDoctorsCount)}
          subtitle={t('dashboard.specialistsCount', { count: doctors.length })}
          icon={Stethoscope}
          to="/doctors"
          actionLabel={t('dashboard.viewDoctors')}
          accent="blue"
        />
        <DashboardCard
          title={t('dashboard.activeConsultations')}
          value={String(patientStats.activeConsultationsCount)}
          subtitle={t('dashboard.doctorMessaging')}
          icon={MessageSquareHeart}
          to="/connect-doctor"
          actionLabel={t('dashboard.openChat')}
          accent="green"
        />
        <DashboardCard
          title={t('dashboard.unreadNotifications')}
          value={String(patientStats.unreadNotificationsCount)}
          subtitle={t('dashboard.localServicesCount', { count: services.length })}
          icon={Bell}
          to="/services"
          actionLabel={t('nav.services')}
          accent="blue"
        />
      </section>

      {/* Digital Health Card Preview & Patient Profile Summary */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
        <div className="xl:col-span-7 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-lg font-bold text-slate-900">
              {t('dashboard.healthCardPreview')}
            </h2>
            <Link
              to="/health-card"
              className="inline-flex items-center gap-1 text-sm font-semibold text-[#198754] hover:underline whitespace-nowrap"
            >
              <span>{t('dashboard.fullHealthCard')}</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="flex-1 flex items-stretch">
            <HealthCard patient={patient} compact />
          </div>
        </div>

        {/* Patient Profile Summary */}
        <div className="xl:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-between gap-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-lg font-bold text-slate-900">
                {t('dashboard.patientOverview')}
              </h2>
              <Link
                to="/profile"
                className="text-sm font-semibold text-[#198754] hover:underline whitespace-nowrap"
              >
                {t('dashboard.editProfile')}
              </Link>
            </div>

            <dl className="divide-y divide-slate-100 text-sm">
              <div className="py-2 flex justify-between gap-4">
                <dt className="text-slate-500">{t('profile.fullName')}</dt>
                <dd className="font-medium text-slate-900 text-right">{patient.fullName}</dd>
              </div>
              <div className="py-2 flex justify-between gap-4">
                <dt className="text-slate-500">{t('profile.ageGender')}</dt>
                <dd className="font-medium text-slate-900 tabular-nums text-right">
                  {patient.age} {t('common.yrs')} ·{' '}
                  {patient.gender === 'Male' ||
                  patient.gender === 'Female' ||
                  patient.gender === 'Other' ||
                  patient.gender === 'Prefer not to say'
                    ? t(`register.genders.${patient.gender}`)
                    : patient.gender}
                </dd>
              </div>
              <div className="py-2 flex justify-between gap-4">
                <dt className="text-slate-500">{t('profile.bloodGroup')}</dt>
                <dd className="font-semibold text-[#DC2626] text-right">{patient.bloodGroup || '—'}</dd>
              </div>
              <div className="py-2 flex justify-between gap-4">
                <dt className="text-slate-500">{t('profile.village')} &amp; {t('profile.district')}</dt>
                <dd className="font-medium text-slate-900 text-right">
                  {[patient.village, patient.district].filter(Boolean).join(', ') || '—'}
                </dd>
              </div>
              <div className="py-2 flex justify-between gap-4">
                <dt className="text-slate-500">{t('profile.emergencyContact')}</dt>
                <dd className="font-medium text-slate-900 text-right tabular-nums">
                  {[patient.emergencyContactName, patient.emergencyContactNumber]
                    .filter(Boolean)
                    .join(' · ') || '—'}
                </dd>
              </div>
            </dl>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span className="inline-flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
              <span>PIN {patient.pinCode || '—'}</span>
            </span>
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Phone className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{patient.mobileNumber || '—'}</span>
            </span>
          </div>
        </div>
      </section>

      {/* Upcoming Appointments & Recent Activities / Notifications */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-lg font-bold text-slate-900">
              {t('dashboard.upcomingAppointments')}
            </h2>
            <Link
              to="/appointments"
              className="text-sm font-semibold text-[#198754] hover:underline whitespace-nowrap"
            >
              {t('common.viewAll')}
            </Link>
          </div>

          {upcomingAppointments.length === 0 ? (
            <div className="py-6 text-center space-y-3">
              <p className="text-sm text-slate-500">{t('dashboard.noUpcoming')}</p>
              <Link
                to="/appointments"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#198754] text-white text-sm font-semibold"
              >
                {t('dashboard.scheduleVisit')}
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {upcomingAppointments.slice(0, 3).map((apt) => (
                <div key={apt.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {apt.doctorName}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {apt.specialization} · {apt.hospital}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-medium text-slate-900 tabular-nums">
                      {apt.date} · {apt.timeSlot}
                    </p>
                    <p
                      className={`text-xs font-semibold ${
                        apt.status === 'Accepted' ? 'text-[#198754]' : 'text-amber-700'
                      }`}
                    >
                      {t(`appointments.status.${apt.status}`)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activities & Notifications */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-lg font-bold text-slate-900">
              {t('dashboard.recentActivities')} &amp; {t('dashboard.notifications')}
            </h2>
            <span className="text-xs text-slate-500 tabular-nums">
              {t('dashboard.updatesCount', { count: notifications.length })}
            </span>
          </div>

          {notifications.length === 0 ? (
            <p className="text-sm text-slate-500 py-4">{t('common.noNotifications')}</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {notifications.slice(0, 4).map((item) => (
                <Link
                  key={item.id}
                  to={item.domainRoute}
                  className="py-3 first:pt-0 last:pb-0 block hover:bg-slate-50 rounded-lg px-2 -mx-2 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {language === 'kn' && item.titleKn ? item.titleKn : item.title}
                    </p>
                    <span className="text-xs text-slate-500 whitespace-nowrap shrink-0">
                      {language === 'kn' && item.timeKn ? item.timeKn : item.time}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">
                    {language === 'kn' && item.messageKn ? item.messageKn : item.message}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Quick Access to All 8 Domains */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900">
              {t('dashboard.quickAccessTitle')}
            </h2>
            <p className="text-sm text-slate-600">{t('dashboard.quickAccessDesc')}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {quickDomainLinks.map((item) => {
            const Icon = item.icon;
            const isEmergency = item.path === '/emergency';
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`p-4 rounded-xl border transition-colors flex items-start gap-3 ${
                  isEmergency
                    ? 'border-red-200 bg-red-50/40 hover:bg-red-50'
                    : 'border-slate-200 bg-[#F5F7FA]/50 hover:bg-slate-50'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    isEmergency
                      ? 'bg-[#DC2626] text-white'
                      : 'bg-emerald-50 text-[#198754]'
                  }`}
                >
                  <Icon className="w-4 h-4" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 leading-snug">{item.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
                </div>
              </Link>
            );
          })}

          <Link
            to="/dashboard"
            className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 transition-colors flex items-start gap-3"
          >
            <div className="w-9 h-9 rounded-lg bg-[#198754] text-white flex items-center justify-center shrink-0">
              <HeartPulse className="w-4 h-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 leading-snug">{t('nav.dashboard')}</p>
              <p className="text-xs text-slate-600 mt-0.5">{t('dashboard.domainDesc.dashboard')}</p>
            </div>
          </Link>
        </div>
      </section>
    </div>
  );
};
