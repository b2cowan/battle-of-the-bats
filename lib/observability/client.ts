/**
 * Browser-side error reporter — posts client React/JS errors to /api/client/error-capture.
 * Best-effort, never throws. Uses sendBeacon when available (survives page unload), else a
 * keepalive fetch. Imported by the client error boundaries (app/error.tsx, app/global-error.tsx)
 * and a window error/unhandledrejection listener.
 */
export interface ClientErrorPayload {
  name?: string;
  message: string;
  stack?: string;
  route?: string;
  componentStack?: string;
}

export function reportClientError(payload: ClientErrorPayload): void {
  try {
    const route =
      payload.route ?? (typeof window !== 'undefined' ? window.location.pathname : undefined);
    const body = JSON.stringify({
      name: payload.name ?? 'Error',
      message: payload.message,
      stack: payload.stack,
      route,
      componentStack: payload.componentStack,
    });
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      navigator.sendBeacon('/api/client/error-capture', new Blob([body], { type: 'application/json' }));
    } else if (typeof fetch !== 'undefined') {
      void fetch('/api/client/error-capture', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    /* never throw from the error reporter */
  }
}
