'use client';

import React, { useEffect, useState, useTransition } from 'react';
import {
  applyFeeTemplateBulkAction,
  previewTemplateAssignmentAction,
} from './actions';
import type {
  FeeTemplate,
  TemplateAssignmentPreview,
  TemplateAssignmentResult,
} from '@/lib/payments/templates';

interface BulkAssignmentModalProps {
  template: FeeTemplate;
  classes: readonly string[];
  onClose: () => void;
  onApplied: (result: TemplateAssignmentResult) => void;
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.45)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '16px',
  zIndex: 50,
};

const panelStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '680px',
  maxHeight: '88vh',
  overflowY: 'auto',
  backgroundColor: 'var(--color-roles-surface)',
  color: 'var(--color-roles-on-surface)',
  borderRadius: '10px',
  border: '1px solid var(--color-roles-outline-color)',
  boxShadow: '0 18px 50px rgba(0, 0, 0, 0.25)',
  padding: '22px',
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
};

function formatMoney(amount: string): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
  }).format(Number(amount));
}

export function BulkAssignmentModal({
  template,
  classes,
  onClose,
  onApplied,
}: BulkAssignmentModalProps) {
  const [targetClass, setTargetClass] = useState(template.targetClass);
  const [preview, setPreview] = useState<TemplateAssignmentPreview | null>(null);
  const [result, setResult] = useState<TemplateAssignmentResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPreviewing, startPreview] = useTransition();
  const [isApplying, startApply] = useTransition();

  const targetOptions = Array.from(new Set(['ALL', ...classes, template.targetClass]));

  useEffect(() => {
    let active = true;
    setPreview(null);
    setResult(null);
    setError(null);

    startPreview(async () => {
      try {
        const response = await previewTemplateAssignmentAction(
          template.id,
          targetClass
        );
        if (!active) return;
        if (!response.success || !response.preview) {
          setError(response.error ?? 'The assignment preview could not be loaded.');
          return;
        }
        setPreview(response.preview);
      } catch {
        if (active) setError('The assignment preview could not be loaded.');
      }
    });

    return () => {
      active = false;
    };
  }, [template.id, targetClass]);

  function handleApply() {
    setError(null);
    startApply(async () => {
      try {
        const response = await applyFeeTemplateBulkAction(
          template.id,
          targetClass
        );
        if (!response.success || !response.result) {
          setError(response.error ?? 'The fee assignment could not be completed.');
          return;
        }
        setResult(response.result);
        onApplied(response.result);
      } catch {
        setError('The fee assignment could not be completed. Please try again.');
      }
    });
  }

  const targetLabel = targetClass === 'ALL' ? 'All active students' : targetClass;

  return (
    <div
      style={overlayStyle}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isApplying) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-assignment-title"
        style={panelStyle}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
          <div>
            <h2 id="bulk-assignment-title" style={{ margin: '0 0 4px 0', fontSize: '20px' }}>
              Assign Fee to Class
            </h2>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-roles-on-surface-variant)' }}>
              {template.title} &bull; {formatMoney(template.amount)} &bull; {template.termId}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isApplying}
            aria-label="Close assignment preview"
            style={{
              border: 'none',
              backgroundColor: 'transparent',
              color: 'var(--color-roles-on-surface-variant)',
              cursor: isApplying ? 'not-allowed' : 'pointer',
              fontSize: '20px',
              lineHeight: 1,
            }}
          >
            &times;
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label htmlFor="bulk-target-class" style={{ fontSize: '13px', fontWeight: 700 }}>
            Apply to
          </label>
          <select
            id="bulk-target-class"
            value={targetClass}
            onChange={(event) => setTargetClass(event.target.value)}
            disabled={isApplying}
            style={{
              padding: '10px 12px',
              borderRadius: '6px',
              border: '1px solid var(--color-roles-outline-color)',
              backgroundColor: 'var(--color-roles-surface)',
              color: 'var(--color-roles-on-surface)',
              fontSize: '13px',
            }}
          >
            {targetOptions.map((option) => (
              <option key={option} value={option}>
                {option === 'ALL' ? 'All active students' : option}
              </option>
            ))}
          </select>
          <span style={{ fontSize: '12px', color: 'var(--color-roles-on-surface-variant)' }}>
            Changing the scope updates the preview. Nothing is billed until you confirm.
          </span>
        </div>

        <div
          style={{
            padding: '12px 14px',
            borderRadius: '8px',
            backgroundColor: 'var(--color-roles-background)',
            border: '1px solid var(--color-roles-outline-color)',
            fontSize: '13px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          <div>
            <strong>Target:</strong> {targetLabel}
          </div>
          <div>
            <strong>Term:</strong> {template.termId}
          </div>
          <div style={{ color: 'var(--color-roles-on-surface-variant)' }}>
            Each eligible student receives one charge. Students already assigned this template
            for the term are skipped.
          </div>
        </div>

        {error && (
          <div
            role="alert"
            style={{
              padding: '12px 14px',
              borderRadius: '8px',
              border: '1px solid var(--color-roles-error)',
              backgroundColor: 'rgba(179, 38, 30, 0.08)',
              color: 'var(--color-roles-error)',
              fontSize: '13px',
            }}
          >
            {error}
          </div>
        )}

        {result ? (
          <div
            role="status"
            style={{
              padding: '14px',
              borderRadius: '8px',
              border: '1px solid var(--color-roles-primary)',
              backgroundColor: 'rgba(46, 125, 50, 0.08)',
              color: 'var(--color-roles-primary)',
              fontSize: '13px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}
          >
            <strong>Assignment complete.</strong>
            <span>{result.createdCount} charge(s) created.</span>
            <span>{result.skippedCount} student(s) skipped as already assigned.</span>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '13px' }}>
              <span>
                <strong>{preview?.eligibleStudents.length ?? 0}</strong> eligible
              </span>
              <span>
                <strong>{preview?.skippedCount ?? 0}</strong> already assigned
              </span>
              <span>
                <strong>{preview?.totalStudents ?? 0}</strong> active in scope
              </span>
            </div>

            <div
              style={{
                border: '1px solid var(--color-roles-outline-color)',
                borderRadius: '8px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: '10px 12px',
                  backgroundColor: 'var(--color-roles-background)',
                  fontWeight: 700,
                  fontSize: '12px',
                  borderBottom: '1px solid var(--color-roles-outline-color)',
                }}
              >
                Students who will receive this charge
              </div>
              <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
                {isPreviewing ? (
                  <div style={{ padding: '20px', fontSize: '13px', textAlign: 'center' }}>
                    Loading eligible students...
                  </div>
                ) : preview && preview.eligibleStudents.length > 0 ? (
                  preview.eligibleStudents.map((student) => (
                    <div
                      key={student.id}
                      style={{
                        padding: '9px 12px',
                        borderBottom: '1px solid var(--color-roles-outline-color)',
                        fontSize: '12px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: '10px',
                      }}
                    >
                      <span>{student.name}</span>
                      <span style={{ color: 'var(--color-roles-on-surface-variant)' }}>
                        {student.studentNumber} &bull; {student.className}
                      </span>
                    </div>
                  ))
                ) : (
                  <div
                    style={{
                      padding: '20px',
                      fontSize: '13px',
                      textAlign: 'center',
                      color: 'var(--color-roles-on-surface-variant)',
                    }}
                  >
                    No eligible students in this scope.
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
          {result ? (
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '10px 18px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: 'var(--color-roles-primary)',
                color: 'var(--color-roles-on-primary)',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              Done
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={isApplying}
                style={{
                  padding: '10px 16px',
                  borderRadius: '6px',
                  border: '1px solid var(--color-roles-outline-color)',
                  backgroundColor: 'transparent',
                  color: 'var(--color-roles-on-surface)',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: isApplying ? 'not-allowed' : 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApply}
                disabled={
                  isApplying ||
                  isPreviewing ||
                  !preview ||
                  preview.eligibleStudents.length === 0
                }
                style={{
                  padding: '10px 18px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: 'var(--color-roles-primary)',
                  color: 'var(--color-roles-on-primary)',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor:
                    isApplying ||
                    isPreviewing ||
                    !preview ||
                    preview.eligibleStudents.length === 0
                      ? 'not-allowed'
                      : 'pointer',
                  opacity:
                    isApplying ||
                    isPreviewing ||
                    !preview ||
                    preview.eligibleStudents.length === 0
                      ? 0.6
                      : 1,
                }}
              >
                {isApplying
                  ? 'Assigning...'
                  : `Confirm & Assign ${preview?.eligibleStudents.length ?? 0} Charge(s)`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
