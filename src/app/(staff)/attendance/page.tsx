import type { Metadata } from 'next';
import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession, assertFrontDeskAccess, getIntendingStudents } from '@/lib/auth';
import { getAcademicCalendar } from '@/lib/attendance/calendar';
import { listFeeTemplates } from '@/lib/payments/templates';
import { prisma } from '@/lib/db';
import { StudentNumberTable } from './StudentNumberTable';
import type { IntakeStudentItem, IntakeStatus, IntakeStudentGuardian } from './fuzzySearch';

export const metadata: Metadata = {
  title: 'Staff Dashboard | SchoolPass',
  description: 'Operational school management dashboard for teachers, front-desk officers, and administrators.',
};

export default async function StaffAttendancePage() {
  const session = await getSession();

  if (!session || (session.role !== 'staff' && session.role !== 'admin')) {
    redirect('/auth/staff-login?returnUrl=/attendance');
  }

  const frontDeskAccess = await assertFrontDeskAccess();
  const isAdmin = session.role === 'admin';
  const isFrontDesk = !isAdmin && frontDeskAccess.authorized;
  const isGeneralStaff = !isAdmin && !isFrontDesk;

  // Retrieve reliable, role-specific metrics with safe error handling
  let calendar = null;
  let activeStudentsCount = 0;
  let intendingStudentsCount = 0;
  let pendingLinksCount = 0;
  let feeTemplatesCount = 0;
  let intendingStudentsWithStatus: IntakeStudentItem[] = [];

  try {
    if (isAdmin) {
      const [calRes, activeStudents, allIntending, linksCount, templates] =
        await Promise.all([
          getAcademicCalendar().catch(() => null),
          prisma.student
            .findMany({
              where: { leftAt: null },
              include: {
                guardians: {
                  include: {
                    parent: {
                      select: { id: true, name: true, email: true, emailVerifiedAt: true },
                    },
                  },
                },
                linkRequests: {
                  include: {
                    parent: {
                      select: { id: true, name: true, email: true },
                    },
                  },
                  orderBy: { createdAt: 'desc' },
                },
                feeEntries: {
                  select: { id: true, type: true, amount: true, createdAt: true },
                  orderBy: { createdAt: 'desc' },
                },
                payments: {
                  where: { status: 'SUCCESSFUL' },
                  select: { id: true, amount: true, createdAt: true },
                  orderBy: { createdAt: 'desc' },
                },
                attendanceRecords: {
                  select: { id: true, status: true, date: true },
                  orderBy: { date: 'desc' },
                },
                arrivalConfirmations: {
                  select: { id: true, date: true, time: true, createdAt: true },
                  orderBy: { createdAt: 'desc' },
                },
              },
              orderBy: { createdAt: 'desc' },
            })
            .catch(() => []),
          getIntendingStudents().catch(() => []),
          prisma.studentLinkRequest
            .count({ where: { status: 'PENDING' } })
            .catch(() => 0),
          listFeeTemplates().catch(() => []),
        ]);

      calendar = calRes;
      activeStudentsCount = activeStudents.length;
      feeTemplatesCount = templates.length;
      pendingLinksCount = linksCount;

      // Track enrolled student numbers to prevent duplicate counting
      const enrolledNumbers = new Set(activeStudents.map((s) => s.studentNumber));

      // Prospective intake: intending students who have not yet been synchronised into Student
      const prospectiveIntake = allIntending.filter(
        (it) => !enrolledNumbers.has(it.studentNumber)
      );
      intendingStudentsCount = prospectiveIntake.length;

      // Unify officially generated student numbers from both IntendingStudent and Student
      // without duplicating synchronised students
      const studentNumberMap = new Map<string, IntakeStudentItem>();

      const feeCurrencyFormatter = new Intl.NumberFormat('en-NG', {
        style: 'currency',
        currency: 'NGN',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      });

      // 1. Add all intending intake records (unclaimed prospective intakes)
      for (const it of allIntending) {
        studentNumberMap.set(it.studentNumber, {
          id: it.id,
          studentNumber: it.studentNumber,
          name: it.name,
          intendedClass: it.intendedClass,
          sessionYear: it.sessionYear,
          createdAt: it.createdAt,
          registeredByName: it.registeredByName ?? null,
          guardianName: it.guardianName ?? null,
          guardianPhone: it.guardianPhone ?? null,
          guardianEmail: it.guardianEmail ?? null,
          notes: it.notes ?? null,
          status: 'Pre-Admission Intake',
          isClaimed: false,
        });
      }

      // 2. Merge active enrolled students into the directory (claimed student numbers)
      for (const st of activeStudents) {
        const existing = studentNumberMap.get(st.studentNumber);
        let status: IntakeStatus = 'Enrolled';
        if (st.guardians && st.guardians.length > 0) {
          status = 'Enrolled & Linked';
        } else if (
          st.linkRequests &&
          st.linkRequests.some((r) => r.status === 'PENDING')
        ) {
          status = 'Verification Pending';
        }

        // Calculate fee metrics
        let totalChargesNum = 0;
        let totalPaidNum = 0;
        let lastPaymentDate: string | null = null;

        for (const entry of st.feeEntries || []) {
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

        for (const payment of st.payments || []) {
          const amt = Number(payment.amount);
          totalPaidNum += amt;
          if (!lastPaymentDate && payment.createdAt) {
            lastPaymentDate = new Date(payment.createdAt).toISOString();
          }
        }

        const outstandingBalanceNum = totalChargesNum - totalPaidNum;
        const feeStatusLabel: 'Settled' | 'Outstanding' | 'No Charges Assigned' =
          totalChargesNum === 0
            ? 'No Charges Assigned'
            : outstandingBalanceNum <= 0
            ? 'Settled'
            : 'Outstanding';

        // Check-ins & Classroom Attendance
        const arrivalCheckinsCount = st.arrivalConfirmations?.length || 0;
        const lastCheckinDate = st.arrivalConfirmations?.[0]
          ? new Date(st.arrivalConfirmations[0].date).toISOString()
          : null;

        const attendanceTotalCount = st.attendanceRecords?.length || 0;
        const attendancePresentCount =
          st.attendanceRecords?.filter((r) => r.status === 'PRESENT').length || 0;

        // Guardians
        const guardians: IntakeStudentGuardian[] = (st.guardians || []).map((g) => ({
          id: g.parent.id,
          name: g.parent.name,
          email: g.parent.email,
          isVerified: !!g.parent.emailVerifiedAt,
        }));
        const pendingLinkCount =
          st.linkRequests?.filter((r) => r.status === 'PENDING').length || 0;

        studentNumberMap.set(st.studentNumber, {
          id: st.id,
          studentNumber: st.studentNumber,
          name: st.name,
          intendedClass: st.className || existing?.intendedClass || 'Unassigned',
          sessionYear: existing?.sessionYear || calRes?.sessionYear || '2026/2027',
          createdAt: st.createdAt,
          registeredByName: existing?.registeredByName ?? null,
          guardianName:
            guardians.length > 0
              ? guardians.map((g) => g.name).join(', ')
              : existing?.guardianName ?? null,
          guardianPhone: existing?.guardianPhone ?? null,
          guardianEmail:
            guardians.length > 0
              ? guardians[0].email
              : existing?.guardianEmail ?? null,
          notes: existing?.notes ?? null,
          status,
          isClaimed: true,

          totalCharges: feeCurrencyFormatter.format(totalChargesNum),
          totalPaid: feeCurrencyFormatter.format(totalPaidNum),
          outstandingBalance: feeCurrencyFormatter.format(
            Math.max(0, outstandingBalanceNum)
          ),
          feeStatusLabel,
          lastPaymentDate,

          arrivalCheckinsCount,
          lastCheckinDate,
          attendancePresentCount,
          attendanceTotalCount,

          guardians,
          pendingLinkCount,
        });
      }

      // Sort by generation / creation date descending
      intendingStudentsWithStatus = Array.from(studentNumberMap.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } else if (isFrontDesk) {
      const [allIntending, linksCount] = await Promise.all([
        getIntendingStudents().catch(() => []),
        prisma.studentLinkRequest
          .count({ where: { status: 'PENDING' } })
          .catch(() => 0),
      ]);
      const enrolledNumbers = new Set(
        (
          await prisma.student
            .findMany({ select: { studentNumber: true } })
            .catch(() => [])
        ).map((s) => s.studentNumber)
      );
      intendingStudentsCount = allIntending.filter(
        (it) => !enrolledNumbers.has(it.studentNumber)
      ).length;
      pendingLinksCount = linksCount;
    } else {
      pendingLinksCount = await prisma.studentLinkRequest
        .count({ where: { status: 'PENDING' } })
        .catch(() => 0);
    }
  } catch {
    // Graceful fallback for database read issues
  }

  const roleTitle = isAdmin
    ? 'School Administrator'
    : isFrontDesk
    ? 'Front Desk Officer'
    : 'Teaching Staff';

  const roleBadgeText = isAdmin
    ? 'Administrator'
    : isFrontDesk
    ? 'Front Desk'
    : 'Teaching Staff';

  const roleDescription = isAdmin
    ? 'Executive school administration, fee ledger control, academic calendar, and staff access management.'
    : isFrontDesk
    ? 'Front-desk operations, prospective student intake, student number generation, and student fee lookup.'
    : 'Classroom attendance recording, gate arrival codes, and parent link verification.';

  const currentTermName =
    calendar?.terms.find((t) => t.termId === calendar.currentTermId)?.name ||
    'First Term';

  return (
    <div
      style={{
        minHeight: '100dvh',
        backgroundColor: 'var(--color-roles-background)',
        color: 'var(--color-roles-on-background)',
        padding: '24px 16px 48px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '780px',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
        }}
      >
        {/* ========================================================
            1. HEADER & NAVIGATION
            ======================================================== */}
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingBottom: '16px',
            borderBottom: '1px solid var(--color-roles-outline-variant)',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                fontFamily: 'var(--typography-title-large-fontfamily)',
                fontSize: 'var(--typography-title-large-fontsize)',
                fontWeight: 700,
                color: 'var(--color-roles-secondary)',
              }}
            >
              SchoolPass
            </span>
            <span
              style={{
                fontSize: '11px',
                color: 'var(--color-roles-on-secondary)',
                backgroundColor: 'var(--color-roles-secondary)',
                padding: '2px 8px',
                borderRadius: '4px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              {roleBadgeText}
            </span>
          </div>

          <nav
            aria-label="Staff primary navigation"
            style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}
          >
            <Link
              href="/attendance"
              style={{
                fontFamily: 'var(--typography-label-large-fontfamily)',
                fontSize: 'var(--typography-label-large-fontsize)',
                color: 'var(--color-roles-primary)',
                textDecoration: 'none',
                fontWeight: 600,
              }}
            >
              Dashboard
            </Link>

            <Link
              href="/guardian-links"
              style={{
                fontFamily: 'var(--typography-label-large-fontfamily)',
                fontSize: 'var(--typography-label-large-fontsize)',
                color: 'var(--color-roles-primary)',
                textDecoration: 'none',
                fontWeight: 600,
              }}
            >
              Guardian Links
            </Link>

            {(isAdmin || isFrontDesk) && (
              <Link
                href="/payments"
                style={{
                  fontFamily: 'var(--typography-label-large-fontfamily)',
                  fontSize: 'var(--typography-label-large-fontsize)',
                  color: 'var(--color-roles-primary)',
                  textDecoration: 'none',
                  fontWeight: 600,
                }}
              >
                {isAdmin ? 'Fee Management' : 'Fee Directory'}
              </Link>
            )}

            {isAdmin && (
              <Link
                href="/settings"
                style={{
                  fontFamily: 'var(--typography-label-large-fontfamily)',
                  fontSize: 'var(--typography-label-large-fontsize)',
                  color: 'var(--color-roles-primary)',
                  textDecoration: 'none',
                  fontWeight: 600,
                }}
              >
                Settings
              </Link>
            )}

            <form action="/api/auth/logout" method="POST" style={{ margin: 0 }}>
              <button
                type="submit"
                style={{
                  fontFamily: 'var(--typography-label-large-fontfamily)',
                  fontSize: 'var(--typography-label-large-fontsize)',
                  color: 'var(--color-roles-error)',
                  backgroundColor: 'transparent',
                  border: 'none',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                Sign Out
              </button>
            </form>
          </nav>
        </header>

        {/* ========================================================
            2. WELCOME & ROLE CONTEXT BANNER
            ======================================================== */}
        <section
          aria-labelledby="staff-welcome-heading"
          style={{
            backgroundColor: 'var(--color-roles-surface)',
            border: '1px solid var(--color-roles-outline-color)',
            boxShadow: 'var(--effect-soft-shadow)',
            borderRadius: '8px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              flexWrap: 'wrap',
              gap: '10px',
            }}
          >
            <div>
              <h1
                id="staff-welcome-heading"
                style={{
                  fontFamily: 'var(--typography-headline-small-fontfamily)',
                  fontSize: 'var(--typography-headline-small-fontsize)',
                  fontWeight: 700,
                  color: 'var(--color-roles-on-surface)',
                  margin: 0,
                }}
              >
                {isAdmin
                  ? 'Admin Dashboard'
                  : isFrontDesk
                  ? 'Front Desk Dashboard'
                  : 'Staff Dashboard'}
              </h1>
              <p
                style={{
                  fontFamily: 'var(--typography-body-medium-fontfamily)',
                  fontSize: 'var(--typography-body-medium-fontsize)',
                  color: 'var(--color-roles-on-surface-variant)',
                  margin: '4px 0 0',
                }}
              >
                Signed in as <strong>{session.user.name}</strong> ({session.user.email}) &bull;{' '}
                <span style={{ fontWeight: 600, color: 'var(--color-roles-primary)' }}>
                  {roleTitle}
                </span>
              </p>
            </div>
          </div>

          <p
            style={{
              fontFamily: 'var(--typography-body-small-fontfamily)',
              fontSize: 'var(--typography-body-small-fontsize)',
              color: 'var(--color-roles-on-surface-variant)',
              margin: '4px 0 0',
              lineHeight: 1.5,
            }}
          >
            {roleDescription}
          </p>
        </section>

        {/* ========================================================
            3. OPERATIONAL OVERVIEW SUMMARY (VERIFIED DATA ONLY)
            ======================================================== */}
        <section
          aria-labelledby="operations-summary-heading"
          style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
        >
          <h2
            id="operations-summary-heading"
            style={{
              fontFamily: 'var(--typography-title-medium-fontfamily)',
              fontSize: 'var(--typography-title-medium-fontsize)',
              fontWeight: 700,
              color: 'var(--color-roles-on-surface)',
              margin: 0,
            }}
          >
            Operational Overview
          </h2>

          {/* ADMIN OPERATIONAL OVERVIEW (4 Cards) */}
          {isAdmin && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                gap: '12px',
              }}
            >
              {/* Academic Calendar Status */}
              <div
                style={{
                  padding: '16px',
                  backgroundColor: 'var(--color-roles-surface)',
                  border: '1px solid var(--color-roles-outline-color)',
                  borderRadius: '8px',
                  boxShadow: 'var(--effect-soft-shadow)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '8px',
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: '11px',
                      color: 'var(--color-roles-on-surface-variant)',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                    }}
                  >
                    Academic Term
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: 700, marginTop: '2px' }}>
                    {calendar
                      ? `${calendar.sessionYear || '2026/2027'} • ${currentTermName}`
                      : 'Session Unconfigured'}
                  </div>
                  <div
                    style={{
                      fontSize: '11px',
                      color: calendar?.isCurrentTermConfigured ? '#2e7d32' : '#e65100',
                      fontWeight: 600,
                      marginTop: '2px',
                    }}
                  >
                    {!calendar
                      ? '⚠ Calendar Not Configured'
                      : calendar.isCurrentTermConfigured
                      ? '✓ Term Active & Ready'
                      : '⚠ Term Dates Incomplete'}
                  </div>
                </div>
                <Link
                  href="/settings"
                  style={{
                    fontSize: '12px',
                    color: 'var(--color-roles-primary)',
                    fontWeight: 600,
                    textDecoration: 'none',
                  }}
                >
                  Settings &rarr;
                </Link>
              </div>

              {/* Student Enrollment */}
              <div
                style={{
                  padding: '16px',
                  backgroundColor: 'var(--color-roles-surface)',
                  border: '1px solid var(--color-roles-outline-color)',
                  borderRadius: '8px',
                  boxShadow: 'var(--effect-soft-shadow)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '8px',
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: '11px',
                      color: 'var(--color-roles-on-surface-variant)',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                    }}
                  >
                    Enrolled Students
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 700, marginTop: '2px' }}>
                    {activeStudentsCount} Active
                  </div>
                  <div
                    style={{
                      fontSize: '11px',
                      color: 'var(--color-roles-on-surface-variant)',
                      marginTop: '2px',
                    }}
                  >
                    {intendingStudentsCount === 0
                      ? '0 prospective intake'
                      : `${intendingStudentsCount} prospective intake`}
                  </div>
                </div>
                <Link
                  href="/students"
                  style={{
                    fontSize: '12px',
                    color: 'var(--color-roles-primary)',
                    fontWeight: 600,
                    textDecoration: 'none',
                  }}
                >
                  View Students &rarr;
                </Link>
              </div>

              {/* Guardian Links Queue */}
              <div
                style={{
                  padding: '16px',
                  backgroundColor: 'var(--color-roles-surface)',
                  border: '1px solid var(--color-roles-outline-color)',
                  borderRadius: '8px',
                  boxShadow: 'var(--effect-soft-shadow)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '8px',
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: '11px',
                      color: 'var(--color-roles-on-surface-variant)',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                    }}
                  >
                    Guardian Queue
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 700, marginTop: '2px' }}>
                    {pendingLinksCount} Pending
                  </div>
                  <div
                    style={{
                      fontSize: '11px',
                      color: pendingLinksCount > 0 ? '#e65100' : '#2e7d32',
                      fontWeight: 600,
                      marginTop: '2px',
                    }}
                  >
                    {pendingLinksCount > 0 ? 'Awaiting verification' : 'Queue clear'}
                  </div>
                </div>
                <Link
                  href="/guardian-links"
                  style={{
                    fontSize: '12px',
                    color: 'var(--color-roles-primary)',
                    fontWeight: 600,
                    textDecoration: 'none',
                  }}
                >
                  Review Links &rarr;
                </Link>
              </div>

              {/* Fee Templates */}
              <div
                style={{
                  padding: '16px',
                  backgroundColor: 'var(--color-roles-surface)',
                  border: '1px solid var(--color-roles-outline-color)',
                  borderRadius: '8px',
                  boxShadow: 'var(--effect-soft-shadow)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '8px',
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: '11px',
                      color: 'var(--color-roles-on-surface-variant)',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                    }}
                  >
                    Fee Templates
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 700, marginTop: '2px' }}>
                    {feeTemplatesCount} Configured
                  </div>
                  <div
                    style={{
                      fontSize: '11px',
                      color: 'var(--color-roles-on-surface-variant)',
                      marginTop: '2px',
                    }}
                  >
                    {feeTemplatesCount === 0
                      ? 'No fee templates configured'
                      : 'Offline & online ledger'}
                  </div>
                </div>
                <Link
                  href="/payments"
                  style={{
                    fontSize: '12px',
                    color: 'var(--color-roles-primary)',
                    fontWeight: 600,
                    textDecoration: 'none',
                  }}
                >
                  Manage Fees &rarr;
                </Link>
              </div>
            </div>
          )}

          {/* FRONT DESK OPERATIONAL OVERVIEW (3 Cards) */}
          {isFrontDesk && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '12px',
              }}
            >
              {/* Student Intake */}
              <div
                style={{
                  padding: '16px',
                  backgroundColor: 'var(--color-roles-surface)',
                  border: '1px solid var(--color-roles-outline-color)',
                  borderRadius: '8px',
                  boxShadow: 'var(--effect-soft-shadow)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '8px',
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: '11px',
                      color: 'var(--color-roles-on-surface-variant)',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                    }}
                  >
                    Prospective Intake
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 700, marginTop: '2px' }}>
                    {intendingStudentsCount} Registered
                  </div>
                  <div
                    style={{
                      fontSize: '11px',
                      color: 'var(--color-roles-on-surface-variant)',
                      marginTop: '2px',
                    }}
                  >
                    Pre-admission ID assignment
                  </div>
                </div>
                <Link
                  href="/students"
                  style={{
                    fontSize: '12px',
                    color: 'var(--color-roles-primary)',
                    fontWeight: 600,
                    textDecoration: 'none',
                  }}
                >
                  Register Student &rarr;
                </Link>
              </div>

              {/* Fee Balance Directory */}
              <div
                style={{
                  padding: '16px',
                  backgroundColor: 'var(--color-roles-surface)',
                  border: '1px solid var(--color-roles-outline-color)',
                  borderRadius: '8px',
                  boxShadow: 'var(--effect-soft-shadow)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '8px',
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: '11px',
                      color: 'var(--color-roles-on-surface-variant)',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                    }}
                  >
                    Student Fee Directory
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: 700, marginTop: '2px' }}>
                    Directory Lookup
                  </div>
                  <div
                    style={{
                      fontSize: '11px',
                      color: 'var(--color-roles-on-surface-variant)',
                      marginTop: '2px',
                    }}
                  >
                    Read-only balance inquiries
                  </div>
                </div>
                <Link
                  href="/payments"
                  style={{
                    fontSize: '12px',
                    color: 'var(--color-roles-primary)',
                    fontWeight: 600,
                    textDecoration: 'none',
                  }}
                >
                  Lookup Balance &rarr;
                </Link>
              </div>

              {/* Guardian Links Queue */}
              <div
                style={{
                  padding: '16px',
                  backgroundColor: 'var(--color-roles-surface)',
                  border: '1px solid var(--color-roles-outline-color)',
                  borderRadius: '8px',
                  boxShadow: 'var(--effect-soft-shadow)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '8px',
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: '11px',
                      color: 'var(--color-roles-on-surface-variant)',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                    }}
                  >
                    Guardian Verification
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 700, marginTop: '2px' }}>
                    {pendingLinksCount} Pending
                  </div>
                  <div
                    style={{
                      fontSize: '11px',
                      color: pendingLinksCount > 0 ? '#e65100' : '#2e7d32',
                      fontWeight: 600,
                      marginTop: '2px',
                    }}
                  >
                    {pendingLinksCount > 0 ? 'Awaiting verification' : 'Queue clear'}
                  </div>
                </div>
                <Link
                  href="/guardian-links"
                  style={{
                    fontSize: '12px',
                    color: 'var(--color-roles-primary)',
                    fontWeight: 600,
                    textDecoration: 'none',
                  }}
                >
                  Verify Links &rarr;
                </Link>
              </div>
            </div>
          )}

          {/* TEACHING STAFF OPERATIONAL OVERVIEW (2 Cards) */}
          {isGeneralStaff && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '12px',
              }}
            >
              {/* Daily Attendance */}
              <div
                style={{
                  padding: '16px',
                  backgroundColor: 'var(--color-roles-surface)',
                  border: '1px solid var(--color-roles-outline-color)',
                  borderRadius: '8px',
                  boxShadow: 'var(--effect-soft-shadow)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '8px',
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: '11px',
                      color: 'var(--color-roles-on-surface-variant)',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                    }}
                  >
                    Classroom Operations
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: 700, marginTop: '2px' }}>
                    Daily Attendance Entry
                  </div>
                  <div
                    style={{
                      fontSize: '11px',
                      color: 'var(--color-roles-on-surface-variant)',
                      marginTop: '2px',
                    }}
                  >
                    Mark morning student attendance
                  </div>
                </div>
                <span style={{ fontSize: '12px', color: 'var(--color-roles-primary)', fontWeight: 600 }}>
                  Ready for today
                </span>
              </div>

              {/* Guardian Verification Queue */}
              <div
                style={{
                  padding: '16px',
                  backgroundColor: 'var(--color-roles-surface)',
                  border: '1px solid var(--color-roles-outline-color)',
                  borderRadius: '8px',
                  boxShadow: 'var(--effect-soft-shadow)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '8px',
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: '11px',
                      color: 'var(--color-roles-on-surface-variant)',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                    }}
                  >
                    Guardian Verification
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 700, marginTop: '2px' }}>
                    {pendingLinksCount} Pending
                  </div>
                  <div
                    style={{
                      fontSize: '11px',
                      color: pendingLinksCount > 0 ? '#e65100' : '#2e7d32',
                      fontWeight: 600,
                      marginTop: '2px',
                    }}
                  >
                    {pendingLinksCount > 0 ? 'Awaiting verification' : 'Queue clear'}
                  </div>
                </div>
                <Link
                  href="/guardian-links"
                  style={{
                    fontSize: '12px',
                    color: 'var(--color-roles-primary)',
                    fontWeight: 600,
                    textDecoration: 'none',
                  }}
                >
                  Review Requests &rarr;
                </Link>
              </div>
            </div>
          )}
        </section>

        {/* ========================================================
            4. AUTHORIZED CAPABILITIES & FUNCTIONS
            ======================================================== */}
        <section
          aria-labelledby="capabilities-heading"
          style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
        >
          <h2
            id="capabilities-heading"
            style={{
              fontFamily: 'var(--typography-title-medium-fontfamily)',
              fontSize: 'var(--typography-title-medium-fontsize)',
              fontWeight: 700,
              color: 'var(--color-roles-on-surface)',
              margin: 0,
            }}
          >
            {isAdmin ? 'Administrative Management' : 'Authorized Functions'}
          </h2>

          {isAdmin ? (
            /* ADMIN: ADMINISTRATIVE MANAGEMENT (6 FUNCTIONS) */
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '14px',
              }}
            >
              {/* 1. Guardian Links */}
              <Link
                href="/guardian-links"
                style={{
                  padding: '18px',
                  backgroundColor: 'var(--color-roles-surface)',
                  border: '1px solid var(--color-roles-outline-color)',
                  borderRadius: '8px',
                  boxShadow: 'var(--effect-soft-shadow)',
                  textDecoration: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '8px',
                }}
              >
                <div>
                  <h3
                    style={{
                      fontSize: '15px',
                      fontWeight: 700,
                      color: 'var(--color-roles-primary)',
                      margin: '0 0 4px',
                    }}
                  >
                    Guardian Links &rarr;
                  </h3>
                  <p
                    style={{
                      fontSize: '12px',
                      color: 'var(--color-roles-on-surface-variant)',
                      margin: 0,
                      lineHeight: 1.4,
                    }}
                  >
                    Review parent linking requests and verify authorized adult-student relationships.
                  </p>
                </div>
                <span
                  style={{
                    fontSize: '11px',
                    color: pendingLinksCount > 0 ? '#e65100' : 'var(--color-roles-primary)',
                    fontWeight: 600,
                  }}
                >
                  {pendingLinksCount} request{pendingLinksCount !== 1 ? 's' : ''} in queue &bull; {pendingLinksCount > 0 ? 'Verification needed' : 'Queue clear'}
                </span>
              </Link>

              {/* 2. Fee Management */}
              <Link
                href="/payments"
                style={{
                  padding: '18px',
                  backgroundColor: 'var(--color-roles-surface)',
                  border: '1px solid var(--color-roles-outline-color)',
                  borderRadius: '8px',
                  boxShadow: 'var(--effect-soft-shadow)',
                  textDecoration: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '8px',
                }}
              >
                <div>
                  <h3
                    style={{
                      fontSize: '15px',
                      fontWeight: 700,
                      color: 'var(--color-roles-primary)',
                      margin: '0 0 4px',
                    }}
                  >
                    Fee Management &rarr;
                  </h3>
                  <p
                    style={{
                      fontSize: '12px',
                      color: 'var(--color-roles-on-surface-variant)',
                      margin: 0,
                      lineHeight: 1.4,
                    }}
                  >
                    Record offline payments, adjust student balances, manage templates, and inspect fee ledger.
                  </p>
                </div>
                <span
                  style={{
                    fontSize: '11px',
                    color: 'var(--color-roles-primary)',
                    fontWeight: 600,
                  }}
                >
                  {feeTemplatesCount} template{feeTemplatesCount !== 1 ? 's' : ''} configured &bull; Ledger active
                </span>
              </Link>

              {/* 3. Student Intake */}
              <Link
                href="/students"
                style={{
                  padding: '18px',
                  backgroundColor: 'var(--color-roles-surface)',
                  border: '1px solid var(--color-roles-outline-color)',
                  borderRadius: '8px',
                  boxShadow: 'var(--effect-soft-shadow)',
                  textDecoration: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '8px',
                }}
              >
                <div>
                  <h3
                    style={{
                      fontSize: '15px',
                      fontWeight: 700,
                      color: 'var(--color-roles-primary)',
                      margin: '0 0 4px',
                    }}
                  >
                    Student Intake &rarr;
                  </h3>
                  <p
                    style={{
                      fontSize: '12px',
                      color: 'var(--color-roles-on-surface-variant)',
                      margin: 0,
                      lineHeight: 1.4,
                    }}
                  >
                    Front-desk intake and official SP-YYYY-NNNN student identifier generation.
                  </p>
                </div>
                <span
                  style={{
                    fontSize: '11px',
                    color: 'var(--color-roles-primary)',
                    fontWeight: 600,
                  }}
                >
                  {intendingStudentsCount} prospective student{intendingStudentsCount !== 1 ? 's' : ''} &bull; Intake ready
                </span>
              </Link>

              {/* 4. School Settings */}
              <Link
                href="/settings"
                style={{
                  padding: '18px',
                  backgroundColor: 'var(--color-roles-surface)',
                  border: '1px solid var(--color-roles-outline-color)',
                  borderRadius: '8px',
                  boxShadow: 'var(--effect-soft-shadow)',
                  textDecoration: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '8px',
                }}
              >
                <div>
                  <h3
                    style={{
                      fontSize: '15px',
                      fontWeight: 700,
                      color: 'var(--color-roles-primary)',
                      margin: '0 0 4px',
                    }}
                  >
                    School Settings &rarr;
                  </h3>
                  <p
                    style={{
                      fontSize: '12px',
                      color: 'var(--color-roles-on-surface-variant)',
                      margin: 0,
                      lineHeight: 1.4,
                    }}
                  >
                    Configure academic calendar, sessions, active terms, and operational settings.
                  </p>
                </div>
                <span
                  style={{
                    fontSize: '11px',
                    color: 'var(--color-roles-primary)',
                    fontWeight: 600,
                  }}
                >
                  {calendar?.sessionYear || '2026/2027'} &bull; {currentTermName} ({calendar?.isCurrentTermConfigured ? 'Active' : 'Setup Needed'})
                </span>
              </Link>

              {/* 5. Attendance Recording */}
              <Link
                href="/attendance"
                style={{
                  padding: '18px',
                  backgroundColor: 'var(--color-roles-surface)',
                  border: '1px solid var(--color-roles-outline-color)',
                  borderRadius: '8px',
                  boxShadow: 'var(--effect-soft-shadow)',
                  textDecoration: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '8px',
                }}
              >
                <div>
                  <h3
                    style={{
                      fontSize: '15px',
                      fontWeight: 700,
                      color: 'var(--color-roles-primary)',
                      margin: '0 0 4px',
                    }}
                  >
                    Attendance Recording &rarr;
                  </h3>
                  <p
                    style={{
                      fontSize: '12px',
                      color: 'var(--color-roles-on-surface-variant)',
                      margin: 0,
                      lineHeight: 1.4,
                    }}
                  >
                    Classroom staff-recorded attendance. Source of truth for student attendance figures.
                  </p>
                </div>
                <span
                  style={{
                    fontSize: '11px',
                    color: 'var(--color-roles-primary)',
                    fontWeight: 600,
                  }}
                >
                  Classroom roll call &bull; Term source of truth
                </span>
              </Link>

              {/* 6. Gate Arrival Codes */}
              <Link
                href="/arrival-code"
                style={{
                  padding: '18px',
                  backgroundColor: 'var(--color-roles-surface)',
                  border: '1px solid var(--color-roles-outline-color)',
                  borderRadius: '8px',
                  boxShadow: 'var(--effect-soft-shadow)',
                  textDecoration: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '8px',
                }}
              >
                <div>
                  <h3
                    style={{
                      fontSize: '15px',
                      fontWeight: 700,
                      color: 'var(--color-roles-primary)',
                      margin: '0 0 4px',
                    }}
                  >
                    Gate Arrival Codes &rarr;
                  </h3>
                  <p
                    style={{
                      fontSize: '12px',
                      color: 'var(--color-roles-on-surface-variant)',
                      margin: 0,
                      lineHeight: 1.4,
                    }}
                  >
                    Daily QR code and 6-digit manual fallback code for morning drop-offs.
                  </p>
                </div>
                <span
                  style={{
                    fontSize: '11px',
                    color: 'var(--color-roles-primary)',
                    fontWeight: 600,
                  }}
                >
                  Morning gate drop-off &bull; Gate display
                </span>
              </Link>
            </div>
          ) : (
            /* NON-ADMIN: FRONT DESK & TEACHING STAFF (UNCHANGED) */
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '14px',
              }}
            >
              {/* Guardian Links (Available to Staff & Admin) */}
              <Link
                href="/guardian-links"
                style={{
                  padding: '18px',
                  backgroundColor: 'var(--color-roles-surface)',
                  border: '1px solid var(--color-roles-outline-color)',
                  borderRadius: '8px',
                  boxShadow: 'var(--effect-soft-shadow)',
                  textDecoration: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '8px',
                }}
              >
                <div>
                  <h3
                    style={{
                      fontSize: '15px',
                      fontWeight: 700,
                      color: 'var(--color-roles-primary)',
                      margin: '0 0 4px',
                    }}
                  >
                    Guardian Links &rarr;
                  </h3>
                  <p
                    style={{
                      fontSize: '12px',
                      color: 'var(--color-roles-on-surface-variant)',
                      margin: 0,
                      lineHeight: 1.4,
                    }}
                  >
                    Review parent linking requests and verify authorized adult-student relationships.
                  </p>
                </div>
                <span
                  style={{
                    fontSize: '11px',
                    color: pendingLinksCount > 0 ? '#e65100' : 'var(--color-roles-primary)',
                    fontWeight: 600,
                  }}
                >
                  {pendingLinksCount} request{pendingLinksCount !== 1 ? 's' : ''} in queue
                </span>
              </Link>

              {/* Fee Management (Admin) or Fee Directory (Front Desk) */}
              {(isAdmin || isFrontDesk) && (
                <Link
                  href="/payments"
                  style={{
                    padding: '18px',
                    backgroundColor: 'var(--color-roles-surface)',
                    border: '1px solid var(--color-roles-outline-color)',
                    borderRadius: '8px',
                    boxShadow: 'var(--effect-soft-shadow)',
                    textDecoration: 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '8px',
                  }}
                >
                  <div>
                    <h3
                      style={{
                        fontSize: '15px',
                        fontWeight: 700,
                        color: 'var(--color-roles-primary)',
                        margin: '0 0 4px',
                      }}
                    >
                      {isAdmin ? 'Fee Management' : 'Student Fee Directory'} &rarr;
                    </h3>
                    <p
                      style={{
                        fontSize: '12px',
                        color: 'var(--color-roles-on-surface-variant)',
                        margin: 0,
                        lineHeight: 1.4,
                      }}
                    >
                      {isAdmin
                        ? 'Record offline payments, adjust student balances, manage templates, and assign fees.'
                        : 'Read-only student balance inquiries for parents visiting the front desk.'}
                    </p>
                  </div>
                  <span
                    style={{
                      fontSize: '11px',
                      color: 'var(--color-roles-primary)',
                      fontWeight: 600,
                    }}
                  >
                    {isAdmin ? 'Admin ledger control' : 'Read-only lookup'}
                  </span>
                </Link>
              )}

              {/* Student Intake (Front Desk & Admin) */}
              {(isAdmin || isFrontDesk) && (
                <Link
                  href="/students"
                  style={{
                    padding: '18px',
                    backgroundColor: 'var(--color-roles-surface)',
                    border: '1px solid var(--color-roles-outline-color)',
                    borderRadius: '8px',
                    boxShadow: 'var(--effect-soft-shadow)',
                    textDecoration: 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '8px',
                  }}
                >
                  <div>
                    <h3
                      style={{
                        fontSize: '15px',
                        fontWeight: 700,
                        color: 'var(--color-roles-primary)',
                        margin: '0 0 4px',
                      }}
                    >
                      Student Intake &rarr;
                    </h3>
                    <p
                      style={{
                        fontSize: '12px',
                        color: 'var(--color-roles-on-surface-variant)',
                        margin: 0,
                        lineHeight: 1.4,
                      }}
                    >
                      Front-desk intake and identifier generation for prospective students.
                    </p>
                  </div>
                  <span
                    style={{
                      fontSize: '11px',
                      color: 'var(--color-roles-primary)',
                      fontWeight: 600,
                    }}
                  >
                    SP-YYYY-NNNN generation
                  </span>
                </Link>
              )}

              {/* School Settings (Admin Only) */}
              {isAdmin && (
                <Link
                  href="/settings"
                  style={{
                    padding: '18px',
                    backgroundColor: 'var(--color-roles-surface)',
                    border: '1px solid var(--color-roles-outline-color)',
                    borderRadius: '8px',
                    boxShadow: 'var(--effect-soft-shadow)',
                    textDecoration: 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '8px',
                  }}
                >
                  <div>
                    <h3
                      style={{
                        fontSize: '15px',
                        fontWeight: 700,
                        color: 'var(--color-roles-primary)',
                        margin: '0 0 4px',
                      }}
                    >
                      School Settings &rarr;
                    </h3>
                    <p
                      style={{
                        fontSize: '12px',
                        color: 'var(--color-roles-on-surface-variant)',
                        margin: 0,
                        lineHeight: 1.4,
                      }}
                    >
                      Configure academic calendar, sessions, active terms, and operational settings.
                    </p>
                  </div>
                  <span
                    style={{
                      fontSize: '11px',
                      color: 'var(--color-roles-primary)',
                      fontWeight: 600,
                    }}
                  >
                    Admin configuration
                  </span>
                </Link>
              )}

              {/* Attendance Entry */}
              <div
                style={{
                  padding: '18px',
                  backgroundColor: 'var(--color-roles-surface)',
                  border: '1px solid var(--color-roles-outline-color)',
                  borderRadius: '8px',
                  boxShadow: 'var(--effect-soft-shadow)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '8px',
                }}
              >
                <div>
                  <h3
                    style={{
                      fontSize: '15px',
                      fontWeight: 700,
                      color: 'var(--color-roles-on-surface)',
                      margin: '0 0 4px',
                    }}
                  >
                    Attendance Recording
                  </h3>
                  <p
                    style={{
                      fontSize: '12px',
                      color: 'var(--color-roles-on-surface-variant)',
                      margin: 0,
                      lineHeight: 1.4,
                    }}
                  >
                    Classroom staff-recorded attendance. Source of truth for student attendance figures.
                  </p>
                </div>
                <span
                  style={{
                    fontSize: '11px',
                    color: 'var(--color-roles-on-surface-variant)',
                    fontWeight: 600,
                  }}
                >
                  Classroom roll call
                </span>
              </div>

              {/* Arrival Codes */}
              <div
                style={{
                  padding: '18px',
                  backgroundColor: 'var(--color-roles-surface)',
                  border: '1px solid var(--color-roles-outline-color)',
                  borderRadius: '8px',
                  boxShadow: 'var(--effect-soft-shadow)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '8px',
                }}
              >
                <div>
                  <h3
                    style={{
                      fontSize: '15px',
                      fontWeight: 700,
                      color: 'var(--color-roles-on-surface)',
                      margin: '0 0 4px',
                    }}
                  >
                    Gate Arrival Codes
                  </h3>
                  <p
                    style={{
                      fontSize: '12px',
                      color: 'var(--color-roles-on-surface-variant)',
                      margin: 0,
                      lineHeight: 1.4,
                    }}
                  >
                    Daily QR code and 6-digit manual fallback code for morning drop-offs.
                  </p>
                </div>
                <span
                  style={{
                    fontSize: '11px',
                    color: 'var(--color-roles-on-surface-variant)',
                    fontWeight: 600,
                  }}
                >
                  Morning gate drop-off
                </span>
              </div>
            </div>
          )}
        </section>

        {/* ========================================================
            5. STUDENT INTAKE & NUMBER GENERATION TABLE (ADMIN)
            ======================================================== */}
        {isAdmin && (
          <StudentNumberTable initialStudents={intendingStudentsWithStatus} />
        )}

        {/* ========================================================
            6. FOOTER
            ======================================================== */}
        <footer style={{ textAlign: 'center', marginTop: '12px' }}>
          <Link
            href="/"
            style={{
              fontSize: 'var(--typography-body-small-fontsize)',
              color: 'var(--color-roles-secondary)',
              textDecoration: 'none',
            }}
          >
            &larr; Back to Landing Page
          </Link>
        </footer>
      </div>
    </div>
  );
}
