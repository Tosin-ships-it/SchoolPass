/**
 * In-memory idempotency helper for server actions.
 *
 * A repeated submission carrying the same idempotency key returns the first
 * successful result instead of creating a second record. Concurrent callers
 * with the same key share the same in-flight promise.
 *
 * This is a best-effort guard for duplicate form submissions within a single
 * server instance. It is not a substitute for a database uniqueness constraint.
 */

interface CompletedEntry<T> {
  expiresAt: number;
  value: T;
}

const DEFAULT_TTL_MS = 5 * 60 * 1000;
const MAX_COMPLETED_ENTRIES = 1000;

const completed = new Map<string, CompletedEntry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();

function sweepExpired(now: number): void {
  for (const [key, entry] of completed.entries()) {
    if (entry.expiresAt <= now) {
      completed.delete(key);
    }
  }
}

export interface RunIdempotentOptions<T> {
  ttlMs?: number;
  shouldCache?: (value: T) => boolean;
}

export async function runIdempotent<T>(
  key: string,
  operation: () => Promise<T>,
  options: RunIdempotentOptions<T> = {}
): Promise<T> {
  const now = Date.now();

  if (completed.size > MAX_COMPLETED_ENTRIES) {
    sweepExpired(now);
  }

  const cached = completed.get(key);
  if (cached) {
    if (cached.expiresAt > now) {
      return cached.value as T;
    }
    completed.delete(key);
  }

  const pending = inFlight.get(key);
  if (pending) {
    return pending as Promise<T>;
  }

  const shouldCache = options.shouldCache ?? (() => true);
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;

  const promise = operation()
    .then((value) => {
      if (shouldCache(value)) {
        completed.set(key, { expiresAt: Date.now() + ttlMs, value });
      }
      return value;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, promise);
  return promise;
}

export function _clearIdempotencyForTesting(): void {
  completed.clear();
  inFlight.clear();
}
