import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { ToastItem, ToastType } from '@/components/notifications/ToastNotification';
import { ToastNotification } from '@/components/notifications/ToastNotification';

interface ToastOptions {
  title?: string;
  duration?: number;
}

interface ToastContextValue {
  showToast: (type: ToastType, message: string, options?: ToastOptions) => void;
  success: (message: string, options?: ToastOptions) => void;
  error: (message: string, options?: ToastOptions) => void;
  warning: (message: string, options?: ToastOptions) => void;
  info: (message: string, options?: ToastOptions) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

// Helper global para invocar notificaciones desde cualquier función de JS/TS (ej. fetch interceptors)
export const toast = {
  show: (type: ToastType, message: string, options?: ToastOptions) => {
    window.dispatchEvent(
      new CustomEvent('guiospro_toast', {
        detail: { type, message, ...options },
      })
    );
  },
  success: (message: string, options?: ToastOptions) => {
    toast.show('success', message, options);
  },
  error: (message: string, options?: ToastOptions) => {
    toast.show('error', message, options);
  },
  warning: (message: string, options?: ToastOptions) => {
    toast.show('warning', message, options);
  },
  info: (message: string, options?: ToastOptions) => {
    toast.show('info', message, options);
  },
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (type: ToastType, message: string, options?: ToastOptions) => {
      const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const newToast: ToastItem = {
        id,
        type,
        message,
        title: options?.title,
        duration: options?.duration,
      };

      setToasts((prev) => {
        // Limitar a máximo 4 notificaciones simultáneas para no saturar la pantalla
        const updated = [...prev, newToast];
        if (updated.length > 4) {
          return updated.slice(updated.length - 4);
        }
        return updated;
      });
    },
    []
  );

  const success = useCallback(
    (message: string, options?: ToastOptions) => showToast('success', message, options),
    [showToast]
  );
  const error = useCallback(
    (message: string, options?: ToastOptions) => showToast('error', message, options),
    [showToast]
  );
  const warning = useCallback(
    (message: string, options?: ToastOptions) => showToast('warning', message, options),
    [showToast]
  );
  const info = useCallback(
    (message: string, options?: ToastOptions) => showToast('info', message, options),
    [showToast]
  );

  // Escuchar eventos globales de toast
  useEffect(() => {
    const handleGlobalToast = (event: Event) => {
      const customEvent = event as CustomEvent<{
        type: ToastType;
        message: string;
        title?: string;
        duration?: number;
      }>;
      if (customEvent.detail && customEvent.detail.message) {
        const { type, message, title, duration } = customEvent.detail;
        showToast(type, message, { title, duration });
      }
    };

    window.addEventListener('guiospro_toast', handleGlobalToast);
    return () => {
      window.removeEventListener('guiospro_toast', handleGlobalToast);
    };
  }, [showToast]);

  return (
    <ToastContext.Provider
      value={{
        showToast,
        success,
        error,
        warning,
        info,
        dismissToast,
      }}
    >
      {children}

      {/* ── Contenedor Flotante de Notificaciones en la esquina superior derecha ── */}
      <div
        aria-live="polite"
        className="fixed top-6 right-6 z-[9999] flex flex-col gap-3.5 max-w-[calc(100vw-2rem)] pointer-events-none"
      >
        {toasts.map((item) => (
          <ToastNotification key={item.id} toast={item} onDismiss={dismissToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextValue => {
  const context = useContext(ToastContext);
  if (!context) {
    // Si se utiliza fuera del Provider, retornar fallback seguro que dispara a través de window
    return {
      showToast: (type, message, options) => toast.show(type, message, options),
      success: (message, options) => toast.success(message, options),
      error: (message, options) => toast.error(message, options),
      warning: (message, options) => toast.warning(message, options),
      info: (message, options) => toast.info(message, options),
      dismissToast: () => {},
    };
  }
  return context;
};
