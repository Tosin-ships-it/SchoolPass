'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuthCard } from '../components/AuthCard';
import { FormField, PrimaryButton, AlertBox, DevCredentialsHint } from '../components/AuthFormElements';

function isValidEmail(value: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value.trim());
}

export function ParentLoginForm() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [resendStatus, setResendStatus] = useState<string | null>(null);

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toLowerCase();
    setEmail(val);
    if (emailError) {
      if (isValidEmail(val)) {
        setEmailError(null);
      }
    }
  };

  const handleEmailBlur = () => {
    const normalized = email.toLowerCase();
    if (normalized !== email) {
      setEmail(normalized);
    }
    if (normalized.trim().length > 0 && !isValidEmail(normalized)) {
      setEmailError('Enter a valid email address');
    } else if (isValidEmail(normalized)) {
      setEmailError(null);
    }
  };

  const isButtonEnabled = email.trim().length > 0 && password.trim().length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setErrorCode(null);
    setResendStatus(null);

    if (!isButtonEnabled) {
      if (!email.trim()) {
        document.getElementById('email')?.focus();
      } else if (!password.trim()) {
        document.getElementById('password')?.focus();
      }
      return;
    }

    if (!isValidEmail(email)) {
      setEmailError('Enter a valid email address');
      document.getElementById('email')?.focus();
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password, rememberMe }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.errorCode === 'EMAIL_NOT_VERIFIED') {
          setError(data.error);
          setErrorCode('EMAIL_NOT_VERIFIED');
        } else if (data.errorCode === 'RATE_LIMITED') {
          setError(data.error);
          setErrorCode('RATE_LIMITED');
        } else {
          setError('Invalid email or password.');
          setErrorCode(null);
        }
        setTimeout(() => {
          document.getElementById('parent-login-error')?.focus();
        }, 50);
        return;
      }

      const params = new URLSearchParams(window.location.search);
      const returnUrl = params.get('returnUrl') || '/ask';
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
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      await res.json();
      setResendStatus('If an unverified account exists, a new verification link has been sent to your email.');
    } catch {
      setError('Failed to resend verification email.');
      setTimeout(() => {
        document.getElementById('parent-login-error')?.focus();
      }, 50);
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
            <Link
              href="/auth/register"
              style={{
                color: 'var(--color-roles-primary)',
                fontWeight: 600,
                textDecoration: 'underline',
              }}
            >
              Register here
            </Link>
          </div>

          <div
            style={{
              fontFamily: 'var(--typography-body-small-fontfamily)',
              fontSize: 'var(--typography-body-small-fontsize)',
              color: 'var(--color-roles-on-surface-variant)',
            }}
          >
            School personnel?{' '}
            <Link
              href="/auth/staff-login"
              style={{
                color: 'var(--color-roles-secondary)',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Staff &amp; Admin Sign In &rarr;
            </Link>
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
                color: 'var(--color-roles-primary)',
                fontSize: 'var(--typography-body-small-fontsize)',
                fontFamily: 'var(--typography-body-small-fontfamily)',
                textDecoration: 'underline',
                padding: 0,
              }}
            >
              Resend verification email
            </button>
            {resendStatus && (
              <p
                role="status"
                aria-live="polite"
                style={{
                  marginTop: '6px',
                  fontSize: 'var(--typography-body-small-fontsize)',
                  color: 'var(--color-roles-on-primary-container)',
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
          error={emailError || undefined}
          onChange={handleEmailChange}
          onBlur={handleEmailBlur}
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

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            marginBottom: '18px',
          }}
        >
          <label
            htmlFor="remember-me"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              fontFamily: 'var(--typography-body-small-fontfamily)',
              fontSize: 'var(--typography-body-small-fontsize)',
              color: 'var(--color-roles-on-surface)',
              userSelect: 'none',
            }}
          >
            <input
              id="remember-me"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              style={{
                width: '16px',
                height: '16px',
                accentColor: 'var(--color-roles-primary)',
                cursor: 'pointer',
              }}
            />
            <span>Remember me</span>
          </label>

          <Link
            href="/auth/forgot-password"
            style={{
              fontFamily: 'var(--typography-body-small-fontfamily)',
              fontSize: 'var(--typography-body-small-fontsize)',
              color: 'var(--color-roles-primary)',
              textDecoration: 'none',
            }}
          >
            Forgot password?
          </Link>
        </div>

        <PrimaryButton type="submit" loading={loading} disabled={!isButtonEnabled || loading}>
          Sign in
        </PrimaryButton>
      </form>

      <DevCredentialsHint
        role="parent"
        onSelect={(selectedEmail, selectedPass) => {
          setEmail(selectedEmail);
          setPassword(selectedPass);
          setEmailError(null);
        }}
      />
    </AuthCard>
  );
}
