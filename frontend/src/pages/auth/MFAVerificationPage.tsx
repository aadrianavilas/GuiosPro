import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AuthBanner } from '@/components/auth/AuthBanner';
import { useToast } from '@/context/ToastContext';
import { ROUTES } from '@/constants/routes';
import { GuiosProLogo } from '@/components/brand/GuiosProLogo';
import { GuiosProSpinner } from '@/components/brand/GuiosProSpinner';

interface MFAPendingState {
  email: string;
  codeLength: number;
  tempToken?: string | null;
}

export const MFAVerificationPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  // Recuperar información de la sesión pendiente de MFA
  const mfaData: MFAPendingState = useMemo(() => {
    const fromLocation = location.state as MFAPendingState | null;
    if (fromLocation && fromLocation.email) {
      return {
        email: fromLocation.email,
        codeLength: Number(fromLocation.codeLength) || 6,
        tempToken: fromLocation.tempToken || null,
      };
    }

    const stored = sessionStorage.getItem('guiospro_mfa_pending');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        return {
          email: parsed.email || 'tu correo registrado',
          codeLength: Number(parsed.codeLength) || 6,
          tempToken: parsed.tempToken || null,
        };
      } catch {
        // Ignorar error de parseo
      }
    }

    return {
      email: '',
      codeLength: 6,
      tempToken: null,
    };
  }, [location.state]);

  const codeLength = mfaData.codeLength > 0 ? mfaData.codeLength : 6;
  const [digits, setDigits] = useState<string[]>(() => Array(codeLength).fill(''));
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [resendCooldown, setResendCooldown] = useState<number>(60);
  const [hasError, setHasError] = useState<boolean>(false);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  // Redirigir al login si no hay información de MFA pendiente
  useEffect(() => {
    if (!mfaData.email && !sessionStorage.getItem('guiospro_mfa_pending')) {
      navigate(ROUTES.AUTH.LOGIN, { replace: true });
    }
  }, [mfaData.email, navigate]);

  // Si cambia la longitud del código, reajustar los dígitos
  useEffect(() => {
    setDigits(Array(codeLength).fill(''));
  }, [codeLength]);

  // Foco automático en el primer input al montar
  useEffect(() => {
    const timer = setTimeout(() => {
      inputsRef.current[0]?.focus();
    }, 150);
    return () => clearTimeout(timer);
  }, [codeLength]);

  // Temporizador para el reenvío de código
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  // Manejar el cambio de dígito en una casilla
  const handleDigitChange = (index: number, value: string) => {
    setHasError(false);

    // Solo permitir caracteres numéricos
    const numericChar = value.replace(/\D/g, '').slice(-1);

    const newDigits = [...digits];
    newDigits[index] = numericChar;
    setDigits(newDigits);

    // Si se ingresó un dígito, avanzar al siguiente cuadro
    if (numericChar && index < codeLength - 1) {
      inputsRef.current[index + 1]?.focus();
    }

    // Si se completaron todos los dígitos, disparar la verificación automáticamente
    if (numericChar && newDigits.every((d) => d !== '')) {
      handleVerify(newDigits.join(''));
    }
  };

  // Manejar teclas de retroceso y flechas
  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        inputsRef.current[index - 1]?.focus();
        const newDigits = [...digits];
        newDigits[index - 1] = '';
        setDigits(newDigits);
      } else {
        const newDigits = [...digits];
        newDigits[index] = '';
        setDigits(newDigits);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputsRef.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < codeLength - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  // Manejar pegado de código completo (ej. "123456")
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    setHasError(false);
    const pastedData = e.clipboardData.getData('text').trim();
    const numericData = pastedData.replace(/\D/g, '').slice(0, codeLength);

    if (!numericData) return;

    const newDigits = [...digits];
    for (let i = 0; i < codeLength; i++) {
      newDigits[i] = numericData[i] || '';
    }
    setDigits(newDigits);

    const nextIndex = Math.min(numericData.length, codeLength - 1);
    inputsRef.current[nextIndex]?.focus();

    if (numericData.length === codeLength) {
      handleVerify(numericData);
    }
  };

  // Enviar código de verificación al backend
  const handleVerify = async (codeToVerify?: string) => {
    const code = codeToVerify || digits.join('');
    if (code.length !== codeLength) {
      toast.warning(`Ingresa el código completo de ${codeLength} dígitos.`);
      return;
    }

    setIsLoading(true);
    setHasError(false);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (mfaData.tempToken) {
        headers['Authorization'] = `Bearer ${mfaData.tempToken}`;
        headers['X-Temp-Token'] = mfaData.tempToken;
      }

      const response = await fetch('/api/v1/auth/email-mfa/verify/', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ code }),
      });

      const data = await response.json();

      if (!response.ok) {
        setHasError(true);
        toast.error(data.detail || data.data || 'El código es inválido o ha expirado.');
        return;
      }

      // Guardar información de sesión del usuario verificado
      const user = data.user;
      const firstName = user?.first_name || 'Usuario';
      const userGroups: string[] = Array.isArray(user?.groups) ? user.groups : [];
      const isAdminUser = Boolean(
        user?.is_superuser ||
        user?.is_staff ||
        user?.role === 'Administrador' ||
        userGroups.includes('Administrador')
      );
      const role = isAdminUser ? 'Administrador' : (user?.role || userGroups[0] || 'Decisor');
      const hasOrganization = !isAdminUser && user?.organization !== null && user?.organization !== undefined;

      localStorage.setItem('guiospro_active_group', role);
      localStorage.setItem('guiospro_user', JSON.stringify({
        id: user?.id,
        firstName,
        username: user?.username,
        email: user?.email,
        role,
        groups: userGroups.length > 0 ? userGroups : [role],
        isAdmin: isAdminUser,
        hasOrganization,
        organization: isAdminUser ? null : user?.organization,
        avatar: user?.avatar,
      }));

      sessionStorage.removeItem('guiospro_mfa_pending');
      toast.success('¡Identidad confirmada exitosamente!');

      if (!isAdminUser && role === 'Decisor' && !hasOrganization) {
        navigate(ROUTES.AUTH.ORGANIZATION_SETUP);
      } else {
        navigate(ROUTES.DASHBOARD.HOME);
      }
    } catch {
      setHasError(true);
      toast.error('Error de conexión al verificar el código. Intente nuevamente.');
    } finally {
      setIsLoading(false);
    }
  };

  // Reenviar código al correo
  const handleResendCode = async () => {
    if (resendCooldown > 0 || isLoading) return;

    setIsLoading(true);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (mfaData.tempToken) {
        headers['Authorization'] = `Bearer ${mfaData.tempToken}`;
        headers['X-Temp-Token'] = mfaData.tempToken;
      }

      const response = await fetch('/api/v1/auth/email-mfa/send/', {
        method: 'POST',
        headers,
        credentials: 'include',
      });

      const data = await response.json();

      if (response.ok) {
        toast.info('Se ha enviado un nuevo código a tu correo.');
        setResendCooldown(60);
        setDigits(Array(codeLength).fill(''));
        setHasError(false);
        inputsRef.current[0]?.focus();
      } else {
        toast.error(data.detail || 'No se pudo reenviar el código en este momento.');
      }
    } catch {
      toast.error('Error de conexión al solicitar el reenvío de código.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToLogin = () => {
    sessionStorage.removeItem('guiospro_mfa_pending');
    navigate(ROUTES.AUTH.LOGIN);
  };

  return (
    <div className="min-h-screen w-full bg-white flex flex-col lg:flex-row font-sans selection:bg-[#F9E8A0] selection:text-[#5B4A12]">
      {/* Columna Izquierda: Formulario de Verificación MFA */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-6 sm:p-12 lg:p-16 xl:p-20">
        <div className="w-full max-w-md">
          
          {/* Header con Logo GuiosPro */}
          <div className="mb-8">
            <GuiosProLogo textSize="text-2xl" />
          </div>

          {/* Título y descripción */}
          <div className="mb-6 space-y-2">
            <div className="inline-flex items-center gap-1.5 bg-[#D5ECEC]/60 text-[#1F3340] text-xs font-semibold px-3 py-1 rounded-full">
              <svg className="w-3.5 h-3.5 text-[#389B9B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
              Autenticación por doble factor
            </div>

            <h1 className="text-3xl sm:text-4xl font-serif text-[#2B3F4C] tracking-tight">
              Código de verificación
            </h1>

            <p className="text-sm text-[#4F6170] leading-relaxed">
              Hemos enviado un código temporal de seguridad a tu correo electrónico:
            </p>

            {/* Pastilla con correo ofuscado */}
            <div className="inline-flex items-center gap-2 bg-[#F6F5F3] border border-[#D5ECEC] px-3.5 py-1.5 rounded-[12px] text-xs font-semibold text-[#243642]">
              <svg className="w-4 h-4 text-[#7FBFC1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
              <span>{mfaData.email || 'tu correo'}</span>
            </div>
          </div>

          {/* Formulario de entrada de dígitos dinámicos (Imagen 3) */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleVerify();
            }}
            className="space-y-6"
          >
            {/* Contenedor de cuadritos dinámicos */}
            <div className="flex items-center justify-between gap-2 sm:gap-3 my-6">
              {digits.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => { inputsRef.current[index] = el; }}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleDigitChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={handlePaste}
                  autoComplete="one-time-code"
                  disabled={isLoading}
                  className={`w-12 h-14 sm:w-14 sm:h-16 text-center font-mono text-2xl sm:text-3xl font-bold rounded-[14px] border-2 transition-all outline-none ${
                    hasError
                      ? 'border-[#FCA5A5] bg-[#FEF2F2] text-[#B84318]'
                      : digit
                      ? 'border-[#7FBFC1] bg-white text-[#243642] shadow-sm'
                      : 'border-[#D5ECEC] bg-[#F6F5F3]/80 text-[#243642] hover:border-[#B4D6D6] focus:border-[#7FBFC1] focus:bg-white focus:ring-2 focus:ring-[#7FBFC1]/20'
                  }`}
                />
              ))}
            </div>

            {/* Botón de envío */}
            <button
              type="submit"
              disabled={isLoading || digits.some((d) => d === '')}
              className="w-full bg-[#7FBFC1] hover:bg-[#72b1b3] disabled:opacity-50 text-[#16303B] font-semibold py-3 px-6 rounded-[14px] transition text-sm flex items-center justify-center gap-2 cursor-pointer shadow-none"
            >
              {isLoading ? (
                <>
                  <GuiosProSpinner size="xs" />
                  <span>Verificando código...</span>
                </>
              ) : (
                <>
                  <span>Ingresar a GuiosPro</span>
                  <span className="font-bold">→</span>
                </>
              )}
            </button>

            {/* Reenvío de código */}
            <div className="text-center pt-2 space-y-3">
              <p className="text-xs text-[#4F6170]">
                ¿No recibiste el correo?{' '}
                {resendCooldown > 0 ? (
                  <span className="text-[#A0AEC0] font-medium">
                    Reenviar código ({resendCooldown}s)
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendCode}
                    disabled={isLoading}
                    className="text-[#389B9B] hover:text-[#286F6F] font-semibold underline cursor-pointer inline-block"
                  >
                    Reenviar código
                  </button>
                )}
              </p>

              <div>
                <button
                  type="button"
                  onClick={handleBackToLogin}
                  className="text-xs text-[#4F6170] hover:text-[#243642] transition cursor-pointer"
                >
                  ← Volver al inicio de sesión
                </button>
              </div>
            </div>

          </form>

        </div>
      </div>

      {/* Columna Derecha: Banner Ilustrativo GuiosPro */}
      <div className="w-full lg:w-1/2 p-6 sm:p-8 lg:p-12 flex items-center justify-center">
        <AuthBanner caption="Autenticación de dos factores: seguridad garantizada para la toma de decisiones en GuiosPro." />
      </div>
    </div>
  );
};
