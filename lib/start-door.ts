/**
 * THE START DOOR — an account remembers which "start something" sign-up made it (Account-First Sign-up, owner
 * rulings A3 + A4 2026-10-18; hub docs/projects/archive/ACCOUNT_FIRST_SIGNUP_HUB.html).
 *
 * Every start sign-up asks for the account alone; the team, league or organization is named after the email link.
 * The door is written onto the auth user at sign-up (`user_metadata.start`), so the link, every resend and Home all
 * land the person on that door's create step, wherever the link is opened. It is cleared when the creation completes.
 *
 * ⚠ `user_metadata` is editable by the signed-in user (`supabase.auth.updateUser({ data })`). This record steers
 * SCREENS only — which create step, whether Home shows a waiting workspace. It must never decide an entitlement, a price
 * or Founding Season eligibility; those read server-side facts (`auth.users.created_at`, the plan rules, checkout).
 *
 * Framework-free: the sign-up forms, the routes and Home all read it.
 */
import { COACHES_START_PATH } from './coaches-portal-routes';

/**
 * `club` is the Start a club door (On-sale pages S2, 2026-11-19): it exists only while Club or Club · Association is on
 * sale. League Plus has no door of its own: it is the `league` door carrying a League Plus pick (no fourth door).
 */
const DOORS = ['team', 'league', 'organization', 'premium', 'club'] as const;
export type StartDoor = (typeof DOORS)[number];

/**
 * The plan and billing picked on the pricing page (owner A6, 2026-10-18): the plans its cards send to the sign-up.
 * They ride on the account so the plan step opens with that plan chosen — a preselection the person can change, never
 * a price (the checkout decides that). The free Tournament pick rides too (The first look G4, 2026-10-20), and it is the
 * one pick with NO billing: a free plan never grows a billing period anywhere it is shown or carried.
 */
const START_PLANS = ['tournament', 'tournament_plus', 'league', 'club', 'club_large'] as const;
export type StartPlan = (typeof START_PLANS)[number];
export type StartBilling = 'monthly' | 'annual';
/** A paid pick always carries its billing; the free pick never does. */
export type StartPricing =
  | { plan: 'tournament'; billing?: undefined }
  | { plan: Exclude<StartPlan, 'tournament'>; billing: StartBilling };

/**
 * The picks Run a tournament can sell (The first look F08, G6): Tournament and Tournament Plus. Step 1 names only these,
 * and the plan step preselects only these; a League Plus or Club pick (an old link, a hand-typed one) reads as none here
 * rather than being promised on step 1 and dropped on step 3. Those plans get their own doors the day they open.
 */
export function runATournamentPick(pricing: StartPricing | null | undefined): StartPricing | null {
  return pricing?.plan === 'tournament' || pricing?.plan === 'tournament_plus' ? pricing : null;
}

/** Run a tournament's step line: step 1 (the account), step 2 (the name) and step 3 (the plan step) say the same. */
export const RUN_A_TOURNAMENT_STEPS = ['Account', 'Organization', 'Plan'] as const;

/**
 * THE PAID DOORS (On-sale pages S2, 2026-11-19): Start a club sells Club and Club · Association, and Start a league
 * season sells League Plus while it is on sale. The organization is made on the free Tournament plan with no Founding
 * comp (Ask 14) and remembers the plan its owner came to buy (`organizations.start_plan`), so the plan step, an
 * abandoned checkout and the wait after Stripe all know it. Nothing here decides a price: checkout does.
 */
export const START_PAID_PLANS = ['league', 'club', 'club_large'] as const;
export type StartPaidPlan = (typeof START_PAID_PLANS)[number];
export type PaidDoor = 'club' | 'league';
/** The plans each paid door sells, in the plan step's order. */
export const PAID_DOOR_PLANS: Record<PaidDoor, readonly StartPaidPlan[]> = {
  club: ['club', 'club_large'],
  league: ['league'],
};
export const CLUB_START_STEPS = ['Account', 'Club', 'Plan'] as const;
export const LEAGUE_PLUS_START_STEPS = ['Account', 'League', 'Plan'] as const;
/** Each paid door's step line, for the screens after step 2 (the plan step, the billing address). */
export const PAID_DOOR_STEPS: Record<PaidDoor, readonly string[]> = { club: CLUB_START_STEPS, league: LEAGUE_PLUS_START_STEPS };

/** One card on a paid door's plan step: the plan, and the trial checkout will really give (trap B). */
export interface StartPlanCard {
  plan: StartPaidPlan;
  /** The trial checkout will give: 0 = none; null when the subscription history could not be read. */
  trialDays: number | null;
  /** Has this organization's customer held a subscription (no second trial)? null when unread. A plan whose trial is
   *  set to 0 is NOT a returning customer: only this says "you've had a subscription before". */
  returning: boolean | null;
}
/** A paid door's plan step (`/api/billing/start-plan`), read from the server for the organization the door made. */
export interface StartPlanOffer {
  door: PaidDoor;
  startPlan: StartPaidPlan;
  /** The door's plans on sale now, in the step's order. Empty: the door closed after the club was made. */
  cards: StartPlanCard[];
}

/**
 * Is a paid door on sale? Start a club opens when either Club band does; Start a league season when League Plus does.
 * `gating` is the live gate map (true = gated); a plan missing from it reads as closed, as `isPlanOpen` does.
 */
export function paidDoorOpen(gating: Partial<Record<string, boolean>>, door: PaidDoor): boolean {
  return openPaidDoorPlans(gating, door).length > 0;
}

/** The door's plans on sale now, in the plan step's order (the same rule: a plan missing from the gate reads as closed). */
export function openPaidDoorPlans(gating: Partial<Record<string, boolean>>, door: PaidDoor): StartPaidPlan[] {
  return PAID_DOOR_PLANS[door].filter(plan => gating[plan] === false);
}

/**
 * NO SECOND TRIAL (Ask 4, 2026-09-25) — the one rule, asked by checkout and by the paid doors' plan step alike, so a card
 * never promises a trial that checkout then withholds (trap B). A trial applies only to a customer that never held one.
 */
export function trialDaysAfterHistory(configuredTrialDays: number, returning: boolean): number {
  return configuredTrialDays > 0 && !returning ? configuredTrialDays : 0;
}

/** The wait after Stripe (trap A): what a paid door's return page can say. */
export type StartPlanSetupState = 'no_payment' | 'setting_up' | 'ready';

/**
 * Has the paid plan landed? `no_payment` for a checkout that is not this organization's completed one; `ready` once the
 * webhook has written THIS checkout's subscription and a paid plan onto the organization; otherwise `setting_up`.
 */
export function startPlanSetupDecision(
  session: StartPlanCheckout,
  org: { id: string; planId: string | null; stripeSubscriptionId: string | null },
): StartPlanSetupState {
  if (!isCompletedCheckoutOf(session, org.id)) return 'no_payment';
  return org.stripeSubscriptionId === session.subscriptionId && org.planId !== 'tournament' ? 'ready' : 'setting_up';
}

/** What the wait reads from Stripe's checkout session. */
export interface StartPlanCheckout { orgId: string | null | undefined; status: string | null | undefined; subscriptionId: string | null }

/** Is this a completed checkout of THIS organization, with a subscription? (The wait's first question, asked before the
 *  organization is read.) */
export function isCompletedCheckoutOf(session: StartPlanCheckout, orgId: string): boolean {
  return session.orgId === orgId && session.status === 'complete' && !!session.subscriptionId;
}

/** A remembered plan from an untrusted value (the database column, a request body), or none. */
export function parseStartPaidPlan(value: unknown): StartPaidPlan | null {
  return typeof value === 'string' && (START_PAID_PLANS as readonly string[]).includes(value) ? value as StartPaidPlan : null;
}

/** The paid door a remembered plan belongs to. */
export function paidDoorOf(plan: StartPaidPlan): PaidDoor {
  return plan === 'league' ? 'league' : 'club';
}

/** A pricing-page pick this paid door can sell, or none (an old or hand-typed link reads as none, as F08 does). */
export function paidDoorPick(door: PaidDoor, pricing: StartPricing | null | undefined): Extract<StartPricing, { billing: StartBilling }> | null {
  if (!pricing || pricing.plan === 'tournament') return null;
  return (PAID_DOOR_PLANS[door] as readonly string[]).includes(pricing.plan) ? pricing : null;
}

/**
 * The start path that sells each plan a pricing card offers (the G6 guard, rewritten in S2: every open org plan's card
 * points at a door that sells it). Tournament and Tournament Plus are Run a tournament's.
 */
export const START_PATH_FOR_PLAN: Record<StartPlan, string> = {
  tournament: '/start/tournament',
  tournament_plus: '/start/tournament',
  league: '/start/league',
  club: '/start/club',
  club_large: '/start/club',
};

export interface StartDoorRecord {
  door: StartDoor;
  /** On the organization door, and on the paid doors (a pick each can sell), only when the person came from the pricing page. */
  pricing?: StartPricing;
  /** Only on Coach Premium's door: the billing chosen before the account was made (Part 3), so step 2 opens on it. */
  billing?: StartBilling;
}

/** A billing choice from an untrusted value, or none. */
export function parseStartBilling(billing: unknown): StartBilling | null {
  return billing === 'annual' || billing === 'monthly' ? billing : null;
}

/**
 * The pricing page's plan and billing from untrusted values; no plan is none. A paid plan's billing defaults to monthly;
 * the free plan has none, whatever was sent.
 */
export function parseStartPricing(plan: unknown, billing: unknown): StartPricing | null {
  if (typeof plan !== 'string' || !(START_PLANS as readonly string[]).includes(plan)) return null;
  if (plan === 'tournament') return { plan };
  return { plan: plan as Exclude<StartPlan, 'tournament'>, billing: parseStartBilling(billing) ?? 'monthly' };
}

/** A pick as query parameters (`plan`, and `billing` when it has one), for every link and form that carries it on. */
export function startPricingParams(pricing: StartPricing): Record<string, string> {
  return pricing.billing ? { plan: pricing.plan, billing: pricing.billing } : { plan: pricing.plan };
}

/** A path carrying the pick, when there is one. */
export function withStartPricing(path: string, pricing: StartPricing | null | undefined): string {
  if (!pricing) return path;
  return `${path}${path.includes('?') ? '&' : '?'}${new URLSearchParams(startPricingParams(pricing))}`;
}

/** The plan step, with the pricing page's choice when there was one (`/{org}/admin/onboarding`). */
export function planStepPath(orgSlug: string, pricing: StartPricing | null | undefined): string {
  return withStartPricing(`/${orgSlug}/admin/onboarding?choosePlan=1`, pricing);
}

/** Who is looking at a door's create step: signed in, and whether this is their first day (no workspace yet). */
export interface StartStepViewer {
  email: string;
  firstRun: boolean;
}

/** The door's create step — step 2, where the link lands and Home's card leads. */
export const START_DOOR_PATH: Record<StartDoor, string> = {
  team: '/start/team',
  league: '/start/league',
  organization: '/start/tournament',
  premium: COACHES_START_PATH,
  club: '/start/club',
};

/** A door from an untrusted value, limited to the doors the caller serves; anything else is none. */
export function parseStartDoor<D extends StartDoor>(value: unknown, allowed: readonly D[]): D | null {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? value as D : null;
}

/**
 * Read the remembered door off an auth user's metadata; anything malformed reads as none. Any other key on the record
 * is ignored — the `notNow` count Home's finish card kept before A4 was revised (2026-10-19) no longer means anything.
 */
export function readStartDoor(userMetadata: unknown): StartDoorRecord | null {
  const raw = (userMetadata as { start?: unknown } | null | undefined)?.start;
  if (!raw || typeof raw !== 'object') return null;
  const { door: rawDoor, plan, billing } = raw as { door?: unknown; plan?: unknown; billing?: unknown };
  const door = parseStartDoor(rawDoor, DOORS);
  if (!door) return null;
  if (door === 'organization') {
    const pricing = parseStartPricing(plan, billing);
    return pricing ? { door, pricing } : { door };
  }
  if (door === 'club' || door === 'league') {
    const pricing = paidDoorPick(door, parseStartPricing(plan, billing));
    return pricing ? { door, pricing } : { door };
  }
  const premiumBilling = door === 'premium' ? parseStartBilling(billing) : null;
  return premiumBilling ? { door, billing: premiumBilling } : { door };
}

/** Where the verification link (and every resend of it) returns: the door's create step, marked as just confirmed. */
export function startDoorLinkPath(door: StartDoor): string {
  return `${START_DOOR_PATH[door]}?confirmed=1`;
}

/**
 * Home's waiting workspace, by door (A4 revised 2026-10-19, hub v7): the card the door's team, league or organization
 * will become, waiting for its name under Workspaces until it is made. It shows beside every other workspace (owner:
 * "otherwise they lose that team") and has no Not now. `kind` is the workspace family it joins, so it wears that
 * card's label, icon and accent and fills in where it sits. Coach Premium has its own words because its step 2 asks
 * for the team, sport and plan before checkout. Words ruled by the owner 2026-10-19.
 */
export const WAITING_WORKSPACE: Record<StartDoor, { kind: 'coaches_basic' | 'coaches_premium' | 'organization'; badge: string; title: string; action: string }> = {
  team: { kind: 'coaches_basic', badge: 'Not named yet', title: 'Your team', action: 'Name your team' },
  league: { kind: 'organization', badge: 'Not named yet', title: 'Your league', action: 'Name your league' },
  organization: { kind: 'organization', badge: 'Not named yet', title: 'Your organization', action: 'Name your organization' },
  premium: { kind: 'coaches_premium', badge: 'Setup not finished', title: 'Your team', action: 'Continue setup' },
  // W49 (ruled 2026-11-18): shown only while Club or Club · Association is on sale.
  club: { kind: 'organization', badge: 'Not named yet', title: 'Your club', action: 'Name your club' },
};
