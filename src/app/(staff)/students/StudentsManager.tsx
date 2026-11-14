'use client';

import React, { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import type { IntendingStudentRecord, StaffSummary } from '@/lib/auth';
import {
  registerIntendingStudentAction,
  searchIntendingStudentsAction,
  toggleStaffFrontDeskAction,
  type IntakeErrorCode,
} from './actions';
import {
  INTAKE_FIELD_NAMES,
  firstIntakeErrorField,
  validateIntakeForm,
  validateIntakeField,
  type IntakeFieldErrors,
  type IntakeFieldName,
} from './intakeValidation';

interface Props {
  initialStudents: IntendingStudentRecord[];
  staffRole: string;
  staffList?: StaffSummary[];
  availableClasses?: string[];
  availableSessions?: string[];
}

type IntakeFailureCode = IntakeErrorCode | 'network';

interface IntakeFailureState {
  code: IntakeFailureCode;
  message?: string;
  retryAfterSeconds?: number;
}

interface IntakeModalProps {
  open: boolean;
  variant: 'success' | 'error';
  titleId: string;
  onClose: () => void;
  children: React.ReactNode;
}

function normalizeIntakeFieldErrors(
  errors?: Record<string, string>
): IntakeFieldErrors {
  const normalized: IntakeFieldErrors = {};
  if (!errors) return normalized;

  for (const field of INTAKE_FIELD_NAMES) {
    if (errors[field]) normalized[field] = errors[field];
  }

  return normalized;
}

function getFailureCopy(failure: IntakeFailureState): {
  title: string;
  message: string;
} {
  switch (failure.code) {
    case 'validation':
      return {
        title: 'Check the form',
        message: 'Some details need correction. Review the highlighted fields and try again.',
      };
    case 'unauthorized':
      return {
        title: 'Access denied',
        message:
          'You do not have front-desk permission to generate student numbers. Contact an Administrator if you need access.',
      };
    case 'session_expired':
      return {
        title: 'Session expired',
        message: 'Your session has expired. Sign in again to continue.',
      };
    case 'rate_limited':
      return {
        title: 'Please wait',
        message:
          failure.message ||
          `Too many attempts. Please wait ${failure.retryAfterSeconds ?? 60} seconds and try again.`,
      };
    case 'conflict':
      return {
        title: 'Conflicting record',
        message:
          'A conflicting record prevented the student number from being issued. No student number was generated. Check the intake directory and try again.',
      };
    case 'temporary':
      return {
        title: 'Service temporarily unavailable',
        message:
          'The student number service is temporarily unavailable. Your details have been kept. Please try again.',
      };
    case 'network':
      return {
        title: 'Connection problem',
        message:
          'We could not reach the server. Check your connection and try again. Your details have been kept.',
      };
    case 'unexpected':
    default:
      return {
        title: 'Student number not generated',
        message:
          'An unexpected error occurred. Your details have been kept. Please try again.',
      };
  }
}

function fallbackCopyToClipboard(text: string): void {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '-1000px';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();

  const copied = document.execCommand('copy');
  document.body.removeChild(textarea);

  if (!copied) {
    throw new Error('Copy failed.');
  }
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;

  return (
    <span
      id={id}
      role="alert"
      aria-live="polite"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        color: 'var(--color-roles-error)',
        fontFamily: 'var(--typography-body-small-fontfamily)',
        fontSize: 'var(--typography-body-small-fontsize)',
        marginTop: '4px',
      }}
    >
      <svg
        aria-hidden="true"
        focusable="false"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ flexShrink: 0 }}
      >
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      <span>{message}</span>
    </span>
  );
}

function IntakeModal({
  open,
  variant,
  titleId,
  onClose,
  children,
}: IntakeModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusTimer = window.setTimeout(() => {
      const target = dialogRef.current?.querySelector<HTMLElement>(
        '[data-modal-autofocus]'
      );
      target?.focus();
    }, 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab' || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );

      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  const accent =
    variant === 'success' ? 'var(--color-roles-primary)' : 'var(--color-roles-error)';

  return (
    <div
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCloseRef.current();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        zIndex: 2000,
        overflowY: 'auto',
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        style={{
          backgroundColor: 'var(--color-roles-surface)',
          borderRadius: '12px',
          border: '1px solid var(--color-roles-outline-variant)',
          borderTop: `4px solid ${accent}`,
          padding: '24px',
          maxWidth: '520px',
          width: '100%',
          maxHeight: 'calc(100dvh - 32px)',
          overflowY: 'auto',
          boxShadow: '0 16px 48px rgba(0, 0, 0, 0.24)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function StudentsManager({
  initialStudents,
  staffRole,
  staffList = [],
  availableClasses = [],
  availableSessions = [],
}: Props) {
  const [activeTab, setActiveTab] = useState<'register' | 'directory' | 'permissions'>('register');
  const [students, setStudents] = useState<IntendingStudentRecord[]>(initialStudents);
  const [staffAccounts, setStaffAccounts] = useState<StaffSummary[]>(staffList);

  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const submittingRef = useRef(false);
  const submissionIdRef = useRef<string | null>(null);

  // Registration Form State
  const currentYear = new Date().getFullYear();
  const calculatedDefaultSession = `${currentYear}/${currentYear + 1}`;
  const defaultSessionYear = availableSessions.includes(calculatedDefaultSession)
    ? calculatedDefaultSession
    : (availableSessions[0] || calculatedDefaultSession);

  const [formData, setFormData] = useState({
    name: '',
    intendedClass: availableClasses.length === 1 ? availableClasses[0] : '',
    sessionYear: availableSessions.includes(calculatedDefaultSession)
      ? calculatedDefaultSession
      : (availableSessions[0] || defaultSessionYear),
    guardianName: '',
    guardianPhone: '',
    guardianEmail: '',
    notes: '',
  });

  const [fieldErrors, setFieldErrors] = useState<IntakeFieldErrors>({});
  const [focusedField, setFocusedField] = useState<IntakeFieldName | null>(null);
  const [lastRegistered, setLastRegistered] = useState<IntendingStudentRecord | null>(null);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const [failureModal, setFailureModal] = useState<IntakeFailureState | null>(null);
  const submitButtonRef = useRef<HTMLButtonElement | null>(null);

  // Search State
  const [searchQuery, setSearchQuery] = useState('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const normalizedValue = name === 'guardianEmail' ? value.toLowerCase() : value;
    setFormData((prev) => ({ ...prev, [name]: normalizedValue }));

    if (INTAKE_FIELD_NAMES.includes(name as IntakeFieldName)) {
      const field = name as IntakeFieldName;
      if (fieldErrors[field]) {
        const error = validateIntakeField(field, normalizedValue, {
          availableClasses,
          availableSessions,
        });
        setFieldErrors((prev) => {
          if (error) {
            return { ...prev, [field]: error };
          }
          const next = { ...prev };
          delete next[field];
          return next;
        });
      }
    }

    setFailureModal((prev) => (prev?.code === 'validation' ? null : prev));
  };

  const handleInputBlur = (field: IntakeFieldName) => {
    setFocusedField(null);
    const error = validateIntakeField(field, formData[field], {
      availableClasses,
      availableSessions,
    });
    setFieldErrors((prev) => {
      if (error) {
        return { ...prev, [field]: error };
      }
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleInputFocus = (field: IntakeFieldName) => {
    setFocusedField(field);
  };

  const focusFirstInvalidField = (errors: IntakeFieldErrors) => {
    const field = firstIntakeErrorField(errors);
    if (!field) return;

    window.setTimeout(() => {
      document.getElementById(field)?.focus();
    }, 0);
  };

  const closeFailureModal = () => {
    const code = failureModal?.code;
    const errors = fieldErrors;
    setFailureModal(null);

    if (code === 'validation') {
      focusFirstInvalidField(errors);
      return;
    }

    if (code === 'temporary' || code === 'network' || code === 'unexpected') {
      window.setTimeout(() => submitButtonRef.current?.focus(), 0);
    }
  };

  const closeSuccessModal = () => {
    setLastRegistered(null);
    setCopyStatus('idle');
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;
    setFeedback(null);
    setCopyStatus('idle');

    const validationErrors = validateIntakeForm(formData, {
      availableClasses,
      availableSessions,
    });
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      setFailureModal({ code: 'validation' });
      return;
    }

    setFieldErrors({});
    setFailureModal(null);
    submittingRef.current = true;
    if (!submissionIdRef.current) {
      submissionIdRef.current =
        typeof globalThis.crypto?.randomUUID === 'function'
          ? globalThis.crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }

    startTransition(async () => {
      try {
        const res = await registerIntendingStudentAction({
          submissionId: submissionIdRef.current ?? undefined,
          name: formData.name.trim(),
          intendedClass: formData.intendedClass.trim(),
          sessionYear: formData.sessionYear.trim(),
          guardianName: formData.guardianName.trim() || undefined,
          guardianPhone: formData.guardianPhone.trim() || undefined,
          guardianEmail: formData.guardianEmail.trim() || undefined,
          notes: formData.notes.trim() || undefined,
        });

        if (res.success && res.student) {
          submissionIdRef.current = null;
          setFeedback({
            type: 'success',
            text: `Student number generated successfully: ${res.student.studentNumber}`,
          });
          setLastRegistered(res.student);
          setStudents((prev) =>
            prev.some((student) => student.id === res.student!.id)
              ? prev
              : [res.student!, ...prev]
          );
          setFormData({
            name: '',
            intendedClass: availableClasses.length === 1 ? availableClasses[0] : '',
            sessionYear: availableSessions.includes(calculatedDefaultSession)
              ? calculatedDefaultSession
              : (availableSessions[0] || defaultSessionYear),
            guardianName: '',
            guardianPhone: '',
            guardianEmail: '',
            notes: '',
          });
        } else {
          const serverFieldErrors = normalizeIntakeFieldErrors(res.fieldErrors);
          if (Object.keys(serverFieldErrors).length > 0) {
            setFieldErrors(serverFieldErrors);
            setFailureModal({ code: 'validation' });
          } else {
            setFailureModal({
              code: res.errorCode ?? 'unexpected',
              message: res.error,
              retryAfterSeconds: res.retryAfterSeconds,
            });
          }
        }
      } catch {
        setFailureModal({ code: 'network' });
      } finally {
        submittingRef.current = false;
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
      } catch {
        setFeedback({
          type: 'error',
          text: 'Search failed. Please try again.',
        });
      }
    });
  };

  const handleCopyNumber = async (num: string) => {
    setCopyStatus('idle');

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(num);
      } else {
        fallbackCopyToClipboard(num);
      }
      setCopyStatus('copied');
    } catch {
      try {
        fallbackCopyToClipboard(num);
        setCopyStatus('copied');
      } catch {
        setCopyStatus('error');
      }
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
      } catch {
        setFeedback({
          type: 'error',
          text: 'Failed to update staff permission. Please try again.',
        });
      }
    });
  };

  const getFieldStyle = (field: IntakeFieldName): React.CSSProperties => {
    const hasError = Boolean(fieldErrors[field]);
    const isFocused = focusedField === field;

    return {
      width: '100%',
      padding: '10px 12px',
      borderRadius: '8px',
      border: hasError
        ? '1px solid var(--color-roles-error)'
        : isFocused
        ? '1px solid var(--color-roles-primary)'
        : '1px solid var(--color-roles-outline)',
      outline: isFocused
        ? hasError
          ? '2px solid var(--color-roles-error)'
          : '2px solid var(--color-roles-primary)'
        : 'none',
      outlineOffset: '2px',
      backgroundColor: 'var(--color-roles-surface)',
      color: 'var(--color-roles-on-surface)',
      fontSize: 'var(--typography-body-medium-fontsize)',
      boxSizing: 'border-box',
      transition: 'border-color 0.15s ease, outline-color 0.15s ease, box-shadow 0.15s ease',
    };
  };

  const fieldErrorId = (field: IntakeFieldName) => `intake-${field}-error`;
  const failureCopy = failureModal ? getFailureCopy(failureModal) : null;
  const failureActionLabel =
    failureModal?.code === 'validation'
      ? 'Review fields'
      : failureModal?.code === 'temporary' ||
          failureModal?.code === 'network' ||
          failureModal?.code === 'unexpected'
        ? 'Try again'
        : 'Close';

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
          Generate Student Number
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
          {/* Intake Registration Form */}
          <form
            onSubmit={handleRegisterSubmit}
            noValidate
            aria-busy={isPending}
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
                Generate Student Number
              </h2>
              <p
                style={{
                  fontSize: 'var(--typography-body-small-fontsize)',
                  color: 'var(--color-roles-on-surface-variant)',
                  margin: 0,
                }}
              >
                Enter the applicant details. The system will atomically generate an official student identifier in format SP-YYYY-NNNN.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
              <div>
                <label
                  htmlFor="name"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: 'var(--typography-label-medium-fontsize)',
                    fontWeight: 600,
                    marginBottom: '6px',
                  }}
                >
                  <span>Student Full Name</span>
                  <span aria-hidden="true" style={{ color: 'var(--color-roles-error)', fontWeight: 700 }}>*</span>
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  placeholder="e.g. Adebayo Ibrahim"
                  value={formData.name}
                  onChange={handleInputChange}
                  onBlur={() => handleInputBlur('name')}
                  onFocus={() => handleInputFocus('name')}
                  aria-invalid={Boolean(fieldErrors.name)}
                  aria-describedby={fieldErrors.name ? fieldErrorId('name') : undefined}
                  style={getFieldStyle('name')}
                />
                <FieldError id={fieldErrorId('name')} message={fieldErrors.name} />
              </div>

              <div>
                <label
                  htmlFor="intendedClass"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: 'var(--typography-label-medium-fontsize)',
                    fontWeight: 600,
                    marginBottom: '6px',
                  }}
                >
                  <span>Intended Class</span>
                  <span aria-hidden="true" style={{ color: 'var(--color-roles-error)', fontWeight: 700 }}>*</span>
                </label>
                <select
                  id="intendedClass"
                  name="intendedClass"
                  required
                  disabled={availableClasses.length === 0}
                  value={formData.intendedClass}
                  onChange={handleInputChange}
                  onBlur={() => handleInputBlur('intendedClass')}
                  onFocus={() => handleInputFocus('intendedClass')}
                  aria-invalid={Boolean(fieldErrors.intendedClass)}
                  aria-describedby={
                    fieldErrors.intendedClass ? fieldErrorId('intendedClass') : undefined
                  }
                  style={{
                    ...getFieldStyle('intendedClass'),
                    cursor: availableClasses.length === 0 ? 'not-allowed' : 'pointer',
                    ...(availableClasses.length === 0 ? { opacity: 0.65 } : {}),
                  }}
                >
                  {availableClasses.length === 0 ? (
                    <option value="">No classes configured</option>
                  ) : (
                    <>
                      <option value="">Select intended class...</option>
                      {availableClasses.map((cls) => (
                        <option key={cls} value={cls}>
                          {cls}
                        </option>
                      ))}
                    </>
                  )}
                </select>
                {availableClasses.length === 0 && (
                  <span
                    role="alert"
                    style={{
                      display: 'block',
                      color: 'var(--color-roles-error)',
                      fontFamily: 'var(--typography-body-small-fontfamily)',
                      fontSize: 'var(--typography-body-small-fontsize)',
                      marginTop: '4px',
                    }}
                  >
                    No school classes are currently configured or available. Please contact an Administrator.
                  </span>
                )}
                <FieldError
                  id={fieldErrorId('intendedClass')}
                  message={fieldErrors.intendedClass}
                />
              </div>

              <div>
                <label
                  htmlFor="sessionYear"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: 'var(--typography-label-medium-fontsize)',
                    fontWeight: 600,
                    marginBottom: '6px',
                  }}
                >
                  <span>Academic Session</span>
                  <span aria-hidden="true" style={{ color: 'var(--color-roles-error)', fontWeight: 700 }}>*</span>
                </label>
                <select
                  id="sessionYear"
                  name="sessionYear"
                  required
                  disabled={availableSessions.length === 0}
                  value={formData.sessionYear}
                  onChange={handleInputChange}
                  onBlur={() => handleInputBlur('sessionYear')}
                  onFocus={() => handleInputFocus('sessionYear')}
                  aria-invalid={Boolean(fieldErrors.sessionYear)}
                  aria-describedby={
                    fieldErrors.sessionYear ? fieldErrorId('sessionYear') : undefined
                  }
                  style={{
                    ...getFieldStyle('sessionYear'),
                    cursor: availableSessions.length === 0 ? 'not-allowed' : 'pointer',
                    ...(availableSessions.length === 0 ? { opacity: 0.65 } : {}),
                  }}
                >
                  {availableSessions.length === 0 ? (
                    <option value="">No academic sessions configured</option>
                  ) : (
                    <>
                      <option value="">Select academic session...</option>
                      {availableSessions.map((session) => (
                        <option key={session} value={session}>
                          {session}
                        </option>
                      ))}
                    </>
                  )}
                </select>
                {availableSessions.length === 0 && (
                  <span
                    role="alert"
                    style={{
                      display: 'block',
                      color: 'var(--color-roles-error)',
                      fontFamily: 'var(--typography-body-small-fontfamily)',
                      fontSize: 'var(--typography-body-small-fontsize)',
                      marginTop: '4px',
                    }}
                  >
                    No academic sessions are currently configured. Please contact an Administrator.
                  </span>
                )}
                <FieldError
                  id={fieldErrorId('sessionYear')}
                  message={fieldErrors.sessionYear}
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
                  onBlur={() => handleInputBlur('guardianName')}
                  onFocus={() => handleInputFocus('guardianName')}
                  aria-invalid={Boolean(fieldErrors.guardianName)}
                  aria-describedby={
                    fieldErrors.guardianName ? fieldErrorId('guardianName') : undefined
                  }
                  style={getFieldStyle('guardianName')}
                />
                <FieldError
                  id={fieldErrorId('guardianName')}
                  message={fieldErrors.guardianName}
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
                  onBlur={() => handleInputBlur('guardianPhone')}
                  onFocus={() => handleInputFocus('guardianPhone')}
                  aria-invalid={Boolean(fieldErrors.guardianPhone)}
                  aria-describedby={
                    fieldErrors.guardianPhone ? fieldErrorId('guardianPhone') : undefined
                  }
                  style={getFieldStyle('guardianPhone')}
                />
                <FieldError
                  id={fieldErrorId('guardianPhone')}
                  message={fieldErrors.guardianPhone}
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
                  onBlur={() => handleInputBlur('guardianEmail')}
                  onFocus={() => handleInputFocus('guardianEmail')}
                  aria-invalid={Boolean(fieldErrors.guardianEmail)}
                  aria-describedby={
                    fieldErrors.guardianEmail ? fieldErrorId('guardianEmail') : undefined
                  }
                  style={getFieldStyle('guardianEmail')}
                />
                <FieldError
                  id={fieldErrorId('guardianEmail')}
                  message={fieldErrors.guardianEmail}
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
                onBlur={() => handleInputBlur('notes')}
                onFocus={() => handleInputFocus('notes')}
                aria-invalid={Boolean(fieldErrors.notes)}
                aria-describedby={fieldErrors.notes ? fieldErrorId('notes') : undefined}
                style={{ ...getFieldStyle('notes'), resize: 'vertical' }}
              />
              <FieldError id={fieldErrorId('notes')} message={fieldErrors.notes} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button
                ref={submitButtonRef}
                type="submit"
                disabled={isPending}
                aria-busy={isPending}
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
                {isPending ? 'Generating Student Number...' : 'Generate Student Number'}
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

      {lastRegistered && (
        <IntakeModal
          open
          variant="success"
          titleId="intake-success-title"
          onClose={closeSuccessModal}
        >
          <div>
            <p
              style={{
                margin: '0 0 4px 0',
                fontSize: 'var(--typography-label-small-fontsize)',
                fontWeight: 700,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                color: 'var(--color-roles-primary)',
              }}
            >
              Intake confirmation
            </p>
            <h2
              id="intake-success-title"
              data-modal-autofocus
              tabIndex={-1}
              style={{
                margin: 0,
                fontSize: 'var(--typography-headline-small-fontsize)',
                color: 'var(--color-roles-on-surface)',
              }}
            >
              Student number generated
            </h2>
            <p
              style={{
                margin: '8px 0 0 0',
                fontSize: 'var(--typography-body-medium-fontsize)',
                color: 'var(--color-roles-on-surface-variant)',
                lineHeight: 1.5,
              }}
            >
              Copy the official student number before closing this window.
            </p>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap',
              backgroundColor: 'var(--color-roles-surface-container)',
              border: '1px solid var(--color-roles-outline-variant)',
              borderRadius: '10px',
              padding: '16px',
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
                Official student identifier
              </div>
              <div
                style={{
                  fontFamily: 'monospace',
                  fontSize: '28px',
                  fontWeight: 800,
                  color: 'var(--color-roles-primary)',
                  letterSpacing: '1px',
                  wordBreak: 'break-word',
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
                backgroundColor:
                  copyStatus === 'copied'
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
              {copyStatus === 'copied' ? 'Copied' : 'Copy number'}
            </button>
          </div>

          {copyStatus === 'copied' && (
            <p
              role="status"
              aria-live="polite"
              style={{
                margin: 0,
                fontSize: 'var(--typography-body-small-fontsize)',
                color: 'var(--color-roles-primary)',
              }}
            >
              Copied to clipboard.
            </p>
          )}
          {copyStatus === 'error' && (
            <p
              role="alert"
              style={{
                margin: 0,
                fontSize: 'var(--typography-body-small-fontsize)',
                color: 'var(--color-roles-error)',
              }}
            >
              Copy failed. Select the number and copy it manually.
            </p>
          )}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '12px',
              fontSize: 'var(--typography-body-medium-fontsize)',
            }}
          >
            <div>
              <span style={{ color: 'var(--color-roles-on-surface-variant)' }}>Student: </span>
              <strong>{lastRegistered.name}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--color-roles-on-surface-variant)' }}>Class: </span>
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

          <p
            style={{
              margin: 0,
              fontSize: 'var(--typography-body-small-fontsize)',
              color: 'var(--color-roles-on-surface-variant)',
            }}
          >
            This intake record is isolated from active attendance and fee records.
          </p>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              onClick={closeSuccessModal}
              style={{
                padding: '10px 20px',
                backgroundColor: 'var(--color-roles-primary)',
                color: 'var(--color-roles-on-primary)',
                border: 'none',
                borderRadius: '8px',
                fontFamily: 'var(--typography-label-large-fontfamily)',
                fontSize: 'var(--typography-label-large-fontsize)',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Done
            </button>
          </div>
        </IntakeModal>
      )}

      {failureModal && failureCopy && (
        <IntakeModal
          open
          variant="error"
          titleId="intake-error-title"
          onClose={closeFailureModal}
        >
          <div>
            <p
              style={{
                margin: '0 0 4px 0',
                fontSize: 'var(--typography-label-small-fontsize)',
                fontWeight: 700,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                color: 'var(--color-roles-error)',
              }}
            >
              Student number generation
            </p>
            <h2
              id="intake-error-title"
              data-modal-autofocus
              tabIndex={-1}
              style={{
                margin: 0,
                fontSize: 'var(--typography-headline-small-fontsize)',
                color: 'var(--color-roles-on-surface)',
              }}
            >
              {failureCopy.title}
            </h2>
            <p
              style={{
                margin: '8px 0 0 0',
                fontSize: 'var(--typography-body-medium-fontsize)',
                color: 'var(--color-roles-on-surface-variant)',
                lineHeight: 1.5,
              }}
            >
              {failureCopy.message}
            </p>
          </div>

          {failureModal.code === 'validation' && (
            <p
              style={{
                margin: 0,
                fontSize: 'var(--typography-body-small-fontsize)',
                color: 'var(--color-roles-error)',
              }}
            >
              Correct the highlighted fields below, then submit again.
            </p>
          )}

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              gap: '10px',
              flexWrap: 'wrap',
            }}
          >
            {failureModal.code === 'session_expired' && (
              <Link
                href="/auth/staff-login?returnUrl=/students"
                style={{
                  padding: '10px 20px',
                  backgroundColor: 'var(--color-roles-primary)',
                  color: 'var(--color-roles-on-primary)',
                  borderRadius: '8px',
                  fontFamily: 'var(--typography-label-large-fontfamily)',
                  fontSize: 'var(--typography-label-large-fontsize)',
                  fontWeight: 700,
                  textDecoration: 'none',
                }}
              >
                Sign in again
              </Link>
            )}
            <button
              type="button"
              onClick={closeFailureModal}
              style={{
                padding: '10px 20px',
                backgroundColor:
                  failureModal.code === 'session_expired'
                    ? 'transparent'
                    : 'var(--color-roles-error)',
                color:
                  failureModal.code === 'session_expired'
                    ? 'var(--color-roles-on-surface)'
                    : '#ffffff',
                border:
                  failureModal.code === 'session_expired'
                    ? '1px solid var(--color-roles-outline)'
                    : 'none',
                borderRadius: '8px',
                fontFamily: 'var(--typography-label-large-fontfamily)',
                fontSize: 'var(--typography-label-large-fontsize)',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {failureActionLabel}
            </button>
          </div>
        </IntakeModal>
      )}
    </div>
  );
}
