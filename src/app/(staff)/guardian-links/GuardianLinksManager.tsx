'use client';

import React, { useState, useTransition } from 'react';
import type { StudentLinkRequestRecord } from '@/lib/auth';
import {
  approveStudentLinkAction,
  rejectStudentLinkAction,
  removeGuardianLinkAction,
} from './actions';

interface ActiveLinkItem {
  id: string;
  parentId: string;
  parentName: string;
  parentEmail: string;
  studentId: string;
  studentNumber: string;
  studentName: string;
  className: string;
  createdAt: Date | string;
}

interface Props {
  initialRequests: StudentLinkRequestRecord[];
  initialActiveLinks: ActiveLinkItem[];
  staffRole: string;
}

export function GuardianLinksManager({
  initialRequests,
  initialActiveLinks,
  staffRole,
}: Props) {
  const [activeTab, setActiveTab] = useState<'pending' | 'active' | 'history'>('pending');
  const [requests, setRequests] = useState<StudentLinkRequestRecord[]>(initialRequests);
  const [activeLinks, setActiveLinks] = useState<ActiveLinkItem[]>(initialActiveLinks);

  const [isPending, startTransition] = useTransition();
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Reject modal state
  const [rejectingRequestId, setRejectingRequestId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Remove confirmation state
  const [removingLinkId, setRemovingLinkId] = useState<string | null>(null);

  const pendingRequests = requests.filter(r => r.status === 'PENDING');
  const historyRequests = requests.filter(r => r.status !== 'PENDING');

  const handleApprove = (requestId: string) => {
    setActionMessage(null);
    startTransition(async () => {
      const res = await approveStudentLinkAction(requestId);
      if (res.success) {
        setActionMessage({ type: 'success', text: 'Student link approved successfully.' });
        setRequests(prev =>
          prev.map(r => (r.id === requestId ? { ...r, status: 'APPROVED', reviewedAt: new Date() } : r))
        );
      } else {
        setActionMessage({ type: 'error', text: res.error || 'Failed to approve request.' });
      }
    });
  };

  const handleRejectSubmit = () => {
    if (!rejectingRequestId) return;
    setActionMessage(null);
    const reqId = rejectingRequestId;
    const reason = rejectionReason;

    startTransition(async () => {
      const res = await rejectStudentLinkAction(reqId, reason);
      if (res.success) {
        setActionMessage({ type: 'success', text: 'Student link request rejected.' });
        setRequests(prev =>
          prev.map(r =>
            r.id === reqId
              ? { ...r, status: 'REJECTED', reviewedAt: new Date(), rejectionReason: reason || null }
              : r
          )
        );
        setRejectingRequestId(null);
        setRejectionReason('');
      } else {
        setActionMessage({ type: 'error', text: res.error || 'Failed to reject request.' });
      }
    });
  };

  const handleRemoveConfirm = () => {
    if (!removingLinkId) return;
    setActionMessage(null);
    const linkId = removingLinkId;

    startTransition(async () => {
      const res = await removeGuardianLinkAction(linkId);
      if (res.success) {
        setActionMessage({ type: 'success', text: 'Guardian link removed successfully.' });
        setActiveLinks(prev => prev.filter(l => l.id !== linkId));
        setRemovingLinkId(null);
      } else {
        setActionMessage({ type: 'error', text: res.error || 'Failed to remove link.' });
      }
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Feedback Alert */}
      {actionMessage && (
        <div
          role="alert"
          aria-live="polite"
          style={{
            padding: '12px 16px',
            borderRadius: '6px',
            fontSize: 'var(--typography-body-medium-fontsize)',
            backgroundColor:
              actionMessage.type === 'success' ? 'rgba(46, 125, 50, 0.1)' : 'rgba(211, 47, 47, 0.1)',
            color:
              actionMessage.type === 'success'
                ? 'var(--color-roles-primary)'
                : 'var(--color-roles-error)',
            border: `1px solid ${actionMessage.type === 'success' ? 'var(--color-roles-primary)' : 'var(--color-roles-error)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>{actionMessage.text}</span>
          <button
            type="button"
            onClick={() => setActionMessage(null)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 700,
              color: 'inherit',
            }}
          >
            &times;
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <nav
        aria-label="Guardian links sections"
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid var(--color-roles-outline-variant)',
          paddingBottom: '8px',
        }}
      >
        <button
          type="button"
          id="tab-pending-requests"
          onClick={() => setActiveTab('pending')}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            border: 'none',
            fontFamily: 'var(--typography-label-large-fontfamily)',
            fontSize: 'var(--typography-label-large-fontsize)',
            fontWeight: activeTab === 'pending' ? 700 : 500,
            backgroundColor:
              activeTab === 'pending'
                ? 'var(--color-roles-primary)'
                : 'var(--color-roles-surface-variant)',
            color:
              activeTab === 'pending'
                ? 'var(--color-roles-on-primary)'
                : 'var(--color-roles-on-surface-variant)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          Pending Requests
          {pendingRequests.length > 0 && (
            <span
              style={{
                backgroundColor: activeTab === 'pending' ? '#ffffff' : 'var(--color-roles-primary)',
                color: activeTab === 'pending' ? 'var(--color-roles-primary)' : '#ffffff',
                borderRadius: '10px',
                padding: '2px 8px',
                fontSize: '12px',
                fontWeight: 700,
              }}
            >
              {pendingRequests.length}
            </span>
          )}
        </button>

        <button
          type="button"
          id="tab-active-links"
          onClick={() => setActiveTab('active')}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            border: 'none',
            fontFamily: 'var(--typography-label-large-fontfamily)',
            fontSize: 'var(--typography-label-large-fontsize)',
            fontWeight: activeTab === 'active' ? 700 : 500,
            backgroundColor:
              activeTab === 'active'
                ? 'var(--color-roles-primary)'
                : 'var(--color-roles-surface-variant)',
            color:
              activeTab === 'active'
                ? 'var(--color-roles-on-primary)'
                : 'var(--color-roles-on-surface-variant)',
            cursor: 'pointer',
          }}
        >
          Active Links ({activeLinks.length})
        </button>

        <button
          type="button"
          id="tab-history"
          onClick={() => setActiveTab('history')}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            border: 'none',
            fontFamily: 'var(--typography-label-large-fontfamily)',
            fontSize: 'var(--typography-label-large-fontsize)',
            fontWeight: activeTab === 'history' ? 700 : 500,
            backgroundColor:
              activeTab === 'history'
                ? 'var(--color-roles-primary)'
                : 'var(--color-roles-surface-variant)',
            color:
              activeTab === 'history'
                ? 'var(--color-roles-on-primary)'
                : 'var(--color-roles-on-surface-variant)',
            cursor: 'pointer',
          }}
        >
          Review History ({historyRequests.length})
        </button>
      </nav>

      {/* 1. Pending Requests Tab */}
      {activeTab === 'pending' && (
        <section aria-labelledby="tab-pending-requests">
          {pendingRequests.length === 0 ? (
            <div
              style={{
                backgroundColor: 'var(--color-roles-surface)',
                border: '1px solid var(--color-roles-outline-color)',
                padding: '32px',
                textAlign: 'center',
                borderRadius: '8px',
                color: 'var(--color-roles-on-surface-variant)',
              }}
            >
              <p style={{ margin: 0, fontWeight: 500 }}>No pending student link requests.</p>
              <span style={{ fontSize: '13px' }}>
                When parents submit their child&apos;s Student Number, requests will appear here for verification.
              </span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {pendingRequests.map(req => (
                <div
                  key={req.id}
                  style={{
                    backgroundColor: 'var(--color-roles-surface)',
                    border: '1px solid var(--color-roles-outline-color)',
                    borderRadius: '8px',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    boxShadow: 'var(--effect-soft-shadow)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      flexWrap: 'wrap',
                      gap: '8px',
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: '16px',
                          fontWeight: 700,
                          color: 'var(--color-roles-on-surface)',
                        }}
                      >
                        Student: {req.studentName}
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--color-roles-on-surface-variant)' }}>
                        Student Number: <strong>{req.studentNumber}</strong> &bull; Class: {req.studentClass}
                      </div>
                    </div>
                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: 600,
                        backgroundColor: 'rgba(230, 81, 0, 0.1)',
                        color: '#E65100',
                      }}
                    >
                      PENDING APPROVAL
                    </span>
                  </div>

                  <div
                    style={{
                      padding: '12px',
                      backgroundColor: 'var(--color-roles-background)',
                      borderRadius: '6px',
                      fontSize: '13px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                    }}
                  >
                    <div>
                      Requesting Guardian: <strong>{req.parentName || 'Parent'}</strong> ({req.parentEmail || 'Email on file'})
                    </div>
                    <div style={{ color: 'var(--color-roles-on-surface-variant)', fontSize: '12px' }}>
                      Requested: {new Date(req.createdAt).toLocaleString()}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '4px' }}>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => {
                        setRejectingRequestId(req.id);
                        setRejectionReason('');
                      }}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '6px',
                        border: '1px solid var(--color-roles-error)',
                        backgroundColor: 'transparent',
                        color: 'var(--color-roles-error)',
                        fontWeight: 600,
                        cursor: isPending ? 'not-allowed' : 'pointer',
                        fontSize: '13px',
                      }}
                    >
                      Reject Request...
                    </button>

                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleApprove(req.id)}
                      style={{
                        padding: '8px 20px',
                        borderRadius: '6px',
                        border: 'none',
                        backgroundColor: 'var(--color-roles-primary)',
                        color: 'var(--color-roles-on-primary)',
                        fontWeight: 600,
                        cursor: isPending ? 'not-allowed' : 'pointer',
                        fontSize: '13px',
                      }}
                    >
                      {isPending ? 'Processing...' : 'Approve Link'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* 2. Active Links Tab */}
      {activeTab === 'active' && (
        <section aria-labelledby="tab-active-links">
          {activeLinks.length === 0 ? (
            <div
              style={{
                backgroundColor: 'var(--color-roles-surface)',
                border: '1px solid var(--color-roles-outline-color)',
                padding: '32px',
                textAlign: 'center',
                borderRadius: '8px',
                color: 'var(--color-roles-on-surface-variant)',
              }}
            >
              <p style={{ margin: 0, fontWeight: 500 }}>No active guardian links found.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {activeLinks.map(link => (
                <div
                  key={link.id}
                  style={{
                    backgroundColor: 'var(--color-roles-surface)',
                    border: '1px solid var(--color-roles-outline-color)',
                    borderRadius: '8px',
                    padding: '16px 20px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '12px',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--color-roles-on-surface)' }}>
                      {link.studentName} ({link.studentNumber})
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--color-roles-on-surface-variant)' }}>
                      Guardian: {link.parentName} ({link.parentEmail}) &bull; Class: {link.className}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--color-roles-on-surface-variant)', marginTop: '2px' }}>
                      Linked on: {new Date(link.createdAt).toLocaleDateString()}
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => setRemovingLinkId(link.id)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '6px',
                      border: '1px solid var(--color-roles-error)',
                      backgroundColor: 'transparent',
                      color: 'var(--color-roles-error)',
                      fontWeight: 600,
                      cursor: isPending ? 'not-allowed' : 'pointer',
                      fontSize: '12px',
                    }}
                  >
                    Remove Link
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* 3. History Tab */}
      {activeTab === 'history' && (
        <section aria-labelledby="tab-history">
          {historyRequests.length === 0 ? (
            <div
              style={{
                backgroundColor: 'var(--color-roles-surface)',
                border: '1px solid var(--color-roles-outline-color)',
                padding: '32px',
                textAlign: 'center',
                borderRadius: '8px',
                color: 'var(--color-roles-on-surface-variant)',
              }}
            >
              <p style={{ margin: 0, fontWeight: 500 }}>No review history recorded yet.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {historyRequests.map(req => {
                const isApproved = req.status === 'APPROVED';
                return (
                  <div
                    key={req.id}
                    style={{
                      backgroundColor: 'var(--color-roles-surface)',
                      border: '1px solid var(--color-roles-outline-color)',
                      borderRadius: '8px',
                      padding: '16px 20px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, color: 'var(--color-roles-on-surface)' }}>
                        {req.studentName} ({req.studentNumber})
                      </span>
                      <span
                        style={{
                          padding: '3px 8px',
                          borderRadius: '10px',
                          fontSize: '11px',
                          fontWeight: 700,
                          backgroundColor: isApproved ? 'rgba(46, 125, 50, 0.1)' : 'rgba(211, 47, 47, 0.1)',
                          color: isApproved ? 'var(--color-roles-primary)' : 'var(--color-roles-error)',
                        }}
                      >
                        {req.status}
                      </span>
                    </div>

                    <div style={{ fontSize: '13px', color: 'var(--color-roles-on-surface-variant)' }}>
                      Guardian: {req.parentName || 'Parent'} &bull; Reviewed by:{' '}
                      {req.reviewerName || 'Staff Member'} on{' '}
                      {req.reviewedAt ? new Date(req.reviewedAt).toLocaleString() : 'N/A'}
                    </div>

                    {req.rejectionReason && (
                      <div
                        style={{
                          fontSize: '12px',
                          color: 'var(--color-roles-error)',
                          backgroundColor: 'rgba(211, 47, 47, 0.05)',
                          padding: '6px 10px',
                          borderRadius: '4px',
                        }}
                      >
                        Reason: {req.rejectionReason}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Reject Modal */}
      {rejectingRequestId && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reject-dialog-title"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--color-roles-surface)',
              borderRadius: '8px',
              padding: '24px',
              maxWidth: '480px',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
            }}
          >
            <h3 id="reject-dialog-title" style={{ margin: 0, color: 'var(--color-roles-on-surface)' }}>
              Reject Link Request
            </h3>
            <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-roles-on-surface-variant)' }}>
              Are you sure you want to reject this student link request? You may provide a reason for the parent.
            </p>

            <div>
              <label
                htmlFor="rejection-reason"
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 600,
                  marginBottom: '6px',
                  color: 'var(--color-roles-on-surface)',
                }}
              >
                Rejection Reason (Optional):
              </label>
              <textarea
                id="rejection-reason"
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                placeholder="e.g. Identity could not be verified, or student record mismatch."
                rows={3}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--color-roles-outline-color)',
                  backgroundColor: 'var(--color-roles-background)',
                  color: 'var(--color-roles-on-surface)',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setRejectingRequestId(null)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: '1px solid var(--color-roles-outline-color)',
                  backgroundColor: 'transparent',
                  color: 'var(--color-roles-on-surface)',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={handleRejectSubmit}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: 'var(--color-roles-error)',
                  color: '#ffffff',
                  fontWeight: 600,
                  cursor: isPending ? 'not-allowed' : 'pointer',
                }}
              >
                {isPending ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Confirmation Modal */}
      {removingLinkId && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="remove-dialog-title"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--color-roles-surface)',
              borderRadius: '8px',
              padding: '24px',
              maxWidth: '440px',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
            }}
          >
            <h3 id="remove-dialog-title" style={{ margin: 0, color: 'var(--color-roles-error)' }}>
              Remove Guardian Link
            </h3>
            <p style={{ margin: 0, fontSize: '14px', color: 'var(--color-roles-on-surface-variant)' }}>
              Are you sure you want to remove this link? The parent will immediately lose access to this child&apos;s
              records, attendance, and fee details.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setRemovingLinkId(null)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: '1px solid var(--color-roles-outline-color)',
                  backgroundColor: 'transparent',
                  color: 'var(--color-roles-on-surface)',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={handleRemoveConfirm}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: 'var(--color-roles-error)',
                  color: '#ffffff',
                  fontWeight: 600,
                  cursor: isPending ? 'not-allowed' : 'pointer',
                }}
              >
                {isPending ? 'Removing...' : 'Confirm Removal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
