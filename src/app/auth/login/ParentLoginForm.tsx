'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuthCard } from '../components/AuthCard';
import { FormField, PrimaryButton, AlertBox, DevCredentialsHint } from '../components/AuthFormElements';

export function ParentLoginForm() {
  const router = useRouter();

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
        setError(data.error || 'Failed to sign in. Please try again.');
        setErrorCode(data.errorCode || null);
        return;
      }

      const params = new URLSearchParams(window.location.search);
      const returnUrl = params.get('returnUrl') || '/ask';
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
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.verificationToken) {
        setResendStatus(`Verification link sent! (Test token: ${data.verificationToken})`);
      } else {
        setResendStatus('If an unverified account exists, a new verification link has been sent to your email.');
      }
    } catch {
      setError('Failed to resend verification email.');
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
        {error && <AlertBox type="error" message={error} />}

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

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            marginBottom: '18px',
          }}
        >
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

        <PrimaryButton type="submit" loading={loading}>
          Sign in
        </PrimaryButton>
      </form>

      <DevCredentialsHint
        role="parent"
        onSelect={(selectedEmail, selectedPass) => {
          setEmail(selectedEmail);
          setPassword(selectedPass);
        }}
      />
    </AuthCard>
  );
}
