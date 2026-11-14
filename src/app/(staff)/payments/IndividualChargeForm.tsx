'use client';

import React, { useState, useTransition } from 'react';
import { createIndividualChargeAction } from './actions';
import type { FeeAssignmentStudentPreview } from '@/lib/payments/templates';

interface IndividualChargeFormProps {
  students: FeeAssignmentStudentPreview[];
  sessions: string[];
  disabled?: boolean;
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

export function IndividualChargeForm({
  students,
  sessions,
  disabled,
}: IndividualChargeFormProps) {
  const [studentId, setStudentId] = useState(students[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [termId, setTermId] = useState(sessions[0] ? `${sessions[0]}-T1` : '');
  const [note, setNote] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );
  const [isPending, startTransition] = useTransition();

  const termOptions = Array.from(
    new Set(sessions.flatMap((session) => [`${session}-T1`, `${session}-T2`, `${session}-T3`]))
  );
  const selectedStudent = students.find((student) => student.id === studentId);
  const isDisabled = Boolean(disabled) || students.length === 0;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isDisabled) return;

    setMessage(null);
    setFieldErrors({});

    startTransition(async () => {
      try {
        const response = await createIndividualChargeAction(studentId, {
          title,
          amount,
          termId,
          note: note.trim() ? note : undefined,
        });

        if (!response.success) {
          setMessage({
            type: 'error',
            text: response.error ?? 'The individual charge could not be created.',
          });
          setFieldErrors(response.fieldErrors ?? {});
          return;
        }

        setMessage({
          type: 'success',
          text: 'Individual charge posted. The fee history now includes this new entry.',
        });
        setTitle('');
        setAmount('');
        setNote('');
      } catch {
        setMessage({
          type: 'error',
          text: 'The individual charge could not be created. Please try again.',
        });
      }
    });
  }

  return (
    <section
      aria-labelledby="individual-charge-title"
      style={{
        backgroundColor: 'var(--color-roles-surface)',
        border: '1px solid var(--color-roles-outline-color)',
        boxShadow: 'var(--effect-soft-shadow)',
        borderRadius: '8px',
        padding: '22px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}
    >
      <div>
        <h2
          id="individual-charge-title"
          style={{ margin: '0 0 6px 0', fontSize: '18px', color: 'var(--color-roles-on-surface)' }}
        >
          Individual Student Charge
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: '13px',
            color: 'var(--color-roles-on-surface-variant)',
            lineHeight: 1.5,
          }}
        >
          Use this for a one-off charge for a single active student. Corrections are posted as
          new entries and do not alter existing fee history.
        </p>
      </div>

      {students.length === 0 && (
        <div
          style={{
            padding: '12px 14px',
            borderRadius: '8px',
            border: '1px solid var(--color-roles-outline-color)',
            backgroundColor: 'var(--color-roles-background)',
            fontSize: '13px',
            color: 'var(--color-roles-on-surface-variant)',
          }}
        >
          No active students are available for individual assignment.
        </div>
      )}

      {message && (
        <div
          role="status"
          style={{
            padding: '12px 14px',
            borderRadius: '8px',
            border: `1px solid ${
              message.type === 'success'
                ? 'var(--color-roles-primary)'
                : 'var(--color-roles-error)'
            }`,
            backgroundColor:
              message.type === 'success'
                ? 'rgba(46, 125, 50, 0.08)'
                : 'rgba(179, 38, 30, 0.08)',
            color:
              message.type === 'success'
                ? 'var(--color-roles-primary)'
                : 'var(--color-roles-error)',
            fontSize: '13px',
          }}
        >
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '14px',
          }}
        >
          <label style={{ ...labelStyle, gridColumn: '1 / -1' }}>
            Student
            <select
              value={studentId}
              onChange={(event) => setStudentId(event.target.value)}
              disabled={isPending || isDisabled}
              style={inputStyle}
            >
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.name} - {student.studentNumber} ({student.className})
                </option>
              ))}
            </select>
            {selectedStudent && (
              <span style={{ fontWeight: 400, color: 'var(--color-roles-on-surface-variant)' }}>
                Selected class: {selectedStudent.className}
              </span>
            )}
            {fieldErrors.studentId && (
              <span style={{ color: 'var(--color-roles-error)' }}>{fieldErrors.studentId}</span>
            )}
          </label>

          <label style={labelStyle}>
            Fee title
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Uniform levy"
              disabled={isPending || isDisabled}
              style={inputStyle}
            />
            {fieldErrors.title && (
              <span style={{ color: 'var(--color-roles-error)' }}>{fieldErrors.title}</span>
            )}
          </label>

          <label style={labelStyle}>
            Amount (NGN)
            <input
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="5000.00"
              inputMode="decimal"
              disabled={isPending || isDisabled}
              style={inputStyle}
            />
            {fieldErrors.amount && (
              <span style={{ color: 'var(--color-roles-error)' }}>{fieldErrors.amount}</span>
            )}
          </label>

          <label style={labelStyle}>
            Term ID
            <input
              list="individual-charge-terms"
              value={termId}
              onChange={(event) => setTermId(event.target.value)}
              placeholder="2026/2027-T1"
              disabled={isPending || isDisabled}
              style={inputStyle}
            />
            <datalist id="individual-charge-terms">
              {termOptions.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
            {fieldErrors.termId && (
              <span style={{ color: 'var(--color-roles-error)' }}>{fieldErrors.termId}</span>
            )}
          </label>

          <label style={{ ...labelStyle, gridColumn: '1 / -1' }}>
            Note (optional)
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Short explanation for staff records"
              disabled={isPending || isDisabled}
              style={inputStyle}
            />
            {fieldErrors.note && (
              <span style={{ color: 'var(--color-roles-error)' }}>{fieldErrors.note}</span>
            )}
          </label>
        </div>

        <div>
          <button
            type="submit"
            disabled={isPending || isDisabled}
            style={{
              padding: '10px 18px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: 'var(--color-roles-primary)',
              color: 'var(--color-roles-on-primary)',
              fontWeight: 700,
              fontSize: '13px',
              cursor: isPending || isDisabled ? 'not-allowed' : 'pointer',
              opacity: isPending || isDisabled ? 0.6 : 1,
            }}
          >
            {isPending ? 'Posting charge...' : 'Post Individual Charge'}
          </button>
        </div>
      </form>
    </section>
  );
}
