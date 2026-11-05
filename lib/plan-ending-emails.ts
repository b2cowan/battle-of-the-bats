/**
 * THE THREE EMAILS OF A CANCEL THAT WAITS (Plans end at the renewal date, Stage 1 Part C; gap review G6; drawn in
 * PLAN_ENDS_AT_RENEWAL_STAGE0_DRAWINGS.html Tab 7, approved 2026-10-31).
 *
 *   ends on   "Your plan ends on {date}" — at the click, once per waiting cancel, whichever door it came through
 *   reminder  seven days before the end, from the daily job
 *   kept      "Your plan will renew on {date}" — Keep {Plan}, or Renew in Stripe's billing portal (as the cheaper plan
 *             when a move the cancel set aside came back, G1)
 *
 * A club's version and a Coaches Portal's (Premium) version of each. Pure: the facts in, the subject, the house-layout
 * HTML and the template variables out (the stored template is used only when an operator has customised it).
 *
 * A MOVE TO THE FREE PLAN THAT WAITS (Stage 2 Part C, owner rulings 2026-11-03 ruling 5 and 2026-11-04): the same row
 * kinds in a move's words — "Your move to {plan} is scheduled for {date}" at the click, its reminder seven days before,
 * the kept email with the Keep window's "The move to {plan} is called off" — and `moved`, "{Org} is now on {plan}" on the
 * date (or at the click, with no paid period to wait for). A club only: a Coaches Portal never moves to the free plan here.
 *
 * ⚠ ONE DATE (G4): every date here goes through `formatStoredDate`, the page's own formatter (Toronto) — never
 * `toLocaleDateString`, which reads an evening-Eastern period end as the next day on a UTC server.
 * Words are Stage 1's and Stage 2's: correct and plain. Stage 4 polishes them with the rest of the help pass.
 */
import { formatStoredDate } from './timezone';
import { joinWithAnd, pluralize } from './utils';
import {
  warmEmailButton, warmEmailDocument, warmEmailHeading, warmEmailParagraph, warmEmailSmall, warmPanelStyle, WARM_EMAIL, WARM_EMAIL_STYLE,
} from './email-envelope-warm';
import { PLAN_BILLING_WORDS as W } from './plan-billing-words';
import type { OrgPlan as OrgPlanKey } from './types';
import type { EmailKind } from './email-kinds';
import type { EndingDoor } from './plan-ending';

/** What a move to the free plan does on its date, as the email says it (re-read for each email; what it did, for `moved`). */
export type MoveEmailFacts = {
  /** The plan it moves to, as the email says it ("Tournament"). */
  target: string;
  /** The tournaments that stay (or stayed) active, and the ones archived then (or now). */
  kept: string[];
  archived: string[];
  /** The pick is gone (or was, on the date), so the newest is (was) kept. */
  fellBack: boolean;
  /** Whether a pick was ever made — the "gone" words differ (Stage 0 Ask 8). */
  picked: boolean;
  /** More tournaments hold a slot than the free plan keeps: there is a choice to make. */
  choose: boolean;
};

export type EndingEmailFacts = {
  kind: 'ends_on' | 'reminder' | 'kept' | 'moved';
  /** A waiting (or done) move to the free plan; null for a cancel. `planLabel` is then the plan it moves FROM. */
  move: MoveEmailFacts | null;
  /** A Coaches Portal: the Premium version. `orgName` is then the team's name (the portal's display name). */
  portal: boolean;
  orgName: string;
  /** The plan the Keep door names: 'team' for a Coaches Portal ("Keep Premium"). */
  plan: OrgPlanKey;
  /** The plan's name as the email says it: "Premium" for a Coaches Portal. */
  planLabel: string;
  door: EndingDoor;
  /** The day the cancel was made. */
  clickedAt: string;
  /** The end date (ends on, reminder) or the renewal date (kept); null only for a kept plan whose date Stripe didn't give. */
  date: string | null;
  retentionUntil: string;
  /** Tournaments live now — what the end date archives. */
  tournaments: number;
  trialing: boolean;
  /** "We'll remind you seven days before it ends" — only when there are seven days or more left. */
  remindLater: boolean;
  daysLeft: number;
  /** Kept as a cheaper plan (G1). */
  renewsAs: string | null;
  /** What the next charge is, in the billing page's words ("$39 CAD / month"); null when nobody can say. */
  price: string | null;
  keepUrl: string;
  billingUrl: string;
};

export type EndingEmailOut = { key: EmailKind; subject: string; html: string; vars: Record<string, string> };

const KEYS: Record<Exclude<EndingEmailFacts['kind'], 'moved'>, { club: EmailKind; portal: EmailKind }> = {
  ends_on: { club: 'plan_ends_on', portal: 'team_workspace_ends_on' },
  reminder: { club: 'plan_ending_reminder', portal: 'team_workspace_ending_reminder' },
  kept: { club: 'plan_kept', portal: 'team_workspace_kept' },
};

/** A move's own keys (owner 2026-11-04); its kept email stays `plan_kept` (from KEYS), with one sentence of its own. */
const MOVE_KEYS: Record<Exclude<EndingEmailFacts['kind'], 'kept'>, EmailKind> = {
  ends_on: 'plan_downgrade_scheduled', reminder: 'plan_downgrade_reminder', moved: 'plan_downgraded',
};

function keyOf(f: EndingEmailFacts): EmailKind {
  if (f.kind === 'moved' || (f.move && f.kind !== 'kept')) return MOVE_KEYS[f.kind];
  return KEYS[f.kind][f.portal ? 'portal' : 'club'];
}

// Local, as the other pure email modules keep theirs (lib/email.ts is not importable without the app's path aliases).
const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const day = (iso: string) => formatStoredDate(iso, { longMonth: true });
const b = (text: string) => `<strong>${escapeHtml(text)}</strong>`;

/** What was cancelled or kept, in a sentence: "Premium for your Falcons Coaches Portal" or "Tournament Plus for Riverside". */
const what = (f: EndingEmailFacts, html: boolean) => f.portal
  ? `Premium for your ${html ? b(f.orgName) : f.orgName} Coaches Portal`
  : html ? `${b(f.planLabel)} for ${b(f.orgName)}` : `${f.planLabel} for ${f.orgName}`;

function panel(title: string, body: string): string {
  return `<div style="${warmPanelStyle('secondary')}"><p style="${WARM_EMAIL_STYLE.panelLabel}">${escapeHtml(title)}</p>`
    + `<p style="margin:0;line-height:1.75;color:${WARM_EMAIL.ink};">${body}</p></div>`;
}

/** The end date, in the account's words: suspended (or Premium stopping), the tournaments archived, the data kept until the date. */
function onTheDay(f: EndingEmailFacts, withComeBack: boolean): string {
  const comeBack = withComeBack ? ', and everything comes back if you resubscribe before then' : '';
  if (f.portal) return `Premium tools stop. Your team is kept until ${b(day(f.retentionUntil))}${comeBack}. Basic tournament records stay available.`;
  const archived = f.tournaments === 0 ? '' : f.tournaments === 1 ? ' and its tournament is archived' : ` and its ${pluralize(f.tournaments, 'tournament')} are archived`;
  return `${escapeHtml(f.orgName)} is suspended${archived}. Your data is kept until ${b(day(f.retentionUntil))}${comeBack}.`;
}

/** The ends-on email's first sentence changes with the door (Tab 7, email A's note). */
function cancelledSentence(f: EndingEmailFacts): string {
  const on = day(f.clickedAt);
  if (f.door === 'operator') return `We cancelled ${what(f, true)} on ${on}, at your request.`;
  if (f.door === 'stripe_portal') return `You cancelled ${what(f, true)} in the billing portal on ${on}.`;
  return `You cancelled ${what(f, true)} on ${on}.`;
}

function endsOn(f: EndingEmailFacts, end: string): { subject: string; body: string[] } {
  const open = f.portal ? `Premium tools stay on until ${day(end)}` : `Everything stays open until ${day(end)}`;
  const stays = f.trialing ? `${open}, when your trial ends. Your card is not charged.` : `${open}, the end of the period you paid for. Nothing more is charged.`;
  return {
    subject: f.portal ? `${what(f, false)} ends on ${day(end)}` : `Your ${f.planLabel} plan ends on ${day(end)}`,
    body: [
      warmEmailHeading('We’re sorry to see you go!'),
      warmEmailParagraph(`${cancelledSentence(f)} ${stays}`),
      panel(`On ${day(end)}`, onTheDay(f, true)),
      warmEmailParagraph(`Changed your mind? ${escapeHtml(W.cancel.keepAnyTime(f.planLabel, end))}`),
      warmEmailButton(escapeHtml(W.cancel.keepDoor(f.plan)), f.keepUrl),
      ...(f.remindLater ? [warmEmailSmall('We’ll remind you seven days before it ends.')] : []),
    ],
  };
}

function reminder(f: EndingEmailFacts, end: string): { subject: string; body: string[] } {
  const left = pluralize(f.daysLeft, 'day');
  return {
    subject: f.portal ? `${what(f, false)} ends in ${left}` : `Your ${f.planLabel} plan ends in ${left}`,
    body: [
      warmEmailHeading(`${left} left on ${escapeHtml(f.planLabel)}`),
      warmEmailParagraph(f.portal
        ? `${what(f, true)} ends on ${day(end)}. Until then every Premium tool stays on.`
        : `Your ${b(f.planLabel)} plan for ${b(f.orgName)} ends on ${day(end)}. Until then everything stays open.`),
      panel(`On ${day(end)}`, onTheDay(f, false)),
      warmEmailButton(escapeHtml(W.cancel.keepDoor(f.plan)), f.keepUrl),
    ],
  };
}

/** Kept: short on purpose — it confirms the charge that is coming back (Tab 7, emails C and D). */
function kept(f: EndingEmailFacts): { subject: string; body: string[] } {
  const when = f.date ? `on ${day(f.date)}` : 'at the end of this period';
  const at = f.price ? ` at ${escapeHtml(f.price)}` : '';
  const who = f.door === 'operator' ? 'We kept' : 'You kept';
  const how = `${f.door === 'stripe_portal' ? ' in the billing portal' : ''}${f.door === 'operator' ? ', at your request' : ''}`;
  const button = warmEmailButton(escapeHtml(`Open ${W.page.title}`), f.billingUrl);
  if (f.renewsAs) {
    return {
      subject: `${f.orgName} will renew as ${f.renewsAs} ${when}`,
      body: [
        warmEmailHeading('Your plan stays on'),
        warmEmailParagraph(`${who} your plan for ${b(f.orgName)}${how}. ${escapeHtml(f.planLabel)} runs until ${f.date ? day(f.date) : 'the end of this period'}. Then it renews as ${b(f.renewsAs)}, the move you chose${at}.`),
        button,
      ],
    };
  }
  const renews = f.trialing && f.date
    ? `Your trial ends on ${day(f.date)}${f.price ? `, and then it’s ${escapeHtml(f.price)}` : ''}.`
    : `It renews ${when}${at}.`;
  // Over a waiting move, the Keep window's own second sentence (Stage 2 Part B ruling) in place of "Nothing else changes."
  const rest = f.move ? escapeHtml(W.downgrade.keepMoveOff(f.move.target)) : W.cancel.keepNothingElse;
  return {
    subject: f.portal ? `${what(f, false)} will renew ${when}` : `${f.planLabel} will renew ${when}`,
    body: [
      warmEmailHeading(`${escapeHtml(f.planLabel)} stays on`),
      warmEmailParagraph(`${who} ${what(f, true)}${how}. ${renews} ${rest}`),
      button,
    ],
  };
}

// ── A move to the free plan (Stage 2 Part C) ─────────────────────────────────────────────────────

const names = (list: readonly string[]) => joinWithAnd(list.map(b));
const isAre = (list: readonly string[]) => (list.length === 1 ? 'is' : 'are');
const itThey = (list: readonly string[]) => (list.length === 1 ? 'it' : 'they');
/** Sentences, the empty ones left out. */
const sentences = (...parts: string[]) => parts.filter(Boolean).join(' ');

/** What the date does, in the band's words: the one kept (or the ask to choose), and what is archived and kept until when. */
function moveOnTheDay(f: EndingEmailFacts, m: MoveEmailFacts, end: string): string {
  const keep = m.fellBack && m.choose
    ? escapeHtml(W.downgrade.band.gone(m.picked, m.kept[0] ?? '', end))
    : m.kept.length > 0 ? `You keep ${names(m.kept)}.` : '';
  const archived = m.archived.length > 0
    ? `${names(m.archived)} ${isAre(m.archived)} archived then and kept until ${b(day(f.retentionUntil))}, so ${itThey(m.archived)} can come back if you upgrade before then. So is any other tournament you make before then.`
    : `Any other tournament you make before then is archived then and kept until ${b(day(f.retentionUntil))}.`;
  return sentences(`${escapeHtml(f.orgName)} moves to ${b(m.target)}.`, keep, archived, `Tools that come only with ${escapeHtml(f.planLabel)} turn off.`);
}

function moveScheduled(f: EndingEmailFacts, m: MoveEmailFacts, end: string): { subject: string; body: string[] } {
  // The Downgrade window's own dated words (Stage 2 Part B), so the email and the window say the same thing.
  const stays = escapeHtml(W.downgrade.whenOn(end, f.planLabel, f.trialing));
  return {
    subject: `Your move to ${m.target} is scheduled for ${day(end)}`,
    body: [
      warmEmailHeading(`Your move to ${escapeHtml(m.target)} is scheduled`),
      warmEmailParagraph(`You chose to move ${b(f.orgName)} from ${b(f.planLabel)} to ${b(m.target)} on ${day(f.clickedAt)}. ${stays}`),
      panel(`On ${day(end)}`, moveOnTheDay(f, m, end)),
      warmEmailParagraph(`Changed your mind? ${escapeHtml(W.cancel.keepAnyTime(f.planLabel, end))}${m.choose ? ` To change which tournament you keep, open ${escapeHtml(W.page.title)}.` : ''}`),
      warmEmailButton(escapeHtml(W.cancel.keepDoor(f.plan)), f.keepUrl),
      ...(f.remindLater ? [warmEmailSmall('We’ll remind you seven days before the move.')] : []),
    ],
  };
}

function moveReminder(f: EndingEmailFacts, m: MoveEmailFacts, end: string): { subject: string; body: string[] } {
  const left = pluralize(f.daysLeft, 'day');
  return {
    subject: `Your move to ${m.target} is in ${left}`,
    body: [
      warmEmailHeading(`${left} until your move to ${escapeHtml(m.target)}`),
      warmEmailParagraph(`${b(f.orgName)} moves from ${b(f.planLabel)} to ${b(m.target)} on ${day(end)}. Until then everything stays open.`),
      panel(`On ${day(end)}`, moveOnTheDay(f, m, end)),
      warmEmailButton(escapeHtml(W.cancel.keepDoor(f.plan)), f.keepUrl),
    ],
  };
}

/** Done: "{Org} is now on Tournament" — what was kept, what was archived and until when, and how it comes back. */
function moved(f: EndingEmailFacts, m: MoveEmailFacts, on: string): { subject: string; body: string[] } {
  // The fallback says why, as the row's own note does (applyDowngrade): nothing picked, or the pick no longer held a slot.
  const keep = m.kept.length === 0 ? ''
    : !m.fellBack ? `You kept ${names(m.kept)}.`
      : m.picked ? `The tournament you chose to keep was no longer a draft or active event, so we kept ${names(m.kept)}, your newest.`
        : `You hadn’t chosen a tournament to keep, so we kept ${names(m.kept)}, your newest.`;
  const archived = m.archived.length > 0
    ? `${names(m.archived)} ${isAre(m.archived)} archived and kept until ${b(day(f.retentionUntil))}. Upgrade before then and ${itThey(m.archived)} ${m.archived.length === 1 ? 'comes' : 'come'} back.`
    : 'No tournament needed to be archived.';
  return {
    subject: `${f.orgName} is now on ${m.target}`,
    body: [
      warmEmailHeading(`You’re now on ${escapeHtml(m.target)}`),
      warmEmailParagraph(`${b(f.orgName)} moved from ${b(f.planLabel)} to ${b(m.target)} on ${day(on)}, as you chose.`),
      panel('What changed', sentences(keep, archived, `Tools that came only with ${escapeHtml(f.planLabel)} are off.`)),
      warmEmailButton(escapeHtml(`Open ${W.page.title}`), f.billingUrl),
    ],
  };
}

function bodyOf(f: EndingEmailFacts): { subject: string; body: string[] } {
  if (f.kind === 'kept') return kept(f);
  const m = f.move;
  if (f.kind === 'moved') {
    if (!m) throw new Error('A "now on" email needs the move it is about.');
    return moved(f, m, f.date!);
  }
  if (m) return f.kind === 'reminder' ? moveReminder(f, m, f.date!) : moveScheduled(f, m, f.date!);
  return f.kind === 'reminder' ? reminder(f, f.date!) : endsOn(f, f.date!);
}

export function endingEmail(f: EndingEmailFacts): EndingEmailOut {
  const { subject, body } = bodyOf(f);
  const m = f.move;
  return {
    key: keyOf(f),
    subject,
    html: warmEmailDocument(body.join('\n')),
    vars: {
      orgName: f.orgName, planLabel: f.planLabel, date: f.date ? day(f.date) : '', retentionUntil: day(f.retentionUntil),
      keepUrl: f.keepUrl, billingUrl: f.billingUrl, renewsAs: f.renewsAs ?? '', price: f.price ?? '',
      // A move's (and the old `plan_downgraded` template's own names, so a customised row still fills in).
      ...(m ? {
        targetPlanLabel: m.target, fromPlanLabel: f.planLabel, toPlanLabel: m.target,
        keptTournaments: joinWithAnd(m.kept), archivedTournaments: joinWithAnd(m.archived),
      } : {}),
    },
  };
}
