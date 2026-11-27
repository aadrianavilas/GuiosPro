import React, { useState, useEffect } from 'react';
import { GuiosProSpinner } from '@/components/brand/GuiosProSpinner';
import type { OrganizationPayload, OrganizationType } from '@/types';

interface OrganizationFormProps {
  initialData?: OrganizationPayload;
  onSubmit: (data: OrganizationPayload) => Promise<void>;
  isLoading?: boolean;
  errorMessage?: string | null;
  submitButtonText?: string;
}

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

export const OrganizationForm: React.FC<OrganizationFormProps> = ({
  initialData,
  onSubmit,
  isLoading = false,
  errorMessage,
  submitButtonText = 'Guardar organización',
}) => {
  const [form, setForm] = useState<OrganizationPayload>(initialData || defaultForm);
  const [errors, setErrors] = useState<Partial<Record<keyof OrganizationPayload, string>>>({});

  // Sincronizar si initialData cambia (por ejemplo al cargar del backend)
  useEffect(() => {
    if (initialData) {
      setForm({
        business_name: initialData.business_name || '',
        commercial_name: initialData.commercial_name || '',
        organization_type: initialData.organization_type || ('' as OrganizationType),
        sector: initialData.sector || '',
        address: initialData.address || '',
        city: initialData.city || '',
        country: initialData.country || '',
      });
    }
  }, [initialData]);

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
    if (!form.business_name.trim())    newErrors.business_name = 'La razón social es obligatoria.';
    if (!form.organization_type)       newErrors.organization_type = 'Selecciona el tipo de organización.';
    if (!form.city.trim())             newErrors.city = 'La ciudad es obligatoria.';
    if (!form.country.trim())          newErrors.country = 'El país es obligatorio.';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const payload: OrganizationPayload = {
      business_name: form.business_name.trim(),
      organization_type: form.organization_type,
      city: form.city.trim(),
      country: form.country.trim(),
    };
    if (form.commercial_name?.trim()) payload.commercial_name = form.commercial_name.trim();
    if (form.sector?.trim())          payload.sector = form.sector.trim();
    if (form.address?.trim())         payload.address = form.address.trim();

    await onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5 w-full">
      {errorMessage && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      {/* Razón social */}
      <Field
        label="Razón social"
        name="business_name"
        value={form.business_name}
        onChange={handleChange}
        error={errors.business_name}
        required
        placeholder="Ej. Empresa Pública de Tecnología S.A."
      />

      {/* Nombre comercial (opcional) */}
      <Field
        label="Nombre comercial"
        name="commercial_name"
        value={form.commercial_name ?? ''}
        onChange={handleChange}
        placeholder="Ej. TecnoEmpresa"
      />

      {/* Tipo de organización */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-[#2B3F4C]">
          Tipo de organización <span className="text-[#B8531A]">*</span>
        </label>
        <select
          name="organization_type"
          value={form.organization_type}
          onChange={handleChange}
          className={`w-full rounded-[14px] border px-4 py-3 text-sm bg-white text-[#2B3F4C]
            focus:outline-none focus:border-[#7FBFC1] focus:ring-2 focus:ring-[#7FBFC1]/20 transition
            ${errors.organization_type ? 'border-red-400' : 'border-[#D5ECEC]'}`}
        >
          <option value="">Selecciona una opción...</option>
          {ORGANIZATION_TYPES.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        {errors.organization_type && (
          <p className="text-xs text-red-500">{errors.organization_type}</p>
        )}
      </div>

      {/* Sector (opcional) */}
      <Field
        label="Sector"
        name="sector"
        value={form.sector ?? ''}
        onChange={handleChange}
        placeholder="Ej. Tecnología, Salud, Educación..."
      />

      {/* Ciudad y País */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field
          label="Ciudad"
          name="city"
          value={form.city}
          onChange={handleChange}
          error={errors.city}
          required
          placeholder="Ej. Guayaquil"
        />
        <Field
          label="País"
          name="country"
          value={form.country}
          onChange={handleChange}
          error={errors.country}
          required
          placeholder="Ej. Ecuador"
        />
      </div>

      {/* Dirección (opcional) */}
      <Field
        label="Dirección"
        name="address"
        value={form.address ?? ''}
        onChange={handleChange}
        placeholder="Ej. Av. 9 de Octubre 100 y Malecón"
      />

      {/* Botón */}
      <button
        type="submit"
        disabled={isLoading}
        className="w-full bg-[#7FBFC1] hover:bg-[#72b1b3] disabled:opacity-60
          text-[#16303B] font-semibold py-3.5 px-6 rounded-[14px] transition-all duration-200
          flex items-center justify-center gap-2 mt-2 shadow-none cursor-pointer"
      >
        {isLoading ? (
          <>
            <GuiosProSpinner size="xs" />
            Guardando...
          </>
        ) : (
          submitButtonText
        )}
      </button>
    </form>
  );
};

interface FieldProps {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  required?: boolean;
  placeholder?: string;
}

const Field: React.FC<FieldProps> = ({
  label, name, value, onChange, error, required, placeholder,
}) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-xs font-semibold text-[#2B3F4C]">
      {label} {required && <span className="text-[#B8531A]">*</span>}
      {!required && <span className="text-[#4F6170] font-normal text-xs"> (opcional)</span>}
    </label>
    <input
      type="text"
      name={name}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={`w-full rounded-[14px] border px-4 py-3 text-sm text-[#2B3F4C]
        placeholder:text-[#4F6170]/60 focus:outline-none focus:border-[#7FBFC1] focus:ring-2 focus:ring-[#7FBFC1]/20
        transition ${error ? 'border-red-400 bg-red-50/20' : 'border-[#D5ECEC] bg-white'}`}
    />
    {error && <p className="text-xs text-red-500">{error}</p>}
  </div>
);
