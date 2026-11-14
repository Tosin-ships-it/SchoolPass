import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { assertAdminSession, getSession } from '@/lib/auth';
import { getAcademicCalendar } from '@/lib/attendance/calendar';
import { SettingsManager } from './SettingsManager';

export const metadata: Metadata = {
  title: 'School Settings | SchoolPass Admin',
};

export default async function SettingsPage() {
  const session = await getSession();

  if (!session || (session.role !== 'staff' && session.role !== 'admin')) {
    redirect('/auth/staff-login?returnUrl=/settings');
  }

  const adminCheck = await assertAdminSession();

  if (!adminCheck.authorized) {
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
            borderRadius: '8px',
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
            Access Restricted
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
            School settings, academic session configurations, and operational settings are restricted
            strictly to Administrator accounts. Teaching staff and front-desk personnel are not
            permitted to modify school configuration.
          </p>
          <div>
            <Link
              href="/attendance"
              style={{
                color: 'var(--color-roles-primary)',
                fontWeight: 600,
                textDecoration: 'none',
                fontSize: '14px',
              }}
            >
              &larr; Return to Staff Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const calendar = await getAcademicCalendar();

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
          maxWidth: '960px',
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

        {/* Breadcrumb / Back Link */}
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

        {/* Page Title & Intro */}
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
            School Settings
          </h1>
          <p
            style={{
              fontFamily: 'var(--typography-body-medium-fontfamily)',
              fontSize: 'var(--typography-body-medium-fontsize)',
              color: 'var(--color-roles-on-surface-variant)',
              margin: 0,
            }}
          >
            Manage academic sessions, term calendars, active school periods, and operational settings.
          </p>
        </div>

        {/* Settings Manager Client Component */}
        <SettingsManager initialCalendar={calendar} />
      </div>
    </div>
  );
}

