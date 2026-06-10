'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { reportClientError } from '@/lib/observability/client';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // The "logged automatically" copy below is now true: report the boundary error to the
    // observability store (/api/client/error-capture → captureError, source='client').
    reportClientError({
      name: error.name,
      message: error.message,
      stack: error.stack,
      route: typeof window !== 'undefined' ? window.location.pathname : undefined,
    });
  }, [error]);

  return (
    <div className="min-h-screen bg-pitch-black flex items-center justify-center p-8">
      <div className="max-w-lg w-full border border-red-500/40 bg-red-500/5 p-8">
        <div className="hud-label text-red-400 mb-4">System Diagnostic Report</div>
        <div className="font-mono text-lg font-bold text-fl-text mb-2">[SYSTEM]: INTERNAL_FAULT</div>
        <div className="font-mono text-xs text-data-gray mb-6 leading-relaxed">
          An unhandled exception was encountered during request processing.
          Event has been logged automatically.
        </div>
        {process.env.NODE_ENV === 'development' && (
          <pre className="font-mono text-xs text-red-400/70 bg-black/40 p-4 mb-6 overflow-auto max-h-40 border border-red-500/20">
            {error.message}
          </pre>
        )}
        <div className="flex gap-4">
          <button
            onClick={reset}
            className="font-mono text-xs uppercase tracking-widest border border-blueprint-blue text-blueprint-light px-6 py-3 hover:bg-blueprint-blue/10 transition-colors"
          >
            Retry Request
          </button>
          <Link
            href="/"
            className="font-mono text-xs uppercase tracking-widest text-data-gray border border-white/10 px-6 py-3 hover:border-white/30 transition-colors"
          >
            Return to Root
          </Link>
        </div>
      </div>
    </div>
  );
}
