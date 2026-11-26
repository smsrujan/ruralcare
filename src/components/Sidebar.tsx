import React from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  User,
  LayoutDashboard,
  CreditCard,
  Stethoscope,
  MessageSquareHeart,
  HeartPulse,
  CalendarCheck,
  AlertTriangle,
  LogOut,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { RuralCareLogo } from './RuralCareLogo';

interface SidebarProps {
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onRequestLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  mobileOpen,
  onCloseMobile,
  onRequestLogout,
}) => {
  const { patient, doctorAccount, userRole } = useAuth();
  const { t } = useTranslation();

  const domainLinks = [
    { label: t('nav.profile'), path: '/profile', icon: User },
    {
      label: t('nav.dashboard'),
      path: userRole === 'doctor' ? '/doctor-dashboard' : '/dashboard',
      icon: LayoutDashboard,
    },
    { label: t('nav.healthCard'), path: '/health-card', icon: CreditCard },
    { label: t('nav.doctorDetails'), path: '/doctors', icon: Stethoscope },
    { label: t('nav.connectDoctor'), path: '/connect-doctor', icon: MessageSquareHeart },
    { label: t('nav.services'), path: '/services', icon: HeartPulse },
    { label: t('nav.appointments'), path: '/appointments', icon: CalendarCheck },
    { label: t('nav.emergency'), path: '/emergency', icon: AlertTriangle, emergency: true },
  ];

  const activeName = userRole === 'doctor' ? doctorAccount.fullName : patient.fullName;
  const activeId = userRole === 'doctor' ? doctorAccount.registrationNumber : patient.healthId;
  const activeAvatar = userRole === 'doctor' ? doctorAccount.photoUrl : patient.avatarUrl;

  const navContent = (
    <div className="flex flex-col h-full bg-white border-r border-slate-200 w-72 shrink-0">
      <div className="flex items-center justify-between px-5 h-16 border-b border-slate-200 shrink-0">
        <RuralCareLogo size="md" />
        <button
          type="button"
          onClick={onCloseMobile}
          className="lg:hidden p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 min-h-[40px] min-w-[40px] flex items-center justify-center"
          aria-label={t('common.closeMenu')}
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* User Quick Summary */}
      <div className="px-4 py-4 border-b border-slate-100">
        <div className="flex items-center gap-3 p-2.5 rounded-xl bg-[#F5F7FA]">
          <img
            src={activeAvatar}
            alt={activeName}
            referrerPolicy="no-referrer"
            className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0 bg-slate-200"
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">{activeName}</p>
            <p className="text-xs text-slate-500 font-mono tabular-nums truncate">{activeId}</p>
          </div>
        </div>
      </div>

      {/* Strictly the 8 Main Domains */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1" aria-label="Primary RuralCare Domains">
        {domainLinks.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onCloseMobile}
              className={({ isActive }) => {
                if (item.emergency) {
                  return `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors min-h-[44px] ${
                    isActive
                      ? 'bg-[#DC2626] text-white'
                      : 'text-[#DC2626] hover:bg-red-50'
                  }`;
                }
                return `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors min-h-[44px] ${
                  isActive
                    ? 'bg-[#198754] text-white'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                }`;
              }}
            >
              <Icon className="w-[18px] h-[18px] shrink-0" aria-hidden="true" />
              <span className="leading-snug">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Logout Button */}
      <div className="p-4 border-t border-slate-200 shrink-0">
        <button
          type="button"
          onClick={onRequestLogout}
          className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-red-50 hover:text-[#DC2626] transition-colors min-h-[44px]"
        >
          <LogOut className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{t('common.logout')}</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:flex lg:shrink-0">{navContent}</aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/50"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative z-10 flex h-full">{navContent}</aside>
        </div>
      )}
    </>
  );
};
