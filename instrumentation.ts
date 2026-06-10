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
    await captureError(err, {
      route: context?.routePath || request?.path,
      method: request?.method,
      source: 'server',
      statusCode: 500,
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
