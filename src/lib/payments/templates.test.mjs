import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import {
  FeeTemplateError,
  FeeTemplateStorageError,
  bulkTemplateAssignmentSchema,
  buildIndividualChargeNote,
  buildTemplateChargeNote,
  buildTemplateMarker,
  canonicalizeTargetClass,
  doesStudentClassMatchTarget,
  feeTemplateInputSchema,
  findDuplicateFeeTemplate,
  getSessionYearFromTermId,
  individualChargeSchema,
  normalizeFeeAmount,
  parseFeeTemplatesJson,
  serializeFeeTemplates,
  planTemplateAssignment,
} from './templates.ts';

function template(overrides = {}) {
  return {
    id: 'c1234567890abcdef',
    title: 'Tuition - First Term',
    amount: '45000.00',
    targetClass: 'Primary 1',
    sessionYear: '2026/2027',
    termId: '2026/2027-T1',
    isCompulsory: true,
    ...overrides,
  };
}

function student(id, className, overrides = {}) {
  return {
    id,
    studentNumber: `SP-${id}`,
    name: `Student ${id}`,
    className,
    leftAt: null,
    ...overrides,
  };
}

describe('SchoolPass Phase 2: fee template validation and storage', () => {
  it('normalizes valid fee amounts to two decimal places', () => {
    assert.equal(normalizeFeeAmount('45000'), '45000.00');
    assert.equal(normalizeFeeAmount('0.5'), '0.50');
    assert.equal(normalizeFeeAmount('001.25'), '1.25');
    assert.equal(normalizeFeeAmount('9999999999.99'), '9999999999.99');
  });

  it('accepts a valid template and enforces session and term consistency', () => {
    const valid = feeTemplateInputSchema.safeParse({
      title: 'Tuition - First Term',
      amount: '45000',
      targetClass: 'all',
      sessionYear: '2026/2027',
      termId: '2026/2027-T1',
      isCompulsory: true,
    });

    assert.equal(valid.success, true);
    assert.equal(valid.data.amount, '45000.00');
    assert.equal(valid.data.targetClass, 'ALL');

    const mismatched = feeTemplateInputSchema.safeParse({
      title: 'Tuition - First Term',
      amount: '45000',
      targetClass: 'Primary 1',
      sessionYear: '2026/2027',
      termId: '2027/2028-T1',
      isCompulsory: true,
    });

    assert.equal(mismatched.success, false);
    assert.ok(
      mismatched.error.issues.some((issue) => issue.path.join('.') === 'termId')
    );
  });

  it('rejects zero amounts, excessive decimals, invalid sessions, and malformed terms', () => {
    const base = {
      title: 'Tuition',
      targetClass: 'Primary 1',
      sessionYear: '2026/2027',
      termId: '2026/2027-T1',
      isCompulsory: true,
    };

    assert.equal(feeTemplateInputSchema.safeParse({ ...base, amount: '0' }).success, false);
    assert.equal(feeTemplateInputSchema.safeParse({ ...base, amount: '100.999' }).success, false);
    assert.equal(
      feeTemplateInputSchema.safeParse({
        ...base,
        amount: '100',
        sessionYear: '2026/2028',
      }).success,
      false
    );
    assert.equal(
      feeTemplateInputSchema.safeParse({
        ...base,
        amount: '100',
        termId: '2026/2027-T4',
      }).success,
      false
    );
  });

  it('round-trips template records and rejects damaged stored JSON', () => {
    const records = [template()];
    const serialized = serializeFeeTemplates(records);

    assert.deepEqual(parseFeeTemplatesJson(serialized), records);
    assert.deepEqual(parseFeeTemplatesJson(null), []);
    assert.throws(() => parseFeeTemplatesJson('{bad json'), FeeTemplateStorageError);
    assert.throws(() => parseFeeTemplatesJson('{}'), FeeTemplateStorageError);
    assert.throws(
      () => parseFeeTemplatesJson(JSON.stringify([{ title: 'Missing fields' }])),
      FeeTemplateStorageError
    );
  });

  it('canonicalizes classes and rejects classes that are not configured', () => {
    assert.deepEqual(canonicalizeTargetClass('all', ['Primary 1']), { targetClass: 'ALL' });
    assert.deepEqual(canonicalizeTargetClass('primary 1', ['Primary 1']), {
      targetClass: 'Primary 1',
    });
    assert.deepEqual(canonicalizeTargetClass('JSS 1', ['JSS 1A', 'JSS 1B']), {
      targetClass: 'JSS 1',
    });
    assert.equal(
      canonicalizeTargetClass('Primary 2', ['Primary 1']).error,
      'Class "Primary 2" is not configured for this school.'
    );
    assert.deepEqual(canonicalizeTargetClass('New Class', []), { targetClass: 'New Class' });
  });

  it('matches student class arms against level-tier fee targets', () => {
    // ALL matches everything
    assert.equal(doesStudentClassMatchTarget('JSS 1A', 'ALL'), true);
    assert.equal(doesStudentClassMatchTarget('Primary 3', 'all'), true);

    // Exact matches
    assert.equal(doesStudentClassMatchTarget('JSS 1', 'JSS 1'), true);
    assert.equal(doesStudentClassMatchTarget('creche', 'Creche'), true);
    assert.equal(doesStudentClassMatchTarget('Nursery 1', 'nursery 1'), true);

    // Level-tier to arm/stream matches
    assert.equal(doesStudentClassMatchTarget('JSS 1A', 'JSS 1'), true);
    assert.equal(doesStudentClassMatchTarget('JSS 1B', 'JSS 1'), true);
    assert.equal(doesStudentClassMatchTarget('JSS 1 - Gold', 'JSS 1'), true);
    assert.equal(doesStudentClassMatchTarget('JSS 1 (Alpha)', 'JSS 1'), true);
    assert.equal(doesStudentClassMatchTarget('Primary 1A', 'Primary 1'), true);
    assert.equal(doesStudentClassMatchTarget('Primary 1 - Silver', 'Primary 1'), true);
    assert.equal(doesStudentClassMatchTarget('Creche A', 'Creche'), true);
    assert.equal(doesStudentClassMatchTarget('Nursery 2B', 'Nursery 2'), true);

    // Non-matches across levels or different tiers
    assert.equal(doesStudentClassMatchTarget('JSS 2A', 'JSS 1'), false);
    assert.equal(doesStudentClassMatchTarget('JSS 10', 'JSS 1'), false);
    assert.equal(doesStudentClassMatchTarget('Primary 2', 'Primary 1'), false);
    assert.equal(doesStudentClassMatchTarget('Primary 10', 'Primary 1'), false);
    assert.equal(doesStudentClassMatchTarget('Nursery 2', 'Nursery 1'), false);
  });

  it('finds duplicate templates case-insensitively and ignores the edited record', () => {
    const existing = template();
    const duplicate = findDuplicateFeeTemplate([existing], {
      title: 'tuition - first term',
      amount: '45000.00',
      targetClass: 'primary 1',
      termId: '2026/2027-T1',
    });

    assert.equal(duplicate?.id, existing.id);
    assert.equal(
      findDuplicateFeeTemplate(
        [existing],
        {
          title: 'tuition - first term',
          amount: '45000.00',
          targetClass: 'primary 1',
          termId: '2026/2027-T1',
        },
        existing.id
      ),
      undefined
    );
  });
});

describe('SchoolPass Phase 2: assignment planning and deduplication', () => {
  it('builds a stable template marker and a separate individual charge note', () => {
    const record = template();
    const marker = buildTemplateMarker(record.id);

    assert.equal(marker, `(template:${record.id})`);
    assert.equal(buildTemplateChargeNote(record), `Tuition - First Term ${marker}`);
    assert.equal(
      buildTemplateChargeNote(template({ title: 'Renamed fee' })),
      `Renamed fee ${marker}`
    );
    assert.equal(buildIndividualChargeNote('Uniform levy', 'Size L'), 'Uniform levy - Size L');
    assert.equal(buildIndividualChargeNote('Uniform levy'), 'Uniform levy');
  });

  it('plans one charge per active student in the class and skips existing template charges', () => {
    const record = template();
    const students = [
      student('cstudent1', 'Primary 1'),
      student('cstudent2', 'primary 1'),
      student('cstudent3', 'Primary 2'),
      student('cstudent4', 'Primary 1', { leftAt: new Date('2026-01-01T00:00:00.000Z') }),
    ];
    const existing = [
      {
        studentId: 'cstudent2',
        termId: '2026/2027-T1',
        type: 'CHARGE',
        note: buildTemplateChargeNote(record),
      },
    ];

    const plan = planTemplateAssignment(record, students, existing, 'Primary 1');

    assert.deepEqual(
      plan.eligibleStudents.map((item) => item.id),
      ['cstudent1']
    );
    assert.deepEqual(
      plan.skippedStudents.map((item) => item.id),
      ['cstudent2']
    );
  });

  it('supports all-student templates without crossing terms', () => {
    const record = template({ targetClass: 'ALL' });
    const students = [student('cstudent1', 'Primary 1'), student('cstudent2', 'Primary 2')];
    const existing = [
      {
        studentId: 'cstudent1',
        termId: '2026/2027-T2',
        type: 'CHARGE',
        note: buildTemplateChargeNote(record),
      },
    ];

    const plan = planTemplateAssignment(record, students, existing, 'ALL');

    assert.deepEqual(
      plan.eligibleStudents.map((item) => item.id),
      ['cstudent1', 'cstudent2']
    );
  });

  it('allows applying a template to a different configured class', () => {
    const record = template();
    const students = [student('cstudent1', 'Primary 1'), student('cstudent2', 'Primary 2')];

    const plan = planTemplateAssignment(record, students, [], 'Primary 2');

    assert.deepEqual(
      plan.eligibleStudents.map((item) => item.id),
      ['cstudent2']
    );
  });

  it('assigns level-tier template to all students in that level across arms/streams', () => {
    const record = template({ targetClass: 'JSS 1' });
    const students = [
      student('s1', 'JSS 1A'),
      student('s2', 'JSS 1B'),
      student('s3', 'JSS 1 - Gold'),
      student('s4', 'JSS 2A'),
    ];

    const plan = planTemplateAssignment(record, students, [], 'JSS 1');

    assert.deepEqual(
      plan.eligibleStudents.map((item) => item.id),
      ['s1', 's2', 's3']
    );
    assert.deepEqual(plan.skippedStudents, []);
  });

  it('extracts the session year from a validated term identifier', () => {
    assert.equal(getSessionYearFromTermId('2026/2027-T1'), '2026/2027');
    assert.equal(getSessionYearFromTermId('bad-term'), null);
  });
});

describe('SchoolPass Phase 2: schemas', () => {
  it('validates bulk assignment and individual charge inputs', () => {
    assert.equal(
      bulkTemplateAssignmentSchema.safeParse({
        templateId: 'c1234567890abcdef',
        targetClass: 'Primary 1',
      }).success,
      true
    );

    assert.equal(
      individualChargeSchema.safeParse({
        studentId: 'c1234567890abcdef',
        title: 'Uniform levy',
        amount: '5000',
        termId: '2026/2027-T1',
        note: 'Size L',
      }).success,
      true
    );

    const invalid = individualChargeSchema.safeParse({
      studentId: 'not-a-cuid',
      title: 'X',
      amount: '0',
      termId: '2026/2027-T9',
      note: 'x'.repeat(501),
    });
    assert.equal(invalid.success, false);
  });
});

const authMockSource = `
let state = { authorized: false, error: 'Authentication required.' };
export function __setAuth(next) { state = next; }
export async function assertAdminSession() { return state; }
export async function getConfiguredClasses() { throw new Error('DB_ACCESS_NOT_ALLOWED'); }
export async function getConfiguredSessions() { throw new Error('DB_ACCESS_NOT_ALLOWED'); }
`;

const loaderSource = `
export async function resolve(specifier, context, nextResolve) {
  if (specifier === '@/lib/auth') {
    return {
      url: 'data:text/javascript,' + encodeURIComponent(${JSON.stringify(authMockSource)}),
      shortCircuit: true,
    };
  }
  if (specifier === '@/lib/logging') {
    return {
      url: 'data:text/javascript,export%20function%20logEvent()%20%7B%7D',
      shortCircuit: true,
    };
  }
  return nextResolve(specifier, context);
}
`;

register('data:text/javascript,' + encodeURIComponent(loaderSource), import.meta.url);

const authMock = await import('@/lib/auth');
const feeActions = await import('@/app/(staff)/payments/actions');

const validCreatePayload = {
  title: 'Tuition - First Term',
  amount: '45000',
  targetClass: 'Primary 1',
  sessionYear: '2026/2027',
  termId: '2026/2027-T1',
  isCompulsory: true,
};

const actionCalls = [
  ['create', () => feeActions.createFeeTemplateAction(validCreatePayload)],
  [
    'update',
    () =>
      feeActions.updateFeeTemplateAction({
        id: 'c1234567890abcdef',
        ...validCreatePayload,
      }),
  ],
  ['delete', () => feeActions.deleteFeeTemplateAction('c1234567890abcdef')],
  [
    'preview',
    () =>
      feeActions.previewTemplateAssignmentAction(
        'c1234567890abcdef',
        'Primary 1'
      ),
  ],
  [
    'bulk',
    () =>
      feeActions.applyFeeTemplateBulkAction(
        'c1234567890abcdef',
        'Primary 1'
      ),
  ],
  [
    'individual',
    () =>
      feeActions.createIndividualChargeAction('c1234567890abcdef', {
        title: 'Uniform levy',
        amount: '5000',
        termId: '2026/2027-T1',
      }),
  ],
];

describe('SchoolPass Phase 2: admin-only server actions', () => {
  it('rejects unauthenticated callers before validation or data access', async () => {
    authMock.__setAuth({ authorized: false, error: 'Authentication required.' });

    for (const [name, call] of actionCalls) {
      const result = await call();
      assert.equal(result.success, false, name);
      assert.equal(result.errorCode, 'session_expired', name);
      assert.match(result.error, /session has expired/i, name);
    }
  });

  it('rejects authenticated staff who are not admins before data access', async () => {
    authMock.__setAuth({
      authorized: false,
      session: { role: 'staff', userId: 'cstaffuser123456789' },
      error: 'Unauthorized. Admin privileges required.',
    });

    for (const [name, call] of actionCalls) {
      const result = await call();
      assert.equal(result.success, false, name);
      assert.equal(result.errorCode, 'unauthorized', name);
      assert.match(result.error, /admin privileges/i, name);
    }
  });

  it('validates payloads after admin authentication without touching data loaders', async () => {
    authMock.__setAuth({
      authorized: true,
      session: { role: 'admin', userId: 'cadminuser123456789' },
    });

    const invalidCreate = await feeActions.createFeeTemplateAction({});
    const invalidUpdate = await feeActions.updateFeeTemplateAction({});
    const invalidDelete = await feeActions.deleteFeeTemplateAction('bad-id');
    const invalidPreview = await feeActions.previewTemplateAssignmentAction('bad-id', '');
    const invalidBulk = await feeActions.applyFeeTemplateBulkAction('bad-id', '');
    const invalidIndividual = await feeActions.createIndividualChargeAction('bad-id', {});

    for (const result of [
      invalidCreate,
      invalidUpdate,
      invalidDelete,
      invalidPreview,
      invalidBulk,
      invalidIndividual,
    ]) {
      assert.equal(result.success, false);
      assert.equal(result.errorCode, 'validation');
    }
  });

  it('maps domain conflicts without exposing internal data', () => {
    const error = new FeeTemplateError(
      'conflict',
      'A matching fee template already exists for this class and term.'
    );
    assert.equal(error.code, 'conflict');
    assert.equal(error.name, 'FeeTemplateError');
  });
});
