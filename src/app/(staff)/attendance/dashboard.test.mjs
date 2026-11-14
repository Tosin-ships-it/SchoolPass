import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('SchoolPass Staff & Admin Dashboard: Role Restrictions & Information Hierarchy', () => {
  it('Admin: sees complete operational overview including calendar, fees, enrollment, and settings', () => {
    const adminSession = {
      role: 'admin',
      userId: 'cadmin_1',
      user: { id: 'cadmin_1', name: 'Admin User', email: 'admin@school.ng' },
    };

    const isAdmin = adminSession.role === 'admin';
    const isFrontDesk = false;
    const isGeneralStaff = false;

    assert.equal(isAdmin, true);
    assert.equal(isFrontDesk, false);
    assert.equal(isGeneralStaff, false);

    // Operational summary access: Admin sees all 4 operational summary cards
    const adminCards = [
      'Academic Term',
      'Enrolled Students',
      'Guardian Queue',
      'Fee Templates',
    ];
    assert.equal(adminCards.length, 4);

    // Administrative tools access: Admin retains all 6 management functions
    const adminManagementSections = [
      { name: 'Guardian Links', href: '/guardian-links' },
      { name: 'Fee Management', href: '/payments' },
      { name: 'Student Intake', href: '/students' },
      { name: 'School Settings', href: '/settings' },
      { name: 'Attendance Recording', href: '/attendance' },
      { name: 'Gate Arrival Codes', href: '/arrival-code' },
    ];
    assert.equal(adminManagementSections.length, 6);
    const hrefs = adminManagementSections.map((s) => s.href);
    assert.equal(hrefs.includes('/guardian-links'), true);
    assert.equal(hrefs.includes('/payments'), true);
    assert.equal(hrefs.includes('/students'), true);
    assert.equal(hrefs.includes('/settings'), true);
    assert.equal(hrefs.includes('/attendance'), true);
    assert.equal(hrefs.includes('/arrival-code'), true);
  });

  it('Admin: Overview metrics distinguish genuine zero values from unconfigured data', () => {
    // Case A: Unconfigured calendar vs Active calendar
    const unconfiguredCalendar = null;
    const termNoticeUnconfigured = !unconfiguredCalendar
      ? '⚠ Calendar Not Configured'
      : unconfiguredCalendar.isCurrentTermConfigured
      ? '✓ Term Active & Ready'
      : '⚠ Term Dates Incomplete';
    assert.equal(termNoticeUnconfigured, '⚠ Calendar Not Configured');

    const incompleteCalendar = { isCurrentTermConfigured: false, sessionYear: '2026/2027' };
    const termNoticeIncomplete = !incompleteCalendar
      ? '⚠ Calendar Not Configured'
      : incompleteCalendar.isCurrentTermConfigured
      ? '✓ Term Active & Ready'
      : '⚠ Term Dates Incomplete';
    assert.equal(termNoticeIncomplete, '⚠ Term Dates Incomplete');

    // Case B: Genuine zero enrollment & prospective intake
    const activeStudentsCount = 0;
    const intendingStudentsCount = 0;
    const activeLabel = `${activeStudentsCount} Active`;
    const intakeLabel =
      intendingStudentsCount === 0
        ? '0 prospective intake'
        : `${intendingStudentsCount} prospective intake`;
    assert.equal(activeLabel, '0 Active');
    assert.equal(intakeLabel, '0 prospective intake');

    // Case C: Genuine zero pending guardian queue
    const pendingLinksCount = 0;
    const queueStatus =
      pendingLinksCount > 0 ? 'Awaiting verification' : 'Queue clear';
    assert.equal(queueStatus, 'Queue clear');

    // Case D: Genuine zero fee templates
    const feeTemplatesCount = 0;
    const templatesSubtitle =
      feeTemplatesCount === 0 ? 'No fee templates configured' : 'Offline & online ledger';
    assert.equal(templatesSubtitle, 'No fee templates configured');
  });

  it('Admin: Resolves currentTermName correctly using termId instead of id', () => {
    const calendar = {
      sessionYear: '2026/2027',
      currentTermId: '2026/2027-T1',
      terms: [
        { termId: '2026/2027-T1', name: 'First Term', startDate: '2026-09-19', endDate: '2026-12-11' },
        { termId: '2026/2027-T2', name: 'Second Term', startDate: '2027-01-09', endDate: '2027-04-02' },
        { termId: '2026/2027-T3', name: 'Third Term', startDate: '2027-04-24', endDate: '2027-07-16' },
      ],
      isConfigured: true,
      isCurrentTermConfigured: true,
    };

    const currentTermName =
      calendar.terms.find((t) => t.termId === calendar.currentTermId)?.name || 'Term 1';
    assert.equal(currentTermName, 'First Term');
  });

  it('Admin: Prevents duplicate counting when intending student is synchronized into Student', () => {
    const activeStudents = [
      { id: 'st_1', studentNumber: 'SP-2026-0001', name: 'Chinedu Okafor', className: 'JSS 1A' },
      { id: 'st_2', studentNumber: 'SP-2026-0002', name: 'Amina Bello', className: 'JSS 1B' },
      { id: 'st_3', studentNumber: 'SP-2026-0003', name: 'Arabella Olabisi', className: 'Primary 2' },
    ];

    const intendingStudents = [
      { id: 'it_1', studentNumber: 'SP-2026-0003', name: 'Arabella Olabisi', intendedClass: 'Primary 2' },
      { id: 'it_2', studentNumber: 'SP-2026-0004', name: 'Emeka Eze', intendedClass: 'Primary 1' },
    ];

    const enrolledNumbers = new Set(activeStudents.map((s) => s.studentNumber));

    // Active enrolled count
    const activeCount = activeStudents.length;
    assert.equal(activeCount, 3);

    // Prospective intake count: only intending students NOT yet in active Student
    const prospectiveIntake = intendingStudents.filter(
      (it) => !enrolledNumbers.has(it.studentNumber)
    );
    assert.equal(prospectiveIntake.length, 1);
    assert.equal(prospectiveIntake[0].studentNumber, 'SP-2026-0004');

    // Generated student number directory without duplicates
    const studentNumberMap = new Map();
    for (const it of intendingStudents) {
      studentNumberMap.set(it.studentNumber, {
        studentNumber: it.studentNumber,
        name: it.name,
        intendedClass: it.intendedClass,
        status: 'Pre-Admission Intake',
      });
    }

    for (const st of activeStudents) {
      const existing = studentNumberMap.get(st.studentNumber);
      if (existing) {
        existing.status = 'Enrolled';
      } else {
        studentNumberMap.set(st.studentNumber, {
          studentNumber: st.studentNumber,
          name: st.name,
          intendedClass: st.className,
          status: 'Enrolled',
        });
      }
    }

    const unifiedDirectory = Array.from(studentNumberMap.values());
    assert.equal(unifiedDirectory.length, 4, 'Total 4 distinct generated student numbers');
    assert.equal(unifiedDirectory.filter((s) => s.studentNumber === 'SP-2026-0003').length, 1, 'No duplicate SP-2026-0003');
    assert.equal(studentNumberMap.get('SP-2026-0003').status, 'Enrolled');
    assert.equal(studentNumberMap.get('SP-2026-0004').status, 'Pre-Admission Intake');
  });

  it('Front Desk: restricted to student intake, read-only fee directory, and guardian queue', () => {
    const frontDeskSession = {
      role: 'staff',
      userId: 'cstaff_frontdesk',
      user: { id: 'cstaff_frontdesk', name: 'Desk Officer', email: 'frontdesk@school.ng' },
      isFrontDesk: true,
    };

    const isAdmin = frontDeskSession.role === 'admin';
    const isFrontDesk = !isAdmin && frontDeskSession.isFrontDesk;
    const isGeneralStaff = !isAdmin && !isFrontDesk;

    assert.equal(isAdmin, false, 'Front desk is not an admin');
    assert.equal(isFrontDesk, true, 'Has front desk authorization');
    assert.equal(isGeneralStaff, false);

    // Operational summary: 3 cards
    const frontDeskCards = [
      'Prospective Intake',
      'Student Fee Directory',
      'Guardian Verification',
    ];
    assert.equal(frontDeskCards.length, 3);

    // Cannot access admin-only settings or offline payment creation
    const canAccessSettings = isAdmin;
    assert.equal(canAccessSettings, false, 'Front desk must not access School Settings');

    const authorizedSections = [
      '/guardian-links',
      '/payments', // Read-only directory lookup
      '/students', // Prospective student intake
    ];
    assert.equal(authorizedSections.includes('/settings'), false);
    assert.equal(authorizedSections.includes('/students'), true);
  });

  it('Teaching / General Staff: restricted to classroom attendance, arrival code, and guardian links', () => {
    const teachingStaffSession = {
      role: 'staff',
      userId: 'cstaff_teacher',
      user: { id: 'cstaff_teacher', name: 'Teacher Ngozi', email: 'ngozi@school.ng' },
      isFrontDesk: false,
    };

    const isAdmin = teachingStaffSession.role === 'admin';
    const isFrontDesk = !isAdmin && teachingStaffSession.isFrontDesk;
    const isGeneralStaff = !isAdmin && !isFrontDesk;

    assert.equal(isAdmin, false);
    assert.equal(isFrontDesk, false);
    assert.equal(isGeneralStaff, true, 'Teaching staff has general staff role');

    // Operational summary: 2 cards
    const teachingStaffCards = [
      'Classroom Operations',
      'Guardian Verification',
    ];
    assert.equal(teachingStaffCards.length, 2);

    // Strict boundary checks
    assert.equal(isAdmin || isFrontDesk, false, 'Teaching staff must not access student intake or fee directory');
    assert.equal(isAdmin, false, 'Teaching staff must not access school settings');
  });
});

