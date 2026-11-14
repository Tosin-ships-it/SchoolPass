'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import type {
  PortalDataResponse,
  PortalLinkedStudent,
} from '@/lib/payments';

export function ParentPayPortal() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PortalDataResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  // Payment form state
  const [paymentMode, setPaymentMode] = useState<'full' | 'custom'>('full');
  const [customAmount, setCustomAmount] = useState<string>('');
  const [initiating, setInitiating] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [checkoutFallbackUrl, setCheckoutFallbackUrl] = useState<string | null>(null);
  const [redirectStatus, setRedirectStatus] = useState<'idle' | 'redirecting' | 'delayed'>('idle');

  const redirectTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Active view tab: 'breakdown' | 'history'
  const [activeTab, setActiveTab] = useState<'breakdown' | 'history'>('breakdown');

  // Load portal data
  const loadPortalData = async (studentId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const url = studentId
        ? `/api/payments/portal?studentId=${encodeURIComponent(studentId)}`
        : '/api/payments/portal';
      const res = await fetch(url);

      let json: PortalDataResponse | null = null;
      try {
        json = await res.json();
      } catch {
        json = null;
      }

      if (!res.ok || !json?.success) {
        setError(json?.error || `Failed to load fee information (HTTP ${res.status}).`);
      } else {
        setData(json);
        if (json.selectedStudent) {
          setSelectedStudentId(json.selectedStudent.studentId);
        }
      }
    } catch {
      setError('Unable to load fee information. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPortalData();
  }, []);

  // Handle browser Back button / bfcache restore and timeout cleanup
  useEffect(() => {
    const handlePageShow = () => {
      // If the parent navigated back from Flutterwave or cached page is restored
      setInitiating(false);
      setRedirectStatus((prev) => (prev === 'redirecting' ? 'delayed' : prev));
    };

    window.addEventListener('pageshow', handlePageShow);
    return () => {
      window.removeEventListener('pageshow', handlePageShow);
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
      }
    };
  }, []);

  const handleStudentChange = (studentId: string) => {
    if (redirectTimeoutRef.current) {
      clearTimeout(redirectTimeoutRef.current);
    }
    setSelectedStudentId(studentId);
    setPaymentMode('full');
    setCustomAmount('');
    setPaymentError(null);
    setCheckoutFallbackUrl(null);
    setRedirectStatus('idle');
    setInitiating(false);
    loadPortalData(studentId);
  };

  const handleInitiatePayment = async () => {
    // Prevent duplicate payment initiation while a request is already in progress
    if (initiating) return;

    if (!data?.selectedStudent || !data.balance) return;
    setPaymentError(null);

    // If an existing fallback checkout URL is ready and redirect was delayed, attempt navigation directly
    if (checkoutFallbackUrl && redirectStatus === 'delayed') {
      try {
        window.location.assign(checkoutFallbackUrl);
        return;
      } catch {
        // Fallback to manual <a> tag below if assign fails
      }
    }

    const amountDueNum = parseFloat(data.balance.amountDue);
    let amountToPay: number;

    if (paymentMode === 'full') {
      amountToPay = amountDueNum;
    } else {
      const parsed = parseFloat(customAmount);
      if (isNaN(parsed) || parsed < 1000) {
        setPaymentError('Minimum online payment amount is ₦1,000.00.');
        return;
      }
      if (parsed > amountDueNum) {
        setPaymentError('Payment amount cannot exceed the total outstanding balance.');
        return;
      }
      amountToPay = parsed;
    }

    if (amountToPay <= 0) {
      setPaymentError('There is no outstanding balance to pay.');
      return;
    }

    setInitiating(true);
    setCheckoutFallbackUrl(null);
    setRedirectStatus('idle');

    try {
      const res = await fetch('/api/payments/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: data.selectedStudent.studentId,
          amount: amountToPay.toFixed(2),
        }),
      });

      const resJson = await res.json();
      if (!res.ok || !resJson.success) {
        setPaymentError(resJson.error || 'Unable to initiate payment with Flutterwave.');
        setInitiating(false);
        setRedirectStatus('idle');
      } else if (resJson.checkoutUrl) {
        const url = resJson.checkoutUrl;
        // Store exact server-provided checkout URL for manual fallback
        setCheckoutFallbackUrl(url);
        setRedirectStatus('redirecting');

        // Set safety timer: restore interactive controls after 4s if navigation is delayed or blocked
        if (redirectTimeoutRef.current) {
          clearTimeout(redirectTimeoutRef.current);
        }
        redirectTimeoutRef.current = setTimeout(() => {
          setInitiating(false);
          setRedirectStatus('delayed');
        }, 4000);

        try {
          // Attempt automatic redirection
          window.location.assign(url);
        } catch {
          setInitiating(false);
          setRedirectStatus('delayed');
          setPaymentError(
            'Automatic redirection was blocked by your browser. Please click the direct checkout link below to proceed.'
          );
        }
      } else {
        setPaymentError('Payment initiation failed: No checkout URL provided.');
        setInitiating(false);
        setRedirectStatus('idle');
      }
    } catch {
      setPaymentError('Network error initiating payment. Please try again.');
      setInitiating(false);
      setRedirectStatus('idle');
    }
  };

  if (loading && !data) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '64px 16px',
          color: 'var(--color-roles-on-surface-variant)',
          fontFamily: 'var(--typography-body-medium-fontfamily)',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              border: '3px solid var(--color-roles-outline-variant)',
              borderTopColor: 'var(--color-roles-primary)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 16px auto',
            }}
          />
          <p>Loading fee obligations...</p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div
        style={{
          backgroundColor: 'var(--color-roles-error-container)',
          color: 'var(--color-roles-on-error-container)',
          padding: '24px',
          borderRadius: '12px',
          textAlign: 'center',
          margin: '24px 0',
        }}
      >
        <p style={{ fontWeight: 600, marginBottom: '12px' }}>{error}</p>
        <button
          onClick={() => loadPortalData(selectedStudentId || undefined)}
          style={{
            backgroundColor: 'var(--color-roles-error)',
            color: 'var(--color-roles-on-error)',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '6px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  // No linked children state
  if (!data?.linkedStudents || data.linkedStudents.length === 0) {
    return (
      <div
        style={{
          backgroundColor: 'var(--color-roles-surface)',
          border: '1px solid var(--color-roles-outline-color)',
          borderRadius: '16px',
          padding: '40px 24px',
          textAlign: 'center',
          boxShadow: 'var(--effect-soft-shadow)',
          maxWidth: '560px',
          margin: '32px auto',
        }}
      >
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
            fontSize: '24px',
            margin: '0 auto 16px auto',
          }}
        >
          ℹ
        </div>
        <h2
          style={{
            fontFamily: 'var(--typography-title-large-fontfamily)',
            fontSize: 'var(--typography-title-large-fontsize)',
            color: 'var(--color-roles-on-surface)',
            margin: '0 0 8px 0',
          }}
        >
          No Children Linked
        </h2>
        <p
          style={{
            color: 'var(--color-roles-on-surface-variant)',
            fontSize: 'var(--typography-body-medium-fontsize)',
            lineHeight: 1.5,
            margin: '0 0 24px 0',
          }}
        >
          You do not have any verified student records linked to your parent account yet. Link your
          child to view fee balances and make payments.
        </p>
        <Link
          href="/records"
          style={{
            display: 'inline-block',
            backgroundColor: 'var(--color-roles-primary)',
            color: 'var(--color-roles-on-primary)',
            padding: '12px 24px',
            borderRadius: '8px',
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          Go to Student Linking
        </Link>
      </div>
    );
  }

  const { linkedStudents, selectedStudent, balance, charges, payments } = data;
  const amountDueNum = balance ? parseFloat(balance.amountDue) : 0;
  const arrearsNum = balance ? parseFloat(balance.earlierTermsArrears) : 0;
  const isPaidInFull = amountDueNum <= 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}>
      {/* Multi-Child Selector Tabs */}
      {linkedStudents.length > 1 && (
        <div
          style={{
            display: 'flex',
            gap: '8px',
            overflowX: 'auto',
            paddingBottom: '4px',
          }}
        >
          {linkedStudents.map((child: PortalLinkedStudent) => {
            const isSelected = child.studentId === selectedStudent?.studentId;
            return (
              <button
                key={child.studentId}
                onClick={() => handleStudentChange(child.studentId)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 16px',
                  borderRadius: '24px',
                  border: isSelected
                    ? '2px solid var(--color-roles-primary)'
                    : '1px solid var(--color-roles-outline-color)',
                  backgroundColor: isSelected
                    ? 'var(--color-roles-primary-container)'
                    : 'var(--color-roles-surface)',
                  color: isSelected
                    ? 'var(--color-roles-on-primary-container)'
                    : 'var(--color-roles-on-surface)',
                  fontWeight: isSelected ? 700 : 500,
                  fontSize: '14px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                <span>{child.studentName}</span>
                <span
                  style={{
                    fontSize: '12px',
                    opacity: 0.8,
                    padding: '2px 6px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(0,0,0,0.06)',
                  }}
                >
                  {child.className}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Selected Child Info Banner */}
      {selectedStudent && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'var(--color-roles-surface-variant)',
            padding: '12px 18px',
            borderRadius: '10px',
            fontSize: '14px',
          }}
        >
          <div>
            <strong>{selectedStudent.studentName}</strong> &bull; Class: {selectedStudent.className}
          </div>
          <div style={{ color: 'var(--color-roles-on-surface-variant)' }}>
            Student No: <code>{selectedStudent.studentNumber}</code>
          </div>
        </div>
      )}

      {/* Outstanding Balance Hero Card */}
      {balance && (
        <div
          style={{
            backgroundColor: 'var(--color-roles-surface)',
            border: '1px solid var(--color-roles-outline-color)',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: 'var(--effect-soft-shadow)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: '12px',
            }}
          >
            <div>
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--color-roles-on-surface-variant)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                Outstanding Balance Due
              </span>
              <div
                style={{
                  fontFamily: 'var(--typography-display-small-fontfamily)',
                  fontSize: '36px',
                  fontWeight: 700,
                  color: isPaidInFull
                    ? 'var(--color-roles-primary)'
                    : arrearsNum > 0
                      ? 'var(--color-roles-error)'
                      : 'var(--color-roles-on-surface)',
                  marginTop: '4px',
                }}
              >
                ₦{parseFloat(balance.amountDue).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
              </div>
            </div>

            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '6px 14px',
                borderRadius: '16px',
                fontSize: '12px',
                fontWeight: 700,
                backgroundColor: isPaidInFull
                  ? 'var(--color-roles-primary-container)'
                  : arrearsNum > 0
                    ? 'var(--color-roles-error-container)'
                    : 'var(--color-roles-secondary-container)',
                color: isPaidInFull
                  ? 'var(--color-roles-on-primary-container)'
                  : arrearsNum > 0
                    ? 'var(--color-roles-on-error-container)'
                    : 'var(--color-roles-on-secondarycontainer)',
              }}
            >
              {isPaidInFull
                ? '✓ Paid in Full'
                : arrearsNum > 0
                  ? 'Arrears Due'
                  : 'Term Balance Outstanding'}
            </span>
          </div>

          {/* Breakdown Pills */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '12px',
              paddingTop: '16px',
              borderTop: '1px solid var(--color-roles-outline-variant)',
              fontSize: '13px',
            }}
          >
            {arrearsNum > 0 && (
              <div
                style={{
                  backgroundColor: 'var(--color-roles-error-container)',
                  color: 'var(--color-roles-on-error-container)',
                  padding: '6px 12px',
                  borderRadius: '6px',
                }}
              >
                <strong>Earlier Terms Arrears:</strong> ₦
                {arrearsNum.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
              </div>
            )}
            <div
              style={{
                backgroundColor: 'var(--color-roles-surface-variant)',
                padding: '6px 12px',
                borderRadius: '6px',
              }}
            >
              <strong>Current Term Balance:</strong> ₦
              {parseFloat(balance.currentTermBalance).toLocaleString('en-NG', {
                minimumFractionDigits: 2,
              })}
            </div>
            {parseFloat(balance.creditBalance) > 0 && (
              <div
                style={{
                  backgroundColor: 'var(--color-roles-tertiary-container)',
                  color: 'var(--color-roles-on-tertiary-container)',
                  padding: '6px 12px',
                  borderRadius: '6px',
                }}
              >
                <strong>Credit Overpayment:</strong> ₦
                {parseFloat(balance.creditBalance).toLocaleString('en-NG', {
                  minimumFractionDigits: 2,
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Online Payment Card (If balance > 0) */}
      {!isPaidInFull && balance && (
        <div
          style={{
            backgroundColor: 'var(--color-roles-surface)',
            border: '1px solid var(--color-roles-outline-color)',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: 'var(--effect-soft-shadow)',
          }}
        >
          <h3
            style={{
              fontFamily: 'var(--typography-title-large-fontfamily)',
              fontSize: '18px',
              fontWeight: 700,
              margin: '0 0 16px 0',
              color: 'var(--color-roles-on-surface)',
            }}
          >
            Make Online Payment
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '14px',
                  cursor: 'pointer',
                  fontWeight: paymentMode === 'full' ? 600 : 400,
                }}
              >
                <input
                  type="radio"
                  name="paymentMode"
                  value="full"
                  checked={paymentMode === 'full'}
                  onChange={() => setPaymentMode('full')}
                />
                Pay Full Balance (₦
                {amountDueNum.toLocaleString('en-NG', { minimumFractionDigits: 2 })})
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '14px',
                  cursor: 'pointer',
                  fontWeight: paymentMode === 'custom' ? 600 : 400,
                }}
              >
                <input
                  type="radio"
                  name="paymentMode"
                  value="custom"
                  checked={paymentMode === 'custom'}
                  onChange={() => setPaymentMode('custom')}
                />
                Pay Custom Amount
              </label>
            </div>

            {paymentMode === 'custom' && (
              <div style={{ maxWidth: '300px' }}>
                <label
                  htmlFor="customAmount"
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: 600,
                    marginBottom: '4px',
                    color: 'var(--color-roles-on-surface-variant)',
                  }}
                >
                  Amount in Naira (Min ₦1,000.00)
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <span
                    style={{
                      position: 'absolute',
                      left: '12px',
                      color: 'var(--color-roles-on-surface-variant)',
                      fontWeight: 600,
                    }}
                  >
                    ₦
                  </span>
                  <input
                    id="customAmount"
                    type="number"
                    min="1000"
                    max={amountDueNum}
                    step="100"
                    placeholder="5,000.00"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px 10px 32px',
                      borderRadius: '8px',
                      border: '1px solid var(--color-roles-outline-color)',
                      fontSize: '15px',
                    }}
                  />
                </div>
              </div>
            )}

            {paymentError && (
              <div
                style={{
                  backgroundColor: 'var(--color-roles-error-container)',
                  color: 'var(--color-roles-on-error-container)',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  fontSize: '13px',
                }}
              >
                {paymentError}
              </div>
            )}

            {checkoutFallbackUrl && (
              <div
                style={{
                  backgroundColor: 'var(--color-roles-surface-container-high)',
                  border: '1px solid var(--color-roles-primary)',
                  borderRadius: '8px',
                  padding: '16px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                }}
              >
                <span style={{ fontSize: '20px' }} aria-hidden="true">
                  ↗️
                </span>
                <div style={{ flex: 1 }}>
                  <h4
                    style={{
                      margin: '0 0 6px 0',
                      fontSize: '14px',
                      fontWeight: 700,
                      color: 'var(--color-roles-on-surface)',
                    }}
                  >
                    {redirectStatus === 'redirecting'
                      ? 'Connecting to Flutterwave...'
                      : 'Secure Payment Checkout Ready'}
                  </h4>
                  <p
                    style={{
                      margin: '0 0 12px 0',
                      fontSize: '13px',
                      color: 'var(--color-roles-on-surface-variant)',
                      lineHeight: 1.4,
                    }}
                  >
                    {redirectStatus === 'redirecting'
                      ? 'Redirecting to the Flutterwave payment gateway. If your browser does not redirect automatically, click below to open the checkout page:'
                      : 'Your secure checkout link is active. If your browser did not redirect automatically, click below to complete your payment on the secure Flutterwave page:'}
                  </p>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <a
                      href={checkoutFallbackUrl}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        backgroundColor: 'var(--color-roles-primary)',
                        color: 'var(--color-roles-on-primary)',
                        padding: '10px 20px',
                        borderRadius: '6px',
                        fontWeight: 700,
                        fontSize: '14px',
                        textDecoration: 'none',
                      }}
                    >
                      Proceed to Flutterwave Checkout &rarr;
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        if (redirectTimeoutRef.current) {
                          clearTimeout(redirectTimeoutRef.current);
                        }
                        setCheckoutFallbackUrl(null);
                        setRedirectStatus('idle');
                        setInitiating(false);
                      }}
                      style={{
                        background: 'none',
                        border: '1px solid var(--color-roles-outline-variant)',
                        color: 'var(--color-roles-on-surface-variant)',
                        padding: '9px 16px',
                        borderRadius: '6px',
                        fontSize: '13px',
                        cursor: 'pointer',
                        fontWeight: 600,
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleInitiatePayment}
                disabled={initiating}
                style={{
                  backgroundColor: 'var(--color-roles-primary)',
                  color: 'var(--color-roles-on-primary)',
                  padding: '12px 28px',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '15px',
                  border: 'none',
                  cursor: initiating ? 'not-allowed' : 'pointer',
                  opacity: initiating ? 0.7 : 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                {initiating ? (
                  <>
                    <span
                      style={{
                        width: '16px',
                        height: '16px',
                        border: '2px solid #fff',
                        borderTopColor: 'transparent',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                      }}
                    />
                    Connecting to Flutterwave...
                  </>
                ) : checkoutFallbackUrl && redirectStatus === 'delayed' ? (
                  <>🔒 Reopen Flutterwave Checkout</>
                ) : (
                  <>🔒 Pay with Flutterwave</>
                )}
              </button>

              <span
                style={{
                  fontSize: '12px',
                  color: 'var(--color-roles-on-surface-variant)',
                }}
              >
                Official printable receipt generated immediately upon payment confirmation.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Tabs: Breakdown vs History */}
      <div>
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--color-roles-outline-variant)',
            marginBottom: '16px',
          }}
        >
          <button
            onClick={() => setActiveTab('breakdown')}
            style={{
              padding: '10px 20px',
              border: 'none',
              backgroundColor: 'transparent',
              borderBottom:
                activeTab === 'breakdown'
                  ? '3px solid var(--color-roles-primary)'
                  : '3px solid transparent',
              color:
                activeTab === 'breakdown'
                  ? 'var(--color-roles-primary)'
                  : 'var(--color-roles-on-surface-variant)',
              fontWeight: activeTab === 'breakdown' ? 700 : 500,
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            Fee Schedule & Breakdown ({charges.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            style={{
              padding: '10px 20px',
              border: 'none',
              backgroundColor: 'transparent',
              borderBottom:
                activeTab === 'history'
                  ? '3px solid var(--color-roles-primary)'
                  : '3px solid transparent',
              color:
                activeTab === 'history'
                  ? 'var(--color-roles-primary)'
                  : 'var(--color-roles-on-surface-variant)',
              fontWeight: activeTab === 'history' ? 700 : 500,
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            Payment History ({payments.length})
          </button>
        </div>

        {/* Tab 1: Breakdown */}
        {activeTab === 'breakdown' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {balance?.terms && balance.terms.length > 0 && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: '12px',
                }}
              >
                {balance.terms.map((term) => (
                  <div
                    key={term.termId}
                    style={{
                      backgroundColor: 'var(--color-roles-surface)',
                      border: '1px solid var(--color-roles-outline-color)',
                      borderRadius: '10px',
                      padding: '16px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '8px',
                      }}
                    >
                      <strong style={{ fontSize: '14px' }}>{term.termName}</strong>
                      {term.isCurrentTerm && (
                        <span
                          style={{
                            fontSize: '11px',
                            backgroundColor: 'var(--color-roles-primary-container)',
                            color: 'var(--color-roles-primary)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontWeight: 600,
                          }}
                        >
                          Current
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '13px', lineHeight: 1.6 }}>
                      <div>Charges: ₦{parseFloat(term.grossCharges).toLocaleString('en-NG', { minimumFractionDigits: 2 })}</div>
                      {parseFloat(term.adjustments) !== 0 && (
                        <div>Adjustments: ₦{parseFloat(term.adjustments).toLocaleString('en-NG', { minimumFractionDigits: 2 })}</div>
                      )}
                      <div>Paid: ₦{parseFloat(term.paid).toLocaleString('en-NG', { minimumFractionDigits: 2 })}</div>
                      <div
                        style={{
                          fontWeight: 700,
                          marginTop: '4px',
                          color:
                            parseFloat(term.outstanding) > 0
                              ? 'var(--color-roles-error)'
                              : 'var(--color-roles-primary)',
                        }}
                      >
                        Outstanding: ₦{parseFloat(term.outstanding).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Itemized charges table */}
            <div
              style={{
                backgroundColor: 'var(--color-roles-surface)',
                border: '1px solid var(--color-roles-outline-color)',
                borderRadius: '12px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: '14px 18px',
                  fontWeight: 700,
                  borderBottom: '1px solid var(--color-roles-outline-variant)',
                  fontSize: '14px',
                }}
              >
                Itemized Charges & Ledger Entries
              </div>

              {charges.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-roles-on-surface-variant)' }}>
                  No fee entries recorded yet for this student.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr
                        style={{
                          backgroundColor: 'var(--color-roles-surface-variant)',
                          textAlign: 'left',
                          color: 'var(--color-roles-on-surface-variant)',
                        }}
                      >
                        <th style={{ padding: '10px 16px' }}>Date</th>
                        <th style={{ padding: '10px 16px' }}>Term</th>
                        <th style={{ padding: '10px 16px' }}>Type</th>
                        <th style={{ padding: '10px 16px' }}>Details / Note</th>
                        <th style={{ padding: '10px 16px', textAlign: 'right' }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {charges.map((entry) => (
                        <tr
                          key={entry.id}
                          style={{
                            borderBottom: '1px solid var(--color-roles-outline-variant)',
                          }}
                        >
                          <td style={{ padding: '10px 16px' }}>
                            {new Date(entry.createdAt).toLocaleDateString()}
                          </td>
                          <td style={{ padding: '10px 16px' }}>{entry.termId}</td>
                          <td style={{ padding: '10px 16px' }}>
                            <span
                              style={{
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 600,
                                backgroundColor:
                                  entry.type === 'CHARGE'
                                    ? 'var(--color-roles-surface-variant)'
                                    : entry.type === 'OFFLINE_PAYMENT'
                                      ? 'var(--color-roles-primary-container)'
                                      : 'var(--color-roles-secondary-container)',
                              }}
                            >
                              {entry.type}
                            </span>
                          </td>
                          <td style={{ padding: '10px 16px' }}>{entry.note || '—'}</td>
                          <td
                            style={{
                              padding: '10px 16px',
                              textAlign: 'right',
                              fontWeight: 600,
                            }}
                          >
                            ₦{parseFloat(entry.amount).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Payment History */}
        {activeTab === 'history' && (
          <div
            style={{
              backgroundColor: 'var(--color-roles-surface)',
              border: '1px solid var(--color-roles-outline-color)',
              borderRadius: '12px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '14px 18px',
                fontWeight: 700,
                borderBottom: '1px solid var(--color-roles-outline-variant)',
                fontSize: '14px',
              }}
            >
              Online & Verified Gateway Payments
            </div>

            {payments.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-roles-on-surface-variant)' }}>
                No online payments initiated yet.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr
                      style={{
                        backgroundColor: 'var(--color-roles-surface-variant)',
                        textAlign: 'left',
                        color: 'var(--color-roles-on-surface-variant)',
                      }}
                    >
                      <th style={{ padding: '10px 16px' }}>Date</th>
                      <th style={{ padding: '10px 16px' }}>Reference</th>
                      <th style={{ padding: '10px 16px' }}>Status</th>
                      <th style={{ padding: '10px 16px', textAlign: 'right' }}>Amount</th>
                      <th style={{ padding: '10px 16px', textAlign: 'center' }}>Receipt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => {
                      const isSuccess = p.status === 'SUCCESSFUL';
                      return (
                        <tr
                          key={p.id}
                          style={{
                            borderBottom: '1px solid var(--color-roles-outline-variant)',
                          }}
                        >
                          <td style={{ padding: '10px 16px' }}>
                            {new Date(p.createdAt).toLocaleDateString()}
                          </td>
                          <td style={{ padding: '10px 16px' }}>
                            <code style={{ fontSize: '12px' }}>{p.internalReference}</code>
                          </td>
                          <td style={{ padding: '10px 16px' }}>
                            <span
                              style={{
                                padding: '3px 8px',
                                borderRadius: '12px',
                                fontSize: '11px',
                                fontWeight: 700,
                                backgroundColor:
                                  p.status === 'SUCCESSFUL'
                                    ? 'var(--color-roles-primary-container)'
                                    : p.status === 'PENDING'
                                      ? 'var(--color-roles-secondary-container)'
                                      : 'var(--color-roles-error-container)',
                                color:
                                  p.status === 'SUCCESSFUL'
                                    ? 'var(--color-roles-primary)'
                                    : p.status === 'PENDING'
                                      ? 'var(--color-roles-on-secondarycontainer)'
                                      : 'var(--color-roles-error)',
                              }}
                            >
                              {p.status}
                            </span>
                          </td>
                          <td
                            style={{
                              padding: '10px 16px',
                              textAlign: 'right',
                              fontWeight: 700,
                            }}
                          >
                            ₦{parseFloat(p.amount).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                            {isSuccess ? (
                              <Link
                                href={`/pay/receipt/${encodeURIComponent(p.internalReference)}`}
                                style={{
                                  backgroundColor: 'var(--color-roles-surface-variant)',
                                  color: 'var(--color-roles-primary)',
                                  padding: '4px 10px',
                                  borderRadius: '6px',
                                  textDecoration: 'none',
                                  fontWeight: 600,
                                  fontSize: '12px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                              >
                                📄 Receipt
                              </Link>
                            ) : (
                              <span style={{ color: 'var(--color-roles-on-surface-variant)', fontSize: '12px' }}>
                                —
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

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

