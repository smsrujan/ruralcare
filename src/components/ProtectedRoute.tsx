import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth, type UserRole } from '../context/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { isAuthenticated, authLoading, justLoggedOut, userRole, doctorVerified } = useAuth();
  const location = useLocation();

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center p-6">
        <div className="flex items-center gap-3 text-slate-700 font-medium text-sm">
          <Loader2 className="w-5 h-5 animate-spin text-[#198754]" aria-hidden="true" />
          <span>Verifying session...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    if (justLoggedOut) {
      return <Navigate to="/login" replace />;
    }
    const isDoctorOnly =
      (allowedRoles && allowedRoles.length === 1 && allowedRoles[0] === 'doctor') ||
      location.pathname === '/doctor-dashboard';
    return (
      <Navigate
        to={isDoctorOnly ? '/doctor-login' : '/login'}
        state={{ from: location }}
        replace
      />
    );
  }

  if (allowedRoles && !allowedRoles.includes(userRole)) {
    return (
      <Navigate
        to={userRole === 'doctor' ? '/doctor-dashboard' : '/dashboard'}
        replace
      />
    );
  }

  if (userRole === 'doctor' && !doctorVerified) {
    return <Navigate to="/doctor-login" replace />;
  }

  return <>{children}</>;
};
