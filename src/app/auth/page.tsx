'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthCard } from './components/AuthCard';
import { FormField, PrimaryButton, AlertBox, DevCredentialsHint } from './components/AuthFormElements';

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
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Sign in failed. Please check your credentials.');
        if (data.code === 'EMAIL_NOT_VERIFIED') {
          setErrorCode('EMAIL_NOT_VERIFIED');
        }
        return;
      }

      router.push(returnUrl);
      router.refresh();
    } catch {
      setError('Something went wrong. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!email) {
      setError('Please enter your email address to resend verification.');
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
        {error && <AlertBox type="error" message={error} />}

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
          onChange={(e) => setEmail(e.target.value)}
        />

        <FormField
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          required
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
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registeredToken, setRegisteredToken] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Registration failed. Please check your details.');
        return;
      }

      setIsSuccess(true);
      if (data.verificationToken) {
        setRegisteredToken(data.verificationToken);
      }
    } catch {
      setError('Something went wrong. Please check your connection and try again.');
    } finally {
      setLoading(false);
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

          <p
            style={{
              fontFamily: 'var(--typography-body-medium-fontfamily)',
              fontSize: 'var(--typography-body-medium-fontsize)',
              color: 'var(--color-roles-on-surface-variant)',
              lineHeight: 'var(--typography-body-medium-lineheight)',
            }}
          >
            Once verified, you will be able to sign in immediately. The school staff will then link your account to your child or children.
          </p>

          {registeredToken && (
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
        {error && <AlertBox type="error" message={error} />}

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
          onChange={(e) => setEmail(e.target.value)}
        />

        <FormField
          id="password"
          label="Password"
          type="password"
          autoComplete="new-password"
          required
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
    setLoading(true);

    try {
      const res = await fetch('/api/auth/staff-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Invalid staff credentials.');
        return;
      }

      router.push(returnUrl);
      router.refresh();
    } catch {
      setError('Something went wrong. Please check your connection and try again.');
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
        {error && <AlertBox type="error" message={error} />}

        <FormField
          id="email"
          label="Staff Email"
          type="email"
          autoComplete="email"
          required
          placeholder="e.g. staff@schoolpass.ng"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <FormField
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <DevCredentialsHint />

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
    setLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      setIsSubmitted(true);
      if (data.resetToken) {
        setDevResetToken(data.resetToken);
      }
    } catch {
      setError('Something went wrong. Please check your connection and try again.');
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

          {devResetToken && (
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
        {error && <AlertBox type="error" message={error} />}

        <FormField
          id="email"
          label="Account Email"
          type="email"
          autoComplete="email"
          required
          placeholder="e.g. parent@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
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
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.trim(), password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to reset password. The link may have expired.');
        return;
      }

      setSuccess(true);
    } catch {
      setError('Something went wrong. Please check your connection and try again.');
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
        {error && <AlertBox type="error" message={error} />}

        <FormField
          id="token"
          label="Reset Token"
          type="text"
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
        body: JSON.stringify({ token: tokenToVerify }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Verification failed. The link may have expired.');
        return;
      }

      setSuccess(true);
    } catch {
      setError('Something went wrong. Please check your connection and try again.');
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
        {error && <AlertBox type="error" message={error} />}

        <FormField
          id="token"
          label="Verification Code / Token"
          type="text"
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
