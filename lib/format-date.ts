/**
 * Platform-admin date formatting — single source of truth.
 *
 * The console used to render dates ~17 different ways (some absolute, some
 * relative, one missing the year, one with a buggy API call). This module
 * establishes one consistent rule, applied by date *semantics* rather than
 * a blanket relativize:
 *
 *   • fmtAbsoluteDate / fmtAbsoluteDateTime — forensic / legal / precision
 *     timestamps that must ALWAYS show the exact date (audit log events,
 *     override created/revoked, feedback submitted, email sent, change-request
 *     history). Never relativized.
 *
 *   • fmtSince — "freshness" signals where at-a-glance recency helps
 *     (last sign-in, last seen, last admin visit, member last activity).
 *     Renders relative ("3d ago") when within RELATIVE_THRESHOLD_DAYS, then
 *     flips to an absolute date beyond it.
 *
 *   • fmtDaysLeft — future deadline suffix ("(15d left)") for retention /
 *     override-expiry style fields.
 *
 * Locale: operator's browser locale via en-CA (matches prior behavior). We do
 * NOT pin to America/Toronto — platform-admin is internal operator tooling and
 * pinning would reintroduce server/client render mismatch.
 *
 * Hydration note: fmtSince / fmtDaysLeft read the current clock (Date.now()),
 * so they are time-dependent and must only be called from CLIENT components.
 * Server components must use the absolute formatters. (The 6 server components
 * that render dates all use absolute fields, so this is naturally satisfied.)
 */

/** Days within which a "freshness" timestamp renders relative instead of absolute. */
export const RELATIVE_THRESHOLD_DAYS = 7;

const DATE_OPTS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
};

const DATE_TIME_OPTS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
};

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Absolute date only — "Jun 4, 2026". Safe in server and client components.
 * Returns `fallback` (default "—") for null/invalid input.
 */
export function fmtAbsoluteDate(
  value: string | Date | null | undefined,
  fallback = '—',
): string {
  const d = toDate(value);
  return d ? d.toLocaleDateString('en-CA', DATE_OPTS) : fallback;
}

/**
 * Absolute date + time — "Jun 4, 2026, 3:00 p.m.". Safe in server and client
 * components. Use for forensic/legal/precision timestamps. Returns `fallback`
 * (default "—") for null/invalid input.
 */
export function fmtAbsoluteDateTime(
  value: string | Date | null | undefined,
  fallback = '—',
): string {
  const d = toDate(value);
  return d ? d.toLocaleString('en-CA', DATE_TIME_OPTS) : fallback;
}

/**
 * "Freshness" formatter — relative when recent, absolute when older.
 * Returns "just now" / "Xm ago" / "Xh ago" / "Xd ago" within
 * RELATIVE_THRESHOLD_DAYS, then an absolute date beyond it.
 *
 * CLIENT-ONLY: reads Date.now(). Pair with `fmtAbsoluteDateTime(value)` as a
 * `title` attribute so hovering reveals the exact timestamp.
 * Returns `fallback` (default "—") for null/invalid input.
 */
export function fmtSince(
  value: string | Date | null | undefined,
  fallback = '—',
): string {
  const d = toDate(value);
  if (!d) return fallback;
  const diff = Date.now() - d.getTime();
  if (diff < 0) return fmtAbsoluteDate(d); // future date — relative makes no sense
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days <= RELATIVE_THRESHOLD_DAYS) return `${days}d ago`;
  return fmtAbsoluteDate(d);
}

/**
 * Future-deadline suffix — " (15d left)" when the date is in the future,
 * "" otherwise. CLIENT-ONLY: reads Date.now(). Intended to append to an
 * absolute date, e.g. `reverts ${fmtAbsoluteDate(iso)}${fmtDaysLeft(iso)}`.
 */
export function fmtDaysLeft(value: string | Date | null | undefined): string {
  const d = toDate(value);
  if (!d) return '';
  const days = Math.ceil((d.getTime() - Date.now()) / 86_400_000);
  return days > 0 ? ` (${days}d left)` : '';
}
