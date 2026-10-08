'use client';

import { ERROR_STRINGS } from '@/lib/errors/strings';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ reset }: ErrorProps) {
  return (
    <main
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100dvh',
        width: '100%',
        backgroundColor: 'var(--color-roles-background)',
        color: 'var(--color-roles-on-background)',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          maxWidth: '400px',
          width: '90%',
          boxShadow: 'var(--effect-soft-shadow)',
          backgroundColor: 'var(--color-roles-surface)',
          padding: 'var(--typography-headline-large-lineheight)',
        }}
      >
        <p
          style={{
            fontFamily: 'var(--typography-body-large-fontfamily)',
            fontSize: 'var(--typography-body-large-fontsize)',
            fontWeight: 'var(--typography-body-large-fontweight)',
            lineHeight: 'var(--typography-body-large-lineheight)',
            color: 'var(--color-roles-on-surface)',
            marginBottom: 'var(--typography-body-large-lineheight)',
          }}
        >
          {ERROR_STRINGS.GENERIC_RETRY}
        </p>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            backgroundColor: 'var(--color-roles-primary)',
            color: 'var(--color-roles-on-primary)',
            fontFamily: 'var(--typography-label-large-fontfamily)',
            fontSize: 'var(--typography-label-large-fontsize)',
            fontWeight: 'var(--typography-label-large-fontweight)',
            lineHeight: 'var(--typography-label-large-lineheight)',
            paddingTop: 'var(--typography-body-small-fontsize)',
            paddingBottom: 'var(--typography-body-small-fontsize)',
            paddingLeft: 'var(--typography-body-large-fontsize)',
            paddingRight: 'var(--typography-body-large-fontsize)',
            width: '100%',
          }}
        >
          Try again
        </button>
      </div>
    </main>
  );
}
