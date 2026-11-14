'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import type { ReceiptResponse, ReceiptData } from '@/lib/payments';
import '../receipt.css';

export function ReceiptView({ reference }: { reference: string }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ReceiptData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchReceipt() {
      try {
        const res = await fetch(`/api/payments/receipt/${encodeURIComponent(reference)}`);
        const json: ReceiptResponse = await res.json();
        if (res.ok && json.success && json.receipt) {
          setData(json.receipt);
        } else {
          setError(json.error || 'Failed to load receipt.');
        }
      } catch {
        setError('Network error loading receipt. Please try again.');
      } finally {
        setLoading(false);
      }
    }

    if (reference) {
      fetchReceipt();
    }
  }, [reference]);

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '50vh',
          color: 'var(--color-roles-on-surface-variant)',
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
          <p>Loading official receipt...</p>
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

  if (error || !data) {
    return (
      <div
        style={{
          backgroundColor: 'var(--color-roles-surface)',
          border: '1px solid var(--color-roles-outline-color)',
          borderRadius: '12px',
          padding: '32px',
          maxWidth: '500px',
          margin: '40px auto',
          textAlign: 'center',
        }}
      >
        <h3 style={{ color: 'var(--color-roles-error)', marginBottom: '8px' }}>
          Receipt Unavailable
        </h3>
        <p style={{ color: 'var(--color-roles-on-surface-variant)', fontSize: '14px', marginBottom: '24px' }}>
          {error || 'Unable to retrieve receipt for this payment reference.'}
        </p>
        <Link
          href="/pay"
          style={{
            backgroundColor: 'var(--color-roles-primary)',
            color: 'var(--color-roles-on-primary)',
            padding: '10px 18px',
            borderRadius: '8px',
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: '14px',
          }}
        >
          Return to Payments
        </Link>
      </div>
    );
  }

  const isConfirmed = data.status === 'SUCCESSFUL';

  return (
    <div className="receipt-container" style={{ width: '100%', maxWidth: '680px', margin: '0 auto' }}>
      {/* Top Action Controls (hidden on print) */}
      <div
        className="no-print"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
        }}
      >
        <Link
          href="/pay"
          style={{
            fontSize: '14px',
            color: 'var(--color-roles-primary)',
            textDecoration: 'none',
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          &larr; Back to Fees Portal
        </Link>

        <button
          onClick={() => window.print()}
          style={{
            backgroundColor: 'var(--color-roles-primary)',
            color: 'var(--color-roles-on-primary)',
            border: 'none',
            borderRadius: '8px',
            padding: '10px 20px',
            fontWeight: 700,
            fontSize: '14px',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: 'var(--effect-soft-shadow)',
          }}
        >
          🖨️ Print Receipt
        </button>
      </div>

      {/* Official Printable Receipt Card */}
      <div
        className="receipt-card"
        style={{
          backgroundColor: '#ffffff',
          color: '#1a1a1a',
          border: '1px solid #e0e0e0',
          borderRadius: '16px',
          padding: '36px',
          boxShadow: 'var(--effect-medium-shadow)',
          fontFamily: 'var(--typography-body-medium-fontfamily), sans-serif',
        }}
      >
        {/* Receipt Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            paddingBottom: '20px',
            borderBottom: '2px solid #087e8b',
            marginBottom: '24px',
          }}
        >
          <div>
            <div
              style={{
                fontSize: '22px',
                fontWeight: 800,
                color: '#087e8b',
                letterSpacing: '-0.5px',
              }}
            >
              {data.schoolName}
            </div>
            <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
              Official Student Fee Payment Receipt
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <span
              style={{
                display: 'inline-block',
                padding: '4px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 800,
                letterSpacing: '0.5px',
                backgroundColor: isConfirmed ? '#e6f7f8' : '#fbe9e7',
                color: isConfirmed ? '#00666f' : '#ba1a1a',
                border: isConfirmed ? '1px solid #4fb3c1' : '1px solid #ba1a1a',
              }}
            >
              {data.status}
            </span>
          </div>
        </div>

        {/* Metadata Details Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '16px',
            backgroundColor: '#f8fafb',
            padding: '16px',
            borderRadius: '10px',
            marginBottom: '24px',
            fontSize: '13px',
          }}
        >
          <div>
            <div style={{ color: '#666', fontSize: '11px', textTransform: 'uppercase' }}>
              Receipt Reference
            </div>
            <div style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: '13px' }}>
              {data.reference}
            </div>
          </div>

          {data.flutterwaveReference && (
            <div>
              <div style={{ color: '#666', fontSize: '11px', textTransform: 'uppercase' }}>
                Gateway Transaction ID
              </div>
              <div style={{ fontWeight: 600, fontFamily: 'monospace' }}>
                {data.flutterwaveReference}
              </div>
            </div>
          )}

          <div>
            <div style={{ color: '#666', fontSize: '11px', textTransform: 'uppercase' }}>
              Payment Date
            </div>
            <div>{new Date(data.createdAt).toLocaleString('en-NG')}</div>
          </div>

          {data.verifiedAt && (
            <div>
              <div style={{ color: '#666', fontSize: '11px', textTransform: 'uppercase' }}>
                Verified At
              </div>
              <div>{new Date(data.verifiedAt).toLocaleString('en-NG')}</div>
            </div>
          )}
        </div>

        {/* Parties Grid (Student & Payer) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '24px',
            marginBottom: '28px',
            fontSize: '13px',
          }}
        >
          <div>
            <div
              style={{
                fontWeight: 700,
                color: '#087e8b',
                marginBottom: '6px',
                textTransform: 'uppercase',
                fontSize: '11px',
                letterSpacing: '0.5px',
              }}
            >
              Student Details
            </div>
            <div style={{ fontWeight: 700, fontSize: '15px' }}>{data.student.name}</div>
            <div style={{ color: '#555' }}>
              Admission No: <strong>{data.student.studentNumber}</strong>
            </div>
            <div style={{ color: '#555' }}>Class: {data.student.className}</div>
          </div>

          <div>
            <div
              style={{
                fontWeight: 700,
                color: '#087e8b',
                marginBottom: '6px',
                textTransform: 'uppercase',
                fontSize: '11px',
                letterSpacing: '0.5px',
              }}
            >
              Payer Details
            </div>
            <div style={{ fontWeight: 700, fontSize: '15px' }}>{data.parent.name}</div>
            <div style={{ color: '#555' }}>Email: {data.parent.email}</div>
            <div style={{ color: '#555' }}>Channel: Flutterwave Online</div>
          </div>
        </div>

        {/* Itemized Payment Table */}
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            marginBottom: '28px',
            fontSize: '14px',
          }}
        >
          <thead>
            <tr style={{ borderBottom: '2px solid #e0e0e0', textAlign: 'left', color: '#555' }}>
              <th style={{ padding: '10px 0' }}>Description</th>
              <th style={{ padding: '10px 0', textAlign: 'center' }}>Currency</th>
              <th style={{ padding: '10px 0', textAlign: 'right' }}>Amount Paid</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '14px 0' }}>
                <strong>School Fee Payment</strong>
                <div style={{ fontSize: '12px', color: '#666' }}>
                  Direct online settlement via Flutterwave gateway
                </div>
              </td>
              <td style={{ padding: '14px 0', textAlign: 'center' }}>NGN</td>
              <td style={{ padding: '14px 0', textAlign: 'right', fontWeight: 700 }}>
                ₦{parseFloat(data.amount).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2} style={{ padding: '14px 0', fontWeight: 800, fontSize: '15px' }}>
                Total Paid:
              </td>
              <td
                style={{
                  padding: '14px 0',
                  textAlign: 'right',
                  fontWeight: 800,
                  fontSize: '18px',
                  color: '#087e8b',
                }}
              >
                ₦{parseFloat(data.amount).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
              </td>
            </tr>
          </tfoot>
        </table>

        {/* Legal & Audit Notice */}
        <div
          style={{
            padding: '14px 18px',
            backgroundColor: '#f8fafb',
            borderLeft: '3px solid #087e8b',
            borderRadius: '4px',
            fontSize: '12px',
            color: '#555',
            lineHeight: 1.5,
          }}
        >
          <strong>Official Record Notice:</strong> This receipt is automatically generated and
          reconciled against school bank records by SchoolPass. It confirms that the specified funds
          have been successfully received and credited to the student&apos;s financial ledger.
        </div>
      </div>
    </div>
  );
}

