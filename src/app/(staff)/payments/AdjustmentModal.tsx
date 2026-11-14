'use client';

import React, { useState, useTransition } from 'react';
import { recordAdjustmentAction } from './actions';
import type { FeeDirectoryStudent } from '@/lib/payments/offline';

interface AdjustmentModalProps {
  student: FeeDirectoryStudent;
  onClose: () => void;
  onRecorded: () => void;
}

type AdjustmentDirection = 'credit' | 'debit';

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

export function AdjustmentModal({ student, onClose, onRecorded }: AdjustmentModalProps) {
  const [direction, setDirection] = useState<AdjustmentDirection>('credit');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    const signedAmount = direction === 'credit' ? `-${amount.trim()}` : amount.trim();

    startTransition(async () => {
      try {
        const result = await recordAdjustmentAction(student.id, signedAmount, note);

        if (!result.success) {
          setError(result.error ?? 'The fee adjustment could not be recorded.');
          setFieldErrors(result.fieldErrors ?? {});
          return;
        }

        onRecorded();
      } catch {
        setError('The fee adjustment could not be recorded. Please try again.');
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
        aria-labelledby="fee-adjustment-title"
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
          <h2 id="fee-adjustment-title" style={{ margin: '0 0 6px 0', fontSize: '20px' }}>
            Record Fee Adjustment
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
          <label style={labelStyle}>
            Adjustment type
            <select
              value={direction}
              onChange={(event) => setDirection(event.target.value as AdjustmentDirection)}
              disabled={isPending}
              style={inputStyle}
            >
              <option value="credit">Credit or waiver (reduces balance)</option>
              <option value="debit">Debit (increases balance)</option>
            </select>
          </label>

          <label style={labelStyle}>
            Amount (NGN)
            <input
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="5000.00"
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
            Reason for adjustment
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Explain why this adjustment is being recorded."
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
              {isPending ? 'Recording...' : 'Record Adjustment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
