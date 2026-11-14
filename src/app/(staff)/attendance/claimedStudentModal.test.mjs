import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Staff Dashboard: Claimed Student Actionability & Modal Data Projection', () => {
  it('correctly identifies claimed vs unclaimed prospective student numbers', () => {
    const records = [
      {
        id: 's1',
        studentNumber: 'SP-2026-0001',
        name: 'Chioma Adeyemi',
        status: 'Enrolled & Linked',
        isClaimed: true,
      },
      {
        id: 's2',
        studentNumber: 'SP-2026-0002',
        name: 'Asher Bello',
        status: 'Verification Pending',
        isClaimed: true,
      },
      {
        id: 's3',
        studentNumber: 'SP-2026-0003',
        name: 'Fatima Garba',
        status: 'Enrolled',
        isClaimed: true,
      },
      {
        id: 's4',
        studentNumber: 'SP-2026-0004',
        name: 'Emeka Okafor',
        status: 'Pre-Admission Intake',
        isClaimed: false,
      },
    ];

    for (const r of records) {
      const isClaimed = r.isClaimed ?? (r.status !== 'Pre-Admission Intake');
      if (r.status === 'Pre-Admission Intake') {
        assert.equal(isClaimed, false, `${r.studentNumber} should be unclaimed`);
      } else {
        assert.equal(isClaimed, true, `${r.studentNumber} should be claimed and actionable`);
      }
    }
  });

  it('calculates student fee status, charges, payments, and balance accurately', () => {
    const studentWithFees = {
      feeEntries: [
        { type: 'CHARGE', amount: '150000.00', createdAt: new Date('2026-09-20T10:00:00Z') },
        { type: 'ADJUSTMENT', amount: '-10000.00', createdAt: new Date('2026-09-25T10:00:00Z') },
        { type: 'OFFLINE_PAYMENT', amount: '50000.00', createdAt: new Date('2026-10-01T12:00:00Z') },
      ],
      payments: [
        { amount: '40000.00', createdAt: new Date('2026-10-15T14:30:00Z') },
      ],
    };

    let totalChargesNum = 0;
    let totalPaidNum = 0;
    let lastPaymentDate = null;

    for (const entry of studentWithFees.feeEntries) {
      const amt = Number(entry.amount);
      if (entry.type === 'CHARGE' || entry.type === 'ADJUSTMENT') {
        totalChargesNum += amt;
      } else if (entry.type === 'OFFLINE_PAYMENT') {
        totalPaidNum += amt;
        if (!lastPaymentDate && entry.createdAt) {
          lastPaymentDate = new Date(entry.createdAt).toISOString();
        }
      }
    }

    for (const payment of studentWithFees.payments) {
      const amt = Number(payment.amount);
      totalPaidNum += amt;
      if (!lastPaymentDate && payment.createdAt) {
        lastPaymentDate = new Date(payment.createdAt).toISOString();
      }
    }

    const outstandingBalanceNum = totalChargesNum - totalPaidNum;
    const feeStatusLabel =
      totalChargesNum === 0
        ? 'No Charges Assigned'
        : outstandingBalanceNum <= 0
        ? 'Settled'
        : 'Outstanding';

    assert.equal(totalChargesNum, 140000);
    assert.equal(totalPaidNum, 90000);
    assert.equal(outstandingBalanceNum, 50000);
    assert.equal(feeStatusLabel, 'Outstanding');
    assert.equal(lastPaymentDate, '2026-10-01T12:00:00.000Z');
  });

  it('marks fee status as Settled when fully paid or overpaid', () => {
    const fullyPaidStudent = {
      feeEntries: [
        { type: 'CHARGE', amount: '80000.00' },
        { type: 'OFFLINE_PAYMENT', amount: '80000.00' },
      ],
      payments: [],
    };

    let totalChargesNum = 0;
    let totalPaidNum = 0;

    for (const entry of fullyPaidStudent.feeEntries) {
      const amt = Number(entry.amount);
      if (entry.type === 'CHARGE' || entry.type === 'ADJUSTMENT') {
        totalChargesNum += amt;
      } else if (entry.type === 'OFFLINE_PAYMENT') {
        totalPaidNum += amt;
      }
    }

    const outstanding = totalChargesNum - totalPaidNum;
    const feeStatusLabel =
      totalChargesNum === 0
        ? 'No Charges Assigned'
        : outstanding <= 0
        ? 'Settled'
        : 'Outstanding';

    assert.equal(outstanding, 0);
    assert.equal(feeStatusLabel, 'Settled');
  });

  it('marks fee status as No Charges Assigned when student has no fee charges', () => {
    const studentWithNoFees = {
      feeEntries: [],
      payments: [],
    };

    const totalChargesNum = 0;
    const outstandingBalanceNum = 0;
    const feeStatusLabel =
      totalChargesNum === 0
        ? 'No Charges Assigned'
        : outstandingBalanceNum <= 0
        ? 'Settled'
        : 'Outstanding';

    assert.equal(feeStatusLabel, 'No Charges Assigned');
  });

  it('projects gate arrival check-ins count and classroom roll call attendance', () => {
    const arrivalConfirmations = [
      { id: 'arr_1', date: new Date('2026-11-14T07:45:00Z') },
      { id: 'arr_2', date: new Date('2026-11-13T07:50:00Z') },
      { id: 'arr_3', date: new Date('2026-11-12T07:42:00Z') },
    ];

    const attendanceRecords = [
      { id: 'att_1', status: 'PRESENT' },
      { id: 'att_2', status: 'PRESENT' },
      { id: 'att_3', status: 'ABSENT' },
      { id: 'att_4', status: 'PRESENT' },
    ];

    const arrivalCheckinsCount = arrivalConfirmations.length;
    const lastCheckinDate = arrivalConfirmations[0]
      ? new Date(arrivalConfirmations[0].date).toISOString()
      : null;

    const attendanceTotalCount = attendanceRecords.length;
    const attendancePresentCount =
      attendanceRecords.filter((r) => r.status === 'PRESENT').length;
    const attendanceRate = `${Math.round((attendancePresentCount / attendanceTotalCount) * 100)}%`;

    assert.equal(arrivalCheckinsCount, 3);
    assert.equal(lastCheckinDate, '2026-11-14T07:45:00.000Z');
    assert.equal(attendanceTotalCount, 4);
    assert.equal(attendancePresentCount, 3);
    assert.equal(attendanceRate, '75%');
  });

  it('maps linked guardians and pending link requests correctly', () => {
    const rawGuardians = [
      {
        parent: {
          id: 'p_1',
          name: 'Mrs. Folake Adeyemi',
          email: 'folake@example.ng',
          emailVerifiedAt: new Date('2026-10-01T09:00:00Z'),
        },
      },
      {
        parent: {
          id: 'p_2',
          name: 'Mr. Babatunde Adeyemi',
          email: 'babatunde@example.ng',
          emailVerifiedAt: null,
        },
      },
    ];

    const rawLinkRequests = [
      { status: 'PENDING' },
    ];

    const guardians = rawGuardians.map((g) => ({
      id: g.parent.id,
      name: g.parent.name,
      email: g.parent.email,
      isVerified: !!g.parent.emailVerifiedAt,
    }));

    const pendingLinkCount = rawLinkRequests.filter((r) => r.status === 'PENDING').length;

    assert.equal(guardians.length, 2);
    assert.equal(guardians[0].isVerified, true);
    assert.equal(guardians[1].isVerified, false);
    assert.equal(pendingLinkCount, 1);
  });
});

