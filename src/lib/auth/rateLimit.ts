/**
 * SchoolPass In-Memory IP Rate Limiter
 * 
 * Enforces a strict maximum of 5 failed attempts per IP address
 * within a 15-minute sliding window before temporarily blocking the IP for 15 minutes.
 * Counters and lockout timestamps are maintained in memory without paid storage dependencies.
 */

interface RateLimitEntry {
  attempts: number;
  firstAttemptAt: number;
  blockedUntil: number | null;
}

const MAX_FAILED_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15-minute window
const BLOCK_DURATION_MS = 15 * 60 * 1000; // 15-minute block

// In-memory store keyed by IP address (or ip:action)
const ipStore = new Map<string, RateLimitEntry>();

// Last cleanup timestamp to prevent memory leaks from stale IPs
let lastCleanupAt = Date.now();
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const MAX_ENTRIES_BEFORE_SWEEP = 5000;

function sweepExpiredEntries(): void {
  const now = Date.now();
  for (const [key, entry] of ipStore.entries()) {
    const isBlockExpired = entry.blockedUntil !== null && entry.blockedUntil <= now;
    const isWindowExpired = entry.blockedUntil === null && now - entry.firstAttemptAt > WINDOW_MS;
    if (isBlockExpired || isWindowExpired) {
      ipStore.delete(key);
    }
  }
  lastCleanupAt = now;
}

// Helper to validate IPv4 and IPv6 strings
export function isValidIp(ip: string): boolean {
  if (!ip || typeof ip !== 'string') return false;
  const trimmed = ip.trim();
  if (trimmed === 'unknown' || trimmed === 'localhost') return false;
  // IPv4 format
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  if (ipv4Regex.test(trimmed)) return true;
  // IPv6 format (simplified standard hex-colon check)
  const ipv6Regex = /^(?:[a-fA-F0-9]{1,4}:){1,7}[a-fA-F0-9]{1,4}$|^::1$|^::$/;
  return ipv6Regex.test(trimmed);
}

/**
 * Safely retrieve a header value from standard Headers, Request, Next.js headers(),
 * or plain header dictionary objects without throwing if internal properties exist.
 */
function getHeaderValue(
  target: Request | Headers | { get: (name: string) => string | null } | Record<string, unknown> | unknown,
  headerName: string
): string | null {
  if (!target || typeof target !== 'object') {
    return null;
  }

  const nameLower = headerName.toLowerCase();

  // 1. Check if target directly implements .get() (Headers, Next.js ReadonlyHeaders, custom Headers-like)
  if ('get' in target && typeof (target as { get: unknown }).get === 'function') {
    try {
      const val = (target as { get: (name: string) => string | null }).get(nameLower)
        ?? (target as { get: (name: string) => string | null }).get(headerName);
      if (typeof val === 'string') return val;
    } catch {
      // Fall through if getter throws
    }
  }

  // 2. Check if target is a Request or request-like wrapper containing a headers property
  if ('headers' in target && target.headers && typeof target.headers === 'object') {
    const inner = target.headers;
    if ('get' in inner && typeof (inner as { get: unknown }).get === 'function') {
      try {
        const val = (inner as { get: (name: string) => string | null }).get(nameLower)
          ?? (inner as { get: (name: string) => string | null }).get(headerName);
        if (typeof val === 'string') return val;
      } catch {
        // Fall through
      }
    } else {
      for (const [k, v] of Object.entries(inner)) {
        if (k.toLowerCase() === nameLower) {
          if (typeof v === 'string') return v;
          if (Array.isArray(v) && typeof v[0] === 'string') return v[0];
        }
      }
    }
  }

  // 3. Check if target is a plain dictionary of headers
  for (const [k, v] of Object.entries(target as Record<string, unknown>)) {
    if (k.toLowerCase() === nameLower) {
      if (typeof v === 'string') return v;
      if (Array.isArray(v) && typeof v[0] === 'string') return v[0];
    }
  }

  return null;
}

/**
 * Extract the client's public or proxy IP address safely from verified platform headers.
 * Resolves platform-provided headers first (Vercel Edge), then standard reverse-proxy headers,
 * preventing spoofed X-Forwarded-For prefixes from bypassing rate limits.
 */
export function extractClientIp(
  requestOrHeaders: Request | Headers | { get: (name: string) => string | null } | Record<string, unknown>
): string {
  // 1. Vercel Edge platform-injected header (unforgeable by external clients)
  const xVercelForwardedFor = getHeaderValue(requestOrHeaders, 'x-vercel-forwarded-for');
  if (xVercelForwardedFor) {
    const candidate = xVercelForwardedFor.split(',')[0].trim();
    if (isValidIp(candidate)) {
      return candidate;
    }
  }

  // 2. Standard single client IP header set by reverse proxy (e.g. Nginx or Vercel Edge)
  const xRealIp = getHeaderValue(requestOrHeaders, 'x-real-ip');
  if (xRealIp) {
    const candidate = xRealIp.trim();
    if (isValidIp(candidate)) {
      return candidate;
    }
  }

  // 3. X-Forwarded-For header: When behind an edge proxy, if a client sends a spoofed
  // X-Forwarded-For header, the proxy appends the real client IP to the end of the chain.
  const xForwardedFor = getHeaderValue(requestOrHeaders, 'x-forwarded-for');
  if (xForwardedFor) {
    const ips = xForwardedFor.split(',').map((s) => s.trim()).filter(Boolean);
    if (ips.length > 0) {
      // In a reverse-proxy chain, the right-most IP is the one appended by the immediate upstream proxy.
      const candidate = ips.length > 1 ? ips[ips.length - 1] : ips[0];
      if (isValidIp(candidate)) {
        return candidate;
      }
    }
  }

  return '127.0.0.1';
}


/**
 * Check whether an IP address is currently blocked by rate limiting.
 */
export function checkIpRateLimit(
  ip: string,
  scope = 'auth'
): { allowed: boolean; retryAfterSeconds?: number; attempts: number } {
  const key = `${scope}:${ip}`;
  const now = Date.now();

  if (now - lastCleanupAt > CLEANUP_INTERVAL_MS || ipStore.size > MAX_ENTRIES_BEFORE_SWEEP) {
    sweepExpiredEntries();
  }

  const entry = ipStore.get(key);
  if (!entry) {
    return { allowed: true, attempts: 0 };
  }

  // Check if IP is currently under active block
  if (entry.blockedUntil && entry.blockedUntil > now) {
    const retryAfterSeconds = Math.ceil((entry.blockedUntil - now) / 1000);
    return { allowed: false, retryAfterSeconds, attempts: entry.attempts };
  }

  // Block expired: clear the record and allow
  if (entry.blockedUntil && entry.blockedUntil <= now) {
    ipStore.delete(key);
    return { allowed: true, attempts: 0 };
  }

  // Sliding window expired without reaching block threshold: clear and allow
  if (now - entry.firstAttemptAt > WINDOW_MS) {
    ipStore.delete(key);
    return { allowed: true, attempts: 0 };
  }

  return { allowed: true, attempts: entry.attempts };
}

/**
 * Record a failed attempt for an IP address. If attempts reach 5, blocks the IP for 15 minutes.
 */
export function recordIpFailedAttempt(
  ip: string,
  scope = 'auth'
): { blocked: boolean; attempts: number; retryAfterSeconds?: number } {
  const key = `${scope}:${ip}`;
  const now = Date.now();

  let entry = ipStore.get(key);
  if (!entry || now - entry.firstAttemptAt > WINDOW_MS) {
    entry = {
      attempts: 1,
      firstAttemptAt: now,
      blockedUntil: null,
    };
    ipStore.set(key, entry);
    return { blocked: false, attempts: 1 };
  }

  entry.attempts += 1;
  if (entry.attempts >= MAX_FAILED_ATTEMPTS) {
    entry.blockedUntil = now + BLOCK_DURATION_MS;
    ipStore.set(key, entry);
    return {
      blocked: true,
      attempts: entry.attempts,
      retryAfterSeconds: Math.ceil(BLOCK_DURATION_MS / 1000),
    };
  }

  ipStore.set(key, entry);
  return { blocked: false, attempts: entry.attempts };
}

/**
 * Create a standardized HTTP 429 Rate Limit Response with Retry-After header.
 */
export function createRateLimitResponse(retryAfterSeconds = 900): Response {
  return Response.json(
    {
      error: `Too many attempts. Please try again in ${retryAfterSeconds} seconds.`,
      errorCode: 'RATE_LIMITED',
      retryAfterSeconds,
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfterSeconds),
      },
    }
  );
}

/**
 * Reset rate limit counters for an IP address on successful authentication.
 * Under Natural Expiry policy, this is reserved for administrative reset/testing.
 */
export function resetIpRateLimit(ip: string, scope = 'auth'): void {
  const key = `${scope}:${ip}`;
  ipStore.delete(key);
}

/**
 * Test helper to clear in-memory rate limit store completely between tests.
 */
export function _clearRateLimitsForTesting(): void {
  ipStore.clear();
}

