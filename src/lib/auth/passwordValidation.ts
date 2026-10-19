/**
 * SchoolPass Password Validation & HIBP Breached Password Checker
 *
 * Enforces consistent client and server password requirements:
 * - Passwords are trimmed consistently.
 * - Minimum 8 characters, maximum 128 characters.
 * - At least one special character.
 * - Dictionary check against common/predictable passwords.
 * - Integration with Have I Been Pwned (HIBP) Pwned Passwords API via k-anonymity.
 */

export const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password12', 'password123', 'password!', 'password@1', 'password123!',
  '12345678', '123456789', '12345678!', '12345678@',
  'qwerty123', 'qwerty!', 'qwerty@123', 'qwerty123!',
  'admin123', 'admin@123', 'admin123!',
  'welcome1', 'welcome!', 'welcome@1', 'welcome123', 'welcome@123', 'welcome123!',
  'letmein1', 'letmein!', 'letmein@123', 'letmein123!',
  'schoolpass', 'schoolpass1', 'schoolpass!', 'schoolpass@123', 'schoolpass123!',
  'iloveyou', 'iloveyou!', 'iloveyou123',
  'pass@word', 'pass@word1', 'p@ssword', 'p@ssw0rd', 'p@ssword1', 'p@ssword!',
  'sunshine!', 'princess!', 'football!', 'monkey123!',
]);

export function isCommonPassword(password: string): boolean {
  const lower = password.trim().toLowerCase();
  if (COMMON_PASSWORDS.has(lower)) {
    return true;
  }
  for (const common of ['password', 'admin', 'welcome', 'letmein', 'qwerty', 'schoolpass']) {
    if (lower.startsWith(common) && lower.length <= common.length + 2) {
      return true;
    }
  }
  return false;
}

/**
 * Compute SHA-1 hash of string in uppercase hexadecimal across both Node.js and Browser environments.
 */
async function computeSha1Hex(text: string): Promise<string> {
  // Check if Node.js crypto is available
  if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    try {
      const crypto = await import('node:crypto');
      return crypto.createHash('sha1').update(text, 'utf8').digest('hex').toUpperCase();
    } catch {
      // Fallback to web crypto if available
    }
  }

  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-1', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  }

  throw new Error('No crypto provider available for SHA-1 hashing.');
}

/**
 * Check whether a password exists in known data breaches using HIBP Pwned Passwords API.
 * Uses k-Anonymity model: only the first 5 characters of the SHA-1 hash leave the client/server.
 * Returns true if breached, false if safe or on API timeout/failure (fail-open).
 */
export async function isPwnedPassword(password: string, overrideUrl?: string): Promise<boolean> {
  const trimmed = password.trim();
  if (!trimmed) return false;

  if (isCommonPassword(trimmed)) {
    return true;
  }

  // Test environment stub
  if (process.env.TEST_MOCK_HIBP === 'true' && !overrideUrl) {
    return trimmed.toLowerCase().includes('pwned') || trimmed.toLowerCase().includes('breached') || trimmed === 'PwnedPassword123!';
  }

  try {
    const hashHex = await computeSha1Hex(trimmed);
    const prefix = hashHex.slice(0, 5);
    const suffix = hashHex.slice(5);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    try {
      const targetUrl = overrideUrl || `https://api.pwnedpasswords.com/range/${prefix}`;
      const res = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'SchoolPass-Security-Validator/1.0',
          'Add-Padding': 'true',
        },
        signal: controller.signal,
      });

      if (!res.ok) {
        // Fail-open on upstream HIBP API errors to prevent user lockout
        console.warn(`[HIBP] Breached password check returned status ${res.status}. Failing open per policy.`);
        return false;
      }

      const text = await res.text();
      const lines = text.split('\n');
      for (const line of lines) {
        const parts = line.trim().split(':');
        if (parts.length >= 2) {
          const returnedSuffix = parts[0].trim().toUpperCase();
          const countStr = parts[1].trim();
          if (returnedSuffix === suffix) {
            const count = parseInt(countStr || '0', 10);
            return count > 0;
          }
        }
      }
      return false;
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (err) {
    // Fail-open: Network issues or timeouts should not prevent legitimate user account creation
    console.warn('[HIBP] Breached password check failed or timed out. Failing open per policy.', err instanceof Error ? err.message : err);
    return false;
  }
}

/**
 * Synchronous rules validation: checks required format, bounds, special character, and dictionary weakness.
 */
export function validatePasswordSync(password: string): { valid: boolean; reason?: string; error?: string } {
  const trimmed = typeof password === 'string' ? password.trim() : '';

  if (!trimmed) {
    const reason = 'Password is required.';
    return { valid: false, reason, error: reason };
  }
  if (trimmed.length < 8) {
    const reason = 'Password must be at least 8 characters long.';
    return { valid: false, reason, error: reason };
  }
  if (trimmed.length > 128) {
    const reason = 'Password must not exceed 128 characters.';
    return { valid: false, reason, error: reason };
  }
  if (!/[^A-Za-z0-9]/.test(trimmed)) {
    const reason = 'Password must include at least one special character.';
    return { valid: false, reason, error: reason };
  }
  if (isCommonPassword(trimmed)) {
    const reason = 'Choose a stronger password.';
    return { valid: false, reason, error: reason };
  }

  return { valid: true };
}

/**
 * Comprehensive async password validation checking format, special character, dictionary, and HIBP breach status.
 */
export async function validatePasswordStrength(
  password: string
): Promise<{ valid: boolean; reason?: string; error?: string }> {
  const syncCheck = validatePasswordSync(password);
  if (!syncCheck.valid) {
    return syncCheck;
  }

  const pwned = await isPwnedPassword(password);
  if (pwned) {
    const reason = 'This password has appeared in a known data breach. Please choose a different, more secure password.';
    return {
      valid: false,
      reason,
      error: reason,
    };
  }

  return { valid: true };
}

export { validatePasswordStrength as validatePasswordStrengthAsync };
