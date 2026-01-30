import crypto from 'crypto';

/**
 * Hash a password using SHA-256.
 * Used for custom (non-Firebase) authentication.
 */
export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}
