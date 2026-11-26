import React, { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import { useAuth } from '../context/AuthContext';

export const AppLayout: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const { logout, dataError, refreshAllData, dataLoading } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleConfirmLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
      setLogoutModalOpen(false);
      navigate('/login', { replace: true });
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-[#F5F7FA] text-slate-900">
      <Sidebar
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        onRequestLogout={() => setLogoutModalOpen(true)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <Navbar onOpenMobileMenu={() => setMobileMenuOpen(true)} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1320px] w-full mx-auto">
          {dataLoading && (
            <div
              role="status"
              aria-live="polite"
              className="mb-5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2.5 text-sm text-[#146c43]"
            >
              <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />
              <span>{t('common.loading')}</span>
            </div>
          )}
          {dataError && (() => {
            const errorItems = dataError
              .split(' | ')
              .map((item) => item.trim())
              .filter(Boolean);
            return (
              <div
                role="alert"
                className="mb-5 p-4 rounded-xl bg-red-50 border border-red-200 flex flex-wrap items-start justify-between gap-3 text-sm text-[#DC2626]"
              >
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
                  {errorItems.length <= 1 ? (
                    <span className="break-words">{dataError}</span>
                  ) : (
                    <div className="space-y-1 min-w-0">
                      <p className="font-semibold">
                        Some Supabase queries failed ({errorItems.length}):
                      </p>
                      <ul className="list-disc pl-4 space-y-0.5 text-xs">
                        {errorItems.map((item, idx) => (
                          <li key={idx} className="break-words">
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  disabled={dataLoading}
                  onClick={() => void refreshAllData()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-red-200 text-xs font-semibold text-[#DC2626] hover:bg-red-100/50 shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${dataLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
                  <span>{t('common.retry')}</span>
                </button>
              </div>
            );
          })()}
          <Outlet />
        </main>
      </div>

      {/* Logout Confirmation Dialog */}
      {logoutModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="logout-dialog-title"
        >
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-xl">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 text-[#DC2626] flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <h3
                  id="logout-dialog-title"
                  className="font-display text-lg font-semibold text-slate-900"
                >
                  {t('common.logoutConfirmTitle')}
                </h3>
                <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                  {t('common.logoutConfirmMessage')}
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setLogoutModalOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors min-h-[44px]"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                disabled={loggingOut}
                onClick={() => void handleConfirmLogout()}
                className="px-5 py-2.5 rounded-xl bg-[#DC2626] hover:bg-red-700 disabled:opacity-70 text-white text-sm font-semibold transition-colors min-h-[44px]"
              >
                {t('common.logout')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
