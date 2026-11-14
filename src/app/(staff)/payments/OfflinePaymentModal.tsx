'use client';

import React, { useState, useTransition } from 'react';
import { recordOfflinePaymentAction } from './actions';
import {
  OFFLINE_PAYMENT_METHOD_LABELS,
  OFFLINE_PAYMENT_METHOD_OPTIONS,
  type OfflinePaymentMethod,
} from '@/lib/payments/offline-options';
import type { FeeDirectoryStudent } from '@/lib/payments/offline';

interface OfflinePaymentModalProps {
  student: FeeDirectoryStudent;
  onClose: () => void;
  onRecorded: () => void;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 12px',
  borderRadius: '6px',
  border: '1px solid var(--color-roles-outline-color)',
  backgroundColor: 'var(--color-roles-surface)',
  color: 'var(--color-roles-on-surface)',
  fontFamily: 'var(--typography-body-medium-fontfamily)',
  fontSize: '14px',
};

const labelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  fontSize: '13px',
  fontWeight: 600,
  color: 'var(--color-roles-on-surface)',
};

function formatMoney(amount?: string | null): string {
  const value = Number(amount ?? 0);
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

export function OfflinePaymentModal({
  student,
  onClose,
  onRecorded,
}: OfflinePaymentModalProps) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<OfflinePaymentMethod>('CASH');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    startTransition(async () => {
      try {
        const result = await recordOfflinePaymentAction(
          student.id,
          amount,
          method,
          reference,
          note
        );

        if (!result.success) {
          setError(result.error ?? 'The offline payment could not be recorded.');
          setFieldErrors(result.fieldErrors ?? {});
          return;
        }

        onRecorded();
      } catch {
        setError('The offline payment could not be recorded. Please try again.');
      }
    });
  }

  return (
    <div
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        backgroundColor: 'rgba(20, 20, 20, 0.55)',
        padding: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="offline-payment-title"
        style={{
          width: '100%',
          maxWidth: '560px',
          maxHeight: '90dvh',
          overflowY: 'auto',
          backgroundColor: 'var(--color-roles-surface)',
          color: 'var(--color-roles-on-surface)',
          border: '1px solid var(--color-roles-outline-color)',
          borderRadius: '8px',
          boxShadow: 'var(--effect-soft-shadow)',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
        }}
      >
        <div>
          <h2 id="offline-payment-title" style={{ margin: '0 0 6px 0', fontSize: '20px' }}>
            Record Offline Payment
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: '13px',
              color: 'var(--color-roles-on-surface-variant)',
              lineHeight: 1.5,
            }}
          >
            {student.name} ({student.studentNumber}) &middot; {student.className}
          </p>
          <p
            style={{
              margin: '8px 0 0 0',
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--color-roles-on-surface)',
            }}
          >
            Outstanding: {formatMoney(student.summary?.amountDue)}
          </p>
        </div>

        <div
          style={{
            padding: '12px 14px',
            borderRadius: '6px',
            border: '1px solid var(--color-roles-outline-color)',
            backgroundColor: 'rgba(255, 193, 7, 0.10)',
            fontSize: '12px',
            lineHeight: 1.5,
            color: 'var(--color-roles-on-surface)',
          }}
        >
          Record this payment only after the funds have been confirmed in the school&apos;s
          cash record or bank statement. A screenshot or transfer alert is not proof of payment.
        </div>

        {error && (
          <div
            role="alert"
            style={{
              padding: '12px 14px',
              border: '1px solid var(--color-roles-error)',
              backgroundColor: 'rgba(179, 38, 30, 0.08)',
              color: 'var(--color-roles-error)',
              borderRadius: '6px',
              fontSize: '13px',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            <label style={labelStyle}>
              Amount (NGN)
              <input
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="45000.00"
                inputMode="decimal"
                disabled={isPending}
                style={inputStyle}
                autoFocus
              />
              {fieldErrors.amount && (
                <span style={{ color: 'var(--color-roles-error)' }}>{fieldErrors.amount}</span>
              )}
            </label>

            <label style={labelStyle}>
              Payment method
              <select
                value={method}
                onChange={(event) => setMethod(event.target.value as OfflinePaymentMethod)}
                disabled={isPending}
                style={inputStyle}
              >
                {OFFLINE_PAYMENT_METHOD_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {fieldErrors.method && (
                <span style={{ color: 'var(--color-roles-error)' }}>{fieldErrors.method}</span>
              )}
            </label>
          </div>

          <label style={labelStyle}>
            Receipt, teller, or transaction reference
            <input
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              placeholder="e.g. TRX-2026-001"
              disabled={isPending}
              style={inputStyle}
            />
            {fieldErrors.reference && (
              <span style={{ color: 'var(--color-roles-error)' }}>{fieldErrors.reference}</span>
            )}
          </label>

          <label style={labelStyle}>
            Note
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={`Describe the ${OFFLINE_PAYMENT_METHOD_LABELS[method].toLowerCase()} payment.`}
              disabled={isPending}
              rows={3}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
            {fieldErrors.note && (
              <span style={{ color: 'var(--color-roles-error)' }}>{fieldErrors.note}</span>
            )}
          </label>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              style={{
                padding: '10px 16px',
                borderRadius: '6px',
                border: '1px solid var(--color-roles-outline-color)',
                backgroundColor: 'transparent',
                color: 'var(--color-roles-on-surface)',
                fontWeight: 600,
                cursor: isPending ? 'not-allowed' : 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              style={{
                padding: '10px 18px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: 'var(--color-roles-primary)',
                color: 'var(--color-roles-on-primary)',
                fontWeight: 700,
                cursor: isPending ? 'not-allowed' : 'pointer',
                opacity: isPending ? 0.7 : 1,
              }}
            >
              {isPending ? 'Recording...' : 'Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
