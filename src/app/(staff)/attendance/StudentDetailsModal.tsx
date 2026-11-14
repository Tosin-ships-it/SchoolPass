'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { IntakeStudentItem, IntakeStatus } from './fuzzySearch';

interface Props {
  student: IntakeStudentItem | null;
  onClose: () => void;
}

function getStatusBadgeStyle(status: IntakeStatus): {
  backgroundColor: string;
  color: string;
  borderColor: string;
} {
  switch (status) {
    case 'Enrolled & Linked':
      return {
        backgroundColor: '#e8f5e9',
        color: '#1b5e20',
        borderColor: '#a5d6a7',
      };
    case 'Verification Pending':
      return {
        backgroundColor: '#fff3e0',
        color: '#e65100',
        borderColor: '#ffcc80',
      };
    case 'Enrolled':
      return {
        backgroundColor: '#e1f5fe',
        color: '#01579b',
        borderColor: '#81d4fa',
      };
    case 'Pre-Admission Intake':
    default:
      return {
        backgroundColor: 'var(--color-roles-surface-container, #f5f5f5)',
        color: 'var(--color-roles-on-surface-variant, #616161)',
        borderColor: 'var(--color-roles-outline-variant, #e0e0e0)',
      };
  }
}

function getFeeBadgeStyle(statusLabel?: 'Settled' | 'Outstanding' | 'No Charges Assigned'): {
  backgroundColor: string;
  color: string;
  borderColor: string;
} {
  switch (statusLabel) {
    case 'Settled':
      return {
        backgroundColor: '#e8f5e9',
        color: '#1b5e20',
        borderColor: '#a5d6a7',
      };
    case 'Outstanding':
      return {
        backgroundColor: '#fff3e0',
        color: '#c62828',
        borderColor: '#ffcdd2',
      };
    case 'No Charges Assigned':
    default:
      return {
        backgroundColor: 'var(--color-roles-surface-container, #f5f5f5)',
        color: 'var(--color-roles-on-surface-variant, #616161)',
        borderColor: 'var(--color-roles-outline-variant, #e0e0e0)',
      };
  }
}

export function StudentDetailsModal({ student, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  // Close on Escape key press & prevent background scrolling
  useEffect(() => {
    if (!student) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [student, onClose]);

  if (!student) return null;

  const handleCopy = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(student.studentNumber).catch(() => {});
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const statusStyle = getStatusBadgeStyle(student.status);
  const feeStyle = getFeeBadgeStyle(student.feeStatusLabel);

  const registeredDateStr = student.createdAt
    ? new Date(student.createdAt).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '—';

  const lastCheckinStr = student.lastCheckinDate
    ? new Date(student.lastCheckinDate).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : 'None recorded';

  const lastPaymentStr = student.lastPaymentDate
    ? new Date(student.lastPaymentDate).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : 'None';

  const attendanceTotal = student.attendanceTotalCount || 0;
  const attendancePresent = student.attendancePresentCount || 0;
  const attendanceRate =
    attendanceTotal > 0
      ? `${Math.round((attendancePresent / attendanceTotal) * 100)}%`
      : 'No sessions';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="student-details-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.15s ease-out',
      }}
    >
      <div
        ref={modalRef}
        style={{
          backgroundColor: 'var(--color-roles-surface, #ffffff)',
          color: 'var(--color-roles-on-surface, #1e293b)',
          borderRadius: '16px',
          border: '1px solid var(--color-roles-outline-color, #e2e8f0)',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
          width: '100%',
          maxWidth: '580px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          outline: 'none',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px 16px',
            borderBottom: '1px solid var(--color-roles-outline-variant, #f1f5f9)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          {/* Top Row: Identifier pill, status badge, and close button */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
            }}
          >
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  fontFamily: 'monospace',
                  fontSize: '13px',
                  fontWeight: 700,
                  color: 'var(--color-roles-primary, #0f172a)',
                  backgroundColor: 'var(--color-roles-surface-container, #f8fafc)',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  border: '1px solid var(--color-roles-outline-variant, #e2e8f0)',
                  letterSpacing: '0.04em',
                }}
              >
                {student.studentNumber}
              </span>
              <button
                type="button"
                onClick={handleCopy}
                title="Copy student number"
                aria-label="Copy student number"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '11px',
                  color: copied ? '#2e7d32' : 'var(--color-roles-on-surface-variant, #64748b)',
                  fontWeight: 600,
                  padding: '2px 4px',
                }}
              >
                {copied ? '✓ Copied' : 'Copy'}
              </button>
              <span
                style={{
                  display: 'inline-block',
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '3px 8px',
                  borderRadius: '12px',
                  backgroundColor: statusStyle.backgroundColor,
                  color: statusStyle.color,
                  border: `1px solid ${statusStyle.borderColor}`,
                }}
              >
                {student.status}
              </span>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close modal"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '18px',
                lineHeight: 1,
                color: 'var(--color-roles-on-surface-variant, #64748b)',
                padding: '6px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ✕
            </button>
          </div>

          {/* Full Name & Class Subtitle */}
          <div>
            <h2
              id="student-details-title"
              style={{
                fontSize: '20px',
                fontWeight: 700,
                color: 'var(--color-roles-on-surface, #0f172a)',
                margin: '2px 0 0',
                letterSpacing: '-0.01em',
              }}
            >
              {student.name}
            </h2>
            <p
              style={{
                fontSize: '13px',
                color: 'var(--color-roles-on-surface-variant, #64748b)',
                margin: '3px 0 0',
              }}
            >
              {student.intendedClass} &bull; Session {student.sessionYear}
            </p>
          </div>
        </div>

        {/* Scrollable Modal Body */}
        <div
          style={{
            padding: '20px 24px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }}
        >
          {/* Quick Metrics 3-Card Strip */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '12px',
            }}
          >
            {/* 1. Fees Status */}
            <div
              style={{
                padding: '12px 14px',
                backgroundColor: 'var(--color-roles-surface-container, #f8fafc)',
                borderRadius: '10px',
                border: '1px solid var(--color-roles-outline-variant, #e2e8f0)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '6px',
              }}
            >
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--color-roles-on-surface-variant, #64748b)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                Fees Balance
              </div>
              <div
                style={{
                  fontSize: '16px',
                  fontWeight: 700,
                  color: 'var(--color-roles-on-surface, #0f172a)',
                }}
              >
                {student.outstandingBalance ?? '₦0.00'}
              </div>
              <div>
                <span
                  style={{
                    display: 'inline-block',
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    backgroundColor: feeStyle.backgroundColor,
                    color: feeStyle.color,
                    border: `1px solid ${feeStyle.borderColor}`,
                  }}
                >
                  {student.feeStatusLabel ?? 'No Charges'}
                </span>
              </div>
            </div>

            {/* 2. Gate Check-ins */}
            <div
              style={{
                padding: '12px 14px',
                backgroundColor: 'var(--color-roles-surface-container, #f8fafc)',
                borderRadius: '10px',
                border: '1px solid var(--color-roles-outline-variant, #e2e8f0)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '6px',
              }}
            >
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--color-roles-on-surface-variant, #64748b)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                Gate Check-ins
              </div>
              <div
                style={{
                  fontSize: '16px',
                  fontWeight: 700,
                  color: 'var(--color-roles-on-surface, #0f172a)',
                }}
              >
                {student.arrivalCheckinsCount ?? 0} drop-off{student.arrivalCheckinsCount !== 1 ? 's' : ''}
              </div>
              <div
                style={{
                  fontSize: '11px',
                  color: 'var(--color-roles-on-surface-variant, #64748b)',
                }}
              >
                Last: {lastCheckinStr}
              </div>
            </div>

            {/* 3. Class Attendance */}
            <div
              style={{
                padding: '12px 14px',
                backgroundColor: 'var(--color-roles-surface-container, #f8fafc)',
                borderRadius: '10px',
                border: '1px solid var(--color-roles-outline-variant, #e2e8f0)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '6px',
              }}
            >
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--color-roles-on-surface-variant, #64748b)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                Classroom Roll
              </div>
              <div
                style={{
                  fontSize: '16px',
                  fontWeight: 700,
                  color: 'var(--color-roles-on-surface, #0f172a)',
                }}
              >
                {attendancePresent} / {attendanceTotal}
              </div>
              <div
                style={{
                  fontSize: '11px',
                  color: 'var(--color-roles-on-surface-variant, #64748b)',
                }}
              >
                Rate: {attendanceRate}
              </div>
            </div>
          </div>

          {/* Section: Fees & Ledger Details */}
          <div
            style={{
              padding: '16px',
              borderRadius: '10px',
              border: '1px solid var(--color-roles-outline-variant, #e2e8f0)',
              backgroundColor: 'var(--color-roles-surface, #ffffff)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <h3
                style={{
                  fontSize: '13px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: 'var(--color-roles-on-surface-variant, #64748b)',
                  margin: 0,
                }}
              >
                Fee Ledger Breakdown
              </h3>
              <Link
                href="/payments"
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--color-roles-primary, #0284c7)',
                  textDecoration: 'none',
                }}
              >
                Manage Fees &rarr;
              </Link>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                gap: '8px',
                fontSize: '12px',
              }}
            >
              <div>
                <span style={{ color: 'var(--color-roles-on-surface-variant, #64748b)' }}>
                  Total Charges:
                </span>
                <div style={{ fontWeight: 600, marginTop: '1px' }}>
                  {student.totalCharges ?? '₦0.00'}
                </div>
              </div>
              <div>
                <span style={{ color: 'var(--color-roles-on-surface-variant, #64748b)' }}>
                  Total Paid:
                </span>
                <div style={{ fontWeight: 600, marginTop: '1px' }}>
                  {student.totalPaid ?? '₦0.00'}
                </div>
              </div>
              <div>
                <span style={{ color: 'var(--color-roles-on-surface-variant, #64748b)' }}>
                  Last Payment:
                </span>
                <div style={{ fontWeight: 600, marginTop: '1px' }}>
                  {lastPaymentStr}
                </div>
              </div>
            </div>
          </div>

          {/* Section: Linked Guardians */}
          <div
            style={{
              padding: '16px',
              borderRadius: '10px',
              border: '1px solid var(--color-roles-outline-variant, #e2e8f0)',
              backgroundColor: 'var(--color-roles-surface, #ffffff)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <h3
                style={{
                  fontSize: '13px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: 'var(--color-roles-on-surface-variant, #64748b)',
                  margin: 0,
                }}
              >
                Linked Guardians &amp; Contacts
              </h3>
              <Link
                href="/guardian-links"
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--color-roles-primary, #0284c7)',
                  textDecoration: 'none',
                }}
              >
                Review Links &rarr;
              </Link>
            </div>

            {student.guardians && student.guardians.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {student.guardians.map((g) => (
                  <div
                    key={g.id}
                    style={{
                      padding: '10px 12px',
                      backgroundColor: 'var(--color-roles-surface-container, #f8fafc)',
                      borderRadius: '8px',
                      border: '1px solid var(--color-roles-outline-variant, #e2e8f0)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                      fontSize: '12px',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--color-roles-on-surface)' }}>
                        {g.name}
                      </div>
                      <div style={{ color: 'var(--color-roles-on-surface-variant, #64748b)', marginTop: '1px' }}>
                        {g.email}
                      </div>
                    </div>
                    <div>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 600,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: g.isVerified ? '#e8f5e9' : '#fff3e0',
                          color: g.isVerified ? '#1b5e20' : '#e65100',
                          border: `1px solid ${g.isVerified ? '#a5d6a7' : '#ffcc80'}`,
                        }}
                      >
                        {g.isVerified ? '✓ Verified' : 'Unverified'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div
                style={{
                  fontSize: '12px',
                  color: 'var(--color-roles-on-surface-variant, #64748b)',
                  backgroundColor: 'var(--color-roles-surface-container, #f8fafc)',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px dashed var(--color-roles-outline-variant, #cbd5e1)',
                }}
              >
                {student.guardianName ? (
                  <div>
                    <strong>Prospective Guardian:</strong> {student.guardianName}
                    {student.guardianPhone && ` • Phone: ${student.guardianPhone}`}
                    {student.guardianEmail && ` • Email: ${student.guardianEmail}`}
                  </div>
                ) : (
                  'No verified guardian linked to this student yet.'
                )}
                {student.pendingLinkCount && student.pendingLinkCount > 0 ? (
                  <div
                    style={{
                      marginTop: '6px',
                      color: '#e65100',
                      fontWeight: 600,
                    }}
                  >
                    ⚠ {student.pendingLinkCount} link request awaiting staff approval.
                  </div>
                ) : null}
              </div>
            )}
          </div>

          {/* Section: Academic Intake & Records Profile */}
          <div
            style={{
              padding: '16px',
              borderRadius: '10px',
              border: '1px solid var(--color-roles-outline-variant, #e2e8f0)',
              backgroundColor: 'var(--color-roles-surface, #ffffff)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <h3
              style={{
                fontSize: '13px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: 'var(--color-roles-on-surface-variant, #64748b)',
                margin: 0,
              }}
            >
              Academic Profile &amp; Registration
            </h3>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                gap: '8px',
                fontSize: '12px',
              }}
            >
              <div>
                <span style={{ color: 'var(--color-roles-on-surface-variant, #64748b)' }}>
                  Date Registered:
                </span>
                <div style={{ fontWeight: 600, marginTop: '1px' }}>
                  {registeredDateStr}
                </div>
              </div>
              {student.registeredByName && (
                <div>
                  <span style={{ color: 'var(--color-roles-on-surface-variant, #64748b)' }}>
                    Intake Staff:
                  </span>
                  <div style={{ fontWeight: 600, marginTop: '1px' }}>
                    {student.registeredByName}
                  </div>
                </div>
              )}
              <div>
                <span style={{ color: 'var(--color-roles-on-surface-variant, #64748b)' }}>
                  Current Status:
                </span>
                <div style={{ fontWeight: 600, marginTop: '1px' }}>
                  {student.status}
                </div>
              </div>
            </div>

            {student.notes && (
              <div
                style={{
                  marginTop: '4px',
                  padding: '8px 10px',
                  backgroundColor: 'var(--color-roles-surface-container, #f8fafc)',
                  borderRadius: '6px',
                  fontSize: '12px',
                  color: 'var(--color-roles-on-surface, #334155)',
                }}
              >
                <span style={{ fontWeight: 600, color: 'var(--color-roles-on-surface-variant)' }}>
                  Intake Notes:{' '}
                </span>
                {student.notes}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid var(--color-roles-outline-variant, #f1f5f9)',
            backgroundColor: 'var(--color-roles-surface-container, #f8fafc)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <span
            style={{
              fontSize: '11px',
              color: 'var(--color-roles-on-surface-variant, #64748b)',
            }}
          >
            Press <kbd style={{ padding: '2px 4px', backgroundColor: '#e2e8f0', borderRadius: '4px' }}>Esc</kbd> to close
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 18px',
              backgroundColor: 'var(--color-roles-surface, #ffffff)',
              color: 'var(--color-roles-on-surface, #1e293b)',
              border: '1px solid var(--color-roles-outline-color, #cbd5e1)',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

