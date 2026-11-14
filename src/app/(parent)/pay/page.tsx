import type { Metadata } from 'next';
import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { ParentPayPortal } from './ParentPayPortal';

export const metadata: Metadata = {
  title: 'Fee Management & Payments | SchoolPass',
  description: 'View child fee obligations, term arrears breakdown, and pay school fees online securely.',
};

export default async function ParentPayPage() {
  const session = await getSession();

  if (!session || session.role !== 'parent') {
    redirect('/auth/login?returnUrl=/pay');
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
                fontWeight: 600,
              }}
            >
              Fees &amp; Payments
            </span>
          </div>

          <nav
            aria-label="Parent top navigation"
            style={{ display: 'flex', alignItems: 'center', gap: '16px' }}
          >
            <Link
              href="/ask"
              style={{
                fontSize: '14px',
                color: 'var(--color-roles-primary)',
                textDecoration: 'none',
                fontWeight: 600,
              }}
            >
              Ask the School
            </Link>
            <Link
              href="/records"
              style={{
                fontSize: '14px',
                color: 'var(--color-roles-primary)',
                textDecoration: 'none',
                fontWeight: 600,
              }}
            >
              Records
            </Link>

            <form action="/api/auth/logout" method="POST">
              <button
                type="submit"
                style={{
                  fontSize: '14px',
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

        {/* Header Greeting */}
        <div>
          <div style={{ marginBottom: '12px' }}>
            <Link
              href="/records"
              style={{
                fontSize: '13px',
                color: 'var(--color-roles-primary)',
                textDecoration: 'none',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              &larr; Back to My Child&apos;s Records
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
            School Fees &amp; Online Payments
          </h1>
          <p
            style={{
              fontSize: '14px',
              color: 'var(--color-roles-on-surface-variant)',
              margin: 0,
            }}
          >
            Welcome, {session.user.name}. View outstanding fee obligations, itemized levies, and pay securely online via Flutterwave.
          </p>
        </div>

        {/* Main Portal View */}
        <ParentPayPortal />

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '13px' }}>
          <Link
            href="/"
            style={{
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

