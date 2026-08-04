/**
 * lib/demo-moments.ts — the two STILL moments of the demo's year, as pure functions of the clock.
 *
 * Phase 2 of the tournament sandbox ("the moments dock", mockups artifact
 * `f8a2d820-31cb-409a-bbf0-91b7ceed933c`, ratified 2026-08-04) adds two more events to the ONE
 * demo org, in two other lifecycle states:
 *
 *   • **Riverdale Season Opener** (`season-opener`) — finished YESTERDAY, permanently. Every
 *     score in, the U11 bracket resolved, a champion crowned. "The morning after."
 *   • **Riverdale Invitational** (`invitational`) — first pitch in THREE WEEKS, permanently.
 *     Mid-registration: one division full with a waitlist, one still filling, payments
 *     part-collected. "Registration week."
 *
 * Neither moment ticks. Unlike the Summer Classic (whose minute-by-minute state lives in
 * `lib/demo-tournament.ts`), these two only need their DATES dragged along as the real calendar
 * moves — which the same stateless reconcile run does, diff-only, with no cursor and no
 * migration. Given the same `now`, every function here returns the same answer, which is what
 * lets the seed and the reconcile job agree without talking to each other.
 *
 * Scores here use `deterministicScore` UNSCALED (not the ×2 bracket variant): nothing in these
 * events is ever live, so there is no run-cadence to serve — only believable youth-ball finals.
 *
 * ⚠ The Opener's champion is **Cedar Hollow Cyclones**, deliberately NOT the club that leads the
 * Summer Classic — two events with the same winner reads as scripted. The strengths below are
 * what make that true; the seed still derives seeding through the app's real standings engine.
 */
import {
  deterministicScore,
  shiftedDate,
  DEMO_BRACKET_CODES,
  ROUND_ROBIN_PAIRS,
  ROUND_ROBIN_SLOTS,
  DEMO_GAME_DURATION_MINUTES,
  roundRobinFacilityIndex,
  type DemoDivisionDef,
} from './demo-tournament.ts';
import {
  buildRegistrationAttentionSummary,
  type RegistrationAttentionKey,
} from './registration-attention.ts';
import { DEMO_OPENER_SLUG, DEMO_INVITATIONAL_SLUG } from './demo-org.ts';

export { DEMO_OPENER_SLUG, DEMO_INVITATIONAL_SLUG };

export const DEMO_OPENER_NAME = 'Riverdale Season Opener';
export const DEMO_INVITATIONAL_NAME = 'Riverdale Invitational';

// ═══════════════════════════ The Season Opener — the morning after ═══════════════════════════

/**
 * Same four clubs as the Summer Classic — the association's teams play the association's events —
 * but different strengths, so the Opener tells a different story: the Cyclones' tournament.
 */
export const OPENER_DIVISIONS: readonly DemoDivisionDef[] = [
  {
    name: 'U11',
    hasBracket: true,
    teams: [
      { name: 'Cedar Hollow Cyclones',  strength: 4, coach: 'Priya Raman' },
      { name: 'Riverdale Rapids',       strength: 3, coach: 'Dana Whitfield' },
      { name: 'Maple Ridge Marauders',  strength: 2, coach: 'Aaron Beaulieu' },
      { name: 'Silver Creek Sharks',    strength: 1, coach: 'Rosa Ferreira' },
    ],
  },
  {
    name: 'U13',
    hasBracket: false,
    teams: [
      { name: 'Riverdale Thunder',      strength: 4, coach: 'Marcus Delacroix' },
      { name: 'Cedar Hollow Comets',    strength: 3, coach: 'Ingrid Halloran' },
      { name: 'Maple Ridge Mustangs',   strength: 2, coach: 'Tobias Nakamura' },
      { name: 'Silver Creek Storm',     strength: 1, coach: 'Yvette Ouellette' },
    ],
  },
];

/** One registration the Opener turned away — so the Post-Event Summary's "Rejected" row is honest. */
export const OPENER_REJECTED_TEAM = {
  name: 'Port Hope Panthers', division: 'U11', coach: 'Ellis Vandermeer',
} as const;

export const OPENER_PLAYOFF_CONFIG = {
  type: 'single',
  crossover: 'reseed',
  tieBreakers: ['h2h', 'rd', 'rf', 'ra'],
  hasThirdPlace: false,
  teamsQualifying: 4,
} as const;

/** Tournament-level fee block: eight teams, all settled — the morning after should feel like relief. */
export const OPENER_FEE = { totalFee: 600, deposit: 150 } as const;

/** Day offsets relative to `now` (org zone). Bracket day is always yesterday. */
const OPENER_BRACKET_DAY_OFFSET = -1;

/**
 * The Opener's round-robin slots are the Summer Classic's OWN pattern (same pairing order,
 * midday hours, facility split), shifted so the Classic's bracket-relative day offsets land on
 * the days before the Opener's bracket day. Derived, not retyped — if the Classic's pattern
 * ever changes, the Opener moves with it.
 */
const OPENER_RR_SLOTS = ROUND_ROBIN_SLOTS.map(slot => ({
  ...slot,
  dayOffset: slot.dayOffset + OPENER_BRACKET_DAY_OFFSET,
}));

export interface OpenerGameState {
  /** `SF1`/`SF2`/`FIN` for bracket games; `RR-<division>-<n>` for pool games. */
  key: string;
  date: string;
  time: string;
  /** Every Opener game is complete — that is the whole moment. */
  status: 'completed';
  homeScore: number;
  awayScore: number;
  /** Which diamond, by the Classic's facility-index rule. Bracket games sit on the first pair. */
  facilityIndex: number;
  isPlayoff: boolean;
}

export interface OpenerState {
  slug: string;
  startDate: string;
  endDate: string;
  /** Org-zone date the champion was crowned — always yesterday, like the bracket. */
  crownedDate: string;
  games: OpenerGameState[];
}

/** The Opener's seeds, strongest first. */
export function openerBracketSeeds() {
  const bracket = OPENER_DIVISIONS.find(d => d.hasBracket)!;
  return [...bracket.teams].sort((a, b) => b.strength - a.strength);
}

/** What the finished Opener should look like at this instant. Pure. */
export function resolveOpenerState(now: Date = new Date()): OpenerState {
  const bracketDay = shiftedDate(now, OPENER_BRACKET_DAY_OFFSET);
  const startDate = shiftedDate(now, Math.min(...OPENER_RR_SLOTS.map(slot => slot.dayOffset)));
  const games: OpenerGameState[] = [];

  OPENER_DIVISIONS.forEach((division, divisionIndex) => {
    ROUND_ROBIN_PAIRS.forEach((pair, index) => {
      const slot = OPENER_RR_SLOTS[index];
      const home = division.teams[pair[0]];
      const away = division.teams[pair[1]];
      const score = deterministicScore(home.strength, away.strength);
      games.push({
        key: `RR-${division.name}-${index}`,
        date: shiftedDate(now, slot.dayOffset),
        time: `${String(slot.hour).padStart(2, '0')}:00:00`,
        status: 'completed',
        homeScore: score.homeScore,
        awayScore: score.awayScore,
        facilityIndex: roundRobinFacilityIndex(index, divisionIndex),
        isPlayoff: false,
      });
    });
  });

  const [seed1, seed2, seed3, seed4] = openerBracketSeeds();
  const sf1 = deterministicScore(seed1.strength, seed4.strength);
  const sf2 = deterministicScore(seed2.strength, seed3.strength);
  const fin = deterministicScore(seed1.strength, seed2.strength);

  games.push(
    { key: DEMO_BRACKET_CODES.SF1, date: bracketDay, time: '10:00:00', status: 'completed',
      homeScore: sf1.homeScore, awayScore: sf1.awayScore, facilityIndex: 0, isPlayoff: true },
    { key: DEMO_BRACKET_CODES.SF2, date: bracketDay, time: '10:00:00', status: 'completed',
      homeScore: sf2.homeScore, awayScore: sf2.awayScore, facilityIndex: 1, isPlayoff: true },
    { key: DEMO_BRACKET_CODES.FIN, date: bracketDay, time: '14:00:00', status: 'completed',
      homeScore: fin.homeScore, awayScore: fin.awayScore, facilityIndex: 0, isPlayoff: true },
  );

  return { slug: DEMO_OPENER_SLUG, startDate, endDate: bracketDay, crownedDate: bracketDay, games };
}

/** Opener settings mirror the Classic's minimal, payment-instruction-free block. */
export const OPENER_TOURNAMENT_SETTINGS = {
  format: 'round_robin_playoffs',
  fee_scope: 'tournament',
  tie_breakers: ['h2h', 'rd', 'rf', 'ra'],
  tie_breaker_scope: 'tournament',
  buffer_minutes: 15,
  game_timing_scope: 'tournament',
  game_duration_minutes: DEMO_GAME_DURATION_MINUTES,
  show_fees_on_register: false,
  payment_instructions_on_form: false,
  roster_require: false,
} as const;

// ═══════════════════════════ The Invitational — registration week ════════════════════════════

/** First pitch is always exactly three weeks out; the event runs a weekend. */
const INVITATIONAL_START_OFFSET = 21;
const INVITATIONAL_END_OFFSET = 22;

/**
 * Per-division fee schedules (`fee_schedule_mode='division'`), and the due dates are the whole
 * trick: the U13 deposit deadline is five days PAST, so exactly one accepted team that never
 * paid its deposit reads **Past Due**, while U11's deadlines are still ahead, so its unpaid
 * accepted teams read **Pending** (the "Unpaid" bucket) rather than delinquent. Fee AMOUNTS are
 * ratified as safe to show; payment INSTRUCTIONS remain banned everywhere in the sandbox.
 */
export const INVITATIONAL_FEE = { totalFee: 600, deposit: 150 } as const;

export interface InvitationalDivisionDef {
  name: string;
  capacity: number;
  /** Org-zone day offsets from now for the division's fee deadlines. */
  depositDueOffset: number;
  balanceDueOffset: number;
}

const INVITATIONAL_DIVISIONS: readonly InvitationalDivisionDef[] = [
  { name: 'U11', capacity: 8, depositDueOffset: 7, balanceDueOffset: 14 },
  { name: 'U13', capacity: 8, depositDueOffset: -5, balanceDueOffset: 14 },
];

export interface InvitationalTeamDef {
  name: string;
  division: string;
  coach: string;
  status: 'accepted' | 'pending' | 'waitlist';
  waitlistPosition: number | null;
  depositPaid: number;
  totalPaid: number;
  /** How many days before `now` this team registered — re-anchored daily with everything else. */
  registeredDaysAgo: number;
}

/**
 * The pipeline the mockups drew, exactly: U11 full (8 accepted, 2 waitlisted), U13 filling
 * (3 accepted, 2 pending review). Payments: 5 paid in full, 4 deposit-only, 3 untouched, and
 * one — the Miners — past its division's deposit deadline. Out-of-town clubs are what an
 * *Invitational* invites; every contact is an unreachable reserved-domain address.
 */
export const INVITATIONAL_TEAMS: readonly InvitationalTeamDef[] = [
  // U11 — full, with a waitlist forming
  { name: 'Riverdale Royals',      division: 'U11', coach: 'Jonah Castellano',  status: 'accepted', waitlistPosition: null, depositPaid: 150, totalPaid: 600, registeredDaysAgo: 16 },
  { name: 'Cedar Hollow Coyotes',  division: 'U11', coach: 'Mirembe Osei',      status: 'accepted', waitlistPosition: null, depositPaid: 150, totalPaid: 600, registeredDaysAgo: 15 },
  { name: 'Maple Ridge Mallards',  division: 'U11', coach: 'Signe Lindqvist',   status: 'accepted', waitlistPosition: null, depositPaid: 150, totalPaid: 600, registeredDaysAgo: 13 },
  { name: 'Silver Creek Spartans', division: 'U11', coach: 'Amelie Duval',      status: 'accepted', waitlistPosition: null, depositPaid: 150, totalPaid: 600, registeredDaysAgo: 12 },
  { name: 'Birchmount Bombers',    division: 'U11', coach: 'Callum Featherstone', status: 'accepted', waitlistPosition: null, depositPaid: 150, totalPaid: 150, registeredDaysAgo: 10 },
  { name: 'Port Sydney Pirates',   division: 'U11', coach: 'Nadia Kowalczyk',   status: 'accepted', waitlistPosition: null, depositPaid: 0,   totalPaid: 0,   registeredDaysAgo: 8 },
  { name: 'Halton Hills Hornets',  division: 'U11', coach: 'Desmond Achebe',    status: 'accepted', waitlistPosition: null, depositPaid: 0,   totalPaid: 0,   registeredDaysAgo: 6 },
  { name: 'Two Rivers Twisters',   division: 'U11', coach: 'Bronwyn Meadows',   status: 'accepted', waitlistPosition: null, depositPaid: 0,   totalPaid: 0,   registeredDaysAgo: 5 },
  { name: 'Lakefield Loons',       division: 'U11', coach: 'Hugo Sablon',       status: 'waitlist', waitlistPosition: 1,    depositPaid: 0,   totalPaid: 0,   registeredDaysAgo: 3 },
  { name: 'Glen Abbey Giants',     division: 'U11', coach: 'Tamsin Oyelaran',   status: 'waitlist', waitlistPosition: 2,    depositPaid: 0,   totalPaid: 0,   registeredDaysAgo: 2 },
  // U13 — filling, with review work waiting
  { name: 'Riverdale Otters',      division: 'U13', coach: 'Jules Castellano',  status: 'accepted', waitlistPosition: null, depositPaid: 150, totalPaid: 600, registeredDaysAgo: 14 },
  { name: 'Cedar Hollow Kestrels', division: 'U13', coach: 'Maren Osei',        status: 'accepted', waitlistPosition: null, depositPaid: 150, totalPaid: 150, registeredDaysAgo: 11 },
  { name: 'Maple Ridge Miners',    division: 'U13', coach: 'Torsten Lindqvist', status: 'accepted', waitlistPosition: null, depositPaid: 0,   totalPaid: 0,   registeredDaysAgo: 12 },
  { name: 'Silver Creek Sabres',   division: 'U13', coach: 'Anouk Duval',       status: 'pending',  waitlistPosition: null, depositPaid: 150, totalPaid: 150, registeredDaysAgo: 2 },
  { name: 'Riverdale Bears',       division: 'U13', coach: 'Petra Whitcombe',   status: 'pending',  waitlistPosition: null, depositPaid: 150, totalPaid: 150, registeredDaysAgo: 1 },
];

export interface InvitationalState {
  slug: string;
  startDate: string;
  endDate: string;
  divisions: Array<InvitationalDivisionDef & { depositDueDate: string; balanceDueDate: string }>;
  teams: Array<InvitationalTeamDef & { registeredDate: string }>;
}

/** What the mid-registration Invitational should look like at this instant. Pure. */
export function resolveInvitationalState(now: Date = new Date()): InvitationalState {
  return {
    slug: DEMO_INVITATIONAL_SLUG,
    startDate: shiftedDate(now, INVITATIONAL_START_OFFSET),
    endDate: shiftedDate(now, INVITATIONAL_END_OFFSET),
    divisions: INVITATIONAL_DIVISIONS.map(division => ({
      ...division,
      depositDueDate: shiftedDate(now, division.depositDueOffset),
      balanceDueDate: shiftedDate(now, division.balanceDueOffset),
    })),
    teams: INVITATIONAL_TEAMS.map(team => ({
      ...team,
      registeredDate: shiftedDate(now, -team.registeredDaysAgo),
    })),
  };
}

/**
 * The Registration Health buckets the Invitational's seeded pipeline should produce, computed
 * through the app's REAL attention engine from the pure resolver output.
 *
 * Lives here — beside the state and the fee it depends on — because three verifiers need the
 * same mapping (the hourly sweep, the moments unit tests, and any future check): three inline
 * copies had already let one drift onto hardcoded fee literals. The DB-backed probe keeps its
 * own row mapping deliberately, since its job is to assert what is actually STORED.
 */
export function invitationalAttentionBuckets(
  state: InvitationalState,
  today: string,
): Partial<Record<RegistrationAttentionKey, number>> {
  const summary = buildRegistrationAttentionSummary(
    state.teams.map((team, index) => ({
      id: String(index),
      divisionId: team.division,
      status: team.status,
      depositPaid: team.depositPaid,
      totalPaid: team.totalPaid,
      waitlistPosition: team.waitlistPosition,
      email: 'x@example.com',
    })),
    {
      divisions: state.divisions.map(division => ({
        id: division.name,
        name: division.name,
        depositAmount: INVITATIONAL_FEE.deposit,
        depositDueDate: division.depositDueDate,
        totalFeeAmount: INVITATIONAL_FEE.totalFee,
        totalFeeDueDate: division.balanceDueDate,
      })),
      feeMode: 'division',
      today,
    },
  );
  return Object.fromEntries(summary.buckets.map(bucket => [bucket.key, bucket.count]));
}

/**
 * A registered_at timestamp whose org-zone date is `date`. 16:00 UTC is midday in Toronto in
 * both DST states, so the date-part can never straddle midnight in either zone.
 */
export function registeredAtIsoFor(date: string): string {
  return `${date}T16:00:00.000Z`;
}

/** Invitational settings: fees are shown on the register form (ratified 2026-08-04) — amounts only. */
export const INVITATIONAL_TOURNAMENT_SETTINGS = {
  format: 'round_robin_playoffs',
  fee_scope: 'division',
  tie_breakers: ['h2h', 'rd', 'rf', 'ra'],
  tie_breaker_scope: 'tournament',
  buffer_minutes: 15,
  game_timing_scope: 'tournament',
  game_duration_minutes: DEMO_GAME_DURATION_MINUTES,
  show_fees_on_register: true,
  payment_instructions_on_form: false,
  roster_require: false,
} as const;

// Pool-game identity lives in ONE place: `poolKeyFor` in `demo-reconcile-core.ts`, now
// parameterized by division list. Coach emails come from `demoCoachEmail` in
// `demo-tournament.ts` — same fictional world, same unreachable domain, one formula each.
