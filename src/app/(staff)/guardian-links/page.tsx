import type { Metadata } from 'next';
import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession, getStaffLinkRequests, listAllGuardianLinks } from '@/lib/auth';
import { GuardianLinksManager } from './GuardianLinksManager';

export const metadata: Metadata = {
  title: 'Guardian Links | SchoolPass Staff',
};

export default async function GuardianLinksPage() {
  const session = await getSession();

  if (!session || (session.role !== 'staff' && session.role !== 'admin')) {
    redirect('/auth/staff-login?returnUrl=/guardian-links');
  }

  const [requests, activeLinks] = await Promise.all([
    getStaffLinkRequests(),
    listAllGuardianLinks(),
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
          maxWidth: '840px',
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
              {session.role}
            </span>
          </div>

          <nav
            aria-label="Staff quick navigation"
            style={{ display: 'flex', alignItems: 'center', gap: '16px' }}
          >
            <Link
              href="/attendance"
              style={{
                fontSize: 'var(--typography-label-large-fontsize)',
                color: 'var(--color-roles-primary)',
                textDecoration: 'none',
                fontWeight: 600,
              }}
            >
              Attendance
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
            Guardian Links Management
          </h1>
          <p
            style={{
              fontFamily: 'var(--typography-body-medium-fontfamily)',
              fontSize: 'var(--typography-body-medium-fontsize)',
              color: 'var(--color-roles-on-surface-variant)',
              margin: 0,
            }}
          >
            Review pending parent student link requests and manage authorized parent-to-student records.
          </p>
        </div>

        {/* Interactive Manager */}
        <GuardianLinksManager
          initialRequests={requests}
          initialActiveLinks={activeLinks}
          staffRole={session.role}
        />

        {/* Back Link */}
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
