import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  assertFrontDeskAccess,
  getConfiguredClasses,
  getConfiguredSessions,
  getSession,
} from '@/lib/auth';
import {
  listFeeTemplates,
  type FeeAssignmentStudentPreview,
  type FeeTemplate,
} from '@/lib/payments/templates';
import {
  loadFeeDirectory,
  loadFrontDeskFeeDirectory,
  type FeeDirectoryBalanceResult,
  type FeeDirectoryResult,
} from '@/lib/payments/offline';
import { PaymentsManager } from './PaymentsManager';

export const metadata: Metadata = {
  title: 'Fee Management | SchoolPass Admin',
};

export default async function PaymentsPage() {
  const session = await getSession();

  if (!session || (session.role !== 'staff' && session.role !== 'admin')) {
    redirect('/auth/staff-login?returnUrl=/payments');
  }

  const frontDeskAccess = await assertFrontDeskAccess();

  if (!frontDeskAccess.authorized) {
    return (
      <div
        style={{
          minHeight: '100dvh',
          backgroundColor: 'var(--color-roles-background)',
          color: 'var(--color-roles-on-background)',
          padding: '24px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '560px',
            backgroundColor: 'var(--color-roles-surface)',
            border: '1px solid var(--color-roles-outline-color)',
            boxShadow: 'var(--effect-soft-shadow)',
            padding: '28px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          <h1
            style={{
              fontFamily: 'var(--typography-headline-small-fontfamily)',
              fontSize: 'var(--typography-headline-small-fontsize)',
              color: 'var(--color-roles-on-surface)',
              margin: 0,
            }}
          >
            Fee access restricted
          </h1>
          <p
            style={{
              fontFamily: 'var(--typography-body-medium-fontfamily)',
              fontSize: 'var(--typography-body-medium-fontsize)',
              color: 'var(--color-roles-on-surface-variant)',
              margin: 0,
              lineHeight: 1.6,
            }}
          >
            Fee management is restricted to Admin accounts. Front-desk staff may view read-only
            student balances when authorised. General staff cannot access financial records.
          </p>
          <Link
            href="/attendance"
            style={{
              color: 'var(--color-roles-primary)',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            &larr; Back to Staff Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const isAdmin = session.role === 'admin';

  let adminDirectory: FeeDirectoryResult = { students: [] };
  let frontDeskDirectory: FeeDirectoryBalanceResult = { students: [] };
  let directoryError: string | undefined;

  try {
    if (isAdmin) {
      adminDirectory = await loadFeeDirectory();
      directoryError = adminDirectory.error;
    } else {
      frontDeskDirectory = await loadFrontDeskFeeDirectory();
      directoryError = frontDeskDirectory.error;
    }
  } catch {
    directoryError =
      'The student fee directory could not be loaded. Refresh the page or contact technical support.';
  }

  const directoryStudents = isAdmin
    ? adminDirectory.students
    : frontDeskDirectory.students;

  let templates: FeeTemplate[] = [];
  let classes: string[] = [];
  let sessions: string[] = [];
  let storageError: string | undefined;
  let dataError: string | undefined;

  if (isAdmin) {
    try {
      templates = await listFeeTemplates();
    } catch {
      storageError =
        'Fee template configuration could not be loaded. Contact technical support before making changes.';
    }

    try {
      [classes, sessions] = await Promise.all([
        getConfiguredClasses(),
        getConfiguredSessions(),
      ]);
    } catch {
      dataError =
        'Class or session data could not be loaded. Refresh the page before assigning fees.';
    }
  }

  const assignmentStudents = adminDirectory.students.map(
    ({ id, studentNumber, name, className }): FeeAssignmentStudentPreview => ({
      id,
      studentNumber,
      name,
      className,
    })
  );

  return (
    <div
      style={{
        minHeight: '100dvh',
        backgroundColor: 'var(--color-roles-background)',
        color: 'var(--color-roles-on-background)',
        padding: '24px 16px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '1080px',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
        }}
      >
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            paddingBottom: '16px',
            borderBottom: '1px solid var(--color-roles-outline-variant)',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
                fontSize: 'var(--typography-label-small-fontsize)',
                color: 'var(--color-roles-on-secondary)',
                backgroundColor: 'var(--color-roles-secondary)',
                padding: '2px 8px',
                borderRadius: '4px',
                textTransform: 'uppercase',
                fontWeight: 600,
              }}
            >
              {session.role}
            </span>
          </div>

          <form action="/api/auth/logout" method="POST">
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
              }}
            >
              Sign Out
            </button>
          </form>
        </header>

        <div>
          <Link
            href="/attendance"
            style={{
              fontFamily: 'var(--typography-body-small-fontfamily)',
              fontSize: 'var(--typography-body-small-fontsize)',
              color: 'var(--color-roles-primary)',
              textDecoration: 'none',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            &larr; Back to Staff Dashboard
          </Link>
        </div>

        <div>
          <h1
            style={{
              fontFamily: 'var(--typography-headline-small-fontfamily)',
              fontSize: 'var(--typography-headline-small-fontsize)',
              fontWeight: 700,
              color: 'var(--color-roles-on-surface)',
              margin: '0 0 6px 0',
            }}
          >
            {isAdmin ? 'Fee Management' : 'Student Fee Directory'}
          </h1>
          <p
            style={{
              fontFamily: 'var(--typography-body-medium-fontfamily)',
              fontSize: 'var(--typography-body-medium-fontsize)',
              color: 'var(--color-roles-on-surface-variant)',
              margin: 0,
              maxWidth: '820px',
              lineHeight: 1.6,
            }}
          >
            {isAdmin
              ? 'Record confirmed offline payments, signed fee adjustments, reusable fee templates, and class or individual charges. Every entry posts separately and preserves the existing fee history.'
              : 'Read-only student balance lookup for front-desk operations. Payments and fee adjustments must be recorded by an Admin.'}
          </p>
        </div>

        <PaymentsManager
          mode={isAdmin ? 'admin' : 'frontdesk'}
          initialStudents={directoryStudents}
          directoryError={directoryError}
          initialTemplates={templates}
          assignmentStudents={assignmentStudents}
          classes={classes}
          sessions={sessions}
          storageError={storageError}
          dataError={dataError}
        />

        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <Link
            href="/"
            style={{
              fontFamily: 'var(--typography-body-small-fontfamily)',
              fontSize: 'var(--typography-body-small-fontsize)',
              color: 'var(--color-roles-secondary)',
              textDecoration: 'none',
            }}
          >
            &larr; Back to Landing Page
          </Link>
        </div>
      </div>
    </div>
  );
}
