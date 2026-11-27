import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';
import type { LoginCredentials, FormErrorState } from '@/types';
import { GuiosProLogo } from '@/components/brand/GuiosProLogo';
import { GuiosProSpinner } from '@/components/brand/GuiosProSpinner';

interface LoginFormProps {
  onSubmit?: (credentials: LoginCredentials) => Promise<void> | void;
  onNavigateToRegister?: () => void;
  isLoading?: boolean;
  errorMessage?: string | null;
}

export const LoginForm: React.FC<LoginFormProps> = ({
  onSubmit,
  onNavigateToRegister,
  isLoading = false,
  errorMessage = null,
}) => {
  const [formData, setFormData] = useState<LoginCredentials>({
    email: '',
    password: '',
  });

  const [errors, setErrors] = useState<FormErrorState>({});
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev: LoginCredentials) => ({ ...prev, [name]: value }));
    if (errors[name as keyof FormErrorState]) {
      setErrors((prev: FormErrorState) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: FormErrorState = {};
    if (!formData.email.trim()) {
      newErrors.email = 'El correo electrónico es obligatorio';
    }
    if (!formData.password) {
      newErrors.password = 'La contraseña es obligatoria';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    if (onSubmit) {
      await onSubmit(formData);
    }
  };

  return (
    <div className="w-full flex flex-col justify-between bg-white">
      {/* 1. Header con Logo GuiosPro */}
      <div>
        <div className="mb-8">
          <GuiosProLogo textSize="text-2xl" />
        </div>

        {/* 2. Título y Subtítulo en Español */}
        <div className="mb-8">
          <h1 className="text-4xl sm:text-5xl font-serif font-normal text-[#2B3F4C] tracking-tight leading-tight">
            ¡Bienvenido de nuevo!
          </h1>
          <p className="text-sm text-[#4F6170] mt-2 font-normal">
            Ingresa tus credenciales para acceder al sistema.
          </p>
        </div>

        {/* Mensaje de error general si aplica */}
        {errorMessage && (
          <div className="mb-5 p-3 rounded-[14px] bg-[#FDE2C8] border border-[#FBB982] text-[#7A3E0A] text-xs font-medium flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* 3. Formulario de Credenciales */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Campo Correo electrónico */}
          <div>
            <label className="block text-xs font-semibold text-[#2B3F4C] mb-1.5 select-none">
              Correo electrónico
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#4F6170]">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </span>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Ingresa tu correo"
                autoComplete="email"
                className={`w-full pl-10 pr-4 py-3 border rounded-[14px] text-[#2B3F4C] placeholder-[#4F6170]/60 text-sm bg-white focus:outline-none transition ${
                  errors.email
                    ? 'border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-400'
                    : 'border-[#D5ECEC] focus:border-[#7FBFC1] focus:ring-2 focus:ring-[#7FBFC1]/20'
                }`}
              />
            </div>
            {errors.email && (
              <p className="mt-1 text-xs text-red-500 font-medium pl-1">{errors.email}</p>
            )}
          </div>

          {/* Campo Contraseña con botón de visibilidad */}
          <div>
            <label className="block text-xs font-semibold text-[#2B3F4C] mb-1.5 select-none">
              Contraseña
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#4F6170]">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Ingresa tu contraseña"
                autoComplete="current-password"
                className={`w-full pl-10 pr-11 py-3 border rounded-[14px] text-[#2B3F4C] placeholder-[#4F6170]/60 text-sm bg-white focus:outline-none transition ${
                  errors.password
                    ? 'border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-400'
                    : 'border-[#D5ECEC] focus:border-[#7FBFC1] focus:ring-2 focus:ring-[#7FBFC1]/20'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-3 text-[#4F6170] hover:text-[#2B3F4C] transition p-0.5 cursor-pointer"
                aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
              >
                {showPassword ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
            {errors.password && (
              <p className="mt-1 text-xs text-red-500 font-medium pl-1">{errors.password}</p>
            )}

            {/* Enlace Olvidé mi contraseña */}
            <div className="flex justify-end mt-2">
              <Link
                to={ROUTES.AUTH.FORGOT_PASSWORD}
                className="text-xs text-[#2B3F4C] underline hover:text-[#16303B] transition"
              >
                ¿Olvidaste tu contraseña?
              </Link>
            </div>
          </div>

          {/* Botón Principal: Iniciar sesión */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 px-6 bg-[#7FBFC1] hover:bg-[#72b1b3] text-[#16303B] font-semibold text-sm rounded-[14px] shadow-none transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <GuiosProSpinner size="xs" />
                <span>Iniciando sesión...</span>
              </>
            ) : (
              <span>Iniciar sesión &rarr;</span>
            )}
          </button>
        </form>
      </div>

      {/* 4. Footer con Enlace directo a Registro */}
      <div className="pt-8 text-center">
        <p className="text-xs text-[#4F6170]">
          ¿No tienes una cuenta?{' '}
          {onNavigateToRegister ? (
            <button
              type="button"
              onClick={onNavigateToRegister}
              className="text-[#2B3F4C] hover:text-[#16303B] font-bold underline transition cursor-pointer"
            >
              Regístrate
            </button>
          ) : (
            <a
              href={ROUTES.AUTH.REGISTER}
              className="text-[#2B3F4C] hover:text-[#16303B] font-bold underline transition"
            >
              Regístrate
            </a>
          )}
        </p>
      </div>
    </div>
  );
};
