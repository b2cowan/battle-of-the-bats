/**
 * Shared, dependency-free feedback logic (Phase 3): taxonomy + route→category default + the
 * /api/feedback validation & throttle gate. Self-contained (no relative imports) so it loads
 * cleanly from client widgets, the server route, AND the node:test runner alike. The route owns
 * the stateful rate-limit maps and calls the pure helpers here.
 */

export const FEEDBACK_TYPES = ['bug', 'feature', 'feedback'] as const;
export type FeedbackType = (typeof FEEDBACK_TYPES)[number];

export const FEEDBACK_CATEGORIES = [
  'Tournaments',
  'Coaches',
  'Registrations',
  'Accounting',
  'Billing',
  'Other',
] as const;
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

export const MAX_TITLE_CHARS = 150;
export const MAX_BODY_CHARS = 4000;

/** Best-guess default category from the current route, so the dropdown pre-selects sensibly. */
export function categoryFromRoute(path: string | null | undefined): FeedbackCategory {
  const p = (path ?? '').toLowerCase();
  if (p.includes('/accounting') || p.includes('/budget') || p.includes('/ledger') || p.includes('/dues')) return 'Accounting';
  if (p.includes('/billing') || p.includes('/checkout') || p.includes('/plan') || p.includes('/subscription')) return 'Billing';
  if (p.includes('/registration') || p.includes('/register')) return 'Registrations';
  if (p.includes('/coaches') || p.includes('/coach')) return 'Coaches';
  if (
    p.includes('/tournament') ||
    p.includes('/scorekeeper') ||
    p.includes('/check-in') ||
    p.includes('/schedule') ||
    p.includes('/standings')
  ) {
    return 'Tournaments';
  }
  return 'Other';
}

export type ValidatedFeedback = {
  type: FeedbackType;
  category: string;
  title: string | null;
  body: string;
  context: Record<string, unknown>;
};

export type ValidationResult =
  | { ok: true; value: ValidatedFeedback }
  | { ok: false; error: string };

/** Validate + normalize a raw feedback payload. body is the only required field; type must be valid. */
export function validateFeedbackInput(raw: unknown): ValidationResult {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'Invalid payload.' };
  }
  const r = raw as Record<string, unknown>;

  const type = r.type;
  if (typeof type !== 'string' || !(FEEDBACK_TYPES as readonly string[]).includes(type)) {
    return { ok: false, error: 'Invalid feedback type.' };
  }

  const bodyRaw = typeof r.body === 'string' ? r.body.trim() : '';
  if (!bodyRaw) return { ok: false, error: 'A description is required.' };

  const title =
    typeof r.title === 'string' && r.title.trim()
      ? r.title.trim().slice(0, MAX_TITLE_CHARS)
      : null;

  const category =
    typeof r.category === 'string' && (FEEDBACK_CATEGORIES as readonly string[]).includes(r.category)
      ? r.category
      : 'Other';

  const context =
    r.context && typeof r.context === 'object' && !Array.isArray(r.context)
      ? (r.context as Record<string, unknown>)
      : {};

  return {
    ok: true,
    value: { type: type as FeedbackType, category, title, body: bodyRaw.slice(0, MAX_BODY_CHARS), context },
  };
}

/**
 * True when a request for `key` should be throttled, given the map of last-accepted timestamps.
 * Pure — does NOT mutate the map; the caller records the timestamp only when it accepts the write.
 */
export function isThrottled(
  map: Map<string, number>,
  key: string,
  now: number,
  minIntervalMs: number,
): boolean {
  return now - (map.get(key) ?? 0) < minIntervalMs;
}
