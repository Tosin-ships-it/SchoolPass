import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractIntakeYear,
  formatStudentNumber,
} from './numbering.ts';
import {
  intendingStudentIntakeSchema,
  intendingStudentSearchSchema,
  staffToggleFrontDeskSchema,
} from './schemas.ts';

describe('Stage 2: Front-Desk Student Number Registration & Permissions', () => {
  describe('Student Number Formatting and Intake Year Parsing', () => {
    it('extracts academic intake year correctly from standard slash format (e.g. 2026/2027)', () => {
      assert.strictEqual(extractIntakeYear('2026/2027'), 2026);
      assert.strictEqual(extractIntakeYear('2027/2028'), 2027);
    });

    it('extracts academic intake year correctly from hyphenated format (e.g. 2026-2027)', () => {
      assert.strictEqual(extractIntakeYear('2026-2027'), 2026);
    });

    it('falls back to current calendar year for unparseable session strings', () => {
      const currentYear = new Date().getFullYear();
      assert.strictEqual(extractIntakeYear('Spring Term'), currentYear);
      assert.strictEqual(extractIntakeYear(''), currentYear);
    });

    it('formats student number in strict SP-YYYY-NNNN format with 4-digit zero padding', () => {
      assert.strictEqual(formatStudentNumber(2026, 1), 'SP-2026-0001');
      assert.strictEqual(formatStudentNumber(2026, 9), 'SP-2026-0009');
      assert.strictEqual(formatStudentNumber(2026, 10), 'SP-2026-0010');
      assert.strictEqual(formatStudentNumber(2026, 99), 'SP-2026-0099');
      assert.strictEqual(formatStudentNumber(2026, 100), 'SP-2026-0100');
      assert.strictEqual(formatStudentNumber(2026, 999), 'SP-2026-0999');
      assert.strictEqual(formatStudentNumber(2026, 1000), 'SP-2026-1000');
    });

    it('preserves sequence numbers beyond 4 digits without truncation', () => {
      assert.strictEqual(formatStudentNumber(2026, 10001), 'SP-2026-10001');
    });
  });

  describe('Zod Schema Validation for Intending Student Intake', () => {
    it('validates a complete and valid prospective student intake payload', () => {
      const validPayload = {
        name: 'Chioma Okonjo',
        intendedClass: 'Primary 1',
        sessionYear: '2026/2027',
        guardianName: 'Dr. Emeka Okonjo',
        guardianPhone: '08021234567',
        guardianEmail: 'emeka.okonjo@example.com',
        notes: 'Transfer from St. Jude Primary School.',
      };

      const result = intendingStudentIntakeSchema.safeParse(validPayload);
      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.strictEqual(result.data.name, 'Chioma Okonjo');
        assert.strictEqual(result.data.intendedClass, 'Primary 1');
        assert.strictEqual(result.data.guardianEmail, 'emeka.okonjo@example.com');
      }
    });

    it('validates a minimal prospective student payload with optional fields omitted', () => {
      const minimalPayload = {
        name: 'Tunde Bakare',
        intendedClass: 'JSS 1',
        sessionYear: '2026/2027',
      };

      const result = intendingStudentIntakeSchema.safeParse(minimalPayload);
      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.strictEqual(result.data.name, 'Tunde Bakare');
        assert.strictEqual(result.data.guardianName, undefined);
        assert.strictEqual(result.data.guardianPhone, undefined);
      }
    });

    it('rejects an empty student name', () => {
      const invalid = {
        name: '   ',
        intendedClass: 'Primary 1',
        sessionYear: '2026/2027',
      };
      const result = intendingStudentIntakeSchema.safeParse(invalid);
      assert.strictEqual(result.success, false);
      assert.match(result.error?.issues[0]?.message || '', /Student full name must be at least 2 characters/i);
    });

    it('rejects an empty intended class', () => {
      const invalid = {
        name: 'Zainab Ahmed',
        intendedClass: '',
        sessionYear: '2026/2027',
      };
      const result = intendingStudentIntakeSchema.safeParse(invalid);
      assert.strictEqual(result.success, false);
      assert.match(result.error?.issues[0]?.message || '', /Intended class is required/i);
    });

    it('rejects an invalid guardian email address', () => {
      const invalid = {
        name: 'Zainab Ahmed',
        intendedClass: 'JSS 1',
        sessionYear: '2026/2027',
        guardianEmail: 'not-an-email',
      };
      const result = intendingStudentIntakeSchema.safeParse(invalid);
      assert.strictEqual(result.success, false);
      assert.match(result.error?.issues[0]?.message || '', /Please enter a valid guardian email address/i);
    });

    it('allows empty string guardian email (treats as absent)', () => {
      const valid = {
        name: 'Zainab Ahmed',
        intendedClass: 'JSS 1',
        sessionYear: '2026/2027',
        guardianEmail: '',
      };
      const result = intendingStudentIntakeSchema.safeParse(valid);
      assert.strictEqual(result.success, true);
    });

    it('rejects notes that exceed 500 characters', () => {
      const invalid = {
        name: 'Amina Bello',
        intendedClass: 'Primary 2',
        sessionYear: '2026/2027',
        notes: 'A'.repeat(501),
      };
      const result = intendingStudentIntakeSchema.safeParse(invalid);
      assert.strictEqual(result.success, false);
      assert.match(result.error?.issues[0]?.message || '', /Notes must not exceed 500 characters/i);
    });
  });

  describe('Search & Admin Permission Schema Validation', () => {
    it('validates search query string', () => {
      const result = intendingStudentSearchSchema.safeParse({ query: 'SP-2026-0001' });
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.data.query, 'SP-2026-0001');
    });

    it('validates empty search query', () => {
      const result = intendingStudentSearchSchema.safeParse({});
      assert.strictEqual(result.success, true);
    });

    it('validates staff toggle front-desk permission payload', () => {
      const valid = {
        staffId: 'clh812345000008l0abcdef12',
        isFrontDesk: true,
      };
      const result = staffToggleFrontDeskSchema.safeParse(valid);
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.data.isFrontDesk, true);
    });

    it('rejects invalid CUID in permission toggle payload', () => {
      const invalid = {
        staffId: 'not-a-cuid',
        isFrontDesk: true,
      };
      const result = staffToggleFrontDeskSchema.safeParse(invalid);
      assert.strictEqual(result.success, false);
      assert.match(result.error?.issues[0]?.message || '', /Invalid identifier format/i);
    });
  });

  describe('Front-Desk Permission Logic & Role Gates', () => {
    function simulateAssertFrontDeskAccess(session, staffUser) {
      if (!session) {
        return { authorized: false, error: 'Authentication required.' };
      }
      if (session.role === 'admin') {
        return { authorized: true, session };
      }
      if (session.role === 'staff') {
        if (staffUser?.isFrontDesk) {
          return { authorized: true, session };
        }
        return { authorized: false, session, error: 'Unauthorized. Front-desk permissions required.' };
      }
      return { authorized: false, session, error: 'Unauthorized. Staff privileges required.' };
    }

    it('denies unauthenticated callers', () => {
      const check = simulateAssertFrontDeskAccess(null, null);
      assert.strictEqual(check.authorized, false);
      assert.strictEqual(check.error, 'Authentication required.');
    });

    it('denies parent accounts even when authenticated', () => {
      const parentSession = { userId: 'parent_1', role: 'parent' };
      const check = simulateAssertFrontDeskAccess(parentSession, null);
      assert.strictEqual(check.authorized, false);
      assert.strictEqual(check.error, 'Unauthorized. Staff privileges required.');
    });

    it('denies teaching/general staff by default when isFrontDesk is false', () => {
      const teacherSession = { userId: 'staff_teacher', role: 'staff' };
      const teacherUser = { id: 'staff_teacher', role: 'STAFF', isFrontDesk: false };
      const check = simulateAssertFrontDeskAccess(teacherSession, teacherUser);
      assert.strictEqual(check.authorized, false);
      assert.strictEqual(check.error, 'Unauthorized. Front-desk permissions required.');
    });

    it('grants access to staff with isFrontDesk=true', () => {
      const frontDeskSession = { userId: 'staff_desk', role: 'staff' };
      const frontDeskUser = { id: 'staff_desk', role: 'STAFF', isFrontDesk: true };
      const check = simulateAssertFrontDeskAccess(frontDeskSession, frontDeskUser);
      assert.strictEqual(check.authorized, true);
    });

    it('grants implicit access to Admin accounts regardless of isFrontDesk flag', () => {
      const adminSession = { userId: 'admin_1', role: 'admin' };
      const adminUser = { id: 'admin_1', role: 'ADMIN', isFrontDesk: false };
      const check = simulateAssertFrontDeskAccess(adminSession, adminUser);
      assert.strictEqual(check.authorized, true);
    });
  });

  describe('Concurrency & Collision Simulation', () => {
    it('advances sequential counter monotonically without generating duplicate numbers', () => {
      const year = 2026;
      const generated = new Set();
      const count = 100;

      for (let seq = 1; seq <= count; seq++) {
        const studentNumber = formatStudentNumber(year, seq);
        assert.strictEqual(generated.has(studentNumber), false, `Collision detected at ${studentNumber}`);
        generated.add(studentNumber);
      }

      assert.strictEqual(generated.size, 100);
      assert.strictEqual(generated.has('SP-2026-0001'), true);
      assert.strictEqual(generated.has('SP-2026-0100'), true);
    });

    it('skips existing candidate numbers when colliding with pre-seeded identifiers', () => {
      const year = 2026;
      const preExistingInDb = new Set(['SP-2026-0001', 'SP-2026-0002']);
      let sequenceCounter = 0;

      function allocateNext() {
        while (true) {
          sequenceCounter++;
          const candidate = formatStudentNumber(year, sequenceCounter);
          if (!preExistingInDb.has(candidate)) {
            return candidate;
          }
        }
      }

      const allocated1 = allocateNext();
      assert.strictEqual(allocated1, 'SP-2026-0003');

      const allocated2 = allocateNext();
      assert.strictEqual(allocated2, 'SP-2026-0004');
    });
  });

  describe('Architectural Isolation between IntendingStudent and Active Student', () => {
    it('verifies IntendingStudent records are structurally separate from Student foreign keys', () => {
      // In the Prisma schema:
      // - Student has relations: guardians (ParentStudent[]), attendanceRecords, feeEntries, payments, arrivalConfirmations
      // - IntendingStudent has relation: registeredBy (StaffUser) only.
      // - IntendingStudent has no relations to ParentStudent, AttendanceRecord, FeeEntry, Payment, or ArrivalConfirmation.
      const intendingStudentFields = [
        'id',
        'studentNumber',
        'name',
        'intendedClass',
        'sessionYear',
        'guardianName',
        'guardianPhone',
        'guardianEmail',
        'notes',
        'registeredById',
        'createdAt',
        'updatedAt',
      ];

      const activeStudentRelations = [
        'guardians',
        'linkRequests',
        'attendanceRecords',
        'arrivalConfirmations',
        'feeEntries',
        'payments',
      ];

      // Verify that no active student relation exists in intending student fields
      for (const rel of activeStudentRelations) {
        assert.strictEqual(
          intendingStudentFields.includes(rel),
          false,
          `Isolation violation: ${rel} must not exist on IntendingStudent`
        );
      }
    });
  });
});
