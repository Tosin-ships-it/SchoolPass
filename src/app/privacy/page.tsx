import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy | SchoolPass',
  description: 'SchoolPass Privacy Policy adhering to the Nigeria Data Protection Act (NDPA) 2023 and NDPR.',
};

export default function PrivacyPolicyPage() {
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
              1. Introduction &amp; Scope
            </h2>
            <p style={{ lineHeight: 1.7, margin: 0, color: 'var(--color-roles-on-surface-variant)' }}>
              SchoolPass (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) provides a dedicated private web portal for registered parents, guardians, and verified school staff. Our mission is to provide one secure, direct place for parents to ask school questions, view verified student records, confirm morning gate arrival, pay school fees, and connect with the front desk.
            </p>
            <p style={{ lineHeight: 1.7, margin: 0, color: 'var(--color-roles-on-surface-variant)' }}>
              We are fully committed to protecting the privacy of our users and the sensitive educational data of students under the <strong>Nigeria Data Protection Act (NDPA) 2023</strong> and the <strong>Nigeria Data Protection Regulation (NDPR)</strong>.
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
              2. Nigerian Data Protection Compliance
            </h2>
            <p style={{ lineHeight: 1.7, margin: 0, color: 'var(--color-roles-on-surface-variant)' }}>
              In accordance with Section 24 of the NDPA 2023, personal data collected and processed via SchoolPass is handled strictly in adherence to the fundamental principles of data protection:
            </p>
            <ul style={{ paddingLeft: '24px', lineHeight: 1.7, margin: 0, color: 'var(--color-roles-on-surface-variant)' }}>
              <li><strong>Lawfulness, Fairness, and Transparency:</strong> Data is collected only for legitimate educational and administrative purposes with clear notice.</li>
              <li><strong>Purpose Limitation:</strong> Personal data is processed solely for school communication, attendance verification, and fee reconciliation.</li>
              <li><strong>Data Minimization:</strong> Only information strictly necessary for portal functionality is requested and stored.</li>
              <li><strong>Accuracy:</strong> Official attendance and financial records are maintained and verified directly by authorized school staff.</li>
              <li><strong>Integrity and Confidentiality:</strong> Technical safeguards prevent unauthorized access, alteration, or disclosure.</li>
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
              3. Information We Collect
            </h2>
            <p style={{ lineHeight: 1.7, margin: 0, color: 'var(--color-roles-on-surface-variant)' }}>
              We collect and process the following categories of information:
            </p>
            <ul style={{ paddingLeft: '24px', lineHeight: 1.7, margin: 0, color: 'var(--color-roles-on-surface-variant)' }}>
              <li><strong>Parent/Guardian Information:</strong> Full name, verified email address, phone number, and encrypted credentials.</li>
              <li><strong>Student Records:</strong> Student full name, class/grade, staff-recorded daily attendance status, and outstanding fee balance.</li>
              <li><strong>Daily Arrival Data:</strong> Daily gate arrival timestamps and confirmation method (gate QR code or manual verification code).</li>
              <li><strong>Payment Transaction Data:</strong> Flutterwave transaction references, payment timestamps, and payment statuses in Nigerian Naira (NGN). We do not store credit card or debit card numbers on SchoolPass servers.</li>
              <li><strong>Audit &amp; Operational Logs:</strong> Access logs, session tokens (via secure httpOnly cookies), and system activity logs for compliance and dispute resolution.</li>
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
              4. Strict Boundary: AI &amp; Student Privacy Protection
            </h2>
            <p style={{ lineHeight: 1.7, margin: 0, color: 'var(--color-roles-on-surface-variant)' }}>
              A core promise of SchoolPass is the absolute structural segregation between public school information and private student records:
            </p>
            <ul style={{ paddingLeft: '24px', lineHeight: 1.7, margin: 0, color: 'var(--color-roles-on-surface-variant)' }}>
              <li>Our automated answering system (&quot;Ask the School&quot;) reads <strong>exclusively</strong> from approved general school information (calendars, uniform policies, office hours).</li>
              <li><strong>No student record, fee balance, payment history, attendance log, or parent identifier is ever shared with, indexed by, or passed to artificial intelligence models.</strong></li>
              <li>All private records are queried directly from the secure relational database only after verifying server-side guardian authorization.</li>
            </ul>
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
              5. Child Data Protection &amp; Guardian Linking
            </h2>
            <p style={{ lineHeight: 1.7, margin: 0, color: 'var(--color-roles-on-surface-variant)' }}>
              In compliance with Section 31 of the NDPA 2023 regarding the processing of personal data of children:
            </p>
            <ul style={{ paddingLeft: '24px', lineHeight: 1.7, margin: 0, color: 'var(--color-roles-on-surface-variant)' }}>
              <li>Child records are protected with highest-tier safeguards and are accessible only to legally linked parents or guardians.</li>
              <li><strong>No self-service linking is allowed.</strong> Parent-to-student links can only be authorized and created by designated School Staff or Administrators after physical or formal school identity verification.</li>
              <li>Every individual request for a student&apos;s records is verified on the server to prevent unauthorized access.</li>
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
              6. Third-Party Services
            </h2>
            <p style={{ lineHeight: 1.7, margin: 0, color: 'var(--color-roles-on-surface-variant)' }}>
              We partner with trusted third-party providers solely to deliver core services:
            </p>
            <ul style={{ paddingLeft: '24px', lineHeight: 1.7, margin: 0, color: 'var(--color-roles-on-surface-variant)' }}>
              <li><strong>Flutterwave:</strong> Licensed and PCI-DSS certified payment gateway used to process fee payments in Nigerian Naira. Flutterwave processes payments subject to its independent privacy policy.</li>
              <li><strong>WhatsApp (Meta):</strong> Unanswered enquiries may be escalated directly to the school Front Desk Officer via WhatsApp with user consent.</li>
            </ul>
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
              7. Data Retention &amp; Security
            </h2>
            <p style={{ lineHeight: 1.7, margin: 0, color: 'var(--color-roles-on-surface-variant)' }}>
              We implement industry-standard encryption (TLS/HTTPS in transit and secure database storage at rest) along with strict role-based access control. In accordance with statutory school accounting and NDPR audit guidelines, official attendance and fee transaction logs are retained for seven (7) years before secure purge or anonymization.
            </p>
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
              8. Your Rights as a Data Subject
            </h2>
            <p style={{ lineHeight: 1.7, margin: 0, color: 'var(--color-roles-on-surface-variant)' }}>
              Under Part V of the NDPA 2023, you have the right to:
            </p>
            <ul style={{ paddingLeft: '24px', lineHeight: 1.7, margin: 0, color: 'var(--color-roles-on-surface-variant)' }}>
              <li>Request access to your personal data held in SchoolPass.</li>
              <li>Request correction or rectification of inaccurate profile information.</li>
              <li>Object to unlawful processing or request restriction of data handling.</li>
              <li>Lodge a complaint with the <strong>Nigeria Data Protection Commission (NDPC)</strong> if you believe your privacy rights have been violated.</li>
            </ul>
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
              9. Contact &amp; Enquiries
            </h2>
            <p style={{ lineHeight: 1.7, margin: 0, color: 'var(--color-roles-on-surface-variant)' }}>
              For questions regarding this Privacy Policy or to exercise your rights under the NDPA 2023, please contact the school administration or data privacy representative via the Front Desk Officer or by visiting the school administrative office.
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
            <Link href="/privacy" style={{ color: 'var(--color-roles-primary)', textDecoration: 'none' }}>
              Privacy Policy
            </Link>
            <Link href="/terms" style={{ color: 'var(--color-roles-on-surface-variant)', textDecoration: 'none' }}>
              Terms of Service
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
