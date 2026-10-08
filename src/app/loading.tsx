export default function Loading() {
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
      }}
    >
      <div
        role="status"
        aria-label="Loading"
        style={{
          width: 'var(--typography-headline-large-lineheight)',
          height: 'var(--typography-headline-large-lineheight)',
          borderWidth: '3px',
          borderStyle: 'solid',
          borderColor: 'var(--color-roles-outline-variant)',
          borderTopColor: 'var(--color-roles-primary)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }}
      />
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </main>
  );
}
