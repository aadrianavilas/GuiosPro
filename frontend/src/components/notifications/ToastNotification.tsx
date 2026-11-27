import React, { useEffect, useState } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

interface ToastNotificationProps {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}

export const ToastNotification: React.FC<ToastNotificationProps> = ({ toast, onDismiss }) => {
  const [isExiting, setIsExiting] = useState(false);

  // Determinar duración según tipo según especificación del mockup:
  // - Éxito: 4 segundos
  // - Error: manual ("Se queda hasta cerrarla", 0 ms)
  // - Advertencia: 7 segundos
  // - Información: 5 segundos
  const effectiveDuration =
    typeof toast.duration === 'number'
      ? toast.duration
      : toast.type === 'success'
      ? 4000
      : toast.type === 'warning'
      ? 7000
      : toast.type === 'info'
      ? 5000
      : 0; // Error no se autocierra por defecto

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      onDismiss(toast.id);
    }, 250);
  };

  useEffect(() => {
    if (effectiveDuration > 0) {
      const timer = setTimeout(() => {
        handleClose();
      }, effectiveDuration);
      return () => clearTimeout(timer);
    }
  }, [effectiveDuration]);

  // Configuración de estilos visuales exactos según el mockup aprobado
  const config = {
    success: {
      defaultTitle: 'Éxito',
      bgClass: 'bg-[#DEF5E5]',
      borderClass: 'border-[#B8E2CB]',
      titleColor: 'text-[#164E3D]',
      textColor: 'text-[#285343]',
      iconBorder: 'border-[#B8E2CB]',
      iconColor: 'text-[#1E7F5E]',
      closeHover: 'hover:bg-[#1E7F5E]/10 text-[#164E3D]',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      ),
    },
    error: {
      defaultTitle: 'Error',
      bgClass: 'bg-[#FCE7E1]',
      borderClass: 'border-[#F7C7B8]',
      titleColor: 'text-[#8A2E14]',
      textColor: 'text-[#522114]',
      iconBorder: 'border-[#F7C7B8]',
      iconColor: 'text-[#B84318]',
      closeHover: 'hover:bg-[#B84318]/10 text-[#8A2E14]',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      ),
    },
    warning: {
      defaultTitle: 'Advertencia',
      bgClass: 'bg-[#FEF3C7]',
      borderClass: 'border-[#FDE68A]',
      titleColor: 'text-[#854D0E]',
      textColor: 'text-[#543806]',
      iconBorder: 'border-[#FDE68A]',
      iconColor: 'text-[#B45309]',
      closeHover: 'hover:bg-[#B45309]/10 text-[#854D0E]',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.3}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
          />
        </svg>
      ),
    },
    info: {
      defaultTitle: 'Información',
      bgClass: 'bg-[#DDF0F2]',
      borderClass: 'border-[#B9E2E5]',
      titleColor: 'text-[#0E4B56]',
      textColor: 'text-[#173F47]',
      iconBorder: 'border-[#B9E2E5]',
      iconColor: 'text-[#0E7490]',
      closeHover: 'hover:bg-[#0E7490]/10 text-[#0E4B56]',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.3}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
          />
        </svg>
      ),
    },
  }[toast.type];

  return (
    <div
      role="alert"
      className={`w-[340px] sm:w-[360px] max-w-[calc(100vw-2rem)] rounded-[20px] p-4 sm:p-5 border shadow-lg relative flex flex-col justify-center pointer-events-auto transition-all duration-300 ease-out ${
        config.bgClass
      } ${config.borderClass} ${
        isExiting
          ? 'opacity-0 translate-x-8 scale-95'
          : 'opacity-100 translate-x-0 scale-100 animate-in fade-in slide-in-from-right-8'
      }`}
    >
      {/* Botón de cierre en la esquina superior derecha (Equis) */}
      <button
        type="button"
        onClick={handleClose}
        aria-label="Cerrar notificación"
        className={`absolute top-3.5 right-3.5 w-7 h-7 rounded-full flex items-center justify-center transition cursor-pointer ${config.closeHover}`}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Cabecera con Ícono circular blanco y Título en la misma línea a su altura */}
      <div className="flex items-center gap-2.5 pr-7">
        <div
          className={`w-8 h-8 rounded-full bg-white border ${config.iconBorder} ${config.iconColor} flex items-center justify-center shadow-xs shrink-0`}
        >
          {config.icon}
        </div>
        <h3 className={`text-lg sm:text-xl font-serif font-bold tracking-tight leading-none ${config.titleColor}`}>
          {toast.title || config.defaultTitle}
        </h3>
      </div>

      {/* Mensaje descriptivo breve y conciso */}
      <p className={`text-xs sm:text-[13px] leading-relaxed mt-2.5 ${config.textColor}`}>
        {toast.message}
      </p>
    </div>
  );
};
