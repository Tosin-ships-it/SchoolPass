'use client';

import React, { useState, useTransition } from 'react';
import type { AcademicCalendarSetting, AcademicTermConfig } from '@/lib/attendance/calendar';
import { saveAcademicCalendarAction } from './actions';

interface SettingsManagerProps {
  initialCalendar: AcademicCalendarSetting;
}

export function SettingsManager({ initialCalendar }: SettingsManagerProps) {
  const [calendar, setCalendar] = useState<AcademicCalendarSetting>(initialCalendar);
  const [errors, setErrors] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSessionChange = (newSession: string) => {
    const trimmed = newSession.trim();
    setCalendar((prev) => ({
      ...prev,
      sessionYear: trimmed,
      // Update term prefixes to match session year if in format YYYY/YYYY
      terms: prev.terms.map((term, index) => ({
        ...term,
        termId: `${trimmed}-T${index + 1}`,
      })),
      currentTermId: prev.currentTermId?.includes('-')
        ? `${trimmed}-${prev.currentTermId.split('-')[1]}`
        : `${trimmed}-T1`,
    }));
  };

  const handleTermDateChange = (
    index: number,
    field: 'startDate' | 'endDate',
    value: string
  ) => {
    setCalendar((prev) => {
      const updatedTerms = [...prev.terms];
      updatedTerms[index] = {
        ...updatedTerms[index],
        [field]: value.trim() === '' ? null : value.trim(),
      };
      return {
        ...prev,
        terms: updatedTerms,
      };
    });
  };

  const handleActiveTermSelect = (termId: string) => {
    setCalendar((prev) => ({
      ...prev,
      currentTermId: termId,
    }));
  };

  const handleSave = () => {
    setErrors([]);
    setSuccessMessage(null);

    startTransition(async () => {
      const res = await saveAcademicCalendarAction(calendar);
      if (!res.success) {
        setErrors(res.errors || ['Failed to save calendar settings.']);
      } else {
        setSuccessMessage('Academic calendar settings updated successfully.');
        const current = calendar.terms.find((t) => t.termId === calendar.currentTermId);
        const hasCurrentDates = Boolean(
          current &&
          current.startDate &&
          current.endDate &&
          current.startDate.trim() !== '' &&
          current.endDate.trim() !== '' &&
          !Number.isNaN(new Date(current.startDate).getTime()) &&
          !Number.isNaN(new Date(current.endDate).getTime()) &&
          new Date(current.startDate).getTime() < new Date(current.endDate).getTime()
        );
        const hasAllDates = calendar.terms.every(
          (t) => t.startDate && t.endDate && t.startDate.trim() !== '' && t.endDate.trim() !== ''
        );
        setCalendar((prev) => ({
          ...prev,
          isConfigured: hasAllDates,
          isCurrentTermConfigured: hasCurrentDates,
        }));
      }
    });
  };

  const currentTerm = calendar.terms.find((t) => t.termId === calendar.currentTermId);
  const isCurrentTermConfigured = Boolean(
    currentTerm &&
    currentTerm.startDate &&
    currentTerm.endDate &&
    currentTerm.startDate.trim() !== '' &&
    currentTerm.endDate.trim() !== '' &&
    !Number.isNaN(new Date(currentTerm.startDate).getTime()) &&
    !Number.isNaN(new Date(currentTerm.endDate).getTime()) &&
    new Date(currentTerm.startDate).getTime() < new Date(currentTerm.endDate).getTime()
  );

  const isFullyConfigured = calendar.terms.every(
    (t) => t.startDate && t.endDate && t.startDate.trim() !== '' && t.endDate.trim() !== ''
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Configuration Status Card */}
      <div
        style={{
          backgroundColor: 'var(--color-roles-surface)',
          border: '1px solid var(--color-roles-outline-color)',
          boxShadow: 'var(--effect-soft-shadow)',
          borderRadius: '8px',
          padding: '20px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2
              style={{
                fontFamily: 'var(--typography-title-medium-fontfamily)',
                fontSize: '18px',
                fontWeight: 700,
                color: 'var(--color-roles-on-surface)',
                margin: '0 0 4px 0',
              }}
            >
              Academic Calendar Status
            </h2>
            <p
              style={{
                fontSize: '13px',
                color: 'var(--color-roles-on-surface-variant)',
                margin: 0,
              }}
            >
              Academic Session: <strong>{calendar.sessionYear}</strong> &bull; Current Active Term:{' '}
              <strong>
                {calendar.terms.find((t) => t.termId === calendar.currentTermId)?.name ||
                  calendar.currentTermId ||
                  'None'}
              </strong>
            </p>
          </div>

          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '13px',
              fontWeight: 600,
              backgroundColor: isCurrentTermConfigured
                ? 'var(--color-semantic-success-container, #e6f4ea)'
                : 'var(--color-semantic-warning-container, #fef7e0)',
              color: isCurrentTermConfigured
                ? 'var(--color-semantic-success, #137333)'
                : 'var(--color-semantic-warning, #b06000)',
              border: `1px solid ${
                isCurrentTermConfigured ? 'rgba(19, 115, 51, 0.3)' : 'rgba(176, 96, 0, 0.3)'
              }`,
            }}
          >
            {isCurrentTermConfigured
              ? isFullyConfigured
                ? '✓ All Term Dates Configured & Ready'
                : '✓ Current Term Active & Ready for Financial Transactions'
              : '⚠ Current Term Dates Incomplete (Financial Entries Paused)'}
          </span>
        </div>

        {!isCurrentTermConfigured ? (
          <div
            style={{
              fontSize: '13px',
              color: 'var(--color-roles-on-surface-variant)',
              backgroundColor: 'var(--color-roles-background)',
              padding: '12px 16px',
              borderRadius: '6px',
              lineHeight: 1.5,
              borderLeft: '4px solid var(--color-semantic-warning, #b06000)',
            }}
          >
            <strong>Note:</strong> The academic session and current term are saved. Financial
            entries (fee assignments, offline payments, adjustments, online payments) remain
            paused until valid start and end dates are entered for the current term. You can
            still create and manage fee templates.
          </div>
        ) : !isFullyConfigured ? (
          <div
            style={{
              fontSize: '13px',
              color: 'var(--color-roles-on-surface-variant)',
              backgroundColor: 'var(--color-roles-background)',
              padding: '12px 16px',
              borderRadius: '6px',
              lineHeight: 1.5,
              borderLeft: '4px solid var(--color-semantic-success, #137333)',
            }}
          >
            <strong>Note:</strong> Current term dates are configured and financial transactions
            are enabled. Future term dates (Second Term, Third Term) may remain blank until
            approved by the school administration.
          </div>
        ) : null}
      </div>

      {/* Success Banner */}
      {successMessage && (
        <div
          role="status"
          style={{
            backgroundColor: 'var(--color-semantic-success-container, #e6f4ea)',
            color: 'var(--color-semantic-success, #137333)',
            padding: '12px 16px',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: 600,
            border: '1px solid rgba(19, 115, 51, 0.3)',
          }}
        >
          {successMessage}
        </div>
      )}

      {/* Error Banner */}
      {errors.length > 0 && (
        <div
          role="alert"
          style={{
            backgroundColor: 'var(--color-semantic-error-container, #fce8e6)',
            color: 'var(--color-roles-error, #c5221f)',
            padding: '14px 18px',
            borderRadius: '6px',
            fontSize: '14px',
            border: '1px solid rgba(197, 34, 31, 0.3)',
          }}
        >
          <strong style={{ display: 'block', marginBottom: '6px' }}>
            Please correct the following errors:
          </strong>
          <ul style={{ margin: 0, paddingLeft: '20px' }}>
            {errors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Calendar Form Card */}
      <div
        style={{
          backgroundColor: 'var(--color-roles-surface)',
          border: '1px solid var(--color-roles-outline-color)',
          boxShadow: 'var(--effect-soft-shadow)',
          borderRadius: '8px',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
        }}
      >
        <div>
          <h2
            style={{
              fontFamily: 'var(--typography-title-medium-fontfamily)',
              fontSize: '18px',
              fontWeight: 700,
              color: 'var(--color-roles-on-surface)',
              margin: '0 0 6px 0',
            }}
          >
            Academic Session &amp; Terms
          </h2>
          <p
            style={{
              fontSize: '13px',
              color: 'var(--color-roles-on-surface-variant)',
              margin: 0,
            }}
          >
            SchoolPass mandates three terms per session (First Term, Second Term, Third Term).
          </p>
        </div>

        {/* Academic Session Input */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxWidth: '320px' }}>
          <label
            htmlFor="academic-session-input"
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: 'var(--color-roles-on-surface)',
            }}
          >
            Academic Session Year
          </label>
          <input
            id="academic-session-input"
            type="text"
            value={calendar.sessionYear}
            onChange={(e) => handleSessionChange(e.target.value)}
            placeholder="e.g. 2026/2027"
            style={{
              padding: '10px 14px',
              borderRadius: '6px',
              border: '1px solid var(--color-roles-outline-color)',
              fontSize: '14px',
              backgroundColor: 'var(--color-roles-surface)',
              color: 'var(--color-roles-on-surface)',
            }}
          />
          <span style={{ fontSize: '12px', color: 'var(--color-roles-on-surface-variant)' }}>
            Format: YYYY/YYYY (e.g. 2026/2027)
          </span>
        </div>

        {/* Terms Configuration */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <span
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: 'var(--color-roles-on-surface)',
            }}
          >
            Term Dates &amp; Active Term Selection
          </span>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '16px',
            }}
          >
            {calendar.terms.map((term: AcademicTermConfig, index: number) => {
              const isCurrent = calendar.currentTermId === term.termId;

              return (
                <div
                  key={term.termId}
                  style={{
                    padding: '18px',
                    borderRadius: '8px',
                    border: `2px solid ${
                      isCurrent
                        ? 'var(--color-roles-primary)'
                        : 'var(--color-roles-outline-variant)'
                    }`,
                    backgroundColor: isCurrent
                      ? 'rgba(var(--color-roles-primary-rgb, 15, 76, 129), 0.03)'
                      : 'var(--color-roles-background)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px',
                    position: 'relative',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h3
                        style={{
                          margin: 0,
                          fontSize: '16px',
                          fontWeight: 700,
                          color: 'var(--color-roles-on-surface)',
                        }}
                      >
                        {term.name}
                      </h3>
                      <span
                        style={{
                          fontSize: '12px',
                          color: 'var(--color-roles-on-surface-variant)',
                        }}
                      >
                        Identifier: <code>{term.termId}</code>
                      </span>
                    </div>

                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: isCurrent
                          ? 'var(--color-roles-primary)'
                          : 'var(--color-roles-on-surface-variant)',
                      }}
                    >
                      <input
                        type="radio"
                        name="activeTermSelector"
                        checked={isCurrent}
                        onChange={() => handleActiveTermSelect(term.termId)}
                        style={{ cursor: 'pointer' }}
                      />
                      {isCurrent ? 'Active Term' : 'Set as Active'}
                    </label>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label
                        htmlFor={`start-date-${term.termId}`}
                        style={{
                          fontSize: '12px',
                          fontWeight: 600,
                          color: 'var(--color-roles-on-surface)',
                        }}
                      >
                        Start Date
                      </label>
                      <input
                        id={`start-date-${term.termId}`}
                        type="date"
                        value={term.startDate || ''}
                        onChange={(e) => handleTermDateChange(index, 'startDate', e.target.value)}
                        style={{
                          padding: '8px 12px',
                          borderRadius: '6px',
                          border: '1px solid var(--color-roles-outline-color)',
                          fontSize: '13px',
                          backgroundColor: 'var(--color-roles-surface)',
                          color: 'var(--color-roles-on-surface)',
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label
                        htmlFor={`end-date-${term.termId}`}
                        style={{
                          fontSize: '12px',
                          fontWeight: 600,
                          color: 'var(--color-roles-on-surface)',
                        }}
                      >
                        End Date
                      </label>
                      <input
                        id={`end-date-${term.termId}`}
                        type="date"
                        value={term.endDate || ''}
                        onChange={(e) => handleTermDateChange(index, 'endDate', e.target.value)}
                        style={{
                          padding: '8px 12px',
                          borderRadius: '6px',
                          border: '1px solid var(--color-roles-outline-color)',
                          fontSize: '13px',
                          backgroundColor: 'var(--color-roles-surface)',
                          color: 'var(--color-roles-on-surface)',
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ fontSize: '11px', color: 'var(--color-roles-on-surface-variant)' }}>
                    {term.startDate && term.endDate
                      ? `Configured: ${term.startDate} to ${term.endDate}`
                      : 'Dates not configured (Official calendar pending)'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Button */}
        <div style={{ display: 'flex', justifyContent: 'flex-start', paddingTop: '8px' }}>
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            style={{
              padding: '12px 28px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: isPending
                ? 'var(--color-roles-outline-color)'
                : 'var(--color-roles-primary)',
              color: 'var(--color-roles-on-primary)',
              fontSize: '14px',
              fontWeight: 700,
              cursor: isPending ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            {isPending ? 'Saving Calendar...' : 'Save Calendar Configuration'}
          </button>
        </div>
      </div>
    </div>
  );
}

