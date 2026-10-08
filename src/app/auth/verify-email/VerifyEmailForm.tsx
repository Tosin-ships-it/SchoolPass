'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AuthCard } from '../components/AuthCard';
import { PrimaryButton, AlertBox, FormField } from '../components/AuthFormElements';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const tokenFromUrl = searchParams.get('token') || '';

  const [token, setToken] = useState(tokenFromUrl);
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
    if (tokenFromUrl) {
      performVerification(tokenFromUrl);
    }
  }, [tokenFromUrl]);

  if (success) {
    return (
      <AuthCard
        title="Email Verified"
        subtitle="Your email address has been successfully confirmed."
        backHref="/auth/login"
        backLabel="Sign In"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <AlertBox
            type="success"
            message="Your account is now active. You can sign in to SchoolPass."
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
            Sign In Now &rarr;
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Verify Your Email"
      subtitle="Confirming your SchoolPass registration."
      backHref="/auth/login"
      backLabel="Sign In"
    >
      {error && <AlertBox type="error" message={error} />}

      {loading ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '30px 0',
            gap: '12px',
          }}
        >
          <div
            role="status"
            aria-label="Verifying email"
            style={{
              width: '32px',
              height: '32px',
              border: '3px solid var(--color-roles-outline-color)',
              borderTopColor: 'var(--color-roles-primary)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }}
          />
          <p
            style={{
              fontFamily: 'var(--typography-body-medium-fontfamily)',
              fontSize: 'var(--typography-body-medium-fontsize)',
              color: 'var(--color-roles-on-surface-variant)',
            }}
          >
            Verifying your email token...
          </p>
          <style>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            performVerification(token);
          }}
          noValidate
        >
          <FormField
            id="token"
            label="Verification Token"
            type="text"
            required
            placeholder="Paste your verification token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />

          <PrimaryButton type="submit" loading={loading} disabled={!token.trim()}>
            Verify Email
          </PrimaryButton>

          <div style={{ marginTop: '16px', textAlign: 'center' }}>
            <Link
              href="/auth/login"
              style={{
                fontFamily: 'var(--typography-body-small-fontfamily)',
                fontSize: 'var(--typography-body-small-fontsize)',
                color: 'var(--color-roles-primary)',
                textDecoration: 'none',
              }}
            >
              Return to Sign In
            </Link>
          </div>
        </form>
      )}
    </AuthCard>
  );
}

export function VerifyEmailForm() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-roles-on-background)' }}>
          Loading...
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
