/**
 * Leads' screens in words (Support console Stage 7 Parts 3 and 5; drawings A and B). The server builds every sentence
 * and date here; the client screens only lay them out. Counts come from `lib/lead-numbers.ts`, never their own way.
 */
import { consoleDay, consoleClock } from './console-dates';
import { tournamentToday, daysBetweenDateStrings, orgDayKey } from './timezone';
import {
  EARLY_ACCESS_FEATURE_LABELS, EARLY_ACCESS_PLAN_LABELS, EARLY_ACCESS_STATUS_LABELS, LEAD_SOURCE_LABELS, LOST_REASON_LABELS,
  SOURCE_NOT_SET, type EarlyAccessStatus, type LeadSource, type LostReason,
} from './early-access-admin';
import { daysOnStep, followUpDue, isStuck, needsYou, stepCounts, type PayRead } from './lead-numbers';
import type { BookLead, OfferedClub } from './lead-book';
import { planName } from './platform-story-view';

export type StepTone = 'plain' | 'ok' | 'info' | 'warn' | 'bad' | 'quiet';

export function stepTone(step: EarlyAccessStatus): StepTone {
  if (step === 'converted') return 'ok';
  if (step === 'pilot_candidate' || step === 'waiting_for_launch') return 'info';
  if (step === 'lost') return 'quiet';
  return 'plain';
}

export type PipelineRow = {
  id: string;
  title: string;
  person: string;
  toConfirm: boolean;
  interest: string;
  interestSub: string | null;
  step: string;
  tone: StepTone;
  stepLine: string;
  stuck: boolean;
  nextAction: string | null;
  followUp: { text: string; due: boolean } | null;
  source: string;
  sourceSet: boolean;
  arrived: string;
};

export type BandCell = { step: EarlyAccessStatus; label: string; count: number; note: string | null; warn: boolean };

export function planWords(plans: string[]): string {
  return plans.length ? plans.map(p => EARLY_ACCESS_PLAN_LABELS[p] ?? p).join(', ') : 'None picked';
}

export function featureWords(features: string[]): string | null {
  return features.length ? features.map(f => EARLY_ACCESS_FEATURE_LABELS[f] ?? f).join(', ') : null;
}

export function sourceWords(source: string | null): string {
  return source ? LEAD_SOURCE_LABELS[source as LeadSource] ?? source : SOURCE_NOT_SET;
}

export function lostWords(reason: string | null): string | null {
  return reason ? LOST_REASON_LABELS[reason as LostReason] ?? reason : null;
}

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

/** "Oct 30", "Today", "Oct 20 · 7 days late". */
function followUpWords(day: string, today: string): { text: string; due: boolean } {
  if (day === today) return { text: 'Today', due: true };
  const late = daysBetweenDateStrings(day, today);
  if (late > 0) return { text: `${consoleDay(day)} · ${plural(late, 'day')} late`, due: true };
  return { text: consoleDay(day), due: false };
}

export function pipelineRow(l: BookLead, now: Date, today: string, hasOffer: boolean): PipelineRow {
  const days = daysOnStep(l, now);
  const stuck = isStuck(l, now);
  return {
    id: l.id,
    title: l.organizationName || l.name,
    person: [l.name, l.role].filter(Boolean).join(' · '),
    toConfirm: hasOffer,
    interest: planWords(l.plans),
    interestSub: l.sourcePath?.startsWith('/coaches/team/') ? 'Asked from inside the product' : featureWords(l.features),
    step: EARLY_ACCESS_STATUS_LABELS[l.step],
    tone: stepTone(l.step),
    stepLine: l.step === 'lost' ? lostWords(l.lostReason) ?? '' : `${plural(days, 'day')}${stuck ? ' · stuck' : ''}`,
    stuck,
    nextAction: l.nextAction,
    followUp: l.followUpDueAt && l.step !== 'converted' && l.step !== 'lost' ? followUpWords(l.followUpDueAt, today) : null,
    source: sourceWords(l.source),
    sourceSet: !!l.source,
    arrived: consoleDay(l.createdAt),
  };
}

/** The order "Needs you" reads in: a sign-up to confirm, a follow-up come due, stuck, then new; newest first within. */
function needRank(l: BookLead, now: Date, today: string, hasOffer: boolean): number {
  if (hasOffer) return 0;
  if (followUpDue(l, today)) return 1;
  if (isStuck(l, now)) return 2;
  return 3;
}

export type PipelineFilters = { q: string; step: string; plan: string; source: string; tag: string };

/**
 * The leads in a list, as the screen shows it: its scope and its filter. Copy emails and the export read the SAME list
 * through this, so they can never hold a lead the screen does not.
 */
export function leadsInList(book: BookLead[], offers: Map<string, OfferedClub[]>, scope: 'needs' | 'all', f: PipelineFilters, now: Date): BookLead[] {
  const today = tournamentToday(now);
  const q = f.q.toLowerCase();
  return (scope === 'needs' ? book.filter(l => needsYou(l, now, today, offers.has(l.id))) : book).filter(l =>
    (!f.step || l.step === f.step)
    && (!f.plan || (f.plan === 'none' ? l.plans.length === 0 : l.plans.includes(f.plan)))
    && (!f.source || (f.source === 'not_set' ? !l.source : l.source === f.source))
    && (!f.tag || l.refTag === f.tag)
    && (!q || [l.name, l.email, l.organizationName ?? ''].some(s => s.toLowerCase().includes(q))));
}

export function pipelineRows(book: BookLead[], offers: Map<string, OfferedClub[]>, scope: 'needs' | 'all', f: PipelineFilters, now: Date): { rows: PipelineRow[]; needCount: number } {
  const today = tournamentToday(now);
  const needs = book.filter(l => needsYou(l, now, today, offers.has(l.id)));
  const list = leadsInList(book, offers, scope, f, now);
  const sorted = scope === 'needs'
    ? [...list].sort((a, b) => needRank(a, now, today, offers.has(a.id)) - needRank(b, now, today, offers.has(b.id)) || b.createdAt.localeCompare(a.createdAt))
    : [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { rows: sorted.map(l => pipelineRow(l, now, today, offers.has(l.id))), needCount: needs.length };
}

/** The step band: every lead in each step, over all of them, with the one fact each step needs. */
export function bandCells(book: BookLead[], now: Date, pay: PayRead): BandCell[] {
  return stepCounts(book, now).map(({ step, count, stuck }) => {
    const ls = book.filter(l => l.step === step);
    let note: string | null = stuck ? `${stuck} stuck` : null;
    if (step === 'new') note = count ? 'nobody has answered' : null;
    if (step === 'converted') {
      const signed = ls.filter(l => !l.demo);
      note = pay.kind === 'read' ? `${signed.filter(l => l.orgId && pay.paying.has(l.orgId)).length} pay now` : 'Pay now: Not read';
    }
    if (step === 'waiting_for_launch' && ls.length) {
      const counts = new Map<string, number>();
      for (const l of ls) for (const p of l.plans) counts.set(p, (counts.get(p) ?? 0) + 1);
      const top = [...counts].sort((a, b) => b[1] - a[1])[0];
      note = top ? `mostly for ${EARLY_ACCESS_PLAN_LABELS[top[0]] ?? top[0]}` : null;
    }
    if (step === 'lost' && ls.length) {
      const counts = new Map<string, number>();
      for (const l of ls) if (l.lostReason) counts.set(l.lostReason, (counts.get(l.lostReason) ?? 0) + 1);
      const top = [...counts].sort((a, b) => b[1] - a[1])[0];
      note = top ? `mostly ${lostWords(top[0])?.toLowerCase()}` : null;
    }
    return { step, label: EARLY_ACCESS_STATUS_LABELS[step], count, note, warn: stuck > 0 };
  });
}

/** "A club signed up with this lead's email. Cedar Hollow Youth Sports joined last night at 7:12 p.m. and is on a League Plus trial." */
export function offerSentence(c: OfferedClub, now: Date): string {
  const gap = daysBetweenDateStrings(orgDayKey(c.createdAt), tournamentToday(now));
  const when = gap === 0 ? `today at ${consoleClock(c.createdAt)}` : gap === 1 ? `yesterday at ${consoleClock(c.createdAt)}` : `on ${consoleDay(c.createdAt)}`;
  const plan = c.status === 'trialing' ? `is on a ${planName(c.planId)} trial` : `is on ${planName(c.planId)}`;
  return `${c.name} joined ${when} and ${plan}.`;
}
