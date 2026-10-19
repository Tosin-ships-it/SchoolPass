'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthCard } from './components/AuthCard';
import { FormField, PrimaryButton, AlertBox, DevCredentialsHint, isDevStubsEnabled } from './components/AuthFormElements';

export type AuthView =
  | 'login'
  | 'register'
  | 'staff-login'
  | 'forgot-password'
  | 'reset-password'
  | 'verify-email';

interface ViewProps {
  onSwitchView: (view: AuthView) => void;
  initialToken?: string;
}

// =============================================================================
// 1. Parent Login View
// =============================================================================
function ParentLoginView({ onSwitchView }: ViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get('returnUrl') || '/ask';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [resendStatus, setResendStatus] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setErrorCode(null);
    setResendStatus(null);

    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    if (!trimmedEmail) {
      setError('Please enter your email address.');
      document.getElementById('email')?.focus();
      return;
    }

    if (!trimmedPassword) {
      setError('Please enter your password.');
      document.getElementById('password')?.focus();
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail, password: password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Sign in failed. Please check your credentials.');
        if (data.code === 'EMAIL_NOT_VERIFIED') {
          setErrorCode('EMAIL_NOT_VERIFIED');
        }
        setTimeout(() => {
          document.getElementById('parent-login-error')?.focus();
        }, 50);
        return;
      }

      router.push(returnUrl);
      router.refresh();
    } catch {
      setError('Something went wrong. Please check your connection and try again.');
      setTimeout(() => {
        document.getElementById('parent-login-error')?.focus();
      }, 50);
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!email) {
      setError('Please enter your email address to resend verification.');
      document.getElementById('email')?.focus();
      return;
    }
    setResendStatus('Resending verification email...');
    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.ok) {
        setResendStatus('Verification email sent! Please check your inbox.');
      } else {
        setResendStatus(data.error || 'Failed to resend verification email.');
      }
    } catch {
      setResendStatus('Failed to resend verification email.');
    }
  };

  return (
    <AuthCard
      title="Parent Sign In"
      subtitle="Access your child's records, attendance, and school information."
      backHref="/"
      backLabel="Home"
      footer={
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', textAlign: 'center' }}>
          <div
            style={{
              fontFamily: 'var(--typography-body-medium-fontfamily)',
              fontSize: 'var(--typography-body-medium-fontsize)',
              color: 'var(--color-roles-on-surface-variant)',
            }}
          >
            Don&apos;t have an account yet?{' '}
            <button
              type="button"
              onClick={() => onSwitchView('register')}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                color: 'var(--color-roles-primary)',
                fontWeight: 600,
                textDecoration: 'underline',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 'inherit',
              }}
            >
              Register here
            </button>
          </div>

          <div
            style={{
              fontFamily: 'var(--typography-body-small-fontfamily)',
              fontSize: 'var(--typography-body-small-fontsize)',
              color: 'var(--color-roles-on-surface-variant)',
            }}
          >
            School personnel?{' '}
            <button
              type="button"
              onClick={() => onSwitchView('staff-login')}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                color: 'var(--color-roles-secondary)',
                fontWeight: 600,
                textDecoration: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 'inherit',
              }}
            >
              Staff &amp; Admin Sign In &rarr;
            </button>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSubmit} noValidate>
        {error && <AlertBox id="parent-login-error" type="error" message={error} />}

        {errorCode === 'EMAIL_NOT_VERIFIED' && (
          <div style={{ marginBottom: '16px' }}>
            <button
              type="button"
              onClick={handleResendVerification}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-roles-primary)',
                fontSize: 'var(--typography-body-small-fontsize)',
                fontFamily: 'var(--typography-body-small-fontfamily)',
                textDecoration: 'underline',
                padding: 0,
                cursor: 'pointer',
              }}
            >
              Resend verification email
            </button>
            {resendStatus && (
              <p
                role="status"
                aria-live="polite"
                style={{
                  fontSize: 'var(--typography-body-small-fontsize)',
                  color: 'var(--color-roles-primary)',
                  marginTop: '4px',
                }}
              >
                {resendStatus}
              </p>
            )}
          </div>
        )}

        <FormField
          id="email"
          label="Email Address"
          type="email"
          autoComplete="email"
          required
          placeholder="e.g. parent@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value.toLowerCase())}
        />

        <FormField
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          showPasswordToggle={true}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
          <button
            type="button"
            onClick={() => onSwitchView('forgot-password')}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-roles-primary)',
              fontSize: 'var(--typography-body-small-fontsize)',
              fontFamily: 'var(--typography-body-small-fontfamily)',
              textDecoration: 'underline',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            Forgot password?
          </button>
        </div>

        <PrimaryButton type="submit" loading={loading}>
          Sign In
        </PrimaryButton>
      </form>
    </AuthCard>
  );
}

// =============================================================================
// 2. Parent Register View
// =============================================================================
function ParentRegisterView({ onSwitchView }: ViewProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [studentNumber, setStudentNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registeredToken, setRegisteredToken] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Please enter your full name.');
      document.getElementById('name')?.focus();
      return;
    }

    if (!email.trim()) {
      setError('Please enter your email address.');
      document.getElementById('email')?.focus();
      return;
    }

    if (!studentNumber.trim()) {
      setError("Please enter your child's student number.");
      document.getElementById('studentNumber')?.focus();
      return;
    }

    const trimmedPassword = password.trim();
    const trimmedConfirmPassword = confirmPassword.trim();

    if (!trimmedPassword) {
      setError('Please enter a password.');
      document.getElementById('password')?.focus();
      return;
    }

    if (trimmedPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      document.getElementById('password')?.focus();
      return;
    }

    if (trimmedPassword !== trimmedConfirmPassword) {
      setError('Passwords do not match.');
      document.getElementById('confirmPassword')?.focus();
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password: trimmedPassword,
          studentNumber: studentNumber.trim().toUpperCase(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Registration failed. Please check your details.');
        setTimeout(() => {
          document.getElementById('parent-register-error')?.focus();
        }, 50);
        return;
      }

      setIsSuccess(true);
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
        document.getElementById('parent-register-error')?.focus();
      }, 50);
    } finally {
      setLoading(false);
    }
  };

  const handleRetryLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setRetryError(null);
    const trimmed = retryStudentNumber.trim().toUpperCase();
    if (!trimmed) {
      setRetryError('Please enter a valid student number.');
      document.getElementById('auth-retry-student-number')?.focus();
      return;
    }

    setRetryLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          token: registeredToken,
          studentNumber: trimmed,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setRetryError(data.error || 'Failed to submit student link request.');
        document.getElementById('auth-retry-student-number')?.focus();
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
      document.getElementById('auth-retry-student-number')?.focus();
    } finally {
      setRetryLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <AuthCard
        title="Check Your Email"
        subtitle="We sent an email verification link to complete your registration."
        backHref="/"
        backLabel="Home"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <AlertBox
            type="success"
            message={`A verification link has been sent to ${email}. Please check your inbox and verify your email before signing in.`}
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
                Your request has been submitted to school administrators. Access to your child&apos;s records is strictly restricted until staff review and approve this link.
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
                message={linkStatus?.error || 'Student not found with this student number. Please check and try again.'}
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
                Your parent account is registered. You do <strong>not</strong> need to create another account. Retry linking your child below:
              </p>

              {retryError && (
                <div id="auth-retry-student-error">
                  <AlertBox type="error" message={retryError} />
                </div>
              )}

              <form onSubmit={handleRetryLink} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }} noValidate>
                <div>
                  <label
                    htmlFor="auth-retry-student-number"
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
                    id="auth-retry-student-number"
                    type="text"
                    placeholder="Enter correct Student No (e.g. SP-2026-0001)"
                    value={retryStudentNumber}
                    onChange={(e) => setRetryStudentNumber(e.target.value.toUpperCase())}
                    autoCapitalize="characters"
                    required
                    aria-invalid={Boolean(retryError)}
                    aria-describedby={retryError ? 'auth-retry-student-error' : undefined}
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

          {isDevStubsEnabled() && registeredToken && (
            <div
              style={{
                marginTop: '12px',
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
              <button
                type="button"
                onClick={() => onSwitchView('verify-email')}
                style={{
                  display: 'inline-block',
                  padding: '8px 14px',
                  backgroundColor: 'var(--color-roles-primary)',
                  color: 'var(--color-roles-on-primary)',
                  fontSize: 'var(--typography-label-large-fontsize)',
                  fontFamily: 'var(--typography-label-large-fontfamily)',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Click to Verify Email Now &rarr;
              </button>
            </div>
          )}

          <div style={{ marginTop: '16px' }}>
            <button
              type="button"
              onClick={() => onSwitchView('login')}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'center',
                color: 'var(--color-roles-primary)',
                fontFamily: 'var(--typography-label-large-fontfamily)',
                fontSize: 'var(--typography-label-large-fontsize)',
                fontWeight: 600,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textDecoration: 'none',
              }}
            >
              Proceed to Sign In &rarr;
            </button>
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
            <button
              type="button"
              onClick={() => onSwitchView('login')}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                color: 'var(--color-roles-primary)',
                fontWeight: 600,
                textDecoration: 'underline',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 'inherit',
              }}
            >
              Sign in
            </button>
          </span>
        </div>
      }
    >
      <form onSubmit={handleSubmit} noValidate>
        {error && <AlertBox id="parent-register-error" type="error" message={error} />}

        <FormField
          id="name"
          label="Full Name"
          type="text"
          autoComplete="name"
          required
          placeholder="e.g. Chinedu Okafor"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <FormField
          id="email"
          label="Email Address"
          type="email"
          autoComplete="email"
          required
          placeholder="e.g. parent@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value.toLowerCase())}
        />

        <FormField
          id="studentNumber"
          label="Child's Student Number"
          type="text"
          required
          placeholder="e.g. SP-2026-0001"
          helperText="Found on your child's admission letter or student ID card."
          value={studentNumber}
          onChange={(e) => setStudentNumber(e.target.value.toUpperCase())}
        />

        <FormField
          id="password"
          label="Password"
          type="password"
          autoComplete="new-password"
          required
          showPasswordToggle={true}
          helperText="Minimum 8 characters."
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <FormField
          id="confirmPassword"
          label="Confirm Password"
          type="password"
          autoComplete="new-password"
          required
          showPasswordToggle={true}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />

        <div style={{ marginTop: '24px' }}>
          <PrimaryButton type="submit" loading={loading}>
            Create Account
          </PrimaryButton>
        </div>
      </form>
    </AuthCard>
  );
}

// =============================================================================
// 3. Staff & Admin Login View
// =============================================================================
function StaffLoginView({ onSwitchView }: ViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get('returnUrl') || '/attendance';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    if (!trimmedEmail) {
      setError('Please enter your staff email.');
      document.getElementById('email')?.focus();
      return;
    }

    if (!trimmedPassword) {
      setError('Please enter your password.');
      document.getElementById('password')?.focus();
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/staff-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail, password: password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Invalid staff credentials.');
        setTimeout(() => {
          document.getElementById('staff-login-error')?.focus();
        }, 50);
        return;
      }

      router.push(returnUrl);
      router.refresh();
    } catch {
      setError('Something went wrong. Please check your connection and try again.');
      setTimeout(() => {
        document.getElementById('staff-login-error')?.focus();
      }, 50);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard
      title="Staff &amp; Admin Sign In"
      subtitle="School administrative management portal."
      backHref="/"
      backLabel="Home"
      footer={
        <div style={{ textAlign: 'center' }}>
          <span
            style={{
              fontFamily: 'var(--typography-body-small-fontfamily)',
              fontSize: 'var(--typography-body-small-fontsize)',
              color: 'var(--color-roles-on-surface-variant)',
            }}
          >
            Looking for Parent Sign In?{' '}
            <button
              type="button"
              onClick={() => onSwitchView('login')}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                color: 'var(--color-roles-primary)',
                fontWeight: 600,
                textDecoration: 'underline',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 'inherit',
              }}
            >
              Parent Portal
            </button>
          </span>
        </div>
      }
    >
      <form onSubmit={handleSubmit} noValidate>
        {error && <AlertBox id="staff-login-error" type="error" message={error} />}

        <FormField
          id="email"
          label="Staff Email"
          type="email"
          autoComplete="email"
          required
          placeholder="e.g. staff@schoolpass.ng"
          value={email}
          onChange={(e) => setEmail(e.target.value.toLowerCase())}
        />

        <FormField
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          showPasswordToggle={true}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <DevCredentialsHint role="staff" />

        <div style={{ marginTop: '20px' }}>
          <PrimaryButton type="submit" loading={loading}>
            Sign In to Staff Portal
          </PrimaryButton>
        </div>
      </form>
    </AuthCard>
  );
}

// =============================================================================
// 4. Forgot Password View
// =============================================================================
function ForgotPasswordView({ onSwitchView }: ViewProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [devResetToken, setDevResetToken] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError('Please enter your account email.');
      document.getElementById('email')?.focus();
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json();

      setIsSubmitted(true);
      if (data.resetToken) {
        setDevResetToken(data.resetToken);
      }
    } catch {
      setError('Something went wrong. Please check your connection and try again.');
      setTimeout(() => {
        document.getElementById('forgot-password-error')?.focus();
      }, 50);
    } finally {
      setLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <AuthCard
        title="Check Your Inbox"
        subtitle="Password reset instructions"
        backHref="/"
        backLabel="Home"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <AlertBox
            type="info"
            message={`If an account exists with the email address ${email}, we have sent instructions to reset your password.`}
          />

          <p
            style={{
              fontFamily: 'var(--typography-body-medium-fontfamily)',
              fontSize: 'var(--typography-body-medium-fontsize)',
              color: 'var(--color-roles-on-surface-variant)',
              lineHeight: 'var(--typography-body-medium-lineheight)',
            }}
          >
            Password reset links expire in 1 hour. If you do not see the email, please check your spam folder.
          </p>

          {isDevStubsEnabled() && devResetToken && (
            <div
              style={{
                marginTop: '12px',
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
              <button
                type="button"
                onClick={() => onSwitchView('reset-password')}
                style={{
                  display: 'inline-block',
                  padding: '8px 14px',
                  backgroundColor: 'var(--color-roles-primary)',
                  color: 'var(--color-roles-on-primary)',
                  fontSize: 'var(--typography-label-large-fontsize)',
                  fontFamily: 'var(--typography-label-large-fontfamily)',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Click to Reset Password Now &rarr;
              </button>
            </div>
          )}

          <div style={{ marginTop: '16px' }}>
            <button
              type="button"
              onClick={() => onSwitchView('login')}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'center',
                color: 'var(--color-roles-primary)',
                fontFamily: 'var(--typography-label-large-fontfamily)',
                fontSize: 'var(--typography-label-large-fontsize)',
                fontWeight: 600,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textDecoration: 'none',
              }}
            >
              Return to Sign In &rarr;
            </button>
          </div>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Reset Password"
      subtitle="Enter your email to receive a password reset link."
      backHref="/"
      backLabel="Home"
      footer={
        <div style={{ textAlign: 'center' }}>
          <button
            type="button"
            onClick={() => onSwitchView('login')}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              color: 'var(--color-roles-primary)',
              fontFamily: 'var(--typography-body-medium-fontfamily)',
              fontSize: 'var(--typography-body-medium-fontsize)',
              fontWeight: 600,
              textDecoration: 'underline',
              cursor: 'pointer',
            }}
          >
            Remember your password? Sign in
          </button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} noValidate>
        {error && <AlertBox id="forgot-password-error" type="error" message={error} />}

        <FormField
          id="email"
          label="Account Email"
          type="email"
          autoComplete="email"
          required
          placeholder="e.g. parent@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value.toLowerCase())}
        />

        <div style={{ marginTop: '20px' }}>
          <PrimaryButton type="submit" loading={loading}>
            Send Reset Link
          </PrimaryButton>
        </div>
      </form>
    </AuthCard>
  );
}

// =============================================================================
// 5. Reset Password View
// =============================================================================
function ResetPasswordView({ onSwitchView, initialToken }: ViewProps) {
  const [token, setToken] = useState(initialToken || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token.trim()) {
      setError('Password reset token is missing.');
      document.getElementById('token')?.focus();
      return;
    }

    const trimmedPassword = password.trim();
    const trimmedConfirmPassword = confirmPassword.trim();

    if (!trimmedPassword) {
      setError('Please enter a new password.');
      document.getElementById('password')?.focus();
      return;
    }

    if (trimmedPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      document.getElementById('password')?.focus();
      return;
    }

    if (trimmedPassword !== trimmedConfirmPassword) {
      setError('Passwords do not match.');
      document.getElementById('confirmPassword')?.focus();
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.trim(), password: trimmedPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to reset password. The link may have expired.');
        setTimeout(() => {
          document.getElementById('reset-password-error')?.focus();
        }, 50);
        return;
      }

      setSuccess(true);
    } catch {
      setError('Something went wrong. Please check your connection and try again.');
      setTimeout(() => {
        document.getElementById('reset-password-error')?.focus();
      }, 50);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <AuthCard
        title="Password Reset Complete"
        subtitle="Your password has been successfully updated."
        backHref="/"
        backLabel="Home"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <AlertBox type="success" message="You can now sign in with your new password." />

          <button
            type="button"
            onClick={() => onSwitchView('login')}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'center',
              backgroundColor: 'var(--color-roles-primary)',
              color: 'var(--color-roles-on-primary)',
              fontFamily: 'var(--typography-label-large-fontfamily)',
              fontSize: 'var(--typography-label-large-fontsize)',
              fontWeight: 600,
              padding: '12px',
              border: 'none',
              cursor: 'pointer',
              textDecoration: 'none',
            }}
          >
            Sign In Now &rarr;
          </button>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Set New Password"
      subtitle="Choose a secure password with at least 8 characters."
      backHref="/"
      backLabel="Home"
      footer={
        <div style={{ textAlign: 'center' }}>
          <button
            type="button"
            onClick={() => onSwitchView('login')}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              color: 'var(--color-roles-primary)',
              fontFamily: 'var(--typography-body-medium-fontfamily)',
              fontSize: 'var(--typography-body-medium-fontsize)',
              fontWeight: 600,
              textDecoration: 'underline',
              cursor: 'pointer',
            }}
          >
            Back to Sign In
          </button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} noValidate>
        {error && <AlertBox id="reset-password-error" type="error" message={error} />}

        <FormField
          id="token"
          label="Reset Token"
          type="text"
          autoComplete="one-time-code"
          required
          placeholder="Paste token if not pre-filled"
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />

        <FormField
          id="password"
          label="New Password"
          type="password"
          autoComplete="new-password"
          required
          showPasswordToggle={true}
          helperText="Minimum 8 characters. Cannot be one of your last 3 passwords."
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <FormField
          id="confirmPassword"
          label="Confirm New Password"
          type="password"
          autoComplete="new-password"
          required
          showPasswordToggle={true}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />

        <div style={{ marginTop: '20px' }}>
          <PrimaryButton type="submit" loading={loading}>
            Update Password
          </PrimaryButton>
        </div>
      </form>
    </AuthCard>
  );
}

// =============================================================================
// 6. Verify Email View
// =============================================================================
function VerifyEmailView({ onSwitchView, initialToken }: ViewProps) {
  const [token, setToken] = useState(initialToken || '');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const performVerification = async (tokenToVerify: string) => {
    if (!tokenToVerify) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tokenToVerify.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Verification failed. The link may have expired.');
        setTimeout(() => {
          document.getElementById('verify-email-error')?.focus();
        }, 50);
        return;
      }

      setSuccess(true);
    } catch {
      setError('Something went wrong. Please check your connection and try again.');
      setTimeout(() => {
        document.getElementById('verify-email-error')?.focus();
      }, 50);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialToken) {
      performVerification(initialToken);
    }
  }, [initialToken]);

  if (success) {
    return (
      <AuthCard
        title="Email Verified"
        subtitle="Your email address has been successfully confirmed."
        backHref="/"
        backLabel="Home"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <AlertBox
            type="success"
            message="Your account is verified! You can now sign in with your email and password."
          />

          <p
            style={{
              fontFamily: 'var(--typography-body-medium-fontfamily)',
              fontSize: 'var(--typography-body-medium-fontsize)',
              color: 'var(--color-roles-on-surface-variant)',
              lineHeight: 'var(--typography-body-medium-lineheight)',
            }}
          >
            School staff will link your verified account to your student records.
          </p>

          <button
            type="button"
            onClick={() => onSwitchView('login')}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'center',
              backgroundColor: 'var(--color-roles-primary)',
              color: 'var(--color-roles-on-primary)',
              fontFamily: 'var(--typography-label-large-fontfamily)',
              fontSize: 'var(--typography-label-large-fontsize)',
              fontWeight: 600,
              padding: '12px',
              border: 'none',
              cursor: 'pointer',
              textDecoration: 'none',
            }}
          >
            Sign In to Portal &rarr;
          </button>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Verify Your Email"
      subtitle="Complete your parent account registration."
      backHref="/"
      backLabel="Home"
      footer={
        <div style={{ textAlign: 'center' }}>
          <button
            type="button"
            onClick={() => onSwitchView('login')}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              color: 'var(--color-roles-primary)',
              fontFamily: 'var(--typography-body-medium-fontfamily)',
              fontSize: 'var(--typography-body-medium-fontsize)',
              fontWeight: 600,
              textDecoration: 'underline',
              cursor: 'pointer',
            }}
          >
            Back to Sign In
          </button>
        </div>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          performVerification(token);
        }}
        noValidate
      >
        {error && <AlertBox id="verify-email-error" type="error" message={error} />}

        <FormField
          id="token"
          label="Verification Code / Token"
          type="text"
          autoComplete="one-time-code"
          required
          placeholder="Paste verification token"
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />

        <div style={{ marginTop: '20px' }}>
          <PrimaryButton type="submit" loading={loading} disabled={!token.trim()}>
            Verify Email
          </PrimaryButton>
        </div>
      </form>
    </AuthCard>
  );
}

// =============================================================================
// Unified Auth Page Container with View Switching & Query Param Support
// =============================================================================
function AuthPageContainer() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const requestedView = searchParams.get('view') as AuthView | null;
  const tokenParam = searchParams.get('token') || undefined;

  // Determine initial view based on query parameters
  const determineInitialView = (): AuthView => {
    if (requestedView && ['login', 'register', 'staff-login', 'forgot-password', 'reset-password', 'verify-email'].includes(requestedView)) {
      return requestedView;
    }
    if (tokenParam) {
      if (searchParams.get('mode') === 'reset' || searchParams.has('reset')) {
        return 'reset-password';
      }
      return 'verify-email';
    }
    return 'login';
  };

  const [currentView, setCurrentView] = useState<AuthView>(determineInitialView);

  // Sync state if URL query param changes
  useEffect(() => {
    if (requestedView && ['login', 'register', 'staff-login', 'forgot-password', 'reset-password', 'verify-email'].includes(requestedView)) {
      setCurrentView(requestedView);
    }
  }, [requestedView]);

  const handleSwitchView = (newView: AuthView) => {
    setCurrentView(newView);
    const params = new URLSearchParams(window.location.search);
    params.set('view', newView);
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    router.replace(newUrl);
  };

  return (
    <>
      {currentView === 'login' && <ParentLoginView onSwitchView={handleSwitchView} />}
      {currentView === 'register' && <ParentRegisterView onSwitchView={handleSwitchView} />}
      {currentView === 'staff-login' && <StaffLoginView onSwitchView={handleSwitchView} />}
      {currentView === 'forgot-password' && <ForgotPasswordView onSwitchView={handleSwitchView} />}
      {currentView === 'reset-password' && (
        <ResetPasswordView onSwitchView={handleSwitchView} initialToken={tokenParam} />
      )}
      {currentView === 'verify-email' && (
        <VerifyEmailView onSwitchView={handleSwitchView} initialToken={tokenParam} />
      )}
    </>
  );
}

// =============================================================================
// Root Page Component
// =============================================================================
export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: '100dvh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'var(--color-roles-background)',
            color: 'var(--color-roles-on-surface-variant)',
            fontFamily: 'var(--typography-body-medium-fontfamily)',
          }}
        >
          Loading SchoolPass authentication...
        </div>
      }
    >
      <AuthPageContainer />
    </Suspense>
  );
}
