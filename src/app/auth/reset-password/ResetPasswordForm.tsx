'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AuthCard } from '../components/AuthCard';
import { FormField, PrimaryButton, AlertBox } from '../components/AuthFormElements';

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const tokenFromUrl = searchParams.get('token') || '';

  const [token, setToken] = useState(tokenFromUrl);
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
        backHref="/auth/login"
        backLabel="Sign In"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <AlertBox
            type="success"
            message="Your password has been changed and all other sessions have been logged out. You can now sign in with your new password."
          />

          <Link
            href="/auth/login"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              padding: '12px 20px',
              backgroundColor: 'var(--color-roles-primary)',
              color: 'var(--color-roles-on-primary)',
              fontFamily: 'var(--typography-label-large-fontfamily)',
              fontSize: 'var(--typography-label-large-fontsize)',
              fontWeight: 600,
              textDecoration: 'none',
              boxShadow: 'var(--effect-soft-shadow)',
            }}
          >
            Sign In with New Password &rarr;
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Create New Password"
      subtitle="Enter a new password for your SchoolPass account."
      backHref="/auth/login"
      backLabel="Sign In"
    >
      <form onSubmit={handleSubmit} noValidate>
        {error && <AlertBox type="error" message={error} />}

        {!tokenFromUrl && (
          <FormField
            id="token"
            label="Reset Token"
            type="text"
            required
            placeholder="Paste your reset token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
        )}

        <FormField
          id="password"
          label="New Password"
          type="password"
          autoComplete="new-password"
          required
          helperText="Minimum 8 characters. Cannot reuse last 3 passwords."
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
            Save New Password
          </PrimaryButton>
        </div>
      </form>
    </AuthCard>
  );
}

export function ResetPasswordForm() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-roles-on-background)' }}>
          Loading...
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
