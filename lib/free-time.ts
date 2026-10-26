import { PLAN_CONFIG, getEffectiveTournamentLimit, getEffectiveTeamLimit } from './plan-config';
import { PLAN_RANK } from './plan-features';
import {
  addCalendarDays,
  addCalendarMonths,
  daysBetweenDateStrings,
  isCalendarDate,
  tournamentToday,
  zonedWallClockToUtc,
} from './timezone';
import { possessive } from './utils';
import type { Organization, OrgPlan, SubscriptionStatus } from './types';

/**
 * Free time (Support console Stage 4): the rules, with no database in them.
 *
 * A grant is an `org_overrides` row a staff member gives a club for a set time: a whole plan (`plan_tier`, the plan
 * in `target.plan`), sections (`module_addon`, `target.addons`) or a billing status (`subscription_status`). It ends
 * by itself: nothing runs at the end, every reader asks the door (`lib/entitlement-grants.ts`), and the door compares
 * the end with the moment of reading, on the server, every time (owner ruling Q1, 2026-10-25).
 *
 * The END is stored as an instant and always means "the first moment of the day after the last free day, in Eastern
 * time", the rule Founding Season's end already follows (`FOUNDING_SEASON_END`). Staff and customers only ever read the
 * LAST FREE DAY ("Free through March 31, 2027", owner ruling Q8); the instant is never shown and never comes from a
 * browser.
 *
 * `comp_period` rows are not free time: they mark the Founding Season cohort and give no access.
 */

/** The club's own plan: what it holds and is billed for. Billing actions read this, never `org.planId` (the door's). */
export function ownPlanOf(org: Pick<Organization, 'planId' | 'ownPlanId'>): OrgPlan {
  return org.ownPlanId ?? org.planId;
}

/** The plans that can be given as free time (owner ruling Q2/T13): League and League Plus are parked. */
export const GRANTABLE_PLANS: readonly OrgPlan[] = ['tournament_plus', 'club', 'club_large'];

export function isGrantablePlan(plan: unknown): plan is OrgPlan {
  return typeof plan === 'string' && (GRANTABLE_PLANS as readonly string[]).includes(plan);
}

/** The plans above the club's own that can be given to it, lowest first. */
export function grantablePlansAbove(ownPlan: OrgPlan): OrgPlan[] {
  return GRANTABLE_PLANS.filter(p => PLAN_RANK[p] > (PLAN_RANK[ownPlan] ?? 0));
}

/** The kinds the console gives. `comp_period` is no longer offered (owner ruling Q5). */
export const FREE_TIME_KINDS = ['plan_tier', 'module_addon', 'subscription_status'] as const;
export type FreeTimeKind = (typeof FREE_TIME_KINDS)[number];

/** Who may give free time and for how long, in calendar months from today (owner ruling Q2). */
export const FREE_TIME_CAP_MONTHS: Record<'super_admin' | 'billing', number> = { super_admin: 12, billing: 6 };

export function capMonthsFor(role: string): number | null {
  return role === 'super_admin' || role === 'billing' ? FREE_TIME_CAP_MONTHS[role] : null;
}

/** Today's date in Eastern time, `YYYY-MM-DD`. */
export function todayEastern(now: Date = new Date()): string {
  return tournamentToday(now);
}

/** The first day that can be given: tomorrow (a last free day must be after today). */
export function earliestLastDay(now: Date = new Date()): string {
  return addCalendarDays(todayEastern(now), 1);
}

/** The latest last free day this role may give: today plus its cap, in calendar months. */
export function latestLastDay(role: string, now: Date = new Date()): string | null {
  const months = capMonthsFor(role);
  return months == null ? null : addCalendarMonths(todayEastern(now), months);
}

/** The stored end instant for a last free day: the first moment of the next day, Eastern. */
export function endInstantForLastDay(lastDay: string): string | null {
  if (!isCalendarDate(lastDay)) return null;
  return zonedWallClockToUtc(addCalendarDays(lastDay, 1), '00:00');
}

/** The last free day an end instant stands for (the Eastern day before the instant's first moment). */
export function lastDayOfInstant(iso: string): string {
  return tournamentToday(new Date(new Date(iso).getTime() - 1));
}

/** Days from today to the last free day: 0 on the last day itself. */
export function daysLeft(lastDay: string, now: Date = new Date()): number {
  return daysBetweenDateStrings(todayEastern(now), lastDay);
}

/** The last 14 days: the window Today's "Free time ending" and the customer's amber band share. */
export const FREE_TIME_ENDING_DAYS = 14;

export function isEndingSoon(lastDay: string, now: Date = new Date()): boolean {
  return daysLeft(lastDay, now) < FREE_TIME_ENDING_DAYS;
}

/** How long the customer's "ended" band shows after free time ends. */
export const FREE_TIME_ENDED_SHOWN_DAYS = 30;

/**
 * Why a last free day cannot be given, or null when it can. The server's check (the window's calendar greys out the
 * same days as a courtesy). `lastDay` must be a bare `YYYY-MM-DD`: an instant is refused, never parsed.
 */
export function lastDayRefusal(lastDay: unknown, role: string, now: Date = new Date()): string | null {
  if (typeof lastDay !== 'string' || !isCalendarDate(lastDay)) {
    return 'Choose the last free day.';
  }
  const latest = latestLastDay(role, now);
  if (latest == null) return "Your role can't give free time.";
  if (lastDay < earliestLastDay(now)) return 'The last free day must be after today.';
  if (lastDay > latest) {
    const months = capMonthsFor(role);
    return role === 'super_admin'
      ? `You can give up to ${months} months, through ${formatLongDay(latest)}.`
      : `You can give up to ${months} months, through ${formatLongDay(latest)}. Longer needs a super admin.`;
  }
  return null;
}

/** "March 31, 2027" from a `YYYY-MM-DD`, without a time zone (the day is already the Eastern day). */
export function formatLongDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-CA', {
    timeZone: 'UTC', month: 'long', day: 'numeric', year: 'numeric',
  });
}

/** "March 31": a last free day inside a sentence that already names the year. */
export function monthDayOf(day: string): string {
  return formatLongDay(day).replace(/, \d{4}$/, '');
}

/** "April 1" (or "January 1, 2027" when the year turns): the first day back on the club's own plan. */
export function dayAfterWords(lastDay: string): string {
  const next = addCalendarDays(lastDay, 1);
  return next.slice(0, 4) === lastDay.slice(0, 4) ? monthDayOf(next) : formatLongDay(next);
}

/** "Mar 31, 2027" from a `YYYY-MM-DD` (the console's short face). */
export function formatShortDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-CA', {
    timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric',
  });
}

/** "Free through Mar 31, 2027": the one phrase for a free-time end (owner ruling Q8). */
export function freeThroughShort(lastDay: string): string {
  return `Free through ${formatShortDay(lastDay)}`;
}

// ── The fold ──────────────────────────────────────────────────────────────────────────────────────────────────────

export type GrantTarget = { addons?: string[]; plan?: string; status?: string } | null;

export type GrantRow = {
  id?: string;
  type: string;
  value: string | null;
  target: GrantTarget;
  starts_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
};

/** A grant is running when it is not revoked, has started, and has not reached its end (the end is exclusive). */
export function isGrantRunning(
  row: Pick<GrantRow, 'starts_at' | 'expires_at' | 'revoked_at'>,
  now: Date = new Date(),
): boolean {
  if (row.revoked_at) return false;
  if (row.starts_at && new Date(row.starts_at) > now) return false;
  if (row.expires_at && new Date(row.expires_at) <= now) return false;
  return true;
}

/** What the club holds on its own: the stored columns. */
export type OwnFacts = {
  planId: OrgPlan;
  subscriptionStatus: SubscriptionStatus;
  enabledAddons: string[];
  storedTournamentLimit: number | null;
  storedTeamLimit: number | null;
};

/** What the club is right now, for access. */
export type EffectiveFacts = {
  /** The plan every access decision reads. */
  planId: OrgPlan;
  /** The plan the club holds on its own (what Stripe bills): every billing ACTION reads this, never `planId`. */
  ownPlanId: OrgPlan;
  tournamentLimit: number;
  teamLimit: number;
  subscriptionStatus: SubscriptionStatus;
  enabledAddons: string[];
  /** The running plan grant, when it lifts the club above its own plan. */
  freeTime: { plan: OrgPlan; lastDay: string } | null;
};

const STATUSES: readonly SubscriptionStatus[] = ['active', 'trialing', 'past_due', 'canceled'];

/**
 * Fold the running grants onto what the club holds. `rows` newest first, so the newest running grant of a kind wins.
 *
 * - **A whole plan** lifts the plan only when it is above the club's own (a tie or a lower plan is the club's own, so
 *   a purchase that overtakes a grant ends its effect at once). Limits follow the given plan, raised by the club's own
 *   where they are higher (`/billing`, 2026-10-25): the stored tournament limit is never passed through the given
 *   plan's function, because a free club stores 1 and it would clamp the given plan to one tournament.
 * - **Sections** are added to the club's own.
 * - **A billing status** replaces the club's own.
 * - With the switch off (`enabled` false) the club is exactly what it holds.
 */
export function foldGrants(own: OwnFacts, rows: GrantRow[], now: Date = new Date(), enabled = true): EffectiveFacts {
  const ownTournamentLimit = getEffectiveTournamentLimit(own.planId, own.storedTournamentLimit);
  const ownTeamLimit = getEffectiveTeamLimit(own.planId, own.storedTeamLimit);
  const base: EffectiveFacts = {
    planId: own.planId,
    ownPlanId: own.planId,
    tournamentLimit: ownTournamentLimit,
    teamLimit: ownTeamLimit,
    subscriptionStatus: own.subscriptionStatus,
    enabledAddons: own.enabledAddons,
    freeTime: null,
  };
  if (!enabled) return base;
  const running = rows.filter(r => isGrantRunning(r, now));
  if (running.length === 0) return base;

  const addons = new Set(own.enabledAddons);
  for (const r of running) {
    if (r.type === 'module_addon' && Array.isArray(r.target?.addons)) for (const a of r.target.addons) addons.add(a);
  }

  let subscriptionStatus = own.subscriptionStatus;
  const statusGrant = running.find(r => r.type === 'subscription_status');
  if (statusGrant) {
    const next = statusGrant.target?.status ?? statusGrant.value;
    if (STATUSES.includes(next as SubscriptionStatus)) subscriptionStatus = next as SubscriptionStatus;
  }

  let { planId, tournamentLimit, teamLimit } = base;
  let freeTime: EffectiveFacts['freeTime'] = null;
  const planGrant = running.find(r => r.type === 'plan_tier' && isGrantablePlan(r.target?.plan));
  const given = planGrant?.target?.plan as OrgPlan | undefined;
  if (planGrant && given && PLAN_RANK[given] > (PLAN_RANK[own.planId] ?? 0)) {
    planId = given;
    tournamentLimit = Math.max(PLAN_CONFIG[given].tournamentLimit, ownTournamentLimit);
    teamLimit = getEffectiveTeamLimit(given, own.storedTeamLimit);
    freeTime = planGrant.expires_at ? { plan: given, lastDay: lastDayOfInstant(planGrant.expires_at) } : null;
  }

  return {
    planId,
    ownPlanId: own.planId,
    tournamentLimit,
    teamLimit,
    subscriptionStatus,
    enabledAddons: [...addons],
    freeTime,
  };
}

/** The raw columns a reader selects to ask the door. */
export const DOOR_COLUMNS = 'id, plan_id, subscription_status, enabled_addons, tournament_limit, team_limit';

export type DoorRow = {
  id: string;
  plan_id: string | null;
  subscription_status: string | null;
  enabled_addons: string[] | null;
  tournament_limit?: number | null;
  team_limit?: number | null;
};

export function ownFactsOf(row: DoorRow): OwnFacts {
  return {
    planId: (row.plan_id ?? 'tournament') as OrgPlan,
    subscriptionStatus: (row.subscription_status ?? 'active') as SubscriptionStatus,
    enabledAddons: row.enabled_addons ?? [],
    storedTournamentLimit: row.tournament_limit ?? null,
    storedTeamLimit: row.team_limit ?? null,
  };
}

// ── What the customer is told ─────────────────────────────────────────────────────────────────────────────────────

export type CustomerFreeTime =
  | { state: 'running' | 'ending'; plan: OrgPlan; ownPlan: OrgPlan; lastDay: string; daysLeft: number }
  | { state: 'ended'; plan: OrgPlan; ownPlan: OrgPlan; lastDay: string };

/**
 * The customer's billing page state (owner ruling Q8): running, ending (the last 14 days), or ended (for 30 days
 * after). Whole-plan grants only (owner, 2026-10-25). Carries the plan, the last free day and the plan it goes back
 * to: never the reason, the giver or the grant (T15).
 */
export function customerFreeTime(own: OwnFacts, rows: (GrantRow & { created_at?: string })[], now: Date = new Date()): CustomerFreeTime | null {
  const folded = foldGrants(own, rows, now);
  if (folded.freeTime) {
    const left = daysLeft(folded.freeTime.lastDay, now);
    return {
      state: left < FREE_TIME_ENDING_DAYS ? 'ending' : 'running',
      plan: folded.freeTime.plan,
      ownPlan: own.planId,
      lastDay: folded.freeTime.lastDay,
      daysLeft: left,
    };
  }
  // Ended: the plan grant that stopped most recently, within 30 days, for a plan still above the club's own (a club
  // that has since bought the plan is not told its free time "ended").
  let latest: { plan: OrgPlan; endedAt: number } | null = null;
  for (const r of rows) {
    if (r.type !== 'plan_tier' || !isGrantablePlan(r.target?.plan)) continue;
    const plan = r.target!.plan as OrgPlan;
    if (PLAN_RANK[plan] <= (PLAN_RANK[own.planId] ?? 0)) continue;
    if (r.starts_at && r.revoked_at && new Date(r.revoked_at) < new Date(r.starts_at)) continue;
    const ends = [r.expires_at, r.revoked_at].filter((v): v is string => !!v).map(v => new Date(v).getTime());
    if (ends.length === 0) continue;
    const endedAt = Math.min(...ends);
    if (endedAt > now.getTime()) continue;
    if (now.getTime() - endedAt > FREE_TIME_ENDED_SHOWN_DAYS * 86_400_000) continue;
    if (!latest || endedAt > latest.endedAt) latest = { plan, endedAt };
  }
  if (!latest) return null;
  return {
    state: 'ended',
    plan: latest.plan,
    ownPlan: own.planId,
    lastDay: lastDayOfInstant(new Date(latest.endedAt).toISOString()),
  };
}

// ── Who may be given what: the decision, from facts the server has read ───────────────────────────────────────────

/** The sections the console gives, in the drawn order (mirrors `CLUB_SECTIONS` in lib/platform-labels.ts). */
export const GIVABLE_SECTIONS = ['module_house_league', 'module_rep_teams', 'module_accounting', 'module_public_site'] as const;

/** What the server read about the club before deciding. `planId` is the plan the club HOLDS. */
export type ClubFacts = {
  id: string;
  name: string;
  planId: OrgPlan;
  accountKind: string | null;
  /** A live Stripe subscription (not a dev mock). */
  payingThroughStripe: boolean;
  runningPlanGrant: { id: string; plan: OrgPlan; lastDay: string } | null;
};

/** What the server read about the giver and the server. */
export type GiveContext = { switchOn: boolean; staffIsMember: boolean; isDemo: boolean };

export type Refusal = { ok: false; status: number; error: string };

/** Known before the click: the record shows it as one line where the door would be (D-3). */
export type GiveBlock = { tone: 'red' | 'amber'; kind: 'switch' | 'own_club' | 'portal' | 'demo'; lead: string; rest: string };

export function freeTimeBlockOf(club: Pick<ClubFacts, 'name' | 'planId' | 'accountKind'>, ctx: GiveContext): GiveBlock | null {
  if (!ctx.switchOn) {
    return { tone: 'red', kind: 'switch', lead: 'Free time is switched off on this server', rest: ', so anything given here would do nothing. An engineer can switch it on.' };
  }
  if (ctx.staffIsMember) {
    return { tone: 'red', kind: 'own_club', lead: `You belong to ${club.name}`, rest: ", so you can't give it free time. Another staff member can." };
  }
  if (club.accountKind === 'team_workspace' || club.planId === 'team') {
    return { tone: 'amber', kind: 'portal', lead: "A Coaches Portal can't be given free time yet.", rest: ' A portal reads its own billing, not free time. Its Founding Season stays as it is.' };
  }
  if (ctx.isDemo) {
    return { tone: 'amber', kind: 'demo', lead: `${club.name} is a public demo club`, rest: ", so it can't be given free time: everyone who opens the demo would see it." };
  }
  return null;
}

/** A plan's name as the product prints it ("Club · Association"). */
const nameOf = (plan: string) => PLAN_CONFIG[plan as OrgPlan]?.label ?? plan;

export type PlanBlock =
  | { kind: 'granted'; sentence: string; overrideId: string; plan: OrgPlan; lastDay: string }
  | { kind: 'paying'; sentence: string }
  | { kind: 'top'; sentence: string };

/** Why a whole plan cannot be given (the window shows it in place of the plan fields), or null. */
export function planGrantBlockOf(club: ClubFacts): PlanBlock | null {
  if (club.runningPlanGrant) {
    const g = club.runningPlanGrant;
    return {
      kind: 'granted', overrideId: g.id, plan: g.plan, lastDay: g.lastDay,
      sentence: `${club.name} already has ${nameOf(g.plan)} free through ${formatLongDay(g.lastDay)}. Give it more time from that entry instead of a second grant.`,
    };
  }
  if (club.payingThroughStripe) {
    return {
      kind: 'paying',
      sentence: `${club.name} pays for ${nameOf(club.planId)} through Stripe. A plan can't be given while Stripe charges for one: they would keep paying for one plan while using another. Give sections, or move their plan in Stripe.`,
    };
  }
  if (grantablePlansAbove(club.planId).length === 0) {
    return { kind: 'top', sentence: `${club.name} is on ${nameOf(club.planId)}, the top plan. Give it sections, or change the plan with the record's pencil.` };
  }
  return null;
}

export type GiveRequest = { kind: unknown; plan?: unknown; addons?: unknown; lastDay: unknown; reason: unknown; role: string };

export type GiveDecision = {
  ok: true;
  row: { type: FreeTimeKind; value: string | null; target: Record<string, unknown> | null; expires_at: string };
  lastDay: string;
  reason: string;
};

/**
 * Give or refuse, from facts the server read (T1–T16). Pure: the caller inserts ONLY on `ok: true`, so a refusal writes
 * nothing. The order puts what nobody here can get past first, then the request's own faults.
 */
export function decideGive(req: GiveRequest, club: ClubFacts, ctx: GiveContext, now: Date = new Date()): Refusal | GiveDecision {
  const refuse = (status: number, error: string): Refusal => ({ ok: false, status, error });
  if (req.kind === 'comp_period') return refuse(400, 'Comp period is no longer given from the console. It never gave a club anything.');
  if (typeof req.kind !== 'string' || !(FREE_TIME_KINDS as readonly string[]).includes(req.kind)) return refuse(400, 'Choose what to give.');
  if (capMonthsFor(req.role) == null) return refuse(403, "Your role can't give free time.");

  const block = freeTimeBlockOf(club, ctx);
  if (block) return refuse(block.kind === 'switch' ? 409 : 403, `${block.lead}${block.rest}`);

  const reason = typeof req.reason === 'string' ? req.reason.trim() : '';
  if (!reason) return refuse(400, "Say why you're giving it.");
  const dayRefusal = lastDayRefusal(req.lastDay, req.role, now);
  if (dayRefusal) return refuse(400, dayRefusal);
  const lastDay = req.lastDay as string;
  const expires_at = endInstantForLastDay(lastDay)!;

  if (req.kind === 'plan_tier') {
    if (req.plan === 'league') return refuse(400, "League plans can't be given as free time.");
    if (!isGrantablePlan(req.plan)) return refuse(400, 'Choose a plan to give.');
    const planBlock = planGrantBlockOf(club);
    if (planBlock) return refuse(409, planBlock.sentence);
    if (PLAN_RANK[req.plan] <= (PLAN_RANK[club.planId] ?? 0)) {
      return refuse(400, `${nameOf(req.plan)} isn't above ${possessive(club.name)} own plan, ${nameOf(club.planId)}.`);
    }
    return { ok: true, row: { type: 'plan_tier', value: null, target: { plan: req.plan }, expires_at }, lastDay, reason };
  }
  if (req.kind === 'module_addon') {
    const addons = req.addons;
    if (!Array.isArray(addons) || addons.length === 0) return refuse(400, 'Choose at least one section.');
    if (addons.some(a => typeof a !== 'string' || !(GIVABLE_SECTIONS as readonly string[]).includes(a))) {
      return refuse(400, 'That section is not one the console gives.');
    }
    return { ok: true, row: { type: 'module_addon', value: null, target: { addons: [...new Set(addons as string[])] }, expires_at }, lastDay, reason };
  }
  // A billing status: the club reads as active while unpaid (the drawn choice).
  return { ok: true, row: { type: 'subscription_status', value: 'active', target: null, expires_at }, lastDay, reason };
}
