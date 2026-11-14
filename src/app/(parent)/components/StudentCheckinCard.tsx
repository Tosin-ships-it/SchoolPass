'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { generateQrSvg } from '@/lib/arrival/qr';

interface StudentCheckinCardProps {
  studentId: string;
  studentName: string;
  studentNumber: string;
  parentEmail: string;
}

interface ActiveCodeData {
  code: string;
  qrSvg?: string;
  expiresAt: string;
  expiresInSeconds: number;
  dateStr?: string;
  timeStr?: string;
  expiresAtStr?: string;
}

export function StudentCheckinCard({
  studentId,
  studentName,
  studentNumber,
  parentEmail,
}: StudentCheckinCardProps) {
  const [activeCode, setActiveCode] = useState<ActiveCodeData | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [showQr, setShowQr] = useState<boolean>(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Check for active code on mount
  useEffect(() => {
    let isMounted = true;
    async function fetchActive() {
      try {
        const res = await fetch(`/api/arrival/active?studentId=${encodeURIComponent(studentId)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (isMounted && data.success && data.activeCode) {
          setActiveCode(data.activeCode);
          setRemainingSeconds(Math.max(0, data.activeCode.expiresInSeconds || 0));
        }
      } catch {
        // Silent recovery
      }
    }

    fetchActive();
    return () => {
      isMounted = false;
    };
  }, [studentId]);

  // 2. Countdown timer
  useEffect(() => {
    if (remainingSeconds <= 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [remainingSeconds]);

  // 3. Generate Code Handler (One-tap)
  const handleGenerateCode = async () => {
    setLoading(true);
    setError(null);
    setCopied(false);

    try {
      const res = await fetch('/api/arrival/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate check-in code.');
      }

      const newCodeData: ActiveCodeData = {
        code: data.code,
        qrSvg: data.qrSvg,
        expiresAt: data.expiresAt,
        expiresInSeconds: data.expiresInSeconds || 15 * 60,
        dateStr: data.dateStr,
        timeStr: data.timeStr,
        expiresAtStr: data.expiresAtStr,
      };

      setActiveCode(newCodeData);
      setRemainingSeconds(newCodeData.expiresInSeconds);
    } catch (err: any) {
      setError(err.message || 'Unable to generate check-in code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!activeCode?.code) return;
    navigator.clipboard?.writeText(activeCode.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const timeFormatted = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  const isExpired = activeCode && remainingSeconds === 0;

  return (
    <div
      style={{
        marginTop: '12px',
        padding: '14px',
        borderRadius: '8px',
        backgroundColor: 'var(--color-roles-surface-variant, #f8fafc)',
        border: '1px solid var(--color-roles-outline-variant, #e2e8f0)',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '6px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: activeCode && !isExpired ? '#10b981' : '#64748b',
              display: 'inline-block',
            }}
          />
          <span
            style={{
              fontSize: '12px',
              fontWeight: 700,
              color: 'var(--color-roles-on-surface, #0f172a)',
              letterSpacing: '0.02em',
              textTransform: 'uppercase',
            }}
          >
            Daily Arrival Check-in
          </span>
        </div>

        {activeCode && !isExpired && (
          <span
            style={{
              fontSize: '11px',
              fontFamily: 'monospace',
              fontWeight: 700,
              color: remainingSeconds < 180 ? '#dc2626' : '#047857',
              backgroundColor: remainingSeconds < 180 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
              padding: '2px 6px',
              borderRadius: '4px',
            }}
          >
            Expires in {timeFormatted}
          </span>
        )}
      </div>

      {error && (
        <div
          style={{
            fontSize: '12px',
            color: '#dc2626',
            backgroundColor: 'rgba(239, 68, 68, 0.08)',
            padding: '6px 10px',
            borderRadius: '4px',
          }}
        >
          {error}
        </div>
      )}

      {/* When no active code or expired */}
      {(!activeCode || isExpired) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <p
            style={{
              fontSize: '12px',
              color: 'var(--color-roles-on-surface-variant, #475569)',
              margin: 0,
              lineHeight: 1.4,
            }}
          >
            {isExpired
              ? 'Your previous check-in code has expired (15m limit). Generate a fresh code below.'
              : 'Generate a 15-minute gate arrival code with one tap. Code will also be emailed to you.'}
          </p>

          <button
            type="button"
            onClick={handleGenerateCode}
            disabled={loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '8px 14px',
              backgroundColor: '#0f766e',
              color: '#ffffff',
              fontSize: '12px',
              fontWeight: 600,
              borderRadius: '6px',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              transition: 'background-color 0.15s ease',
            }}
          >
            {loading ? (
              <span>Generating &amp; Emailing Code...</span>
            ) : (
              <>
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
                <span>{isExpired ? 'Generate New Check-in Code' : 'Generate Check-in Code'}</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* When active unexpired code exists */}
      {activeCode && !isExpired && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            backgroundColor: '#ffffff',
            padding: '12px',
            borderRadius: '6px',
            border: '1px solid #cbd5e1',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '8px',
            }}
          >
            <div>
              <div
                style={{
                  fontSize: '11px',
                  color: '#64748b',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                Gate Pass Code
              </div>
              <div
                style={{
                  fontSize: '28px',
                  fontWeight: 800,
                  fontFamily: 'monospace',
                  letterSpacing: '0.22em',
                  color: '#0f172a',
                  lineHeight: 1.1,
                  marginTop: '2px',
                }}
              >
                {activeCode.code}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                type="button"
                onClick={handleCopy}
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: copied ? '#059669' : '#0f766e',
                  backgroundColor: copied ? '#ecfdf5' : '#f0fdfa',
                  border: '1px solid',
                  borderColor: copied ? '#a7f3d0' : '#ccfbf1',
                  padding: '4px 10px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                {copied ? '✓ Copied' : 'Copy Code'}
              </button>

              <button
                type="button"
                onClick={() => setShowQr((prev) => !prev)}
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: showQr ? '#4338ca' : '#475569',
                  backgroundColor: showQr ? '#eef2ff' : '#f8fafc',
                  border: '1px solid',
                  borderColor: showQr ? '#c7d2fe' : '#e2e8f0',
                  padding: '4px 10px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
                <span>{showQr ? 'Hide QR' : 'Show QR'}</span>
              </button>
            </div>
          </div>

          {/* Optional QR Code View (6-digit code remains primary) */}
          {showQr && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '12px',
                backgroundColor: '#f8fafc',
                borderRadius: '6px',
                border: '1px solid #e2e8f0',
                gap: '8px',
              }}
            >
              <div
                dangerouslySetInnerHTML={{
                  __html: activeCode.qrSvg || generateQrSvg(activeCode.code, { size: 160 }),
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#ffffff',
                  padding: '8px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                }}
              />
              <div
                style={{
                  fontSize: '11px',
                  color: '#64748b',
                  textAlign: 'center',
                }}
              >
                Scan at gate optical reader or use 6-digit code <strong>{activeCode.code}</strong>
              </div>
            </div>
          )}

          <div
            style={{
              fontSize: '11px',
              color: '#475569',
              lineHeight: 1.4,
              borderTop: '1px dashed #e2e8f0',
              paddingTop: '8px',
            }}
          >
            <div>
              📧 Also sent to <strong>{parentEmail}</strong> with date &amp; time.
            </div>
            <div style={{ marginTop: '2px', color: '#64748b' }}>
              Valid for 15 minutes. Enter at the school gate turnstile terminal.
            </div>
          </div>

          {/* Quick simulator tester link */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
              paddingTop: '4px',
            }}
          >
            <Link
              href={`/schoolpass/checkin?code=${activeCode.code}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: '#4338ca',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span>Test in Gate Simulator</span>
              <span>&rarr;</span>
            </Link>

            <button
              type="button"
              onClick={handleGenerateCode}
              disabled={loading}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                fontSize: '11px',
                color: '#64748b',
                textDecoration: 'underline',
                cursor: 'pointer',
              }}
            >
              Regenerate
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
