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

export function StaffLoginForm() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      const res = await fetch('/api/auth/staff-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password, rememberMe }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError('Invalid email or password.');
        setTimeout(() => {
          document.getElementById('staff-login-error')?.focus();
        }, 50);
        return;
      }

      const params = new URLSearchParams(window.location.search);
      const returnUrl = params.get('returnUrl') || '/attendance';
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
        {error && <AlertBox id="staff-login-error" type="error" message={error} />}

        <FormField
          id="email"
          label="Staff Email Address"
          type="email"
          autoComplete="email"
          required
          placeholder="e.g. staff@school.ng"
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
            alignItems: 'center',
            marginBottom: '18px',
          }}
        >
          <label
            htmlFor="staff-remember-me"
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
              id="staff-remember-me"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              style={{
                width: '16px',
                height: '16px',
                accentColor: 'var(--color-roles-secondary)',
                cursor: 'pointer',
              }}
            />
            <span>Remember me</span>
          </label>
        </div>

        <div style={{ marginTop: '20px' }}>
          <PrimaryButton
            type="submit"
            loading={loading}
            disabled={!isButtonEnabled || loading}
            style={
              !isButtonEnabled || loading
                ? undefined
                : {
                    backgroundColor: 'var(--color-roles-secondary)',
                  }
            }
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
          setEmailError(null);
        }}
      />
    </AuthCard>
  );
}
