import type { Metadata } from 'next';
import React from 'react';
import Link from 'next/link';
import { getSession } from '@/lib/auth';

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://schoolpass.ng';

export const metadata: Metadata = {
  title: 'SchoolPass',
  description: 'Private school parent portal',
  alternates: {
    canonical: baseUrl,
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: 'website',
    url: baseUrl,
    title: 'SchoolPass',
    description: 'Private school parent portal',
    siteName: 'SchoolPass',
    locale: 'en_NG',
  },
  twitter: {
    card: 'summary',
    title: 'SchoolPass',
    description: 'Private school parent portal',
  },
};

function PrivacyView() {
  return (
    <div
      style={{
        width: '100%',
        padding: '40px 0 64px',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ marginBottom: '20px' }}>
        <Link
          href="/"
          className="sp-text-link"
          aria-label="Back to home page"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            color: 'var(--color-roles-primary)',
            textDecoration: 'none',
            fontWeight: 600,
            fontFamily: 'var(--typography-label-large-fontfamily)',
            fontSize: 'var(--typography-label-large-fontsize)',
          }}
        >
          &larr; Back to Home
        </Link>
      </div>
      <article
        className="sp-card"
        aria-label="Privacy Policy"
        style={{
          backgroundColor: 'var(--color-roles-surface)',
          border: '1px solid var(--color-roles-outline-color)',
          boxShadow: 'var(--effect-soft-shadow)',
          padding: '40px 32px',
          borderRadius: '0.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
        }}
      >
        <div>
          <div
            style={{
              fontFamily: 'var(--typography-label-medium-fontfamily)',
              fontSize: 'var(--typography-label-medium-fontsize)',
              fontWeight: 700,
              color: 'var(--color-roles-primary)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '8px',
            }}
          >
            Legal &amp; Compliance
          </div>
          <h1
            style={{
              fontFamily: 'var(--typography-display-small-fontfamily)',
              fontSize: 'var(--typography-headline-large-fontsize)',
              fontWeight: 700,
              color: 'var(--color-roles-on-surface)',
              margin: 0,
              lineHeight: 1.25,
            }}
          >
            Privacy Policy
          </h1>
          <p
            style={{
              fontSize: 'var(--typography-body-small-fontsize)',
              color: 'var(--color-roles-on-surface-variant)',
              marginTop: '8px',
              marginBottom: 0,
            }}
          >
            Effective Date: October 2026 &bull; Governing Law: Nigeria Data Protection Act (NDPA) 2023
          </p>
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid var(--color-roles-outline-variant)', margin: 0 }} />

        <section style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <h2 style={{ fontSize: 'var(--typography-title-large-fontsize)', fontWeight: 600, color: 'var(--color-roles-on-surface)', margin: 0 }}>
            1. Introduction &amp; Scope
          </h2>
          <p style={{ lineHeight: 1.7, margin: 0, color: 'var(--color-roles-on-surface-variant)' }}>
            SchoolPass provides a dedicated private web portal for registered parents, guardians, and verified school staff. Our mission is to provide one secure, direct place for parents to ask school questions, view verified student records, confirm morning gate arrival, pay school fees, and reach the school office.
          </p>
          <p style={{ lineHeight: 1.7, margin: 0, color: 'var(--color-roles-on-surface-variant)' }}>
            We protect user privacy and student educational data in strict compliance with the <strong>Nigeria Data Protection Act (NDPA) 2023</strong> and the <strong>Nigeria Data Protection Regulation (NDPR)</strong>.
          </p>
        </section>

        <section style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <h2 style={{ fontSize: 'var(--typography-title-large-fontsize)', fontWeight: 600, color: 'var(--color-roles-on-surface)', margin: 0 }}>
            2. Principles of Lawful Processing
          </h2>
          <p style={{ lineHeight: 1.7, margin: 0, color: 'var(--color-roles-on-surface-variant)' }}>
            In accordance with Section 24 of the NDPA 2023, data processing follows core statutory principles:
          </p>
          <ul style={{ paddingLeft: '24px', lineHeight: 1.7, margin: 0, color: 'var(--color-roles-on-surface-variant)' }}>
            <li><strong>Lawfulness &amp; Transparency:</strong> Information is collected only for legitimate educational and administrative purposes.</li>
            <li><strong>Purpose Limitation:</strong> Personal data is processed solely for school communication, attendance verification, and fee reconciliation.</li>
            <li><strong>Data Minimization:</strong> Only data strictly necessary for portal functionality is stored.</li>
            <li><strong>Integrity &amp; Confidentiality:</strong> Robust technical controls prevent unauthorized disclosure or access.</li>
          </ul>
        </section>

        <section style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <h2 style={{ fontSize: 'var(--typography-title-large-fontsize)', fontWeight: 600, color: 'var(--color-roles-on-surface)', margin: 0 }}>
            3. Strict Structural Boundary: AI &amp; Private Child Records
          </h2>
          <p style={{ lineHeight: 1.7, margin: 0, color: 'var(--color-roles-on-surface-variant)' }}>
            The primary architectural guarantee of SchoolPass is the absolute structural segregation between public school information and private child records:
          </p>
          <ul style={{ paddingLeft: '24px', lineHeight: 1.7, margin: 0, color: 'var(--color-roles-on-surface-variant)' }}>
            <li>Our automated answering pipeline (&quot;Ask the School&quot;) reads exclusively from approved, general school documentation (calendars, uniform policies, closing times).</li>
            <li><strong>No student record, fee balance, payment reference, attendance figure, or guardian detail is ever shared with or processed by artificial intelligence models.</strong></li>
            <li>All private student records are retrieved directly from the primary relational database only after verifying server-side guardian authorization.</li>
          </ul>
        </section>

        <section style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <h2 style={{ fontSize: 'var(--typography-title-large-fontsize)', fontWeight: 600, color: 'var(--color-roles-on-surface)', margin: 0 }}>
            4. Child Data Protection &amp; Guardian Linking
          </h2>
          <p style={{ lineHeight: 1.7, margin: 0, color: 'var(--color-roles-on-surface-variant)' }}>
            In compliance with Section 31 of the NDPA 2023 regarding child data protection:
          </p>
          <ul style={{ paddingLeft: '24px', lineHeight: 1.7, margin: 0, color: 'var(--color-roles-on-surface-variant)' }}>
            <li><strong>No parent self-service linking exists.</strong> Parent-student links can only be authorized and created by designated School Staff or Administrators.</li>
            <li>Every access request to a child&apos;s record undergoes independent server-side verification that the authenticated user possesses an active guardian link.</li>
          </ul>
        </section>

        <section style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <h2 style={{ fontSize: 'var(--typography-title-large-fontsize)', fontWeight: 600, color: 'var(--color-roles-on-surface)', margin: 0 }}>
            5. Financial Data &amp; Electronic Payments
          </h2>
          <p style={{ lineHeight: 1.7, margin: 0, color: 'var(--color-roles-on-surface-variant)' }}>
            Fee payments in Nigerian Naira (NGN) are processed through Flutterwave, a PCI-DSS certified and CBN-licensed payment partner. SchoolPass does not store credit or debit card numbers on its servers. Fee balances update exclusively after cryptographic server-side payment verification.
          </p>
        </section>

        <section style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <h2 style={{ fontSize: 'var(--typography-title-large-fontsize)', fontWeight: 600, color: 'var(--color-roles-on-surface)', margin: 0 }}>
            6. Retention &amp; Data Subject Rights
          </h2>
          <p style={{ lineHeight: 1.7, margin: 0, color: 'var(--color-roles-on-surface-variant)' }}>
            Official attendance and financial audit logs are retained for seven (7) years in compliance with Nigerian school audit and NDPR regulations. Under Part V of the NDPA 2023, data subjects retain the right to request access, rectification, or restriction of their personal data, or to lodge inquiries with the <strong>Nigeria Data Protection Commission (NDPC)</strong>.
          </p>
        </section>
      </article>
    </div>
  );
}

function TermsView() {
  return (
    <div
      style={{
        width: '100%',
        padding: '40px 0 64px',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ marginBottom: '20px' }}>
        <Link
          href="/"
          className="sp-text-link"
          aria-label="Back to home page"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            color: 'var(--color-roles-primary)',
            textDecoration: 'none',
            fontWeight: 600,
            fontFamily: 'var(--typography-label-large-fontfamily)',
            fontSize: 'var(--typography-label-large-fontsize)',
          }}
        >
          &larr; Back to Home
        </Link>
      </div>
      <article
        className="sp-card"
        aria-label="Terms of Service"
        style={{
          backgroundColor: 'var(--color-roles-surface)',
          border: '1px solid var(--color-roles-outline-color)',
          boxShadow: 'var(--effect-soft-shadow)',
          padding: '40px 32px',
          borderRadius: '0.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
        }}
      >
        <div>
          <div
            style={{
              fontFamily: 'var(--typography-label-medium-fontfamily)',
              fontSize: 'var(--typography-label-medium-fontsize)',
              fontWeight: 700,
              color: 'var(--color-roles-primary)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '8px',
            }}
          >
            Terms &amp; Conditions
          </div>
          <h1
            style={{
              fontFamily: 'var(--typography-display-small-fontfamily)',
              fontSize: 'var(--typography-headline-large-fontsize)',
              fontWeight: 700,
              color: 'var(--color-roles-on-surface)',
              margin: 0,
              lineHeight: 1.25,
            }}
          >
            Terms of Service
          </h1>
          <p
            style={{
              fontSize: 'var(--typography-body-small-fontsize)',
              color: 'var(--color-roles-on-surface-variant)',
              marginTop: '8px',
              marginBottom: 0,
            }}
          >
            Effective Date: October 2026 &bull; Governing Law: Laws of the Federal Republic of Nigeria
          </p>
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid var(--color-roles-outline-variant)', margin: 0 }} />

        <section style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <h2 style={{ fontSize: 'var(--typography-title-large-fontsize)', fontWeight: 600, color: 'var(--color-roles-on-surface)', margin: 0 }}>
            1. Acceptance of Terms
          </h2>
          <p style={{ lineHeight: 1.7, margin: 0, color: 'var(--color-roles-on-surface-variant)' }}>
            By registering, logging in, or using SchoolPass, you agree to these Terms of Service under the laws of the Federal Republic of Nigeria. SchoolPass is a private single-school platform intended solely for authorized parents, legal guardians, and school staff.
          </p>
        </section>

        <section style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <h2 style={{ fontSize: 'var(--typography-title-large-fontsize)', fontWeight: 600, color: 'var(--color-roles-on-surface)', margin: 0 }}>
            2. Account Registration &amp; Student Linkage
          </h2>
          <p style={{ lineHeight: 1.7, margin: 0, color: 'var(--color-roles-on-surface-variant)' }}>
            Users must provide accurate information. Under the <strong>Cybercrimes (Prohibition, Prevention, etc.) Act 2015</strong> and <strong>NDPA 2023</strong>, claiming or attempting to access student records without verified authorization is prohibited. Student links are created solely by school staff following verified identity confirmation.
          </p>
        </section>

        <section style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <h2 style={{ fontSize: 'var(--typography-title-large-fontsize)', fontWeight: 600, color: 'var(--color-roles-on-surface)', margin: 0 }}>
            3. Attendance as Source of Truth
          </h2>
          <p style={{ lineHeight: 1.7, margin: 0, color: 'var(--color-roles-on-surface-variant)' }}>
            Staff-recorded daily attendance is the official legal source of truth. Gate arrival confirmations made by parents via morning QR codes or manual codes serve as auxiliary drop-off logs and do not override official staff attendance marks.
          </p>
        </section>

        <section style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <h2 style={{ fontSize: 'var(--typography-title-large-fontsize)', fontWeight: 600, color: 'var(--color-roles-on-surface)', margin: 0 }}>
            4. Fee Obligations &amp; Payments
          </h2>
          <p style={{ lineHeight: 1.7, margin: 0, color: 'var(--color-roles-on-surface-variant)' }}>
            All fees are denominated in Nigerian Naira (NGN) and payable through Flutterwave. In accordance with Central Bank of Nigeria (CBN) regulations, fee balances decrement only after cryptographic server-side and webhook confirmation. Artificial intelligence is never permitted to calculate or state fee balances.
          </p>
        </section>

        <section style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <h2 style={{ fontSize: 'var(--typography-title-large-fontsize)', fontWeight: 600, color: 'var(--color-roles-on-surface)', margin: 0 }}>
            5. AI Answers &amp; WhatsApp Office Escalation
          </h2>
          <p style={{ lineHeight: 1.7, margin: 0, color: 'var(--color-roles-on-surface-variant)' }}>
            &quot;Ask the School&quot; offers fast reference answers from approved literature but does not replace formal administrative circulars. Complex or unanswered queries escalate directly to the school Front Desk Officer on WhatsApp.
          </p>
        </section>

        <section style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <h2 style={{ fontSize: 'var(--typography-title-large-fontsize)', fontWeight: 600, color: 'var(--color-roles-on-surface)', margin: 0 }}>
            6. Governing Law &amp; Dispute Resolution
          </h2>
          <p style={{ lineHeight: 1.7, margin: 0, color: 'var(--color-roles-on-surface-variant)' }}>
            These Terms are governed by the laws of the <strong>Federal Republic of Nigeria</strong>. Disputes shall be resolved through good-faith mediation with school leadership before submission to Nigerian courts of competent jurisdiction.
          </p>
        </section>
      </article>
    </div>
  );
}

export default async function HomePage({
  searchParams,
}: {
  searchParams?: Promise<{ view?: string }>;
}) {
  const session = await getSession();
  const resolvedParams = searchParams ? await searchParams : undefined;
  const currentView = resolvedParams?.view;

  return (
    <div
      style={{
        minHeight: '100dvh',
        width: '100%',
        maxWidth: '1040px',
        margin: '0 auto',
        padding: '0 20px',
        boxSizing: 'border-box',
        backgroundColor: 'var(--color-roles-background)',
        color: 'var(--color-roles-on-background)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* ========================================================
          Interactive Hover States (Design System Tokens)
          ======================================================== */}
      <style>{`
        .sp-btn-primary {
          transition: background-color 0.18s ease, box-shadow 0.18s ease, transform 0.15s ease;
        }
        .sp-btn-primary:hover {
          background-color: var(--primitives-color-palettes-primary-primary30) !important;
          box-shadow: var(--effect-medium-shadow) !important;
          transform: translateY(-1px);
        }
        .sp-btn-primary:active {
          transform: translateY(0);
          box-shadow: var(--effect-soft-shadow) !important;
        }

        .sp-btn-secondary {
          transition: background-color 0.18s ease, color 0.18s ease, box-shadow 0.18s ease, transform 0.15s ease;
        }
        .sp-btn-secondary:hover {
          background-color: var(--color-roles-surface-container-highest) !important;
          color: var(--color-roles-on-surface) !important;
          box-shadow: var(--effect-soft-shadow) !important;
          transform: translateY(-1px);
        }
        .sp-btn-secondary:active {
          transform: translateY(0);
        }

        .sp-card {
          transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.22s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.18s ease;
          border-radius: 0.5rem;
        }
        .sp-card:hover {
          transform: translateY(-3px);
          box-shadow: var(--effect-medium-shadow) !important;
          border-color: var(--color-roles-primary-fixed-dim) !important;
        }

        .sp-text-link {
          transition: color 0.18s ease, opacity 0.18s ease;
        }
        .sp-text-link:hover {
          color: var(--color-roles-primary) !important;
          opacity: 0.9;
        }

        /* Responsive Navigation (Desktop vs Mobile Full-Screen Slider) */
        .sp-desktop-nav {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .sp-mobile-nav {
          display: none;
        }

        .sp-hamburger-btn {
          cursor: pointer;
          user-select: none;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 42px;
          height: 42px;
          border-radius: 0.5rem;
          border: 1px solid var(--color-roles-outline-color);
          background-color: var(--color-roles-surface);
          color: var(--color-roles-on-surface);
          box-shadow: var(--effect-soft-shadow);
          transition: background-color 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
        }
        .sp-hamburger-btn:hover {
          background-color: var(--color-roles-surface-variant);
          border-color: var(--color-roles-primary);
        }
        .sp-hamburger-btn:active {
          transform: scale(0.96);
        }

        /* Full Screen Slider (Slides in from the right) */
        .sp-mobile-slider {
          position: fixed;
          top: 0;
          right: 0;
          bottom: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          height: 100dvh;
          background-color: var(--color-roles-surface);
          z-index: 9999;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          transform: translateX(100%);
          transition: transform 0.32s cubic-bezier(0.16, 1, 0.3, 1), visibility 0.32s ease;
          visibility: hidden;
          pointer-events: none;
          box-sizing: border-box;
          overflow-y: auto;
        }

        #sp-mobile-slider-toggle:checked ~ .sp-mobile-slider {
          transform: translateX(0);
          visibility: visible;
          pointer-events: auto;
        }

        .sp-slider-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          width: 100%;
          box-sizing: border-box;
          border-bottom: 1px solid var(--color-roles-outline-variant);
        }

        .sp-close-btn {
          cursor: pointer;
          user-select: none;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 42px;
          height: 42px;
          border-radius: 0.5rem;
          border: 1px solid var(--color-roles-outline-color);
          background-color: var(--color-roles-surface);
          color: var(--color-roles-on-surface);
          box-shadow: var(--effect-soft-shadow);
          transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease, transform 0.15s ease;
        }
        .sp-close-btn:hover {
          background-color: var(--color-roles-surface-variant);
          border-color: var(--color-roles-primary);
          color: var(--color-roles-primary);
        }
        .sp-close-btn:active {
          transform: scale(0.96);
        }

        .sp-slider-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 24px;
          gap: 28px;
          text-align: center;
          box-sizing: border-box;
        }

        .sp-slider-footer {
          padding: 24px 20px;
          display: flex;
          justify-content: center;
          gap: 20px;
          border-top: 1px solid var(--color-roles-outline-variant);
          box-sizing: border-box;
        }

        @media (max-width: 640px) {
          .sp-desktop-nav {
            display: none !important;
          }
          .sp-mobile-nav {
            display: block !important;
          }
        }
      `}</style>

      {/* ========================================================
          1. APPLICATION HEADER (Defines Primary Project Margins)
          ======================================================== */}
      <header
        style={{
          width: '100%',
          backgroundColor: 'var(--color-roles-background)',
          position: 'sticky',
          top: 0,
          zIndex: 10,
          padding: '16px 0',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Link
              href="/"
              className="sp-text-link"
              style={{ textDecoration: 'none' }}
              aria-label="SchoolPass home"
            >
              <span
                style={{
                  fontFamily: 'var(--typography-title-large-fontfamily)',
                  fontSize: 'var(--typography-title-large-fontsize)',
                  fontWeight: 700,
                  color: 'var(--color-roles-primary)',
                  letterSpacing: '-0.04em',
                }}
              >
                SchoolPass
              </span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav aria-label="Main Navigation" className="sp-desktop-nav">
            {session ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span
                  style={{
                    fontFamily: 'var(--typography-body-small-fontfamily)',
                    fontSize: 'var(--typography-body-small-fontsize)',
                    color: 'var(--color-roles-on-surface-variant)',
                    display: 'none',
                  }}
                >
                  {session.user.name}
                </span>
                <Link
                  href={session.role === 'parent' ? '/ask' : '/attendance'}
                  className="sp-btn-primary"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'var(--color-roles-primary)',
                    color: 'var(--color-roles-on-primary)',
                    fontFamily: 'var(--typography-label-large-fontfamily)',
                    fontSize: 'var(--typography-label-large-fontsize)',
                    fontWeight: 600,
                    padding: '12px 24px',
                    boxShadow: 'var(--effect-soft-shadow)',
                    textDecoration: 'none',
                    borderRadius: '0.5rem',
                  }}
                >
                  Go to Portal
                </Link>
              </div>
            ) : (
              <Link
                href="/auth/register"
                className="sp-btn-primary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'var(--color-roles-primary)',
                  color: 'var(--color-roles-on-primary)',
                  fontFamily: 'var(--typography-label-large-fontfamily)',
                  fontSize: 'var(--typography-label-large-fontsize)',
                  fontWeight: 600,
                  padding: '12px 24px',
                  boxShadow: 'var(--effect-soft-shadow)',
                  textDecoration: 'none',
                  borderRadius: '0.5rem',
                }}
              >
                Get Started
              </Link>
            )}
          </nav>

          {/* Mobile Navigation (Hamburger + Full Screen Slider) */}
          <nav aria-label="Mobile Navigation" className="sp-mobile-nav">
            <input
              type="checkbox"
              id="sp-mobile-slider-toggle"
              aria-hidden="true"
              tabIndex={-1}
              style={{ display: 'none' }}
            />

            {/* Hamburger Icon Button on Right Side */}
            <label
              htmlFor="sp-mobile-slider-toggle"
              className="sp-hamburger-btn"
              role="button"
              tabIndex={0}
              aria-label="Open navigation menu"
              aria-controls="sp-mobile-slider-drawer"
            >
              <svg
                aria-hidden="true"
                focusable="false"
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="4" y1="6" x2="20" y2="6" />
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="18" x2="20" y2="18" />
              </svg>
            </label>

            {/* Full Screen Slider (Slides in from the right) */}
            <div
              id="sp-mobile-slider-drawer"
              className="sp-mobile-slider"
              role="dialog"
              aria-modal="true"
              aria-label="Mobile navigation menu"
            >
              {/* Slider Header with X Close Button */}
              <div className="sp-slider-header">
                <Link
                  href="/"
                  className="sp-text-link"
                  style={{ textDecoration: 'none' }}
                  aria-label="SchoolPass home"
                >
                  <span
                    style={{
                      fontFamily: 'var(--typography-title-large-fontfamily)',
                      fontSize: 'var(--typography-title-large-fontsize)',
                      fontWeight: 700,
                      color: 'var(--color-roles-primary)',
                      letterSpacing: '-0.04em',
                    }}
                  >
                    SchoolPass
                  </span>
                </Link>

                {/* X Close Button */}
                <label
                  htmlFor="sp-mobile-slider-toggle"
                  className="sp-close-btn"
                  role="button"
                  tabIndex={0}
                  aria-label="Close navigation menu"
                >
                  <svg
                    aria-hidden="true"
                    focusable="false"
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </label>
              </div>

              {/* Slider Main Body containing Get Started button */}
              <div className="sp-slider-content">
                <div style={{ maxWidth: '320px', width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <span
                    style={{
                      fontFamily: 'var(--typography-label-medium-fontfamily)',
                      fontSize: 'var(--typography-label-medium-fontsize)',
                      fontWeight: 700,
                      color: 'var(--color-roles-primary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    SchoolPass Portal
                  </span>
                  <p
                    style={{
                      fontFamily: 'var(--typography-headline-small-fontfamily)',
                      fontSize: 'var(--typography-headline-small-fontsize)',
                      fontWeight: 600,
                      color: 'var(--color-roles-on-surface)',
                      lineHeight: 1.3,
                      margin: 0,
                    }}
                  >
                    The school&apos;s answers. Your child&apos;s records. One place.
                  </p>
                </div>

                <div style={{ width: '100%', maxWidth: '320px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {session ? (
                    <>
                      <div
                        style={{
                          padding: '10px 16px',
                          backgroundColor: 'var(--color-roles-primary-container)',
                          color: 'var(--color-roles-on-primary-container)',
                          fontSize: 'var(--typography-label-large-fontsize)',
                          fontFamily: 'var(--typography-label-large-fontfamily)',
                          fontWeight: 500,
                          borderRadius: '0.5rem',
                        }}
                      >
                        Signed in as <strong>{session.user.name}</strong> ({session.role})
                      </div>
                      <Link
                        href={session.role === 'parent' ? '/ask' : '/attendance'}
                        className="sp-btn-primary"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: 'var(--color-roles-primary)',
                          color: 'var(--color-roles-on-primary)',
                          fontFamily: 'var(--typography-label-large-fontfamily)',
                          fontSize: 'var(--typography-label-large-fontsize)',
                          fontWeight: 600,
                          padding: '14px 28px',
                          boxShadow: 'var(--effect-soft-shadow)',
                          textDecoration: 'none',
                          borderRadius: '0.5rem',
                          width: '100%',
                          boxSizing: 'border-box',
                        }}
                      >
                        Go to Portal &rarr;
                      </Link>
                    </>
                  ) : (
                    <>
                      <Link
                        href="/auth/register"
                        className="sp-btn-primary"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: 'var(--color-roles-primary)',
                          color: 'var(--color-roles-on-primary)',
                          fontFamily: 'var(--typography-label-large-fontfamily)',
                          fontSize: 'var(--typography-label-large-fontsize)',
                          fontWeight: 600,
                          padding: '14px 28px',
                          boxShadow: 'var(--effect-soft-shadow)',
                          textDecoration: 'none',
                          borderRadius: '0.5rem',
                          width: '100%',
                          boxSizing: 'border-box',
                        }}
                      >
                        Get Started
                      </Link>
                      <Link
                        href="/auth/staff-login"
                        className="sp-btn-secondary"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: 'var(--color-roles-surface-variant)',
                          color: 'var(--color-roles-on-surface-variant)',
                          fontFamily: 'var(--typography-label-large-fontfamily)',
                          fontSize: 'var(--typography-label-large-fontsize)',
                          fontWeight: 600,
                          padding: '14px 28px',
                          textDecoration: 'none',
                          borderRadius: '0.5rem',
                          width: '100%',
                          boxSizing: 'border-box',
                        }}
                      >
                        Staff Portal &rarr;
                      </Link>
                    </>
                  )}
                </div>
              </div>

              {/* Slider Footer */}
              <nav aria-label="Mobile menu legal links" className="sp-slider-footer">
                <Link
                  href="/?view=privacy"
                  className="sp-text-link"
                  style={{
                    fontSize: 'var(--typography-label-large-fontsize)',
                    fontFamily: 'var(--typography-label-large-fontfamily)',
                    color: 'var(--color-roles-on-surface-variant)',
                    textDecoration: 'none',
                    fontWeight: 500,
                  }}
                >
                  Privacy Policy
                </Link>
                <Link
                  href="/?view=terms"
                  className="sp-text-link"
                  style={{
                    fontSize: 'var(--typography-label-large-fontsize)',
                    fontFamily: 'var(--typography-label-large-fontfamily)',
                    color: 'var(--color-roles-on-surface-variant)',
                    textDecoration: 'none',
                    fontWeight: 500,
                  }}
                >
                  Terms of Service
                </Link>
              </nav>
            </div>
          </nav>
        </div>
      </header>

      {/* ========================================================
          2. MAIN CONTENT AREA (Strict Alignment to Header Margins)
          ======================================================== */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%' }}>
        {currentView === 'privacy' ? (
          <PrivacyView />
        ) : currentView === 'terms' ? (
          <TermsView />
        ) : (
          <>
            {/* HERO SECTION */}
            <section
              aria-labelledby="hero-heading"
              style={{
                width: '100%',
                padding: '64px 0 56px 0',
                boxSizing: 'border-box',
              }}
            >
              <div
                style={{
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    maxWidth: '680px',
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                  }}
                >
                  {/* Active Session Notice if logged in */}
                  {session && (
                    <div
                      style={{
                        marginBottom: '20px',
                        padding: '8px 16px',
                        backgroundColor: 'var(--color-roles-primary-container)',
                        color: 'var(--color-roles-on-primary-container)',
                        fontSize: 'var(--typography-label-large-fontsize)',
                        fontFamily: 'var(--typography-label-large-fontfamily)',
                        fontWeight: 500,
                      }}
                    >
                      Signed in as <strong>{session.user.name}</strong> ({session.role}) &bull;{' '}
                      <Link
                        href={session.role === 'parent' ? '/ask' : '/attendance'}
                        className="sp-text-link"
                        style={{ textDecoration: 'underline', fontWeight: 600 }}
                      >
                        Enter Portal
                      </Link>
                    </div>
                  )}

                  <h1
                    id="hero-heading"
                    style={{
                      fontFamily: 'var(--typography-display-small-fontfamily)',
                      fontSize: 'var(--typography-display-small-fontsize)',
                      fontWeight: 'var(--typography-display-small-fontweight)',
                      lineHeight: 1.2,
                      letterSpacing: 'var(--typography-display-small-letterspacing)',
                      color: 'var(--color-roles-on-surface)',
                      margin: 0,
                    }}
                  >
                    The school&apos;s answers. Your child&apos;s records. One place.
                  </h1>

                  <p
                    style={{
                      fontFamily: 'var(--typography-body-large-fontfamily)',
                      fontSize: 'var(--typography-body-large-fontsize)',
                      fontWeight: 'var(--typography-body-large-fontweight)',
                      lineHeight: 'var(--typography-body-large-lineheight)',
                      color: 'var(--color-roles-on-surface-variant)',
                      marginTop: '16px',
                      marginBottom: '32px',
                      maxWidth: '560px',
                    }}
                  >
                    SchoolPass gives registered parents and guardians one direct place to ask school questions, view verified student attendance and fee balances, confirm morning arrival, and reach the school office.
                  </p>

                  {/* Hero Action Buttons */}
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '12px',
                      justifyContent: 'center',
                      width: '100%',
                    }}
                  >
                    <Link
                      href="/auth/register"
                      className="sp-btn-primary"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'var(--color-roles-primary)',
                        color: 'var(--color-roles-on-primary)',
                        fontFamily: 'var(--typography-label-large-fontfamily)',
                        fontSize: 'var(--typography-label-large-fontsize)',
                        fontWeight: 600,
                        padding: '12px 24px',
                        boxShadow: 'var(--effect-soft-shadow)',
                        textDecoration: 'none',
                        borderRadius: '0.5rem',
                      }}
                    >
                      Get Started
                    </Link>

                    <Link
                      href="/auth/staff-login"
                      className="sp-btn-secondary"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'var(--color-roles-surface-variant)',
                        color: 'var(--color-roles-on-surface-variant)',
                        fontFamily: 'var(--typography-label-large-fontfamily)',
                        fontSize: 'var(--typography-label-large-fontsize)',
                        fontWeight: 600,
                        padding: '12px 24px',
                        textDecoration: 'none',
                        borderRadius: '0.5rem',
                      }}
                    >
                      Staff Portal &rarr;
                    </Link>
                  </div>
                </div>
              </div>
            </section>

            {/* CORE FEATURES SECTION (F-1 through F-5) */}
            <section
              aria-labelledby="features-heading"
              style={{
                width: '100%',
                padding: '56px 0',
                boxSizing: 'border-box',
                display: 'flex',
                flexDirection: 'column',
                gap: '24px',
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <h2
                  id="features-heading"
                  style={{
                    fontFamily: 'var(--typography-headline-small-fontfamily)',
                    fontSize: 'var(--typography-headline-small-fontsize)',
                    fontWeight: 'var(--typography-headline-small-fontweight)',
                    color: 'var(--color-roles-on-surface)',
                    margin: 0,
                  }}
                >
                  What SchoolPass Provides
                </h2>
                <p
                  style={{
                    fontFamily: 'var(--typography-body-medium-fontfamily)',
                    fontSize: 'var(--typography-body-medium-fontsize)',
                    color: 'var(--color-roles-on-surface-variant)',
                    marginTop: '6px',
                  }}
                >
                  Essential parent services defined by the school, built for simplicity and reliability.
                </p>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '20px',
                }}
              >
                {/* Ask the School */}
                <article
                  className="sp-card"
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
                  <div
                    style={{
                      fontFamily: 'var(--typography-label-medium-fontfamily)',
                      fontSize: 'var(--typography-label-medium-fontsize)',
                      fontWeight: 700,
                      color: 'var(--color-roles-primary)',
                    }}
                  >
                    Ask the School
                  </div>
                  <h3
                    style={{
                      fontFamily: 'var(--typography-title-large-fontfamily)',
                      fontSize: 'var(--typography-title-large-fontsize)',
                      fontWeight: 600,
                      color: 'var(--color-roles-on-surface)',
                      margin: 0,
                    }}
                  >
                    Direct School Answers
                  </h3>
                  <p
                    style={{
                      fontFamily: 'var(--typography-body-medium-fontfamily)',
                      fontSize: 'var(--typography-body-medium-fontsize)',
                      lineHeight: 'var(--typography-body-medium-lineheight)',
                      color: 'var(--color-roles-on-surface-variant)',
                      margin: 0,
                    }}
                  >
                    Instant answers to recurring school questions regarding calendars, uniforms, closing times, and policies, drawn strictly from approved school records.
                  </p>
                </article>

                {/* My Child's Records */}
                <article
                  className="sp-card"
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
                  <div
                    style={{
                      fontFamily: 'var(--typography-label-medium-fontfamily)',
                      fontSize: 'var(--typography-label-medium-fontsize)',
                      fontWeight: 700,
                      color: 'var(--color-roles-primary)',
                    }}
                  >
                    My Child&apos;s Records
                  </div>
                  <h3
                    style={{
                      fontFamily: 'var(--typography-title-large-fontfamily)',
                      fontSize: 'var(--typography-title-large-fontsize)',
                      fontWeight: 600,
                      color: 'var(--color-roles-on-surface)',
                      margin: 0,
                    }}
                  >
                    Private Student Records
                  </h3>
                  <p
                    style={{
                      fontFamily: 'var(--typography-body-medium-fontfamily)',
                      fontSize: 'var(--typography-body-medium-fontsize)',
                      lineHeight: 'var(--typography-body-medium-lineheight)',
                      color: 'var(--color-roles-on-surface-variant)',
                      margin: 0,
                    }}
                  >
                    Direct access to staff-recorded daily attendance, active enrollment status, and verified outstanding fee records for each linked student.
                  </p>
                </article>

                {/* Confirm Arrival */}
                <article
                  className="sp-card"
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
                  <div
                    style={{
                      fontFamily: 'var(--typography-label-medium-fontfamily)',
                      fontSize: 'var(--typography-label-medium-fontsize)',
                      fontWeight: 700,
                      color: 'var(--color-roles-primary)',
                    }}
                  >
                    Confirm Arrival
                  </div>
                  <h3
                    style={{
                      fontFamily: 'var(--typography-title-large-fontfamily)',
                      fontSize: 'var(--typography-title-large-fontsize)',
                      fontWeight: 600,
                      color: 'var(--color-roles-on-surface)',
                      margin: 0,
                    }}
                  >
                    Morning Gate Check-in
                  </h3>
                  <p
                    style={{
                      fontFamily: 'var(--typography-body-medium-fontfamily)',
                      fontSize: 'var(--typography-body-medium-fontsize)',
                      lineHeight: 'var(--typography-body-medium-lineheight)',
                      color: 'var(--color-roles-on-surface-variant)',
                      margin: 0,
                    }}
                  >
                    Confirm your child&apos;s daily morning arrival at the gate using the school&apos;s active daily QR code or a 6-digit manual fallback code.
                  </p>
                </article>

                {/* Pay Fees */}
                <article
                  className="sp-card"
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
                  <div
                    style={{
                      fontFamily: 'var(--typography-label-medium-fontfamily)',
                      fontSize: 'var(--typography-label-medium-fontsize)',
                      fontWeight: 700,
                      color: 'var(--color-roles-primary)',
                    }}
                  >
                    Pay Fees
                  </div>
                  <h3
                    style={{
                      fontFamily: 'var(--typography-title-large-fontfamily)',
                      fontSize: 'var(--typography-title-large-fontsize)',
                      fontWeight: 600,
                      color: 'var(--color-roles-on-surface)',
                      margin: 0,
                    }}
                  >
                    Straightforward Fee Payment
                  </h3>
                  <p
                    style={{
                      fontFamily: 'var(--typography-body-medium-fontfamily)',
                      fontSize: 'var(--typography-body-medium-fontsize)',
                      lineHeight: 'var(--typography-body-medium-lineheight)',
                      color: 'var(--color-roles-on-surface-variant)',
                      margin: 0,
                    }}
                  >
                    Review outstanding balances computed in Nigerian Naira (NGN) and complete payments securely through Flutterwave with server-side verification.
                  </p>
                </article>

                {/* Ask the Office */}
                <article
                  className="sp-card"
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
                  <div
                    style={{
                      fontFamily: 'var(--typography-label-medium-fontfamily)',
                      fontSize: 'var(--typography-label-medium-fontsize)',
                      fontWeight: 700,
                      color: 'var(--color-roles-primary)',
                    }}
                  >
                    Ask the Office
                  </div>
                  <h3
                    style={{
                      fontFamily: 'var(--typography-title-large-fontfamily)',
                      fontSize: 'var(--typography-title-large-fontsize)',
                      fontWeight: 600,
                      color: 'var(--color-roles-on-surface)',
                      margin: 0,
                    }}
                  >
                    Front Desk Human Support
                  </h3>
                  <p
                    style={{
                      fontFamily: 'var(--typography-body-medium-fontfamily)',
                      fontSize: 'var(--typography-body-medium-fontsize)',
                      lineHeight: 'var(--typography-body-medium-lineheight)',
                      color: 'var(--color-roles-on-surface-variant)',
                      margin: 0,
                    }}
                  >
                    When questions require human review or decisions, route directly to the designated school Front Desk Officer on WhatsApp with prefilled inquiries.
                  </p>
                </article>

                {/* Privacy & Security Foundation */}
                <article
                  className="sp-card"
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
                  <div
                    style={{
                      fontFamily: 'var(--typography-label-medium-fontfamily)',
                      fontSize: 'var(--typography-label-medium-fontsize)',
                      fontWeight: 700,
                      color: 'var(--color-roles-primary)',
                    }}
                  >
                    Built-in Protection
                  </div>
                  <h3
                    style={{
                      fontFamily: 'var(--typography-title-large-fontfamily)',
                      fontSize: 'var(--typography-title-large-fontsize)',
                      fontWeight: 600,
                      color: 'var(--color-roles-on-surface)',
                      margin: 0,
                    }}
                  >
                    Private Student Records
                  </h3>
                  <p
                    style={{
                      fontFamily: 'var(--typography-body-medium-fontfamily)',
                      fontSize: 'var(--typography-body-medium-fontsize)',
                      lineHeight: 'var(--typography-body-medium-lineheight)',
                      color: 'var(--color-roles-on-surface-variant)',
                      margin: 0,
                    }}
                  >
                    Public school information and private child records are strictly segregated. Student data is never exposed to AI models and is protected by server-side guardian authorization.
                  </p>
                </article>
              </div>
            </section>

            {/* ONBOARDING & ACCESS STEPS SECTION */}
            <section
              aria-labelledby="onboarding-heading"
              style={{
                width: '100%',
                padding: '56px 0',
                boxSizing: 'border-box',
              }}
            >
              <div
                style={{
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '24px',
                }}
              >
                <div style={{ textAlign: 'center' }}>
                  <h2
                    id="onboarding-heading"
                    style={{
                      fontFamily: 'var(--typography-headline-small-fontfamily)',
                      fontSize: 'var(--typography-headline-small-fontsize)',
                      fontWeight: 'var(--typography-headline-small-fontweight)',
                      color: 'var(--color-roles-on-surface)',
                      margin: 0,
                    }}
                  >
                    How Parent Access Works
                  </h2>
                  <p
                    style={{
                      fontFamily: 'var(--typography-body-medium-fontfamily)',
                      fontSize: 'var(--typography-body-medium-fontsize)',
                      color: 'var(--color-roles-on-surface-variant)',
                      marginTop: '6px',
                    }}
                  >
                    Simple, secure registration verified by the school administration.
                  </p>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: '16px',
                  }}
                >
                  <div
                    className="sp-card"
                    style={{
                      backgroundColor: 'var(--color-roles-surface)',
                      border: '1px solid var(--color-roles-outline-color)',
                      boxShadow: 'var(--effect-soft-shadow)',
                      padding: '24px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div
                      style={{
                        fontFamily: 'var(--typography-title-medium-fontfamily)',
                        fontSize: 'var(--typography-title-medium-fontsize)',
                        fontWeight: 700,
                        color: 'var(--color-roles-primary)',
                      }}
                    >
                      1. Register
                    </div>
                    <p
                      style={{
                        fontFamily: 'var(--typography-body-medium-fontfamily)',
                        fontSize: 'var(--typography-body-medium-fontsize)',
                        lineHeight: 'var(--typography-body-medium-lineheight)',
                        color: 'var(--color-roles-on-surface-variant)',
                        margin: 0,
                      }}
                    >
                      Create your parent account using your name, email, and password.
                    </p>
                  </div>

                  <div
                    className="sp-card"
                    style={{
                      backgroundColor: 'var(--color-roles-surface)',
                      border: '1px solid var(--color-roles-outline-color)',
                      boxShadow: 'var(--effect-soft-shadow)',
                      padding: '24px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div
                      style={{
                        fontFamily: 'var(--typography-title-medium-fontfamily)',
                        fontSize: 'var(--typography-title-medium-fontsize)',
                        fontWeight: 700,
                        color: 'var(--color-roles-primary)',
                      }}
                    >
                      2. Verify Email
                    </div>
                    <p
                      style={{
                        fontFamily: 'var(--typography-body-medium-fontfamily)',
                        fontSize: 'var(--typography-body-medium-fontsize)',
                        lineHeight: 'var(--typography-body-medium-lineheight)',
                        color: 'var(--color-roles-on-surface-variant)',
                        margin: 0,
                      }}
                    >
                      Confirm your email address through the single-use verification link sent to your inbox.
                    </p>
                  </div>

                  <div
                    className="sp-card"
                    style={{
                      backgroundColor: 'var(--color-roles-surface)',
                      border: '1px solid var(--color-roles-outline-color)',
                      boxShadow: 'var(--effect-soft-shadow)',
                      padding: '24px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div
                      style={{
                        fontFamily: 'var(--typography-title-medium-fontfamily)',
                        fontSize: 'var(--typography-title-medium-fontsize)',
                        fontWeight: 700,
                        color: 'var(--color-roles-primary)',
                      }}
                    >
                      3. School Staff Link
                    </div>
                    <p
                      style={{
                        fontFamily: 'var(--typography-body-medium-fontfamily)',
                        fontSize: 'var(--typography-body-medium-fontsize)',
                        lineHeight: 'var(--typography-body-medium-lineheight)',
                        color: 'var(--color-roles-on-surface-variant)',
                        margin: 0,
                      }}
                    >
                      School staff look up your verified email and link your account to your child&apos;s records.
                    </p>
                  </div>
                </div>

                <div style={{ textAlign: 'center', marginTop: '12px' }}>
                  <Link
                    href="/auth/register"
                    className="sp-btn-primary"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: 'var(--color-roles-primary)',
                      color: 'var(--color-roles-on-primary)',
                      fontFamily: 'var(--typography-label-large-fontfamily)',
                      fontSize: 'var(--typography-label-large-fontsize)',
                      fontWeight: 600,
                      padding: '12px 24px',
                      boxShadow: 'var(--effect-soft-shadow)',
                      textDecoration: 'none',
                      borderRadius: '0.5rem',
                    }}
                  >
                    Get Started &rarr;
                  </Link>
                </div>
              </div>
            </section>
          </>
        )}
      </main>

      {/* ========================================================
          3. FOOTER (Strict Alignment to Header Margins)
          ======================================================== */}
      <footer
        style={{
          width: '100%',
          borderTop: '1px solid var(--color-roles-outline-variant)',
          padding: '32px 0',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            width: '100%',
          }}
        >
          <div>
            <Link
              href="/"
              className="sp-text-link"
              style={{ textDecoration: 'none' }}
              aria-label="SchoolPass home"
            >
              <span
                style={{
                  fontFamily: 'var(--typography-title-medium-fontfamily)',
                  fontSize: 'var(--typography-title-medium-fontsize)',
                  fontWeight: 700,
                  color: 'var(--color-roles-primary)',
                }}
              >
                SchoolPass
              </span>
            </Link>
            <p
              style={{
                fontFamily: 'var(--typography-body-small-fontfamily)',
                fontSize: 'var(--typography-body-small-fontsize)',
                color: 'var(--color-roles-on-surface-variant)',
                marginTop: '4px',
                margin: 0,
              }}
            >
              The school&apos;s answers. Your child&apos;s records. One place.
            </p>
          </div>

          <nav
            aria-label="Footer legal and policy navigation"
            style={{
              display: 'flex',
              gap: '20px',
              fontFamily: 'var(--typography-label-large-fontfamily)',
              fontSize: 'var(--typography-label-large-fontsize)',
              fontWeight: 500,
            }}
          >
            <Link
              href="/?view=privacy"
              className="sp-text-link"
              style={{
                color: currentView === 'privacy' ? 'var(--color-roles-primary)' : 'var(--color-roles-on-surface-variant)',
                textDecoration: 'none',
                fontWeight: currentView === 'privacy' ? 700 : 500,
              }}
            >
              Privacy Policy
            </Link>
            <Link
              href="/?view=terms"
              className="sp-text-link"
              style={{
                color: currentView === 'terms' ? 'var(--color-roles-primary)' : 'var(--color-roles-on-surface-variant)',
                textDecoration: 'none',
                fontWeight: currentView === 'terms' ? 700 : 500,
              }}
            >
              Terms of Service
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
