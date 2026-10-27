/**
 * The mail service's delivery callback, checked (Support console Stage 5, owner Q7 2026-10-26; drawing F; threats T8-T12).
 * Pure: no database, no logging. `app/api/webhooks/resend/route.ts` is its only caller.
 *
 * Resend signs every callback the Svix / Standard Webhooks way (docs, read 2026-10-26):
 *   signed content = `${svix-id}.${svix-timestamp}.${raw body}`
 *   key            = base64-decode(the secret after its `whsec_` prefix)
 *   signature      = base64(HMAC-SHA256(key, signed content)), sent as `v1,<sig>`; several may come, space-separated,
 *                    and one match is enough (key rotation).
 * The time is inside what is signed, so it cannot be forged; a call more than 5 minutes old, or as far in the future,
 * is refused. Nothing from the call is read before the signature holds.
 *
 * ⚠ What may leave this module into our database: our row number, the state (our word), its time and a bounce reason
 * from a short fixed list. Never the subject, the addresses or the mail service's own words (T12).
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { BounceReason, SentState } from './sent-log-words';
import { isUuid } from './utils';

export const MAX_CALLBACK_BYTES = 64 * 1024;
export const TOLERANCE_SECONDS = 5 * 60;

export type CallbackHeaders = { id: string | null; timestamp: string | null; signature: string | null };

/** True when one of the call's v1 signatures matches, compared in constant time, and its time is within 5 minutes. */
export function verifyCallback(
  headers: CallbackHeaders,
  rawBody: string,
  secret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): boolean {
  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature) return false;
  if (!/^\d{1,12}$/.test(timestamp)) return false;
  const ts = Number(timestamp);
  if (Math.abs(nowSeconds - ts) > TOLERANCE_SECONDS) return false;
  if (Buffer.byteLength(rawBody, 'utf8') > MAX_CALLBACK_BYTES) return false;

  const key = secretKey(secret);
  if (!key) return false;
  const expected = createHmac('sha256', key).update(`${id}.${timestamp}.${rawBody}`).digest();

  let matched = false;
  for (const entry of signature.split(' ')) {
    const comma = entry.indexOf(',');
    if (comma < 0 || entry.slice(0, comma) !== 'v1') continue;
    let given: Buffer;
    try {
      given = Buffer.from(entry.slice(comma + 1), 'base64');
    } catch {
      continue;
    }
    // Every entry is compared (no early exit), so the time taken never says which one matched.
    if (given.length === expected.length && timingSafeEqual(given, expected)) matched = true;
  }
  return matched;
}

function secretKey(secret: string): Buffer | null {
  const raw = secret.trim().replace(/^whsec_/, '');
  if (!raw) return null;
  const key = Buffer.from(raw, 'base64');
  return key.length > 0 ? key : null;
}

// ── The event, in our words ──────────────────────────────────────────────────────────────────────────

/** Every state the log knows except Not confirmed, which only our own sender sets. */
export type CallbackState = Exclude<SentState, 'unconfirmed'>;

/** The seven events subscribed (never opened or clicked). Anything else is accepted and ignored. */
const EVENT_STATES: Record<string, CallbackState> = {
  'email.sent': 'sent',
  'email.delivery_delayed': 'delayed',
  'email.delivered': 'delivered',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
  'email.failed': 'failed',
  'email.suppressed': 'not_sent',
};

export const EVENT_ID = /^[A-Za-z0-9_-]{6,80}$/;

export type ParsedCallback = { rowId: string; state: CallbackState; at: string; reason: BounceReason | null };

/**
 * Our row and what happened, or null when the call is not about one of THIS database's rows (another site's, a family
 * or campaign email, an event we do not track): the caller accepts it and keeps nothing (T11). The row tag must look
 * like one of our row numbers before anything looks it up.
 */
export function parseCallback(body: unknown, ourDatabase: string): ParsedCallback | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as { type?: unknown; created_at?: unknown; data?: unknown };
  const state = typeof b.type === 'string' ? EVENT_STATES[b.type] : undefined;
  if (!state) return null;
  const data = (b.data && typeof b.data === 'object' ? b.data : {}) as {
    tags?: unknown; created_at?: unknown; bounce?: { type?: unknown; subType?: unknown };
  };
  const tags = readTags(data.tags);
  if (tags.flhq_db !== ourDatabase) return null;
  const rowId = tags.flhq_row?.toLowerCase();
  if (!isUuid(rowId)) return null;

  const at = toInstant(b.created_at) ?? toInstant(data.created_at);
  if (!at) return null;
  const reason = state === 'bounced' ? bounceReason(data.bounce) : state === 'not_sent' ? 'suppressed' : null;
  return { rowId, state, at, reason };
}

/** Tags arrive as an object in a callback, `{ name: value }`; the send API's array form is accepted too. */
function readTags(tags: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (Array.isArray(tags)) {
    for (const t of tags) {
      if (t && typeof t === 'object' && typeof (t as { name?: unknown }).name === 'string' && typeof (t as { value?: unknown }).value === 'string') {
        out[(t as { name: string }).name] = (t as { value: string }).value;
      }
    }
  } else if (tags && typeof tags === 'object') {
    for (const [k, v] of Object.entries(tags as Record<string, unknown>)) if (typeof v === 'string') out[k] = v;
  }
  return out;
}

function toInstant(v: unknown): string | null {
  if (typeof v !== 'string' || v.length > 40) return null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? new Date(t).toISOString() : null; // utc-intentional: an instant stored as timestamptz
}

/** Resend's bounce type and subtype, mapped to our fixed list. Its message and diagnostic codes are never read. */
function bounceReason(bounce: { type?: unknown; subType?: unknown } | undefined): BounceReason {
  const type = typeof bounce?.type === 'string' ? bounce.type.toLowerCase() : '';
  const sub = typeof bounce?.subType === 'string' ? bounce.subType.toLowerCase() : '';
  if (sub.includes('suppress')) return 'suppressed';
  if (sub.includes('mailboxfull') || sub.includes('mailbox_full')) return 'mailbox_full';
  // Only an explicit no-such-mailbox says the address does not exist; a General bounce is a refusal for any reason
  // (the /review of the build: "probably mistyped" must not be said on a guess).
  if (sub === 'nosuchuser' || sub.includes('noemail')) return type === 'permanent' ? 'address_does_not_exist' : 'other';
  if (sub.includes('reject') || sub.includes('content') || sub.includes('policy')) return 'refused_by_server';
  return 'other';
}
