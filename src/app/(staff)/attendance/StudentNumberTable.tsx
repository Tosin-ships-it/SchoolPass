'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  fuzzySearchStudents,
  type IntakeStudentItem,
  type IntakeStatus,
} from './fuzzySearch';
import { StudentDetailsModal } from './StudentDetailsModal';

interface Props {
  initialStudents: IntakeStudentItem[];
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

export function StudentNumberTable({ initialStudents }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedNumber, setCopiedNumber] = useState<string | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<IntakeStudentItem | null>(null);

  const filteredStudents = useMemo(() => {
    return fuzzySearchStudents(initialStudents, searchQuery);
  }, [initialStudents, searchQuery]);

  const handleCopy = (studentNumber: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(studentNumber).catch(() => {
        // Fallback or ignore
      });
    }
    setCopiedNumber(studentNumber);
    setTimeout(() => {
      setCopiedNumber((current) => (current === studentNumber ? null : current));
    }, 2000);
  };

  const handleClear = () => {
    setSearchQuery('');
  };

  return (
    <section
      aria-labelledby="student-intake-table-heading"
      style={{
        backgroundColor: 'var(--color-roles-surface)',
        border: '1px solid var(--color-roles-outline-color)',
        borderRadius: '8px',
        boxShadow: 'var(--effect-soft-shadow)',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}
    >
      {/* Table Header & Top-Right Search Toolbar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <h2
            id="student-intake-table-heading"
            style={{
              fontFamily: 'var(--typography-title-medium-fontfamily)',
              fontSize: 'var(--typography-title-medium-fontsize)',
              fontWeight: 700,
              color: 'var(--color-roles-on-surface)',
              margin: 0,
            }}
          >
            Student Intake &amp; Number Generation
          </h2>
          <p
            style={{
              fontFamily: 'var(--typography-body-small-fontfamily)',
              fontSize: 'var(--typography-body-small-fontsize)',
              color: 'var(--color-roles-on-surface-variant)',
              margin: '3px 0 0',
            }}
          >
            Generated student numbers and intake records &bull; {initialStudents.length} record{initialStudents.length !== 1 ? 's' : ''} total
          </p>
        </div>

        {/* Top-Right Toolbar: Search field & Register action */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexWrap: 'wrap',
          }}
        >
          {/* Search Input with inline Clear button */}
          <div
            style={{
              position: 'relative',
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search student number or name..."
              aria-label="Search generated student numbers"
              style={{
                padding: '8px 30px 8px 12px',
                fontSize: '13px',
                borderRadius: '6px',
                border: '1px solid var(--color-roles-outline-color)',
                backgroundColor: 'var(--color-roles-surface)',
                color: 'var(--color-roles-on-surface)',
                width: '240px',
                boxSizing: 'border-box',
                outline: 'none',
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={handleClear}
                aria-label="Clear search"
                title="Clear search"
                style={{
                  position: 'absolute',
                  right: '8px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--color-roles-on-surface-variant)',
                  fontSize: '14px',
                  padding: '2px',
                  lineHeight: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Quick link to Student Intake / Registration */}
          <Link
            href="/students"
            style={{
              fontSize: '13px',
              fontWeight: 600,
              padding: '8px 14px',
              backgroundColor: 'var(--color-roles-primary)',
              color: 'var(--color-roles-on-primary)',
              borderRadius: '6px',
              textDecoration: 'none',
              whiteSpace: 'nowrap',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <span>+ Generate Number</span>
          </Link>
        </div>
      </div>

      {/* Active search filter indicator */}
      {searchQuery && (
        <div
          style={{
            fontSize: '12px',
            color: 'var(--color-roles-on-surface-variant)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 12px',
            backgroundColor: 'var(--color-roles-surface-container, #f9f9f9)',
            borderRadius: '6px',
            border: '1px solid var(--color-roles-outline-variant, #eee)',
          }}
        >
          <span>
            Showing <strong>{filteredStudents.length}</strong> of{' '}
            <strong>{initialStudents.length}</strong> results matching &ldquo;{searchQuery}&rdquo;
          </span>
          <button
            type="button"
            onClick={handleClear}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-roles-primary)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              padding: 0,
            }}
          >
            Reset filter
          </button>
        </div>
      )}

      {/* Table Container */}
      {filteredStudents.length === 0 ? (
        <div
          style={{
            padding: '36px 20px',
            textAlign: 'center',
            backgroundColor: 'var(--color-roles-surface-container, #fafafa)',
            borderRadius: '8px',
            border: '1px dashed var(--color-roles-outline-color, #ccc)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-roles-on-surface)' }}>
            {initialStudents.length === 0
              ? 'No student numbers generated yet'
              : `No matches found for "${searchQuery}"`}
          </div>
          <p
            style={{
              fontSize: '13px',
              color: 'var(--color-roles-on-surface-variant)',
              maxWidth: '420px',
              margin: '0 auto',
              lineHeight: 1.4,
            }}
          >
            {initialStudents.length === 0
              ? 'Official student identifiers generated during prospective intake will appear here.'
              : 'Try checking for typos or searching by partial student number (e.g. 0001) or student name.'}
          </p>
          {initialStudents.length === 0 ? (
            <Link
              href="/students"
              style={{
                marginTop: '8px',
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--color-roles-primary)',
                textDecoration: 'none',
              }}
            >
              Generate your first student number &rarr;
            </Link>
          ) : (
            <button
              type="button"
              onClick={handleClear}
              style={{
                marginTop: '8px',
                padding: '6px 16px',
                backgroundColor: 'var(--color-roles-primary)',
                color: 'var(--color-roles-on-primary)',
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Clear Search
            </button>
          )}
        </div>
      ) : (
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              textAlign: 'left',
              fontSize: '13px',
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: '2px solid var(--color-roles-outline-variant)',
                  color: 'var(--color-roles-on-surface-variant)',
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                <th style={{ padding: '10px 12px' }}>Student Name</th>
                <th style={{ padding: '10px 12px' }}>Generated Student Number</th>
                <th style={{ padding: '10px 12px' }}>Intended Class</th>
                <th style={{ padding: '10px 12px' }}>Date Generated</th>
                <th style={{ padding: '10px 12px' }}>Intake Status</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((student) => {
                const dateStr = student.createdAt
                  ? new Date(student.createdAt).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })
                  : '—';
                const statusStyle = getStatusBadgeStyle(student.status);
                const isCopied = copiedNumber === student.studentNumber;
                const isClaimed = student.isClaimed ?? (student.status !== 'Pre-Admission Intake');

                return (
                  <tr
                    key={student.id}
                    onClick={() => {
                      if (isClaimed) {
                        setSelectedStudent(student);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (isClaimed && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        setSelectedStudent(student);
                      }
                    }}
                    tabIndex={isClaimed ? 0 : undefined}
                    role={isClaimed ? 'button' : undefined}
                    aria-label={isClaimed ? `View details for ${student.name}` : undefined}
                    style={{
                      borderBottom: '1px solid var(--color-roles-outline-variant)',
                      transition: 'background-color 0.15s ease',
                      cursor: isClaimed ? 'pointer' : 'default',
                    }}
                    onMouseEnter={(e) => {
                      if (isClaimed) {
                        e.currentTarget.style.backgroundColor = 'var(--color-roles-surface-container, #f8fafc)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (isClaimed) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    {/* Student Name */}
                    <td style={{ padding: '12px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--color-roles-on-surface)' }}>
                        {student.name}
                      </div>
                      {student.guardianName && (
                        <div
                          style={{
                            fontSize: '11px',
                            color: 'var(--color-roles-on-surface-variant)',
                            marginTop: '2px',
                          }}
                        >
                          Guardian: {student.guardianName}
                        </div>
                      )}
                    </td>

                    {/* Generated Student Number */}
                    <td style={{ padding: '12px' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <span
                          style={{
                            fontFamily: 'monospace',
                            fontSize: '13px',
                            fontWeight: 700,
                            color: 'var(--color-roles-primary)',
                            backgroundColor: 'var(--color-roles-surface-container, #f5f5f5)',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            border: '1px solid var(--color-roles-outline-variant, #e0e0e0)',
                            letterSpacing: '0.02em',
                          }}
                        >
                          {student.studentNumber}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopy(student.studentNumber);
                          }}
                          title="Copy student number"
                          aria-label={`Copy student number ${student.studentNumber}`}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '11px',
                            color: isCopied ? '#2e7d32' : 'var(--color-roles-on-surface-variant)',
                            padding: '2px 4px',
                            borderRadius: '3px',
                            fontWeight: isCopied ? 700 : 500,
                          }}
                        >
                          {isCopied ? '✓ Copied' : 'Copy'}
                        </button>
                      </div>
                    </td>

                    {/* Intended Class */}
                    <td style={{ padding: '12px' }}>
                      <div style={{ fontWeight: 500 }}>{student.intendedClass}</div>
                      <div
                        style={{
                          fontSize: '11px',
                          color: 'var(--color-roles-on-surface-variant)',
                          marginTop: '2px',
                        }}
                      >
                        Session: {student.sessionYear}
                      </div>
                    </td>

                    {/* Date Generated */}
                    <td style={{ padding: '12px' }}>
                      <div style={{ color: 'var(--color-roles-on-surface)' }}>{dateStr}</div>
                      {student.registeredByName && (
                        <div
                          style={{
                            fontSize: '11px',
                            color: 'var(--color-roles-on-surface-variant)',
                            marginTop: '2px',
                          }}
                        >
                          By: {student.registeredByName}
                        </div>
                      )}
                    </td>

                    {/* Intake Status */}
                    <td style={{ padding: '12px' }}>
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
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {student.status}
                      </span>
                    </td>

                    {/* Action */}
                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      {isClaimed ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedStudent(student);
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '12px',
                            fontWeight: 600,
                            color: 'var(--color-roles-primary)',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '4px 8px',
                            borderRadius: '4px',
                          }}
                        >
                          <span>View Details</span>
                          <span>&rarr;</span>
                        </button>
                      ) : (
                        <span
                          style={{
                            fontSize: '11px',
                            color: 'var(--color-roles-on-surface-variant)',
                          }}
                        >
                          Unclaimed
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Popup Modal for Claimed Student Details */}
      <StudentDetailsModal
        student={selectedStudent}
        onClose={() => setSelectedStudent(null)}
      />
    </section>
  );
}

