import 'server-only';
import { randomBytes, scrypt, timingSafeEqual, createHmac, createHash } from 'node:crypto';
import { hash as argon2Hash, verify as argon2Verify } from '@node-rs/argon2';

function scryptAsync(
  password: string,
  salt: string,
  keyLength: number,
  options: { N: number; r: number; p: number }
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keyLength, options, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });
}

// Legacy scrypt constants preserved for backward-compatible verification
const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_SALT_LENGTH = 16;
const SCRYPT_COST = 16384; // N=16384, r=8, p=1
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELISM = 1;

// Argon2id parameters (RFC 9106 & OWASP recommendation: 64 MiB, 3 iterations, p=1, 32-byte key)
export const ARGON2_MEMORY_COST = 65536; // 64 MiB in KiB
export const ARGON2_TIME_COST = 3;
export const ARGON2_PARALLELISM = 1;
export const ARGON2_OUTPUT_LEN = 32;

/**
 * Modern password hashing using Argon2id (RFC 9106).
 * Parameters: m=65536 (64 MiB), t=3, p=1, 32-byte derived key, cryptographically secure salt.
 * Produces standard PHC format: $argon2id$v=19$m=65536,t=3,p=1$...
 */
export async function hashPassword(password: string): Promise<string> {
  return argon2Hash(password, {
    memoryCost: ARGON2_MEMORY_COST,
    timeCost: ARGON2_TIME_COST,
    parallelism: ARGON2_PARALLELISM,
    outputLen: ARGON2_OUTPUT_LEN,
  });
}

/**
 * Check whether a stored hash needs to be rehashed to current Argon2id parameters.
 * Returns true if the hash is legacy scrypt or does not match target Argon2id parameters.
 */
export function needsRehash(storedHash: string): boolean {
  if (!storedHash || typeof storedHash !== 'string') return false;
  if (storedHash.startsWith('scrypt$')) return true;
  if (!storedHash.startsWith(`$argon2id$v=19$m=${ARGON2_MEMORY_COST},t=${ARGON2_TIME_COST},p=${ARGON2_PARALLELISM}$`)) {
    return true;
  }
  return false;
}

/**
 * Verify password against stored hash representation.
 * Supports both modern Argon2id ($argon2id$...) and legacy scrypt (scrypt$N=16384,r=8,p=1$...).
 * Employs timing-safe comparisons to prevent timing attacks.
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  try {
    if (!storedHash || typeof storedHash !== 'string') {
      return false;
    }

    // 1. Argon2id verification
    if (storedHash.startsWith('$argon2')) {
      return await argon2Verify(storedHash, password);
    }

    // 2. Legacy scrypt verification
    if (storedHash.startsWith('scrypt$')) {
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
    }

    return false;
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

export {
  validatePasswordSync as validatePasswordStrength,
  validatePasswordStrength as validatePasswordStrengthAsync,
  isPwnedPassword,
  isCommonPassword,
} from './passwordValidation';
