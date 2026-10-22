/**
 * Pure helper functions for intake year parsing and student number formatting.
 */

/**
 * Extract an academic calendar intake year from sessionYear string (e.g. "2026/2027" -> 2026).
 * Defaults to current calendar year if unparseable.
 */
export function extractIntakeYear(sessionYear: string): number {
  const match = sessionYear.trim().match(/^(\d{4})/);
  if (match) {
    const parsed = parseInt(match[1], 10);
    if (!isNaN(parsed) && parsed >= 2000 && parsed <= 2100) {
      return parsed;
    }
  }
  return new Date().getFullYear();
}

/**
 * Format candidate student number given year and sequential integer.
 * Standard format: SP-YYYY-NNNN (e.g. SP-2026-0001).
 */
export function formatStudentNumber(year: number, sequenceValue: number): string {
  const padded = String(sequenceValue).padStart(4, '0');
  return `SP-${year}-${padded}`;
}
