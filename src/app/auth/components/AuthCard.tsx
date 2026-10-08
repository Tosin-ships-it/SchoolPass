'use client';

import React from 'react';
import Link from 'next/link';

interface AuthCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
}

export function AuthCard({
  title,
  subtitle,
  children,
  footer,
  backHref = '/',
  backLabel = 'Back to Home',
}: AuthCardProps) {
  return (
    <div
      style={{
        minHeight: '100dvh',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        backgroundColor: 'var(--color-roles-background)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '440px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}
      >
        {/* Navigation Back Link */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link
            href={backHref}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontFamily: 'var(--typography-label-large-fontfamily)',
              fontSize: 'var(--typography-label-large-fontsize)',
              fontWeight: 'var(--typography-label-large-fontweight)',
              color: 'var(--color-roles-primary)',
              textDecoration: 'none',
              padding: '6px 0',
            }}
          >
            <span aria-hidden="true">&larr;</span> {backLabel}
          </Link>

          <span
            style={{
              fontFamily: 'var(--typography-title-medium-fontfamily)',
              fontSize: 'var(--typography-title-medium-fontsize)',
              fontWeight: 700,
              color: 'var(--color-roles-primary)',
              letterSpacing: '-0.3px',
            }}
          >
            SchoolPass
          </span>
        </div>

        {/* Main Card */}
        <div
          style={{
            backgroundColor: 'var(--color-roles-surface)',
            border: '1px solid var(--color-roles-outline-color)',
            boxShadow: 'var(--effect-soft-shadow)',
            padding: '32px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }}
        >
          <header style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <h1
              style={{
                fontFamily: 'var(--typography-headline-small-fontfamily)',
                fontSize: 'var(--typography-headline-small-fontsize)',
                fontWeight: 'var(--typography-headline-small-fontweight)',
                lineHeight: 'var(--typography-headline-small-lineheight)',
                color: 'var(--color-roles-on-surface)',
                margin: 0,
              }}
            >
              {title}
            </h1>
            {subtitle && (
              <p
                style={{
                  fontFamily: 'var(--typography-body-medium-fontfamily)',
                  fontSize: 'var(--typography-body-medium-fontsize)',
                  color: 'var(--color-roles-on-surface-variant)',
                  margin: 0,
                  lineHeight: 'var(--typography-body-medium-lineheight)',
                }}
              >
                {subtitle}
              </p>
            )}
          </header>

          <main>{children}</main>

          {footer && (
            <footer
              style={{
                borderTop: '1px solid var(--color-roles-outline-variant)',
                paddingTop: '16px',
                marginTop: '4px',
              }}
            >
              {footer}
            </footer>
          )}
        </div>
      </div>
    </div>
  );
}
