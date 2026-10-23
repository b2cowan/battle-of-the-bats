'use client';

import { useEffect } from 'react';
import { reportClientError } from '@/lib/observability/client';
import SystemScreen, { SystemAction } from '@/components/shared/SystemScreen';

// `retry` (stable in Next 16.3) re-fetches and re-renders the boundary's children; `reset` only cleared the error state,
// which left a failed server render showing the same failure.
export default function PageError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    // The "logged automatically" copy below is true: report the boundary error to the
    // observability store (/api/client/error-capture → captureError, source='client').
    reportClientError({
      name: error.name,
      message: error.message,
      stack: error.stack,
      route: typeof window !== 'undefined' ? window.location.pathname : undefined,
    });
  }, [error]);

  return (
    <SystemScreen icon="alert" title="Something went wrong on our side"
      devDetail={process.env.NODE_ENV === 'development' ? error.message : undefined}
      actions={(
        <>
          <SystemAction kind="primary" onClick={() => retry()}>Try again</SystemAction>
          <SystemAction kind="secondary" href="/discover">Go to Home</SystemAction>
        </>
      )}>
      We’ve logged it automatically. Try again, and if it keeps happening, go back to Home.
    </SystemScreen>
  );
}
