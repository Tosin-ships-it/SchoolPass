export const INTAKE_FIELD_NAMES = [
  'name',
  'intendedClass',
  'sessionYear',
  'guardianName',
  'guardianPhone',
  'guardianEmail',
  'notes',
] as const;

export type IntakeFieldName = (typeof INTAKE_FIELD_NAMES)[number];

export type IntakeFieldErrors = Partial<Record<IntakeFieldName, string>>;

export interface IntakeFormValues {
  name: string;
  intendedClass: string;
  sessionYear: string;
  guardianName: string;
  guardianPhone: string;
  guardianEmail: string;
  notes: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_ALLOWED_PATTERN = /^\+?[\d\s()-]+$/;
const SESSION_YEAR_PATTERN = /^(\d{4})\/(\d{4})$/;

function isValidSessionYear(value: string): boolean {
  const match = value.match(SESSION_YEAR_PATTERN);
  if (!match) return false;

  const start = Number(match[1]);
  const end = Number(match[2]);
  return start >= 2000 && start <= 2100 && end === start + 1;
}

function isValidPhone(value: string): boolean {
  if (!PHONE_ALLOWED_PATTERN.test(value)) return false;
  const digits = value.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
}

export interface IntakeValidationOptions {
  availableClasses?: string[];
  availableSessions?: string[];
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

export function validateIntakeField(
  field: IntakeFieldName,
  value: string,
  options?: IntakeValidationOptions
): string | null {
  const trimmed = value.trim();

  switch (field) {
    case 'name':
      return validatePersonFullName(trimmed, 'Student full name');

    case 'intendedClass':
      if (trimmed.length < 1) {
        return 'Intended class is required.';
      }
      if (trimmed.length > 50) {
        return 'Intended class must not exceed 50 characters.';
      }
      if (!/[\p{L}\p{N}]/u.test(trimmed)) {
        return 'Intended class must include letters or numbers.';
      }
      if (options?.availableClasses && options.availableClasses.length > 0) {
        if (!options.availableClasses.includes(trimmed)) {
          return 'Please select a valid school class from the list.';
        }
      }
      return null;

    case 'sessionYear':
      if (trimmed.length < 4) {
        return 'Session year is required (e.g. 2026/2027).';
      }
      if (trimmed.length > 20) {
        return 'Session year must not exceed 20 characters.';
      }
      if (!isValidSessionYear(trimmed)) {
        return 'Session year must be a consecutive academic year in the format YYYY/YYYY (e.g. 2026/2027).';
      }
      if (options?.availableSessions && options.availableSessions.length > 0) {
        if (!options.availableSessions.includes(trimmed)) {
          return 'Please select a valid academic session from the list.';
        }
      }
      return null;

    case 'guardianName':
      if (!trimmed) return null;
      return validatePersonFullName(trimmed, 'Guardian name');

    case 'guardianPhone':
      if (trimmed.length > 30) {
        return 'Guardian phone must not exceed 30 characters.';
      }
      if (trimmed.length > 0 && !isValidPhone(trimmed)) {
        return 'Please enter a valid guardian phone number.';
      }
      return null;

    case 'guardianEmail':
      if (trimmed.length > 255) {
        return 'Guardian email must not exceed 255 characters.';
      }
      if (trimmed.length > 0 && !EMAIL_PATTERN.test(trimmed)) {
        return 'Please enter a valid guardian email address.';
      }
      return null;

    case 'notes':
      if (trimmed.length > 500) {
        return 'Notes must not exceed 500 characters.';
      }
      return null;

    default:
      return null;
  }
}

export function validateIntakeForm(
  values: IntakeFormValues,
  options?: IntakeValidationOptions
): IntakeFieldErrors {
  const errors: IntakeFieldErrors = {};

  for (const field of INTAKE_FIELD_NAMES) {
    const error = validateIntakeField(field, values[field] ?? '', options);
    if (error) {
      errors[field] = error;
    }
  }

  return errors;
}

export function firstIntakeErrorField(errors: IntakeFieldErrors): IntakeFieldName | null {
  for (const field of INTAKE_FIELD_NAMES) {
    if (errors[field]) return field;
  }
  return null;
}
