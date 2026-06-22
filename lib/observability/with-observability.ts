/**
 * withObservability — wraps an App-Router route handler to (1) mint a requestId and seed the
 * AsyncLocalStorage request context, (2) count calls vs errors for the dashboard chart, and
 * (3) act as a returned-5xx SAFETY NET: if the handler RETURNS a 5xx that it never reported
 * itself, capture a fallback error event so no swallowed server failure is ever invisible.
 *
 * It does NOT capture thrown errors here — Next's instrumentation.ts onRequestError captures
 * uncaught throws globally (capturing here too would double-count). The safety net is for the
 * complementary path onRequestError can't see: a handler that catches its own error and returns a
 * 5xx. Routes that call captureError() in their catch get RICH attribution (real error + stack)
 * and set the request's `captured` flag, so the net skips them (dedup, no double-capture).
 *
 * The generic preserves the wrapped handler's exact signature so Next's route-type validator and
 * the (req, { params }) calling convention are unaffected.
 */
import { randomUUID } from 'node:crypto';
import { runWithRequestContext, getRequestContext } from './request-context';
import { recordRequest } from './metrics';
import { captureError } from './capture';

type AnyRouteHandler = (...args: never[]) => Promise<Response> | Response;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function withObservability<T extends AnyRouteHandler>(handler: T, opts: { route: string }): T {
  const wrapped = (...args: Parameters<T>): Promise<Response> => {
    const req = args[0] as unknown as Request | undefined;
    const method = req && typeof req.method === 'string' ? req.method : 'GET';
    // Adopt an upstream-minted id when present (proxy.ts stamps a UUID x-request-id on every /api
    // request) so the id the client reads off the response equals the one stored on error_events —
    // one mint site, no mismatch. Only accept a well-formed UUID; otherwise mint our own.
    const incoming = req?.headers?.get?.('x-request-id');
    const requestId = incoming && UUID_RE.test(incoming) ? incoming : randomUUID();
    return runWithRequestContext(
      { requestId, route: opts.route, method, source: 'server' },
      async () => {
        try {
          const callable = handler as unknown as (...a: unknown[]) => Promise<Response> | Response;
          const res = (await callable(...args)) as Response;
          const status = res && typeof res.status === 'number' ? res.status : 200;
          recordRequest(opts.route, status >= 500);
          // Safety net: the handler RETURNED a 5xx without reporting it (a swallowed error —
          // caught + returned, so onRequestError never sees it). Capture a fallback event so it's
          // visible in observability and can alert. Skipped when the route already captured (rich
          // attribution wins). Awaited (Amplify can freeze a detached promise once the handler
          // returns); captureError never throws, so this can't break the response path.
          if (status >= 500 && !getRequestContext()?.captured) {
            await captureError(new Error(`Route returned HTTP ${status}`), {
              route: opts.route,
              method,
              statusCode: status,
              source: 'server',
              requestId,
              title: `HTTP ${status} (returned) @ ${opts.route}`,
              requestContext: { swallowed: true },
            });
          }
          // Surface the id so the client can attach it to a feedback report (Phase 3 deep-link).
          // Guarded: a plain Response could have immutable headers — this wrapper must never throw.
          try { res?.headers?.set?.('x-request-id', requestId); } catch { /* immutable headers */ }
          return res;
        } catch (err) {
          recordRequest(opts.route, true);
          throw err; // onRequestError (instrumentation.ts) captures uncaught throws globally
        }
      },
    );
  };
  return wrapped as unknown as T;
}
