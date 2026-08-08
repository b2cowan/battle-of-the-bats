/**
 * A thrown error that already knows the HTTP answer it deserves.
 *
 * Why this exists: `withObservability` wraps every API route, and it is the only wrapper that
 * genuinely does (verified: zero unwrapped callers of `getAuthContext`). That makes it the right
 * place to turn a deep, typed failure into a response — but teaching it the NAME of one specific
 * business exception would make it a special case, and the next such error would need another edit
 * to the same infra file. So it knows this contract instead: any error carrying a status and a body
 * becomes that response. Adding a second one (rate limiting, a future suspension reason) needs zero
 * changes to the wrapper.
 *
 * Deliberately NOT a general-purpose replacement for routes returning their own responses. Throwing
 * is for failures raised deep in shared plumbing that the route above cannot reasonably be asked to
 * translate — the billing rail's whole point is that ~242 call sites should not each need a line.
 */
export abstract class HttpError extends Error {
  /** Status the wrapper should answer with. */
  abstract readonly status: number;
  /** JSON body for the response. Kept a method so subclasses can build it from their own fields. */
  abstract body(): Record<string, unknown>;

  toResponse(): Response {
    return new Response(JSON.stringify(this.body()), {
      status: this.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export function isHttpError(err: unknown): err is HttpError {
  return err instanceof HttpError;
}
