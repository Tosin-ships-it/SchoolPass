'use client';

import React, { useState } from 'react';
import type { StudentLinkRequestRecord, ParentStudentLink } from '@/lib/auth';
import { determineRecordsLinkState } from '@/lib/auth/dashboard';

interface Props {
  initialRequests: StudentLinkRequestRecord[];
  initialActiveLinks: ParentStudentLink[];
}

export function StudentLinkSection({ initialRequests, initialActiveLinks }: Props) {
  const [studentNumber, setStudentNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [requests, setRequests] = useState<StudentLinkRequestRecord[]>(initialRequests);
  const [activeLinks, setActiveLinks] = useState<ParentStudentLink[]>(initialActiveLinks);

  const { formTitle, hasPending, pendingRequests } = determineRecordsLinkState(
    activeLinks.length,
    requests
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const trimmed = studentNumber.trim().toUpperCase();
    if (!trimmed) {
      setError('Please enter your child\'s Student Number.');
      document.getElementById('student-number-input')?.focus();
      return;
    }

    // Client-side guard against duplicate pending request
    const isAlreadyPending = pendingRequests.some(
      r => r.studentNumber.toUpperCase() === trimmed
    );
    if (isAlreadyPending) {
      setError('A link request for this student is already pending staff approval.');
      setTimeout(() => {
        document.getElementById('student-number-link-error')?.focus();
      }, 50);
      return;
    }

    // Client-side guard against duplicate active link
    const isAlreadyLinked = activeLinks.some(
      l => l.studentNumber && l.studentNumber.toUpperCase() === trimmed
    );
    if (isAlreadyLinked) {
      setError('You are already linked to this student.');
      setTimeout(() => {
        document.getElementById('student-number-link-error')?.focus();
      }, 50);
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/records/link-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentNumber: trimmed }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to submit link request.');
        setTimeout(() => {
          document.getElementById('student-number-link-error')?.focus();
        }, 50);
      } else {
        setSuccessMessage(
          `Request submitted for ${data.studentName || 'student'}. Awaiting school staff verification.`
        );
        setStudentNumber('');

        // Refresh requests list
        const refreshRes = await fetch('/api/records/link-requests');
        if (refreshRes.ok) {
          const refreshData = await refreshRes.json();
          if (refreshData.requests) setRequests(refreshData.requests);
          if (refreshData.activeLinks) setActiveLinks(refreshData.activeLinks);
        }
      }
    } catch {
      setError('Something went wrong. Please check your connection and try again.');
      setTimeout(() => {
        document.getElementById('student-number-link-error')?.focus();
      }, 50);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Active Linked Students Card */}
      {activeLinks.length > 0 && (
        <div
          style={{
            backgroundColor: 'var(--color-roles-surface)',
            border: '1px solid var(--color-roles-outline-color)',
            boxShadow: 'var(--effect-soft-shadow)',
            borderRadius: '8px',
            padding: '24px',
          }}
        >
          <h2
            style={{
              fontFamily: 'var(--typography-title-medium-fontfamily)',
              fontSize: 'var(--typography-title-medium-fontsize)',
              fontWeight: 700,
              color: 'var(--color-roles-on-surface)',
              margin: '0 0 12px 0',
            }}
          >
            Linked Children
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {activeLinks.map(link => (
              <div
                key={link.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 16px',
                  backgroundColor: 'var(--color-roles-background)',
                  borderRadius: '6px',
                  border: '1px solid var(--color-roles-outline-variant)',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--color-roles-on-surface)' }}>
                    {link.studentName}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--color-roles-on-surface-variant)' }}>
                    Student No: {link.studentNumber || 'Assigned'} &bull; Class: {link.className || 'Active'}
                  </div>
                </div>
                <span
                  style={{
                    padding: '3px 10px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    backgroundColor: 'rgba(46, 125, 50, 0.1)',
                    color: 'var(--color-roles-primary)',
                  }}
                >
                  Verified
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Submitted Requests Status displayed prominently */}
      {requests.length > 0 && (
        <div
          style={{
            backgroundColor: 'var(--color-roles-surface)',
            border: '1px solid var(--color-roles-outline-color)',
            boxShadow: 'var(--effect-soft-shadow)',
            borderRadius: '8px',
            padding: '24px',
          }}
        >
          <h2
            style={{
              fontFamily: 'var(--typography-title-medium-fontfamily)',
              fontSize: 'var(--typography-title-medium-fontsize)',
              fontWeight: 700,
              color: 'var(--color-roles-on-surface)',
              margin: '0 0 12px 0',
            }}
          >
            Your Link Requests
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {requests.map(req => {
              const isPending = req.status === 'PENDING';
              const isApproved = req.status === 'APPROVED';
              return (
                <div
                  key={req.id}
                  style={{
                    padding: '12px 16px',
                    borderRadius: '6px',
                    border: '1px solid var(--color-roles-outline-variant)',
                    backgroundColor: 'var(--color-roles-background)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, color: 'var(--color-roles-on-surface)' }}>
                      {req.studentName} ({req.studentNumber})
                    </span>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '10px',
                        fontSize: '11px',
                        fontWeight: 700,
                        backgroundColor: isPending
                          ? 'rgba(230, 81, 0, 0.1)'
                          : isApproved
                          ? 'rgba(46, 125, 50, 0.1)'
                          : 'rgba(211, 47, 47, 0.1)',
                        color: isPending ? '#E65100' : isApproved ? 'var(--color-roles-primary)' : 'var(--color-roles-error)',
                      }}
                    >
                      {req.status}
                    </span>
                  </div>

                  <div style={{ fontSize: '12px', color: 'var(--color-roles-on-surface-variant)' }}>
                    Class: {req.studentClass} &bull; Requested on {new Date(req.createdAt).toLocaleDateString()}
                  </div>

                  {isPending && (
                    <div
                      style={{
                        fontSize: '12px',
                        color: '#E65100',
                        fontWeight: 500,
                        marginTop: '2px',
                      }}
                    >
                      Awaiting school staff verification. Access to records will be granted once approved.
                    </div>
                  )}

                  {req.rejectionReason && (
                    <div
                      style={{
                        fontSize: '12px',
                        color: 'var(--color-roles-error)',
                        marginTop: '4px',
                      }}
                    >
                      Note: {req.rejectionReason}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Link Student by Number Form */}
      <div
        style={{
          backgroundColor: 'var(--color-roles-surface)',
          border: '1px solid var(--color-roles-outline-color)',
          boxShadow: 'var(--effect-soft-shadow)',
          borderRadius: '8px',
          padding: '24px',
        }}
      >
        <h2
          style={{
            fontFamily: 'var(--typography-title-medium-fontfamily)',
            fontSize: 'var(--typography-title-medium-fontsize)',
            fontWeight: 700,
            color: 'var(--color-roles-on-surface)',
            margin: '0 0 8px 0',
          }}
        >
          {formTitle}
        </h2>
        <p
          style={{
            fontFamily: 'var(--typography-body-medium-fontfamily)',
            fontSize: 'var(--typography-body-medium-fontsize)',
            color: 'var(--color-roles-on-surface-variant)',
            margin: '0 0 16px 0',
          }}
        >
          {hasPending ? (
            <>
              You currently have a request pending staff verification. If you have another child enrolled at the
              school, enter their Student Number below. All linking requests are verified and approved by school staff.
            </>
          ) : activeLinks.length > 0 ? (
            <>
              Enter the unique Student Number issued by the school for another child (for example,{' '}
              <code>SP-2026-0002</code>). For security, all linking requests are verified and approved by school staff.
            </>
          ) : (
            <>
              Enter the unique Student Number issued by the school (for example, <code>SP-2026-0001</code>). For security,
              all linking requests are verified and approved by school staff.
            </>
          )}
        </p>

        {error && (
          <div
            id="student-number-link-error"
            role="alert"
            aria-live="assertive"
            tabIndex={-1}
            style={{
              padding: '12px 16px',
              borderRadius: '6px',
              fontSize: '14px',
              backgroundColor: 'rgba(211, 47, 47, 0.1)',
              color: 'var(--color-roles-error)',
              border: '1px solid var(--color-roles-error)',
              marginBottom: '16px',
            }}
          >
            {error}
          </div>
        )}

        {successMessage && (
          <div
            role="status"
            aria-live="polite"
            style={{
              padding: '12px 16px',
              borderRadius: '6px',
              fontSize: '14px',
              backgroundColor: 'rgba(46, 125, 50, 0.1)',
              color: 'var(--color-roles-primary)',
              border: '1px solid var(--color-roles-primary)',
              marginBottom: '16px',
            }}
          >
            {successMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label
              htmlFor="student-number-input"
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--color-roles-on-surface)',
                marginBottom: '6px',
              }}
            >
              Student Number{' '}
              <span aria-hidden="true" style={{ color: 'var(--color-roles-error)', fontWeight: 'bold' }}>
                *
              </span>
            </label>
            <input
              id="student-number-input"
              type="text"
              value={studentNumber}
              onChange={e => setStudentNumber(e.target.value)}
              placeholder="e.g. SP-2026-0001"
              required
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'student-number-link-error' : undefined}
              autoCapitalize="characters"
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '6px',
                border: error
                  ? '1px solid var(--color-roles-error)'
                  : '1px solid var(--color-roles-outline-color)',
                backgroundColor: 'var(--color-roles-background)',
                color: 'var(--color-roles-on-surface)',
                fontSize: '14px',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            aria-busy={loading ? 'true' : undefined}
            style={{
              padding: '10px 20px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: 'var(--color-roles-primary)',
              color: 'var(--color-roles-on-primary)',
              fontSize: '14px',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              alignSelf: 'flex-start',
            }}
          >
            {loading ? 'Submitting Request...' : 'Submit Link Request'}
          </button>
        </form>
      </div>
    </div>
  );
}
