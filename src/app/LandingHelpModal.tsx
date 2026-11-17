'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

/**
 * Easily replaceable configuration for school support channels.
 */
export const SUPPORT_CONFIG = {
  // Temporary testing number; can be overridden via NEXT_PUBLIC_FRONT_DESK_WHATSAPP
  WHATSAPP_NUMBER: '+2348101724228',
  WHATSAPP_PREFILLED_MESSAGE: 'Hello, I need assistance with SchoolPass.',
  // Temporary testing support email address; easily replaceable
  SCHOOL_EMAIL: 'schoolpass511@gmail.com',
} as const;

interface LandingHelpModalProps {
  whatsappNumber?: string;
  schoolEmail?: string;
}

export function LandingHelpModal({
  whatsappNumber = SUPPORT_CONFIG.WHATSAPP_NUMBER,
  schoolEmail = SUPPORT_CONFIG.SCHOOL_EMAIL,
}: LandingHelpModalProps) {
  const activeEmail = schoolEmail || SUPPORT_CONFIG.SCHOOL_EMAIL;
  const [isOpen, setIsOpen] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const modalCardRef = useRef<HTMLDivElement | null>(null);

  // Keyboard Escape listener & focus management
  useEffect(() => {
    if (!isOpen) return;

    // Save previous active element to restore focus when closed
    const prevActiveElement = document.activeElement as HTMLElement | null;

    // Focus close button on open
    const timer = setTimeout(() => {
      closeBtnRef.current?.focus();
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsOpen(false);
      }

      // Accessible Tab focus trap
      if (e.key === 'Tab' && modalCardRef.current) {
        const focusableElements = modalCardRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    // Prevent background scrolling while modal is open
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
      // Restore focus to floating trigger button
      if (triggerRef.current) {
        triggerRef.current.focus();
      } else if (prevActiveElement) {
        prevActiveElement.focus();
      }
    };
  }, [isOpen]);

  // Clean WhatsApp number to digits only (stripping +, spaces, dashes)
  const cleanNumber = whatsappNumber ? whatsappNumber.replace(/[^0-9]/g, '') : '';
  const prefilledText = encodeURIComponent(SUPPORT_CONFIG.WHATSAPP_PREFILLED_MESSAGE);
  const whatsappUrl = cleanNumber
    ? `https://wa.me/${cleanNumber}?text=${prefilledText}`
    : null;

  // Copy email to clipboard with user feedback
  const handleCopyEmail = async () => {
    if (!activeEmail) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(activeEmail);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = activeEmail;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    } catch {
      setCopiedEmail(false);
    }
  };

  return (
    <>
      {/* ========================================================
          1. FLOATING HELP BUTTON
          ======================================================== */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Need Help?"
        title="Need Help?"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls="sp-help-modal"
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 9000,
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          backgroundColor: 'var(--color-roles-primary)',
          color: 'var(--color-roles-on-primary)',
          border: 'none',
          boxShadow: '0 4px 16px rgba(8, 126, 139, 0.45), var(--effect-medium-shadow)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'transform 0.18s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.18s ease, background-color 0.15s ease',
          outline: 'none',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px) scale(1.05)';
          e.currentTarget.style.boxShadow = '0 6px 20px rgba(8, 126, 139, 0.55), var(--effect-medium-shadow)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0) scale(1)';
          e.currentTarget.style.boxShadow = '0 4px 16px rgba(8, 126, 139, 0.45), var(--effect-medium-shadow)';
        }}
        onFocus={(e) => {
          e.currentTarget.style.outline = '3px solid var(--color-roles-primary-fixed-dim, #087e8b)';
          e.currentTarget.style.outlineOffset = '3px';
        }}
        onBlur={(e) => {
          e.currentTarget.style.outline = 'none';
        }}
      >
        <svg
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </button>

      {/* ========================================================
          2. HELP MODAL BACKDROP & DIALOG
          ======================================================== */}
      {isOpen && (
        <div
          role="presentation"
          onClick={(e) => {
            // Close when clicking directly on the backdrop
            if (e.target === e.currentTarget) {
              setIsOpen(false);
            }
          }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100vw',
            height: '100vh',
            height: '100dvh',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(3px)',
            zIndex: 9500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            boxSizing: 'border-box',
          }}
        >
          <div
            id="sp-help-modal"
            ref={modalCardRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="sp-help-modal-title"
            style={{
              backgroundColor: 'var(--color-roles-surface)',
              border: '1px solid var(--color-roles-outline-color)',
              borderRadius: '0.75rem',
              boxShadow: 'var(--effect-medium-shadow), 0 20px 25px -5px rgba(0, 0, 0, 0.2)',
              width: '100%',
              maxWidth: '520px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              padding: '24px',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: '12px',
              }}
            >
              <div>
                <h3
                  id="sp-help-modal-title"
                  style={{
                    margin: 0,
                    fontFamily: 'var(--typography-headline-small-fontfamily)',
                    fontSize: 'var(--typography-headline-small-fontsize)',
                    fontWeight: 700,
                    color: 'var(--color-roles-on-surface)',
                    lineHeight: 1.25,
                  }}
                >
                  Need Help?
                </h3>
                <p
                  style={{
                    margin: '6px 0 0 0',
                    fontFamily: 'var(--typography-body-medium-fontfamily)',
                    fontSize: 'var(--typography-body-medium-fontsize)',
                    color: 'var(--color-roles-on-surface-variant)',
                    lineHeight: 'var(--typography-body-medium-lineheight)',
                  }}
                >
                  What do you need help with? Choose an option to get started.
                </p>
              </div>

              <button
                ref={closeBtnRef}
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close help modal"
                style={{
                  background: 'none',
                  border: '1px solid var(--color-roles-outline-variant)',
                  borderRadius: '0.375rem',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'var(--color-roles-on-surface-variant)',
                  fontSize: '18px',
                  lineHeight: 1,
                  padding: 0,
                  flexShrink: 0,
                  transition: 'background-color 0.15s ease, color 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-roles-surface-variant)';
                  e.currentTarget.style.color = 'var(--color-roles-on-surface)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--color-roles-on-surface-variant)';
                }}
              >
                &times;
              </button>
            </div>

            {/* Support Options List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Option 1: Registration assistance */}
              <div
                style={{
                  backgroundColor: 'var(--color-roles-surface-variant)',
                  border: '1px solid var(--color-roles-outline-variant)',
                  borderRadius: '0.5rem',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div
                  style={{
                    fontFamily: 'var(--typography-title-medium-fontfamily)',
                    fontSize: 'var(--typography-title-medium-fontsize)',
                    fontWeight: 700,
                    color: 'var(--color-roles-on-surface)',
                  }}
                >
                  1. Registration assistance
                </div>
                <p
                  style={{
                    margin: 0,
                    fontFamily: 'var(--typography-body-medium-fontfamily)',
                    fontSize: 'var(--typography-body-medium-fontsize)',
                    color: 'var(--color-roles-on-surface-variant)',
                    lineHeight: 'var(--typography-body-medium-lineheight)',
                  }}
                >
                  New to SchoolPass? Create your parent account, verify your email and provide your child&apos;s official Student Number to request access to their records.
                </p>
                <div style={{ marginTop: '4px' }}>
                  <Link
                    href="/auth?view=register"
                    onClick={() => setIsOpen(false)}
                    className="sp-text-link"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      color: 'var(--color-roles-primary)',
                      fontFamily: 'var(--typography-label-large-fontfamily)',
                      fontSize: 'var(--typography-label-large-fontsize)',
                      fontWeight: 600,
                      textDecoration: 'none',
                    }}
                  >
                    Go to Registration &rarr;
                  </Link>
                </div>
              </div>

              {/* Option 2: Account access */}
              <div
                style={{
                  backgroundColor: 'var(--color-roles-surface-variant)',
                  border: '1px solid var(--color-roles-outline-variant)',
                  borderRadius: '0.5rem',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div
                  style={{
                    fontFamily: 'var(--typography-title-medium-fontfamily)',
                    fontSize: 'var(--typography-title-medium-fontsize)',
                    fontWeight: 700,
                    color: 'var(--color-roles-on-surface)',
                  }}
                >
                  2. Account access
                </div>
                <p
                  style={{
                    margin: 0,
                    fontFamily: 'var(--typography-body-medium-fontfamily)',
                    fontSize: 'var(--typography-body-medium-fontsize)',
                    color: 'var(--color-roles-on-surface-variant)',
                    lineHeight: 'var(--typography-body-medium-lineheight)',
                  }}
                >
                  Already registered? Get help signing in or accessing your parent portal.
                </p>
                <div style={{ marginTop: '4px' }}>
                  <Link
                    href="/auth?view=login"
                    onClick={() => setIsOpen(false)}
                    className="sp-text-link"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      color: 'var(--color-roles-primary)',
                      fontFamily: 'var(--typography-label-large-fontfamily)',
                      fontSize: 'var(--typography-label-large-fontsize)',
                      fontWeight: 600,
                      textDecoration: 'none',
                    }}
                  >
                    Go to Sign In &rarr;
                  </Link>
                </div>
              </div>

              {/* Option 3: Contact the School */}
              <div
                style={{
                  backgroundColor: 'var(--color-roles-surface-variant)',
                  border: '1px solid var(--color-roles-outline-variant)',
                  borderRadius: '0.5rem',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div>
                  <div
                    style={{
                      fontFamily: 'var(--typography-title-medium-fontfamily)',
                      fontSize: 'var(--typography-title-medium-fontsize)',
                      fontWeight: 700,
                      color: 'var(--color-roles-on-surface)',
                    }}
                  >
                    3. Contact the School
                  </div>
                  <p
                    style={{
                      margin: '4px 0 0 0',
                      fontFamily: 'var(--typography-body-medium-fontfamily)',
                      fontSize: 'var(--typography-body-medium-fontsize)',
                      color: 'var(--color-roles-on-surface-variant)',
                      lineHeight: 'var(--typography-body-medium-lineheight)',
                    }}
                  >
                    For assistance with student linking, fees, payments, records or other school-related enquiries.
                  </p>
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    paddingTop: '8px',
                    borderTop: '1px solid var(--color-roles-outline-variant)',
                  }}
                >
                  {/* WhatsApp Support Option */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span
                      style={{
                        fontFamily: 'var(--typography-label-medium-fontfamily)',
                        fontSize: 'var(--typography-label-medium-fontsize)',
                        fontWeight: 700,
                        color: 'var(--color-roles-on-surface)',
                      }}
                    >
                      WhatsApp Support
                    </span>
                    {whatsappUrl ? (
                      <div>
                        <a
                          href={whatsappUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="sp-btn-primary"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            backgroundColor: 'var(--color-roles-primary)',
                            color: 'var(--color-roles-on-primary)',
                            fontFamily: 'var(--typography-label-large-fontfamily)',
                            fontSize: 'var(--typography-label-large-fontsize)',
                            fontWeight: 600,
                            padding: '10px 16px',
                            borderRadius: '0.5rem',
                            textDecoration: 'none',
                            boxShadow: 'var(--effect-soft-shadow)',
                          }}
                        >
                          <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                          </svg>
                          <span>Chat on WhatsApp</span>
                        </a>
                      </div>
                    ) : (
                      <span
                        style={{
                          fontSize: 'var(--typography-body-small-fontsize)',
                          color: 'var(--color-roles-on-surface-variant)',
                          fontStyle: 'italic',
                        }}
                      >
                        WhatsApp support contact has not been configured.
                      </span>
                    )}
                  </div>

                  {/* School Email Option */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span
                      style={{
                        fontFamily: 'var(--typography-label-medium-fontfamily)',
                        fontSize: 'var(--typography-label-medium-fontsize)',
                        fontWeight: 700,
                        color: 'var(--color-roles-on-surface)',
                      }}
                    >
                      School Email
                    </span>
                    {activeEmail ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <a
                          href={`mailto:${activeEmail}`}
                          className="sp-text-link"
                          style={{
                            fontFamily: 'var(--typography-body-medium-fontfamily)',
                            fontSize: 'var(--typography-body-medium-fontsize)',
                            color: 'var(--color-roles-primary)',
                            fontWeight: 600,
                            textDecoration: 'underline',
                          }}
                        >
                          {activeEmail}
                        </a>
                        <button
                          type="button"
                          onClick={handleCopyEmail}
                          aria-label={copiedEmail ? 'Email address copied' : `Copy school email address ${activeEmail}`}
                          style={{
                            padding: '4px 10px',
                            backgroundColor: copiedEmail
                              ? 'var(--primitives-color-palettes-primary-primary20, #004f57)'
                              : 'var(--color-roles-surface)',
                            color: copiedEmail
                              ? 'var(--color-roles-on-primary, #ffffff)'
                              : 'var(--color-roles-on-surface)',
                            border: '1px solid var(--color-roles-outline-variant)',
                            borderRadius: '0.375rem',
                            fontFamily: 'var(--typography-label-medium-fontfamily)',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            transition: 'background-color 0.15s ease, color 0.15s ease',
                          }}
                        >
                          {copiedEmail ? 'Email copied' : 'Copy'}
                        </button>
                      </div>
                    ) : (
                      <span
                        style={{
                          fontSize: 'var(--typography-body-small-fontsize)',
                          color: 'var(--color-roles-on-surface-variant)',
                          fontStyle: 'italic',
                        }}
                      >
                        The official school email address has not been configured yet.
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
