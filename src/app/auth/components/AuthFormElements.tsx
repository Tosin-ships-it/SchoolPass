'use client';

import React, { useState, useEffect } from 'react';

interface FormFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  error?: string;
  helperText?: string;
  showPasswordToggle?: boolean;
}

export function FormField({
  id,
  label,
  error,
  helperText,
  showPasswordToggle,
  style,
  onBlur,
  onChange,
  onFocus,
  type = 'text',
  ...inputProps
}: FormFieldProps) {
  const [internalError, setInternalError] = useState<string | null>(null);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (inputProps.value !== undefined && String(inputProps.value).trim().length > 0) {
      setInternalError(null);
    }
  }, [inputProps.value]);

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    const val =
      e.target.value !== undefined
        ? e.target.value
        : inputProps.value !== undefined
        ? String(inputProps.value)
        : '';
    if (!val || !String(val).trim()) {
      setInternalError('This field must not be empty');
    } else {
      setInternalError(null);
    }
    if (onBlur) {
      onBlur(e);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value && String(e.target.value).trim()) {
      setInternalError(null);
    }
    if (onChange) {
      onChange(e);
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    if (onFocus) {
      onFocus(e);
    }
  };

  const activeError = error || internalError;
  const errorId = activeError ? `${id}-error` : undefined;
  const helperId = helperText ? `${id}-helper` : undefined;

  const resolvedType = showPasswordToggle
    ? isPasswordVisible
      ? 'text'
      : 'password'
    : type;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
      <label
        htmlFor={id}
        style={{
          fontFamily: 'var(--typography-label-large-fontfamily)',
          fontSize: 'var(--typography-label-large-fontsize)',
          fontWeight: 600,
          color: 'var(--color-roles-on-surface)',
        }}
      >
        {label}
      </label>

      <div style={{ position: 'relative', width: '100%' }}>
        <input
          id={id}
          type={resolvedType}
          aria-invalid={Boolean(activeError)}
          aria-describedby={[errorId, helperId].filter(Boolean).join(' ') || undefined}
          style={{
            width: '100%',
            height: '42px',
            padding: showPasswordToggle ? '8px 36px 8px 12px' : '8px 12px',
            fontFamily: 'var(--typography-body-large-fontfamily)',
            fontSize: 'var(--typography-body-large-fontsize)',
            lineHeight: 'var(--typography-body-large-lineheight)',
            color: 'var(--color-roles-on-surface)',
            backgroundColor: 'var(--color-roles-surface)',
            border: activeError
              ? '0.8px solid var(--color-roles-error)'
              : isFocused
              ? '1px solid var(--color-roles-primary)'
              : '1px solid var(--color-roles-outline-color)',
            outline: activeError
              ? 'none'
              : isFocused
              ? '1px solid var(--color-roles-primary)'
              : 'none',
            borderRadius: '8px',
            boxSizing: 'border-box',
            transition: 'border-color 0.15s ease, outline-color 0.15s ease, box-shadow 0.15s ease',
            ...style,
          }}
          {...inputProps}
          onBlur={handleBlur}
          onChange={handleChange}
          onFocus={handleFocus}
        />

        {showPasswordToggle && (
          <button
            type="button"
            aria-label={isPasswordVisible ? 'Hide password' : 'Show password'}
            onClick={() => setIsPasswordVisible((prev) => !prev)}
            style={{
              position: 'absolute',
              right: '8px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              padding: '4px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-roles-on-surface-variant)',
              borderRadius: '4px',
              transition: 'color 0.15s ease',
            }}
          >
            {isPasswordVisible ? (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                style={{ flexShrink: 0 }}
              >
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                style={{ flexShrink: 0 }}
              >
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        )}
      </div>

      {activeError && (
        <span
          id={errorId}
          role="alert"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontFamily: 'var(--typography-body-small-fontfamily)',
            fontSize: 'var(--typography-body-small-fontsize)',
            color: 'var(--color-roles-error)',
            marginTop: '2px',
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
          <span>{activeError}</span>
        </span>
      )}

      {helperText && !activeError && (
        <span
          id={helperId}
          style={{
            fontFamily: 'var(--typography-body-small-fontfamily)',
            fontSize: 'var(--typography-body-small-fontsize)',
            color: 'var(--color-roles-on-surface-variant)',
            marginTop: '2px',
          }}
        >
          {helperText}
        </span>
      )}
    </div>
  );
}

interface PrimaryButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  children: React.ReactNode;
}

export function PrimaryButton({
  loading,
  disabled,
  children,
  style,
  ...props
}: PrimaryButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        width: '100%',
        height: '42px',
        boxSizing: 'border-box',
        borderRadius: '8px',
        padding: '8px 16px',
        backgroundColor: disabled || loading ? 'var(--color-roles-outline-color)' : 'var(--color-roles-primary)',
        color: disabled || loading ? 'var(--color-roles-on-surface-variant)' : 'var(--color-roles-on-primary)',
        fontFamily: 'var(--typography-label-large-fontfamily)',
        fontSize: 'var(--typography-label-large-fontsize)',
        fontWeight: 'var(--typography-label-large-fontweight)',
        lineHeight: 'var(--typography-label-large-lineheight)',
        border: 'none',
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        boxShadow: disabled || loading ? 'none' : 'var(--effect-soft-shadow)',
        transition: 'background-color 0.15s ease, opacity 0.15s ease',
        ...style,
      }}
      {...props}
    >
      {loading ? (
        <>
          <span
            aria-hidden="true"
            style={{
              width: '16px',
              height: '16px',
              border: '2px solid currentColor',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              display: 'inline-block',
            }}
          />
          <span>Processing...</span>
        </>
      ) : (
        children
      )}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </button>
  );
}

export function AlertBox({
  type = 'error',
  message,
}: {
  type?: 'error' | 'success' | 'info';
  message: string;
}) {
  const bg =
    type === 'error'
      ? 'var(--color-roles-error-container)'
      : type === 'success'
      ? 'var(--color-roles-primary-container)'
      : 'var(--color-roles-surface-variant)';
  const fg =
    type === 'error'
      ? 'var(--color-roles-on-error-container)'
      : type === 'success'
      ? 'var(--color-roles-on-primary-container)'
      : 'var(--color-roles-on-surface)';
  const border =
    type === 'error'
      ? 'var(--color-roles-error)'
      : 'var(--color-roles-outline-color)';

  return (
    <div
      role={type === 'error' ? 'alert' : 'status'}
      style={{
        padding: '12px 14px',
        backgroundColor: bg,
        color: fg,
        border: `1px solid ${border}`,
        fontFamily: 'var(--typography-body-medium-fontfamily)',
        fontSize: 'var(--typography-body-medium-fontsize)',
        lineHeight: 'var(--typography-body-medium-lineheight)',
        marginBottom: '16px',
      }}
    >
      {message}
    </div>
  );
}

export function DevCredentialsHint({
  role = 'parent',
  onSelect,
}: {
  role?: 'parent' | 'staff';
  onSelect?: (email: string, pass: string) => void;
}) {
  return (
    <details
      style={{
        marginTop: '12px',
        padding: '10px 12px',
        backgroundColor: 'var(--color-roles-surface-variant)',
        border: '1px solid var(--color-roles-outline-variant)',
        fontFamily: 'var(--typography-body-small-fontfamily)',
        fontSize: 'var(--typography-body-small-fontsize)',
        color: 'var(--color-roles-on-surface-variant)',
      }}
    >
      <summary style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--color-roles-primary)' }}>
        Development Test Credentials
      </summary>
      <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {role === 'parent' ? (
          <>
            <div>
              <strong>Linked Parent (Verified):</strong> parent.linked@example.com / ParentPass2026!
              {onSelect && (
                <button
                  type="button"
                  onClick={() => onSelect('parent.linked@example.com', 'ParentPass2026!')}
                  style={{
                    marginLeft: '8px',
                    color: 'var(--color-roles-primary)',
                    textDecoration: 'underline',
                    fontSize: '11px',
                  }}
                >
                  Use
                </button>
              )}
            </div>
            <div>
              <strong>Unlinked Parent (Verified):</strong> parent.unlinked@example.com / ParentPass2026!
              {onSelect && (
                <button
                  type="button"
                  onClick={() => onSelect('parent.unlinked@example.com', 'ParentPass2026!')}
                  style={{
                    marginLeft: '8px',
                    color: 'var(--color-roles-primary)',
                    textDecoration: 'underline',
                    fontSize: '11px',
                  }}
                >
                  Use
                </button>
              )}
            </div>
            <div>
              <strong>Unverified Parent:</strong> parent.unverified@example.com / ParentPass2026!
              {onSelect && (
                <button
                  type="button"
                  onClick={() => onSelect('parent.unverified@example.com', 'ParentPass2026!')}
                  style={{
                    marginLeft: '8px',
                    color: 'var(--color-roles-primary)',
                    textDecoration: 'underline',
                    fontSize: '11px',
                  }}
                >
                  Use
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <div>
              <strong>School Staff:</strong> staff@school.ng / StaffPass2026!
              {onSelect && (
                <button
                  type="button"
                  onClick={() => onSelect('staff@school.ng', 'StaffPass2026!')}
                  style={{
                    marginLeft: '8px',
                    color: 'var(--color-roles-primary)',
                    textDecoration: 'underline',
                    fontSize: '11px',
                  }}
                >
                  Use
                </button>
              )}
            </div>
            <div>
              <strong>Owner / Admin:</strong> admin@school.ng / SchoolAdmin2026!
              {onSelect && (
                <button
                  type="button"
                  onClick={() => onSelect('admin@school.ng', 'SchoolAdmin2026!')}
                  style={{
                    marginLeft: '8px',
                    color: 'var(--color-roles-primary)',
                    textDecoration: 'underline',
                    fontSize: '11px',
                  }}
                >
                  Use
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </details>
  );
}
