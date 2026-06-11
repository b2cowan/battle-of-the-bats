/**
 * observability-route-exclusions — single source of truth for API routes that are PERMANENTLY
 * excluded from observability wrapping (Mechanism B). Shared by the codemod
 * (wrap-route-observability.mjs) and the coverage tracker (check-observability-coverage.mjs) so
 * their exclusion sets can never drift — a permanently-unwrappable route must be dropped from BOTH
 * the codemod's input AND the coverage denominator, else the headline % can never reach 100%.
 *
 *   • api/dev/**                  — dev/seed-only routes (locked owner decision §13; never instrumented).
 *   • api/client/error-capture    — the error-ingest endpoint itself; wrapping it risks a feedback loop.
 */
export const OBSERVABILITY_EXCLUDE_RE = [
  /[\\/]api[\\/]dev[\\/]/,
  /[\\/]api[\\/]client[\\/]error-capture[\\/]route\.[tj]sx?$/,
];

/** True when a route-file path is permanently excluded from wrapping + coverage. */
export function isObservabilityExcluded(absPath) {
  return OBSERVABILITY_EXCLUDE_RE.some((re) => re.test(absPath));
}
