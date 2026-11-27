/**
 * Utilidad compartida de validación de contraseñas de GuiosPro
 * 
 * Requisitos:
 * 1. Mayor de 8 caracteres (mínimo 9 caracteres)
 * 2. No puede ser solo números (debe contener letras o símbolos)
 * 3. No contiene tu nombre, apellido, usuario o correo
 * 4. Las dos contraseñas deben coincidir exactamente
 */

export interface PasswordValidationResult {
  isLengthValid: boolean;
  isNotOnlyDigits: boolean;
  isNoPersonalInfo: boolean;
  matchedToken?: string;
  isMatch: boolean;
  allValid: boolean;
  firstError?: string;
  confirmError?: string;
}

export function validatePassword(
  password: string,
  confirmPassword?: string,
  userInfo?: {
    first_name?: string;
    last_name?: string;
    username?: string;
    email?: string;
  }
): PasswordValidationResult {
  const pwd = password || '';
  const confirm = confirmPassword || '';
  const fn = (userInfo?.first_name || '').trim().toLowerCase();
  const ln = (userInfo?.last_name || '').trim().toLowerCase();
  const un = (userInfo?.username || '').trim().toLowerCase();
  const em = (userInfo?.email || '').trim().toLowerCase();

  // 1. Longitud mayor de 8 caracteres (mínimo 9)
  const isLengthValid = pwd.length > 8;

  // 2. No solo números (debe contener letras o caracteres especiales)
  const isNotOnlyDigits = pwd.length > 0 && !/^\d+$/.test(pwd);

  // 3. No contener datos personales (nombre, apellido, usuario o correo)
  const pwdLower = pwd.toLowerCase();
  const personalTokens: string[] = [];

  if (un.length >= 3) personalTokens.push(un);
  if (fn.length >= 3) {
    fn.split(/\s+/).forEach((part) => {
      if (part.length >= 3) personalTokens.push(part);
    });
  }
  if (ln.length >= 3) {
    ln.split(/\s+/).forEach((part) => {
      if (part.length >= 3) personalTokens.push(part);
    });
  }
  if (em) {
    const localPart = em.split('@')[0];
    localPart.split(/[._\-+0-9]+/).forEach((part) => {
      if (part.length >= 3) personalTokens.push(part);
    });
  }

  const matchedToken = personalTokens.find((tok) => tok && pwdLower.includes(tok));
  const isNoPersonalInfo = !matchedToken;

  // 4. Coincidencia con confirmación
  const isMatch = Boolean(confirm && pwd === confirm);

  let firstError: string | undefined = undefined;
  if (pwd.length > 0) {
    if (!isLengthValid) {
      firstError = 'Mayor de 8 caracteres (mínimo 9 caracteres)';
    } else if (!isNotOnlyDigits) {
      firstError = 'No puede ser solo números (debe contener letras o símbolos)';
    } else if (!isNoPersonalInfo) {
      firstError = `No debe contener tu nombre, apellido, usuario o correo ('${matchedToken}')`;
    }
  }

  let confirmError: string | undefined = undefined;
  if (confirm.length > 0 && !isMatch) {
    confirmError = 'Las contraseñas no coinciden exactamente.';
  }

  const allValid = isLengthValid && isNotOnlyDigits && isNoPersonalInfo && isMatch;

  return {
    isLengthValid,
    isNotOnlyDigits,
    isNoPersonalInfo,
    matchedToken,
    isMatch,
    allValid,
    firstError,
    confirmError,
  };
}
