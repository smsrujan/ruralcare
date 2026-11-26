import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppLayout } from './components/AppLayout';
import { Login } from './pages/Login';
import { DoctorLogin } from './pages/DoctorLogin';
import { Register } from './pages/Register';
import { ForgotPassword } from './pages/ForgotPassword';
import { Profile } from './pages/Profile';
import { Dashboard } from './pages/Dashboard';
import { HealthCardPage } from './pages/HealthCardPage';
import { DoctorDetails } from './pages/DoctorDetails';
import { DoctorPatientConnection } from './pages/DoctorPatientConnection';
import { Services } from './pages/Services';
import { DoctorAppointment } from './pages/DoctorAppointment';
import { EmergencyAlert } from './pages/EmergencyAlert';

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Authentication Entry Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/doctor-login" element={<DoctorLogin />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/doctor-forgot-password" element={<ForgotPassword mode="doctor" />} />

            {/* Protected 8 Main Domains */}
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/profile" element={<Profile />} />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute allowedRoles={['patient']}>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/doctor-dashboard"
                element={
                  <ProtectedRoute allowedRoles={['doctor']}>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route path="/health-card" element={<HealthCardPage />} />
              <Route path="/doctors" element={<DoctorDetails />} />
              <Route path="/connect-doctor" element={<DoctorPatientConnection />} />
              <Route path="/services" element={<Services />} />
              <Route path="/appointments" element={<DoctorAppointment />} />
              <Route path="/emergency" element={<EmergencyAlert />} />
            </Route>

            {/* Default Entry & Fallback */}
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </LanguageProvider>
  );
}
