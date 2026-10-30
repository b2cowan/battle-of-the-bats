/**
 * Plan & billing profiles (Stage 1 Part 1). Customer facts come from PLAN_CONFIG;
 * display variants carry the ruled billing copy and unchanged published article copy. No server imports.
 * Sale availability is deliberately absent: callers must read the live plan gate.
 * Owner decisions: ONE_EXPERIENCE_PLAN section 9 (2026-10-28).
 */
import { PLAN_CONFIG, type PlanConfig } from './plan-config';
import type { OrgPlan } from './types';
import { upgradePlansFor } from './plan-upgrade';
import { moveTargetsFor } from './plan-move-options';
import {
  retentionDaysForKind, organizationShutdownAreas, shortOrganizationShutdownAreas, PREMIUM_COACH_SHUTDOWN_AREAS,
  type CancellationKind,
} from './billing-cancellation-policy';

export type BillingUsageMeter = 'teams' | 'tournament_slots' | 'staff_seats';
export type BillingPlanChange<Key extends string = OrgPlan> = {
  target: Key;
  mechanism: 'checkout' | 'move' | 'downgrade';
};
export type PlanBillingDefinition<Key extends string = OrgPlan> = {
  included: { billing: readonly string[]; article: readonly string[]; explore?: readonly string[] };
  usageMeters: readonly BillingUsageMeter[];
  changes: readonly BillingPlanChange<Key>[];
  downgradeLosses?: readonly string[];
  /** Existing-comp DISPLAY only; this flag never grants or renews a Founding offer. */
  showFoundingSeason: boolean;
  cancellationKind: CancellationKind;
  /** Presentation choices belong to the profile, so a new profile needs no screen branch. */
  joinClub?: boolean;
  discoveryPlans?: readonly Key[];
  freeTimeOmittedBillingItems?: readonly number[];
};
/** Days kept follows the cancellation kind, so the registry derives it rather than storing it twice. */
export type PlanBillingProfile<Key extends string = OrgPlan> = PlanBillingDefinition<Key> & {
  key: Key;
  config: PlanConfig;
  retentionDays: number;
};

/** Adding a plan is config plus one data entry. Both display variants are mandatory. */
export function createPlanBillingRegistry<Key extends string>(
  configs: Record<Key, PlanConfig>, definitions: Record<Key, PlanBillingDefinition<Key>>,
): Record<Key, PlanBillingProfile<Key>> {
  const keys = Object.keys(configs) as Key[];
  if (Object.keys(definitions).some(key => !(key in configs))) throw new Error('Billing profile has no plan config.');
  return Object.fromEntries(keys.map(key => {
    const definition = definitions[key];
    for (const variant of ['billing', 'article'] as const) {
      const lines = definition?.included?.[variant];
      if (!Array.isArray(lines) || lines.length === 0 || lines.some(line => typeof line !== 'string' || !line.trim())) {
        throw new Error('Every billing profile needs both included-item variants: ' + key + ' / ' + variant);
      }
    }
    return [key, { ...definition, key, config: configs[key], retentionDays: retentionDaysForKind(definition.cancellationKind) }];
  })) as Record<Key, PlanBillingProfile<Key>>;
}

// The seven drawn billing items (D1). The published article adds an eighth, the parent-organization link.
const TEAM_CORE = [
  'Full roster management — positions, jersey numbers, and contact info',
  'Game schedule, attendance tracking, and lineup builder with PDF export',
  'Team budget, player dues, expense tracking, and payment reminders',
  // ⚠ "year-over-year history" removed 2026-08-20 — it promised the exact thing the product
  // deliberately REFUSES to do. Owner ruling 2026-07-09: youth seasons aren't comparable
  // across years, so there are no season-over-season deltas and no season dial, on purpose.
  'Documents, season setup checklist, and a season-end record',
  // ⚠ "run round robins…" removed 2026-08-20 — a coach ENTERS tournaments here, never hosts
  // one. There is no create-a-tournament action anywhere in the coach navigation. That
  // wording was copy-pasted from the Tournament product's cross-sell card on this same page.
  'Tournaments included — register your team, track entries, and pull results into your season record',
  'Tournament history included — every event your team has been part of, preserved',
  // R9 (the free tournament tier, 2026-10-12): the Premium portal says it includes one hosted tournament. It follows
  // the free plan (invite-only) plus PDFs — entering tournaments (above) and hosting one are different things.
  'Host one tournament at a time — an invite-only round robin or exhibition weekend, with PDF schedules and results',
];

// Published article variant: preserve its text/order (dated hashes in the copy document).
const TEAM_ARTICLE = [...TEAM_CORE, 'Link to your parent organization at any time, without transferring ownership'];

// Explore's existing descriptions, unchanged in wording/order (owner ruling 2026-10-30).
const TEAM_EXPLORE = [
  'Game lineups',
  'Attendance tracking',
  'Assistant coaches with their own sign-in',
  'Team documents',
  'Dues schedules & automatic reminders',
  'A season budget',
  'Carry your roster into next season',
];

// Published article variant: preserve its text/order (dated hashes in the copy document).
const TOURNAMENT_PLUS_ARTICLE = [
  'Public registration — teams register on your site, and you approve, waitlist, or decline',
  'Fees and payment tracking — you record what each team has paid',
  'Check-in and unlimited volunteers on game day',
  'Unlimited active tournaments',
  'Round-robin and playoff generators',
  'Custom registration fields, file uploads, and waitlist promotion',
  'Registration exports — Excel, CSV, and PDF',
  'Post-tournament reporting',
  // ⚠ "no FieldLogicHQ badge" corrected 2026-08-20 — paid pages still carry a permanent,
  // non-dismissible "Built on FieldLogicHQ" footer credit. What paying actually removes is
  // the free tier's dismissible pill AND its acquisition banner. Still a real difference;
  // just not the absence of all branding, which is what a customer would expect.
  'Full branding control — no acquisition banner, just a quiet “Built on FieldLogicHQ” footer credit',
  'Permanent sealed archives and tournament cloning',
  // ⚠ "Unlimited officials" moved OUT of the paid list 2026-08-20 — officials have never
  // counted against a seat cap on ANY plan, so it was never something upgrading granted.
  // It belongs on the free tier's list, where it is a genuine surprise.
  'Unlimited staff seats',
];

// Published article variant: preserve its text/order (dated hashes in the copy document).
const LEAGUE_ARTICLE = [
  'Player registration per season — with waitlist management',
  'Season and division setup',
  'Draft tools and team building',
  'Auto-generated round-robin schedules, editable game by game',
  'Live standings — update automatically as scores are entered',
  'Season-wide parent messaging — one screen, every registered family',
  'Public organization page',
  'League-scoped communications',
  // ⚠ "program coordinator" removed 2026-08-20 — no such role exists. The only occurrence of
  // the word anywhere in this codebase was this marketing string.
  'Advanced member roles — league admin, registrar',
  'Registration and standings exports (Excel, CSV)',
  'Unlimited tournaments included',
  'Unlimited staff seats · Unlimited officials',
];

// Published article variant: preserve its text/order (dated hashes in the copy document).
const CLUB_ARTICLE = [
  'Everything in League (tournaments, house league, public org page)',
  'Unlimited staff / admin seats',
  'Accounting module — org ledger and expense tracking',
  'Club costs split across teams, with reminders and payment tracking',
  'Rep teams module — tryout registration and roster management',
  'Player documents and season history',
  'Team financial management',
  // Added 2026-08-20 — a real, Club-ONLY capability that the page had never mentioned.
  // Deliberately absent from every other plan (a single-team customer has no siblings to
  // share with), which makes it one of the few things only this tier can offer.
  'Club Shared Book — your teams share opponent scouting notes across the club',
  'Premium Coaches Portal for your whole coaching staff — every team included, no per-team fee',
  'Up to 15 teams — or up to 30 on Club · Association',
];

const TOURNAMENT_BILLING = [
  'You add every team — each coach claims it from an email invitation',
  'Manual tournament scheduling',
  'Basic standings and score entry',
  'A public event site with live scores families can follow',
  'Venue management',
  'Default FieldLogicHQ public styling',
  'Public news posts and basic team email',
  `${PLAN_CONFIG.tournament.seatLimit} staff / admin seats · ${PLAN_CONFIG.tournament.tournamentLimit} tournament at a time`,
];

const TOURNAMENT_PLUS_BILLING = [
  `Everything in ${PLAN_CONFIG.tournament.label}`,
  'Public registration — the review queue, waitlist, questions, file uploads, and exports',
  'Fees and payment tracking, and check-in',
  'Unlimited tournament slots',
  'Round-robin and playoff generators',
  'Full branding control',
  'Tournament cloning, announcements, and post-event archives',
  'Unlimited staff seats and volunteers',
];

const LEAGUE_BILLING = [
  `Everything in ${PLAN_CONFIG.tournament_plus.label}`,
  'Public organization page (branded)',
  'House league — registration, divisions, seasons, standings',
  'Advanced member roles and permissions',
  'Unlimited staff / admin seats',
];

const CLUB_BILLING = [
  'Rep teams: tryouts, rosters, player documents, season history',
  `A ${PLAN_CONFIG.team.label} for every team, with no per-team fee`,
  'Accounting: ledgers, the club budget, allocations to teams',
  'Families: every household across your programs',
  'Your club’s public site',
  'House league and tournaments',
  'Unlimited board and staff members',
];

/** Every move a plan has today: the upgrade checkout, then the plan-to-plan moves. */
const checkoutAndMoves = (plan: OrgPlan): BillingPlanChange[] => [
  ...upgradePlansFor(plan).map(target => ({ target, mechanism: 'checkout' as const })),
  ...moveTargetsFor(plan).map(target => ({ target, mechanism: 'move' as const })),
];

export const PLAN_BILLING_DEFINITIONS: Record<OrgPlan, PlanBillingDefinition> = {
  tournament: {
    included: { billing: TOURNAMENT_BILLING, article: TOURNAMENT_BILLING },
    usageMeters: ['tournament_slots', 'staff_seats'],
    changes: checkoutAndMoves('tournament'),
    showFoundingSeason: true,
    cancellationKind: 'organization',
    discoveryPlans: ['team', 'league', 'club'],
  },
  team: {
    included: { billing: TEAM_CORE, article: TEAM_ARTICLE, explore: TEAM_EXPLORE },
    usageMeters: ['tournament_slots', 'staff_seats'],
    changes: checkoutAndMoves('team'),
    showFoundingSeason: true,
    cancellationKind: 'premium',
    joinClub: true,
    freeTimeOmittedBillingItems: [6],
  },
  tournament_plus: {
    included: { billing: TOURNAMENT_PLUS_BILLING, article: TOURNAMENT_PLUS_ARTICLE },
    usageMeters: ['tournament_slots', 'staff_seats'],
    changes: [...checkoutAndMoves('tournament_plus'), { target: 'tournament', mechanism: 'downgrade' }],
    showFoundingSeason: true,
    cancellationKind: 'organization',
    discoveryPlans: ['team', 'league', 'club'],
    downgradeLosses: [
      'custom tournament branding', 'custom registration controls', 'exports', 'payment reminders',
      'waitlist promotion', 'cloning', 'targeted announcements', 'post-event summaries',
    ],
  },
  league: {
    included: { billing: LEAGUE_BILLING, article: LEAGUE_ARTICLE },
    usageMeters: ['tournament_slots', 'staff_seats'],
    changes: checkoutAndMoves('league'),
    showFoundingSeason: true,
    cancellationKind: 'organization',
  },
  club: {
    included: { billing: CLUB_BILLING, article: CLUB_ARTICLE },
    usageMeters: ['teams'],
    changes: checkoutAndMoves('club'),
    showFoundingSeason: false,
    cancellationKind: 'organization',
  },
  club_large: {
    included: { billing: CLUB_BILLING, article: CLUB_ARTICLE },
    usageMeters: ['teams'],
    changes: checkoutAndMoves('club_large'),
    showFoundingSeason: false,
    cancellationKind: 'organization',
  },
};

export const PLAN_BILLING_PROFILES = createPlanBillingRegistry(PLAN_CONFIG, PLAN_BILLING_DEFINITIONS);

/** Server preflight remains authoritative; enabled add-ons must survive the display projection. */
export function planCancellationImpact(profile: PlanBillingProfile<string>, enabledAddons: readonly string[] = [], activeTeams: number | null = null) {
  const premium = profile.cancellationKind === 'premium';
  return {
    retentionDays: profile.retentionDays,
    shutsDown: premium ? [...PREMIUM_COACH_SHUTDOWN_AREAS] : organizationShutdownAreas(profile.config, enabledAddons),
    // A coach's short and full lists are the same sentence list.
    shortShutsDown: premium ? [...PREMIUM_COACH_SHUTDOWN_AREAS] : shortOrganizationShutdownAreas(profile.config, enabledAddons, activeTeams),
  };
}
