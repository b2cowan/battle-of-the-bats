/**
 * Per-request observability context, carried via Node AsyncLocalStorage so deeply-nested
 * lib/db.ts calls can captureError() without threading ctx through every signature.
 *
 * Seeded by withObservability() with {requestId, route, method}; enriched with auth identity
 * by setRequestAuth() once a route resolves getAuthContext(). VERIFIED: zero routes use the
 * edge runtime, so AsyncLocalStorage is available everywhere in this codebase.
 */
import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestObservabilityContext {
  requestId: string;
  route?: string;
  method?: string;
  source?: 'server' | 'client';
  orgId?: string | null;
  orgSlug?: string | null;
  userId?: string | null;
  userEmail?: string | null;
  userRole?: string | null;
}

const storage = new AsyncLocalStorage<RequestObservabilityContext>();

export function runWithRequestContext<T>(seed: RequestObservabilityContext, fn: () => T): T {
  return storage.run(seed, fn);
}

export function getRequestContext(): RequestObservabilityContext | undefined {
  return storage.getStore();
}

/**
 * Enrich the active request context with auth identity once it's resolved.
 * No-op outside a request context (e.g. a route that isn't wrapped yet).
 */
export function setRequestAuth(auth: {
  orgId?: string | null;
  orgSlug?: string | null;
  userId?: string | null;
  userEmail?: string | null;
  userRole?: string | null;
}): void {
  const store = storage.getStore();
  if (!store) return;
  if (auth.orgId !== undefined) store.orgId = auth.orgId;
  if (auth.orgSlug !== undefined) store.orgSlug = auth.orgSlug;
  if (auth.userId !== undefined) store.userId = auth.userId;
  if (auth.userEmail !== undefined) store.userEmail = auth.userEmail;
  if (auth.userRole !== undefined) store.userRole = auth.userRole;
}
