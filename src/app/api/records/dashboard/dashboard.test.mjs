import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import { handleGetParentDashboard } from './route.ts';

const FIXED_DATE = new Date('2026-10-15T10:00:00.000Z');

function createMockPrisma(options = {}) {
  const attendanceCounts = options.attendanceCounts || {};
  const payments = options.payments || [];
  const arrivals = options.arrivals || [];

  return {
    attendanceRecord: {
      count: async ({ where }) => {
        const studentId = where?.studentId;
        const isPresent = where?.status === 'PRESENT';
        const studentCounts = attendanceCounts[studentId] || { total: 0, present: 0 };
        return isPresent ? studentCounts.present : studentCounts.total;
      },
    },
    payment: {
      findMany: async () => payments,
    },
    arrivalConfirmation: {
      findMany: async () => arrivals,
    },
  };
}

describe('SchoolPass Parent Dashboard: Information Hierarchy & Student Access States', () => {
  const parentA = {
    sessionId: 'session_parent_1',
    userId: 'cparent_1',
    role: 'parent',
    user: { id: 'cparent_1', name: 'Zainab Mohammed', email: 'zainab@example.com' },
  };

  const staffUser = {
    sessionId: 'session_staff_1',
    userId: 'cstaff_1',
    role: 'staff',
    user: { id: 'cstaff_1', name: 'Teacher Adewale', email: 'adewale@school.ng' },
  };

  const child1 = {
    id: 'link_1',
    parentId: 'cparent_1',
    studentId: 'student_1',
    studentName: 'Ibrahim Mohammed',
    studentNumber: 'SP-2026-0005',
    className: 'Primary 1',
    createdAt: FIXED_DATE,
  };

  const child2 = {
    id: 'link_2',
    parentId: 'cparent_1',
    studentId: 'student_2',
    studentName: 'Fatima Mohammed',
    studentNumber: 'SP-2026-0006',
    className: 'Primary 3',
    createdAt: FIXED_DATE,
  };

  it('1. Parent with one linked child: displays compact overview card with verified figures', async () => {
    const mockPrisma = createMockPrisma({
      attendanceCounts: {
        student_1: { total: 20, present: 19 },
      },
    });

    const mockComputeBalance = async (studentId) => {
      assert.equal(studentId, 'student_1');
      return {
        totalCharges: new Prisma.Decimal('35000.00'),
        totalPaid: new Prisma.Decimal('20000.00'),
        totalOutstanding: new Prisma.Decimal('15000.00'),
        earlierTermsArrears: new Prisma.Decimal('0.00'),
      };
    };

    const res = await handleGetParentDashboard({
      session: parentA,
      prismaClient: mockPrisma,
      getLinksFn: async () => [child1],
      getRequestsFn: async () => [],
      computeBalanceFn: mockComputeBalance,
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.linkState.type, 'LINKED');
    assert.equal(data.children.length, 1);

    const child = data.children[0];
    assert.equal(child.studentName, 'Ibrahim Mohammed');
    assert.equal(child.studentNumber, 'SP-2026-0005');
    assert.equal(child.className, 'Primary 1');
    assert.equal(child.enrollmentStatus, 'Active');

    // Attendance summary
    assert.equal(child.attendance.hasRecords, true);
    assert.equal(child.attendance.totalDays, 20);
    assert.equal(child.attendance.presentDays, 19);
    assert.equal(child.attendance.percentage, 95);
    assert.equal(child.attendance.text, '19 of 20 days present (95%)');

    // Fee balance
    assert.equal(child.feeBalance.isConfigured, true);
    assert.equal(child.feeBalance.hasCharges, true);
    assert.equal(child.feeBalance.isCleared, false);
    assert.equal(child.feeBalance.totalOutstanding, '15000.00');
    assert.match(child.feeBalance.formattedAmount, /15,000\.00/);
  });

  it('2. Parent with multiple linked children: separate cards with distinct figures (not combined)', async () => {
    const mockPrisma = createMockPrisma({
      attendanceCounts: {
        student_1: { total: 20, present: 18 }, // 90%
        student_2: { total: 22, present: 22 }, // 100%
      },
    });

    const mockComputeBalance = async (studentId) => {
      if (studentId === 'student_1') {
        return {
          totalCharges: new Prisma.Decimal('50000.00'),
          totalPaid: new Prisma.Decimal('50000.00'),
          totalOutstanding: new Prisma.Decimal('0.00'),
          earlierTermsArrears: new Prisma.Decimal('0.00'),
        };
      }
      return {
        totalCharges: new Prisma.Decimal('45000.00'),
        totalPaid: new Prisma.Decimal('10000.00'),
        totalOutstanding: new Prisma.Decimal('35000.00'),
        earlierTermsArrears: new Prisma.Decimal('10000.00'),
      };
    };

    const res = await handleGetParentDashboard({
      session: parentA,
      prismaClient: mockPrisma,
      getLinksFn: async () => [child1, child2],
      getRequestsFn: async () => [],
      computeBalanceFn: mockComputeBalance,
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.children.length, 2);

    // First child: Ibrahim
    const c1 = data.children[0];
    assert.equal(c1.studentName, 'Ibrahim Mohammed');
    assert.equal(c1.attendance.percentage, 90);
    assert.equal(c1.feeBalance.isCleared, true);
    assert.equal(c1.feeBalance.totalOutstanding, '0.00');

    // Second child: Fatima
    const c2 = data.children[1];
    assert.equal(c2.studentName, 'Fatima Mohammed');
    assert.equal(c2.attendance.percentage, 100);
    assert.equal(c2.feeBalance.isCleared, false);
    assert.equal(c2.feeBalance.totalOutstanding, '35000.00');
    assert.equal(c2.feeBalance.note, 'Includes earlier term arrears');

    // Figures are strictly distinct and never combined
    assert.notEqual(c1.attendance.percentage, c2.attendance.percentage);
    assert.notEqual(c1.feeBalance.totalOutstanding, c2.feeBalance.totalOutstanding);
  });

  it('3. Parent with pending links: shows verification pending status without leaking records', async () => {
    const pendingRequest = {
      id: 'req_pending_1',
      parentId: 'cparent_1',
      studentId: 'student_3',
      studentName: 'Chinedu Okafor',
      studentNumber: 'SP-2026-0001',
      studentClass: 'Basic 4',
      status: 'PENDING',
      createdAt: FIXED_DATE,
      updatedAt: FIXED_DATE,
    };

    const res = await handleGetParentDashboard({
      session: parentA,
      prismaClient: createMockPrisma(),
      getLinksFn: async () => [], // No approved links yet
      getRequestsFn: async () => [pendingRequest],
      computeBalanceFn: async () => {
        throw new Error('Should not compute balance for unapproved student');
      },
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.linkState.type, 'PENDING_VERIFICATION');
    assert.equal(data.children.length, 0, 'No private child records exposed for pending link');
    assert.equal(data.pendingRequests.length, 1);
    assert.equal(data.pendingRequests[0].studentName, 'Chinedu Okafor');
    assert.equal(data.pendingRequests[0].studentNumber, 'SP-2026-0001');
    assert.equal(data.pendingRequests[0].status, 'PENDING');
  });

  it('4. Parent with no linked children: returns unlinked state without private records', async () => {
    const res = await handleGetParentDashboard({
      session: parentA,
      prismaClient: createMockPrisma(),
      getLinksFn: async () => [],
      getRequestsFn: async () => [],
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.linkState.type, 'UNLINKED');
    assert.equal(data.children.length, 0);
    assert.equal(data.pendingRequests.length, 0);
  });

  it('5. Security: blocks unauthenticated callers and staff accounts from parent dashboard API', async () => {
    // Unauthenticated caller
    const unauthRes = await handleGetParentDashboard({ session: null });
    assert.equal(unauthRes.status, 401);

    // Staff session
    const staffRes = await handleGetParentDashboard({ session: staffUser });
    assert.equal(staffRes.status, 401);
  });

  it('6. Incomplete academic calendar: displays honest pending setup notice instead of crash or fake 0', async () => {
    const mockPrisma = createMockPrisma();
    const mockFailingComputeBalance = async () => {
      // Simulating unconfigured or incomplete calendar throw
      throw new Error('The academic term calendar is not configured.');
    };

    const res = await handleGetParentDashboard({
      session: parentA,
      prismaClient: mockPrisma,
      getLinksFn: async () => [child1],
      getRequestsFn: async () => [],
      computeBalanceFn: mockFailingComputeBalance,
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    const child = data.children[0];
    assert.equal(child.feeBalance.isConfigured, false);
    assert.equal(child.feeBalance.formattedAmount, 'Pending');
    assert.match(child.feeBalance.text, /pending term configuration/i);
    assert.match(child.feeBalance.note, /School Settings/i);
  });

  it('7. Recent activity: includes real verified payments and arrivals, omits fake updates', async () => {
    const mockPrisma = createMockPrisma({
      payments: [
        {
          id: 'pay_1',
          amount: new Prisma.Decimal('25000.00'),
          internalReference: 'SP-PAY-20261015-ABC12345',
          createdAt: FIXED_DATE,
          student: { name: 'Ibrahim Mohammed' },
        },
      ],
      arrivals: [
        {
          id: 'arr_1',
          method: 'QR',
          createdAt: new Date('2026-10-15T07:45:00.000Z'),
          student: { name: 'Ibrahim Mohammed' },
        },
      ],
    });

    const res = await handleGetParentDashboard({
      session: parentA,
      prismaClient: mockPrisma,
      getLinksFn: async () => [child1],
      getRequestsFn: async () => [],
      computeBalanceFn: async () => ({
        totalCharges: new Prisma.Decimal('25000.00'),
        totalPaid: new Prisma.Decimal('25000.00'),
        totalOutstanding: new Prisma.Decimal('0.00'),
        earlierTermsArrears: new Prisma.Decimal('0.00'),
      }),
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.recentActivity.length, 2);
    assert.equal(data.recentActivity[0].type, 'PAYMENT');
    assert.match(data.recentActivity[0].description, /25,000\.00/);
    assert.equal(data.recentActivity[1].type, 'ARRIVAL');
    assert.match(data.recentActivity[1].description, /QR Code/);
  });
});

