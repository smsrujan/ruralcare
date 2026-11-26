import React, { useEffect, useState } from 'react';
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
  CreditCard,
  CalendarCheck,
  ShieldAlert,
  ArrowRight,
  User,
  Info,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { RuralCareLogo } from '../components/RuralCareLogo';
import { LanguageSelector } from '../components/LanguageSelector';
import { validateLoginIdentifier } from '../utils/validation';
import { extractSupabaseErrorMessage, resolveAuthErrorMessage } from '../utils/supabaseMappers';

export const Login: React.FC = () => {
  const { isAuthenticated, userRole, login, clearJustLoggedOut, isSupabaseReady } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  useEffect(() => {
    clearJustLoggedOut();
  }, [clearJustLoggedOut]);

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<{ identifier?: string; password?: string }>({});
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

    const errors: { identifier?: string; password?: string } = {};
    const idError = validateLoginIdentifier(identifier, t);
    if (idError) errors.identifier = idError;
    if (!password.trim()) {
      errors.password = t('validation.enterPassword');
    }

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await login(identifier, password, rememberMe, 'patient');
      if (!result.ok) {
        setAuthError(resolveAuthErrorMessage(result, t, 'auth.invalidCredentialsPatient'));
        return;
      }

      setAuthSuccess(true);
      setTimeout(() => {
        navigate('/dashboard', { replace: true });
      }, 300);
    } catch (err) {
      setAuthError(extractSupabaseErrorMessage(err, t('auth.invalidCredentialsPatient')));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F7FA] flex flex-col justify-center py-6 sm:py-8 px-4 sm:px-6 lg:px-8">
      {/* Top Login Header with RuralCare Logo and Language Selector */}
      <header className="max-w-6xl w-full mx-auto mb-5 flex items-center justify-between gap-4">
        <RuralCareLogo size="md" />
        <LanguageSelector />
      </header>

      <div className="max-w-6xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch">
        {/* Left Section on Desktop / Below Form on Mobile */}
        <section className="order-2 lg:order-1 lg:col-span-6 bg-[#198754] text-white rounded-2xl p-6 sm:p-8 lg:p-10 flex flex-col justify-between gap-6">
          <div className="space-y-5">
            <div className="hidden lg:block">
              <RuralCareLogo size="lg" light />
            </div>

            <div className="space-y-2">
              <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-balance">
                {t('auth.welcome')}
              </h1>
              <p className="text-emerald-100 text-base sm:text-lg font-medium">
                {t('common.tagline')}
              </p>
              <p className="text-emerald-50/90 text-sm sm:text-base leading-relaxed max-w-lg">
                {t('auth.heroDesc')}
              </p>
            </div>

            {/* Healthcare Illustration / Scene */}
            <div className="rounded-xl overflow-hidden border border-white/20 bg-emerald-900/30 aspect-[4/3] max-h-64 w-full">
              {!heroImgError ? (
                <img
                  src="/src/assets/images/login_rural_healthcare_hero_1795000484029.jpg"
                  alt={t('auth.heroAlt')}
                  referrerPolicy="no-referrer"
                  onError={() => setHeroImgError(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-emerald-50">
                  <Stethoscope className="w-12 h-12 mb-2 opacity-80" aria-hidden="true" />
                  <p className="text-sm font-medium">{t('auth.heroFallback')}</p>
                </div>
              )}
            </div>
          </div>

          {/* 4 Key Highlights */}
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-sm text-emerald-50">
            <li className="flex items-start gap-2.5">
              <Stethoscope className="w-4 h-4 mt-0.5 text-emerald-200 shrink-0" aria-hidden="true" />
              <span>{t('auth.highlight1')}</span>
            </li>
            <li className="flex items-start gap-2.5">
              <CreditCard className="w-4 h-4 mt-0.5 text-emerald-200 shrink-0" aria-hidden="true" />
              <span>{t('auth.highlight2')}</span>
            </li>
            <li className="flex items-start gap-2.5">
              <CalendarCheck className="w-4 h-4 mt-0.5 text-emerald-200 shrink-0" aria-hidden="true" />
              <span>{t('auth.highlight3')}</span>
            </li>
            <li className="flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 mt-0.5 text-emerald-200 shrink-0" aria-hidden="true" />
              <span>{t('auth.highlight4')}</span>
            </li>
          </ul>
        </section>

        {/* Right Section on Desktop / First on Mobile: Login Card */}
        <section className="order-1 lg:order-2 lg:col-span-6 bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 lg:p-10 flex flex-col justify-center">
          <div className="max-w-md w-full mx-auto space-y-6">
            {/* Patient / Doctor Login Selection */}
            <div
              className="grid grid-cols-2 gap-1.5 p-1 bg-[#F5F7FA] rounded-xl border border-slate-200"
              role="navigation"
              aria-label="Login role selection"
            >
              <span
                className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold bg-white text-[#198754] shadow-sm border border-slate-200 min-h-[42px]"
                aria-current="page"
              >
                <User className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{t('auth.patientLogin')}</span>
              </span>
              <Link
                to="/doctor-login"
                className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-white/60 transition-colors min-h-[42px]"
              >
                <Stethoscope className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{t('auth.doctorLogin')}</span>
              </Link>
            </div>

            <div>
              <h2 className="font-display text-2xl font-bold text-slate-900">
                {t('auth.patientLogin')}
              </h2>
              <p className="text-sm text-slate-600 mt-1">
                {t('auth.signInSubtitlePatient')}
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
                <span>{t('auth.loginSuccess')}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              {/* Email / Mobile Field */}
              <div>
                <label
                  htmlFor="login-identifier"
                  className="block text-sm font-medium text-slate-800 mb-1.5"
                >
                  {t('auth.emailOrMobile')}
                </label>
                <div className="relative">
                  <Mail
                    className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    id="login-identifier"
                    type="text"
                    value={identifier}
                    onChange={(e) => {
                      setIdentifier(e.target.value);
                      if (fieldErrors.identifier) {
                        setFieldErrors((prev) => ({ ...prev, identifier: undefined }));
                      }
                    }}
                    placeholder={t('auth.emailOrMobilePlaceholder')}
                    autoComplete="username"
                    aria-invalid={Boolean(fieldErrors.identifier)}
                    aria-describedby={fieldErrors.identifier ? 'login-identifier-error' : undefined}
                    className={`w-full pl-10 pr-4 py-3 rounded-xl bg-white border text-sm text-slate-900 placeholder:text-slate-400 min-h-[46px] ${
                      fieldErrors.identifier ? 'border-[#DC2626]' : 'border-slate-300'
                    }`}
                  />
                </div>
                {fieldErrors.identifier && (
                  <p id="login-identifier-error" className="text-xs text-[#DC2626] mt-1.5">
                    {fieldErrors.identifier}
                  </p>
                )}
              </div>

              {/* Password Field */}
              <div>
                <label
                  htmlFor="login-password"
                  className="block text-sm font-medium text-slate-800 mb-1.5"
                >
                  {t('auth.password')}
                </label>
                <div className="relative">
                  <Lock
                    className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (fieldErrors.password) {
                        setFieldErrors((prev) => ({ ...prev, password: undefined }));
                      }
                    }}
                    placeholder={t('auth.passwordPlaceholder')}
                    autoComplete="current-password"
                    aria-invalid={Boolean(fieldErrors.password)}
                    aria-describedby={fieldErrors.password ? 'login-password-error' : undefined}
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
                  <p id="login-password-error" className="text-xs text-[#DC2626] mt-1.5">
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
                  <span>{t('auth.rememberMe')}</span>
                </label>

                <Link
                  to="/forgot-password"
                  className="text-sm font-medium text-[#0D6EFD] hover:underline whitespace-nowrap"
                >
                  {t('auth.forgotPassword')}
                </Link>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#198754] hover:bg-[#146c43] disabled:opacity-70 text-white text-base font-semibold transition-colors min-h-[48px]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                    <span>{t('auth.signingIn')}</span>
                  </>
                ) : (
                  <>
                    <span>{t('auth.loginBtn')}</span>
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </>
                )}
              </button>
            </form>

            <div className="p-3.5 rounded-xl bg-[#F5F7FA] border border-slate-200 flex items-start gap-2.5 text-xs text-slate-600">
              <Info className="w-4 h-4 text-[#198754] shrink-0 mt-0.5" aria-hidden="true" />
              <span>{t('auth.supabaseNotice')}</span>
            </div>

            <p className="text-center text-sm text-slate-600">
              {t('auth.noAccount')}{' '}
              <Link to="/register" className="font-semibold text-[#198754] hover:underline">
                {t('auth.createAccount')}
              </Link>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};
