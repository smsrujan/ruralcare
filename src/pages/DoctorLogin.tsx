import React, { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Stethoscope,
  CalendarCheck,
  MessageSquareHeart,
  FileText,
  ArrowLeft,
  ArrowRight,
  Info,
  UserPlus,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { RuralCareLogo } from '../components/RuralCareLogo';
import { LanguageSelector } from '../components/LanguageSelector';
import { DEFAULT_DOCTOR_AVATAR, extractSupabaseErrorMessage, resolveAuthErrorMessage } from '../utils/supabaseMappers';
import { validateEmail } from '../utils/validation';

export const DoctorLogin: React.FC = () => {
  const { isAuthenticated, userRole, login, isSupabaseReady } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [heroImgError, setHeroImgError] = useState(false);

  if (isAuthenticated) {
    return (
      <Navigate
        to={userRole === 'doctor' ? '/doctor-dashboard' : '/dashboard'}
        replace
      />
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setAuthError(null);
    setAuthSuccess(false);

    const errors: { email?: string; password?: string } = {};
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      errors.email = t('doctorLogin.emailRequired');
    } else if (!validateEmail(trimmedEmail)) {
      errors.email = t('doctorLogin.emailInvalid');
    }

    if (!password.trim()) {
      errors.password = t('doctorLogin.passwordRequired');
    }

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await login(trimmedEmail, password, rememberMe, 'doctor');
      if (!result.ok) {
        setAuthError(resolveAuthErrorMessage(result, t, 'doctorLogin.invalidCredentials'));
        return;
      }

      setAuthSuccess(true);
      setTimeout(() => {
        navigate('/doctor-dashboard', { replace: true });
      }, 300);
    } catch (err) {
      setAuthError(extractSupabaseErrorMessage(err, t('doctorLogin.invalidCredentials')));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F7FA] flex flex-col justify-center py-6 sm:py-8 px-4 sm:px-6 lg:px-8">
      {/* Top Header: RuralCare Logo + Language Selector in top-right */}
      <header className="max-w-6xl w-full mx-auto mb-5 flex items-center justify-between gap-4">
        <RuralCareLogo size="md" />
        <LanguageSelector />
      </header>

      <div className="max-w-6xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch">
        {/* Left Section: Doctor Welcome Panel */}
        <section className="order-2 lg:order-1 lg:col-span-6 bg-[#198754] text-white rounded-2xl p-6 sm:p-8 lg:p-10 flex flex-col justify-between gap-6">
          <div className="space-y-5">
            <div className="hidden lg:block">
              <RuralCareLogo size="lg" light />
            </div>

            <div className="space-y-2">
              <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-balance">
                {t('doctorLogin.welcomeHeading')}
              </h1>
              <p className="text-emerald-100 text-base sm:text-lg font-medium">
                {t('doctorLogin.welcomeSubtitle')}
              </p>
              <p className="text-emerald-50/90 text-sm sm:text-base leading-relaxed max-w-lg">
                {t('doctorLogin.welcomeDesc')}
              </p>
            </div>

            {/* Professional Doctor Illustration */}
            <div className="rounded-xl overflow-hidden border border-white/20 bg-emerald-900/30 aspect-[4/3] max-h-64 w-full">
              {!heroImgError ? (
                <img
                  src={DEFAULT_DOCTOR_AVATAR}
                  alt={t('doctorLogin.heroAlt')}
                  referrerPolicy="no-referrer"
                  onError={() => setHeroImgError(true)}
                  className="w-full h-full object-cover object-top"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-emerald-50">
                  <Stethoscope className="w-12 h-12 mb-2 opacity-80" aria-hidden="true" />
                  <p className="text-sm font-medium">{t('doctorLogin.welcomeSubtitle')}</p>
                </div>
              )}
            </div>
          </div>

          {/* Four Medical Highlights */}
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-sm text-emerald-50">
            <li className="flex items-start gap-2.5">
              <CalendarCheck className="w-4 h-4 mt-0.5 text-emerald-200 shrink-0" aria-hidden="true" />
              <span>{t('doctorLogin.highlight1')}</span>
            </li>
            <li className="flex items-start gap-2.5">
              <MessageSquareHeart className="w-4 h-4 mt-0.5 text-emerald-200 shrink-0" aria-hidden="true" />
              <span>{t('doctorLogin.highlight2')}</span>
            </li>
            <li className="flex items-start gap-2.5">
              <FileText className="w-4 h-4 mt-0.5 text-emerald-200 shrink-0" aria-hidden="true" />
              <span>{t('doctorLogin.highlight3')}</span>
            </li>
            <li className="flex items-start gap-2.5">
              <Stethoscope className="w-4 h-4 mt-0.5 text-emerald-200 shrink-0" aria-hidden="true" />
              <span>{t('doctorLogin.highlight4')}</span>
            </li>
          </ul>
        </section>

        {/* Right Section: Doctor Login Form */}
        <section className="order-1 lg:order-2 lg:col-span-6 bg-white border border-slate-200 rounded-2xl shadow-sm p-6 sm:p-8 lg:p-10 flex flex-col justify-center">
          <div className="max-w-md w-full mx-auto space-y-5">
            <div>
              <h2 className="font-display text-2xl font-bold text-slate-900">
                {t('doctorLogin.heading')}
              </h2>
              <p className="text-sm text-slate-600 mt-1">{t('doctorLogin.subtitle')}</p>
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

            {authError && (
              <div
                role="alert"
                className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-sm text-[#DC2626]"
              >
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
                <span>{authError}</span>
              </div>
            )}

            {authSuccess && (
              <div
                role="status"
                className="flex items-start gap-2.5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-[#198754]"
              >
                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
                <span>{t('doctorLogin.loginSuccess')}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              {/* Registered Email Address */}
              <div>
                <label
                  htmlFor="doctor-login-email"
                  className="block text-sm font-medium text-slate-800 mb-1.5"
                >
                  {t('doctorLogin.registeredEmailLabel')}
                </label>
                <div className="relative">
                  <Mail
                    className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    id="doctor-login-email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (fieldErrors.email) {
                        setFieldErrors((prev) => ({ ...prev, email: undefined }));
                      }
                    }}
                    placeholder={t('doctorLogin.registeredEmailPlaceholder')}
                    autoComplete="email"
                    aria-invalid={Boolean(fieldErrors.email)}
                    aria-describedby={fieldErrors.email ? 'doctor-email-error' : undefined}
                    className={`w-full pl-10 pr-4 py-3 rounded-xl bg-white border text-sm text-slate-900 placeholder:text-slate-400 min-h-[46px] ${
                      fieldErrors.email ? 'border-[#DC2626]' : 'border-slate-300'
                    }`}
                  />
                </div>
                {fieldErrors.email && (
                  <p id="doctor-email-error" className="text-xs text-[#DC2626] mt-1.5">
                    {fieldErrors.email}
                  </p>
                )}
              </div>

              {/* Password */}
              <div>
                <label
                  htmlFor="doctor-login-password"
                  className="block text-sm font-medium text-slate-800 mb-1.5"
                >
                  {t('doctorLogin.passwordLabel')}
                </label>
                <div className="relative">
                  <Lock
                    className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    id="doctor-login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (fieldErrors.password) {
                        setFieldErrors((prev) => ({ ...prev, password: undefined }));
                      }
                    }}
                    placeholder={t('doctorLogin.passwordPlaceholder')}
                    autoComplete="current-password"
                    aria-invalid={Boolean(fieldErrors.password)}
                    aria-describedby={fieldErrors.password ? 'doctor-password-error' : undefined}
                    className={`w-full pl-10 pr-12 py-3 rounded-xl bg-white border text-sm text-slate-900 placeholder:text-slate-400 min-h-[46px] ${
                      fieldErrors.password ? 'border-[#DC2626]' : 'border-slate-300'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg text-slate-500 hover:text-slate-800 min-h-[36px] min-w-[36px] flex items-center justify-center"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {fieldErrors.password && (
                  <p id="doctor-password-error" className="text-xs text-[#DC2626] mt-1.5">
                    {fieldErrors.password}
                  </p>
                )}
              </div>

              {/* Remember Me + Forgot Password */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 accent-[#198754]"
                  />
                  <span>{t('doctorLogin.rememberMe')}</span>
                </label>

                <Link
                  to="/forgot-password?role=doctor"
                  className="text-sm font-medium text-[#0D6EFD] hover:underline whitespace-nowrap"
                >
                  {t('doctorLogin.forgotPassword')}
                </Link>
              </div>

              {/* Login as Doctor Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#198754] hover:bg-[#146c43] disabled:opacity-70 text-white text-base font-semibold transition-colors min-h-[48px]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                    <span>{t('doctorLogin.signingIn')}</span>
                  </>
                ) : (
                  <>
                    <span>{t('doctorLogin.loginButton')}</span>
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </>
                )}
              </button>
            </form>

            {/* Doctor Verification Notice + Registration Request Link */}
            <div className="p-4 rounded-xl bg-[#F5F7FA] border border-slate-200 space-y-2.5">
              <div className="flex items-start gap-2.5 text-xs text-slate-600 leading-relaxed">
                <Info className="w-4 h-4 text-[#198754] shrink-0 mt-0.5" aria-hidden="true" />
                <span>{t('doctorLogin.supabaseNotice')}</span>
              </div>
              <Link
                to="/register?role=doctor"
                className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#198754] hover:underline"
              >
                <UserPlus className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{t('doctorLogin.registerDoctorLink')}</span>
              </Link>
            </div>

            {/* Back to Patient / Doctor Login Selection */}
            <div className="text-center">
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#198754] hover:underline"
              >
                <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                <span>{t('doctorLogin.backToSelection')}</span>
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
