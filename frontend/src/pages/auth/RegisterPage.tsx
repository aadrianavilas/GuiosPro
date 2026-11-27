import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RegisterForm } from '@/components/auth/RegisterForm';
import { AuthBanner } from '@/components/auth/AuthBanner';
import { ROUTES } from '@/constants/routes';
import type { RegisterPayload } from '@/types';

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleRegister = async (data: RegisterPayload) => {
    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch('/api/v1/auth/register/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        // Manejar errores de validación de campos
        const firstErrorKey = Object.keys(result)[0];
        const errorDetail = Array.isArray(result[firstErrorKey])
          ? result[firstErrorKey][0]
          : result.detail || result[firstErrorKey] || 'Error al procesar el registro.';
        
        setErrorMessage(errorDetail);
        return;
      }

      setSuccessMessage(
        `¡Cuenta creada exitosamente para ${result.user?.first_name || 'usuario'} con rol Decisor! Redirigiendo a inicio de sesión...`
      );

      // Redirigir a login después de 2 segundos
      setTimeout(() => {
        navigate(ROUTES.AUTH.LOGIN);
      }, 2000);
    } catch {
      setErrorMessage('No se pudo completar el registro. Por favor, intente nuevamente en unos instantes.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen lg:h-screen w-full bg-white flex flex-col lg:flex-row font-sans selection:bg-[#F9E8A0] selection:text-[#5B4A12] overflow-y-auto lg:overflow-hidden">
      {/* Columna Izquierda: Formulario de Registro */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center py-4 px-6 sm:px-10 lg:px-10 xl:px-14 h-full overflow-y-auto lg:overflow-visible">
        <div className="w-full max-w-md my-auto">
          <RegisterForm
            onSubmit={handleRegister}
            onNavigateToLogin={() => navigate(ROUTES.AUTH.LOGIN)}
            isLoading={isLoading}
            errorMessage={errorMessage}
            successMessage={successMessage}
          />
        </div>
      </div>

      {/* Columna Derecha: Banner Ilustrativo GuiosPro */}
      <div className="hidden lg:flex lg:w-1/2 p-4 sm:p-6 lg:p-6 xl:p-8 items-center justify-center h-full">
        <div className="w-full h-full max-h-[94vh] flex items-center justify-center">
          <AuthBanner
            caption="Únete a GuiosPro como Decisor y comienza a evaluar la adopción de software libre para tu organización."
            className="max-h-full"
          />
        </div>
      </div>
    </div>
  );
};
