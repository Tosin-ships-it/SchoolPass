import test, { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_ACADEMIC_SESSION,
  DEFAULT_CURRENT_TERM_ID,
  getDefaultAcademicCalendar,
  validateAcademicCalendar,
  resolveActiveTermFromCalendar,
  getAcademicCalendar,
  saveAcademicCalendar,
} from './calendar.ts';
import {
  getAcademicCalendarAction,
  saveAcademicCalendarAction,
} from '../../app/(staff)/settings/actions.ts';
import { loadTermCalendarFromSettings } from '../payments/ledger.ts';
import { resolveCurrentTermId } from '../payments/offline.ts';
import { feeTemplateInputSchema, parseFeeTemplatesJson, serializeFeeTemplates } from '../payments/templates.ts';

function createMockPrisma(initialSetting = null) {
  let setting = initialSetting;
  let templates = [];
  const client = {
    __getSetting: () => setting,
    __getTemplates: () => templates,
    schoolSetting: {
      findUnique: async ({ where }) => {
        if (where.key === 'academic_terms' && setting) {
          return setting;
        }
        if (where.key === 'fee_templates') {
          return { id: 'templates_1', key: 'fee_templates', value: serializeFeeTemplates(templates), updatedAt: new Date() };
        }
        return null;
      },
      findFirst: async ({ where }) => {
        if (setting && where?.key?.in?.includes(setting.key)) {
          return setting;
        }
        return null;
      },
      findMany: async ({ where }) => {
        const results = [];
        if (setting && where?.key?.in?.includes(setting.key)) {
          results.push(setting);
        }
        return results;
      },
      upsert: async ({ where, create, update }) => {
        if (where.key === 'fee_templates') {
          const val = create?.value ?? update?.value;
          return { id: 'templates_1', key: 'fee_templates', value: val, updatedAt: new Date() };
        }
        setting = {
          id: 'setting_cuid_12345',
          key: where.key,
          value: create?.value ?? update?.value,
          updatedAt: new Date(),
        };
        return setting;
      },
    },
    $transaction: async (fn) => fn(client),
  };
  return client;
}

describe('SchoolPass Academic Calendar: Default Structure & Initialization', () => {
  it('returns default initial values for 2026/2027 First Term with unconfigured dates', () => {
    const calendar = getDefaultAcademicCalendar();
    assert.equal(calendar.sessionYear, '2026/2027');
    assert.equal(calendar.currentTermId, '2026/2027-T1');
    assert.equal(calendar.terms.length, 3);
    assert.equal(calendar.terms[0].termId, '2026/2027-T1');
    assert.equal(calendar.terms[0].name, 'First Term');
    assert.equal(calendar.terms[0].startDate, null);
    assert.equal(calendar.terms[0].endDate, null);
    assert.equal(calendar.terms[1].termId, '2026/2027-T2');
    assert.equal(calendar.terms[2].termId, '2026/2027-T3');
    assert.equal(calendar.isConfigured, false);
  });
});

describe('SchoolPass Academic Calendar: Validation Rules & Incomplete Dates', () => {
  it('accepts a valid unconfigured baseline calendar without inventing dates', () => {
    const calendar = getDefaultAcademicCalendar();
    const result = validateAcademicCalendar(calendar);
    assert.equal(result.valid, true);
    assert.equal(result.isFullyConfigured, false);
    assert.equal(result.isCurrentTermConfigured, false);
    assert.equal(result.errors.length, 0);
  });

  it('allows future term dates to remain blank when configuring the current term', () => {
    const calendar = {
      sessionYear: '2026/2027',
      currentTermId: '2026/2027-T1',
      terms: [
        {
          termId: '2026/2027-T1',
          name: 'First Term',
          startDate: '2026-09-07',
          endDate: '2026-12-18',
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
    };

    const result = validateAcademicCalendar(calendar);
    assert.equal(result.valid, true);
    assert.equal(result.isCurrentTermConfigured, true, 'Current term is configured with valid dates');
    assert.equal(result.isFullyConfigured, false, 'Future terms remain unconfigured');
    assert.equal(result.errors.length, 0);
  });

  it('accepts a valid fully-configured calendar with sequential dates', () => {
    const calendar = {
      sessionYear: '2026/2027',
      currentTermId: '2026/2027-T1',
      terms: [
        {
          termId: '2026/2027-T1',
          name: 'First Term',
          startDate: '2026-09-07',
          endDate: '2026-12-18',
        },
        {
          termId: '2026/2027-T2',
          name: 'Second Term',
          startDate: '2027-01-11',
          endDate: '2027-04-09',
        },
        {
          termId: '2026/2027-T3',
          name: 'Third Term',
          startDate: '2027-04-26',
          endDate: '2027-07-23',
        },
      ],
    };

    const result = validateAcademicCalendar(calendar);
    assert.equal(result.valid, true);
    assert.equal(result.isCurrentTermConfigured, true);
    assert.equal(result.isFullyConfigured, true);
    assert.equal(result.errors.length, 0);
  });

  it('rejects an invalid session year format', () => {
    const badFormats = ['2026', '2026-2027', '2026/2028', '2027/2026', 'session'];
    for (const bad of badFormats) {
      const res = validateAcademicCalendar({
        ...getDefaultAcademicCalendar(),
        sessionYear: bad,
      });
      assert.equal(res.valid, false);
      assert.match(res.errors[0], /Academic session/);
    }
  });

  it('rejects calendars that do not have exactly 3 terms', () => {
    const calendarTwoTerms = {
      ...getDefaultAcademicCalendar(),
      terms: [
        { termId: '2026/2027-T1', name: 'First Term', startDate: null, endDate: null },
        { termId: '2026/2027-T2', name: 'Second Term', startDate: null, endDate: null },
      ],
    };

    const res = validateAcademicCalendar(calendarTwoTerms);
    assert.equal(res.valid, false);
    assert.match(res.errors[0], /must contain exactly three terms/);
  });

  it('rejects invalid date strings', () => {
    const calendar = {
      sessionYear: '2026/2027',
      currentTermId: '2026/2027-T1',
      terms: [
        { termId: '2026/2027-T1', name: 'First Term', startDate: 'invalid-date', endDate: '2026-12-18' },
        { termId: '2026/2027-T2', name: 'Second Term', startDate: null, endDate: null },
        { termId: '2026/2027-T3', name: 'Third Term', startDate: null, endDate: null },
      ],
    };

    const res = validateAcademicCalendar(calendar);
    assert.equal(res.valid, false);
    assert.match(res.errors[0], /not a valid date/);
  });

  it('rejects term whose start date is later than or equal to its end date', () => {
    const calendar = {
      sessionYear: '2026/2027',
      currentTermId: '2026/2027-T1',
      terms: [
        { termId: '2026/2027-T1', name: 'First Term', startDate: '2026-12-18', endDate: '2026-09-07' },
        { termId: '2026/2027-T2', name: 'Second Term', startDate: null, endDate: null },
        { termId: '2026/2027-T3', name: 'Third Term', startDate: null, endDate: null },
      ],
    };

    const res = validateAcademicCalendar(calendar);
    assert.equal(res.valid, false);
    assert.match(res.errors[0], /must be earlier than its end date/);
  });

  it('rejects overlapping terms even when some intermediate terms are undated', () => {
    const calendar = {
      sessionYear: '2026/2027',
      currentTermId: '2026/2027-T1',
      terms: [
        { termId: '2026/2027-T1', name: 'First Term', startDate: '2026-09-07', endDate: '2027-05-01' },
        { termId: '2026/2027-T2', name: 'Second Term', startDate: null, endDate: null },
        { termId: '2026/2027-T3', name: 'Third Term', startDate: '2027-04-26', endDate: '2027-07-23' },
      ],
    };

    const res = validateAcademicCalendar(calendar);
    assert.equal(res.valid, false);
    assert.match(res.errors[0], /overlaps with/);
  });

  it('rejects current term that is not present in configured terms', () => {
    const calendar = {
      ...getDefaultAcademicCalendar(),
      currentTermId: '2026/2027-T4',
    };

    const res = validateAcademicCalendar(calendar);
    assert.equal(res.valid, false);
    assert.match(res.errors[0], /not present in the configured calendar/);
  });
});

describe('SchoolPass Academic Calendar: Active Term Resolution', () => {
  it('resolves active term by date when date falls inside term window', () => {
    const calendar = {
      sessionYear: '2026/2027',
      currentTermId: '2026/2027-T1',
      terms: [
        { termId: '2026/2027-T1', name: 'First Term', startDate: '2026-09-07', endDate: '2026-12-18' },
        { termId: '2026/2027-T2', name: 'Second Term', startDate: '2027-01-11', endDate: '2027-04-09' },
        { termId: '2026/2027-T3', name: 'Third Term', startDate: '2027-04-26', endDate: '2027-07-23' },
      ],
    };

    const res = resolveActiveTermFromCalendar(calendar, new Date('2027-02-15'));
    assert.equal(res.termId, '2026/2027-T2');
    assert.equal(res.isDeterminedByDate, true);
  });

  it('falls back to configured currentTermId when dates are unconfigured', () => {
    const calendar = getDefaultAcademicCalendar();
    const res = resolveActiveTermFromCalendar(calendar);
    assert.equal(res.termId, '2026/2027-T1');
    assert.equal(res.isDeterminedByDate, false);
  });
});

describe('SchoolPass Academic Calendar: Database Operations & Persistence', () => {
  it('returns default calendar when setting does not exist in database', async () => {
    const mockPrisma = createMockPrisma(null);
    const calendar = await getAcademicCalendar({ prismaClient: mockPrisma });
    assert.equal(calendar.sessionYear, '2026/2027');
    assert.equal(calendar.currentTermId, '2026/2027-T1');
    assert.equal(calendar.terms.length, 3);
    assert.equal(calendar.isConfigured, false);
    assert.equal(calendar.isCurrentTermConfigured, false);
  });

  it('saves and retrieves incomplete calendar without error', async () => {
    const mockPrisma = createMockPrisma(null);
    const incomplete = {
      sessionYear: '2026/2027',
      currentTermId: '2026/2027-T1',
      terms: [
        { termId: '2026/2027-T1', name: 'First Term', startDate: '2026-09-07', endDate: '2026-12-18' },
        { termId: '2026/2027-T2', name: 'Second Term', startDate: null, endDate: null },
        { termId: '2026/2027-T3', name: 'Third Term', startDate: null, endDate: null },
      ],
    };

    const saveResult = await saveAcademicCalendar(incomplete, 'cadmin_001', { prismaClient: mockPrisma });
    assert.equal(saveResult.success, true);

    const loaded = await getAcademicCalendar({ prismaClient: mockPrisma });
    assert.equal(loaded.sessionYear, '2026/2027');
    assert.equal(loaded.terms[0].startDate, '2026-09-07');
    assert.equal(loaded.terms[1].startDate, null);
    assert.equal(loaded.isCurrentTermConfigured, true);
    assert.equal(loaded.isConfigured, false);
  });
});

describe('SchoolPass Academic Calendar: Payment Ledger & Financial Protections', () => {
  it('blocks financial transactions by returning null from loadTermCalendarFromSettings when current term has no dates', async () => {
    const mockPrisma = createMockPrisma();
    await saveAcademicCalendar(getDefaultAcademicCalendar(), 'cadmin_001', { prismaClient: mockPrisma });

    const calendar = await loadTermCalendarFromSettings({ prismaClient: mockPrisma });
    assert.equal(calendar, null, 'Unconfigured current term must return null to block financial transactions');
  });

  it('enables financial transactions when only the selected current term has valid dates', async () => {
    const mockPrisma = createMockPrisma();
    const currentTermConfigured = {
      sessionYear: '2026/2027',
      currentTermId: '2026/2027-T1',
      terms: [
        { termId: '2026/2027-T1', name: 'First Term', startDate: '2026-09-07', endDate: '2026-12-18' },
        { termId: '2026/2027-T2', name: 'Second Term', startDate: null, endDate: null },
        { termId: '2026/2027-T3', name: 'Third Term', startDate: null, endDate: null },
      ],
    };

    await saveAcademicCalendar(currentTermConfigured, 'cadmin_001', { prismaClient: mockPrisma });

    const calendar = await loadTermCalendarFromSettings({ prismaClient: mockPrisma });
    assert.notEqual(calendar, null, 'Current term with valid dates enables financial ledger operations');
    assert.equal(calendar.terms.length, 1);
    assert.equal(calendar.currentTermId, '2026/2027-T1');

    const activeTermId = resolveCurrentTermId(calendar, new Date('2026-10-15'));
    assert.equal(activeTermId, '2026/2027-T1');
  });

  it('allows fee templates to be created and managed even when term dates are blank', async () => {
    // Fee template schema and records can be defined and validated for 2026/2027 and 2026/2027-T1
    // completely independently of whether academic calendar dates have been configured yet.
    const validation = feeTemplateInputSchema.safeParse({
      title: 'Tuition Fee - First Term',
      amount: '45000.00',
      targetClass: 'ALL',
      sessionYear: '2026/2027',
      termId: '2026/2027-T1',
      isCompulsory: true,
    });

    assert.equal(validation.success, true);
    assert.equal(validation.data.title, 'Tuition Fee - First Term');
    assert.equal(validation.data.termId, '2026/2027-T1');

    const sampleTemplate = {
      id: 'c1234567890abcdef12345678',
      ...validation.data,
    };

    const serialized = serializeFeeTemplates([sampleTemplate]);
    const parsed = parseFeeTemplatesJson(serialized);
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].title, 'Tuition Fee - First Term');
    assert.equal(parsed[0].termId, '2026/2027-T1');
  });
});
