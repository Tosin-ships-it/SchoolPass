'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { AuthCard } from '../components/AuthCard';
import { FormField, PrimaryButton, AlertBox } from '../components/AuthFormElements';

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [devResetToken, setDevResetToken] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError('Please enter your account email address.');
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
        backHref="/auth/login"
        backLabel="Back to Sign In"
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
              <Link
                href={`/auth/reset-password?token=${devResetToken}`}
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
                Reset Password with Test Token &rarr;
              </Link>
            </div>
          )}

          <div style={{ marginTop: '16px' }}>
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
              Return to Sign In
            </Link>
          </div>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Reset Password"
      subtitle="Enter your email to receive a password reset link."
      backHref="/auth/login"
      backLabel="Sign In"
      footer={
        <div style={{ textAlign: 'center' }}>
          <Link
            href="/auth/login"
            style={{
              fontFamily: 'var(--typography-body-medium-fontfamily)',
              fontSize: 'var(--typography-body-medium-fontsize)',
              color: 'var(--color-roles-primary)',
              textDecoration: 'none',
            }}
          >
            Remember your password? Sign in
          </Link>
        </div>
      }
    >
      <form onSubmit={handleSubmit} noValidate>
        {error && <AlertBox id="forgot-password-error" type="error" message={error} />}

        <FormField
          id="email"
          label="Account Email Address"
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
