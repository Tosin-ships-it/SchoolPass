import type { Metadata } from 'next';
import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession, getParentRequests, getParentStudentLinks } from '@/lib/auth';
import { StudentLinkSection } from './StudentLinkSection';

export const metadata: Metadata = {
  title: "My Child's Records | SchoolPass",
};

export default async function RecordsPage() {
  const session = await getSession();

  if (!session || session.role !== 'parent') {
    redirect('/auth/login?returnUrl=/records');
  }

  const [requests, activeLinks] = await Promise.all([
    getParentRequests(session.userId),
    getParentStudentLinks(session.userId),
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
          maxWidth: '680px',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                fontSize: 'var(--typography-label-small-fontsize)',
                color: 'var(--color-roles-on-surface-variant)',
                padding: '2px 8px',
                backgroundColor: 'var(--color-roles-surface-variant)',
                borderRadius: '4px',
              }}
            >
              Records
            </span>
          </div>

          <nav
            aria-label="Parent top navigation"
            style={{ display: 'flex', alignItems: 'center', gap: '16px' }}
          >
            <Link
              href="/ask"
              style={{
                fontSize: 'var(--typography-label-large-fontfamily)',
                fontSizeAdjust: 'var(--typography-label-large-fontsize)',
                color: 'var(--color-roles-primary)',
                textDecoration: 'none',
                fontWeight: 600,
              }}
            >
              Ask the School
            </Link>

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

        {/* Welcome Section */}
        <div>
          <div style={{ marginBottom: '12px' }}>
            <Link
              href="/ask"
              aria-label="Back to parent dashboard"
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
              &larr; Back to Dashboard
            </Link>
          </div>
          <h1
            style={{
              fontFamily: 'var(--typography-headline-small-fontfamily)',
              fontSize: 'var(--typography-headline-small-fontsize)',
              fontWeight: 700,
              color: 'var(--color-roles-on-surface)',
              margin: '0 0 6px 0',
            }}
          >
            My Child&apos;s Records
          </h1>
          <p
            style={{
              fontFamily: 'var(--typography-body-medium-fontfamily)',
              fontSize: 'var(--typography-body-medium-fontsize)',
              color: 'var(--color-roles-on-surface-variant)',
              margin: 0,
            }}
          >
            Welcome, {session.user.name}. View your verified children&apos;s records or submit your child&apos;s Student
            Number for staff approval.
          </p>
        </div>

        {/* Interactive Student Linking & Request Tracking */}
        <StudentLinkSection initialRequests={requests} initialActiveLinks={activeLinks} />

        {/* Footer Navigation */}
        <div style={{ textAlign: 'center', marginTop: '16px' }}>
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
