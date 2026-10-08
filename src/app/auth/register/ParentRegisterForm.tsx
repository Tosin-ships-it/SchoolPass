'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { AuthCard } from '../components/AuthCard';
import { FormField, PrimaryButton, AlertBox } from '../components/AuthFormElements';

export function ParentRegisterForm() {
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
        backHref="/auth/login"
        backLabel="Back to Sign In"
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
