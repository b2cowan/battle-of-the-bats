import { endOnClock, joinNames } from './practice-plan-send';
import { possessive } from './utils';
import {
  WARM_EMAIL, warmEmailButton, warmEmailDocument, warmEmailFootnote, warmEmailHeading, warmEmailParagraph,
} from './email-envelope-warm';

/**
 * The coach's own email for "Send to staff" — ruled J and K (COACH_PRACTICE_WHO_RUNS_IT, owner
 * 2026-09-17). Pure: builds the subject and the HTML; the send route mails it.
 *
 * ⚠ THIS EMAIL IS A THIRD KIND, and it is outside two doors ON PURPOSE (plan finding F08):
 *   · not `notify()`'s email channel — that is a per-person, per-event PREFERENCE, default off;
 *   · not `sendFamilyEmail` — the suppression list and the unsubscribe footer are for families.
 * A coach pressing "Also email them" is a colleague addressing colleagues about tonight — the
 * same ground a dues reminder stands on (transactional, owner ruling 2026-08-18) and an @mention
 * (it pierces the master pause because a person addressed you). So it goes to every recipient in
 * the audience whatever their notification settings say and whether or not their account is
 * paused. Two boundaries, drawn in: it NAMES the coach as the sender, and its footer says why it
 * arrived. `lib/family-email.ts`'s "who is still outside this door" audit lists it.
 *
 * ⚠ THE OUTLINE, NOT THE SHEET (ruling K): times · blocks · stations · who, with the reader's rows
 * marked "you", then a button to the plan. The drills, coaching points and groups stay behind
 * the button — they are the printed page, and the printed page names children.
 */

export interface PracticePlanEmailStation {
  name: string;
  staffLine: string;
  mine: boolean;
}

export interface PracticePlanEmailBlock {
  /** "6:10 p.m." — the block's planned clock, or '' when the practice has no start. */
  time: string;
  title: string;
  /** "Whole team", "Jen · Craig", '' — the block's own people line, when it has one. */
  staffLine: string;
  mine: boolean;
  stations: PracticePlanEmailStation[];
}

export interface PracticePlanEmailInput {
  coachName: string;
  teamName: string;
  /** "Tuesday, September 22 · 6:00–7:30 p.m." */
  whenLine: string;
  /** "Riverdale Fields 2" or '' */
  whereLine: string;
  /** "5:45 p.m." or null */
  arriveLabel: string | null;
  /** What THIS recipient is on — empty for a person not named. */
  myLabels: readonly string[];
  outline: readonly PracticePlanEmailBlock[];
  /** Absolute URL of the plan page. */
  planUrl: string;
  /** "Tuesday" / "Sep 29" — the subject's day word. */
  dayLabel: string;
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const YOU = `<span style="font-weight:700;color:${WARM_EMAIL.olive};"> · you</span>`;

export function practicePlanEmail(input: PracticePlanEmailInput): { subject: string; html: string } {
  const subject = `${possessive(input.dayLabel)} practice plan — ${input.teamName}`;

  const mine = input.myLabels.length > 0
    ? ` You’re on <strong>${esc(joinNames(input.myLabels))}</strong>.`
    : '';
  // The clock ends the sentence — see `endOnClock`; the period lives inside the strong when the
  // label already carries one ("5:45 p.m."), never doubled after it.
  const arrive = input.arriveLabel ? ` Arrive by <strong>${esc(input.arriveLabel)}</strong>${endOnClock(input.arriveLabel).slice(input.arriveLabel.length)}` : '';

  const rows = input.outline.map(b => {
    const stationLines = b.stations.map(s =>
      `<div style="margin:2px 0 0 0;font-size:13px;color:${s.mine ? WARM_EMAIL.ink : WARM_EMAIL.secondary};">${esc(s.name)}${s.staffLine ? ` — ${esc(s.staffLine)}` : ''}${s.mine ? YOU : ''}</div>`,
    ).join('');
    return `<tr>
      <td style="padding:8px 10px 8px 0;vertical-align:top;white-space:nowrap;font-family:${WARM_EMAIL.font};font-variant-numeric:tabular-nums;font-size:13px;color:${WARM_EMAIL.ink};">${esc(b.time)}</td>
      <td style="padding:8px 0;vertical-align:top;font-family:${WARM_EMAIL.font};font-size:14px;color:${WARM_EMAIL.ink};border-bottom:1px solid ${WARM_EMAIL.cardEdge};">
        <div style="font-weight:600;">${esc(b.title)}${b.mine ? YOU : ''}</div>
        ${b.staffLine ? `<div style="font-size:13px;color:${WARM_EMAIL.secondary};">${esc(b.staffLine)}</div>` : ''}
        ${stationLines}
      </td>
    </tr>`;
  }).join('');

  const html = warmEmailDocument(`
${warmEmailHeading(`${possessive(esc(input.dayLabel))} practice plan is ready`)}
${warmEmailParagraph(`${esc(input.coachName)} sent you the plan for <strong>${esc(input.whenLine)}</strong>${input.whereLine ? ` at ${esc(input.whereLine)}` : ''}.${mine}${arrive}`)}
<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;margin:0 0 1.25rem;">${rows}</table>
${warmEmailButton('Open the plan', esc(input.planUrl))}
${warmEmailFootnote(`${esc(input.coachName)} sent this to you directly as staff of ${esc(input.teamName)} — it isn’t affected by your notification settings.`)}`);
  return { subject, html };
}
