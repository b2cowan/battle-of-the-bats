/**
 * AFTER THE EVENT'S WORDS — one home (Tournament admin redesign Stage 4, 2026-10-06): the finished board,
 * Summary and its printed page, the reuse step, and the two lists. The words are `/marketing`'s (one run,
 * 2026-10-06, with every fact checked against the code first); the placement is the owner's ruling (hub
 * Stage 4 tab, D1–D6, A19–A24; P1–P5 at the build's start). The status changes' sentences live beside
 * the archive sentence in `lib/tournament-status-words.ts`.
 *
 * Plain strings and small functions only — no React — so a unit test and the help content's search
 * keywords can read the same word.
 *
 * ⚠ Calls /marketing made that change a drawn word (the plan's §6d records them): a running event's
 * status is "Active", never "Live" — "Live" is one GAME in progress (G1, `PHASE_LABEL`); a public site is
 * "online" / "offline"; the figures card is "The event in numbers" (not every event is a weekend; it
 * pairs with game day's "The event so far"); the reuse window is "New tournament from ‹event›".
 */
import { formatShortWeekdayDate } from './timezone.ts';
import { pluralize as plural } from './utils.ts';
import { formatMoney as money } from './tournament-teams.ts';
import type { DivisionFinish, EventRecap } from './event-recap.ts';

/** The plan an after-event lock names (the Facts doc's spelling). */
export const AFTER_EVENT_LOCK_PLAN = 'Tournament Plus';

/** "won the final by forfeit over X" / "beat X 5–4 in the final" (a score keeps its dash). */
function finalWords(f: Extract<DivisionFinish, { kind: 'champion' }>): string {
  if (f.byForfeit) return f.runnerUpName ? `won the final by forfeit over ${f.runnerUpName}` : 'won the final by forfeit';
  const score = `${f.winnerScore}–${f.loserScore}`;
  return f.runnerUpName ? `beat ${f.runnerUpName} ${score} in the final` : `won the final ${score}`;
}

/** A win–loss record takes a hyphen (3-0-0, the 2026-08-19 rule). */
export const winLossRecord = (w: number, l: number, t: number) => `${w}-${l}-${t}`;

/** "first in the standings, 3-0-0 · no final" — one phrase for the screen's row and the printed page. */
const standingsTail = (f: Extract<DivisionFinish, { kind: 'standings' }>) =>
  `first in the standings, ${winLossRecord(f.w, f.l, f.t)} · ${f.final === 'unscored' ? 'final not scored' : 'no final'}`;
/** ", Sun, Oct 4" — the day a champion's final was played; '' otherwise. */
const dayOf = (f: DivisionFinish) => (f.kind === 'champion' && f.finalDate ? `, ${formatShortWeekdayDate(f.finalDate)}` : '');

/** The money pair is said when the event charged fees or collected anything (the definitions: collected
 *  counts with or without a fee schedule) — never a pair of zeroes for a free event. */
export const hasMoney = (r: EventRecap) => r.money.charged || r.money.collected > 0;

export const FINISH_WORDS = {
  heading: 'How it finished',
  /** The board's and Summary's row caption (without the final's day — `finalDay` adds it at a desk). */
  caption(f: DivisionFinish): string {
    if (f.kind === 'champion') {
      const who = f.tierLabel ? `${f.divisionName} · ${f.tierLabel} champion` : `${f.divisionName} champion`;
      return `${who} · ${finalWords(f)}`;
    }
    return `${f.divisionName} · ${standingsTail(f)}`;
  },
  /** The final's day, which a desk's row adds. */
  finalDay: dayOf,
  /** The printed page's "How it finished" column (the division has its own column there). */
  printCell(f: DivisionFinish): string {
    if (f.kind === 'champion') {
      const who = f.tierLabel ? `${f.tierLabel} champion` : 'Champion';
      return `${who} · ${finalWords(f)}${dayOf(f)}`;
    }
    const tail = standingsTail(f);
    return tail.charAt(0).toUpperCase() + tail.slice(1);
  },
  /** The board's foot line: the teams that played · games played · the money in three states. The
   *  owed clause is returned apart, so the screen can set it in the amber of money owed. */
  footLine(r: EventRecap): { lead: string; owed: string | null } {
    const parts = [plural(r.teamsPlayed, 'team'), `${plural(r.gamesPlayed, 'game')} played`];
    if (!hasMoney(r)) return { lead: parts.join(' · '), owed: null };
    if (r.money.owed <= 0) return { lead: [...parts, `${money(r.money.collected)} collected, all paid`].join(' · '), owed: null };
    return {
      lead: [...parts, `${money(r.money.collected)} collected`].join(' · '),
      owed: `${money(r.money.owed)} still owed by ${plural(r.money.teamsOwing, 'team')}`,
    };
  },
} as const;

/** The copy action (P3: the champions page when it will name one, else the Standings page). */
export const SHARE_WORDS = {
  champions: { label: 'Copy champions link', name: 'Copy the champions link', copied: 'Champions link copied' },
  standings: { label: 'Copy standings link', name: 'Copy the standings link', copied: 'Standings link copied' },
  failed: 'Your browser didn’t let us copy the link.',
  /** In place of the button when Standings is hidden (the champions page follows it). */
  hidden: 'Standings is hidden on your public site, so there’s no results link to share.',
} as const;

export const NEXT_YEAR_WORDS = {
  heading: 'Next year',
  sentence: (year: number | null | undefined) =>
    `Start ${year ? year + 1 : 'next year'} from this event’s divisions, venues, fees, registration questions, rules, and public site. Teams, scores, and payments stay with this one.`,
  reuse: 'Reuse this setup',
  /** The record's caption beside it. */
  recordCaption: 'Starts a private draft from this event',
  /** The Tournament plan: one slot, held. */
  oneSlotHeld: 'Your plan has one tournament slot, and this event holds it. To set up next year’s event, archive this one first: its public site goes offline and the links you’ve shared stop working.',
  slotsHeld: (holders: number) =>
    `Your plan has one tournament slot, and ${holders} events hold one, this one included. To set up next year’s event, archive all ${holders} first: each one’s public site goes offline and the links you’ve shared stop working.`,
  archive: 'Archive this tournament',
  lockReuse: 'Reuse this setup for next year',
} as const;

export const BOARD_WORDS = {
  /** Summary's door card. */
  doorEyebrow: 'Summary',
  doorTitle: 'Your event’s recap',
  doorCaption: 'A champions link to share, and a printed page for your records',
  lockSummary: 'Summary',
  /** The phone strip's door on a finished event's other pages. */
  stripSummary: 'Review the summary',
} as const;

export const SUMMARY_WORDS = {
  title: 'Summary',
  noEvent: 'Select a tournament from the sidebar to view its summary.',
  print: 'Print',
  figuresHeading: 'The event in numbers',
  teams: (n: number) => (n === 1 ? 'team' : 'teams'),
  gamesPlayed: (n: number, playoffs: number) =>
    `${n === 1 ? 'game' : 'games'} played${playoffs > 0 ? ` · ${playoffs} in the playoffs` : ''}`,
  collected: 'collected',
  stillOwed: 'still owed',
  money,
  closingLine: 'FieldLogicHQ also runs season-long leagues and full club operations.',
  closingLink: 'See what League Plus and Club include',
  /** The Tournament plan's page: the title, this sentence, the lock line. */
  lockedSentence: 'A recap of how it finished and the event’s figures, on one page that prints for your records.',
  // ── The printed page ──
  printEyebrow: (club: string) => `${club} · Summary`,
  printStandings: 'Final standings',
  printColumns: { division: 'Division', team: 'Team', finish: 'How it finished', record: 'W-L-T' },
  printed: (date: string) => `Printed ${date}`,
} as const;

/** The reuse step (D2). The flow's customer name stays "Reuse this setup". */
export const REUSE_WORDS = {
  title: (source: string) => `New tournament from ${source}`,
  lede: 'Name the new draft and choose what to bring forward.',
  dateHint: 'You can change the dates later if they aren’t final yet.',
  whatToBring: 'What to bring forward',
  count: (chosen: number, total: number) => `${chosen} of ${total}`,
  areas: {
    structure: { title: 'Event structure', caption: 'Divisions, pools, and empty schedule slots' },
    venues: { title: 'Locations', caption: 'Venues and playing surfaces' },
    registration: { title: 'Registration setup', caption: 'Registration questions and fees' },
    publicPresence: { title: 'Public presence', caption: 'Branding and public page settings' },
    content: { title: 'Content', caption: 'Rules, resources, and welcome content' },
  },
  neverCopied: (source: string) =>
    `Teams, registrations, games, scores, payments, files, messages, and admin notes stay with ${source}.`,
  reviewHeading: 'Review before you publish',
  warning: {
    source_draft: (source: string) => `${source} is still a draft, so some of its setup may be unfinished.`,
    source_active: (source: string) => `${source} is still active, so its setup may still change.`,
    source_older_than_one_year: (source: string, years: number) =>
      `${source} ran ${years} years before this draft: its dates, contacts, fees, rules, and public text may need a refresh.`,
    draft_year_before_source: (source: string) => `This draft’s year is before ${source}’s. Check the name and dates.`,
    registration_setup_review: 'Registration setup: check the questions, fee amounts, due dates, and payment instructions.',
    public_content_review: 'Public presence and content: check sponsor names, rules, resources, welcome text, and hidden pages.',
  },
  privacy: 'The new tournament stays private as a draft until you activate it.',
  create: 'Create the draft',
  creating: 'Creating the draft…',
  cancel: 'Cancel',
  nothingChosenDoor: 'Choose at least one area to bring forward.',
  nothingChosenNew: 'Choose at least one area to bring forward, or start a blank tournament.',
  slugInvalid: 'Use lowercase letters, numbers, and hyphens in the public link.',
  /** The notice on the new draft's board. */
  created: (source: string) => `Draft created from ${source}`,
} as const;

/** The one Tournaments list (D7, ruled 2026-10-06 — it replaced A22's two lists): every event in one band. */
export const LIST_WORDS = {
  tournaments: 'Tournaments',
  newTournament: 'New tournament',
  /** "1 of 1 tournament slot in use" — on a plan with a finite number of slots. */
  slotsInUse: (used: number, limit: number) =>
    used > limit
      ? `${used} events hold slots; your plan has ${limit}.`
      : `${used} of ${limit} tournament ${limit === 1 ? 'slot' : 'slots'} in use`,
  /** A finished event's teams are history: "no teams", never "no teams yet". */
  teams: (n: number, finished = false) => (n === 0 ? (finished ? 'no teams' : 'no teams yet') : n === 1 ? '1 team' : `${n} teams`),
  datesNotSet: 'Dates not set',
  nothingYet: 'No tournaments yet.',
  colTournament: 'Tournament',
  colDates: 'Dates',
  colTeams: 'Teams',
  /** What each band means for the public site, said ONCE beside its count (it replaced a column that
   *  repeated it on every row). */
  bandSite: { active: 'public site online', draft: 'private', completed: 'public site online', archived: 'public site offline' },
  publicLedger: 'Public ledger',
  sealedBand: 'Sealed records',
  /** The Completed band's row action — a named short form; everywhere else "Reuse this setup". */
  reuseRow: 'Reuse setup',
  noneSealed: 'None yet. Seal a finished tournament from its record to keep a permanent public record of its results.',
  /** The record's position at its foot. */
  position: (i: number, n: number) => `${i} of ${n}`,
  positionIn: (i: number, n: number, band: string) => `${i} of ${n} in ${band}`,
} as const;
