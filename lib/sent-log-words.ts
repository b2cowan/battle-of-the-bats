/**
 * The sent-email log's words (Support console Stage 5, drawing E: "What happened, in plain words"). PURE and
 * client-safe. One spelling: Sent · Delivered · Delayed · Bounced · Marked as spam · Not sent · Failed · Not confirmed.
 *
 * G4 2026-10-26: Delayed's meaning carries no number of hours (the drawing's "up to 14 hours" had no source).
 */

export type SentState = 'sent' | 'unconfirmed' | 'delayed' | 'delivered' | 'bounced' | 'complained' | 'failed' | 'not_sent';
export type SentTone = 'plain' | 'ok' | 'warn' | 'bad';

export const SENT_STATES: Record<SentState, { word: string; meaning: string; tone: SentTone }> = {
  sent:        { word: 'Sent', meaning: 'Handed to the mail service. No word back yet; usually within a minute.', tone: 'plain' },
  delivered:   { word: 'Delivered', meaning: 'Their mail server accepted it. It may be in spam. We do not know if it was opened.', tone: 'ok' },
  delayed:     { word: 'Delayed', meaning: 'Their mail server is slow to accept it. The mail service keeps trying.', tone: 'warn' },
  bounced:     { word: 'Bounced', meaning: 'Refused for good: the address does not exist, or will not take mail.', tone: 'bad' },
  complained:  { word: 'Marked as spam', meaning: 'The person reported it as spam. The mail service stops sending to them.', tone: 'bad' },
  not_sent:    { word: 'Not sent', meaning: 'Not sent at all: this address bounced or reported spam before.', tone: 'bad' },
  failed:      { word: 'Failed', meaning: 'The mail service could not send it.', tone: 'bad' },
  unconfirmed: { word: 'Not confirmed', meaning: "We did not hear back when we sent it. The mail service's own word will settle it.", tone: 'warn' },
};

export const SENT_STATE_ORDER: SentState[] = ['sent', 'delivered', 'delayed', 'bounced', 'complained', 'not_sent', 'failed', 'unconfirmed'];

export function isSentState(v: unknown): v is SentState {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(SENT_STATES, v);
}

export type BounceReason = 'address_does_not_exist' | 'mailbox_full' | 'refused_by_server' | 'suppressed' | 'other';

/** The flag line under a bounced email (E3, E4). */
export const BOUNCE_WORDS: Record<BounceReason, { short: string; flag: string; todo: string }> = {
  address_does_not_exist: {
    short: 'This address does not exist',
    flag: 'Bounced: the receiving mail server says this address does not exist.',
    todo: 'the address is probably mistyped. Check it with the person, then send it again from where it was first sent.',
  },
  mailbox_full: {
    short: 'Their mailbox is full',
    flag: 'Bounced: their mailbox is full.',
    todo: 'ask them to clear space in their mailbox, then send it again.',
  },
  refused_by_server: {
    short: 'Their mail server refused it',
    flag: 'Bounced: their mail server refused it.',
    todo: 'ask them to allow mail from FieldLogicHQ, or to give an address at another provider.',
  },
  suppressed: {
    short: 'This address bounced or reported spam before',
    flag: 'Not sent: this address bounced or reported spam before.',
    todo: 'the mail service will not write to this address again. Ask for a different address.',
  },
  other: {
    short: 'Their mail server refused it',
    flag: 'Bounced: their mail server refused it.',
    todo: 'check the address with the person, then send it again.',
  },
};

export function isBounceReason(v: unknown): v is BounceReason {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(BOUNCE_WORDS, v);
}

/** The email window's "What to do" for a state with no bounce reason, or null when there is nothing to do. */
export function whatToDo(state: SentState, reason: BounceReason | null): string | null {
  if (reason) return BOUNCE_WORDS[reason].todo;
  switch (state) {
    case 'delivered': return 'nothing on our side. If they cannot find it, ask them to look in spam.';
    case 'delayed': return 'wait; the mail service keeps trying. If it never arrives, check the address with them.';
    case 'complained': return 'the mail service stops writing to them. Ask whether they meant to, and for another address if they still want our emails.';
    case 'not_sent': return BOUNCE_WORDS.suppressed.todo;
    case 'failed': return 'send it again from where it was first sent. If it fails again, tell the developer.';
    case 'unconfirmed': return 'wait a few minutes; the mail service usually reports within the hour.';
    default: return null;
  }
}

export const SENT_LOG_FOOT =
  'Delivered means their mail server accepted it. It can still be in spam; we do not know whether it was opened. Kept 90 days. Emails a club sends to families are in the club\'s own Emails tab, not here.';
export const EMAIL_WINDOW_FOOT = 'The email itself is not kept.';
export const NO_EMAILS_FOR_PERSON = 'No emails recorded for this person.';
export const NO_EMAILS_TO_ADDRESS = 'Nothing was sent to this address in the last 90 days.';
export const NO_EMAILS_TO_ADDRESS_HINT =
  'Check the spelling with the customer. If they say we sent it before recording started, it cannot be checked here.';

/** "Recording started on {date}; anything sent before then was not kept. …" — the date is the first row ever kept. */
export function recordingStartedLine(startedOn: string | null): string {
  const lead = startedOn ? `Recording started on ${startedOn}; anything sent before then was not kept.` : NO_EMAILS_YET;
  return `${lead} Emails a club sends to families are in that club's own Emails tab.`;
}

/** The line of a timeline event for a bounce, after "Bounced 2 seconds later, for good." (E4). */
export const BOUNCE_EVENT_TAIL: Record<BounceReason, string> = {
  address_does_not_exist: 'The address does not exist at that mail provider.',
  mailbox_full: 'Their mailbox is full.',
  refused_by_server: 'Their mail server refused it.',
  suppressed: 'This address bounced or reported spam before.',
  other: 'Their mail server refused it.',
};

/** The red line under a state in a list (E3): the short reason, for the two states that carry one; else null. */
export function listFlag(state: SentState, reason: BounceReason | null): string | null {
  if (state === 'bounced') return BOUNCE_WORDS[reason ?? 'other'].short;
  if (state === 'not_sent') return BOUNCE_WORDS.suppressed.short;
  return null;
}

/** The email window's flag line (E4): bounced, not sent and marked as spam say what happened; every other state has none. */
export function windowFlag(state: SentState, reason: BounceReason | null): string | null {
  if (state === 'bounced') return BOUNCE_WORDS[reason ?? 'other'].flag;
  if (state === 'not_sent') return BOUNCE_WORDS.suppressed.flag;
  if (state === 'complained') return `Marked as spam: ${SENT_STATES.complained.meaning.charAt(0).toLowerCase()}${SENT_STATES.complained.meaning.slice(1)}`;
  return null;
}

export const NO_EMAILS_YET = 'Nothing has been recorded yet.';
export const NO_EMAILS_IN_STATE = 'No emails in that state in the last 90 days.';
/** The one sentence a refused search says (T17); it never says how many are left or what was typed. */
export const SENT_SEARCH_LIMIT = "You have reached today's limit of searches. It resets within 24 hours.";
export const SENT_LOG_FAILED = 'Sent emails could not be read just now. Try again in a moment.';
export const SENT_EMAIL_FAILED = 'That email could not be read just now. Try again in a moment.';

/** Whether the words are a whole email address (Sent emails searches and Find's group take nothing else: exact match only). */
export function looksLikeEmailAddress(words: string): boolean {
  const w = words.trim();
  return w.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(w);
}
