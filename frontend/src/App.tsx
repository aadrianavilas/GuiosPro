import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import { MFAVerificationPage } from '@/pages/auth/MFAVerificationPage';
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage';
import { OrganizationSetupPage } from '@/pages/organization/OrganizationSetupPage';
import { DashboardLayout } from '@/pages/dashboard/DashboardLayout';
import { ToastProvider } from '@/context/ToastContext';
import { ROUTES } from '@/constants/routes';

function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          {/* ── Rutas de Autenticación ── */}
          <Route path={ROUTES.AUTH.LOGIN} element={<LoginPage />} />
          <Route path={ROUTES.AUTH.REGISTER} element={<RegisterPage />} />
          <Route path={ROUTES.AUTH.ORGANIZATION_SETUP} element={<OrganizationSetupPage />} />
          <Route path={ROUTES.AUTH.MFA_EMAIL} element={<MFAVerificationPage />} />
          <Route path="/auth/email-mfa" element={<MFAVerificationPage />} />
          <Route path={ROUTES.AUTH.FORGOT_PASSWORD} element={<ForgotPasswordPage />} />
          <Route path={ROUTES.AUTH.RESET_PASSWORD} element={<ForgotPasswordPage />} />

          {/* ── Rutas de Dashboard y Administración con Sidebar ── */}
          <Route path="/dashboard" element={<DashboardLayout />} />
          <Route path="/organization" element={<DashboardLayout />} />
          <Route path="/evaluations/*" element={<DashboardLayout />} />
          <Route path="/evaluaciones/*" element={<DashboardLayout />} />
          <Route path="/profile" element={<DashboardLayout />} />
          <Route path="/methodology/*" element={<DashboardLayout />} />
          <Route path="/config/*" element={<DashboardLayout />} />
          <Route path="/admin/*" element={<DashboardLayout />} />

          {/* Compatibilidad hacia atrás con prefijo dashboard */}
          <Route path="/dashboard/*" element={<DashboardLayout />} />

          {/* ── Cualquier otra ruta redirige a la raíz ── */}
          <Route path="*" element={<Navigate to={ROUTES.AUTH.LOGIN} replace />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}

export default App;
