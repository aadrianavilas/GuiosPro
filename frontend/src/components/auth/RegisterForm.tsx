import React, { useState } from 'react';
import { ROUTES } from '@/constants/routes';
import type { RegisterPayload, FormErrorState } from '@/types';
import { GuiosProLogo } from '@/components/brand/GuiosProLogo';
import { GuiosProSpinner } from '@/components/brand/GuiosProSpinner';

interface RegisterFormProps {
  onSubmit?: (data: RegisterPayload) => Promise<void> | void;
  onNavigateToLogin?: () => void;
  isLoading?: boolean;
  errorMessage?: string | null;
  successMessage?: string | null;
}

export const RegisterForm: React.FC<RegisterFormProps> = ({
  onSubmit,
  onNavigateToLogin,
  isLoading = false,
  errorMessage = null,
  successMessage = null,
}) => {
  const [formData, setFormData] = useState<RegisterPayload>({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    password_confirm: '',
  });

  const [errors, setErrors] = useState<FormErrorState & { first_name?: string; last_name?: string; password_confirm?: string }>({});
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev: RegisterPayload) => ({ ...prev, [name]: value }));
    if (errors[name as keyof typeof errors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: typeof errors = {};
    if (!formData.first_name.trim()) {
      newErrors.first_name = 'Los nombres son obligatorios';
    }
    if (!formData.last_name.trim()) {
      newErrors.last_name = 'Los apellidos son obligatorios';
    }
    if (!formData.email.trim()) {
      newErrors.email = 'El correo electrónico es obligatorio';
    }
    if (!formData.password || formData.password.length < 8) {
      newErrors.password = 'La contraseña debe tener al menos 8 caracteres';
    }
    if (formData.password !== formData.password_confirm) {
      newErrors.password_confirm = 'Las contraseñas no coinciden';
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
      <div>
        {/* 1. Header con Logo GuiosPro */}
        <div className="mb-3 sm:mb-4">
          <GuiosProLogo textSize="text-2xl" />
        </div>

        {/* 2. Título y Asignación de Rol */}
        <div className="mb-3">
          <div className="flex items-center gap-2.5 mb-1 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-serif font-normal text-[#2B3F4C] tracking-tight">
              Crear cuenta
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#F9E8A0] text-[#5B4A12]">
              Decisor
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#4F6170]">
            Regístrate para evaluar y liderar la adopción de Software Libre
          </p>
        </div>

        {/* Mensaje de error general si aplica */}
        {errorMessage && (
          <div className="mb-3 p-2.5 rounded-[12px] bg-[#FDE2C8] border border-[#FBB982] text-[#7A3E0A] text-xs font-medium flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Mensaje de éxito si aplica */}
        {successMessage && (
          <div className="mb-3 p-2.5 rounded-[12px] bg-[#D5ECEC] border border-[#7FBFC1] text-[#16303B] text-xs font-medium flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0 text-[#1F7A4D]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <span>{successMessage}</span>
          </div>
        )}

        {/* 3. Formulario con campos del modelo User */}
        <form onSubmit={handleSubmit} className="space-y-2.5 sm:space-y-3">
          {/* Nombres y Apellidos en 2 columnas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#2B3F4C] mb-1 select-none">
                Nombres <span className="text-[#B8531A]">*</span>
              </label>
              <input
                type="text"
                name="first_name"
                value={formData.first_name}
                onChange={handleChange}
                placeholder="Ingresa tus nombres"
                className={`w-full px-3 py-2 border rounded-[12px] text-[#2B3F4C] placeholder-[#4F6170]/60 text-sm bg-white focus:outline-none transition ${errors.first_name
                  ? 'border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-400'
                  : 'border-[#D5ECEC] focus:border-[#7FBFC1] focus:ring-2 focus:ring-[#7FBFC1]/20'
                  }`}
              />
              {errors.first_name && (
                <p className="mt-1 text-xs text-red-500 font-medium pl-1">{errors.first_name}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#2B3F4C] mb-1 select-none">
                Apellidos <span className="text-[#B8531A]">*</span>
              </label>
              <input
                type="text"
                name="last_name"
                value={formData.last_name}
                onChange={handleChange}
                placeholder="Ingresa tus apellidos"
                className={`w-full px-3 py-2 border rounded-[12px] text-[#2B3F4C] placeholder-[#4F6170]/60 text-sm bg-white focus:outline-none transition ${errors.last_name
                  ? 'border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-400'
                  : 'border-[#D5ECEC] focus:border-[#7FBFC1] focus:ring-2 focus:ring-[#7FBFC1]/20'
                  }`}
              />
              {errors.last_name && (
                <p className="mt-1 text-xs text-red-500 font-medium pl-1">{errors.last_name}</p>
              )}
            </div>
          </div>

          {/* Correo electrónico */}
          <div>
            <label className="block text-xs font-semibold text-[#2B3F4C] mb-1 select-none">
              Correo electrónico <span className="text-[#B8531A]">*</span>
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Ingresa tu correo institucional"
              autoComplete="email"
              className={`w-full px-3 py-2 border rounded-[12px] text-[#2B3F4C] placeholder-[#4F6170]/60 text-sm bg-white focus:outline-none transition ${errors.email
                ? 'border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-400'
                : 'border-[#D5ECEC] focus:border-[#7FBFC1] focus:ring-2 focus:ring-[#7FBFC1]/20'
                }`}
            />
            {errors.email && (
              <p className="mt-1 text-xs text-red-500 font-medium pl-1">{errors.email}</p>
            )}
          </div>

          {/* Contraseña y Confirmar Contraseña en 2 columnas en pantallas sm para ahorrar espacio */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Contraseña */}
            <div>
              <label className="block text-xs font-semibold text-[#2B3F4C] mb-1 select-none">
                Contraseña <span className="text-[#B8531A]">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Mínimo 8 caracteres"
                  autoComplete="new-password"
                  className={`w-full pl-3 pr-8 py-2 border rounded-[12px] text-[#2B3F4C] placeholder-[#4F6170]/60 text-sm bg-white focus:outline-none transition ${errors.password
                    ? 'border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-400'
                    : 'border-[#D5ECEC] focus:border-[#7FBFC1] focus:ring-2 focus:ring-[#7FBFC1]/20'
                    }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-2 text-[#4F6170] hover:text-[#2B3F4C] transition p-0.5 cursor-pointer"
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
            </div>

            {/* Confirmar Contraseña */}
            <div>
              <label className="block text-xs font-semibold text-[#2B3F4C] mb-1 select-none">
                Confirmar contraseña <span className="text-[#B8531A]">*</span>
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                name="password_confirm"
                value={formData.password_confirm}
                onChange={handleChange}
                placeholder="Repite tu contraseña"
                autoComplete="new-password"
                className={`w-full px-3 py-2 border rounded-[12px] text-[#2B3F4C] placeholder-[#4F6170]/60 text-sm bg-white focus:outline-none transition ${errors.password_confirm
                  ? 'border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-400'
                  : 'border-[#D5ECEC] focus:border-[#7FBFC1] focus:ring-2 focus:ring-[#7FBFC1]/20'
                  }`}
              />
              {errors.password_confirm && (
                <p className="mt-1 text-xs text-red-500 font-medium pl-1">{errors.password_confirm}</p>
              )}
            </div>
          </div>

          {/* Botón Principal: Registrarse como Decisor */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-3 py-2.5 sm:py-3 px-6 bg-[#7FBFC1] hover:bg-[#72b1b3] text-[#16303B] font-semibold text-sm rounded-[14px] shadow-none transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <GuiosProSpinner size="xs" />
                <span>Registrando cuenta...</span>
              </>
            ) : (
              <span>Registrarse como Decisor &rarr;</span>
            )}
          </button>
        </form>
      </div>

      {/* 4. Footer con enlace a Login */}
      <div className="pt-3 text-center">
        <p className="text-xs text-[#4F6170]">
          ¿Ya tienes una cuenta?{' '}
          {onNavigateToLogin ? (
            <button
              type="button"
              onClick={onNavigateToLogin}
              className="text-[#2B3F4C] hover:text-[#16303B] font-bold underline transition cursor-pointer"
            >
              Inicia sesión
            </button>
          ) : (
            <a
              href={ROUTES.AUTH.LOGIN}
              className="text-[#2B3F4C] hover:text-[#16303B] font-bold underline transition"
            >
              Inicia sesión
            </a>
          )}
        </p>
      </div>
    </div>
  );
};
