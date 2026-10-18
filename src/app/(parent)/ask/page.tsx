import type { Metadata } from 'next';
import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Ask the School',
};

export default async function AskPage() {
  const session = await getSession();

  if (!session || session.role !== 'parent') {
    redirect('/auth/login?returnUrl=/ask');
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
          maxWidth: '640px',
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
                color: 'var(--color-roles-primary)',
              }}
            >
              SchoolPass
            </span>
            <span
              style={{
                marginLeft: '8px',
                fontSize: 'var(--typography-label-small-fontsize)',
                color: 'var(--color-roles-on-surface-variant)',
                padding: '2px 8px',
                backgroundColor: 'var(--color-roles-surface-variant)',
              }}
            >
              Parent Portal
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
            Welcome, {session.user.name}
          </h1>

          <p
            style={{
              fontFamily: 'var(--typography-body-medium-fontfamily)',
              fontSize: 'var(--typography-body-medium-fontsize)',
              color: 'var(--color-roles-on-surface-variant)',
              margin: 0,
            }}
          >
            Signed in as <strong>{session.user.email}</strong>.
          </p>

          {/* Unlinked status notice according to Addendum §5.2 */}
          {!session.isLinked ? (
            <div
              style={{
                marginTop: '8px',
                padding: '16px',
                backgroundColor: 'var(--color-roles-primary-container)',
                border: '1px solid var(--color-roles-outline-color)',
                color: 'var(--color-roles-on-primary-container)',
                fontSize: 'var(--typography-body-medium-fontsize)',
                lineHeight: 'var(--typography-body-medium-lineheight)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div>
                <strong>Status: Account Verified.</strong> Your parent account is active. To access your child&apos;s
                records and attendance, submit your child&apos;s Student Number for staff verification.
              </div>
              <div>
                <Link
                  href="/records"
                  style={{
                    display: 'inline-block',
                    fontSize: '13px',
                    fontWeight: 700,
                    color: 'var(--color-roles-on-primary-container)',
                    textDecoration: 'underline',
                  }}
                >
                  Link your child via Student Number &rarr;
                </Link>
              </div>
            </div>
          ) : (
            <div
              style={{
                marginTop: '8px',
                padding: '14px',
                backgroundColor: 'var(--color-roles-surface-variant)',
                border: '1px solid var(--color-roles-outline-color)',
                fontSize: 'var(--typography-body-medium-fontsize)',
                color: 'var(--color-roles-on-surface)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '8px',
              }}
            >
              <div>
                <strong>Status: Linked Guardian.</strong> You have active student links associated with your account.
              </div>
              <Link
                href="/records"
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--color-roles-primary)',
                  textDecoration: 'none',
                }}
              >
                View Records &rarr;
              </Link>
            </div>
          )}
        </div>

        {/* Feature Navigation Links */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '14px',
          }}
        >
          <div
            style={{
              padding: '18px',
              backgroundColor: 'var(--color-roles-surface)',
              border: '1px solid var(--color-roles-outline-color)',
            }}
          >
            <h2
              style={{
                fontFamily: 'var(--typography-title-medium-fontfamily)',
                fontSize: 'var(--typography-title-medium-fontsize)',
                fontWeight: 600,
                color: 'var(--color-roles-primary)',
                marginBottom: '6px',
              }}
            >
              F-1 Ask the School
            </h2>
            <p
              style={{
                fontFamily: 'var(--typography-body-small-fontfamily)',
                fontSize: 'var(--typography-body-small-fontsize)',
                color: 'var(--color-roles-on-surface-variant)',
                marginBottom: '12px',
              }}
            >
              Ask questions about school policies, uniform guidelines, term schedules, and closing times.
            </p>
            <span
              style={{
                fontSize: 'var(--typography-label-small-fontsize)',
                color: 'var(--color-roles-primary)',
                fontWeight: 600,
              }}
            >
              Active Feature
            </span>
          </div>

          <div
            style={{
              padding: '18px',
              backgroundColor: 'var(--color-roles-surface)',
              border: '1px solid var(--color-roles-outline-color)',
            }}
          >
            <h2
              style={{
                fontFamily: 'var(--typography-title-medium-fontfamily)',
                fontSize: 'var(--typography-title-medium-fontsize)',
                fontWeight: 600,
                color: 'var(--color-roles-on-surface)',
                marginBottom: '6px',
              }}
            >
              F-2 Child Records &amp; Attendance
            </h2>
            <p
              style={{
                fontFamily: 'var(--typography-body-small-fontfamily)',
                fontSize: 'var(--typography-body-small-fontsize)',
                color: 'var(--color-roles-on-surface-variant)',
                marginBottom: '12px',
              }}
            >
              {session.isLinked
                ? "View your child's verified attendance figures, fee balance, and enrollment."
                : 'Link your child via Student Number to view attendance and records.'}
            </p>
            <Link
              href="/records"
              style={{
                fontSize: 'var(--typography-label-small-fontsize)',
                color: 'var(--color-roles-primary)',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              {session.isLinked ? 'Access Records &rarr;' : 'Link Child &rarr;'}
            </Link>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: '12px' }}>
          <Link
            href="/"
            style={{
              fontSize: 'var(--typography-body-small-fontsize)',
              color: 'var(--color-roles-primary)',
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
