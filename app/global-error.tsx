'use client';

import { useEffect } from 'react';
import { reportClientError } from '@/lib/observability/client';

// Root error boundary — catches errors thrown in the root layout itself (where app/error.tsx
// can't reach). Must render its own <html>/<body>. Styles are inline because globals.css may
// not have loaded when the root fails.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportClientError({
      name: error.name,
      message: error.message,
      stack: error.stack,
      route: typeof window !== 'undefined' ? window.location.pathname : undefined,
    });
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          background: '#0a0a0a',
          color: '#e5e5e5',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          padding: '2rem',
        }}
      >
        <div style={{ maxWidth: '32rem', width: '100%', border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.05)', padding: '2rem' }}>
          <div style={{ color: '#f87171', fontSize: '0.7rem', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '1rem' }}>
            System Diagnostic Report
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>[SYSTEM]: FATAL_FAULT</div>
          <div style={{ fontSize: '0.78rem', color: '#9ca3af', marginBottom: '1.5rem', lineHeight: 1.6 }}>
            A fault was encountered before the interface could load. The event has been logged automatically.
          </div>
          <button
            onClick={reset}
            style={{
              fontSize: '0.72rem',
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
              border: '1px solid #2563eb',
              color: '#93c5fd',
              background: 'transparent',
              padding: '0.75rem 1.5rem',
              cursor: 'pointer',
            }}
          >
            Retry Request
          </button>
        </div>
      </body>
    </html>
  );
}
