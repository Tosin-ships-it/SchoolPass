'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AdjustmentModal } from './AdjustmentModal';
import { OfflinePaymentModal } from './OfflinePaymentModal';
import { FeeTemplateManager } from './FeeTemplateManager';
import {
  OFFLINE_PAYMENT_METHOD_LABELS,
} from '@/lib/payments/offline-options';
import type {
  FeeDirectoryHistoryItem,
  FeeDirectoryStudent,
  PaymentsDirectoryStudent,
} from '@/lib/payments/offline';
import type {
  FeeAssignmentStudentPreview,
  FeeTemplate,
} from '@/lib/payments/templates';

interface PaymentsManagerProps {
  mode: 'admin' | 'frontdesk';
  initialStudents: PaymentsDirectoryStudent[];
  directoryError?: string;
  initialTemplates: FeeTemplate[];
  assignmentStudents: FeeAssignmentStudentPreview[];
  classes: string[];
  sessions: string[];
  storageError?: string;
  dataError?: string;
}

type PaymentsTab = 'directory' | 'templates';

function formatMoney(amount?: string | null): string {
  const value = Number(amount ?? 0);
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

function historyTypeLabel(item: FeeDirectoryHistoryItem): string {
  if (item.type === 'OFFLINE_PAYMENT') return 'Offline payment';
  if (item.type === 'ADJUSTMENT') return 'Adjustment';
  return 'Charge';
}

function historyDetail(item: FeeDirectoryHistoryItem): string {
  if (item.type === 'OFFLINE_PAYMENT' && item.method) {
    return `${OFFLINE_PAYMENT_METHOD_LABELS[item.method]} \u00b7 Ref: ${item.reference ?? '-'}`;
  }
  if (item.type === 'ADJUSTMENT' && item.adjustmentDirection) {
    return item.adjustmentDirection === 'credit' ? 'Credit or waiver' : 'Debit';
  }
  return 'Fee charge';
}

function isDetailedStudent(student: PaymentsDirectoryStudent): student is FeeDirectoryStudent {
  return 'history' in student;
}

function SummaryTile({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div
      style={{
        padding: '14px',
        borderRadius: '8px',
        border: '1px solid var(--color-roles-outline-color)',
        backgroundColor: 'var(--color-roles-surface)',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
      }}
    >
      <span style={{ fontSize: '12px', color: 'var(--color-roles-on-surface-variant)' }}>
        {label}
      </span>
      <span
        style={{
          fontSize: emphasis ? '22px' : '17px',
          fontWeight: 700,
          color: emphasis ? 'var(--color-roles-primary)' : 'var(--color-roles-on-surface)',
        }}
      >
        {value}
      </span>
    </div>
  );
}

export function PaymentsManager({
  mode,
  initialStudents,
  directoryError,
  initialTemplates,
  assignmentStudents,
  classes,
  sessions,
  storageError,
  dataError,
}: PaymentsManagerProps) {
  const router = useRouter();
  const isAdmin = mode === 'admin';
  const [tab, setTab] = useState<PaymentsTab>('directory');
  const [students, setStudents] = useState(initialStudents);
  const [selectedId, setSelectedId] = useState<string | null>(initialStudents[0]?.id ?? null);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );
  const [paymentStudent, setPaymentStudent] = useState<FeeDirectoryStudent | null>(null);
  const [adjustmentStudent, setAdjustmentStudent] = useState<FeeDirectoryStudent | null>(null);

  useEffect(() => {
    setStudents(initialStudents);
    setSelectedId((current) => {
      if (current && initialStudents.some((student) => student.id === current)) return current;
      return initialStudents[0]?.id ?? null;
    });
  }, [initialStudents]);

  const filteredStudents = students.filter((student) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return (
      student.name.toLowerCase().includes(query) ||
      student.studentNumber.toLowerCase().includes(query) ||
      student.className.toLowerCase().includes(query)
    );
  });

  const selected = students.find((student) => student.id === selectedId) ?? null;
  const selectedDetail = selected && isDetailedStudent(selected) ? selected : null;

  function handleRecorded(text: string) {
    setPaymentStudent(null);
    setAdjustmentStudent(null);
    setMessage({ type: 'success', text });
    router.refresh();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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

      {directoryError && (
        <div
          role="alert"
          style={{
            padding: '14px 16px',
            border: '1px solid var(--color-roles-error)',
            backgroundColor: 'rgba(179, 38, 30, 0.08)',
            color: 'var(--color-roles-error)',
            borderRadius: '8px',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <span>{directoryError}</span>
          {isAdmin && (
            <Link
              href="/settings"
              style={{
                color: 'var(--color-roles-primary)',
                fontWeight: 700,
                textDecoration: 'underline',
              }}
            >
              Configure in Settings &rarr;
            </Link>
          )}
        </div>
      )}

      {mode === 'frontdesk' && (
        <div
          style={{
            padding: '14px 16px',
            border: '1px solid var(--color-roles-outline-color)',
            backgroundColor: 'var(--color-roles-surface)',
            borderRadius: '8px',
            fontSize: '13px',
            color: 'var(--color-roles-on-surface-variant)',
            lineHeight: 1.5,
          }}
        >
          Read-only student balance lookup. Offline payments and fee adjustments can only be
          recorded by an Admin.
        </div>
      )}

      {isAdmin && (
        <div role="tablist" aria-label="Fee management sections" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'directory'}
            onClick={() => setTab('directory')}
            style={{
              padding: '9px 16px',
              borderRadius: '6px',
              border: '1px solid var(--color-roles-outline-color)',
              backgroundColor:
                tab === 'directory' ? 'var(--color-roles-primary)' : 'transparent',
              color:
                tab === 'directory'
                  ? 'var(--color-roles-on-primary)'
                  : 'var(--color-roles-on-surface)',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Student Directory
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'templates'}
            onClick={() => setTab('templates')}
            style={{
              padding: '9px 16px',
              borderRadius: '6px',
              border: '1px solid var(--color-roles-outline-color)',
              backgroundColor:
                tab === 'templates' ? 'var(--color-roles-primary)' : 'transparent',
              color:
                tab === 'templates'
                  ? 'var(--color-roles-on-primary)'
                  : 'var(--color-roles-on-surface)',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Fee Templates &amp; Charges
          </button>
        </div>
      )}

      {tab === 'templates' && isAdmin ? (
        <FeeTemplateManager
          initialTemplates={initialTemplates}
          students={assignmentStudents}
          classes={classes}
          sessions={sessions}
          storageError={storageError}
          dataError={dataError}
        />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '16px',
            alignItems: 'start',
          }}
        >
          <section
            aria-labelledby="fee-directory-title"
            style={{
              backgroundColor: 'var(--color-roles-surface)',
              border: '1px solid var(--color-roles-outline-color)',
              borderRadius: '8px',
              boxShadow: 'var(--effect-soft-shadow)',
              padding: '18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div>
              <h2
                id="fee-directory-title"
                style={{ margin: '0 0 4px 0', fontSize: '18px', color: 'var(--color-roles-on-surface)' }}
              >
                Student Directory
              </h2>
              <p
                style={{
                  margin: 0,
                  fontSize: '12px',
                  color: 'var(--color-roles-on-surface-variant)',
                  lineHeight: 1.5,
                }}
              >
                Active students only. Search by name or student number.
              </p>
            </div>

            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search student name or number"
              aria-label="Search students"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '10px 12px',
                borderRadius: '6px',
                border: '1px solid var(--color-roles-outline-color)',
                backgroundColor: 'var(--color-roles-surface)',
                color: 'var(--color-roles-on-surface)',
                fontSize: '14px',
              }}
            />

            <div style={{ fontSize: '12px', color: 'var(--color-roles-on-surface-variant)' }}>
              {filteredStudents.length} of {students.length} student
              {students.length === 1 ? '' : 's'}
            </div>

            {filteredStudents.length === 0 ? (
              <div
                style={{
                  padding: '24px',
                  borderRadius: '6px',
                  border: '1px dashed var(--color-roles-outline-color)',
                  color: 'var(--color-roles-on-surface-variant)',
                  fontSize: '13px',
                  textAlign: 'center',
                }}
              >
                {students.length === 0
                  ? 'No active students are available.'
                  : 'No student matches this search.'}
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  maxHeight: '620px',
                  overflowY: 'auto',
                }}
              >
                {filteredStudents.map((student) => {
                  const isSelected = student.id === selectedId;
                  const outstandingBalance = isDetailedStudent(student)
                    ? student.summary?.amountDue ?? null
                    : student.outstandingBalance;
                  return (
                    <button
                      key={student.id}
                      type="button"
                      onClick={() => setSelectedId(student.id)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '12px',
                        borderRadius: '6px',
                        border: `1px solid ${
                          isSelected
                            ? 'var(--color-roles-primary)'
                            : 'var(--color-roles-outline-color)'
                        }`,
                        backgroundColor: isSelected
                          ? 'rgba(46, 125, 50, 0.08)'
                          : 'transparent',
                        color: 'var(--color-roles-on-surface)',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '10px',
                      }}
                    >
                      <span style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 700 }}>{student.name}</span>
                        <span
                          style={{
                            fontSize: '12px',
                            color: 'var(--color-roles-on-surface-variant)',
                          }}
                        >
                          {student.studentNumber} &middot; {student.className}
                        </span>
                      </span>
                      <span
                        style={{
                          fontSize: '13px',
                          fontWeight: 700,
                          color: outstandingBalance
                            ? 'var(--color-roles-primary)'
                            : 'var(--color-roles-on-surface-variant)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {outstandingBalance
                          ? formatMoney(outstandingBalance)
                          : 'Unavailable'}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {selected ? (
            <section
              aria-labelledby="fee-student-title"
              style={{
                backgroundColor: 'var(--color-roles-surface)',
                border: '1px solid var(--color-roles-outline-color)',
                borderRadius: '8px',
                boxShadow: 'var(--effect-soft-shadow)',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '18px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: '12px',
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <h2
                    id="fee-student-title"
                    style={{
                      margin: '0 0 4px 0',
                      fontSize: '20px',
                      color: 'var(--color-roles-on-surface)',
                    }}
                  >
                    {selected.name}
                  </h2>
                  <p
                    style={{
                      margin: 0,
                      fontSize: '13px',
                      color: 'var(--color-roles-on-surface-variant)',
                    }}
                  >
                    {selected.studentNumber} &middot; {selected.className}
                  </p>
                </div>

                {isAdmin && selectedDetail && (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => setPaymentStudent(selectedDetail)}
                      disabled={!selectedDetail.summary}
                      style={{
                        padding: '9px 14px',
                        borderRadius: '6px',
                        border: 'none',
                        backgroundColor: 'var(--color-roles-primary)',
                        color: 'var(--color-roles-on-primary)',
                        fontWeight: 700,
                        cursor: selectedDetail.summary ? 'pointer' : 'not-allowed',
                        opacity: selectedDetail.summary ? 1 : 0.55,
                      }}
                    >
                      Record Offline Payment
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdjustmentStudent(selectedDetail)}
                      disabled={!selectedDetail.summary}
                      style={{
                        padding: '9px 14px',
                        borderRadius: '6px',
                        border: '1px solid var(--color-roles-outline-color)',
                        backgroundColor: 'transparent',
                        color: 'var(--color-roles-on-surface)',
                        fontWeight: 700,
                        cursor: selectedDetail.summary ? 'pointer' : 'not-allowed',
                        opacity: selectedDetail.summary ? 1 : 0.55,
                      }}
                    >
                      Record Adjustment
                    </button>
                  </div>
                )}
              </div>

              {selectedDetail ? (
                <>
                  {selectedDetail.summary ? (
                <>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                      gap: '10px',
                    }}
                  >
                    <SummaryTile
                      label="Outstanding balance"
                      value={formatMoney(selectedDetail.summary.amountDue)}
                      emphasis
                    />
                    <SummaryTile
                      label="Current term balance"
                      value={formatMoney(selectedDetail.summary.currentTermBalance)}
                    />
                    <SummaryTile
                      label="Earlier term arrears"
                      value={formatMoney(selectedDetail.summary.earlierTermsArrears)}
                    />
                    <SummaryTile
                      label="Credit balance"
                      value={formatMoney(selectedDetail.summary.creditBalance)}
                    />
                    <SummaryTile
                      label="Total charges"
                      value={formatMoney(selectedDetail.summary.totalCharges)}
                    />
                    <SummaryTile
                      label="Total paid"
                      value={formatMoney(selectedDetail.summary.totalPaid)}
                    />
                  </div>

                  <div>
                    <h3 style={{ margin: '0 0 8px 0', fontSize: '15px' }}>
                      Term Breakdown
                    </h3>
                    {selectedDetail.summary.termBreakdown.length === 0 ? (
                      <p
                        style={{
                          margin: 0,
                          fontSize: '13px',
                          color: 'var(--color-roles-on-surface-variant)',
                        }}
                      >
                        No started term charges are recorded for this student.
                      </p>
                    ) : (
                      <div style={{ overflowX: 'auto' }}>
                        <table
                          style={{
                            width: '100%',
                            borderCollapse: 'collapse',
                            fontSize: '12px',
                            minWidth: '560px',
                          }}
                        >
                          <thead>
                            <tr style={{ textAlign: 'left', color: 'var(--color-roles-on-surface-variant)' }}>
                              <th style={{ padding: '8px', borderBottom: '1px solid var(--color-roles-outline-color)' }}>Term</th>
                              <th style={{ padding: '8px', borderBottom: '1px solid var(--color-roles-outline-color)' }}>Net charges</th>
                              <th style={{ padding: '8px', borderBottom: '1px solid var(--color-roles-outline-color)' }}>Adjustments</th>
                              <th style={{ padding: '8px', borderBottom: '1px solid var(--color-roles-outline-color)' }}>Paid</th>
                              <th style={{ padding: '8px', borderBottom: '1px solid var(--color-roles-outline-color)' }}>Outstanding</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedDetail.summary.termBreakdown.map((term) => (
                              <tr key={term.termId}>
                                <td style={{ padding: '8px', borderBottom: '1px solid var(--color-roles-outline-variant)' }}>
                                  <strong>{term.termName}</strong>
                                  {term.isCurrentTerm ? ' (current)' : ''}
                                </td>
                                <td style={{ padding: '8px', borderBottom: '1px solid var(--color-roles-outline-variant)' }}>
                                  {formatMoney(term.charges)}
                                </td>
                                <td style={{ padding: '8px', borderBottom: '1px solid var(--color-roles-outline-variant)' }}>
                                  {formatMoney(term.adjustments)}
                                </td>
                                <td style={{ padding: '8px', borderBottom: '1px solid var(--color-roles-outline-variant)' }}>
                                  {formatMoney(term.paid)}
                                </td>
                                <td style={{ padding: '8px', borderBottom: '1px solid var(--color-roles-outline-variant)', fontWeight: 700 }}>
                                  {formatMoney(term.outstanding)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div
                  style={{
                    padding: '16px',
                    borderRadius: '6px',
                    border: '1px solid var(--color-roles-error)',
                    backgroundColor: 'rgba(179, 38, 30, 0.08)',
                    color: 'var(--color-roles-error)',
                    fontSize: '13px',
                  }}
                >
                  {selectedDetail.balanceError ?? 'The balance is unavailable for this student.'}
                </div>
              )}

              <div>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '15px' }}>Payment History</h3>
                {selectedDetail.history.length === 0 ? (
                  <p
                    style={{
                      margin: 0,
                      fontSize: '13px',
                      color: 'var(--color-roles-on-surface-variant)',
                    }}
                  >
                    No fee ledger entries have been recorded for this student.
                  </p>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table
                      style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        fontSize: '12px',
                        minWidth: '700px',
                      }}
                    >
                      <thead>
                        <tr style={{ textAlign: 'left', color: 'var(--color-roles-on-surface-variant)' }}>
                          <th style={{ padding: '8px', borderBottom: '1px solid var(--color-roles-outline-color)' }}>Date</th>
                          <th style={{ padding: '8px', borderBottom: '1px solid var(--color-roles-outline-color)' }}>Type</th>
                          <th style={{ padding: '8px', borderBottom: '1px solid var(--color-roles-outline-color)' }}>Details</th>
                          <th style={{ padding: '8px', borderBottom: '1px solid var(--color-roles-outline-color)' }}>Amount</th>
                          <th style={{ padding: '8px', borderBottom: '1px solid var(--color-roles-outline-color)' }}>Recorded by</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedDetail.history.map((item) => (
                          <tr key={item.id}>
                            <td style={{ padding: '8px', borderBottom: '1px solid var(--color-roles-outline-variant)', whiteSpace: 'nowrap' }}>
                              {formatDate(item.createdAt)}
                            </td>
                            <td style={{ padding: '8px', borderBottom: '1px solid var(--color-roles-outline-variant)' }}>
                              {historyTypeLabel(item)}
                            </td>
                            <td style={{ padding: '8px', borderBottom: '1px solid var(--color-roles-outline-variant)' }}>
                              <div style={{ fontWeight: 600 }}>{historyDetail(item)}</div>
                              {item.note && (
                                <div style={{ color: 'var(--color-roles-on-surface-variant)', marginTop: '2px' }}>
                                  {item.note}
                                </div>
                              )}
                              <div style={{ color: 'var(--color-roles-on-surface-variant)', marginTop: '2px' }}>
                                Term: {item.termId}
                              </div>
                            </td>
                            <td style={{ padding: '8px', borderBottom: '1px solid var(--color-roles-outline-variant)', whiteSpace: 'nowrap', fontWeight: 700 }}>
                              {formatMoney(item.amount)}
                            </td>
                            <td style={{ padding: '8px', borderBottom: '1px solid var(--color-roles-outline-variant)' }}>
                              {item.recordedBy}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
                </>
              ) : (
                <>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                      gap: '10px',
                    }}
                  >
                    <SummaryTile
                      label="Outstanding balance"
                      value={
                        selected.outstandingBalance
                          ? formatMoney(selected.outstandingBalance)
                          : 'Unavailable'
                      }
                      emphasis
                    />
                  </div>
                  {selected.outstandingBalance === null && (
                    <div
                      style={{
                        padding: '16px',
                        borderRadius: '6px',
                        border: '1px solid var(--color-roles-error)',
                        backgroundColor: 'rgba(179, 38, 30, 0.08)',
                        color: 'var(--color-roles-error)',
                        fontSize: '13px',
                      }}
                    >
                      {selected.balanceError ?? 'The balance is unavailable for this student.'}
                    </div>
                  )}
                </>
              )}
            </section>
          ) : (
            <div
              style={{
                backgroundColor: 'var(--color-roles-surface)',
                border: '1px dashed var(--color-roles-outline-color)',
                borderRadius: '8px',
                padding: '40px 24px',
                textAlign: 'center',
                color: 'var(--color-roles-on-surface-variant)',
                fontSize: '13px',
              }}
            >
              Select a student to view their balance and payment history.
            </div>
          )}
        </div>
      )}

      {paymentStudent && (
        <OfflinePaymentModal
          student={paymentStudent}
          onClose={() => setPaymentStudent(null)}
          onRecorded={() =>
            handleRecorded('Offline payment recorded. The student balance has been refreshed.')
          }
        />
      )}

      {adjustmentStudent && (
        <AdjustmentModal
          student={adjustmentStudent}
          onClose={() => setAdjustmentStudent(null)}
          onRecorded={() =>
            handleRecorded('Fee adjustment recorded. The student balance has been refreshed.')
          }
        />
      )}
    </div>
  );
}
