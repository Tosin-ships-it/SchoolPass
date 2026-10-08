'use client';

import React from 'react';

interface FormFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  error?: string;
  helperText?: string;
}

export function FormField({
  id,
  label,
  error,
  helperText,
  style,
  ...inputProps
}: FormFieldProps) {
  const errorId = error ? `${id}-error` : undefined;
  const helperId = helperText ? `${id}-helper` : undefined;

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

      <input
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={[errorId, helperId].filter(Boolean).join(' ') || undefined}
        style={{
          width: '100%',
          padding: '12px 14px',
          fontFamily: 'var(--typography-body-large-fontfamily)',
          fontSize: 'var(--typography-body-large-fontsize)',
          lineHeight: 'var(--typography-body-large-lineheight)',
          color: 'var(--color-roles-on-surface)',
          backgroundColor: 'var(--color-roles-surface)',
          border: error
            ? '1.5px solid var(--color-roles-error)'
            : '1px solid var(--color-roles-outline-color)',
          boxSizing: 'border-box',
          outline: 'none',
          transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
          ...style,
        }}
        {...inputProps}
      />

      {error && (
        <span
          id={errorId}
          role="alert"
          style={{
            fontFamily: 'var(--typography-body-small-fontfamily)',
            fontSize: 'var(--typography-body-small-fontsize)',
            color: 'var(--color-roles-error)',
            marginTop: '2px',
          }}
        >
          {error}
        </span>
      )}

      {helperText && !error && (
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
        padding: '12px 20px',
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
