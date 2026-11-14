import type { ZodSchema } from 'zod';

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; response: Response };

export type ActionValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors: Record<string, string> };

/**
 * Safely parse and validate an incoming HTTP Request JSON body against a Zod schema.
 * - Catches malformed JSON syntax without throwing unhandled runtime exceptions.
 * - Validates field types, trimming, lowercasing, and domain constraints.
 * - Returns a standardized HTTP 400 response on validation failure without exposing internal details.
 */
export async function validateJsonBody<T>(
  request: Request,
  schema: ZodSchema<T>
): Promise<ValidationResult<T>> {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return {
      success: false,
      response: Response.json(
        { error: 'Malformed JSON payload. Please verify request format.' },
        { status: 400 }
      ),
    };
  }

  const result = schema.safeParse(rawBody);
  if (!result.success) {
    const issue = result.error.issues[0];
    const errorMessage = issue?.message || 'Invalid request parameters.';
    return {
      success: false,
      response: Response.json({ error: errorMessage }, { status: 400 }),
    };
  }

  return { success: true, data: result.data };
}

/**
 * Safely parse and validate in-memory payloads (such as Server Action arguments).
 */
export function validateActionPayload<T>(
  payload: unknown,
  schema: ZodSchema<T>
): ActionValidationResult<T> {
  const result = schema.safeParse(payload);
  if (!result.success) {
    const fieldErrors: Record<string, string> = {};

    for (const issue of result.error.issues) {
      const field = issue.path[0];
      if (typeof field === 'string' && !fieldErrors[field]) {
        fieldErrors[field] = issue.message;
      }
    }

    const issue = result.error.issues[0];
    return {
      success: false,
      error: issue?.message || 'Invalid parameters provided.',
      fieldErrors,
    };
  }
  return { success: true, data: result.data };
}

/**
 * Trims leading/trailing whitespace and normalizes repeated internal spaces.
 */
export function normalizeFullName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

/**
 * Validates a person's full name:
 * - Requires at least two complete name parts.
 * - Requires each name part to contain at least two letters.
 * - Rejects single-letter initials (e.g. 'HH', 'h j', 'T David').
 * - Rejects numbers and unsupported special characters.
 * - Allows legitimate names containing hyphens, apostrophes and accented letters.
 * - Optional title prefix with trailing dot (e.g. 'Dr.', 'Mrs.', 'Prof.') is allowed if it has >= 2 letters.
 */
export function validatePersonFullName(
  value: string,
  fieldLabel = 'Student full name'
): string | null {
  const trimmed = value.trim();
  if (trimmed.length < 2) {
    return `${fieldLabel} must be at least 2 characters.`;
  }

  if (trimmed.length > 100) {
    return `${fieldLabel} must not exceed 100 characters.`;
  }

  // Reject numbers
  if (/\d/.test(trimmed)) {
    return `${fieldLabel} must include letters only and must not contain numbers.`;
  }

  // Must include letters
  if (!/\p{L}/u.test(trimmed)) {
    return `${fieldLabel} must include letters.`;
  }

  const normalized = normalizeFullName(trimmed);
  const parts = normalized.split(' ');

  if (parts.length < 2) {
    return `Please enter at least a first and last name for ${fieldLabel.toLowerCase()}.`;
  }

  const partPattern = /^[\p{L}]+(?:['’\-][\p{L}]+)*\.?$/u;

  for (const part of parts) {
    if (!partPattern.test(part)) {
      return `${fieldLabel} must contain only letters, hyphens, and apostrophes.`;
    }

    const letters = part.match(/\p{L}/gu) || [];
    if (letters.length < 2) {
      return `Each name part must contain at least 2 letters. Single-letter initials like "${part}" are not accepted.`;
    }
  }

  return null;
}
