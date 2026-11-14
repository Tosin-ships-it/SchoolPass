'use client';

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

function VerifyPaymentContent() {
  const searchParams = useSearchParams();
  const txRef = searchParams.get('tx_ref');
  const transactionId = searchParams.get('transaction_id');
  const urlStatus = searchParams.get('status');

  const [loading, setLoading] = useState(true);
  const [verified, setVerified] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function performVerification() {
      if (!transactionId && !txRef) {
        setLoading(false);
        setErrorMessage('Missing transaction reference or transaction ID in return URL.');
        return;
      }

      try {
        const res = await fetch('/api/payments/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transactionId: transactionId || txRef,
            tx_ref: txRef,
          }),
        });

        const json = await res.json();
        if (isCancelled) return;

        if (res.ok && json.success) {
          setVerified(true);
        } else {
          setErrorMessage(
            json.error ||
              'Payment could not be verified by the gateway. If you were debited, please contact the school office with your reference.'
          );
        }
      } catch {
        if (!isCancelled) {
          setErrorMessage(
            'Connection error verifying transaction. Please check your payment history in a few moments.'
          );
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    performVerification();

    return () => {
      isCancelled = true;
    };
  }, [txRef, transactionId, urlStatus]);

  return (
    <div
      style={{
        backgroundColor: 'var(--color-roles-surface)',
        border: '1px solid var(--color-roles-outline-color)',
        borderRadius: '16px',
        padding: '36px 24px',
        maxWidth: '520px',
        width: '100%',
        textAlign: 'center',
        boxShadow: 'var(--effect-soft-shadow)',
      }}
    >
      {loading ? (
        <div>
          <div
            style={{
              width: '48px',
              height: '48px',
              border: '4px solid var(--color-roles-outline-variant)',
              borderTopColor: 'var(--color-roles-primary)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 20px auto',
            }}
          />
          <h2
            style={{
              fontFamily: 'var(--typography-title-large-fontfamily)',
              fontSize: '20px',
              fontWeight: 700,
              color: 'var(--color-roles-on-surface)',
              marginBottom: '8px',
            }}
          >
            Verifying Payment...
          </h2>
          <p
            style={{
              fontSize: '14px',
              color: 'var(--color-roles-on-surface-variant)',
              lineHeight: 1.5,
              margin: 0,
            }}
          >
            Please wait while SchoolPass verifies your transaction directly with Flutterwave and updates
            the financial ledger.
          </p>
        </div>
      ) : verified ? (
        <div>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: 'var(--color-roles-primary-container)',
              color: 'var(--color-roles-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
              margin: '0 auto 16px auto',
              fontWeight: 700,
            }}
          >
            ✓
          </div>
          <h2
            style={{
              fontFamily: 'var(--typography-title-large-fontfamily)',
              fontSize: '22px',
              fontWeight: 700,
              color: 'var(--color-roles-primary)',
              margin: '0 0 8px 0',
            }}
          >
            Payment Confirmed!
          </h2>
          <p
            style={{
              fontSize: '14px',
              color: 'var(--color-roles-on-surface-variant)',
              lineHeight: 1.5,
              marginBottom: '16px',
            }}
          >
            Your payment has been successfully verified and posted to your child&apos;s school fee ledger.
          </p>

          {txRef && (
            <div
              style={{
                backgroundColor: 'var(--color-roles-surface-variant)',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                marginBottom: '24px',
              }}
            >
              Payment Reference: <code>{txRef}</code>
            </div>
          )}

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            {txRef && (
              <Link
                href={`/pay/receipt/${encodeURIComponent(txRef)}`}
                style={{
                  backgroundColor: 'var(--color-roles-primary)',
                  color: 'var(--color-roles-on-primary)',
                  padding: '12px 20px',
                  borderRadius: '8px',
                  fontWeight: 700,
                  textDecoration: 'none',
                  fontSize: '15px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                📄 View Official Receipt
              </Link>
            )}

            <Link
              href="/pay"
              style={{
                backgroundColor: 'transparent',
                color: 'var(--color-roles-on-surface)',
                border: '1px solid var(--color-roles-outline-color)',
                padding: '12px 20px',
                borderRadius: '8px',
                fontWeight: 600,
                textDecoration: 'none',
                fontSize: '14px',
              }}
            >
              Return to Payments Portal
            </Link>
          </div>
        </div>
      ) : (
        <div>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: 'var(--color-roles-error-container)',
              color: 'var(--color-roles-error)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
              margin: '0 auto 16px auto',
              fontWeight: 700,
            }}
          >
            !
          </div>
          <h2
            style={{
              fontFamily: 'var(--typography-title-large-fontfamily)',
              fontSize: '20px',
              fontWeight: 700,
              color: 'var(--color-roles-error)',
              margin: '0 0 8px 0',
            }}
          >
            Payment Verification Notice
          </h2>
          <p
            style={{
              fontSize: '14px',
              color: 'var(--color-roles-on-surface-variant)',
              lineHeight: 1.5,
              marginBottom: '20px',
            }}
          >
            {errorMessage || 'Unable to confirm payment status at this time.'}
          </p>

          <Link
            href="/pay"
            style={{
              display: 'inline-block',
              backgroundColor: 'var(--color-roles-surface-variant)',
              color: 'var(--color-roles-on-surface)',
              padding: '10px 20px',
              borderRadius: '8px',
              fontWeight: 600,
              textDecoration: 'none',
              fontSize: '14px',
            }}
          >
            Return to Payments Portal
          </Link>
        </div>
      )}

      <style jsx global>{`
        @keyframes spin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}

export default function VerifyPaymentPage() {
  return (
    <div
      style={{
        minHeight: '100dvh',
        backgroundColor: 'var(--color-roles-background)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
      }}
    >
      <Suspense
        fallback={
          <div style={{ color: 'var(--color-roles-on-surface-variant)' }}>
            Loading return details...
          </div>
        }
      >
        <VerifyPaymentContent />
      </Suspense>
    </div>
  );
}

