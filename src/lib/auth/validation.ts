import type { ZodSchema } from 'zod';

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; response: Response };

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
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(payload);
  if (!result.success) {
    const issue = result.error.issues[0];
    return {
      success: false,
      error: issue?.message || 'Invalid parameters provided.',
    };
  }
  return { success: true, data: result.data };
}
