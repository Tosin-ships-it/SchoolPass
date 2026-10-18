import type { Metadata } from 'next';
import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Staff Attendance',
};

export default async function StaffAttendancePage() {
  const session = await getSession();

  if (!session || (session.role !== 'staff' && session.role !== 'admin')) {
    redirect('/auth/staff-login?returnUrl=/attendance');
  }

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
          maxWidth: '720px',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
        }}
      >
        {/* Navigation Bar */}
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingBottom: '16px',
            borderBottom: '1px solid var(--color-roles-outline-variant)',
          }}
        >
          <div>
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
                marginLeft: '8px',
                fontSize: 'var(--typography-label-small-fontsize)',
                color: 'var(--color-roles-on-secondary)',
                backgroundColor: 'var(--color-roles-secondary)',
                padding: '2px 8px',
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
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Sign Out
            </button>
          </form>
        </header>

        {/* Welcome Banner */}
        <div
          style={{
            backgroundColor: 'var(--color-roles-surface)',
            border: '1px solid var(--color-roles-outline-color)',
            boxShadow: 'var(--effect-soft-shadow)',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <h1
            style={{
              fontFamily: 'var(--typography-headline-small-fontfamily)',
              fontSize: 'var(--typography-headline-small-fontsize)',
              fontWeight: 600,
              color: 'var(--color-roles-on-surface)',
              margin: 0,
            }}
          >
            Staff &amp; Admin Interface
          </h1>

          <p
            style={{
              fontFamily: 'var(--typography-body-medium-fontfamily)',
              fontSize: 'var(--typography-body-medium-fontsize)',
              color: 'var(--color-roles-on-surface-variant)',
              margin: 0,
            }}
          >
            Signed in as <strong>{session.user.name}</strong> ({session.user.email}).
          </p>

          <p
            style={{
              fontFamily: 'var(--typography-body-small-fontfamily)',
              fontSize: 'var(--typography-body-small-fontsize)',
              color: 'var(--color-roles-on-surface-variant)',
              margin: 0,
              lineHeight: 'var(--typography-body-small-lineheight)',
            }}
          >
            You have access to school operations, attendance recording, arrival codes, payment verification, and guardian linking based on your assigned role.
          </p>
        </div>

        {/* Staff Capabilities Overview according to PRD §7.1 and Addendum §8.3 */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '14px',
          }}
        >
          <div
            style={{
              padding: '16px',
              backgroundColor: 'var(--color-roles-surface)',
              border: '1px solid var(--color-roles-outline-color)',
            }}
          >
            <h3 style={{ fontSize: '15px', color: 'var(--color-roles-primary)', marginBottom: '4px' }}>
              Attendance
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--color-roles-on-surface-variant)' }}>
              Record manual attendance and resolve unresolved student records.
            </p>
          </div>

          <div
            style={{
              padding: '16px',
              backgroundColor: 'var(--color-roles-surface)',
              border: '1px solid var(--color-roles-outline-color)',
            }}
          >
            <h3 style={{ fontSize: '15px', color: 'var(--color-roles-primary)', marginBottom: '4px' }}>
              Arrival Codes
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--color-roles-on-surface-variant)' }}>
              Display daily QR code and 6-digit manual fallback code for gate drop-offs.
            </p>
          </div>

          <Link
            href="/guardian-links"
            style={{
              padding: '16px',
              backgroundColor: 'var(--color-roles-surface)',
              border: '1px solid var(--color-roles-outline-color)',
              textDecoration: 'none',
              display: 'block',
            }}
          >
            <h3 style={{ fontSize: '15px', color: 'var(--color-roles-primary)', marginBottom: '4px' }}>
              Guardian Links &rarr;
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--color-roles-on-surface-variant)', margin: 0 }}>
              Review parent linking requests and manage verified student links.
            </p>
          </Link>
        </div>

        <div style={{ textAlign: 'center', marginTop: '12px' }}>
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
        </div>
      </div>
    </div>
  );
}
