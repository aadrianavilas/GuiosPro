import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LoginForm } from '@/components/auth/LoginForm';
import { AuthBanner } from '@/components/auth/AuthBanner';
import { ROUTES } from '@/constants/routes';
import type { LoginCredentials } from '@/types';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const reason = sessionStorage.getItem('guiospro_logout_reason');
    if (reason === 'inactivity') {
      setErrorMessage('Tu sesión ha expirado por inactividad. Por favor, inicia sesión nuevamente.');
      sessionStorage.removeItem('guiospro_logout_reason');
    }
  }, []);

  const handleLogin = async (credentials: LoginCredentials) => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/v1/auth/login/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(credentials),
      });

      const data = await response.json();

      if (!response.ok) {
        setErrorMessage(
          data.detail ||
          data.non_field_errors?.[0] ||
          'Credenciales incorrectas. Verifique su correo o contraseña.'
        );
        return;
      }

      // Si requiere MFA por doble factor
      if (data.mfa_required) {
        const mfaState = {
          email: data.email || credentials.email,
          codeLength: data.code_length || 6,
          tempToken: data.temp_token || null,
        };
        sessionStorage.setItem('guiospro_mfa_pending', JSON.stringify(mfaState));
        navigate(ROUTES.AUTH.MFA_EMAIL, { state: mfaState });
        return;
      }

      // Guardar información básica de sesión
      const user = data.user;
      const firstName = user?.first_name || 'Usuario';
      const userGroups: string[] = Array.isArray(user?.groups) ? user.groups : [];
      const isAdminUser = Boolean(
        user?.is_superuser ||
        user?.is_staff ||
        user?.role === 'Administrador' ||
        userGroups.includes('Administrador')
      );
      const role = isAdminUser ? 'Administrador' : (user?.role || userGroups[0] || 'Decisor');
      const hasOrganization = !isAdminUser && user?.organization !== null && user?.organization !== undefined;

      localStorage.setItem('guiospro_active_group', role);
      localStorage.setItem('guiospro_user', JSON.stringify({
        id: user?.id,
        firstName,
        username: user?.username,
        email: user?.email,
        role,
        groups: userGroups.length > 0 ? userGroups : [role],
        isAdmin: isAdminUser,
        hasOrganization,
        organization: isAdminUser ? null : user?.organization,
        avatar: user?.avatar,
      }));

      // Redirección por URL: Un administrador nunca ingresa organización
      if (!isAdminUser && role === 'Decisor' && !hasOrganization) {
        navigate(ROUTES.AUTH.ORGANIZATION_SETUP);
      } else {
        navigate(ROUTES.DASHBOARD.HOME);
      }
    } catch {
      setErrorMessage('No se pudo establecer la conexión. Por favor, intente nuevamente en unos instantes.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-white flex flex-col lg:flex-row font-sans selection:bg-[#F9E8A0] selection:text-[#5B4A12]">
      {/* Columna Izquierda: Formulario de Login */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-6 sm:p-12 lg:p-16 xl:p-20">
        <div className="w-full max-w-md">
          <LoginForm
            onSubmit={handleLogin}
            onNavigateToRegister={() => navigate(ROUTES.AUTH.REGISTER)}
            isLoading={isLoading}
            errorMessage={errorMessage}
          />
        </div>
      </div>

      {/* Columna Derecha: Banner Ilustrativo GuiosPro (Pantalla completa con margen y rounded-[32px]) */}
      <div className="hidden lg:flex lg:w-1/2 p-6 lg:p-8 xl:p-10 items-stretch">
        <div className="w-full h-full">
          <AuthBanner
            caption="Evalúa, compara y toma decisiones seguras en la adopción de software libre con GuiosPro."
          />
        </div>
      </div>
    </div>
  );
};
