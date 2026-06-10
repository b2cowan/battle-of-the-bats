/**
 * Error fingerprinting — collapses identical errors into one issue (error_group) at write time.
 *
 * fingerprint = sha256(route + errorName + topNormalizedStackFrames) truncated to a stable
 * 16-char hex. Stack frames are normalized (file locations, line:col, uuids, hex, digit runs
 * stripped) so the same bug fingerprints the same across requests/builds. The normalization
 * regex is the tuning knob: too aggressive merges distinct bugs, too loose splits one — its
 * behavior is pinned by tests/unit/observability.test.ts.
 */
import { createHash } from 'node:crypto';

const TOP_FRAMES = 5;

function normalizeFrame(frame: string): string {
  return frame
    // collapse parenthesized file locations: (C:\...:12:5) / (/app/foo.js:1:2) / (webpack://…)
    .replace(/\([^)]*\)/g, '()')
    // any remaining :line:col
    .replace(/:\d+:\d+/g, '')
    // uuids
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<id>')
    // long hex runs (chunk hashes, ids)
    .replace(/\b[0-9a-f]{16,}\b/gi, '<hex>')
    // standalone digit runs
    .replace(/\b\d+\b/g, '<n>')
    .trim();
}

/** Normalize a stack trace into stable, fingerprint-friendly top frames. */
export function normalizeStack(stack: string | undefined | null): string {
  if (!stack) return '';
  const lines = stack.split('\n').map(l => l.trim()).filter(Boolean);
  const frames = lines.filter(l => l.startsWith('at '));
  const picked = (frames.length ? frames : lines).slice(0, TOP_FRAMES);
  return picked.map(normalizeFrame).join('\n');
}

/** Stable 16-hex fingerprint for grouping a given (route, errorName, stack). */
export function fingerprint(input: {
  route?: string | null;
  errorName?: string | null;
  stack?: string | null;
}): string {
  const basis = [
    (input.route ?? '').trim(),
    (input.errorName ?? 'Error').trim(),
    normalizeStack(input.stack),
  ].join('|');
  return createHash('sha256').update(basis).digest('hex').slice(0, 16);
}
