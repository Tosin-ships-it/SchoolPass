'use client';

import React, { useState, useTransition } from 'react';
import type { IntendingStudentRecord, StaffAccount } from '@/lib/auth';
import {
  registerIntendingStudentAction,
  searchIntendingStudentsAction,
  toggleStaffFrontDeskAction,
} from './actions';

interface Props {
  initialStudents: IntendingStudentRecord[];
  staffRole: string;
  staffList?: StaffAccount[];
}

export function StudentsManager({
  initialStudents,
  staffRole,
  staffList = [],
}: Props) {
  const [activeTab, setActiveTab] = useState<'register' | 'directory' | 'permissions'>('register');
  const [students, setStudents] = useState<IntendingStudentRecord[]>(initialStudents);
  const [staffAccounts, setStaffAccounts] = useState<StaffAccount[]>(staffList);

  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Registration Form State
  const currentYear = new Date().getFullYear();
  const defaultSessionYear = `${currentYear}/${currentYear + 1}`;
  const [formData, setFormData] = useState({
    name: '',
    intendedClass: '',
    sessionYear: defaultSessionYear,
    guardianName: '',
    guardianPhone: '',
    guardianEmail: '',
    notes: '',
  });

  // Slip / Receipt modal state for newly created student
  const [lastRegistered, setLastRegistered] = useState<IntendingStudentRecord | null>(null);
  const [copied, setCopied] = useState(false);

  // Search State
  const [searchQuery, setSearchQuery] = useState('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setCopied(false);

    if (!formData.name.trim()) {
      setFeedback({ type: 'error', text: 'Please enter the student full name.' });
      return;
    }
    if (!formData.intendedClass.trim()) {
      setFeedback({ type: 'error', text: 'Please enter or select the intended class.' });
      return;
    }

    startTransition(async () => {
      try {
        const res = await registerIntendingStudentAction({
          name: formData.name.trim(),
          intendedClass: formData.intendedClass.trim(),
          sessionYear: formData.sessionYear.trim(),
          guardianName: formData.guardianName.trim() || undefined,
          guardianPhone: formData.guardianPhone.trim() || undefined,
          guardianEmail: formData.guardianEmail.trim() || undefined,
          notes: formData.notes.trim() || undefined,
        });

        if (res.success && res.student) {
          setFeedback({
            type: 'success',
            text: `Intending student registered successfully! Generated Student Number: ${res.student.studentNumber}`,
          });
          setLastRegistered(res.student);
          setStudents((prev) => [res.student!, ...prev]);
          // Reset form to defaults
          setFormData({
            name: '',
            intendedClass: '',
            sessionYear: defaultSessionYear,
            guardianName: '',
            guardianPhone: '',
            guardianEmail: '',
            notes: '',
          });
        } else {
          setFeedback({ type: 'error', text: res.error || 'Failed to register student.' });
        }
      } catch (err: unknown) {
        setFeedback({
          type: 'error',
          text: err instanceof Error ? err.message : 'An unexpected error occurred.',
        });
      }
    });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    startTransition(async () => {
      try {
        const res = await searchIntendingStudentsAction(searchQuery);
        if (res.success && res.students) {
          setStudents(res.students);
        } else {
          setFeedback({ type: 'error', text: res.error || 'Failed to search intending students.' });
        }
      } catch (err: unknown) {
        setFeedback({
          type: 'error',
          text: err instanceof Error ? err.message : 'Search failed.',
        });
      }
    });
  };

  const handleCopyNumber = (num: string) => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(num);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleTogglePermission = (staffId: string, currentStatus: boolean) => {
    setFeedback(null);
    startTransition(async () => {
      try {
        const res = await toggleStaffFrontDeskAction(staffId, !currentStatus);
        if (res.success && res.staff) {
          setStaffAccounts((prev) =>
            prev.map((s) => (s.id === staffId ? { ...s, isFrontDesk: !currentStatus } : s))
          );
          setFeedback({
            type: 'success',
            text: `Front-desk permission ${!currentStatus ? 'granted' : 'revoked'} for ${res.staff.name}.`,
          });
        } else {
          setFeedback({ type: 'error', text: res.error || 'Failed to update permission.' });
        }
      } catch (err: unknown) {
        setFeedback({
          type: 'error',
          text: err instanceof Error ? err.message : 'Failed to update staff permission.',
        });
      }
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Feedback Banner */}
      {feedback && (
        <div
          role="alert"
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            backgroundColor:
              feedback.type === 'success'
                ? 'var(--color-roles-primary-container)'
                : 'var(--color-roles-error-container)',
            color:
              feedback.type === 'success'
                ? 'var(--color-roles-on-primary-container)'
                : 'var(--color-roles-on-error-container)',
            border: `1px solid ${
              feedback.type === 'success'
                ? 'var(--color-roles-primary)'
                : 'var(--color-roles-error)'
            }`,
            fontSize: 'var(--typography-body-medium-fontsize)',
            fontWeight: 500,
          }}
        >
          {feedback.text}
        </div>
      )}

      {/* Navigation Tabs */}
      <nav
        aria-label="Front-desk sections"
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid var(--color-roles-outline-variant)',
          paddingBottom: '8px',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('register')}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            border: 'none',
            fontFamily: 'var(--typography-label-large-fontfamily)',
            fontSize: 'var(--typography-label-large-fontsize)',
            fontWeight: 600,
            cursor: 'pointer',
            backgroundColor:
              activeTab === 'register'
                ? 'var(--color-roles-primary)'
                : 'transparent',
            color:
              activeTab === 'register'
                ? 'var(--color-roles-on-primary)'
                : 'var(--color-roles-on-surface-variant)',
            transition: 'background-color 0.2s',
          }}
        >
          New Registration
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('directory')}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            border: 'none',
            fontFamily: 'var(--typography-label-large-fontfamily)',
            fontSize: 'var(--typography-label-large-fontsize)',
            fontWeight: 600,
            cursor: 'pointer',
            backgroundColor:
              activeTab === 'directory'
                ? 'var(--color-roles-primary)'
                : 'transparent',
            color:
              activeTab === 'directory'
                ? 'var(--color-roles-on-primary)'
                : 'var(--color-roles-on-surface-variant)',
            transition: 'background-color 0.2s',
          }}
        >
          Intake Directory ({students.length})
        </button>

        {staffRole === 'admin' && (
          <button
            type="button"
            onClick={() => setActiveTab('permissions')}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: 'none',
              fontFamily: 'var(--typography-label-large-fontfamily)',
              fontSize: 'var(--typography-label-large-fontsize)',
              fontWeight: 600,
              cursor: 'pointer',
              backgroundColor:
                activeTab === 'permissions'
                  ? 'var(--color-roles-primary)'
                  : 'transparent',
              color:
                activeTab === 'permissions'
                  ? 'var(--color-roles-on-primary)'
                  : 'var(--color-roles-on-surface-variant)',
              transition: 'background-color 0.2s',
            }}
          >
            Staff Permissions
          </button>
        )}
      </nav>

      {/* Tab 1: New Registration */}
      {activeTab === 'register' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Slip Card if last registered */}
          {lastRegistered && (
            <div
              style={{
                backgroundColor: 'var(--color-roles-surface-container-high)',
                border: '2px solid var(--color-roles-primary)',
                borderRadius: '12px',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span
                  style={{
                    fontSize: 'var(--typography-label-small-fontsize)',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: 'var(--color-roles-primary)',
                    letterSpacing: '0.05em',
                  }}
                >
                  Registration Slip / Intake Confirmation
                </span>
                <span
                  style={{
                    fontSize: 'var(--typography-label-small-fontsize)',
                    color: 'var(--color-roles-outline)',
                  }}
                >
                  Isolated from active attendance & fees
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: 'var(--color-roles-surface)',
                  padding: '16px',
                  borderRadius: '8px',
                  border: '1px solid var(--color-roles-outline-variant)',
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 'var(--typography-label-medium-fontsize)',
                      color: 'var(--color-roles-on-surface-variant)',
                      marginBottom: '4px',
                    }}
                  >
                    Official Student Identifier
                  </div>
                  <div
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '28px',
                      fontWeight: 800,
                      color: 'var(--color-roles-primary)',
                      letterSpacing: '1px',
                    }}
                  >
                    {lastRegistered.studentNumber}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleCopyNumber(lastRegistered.studentNumber)}
                  style={{
                    padding: '10px 16px',
                    backgroundColor: copied
                      ? 'var(--color-roles-secondary)'
                      : 'var(--color-roles-primary)',
                    color: 'var(--color-roles-on-primary)',
                    border: 'none',
                    borderRadius: '8px',
                    fontFamily: 'var(--typography-label-large-fontfamily)',
                    fontSize: 'var(--typography-label-large-fontsize)',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {copied ? 'Copied!' : 'Copy Number'}
                </button>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '12px',
                  fontSize: 'var(--typography-body-medium-fontsize)',
                }}
              >
                <div>
                  <span style={{ color: 'var(--color-roles-on-surface-variant)' }}>Student: </span>
                  <strong>{lastRegistered.name}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--color-roles-on-surface-variant)' }}>Intended Class: </span>
                  <strong>{lastRegistered.intendedClass}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--color-roles-on-surface-variant)' }}>Session: </span>
                  <strong>{lastRegistered.sessionYear}</strong>
                </div>
                {lastRegistered.guardianName && (
                  <div>
                    <span style={{ color: 'var(--color-roles-on-surface-variant)' }}>Guardian: </span>
                    <strong>{lastRegistered.guardianName}</strong>
                  </div>
                )}
                {lastRegistered.guardianPhone && (
                  <div>
                    <span style={{ color: 'var(--color-roles-on-surface-variant)' }}>Phone: </span>
                    <strong>{lastRegistered.guardianPhone}</strong>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Intake Registration Form */}
          <form
            onSubmit={handleRegisterSubmit}
            style={{
              backgroundColor: 'var(--color-roles-surface-container)',
              borderRadius: '12px',
              padding: '24px',
              border: '1px solid var(--color-roles-outline-variant)',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
            }}
          >
            <div>
              <h2
                style={{
                  fontSize: 'var(--typography-title-medium-fontsize)',
                  fontWeight: 700,
                  margin: '0 0 4px 0',
                }}
              >
                Prospective Student Intake
              </h2>
              <p
                style={{
                  fontSize: 'var(--typography-body-small-fontsize)',
                  color: 'var(--color-roles-on-surface-variant)',
                  margin: 0,
                }}
              >
                Enter the applicant details. An official student identifier in format SP-YYYY-NNNN will be atomically generated.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
              <div>
                <label
                  htmlFor="name"
                  style={{
                    display: 'block',
                    fontSize: 'var(--typography-label-medium-fontsize)',
                    fontWeight: 600,
                    marginBottom: '6px',
                  }}
                >
                  Student Full Name *
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  placeholder="e.g. Adebayo Ibrahim"
                  value={formData.name}
                  onChange={handleInputChange}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--color-roles-outline)',
                    backgroundColor: 'var(--color-roles-surface)',
                    color: 'var(--color-roles-on-surface)',
                    fontSize: 'var(--typography-body-medium-fontsize)',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label
                  htmlFor="intendedClass"
                  style={{
                    display: 'block',
                    fontSize: 'var(--typography-label-medium-fontsize)',
                    fontWeight: 600,
                    marginBottom: '6px',
                  }}
                >
                  Intended Class *
                </label>
                <input
                  id="intendedClass"
                  name="intendedClass"
                  type="text"
                  required
                  placeholder="e.g. Primary 1, JSS 1, SS 1"
                  value={formData.intendedClass}
                  onChange={handleInputChange}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--color-roles-outline)',
                    backgroundColor: 'var(--color-roles-surface)',
                    color: 'var(--color-roles-on-surface)',
                    fontSize: 'var(--typography-body-medium-fontsize)',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label
                  htmlFor="sessionYear"
                  style={{
                    display: 'block',
                    fontSize: 'var(--typography-label-medium-fontsize)',
                    fontWeight: 600,
                    marginBottom: '6px',
                  }}
                >
                  Academic Session *
                </label>
                <input
                  id="sessionYear"
                  name="sessionYear"
                  type="text"
                  required
                  placeholder="e.g. 2026/2027"
                  value={formData.sessionYear}
                  onChange={handleInputChange}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--color-roles-outline)',
                    backgroundColor: 'var(--color-roles-surface)',
                    color: 'var(--color-roles-on-surface)',
                    fontSize: 'var(--typography-body-medium-fontsize)',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
              <div>
                <label
                  htmlFor="guardianName"
                  style={{
                    display: 'block',
                    fontSize: 'var(--typography-label-medium-fontsize)',
                    fontWeight: 600,
                    marginBottom: '6px',
                  }}
                >
                  Parent/Guardian Full Name
                </label>
                <input
                  id="guardianName"
                  name="guardianName"
                  type="text"
                  placeholder="e.g. Mrs. Folashade Ibrahim"
                  value={formData.guardianName}
                  onChange={handleInputChange}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--color-roles-outline)',
                    backgroundColor: 'var(--color-roles-surface)',
                    color: 'var(--color-roles-on-surface)',
                    fontSize: 'var(--typography-body-medium-fontsize)',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label
                  htmlFor="guardianPhone"
                  style={{
                    display: 'block',
                    fontSize: 'var(--typography-label-medium-fontsize)',
                    fontWeight: 600,
                    marginBottom: '6px',
                  }}
                >
                  Guardian Phone Number
                </label>
                <input
                  id="guardianPhone"
                  name="guardianPhone"
                  type="tel"
                  placeholder="e.g. 08031234567"
                  value={formData.guardianPhone}
                  onChange={handleInputChange}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--color-roles-outline)',
                    backgroundColor: 'var(--color-roles-surface)',
                    color: 'var(--color-roles-on-surface)',
                    fontSize: 'var(--typography-body-medium-fontsize)',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label
                  htmlFor="guardianEmail"
                  style={{
                    display: 'block',
                    fontSize: 'var(--typography-label-medium-fontsize)',
                    fontWeight: 600,
                    marginBottom: '6px',
                  }}
                >
                  Guardian Email
                </label>
                <input
                  id="guardianEmail"
                  name="guardianEmail"
                  type="email"
                  placeholder="e.g. guardian@example.com"
                  value={formData.guardianEmail}
                  onChange={handleInputChange}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--color-roles-outline)',
                    backgroundColor: 'var(--color-roles-surface)',
                    color: 'var(--color-roles-on-surface)',
                    fontSize: 'var(--typography-body-medium-fontsize)',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="notes"
                style={{
                  display: 'block',
                  fontSize: 'var(--typography-label-medium-fontsize)',
                  fontWeight: 600,
                  marginBottom: '6px',
                }}
              >
                Intake Notes (Optional)
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={2}
                maxLength={500}
                placeholder="Special considerations, previous school, or entrance exam notes..."
                value={formData.notes}
                onChange={handleInputChange}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--color-roles-outline)',
                  backgroundColor: 'var(--color-roles-surface)',
                  color: 'var(--color-roles-on-surface)',
                  fontSize: 'var(--typography-body-medium-fontsize)',
                  boxSizing: 'border-box',
                  resize: 'vertical',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button
                type="submit"
                disabled={isPending}
                style={{
                  padding: '12px 24px',
                  backgroundColor: 'var(--color-roles-primary)',
                  color: 'var(--color-roles-on-primary)',
                  border: 'none',
                  borderRadius: '8px',
                  fontFamily: 'var(--typography-label-large-fontfamily)',
                  fontSize: 'var(--typography-label-large-fontsize)',
                  fontWeight: 700,
                  cursor: isPending ? 'not-allowed' : 'pointer',
                  opacity: isPending ? 0.6 : 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                {isPending ? 'Generating Identifier...' : 'Register & Generate Student Number'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tab 2: Intake Directory */}
      {activeTab === 'directory' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Search Form */}
          <form
            onSubmit={handleSearch}
            style={{
              display: 'flex',
              gap: '10px',
            }}
          >
            <input
              type="text"
              placeholder="Search by student number, name, class, or guardian phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1px solid var(--color-roles-outline)',
                backgroundColor: 'var(--color-roles-surface)',
                color: 'var(--color-roles-on-surface)',
                fontSize: 'var(--typography-body-medium-fontsize)',
              }}
            />
            <button
              type="submit"
              disabled={isPending}
              style={{
                padding: '10px 20px',
                backgroundColor: 'var(--color-roles-primary)',
                color: 'var(--color-roles-on-primary)',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Search
            </button>
          </form>

          {/* Results List */}
          {students.length === 0 ? (
            <div
              style={{
                padding: '32px',
                textAlign: 'center',
                backgroundColor: 'var(--color-roles-surface-container)',
                borderRadius: '8px',
                color: 'var(--color-roles-on-surface-variant)',
              }}
            >
              No intending students found matching your criteria.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {students.map((student) => (
                <div
                  key={student.id}
                  style={{
                    backgroundColor: 'var(--color-roles-surface-container)',
                    border: '1px solid var(--color-roles-outline-variant)',
                    borderRadius: '10px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span
                        style={{
                          fontFamily: 'monospace',
                          fontSize: '18px',
                          fontWeight: 700,
                          color: 'var(--color-roles-primary)',
                          backgroundColor: 'var(--color-roles-surface)',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          border: '1px solid var(--color-roles-outline-variant)',
                        }}
                      >
                        {student.studentNumber}
                      </span>
                      <strong style={{ fontSize: '16px' }}>{student.name}</strong>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          fontSize: 'var(--typography-label-small-fontsize)',
                          backgroundColor: 'var(--color-roles-surface-container-highest)',
                          color: 'var(--color-roles-on-surface-variant)',
                          padding: '4px 8px',
                          borderRadius: '4px',
                        }}
                      >
                        Class: {student.intendedClass}
                      </span>
                      <span
                        style={{
                          fontSize: 'var(--typography-label-small-fontsize)',
                          backgroundColor: 'var(--color-roles-surface-container-highest)',
                          color: 'var(--color-roles-on-surface-variant)',
                          padding: '4px 8px',
                          borderRadius: '4px',
                        }}
                      >
                        Session: {student.sessionYear}
                      </span>
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '16px',
                      fontSize: 'var(--typography-body-small-fontsize)',
                      color: 'var(--color-roles-on-surface-variant)',
                    }}
                  >
                    {student.guardianName && (
                      <div>
                        Guardian: <strong style={{ color: 'var(--color-roles-on-surface)' }}>{student.guardianName}</strong>
                      </div>
                    )}
                    {student.guardianPhone && (
                      <div>
                        Phone: <strong style={{ color: 'var(--color-roles-on-surface)' }}>{student.guardianPhone}</strong>
                      </div>
                    )}
                    {student.guardianEmail && (
                      <div>
                        Email: <strong style={{ color: 'var(--color-roles-on-surface)' }}>{student.guardianEmail}</strong>
                      </div>
                    )}
                    <div>
                      Registered:{' '}
                      <strong>{new Date(student.createdAt).toLocaleDateString()}</strong>
                      {student.registeredByName && ` by ${student.registeredByName}`}
                    </div>
                  </div>

                  {student.notes && (
                    <div
                      style={{
                        fontSize: 'var(--typography-body-small-fontsize)',
                        color: 'var(--color-roles-on-surface-variant)',
                        fontStyle: 'italic',
                        backgroundColor: 'var(--color-roles-surface)',
                        padding: '6px 10px',
                        borderRadius: '4px',
                      }}
                    >
                      Note: {student.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Staff Permissions (Admin Only) */}
      {activeTab === 'permissions' && staffRole === 'admin' && (
        <div
          style={{
            backgroundColor: 'var(--color-roles-surface-container)',
            borderRadius: '12px',
            padding: '24px',
            border: '1px solid var(--color-roles-outline-variant)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          <div>
            <h2
              style={{
                fontSize: 'var(--typography-title-medium-fontsize)',
                fontWeight: 700,
                margin: '0 0 4px 0',
              }}
            >
              Front-Desk Role Administration
            </h2>
            <p
              style={{
                fontSize: 'var(--typography-body-small-fontsize)',
                color: 'var(--color-roles-on-surface-variant)',
                margin: 0,
              }}
            >
              Teaching staff are denied front-desk intake privileges by default. Grant or revoke explicit front-desk access below.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {staffAccounts.map((account) => (
              <div
                key={account.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--color-roles-surface)',
                  border: '1px solid var(--color-roles-outline-variant)',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>{account.name}</div>
                  <div
                    style={{
                      fontSize: 'var(--typography-body-small-fontsize)',
                      color: 'var(--color-roles-on-surface-variant)',
                    }}
                  >
                    {account.email} &bull; Role: <strong>{account.role}</strong>
                  </div>
                </div>

                <div>
                  {account.role === 'ADMIN' ? (
                    <span
                      style={{
                        fontSize: 'var(--typography-label-small-fontsize)',
                        color: 'var(--color-roles-primary)',
                        backgroundColor: 'var(--color-roles-primary-container)',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontWeight: 600,
                      }}
                    >
                      Admin (Implicit Access)
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleTogglePermission(account.id, account.isFrontDesk)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '6px',
                        border: 'none',
                        fontSize: 'var(--typography-label-medium-fontsize)',
                        fontWeight: 600,
                        cursor: 'pointer',
                        backgroundColor: account.isFrontDesk
                          ? 'var(--color-roles-error-container)'
                          : 'var(--color-roles-primary)',
                        color: account.isFrontDesk
                          ? 'var(--color-roles-on-error-container)'
                          : 'var(--color-roles-on-primary)',
                      }}
                    >
                      {account.isFrontDesk ? 'Revoke Access' : 'Grant Front-Desk'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
