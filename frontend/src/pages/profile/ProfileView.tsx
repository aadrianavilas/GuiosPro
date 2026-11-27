import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useToast } from '@/context/ToastContext';
import { GuiosProSpinner } from '@/components/brand/GuiosProSpinner';
import type { User } from '@/types';
import { getAvatarUrl } from '@/utils/avatar';
import { validatePassword } from '@/utils/passwordValidation';

interface ProfileFormState {
  first_name: string;
  last_name: string;
  email: string;
  username: string;
  organization_name?: string;
  role?: string;
  avatarUrl?: string | null;
  avatarFile?: File | null;
  new_password: string;
  confirm_password: string;
  is_mfa_enabled: boolean;
}

export const ProfileView: React.FC = () => {
  const toast = useToast();
  const [form, setForm] = useState<ProfileFormState>({
    first_name: '',
    last_name: '',
    email: '',
    username: '',
    organization_name: '',
    role: 'Decisor',
    avatarUrl: null,
    avatarFile: null,
    new_password: '',
    confirm_password: '',
    is_mfa_enabled: false,
  });

  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarLoadError, setAvatarLoadError] = useState<boolean>(false);
  const [removeAvatarFlag, setRemoveAvatarFlag] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoadingFetch, setIsLoadingFetch] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isTogglingMFA, setIsTogglingMFA] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setAvatarLoadError(false);
  }, [avatarPreview]);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await fetch('/api/v1/auth/profile/', {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          const user: User = data.user;
          const userRole = user.groups?.[0] || 'Decisor';

          setForm({
            first_name: user.first_name || '',
            last_name: user.last_name || '',
            email: user.email || '',
            username: user.username || '',
            organization_name: user.organization_name || '',
            role: userRole,
            avatarUrl: user.avatar || null,
            avatarFile: null,
            new_password: '',
            confirm_password: '',
            is_mfa_enabled: Boolean(user.is_mfa_enabled),
          });

          if (user.avatar) {
            setAvatarPreview(getAvatarUrl(user.avatar));
          }
        } else {
          // Si no responde el endpoint, leer datos desde localStorage como respaldo
          const userStr = localStorage.getItem('guiospro_user');
          if (userStr) {
            const localUser = JSON.parse(userStr);
            setForm((prev) => ({
              ...prev,
              first_name: localUser.firstName || '',
              role: localUser.role || 'Decisor',
            }));
            if (localUser.avatar) {
              setAvatarPreview(getAvatarUrl(localUser.avatar));
            }
          }
        }
      } catch (err) {
        console.error('Error al cargar perfil de usuario:', err);
        toast.error('No se pudo cargar la información del usuario.');
      } finally {
        setIsLoadingFetch(false);
      }
    };

    fetchProfile();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => {
        const updated = { ...prev };
        delete updated[name];
        return updated;
      });
    }
  };

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrors((prev) => ({ ...prev, avatar: 'Por favor selecciona un archivo de imagen válido.' }));
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setErrors((prev) => ({ ...prev, avatar: 'La imagen debe ser menor a 2MB.' }));
      return;
    }

    setRemoveAvatarFlag(false);
    setForm((prev) => ({ ...prev, avatarFile: file }));
    const objectUrl = URL.createObjectURL(file);
    setAvatarPreview(objectUrl);

    setErrors((prev) => {
      const updated = { ...prev };
      delete updated.avatar;
      return updated;
    });
  };

  const handleRemoveAvatar = () => {
    setRemoveAvatarFlag(true);
    setForm((prev) => ({ ...prev, avatarFile: null, avatarUrl: null }));
    setAvatarPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleToggleMFA = async () => {
    const nextValue = !form.is_mfa_enabled;
    setIsTogglingMFA(true);
    try {
      const response = await fetch('/api/v1/auth/profile/', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ is_mfa_enabled: nextValue }),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.detail || 'No se pudo actualizar el estado de autenticación por doble factor.');
        return;
      }
      setForm((prev) => ({ ...prev, is_mfa_enabled: nextValue }));
      if (nextValue) {
        toast.success('Autenticación por doble factor activada correctamente.');
      } else {
        toast.info('Autenticación por doble factor desactivada.');
      }
    } catch {
      toast.error('Error de red al actualizar la autenticación por doble factor.');
    } finally {
      setIsTogglingMFA(false);
    }
  };

  // Validación en tiempo real de contraseña para el perfil
  const profilePasswordValidation = useMemo(() => {
    return validatePassword(form.new_password, form.confirm_password, {
      first_name: form.first_name,
      last_name: form.last_name,
      username: form.username,
      email: form.email,
    });
  }, [form.new_password, form.confirm_password, form.first_name, form.last_name, form.username, form.email]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!form.first_name.trim()) {
      newErrors.first_name = 'Los nombres son obligatorios.';
    }
    if (!form.last_name.trim()) {
      newErrors.last_name = 'Los apellidos son obligatorios.';
    }

    if (form.new_password || form.confirm_password) {
      if (!form.new_password) {
        newErrors.new_password = 'Debes ingresar la nueva contraseña.';
      } else if (profilePasswordValidation.firstError) {
        newErrors.new_password = profilePasswordValidation.firstError;
      }

      if (!form.confirm_password) {
        newErrors.confirm_password = 'Debes repetir la nueva contraseña.';
      } else if (!profilePasswordValidation.isMatch) {
        newErrors.confirm_password = 'Las contraseñas no coinciden exactamente.';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setIsSaving(true);
    try {
      const formData = new FormData();
      formData.append('first_name', form.first_name.trim());
      formData.append('last_name', form.last_name.trim());

      if (form.avatarFile) {
        formData.append('avatar', form.avatarFile);
      } else if (removeAvatarFlag) {
        formData.append('remove_avatar', 'true');
      }

      if (form.new_password) {
        formData.append('new_password', form.new_password);
        formData.append('confirm_password', form.confirm_password);
      }

      const response = await fetch('/api/v1/auth/profile/', {
        method: 'PUT',
        credentials: 'include',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        const errorMsg =
          result.detail ||
          result.confirm_password?.[0] ||
          result.new_password?.[0] ||
          result.first_name?.[0] ||
          result.last_name?.[0] ||
          'Error al guardar los cambios del perfil.';
        toast.error(errorMsg);
        return;
      }

      if (result.user) {
        const updatedUser: User = result.user;
        setForm((prev) => ({
          ...prev,
          first_name: updatedUser.first_name,
          last_name: updatedUser.last_name,
          avatarUrl: updatedUser.avatar || null,
          avatarFile: null,
          new_password: '',
          confirm_password: '',
        }));
        if (updatedUser.avatar) {
          setAvatarPreview(getAvatarUrl(updatedUser.avatar));
        } else {
          setAvatarPreview(null);
        }

        // Actualizar datos locales de usuario para reflejar de inmediato en la barra lateral
        const userStr = localStorage.getItem('guiospro_user');
        const existingData = userStr ? JSON.parse(userStr) : {};
        const mergedUser = {
          ...existingData,
          firstName: updatedUser.first_name,
          avatar: updatedUser.avatar,
        };
        localStorage.setItem('guiospro_user', JSON.stringify(mergedUser));

        // Notificar al DashboardLayout para actualizar el Sidebar sin recargar la página
        window.dispatchEvent(new CustomEvent('guiospro_user_updated', { detail: updatedUser }));
      }

      toast.success('¡Datos del perfil actualizados correctamente!');
    } catch {
      toast.error('No se pudieron guardar los cambios. Intente nuevamente.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoadingFetch) {
    return (
      <div className="h-64 flex items-center justify-center">
        <GuiosProSpinner size="xl" label="Cargando perfil de usuario..." />
      </div>
    );
  }

  const fullName = `${form.first_name.trim()} ${form.last_name.trim()}`.trim() || 'Adrián Decisor';
  const initial = (form.first_name.trim() || 'A').charAt(0).toUpperCase();
  const normalizedPreview = getAvatarUrl(avatarPreview);

  return (
    <div className="w-full space-y-6 pb-12 font-sans">
      {/* ── Banner Superior Hero con Paleta GuiosPro (Naranja #F7A35F) ── */}
      <div className="relative w-full rounded-[28px] bg-[#F7A35F] p-6 sm:p-8 text-[#1F3340] overflow-hidden shadow-none flex items-center justify-between">
        {/* Círculos decorativos en Naranja claro #FBB982 */}
        <div className="absolute right-28 -bottom-16 w-60 h-60 rounded-full bg-[#FBB982]/60 pointer-events-none" />
        <div className="absolute -top-12 -right-10 w-44 h-44 rounded-full bg-[#FBB982]/60 pointer-events-none" />

        <div className="relative z-10 max-w-xl space-y-2">
          <span className="inline-block bg-[#FDE2C8] text-[#7A3E0A] text-[10px] sm:text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
            PERFIL DE USUARIO
          </span>
          <h1 className="text-3xl sm:text-4xl font-serif text-[#1F3340] leading-tight">
            Datos del usuario
          </h1>
          <p className="text-xs sm:text-sm text-[#1F3340]/90 font-medium leading-relaxed max-w-lg">
            Información personal y credenciales de acceso a la plataforma GuiosPro.
          </p>
        </div>

        {/* Ilustración de perfil con badge idéntico al diseño */}
        <div className="relative z-10 hidden md:flex items-center justify-center shrink-0 pr-2">
          <div className="w-28 h-22 rounded-[18px] bg-white p-3.5 relative flex flex-col items-center justify-center shadow-none border border-white/60">
            {/* Badge circular oscuro con checkmark blanco */}
            <div className="absolute -top-2.5 -right-2.5 w-7 h-7 rounded-full bg-[#2B3F4C] text-white flex items-center justify-center font-bold text-xs shadow-none">
              ✓
            </div>
            {/* Ícono grande estilizado */}
            <div className="w-12 h-12 rounded-full bg-[#D5ECEC] flex items-center justify-center text-[#16303B]">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* ── Grid Principal: 2 Columnas (Idéntica a Organización) ── */}
      <form onSubmit={handleSubmit} noValidate className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* COLUMNA IZQUIERDA: Tarjetas de Formulario */}
        <div className="lg:col-span-2 space-y-5">

          {/* Tarjeta 1: Información personal */}
          <div className="bg-white rounded-[24px] p-6 border border-[#D5ECEC] shadow-none space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-[14px] bg-[#F9E8A0] text-[#5B4A12] flex items-center justify-center font-bold shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-serif text-[#2B3F4C]">Información personal</h2>
                <p className="text-xs text-[#4F6170]">Datos identificativos y avatar de tu cuenta.</p>
              </div>
            </div>

            {/* Apartado de Avatar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-[18px] bg-[#F6F5F3]/80 border border-[#D5ECEC]">
              <div className="relative shrink-0">
                {normalizedPreview && !avatarLoadError ? (
                  <img
                    src={normalizedPreview}
                    alt="Avatar de usuario"
                    onError={() => setAvatarLoadError(true)}
                    className="w-16 h-16 rounded-full object-cover border-2 border-[#7FBFC1] shadow-none"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-[#F7A35F] text-[#1F3340] flex items-center justify-center font-bold text-2xl border-2 border-white shadow-none">
                    {initial}
                  </div>
                )}
              </div>

              <div className="flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleAvatarFileChange}
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    id="avatar-upload-input"
                  />
                  <label
                    htmlFor="avatar-upload-input"
                    className="bg-white hover:bg-[#D5ECEC]/50 text-[#2B3F4C] border border-[#D5ECEC] hover:border-[#7FBFC1] font-semibold text-xs py-2 px-3.5 rounded-[12px] transition cursor-pointer flex items-center gap-1.5 shadow-none"
                  >
                    <svg className="w-4 h-4 text-[#4F6170]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                    </svg>
                    <span>Cambiar avatar</span>
                  </label>

                  {avatarPreview && (
                    <button
                      type="button"
                      onClick={handleRemoveAvatar}
                      className="text-xs text-[#B84318] hover:text-[#932F0C] font-semibold py-2 px-3 rounded-[12px] border border-transparent hover:border-[#FBB982] transition cursor-pointer"
                    >
                      Quitar foto
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-[#4F6170]">
                  Formatos permitidos: JPG, PNG o WebP. Tamaño máximo recomendado: 2MB.
                </p>
                {errors.avatar && <p className="text-[11px] text-red-500 font-semibold">{errors.avatar}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              {/* Nombres (Editable) */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#2B3F4C] flex items-center justify-between">
                  <span>Nombres <span className="text-[#B8531A] font-bold">*</span></span>
                  <span className="text-[10px] font-bold text-[#7A3E0A] bg-[#FDE2C8] px-2 py-0.5 rounded-full">Obligatorio</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#4F6170] pointer-events-none">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    name="first_name"
                    value={form.first_name}
                    onChange={handleChange}
                    placeholder="Tus nombres"
                    className={`w-full rounded-[14px] border pl-10 pr-3.5 py-2.5 text-sm text-[#2B3F4C] focus:outline-none focus:border-[#7FBFC1] focus:ring-2 focus:ring-[#7FBFC1]/20 transition ${
                      errors.first_name ? 'border-red-400 bg-red-50/30' : 'border-[#D5ECEC] bg-white hover:border-[#B4D6D6]'
                    }`}
                  />
                </div>
                {errors.first_name && <p className="text-[11px] text-red-500">{errors.first_name}</p>}
              </div>

              {/* Apellidos (Editable) */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#2B3F4C] flex items-center justify-between">
                  <span>Apellidos <span className="text-[#B8531A] font-bold">*</span></span>
                  <span className="text-[10px] font-bold text-[#7A3E0A] bg-[#FDE2C8] px-2 py-0.5 rounded-full">Obligatorio</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#4F6170] pointer-events-none">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    name="last_name"
                    value={form.last_name}
                    onChange={handleChange}
                    placeholder="Tus apellidos"
                    className={`w-full rounded-[14px] border pl-10 pr-3.5 py-2.5 text-sm text-[#2B3F4C] focus:outline-none focus:border-[#7FBFC1] focus:ring-2 focus:ring-[#7FBFC1]/20 transition ${
                      errors.last_name ? 'border-red-400 bg-red-50/30' : 'border-[#D5ECEC] bg-white hover:border-[#B4D6D6]'
                    }`}
                  />
                </div>
                {errors.last_name && <p className="text-[11px] text-red-500">{errors.last_name}</p>}
              </div>

              {/* Nombre de usuario (Solo lectura) */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#2B3F4C] flex items-center justify-between">
                  <span>Nombre de usuario</span>
                  <span className="text-[10px] font-semibold text-[#4F6170] bg-[#D5ECEC]/70 px-2 py-0.5 rounded-full">Solo lectura</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#4F6170] pointer-events-none font-bold text-xs">
                    @
                  </span>
                  <input
                    type="text"
                    name="username"
                    value={form.username}
                    readOnly
                    disabled
                    className="w-full rounded-[14px] border border-[#D5ECEC] bg-[#F6F5F3] pl-10 pr-9 py-2.5 text-sm text-[#4F6170] cursor-not-allowed select-none"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#4F6170]/60 pointer-events-none" title="Campo bloqueado">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                  </span>
                </div>
              </div>

              {/* Correo electrónico (Solo lectura) */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#2B3F4C] flex items-center justify-between">
                  <span>Correo electrónico</span>
                  <span className="text-[10px] font-semibold text-[#4F6170] bg-[#D5ECEC]/70 px-2 py-0.5 rounded-full">Solo lectura</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#4F6170] pointer-events-none">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                    </svg>
                  </span>
                  <input
                    type="email"
                    name="email"
                    value={form.email}
                    readOnly
                    disabled
                    className="w-full rounded-[14px] border border-[#D5ECEC] bg-[#F6F5F3] pl-10 pr-9 py-2.5 text-sm text-[#4F6170] cursor-not-allowed select-none"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#4F6170]/60 pointer-events-none" title="Campo bloqueado">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Tarjeta 2: Apartado de Cambio de Contraseña */}
          <div className="bg-white rounded-[24px] p-6 border border-[#D5ECEC] shadow-none space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-[14px] bg-[#D5ECEC] text-[#2B3F4C] flex items-center justify-center font-bold shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-serif text-[#2B3F4C]">Seguridad y Contraseña</h2>
                <p className="text-xs text-[#4F6170]">Ingresa una nueva contraseña si deseas cambiar tu clave de acceso.</p>
              </div>
            </div>

            <div className="p-3.5 rounded-[14px] bg-[#F6F5F3] border border-[#D5ECEC]/80 text-[11px] text-[#4F6170]">
              💡 <strong>Nota:</strong> Solo completa estos campos si deseas modificar tu clave. Se te solicita confirmar la nueva contraseña dos veces para evitar equivocaciones.
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              {/* Nueva contraseña */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#2B3F4C]">
                  Nueva contraseña
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#4F6170] pointer-events-none">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="new_password"
                    value={form.new_password}
                    onChange={handleChange}
                    placeholder="Mínimo 9 caracteres"
                    autoComplete="new-password"
                    className={`w-full rounded-[14px] border pl-10 pr-10 py-2.5 text-sm text-[#2B3F4C] focus:outline-none focus:border-[#7FBFC1] focus:ring-2 focus:ring-[#7FBFC1]/20 transition ${
                      errors.new_password || (form.new_password.length > 0 && profilePasswordValidation.firstError)
                        ? 'border-red-400 bg-red-50/30'
                        : 'border-[#D5ECEC] bg-white hover:border-[#B4D6D6]'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4F6170] hover:text-[#2B3F4C] p-1 cursor-pointer"
                    title={showPassword ? 'Ocultar' : 'Mostrar'}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      {showPassword ? (
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178zM15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      )}
                    </svg>
                  </button>
                </div>
                {errors.new_password ? (
                  <p className="text-[11px] text-red-500 font-medium">{errors.new_password}</p>
                ) : form.new_password.length > 0 && profilePasswordValidation.firstError ? (
                  <p className="text-[11px] text-red-500 font-medium">{profilePasswordValidation.firstError}</p>
                ) : null}
              </div>

              {/* Confirmar nueva contraseña */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#2B3F4C]">
                  Repetir nueva contraseña
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#4F6170] pointer-events-none">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </span>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    name="confirm_password"
                    value={form.confirm_password}
                    onChange={handleChange}
                    placeholder="Repite la contraseña"
                    autoComplete="new-password"
                    className={`w-full rounded-[14px] border pl-10 pr-10 py-2.5 text-sm text-[#2B3F4C] focus:outline-none focus:border-[#7FBFC1] focus:ring-2 focus:ring-[#7FBFC1]/20 transition ${
                      errors.confirm_password || (form.confirm_password.length > 0 && profilePasswordValidation.confirmError)
                        ? 'border-red-400 bg-red-50/30'
                        : 'border-[#D5ECEC] bg-white hover:border-[#B4D6D6]'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4F6170] hover:text-[#2B3F4C] p-1 cursor-pointer"
                    title={showConfirmPassword ? 'Ocultar' : 'Mostrar'}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      {showConfirmPassword ? (
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178zM15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      )}
                    </svg>
                  </button>
                </div>
                {errors.confirm_password ? (
                  <p className="text-[11px] text-red-500 font-medium">{errors.confirm_password}</p>
                ) : form.confirm_password.length > 0 && profilePasswordValidation.confirmError ? (
                  <p className="text-[11px] text-red-500 font-medium">{profilePasswordValidation.confirmError}</p>
                ) : null}
              </div>
            </div>
          </div>

          {/* Tarjeta 3: Autenticación por doble factor (MFA) */}
          <div className="bg-white rounded-[24px] p-6 border border-[#D5ECEC] shadow-none space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-[14px] bg-[#D5ECEC] text-[#2B3F4C] flex items-center justify-center font-bold shrink-0">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-serif text-[#2B3F4C]">Autenticación por doble factor</h2>
                  <p className="text-xs text-[#4F6170]">Protección adicional para tu cuenta mediante códigos de verificación.</p>
                </div>
              </div>

              {/* Badge de estado */}
              <span className={`text-[11px] font-bold px-3 py-1 rounded-full ${
                form.is_mfa_enabled
                  ? 'bg-[#E1F3EA] text-[#1F7A4D]'
                  : 'bg-[#F6F5F3] text-[#4F6170]'
              }`}>
                {form.is_mfa_enabled ? 'Activado' : 'Desactivado'}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-[18px] bg-[#F6F5F3]/80 border border-[#D5ECEC]">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-[#2B3F4C]">
                  Verificación en dos pasos por correo electrónico
                </p>
                <p className="text-xs text-[#4F6170] max-w-lg leading-relaxed">
                  Al iniciar sesión, te solicitaremos un código temporal enviado a tu correo registrado (<strong>{form.email || 'tu correo'}</strong>) para verificar que eres tú.
                </p>
              </div>

              {/* Control tipo Switch exacto a la referencia */}
              <button
                type="button"
                role="switch"
                aria-checked={form.is_mfa_enabled}
                disabled={isTogglingMFA}
                onClick={handleToggleMFA}
                className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full p-1 transition-colors duration-200 ease-in-out focus:outline-none ${
                  form.is_mfa_enabled
                    ? 'bg-[#389B9B]'
                    : 'bg-[#C5DFDF] border border-[#A8CCCC]'
                }`}
                title={form.is_mfa_enabled ? 'Desactivar doble factor' : 'Activar doble factor'}
              >
                <span
                  className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out ${
                    form.is_mfa_enabled ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

        </div>

        {/* COLUMNA DERECHA: Vista Previa Naranja e Info Box Menta */}
        <div className="space-y-4">

          {/* Tarjeta VISTA PREVIA en Naranja #F7A35F */}
          <div className="bg-[#F7A35F] text-[#1F3340] rounded-[24px] p-6 shadow-none space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#1F3340]/80 tracking-widest uppercase">
                VISTA PREVIA
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-white text-[#1F7A4D]">
                <span className="w-2 h-2 rounded-full bg-[#1F7A4D]" />
                En edición
              </span>
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex items-start gap-3">
                <div className="w-14 h-14 rounded-full bg-white flex items-center justify-center shrink-0 border border-white/60 text-[#1F3340] overflow-hidden">
                  {normalizedPreview && !avatarLoadError ? (
                    <img
                      src={normalizedPreview}
                      alt="Avatar"
                      onError={() => setAvatarLoadError(true)}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-xl font-bold font-serif">{initial}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1 pt-1">
                  <h3 className="font-serif font-bold text-xl text-[#1F3340] leading-snug truncate">
                    {fullName}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-[#1F3340]/90 font-medium">
                      @{form.username || 'decisor'}
                    </span>
                    <span className="inline-block text-[10px] font-bold text-[#5B4A12] bg-[#F9E8A0] px-2 py-0.5 rounded-full">
                      {form.role || 'Decisor'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Correo */}
              <div className="pt-2 flex items-center gap-1.5 text-xs text-[#1F3340] font-medium">
                <svg className="w-4 h-4 text-[#1F3340] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
                <span className="truncate">{form.email || 'decisor@guiospro.local'}</span>
              </div>

              {/* Organización si existe */}
              {form.organization_name && (
                <div className="flex items-center gap-1.5 text-xs text-[#1F3340] font-medium">
                  <svg className="w-4 h-4 text-[#1F3340] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <span className="truncate">{form.organization_name}</span>
                </div>
              )}
            </div>
          </div>

          {/* Tarjeta Informativa en Menta #D5ECEC */}
          <div className="bg-[#D5ECEC] rounded-[24px] p-5 shadow-none flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-transparent border border-[#2B3F4C]/40 text-[#2B3F4C] flex items-center justify-center shrink-0 mt-0.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-xs text-[#1F3340] leading-relaxed font-medium">
              Los campos con <span className="text-[#B8531A] font-bold">*</span> son obligatorios. El usuario y correo electrónico son gestionados por políticas de seguridad del sistema.
            </p>
          </div>

        </div>

        {/* ── Botón de Guardar Cambios (Teal #7FBFC1 con texto #16303B) ── */}
        <div className="lg:col-span-3 flex justify-end pt-4">
          <button
            type="submit"
            disabled={isSaving}
            className="bg-[#7FBFC1] hover:bg-[#72b1b3] disabled:opacity-60 text-[#16303B] font-semibold py-3 px-8 rounded-[14px] transition-all shadow-none text-sm flex items-center gap-2 cursor-pointer"
          >
            {isSaving ? (
              <>
                <GuiosProSpinner size="xs" />
                Guardando cambios...
              </>
            ) : (
              <>
                <span>Guardar cambios</span>
                <span className="font-bold">✓</span>
              </>
            )}
          </button>
        </div>

      </form>
    </div>
  );
};
