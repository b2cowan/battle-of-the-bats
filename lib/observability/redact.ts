/**
 * PII redaction — runs BEFORE every observability write.
 *
 * FieldLogicHQ holds consent-gated minor data (basic_coach_team_players DOB), so error context,
 * request bodies, and client payloads must be scrubbed by key name before they land in Postgres.
 * The dedicated attribution columns (user_email, user_id, org_id) are set explicitly by the
 * caller — this redactor only governs the free-form request_context JSONB blob.
 */
// Substring match (no \b) so compound keys redact too: email, user_email, emailAddress, etc.
const SENSITIVE_KEY =
  /(authorization|cookie|set-cookie|token|password|passwd|secret|api[-_]?key|private|dob|date_of_birth|birth|ssn|sin|guardian|phone|email)/i;
const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const MAX_STRING = 2000;
const MAX_ARRAY = 50;
const MAX_DEPTH = 4;

/** Scrub email-address VALUES out of a free-text string (defense-in-depth for messages/stacks). */
export function scrubEmails(s: string): string {
  return s.replace(EMAIL_RE, '[redacted-email]');
}

export function redactValue(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    const scrubbed = scrubEmails(value);
    return scrubbed.length > MAX_STRING ? scrubbed.slice(0, MAX_STRING) + '…[truncated]' : scrubbed;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (depth >= MAX_DEPTH) return '[depth-limited]';
  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY).map(v => redactValue(v, depth + 1));
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEY.test(k) ? '[redacted]' : redactValue(v, depth + 1);
    }
    return out;
  }
  return '[unserializable]';
}

/** Redact a free-form context object for safe storage in request_context. */
export function redactContext(ctx: Record<string, unknown> | undefined | null): Record<string, unknown> {
  if (!ctx) return {};
  return redactValue(ctx, 0) as Record<string, unknown>;
}
