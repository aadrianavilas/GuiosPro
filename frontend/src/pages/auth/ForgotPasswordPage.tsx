import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthBanner } from '@/components/auth/AuthBanner';
import { useToast } from '@/context/ToastContext';
import { ROUTES } from '@/constants/routes';
import { validatePassword } from '@/utils/passwordValidation';
import { GuiosProLogo } from '@/components/brand/GuiosProLogo';
import { GuiosProSpinner } from '@/components/brand/GuiosProSpinner';

export const ForgotPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();

  // Pasos: 1 = Ingreso de Correo, 2 = Ingreso de Código en Cuadritos, 3 = Nueva Contraseña
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Datos del flujo
  const [email, setEmail] = useState<string>('');
  const [codeLength, setCodeLength] = useState<number>(6);
  const [digits, setDigits] = useState<string[]>(() => Array(6).fill(''));
  const [resetToken, setResetToken] = useState<string>('');

  // Paso 3: Contraseñas
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);

  // Estados de control
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [resendCooldown, setResendCooldown] = useState<number>(0);
  const [hasCodeError, setHasCodeError] = useState<boolean>(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  // Temporizador de reenvío
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Foco inicial en inputs de código cuando se entra al paso 2
  useEffect(() => {
    if (step === 2) {
      const timer = setTimeout(() => {
        inputsRef.current[0]?.focus();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [step]);

  // Validación en tiempo real de contraseña para el Paso 3
  const passwordValidation = useMemo(() => {
    return validatePassword(password, confirmPassword, { email });
  }, [password, confirmPassword, email]);

  // ── PASO 1: Solicitar código al correo ──
  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setEmailError('Ingresa tu correo electrónico.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setEmailError('Ingresa un correo electrónico válido.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/v1/auth/password-reset/request/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      });

      const data = await response.json();
      const lengthFromBackend = Number(data.code_length) || 6;
      setCodeLength(lengthFromBackend);
      setDigits(Array(lengthFromBackend).fill(''));

      // Regla de seguridad: Respuesta genérica sin indicar si el usuario existe o no
      toast.info('Si el correo está registrado, recibirás un código de verificación.');
      setResendCooldown(60);
      setStep(2);
    } catch {
      toast.error('Error de conexión. Intente nuevamente en unos instantes.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── PASO 2: Manejo de los cuadritos de código (Idéntico a MFA) ──
  const handleDigitChange = (index: number, val: string) => {
    setHasCodeError(false);
    const numericChar = val.replace(/\D/g, '').slice(-1);

    const newDigits = [...digits];
    newDigits[index] = numericChar;
    setDigits(newDigits);

    if (numericChar && index < codeLength - 1) {
      inputsRef.current[index + 1]?.focus();
    }

    if (numericChar && newDigits.every((d) => d !== '')) {
      handleVerifyCode(newDigits.join(''));
    }
  };

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

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    setHasCodeError(false);
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
      handleVerifyCode(numericData);
    }
  };

  const handleVerifyCode = async (codeToVerify?: string) => {
    const code = codeToVerify || digits.join('');
    if (code.length !== codeLength) {
      toast.warning(`Ingresa el código completo de ${codeLength} dígitos.`);
      return;
    }

    setIsLoading(true);
    setHasCodeError(false);

    try {
      const response = await fetch('/api/v1/auth/password-reset/verify/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), code }),
      });

      const data = await response.json();

      if (!response.ok) {
        setHasCodeError(true);
        toast.error(data.detail || 'El código es incorrecto o ha expirado.');
        return;
      }

      setResetToken(data.reset_token);
      toast.success('¡Código verificado con éxito!');
      setStep(3);
    } catch {
      setHasCodeError(true);
      toast.error('Error de conexión al verificar el código.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0 || isLoading) return;
    setIsLoading(true);
    try {
      const response = await fetch('/api/v1/auth/password-reset/request/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      if (response.ok) {
        toast.info('Se ha enviado un nuevo código a tu correo.');
        setResendCooldown(60);
        setDigits(Array(codeLength).fill(''));
        setHasCodeError(false);
        inputsRef.current[0]?.focus();
      } else {
        toast.error('No se pudo reenviar el código en este momento.');
      }
    } catch {
      toast.error('Error de red al reenviar el código.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── PASO 3: Guardar nueva contraseña ──
  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!passwordValidation.allValid) {
      toast.warning('Cumple con todos los requisitos de seguridad antes de continuar.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/v1/auth/password-reset/confirm/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reset_token: resetToken,
          password,
          confirm_password: confirmPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg =
          data.password?.[0] ||
          data.confirm_password?.[0] ||
          data.detail ||
          'Error al restablecer la contraseña.';
        toast.error(errorMsg);
        return;
      }

      toast.success('¡Contraseña restablecida exitosamente! Ya puedes iniciar sesión.');
      navigate(ROUTES.AUTH.LOGIN);
    } catch {
      toast.error('Error de conexión al actualizar la contraseña.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen lg:h-screen w-full bg-white flex flex-col lg:flex-row font-sans selection:bg-[#F9E8A0] selection:text-[#5B4A12] overflow-y-auto lg:overflow-hidden">
      
      {/* ── PARTE NARANJA A LA IZQUIERDA (Según requerimiento del usuario) ── */}
      <div className="hidden lg:flex lg:w-1/2 p-4 sm:p-6 lg:p-6 xl:p-8 items-center justify-center order-2 lg:order-1 h-full">
        <div className="w-full h-full max-h-[94vh] flex items-center justify-center">
          <AuthBanner
            caption="Restablece tu contraseña de forma segura y continúa evaluando software libre con GuiosPro."
            className="max-h-full"
          />
        </div>
      </div>

      {/* ── FORMULARIO A LA DERECHA (Paso a paso sin scroll) ── */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center py-4 px-6 sm:px-10 lg:px-10 xl:px-14 order-1 lg:order-2 h-full overflow-y-auto lg:overflow-visible">
        <div className="w-full max-w-md my-auto">

          {/* Logo GuiosPro */}
          <div className="mb-4 sm:mb-5">
            <GuiosProLogo textSize="text-2xl" />
          </div>

          {/* ══════════════════════════════════════════════════════════
              PASO 1: Ingreso de correo electrónico
             ══════════════════════════════════════════════════════════ */}
          {step === 1 && (
            <div className="space-y-4 sm:space-y-5">
              <div className="space-y-1.5">
                <span className="inline-block bg-[#FDE2C8] text-[#7A3E0A] text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  RECUPERACIÓN DE ACCESO
                </span>
                <h1 className="text-2xl sm:text-3xl font-serif text-[#2B3F4C] tracking-tight">
                  ¿Olvidaste tu contraseña?
                </h1>
                <p className="text-xs sm:text-sm text-[#4F6170] leading-relaxed">
                  Ingresa tu correo electrónico registrado y te enviaremos un código de seguridad para restablecer tu clave de acceso.
                </p>
              </div>

              <form onSubmit={handleRequestCode} className="space-y-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-[#2B3F4C]">
                    Correo electrónico
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#4F6170] pointer-events-none">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                      </svg>
                    </span>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setEmailError(null);
                      }}
                      placeholder="nombre@organizacion.com"
                      autoFocus
                      disabled={isLoading}
                      className={`w-full rounded-[14px] border pl-10 pr-3.5 py-2.5 sm:py-3 text-sm text-[#2B3F4C] focus:outline-none transition ${
                        emailError
                          ? 'border-red-400 bg-red-50/30'
                          : 'border-[#D5ECEC] bg-white hover:border-[#B4D6D6] focus:border-[#7FBFC1] focus:ring-2 focus:ring-[#7FBFC1]/20'
                      }`}
                    />
                  </div>
                  {emailError && <p className="text-xs text-red-500 font-medium pl-1">{emailError}</p>}
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-[#7FBFC1] hover:bg-[#72b1b3] disabled:opacity-50 text-[#16303B] font-semibold py-3 px-6 rounded-[14px] transition text-sm flex items-center justify-center gap-2 cursor-pointer shadow-none"
                >
                  {isLoading ? (
                    <>
                      <GuiosProSpinner size="xs" />
                      <span>Enviando código...</span>
                    </>
                  ) : (
                    <>
                      <span>Continuar</span>
                      <span className="font-bold">&rarr;</span>
                    </>
                  )}
                </button>

                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => navigate(ROUTES.AUTH.LOGIN)}
                    className="text-xs text-[#4F6170] hover:text-[#243642] transition cursor-pointer"
                  >
                    &larr; Volver al inicio de sesión
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════
              PASO 2: Ingreso de código en cuadritos dinámicos
             ══════════════════════════════════════════════════════════ */}
          {step === 2 && (
            <div className="space-y-4 sm:space-y-5">
              <div className="space-y-1.5">
                <span className="inline-block bg-[#D5ECEC] text-[#1F3340] text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  PASO 2 DE 3
                </span>
                <h1 className="text-2xl sm:text-3xl font-serif text-[#2B3F4C] tracking-tight">
                  Código de verificación
                </h1>
                <p className="text-xs sm:text-sm text-[#4F6170] leading-relaxed">
                  Ingresa el código temporal enviado a:
                </p>
                <div className="inline-flex items-center gap-2 bg-[#F6F5F3] border border-[#D5ECEC] px-3 py-1 rounded-[10px] text-xs font-semibold text-[#243642]">
                  <span>{email}</span>
                </div>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleVerifyCode();
                }}
                className="space-y-4 sm:space-y-5"
              >
                {/* Cuadritos dinámicos */}
                <div className="flex items-center justify-between gap-2 sm:gap-2.5 my-3 sm:my-4">
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
                      className={`w-11 h-13 sm:w-12 sm:h-14 text-center font-mono text-xl sm:text-2xl font-bold rounded-[12px] border-2 transition-all outline-none ${
                        hasCodeError
                          ? 'border-[#FCA5A5] bg-[#FEF2F2] text-[#B84318]'
                          : digit
                          ? 'border-[#7FBFC1] bg-white text-[#243642] shadow-sm'
                          : 'border-[#D5ECEC] bg-[#F6F5F3]/80 text-[#243642] hover:border-[#B4D6D6] focus:border-[#7FBFC1] focus:bg-white focus:ring-2 focus:ring-[#7FBFC1]/20'
                      }`}
                    />
                  ))}
                </div>

                <button
                  type="submit"
                  disabled={isLoading || digits.some((d) => d === '')}
                  className="w-full bg-[#7FBFC1] hover:bg-[#72b1b3] disabled:opacity-50 text-[#16303B] font-semibold py-3 px-6 rounded-[14px] transition text-sm flex items-center justify-center gap-2 cursor-pointer shadow-none"
                >
                  {isLoading ? (
                    <>
                      <GuiosProSpinner size="xs" />
                      <span>Validando código...</span>
                    </>
                  ) : (
                    <>
                      <span>Verificar código</span>
                      <span className="font-bold">&rarr;</span>
                    </>
                  )}
                </button>

                <div className="text-center pt-1 space-y-2">
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
                      onClick={() => setStep(1)}
                      className="text-xs text-[#4F6170] hover:text-[#243642] transition cursor-pointer"
                    >
                      &larr; Cambiar correo electrónico
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════
              PASO 3: Nueva contraseña y checklist interactivo
             ══════════════════════════════════════════════════════════ */}
          {step === 3 && (
            <div className="space-y-3.5 sm:space-y-4">
              <div className="space-y-1">
                <span className="inline-block bg-[#E1F3EA] text-[#1F7A4D] text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  PASO FINAL
                </span>
                <h1 className="text-2xl sm:text-3xl font-serif text-[#2B3F4C] tracking-tight">
                  Crea tu nueva contraseña
                </h1>
                <p className="text-xs sm:text-sm text-[#4F6170] leading-relaxed">
                  Ingresa tu nueva clave de acceso asegurándote de cumplir los requisitos de seguridad.
                </p>
              </div>

              <form onSubmit={handleConfirmReset} className="space-y-3 sm:space-y-3.5">
                {/* Campo Nueva Contraseña */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-[#2B3F4C]">
                    Nueva contraseña <span className="text-[#B84318]">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#4F6170] pointer-events-none">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </span>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mínimo 9 caracteres"
                      autoFocus
                      disabled={isLoading}
                      className="w-full rounded-[14px] border border-[#D5ECEC] pl-10 pr-10 py-2.5 text-sm text-[#2B3F4C] focus:outline-none focus:border-[#7FBFC1] focus:ring-2 focus:ring-[#7FBFC1]/20 transition bg-white"
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
                </div>

                {/* Campo Confirmar Contraseña */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-[#2B3F4C]">
                    Confirmar nueva contraseña <span className="text-[#B84318]">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#4F6170] pointer-events-none">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </span>
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repite la contraseña"
                      disabled={isLoading}
                      className="w-full rounded-[14px] border border-[#D5ECEC] pl-10 pr-10 py-2.5 text-sm text-[#2B3F4C] focus:outline-none focus:border-[#7FBFC1] focus:ring-2 focus:ring-[#7FBFC1]/20 transition bg-white"
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
                </div>

                {/* ── Checklist interactivo de requisitos de contraseña ── */}
                <div className="p-2.5 sm:p-3 bg-[#F6F5F3] rounded-[14px] border border-[#D5ECEC] space-y-1 sm:space-y-1.5">
                  <div className="text-[10px] font-bold text-[#2B3F4C] uppercase tracking-wider">
                    Requisitos de seguridad de contraseña:
                  </div>

                  {/* Criterio 1: Longitud */}
                  <div className="flex items-center gap-2 text-[11px] sm:text-xs">
                    {passwordValidation.isLengthValid ? (
                      <span className="w-3.5 h-3.5 rounded-full bg-[#1F7A4D]/20 text-[#1F7A4D] flex items-center justify-center font-bold text-[9px] shrink-0">
                        ✓
                      </span>
                    ) : (
                      <span className="w-3.5 h-3.5 rounded-full bg-gray-200 text-[#4F6170] flex items-center justify-center font-bold text-[9px] shrink-0">
                        •
                      </span>
                    )}
                    <span className={passwordValidation.isLengthValid ? 'text-[#1F7A4D] font-medium' : 'text-[#4F6170]'}>
                      Mayor de 8 caracteres (mínimo 9 caracteres)
                    </span>
                  </div>

                  {/* Criterio 2: No solo números */}
                  <div className="flex items-center gap-2 text-[11px] sm:text-xs">
                    {passwordValidation.isNotOnlyDigits ? (
                      <span className="w-3.5 h-3.5 rounded-full bg-[#1F7A4D]/20 text-[#1F7A4D] flex items-center justify-center font-bold text-[9px] shrink-0">
                        ✓
                      </span>
                    ) : (
                      <span className="w-3.5 h-3.5 rounded-full bg-gray-200 text-[#4F6170] flex items-center justify-center font-bold text-[9px] shrink-0">
                        •
                      </span>
                    )}
                    <span className={passwordValidation.isNotOnlyDigits ? 'text-[#1F7A4D] font-medium' : 'text-[#4F6170]'}>
                      No puede ser solo números (debe contener letras o símbolos)
                    </span>
                  </div>

                  {/* Criterio 3: No contiene datos personales */}
                  <div className="flex items-center gap-2 text-[11px] sm:text-xs">
                    {passwordValidation.isNoPersonalInfo ? (
                      <span className="w-3.5 h-3.5 rounded-full bg-[#1F7A4D]/20 text-[#1F7A4D] flex items-center justify-center font-bold text-[9px] shrink-0">
                        ✓
                      </span>
                    ) : (
                      <span className="w-3.5 h-3.5 rounded-full bg-gray-200 text-[#4F6170] flex items-center justify-center font-bold text-[9px] shrink-0">
                        •
                      </span>
                    )}
                    <span className={passwordValidation.isNoPersonalInfo ? 'text-[#1F7A4D] font-medium' : 'text-[#4F6170]'}>
                      No contiene tu nombre, apellido, usuario o correo
                    </span>
                  </div>

                  {/* Criterio 4: Coincidencia */}
                  <div className="flex items-center gap-2 text-[11px] sm:text-xs">
                    {passwordValidation.isMatch ? (
                      <span className="w-3.5 h-3.5 rounded-full bg-[#1F7A4D]/20 text-[#1F7A4D] flex items-center justify-center font-bold text-[9px] shrink-0">
                        ✓
                      </span>
                    ) : (
                      <span className="w-3.5 h-3.5 rounded-full bg-gray-200 text-[#4F6170] flex items-center justify-center font-bold text-[9px] shrink-0">
                        •
                      </span>
                    )}
                    <span className={passwordValidation.isMatch ? 'text-[#1F7A4D] font-medium' : 'text-[#4F6170]'}>
                      Las dos contraseñas deben coincidir exactamente
                    </span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !passwordValidation.allValid}
                  className="w-full bg-[#7FBFC1] hover:bg-[#72b1b3] disabled:opacity-50 text-[#16303B] font-semibold py-3 px-6 rounded-[14px] transition text-sm flex items-center justify-center gap-2 cursor-pointer shadow-none"
                >
                  {isLoading ? (
                    <>
                      <GuiosProSpinner size="xs" />
                      <span>Guardando nueva contraseña...</span>
                    </>
                  ) : (
                    <>
                      <span>Restablecer contraseña</span>
                      <span className="font-bold">✓</span>
                    </>
                  )}
                </button>

                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => navigate(ROUTES.AUTH.LOGIN)}
                    className="text-xs text-[#4F6170] hover:text-[#243642] transition cursor-pointer"
                  >
                    &larr; Volver al inicio de sesión
                  </button>
                </div>
              </form>
            </div>
          )}

        </div>
      </div>

    </div>
  );
};
