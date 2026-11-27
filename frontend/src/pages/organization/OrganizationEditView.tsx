import React, { useEffect, useState } from 'react';
import { useToast } from '@/context/ToastContext';
import { GuiosProSpinner } from '@/components/brand/GuiosProSpinner';
import type { OrganizationPayload, OrganizationData, OrganizationType } from '@/types';

const ORGANIZATION_TYPES: { value: OrganizationType; label: string }[] = [
  { value: 'public',      label: 'Pública' },
  { value: 'private',     label: 'Privada' },
  { value: 'educational', label: 'Educativa' },
  { value: 'ngo',         label: 'ONG' },
  { value: 'other',       label: 'Otra' },
];

const defaultForm: OrganizationPayload = {
  business_name: '',
  commercial_name: '',
  organization_type: '' as OrganizationType,
  sector: '',
  address: '',
  city: '',
  country: '',
};

export const OrganizationEditView: React.FC = () => {
  const toast = useToast();
  const [form, setForm] = useState<OrganizationPayload>(defaultForm);
  const [errors, setErrors] = useState<Partial<Record<keyof OrganizationPayload, string>>>({});
  const [isLoadingFetch, setIsLoadingFetch] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  useEffect(() => {
    const fetchOrg = async () => {
      try {
        const response = await fetch('/api/v1/organization/me/', {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          if (data.has_organization && data.organization) {
            const org: OrganizationData = data.organization;
            setForm({
              business_name: org.business_name || '',
              commercial_name: org.commercial_name || '',
              organization_type: org.organization_type,
              sector: org.sector || '',
              address: org.address || '',
              city: org.city || '',
              country: org.country || '',
            });
          }
        }
      } catch (err) {
        console.error('Error al cargar organización:', err);
        toast.error('No se pudo cargar la información de la organización.');
      } finally {
        setIsLoadingFetch(false);
      }
    };

    fetchOrg();
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof OrganizationPayload]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validate = (): boolean => {
    const newErrors: typeof errors = {};
    if (!form.business_name.trim()) newErrors.business_name = 'La razón social es obligatoria.';
    if (!form.organization_type) newErrors.organization_type = 'Selecciona el tipo de organización.';
    if (!form.city.trim()) newErrors.city = 'La ciudad es obligatoria.';
    if (!form.country.trim()) newErrors.country = 'El país es obligatorio.';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setIsSaving(true);
    try {
      const payload: OrganizationPayload = {
        business_name: form.business_name.trim(),
        organization_type: form.organization_type,
        city: form.city.trim(),
        country: form.country.trim(),
      };
      if (form.commercial_name?.trim()) payload.commercial_name = form.commercial_name.trim();
      if (form.sector?.trim()) payload.sector = form.sector.trim();
      if (form.address?.trim()) payload.address = form.address.trim();

      const response = await fetch('/api/v1/organization/me/', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        const firstError =
          result.detail ||
          result.business_name?.[0] ||
          result.non_field_errors?.[0] ||
          'Error al guardar la organización.';
        toast.error(firstError);
        return;
      }

      if (result.organization) {
        const org: OrganizationData = result.organization;
        setForm({
          business_name: org.business_name || '',
          commercial_name: org.commercial_name || '',
          organization_type: org.organization_type,
          sector: org.sector || '',
          address: org.address || '',
          city: org.city || '',
          country: org.country || '',
        });
      }

      toast.success('¡Datos de la organización guardados correctamente!');
    } catch {
      toast.error('No se pudieron guardar los cambios. Por favor, intente nuevamente.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoadingFetch) {
    return (
      <div className="h-64 flex items-center justify-center">
        <GuiosProSpinner size="xl" label="Cargando información de la organización..." />
      </div>
    );
  }

  const displayName = form.business_name.trim() || 'Comercial Andina Cía. Ltda.';
  const displayLocation =
    form.city.trim() && form.country.trim()
      ? `${form.city.trim()}, ${form.country.trim()}`
      : form.city.trim() || form.country.trim() || 'Guayaquil, Ecuador';

  return (
    <div className="w-full space-y-6 pb-12 font-sans">
      {/* ── Banner Superior Hero con Paleta GuiosPro (Naranja #F7A35F) ── */}
      <div className="relative w-full rounded-[28px] bg-[#F7A35F] p-6 sm:p-8 text-[#1F3340] overflow-hidden shadow-none flex items-center justify-between">
        {/* Círculos decorativos en Naranja claro #FBB982 */}
        <div className="absolute right-28 -bottom-16 w-60 h-60 rounded-full bg-[#FBB982]/60 pointer-events-none" />
        <div className="absolute -top-12 -right-10 w-44 h-44 rounded-full bg-[#FBB982]/60 pointer-events-none" />

        <div className="relative z-10 max-w-xl space-y-2">
          <span className="inline-block bg-[#FDE2C8] text-[#7A3E0A] text-[10px] sm:text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
            PERFIL DE LA ORGANIZACIÓN
          </span>
          <h1 className="text-3xl sm:text-4xl font-serif text-[#1F3340] leading-tight">
            Datos de la organización
          </h1>
          <p className="text-xs sm:text-sm text-[#1F3340]/90 font-medium leading-relaxed max-w-lg">
            Información empresarial vinculada a tus evaluaciones de adopción de software libre.
          </p>
        </div>

        {/* Ilustración de edificio con badge de verificación idéntico al diseño */}
        <div className="relative z-10 hidden md:flex items-center justify-center shrink-0 pr-2">
          <div className="w-28 h-22 rounded-[18px] bg-white p-3.5 relative flex flex-col items-center justify-between shadow-none border border-white/60">
            {/* Badge circular oscuro con checkmark blanco */}
            <div className="absolute -top-2.5 -right-2.5 w-7 h-7 rounded-full bg-[#2B3F4C] text-white flex items-center justify-center font-bold text-xs shadow-none">
              ✓
            </div>
            {/* Ventanas 2 filas de 3 */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              <div className="w-3.5 h-3.5 rounded-[3px] bg-[#7FBFC1]" />
              <div className="w-3.5 h-3.5 rounded-[3px] bg-[#7FBFC1]" />
              <div className="w-3.5 h-3.5 rounded-[3px] bg-[#7FBFC1]" />
              <div className="w-3.5 h-3.5 rounded-[3px] bg-[#7FBFC1]" />
              <div className="w-3.5 h-3.5 rounded-[3px] bg-[#F9E8A0]" />
              <div className="w-3.5 h-3.5 rounded-[3px] bg-[#7FBFC1]" />
            </div>
            {/* Puerta central oscura */}
            <div className="w-4 h-4.5 rounded-t-sm bg-[#2B3F4C]" />
          </div>
        </div>
      </div>

      {/* ── Grid Principal: 2 Columnas ── */}
      <form onSubmit={handleSubmit} noValidate className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* COLUMNA IZQUIERDA: 3 Tarjetas de Formulario */}
        <div className="lg:col-span-2 space-y-5">

          {/* Tarjeta 1: Información General */}
          <div className="bg-white rounded-[24px] p-6 border border-[#D5ECEC] shadow-none space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-[14px] bg-[#F9E8A0] text-[#5B4A12] flex items-center justify-center font-bold shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-serif text-[#2B3F4C]">Información general</h2>
                <p className="text-xs text-[#4F6170]">Cómo se identifica tu organización.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              {/* Razón social */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#2B3F4C] flex items-center justify-between">
                  <span>Razón social <span className="text-[#B8531A] font-bold">*</span></span>
                  <span className="text-[10px] font-bold text-[#7A3E0A] bg-[#FDE2C8] px-2 py-0.5 rounded-full">Obligatorio</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#4F6170] pointer-events-none">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    name="business_name"
                    value={form.business_name}
                    onChange={handleChange}
                    placeholder="Comercial Andina Cía. Ltda."
                    className={`w-full rounded-[14px] border pl-10 pr-3.5 py-2.5 text-sm text-[#2B3F4C] focus:outline-none focus:border-[#7FBFC1] focus:ring-2 focus:ring-[#7FBFC1]/20 transition ${
                      errors.business_name ? 'border-red-400 bg-red-50/30' : 'border-[#D5ECEC] bg-white hover:border-[#B4D6D6]'
                    }`}
                  />
                </div>
                {errors.business_name && <p className="text-[11px] text-red-500">{errors.business_name}</p>}
              </div>

              {/* Nombre comercial */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#2B3F4C]">
                  Nombre comercial <span className="text-[#4F6170] font-normal text-xs">(opcional)</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#4F6170] pointer-events-none">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    name="commercial_name"
                    value={form.commercial_name ?? ''}
                    onChange={handleChange}
                    placeholder="Ej. TecnoEmpresa"
                    className="w-full rounded-[14px] border border-[#D5ECEC] bg-white pl-10 pr-3.5 py-2.5 text-sm text-[#2B3F4C] focus:outline-none focus:border-[#7FBFC1] focus:ring-2 focus:ring-[#7FBFC1]/20 hover:border-[#B4D6D6] transition"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Tarjeta 2: Clasificación */}
          <div className="bg-white rounded-[24px] p-6 border border-[#D5ECEC] shadow-none space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-[14px] bg-[#F9E8A0] text-[#5B4A12] flex items-center justify-center font-bold shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-serif text-[#2B3F4C]">Clasificación</h2>
                <p className="text-xs text-[#4F6170]">Tipo de organización y sector de actividad.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              {/* Tipo de organización */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#2B3F4C] flex items-center justify-between">
                  <span>Tipo de organización <span className="text-[#B8531A] font-bold">*</span></span>
                  <span className="text-[10px] font-bold text-[#7A3E0A] bg-[#FDE2C8] px-2 py-0.5 rounded-full">Obligatorio</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#4F6170] pointer-events-none">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  </span>
                  <select
                    name="organization_type"
                    value={form.organization_type}
                    onChange={handleChange}
                    className={`w-full rounded-[14px] border pl-10 pr-3.5 py-2.5 text-sm bg-white text-[#2B3F4C] focus:outline-none focus:border-[#7FBFC1] focus:ring-2 focus:ring-[#7FBFC1]/20 transition ${
                      errors.organization_type ? 'border-red-400 bg-red-50/30' : 'border-[#D5ECEC] hover:border-[#B4D6D6]'
                    }`}
                  >
                    <option value="">Selecciona una opción</option>
                    {ORGANIZATION_TYPES.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                {errors.organization_type && <p className="text-[11px] text-red-500">{errors.organization_type}</p>}
              </div>

              {/* Sector */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#2B3F4C]">
                  Sector <span className="text-[#4F6170] font-normal text-xs">(opcional)</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#4F6170] pointer-events-none">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    name="sector"
                    value={form.sector ?? ''}
                    onChange={handleChange}
                    placeholder="Ej. Tecnología, Salud, Finanzas"
                    className="w-full rounded-[14px] border border-[#D5ECEC] bg-white pl-10 pr-3.5 py-2.5 text-sm text-[#2B3F4C] focus:outline-none focus:border-[#7FBFC1] focus:ring-2 focus:ring-[#7FBFC1]/20 hover:border-[#B4D6D6] transition"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Tarjeta 3: Ubicación */}
          <div className="bg-white rounded-[24px] p-6 border border-[#D5ECEC] shadow-none space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-[14px] bg-[#F9E8A0] text-[#5B4A12] flex items-center justify-center font-bold shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-serif text-[#2B3F4C]">Ubicación</h2>
                <p className="text-xs text-[#4F6170]">Dónde opera tu organización.</p>
              </div>
            </div>

            <div className="space-y-4 pt-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Ciudad */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-[#2B3F4C] flex items-center justify-between">
                    <span>Ciudad <span className="text-[#B8531A] font-bold">*</span></span>
                    <span className="text-[10px] font-bold text-[#7A3E0A] bg-[#FDE2C8] px-2 py-0.5 rounded-full">Obligatorio</span>
                  </label>
                  <input
                    type="text"
                    name="city"
                    value={form.city}
                    onChange={handleChange}
                    placeholder="Guayaquil"
                    className={`w-full rounded-[14px] border px-3.5 py-2.5 text-sm text-[#2B3F4C] focus:outline-none focus:border-[#7FBFC1] focus:ring-2 focus:ring-[#7FBFC1]/20 transition ${
                      errors.city ? 'border-red-400 bg-red-50/30' : 'border-[#D5ECEC] bg-white hover:border-[#B4D6D6]'
                    }`}
                  />
                  {errors.city && <p className="text-[11px] text-red-500">{errors.city}</p>}
                </div>

                {/* País */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-[#2B3F4C] flex items-center justify-between">
                    <span>País <span className="text-[#B8531A] font-bold">*</span></span>
                    <span className="text-[10px] font-bold text-[#7A3E0A] bg-[#FDE2C8] px-2 py-0.5 rounded-full">Obligatorio</span>
                  </label>
                  <input
                    type="text"
                    name="country"
                    value={form.country}
                    onChange={handleChange}
                    placeholder="Ecuador"
                    className={`w-full rounded-[14px] border px-3.5 py-2.5 text-sm text-[#2B3F4C] focus:outline-none focus:border-[#7FBFC1] focus:ring-2 focus:ring-[#7FBFC1]/20 transition ${
                      errors.country ? 'border-red-400 bg-red-50/30' : 'border-[#D5ECEC] bg-white hover:border-[#B4D6D6]'
                    }`}
                  />
                  {errors.country && <p className="text-[11px] text-red-500">{errors.country}</p>}
                </div>
              </div>

              {/* Dirección */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#2B3F4C]">
                  Dirección <span className="text-[#4F6170] font-normal text-xs">(opcional)</span>
                </label>
                <input
                  type="text"
                  name="address"
                  value={form.address ?? ''}
                  onChange={handleChange}
                  placeholder="Ej. Av. 9 de Octubre"
                  className="w-full rounded-[14px] border border-[#D5ECEC] bg-white px-3.5 py-2.5 text-sm text-[#2B3F4C] focus:outline-none focus:border-[#7FBFC1] focus:ring-2 focus:ring-[#7FBFC1]/20 hover:border-[#B4D6D6] transition"
                />
              </div>
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
                <div className="w-12 h-12 rounded-[14px] bg-white flex items-center justify-center shrink-0 border border-white/60 text-[#1F3340]">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-serif font-bold text-xl text-[#1F3340] leading-snug">
                    {displayName}
                  </h3>
                </div>
              </div>

              {/* Ubicación */}
              <div className="pt-2 flex items-center gap-1.5 text-xs text-[#1F3340] font-medium">
                <svg className="w-4 h-4 text-[#1F3340] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="truncate">{displayLocation}</span>
              </div>
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
              Los campos con <span className="text-[#B8531A] font-bold">*</span> son obligatorios. Estos datos acompañan todas tus evaluaciones.
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
