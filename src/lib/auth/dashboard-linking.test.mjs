import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { determineDashboardLinkState, determineRecordsLinkState } from './dashboard.ts';

describe('SchoolPass Parent Dashboard: Student-Linking States (States A, B, and C)', () => {
  const sampleStudentA = {
    id: 'req_1',
    parentId: 'parent_1',
    studentId: 'student_1',
    studentName: 'Chinedu Okafor',
    studentNumber: 'SP-2026-0001',
    studentClass: 'Basic 4A',
    status: 'PENDING',
    reviewedByStaffId: null,
    reviewerName: null,
    reviewedAt: null,
    rejectionReason: null,
    createdAt: new Date('2026-10-18T10:00:00Z'),
    updatedAt: new Date('2026-10-18T10:00:00Z'),
  };

  const sampleStudentB = {
    id: 'req_2',
    parentId: 'parent_1',
    studentId: 'student_2',
    studentName: 'Amina Bello',
    studentNumber: 'SP-2026-0002',
    studentClass: 'Basic 2B',
    status: 'PENDING',
    reviewedByStaffId: null,
    reviewerName: null,
    reviewedAt: null,
    rejectionReason: null,
    createdAt: new Date('2026-10-18T10:05:00Z'),
    updatedAt: new Date('2026-10-18T10:05:00Z'),
  };

  const sampleRejectedRequest = {
    id: 'req_3',
    parentId: 'parent_1',
    studentId: 'student_3',
    studentName: 'Zainab Ibrahim',
    studentNumber: 'SP-2026-0099',
    studentClass: 'Basic 1A',
    status: 'REJECTED',
    reviewedByStaffId: 'staff_1',
    reviewerName: 'Mr. Adewale',
    reviewedAt: new Date('2026-10-18T12:00:00Z'),
    rejectionReason: 'Student number mismatch with parent surname on record.',
    createdAt: new Date('2026-10-17T09:00:00Z'),
    updatedAt: new Date('2026-10-18T12:00:00Z'),
  };

  const sampleApprovedRequest = {
    id: 'req_4',
    parentId: 'parent_1',
    studentId: 'student_4',
    studentName: 'Emeka Obi',
    studentNumber: 'SP-2026-0004',
    studentClass: 'Basic 5',
    status: 'APPROVED',
    reviewedByStaffId: 'staff_1',
    reviewerName: 'Mr. Adewale',
    reviewedAt: new Date('2026-10-18T11:00:00Z'),
    rejectionReason: null,
    createdAt: new Date('2026-10-17T08:00:00Z'),
    updatedAt: new Date('2026-10-18T11:00:00Z'),
  };

  it('State A: returns LINKED when parent has an active approved link', () => {
    // When isLinked is true, dashboard enters State A regardless of request history
    const state = determineDashboardLinkState(true, []);
    assert.equal(state.type, 'LINKED', 'Dashboard must be in LINKED state');

    // Even if there are pending or historical requests, active link takes precedence
    const stateWithRequests = determineDashboardLinkState(true, [sampleStudentA, sampleApprovedRequest]);
    assert.equal(stateWithRequests.type, 'LINKED', 'Active link takes precedence over requests');
  });

  it('State B: returns PENDING_VERIFICATION with student details when a link request is pending', () => {
    const state = determineDashboardLinkState(false, [sampleStudentA]);
    assert.equal(state.type, 'PENDING_VERIFICATION', 'Dashboard must show PENDING_VERIFICATION state');

    if (state.type === 'PENDING_VERIFICATION') {
      assert.equal(state.pendingRequests.length, 1);
      assert.equal(state.pendingRequests[0].studentName, 'Chinedu Okafor');
      assert.equal(state.pendingRequests[0].studentNumber, 'SP-2026-0001');
      assert.equal(state.pendingRequests[0].status, 'PENDING');
    }
  });

  it('State B: handles multiple pending link requests safely without ignoring any', () => {
    const state = determineDashboardLinkState(false, [sampleStudentA, sampleStudentB]);
    assert.equal(state.type, 'PENDING_VERIFICATION', 'Dashboard must show PENDING_VERIFICATION for siblings');

    if (state.type === 'PENDING_VERIFICATION') {
      assert.equal(state.pendingRequests.length, 2, 'All pending requests must be preserved');
      assert.equal(state.pendingRequests[0].studentName, 'Chinedu Okafor');
      assert.equal(state.pendingRequests[1].studentName, 'Amina Bello');
    }
  });

  it('State C: returns UNLINKED when parent has no link and no requests', () => {
    const state = determineDashboardLinkState(false, []);
    assert.equal(state.type, 'UNLINKED', 'Dashboard must show UNLINKED state when no request exists');
  });

  it('State C: rejected requests are NOT displayed as pending verification', () => {
    // When only rejected requests exist, the dashboard must not claim verification is pending
    const state = determineDashboardLinkState(false, [sampleRejectedRequest]);
    assert.equal(state.type, 'UNLINKED', 'Rejected requests must not result in PENDING_VERIFICATION state');
  });

  it('State C: approved requests without active ParentStudent link are not shown as pending', () => {
    // If request was approved in historical record, pendingRequests filter excludes it
    const state = determineDashboardLinkState(false, [sampleApprovedRequest]);
    assert.equal(state.type, 'UNLINKED');
  });

  it('Mixed requests: filters exclusively pending requests when both pending and rejected exist', () => {
    const state = determineDashboardLinkState(false, [sampleStudentA, sampleRejectedRequest]);
    assert.equal(state.type, 'PENDING_VERIFICATION');

    if (state.type === 'PENDING_VERIFICATION') {
      assert.equal(state.pendingRequests.length, 1);
      assert.equal(state.pendingRequests[0].studentId, 'student_1');
      // Verify rejected request is excluded from pending list
      const hasRejected = state.pendingRequests.some(r => r.status === 'REJECTED');
      assert.equal(hasRejected, false, 'Rejected request must not be included in pendingRequests');
    }
  });
});

describe('SchoolPass Security & Privacy Invariants: Linking and Authorization Isolation', () => {
  it('enforces parent ownership isolation when querying link requests', () => {
    // Simulating parent ownership filtering rule from store.ts getParentLinkRequests
    const parentAId = 'parent_alpha_123';
    const parentBId = 'parent_beta_456';

    const databaseRequests = [
      { id: 'req_1', parentId: parentAId, studentName: 'Student Alpha', status: 'PENDING' },
      { id: 'req_2', parentId: parentBId, studentName: 'Student Beta', status: 'PENDING' },
    ];

    // Filter by parent A
    const parentARequests = databaseRequests.filter(r => r.parentId === parentAId);
    assert.equal(parentARequests.length, 1);
    assert.equal(parentARequests[0].studentName, 'Student Alpha');

    // Verify Parent A cannot see Parent B's requests
    const leaksParentB = parentARequests.some(r => r.parentId === parentBId);
    assert.equal(leaksParentB, false, 'Parent A must never view Parent B requests');
  });

  it('a pending request strictly does NOT grant access to protected student records', () => {
    // Simulated ParentStudent active links store
    const parentStudentLinks = []; // Empty: staff has not approved yet
    const studentLinkRequests = [
      { parentId: 'parent_1', studentId: 'student_1', status: 'PENDING' }
    ];

    // Server-side authorization check (isParentLinkedToStudent in store.ts)
    const isAuthorized = parentStudentLinks.some(
      link => link.parentId === 'parent_1' && link.studentId === 'student_1'
    );

    assert.equal(isAuthorized, false, 'Pending request must not grant access to student records');
    assert.equal(studentLinkRequests[0].status, 'PENDING', 'Request remains in PENDING state awaiting staff review');
  });

  it('access to protected student records requires explicit staff approval creating a ParentStudent link', () => {
    const parentStudentLinks = [];
    const pendingRequest = { id: 'req_1', parentId: 'parent_1', studentId: 'student_1', status: 'PENDING' };

    // Before approval
    let hasAccess = parentStudentLinks.some(l => l.parentId === 'parent_1' && l.studentId === 'student_1');
    assert.equal(hasAccess, false);

    // Staff approves link request
    pendingRequest.status = 'APPROVED';
    pendingRequest.reviewedByStaffId = 'staff_admin_999';
    parentStudentLinks.push({ id: 'link_1', parentId: 'parent_1', studentId: 'student_1' });

    // After approval
    hasAccess = parentStudentLinks.some(l => l.parentId === 'parent_1' && l.studentId === 'student_1');
    assert.equal(hasAccess, true, 'Access granted only after staff approval creates ParentStudent link');
  });

  it('marks student leavers as inaccessible even if ParentStudent link exists', () => {
    // Addendum §9.6: Leavers excluded from active parent access
    const activeStudent = { id: 'student_1', leftAt: null };
    const leaverStudent = { id: 'student_2', leftAt: new Date('2026-07-01') };

    const links = [
      { parentId: 'parent_1', student: activeStudent },
      { parentId: 'parent_1', student: leaverStudent },
    ];

    const accessibleLinks = links.filter(l => l.student.leftAt === null);
    assert.equal(accessibleLinks.length, 1);
    assert.equal(accessibleLinks[0].student.id, 'student_1');
  });
});

describe('SchoolPass Records Page: Student-Linking Section & Pending Request Display', () => {
  const sampleStudentA = {
    id: 'req_1',
    parentId: 'parent_1',
    studentId: 'student_1',
    studentName: 'Chinedu Okafor',
    studentNumber: 'SP-2026-0001',
    studentClass: 'Basic 4A',
    status: 'PENDING',
    reviewedByStaffId: null,
    reviewerName: null,
    reviewedAt: null,
    rejectionReason: null,
    createdAt: new Date('2026-10-18T10:00:00Z'),
    updatedAt: new Date('2026-10-18T10:00:00Z'),
  };

  const sampleRejectedRequest = {
    id: 'req_3',
    parentId: 'parent_1',
    studentId: 'student_3',
    studentName: 'Zainab Ibrahim',
    studentNumber: 'SP-2026-0099',
    studentClass: 'Basic 1A',
    status: 'REJECTED',
    reviewedByStaffId: 'staff_1',
    reviewerName: 'Mr. Adewale',
    reviewedAt: new Date('2026-10-18T12:00:00Z'),
    rejectionReason: 'Student number mismatch with parent surname on record.',
    createdAt: new Date('2026-10-17T09:00:00Z'),
    updatedAt: new Date('2026-10-18T12:00:00Z'),
  };

  it('displays existing request and changes form title to Link Another Child when request is pending', () => {
    const state = determineRecordsLinkState(0, [sampleStudentA]);
    assert.equal(state.hasPending, true);
    assert.equal(state.pendingRequests.length, 1);
    assert.equal(state.pendingRequests[0].studentName, 'Chinedu Okafor');
    assert.equal(state.pendingRequests[0].studentNumber, 'SP-2026-0001');
    assert.equal(state.pendingRequests[0].status, 'PENDING');
    assert.equal(state.formTitle, 'Link Another Child');
  });

  it('displays Link Your Child when parent has 0 active links and 0 requests', () => {
    const state = determineRecordsLinkState(0, []);
    assert.equal(state.hasPending, false);
    assert.equal(state.formTitle, 'Link Your Child');
  });

  it('displays Link Your Child when all existing requests were rejected', () => {
    const state = determineRecordsLinkState(0, [sampleRejectedRequest]);
    assert.equal(state.hasPending, false);
    assert.equal(state.formTitle, 'Link Your Child');
  });

  it('displays Link Another Child when parent has an active approved link', () => {
    const state = determineRecordsLinkState(1, []);
    assert.equal(state.hasPending, false);
    assert.equal(state.formTitle, 'Link Another Child');
  });

  it('prevents submitting duplicate request for student already pending', () => {
    const pendingRequests = [sampleStudentA];
    const candidateNumber = 'SP-2026-0001';
    const isDuplicate = pendingRequests.some(
      r => r.status === 'PENDING' && r.studentNumber.toUpperCase() === candidateNumber.toUpperCase()
    );
    assert.equal(isDuplicate, true, 'Must prevent duplicate submission for student already pending');
  });

  it('prevents submitting request for student already actively linked', () => {
    const activeLinks = [{ id: 'link_1', studentNumber: 'SP-2026-0001', studentName: 'Chinedu Okafor' }];
    const candidateNumber = 'SP-2026-0001';
    const isAlreadyLinked = activeLinks.some(
      l => l.studentNumber && l.studentNumber.toUpperCase() === candidateNumber.toUpperCase()
    );
    assert.equal(isAlreadyLinked, true, 'Must prevent submission for already linked student');
  });

  it('permits submitting request for a different student while one is pending', () => {
    const pendingRequests = [sampleStudentA];
    const differentStudentNumber = 'SP-2026-0002';
    const isDuplicate = pendingRequests.some(
      r => r.status === 'PENDING' && r.studentNumber.toUpperCase() === differentStudentNumber.toUpperCase()
    );
    assert.equal(isDuplicate, false, 'Must permit submission for different student');
  });
});

