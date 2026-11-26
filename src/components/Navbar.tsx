import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bell, Menu, AlertTriangle, CheckCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { LanguageSelector } from './LanguageSelector';

interface NavbarProps {
  onOpenMobileMenu: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenMobileMenu }) => {
  const { patient, doctorAccount, userRole, notifications, markNotificationRead, markAllNotificationsRead } =
    useAuth();
  const { language } = useLanguage();
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [notifOpen, setNotifOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const routeTitleMap: Record<string, string> = {
    '/profile': t('nav.profile'),
    '/dashboard': userRole === 'doctor' ? t('nav.doctorDashboard') : t('nav.dashboard'),
    '/doctor-dashboard': t('nav.doctorDashboard'),
    '/health-card': t('nav.healthCard'),
    '/doctors': t('nav.doctorDetails'),
    '/connect-doctor': t('nav.connectDoctor'),
    '/services': t('nav.services'),
    '/appointments': t('nav.appointments'),
    '/emergency': t('nav.emergency'),
  };

  const pageTitle = routeTitleMap[location.pathname] ?? t('common.brand');
  const unreadCount = notifications.filter((n) => !n.read).length;

  const activeName = userRole === 'doctor' ? doctorAccount.fullName : patient.fullName;
  const activeAvatar = userRole === 'doctor' ? doctorAccount.photoUrl : patient.avatarUrl;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-30 h-16 bg-white border-b border-slate-200 px-3 sm:px-6 flex items-center justify-between gap-3 shrink-0">
      {/* Zone 1: Menu toggle (mobile) + Page title */}
      <div className="flex items-center gap-2.5 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 min-h-[40px] min-w-[40px] flex items-center justify-center shrink-0"
          aria-label={t('common.openMenu')}
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="min-w-0">
          <h2 className="font-display text-sm sm:text-lg font-semibold text-slate-900 truncate">
            {pageTitle}
          </h2>
        </div>
      </div>

      {/* Zone 2 & 3: Language Selector + Notifications + Quick SOS + User Profile */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <LanguageSelector compact />

        {/* Notifications Bell */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setNotifOpen((prev) => !prev)}
            className="relative p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
            aria-label={`${t('dashboard.notifications')}${unreadCount > 0 ? ` (${unreadCount})` : ''}`}
            aria-expanded={notifOpen}
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#198754] text-white text-[11px] font-semibold tabular-nums flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-xl shadow-lg z-40 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2">
                <span className="font-display text-sm font-semibold text-slate-900">
                  {t('dashboard.notifications')}
                </span>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      void markAllNotificationsRead().catch(() => {});
                    }}
                    className="inline-flex items-center gap-1 text-xs font-medium text-[#198754] hover:underline whitespace-nowrap shrink-0"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span>{t('common.markAllRead')}</span>
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                {notifications.length === 0 ? (
                  <p className="p-4 text-sm text-slate-500 text-center">{t('common.noNotifications')}</p>
                ) : (
                  notifications.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => {
                        void markNotificationRead(n.id).catch(() => {});
                        setNotifOpen(false);
                        navigate(n.domainRoute);
                      }}
                      className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors block ${
                        n.read ? 'bg-white' : 'bg-emerald-50/40'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-slate-900">
                          {language === 'kn' && n.titleKn ? n.titleKn : n.title}
                        </span>
                        <span className="text-xs text-slate-500 whitespace-nowrap shrink-0">
                          {language === 'kn' && n.timeKn ? n.timeKn : n.time}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                        {language === 'kn' && n.messageKn ? n.messageKn : n.message}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Quick SOS */}
        <Link
          to="/emergency"
          className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl bg-[#DC2626] hover:bg-red-700 text-white text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 min-h-[40px]"
        >
          <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span className="hidden sm:inline">{t('common.quickSos')}</span>
        </Link>

        {/* User Profile Link */}
        <Link
          to="/profile"
          className="hidden md:inline-flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors shrink-0 min-h-[40px]"
          aria-label={t('nav.profile')}
        >
          <img
            src={activeAvatar}
            alt={activeName}
            referrerPolicy="no-referrer"
            className="w-7 h-7 rounded-full object-cover bg-slate-200 shrink-0"
          />
          <span className="text-sm font-medium text-slate-800 max-w-[150px] truncate">
            {activeName}
          </span>
        </Link>
      </div>
    </header>
  );
};
