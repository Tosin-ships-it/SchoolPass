import type { Metadata } from 'next';
import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  getSession,
  assertFrontDeskAccess,
  getIntendingStudents,
  getAllStaffUsers,
} from '@/lib/auth';
import { StudentsManager } from './StudentsManager';

export const metadata: Metadata = {
  title: 'Prospective Students Intake | SchoolPass Staff',
};

export default async function StudentsPage() {
  const session = await getSession();

  if (!session || (session.role !== 'staff' && session.role !== 'admin')) {
    redirect('/auth/staff-login?returnUrl=/students');
  }

  const authCheck = await assertFrontDeskAccess();

  // If authenticated as staff but lacks front-desk permissions
  if (!authCheck.authorized) {
    return (
      <div
        style={{
          minHeight: '100dvh',
          backgroundColor: 'var(--color-roles-background)',
          color: 'var(--color-roles-on-background)',
          padding: '32px 16px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            maxWidth: '520px',
            width: '100%',
            backgroundColor: 'var(--color-roles-surface-container)',
            borderRadius: '12px',
            padding: '32px',
            border: '1px solid var(--color-roles-outline-variant)',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          <div
            style={{
              fontSize: '32px',
              margin: '0 auto',
            }}
          >
            🔒
          </div>
          <h1
            style={{
              fontFamily: 'var(--typography-headline-small-fontfamily)',
              fontSize: 'var(--typography-headline-small-fontsize)',
              fontWeight: 700,
              color: 'var(--color-roles-error)',
              margin: 0,
            }}
          >
            Access Restricted
          </h1>
          <p
            style={{
              fontFamily: 'var(--typography-body-medium-fontfamily)',
              fontSize: 'var(--typography-body-medium-fontsize)',
              color: 'var(--color-roles-on-surface-variant)',
              lineHeight: 1.5,
              margin: 0,
            }}
          >
            Your staff account does not have front-desk registration permissions. Teaching staff are restricted to classroom attendance workflows by default. Please contact an Administrator to request front-desk access.
          </p>
          <div style={{ marginTop: '12px' }}>
            <Link
              href="/attendance"
              style={{
                display: 'inline-block',
                padding: '10px 20px',
                backgroundColor: 'var(--color-roles-primary)',
                color: 'var(--color-roles-on-primary)',
                borderRadius: '8px',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              &larr; Return to Attendance Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const [initialStudents, staffList] = await Promise.all([
    getIntendingStudents(),
    session.role === 'admin' ? getAllStaffUsers() : Promise.resolve([]),
  ]);

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
          maxWidth: '860px',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
        }}
      >
        {/* Navigation Header */}
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingBottom: '16px',
            borderBottom: '1px solid var(--color-roles-outline-variant)',
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
              Front Desk ({session.role})
            </span>
          </div>

          <nav
            aria-label="Staff quick navigation"
            style={{ display: 'flex', alignItems: 'center', gap: '16px' }}
          >
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
          </nav>
        </header>

        {/* Quick Back Links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
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
          <span style={{ color: 'var(--color-roles-outline-variant)' }}>|</span>
          <Link
            href="/guardian-links"
            style={{
              fontFamily: 'var(--typography-body-small-fontfamily)',
              fontSize: 'var(--typography-body-small-fontsize)',
              color: 'var(--color-roles-secondary)',
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            Guardian Links
          </Link>
        </div>

        {/* Page Title & Scope */}
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
            Front-Desk Prospective Student Intake
          </h1>
          <p
            style={{
              fontFamily: 'var(--typography-body-medium-fontfamily)',
              fontSize: 'var(--typography-body-medium-fontsize)',
              color: 'var(--color-roles-on-surface-variant)',
              margin: 0,
            }}
          >
            Register prospective students, atomically allocate unique official identifiers (SP-YYYY-NNNN), and issue intake slips prior to formal admission.
          </p>
        </div>

        {/* Interactive Intake & Directory Manager */}
        <StudentsManager
          initialStudents={initialStudents}
          staffRole={session.role}
          staffList={staffList}
        />

        {/* Footer Navigation */}
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
