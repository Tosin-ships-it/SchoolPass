'use client';

import React, { useState, useTransition } from 'react';
import {
  createFeeTemplateAction,
  deleteFeeTemplateAction,
  updateFeeTemplateAction,
} from './actions';
import { BulkAssignmentModal } from './BulkAssignmentModal';
import { IndividualChargeForm } from './IndividualChargeForm';
import type {
  FeeAssignmentStudentPreview,
  FeeTemplate,
} from '@/lib/payments/templates';

interface FeeTemplateManagerProps {
  initialTemplates: FeeTemplate[];
  students: FeeAssignmentStudentPreview[];
  classes: string[];
  sessions: string[];
  storageError?: string;
  dataError?: string;
}

interface TemplateFormState {
  title: string;
  amount: string;
  targetClass: string;
  sessionYear: string;
  termId: string;
  isCompulsory: boolean;
  dueDate: string;
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

const primaryButtonStyle: React.CSSProperties = {
  padding: '10px 18px',
  borderRadius: '6px',
  border: 'none',
  backgroundColor: 'var(--color-roles-primary)',
  color: 'var(--color-roles-on-primary)',
  fontWeight: 700,
  fontSize: '13px',
  cursor: 'pointer',
};

const secondaryButtonStyle: React.CSSProperties = {
  padding: '8px 14px',
  borderRadius: '6px',
  border: '1px solid var(--color-roles-outline-color)',
  backgroundColor: 'transparent',
  color: 'var(--color-roles-on-surface)',
  fontWeight: 600,
  fontSize: '13px',
  cursor: 'pointer',
};

function buildEmptyForm(classes: string[], sessions: string[]): TemplateFormState {
  const sessionYear = sessions[0] ?? '2026/2027';
  return {
    title: '',
    amount: '',
    targetClass: classes[0] ?? 'ALL',
    sessionYear,
    termId: sessionYear ? `${sessionYear}-T1` : '2026/2027-T1',
    isCompulsory: true,
    dueDate: '',
  };
}

function formatMoney(amount: string): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
  }).format(Number(amount));
}

function formatDate(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

export function FeeTemplateManager({
  initialTemplates,
  students,
  classes,
  sessions,
  storageError,
  dataError,
}: FeeTemplateManagerProps) {
  const availableSessions = sessions && sessions.length > 0 ? sessions : ['2026/2027'];
  const [templates, setTemplates] = useState(initialTemplates);
  const [form, setForm] = useState<TemplateFormState>(() =>
    buildEmptyForm(classes, availableSessions)
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );
  const [bulkTemplate, setBulkTemplate] = useState<FeeTemplate | null>(null);
  const [isPending, startTransition] = useTransition();

  const isReadOnly = Boolean(storageError);

  function updateForm<K extends keyof TemplateFormState>(
    key: K,
    value: TemplateFormState[K]
  ) {
    setForm((previous) => ({ ...previous, [key]: value }));
    setFieldErrors((previous) => {
      if (!previous[key]) return previous;
      const next = { ...previous };
      delete next[key];
      return next;
    });
  }

  function resetForm() {
    setForm(buildEmptyForm(classes, sessions));
    setEditingId(null);
    setFieldErrors({});
  }

  function handleEdit(template: FeeTemplate) {
    setEditingId(template.id);
    setForm({
      title: template.title,
      amount: template.amount,
      targetClass: template.targetClass,
      sessionYear: template.sessionYear,
      termId: template.termId,
      isCompulsory: template.isCompulsory,
      dueDate: template.dueDate ? template.dueDate.slice(0, 10) : '',
    });
    setFieldErrors({});
    setMessage(null);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isReadOnly) return;

    setMessage(null);
    setFieldErrors({});

    const payload = {
      title: form.title,
      amount: form.amount,
      targetClass: form.targetClass,
      sessionYear: form.sessionYear,
      termId: form.termId,
      isCompulsory: form.isCompulsory,
      ...(form.dueDate ? { dueDate: form.dueDate } : {}),
    };

    startTransition(async () => {
      try {
        const result = editingId
          ? await updateFeeTemplateAction({ id: editingId, ...payload })
          : await createFeeTemplateAction(payload);

        if (!result.success || !result.template) {
          setMessage({
            type: 'error',
            text: result.error ?? 'The fee template could not be saved.',
          });
          setFieldErrors(result.fieldErrors ?? {});
          return;
        }

        if (editingId) {
          setTemplates((previous) =>
            previous.map((template) =>
              template.id === result.template!.id ? result.template! : template
            )
          );
        } else {
          setTemplates((previous) => [...previous, result.template!]);
        }

        setMessage({
          type: 'success',
          text: editingId ? 'Fee template updated.' : 'Fee template created.',
        });
        resetForm();
      } catch {
        setMessage({
          type: 'error',
          text: 'The fee template could not be saved. Please try again.',
        });
      }
    });
  }

  function handleDelete(template: FeeTemplate) {
    if (isReadOnly) return;
    if (
      typeof window !== 'undefined' &&
      !window.confirm(`Delete the fee template "${template.title}"? Existing charges will not change.`)
    ) {
      return;
    }

    setMessage(null);

    startTransition(async () => {
      try {
        const result = await deleteFeeTemplateAction(template.id);
        if (!result.success) {
          setMessage({
            type: 'error',
            text: result.error ?? 'The fee template could not be deleted.',
          });
          return;
        }

        setTemplates((previous) => previous.filter((item) => item.id !== template.id));
        if (editingId === template.id) resetForm();
        setMessage({
          type: 'success',
          text: 'Fee template deleted. Existing posted charges were not changed.',
        });
      } catch {
        setMessage({
          type: 'error',
          text: 'The fee template could not be deleted. Please try again.',
        });
      }
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {storageError && (
        <div
          role="alert"
          style={{
            padding: '14px 16px',
            border: '1px solid var(--color-roles-error)',
            backgroundColor: 'rgba(179, 38, 30, 0.08)',
            color: 'var(--color-roles-error)',
            borderRadius: '8px',
            fontSize: '13px',
          }}
        >
          {storageError}
        </div>
      )}

      {dataError && (
        <div
          role="alert"
          style={{
            padding: '14px 16px',
            border: '1px solid var(--color-roles-error)',
            backgroundColor: 'rgba(179, 38, 30, 0.08)',
            color: 'var(--color-roles-error)',
            borderRadius: '8px',
            fontSize: '13px',
          }}
        >
          {dataError}
        </div>
      )}

      {message && (
        <div
          role="status"
          style={{
            padding: '14px 16px',
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
            borderRadius: '8px',
            fontSize: '13px',
          }}
        >
          {message.text}
        </div>
      )}

      <section
        aria-labelledby="fee-template-form-title"
        style={{
          backgroundColor: 'var(--color-roles-surface)',
          border: '1px solid var(--color-roles-outline-color)',
          boxShadow: 'var(--effect-soft-shadow)',
          borderRadius: '8px',
          padding: '22px',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
        }}
      >
        <div>
          <h2
            id="fee-template-form-title"
            style={{
              margin: '0 0 6px 0',
              fontSize: '18px',
              color: 'var(--color-roles-on-surface)',
            }}
          >
            {editingId ? 'Edit Fee Template' : 'Create Fee Template'}
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: '13px',
              color: 'var(--color-roles-on-surface-variant)',
              lineHeight: 1.5,
            }}
          >
            Templates define the title, amount, term, and target class. Applying a template
            creates one separate charge for each eligible student.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '14px',
            }}
          >
            <label style={labelStyle}>
              Fee title
              <input
                value={form.title}
                onChange={(event) => updateForm('title', event.target.value)}
                placeholder="Tuition - First Term"
                disabled={isPending || isReadOnly}
                style={inputStyle}
              />
              {fieldErrors.title && <span style={{ color: 'var(--color-roles-error)' }}>{fieldErrors.title}</span>}
            </label>

            <label style={labelStyle}>
              Amount (NGN)
              <input
                value={form.amount}
                onChange={(event) => updateForm('amount', event.target.value)}
                placeholder="45000.00"
                inputMode="decimal"
                disabled={isPending || isReadOnly}
                style={inputStyle}
              />
              {fieldErrors.amount && <span style={{ color: 'var(--color-roles-error)' }}>{fieldErrors.amount}</span>}
            </label>

            <label style={labelStyle}>
              Target class
              <input
                list="fee-template-classes"
                value={form.targetClass}
                onChange={(event) => updateForm('targetClass', event.target.value)}
                placeholder="ALL or class name"
                disabled={isPending || isReadOnly}
                style={inputStyle}
              />
              <datalist id="fee-template-classes">
                <option value="ALL" />
                {classes.map((className) => (
                  <option key={className} value={className} />
                ))}
              </datalist>
              {fieldErrors.targetClass && (
                <span style={{ color: 'var(--color-roles-error)' }}>{fieldErrors.targetClass}</span>
              )}
            </label>

            <label style={labelStyle}>
              Session year
              <input
                list="fee-template-sessions"
                value={form.sessionYear}
                onChange={(event) => updateForm('sessionYear', event.target.value)}
                placeholder="2026/2027"
                disabled={isPending || isReadOnly}
                style={inputStyle}
              />
              <datalist id="fee-template-sessions">
                {availableSessions.map((session) => (
                  <option key={session} value={session} />
                ))}
              </datalist>
              {fieldErrors.sessionYear && (
                <span style={{ color: 'var(--color-roles-error)' }}>{fieldErrors.sessionYear}</span>
              )}
            </label>

            <label style={labelStyle}>
              Term ID
              <input
                value={form.termId}
                onChange={(event) => updateForm('termId', event.target.value)}
                placeholder="2026/2027-T1"
                disabled={isPending || isReadOnly}
                style={inputStyle}
              />
              {fieldErrors.termId && <span style={{ color: 'var(--color-roles-error)' }}>{fieldErrors.termId}</span>}
            </label>

            <label style={labelStyle}>
              Due date (optional)
              <input
                type="date"
                value={form.dueDate}
                onChange={(event) => updateForm('dueDate', event.target.value)}
                disabled={isPending || isReadOnly}
                style={inputStyle}
              />
              {fieldErrors.dueDate && <span style={{ color: 'var(--color-roles-error)' }}>{fieldErrors.dueDate}</span>}
            </label>
          </div>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '13px',
              color: 'var(--color-roles-on-surface)',
              fontWeight: 600,
            }}
          >
            <input
              type="checkbox"
              checked={form.isCompulsory}
              onChange={(event) => updateForm('isCompulsory', event.target.checked)}
              disabled={isPending || isReadOnly}
            />
            Compulsory fee
          </label>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="submit"
              disabled={isPending || isReadOnly}
              style={{
                ...primaryButtonStyle,
                cursor: isPending || isReadOnly ? 'not-allowed' : 'pointer',
                opacity: isPending || isReadOnly ? 0.65 : 1,
              }}
            >
              {isPending
                ? 'Saving...'
                : editingId
                  ? 'Save Template Changes'
                  : 'Create Fee Template'}
            </button>

            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                disabled={isPending}
                style={secondaryButtonStyle}
              >
                Cancel Edit
              </button>
            )}
          </div>
        </form>
      </section>

      <section
        aria-labelledby="fee-template-list-title"
        style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          <h2
            id="fee-template-list-title"
            style={{
              margin: 0,
              fontSize: '18px',
              color: 'var(--color-roles-on-surface)',
            }}
          >
            Reusable Fee Templates
          </h2>
          <span style={{ fontSize: '13px', color: 'var(--color-roles-on-surface-variant)' }}>
            {templates.length} template{templates.length === 1 ? '' : 's'}
          </span>
        </div>

        {templates.length === 0 ? (
          <div
            style={{
              backgroundColor: 'var(--color-roles-surface)',
              border: '1px solid var(--color-roles-outline-color)',
              borderRadius: '8px',
              padding: '30px',
              textAlign: 'center',
              color: 'var(--color-roles-on-surface-variant)',
              fontSize: '13px',
            }}
          >
            No fee templates have been created yet.
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '14px',
            }}
          >
            {templates.map((template) => (
              <article
                key={template.id}
                style={{
                  backgroundColor: 'var(--color-roles-surface)',
                  border: '1px solid var(--color-roles-outline-color)',
                  borderRadius: '8px',
                  padding: '18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  boxShadow: 'var(--effect-soft-shadow)',
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: '16px',
                      fontWeight: 700,
                      color: 'var(--color-roles-on-surface)',
                      marginBottom: '4px',
                    }}
                  >
                    {template.title}
                  </div>
                  <div
                    style={{
                      fontSize: '20px',
                      fontWeight: 700,
                      color: 'var(--color-roles-primary)',
                    }}
                  >
                    {formatMoney(template.amount)}
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '8px',
                    fontSize: '12px',
                    color: 'var(--color-roles-on-surface-variant)',
                  }}
                >
                  <div>
                    <strong style={{ color: 'var(--color-roles-on-surface)' }}>Class</strong>
                    <br />
                    {template.targetClass}
                  </div>
                  <div>
                    <strong style={{ color: 'var(--color-roles-on-surface)' }}>Term</strong>
                    <br />
                    {template.termId}
                  </div>
                  <div>
                    <strong style={{ color: 'var(--color-roles-on-surface)' }}>Session</strong>
                    <br />
                    {template.sessionYear}
                  </div>
                  <div>
                    <strong style={{ color: 'var(--color-roles-on-surface)' }}>Type</strong>
                    <br />
                    {template.isCompulsory ? 'Compulsory' : 'Optional'}
                  </div>
                  {template.dueDate && (
                    <div>
                      <strong style={{ color: 'var(--color-roles-on-surface)' }}>Due</strong>
                      <br />
                      {formatDate(template.dueDate)}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                  <button
                    type="button"
                    onClick={() => handleEdit(template)}
                    disabled={isPending || isReadOnly}
                    style={secondaryButtonStyle}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setBulkTemplate(template)}
                    disabled={isPending || isReadOnly || Boolean(dataError)}
                    style={{
                      ...secondaryButtonStyle,
                      border: '1px solid var(--color-roles-primary)',
                      color: 'var(--color-roles-primary)',
                    }}
                  >
                    Assign to Class
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(template)}
                    disabled={isPending || isReadOnly}
                    style={{
                      ...secondaryButtonStyle,
                      border: '1px solid var(--color-roles-error)',
                      color: 'var(--color-roles-error)',
                    }}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <IndividualChargeForm
        students={students}
        sessions={sessions}
        disabled={isReadOnly || Boolean(dataError)}
      />

      {bulkTemplate && (
        <BulkAssignmentModal
          template={bulkTemplate}
          classes={classes}
          onClose={() => setBulkTemplate(null)}
          onApplied={(result) => {
            setMessage({
              type: 'success',
              text: `${result.createdCount} charge${result.createdCount === 1 ? '' : 's'} created. ${result.skippedCount} already-assigned student${result.skippedCount === 1 ? '' : 's'} skipped.`,
            });
          }}
        />
      )}
    </div>
  );
}
