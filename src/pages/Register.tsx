import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  User,
  Calendar,
  Phone,
  Mail,
  Lock,
  Eye,
  EyeOff,
  MapPin,
  Droplets,
  CheckCircle2,
  RotateCcw,
  ArrowLeft,
  Loader2,
  Stethoscope,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { RuralCareLogo } from '../components/RuralCareLogo';
import { LanguageSelector } from '../components/LanguageSelector';
import {
  calculateAgeFromDob,
  validateDoctorRegistrationForm,
  validateRegistrationForm,
  type DoctorRegistrationFormInput,
  type RegistrationFormInput,
} from '../utils/validation';
import { extractSupabaseErrorMessage, resolveAuthErrorMessage } from '../utils/supabaseMappers';

const INITIAL_PATIENT_FORM: RegistrationFormInput = {
  fullName: '',
  dateOfBirth: '',
  gender: '',
  mobileNumber: '',
  email: '',
  password: '',
  confirmPassword: '',
  village: '',
  district: '',
  state: '',
  fullAddress: '',
  pinCode: '',
  bloodGroup: '',
  emergencyContactName: '',
  emergencyContactNumber: '',
};

const INITIAL_DOCTOR_FORM: DoctorRegistrationFormInput = {
  fullName: '',
  email: '',
  mobileNumber: '',
  medicalRegistrationNumber: '',
  qualification: '',
  specialization: '',
  experienceYears: '',
  hospitalName: '',
  hospitalAddress: '',
  district: '',
  password: '',
  confirmPassword: '',
};

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
const GENDERS = ['Male', 'Female', 'Other', 'Prefer not to say'] as const;

export const Register: React.FC = () => {
  const { isAuthenticated, userRole, register, registerDoctorRequest, isSupabaseReady } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [mode, setMode] = useState<'patient' | 'doctor'>(
    searchParams.get('role') === 'doctor' ? 'doctor' : 'patient'
  );

  // Patient form state
  const [form, setForm] = useState<RegistrationFormInput>(INITIAL_PATIENT_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdHealthId, setCreatedHealthId] = useState<string | null>(null);

  // Doctor registration request form state
  const [docForm, setDocForm] = useState<DoctorRegistrationFormInput>(INITIAL_DOCTOR_FORM);
  const [docErrors, setDocErrors] = useState<Record<string, string>>({});
  const [docSubmitted, setDocSubmitted] = useState(false);
  const submitErrorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (submitError && submitErrorRef.current) {
      submitErrorRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [submitError]);

  const calculatedAge = useMemo(
    () => calculateAgeFromDob(form.dateOfBirth),
    [form.dateOfBirth]
  );

  if (isAuthenticated && !createdHealthId) {
    return (
      <Navigate
        to={userRole === 'doctor' ? '/doctor-dashboard' : '/dashboard'}
        replace
      />
    );
  }

  const updateField = (field: keyof RegistrationFormInput, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const updateDocField = (field: keyof DoctorRegistrationFormInput, value: string) => {
    setDocForm((prev) => ({ ...prev, [field]: value }));
    if (docErrors[field]) {
      setDocErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleReset = () => {
    setForm(INITIAL_PATIENT_FORM);
    setDocForm(INITIAL_DOCTOR_FORM);
    setErrors({});
    setDocErrors({});
    setSubmitError(null);
  };

  const handleSubmitPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setSubmitError(null);

    const validationErrors = validateRegistrationForm(form, new Date(), t);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await register(form);
      if (!res.ok) {
        setSubmitError(resolveAuthErrorMessage(res, t, 'common.errorGeneric'));
        return;
      }

      setCreatedHealthId(res.healthId ?? 'RC-NEW');
      setTimeout(() => {
        navigate('/dashboard', { replace: true });
      }, 900);
    } catch (err) {
      setSubmitError(extractSupabaseErrorMessage(err, t('common.errorGeneric')));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setSubmitError(null);

    const validationErrors = validateDoctorRegistrationForm(docForm, t);
    setDocErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await registerDoctorRequest({
        fullName: docForm.fullName,
        email: docForm.email,
        mobileNumber: docForm.mobileNumber,
        medicalRegistrationNumber: docForm.medicalRegistrationNumber,
        qualification: docForm.qualification,
        specialization: docForm.specialization,
        experienceYears: Number(docForm.experienceYears),
        hospitalName: docForm.hospitalName,
        hospitalAddress: docForm.hospitalAddress,
        district: docForm.district,
        password: docForm.password,
      });

      if (!res.ok) {
        setSubmitError(resolveAuthErrorMessage(res, t, 'common.errorGeneric'));
        return;
      }

      navigate('/doctor-dashboard', { replace: true });
    } catch (err) {
      setSubmitError(extractSupabaseErrorMessage(err, t('common.errorGeneric')));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F7FA] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header Bar with Language Selector */}
        <header className="flex flex-wrap items-center justify-between gap-4">
          <RuralCareLogo size="md" />
          <div className="flex items-center gap-3">
            <LanguageSelector />
            <Link
              to={mode === 'doctor' ? '/doctor-login' : '/login'}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#198754] hover:underline whitespace-nowrap"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              <span>{t('register.backToLogin')}</span>
            </Link>
          </div>
        </header>

        {/* Main Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 lg:p-10 space-y-6">
          {/* Patient vs Doctor Registration Mode Switcher */}
          <div
            className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-1.5 bg-[#F5F7FA] rounded-xl border border-slate-200"
            role="tablist"
            aria-label="Registration role"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'patient'}
              onClick={() => {
                setMode('patient');
                setSubmitError(null);
              }}
              className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors min-h-[42px] ${
                mode === 'patient'
                  ? 'bg-white text-[#198754] shadow-sm border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <User className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{t('doctorRegister.tabPatient')}</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={mode === 'doctor'}
              onClick={() => {
                setMode('doctor');
                setSubmitError(null);
              }}
              className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors min-h-[42px] ${
                mode === 'doctor'
                  ? 'bg-white text-[#198754] shadow-sm border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Stethoscope className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{t('doctorRegister.tabDoctor')}</span>
            </button>
          </div>

          <div className="space-y-2 border-b border-slate-100 pb-5">
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">
              {mode === 'doctor' ? t('doctorRegister.heading') : t('register.heading')}
            </h1>
            <p className="text-sm sm:text-base text-slate-600">
              {mode === 'doctor' ? t('doctorRegister.subtitle') : t('register.subtitle')}
            </p>
            <p className="text-xs text-slate-500 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#198754] shrink-0" aria-hidden="true" />
              <span>
                {mode === 'doctor' ? t('doctorRegister.pendingNote') : t('register.supabaseNote')}
              </span>
            </p>
          </div>

          {!isSupabaseReady && (
            <div
              role="alert"
              className="flex items-start gap-2.5 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs sm:text-sm text-amber-900"
            >
              <AlertCircle className="w-4 h-4 mt-0.5 text-amber-700 shrink-0" aria-hidden="true" />
              <span>{t('supabase.missingConfig')}</span>
            </div>
          )}

          {submitError && (
            <div
              ref={submitErrorRef}
              role="alert"
              className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-sm text-[#DC2626]"
            >
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
              <span>{submitError}</span>
            </div>
          )}

          {mode === 'patient' ? (
            createdHealthId ? (
              <div
                role="status"
                className="p-6 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-3 text-center"
              >
                <CheckCircle2 className="w-10 h-10 text-[#198754] mx-auto" aria-hidden="true" />
                <h2 className="font-display text-xl font-bold text-slate-900">
                  {t('register.createdTitle')}
                </h2>
                <p className="text-sm text-slate-700">
                  {t('register.createdMessage', { healthId: createdHealthId })}
                </p>
                <Link
                  to="/dashboard"
                  className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-[#198754] text-white text-sm font-semibold"
                >
                  {t('register.continueDashboard')}
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmitPatient} noValidate className="space-y-8">
                {/* 1. Personal Information */}
                <fieldset className="space-y-4">
                  <legend className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
                    <User className="w-4 h-4 text-[#198754]" aria-hidden="true" />
                    <span>{t('register.personalInfo')}</span>
                  </legend>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="sm:col-span-2">
                      <label htmlFor="reg-fullname" className="block text-sm font-medium text-slate-800 mb-1">
                        {t('register.fullName')}
                      </label>
                      <input
                        id="reg-fullname"
                        type="text"
                        value={form.fullName}
                        onChange={(e) => updateField('fullName', e.target.value)}
                        placeholder={t('register.fullNamePlaceholder')}
                        className={`w-full px-3.5 py-2.5 rounded-xl border text-sm min-h-[44px] ${
                          errors.fullName ? 'border-[#DC2626]' : 'border-slate-300'
                        }`}
                      />
                      {errors.fullName && (
                        <p className="text-xs text-[#DC2626] mt-1">{errors.fullName}</p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="reg-dob" className="block text-sm font-medium text-slate-800 mb-1">
                        {t('register.dob')}
                      </label>
                      <div className="relative">
                        <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
                        <input
                          id="reg-dob"
                          type="date"
                          max={new Date().toISOString().slice(0, 10)}
                          value={form.dateOfBirth}
                          onChange={(e) => updateField('dateOfBirth', e.target.value)}
                          className={`w-full pl-9 pr-3 py-2.5 rounded-xl border text-sm min-h-[44px] tabular-nums ${
                            errors.dateOfBirth ? 'border-[#DC2626]' : 'border-slate-300'
                          }`}
                        />
                      </div>
                      {errors.dateOfBirth && (
                        <p className="text-xs text-[#DC2626] mt-1">{errors.dateOfBirth}</p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="reg-age" className="block text-sm font-medium text-slate-800 mb-1">
                        {t('register.ageAuto')}
                      </label>
                      <input
                        id="reg-age"
                        type="text"
                        readOnly
                        value={
                          calculatedAge !== null
                            ? `${calculatedAge} ${t('common.years')}`
                            : t('register.selectDob')
                        }
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-700 min-h-[44px] tabular-nums"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label htmlFor="reg-gender" className="block text-sm font-medium text-slate-800 mb-1">
                        {t('register.gender')}
                      </label>
                      <select
                        id="reg-gender"
                        value={form.gender}
                        onChange={(e) => updateField('gender', e.target.value)}
                        className={`w-full px-3.5 py-2.5 rounded-xl border bg-white text-sm min-h-[44px] ${
                          errors.gender ? 'border-[#DC2626]' : 'border-slate-300'
                        }`}
                      >
                        <option value="">{t('register.selectGender')}</option>
                        {GENDERS.map((g) => (
                          <option key={g} value={g}>
                            {t(`register.genders.${g}`)}
                          </option>
                        ))}
                      </select>
                      {errors.gender && (
                        <p className="text-xs text-[#DC2626] mt-1">{errors.gender}</p>
                      )}
                    </div>
                  </div>
                </fieldset>

                {/* 2. Contact Information */}
                <fieldset className="space-y-4 pt-4 border-t border-slate-100">
                  <legend className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
                    <Phone className="w-4 h-4 text-[#198754]" aria-hidden="true" />
                    <span>{t('register.contactCredentials')}</span>
                  </legend>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="reg-mobile" className="block text-sm font-medium text-slate-800 mb-1">
                        {t('auth.mobileNumber')}
                      </label>
                      <input
                        id="reg-mobile"
                        type="tel"
                        value={form.mobileNumber}
                        onChange={(e) => updateField('mobileNumber', e.target.value)}
                        placeholder={t('register.mobilePlaceholder')}
                        className={`w-full px-3.5 py-2.5 rounded-xl border text-sm min-h-[44px] tabular-nums ${
                          errors.mobileNumber ? 'border-[#DC2626]' : 'border-slate-300'
                        }`}
                      />
                      {errors.mobileNumber && (
                        <p className="text-xs text-[#DC2626] mt-1">{errors.mobileNumber}</p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="reg-email" className="block text-sm font-medium text-slate-800 mb-1">
                        {t('auth.emailAddress')}
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
                        <input
                          id="reg-email"
                          type="email"
                          value={form.email}
                          onChange={(e) => updateField('email', e.target.value)}
                          placeholder={t('register.emailPlaceholder')}
                          className={`w-full pl-9 pr-3.5 py-2.5 rounded-xl border text-sm min-h-[44px] ${
                            errors.email ? 'border-[#DC2626]' : 'border-slate-300'
                          }`}
                        />
                      </div>
                      {errors.email && (
                        <p className="text-xs text-[#DC2626] mt-1">{errors.email}</p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="reg-password" className="block text-sm font-medium text-slate-800 mb-1">
                        {t('auth.password')}
                      </label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
                        <input
                          id="reg-password"
                          type={showPassword ? 'text' : 'password'}
                          value={form.password}
                          onChange={(e) => updateField('password', e.target.value)}
                          placeholder={t('register.passwordPlaceholder')}
                          className={`w-full pl-9 pr-11 py-2.5 rounded-xl border text-sm min-h-[44px] ${
                            errors.password ? 'border-[#DC2626]' : 'border-slate-300'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((prev) => !prev)}
                          aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 hover:text-slate-800"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {errors.password && (
                        <p className="text-xs text-[#DC2626] mt-1">{errors.password}</p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="reg-confirm-password" className="block text-sm font-medium text-slate-800 mb-1">
                        {t('register.confirmPassword')}
                      </label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
                        <input
                          id="reg-confirm-password"
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={form.confirmPassword}
                          onChange={(e) => updateField('confirmPassword', e.target.value)}
                          placeholder={t('register.confirmPasswordPlaceholder')}
                          className={`w-full pl-9 pr-11 py-2.5 rounded-xl border text-sm min-h-[44px] ${
                            errors.confirmPassword ? 'border-[#DC2626]' : 'border-slate-300'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword((prev) => !prev)}
                          aria-label={showConfirmPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 hover:text-slate-800"
                        >
                          {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {errors.confirmPassword && (
                        <p className="text-xs text-[#DC2626] mt-1">{errors.confirmPassword}</p>
                      )}
                    </div>
                  </div>
                </fieldset>

                {/* 3. Address Information */}
                <fieldset className="space-y-4 pt-4 border-t border-slate-100">
                  <legend className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[#198754]" aria-hidden="true" />
                    <span>{t('register.addressInfo')}</span>
                  </legend>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label htmlFor="reg-village" className="block text-sm font-medium text-slate-800 mb-1">
                        {t('register.village')}
                      </label>
                      <input
                        id="reg-village"
                        type="text"
                        value={form.village}
                        onChange={(e) => updateField('village', e.target.value)}
                        placeholder={t('register.villagePlaceholder')}
                        className={`w-full px-3.5 py-2.5 rounded-xl border text-sm min-h-[44px] ${
                          errors.village ? 'border-[#DC2626]' : 'border-slate-300'
                        }`}
                      />
                      {errors.village && (
                        <p className="text-xs text-[#DC2626] mt-1">{errors.village}</p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="reg-district" className="block text-sm font-medium text-slate-800 mb-1">
                        {t('register.district')}
                      </label>
                      <input
                        id="reg-district"
                        type="text"
                        value={form.district}
                        onChange={(e) => updateField('district', e.target.value)}
                        placeholder={t('register.districtPlaceholder')}
                        className={`w-full px-3.5 py-2.5 rounded-xl border text-sm min-h-[44px] ${
                          errors.district ? 'border-[#DC2626]' : 'border-slate-300'
                        }`}
                      />
                      {errors.district && (
                        <p className="text-xs text-[#DC2626] mt-1">{errors.district}</p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="reg-state" className="block text-sm font-medium text-slate-800 mb-1">
                        {t('register.state')}
                      </label>
                      <input
                        id="reg-state"
                        type="text"
                        value={form.state}
                        onChange={(e) => updateField('state', e.target.value)}
                        placeholder={t('register.statePlaceholder')}
                        className={`w-full px-3.5 py-2.5 rounded-xl border text-sm min-h-[44px] ${
                          errors.state ? 'border-[#DC2626]' : 'border-slate-300'
                        }`}
                      />
                      {errors.state && (
                        <p className="text-xs text-[#DC2626] mt-1">{errors.state}</p>
                      )}
                    </div>

                    <div className="sm:col-span-2">
                      <label htmlFor="reg-address" className="block text-sm font-medium text-slate-800 mb-1">
                        {t('register.fullAddress')}
                      </label>
                      <input
                        id="reg-address"
                        type="text"
                        value={form.fullAddress}
                        onChange={(e) => updateField('fullAddress', e.target.value)}
                        placeholder={t('register.fullAddressPlaceholder')}
                        className={`w-full px-3.5 py-2.5 rounded-xl border text-sm min-h-[44px] ${
                          errors.fullAddress ? 'border-[#DC2626]' : 'border-slate-300'
                        }`}
                      />
                      {errors.fullAddress && (
                        <p className="text-xs text-[#DC2626] mt-1">{errors.fullAddress}</p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="reg-pincode" className="block text-sm font-medium text-slate-800 mb-1">
                        {t('register.pinCode')}
                      </label>
                      <input
                        id="reg-pincode"
                        type="text"
                        maxLength={6}
                        value={form.pinCode}
                        onChange={(e) => updateField('pinCode', e.target.value)}
                        placeholder={t('register.pinCodePlaceholder')}
                        className={`w-full px-3.5 py-2.5 rounded-xl border text-sm min-h-[44px] tabular-nums ${
                          errors.pinCode ? 'border-[#DC2626]' : 'border-slate-300'
                        }`}
                      />
                      {errors.pinCode && (
                        <p className="text-xs text-[#DC2626] mt-1">{errors.pinCode}</p>
                      )}
                    </div>
                  </div>
                </fieldset>

                {/* 4. Medical Information */}
                <fieldset className="space-y-4 pt-4 border-t border-slate-100">
                  <legend className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
                    <Droplets className="w-4 h-4 text-[#DC2626]" aria-hidden="true" />
                    <span>{t('register.medicalInfo')}</span>
                  </legend>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label htmlFor="reg-blood" className="block text-sm font-medium text-slate-800 mb-1">
                        {t('register.bloodGroup')}
                      </label>
                      <select
                        id="reg-blood"
                        value={form.bloodGroup}
                        onChange={(e) => updateField('bloodGroup', e.target.value)}
                        className={`w-full px-3.5 py-2.5 rounded-xl border bg-white text-sm min-h-[44px] ${
                          errors.bloodGroup ? 'border-[#DC2626]' : 'border-slate-300'
                        }`}
                      >
                        <option value="">{t('register.selectBloodGroup')}</option>
                        {BLOOD_GROUPS.map((bg) => (
                          <option key={bg} value={bg}>
                            {bg}
                          </option>
                        ))}
                      </select>
                      {errors.bloodGroup && (
                        <p className="text-xs text-[#DC2626] mt-1">{errors.bloodGroup}</p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="reg-emg-name" className="block text-sm font-medium text-slate-800 mb-1">
                        {t('register.emergencyName')}
                      </label>
                      <input
                        id="reg-emg-name"
                        type="text"
                        value={form.emergencyContactName}
                        onChange={(e) => updateField('emergencyContactName', e.target.value)}
                        placeholder={t('register.emergencyNamePlaceholder')}
                        className={`w-full px-3.5 py-2.5 rounded-xl border text-sm min-h-[44px] ${
                          errors.emergencyContactName ? 'border-[#DC2626]' : 'border-slate-300'
                        }`}
                      />
                      {errors.emergencyContactName && (
                        <p className="text-xs text-[#DC2626] mt-1">{errors.emergencyContactName}</p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="reg-emg-phone" className="block text-sm font-medium text-slate-800 mb-1">
                        {t('register.emergencyPhone')}
                      </label>
                      <input
                        id="reg-emg-phone"
                        type="tel"
                        value={form.emergencyContactNumber}
                        onChange={(e) => updateField('emergencyContactNumber', e.target.value)}
                        placeholder={t('register.mobilePlaceholder')}
                        className={`w-full px-3.5 py-2.5 rounded-xl border text-sm min-h-[44px] tabular-nums ${
                          errors.emergencyContactNumber ? 'border-[#DC2626]' : 'border-slate-300'
                        }`}
                      />
                      {errors.emergencyContactNumber && (
                        <p className="text-xs text-[#DC2626] mt-1">{errors.emergencyContactNumber}</p>
                      )}
                    </div>
                  </div>
                </fieldset>

                {/* Form Actions */}
                <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#198754] hover:bg-[#146c43] disabled:opacity-70 text-white text-sm font-semibold transition-colors min-h-[46px]"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                          <span>{t('register.creating')}</span>
                        </>
                      ) : (
                        <span>{t('register.submit')}</span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleReset}
                      className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold transition-colors min-h-[46px]"
                    >
                      <RotateCcw className="w-4 h-4" aria-hidden="true" />
                      <span>{t('register.resetForm')}</span>
                    </button>
                  </div>

                  <p className="text-sm text-slate-600">
                    {t('register.alreadyAccount')}{' '}
                    <Link to="/login" className="font-semibold text-[#198754] hover:underline">
                      {t('register.loginHere')}
                    </Link>
                  </p>
                </div>
              </form>
            )
          ) : docSubmitted ? (
            <div
              role="status"
              className="p-6 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-3 text-center"
            >
              <CheckCircle2 className="w-10 h-10 text-[#198754] mx-auto" aria-hidden="true" />
              <h2 className="font-display text-xl font-bold text-slate-900">
                {t('doctorRegister.submittedTitle')}
              </h2>
              <p className="text-sm text-slate-700 max-w-xl mx-auto leading-relaxed">
                {t('doctorRegister.submittedMessage')}
              </p>
              <Link
                to="/doctor-login"
                className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-[#198754] text-white text-sm font-semibold"
              >
                {t('doctorRegister.backToDoctorLogin')}
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmitDoctor} noValidate className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="doc-reg-name" className="block text-sm font-medium text-slate-800 mb-1">
                    {t('register.fullName')}
                  </label>
                  <input
                    id="doc-reg-name"
                    type="text"
                    value={docForm.fullName}
                    onChange={(e) => updateDocField('fullName', e.target.value)}
                    placeholder="e.g. Dr. Ramesh Kulkarni"
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm min-h-[44px] ${
                      docErrors.fullName ? 'border-[#DC2626]' : 'border-slate-300'
                    }`}
                  />
                  {docErrors.fullName && (
                    <p className="text-xs text-[#DC2626] mt-1">{docErrors.fullName}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="doc-reg-number" className="block text-sm font-medium text-slate-800 mb-1">
                    {t('doctorRegister.regNumber')}
                  </label>
                  <input
                    id="doc-reg-number"
                    type="text"
                    value={docForm.medicalRegistrationNumber}
                    onChange={(e) => updateDocField('medicalRegistrationNumber', e.target.value)}
                    placeholder={t('doctorRegister.regNumberPlaceholder')}
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm min-h-[44px] ${
                      docErrors.medicalRegistrationNumber ? 'border-[#DC2626]' : 'border-slate-300'
                    }`}
                  />
                  {docErrors.medicalRegistrationNumber && (
                    <p className="text-xs text-[#DC2626] mt-1">{docErrors.medicalRegistrationNumber}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="doc-reg-email" className="block text-sm font-medium text-slate-800 mb-1">
                    {t('auth.emailAddress')}
                  </label>
                  <input
                    id="doc-reg-email"
                    type="email"
                    value={docForm.email}
                    onChange={(e) => updateDocField('email', e.target.value)}
                    placeholder={t('register.emailPlaceholder')}
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm min-h-[44px] ${
                      docErrors.email ? 'border-[#DC2626]' : 'border-slate-300'
                    }`}
                  />
                  {docErrors.email && (
                    <p className="text-xs text-[#DC2626] mt-1">{docErrors.email}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="doc-reg-mobile" className="block text-sm font-medium text-slate-800 mb-1">
                    {t('auth.mobileNumber')}
                  </label>
                  <input
                    id="doc-reg-mobile"
                    type="tel"
                    value={docForm.mobileNumber}
                    onChange={(e) => updateDocField('mobileNumber', e.target.value)}
                    placeholder={t('register.mobilePlaceholder')}
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm min-h-[44px] tabular-nums ${
                      docErrors.mobileNumber ? 'border-[#DC2626]' : 'border-slate-300'
                    }`}
                  />
                  {docErrors.mobileNumber && (
                    <p className="text-xs text-[#DC2626] mt-1">{docErrors.mobileNumber}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="doc-reg-qual" className="block text-sm font-medium text-slate-800 mb-1">
                    {t('doctorRegister.qualification')}
                  </label>
                  <input
                    id="doc-reg-qual"
                    type="text"
                    value={docForm.qualification}
                    onChange={(e) => updateDocField('qualification', e.target.value)}
                    placeholder={t('doctorRegister.qualificationPlaceholder')}
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm min-h-[44px] ${
                      docErrors.qualification ? 'border-[#DC2626]' : 'border-slate-300'
                    }`}
                  />
                  {docErrors.qualification && (
                    <p className="text-xs text-[#DC2626] mt-1">{docErrors.qualification}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="doc-reg-spec" className="block text-sm font-medium text-slate-800 mb-1">
                    {t('doctorRegister.specialization')}
                  </label>
                  <input
                    id="doc-reg-spec"
                    type="text"
                    value={docForm.specialization}
                    onChange={(e) => updateDocField('specialization', e.target.value)}
                    placeholder={t('doctorRegister.specializationPlaceholder')}
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm min-h-[44px] ${
                      docErrors.specialization ? 'border-[#DC2626]' : 'border-slate-300'
                    }`}
                  />
                  {docErrors.specialization && (
                    <p className="text-xs text-[#DC2626] mt-1">{docErrors.specialization}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="doc-reg-exp" className="block text-sm font-medium text-slate-800 mb-1">
                    {t('doctorRegister.experienceYears')}
                  </label>
                  <input
                    id="doc-reg-exp"
                    type="number"
                    min={0}
                    max={80}
                    value={docForm.experienceYears}
                    onChange={(e) => updateDocField('experienceYears', e.target.value)}
                    placeholder="e.g. 8"
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm min-h-[44px] tabular-nums ${
                      docErrors.experienceYears ? 'border-[#DC2626]' : 'border-slate-300'
                    }`}
                  />
                  {docErrors.experienceYears && (
                    <p className="text-xs text-[#DC2626] mt-1">{docErrors.experienceYears}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="doc-reg-district" className="block text-sm font-medium text-slate-800 mb-1">
                    {t('register.district')}
                  </label>
                  <input
                    id="doc-reg-district"
                    type="text"
                    value={docForm.district}
                    onChange={(e) => updateDocField('district', e.target.value)}
                    placeholder={t('register.districtPlaceholder')}
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm min-h-[44px] ${
                      docErrors.district ? 'border-[#DC2626]' : 'border-slate-300'
                    }`}
                  />
                  {docErrors.district && (
                    <p className="text-xs text-[#DC2626] mt-1">{docErrors.district}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="doc-reg-hospital" className="block text-sm font-medium text-slate-800 mb-1">
                    {t('doctorRegister.hospitalName')}
                  </label>
                  <input
                    id="doc-reg-hospital"
                    type="text"
                    value={docForm.hospitalName}
                    onChange={(e) => updateDocField('hospitalName', e.target.value)}
                    placeholder={t('doctorRegister.hospitalNamePlaceholder')}
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm min-h-[44px] ${
                      docErrors.hospitalName ? 'border-[#DC2626]' : 'border-slate-300'
                    }`}
                  />
                  {docErrors.hospitalName && (
                    <p className="text-xs text-[#DC2626] mt-1">{docErrors.hospitalName}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="doc-reg-hosp-addr" className="block text-sm font-medium text-slate-800 mb-1">
                    {t('doctorRegister.hospitalAddress')}
                  </label>
                  <input
                    id="doc-reg-hosp-addr"
                    type="text"
                    value={docForm.hospitalAddress}
                    onChange={(e) => updateDocField('hospitalAddress', e.target.value)}
                    placeholder={t('doctorRegister.hospitalAddressPlaceholder')}
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm min-h-[44px] ${
                      docErrors.hospitalAddress ? 'border-[#DC2626]' : 'border-slate-300'
                    }`}
                  />
                  {docErrors.hospitalAddress && (
                    <p className="text-xs text-[#DC2626] mt-1">{docErrors.hospitalAddress}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="doc-reg-pass" className="block text-sm font-medium text-slate-800 mb-1">
                    {t('auth.password')}
                  </label>
                  <input
                    id="doc-reg-pass"
                    type={showPassword ? 'text' : 'password'}
                    value={docForm.password}
                    onChange={(e) => updateDocField('password', e.target.value)}
                    placeholder={t('register.passwordPlaceholder')}
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm min-h-[44px] ${
                      docErrors.password ? 'border-[#DC2626]' : 'border-slate-300'
                    }`}
                  />
                  {docErrors.password && (
                    <p className="text-xs text-[#DC2626] mt-1">{docErrors.password}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="doc-reg-conf" className="block text-sm font-medium text-slate-800 mb-1">
                    {t('register.confirmPassword')}
                  </label>
                  <input
                    id="doc-reg-conf"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={docForm.confirmPassword}
                    onChange={(e) => updateDocField('confirmPassword', e.target.value)}
                    placeholder={t('register.confirmPasswordPlaceholder')}
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm min-h-[44px] ${
                      docErrors.confirmPassword ? 'border-[#DC2626]' : 'border-slate-300'
                    }`}
                  />
                  {docErrors.confirmPassword && (
                    <p className="text-xs text-[#DC2626] mt-1">{docErrors.confirmPassword}</p>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#198754] hover:bg-[#146c43] disabled:opacity-70 text-white text-sm font-semibold transition-colors min-h-[46px]"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                        <span>{t('common.submitting')}</span>
                      </>
                    ) : (
                      <span>{t('doctorRegister.submit')}</span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleReset}
                    className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold transition-colors min-h-[46px]"
                  >
                    <RotateCcw className="w-4 h-4" aria-hidden="true" />
                    <span>{t('register.resetForm')}</span>
                  </button>
                </div>

                <p className="text-sm text-slate-600">
                  {t('register.alreadyAccount')}{' '}
                  <Link to="/doctor-login" className="font-semibold text-[#198754] hover:underline">
                    {t('doctorRegister.backToDoctorLogin')}
                  </Link>
                </p>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
