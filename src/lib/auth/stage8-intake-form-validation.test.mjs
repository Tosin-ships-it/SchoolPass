import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { intendingStudentIntakeSchema } from './schemas.ts';
import { validateActionPayload } from './validation.ts';
import { classifyIntendingStudentError } from './store.ts';
import {
  firstIntakeErrorField,
  validateIntakeForm,
  validateIntakeField,
} from '../../app/(staff)/students/intakeValidation.ts';

const baseForm = {
  name: 'Chioma Okonjo',
  intendedClass: 'Primary 1',
  sessionYear: '2026/2027',
  guardianName: '',
  guardianPhone: '',
  guardianEmail: '',
  notes: '',
};

const form = (overrides = {}) => ({ ...baseForm, ...overrides });

describe('Stage 8: Intake form validation and feedback', () => {
  describe('Client validation parity with the server schema', () => {
    const validCases = [
      form(),
      form({
        guardianName: 'Dr. Emeka Okonjo',
        guardianPhone: '+234 802 123 4567',
        guardianEmail: 'emeka.okonjo@example.com',
        notes: 'Transfer from St. Jude Primary School.',
      }),
    ];

    for (const [index, values] of validCases.entries()) {
      it(`accepts valid intake form case ${index + 1} on both client and server`, () => {
        assert.deepEqual(validateIntakeForm(values), {});
        assert.equal(intendingStudentIntakeSchema.safeParse(values).success, true);
      });
    }

    const invalidCases = [
      { field: 'name', values: form({ name: '   ' }), message: /at least 2 characters/i },
      { field: 'name', values: form({ name: '12345' }), message: /must include letters/i },
      { field: 'intendedClass', values: form({ intendedClass: '' }), message: /required/i },
      {
        field: 'intendedClass',
        values: form({ intendedClass: '!!!' }),
        message: /letters or numbers/i,
      },
      {
        field: 'sessionYear',
        values: form({ sessionYear: '2026' }),
        message: /consecutive academic year/i,
      },
      {
        field: 'sessionYear',
        values: form({ sessionYear: '2026/2028' }),
        message: /consecutive academic year/i,
      },
      {
        field: 'guardianName',
        values: form({ guardianName: '12345' }),
        message: /must include letters/i,
      },
      {
        field: 'guardianPhone',
        values: form({ guardianPhone: '123' }),
        message: /valid guardian phone number/i,
      },
      {
        field: 'guardianPhone',
        values: form({ guardianPhone: 'call-me' }),
        message: /valid guardian phone number/i,
      },
      {
        field: 'guardianEmail',
        values: form({ guardianEmail: 'not-an-email' }),
        message: /valid guardian email address/i,
      },
      {
        field: 'notes',
        values: form({ notes: 'A'.repeat(501) }),
        message: /must not exceed 500 characters/i,
      },
    ];

    for (const { field, values, message } of invalidCases) {
      it(`rejects invalid ${field} on both client and server`, () => {
        const clientErrors = validateIntakeForm(values);
        assert.ok(clientErrors[field], `client should flag ${field}`);
        assert.match(clientErrors[field], message);

        const serverResult = intendingStudentIntakeSchema.safeParse(values);
        assert.equal(serverResult.success, false);
        if (!serverResult.success) {
          const issue = serverResult.error.issues.find(
            (candidate) => candidate.path[0] === field
          );
          assert.ok(issue, `server should flag ${field}`);
          assert.match(issue.message, message);
        }
      });
    }

    it('identifies the first invalid field in form order', () => {
      assert.equal(
        firstIntakeErrorField({
          notes: 'Notes error',
          sessionYear: 'Session error',
          name: 'Name error',
        }),
        'name'
      );
      assert.equal(firstIntakeErrorField({}), null);
    });

    it('validates individual fields for blur and change feedback', () => {
      assert.equal(validateIntakeField('name', 'Chioma Okonjo'), null);
      assert.match(validateIntakeField('name', 'C'), /at least 2 characters/i);
      assert.match(validateIntakeField('intendedClass', ''), /required/i);
      assert.equal(validateIntakeField('sessionYear', '2026/2027'), null);
      assert.match(validateIntakeField('sessionYear', '2026/2028'), /consecutive academic year/i);
      assert.equal(validateIntakeField('guardianEmail', ''), null);
      assert.match(validateIntakeField('guardianEmail', 'invalid-email'), /valid guardian email/i);
      assert.equal(validateIntakeField('guardianPhone', ''), null);
      assert.match(validateIntakeField('guardianPhone', 'bad-phone'), /valid guardian phone/i);
    });
  });

  describe('Server action validation feedback', () => {
    it('returns field-level errors for invalid intake payloads', () => {
      const result = validateActionPayload(
        { name: 'A', intendedClass: '', sessionYear: '2026/2027' },
        intendingStudentIntakeSchema
      );

      assert.equal(result.success, false);
      if (!result.success) {
        assert.equal(
          result.fieldErrors.name,
          'Student full name must be at least 2 characters.'
        );
        assert.equal(result.fieldErrors.intendedClass, 'Intended class is required.');
        assert.equal(result.error, result.fieldErrors.name);
      }
    });

    it('does not return field errors for a valid intake payload', () => {
      const result = validateActionPayload(baseForm, intendingStudentIntakeSchema);
      assert.equal(result.success, true);
    });
  });

  describe('Student number error classification', () => {
    it('classifies unique constraint failures as duplicate conflicts', () => {
      assert.equal(classifyIntendingStudentError({ code: 'P2002' }), 'duplicate');
    });

    it('classifies transient database failures as temporary', () => {
      assert.equal(classifyIntendingStudentError({ code: 'P2024' }), 'temporary');
      assert.equal(classifyIntendingStudentError({ code: 'P1001' }), 'temporary');
      assert.equal(
        classifyIntendingStudentError(
          new Error('Unable to allocate a unique student number after multiple attempts.')
        ),
        'temporary'
      );
    });

    it('classifies unknown failures as unexpected', () => {
      assert.equal(classifyIntendingStudentError(new Error('boom')), 'unexpected');
      assert.equal(classifyIntendingStudentError({ code: 'P9999' }), 'unexpected');
    });
  });

  describe('Accessible intake feedback wiring', () => {
    it('renders accessible success and failure modal semantics with focus handling', () => {
      const source = readFileSync(
        fileURLToPath(
          new URL(
            '../../app/(staff)/students/StudentsManager.tsx',
            import.meta.url
          )
        ),
        'utf8'
      );

      for (const token of [
        'role="dialog"',
        'aria-modal="true"',
        'aria-labelledby={titleId}',
        'data-modal-autofocus',
        'noValidate',
        'aria-invalid',
        'role="status"',
        'role="alert"',
        'Copy number',
        'Done',
        'Review fields',
        'Try again',
        'validateIntakeForm',
        "event.key !== 'Tab'",
        "event.key === 'Escape'",
        'id="intendedClass"',
        'id="sessionYear"',
        'No school classes are currently configured or available',
        'No academic sessions are currently configured',
      ]) {
        assert.ok(source.includes(token), `StudentsManager must include ${token}`);
      }
    });
  });

  describe('Comprehensive full name validation (Student and Guardian)', () => {
    it('rejects incomplete student names (HH, h j, T David, T. David)', () => {
      const invalidNames = ['HH', 'h j', 'T David', 'T. David', 'J. Cole', 'B Smith'];
      for (const name of invalidNames) {
        const clientError = validateIntakeField('name', name);
        assert.ok(clientError, `validateIntakeField should reject "${name}"`);

        const formErrors = validateIntakeForm(form({ name }));
        assert.ok(formErrors.name, `validateIntakeForm should reject "${name}"`);

        const serverResult = intendingStudentIntakeSchema.safeParse(form({ name }));
        assert.equal(serverResult.success, false, `server schema should reject "${name}"`);
      }
    });

    it('rejects numbers and unsupported symbols in student names', () => {
      const invalidNames = ['David 2', 'Adebayo #1', 'Chioma@School', '12345'];
      for (const name of invalidNames) {
        const clientError = validateIntakeField('name', name);
        assert.ok(clientError, `validateIntakeField should reject "${name}"`);

        const serverResult = intendingStudentIntakeSchema.safeParse(form({ name }));
        assert.equal(serverResult.success, false, `server schema should reject "${name}"`);
      }
    });

    it('accepts legitimate student names with hyphens, apostrophes, and accented letters', () => {
      const validNames = [
        'Adebayo Ibrahim',
        'Mary-Jane Watson',
        "Chidi O'Connor",
        'Zoë Élise',
        'Jean-Luc Picard',
      ];
      for (const name of validNames) {
        const clientError = validateIntakeField('name', name);
        assert.equal(clientError, null, `validateIntakeField should accept "${name}"`);

        const formErrors = validateIntakeForm(form({ name }));
        assert.equal(formErrors.name, undefined, `validateIntakeForm should accept "${name}"`);

        const serverResult = intendingStudentIntakeSchema.safeParse(form({ name }));
        assert.equal(serverResult.success, true, `server schema should accept "${name}"`);
      }
    });

    it('rejects incomplete guardian names when provided (HH, h j, T David)', () => {
      const invalidGuardianNames = ['HH', 'h j', 'T David', 'T. David', '12345'];
      for (const guardianName of invalidGuardianNames) {
        const clientError = validateIntakeField('guardianName', guardianName);
        assert.ok(clientError, `validateIntakeField should reject guardian "${guardianName}"`);

        const formErrors = validateIntakeForm(form({ guardianName }));
        assert.ok(formErrors.guardianName, `validateIntakeForm should reject guardian "${guardianName}"`);

        const serverResult = intendingStudentIntakeSchema.safeParse(form({ guardianName }));
        assert.equal(serverResult.success, false, `server schema should reject guardian "${guardianName}"`);
      }
    });

    it('accepts valid guardian names with titles, hyphens, and apostrophes, and allows empty string', () => {
      const validGuardianNames = [
        '',
        'Dr. Emeka Okonjo',
        'Mrs. Folashade Ibrahim',
        "Patrick O'Donnell",
        'Marie-Claire Dupont',
      ];
      for (const guardianName of validGuardianNames) {
        const clientError = validateIntakeField('guardianName', guardianName);
        assert.equal(clientError, null, `validateIntakeField should accept guardian "${guardianName}"`);

        const formErrors = validateIntakeForm(form({ guardianName }));
        assert.equal(formErrors.guardianName, undefined, `validateIntakeForm should accept guardian "${guardianName}"`);

        const serverResult = intendingStudentIntakeSchema.safeParse(form({ guardianName }));
        assert.equal(serverResult.success, true, `server schema should accept guardian "${guardianName}"`);
      }
    });
  });

  describe('Dynamic Class and Academic Session dropdown validation', () => {
    const availableClasses = ['Primary 1', 'Primary 2', 'JSS 1', 'SSS 1'];
    const availableSessions = ['2025/2026', '2026/2027'];

    it('accepts class when included in availableClasses', () => {
      const error = validateIntakeField('intendedClass', 'Primary 1', { availableClasses });
      assert.equal(error, null);

      const formErrors = validateIntakeForm(
        form({ intendedClass: 'Primary 1' }),
        { availableClasses, availableSessions }
      );
      assert.equal(formErrors.intendedClass, undefined);
    });

    it('rejects class when not present in availableClasses', () => {
      const error = validateIntakeField('intendedClass', 'NonExistent Class', { availableClasses });
      assert.match(error, /select a valid school class from the list/i);

      const formErrors = validateIntakeForm(
        form({ intendedClass: 'NonExistent Class' }),
        { availableClasses, availableSessions }
      );
      assert.match(formErrors.intendedClass, /select a valid school class from the list/i);
    });

    it('accepts session when included in availableSessions', () => {
      const error = validateIntakeField('sessionYear', '2026/2027', { availableSessions });
      assert.equal(error, null);

      const formErrors = validateIntakeForm(
        form({ sessionYear: '2026/2027' }),
        { availableClasses, availableSessions }
      );
      assert.equal(formErrors.sessionYear, undefined);
    });

    it('rejects session when not present in availableSessions', () => {
      const error = validateIntakeField('sessionYear', '2029/2030', { availableSessions });
      assert.match(error, /select a valid academic session from the list/i);

      const formErrors = validateIntakeForm(
        form({ sessionYear: '2029/2030' }),
        { availableClasses, availableSessions }
      );
      assert.match(formErrors.sessionYear, /select a valid academic session from the list/i);
    });
  });
});
