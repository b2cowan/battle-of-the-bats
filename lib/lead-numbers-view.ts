/**
 * Leads › Numbers in words (Support console Stage 7 Part 5; drawing B). Read live when the view opens, from dated facts
 * we already keep (owner Q3 A): nothing stored, nothing scheduled. Every count is `leadNumbers`'s; this module only
 * picks the period, applies the filter and writes the sentences, including the ones whose figures are computed rather
 * than typed ("3 of the 11 were offered matches", "anything before May 20").
 */
import { consoleDate, consoleDay } from './console-dates';
import { tournamentToday } from './timezone';
import { leadPageLabel } from './early-access-admin';
import { leadNumbers, PAYING_RECORDED_FROM, type AccountsRead, type GroupRow, type LeadFacts, type LeadNumbers, type PayRead } from './lead-numbers';

export type PeriodKey = 'all' | 'month' | '30' | '90' | 'year';
export type PeriodPick = { key: PeriodKey; from: string | null; to: string | null; label: string };

function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10); // utc-intentional: a calendar-day step from a noon anchor
}

export function periodOptions(leads: Pick<LeadFacts, 'createdAt'>[], now: Date): PeriodPick[] {
  const today = tournamentToday(now);
  const first = leads.reduce<string | null>((min, l) => (!min || l.createdAt < min ? l.createdAt : min), null);
  return [
    { key: 'all', from: null, to: null, label: first ? `All time · since ${consoleDay(first)}` : 'All time' },
    { key: 'month', from: `${today.slice(0, 7)}-01`, to: today, label: 'This month' },
    { key: '30', from: addDays(today, -29), to: today, label: 'Last 30 days' },
    { key: '90', from: addDays(today, -89), to: today, label: 'Last 90 days' },
    { key: 'year', from: `${today.slice(0, 4)}-01-01`, to: today, label: 'This year' },
  ];
}

export function parsePeriod(raw: string | undefined, leads: Pick<LeadFacts, 'createdAt'>[], now: Date = new Date()): PeriodPick {
  const all = periodOptions(leads, now);
  return all.find(p => p.key === raw) ?? all[0];
}

export type NumbersFilters = { plan: string; source: string; tag: string; page: string };

export type NumbersModel = {
  period: PeriodPick;
  periods: PeriodPick[];
  numbers: LeadNumbers;
  /** "May 20 to Oct 27" under Leads arrived. */
  rangeLine: string;
  definitions: { term: string; text: string }[];
  /** The trend's caveat, said where the trend shows it. */
  payingFrom: string;
  filterOptions: { plans: string[]; tags: string[]; pages: string[] };
  filtered: boolean;
};

export function numbersView(all: LeadFacts[], period: PeriodPick, f: NumbersFilters, pay: PayRead, accounts: AccountsRead, linked: ReadonlySet<string>, now: Date): NumbersModel {
  const leads = all.filter(l =>
    (!f.plan || (f.plan === 'none' ? l.plans.length === 0 : l.plans.includes(f.plan)))
    && (!f.source || (f.source === 'not_set' ? !l.source : l.source === f.source))
    && (!f.tag || l.refTag === f.tag)
    && (!f.page || leadPageLabel(l.sourcePath) === f.page));
  const numbers = leadNumbers(leads, period, pay, accounts, linked);
  const first = all.reduce<string | null>((min, l) => (!min || l.createdAt < min ? l.createdAt : min), null);
  const today = tournamentToday(now);
  const rangeLine = `${consoleDay(period.from ?? first ?? today)} to ${consoleDay(period.to ?? today)}`;
  return {
    period,
    periods: periodOptions(all, now),
    numbers,
    rangeLine,
    definitions: [
      { term: 'Leads arrived', text: 'leads whose first form came in the period. A second form from the same address is the same lead.' },
      {
        term: 'Signed up',
        text: `of those leads, the ones linked to a club or a Coaches Portal by a person (an offered match they confirmed, or by hand), at any time up to today.${numbers.signedUp ? ` ${numbers.offered} of the ${numbers.signedUp} were offered matches.` : ''}`,
      },
      { term: 'Pay now', text: 'of those, the ones paying today: their own plan is not the free Tournament plan, their billing is active, and a real subscription stands behind it. A trial, free time and a Founding Season comp are not paying.' },
      { term: 'Time to sign up', text: 'days from the lead’s first form to the day its club or portal was created, not the day staff linked it. A club that already existed before the first form is still Signed up, but is left out of this figure.' },
      { term: 'Link tag', text: 'the tag on the link a lead arrived by, from our short list. A lead that filled the form again keeps its first tag. Leads with no tag are counted too, so the tagged ones are not mistaken for all of them.' },
      { term: 'What it cannot know', text: `whether a charge was actually collected or how much; how a lead heard of us unless staff recorded it or the visitor said; a club that signed up under a different address from the lead’s until someone links it; anything before ${first ? consoleDay(first) : 'the first lead'}.` },
    ],
    payingFrom: `“Started a subscription” counts the leads of each month whose club began a subscription of its own, from ${consoleDate(`${PAYING_RECORDED_FROM}T12:00:00Z`)}, the day we began recording when one starts. Earlier months show no figure, and that first month counts only starts from that day. Pay now is today’s count.`,
    filterOptions: {
      plans: [...new Set(all.flatMap(l => l.plans))],
      tags: [...new Set(all.map(l => l.refTag).filter((x): x is string => !!x))],
      pages: [...new Set(all.map(l => leadPageLabel(l.sourcePath)))].sort(),
    },
    filtered: !!(f.plan || f.source || f.tag || f.page),
  };
}

/** The export's rows for one table, in the screen's words (Tools › Export the numbers). */
export function tableRows(rows: GroupRow[], withDays: boolean): (string | number)[][] {
  return rows.map(r => [r.label, r.leads, r.signedUp, r.rate === null ? '—' : `${r.rate}%`, r.payNow ?? 'Not read', ...(withDays ? [r.days ?? '—'] : [])]);
}
