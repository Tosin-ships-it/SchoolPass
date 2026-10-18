'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { AuthCard } from '../components/AuthCard';
import { FormField, PrimaryButton, AlertBox } from '../components/AuthFormElements';

function validateFullName(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return 'Enter your full name.';
  }

  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length < 2) {
    return 'Enter your first and last name.';
  }

  const hasShortPart = parts.some((part) => part.length < 2);
  if (hasShortPart) {
    return 'Each name must contain at least 2 characters.';
  }

  return null;
}

function isValidEmail(value: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value.trim());
}

const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password12', 'password123', 'password!', 'password@1', 'password123!',
  '12345678', '123456789', '12345678!', '12345678@',
  'qwerty123', 'qwerty!', 'qwerty@123',
  'admin123', 'admin@123', 'admin123!',
  'welcome1', 'welcome!', 'welcome@1', 'welcome123', 'welcome@123',
  'letmein1', 'letmein!', 'letmein@123',
  'schoolpass', 'schoolpass1', 'schoolpass!', 'schoolpass@123',
  'iloveyou', 'iloveyou!', 'iloveyou123',
  'pass@word', 'pass@word1', 'p@ssword', 'p@ssw0rd', 'p@ssword1', 'p@ssword!',
  'sunshine!', 'princess!', 'football!', 'monkey123!',
]);

function isCommonPassword(password: string): boolean {
  const lower = password.toLowerCase().trim();
  if (COMMON_PASSWORDS.has(lower)) {
    return true;
  }
  for (const common of ['password', 'admin', 'welcome', 'letmein', 'qwerty', 'schoolpass']) {
    if (lower.startsWith(common) && lower.length <= common.length + 2) {
      return true;
    }
  }
  return false;
}

async function isPwnedPassword(password: string): Promise<boolean> {
  if (isCommonPassword(password)) {
    return true;
  }

  try {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
      const encoder = new TextEncoder();
      const data = encoder.encode(password);
      const hashBuffer = await window.crypto.subtle.digest('SHA-1', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();

      const prefix = hashHex.slice(0, 5);
      const suffix = hashHex.slice(5);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        return false;
      }

      const text = await res.text();
      const lines = text.split('\n');
      for (const line of lines) {
        const [returnedSuffix] = line.trim().split(':');
        if (returnedSuffix === suffix) {
          return true;
        }
      }
    }
  } catch {
    return false;
  }

  return false;
}

function validatePasswordSync(value: string, isSubmit = false): string | null {
  if (!value) {
    return isSubmit ? 'Enter a password.' : 'Enter a password.';
  }
  if (value.length < 8) {
    return 'Password must be at least 8 characters.';
  }
  if (!/[^A-Za-z0-9]/.test(value)) {
    return 'Include at least one special character.';
  }
  if (isCommonPassword(value)) {
    return 'Choose a stronger password.';
  }
  return null;
}

async function validatePassword(value: string, isSubmit = false): Promise<string | null> {
  const syncErr = validatePasswordSync(value, isSubmit);
  if (syncErr) {
    return syncErr;
  }
  const compromised = await isPwnedPassword(value);
  if (compromised) {
    return 'Choose a stronger password.';
  }
  return null;
}

const TERMS_DOCUMENT = {
  tag: 'Terms & Conditions',
  title: 'Terms of Service',
  subtitle: 'Effective Date: October 2026 • Governing Law: Laws of the Federal Republic of Nigeria',
  sections: [
    {
      heading: '1. Acceptance of Terms',
      paragraphs: [
        'These Terms of Service ("Terms") constitute a legally binding agreement between you (as a registered parent, legal guardian, or school staff member) and SchoolPass ("we", "us", "our"). By creating an account, accessing, or using the SchoolPass portal, you agree to be bound by these Terms and our Privacy Policy under the laws of the Federal Republic of Nigeria.',
      ],
    },
    {
      heading: '2. Description of Service',
      paragraphs: [
        'SchoolPass provides a private, single-school web platform designed to streamline communication, record inspection, daily gate arrival confirmation, fee payments, and office contact for parents and guardians:',
      ],
      list: [
        'Ask the School: Automated retrieval answering tool grounded exclusively in approved general school documentation.',
        'My Child\'s Records: Direct read access to verified student daily attendance, active enrollment status, and official fee balances.',
        'Confirm Arrival: Daily morning gate drop-off confirmation utilizing gate-displayed QR codes or manual 6-digit fallback codes.',
        'Pay Fees: Online school fee payments computed in Nigerian Naira (NGN) processed through Flutterwave.',
        'Ask the Office: Direct referral to the designated school Front Desk Officer on WhatsApp for unanswered queries.',
      ],
    },
    {
      heading: '3. Account Registration & Guardian Linking',
      paragraphs: [
        'To safeguard student records and comply with the Nigeria Data Protection Act (NDPA) 2023 and the Cybercrimes (Prohibition, Prevention, etc.) Act 2015 (as amended 2024):',
      ],
      list: [
        'You must register using accurate, truthful, and verifiable personal contact information (name, email address, password).',
        'Parent-Student Link Verification: Self-service linking to students is strictly prohibited. Access to student attendance and fee records is granted only after School Staff or Administrators formally verify and create a parent-student link on the system.',
        'You are solely responsible for maintaining the confidentiality of your login credentials and session tokens. You agree to notify the school immediately of any unauthorized account access.',
      ],
    },
    {
      heading: '4. Attendance & Official Source of Truth',
      paragraphs: [
        'Official staff-recorded attendance entered by teachers or school administrators is the sole legal source of truth regarding student attendance. Parent gate arrival confirmations are logged separately as arrival checkpoints and do not override official staff attendance records.',
      ],
    },
    {
      heading: '5. Fee Payments & Financial Transactions',
      paragraphs: [
        'All fee obligations are denominated and payable in Nigerian Naira (NGN). In accordance with Central Bank of Nigeria (CBN) electronic payment guidelines:',
      ],
      list: [
        'Payments are processed through Flutterwave, a licensed payment solution provider. SchoolPass does not store credit or debit card credentials.',
        'Fee balances are decremented only upon independent, cryptographic server-side verification and webhook confirmation from Flutterwave. A redirect or return URL alone does not confirm payment.',
        'Refunds are governed by school policy, must not exceed the original payment amount, and are credited only after payment processor confirmation.',
        'Artificial intelligence tools in SchoolPass are strictly prohibited from calculating, estimating, or confirming fee balances.',
      ],
    },
    {
      heading: '6. Information Retrieval & AI Accuracy',
      paragraphs: [
        'The "Ask the School" feature provides rapid reference answers based on approved school literature. While we aim for high factual accuracy, automated answers do not supersede formal, signed letters or circulars issued directly by the school principal or administration. If an answer appears incorrect, users are encouraged to use the "Report an incorrect answer" tool or contact the Front Desk Officer.',
      ],
    },
    {
      heading: '7. Acceptable Use Policy',
      paragraphs: [
        'Users agree not to:',
      ],
      list: [
        'Attempt to gain unauthorized access to another student\'s records or another guardian\'s account.',
        'Interfere with or circumvent the security mechanisms, rate limits, or server-side authorization checks of SchoolPass.',
        'Transmit fraudulent payment receipts or manipulate transaction parameters.',
        'Violate any provision of the Cybercrimes (Prohibition, Prevention, etc.) Act 2015.',
      ],
    },
    {
      heading: '8. Limitation of Liability',
      paragraphs: [
        'To the fullest extent permitted by Nigerian law, SchoolPass and the school administration shall not be liable for indirect, incidental, special, or consequential damages resulting from third-party payment gateway downtime, telecom network failures, or WhatsApp message delivery delays.',
      ],
    },
    {
      heading: '9. Governing Law & Dispute Resolution',
      paragraphs: [
        'These Terms shall be governed by, and construed in accordance with, the laws of the Federal Republic of Nigeria. Any disputes arising out of or in connection with these Terms shall first be submitted to good-faith mediation with the school leadership. Where unresolved, disputes shall be subject to the exclusive jurisdiction of the competent courts of Nigeria.',
      ],
    },
    {
      heading: '10. Contact Information',
      paragraphs: [
        'If you have any questions or concerns regarding these Terms, please contact the school administration office or reach out via the designated Front Desk Officer.',
      ],
    },
  ],
};

const PRIVACY_DOCUMENT = {
  tag: 'Legal & Compliance',
  title: 'Privacy Policy',
  subtitle: 'Effective Date: October 2026 • Governing Law: Nigeria Data Protection Act (NDPA) 2023',
  sections: [
    {
      heading: '1. Introduction & Scope',
      paragraphs: [
        'SchoolPass ("we", "us", "our") provides a dedicated private web portal for registered parents, guardians, and verified school staff. Our mission is to provide one secure, direct place for parents to ask school questions, view verified student records, confirm morning gate arrival, pay school fees, and connect with the front desk.',
        'We are fully committed to protecting the privacy of our users and the sensitive educational data of students under the Nigeria Data Protection Act (NDPA) 2023 and the Nigeria Data Protection Regulation (NDPR).',
      ],
    },
    {
      heading: '2. Nigerian Data Protection Compliance',
      paragraphs: [
        'In accordance with Section 24 of the NDPA 2023, personal data collected and processed via SchoolPass is handled strictly in adherence to the fundamental principles of data protection:',
      ],
      list: [
        'Lawfulness, Fairness, and Transparency: Data is collected only for legitimate educational and administrative purposes with clear notice.',
        'Purpose Limitation: Personal data is processed solely for school communication, attendance verification, and fee reconciliation.',
        'Data Minimization: Only information strictly necessary for portal functionality is requested and stored.',
        'Accuracy: Official attendance and financial records are maintained and verified directly by authorized school staff.',
        'Integrity and Confidentiality: Technical safeguards prevent unauthorized access, alteration, or disclosure.',
      ],
    },
    {
      heading: '3. Information We Collect',
      paragraphs: [
        'We collect and process the following categories of information:',
      ],
      list: [
        'Parent/Guardian Information: Full name, verified email address, phone number, and encrypted credentials.',
        'Student Records: Student full name, class/grade, staff-recorded daily attendance status, and outstanding fee balance.',
        'Daily Arrival Data: Daily gate arrival timestamps and confirmation method (gate QR code or manual verification code).',
        'Payment Transaction Data: Flutterwave transaction references, payment timestamps, and payment statuses in Nigerian Naira (NGN). We do not store credit card or debit card numbers on SchoolPass servers.',
        'Audit & Operational Logs: Access logs, session tokens (via secure httpOnly cookies), and system activity logs for compliance and dispute resolution.',
      ],
    },
    {
      heading: '4. Strict Boundary: AI & Student Privacy Protection',
      paragraphs: [
        'A core promise of SchoolPass is the absolute structural segregation between public school information and private student records:',
      ],
      list: [
        'Our automated answering system ("Ask the School") reads exclusively from approved general school information (calendars, uniform policies, office hours).',
        'No student record, fee balance, payment history, attendance log, or parent identifier is ever shared with, indexed by, or passed to artificial intelligence models.',
        'All private records are queried directly from the secure relational database only after verifying server-side guardian authorization.',
      ],
    },
    {
      heading: '5. Child Data Protection & Guardian Linking',
      paragraphs: [
        'In compliance with Section 31 of the NDPA 2023 regarding the processing of personal data of children:',
      ],
      list: [
        'Child records are protected with highest-tier safeguards and are accessible only to legally linked parents or guardians.',
        'No self-service linking is allowed. Parent-to-student links can only be authorized and created by designated School Staff or Administrators after physical or formal school identity verification.',
        'Every individual request for a student\'s records is verified on the server to prevent unauthorized access.',
      ],
    },
    {
      heading: '6. Third-Party Services',
      paragraphs: [
        'We partner with trusted third-party providers solely to deliver core services:',
      ],
      list: [
        'Flutterwave: Licensed and PCI-DSS certified payment gateway used to process fee payments in Nigerian Naira. Flutterwave processes payments subject to its independent privacy policy.',
        'WhatsApp (Meta): Unanswered enquiries may be escalated directly to the school Front Desk Officer via WhatsApp with user consent.',
      ],
    },
    {
      heading: '7. Data Retention & Security',
      paragraphs: [
        'We implement industry-standard encryption (TLS/HTTPS in transit and secure database storage at rest) along with strict role-based access control. In accordance with statutory school accounting and NDPR audit guidelines, official attendance and fee transaction logs are retained for seven (7) years before secure purge or anonymization.',
      ],
    },
    {
      heading: '8. Your Rights as a Data Subject',
      paragraphs: [
        'Under Part V of the NDPA 2023, you have the right to:',
      ],
      list: [
        'Request access to your personal data held in SchoolPass.',
        'Request correction or rectification of inaccurate profile information.',
        'Object to unlawful processing or request restriction of data handling.',
        'Lodge a complaint with the Nigeria Data Protection Commission (NDPC) if you believe your privacy rights have been violated.',
      ],
    },
    {
      heading: '9. Contact & Enquiries',
      paragraphs: [
        'For questions regarding this Privacy Policy or to exercise your rights under the NDPA 2023, please contact the school administration or data privacy representative via the Front Desk Officer or by visiting the school administrative office.',
      ],
    },
  ],
};

export function ParentRegisterForm() {
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [studentNumber, setStudentNumber] = useState('');
  const [studentNumberError, setStudentNumberError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null);
  const [confirmPasswordTouched, setConfirmPasswordTouched] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [termsError, setTermsError] = useState<string | null>(null);

  const [registeredEmail, setRegisteredEmail] = useState('');
  const [linkStatus, setLinkStatus] = useState<{
    success: boolean;
    error?: string;
    studentName?: string;
    className?: string;
    requestId?: string;
  } | null>(null);
  const [retryStudentNumber, setRetryStudentNumber] = useState('');
  const [retryLoading, setRetryLoading] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  const [activeLegalDoc, setActiveLegalDoc] = useState<'terms' | 'privacy' | null>(null);
  const lastActiveTriggerRef = useRef<HTMLElement | null>(null);
  const modalDoneBtnRef = useRef<HTMLButtonElement | null>(null);

  const openLegalModal = (doc: 'terms' | 'privacy', triggerEl: HTMLElement | null) => {
    lastActiveTriggerRef.current = triggerEl;
    setActiveLegalDoc(doc);
  };

  const closeLegalModal = () => {
    setActiveLegalDoc(null);
    if (lastActiveTriggerRef.current) {
      lastActiveTriggerRef.current.focus();
    }
  };

  useEffect(() => {
    if (!activeLegalDoc) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeLegalModal();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    const focusTimer = setTimeout(() => {
      if (modalDoneBtnRef.current) {
        modalDoneBtnRef.current.focus();
      }
    }, 40);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(focusTimer);
    };
  }, [activeLegalDoc]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registeredToken, setRegisteredToken] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setName(val);
    if (nameError) {
      const err = validateFullName(val);
      if (!err) {
        setNameError(null);
      } else {
        setNameError(err);
      }
    }
  };

  const handleNameBlur = () => {
    const err = validateFullName(name);
    setNameError(err);
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setEmail(val);
    if (isValidEmail(val)) {
      setEmailError(null);
    } else {
      setEmailError('Enter a valid email address');
    }
  };

  const handleEmailBlur = () => {
    if (!isValidEmail(email)) {
      setEmailError('Enter a valid email address');
    }
  };

  const handleStudentNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase();
    setStudentNumber(val);
    if (val.trim()) {
      setStudentNumberError(null);
    }
  };

  const handleStudentNumberBlur = () => {
    if (!studentNumber.trim()) {
      setStudentNumberError("Enter your child's student number.");
    } else {
      setStudentNumberError(null);
    }
  };

  const handleRetryLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setRetryError(null);
    const trimmed = retryStudentNumber.trim().toUpperCase();
    if (!trimmed) {
      setRetryError('Please enter a valid student number.');
      document.getElementById('retry-student-number')?.focus();
      return;
    }

    setRetryLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: registeredEmail || email,
          token: registeredToken,
          studentNumber: trimmed,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setRetryError(data.error || 'Failed to submit student link request.');
        document.getElementById('retry-student-number')?.focus();
      } else {
        setStudentNumber(trimmed);
        setLinkStatus({
          success: true,
          studentName: data.studentName,
          className: data.className,
          requestId: data.requestId,
        });
        setRetryError(null);
        setRetryStudentNumber('');
      }
    } catch {
      setRetryError('Something went wrong. Please check your connection and try again.');
      document.getElementById('retry-student-number')?.focus();
    } finally {
      setRetryLoading(false);
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setPassword(val);

    if (passwordError) {
      const syncErr = validatePasswordSync(val);
      if (!syncErr) {
        setPasswordError(null);
        isPwnedPassword(val).then((compromised) => {
          if (compromised) {
            setPasswordError('Choose a stronger password.');
          }
        });
      } else {
        setPasswordError(syncErr);
      }
    }

    if (confirmPasswordTouched) {
      if (val === confirmPassword) {
        setConfirmPasswordError(null);
      } else {
        setConfirmPasswordError('Passwords do not match.');
      }
    }
  };

  const handlePasswordBlur = async () => {
    if (!password) {
      return;
    }
    const syncErr = validatePasswordSync(password);
    if (syncErr) {
      setPasswordError(syncErr);
      return;
    }
    const compromised = await isPwnedPassword(password);
    if (compromised) {
      setPasswordError('Choose a stronger password.');
    } else {
      setPasswordError(null);
    }
  };

  const handleConfirmPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setConfirmPassword(val);

    if (confirmPasswordError) {
      if (val === password) {
        setConfirmPasswordError(null);
      } else {
        setConfirmPasswordError('Passwords do not match.');
      }
    }
  };

  const handleConfirmPasswordBlur = () => {
    setConfirmPasswordTouched(true);
    if (confirmPassword !== password) {
      setConfirmPasswordError('Passwords do not match.');
    } else {
      setConfirmPasswordError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const nameValidationError = validateFullName(name);
    if (nameValidationError) {
      setNameError(nameValidationError);
      document.getElementById('name')?.focus();
      return;
    }

    if (!isValidEmail(email)) {
      setEmailError('Enter a valid email address');
      document.getElementById('email')?.focus();
      return;
    }

    if (!studentNumber.trim()) {
      setStudentNumberError("Enter your child's student number.");
      document.getElementById('studentNumber')?.focus();
      return;
    }

    if (!password) {
      setPasswordError('Enter a password.');
      document.getElementById('password')?.focus();
      return;
    }

    const passwordErr = await validatePassword(password, true);
    if (passwordErr) {
      setPasswordError(passwordErr);
      document.getElementById('password')?.focus();
      return;
    }

    if (confirmPassword !== password) {
      setConfirmPasswordTouched(true);
      setConfirmPasswordError('Passwords do not match.');
      document.getElementById('confirmPassword')?.focus();
      return;
    }

    if (!acceptedTerms) {
      setTermsError('Please accept the Terms and Conditions and Privacy Policy to continue.');
      document.getElementById('terms')?.focus();
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email,
          password,
          studentNumber: studentNumber.trim().toUpperCase(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Registration failed. Please check your details.');
        setTimeout(() => {
          document.getElementById('register-error-alert')?.focus();
        }, 50);
        return;
      }

      setIsSuccess(true);
      setRegisteredEmail(email);
      if (data.verificationToken) {
        setRegisteredToken(data.verificationToken);
      }
      if (data.studentLink) {
        setLinkStatus(data.studentLink);
      } else {
        setLinkStatus({ success: false, error: 'No link request was created.' });
      }
    } catch {
      setError('Something went wrong. Please check your connection and try again.');
      setTimeout(() => {
        document.getElementById('register-error-alert')?.focus();
      }, 50);
    } finally {
      setLoading(false);
    }
  };

  const isFormValid =
    Boolean(name.trim()) &&
    validateFullName(name) === null &&
    !nameError &&
    Boolean(email.trim()) &&
    isValidEmail(email) &&
    !emailError &&
    Boolean(studentNumber.trim()) &&
    !studentNumberError &&
    Boolean(password) &&
    validatePasswordSync(password) === null &&
    !passwordError &&
    Boolean(confirmPassword) &&
    confirmPassword === password &&
    !confirmPasswordError;

  if (isSuccess) {
    return (
      <AuthCard
        title="Check Your Email"
        subtitle="We sent an email verification link to complete your registration."
        backHref="/auth/login"
        backLabel="Back to Sign In"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <AlertBox
            type="success"
            message={`A verification link has been sent to ${registeredEmail || email}. Please check your inbox and verify your email before signing in.`}
          />

          {/* Student Linking Status & Pending Notice */}
          {linkStatus?.success ? (
            <div
              style={{
                padding: '16px',
                backgroundColor: 'var(--color-roles-surface)',
                border: '1px solid var(--color-roles-outline-color)',
                borderRadius: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <span
                  style={{
                    fontFamily: 'var(--typography-title-small-fontfamily)',
                    fontSize: 'var(--typography-title-small-fontsize)',
                    fontWeight: 700,
                    color: 'var(--color-roles-on-surface)',
                  }}
                >
                  Student Linking Request Submitted
                </span>
                <span
                  style={{
                    padding: '3px 10px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: 700,
                    backgroundColor: 'rgba(237, 108, 2, 0.12)',
                    color: '#c25700',
                    border: '1px solid rgba(237, 108, 2, 0.3)',
                  }}
                >
                  Pending Staff Approval
                </span>
              </div>

              <div
                style={{
                  padding: '10px 14px',
                  backgroundColor: 'var(--color-roles-surface-variant)',
                  borderRadius: '6px',
                  fontSize: '13px',
                  color: 'var(--color-roles-on-surface)',
                }}
              >
                <div><strong>Student:</strong> {linkStatus.studentName || 'Student'}</div>
                <div><strong>Student Number:</strong> {studentNumber}</div>
                {linkStatus.className && <div><strong>Class:</strong> {linkStatus.className}</div>}
              </div>

              <p
                style={{
                  fontFamily: 'var(--typography-body-small-fontfamily)',
                  fontSize: 'var(--typography-body-small-fontsize)',
                  color: 'var(--color-roles-on-surface-variant)',
                  lineHeight: 'var(--typography-body-small-lineheight)',
                  margin: 0,
                }}
              >
                Your request has been submitted to school administrators. Under school security rules, access to your child&apos;s attendance and academic records is strictly restricted until staff formally review and approve this link.
              </p>
            </div>
          ) : (
            <div
              style={{
                padding: '16px',
                backgroundColor: 'var(--color-roles-surface)',
                border: '1px solid var(--color-roles-outline-color)',
                borderRadius: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--typography-title-small-fontfamily)',
                  fontSize: 'var(--typography-title-small-fontsize)',
                  fontWeight: 700,
                  color: 'var(--color-roles-error)',
                }}
              >
                Student Linking Incomplete
              </div>

              <AlertBox
                type="error"
                message={linkStatus?.error || 'Student not found with this student number. Please check the number and try again.'}
              />

              <p
                style={{
                  fontFamily: 'var(--typography-body-small-fontfamily)',
                  fontSize: 'var(--typography-body-small-fontsize)',
                  color: 'var(--color-roles-on-surface-variant)',
                  lineHeight: 'var(--typography-body-small-lineheight)',
                  margin: 0,
                }}
              >
                Your parent account is already registered. You do <strong>not</strong> need to create another account. You can retry linking now or link your child later from the Records page:
              </p>

              {retryError && (
                <div id="retry-student-error">
                  <AlertBox type="error" message={retryError} />
                </div>
              )}

              <form onSubmit={handleRetryLink} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }} noValidate>
                <div>
                  <label
                    htmlFor="retry-student-number"
                    style={{
                      display: 'block',
                      fontFamily: 'var(--typography-label-medium-fontfamily)',
                      fontSize: 'var(--typography-label-medium-fontsize)',
                      fontWeight: 600,
                      color: 'var(--color-roles-on-surface)',
                      marginBottom: '6px',
                    }}
                  >
                    Student Number{' '}
                    <span aria-hidden="true" style={{ color: 'var(--color-roles-error)', fontWeight: 'bold' }}>
                      *
                    </span>
                  </label>
                  <input
                    id="retry-student-number"
                    type="text"
                    placeholder="Enter correct Student No (e.g. SP-2026-0001)"
                    value={retryStudentNumber}
                    onChange={(e) => setRetryStudentNumber(e.target.value.toUpperCase())}
                    autoCapitalize="characters"
                    required
                    aria-invalid={Boolean(retryError)}
                    aria-describedby={retryError ? 'retry-student-error' : undefined}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '6px',
                      border: retryError
                        ? '1px solid var(--color-roles-error)'
                        : '1px solid var(--color-roles-outline-color)',
                      backgroundColor: 'var(--color-roles-background)',
                      color: 'var(--color-roles-on-surface)',
                      fontSize: 'var(--typography-body-medium-fontsize)',
                    }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={retryLoading || !retryStudentNumber.trim()}
                  aria-busy={retryLoading ? 'true' : undefined}
                  style={{
                    padding: '10px 16px',
                    backgroundColor: 'var(--color-roles-primary)',
                    color: 'var(--color-roles-on-primary)',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: 'var(--typography-label-medium-fontsize)',
                    fontWeight: 700,
                    cursor: retryLoading ? 'not-allowed' : 'pointer',
                    opacity: retryLoading || !retryStudentNumber.trim() ? 0.6 : 1,
                  }}
                >
                  {retryLoading ? 'Submitting Request...' : 'Submit Student Linking Request'}
                </button>
              </form>
            </div>
          )}

          {registeredToken && (
            <div
              style={{
                marginTop: '4px',
                padding: '14px',
                backgroundColor: 'var(--color-roles-surface-variant)',
                border: '1px solid var(--color-roles-outline-color)',
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--typography-label-medium-fontfamily)',
                  fontSize: 'var(--typography-label-medium-fontsize)',
                  fontWeight: 600,
                  color: 'var(--color-roles-primary)',
                  marginBottom: '8px',
                }}
              >
                Development Testing Stub:
              </div>
              <Link
                href={`/auth/verify-email?token=${registeredToken}`}
                style={{
                  display: 'inline-block',
                  padding: '8px 14px',
                  backgroundColor: 'var(--color-roles-primary)',
                  color: 'var(--color-roles-on-primary)',
                  fontSize: 'var(--typography-label-large-fontsize)',
                  fontFamily: 'var(--typography-label-large-fontfamily)',
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                Click to Verify Email Now &rarr;
              </Link>
            </div>
          )}

          <div style={{ marginTop: '12px' }}>
            <Link
              href="/auth/login"
              style={{
                display: 'block',
                textAlign: 'center',
                color: 'var(--color-roles-primary)',
                fontFamily: 'var(--typography-label-large-fontfamily)',
                fontSize: 'var(--typography-label-large-fontsize)',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Proceed to Sign In &rarr;
            </Link>
          </div>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Create Parent Account"
      subtitle="Register to access school information and your child's records."
      backHref="/"
      backLabel="Home"
      footer={
        <div style={{ textAlign: 'center' }}>
          <span
            style={{
              fontFamily: 'var(--typography-body-medium-fontfamily)',
              fontSize: 'var(--typography-body-medium-fontsize)',
              color: 'var(--color-roles-on-surface-variant)',
            }}
          >
            Already have an account?{' '}
            <Link
              href="/auth/login"
              style={{
                color: 'var(--color-roles-primary)',
                fontWeight: 600,
                textDecoration: 'underline',
              }}
            >
              Sign in
            </Link>
          </span>
        </div>
      }
    >
      <form onSubmit={handleSubmit} noValidate>
        {error && <AlertBox id="register-error-alert" type="error" message={error} />}

        <FormField
          id="name"
          label="Full Name"
          type="text"
          autoComplete="name"
          required
          placeholder="e.g. Chinedu Okafor"
          value={name}
          error={nameError || undefined}
          onChange={handleNameChange}
          onBlur={handleNameBlur}
        />

        <FormField
          id="email"
          label="Email Address"
          type="email"
          autoComplete="email"
          required
          placeholder="e.g. parent@example.com"
          value={email}
          error={emailError || undefined}
          onChange={handleEmailChange}
          onBlur={handleEmailBlur}
        />

        <FormField
          id="studentNumber"
          label="Child's Student Number"
          type="text"
          required
          placeholder="e.g. SP-2026-0001"
          helperText="Found on your child's admission letter or student ID card."
          value={studentNumber}
          error={studentNumberError || undefined}
          onChange={handleStudentNumberChange}
          onBlur={handleStudentNumberBlur}
        />

        <FormField
          id="password"
          label="Password"
          type="password"
          autoComplete="new-password"
          required
          maxLength={64}
          showPasswordToggle={true}
          error={passwordError || undefined}
          helperText={password.length > 0 && password.length < 8 && !passwordError ? 'Minimum 8 characters.' : undefined}
          value={password}
          onChange={handlePasswordChange}
          onBlur={handlePasswordBlur}
        />

        <FormField
          id="confirmPassword"
          label="Confirm Password"
          type="password"
          autoComplete="new-password"
          required
          showPasswordToggle={true}
          error={confirmPasswordError || undefined}
          value={confirmPassword}
          onChange={handleConfirmPasswordChange}
          onBlur={handleConfirmPasswordBlur}
        />

        {/* Terms and Conditions Acceptance Checkbox */}
        <div style={{ marginTop: '20px', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}>
            <input
              id="terms"
              type="checkbox"
              required
              checked={acceptedTerms}
              onChange={(e) => {
                setAcceptedTerms(e.target.checked);
                if (e.target.checked) {
                  setTermsError(null);
                }
              }}
              aria-invalid={Boolean(termsError)}
              aria-describedby={termsError ? 'terms-error' : undefined}
              style={{
                width: '16px',
                height: '16px',
                accentColor: 'var(--color-roles-primary)',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            />
            <div
              style={{
                fontFamily: 'var(--typography-body-small-fontfamily)',
                fontSize: 'var(--typography-body-small-fontsize)',
                lineHeight: 'var(--typography-body-small-lineheight)',
                color: 'var(--color-roles-on-surface)',
                whiteSpace: 'nowrap',
              }}
            >
              <label
                htmlFor="terms"
                style={{
                  cursor: 'pointer',
                }}
              >
                I agree to the{' '}
              </label>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  openLegalModal('terms', e.currentTarget);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  color: 'var(--color-roles-primary)',
                  fontWeight: 600,
                  textDecoration: 'underline',
                  fontFamily: 'inherit',
                  fontSize: 'inherit',
                  cursor: 'pointer',
                  verticalAlign: 'baseline',
                }}
              >
                Terms and Conditions
              </button>{' '}
              <label
                htmlFor="terms"
                style={{
                  cursor: 'pointer',
                }}
              >
                and{' '}
              </label>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  openLegalModal('privacy', e.currentTarget);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  color: 'var(--color-roles-primary)',
                  fontWeight: 600,
                  textDecoration: 'underline',
                  fontFamily: 'inherit',
                  fontSize: 'inherit',
                  cursor: 'pointer',
                  verticalAlign: 'baseline',
                }}
              >
                Privacy Policy
              </button>
              <label
                htmlFor="terms"
                style={{
                  cursor: 'pointer',
                }}
              >
                .
              </label>
            </div>
          </div>

          {termsError && (
            <span
              id="terms-error"
              role="alert"
              aria-live="polite"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontFamily: 'var(--typography-body-small-fontfamily)',
                fontSize: 'var(--typography-body-small-fontsize)',
                color: 'var(--color-roles-error)',
                marginTop: '6px',
              }}
            >
              <svg
                aria-hidden="true"
                focusable="false"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ flexShrink: 0 }}
              >
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <span>{termsError}</span>
            </span>
          )}
        </div>

        <div style={{ marginTop: '20px' }}>
          <PrimaryButton type="submit" loading={loading} disabled={!isFormValid}>
            Create Account
          </PrimaryButton>
        </div>
      </form>

      {/* Legal Document Modal Dialog */}
      {activeLegalDoc && (
        <div
          role="presentation"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            zIndex: 9999,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              closeLegalModal();
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="legal-modal-title"
            style={{
              backgroundColor: 'var(--color-roles-surface)',
              color: 'var(--color-roles-on-surface)',
              borderRadius: '8px',
              border: '1px solid var(--color-roles-outline-color)',
              boxShadow: 'var(--effect-hard-shadow)',
              width: '100%',
              maxWidth: '700px',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                padding: '24px 24px 16px',
                borderBottom: '1px solid var(--color-roles-outline-variant)',
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
                    marginBottom: '4px',
                  }}
                >
                  {activeLegalDoc === 'terms' ? TERMS_DOCUMENT.tag : PRIVACY_DOCUMENT.tag}
                </div>
                <h2
                  id="legal-modal-title"
                  style={{
                    margin: 0,
                    fontFamily: 'var(--typography-title-large-fontfamily)',
                    fontSize: 'var(--typography-title-large-fontsize)',
                    fontWeight: 700,
                    color: 'var(--color-roles-on-surface)',
                  }}
                >
                  {activeLegalDoc === 'terms' ? TERMS_DOCUMENT.title : PRIVACY_DOCUMENT.title}
                </h2>
                <p
                  style={{
                    margin: '4px 0 0',
                    fontFamily: 'var(--typography-body-small-fontfamily)',
                    fontSize: 'var(--typography-body-small-fontsize)',
                    color: 'var(--color-roles-on-surface-variant)',
                  }}
                >
                  {activeLegalDoc === 'terms' ? TERMS_DOCUMENT.subtitle : PRIVACY_DOCUMENT.subtitle}
                </p>
              </div>

              <button
                type="button"
                onClick={closeLegalModal}
                aria-label="Close dialog"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '6px',
                  color: 'var(--color-roles-on-surface-variant)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '4px',
                }}
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Scrollable Document Content */}
            <div
              tabIndex={0}
              role="region"
              aria-label={`${activeLegalDoc === 'terms' ? TERMS_DOCUMENT.title : PRIVACY_DOCUMENT.title} document content`}
              style={{
                padding: '24px',
                overflowY: 'auto',
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                gap: '24px',
              }}
            >
              {(activeLegalDoc === 'terms' ? TERMS_DOCUMENT.sections : PRIVACY_DOCUMENT.sections).map((sec, idx) => (
                <section key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <h3
                    style={{
                      fontFamily: 'var(--typography-title-large-fontfamily)',
                      fontSize: '18px',
                      fontWeight: 600,
                      color: 'var(--color-roles-on-surface)',
                      margin: 0,
                    }}
                  >
                    {sec.heading}
                  </h3>
                  {sec.paragraphs.map((p, pIdx) => (
                    <p
                      key={pIdx}
                      style={{
                        fontFamily: 'var(--typography-body-medium-fontfamily)',
                        fontSize: 'var(--typography-body-medium-fontsize)',
                        lineHeight: 'var(--typography-body-medium-lineheight)',
                        color: 'var(--color-roles-on-surface-variant)',
                        margin: 0,
                      }}
                    >
                      {p}
                    </p>
                  ))}
                  {sec.list && (
                    <ul
                      style={{
                        paddingLeft: '20px',
                        margin: '4px 0 0',
                        fontFamily: 'var(--typography-body-medium-fontfamily)',
                        fontSize: 'var(--typography-body-medium-fontsize)',
                        lineHeight: 'var(--typography-body-medium-lineheight)',
                        color: 'var(--color-roles-on-surface-variant)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                      }}
                    >
                      {sec.list.map((item, iIdx) => (
                        <li key={iIdx}>{item}</li>
                      ))}
                    </ul>
                  )}
                </section>
              ))}
            </div>

            {/* Modal Footer with Done Button */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                padding: '16px 24px',
                borderTop: '1px solid var(--color-roles-outline-variant)',
                backgroundColor: 'var(--color-roles-surface)',
              }}
            >
              <button
                ref={modalDoneBtnRef}
                type="button"
                onClick={closeLegalModal}
                style={{
                  padding: '10px 28px',
                  backgroundColor: 'var(--color-roles-primary)',
                  color: 'var(--color-roles-on-primary)',
                  border: 'none',
                  borderRadius: '4px',
                  fontFamily: 'var(--typography-label-large-fontfamily)',
                  fontSize: 'var(--typography-label-large-fontsize)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  minHeight: '44px',
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </AuthCard>
  );
}
