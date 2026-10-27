/**
 * How the Sent emails screens say a row (Support console Stage 5, drawing E): "Delivered 9:50 a.m.", and the email
 * window's timeline. PURE and client-safe; times go through `lib/console-dates.ts` (the house clock), and the only seconds
 * anywhere are in the relative phrase "2 seconds later", never a clock.
 */
import { consoleClock, consoleDay, consoleWhen } from './console-dates';
import type { SentEmail, SentEmailDetail } from './sent-log';
import { BOUNCE_EVENT_TAIL, NO_MAIL_KEY, SENT_STATES, type BounceReason, type SentState } from './sent-log-words';

/** A Sent emails list row: the email and whether no account has its address. */
export type SentLogRow = SentEmail & { noAccount: boolean };

/** What the email window is given: the email and its timeline, never an account number. */
export type SentWindowEmail = Pick<SentEmail, 'id' | 'label' | 'to' | 'orgName' | 'state' | 'stateAt' | 'bounceReason' | 'sentAt' | 'wasDelayed'> & {
  resendId: string | null;
  timeline: SentEmailDetail['timeline'];
};

type Stateful = { state: SentState; stateAt: string; wasDelayed: boolean };

/** "9:50 a.m." — and "6:41 p.m., after a delay" for a Delivered that was delayed first. */
export function whatHappenedTime(row: Stateful): string {
  const clock = consoleClock(row.stateAt);
  return row.state === 'delivered' && row.wasDelayed ? `${clock}, after a delay` : clock;
}

export type TimelineLine = { key: string; time: string; word: string | null; text: string };

export type TimelineSource = {
  sentAt: string; state: SentState; stateAt: string; bounceReason: BounceReason | null;
  timeline: readonly { state: SentState; at: string; bounceReason: BounceReason | null }[];
};

/** "straight away", "2 seconds later", "39 minutes later", "3 hours later", "2 days later". */
export function laterWords(fromIso: string, toIso: string): string {
  const ms = Math.max(0, new Date(toIso).getTime() - new Date(fromIso).getTime());
  const unit = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'} later`;
  if (ms < 1000) return 'straight away';
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return unit(seconds, 'second');
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return unit(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (hours < 24) return unit(hours, 'hour');
  return unit(Math.round(hours / 24), 'day');
}

/** The window's "What happened": the send, then each thing the mail service said, in its own order. */
export function timelineLines(d: TimelineSource): TimelineLine[] {
  const stamp = (iso: string) => (consoleDay(iso) === consoleDay(d.sentAt) ? consoleClock(iso) : consoleWhen(iso));
  const tailOf = (state: SentState, reason: BounceReason | null) =>
    state === 'not_sent' && !reason ? NO_MAIL_KEY.tail
      : state === 'bounced' || state === 'not_sent' ? BOUNCE_EVENT_TAIL[reason ?? 'other'] : SENT_STATES[state].meaning;
  const lines: TimelineLine[] = [];
  const events = d.timeline.filter(e => e.state !== 'sent');
  // Not sent and Failed never left: there is no "Sent to the mail service" to claim.
  if (d.state !== 'not_sent' && d.state !== 'failed') {
    lines.push({ key: 'sent', time: consoleClock(d.sentAt), word: null, text: 'Sent to the mail service' });
  }
  events.forEach((e, i) => {
    const later = laterWords(d.sentAt, e.at);
    lines.push({
      key: `e${i}`, time: stamp(e.at), word: SENT_STATES[e.state].word,
      text: `${later}${e.state === 'bounced' ? ', for good' : ''}. ${tailOf(e.state, e.bounceReason)}`,
    });
  });
  // A state we set ourselves (Not sent, Failed, Not confirmed), or one whose callback row is not kept: say it once.
  if (d.state !== 'sent' && !events.some(e => e.state === d.state)) {
    const ours = d.state === 'not_sent' || d.state === 'failed' || d.state === 'unconfirmed';
    // Ours read as the meaning alone ("Not sent at all: ..."): the word is already its first words.
    lines.push({
      key: 'state', time: stamp(d.stateAt), word: ours ? null : SENT_STATES[d.state].word,
      text: ours ? tailOf(d.state, d.bounceReason) : `${laterWords(d.sentAt, d.stateAt)}. ${tailOf(d.state, d.bounceReason)}`,
    });
  }
  return lines;
}
