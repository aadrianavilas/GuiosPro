import { useEffect, useRef } from 'react';
import { logoutUser } from './authClient';

const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutos de inactividad

/**
 * Hook para monitorear inactividad del usuario durante 10 minutos.
 * Si el usuario deja de interactuar (mouse, teclado, scroll, touch),
 * cierra la sesión automáticamente, blacklisteando el refresh token y limpiando cookies.
 */
export function useInactivityTimer(isEnabled: boolean = true) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isEnabled) return;

    const resetTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        // Ejecutar cierre de sesión por inactividad
        logoutUser('inactivity');
      }, INACTIVITY_TIMEOUT_MS);
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];

    // Iniciar temporizador
    resetTimer();

    // Throttling ligero para no disparar en cada píxel de mousemove
    let lastActivity = Date.now();
    const handleActivity = () => {
      const now = Date.now();
      if (now - lastActivity > 1000) {
        lastActivity = now;
        resetTimer();
      }
    };

    events.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [isEnabled]);
}
