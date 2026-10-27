/**
 * A staff reply to a feedback item (Support console Stage 5, owner Q5 + G4 2026-10-26; drawings D and G; threats
 * T18-T23). The reply route (`app/api/platform-admin/feedback/[id]/reply/route.ts`) is the only sender.
 *
 * ⚠ WHO IT GOES TO IS THE SERVER'S (T18, T19). The address is the one the person wrote from, read here from the account
 * behind the feedback, and only while that account still exists, still has that address, is confirmed and is not
 * locked, and the feedback is under 90 days old. The browser sends the feedback's number, the words and the reply's
 * own number, never an address or a header.
 *
 * ⚠ THE WORDS ARE PLAIN TEXT, built here (T20, T21): the subject is "Re: " and the title with line breaks removed;
 * the body is the staff member's words, the signature, the person's message quoted, and the foot (/marketing,
 * 2026-10-26). Control characters are stripped from both parts.
 */
import { personAuthStatus, personById } from './platform-people-lookup';
import { formatInOrgZone } from './timezone';
import { consoleClock } from './console-dates';

export const REPLY_MAX_CHARS = 4000;
export const REPLY_MAX_AGE_DAYS = 90;
export const REPLIES_PER_DAY = 30;
/** The mail service remembers a once-only key for 24 hours; a retry after that could send twice. */
export const RETRY_WINDOW_MS = 24 * 3_600_000;
export const REPLY_FROM_NAME = 'FieldLogicHQ support';
export const REPLY_FOOT =
  "You're getting this because you sent us feedback from inside FieldLogicHQ. Reply to this email to reach a person on our team.";

export type NoReplyReason = 'anonymous' | 'gone' | 'changed' | 'unconfirmed' | 'blocked' | 'too_old' | 'unreadable';

/** The one line that stands where the Reply door would be (drawing G; absent beats disabled). */
export const NO_REPLY_WORDS: Record<NoReplyReason, string> = {
  anonymous: 'Sent without signing in, so there is no address to reply to. Triage it as usual.',
  gone: 'No address to reply to: this account no longer exists.',
  changed: 'Their address changed after they wrote. Check who they are, then answer from the admin inbox.',
  unconfirmed: 'No address to reply to: their address is not confirmed. Answer from the admin inbox if it still matters.',
  blocked: 'No address to reply to: this account is locked. Answer from the admin inbox if it still matters.',
  too_old: 'Too old to reply from here. Answer from the admin inbox if it still matters.',
  unreadable: 'The account behind this feedback could not be read just now. Try again in a minute.',
};

export type FeedbackForReply = { user_id: string | null; user_email: string | null; created_at: string };
export type ReplyTarget = { ok: true; to: string; name: string | null } | { ok: false; reason: NoReplyReason };

/** Whether this feedback may be answered from the console, and to which address (the server's, never the browser's). */
export async function replyTarget(f: FeedbackForReply, now = Date.now()): Promise<ReplyTarget> {
  if (!f.user_id || !f.user_email) return { ok: false, reason: 'anonymous' };
  if (now - Date.parse(f.created_at) > REPLY_MAX_AGE_DAYS * 86_400_000) return { ok: false, reason: 'too_old' };
  let person;
  try {
    person = await personById(f.user_id);
  } catch {
    return { ok: false, reason: 'unreadable' };
  }
  if (!person || !person.email) return { ok: false, reason: 'gone' };
  if (person.email.trim().toLowerCase() !== f.user_email.trim().toLowerCase()) return { ok: false, reason: 'changed' };
  const status = personAuthStatus(person, now);
  if (status === 'banned') return { ok: false, reason: 'blocked' };
  if (status === 'unconfirmed') return { ok: false, reason: 'unconfirmed' };
  return { ok: true, to: person.email.trim().toLowerCase(), name: person.displayName ?? null };
}

/** Control characters out (a line break stays), Windows line ends normalised. */
export function cleanText(value: string): string {
  return value.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '');
}

/** "Re: " and the title on one line (T21): no line break, no run of spaces, at most 150 characters of title. */
export function replySubject(title: string | null | undefined): string {
  const one = cleanText(title ?? '').replace(/\s+/g, ' ').trim().slice(0, 150);
  return one ? `Re: ${one}` : 'Re: your feedback';
}

/**
 * The first name the reply is signed with: the staff list's display name, first word. None (or a name that is an
 * email address) = "", and the email signs "FieldLogicHQ support" alone (G4).
 */
export function signedFirstName(displayName: string | null | undefined): string {
  const name = cleanText(displayName ?? '').replace(/\n/g, ' ').trim();
  if (!name || name.includes('@')) return '';
  return name.split(/\s+/)[0].slice(0, 40);
}

/** "Oct 26, 2026 at 9:15 a.m." — the year always, since feedback can be months old (/marketing). */
export function wroteAt(iso: string): string {
  return `${formatInOrgZone(iso, { month: 'short', day: 'numeric', year: 'numeric' })} at ${consoleClock(iso)}`;
}

/** The whole plain-text email. */
export function replyText(opts: { body: string; signedName: string; feedbackAt: string; feedbackBody: string | null }): string {
  const quoted = cleanText(opts.feedbackBody ?? '').trim().slice(0, REPLY_MAX_CHARS)
    .split('\n').map(l => `> ${l}`).join('\n');
  const signature = opts.signedName ? `${opts.signedName}\n${REPLY_FROM_NAME}` : REPLY_FROM_NAME;
  return [
    cleanText(opts.body).trim(),
    '',
    signature,
    '',
    `On ${wroteAt(opts.feedbackAt)}, you wrote:`,
    quoted || '>',
    '',
    REPLY_FOOT,
  ].join('\n');
}

/** The window's first sentence ends with what happens to the item (G4: only a move that will happen is promised). */
export function stateAfterReply(status: string): { next: string | null; sentence: string } {
  if (status === 'new' || status === 'triaged') return { next: 'acknowledged', sentence: 'The feedback moves to Acknowledged.' };
  return { next: null, sentence: '' };
}

/** The fixed answers the window shows (drawings D5 and G). */
export const REPLY_WORDS = {
  refused: 'The mail service did not take it, so nothing was sent. Your message is kept here; try again in a minute.',
  noKey: 'This site has no mail key, so nothing was sent. Your message is kept here.',
  unconfirmed:
    'We did not hear back from the mail service, so we do not know yet whether it went. It is in the conversation as "Not confirmed". Trying again within a day is safe: it sends the same words, and the mail service sends them at most once.',
  tooLate: 'Too long to retry safely. Check the conversation, then send a new reply.',
  edited: 'Your words changed after the first try, so this would be a different email. Send it as a new reply.',
  sending: 'This reply is already being sent. Close the window and read the conversation.',
  limit: `You have sent ${REPLIES_PER_DAY} replies in the last 24 hours, the most one person may send. Answer from the admin inbox.`,
  empty: 'Write a message first.',
  tooLong: `A reply is at most ${REPLY_MAX_CHARS.toLocaleString('en-CA')} characters.`,
} as const;

/** "Robin replied at 9:49 a.m. while you were writing. Read it first." */
export function concurrentWords(by: string, atIso: string): string {
  return `${by} replied at ${consoleClock(atIso)} while you were writing. Read it first.`;
}
