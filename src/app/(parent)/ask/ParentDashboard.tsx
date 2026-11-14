'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { AskSchoolQuestions } from './AskSchoolQuestions';
import { StudentCheckinCard } from '../components/StudentCheckinCard';
import type {
  ParentDashboardData,
  ChildDashboardOverview,
  RecentActivityItem,
} from '@/app/api/records/dashboard/route';

interface Props {
  parentName: string;
  parentEmail: string;
}

export function ParentDashboard({ parentName, parentEmail }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ParentDashboardData | null>(null);

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/records/dashboard');
      if (!res.ok) {
        throw new Error('Failed to load dashboard records.');
      }
      const json: ParentDashboardData = await res.json();
      if (!json.success) {
        throw new Error(json.error || 'Unable to retrieve dashboard information.');
      }
      setData(json);
    } catch {
      setError('Unable to load dashboard information. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const isLinked = data?.linkState.type === 'LINKED';
  const isPending = data?.linkState.type === 'PENDING_VERIFICATION';
  const isUnlinked = data?.linkState.type === 'UNLINKED';

  return (
    <div
      style={{
        minHeight: '100dvh',
        backgroundColor: 'var(--color-roles-background)',
        color: 'var(--color-roles-on-background)',
        padding: '24px 16px 48px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '760px',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
        }}
      >
        {/* ========================================================
            1. HEADER & NAVIGATION
            ======================================================== */}
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingBottom: '16px',
            borderBottom: '1px solid var(--color-roles-outline-variant)',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                fontFamily: 'var(--typography-title-large-fontfamily)',
                fontSize: 'var(--typography-title-large-fontsize)',
                fontWeight: 700,
                color: 'var(--color-roles-primary)',
              }}
            >
              SchoolPass
            </span>
            <span
              style={{
                fontSize: '11px',
                color: 'var(--color-roles-on-surface-variant)',
                padding: '2px 8px',
                backgroundColor: 'var(--color-roles-surface-variant)',
                borderRadius: '4px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Parent Portal
            </span>
          </div>

          <nav
            aria-label="Parent primary navigation"
            style={{ display: 'flex', alignItems: 'center', gap: '16px' }}
          >
            <Link
              href="/records"
              style={{
                fontFamily: 'var(--typography-label-large-fontfamily)',
                fontSize: 'var(--typography-label-large-fontsize)',
                color: 'var(--color-roles-primary)',
                textDecoration: 'none',
                fontWeight: 600,
              }}
            >
              My Records
            </Link>

            <Link
              href="/pay"
              style={{
                fontFamily: 'var(--typography-label-large-fontfamily)',
                fontSize: 'var(--typography-label-large-fontsize)',
                color: 'var(--color-roles-primary)',
                textDecoration: 'none',
                fontWeight: 600,
              }}
            >
              Pay Fees
            </Link>

            <form action="/api/auth/logout" method="POST" style={{ margin: 0 }}>
              <button
                type="submit"
                style={{
                  fontFamily: 'var(--typography-label-large-fontfamily)',
                  fontSize: 'var(--typography-label-large-fontsize)',
                  color: 'var(--color-roles-error)',
                  backgroundColor: 'transparent',
                  border: 'none',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                Sign Out
              </button>
            </form>
          </nav>
        </header>

        {/* ========================================================
            2. WELCOME & ACCOUNT STATUS SECTION
            ======================================================== */}
        <section
          aria-labelledby="dashboard-welcome-heading"
          style={{
            backgroundColor: 'var(--color-roles-surface)',
            border: '1px solid var(--color-roles-outline-color)',
            boxShadow: 'var(--effect-soft-shadow)',
            borderRadius: '8px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              flexWrap: 'wrap',
              gap: '10px',
            }}
          >
            <div>
              <h1
                id="dashboard-welcome-heading"
                style={{
                  fontFamily: 'var(--typography-headline-small-fontfamily)',
                  fontSize: 'var(--typography-headline-small-fontsize)',
                  fontWeight: 700,
                  color: 'var(--color-roles-on-surface)',
                  margin: 0,
                }}
              >
                Welcome, {parentName}
              </h1>
              <p
                style={{
                  fontFamily: 'var(--typography-body-medium-fontfamily)',
                  fontSize: 'var(--typography-body-medium-fontsize)',
                  color: 'var(--color-roles-on-surface-variant)',
                  margin: '4px 0 0',
                }}
              >
                Signed in as <strong>{parentEmail}</strong>
              </p>
            </div>

            {/* Concise Account Status Pill */}
            <div>
              {loading ? (
                <span
                  style={{
                    padding: '4px 10px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    backgroundColor: 'var(--color-roles-surface-variant)',
                    color: 'var(--color-roles-on-surface-variant)',
                  }}
                >
                  Checking link status...
                </span>
              ) : isLinked ? (
                <span
                  style={{
                    padding: '4px 10px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    backgroundColor: 'rgba(46, 125, 50, 0.1)',
                    color: '#2e7d32',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <span style={{ fontSize: '8px' }}>●</span> Verified Guardian (
                  {data?.children.length} Child
                  {data?.children.length !== 1 ? 'ren' : ''})
                </span>
              ) : isPending ? (
                <span
                  style={{
                    padding: '4px 10px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    backgroundColor: 'rgba(230, 81, 0, 0.1)',
                    color: '#e65100',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <span style={{ fontSize: '8px' }}>●</span> Verification Pending
                </span>
              ) : (
                <span
                  style={{
                    padding: '4px 10px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    backgroundColor: 'var(--color-roles-surface-variant)',
                    color: 'var(--color-roles-on-surface-variant)',
                  }}
                >
                  {data?.isEmailVerified ? 'Email Verified (Awaiting Student Link)' : 'Email Verification Pending'}
                </span>
              )}
            </div>
          </div>
        </section>

        {/* ========================================================
            3. ERROR & LOADING STATES
            ======================================================== */}
        {error && (
          <div
            role="alert"
            style={{
              padding: '16px',
              backgroundColor: 'rgba(186, 26, 26, 0.08)',
              border: '1px solid var(--color-roles-error)',
              borderRadius: '8px',
              color: 'var(--color-roles-error)',
              fontSize: '14px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>{error}</span>
            <button
              onClick={loadDashboard}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-roles-error)',
                fontWeight: 700,
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              Retry
            </button>
          </div>
        )}

        {loading && (
          <div
            style={{
              padding: '40px 20px',
              textAlign: 'center',
              color: 'var(--color-roles-on-surface-variant)',
              backgroundColor: 'var(--color-roles-surface)',
              border: '1px solid var(--color-roles-outline-color)',
              borderRadius: '8px',
            }}
          >
            Loading your family records...
          </div>
        )}

        {/* ========================================================
            4. ACCESS STATE: LINKED GUARDIAN -> "MY CHILDREN"
            ======================================================== */}
        {!loading && isLinked && data?.children && data.children.length > 0 && (
          <section
            aria-labelledby="my-children-heading"
            style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <h2
                  id="my-children-heading"
                  style={{
                    fontFamily: 'var(--typography-title-medium-fontfamily)',
                    fontSize: 'var(--typography-title-medium-fontsize)',
                    fontWeight: 700,
                    color: 'var(--color-roles-on-surface)',
                    margin: 0,
                  }}
                >
                  My Children
                </h2>
                <p
                  style={{
                    fontSize: '13px',
                    color: 'var(--color-roles-on-surface-variant)',
                    margin: '2px 0 0',
                  }}
                >
                  Active student overview, current term attendance, and verified fee balances.
                </p>
              </div>

              <Link
                href="/records"
                style={{
                  fontSize: '13px',
                  color: 'var(--color-roles-primary)',
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                Manage Links &rarr;
              </Link>
            </div>

            {/* Children Cards Grid (Separated Cards, Never Combined) */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  data.children.length > 1
                    ? 'repeat(auto-fit, minmax(320px, 1fr))'
                    : '1fr',
                gap: '16px',
              }}
            >
              {data.children.map((child: ChildDashboardOverview) => (
                <article
                  key={child.studentId}
                  style={{
                    backgroundColor: 'var(--color-roles-surface)',
                    border: '1px solid var(--color-roles-outline-color)',
                    boxShadow: 'var(--effect-soft-shadow)',
                    borderRadius: '8px',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '16px',
                  }}
                >
                  {/* Card Header */}
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: '8px',
                      }}
                    >
                      <div>
                        <h3
                          style={{
                            fontFamily: 'var(--typography-title-large-fontfamily)',
                            fontSize: '18px',
                            fontWeight: 700,
                            color: 'var(--color-roles-on-surface)',
                            margin: 0,
                          }}
                        >
                          {child.studentName}
                        </h3>
                        <div
                          style={{
                            fontSize: '13px',
                            color: 'var(--color-roles-on-surface-variant)',
                            marginTop: '2px',
                          }}
                        >
                          Class: <strong>{child.className}</strong> &bull; ID:{' '}
                          <code>{child.studentNumber}</code>
                        </div>
                      </div>

                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '10px',
                          fontSize: '11px',
                          fontWeight: 700,
                          backgroundColor: 'rgba(46, 125, 50, 0.1)',
                          color: '#2e7d32',
                          textTransform: 'uppercase',
                        }}
                      >
                        {child.enrollmentStatus}
                      </span>
                    </div>

                    <hr
                      style={{
                        border: 'none',
                        borderTop: '1px solid var(--color-roles-outline-variant)',
                        margin: '14px 0',
                      }}
                    />

                    {/* Operational Metrics Grid */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '12px',
                      }}
                    >
                      {/* Attendance Cardlet */}
                      <div
                        style={{
                          padding: '12px',
                          backgroundColor: 'var(--color-roles-background)',
                          borderRadius: '6px',
                          border: '1px solid var(--color-roles-outline-variant)',
                        }}
                      >
                        <div
                          style={{
                            fontSize: '11px',
                            color: 'var(--color-roles-on-surface-variant)',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.03em',
                            marginBottom: '4px',
                          }}
                        >
                          Attendance
                        </div>
                        <div
                          style={{
                            fontSize: '14px',
                            fontWeight: 700,
                            color: 'var(--color-roles-on-surface)',
                            lineHeight: 1.3,
                          }}
                        >
                          {child.attendance.hasRecords
                            ? child.attendance.text
                            : 'Pending'}
                        </div>
                        <div
                          style={{
                            fontSize: '11px',
                            color: 'var(--color-roles-on-surface-variant)',
                            marginTop: '4px',
                          }}
                        >
                          {child.attendance.hasRecords
                            ? 'Source: Staff-recorded'
                            : 'No records for current term'}
                        </div>
                      </div>

                      {/* Fee Balance Cardlet */}
                      <div
                        style={{
                          padding: '12px',
                          backgroundColor: 'var(--color-roles-background)',
                          borderRadius: '6px',
                          border: '1px solid var(--color-roles-outline-variant)',
                        }}
                      >
                        <div
                          style={{
                            fontSize: '11px',
                            color: 'var(--color-roles-on-surface-variant)',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.03em',
                            marginBottom: '4px',
                          }}
                        >
                          Fee Balance
                        </div>
                        <div
                          style={{
                            fontSize: '14px',
                            fontWeight: 700,
                            color: child.feeBalance.isCleared
                              ? '#2e7d32'
                              : child.feeBalance.hasCharges
                              ? 'var(--color-roles-on-surface)'
                              : 'var(--color-roles-on-surface-variant)',
                            lineHeight: 1.3,
                          }}
                        >
                          {child.feeBalance.formattedAmount}
                        </div>
                        <div
                          style={{
                            fontSize: '11px',
                            color: 'var(--color-roles-on-surface-variant)',
                            marginTop: '4px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {child.feeBalance.isCleared
                            ? 'Cleared'
                            : child.feeBalance.hasCharges
                            ? 'Outstanding'
                            : 'Schedule pending'}
                        </div>
                      </div>
                    </div>

                    {/* Daily Arrival Check-in (15m Expiring Gate Pass) */}
                    <StudentCheckinCard
                      studentId={child.studentId}
                      studentName={child.studentName}
                      studentNumber={child.studentNumber}
                      parentEmail={parentEmail}
                    />
                  </div>

                  {/* Card Actions */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderTop: '1px solid var(--color-roles-outline-variant)',
                      paddingTop: '12px',
                      marginTop: '4px',
                      flexWrap: 'wrap',
                      gap: '8px',
                    }}
                  >
                    <Link
                      href={`/records`}
                      style={{
                        fontSize: '13px',
                        color: 'var(--color-roles-primary)',
                        textDecoration: 'none',
                        fontWeight: 600,
                      }}
                    >
                      View Full Records &rarr;
                    </Link>

                    <Link
                      href={`/pay?studentId=${child.studentId}`}
                      style={{
                        padding: '6px 14px',
                        backgroundColor: 'var(--color-roles-primary)',
                        color: 'var(--color-roles-on-primary)',
                        fontSize: '12px',
                        fontWeight: 600,
                        borderRadius: '4px',
                        textDecoration: 'none',
                        boxShadow: 'var(--effect-soft-shadow)',
                      }}
                    >
                      Pay Fees
                    </Link>
                  </div>
                </article>
              ))}
            </div>

            {/* Sibling Pending Request Callout (If parent has active links AND a pending request) */}
            {data.pendingRequests && data.pendingRequests.length > 0 && (
              <div
                style={{
                  padding: '14px 18px',
                  backgroundColor: 'rgba(230, 81, 0, 0.08)',
                  border: '1px solid rgba(230, 81, 0, 0.3)',
                  borderRadius: '6px',
                  color: 'var(--color-roles-on-surface)',
                  fontSize: '13px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '8px',
                }}
              >
                <div>
                  <strong>Pending Verification:</strong> Link request for{' '}
                  {data.pendingRequests.map((r, i) => (
                    <span key={r.id}>
                      {i > 0 && ', '}
                      <strong>{r.studentName}</strong> ({r.studentNumber})
                    </span>
                  ))}{' '}
                  is awaiting staff review.
                </div>
                <Link
                  href="/records"
                  style={{
                    color: '#e65100',
                    fontWeight: 700,
                    textDecoration: 'underline',
                  }}
                >
                  View in Records &rarr;
                </Link>
              </div>
            )}
          </section>
        )}

        {/* ========================================================
            5. ACCESS STATE: VERIFICATION PENDING
            ======================================================== */}
        {!loading && isPending && (
          <section
            aria-labelledby="pending-verification-heading"
            style={{
              backgroundColor: 'var(--color-roles-surface)',
              border: '1px solid var(--color-roles-outline-color)',
              boxShadow: 'var(--effect-soft-shadow)',
              borderRadius: '8px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div>
              <h2
                id="pending-verification-heading"
                style={{
                  fontFamily: 'var(--typography-title-medium-fontfamily)',
                  fontSize: 'var(--typography-title-medium-fontsize)',
                  fontWeight: 700,
                  color: 'var(--color-roles-on-surface)',
                  margin: '0 0 6px',
                }}
              >
                Student Verification in Progress
              </h2>
              <p
                style={{
                  fontFamily: 'var(--typography-body-medium-fontfamily)',
                  fontSize: 'var(--typography-body-medium-fontsize)',
                  color: 'var(--color-roles-on-surface-variant)',
                  margin: 0,
                  lineHeight: 1.5,
                }}
              >
                You have submitted a student linking request. School staff must review and approve your request before access to attendance and fee records can be granted.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {data?.pendingRequests.map((req) => (
                <div
                  key={req.id}
                  style={{
                    padding: '12px 16px',
                    borderRadius: '6px',
                    border: '1px solid var(--color-roles-outline-variant)',
                    backgroundColor: 'var(--color-roles-background)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '8px',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--color-roles-on-surface)' }}>
                      {req.studentName}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--color-roles-on-surface-variant)' }}>
                      Student ID: {req.studentNumber} &bull; Class: {req.studentClass}
                    </div>
                  </div>

                  <span
                    style={{
                      padding: '3px 10px',
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontWeight: 700,
                      backgroundColor: 'rgba(230, 81, 0, 0.1)',
                      color: '#e65100',
                    }}
                  >
                    PENDING STAFF REVIEW
                  </span>
                </div>
              ))}
            </div>

            <div>
              <Link
                href="/records"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--color-roles-primary)',
                  textDecoration: 'none',
                }}
              >
                View Request Status in Records &rarr;
              </Link>
            </div>
          </section>
        )}

        {/* ========================================================
            6. ACCESS STATE: UNLINKED PARENT
            ======================================================== */}
        {!loading && isUnlinked && (
          <section
            aria-labelledby="unlinked-parent-heading"
            style={{
              backgroundColor: 'var(--color-roles-surface)',
              border: '1px solid var(--color-roles-outline-color)',
              boxShadow: 'var(--effect-soft-shadow)',
              borderRadius: '8px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div>
              <h2
                id="unlinked-parent-heading"
                style={{
                  fontFamily: 'var(--typography-title-medium-fontfamily)',
                  fontSize: 'var(--typography-title-medium-fontsize)',
                  fontWeight: 700,
                  color: 'var(--color-roles-on-surface)',
                  margin: '0 0 6px',
                }}
              >
                Link Your Child to SchoolPass
              </h2>
              <p
                style={{
                  fontFamily: 'var(--typography-body-medium-fontfamily)',
                  fontSize: 'var(--typography-body-medium-fontsize)',
                  color: 'var(--color-roles-on-surface-variant)',
                  margin: 0,
                  lineHeight: 1.5,
                }}
              >
                {data?.isEmailVerified
                  ? "Your parent email is verified. To view your child's verified attendance, fee balances, and confirm daily gate arrival, connect your account to your child using their official Student Number."
                  : "To view your child's verified attendance, fee balances, and confirm daily gate arrival, connect your account to your child using their official Student Number."}
              </p>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                flexWrap: 'wrap',
              }}
            >
              <Link
                href="/records"
                style={{
                  padding: '10px 20px',
                  backgroundColor: 'var(--color-roles-primary)',
                  color: 'var(--color-roles-on-primary)',
                  fontSize: '14px',
                  fontWeight: 600,
                  borderRadius: '6px',
                  textDecoration: 'none',
                  boxShadow: 'var(--effect-soft-shadow)',
                }}
              >
                Link Child via Student Number &rarr;
              </Link>

              <span style={{ fontSize: '13px', color: 'var(--color-roles-on-surface-variant)' }}>
                Need your child&apos;s Student Number? Contact the school front desk.
              </span>
            </div>
          </section>
        )}

        {/* ========================================================
            7. ASK THE SCHOOL (Compact, non-dominating section)
            ======================================================== */}
        <section
          aria-labelledby="ask-school-heading"
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
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: 'var(--typography-label-medium-fontfamily)',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: 'var(--color-roles-primary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  marginBottom: '2px',
                }}
              >
                School Information Service
              </div>
              <h2
                id="ask-school-heading"
                style={{
                  fontFamily: 'var(--typography-title-medium-fontfamily)',
                  fontSize: 'var(--typography-title-medium-fontsize)',
                  fontWeight: 700,
                  color: 'var(--color-roles-on-surface)',
                  margin: 0,
                }}
              >
                Ask the School
              </h2>
              <p
                style={{
                  fontSize: '13px',
                  color: 'var(--color-roles-on-surface-variant)',
                  margin: '4px 0 0',
                }}
              >
                Get direct answers about official school policies, uniform guidelines, term calendar, and closing times.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <Link
                href="/office"
                style={{
                  padding: '8px 14px',
                  backgroundColor: 'var(--color-roles-surface-variant)',
                  color: 'var(--color-roles-on-surface-variant)',
                  fontSize: '12px',
                  fontWeight: 600,
                  borderRadius: '4px',
                  textDecoration: 'none',
                }}
              >
                Ask the Office &rarr;
              </Link>
            </div>
          </div>

          {/* Ask the School Questions (4 default, expand to 8, auto-close hidden answers) */}
          <AskSchoolQuestions />
        </section>

        {/* ========================================================
            8. RECENT ACTIVITY (Meaningful only, omitted if empty)
            ======================================================== */}
        {!loading && data?.recentActivity && data.recentActivity.length > 0 && (
          <section
            aria-labelledby="recent-activity-heading"
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
            <h2
              id="recent-activity-heading"
              style={{
                fontFamily: 'var(--typography-title-medium-fontfamily)',
                fontSize: '15px',
                fontWeight: 700,
                color: 'var(--color-roles-on-surface)',
                margin: 0,
              }}
            >
              Recent Activity
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {data.recentActivity.map((act: RecentActivityItem) => (
                <div
                  key={act.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 14px',
                    backgroundColor: 'var(--color-roles-background)',
                    borderRadius: '6px',
                    border: '1px solid var(--color-roles-outline-variant)',
                    gap: '12px',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--color-roles-on-surface)' }}>
                      {act.title}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--color-roles-on-surface-variant)' }}>
                      {act.description}
                    </div>
                  </div>

                  <span
                    style={{
                      fontSize: '11px',
                      color: 'var(--color-roles-on-surface-variant)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {new Date(act.date).toLocaleDateString('en-NG', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ========================================================
            9. FOOTER
            ======================================================== */}
        <footer style={{ textAlign: 'center', marginTop: '12px' }}>
          <Link
            href="/"
            style={{
              fontSize: 'var(--typography-body-small-fontsize)',
              color: 'var(--color-roles-secondary)',
              textDecoration: 'none',
            }}
          >
            &larr; Back to Landing Page
          </Link>
        </footer>
      </div>
    </div>
  );
}

