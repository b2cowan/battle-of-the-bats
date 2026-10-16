/**
 * THE BOARD BEFORE THE EVENT, IN WORDS — one home (Tournament admin redesign Stage 5, E2; hub v45). The draft's board
 * (one checklist, every row a door, Ready to activate) and the weeks before game day (one note, five cards, every row a
 * door). The words are /marketing's (2026-10-10, `.probe/s5b/words-final.md` §3–§4); the builders turn the dashboard
 * route's facts into them, so the board says one thing wherever it is drawn.
 *
 *   - Fees are never "free" (F92, owner 10 Oct): a draft with none set up says "payments aren't tracked here" — the
 *     event may charge, and the organizer may collect outside the product.
 *   - An event's date range is `formatEventDateRange` (lib/timezone), the one formatter for it.
 *   - A lane is the sport's word ("diamond"), from the sport's pack.
 *
 * Pure (relative `.ts` imports), so a plain Node unit test reads it.
 */
import { formatEventDateRange } from './timezone.ts';
import { facilityKindForSport, facilityNoun } from './venue-facilities.ts';
import { getSportPack } from './sports.ts';
import type { ContactSource } from './tournament-activation.ts';
import type { TieBreaker } from './tie-breakers.ts';

// ── The facts the dashboard route reads (app/api/admin/tournament-dashboard) ─────────────────────────────────────

/** How the event's fees are set up — both boards read it (the draft's Fees row, the weeks-before Payments card). */
export type BoardFees = {
  /** settings.fee_scope: 'tournament' | 'allow_override' | 'per_division' | 'free' (stored `free` = not tracked) | null. */
  scope: string | null;
  /** tournaments.fee_schedule_mode. */
  mode: 'tournament' | 'division';
  total: number | null;
  deposit: number | null;
  /** Divisions with their own total fee. */
  divisionFees: number;
};

/** A draft's setup, as its board's rows say it. */
export type DraftSetup = {
  contact: { source: ContactSource | null; email: string | null };
  venues: { names: string[]; lanes: number };
  /** Rule sections. */
  rules: number;
  timing: {
    minutes: number | null;
    perDivision: boolean;
    breakers: TieBreaker[];
    breakersPerDivision: boolean;
  };
  /** The public site's pages that are on, by their label. */
  publicPages: string[];
  hasLogo: boolean;
  sport: string;
  /** Divisions open for registration, by name — Activate's question names them. */
  openDivisions: string[];
};

// ── Small helpers ────────────────────────────────────────────────────────────────────────────────────────────────

/** "$450" — the Teams screen's money (no cents unless there are some). */
export function boardMoney(value: number): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency', currency: 'CAD', maximumFractionDigits: Number.isInteger(value) ? 0 : 2, minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
  }).format(value);
}

/** "U11", "U11 and U13", "U11, U13, and U15" (the house's serial comma). */
export function andList(items: readonly string[]): string {
  if (items.length <= 2) return items.join(' and ');
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// ── Fees (F81, F92) ─────────────────────────────────────────────────────────────────────────────────────────────

export type FeeState = 'notSet' | 'notTracked' | 'perTeam' | 'perDivision';

export function feeState(f: BoardFees): FeeState {
  if (f.scope === 'free') return 'notTracked';
  if (f.scope === 'per_division' || f.mode === 'division') return f.divisionFees > 0 ? 'perDivision' : 'notSet';
  if (f.total != null && f.total > 0) return 'perTeam';
  if (f.divisionFees > 0) return 'perDivision';
  return 'notSet';
}

/** "$450 per team · a $100 deposit" / "Set for each division" / "Not tracked here" / "Not set up — …". */
export function feeLine(f: BoardFees): string {
  switch (feeState(f)) {
    case 'notSet': return DRAFT_BOARD_WORDS.feesNotSet;
    case 'notTracked': return DRAFT_BOARD_WORDS.feesNotTracked;
    case 'perDivision': return DRAFT_BOARD_WORDS.feesEachDivision;
    case 'perTeam': {
      const deposit = f.deposit != null && f.deposit > 0 ? ` · a ${boardMoney(f.deposit)} deposit` : '';
      return `${boardMoney(f.total ?? 0)} per team${deposit}`;
    }
  }
}

// ── The draft's board ───────────────────────────────────────────────────────────────────────────────────────────

export const DRAFT_BOARD_WORDS = {
  title: 'Before you activate',
  progress: (done: number, total: number) =>
    done >= total ? `${done} of ${total} done` : `${done} of ${total} done · it stays private until then`,
  dates: 'Dates',
  noDates: 'No dates yet',
  divisions: 'Divisions',
  contact: 'Who teams can write to',
  noContact: 'No contact yet — Activate needs one',
  orgContact: (email: string) => `Your organization’s email, ${email}`,
  /** A chosen member whose email can't be read: the row is still done (Activate reads a contact, not its address). */
  memberContact: 'A member of your organization',
  rest: 'The rest, when you’re ready',
  restCount: (done: number, total: number) => `${done} of ${total}`,
  venues: 'Venues',
  fees: 'Fees',
  feesNotSet: 'Not set up — payments aren’t tracked here',
  feesNotTracked: 'Not tracked here',
  feesEachDivision: 'Set for each division',
  schedule: 'Schedule',
  rules: 'Rules & resources',
  timing: 'Game timing & tie-breakers',
  publicSite: 'Public site',
  none: 'None yet',
  noGames: 'No games yet',
  games: (n: number) => plural(n, 'game', 'games'),
  sections: (n: number) => plural(n, 'section', 'sections'),
  ready: 'Ready to activate',
  publicLink: 'Public link',
  copy: 'Copy',
  copied: 'Copied',
  previewEyebrow: 'Preview',
  previewTitle: 'See what families and coaches see',
  previewLine: 'The public site and its registration form, as they’ll look once you activate',
  startFrom: 'Start from a past tournament',
  startFromLine: 'Bring in its divisions, venues, rules, and more',
  /** J1-021: the board with no tournament chosen. */
  noTournament: 'Choose a tournament first.',
  openTournaments: 'Open Tournaments',
} as const;

const W = DRAFT_BOARD_WORDS;

/** "May 14–16, 2027" — or "No dates yet". */
export function datesLine(start: string | null | undefined, end: string | null | undefined): string {
  return (start && end && formatEventDateRange(start, end, true)) || W.noDates;
}

/** "U11 · U13 · U15 — 24 spots" (four names at most, then "and 2 more"). */
/** `spots: false` — an invite-only event, which has no spots (the free tournament tier): the names alone. */
export function divisionsLine(divisions: readonly { name: string; capacity: number | null }[], { spots: withSpots = true } = {}): string {
  if (divisions.length === 0) return W.none;
  const shown = divisions.slice(0, 4).map(d => d.name);
  const more = divisions.length - shown.length;
  const names = `${shown.join(' · ')}${more > 0 ? ` and ${more} more` : ''}`;
  const spots = withSpots ? divisions.reduce((n, d) => n + (d.capacity != null && d.capacity > 0 ? d.capacity : 0), 0) : 0;
  return spots > 0 ? `${names} — ${plural(spots, 'spot', 'spots')}` : names;
}

/** "Your organization's email, info@…", the event's own address, or "No contact yet — Activate needs one". */
export function contactLine(contact: DraftSetup['contact']): string {
  if (!contact.source) return W.noContact;
  if (contact.source === 'org') return contact.email ? W.orgContact(contact.email) : W.noContact;
  return contact.email ?? W.memberContact;
}

/** "Lions Park · 3 diamonds" / "2 venues · 5 diamonds" / "None yet" — in the sport's word. */
export function venuesLine(venues: DraftSetup['venues'], sport: string | null | undefined): string {
  const kind = facilityKindForSport(sport);
  if (venues.names.length === 0) return W.none;
  const lanes = venues.lanes > 0 ? plural(venues.lanes, facilityNoun(kind, 1), facilityNoun(kind, 2)) : `no ${facilityNoun(kind, 2)} yet`;
  return venues.names.length === 1 ? `${venues.names[0]} · ${lanes}` : `${venues.names.length} venues · ${lanes}`;
}

/** "head-to-head, then run difference" — the first two tie-breakers, in the sport's own word. */
export function breakerPhrase(breakers: readonly TieBreaker[], sport: string | null | undefined): string {
  if (breakers.length === 0) return 'no tie-breakers';
  const unit = getSportPack(sport).score.unit.toLowerCase();
  const units = getSportPack(sport).score.unitPlural.toLowerCase();
  const word = (b: TieBreaker) => (
    b === 'h2h' ? 'head-to-head'
      : b === 'rd' ? `${unit} difference`
        : b === 'rf' ? `${units} scored`
          : b === 'ra' ? `${units} allowed`
            : 'a coin toss'
  );
  return breakers.slice(0, 2).map(word).join(', then ');
}

/** "90-minute games · head-to-head, then run difference". */
export function timingLine(timing: DraftSetup['timing'], sport: string | null | undefined): string {
  const length = timing.perDivision ? 'game length set for each division' : `${timing.minutes ?? 90}-minute games`;
  const breakers = timing.breakersPerDivision ? 'tie-breakers set for each division' : breakerPhrase(timing.breakers, sport);
  return capitalize(`${length} · ${breakers}`);
}

/** "Schedule, Standings, Teams, and Rules on · no logo". */
export function publicSiteLine(pages: readonly string[], hasLogo: boolean, allPages: number): string {
  const on = pages.length === 0 ? 'Every page hidden' : pages.length >= allPages ? 'Every page on' : `${andList(pages)} on`;
  return `${on} · ${hasLogo ? 'with its logo' : 'no logo'}`;
}

// ── The weeks before game day ───────────────────────────────────────────────────────────────────────────────────

export const WEEKS_BEFORE_WORDS = {
  note: (days: number) => (days === 1 ? 'Your event is tomorrow.' : `Your event is ${days} days away.`),
  noteLine: 'Tell your teams what to expect.',
  noteDoor: 'Message teams',
  registration: 'Registration',
  regFigure: (accepted: number, capacity: number, thisWeek: number) =>
    `${capacity > 0 ? `${accepted} of ${capacity} spots` : `${accepted} accepted`}${thisWeek > 0 ? ` · ${thisWeek} this week` : ''}`,
  divisionLine: (d: { accepted: number; capacity: number | null; waitlist: number }) => {
    const full = d.capacity != null && d.capacity > 0 && d.accepted >= d.capacity;
    return [
      d.capacity != null && d.capacity > 0 ? `${d.accepted} of ${d.capacity} accepted` : `${d.accepted} accepted`,
      full ? 'full' : '',
      d.waitlist > 0 ? `${d.waitlist} on the waitlist` : '',
    ].filter(Boolean).join(' · ');
  },
  waiting: (n: number) => `${n} waiting`,
  noDivisions: 'No divisions yet',
  noDivisionsLine: 'Teams register into a division',
  payments: 'Payments',
  payFigure: (collected: number, expected: number) => `${boardMoney(collected)} of ${boardMoney(expected)}`,
  paidLine: (paid: number, deposits: number) =>
    [paid > 0 ? `${paid} paid in full` : '', deposits > 0 ? `${deposits} paid a deposit` : ''].filter(Boolean).join(' · ') || 'Nobody has paid yet',
  owingLine: (unpaid: number, pastDue: number) =>
    [unpaid > 0 ? `${unpaid} haven’t paid` : '', pastDue > 0 ? `${pastDue} past due` : ''].filter(Boolean).join(' · ') || 'Everyone is up to date',
  nothingDue: (fees: string) => `${fees} · nothing due until a team is accepted`,
  coaches: 'Coaches',
  coachesFigure: (signed: number, total: number) => `${signed} of ${total} signed up`,
  notJoined: (n: number) => `${n} haven’t joined yet`,
  joinLine: 'A coach who signs up joins the event’s chat room',
  openRoom: 'Open the room on Chat, and every coach who signs up joins it',
  allJoined: 'Every team’s coach is signed up',
  noTeams: 'No teams yet',
  noTeamsLine: 'A coach who claims their team joins the event’s chat room',
  noEmail: (n: number) => `${plural(n, 'team has', 'teams have')} no coach email`,
  noEmailLine: 'Add one so they can be invited',
  coachesLoading: 'Reading coach sign-ups…',
  coachesFailed: 'Couldn’t load coach sign-ups.',
  coachesFailedLine: 'Your coaches and the chat room are unaffected.',
  tryAgain: 'Try again',
  chatLocked: 'Tournament Chat',
  remind: (n: number) => `Remind ${plural(n, 'team', 'teams')}`,
  sending: 'Sending…',
  remindedAgo: (mins: number) =>
    mins < 1 ? 'Reminded just now'
      : mins < 60 ? `Reminded ${plural(mins, 'minute', 'minutes')} ago`
        : `Reminded ${plural(Math.floor(mins / 60), 'hour', 'hours')} ago`,
  noRemindAccess: 'An organizer with registration access can remind them',
  noRemindEmail: 'None of them has an email on file to remind',
  finishedRemind: 'This tournament has finished, so sign-up reminders are no longer sent',
  messages: 'Messages',
  nothingSent: 'Nothing sent yet',
  messagesLine: 'Announcements go to the public site and your teams',
  sent: (total: number, emailed: number) =>
    `${plural(total, 'announcement', 'announcements')}${emailed > 0 ? ` · ${emailed} emailed` : ''}`,
  schedule: 'Schedule',
  noTimes: 'No games have times yet',
  teamsIn: (teams: number, divisions: number) => `${plural(teams, 'team', 'teams')} in ${plural(divisions, 'division', 'divisions')}`,
  timed: (timed: number, total: number) => `${timed} of ${plural(total, 'game has', 'games have')} times`,
  healthLine: (tone: 'good' | 'warning' | 'danger', issues: number) =>
    tone === 'good' && issues === 0 ? 'No schedule issues' : `${plural(issues, 'issue', 'issues')} to ${tone === 'danger' ? 'fix' : 'review'}`,
  allHidden: 'Every card is hidden. Customize this board to bring them back.',
} as const;
