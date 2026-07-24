/**
 * Observability (Phase 1) — server entry point.
 * Error tracking + request metrics for the platform-admin notification center.
 * See docs/projects/active/OBSERVABILITY_ERROR_TRACKING_PLAN.md.
 *
 * NOTE: the browser reporter lives in ./client (import it directly from client components).
 */
export { captureError, captureAndJson } from './capture';
export type { CaptureOptions, Severity } from './capture';
export { withObservability } from './with-observability';
export { setRequestAuth, getRequestContext, runWithRequestContext } from './request-context';
export { recordRequest, flush as flushRequestMetrics } from './metrics';
export { fingerprint, normalizeStack } from './fingerprint';
export { redactContext, redactValue } from './redact';
export { observabilityEnv } from './env';
export type { ObservabilityEnv } from './env';
