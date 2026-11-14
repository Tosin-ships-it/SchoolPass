import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Prisma, PaymentStatus } from '@prisma/client';
import { getPortalData } from './api/portal.ts';
import { getReceiptData } from './api/receipt.ts';

const FIXED_DATE = new Date('2026-10-15T10:00:00.000Z');

function createMockBalance() {
  return {
    totalOutstanding: new Prisma.Decimal('45000.00'),
    amountDue: new Prisma.Decimal('45000.00'),
    earlierTermsArrears: new Prisma.Decimal('15000.00'),
    currentTermBalance: new Prisma.Decimal('30000.00'),
    creditBalance: new Prisma.Decimal('0.00'),
    currentTermId: '2026/2027-T1',
    termBreakdown: [
      {
        termId: '2025/2026-T3',
        termName: 'Third Term (Past)',
        charges: new Prisma.Decimal('15000.00'),
        grossCharges: new Prisma.Decimal('15000.00'),
        adjustments: new Prisma.Decimal('0.00'),
        paid: new Prisma.Decimal('0.00'),
        outstanding: new Prisma.Decimal('15000.00'),
        isCurrentTerm: false,
      },
      {
        termId: '2026/2027-T1',
        termName: 'First Term (Current)',
        charges: new Prisma.Decimal('30000.00'),
        grossCharges: new Prisma.Decimal('30000.00'),
        adjustments: new Prisma.Decimal('0.00'),
        paid: new Prisma.Decimal('0.00'),
        outstanding: new Prisma.Decimal('30000.00'),
        isCurrentTerm: true,
      },
    ],
  };
}

describe('SchoolPass Phase 5: Parent Portal data API & access boundaries', () => {
  const parentSession = {
    sessionId: 'session_parent_100',
    userId: 'cparent_100',
    role: 'parent',
    user: { id: 'cparent_100', name: 'Zainab Mohammed', email: 'zainab@example.com' },
  };

  const staffSession = {
    sessionId: 'session_staff_100',
    userId: 'cstaff_100',
    role: 'staff',
    user: { id: 'cstaff_100', name: 'Staff User', email: 'staff@example.com' },
  };

  const mockLinkedStudents = [
    {
      id: 'link_1',
      parentId: 'cparent_100',
      studentId: 'cstudent_child1',
      studentName: 'Ibrahim Mohammed',
      studentNumber: 'SP-2026-0005',
      className: 'Primary 1',
      createdAt: FIXED_DATE,
    },
    {
      id: 'link_2',
      parentId: 'cparent_100',
      studentId: 'cstudent_child2',
      studentName: 'Mariam Mohammed',
      studentNumber: 'SP-2026-0006',
      className: 'Primary 3',
      createdAt: FIXED_DATE,
    },
  ];

  function createMockPrisma() {
    return {
      feeEntry: {
        findMany: async ({ where }) => [
          {
            id: 'fee_entry_01',
            studentId: where.studentId,
            termId: '2026/2027-T1',
            type: 'CHARGE',
            amount: new Prisma.Decimal('30000.00'),
            note: 'First Term Tuition',
            createdAt: FIXED_DATE,
          },
        ],
      },
      payment: {
        findMany: async ({ where }) => [
          {
            id: 'pay_rec_01',
            studentId: where.studentId,
            amount: new Prisma.Decimal('10000.00'),
            internalReference: 'SP-PAY-20261015-AAAA1111',
            flutterwaveReference: 'FLW-123456',
            status: PaymentStatus.SUCCESSFUL,
            createdAt: FIXED_DATE,
            verifiedAt: FIXED_DATE,
            refunds: [],
          },
        ],
      },
    };
  }

  it('rejects unauthenticated requests with HTTP 401', async () => {
    const req = new Request('https://schoolpass.local/api/payments/portal');
    const res = await getPortalData(req, { session: null });

    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.code, 'UNAUTHORIZED');
  });

  it('rejects non-parent accounts (staff/admin) with HTTP 401', async () => {
    const req = new Request('https://schoolpass.local/api/payments/portal');
    const res = await getPortalData(req, { session: staffSession });

    assert.equal(res.status, 401);
  });

  it('handles parents with zero linked students gracefully', async () => {
    const req = new Request('https://schoolpass.local/api/payments/portal');
    const res = await getPortalData(req, {
      session: parentSession,
      getLinksFn: async () => [],
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.deepEqual(body.linkedStudents, []);
    assert.equal(body.selectedStudent, null);
    assert.equal(body.balance, null);
  });

  it('defaults to first active linked student when no studentId is specified', async () => {
    const req = new Request('https://schoolpass.local/api/payments/portal');
    const prisma = createMockPrisma();

    const res = await getPortalData(req, {
      session: parentSession,
      getLinksFn: async () => mockLinkedStudents,
      checkAuthFn: async () => true,
      computeBalanceFn: async () => createMockBalance(),
      prismaClient: prisma,
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.selectedStudent.studentId, 'cstudent_child1');
    assert.equal(body.selectedStudent.studentName, 'Ibrahim Mohammed');
    assert.equal(body.balance.amountDue, '45000.00');
    assert.equal(body.balance.earlierTermsArrears, '15000.00');
    assert.equal(body.charges.length, 1);
    assert.equal(body.payments.length, 1);
  });

  it('switches to requested linked student when valid studentId is provided', async () => {
    const req = new Request('https://schoolpass.local/api/payments/portal?studentId=cstudent_child2');
    const prisma = createMockPrisma();

    const res = await getPortalData(req, {
      session: parentSession,
      getLinksFn: async () => mockLinkedStudents,
      checkAuthFn: async (parentId, studentId) => studentId === 'cstudent_child2',
      computeBalanceFn: async () => createMockBalance(),
      prismaClient: prisma,
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.selectedStudent.studentId, 'cstudent_child2');
    assert.equal(body.selectedStudent.studentName, 'Mariam Mohammed');
  });

  it('blocks access with HTTP 403 when parent requests a student they are not linked to', async () => {
    const req = new Request('https://schoolpass.local/api/payments/portal?studentId=cstudent_unauthorized');

    const res = await getPortalData(req, {
      session: parentSession,
      getLinksFn: async () => mockLinkedStudents,
      checkAuthFn: async () => false, // Authorization check fails
    });

    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.code, 'FORBIDDEN');
  });

  it('gracefully handles unconfigured term calendar by returning fallback balance rather than crashing', async () => {
    const req = new Request('https://schoolpass.local/api/payments/portal');
    const prisma = createMockPrisma();

    const res = await getPortalData(req, {
      session: parentSession,
      getLinksFn: async () => mockLinkedStudents,
      checkAuthFn: async () => true,
      computeBalanceFn: async () => {
        const err = new Error('The academic term calendar is not configured.');
        err.name = 'LedgerConfigurationError';
        throw err;
      },
      prismaClient: prisma,
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.balance.amountDue, '0.00');
    assert.equal(body.balance.totalOutstanding, '0.00');
    assert.match(body.balance.configurationNotice, /calendar is not configured/i);
    assert.equal(body.charges.length, 1);
    assert.equal(body.payments.length, 1);
  });
});

describe('SchoolPass Phase 5: Digital Payment Receipt generation & isolation', () => {
  const parentSession = {
    sessionId: 'session_parent_200',
    userId: 'cparent_200',
    role: 'parent',
    user: { id: 'cparent_200', name: 'Kabir Musa', email: 'kabir@example.com' },
  };

  const samplePayment = {
    id: 'pay_sample_01',
    internalReference: 'SP-PAY-20261015-KABIR001',
    flutterwaveReference: 'FLW-998877',
    amount: new Prisma.Decimal('25000.00'),
    status: PaymentStatus.SUCCESSFUL,
    studentId: 'cstudent_musa',
    parentId: 'cparent_200',
    createdAt: FIXED_DATE,
    verifiedAt: FIXED_DATE,
    student: {
      id: 'cstudent_musa',
      name: 'Yusuf Musa',
      studentNumber: 'SP-2026-0088',
      className: 'Primary 2',
    },
    parent: {
      id: 'cparent_200',
      name: 'Kabir Musa',
      email: 'kabir@example.com',
    },
  };

  function createMockReceiptPrisma(foundPayment = samplePayment) {
    return {
      payment: {
        findUnique: async ({ where }) => {
          if (foundPayment && where.internalReference === foundPayment.internalReference) {
            return foundPayment;
          }
          return null;
        },
      },
      schoolSetting: {
        findUnique: async ({ where }) => {
          if (where.key === 'school_name') {
            return { value: 'Apex Model Academy' };
          }
          return null;
        },
      },
    };
  }

  it('returns HTTP 401 when unauthenticated user requests receipt', async () => {
    const res = await getReceiptData('SP-PAY-20261015-KABIR001', { session: null });
    assert.equal(res.status, 401);
  });

  it('returns HTTP 404 when receipt reference does not exist in database', async () => {
    const prisma = createMockReceiptPrisma(null);
    const res = await getReceiptData('SP-PAY-NONEXISTENT', {
      session: parentSession,
      prismaClient: prisma,
    });

    assert.equal(res.status, 404);
  });

  it('blocks parent from viewing receipt of an unlinked student (RULES_AUTH)', async () => {
    const prisma = createMockReceiptPrisma();
    const res = await getReceiptData('SP-PAY-20261015-KABIR001', {
      session: parentSession,
      prismaClient: prisma,
      checkAuthFn: async () => false, // Parent not linked to Yusuf Musa
    });

    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.code, 'FORBIDDEN');
  });

  it('generates complete official receipt data for authorized linked parent', async () => {
    const prisma = createMockReceiptPrisma();
    const res = await getReceiptData('SP-PAY-20261015-KABIR001', {
      session: parentSession,
      prismaClient: prisma,
      checkAuthFn: async () => true, // Authorized
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.receipt.reference, 'SP-PAY-20261015-KABIR001');
    assert.equal(body.receipt.amount, '25000.00');
    assert.equal(body.receipt.status, PaymentStatus.SUCCESSFUL);
    assert.equal(body.receipt.student.name, 'Yusuf Musa');
    assert.equal(body.receipt.student.studentNumber, 'SP-2026-0088');
    assert.equal(body.receipt.parent.name, 'Kabir Musa');
    assert.equal(body.receipt.schoolName, 'Apex Model Academy');
  });
});

