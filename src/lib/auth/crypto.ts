import 'server-only';
import { randomBytes, scrypt, timingSafeEqual, createHmac, createHash } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const SCRYPT_COST = 16384; // N=16384, r=8, p=1 recommended standard for slow hashing
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELISM = 1;

/**
 * Modern slow password hashing using scrypt (Node.js crypto).
 * Format: scrypt$N=16384,r=8,p=1$salt$derivedKey
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH).toString('hex');
  const derivedKey = (await scryptAsync(password, salt, KEY_LENGTH, {
    N: SCRYPT_COST,
    r: SCRYPT_BLOCK_SIZE,
    p: SCRYPT_PARALLELISM,
  })) as Buffer;

  return `scrypt$N=${SCRYPT_COST},r=${SCRYPT_BLOCK_SIZE},p=${SCRYPT_PARALLELISM}$${salt}$${derivedKey.toString('hex')}`;
}

/**
 * Verify password against hashed representation using timing-safe comparison.
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  try {
    const parts = storedHash.split('$');
    if (parts.length !== 4 || parts[0] !== 'scrypt') {
      return false;
    }

    const salt = parts[2];
    const originalKey = Buffer.from(parts[3], 'hex');

    const derivedKey = (await scryptAsync(password, salt, originalKey.length, {
      N: SCRYPT_COST,
      r: SCRYPT_BLOCK_SIZE,
      p: SCRYPT_PARALLELISM,
    })) as Buffer;

    return timingSafeEqual(originalKey, derivedKey);
  } catch {
    return false;
  }
}

/**
 * Generate a cryptographically secure random token string for email verification or password reset.
 */
export function generateSecureToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Hash a token using SHA-256 before saving to the database/store.
 * Addendum §5.4: tokens are hashed in storage.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Sign session data with HMAC-SHA256.
 */
export function signSessionPayload(payload: string, secret?: string): string {
  const sessionSecret = secret || process.env.SESSION_SECRET || 'schoolpass_dev_fallback_secret_key_32bytes_min';
  const hmac = createHmac('sha256', sessionSecret).update(payload).digest('hex');
  return `${payload}.${hmac}`;
}

/**
 * Verify and extract session data from signed string.
 */
export function verifySessionPayload(signedString: string, secret?: string): string | null {
  try {
    const sessionSecret = secret || process.env.SESSION_SECRET || 'schoolpass_dev_fallback_secret_key_32bytes_min';
    const lastDotIndex = signedString.lastIndexOf('.');
    if (lastDotIndex === -1) return null;

    const payload = signedString.substring(0, lastDotIndex);
    const signature = signedString.substring(lastDotIndex + 1);

    const expectedHmac = createHmac('sha256', sessionSecret).update(payload).digest('hex');

    const sigBuf = Buffer.from(signature, 'hex');
    const expBuf = Buffer.from(expectedHmac, 'hex');

    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Minimum password length validation (RULES_CONFIG Rule 5: 8 chars).
 */
export function validatePasswordStrength(password: string): { valid: boolean; reason?: string } {
  if (!password || password.length < 8) {
    return { valid: false, reason: 'Password must be at least 8 characters long.' };
  }
  return { valid: true };
}
