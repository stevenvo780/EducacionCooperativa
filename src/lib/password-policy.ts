// Política de password compartida entre register, change-password y validators
// de formularios. La validación final SIEMPRE sucede server-side; esta es UX
// de borde para feedback inmediato y para alinear el mensaje con el server.

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_HELP_TEXT = 'Mínimo 8 caracteres, incluye letras y números.';

// Top passwords comunes/débiles. Lista corta hardcoded — la validación real
// vive en Firebase Auth y en políticas del backend; esto es solo feedback UX.
const COMMON_WEAK_PASSWORDS = new Set([
  'password',
  'password1',
  'password123',
  '12345678',
  '123456789',
  '1234567890',
  'qwerty123',
  'qwertyui',
  'qwerty1234',
  'abc12345',
  'iloveyou',
  'letmein1',
  'welcome1',
  'admin123',
  'agora123'
]);

export interface PasswordValidationResult {
  ok: boolean;
  error?: string;
}

export const validatePasswordPolicy = (password: string): PasswordValidationResult => {
  if (typeof password !== 'string' || password.length === 0) {
    return { ok: false, error: 'La contraseña es obligatoria.' };
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    return { ok: false, error: `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.` };
  }
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    return { ok: false, error: 'La contraseña debe combinar letras y números.' };
  }
  if (COMMON_WEAK_PASSWORDS.has(password.toLowerCase())) {
    return { ok: false, error: 'Esta contraseña es demasiado común. Elige una más difícil de adivinar.' };
  }
  return { ok: true };
};
