/**
 * withObservability — wraps an App-Router route handler to (1) mint a requestId and seed the
 * AsyncLocalStorage request context, and (2) count calls vs errors for the dashboard chart.
 *
 * It does NOT capture thrown errors itself — Next's instrumentation.ts onRequestError captures
 * uncaught throws globally (capturing here too would double-count). Routes that catch their own
 * errors and return a 5xx call captureError() in their catch block for rich attribution.
 *
 * The generic preserves the wrapped handler's exact signature so Next's route-type validator and
 * the (req, { params }) calling convention are unaffected.
 */
import { randomUUID } from 'node:crypto';
import { runWithRequestContext } from './request-context';
import { recordRequest } from './metrics';

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
