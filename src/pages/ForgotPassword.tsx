import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Mail, ArrowLeft, CheckCircle2, AlertCircle, KeyRound, Loader2 } from 'lucide-react';
import { RuralCareLogo } from '../components/RuralCareLogo';
import { LanguageSelector } from '../components/LanguageSelector';
import { validateEmail } from '../utils/validation';
import { sendSupabasePasswordReset } from '../services/authService';
import { useAuth } from '../context/AuthContext';
import { resolveAuthErrorMessage } from '../utils/supabaseMappers';

interface ForgotPasswordProps {
  mode?: 'patient' | 'doctor';
}

export const ForgotPassword: React.FC<ForgotPasswordProps> = ({ mode }) => {
  const { t } = useTranslation();
  const { isSupabaseReady } = useAuth();
  const [searchParams] = useSearchParams();
  const isDoctorMode = mode === 'doctor' || searchParams.get('role') === 'doctor';

  const [email, setEmail] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSending) return;
    setErrorMsg(null);
    setSubmittedEmail(null);

    const trimmed = email.trim();
    if (!trimmed) {
      setErrorMsg(t('supabase.emailRequiredForReset'));
      return;
    }
    if (!validateEmail(trimmed)) {
      setErrorMsg(t('validation.invalidEmail'));
      return;
    }

    setIsSending(true);
    try {
      const res = await sendSupabasePasswordReset(
        trimmed,
        isDoctorMode ? '/doctor-login' : '/login'
      );
      if (!res.ok) {
        setErrorMsg(resolveAuthErrorMessage(res, t, 'common.errorGeneric'));
        return;
      }
      setSubmittedEmail(trimmed);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F7FA] flex flex-col justify-center py-8 px-4 sm:px-6">
      <div className="max-w-md w-full mx-auto space-y-6">
        <header className="flex items-center justify-between gap-3">
          <RuralCareLogo size="md" />
          <LanguageSelector />
        </header>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6">
          <div className="space-y-2">
            <div className="w-11 h-11 rounded-xl bg-blue-50 text-[#0D6EFD] flex items-center justify-center mb-3">
              <KeyRound className="w-5 h-5" aria-hidden="true" />
            </div>
            <h1 className="font-display text-2xl font-bold text-slate-900">
              {t('forgot.resetHeading')}
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              {isDoctorMode ? t('forgot.doctorSubtitle') : t('forgot.subtitle')}
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

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div>
              <label
                htmlFor="forgot-identifier"
                className="block text-sm font-medium text-slate-800 mb-1.5"
              >
                {t('forgot.emailLabel')}
              </label>
              <div className="relative">
                <Mail
                  className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  id="forgot-identifier"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  placeholder={t('forgot.emailPlaceholder')}
                  className={`w-full pl-10 pr-4 py-3 rounded-xl border text-sm min-h-[46px] ${
                    errorMsg ? 'border-[#DC2626]' : 'border-slate-300'
                  }`}
                />
              </div>
              {errorMsg && (
                <p role="alert" className="text-xs text-[#DC2626] mt-1.5">
                  {errorMsg}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSending}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#198754] hover:bg-[#146c43] disabled:opacity-70 text-white text-sm font-semibold transition-colors min-h-[46px]"
            >
              {isSending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  <span>{t('forgot.sending')}</span>
                </>
              ) : (
                <span>{t('forgot.submit')}</span>
              )}
            </button>
          </form>

          {submittedEmail && (
            <div
              role="status"
              className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-slate-800 space-y-2"
            >
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#198754] mt-0.5 shrink-0" aria-hidden="true" />
                <div className="space-y-1">
                  <p className="font-semibold text-slate-900">{t('forgot.successTitle')}</p>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    {t('forgot.successDesc', { value: submittedEmail })}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="pt-2 border-t border-slate-100 text-center">
            <Link
              to={isDoctorMode ? '/doctor-login' : '/login'}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#198754] hover:underline"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              <span>
                {isDoctorMode ? t('forgot.backToDoctorLogin') : t('register.backToLogin')}
              </span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
