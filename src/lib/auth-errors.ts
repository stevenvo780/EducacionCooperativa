// Traduce errores de Firebase Auth y del backend de Agora a mensajes claros
// en español. Funciona con tres formatos posibles del error:
//   1. Error con .code === 'auth/...' (cliente Firebase JS SDK).
//   2. Error cuya .message contiene la cadena 'auth/...' (el backend a veces
//      adjunta el código en el texto).
//   3. Error genérico — devuelve fallback.

import { getErrorCode, getErrorMessage } from './error-utils';

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  'auth/user-not-found': 'No encontramos una cuenta con este email.',
  'auth/wrong-password': 'Contraseña incorrecta.',
  'auth/invalid-credential': 'Email o contraseña incorrectos.',
  'auth/invalid-login-credentials': 'Email o contraseña incorrectos.',
  'auth/invalid-email': 'Email inválido.',
  'auth/email-already-in-use': 'Ya hay una cuenta con este email.',
  'auth/email-already-exists': 'Ya hay una cuenta con este email.',
  'auth/weak-password': 'La contraseña es demasiado débil. Usá al menos 8 caracteres con letras y números.',
  'auth/too-many-requests': 'Demasiados intentos. Esperá unos minutos antes de volver a intentarlo.',
  'auth/user-disabled': 'Esta cuenta está deshabilitada. Contactá al administrador.',
  'auth/network-request-failed': 'Sin conexión. Verificá tu internet.',
  'auth/popup-closed-by-user': 'Cerraste la ventana de Google antes de completar el inicio de sesión.',
  'auth/popup-blocked': 'El navegador bloqueó la ventana emergente de Google. Permitila y reintentá.',
  'auth/cancelled-popup-request': 'Operación cancelada.',
  'auth/operation-not-allowed': 'Este método de inicio de sesión no está habilitado.',
  'auth/requires-recent-login': 'Por seguridad, volvé a iniciar sesión antes de cambiar la contraseña.'
};

const CODE_PATTERN = /auth\/[a-z0-9-]+/i;

const extractAuthCode = (error: unknown): string | undefined => {
  const code = getErrorCode(error);
  if (code && code.startsWith('auth/')) {
    return code;
  }
  const message = getErrorMessage(error, '');
  const match = message.match(CODE_PATTERN);
  return match ? match[0].toLowerCase() : undefined;
};

export const translateAuthError = (error: unknown, fallback = 'Ocurrió un error al autenticarte. Intentalo de nuevo.'): string => {
  const code = extractAuthCode(error);
  if (code && AUTH_ERROR_MESSAGES[code]) {
    return AUTH_ERROR_MESSAGES[code];
  }
  return getErrorMessage(error, fallback);
};
