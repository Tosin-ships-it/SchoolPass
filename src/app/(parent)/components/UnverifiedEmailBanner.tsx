'use client';

import React, { useState, useEffect } from 'react';

export function UnverifiedEmailBanner({ email }: { email: string }) {
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const checkVerification = async () => {
      try {
        const res = await fetch('/api/records/dashboard');
        if (res.ok) {
          const data = await res.json();
          if (data.isEmailVerified && isMounted) {
            setDismissed(true);
          }
        }
      } catch {
        // Silently ignore temporary network errors
      }
    };
    checkVerification();
    return () => {
      isMounted = false;
    };
  }, []);

  if (dismissed) {
    return null;
  }

  const handleResend = async () => {
    setLoading(true);
    setFeedback(null);
    setError(null);

    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to send verification email. Please try again.');
      } else {
        setFeedback('Verification email sent! Please check your inbox.');
      }
    } catch {
      setError('Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="status"
      aria-label="Email Verification Notice"
      style={{
        width: '100%',
        backgroundColor: '#fffbeb',
        borderBottom: '1px solid #fde68a',
        color: '#92400e',
        padding: '12px 16px',
        fontSize: '14px',
        lineHeight: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexWrap: 'wrap',
        gap: '12px',
        zIndex: 50,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span aria-hidden="true" style={{ fontSize: '18px' }}>⚠️</span>
        <span>
          <strong>Action Required:</strong> Your email address (<strong>{email}</strong>) has not been verified. Some features like student linking and tuition fee payments require verified email ownership.
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          type="button"
          onClick={handleResend}
          disabled={loading}
          style={{
            backgroundColor: '#d97706',
            color: '#ffffff',
            border: 'none',
            borderRadius: '4px',
            padding: '6px 12px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
            transition: 'background-color 0.2s',
          }}
        >
          {loading ? 'Sending...' : 'Resend Verification Email'}
        </button>
      </div>

      {feedback && (
        <span style={{ color: '#065f46', fontWeight: 600, fontSize: '13px' }}>
          ✓ {feedback}
        </span>
      )}
      {error && (
        <span style={{ color: '#991b1b', fontWeight: 600, fontSize: '13px' }}>
          ✕ {error}
        </span>
      )}
    </div>
  );
}
