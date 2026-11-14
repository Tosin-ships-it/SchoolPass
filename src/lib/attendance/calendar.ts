import 'server-only';
import { prisma } from '@/lib/db';
import { logEvent } from '@/lib/logging';

export interface AcademicTermConfig {
  termId: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
}

export interface AcademicCalendarSetting {
  sessionYear: string;
  currentTermId: string | null;
  terms: AcademicTermConfig[];
  isConfigured?: boolean;
  isCurrentTermConfigured?: boolean;
  updatedAt?: string;
}

export interface CalendarValidationResult {
  valid: boolean;
  errors: string[];
  isFullyConfigured: boolean;
  isCurrentTermConfigured: boolean;
}

export const DEFAULT_ACADEMIC_SESSION = '2026/2027';
export const DEFAULT_CURRENT_TERM_ID = '2026/2027-T1';

/**
 * Returns the default initial academic calendar structure for SchoolPass.
 * Uses 2026/2027 First Term, with dates left unconfigured until official dates are provided.
 */
export function getDefaultAcademicCalendar(): AcademicCalendarSetting {
  return {
    sessionYear: DEFAULT_ACADEMIC_SESSION,
    currentTermId: DEFAULT_CURRENT_TERM_ID,
    terms: [
      {
        termId: '2026/2027-T1',
        name: 'First Term',
        startDate: null,
        endDate: null,
      },
      {
        termId: '2026/2027-T2',
        name: 'Second Term',
        startDate: null,
        endDate: null,
      },
      {
        termId: '2026/2027-T3',
        name: 'Third Term',
        startDate: null,
        endDate: null,
      },
    ],
    isConfigured: false,
    isCurrentTermConfigured: false,
  };
}

/**
 * Validate academic calendar structure and date constraints.
 */
export function validateAcademicCalendar(calendar: unknown): CalendarValidationResult {
  const errors: string[] = [];

  if (!calendar || typeof calendar !== 'object') {
    return { valid: false, errors: ['Calendar payload must be an object.'], isFullyConfigured: false };
  }

  const { sessionYear, currentTermId, terms } = calendar as Partial<AcademicCalendarSetting>;

  if (!sessionYear || typeof sessionYear !== 'string') {
    errors.push('Academic session year is required.');
  } else {
    const match = sessionYear.trim().match(/^(\d{4})\/(\d{4})$/);
    if (!match) {
      errors.push('Academic session year must follow the format YYYY/YYYY (e.g. 2026/2027).');
    } else {
      const startYear = parseInt(match[1], 10);
      const endYear = parseInt(match[2], 10);
      if (endYear !== startYear + 1) {
        errors.push('Academic session end year must be exactly one year after the start year.');
      }
    }
  }

  if (!Array.isArray(terms) || terms.length !== 3) {
    errors.push('The academic calendar must contain exactly three terms (First Term, Second Term, Third Term).');
    return { valid: false, errors, isFullyConfigured: false };
  }

  const expectedSuffixes = ['-T1', '-T2', '-T3'];
  let allDatesConfigured = true;
  const parsedTerms: { termId: string; name: string; start: Date | null; end: Date | null }[] = [];

  for (let i = 0; i < terms.length; i++) {
    const term = terms[i];
    if (!term || typeof term !== 'object') {
      errors.push(`Term definition at index ${i} is invalid.`);
      continue;
    }

    const expectedSuffix = expectedSuffixes[i];
    if (!term.termId || typeof term.termId !== 'string' || !term.termId.endsWith(expectedSuffix)) {
      errors.push(`Term ${i + 1} identifier must end with ${expectedSuffix}.`);
    }

    if (!term.name || typeof term.name !== 'string' || !term.name.trim()) {
      errors.push(`Term ${i + 1} must have a name.`);
    }

    let startDateObj: Date | null = null;
    let endDateObj: Date | null = null;

    if (term.startDate !== null && term.startDate !== undefined && String(term.startDate).trim() !== '') {
      const d = new Date(String(term.startDate).trim());
      if (Number.isNaN(d.getTime())) {
        errors.push(`Start date for ${term.name || term.termId} is not a valid date.`);
      } else {
        startDateObj = d;
      }
    } else {
      allDatesConfigured = false;
    }

    if (term.endDate !== null && term.endDate !== undefined && String(term.endDate).trim() !== '') {
      const d = new Date(String(term.endDate).trim());
      if (Number.isNaN(d.getTime())) {
        errors.push(`End date for ${term.name || term.termId} is not a valid date.`);
      } else {
        endDateObj = d;
      }
    } else {
      allDatesConfigured = false;
    }

    if (startDateObj && endDateObj) {
      if (startDateObj.getTime() >= endDateObj.getTime()) {
        errors.push(`Start date for ${term.name || term.termId} must be earlier than its end date.`);
      }
    }

    parsedTerms.push({
      termId: term.termId,
      name: term.name,
      start: startDateObj,
      end: endDateObj,
    });
  }

  // Check chronological order and non-overlapping terms across all dated terms
  for (let i = 0; i < parsedTerms.length; i++) {
    for (let j = i + 1; j < parsedTerms.length; j++) {
      const earlier = parsedTerms[i];
      const later = parsedTerms[j];

      if (earlier.end && later.start) {
        if (earlier.end.getTime() > later.start.getTime()) {
          errors.push(
            `${earlier.name} end date (${earlier.end.toISOString().slice(0, 10)}) overlaps with ${later.name} start date (${later.start.toISOString().slice(0, 10)}).`
          );
        }
      }

      if (earlier.start && later.start) {
        if (earlier.start.getTime() >= later.start.getTime()) {
          errors.push(
            `${earlier.name} start date must precede ${later.name} start date.`
          );
        }
      }
    }
  }

  // Current term presence check
  if (currentTermId) {
    const found = terms.some((t) => t && t.termId === currentTermId);
    if (!found) {
      errors.push(`The selected current term (${currentTermId}) is not present in the configured calendar.`);
    }
  }

  const currentTermParsed = parsedTerms.find((t) => t.termId === currentTermId);
  const isCurrentTermConfigured = Boolean(
    currentTermParsed &&
    currentTermParsed.start &&
    currentTermParsed.end &&
    currentTermParsed.start.getTime() < currentTermParsed.end.getTime()
  );

  return {
    valid: errors.length === 0,
    errors,
    isFullyConfigured: allDatesConfigured && errors.length === 0,
    isCurrentTermConfigured: isCurrentTermConfigured && errors.length === 0,
  };
}

/**
 * Determine the active term identifier.
 * Checks reference date against configured terms; falls back to explicit currentTermId.
 */
export function resolveActiveTermFromCalendar(
  calendar: AcademicCalendarSetting,
  referenceDate: Date = new Date()
): { termId: string | null; isDeterminedByDate: boolean; error?: string } {
  const validation = validateAcademicCalendar(calendar);
  if (!validation.valid) {
    return { termId: null, isDeterminedByDate: false, error: validation.errors[0] };
  }

  const refTime = referenceDate.getTime();
  const datedTerms = calendar.terms
    .filter((t) => t.startDate && !Number.isNaN(new Date(t.startDate).getTime()))
    .map((t) => ({
      termId: t.termId,
      startDate: new Date(t.startDate!),
      endDate: t.endDate ? new Date(t.endDate) : null,
    }))
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

  // 1. If currently inside a term's window:
  for (const term of datedTerms) {
    if (term.endDate) {
      if (refTime >= term.startDate.getTime() && refTime <= term.endDate.getTime()) {
        return { termId: term.termId, isDeterminedByDate: true };
      }
    }
  }

  // 2. If after a term's start date, return the latest started term:
  const started = datedTerms.filter((t) => t.startDate.getTime() <= refTime);
  if (started.length > 0) {
    return { termId: started[started.length - 1].termId, isDeterminedByDate: true };
  }

  // 3. Fall back to configured currentTermId
  if (calendar.currentTermId) {
    return { termId: calendar.currentTermId, isDeterminedByDate: false };
  }

  return { termId: null, isDeterminedByDate: false };
}

/**
 * Retrieve the academic calendar setting from the database.
 * If not yet configured, returns the default baseline calendar.
 */
export async function getAcademicCalendar(options?: {
  prismaClient?: any;
}): Promise<AcademicCalendarSetting> {
  const db = options?.prismaClient ?? prisma;
  const row = await db.schoolSetting.findUnique({
    where: { key: 'academic_terms' },
  });

  if (!row) {
    return getDefaultAcademicCalendar();
  }

  try {
    const parsed = JSON.parse(row.value);
    const validation = validateAcademicCalendar(parsed);
    if (validation.valid) {
      return {
        sessionYear: parsed.sessionYear || DEFAULT_ACADEMIC_SESSION,
        currentTermId: parsed.currentTermId || DEFAULT_CURRENT_TERM_ID,
        terms: parsed.terms.map((t: AcademicTermConfig) => ({
          termId: t.termId,
          name: t.name,
          startDate: t.startDate || null,
          endDate: t.endDate || null,
        })),
        isConfigured: validation.isFullyConfigured,
        isCurrentTermConfigured: validation.isCurrentTermConfigured,
        updatedAt: row.updatedAt?.toISOString ? row.updatedAt.toISOString() : new Date().toISOString(),
      };
    }
    return getDefaultAcademicCalendar();
  } catch {
    return getDefaultAcademicCalendar();
  }
}

/**
 * Save the academic calendar setting to the database.
 * Strictly requires admin validation.
 */
export async function saveAcademicCalendar(
  input: AcademicCalendarSetting,
  adminUserId: string,
  options?: { prismaClient?: any }
): Promise<{ success: boolean; errors?: string[] }> {
  const validation = validateAcademicCalendar(input);
  if (!validation.valid) {
    return { success: false, errors: validation.errors };
  }

  const payload: AcademicCalendarSetting = {
    sessionYear: input.sessionYear.trim(),
    currentTermId: input.currentTermId ? input.currentTermId.trim() : null,
    terms: input.terms.map((t) => ({
      termId: t.termId.trim(),
      name: t.name.trim(),
      startDate: t.startDate && String(t.startDate).trim() ? String(t.startDate).trim() : null,
      endDate: t.endDate && String(t.endDate).trim() ? String(t.endDate).trim() : null,
    })),
    isConfigured: validation.isFullyConfigured,
    isCurrentTermConfigured: validation.isCurrentTermConfigured,
  };

  const serialized = JSON.stringify(payload);
  const db = options?.prismaClient ?? prisma;

  await db.schoolSetting.upsert({
    where: { key: 'academic_terms' },
    create: {
      key: 'academic_terms',
      value: serialized,
    },
    update: {
      value: serialized,
    },
  });

  logEvent({
    level: 'info',
    event: 'admin_academic_calendar_updated',
    actorType: 'admin',
    actorId: adminUserId,
    entityType: 'school_setting',
    entityId: 'academic_terms',
    outcome: 'success',
    details: {
      sessionYear: payload.sessionYear,
      currentTermId: payload.currentTermId,
      isFullyConfigured: validation.isFullyConfigured,
      isCurrentTermConfigured: validation.isCurrentTermConfigured,
    },
  });

  return { success: true };
}
