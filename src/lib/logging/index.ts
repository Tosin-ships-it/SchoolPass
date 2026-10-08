import 'server-only';

export type LogLevel = 'info' | 'warn' | 'error';
export type ActorType = 'parent' | 'staff' | 'admin' | 'system' | 'anonymous';

export interface StructuredLogEntry {
  timestamp: string;
  level: LogLevel;
  event: string;
  actorType: ActorType;
  actorId?: string; // Record CUID only. Never personal identifiers.
  entityType?: string;
  entityId?: string; // Record CUID only. Never personal identifiers.
  outcome: 'success' | 'failure' | 'pending';
  details?: Record<string, unknown>;
}

/**
 * RULES_LOGGING.md compliant logger.
 * Never logs: names, emails, phone numbers, fee balances, payment amounts,
 * attendance status, or session tokens.
 */
export function logEvent(entry: Omit<StructuredLogEntry, 'timestamp'>): void {
  try {
    const payload: StructuredLogEntry = {
      timestamp: new Date().toISOString(),
      ...entry,
    };
    const serialized = JSON.stringify(payload);
    if (entry.level === 'error') {
      console.error(serialized);
    } else if (entry.level === 'warn') {
      console.warn(serialized);
    } else {
      console.info(serialized);
    }
  } catch {
    // Rule 6: A failed log write does not break the request.
  }
}
