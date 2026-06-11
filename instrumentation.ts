/**
 * Next.js instrumentation — global server-error capture safety net.
 *
 * `onRequestError` fires for UNCAUGHT errors that bubble out of route handlers and for React
 * Server Component render errors — things our per-route catch blocks never see. Handled 5xx
 * responses still go through captureError() in each route's own catch block (richer attribution).
 *
 * Node-runtime only: the Edge runtime can't reach supabaseAdmin. The capture module is imported
 * dynamically so the Edge bundle never pulls it in.
 */
import type { Instrumentation } from 'next';

export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  try {
    const { captureError } = await import('./lib/observability/capture');
    // proxy.ts stamped x-request-id on the request; carry it through so error_events.request_id
    // matches the id the client stashed off the response (the feedback bug→error deep-link). This
    // path has no AsyncLocalStorage context (the throw already unwound it / RSC render), so without
    // this the id would be null for essentially every uncaught/RSC error.
    const rawRid = request?.headers?.['x-request-id'];
    const requestId = Array.isArray(rawRid) ? rawRid[0] : rawRid;
    await captureError(err, {
      route: context?.routePath || request?.path,
      method: request?.method,
      source: 'server',
      statusCode: 500,
      requestId: requestId ?? null,
      requestContext: {
        routeType: context?.routeType,
        renderSource: context?.renderSource,
        path: request?.path,
      },
    });
  } catch {
    /* instrumentation must never throw */
  }
};
