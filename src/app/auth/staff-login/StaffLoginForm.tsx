'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuthCard } from '../components/AuthCard';
import { FormField, PrimaryButton, AlertBox, DevCredentialsHint } from '../components/AuthFormElements';

export function StaffLoginForm() {
  const router = useRouter();

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

      const params = new URLSearchParams(window.location.search);
      const returnUrl = params.get('returnUrl') || '/attendance';
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
            Are you a parent or guardian?{' '}
            <Link
              href="/auth/login"
              style={{
                color: 'var(--color-roles-primary)',
                fontWeight: 600,
                textDecoration: 'underline',
              }}
            >
              Parent Sign In &rarr;
            </Link>
          </span>
        </div>
      }
    >
      <form onSubmit={handleSubmit} noValidate>
        {error && <AlertBox type="error" message={error} />}

        <FormField
          id="email"
          label="Staff Email Address"
          type="email"
          autoComplete="email"
          required
          placeholder="e.g. staff@school.ng"
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

        <div style={{ marginTop: '20px' }}>
          <PrimaryButton
            type="submit"
            loading={loading}
            style={{
              backgroundColor: 'var(--color-roles-secondary)',
            }}
          >
            Sign In as Staff
          </PrimaryButton>
        </div>
      </form>

      <DevCredentialsHint
        role="staff"
        onSelect={(selectedEmail, selectedPass) => {
          setEmail(selectedEmail);
          setPassword(selectedPass);
        }}
      />
    </AuthCard>
  );
}
