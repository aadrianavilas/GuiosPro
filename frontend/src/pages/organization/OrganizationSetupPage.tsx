import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { OrganizationForm } from '@/components/organization/OrganizationForm';
import { AuthBanner } from '@/components/auth/AuthBanner';
import { ROUTES } from '@/constants/routes';
import type { OrganizationPayload } from '@/types';
import { GuiosProLogo } from '@/components/brand/GuiosProLogo';

export const OrganizationSetupPage: React.FC = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Obtener nombre del usuario si existe en sesión
  const userStr = localStorage.getItem('guiospro_user');
  const user = userStr ? JSON.parse(userStr) : null;
  const userName = user?.firstName || 'Decisor';

  // Si el usuario es Administrador, no debe configurar organización: redirigir a dashboard
  useEffect(() => {
    if (user?.role === 'Administrador' || user?.isAdmin) {
      navigate(ROUTES.DASHBOARD.HOME, { replace: true });
    }
  }, [user, navigate]);

  const handleSubmit = async (data: OrganizationPayload) => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/v1/organization/setup/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        const firstError =
          result.detail ||
          result.business_name?.[0] ||
          result.non_field_errors?.[0] ||
          'No se pudo registrar la organización. Intente nuevamente.';
        setErrorMessage(firstError);
        return;
      }

      // Actualizar estado de organización en almacenamiento local
      if (user) {
        user.hasOrganization = true;
        localStorage.setItem('guiospro_user', JSON.stringify(user));
      }

      // Registro exitoso → navegar a la URL del Dashboard
      navigate(ROUTES.DASHBOARD.HOME);
    } catch {
      setErrorMessage('No se pudo registrar la organización. Por favor, intente nuevamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-white flex flex-col lg:flex-row font-sans selection:bg-[#F9E8A0] selection:text-[#5B4A12]">
      {/* ── Columna Izquierda: Formulario ── */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-6 sm:p-12 lg:p-16 xl:p-20 overflow-y-auto">
        <div className="w-full max-w-md space-y-6">
          {/* Logo GuiosPro */}
          <GuiosProLogo textSize="text-2xl" />

          <div>
            <span className="inline-block bg-[#F9E8A0] text-[#5B4A12] text-xs font-bold px-3 py-1 rounded-full mb-3">
              Configuración inicial
            </span>
            <h1 className="text-4xl font-serif text-[#2B3F4C] leading-tight">
              ¡Bienvenido, {userName}!
            </h1>
            <p className="mt-2 text-sm text-[#4F6170]">
              Para comenzar, registra los datos de tu organización. Esta información es necesaria para asociar las evaluaciones que realices.
            </p>
          </div>

          {/* Formulario */}
          <OrganizationForm
            onSubmit={handleSubmit}
            isLoading={isLoading}
            errorMessage={errorMessage}
          />
        </div>
      </div>

      {/* ── Columna Derecha: Panel ilustrativo oficial con los colores de GuiosPro ── */}
      <div className="hidden lg:flex lg:w-1/2 p-6 lg:p-8 xl:p-10 items-stretch">
        <div className="w-full h-full">
          <AuthBanner
            caption="Configura tu organización y comienza a evaluar la adopción de software libre de manera formal y segura con GuiosPro."
          />
        </div>
      </div>
    </div>
  );
};
