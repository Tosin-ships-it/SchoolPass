import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service | SchoolPass',
  description: 'SchoolPass Terms of Service governing parent and guardian access under Nigerian law.',
};

export default function TermsOfServicePage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--color-roles-background)',
        color: 'var(--color-roles-on-background)',
        fontFamily: 'var(--typography-body-large-fontfamily)',
      }}
    >
      {/* Header */}
      <header
        style={{
          width: '100%',
          backgroundColor: 'var(--color-roles-surface)',
          borderBottom: '1px solid var(--color-roles-outline-variant)',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <div
          style={{
            maxWidth: '900px',
            margin: '0 auto',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Link href="/" style={{ textDecoration: 'none' }}>
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
          <Link
            href="/"
            style={{
              fontFamily: 'var(--typography-label-large-fontfamily)',
              fontSize: 'var(--typography-label-large-fontsize)',
              color: 'var(--color-roles-primary)',
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            &larr; Back to Home
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ flex: 1, padding: '48px 20px 64px' }}>
        <article
          style={{
            maxWidth: '900px',
            margin: '0 auto',
            backgroundColor: 'var(--color-roles-surface)',
            border: '1px solid var(--color-roles-outline-color)',
            boxShadow: 'var(--effect-soft-shadow)',
            padding: '40px 32px',
            borderRadius: '0.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '28px',
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

          {/* Section 1 */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <h2
              style={{
                fontSize: 'var(--typography-title-large-fontsize)',
                fontWeight: 600,
                color: 'var(--color-roles-on-surface)',
                margin: 0,
              }}
            >
              1. Acceptance of Terms
            </h2>
            <p style={{ lineHeight: 1.7, margin: 0, color: 'var(--color-roles-on-surface-variant)' }}>
              These Terms of Service (&quot;Terms&quot;) constitute a legally binding agreement between you (as a registered parent, legal guardian, or school staff member) and SchoolPass (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;). By creating an account, accessing, or using the SchoolPass portal, you agree to be bound by these Terms and our Privacy Policy under the laws of the Federal Republic of Nigeria.
            </p>
          </section>

          {/* Section 2 */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <h2
              style={{
                fontSize: 'var(--typography-title-large-fontsize)',
                fontWeight: 600,
                color: 'var(--color-roles-on-surface)',
                margin: 0,
              }}
            >
              2. Description of Service
            </h2>
            <p style={{ lineHeight: 1.7, margin: 0, color: 'var(--color-roles-on-surface-variant)' }}>
              SchoolPass provides a private, single-school web platform designed to streamline communication, record inspection, daily gate arrival confirmation, fee payments, and office contact for parents and guardians:
            </p>
            <ul style={{ paddingLeft: '24px', lineHeight: 1.7, margin: 0, color: 'var(--color-roles-on-surface-variant)' }}>
              <li><strong>Ask the School:</strong> Automated retrieval answering tool grounded exclusively in approved general school documentation.</li>
              <li><strong>My Child&apos;s Records:</strong> Direct read access to verified student daily attendance, active enrollment status, and official fee balances.</li>
              <li><strong>Confirm Arrival:</strong> Daily morning gate drop-off confirmation utilizing gate-displayed QR codes or manual 6-digit fallback codes.</li>
              <li><strong>Pay Fees:</strong> Online school fee payments computed in Nigerian Naira (NGN) processed through Flutterwave.</li>
              <li><strong>Ask the Office:</strong> Direct referral to the designated school Front Desk Officer on WhatsApp for unanswered queries.</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <h2
              style={{
                fontSize: 'var(--typography-title-large-fontsize)',
                fontWeight: 600,
                color: 'var(--color-roles-on-surface)',
                margin: 0,
              }}
            >
              3. Account Registration &amp; Guardian Linking
            </h2>
            <p style={{ lineHeight: 1.7, margin: 0, color: 'var(--color-roles-on-surface-variant)' }}>
              To safeguard student records and comply with the <strong>Nigeria Data Protection Act (NDPA) 2023</strong> and the <strong>Cybercrimes (Prohibition, Prevention, etc.) Act 2015 (as amended 2024)</strong>:
            </p>
            <ul style={{ paddingLeft: '24px', lineHeight: 1.7, margin: 0, color: 'var(--color-roles-on-surface-variant)' }}>
              <li>You must register using accurate, truthful, and verifiable personal contact information (name, email address, password).</li>
              <li><strong>Parent-Student Link Verification:</strong> Self-service linking to students is strictly prohibited. Access to student attendance and fee records is granted only after School Staff or Administrators formally verify and create a parent-student link on the system.</li>
              <li>You are solely responsible for maintaining the confidentiality of your login credentials and session tokens. You agree to notify the school immediately of any unauthorized account access.</li>
            </ul>
          </section>

          {/* Section 4 */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <h2
              style={{
                fontSize: 'var(--typography-title-large-fontsize)',
                fontWeight: 600,
                color: 'var(--color-roles-on-surface)',
                margin: 0,
              }}
            >
              4. Attendance &amp; Official Source of Truth
            </h2>
            <p style={{ lineHeight: 1.7, margin: 0, color: 'var(--color-roles-on-surface-variant)' }}>
              Official staff-recorded attendance entered by teachers or school administrators is the sole legal source of truth regarding student attendance. Parent gate arrival confirmations are logged separately as arrival checkpoints and do not override official staff attendance records.
            </p>
          </section>

          {/* Section 5 */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <h2
              style={{
                fontSize: 'var(--typography-title-large-fontsize)',
                fontWeight: 600,
                color: 'var(--color-roles-on-surface)',
                margin: 0,
              }}
            >
              5. Fee Payments &amp; Financial Transactions
            </h2>
            <p style={{ lineHeight: 1.7, margin: 0, color: 'var(--color-roles-on-surface-variant)' }}>
              All fee obligations are denominated and payable in Nigerian Naira (NGN). In accordance with Central Bank of Nigeria (CBN) electronic payment guidelines:
            </p>
            <ul style={{ paddingLeft: '24px', lineHeight: 1.7, margin: 0, color: 'var(--color-roles-on-surface-variant)' }}>
              <li>Payments are processed through Flutterwave, a licensed payment solution provider. SchoolPass does not store credit or debit card credentials.</li>
              <li>Fee balances are decremented only upon independent, cryptographic server-side verification and webhook confirmation from Flutterwave. A redirect or return URL alone does not confirm payment.</li>
              <li>Refunds are governed by school policy, must not exceed the original payment amount, and are credited only after payment processor confirmation.</li>
              <li>Artificial intelligence tools in SchoolPass are strictly prohibited from calculating, estimating, or confirming fee balances.</li>
            </ul>
          </section>

          {/* Section 6 */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <h2
              style={{
                fontSize: 'var(--typography-title-large-fontsize)',
                fontWeight: 600,
                color: 'var(--color-roles-on-surface)',
                margin: 0,
              }}
            >
              6. Information Retrieval &amp; AI Accuracy
            </h2>
            <p style={{ lineHeight: 1.7, margin: 0, color: 'var(--color-roles-on-surface-variant)' }}>
              The &quot;Ask the School&quot; feature provides rapid reference answers based on approved school literature. While we aim for high factual accuracy, automated answers do not supersede formal, signed letters or circulars issued directly by the school principal or administration. If an answer appears incorrect, users are encouraged to use the &quot;Report an incorrect answer&quot; tool or contact the Front Desk Officer.
            </p>
          </section>

          {/* Section 7 */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <h2
              style={{
                fontSize: 'var(--typography-title-large-fontsize)',
                fontWeight: 600,
                color: 'var(--color-roles-on-surface)',
                margin: 0,
              }}
            >
              7. Acceptable Use Policy
            </h2>
            <p style={{ lineHeight: 1.7, margin: 0, color: 'var(--color-roles-on-surface-variant)' }}>
              Users agree not to:
            </p>
            <ul style={{ paddingLeft: '24px', lineHeight: 1.7, margin: 0, color: 'var(--color-roles-on-surface-variant)' }}>
              <li>Attempt to gain unauthorized access to another student&apos;s records or another guardian&apos;s account.</li>
              <li>Interfere with or circumvent the security mechanisms, rate limits, or server-side authorization checks of SchoolPass.</li>
              <li>Transmit fraudulent payment receipts or manipulate transaction parameters.</li>
              <li>Violate any provision of the <strong>Cybercrimes (Prohibition, Prevention, etc.) Act 2015</strong>.</li>
            </ul>
          </section>

          {/* Section 8 */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <h2
              style={{
                fontSize: 'var(--typography-title-large-fontsize)',
                fontWeight: 600,
                color: 'var(--color-roles-on-surface)',
                margin: 0,
              }}
            >
              8. Limitation of Liability
            </h2>
            <p style={{ lineHeight: 1.7, margin: 0, color: 'var(--color-roles-on-surface-variant)' }}>
              To the fullest extent permitted by Nigerian law, SchoolPass and the school administration shall not be liable for indirect, incidental, special, or consequential damages resulting from third-party payment gateway downtime, telecom network failures, or WhatsApp message delivery delays.
            </p>
          </section>

          {/* Section 9 */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <h2
              style={{
                fontSize: 'var(--typography-title-large-fontsize)',
                fontWeight: 600,
                color: 'var(--color-roles-on-surface)',
                margin: 0,
              }}
            >
              9. Governing Law &amp; Dispute Resolution
            </h2>
            <p style={{ lineHeight: 1.7, margin: 0, color: 'var(--color-roles-on-surface-variant)' }}>
              These Terms shall be governed by, and construed in accordance with, the laws of the <strong>Federal Republic of Nigeria</strong>. Any disputes arising out of or in connection with these Terms shall first be submitted to good-faith mediation with the school leadership. Where unresolved, disputes shall be subject to the exclusive jurisdiction of the competent courts of Nigeria.
            </p>
          </section>

          {/* Section 10 */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <h2
              style={{
                fontSize: 'var(--typography-title-large-fontsize)',
                fontWeight: 600,
                color: 'var(--color-roles-on-surface)',
                margin: 0,
              }}
            >
              10. Contact Information
            </h2>
            <p style={{ lineHeight: 1.7, margin: 0, color: 'var(--color-roles-on-surface-variant)' }}>
              If you have any questions or concerns regarding these Terms, please contact the school administration office or reach out via the designated Front Desk Officer.
            </p>
          </section>
        </article>
      </main>

      {/* Footer */}
      <footer
        style={{
          width: '100%',
          borderTop: '1px solid var(--color-roles-outline-variant)',
          backgroundColor: 'var(--color-roles-surface)',
          padding: '24px 20px',
        }}
      >
        <div
          style={{
            maxWidth: '900px',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 'var(--typography-body-small-fontsize)',
            color: 'var(--color-roles-on-surface-variant)',
          }}
        >
          <span>&copy; {new Date().getFullYear()} SchoolPass. All rights reserved.</span>
          <div style={{ display: 'flex', gap: '16px' }}>
            <Link href="/privacy" style={{ color: 'var(--color-roles-on-surface-variant)', textDecoration: 'none' }}>
              Privacy Policy
            </Link>
            <Link href="/terms" style={{ color: 'var(--color-roles-primary)', textDecoration: 'none' }}>
              Terms of Service
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
