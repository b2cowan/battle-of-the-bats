import 'server-only';
import { cache } from 'react';
import { isCoachesPortalPurchasable, isPaidDoorOpen } from './plan-gating-server';
import { START_DOOR_PATH } from './start-door';

/**
 * THE ONE "COACH A TEAM" RULE (The first look, rule 8 / F14, owner 2026-10-19: one door per thing). Every
 * "Coach a team" — the /start card, the top bar's Get started menu and the coach demo's start button — leads
 * where this says, so the doors can never disagree about which product a coach is starting again:
 *   • the Premium Coaches Portal sign-up while team checkout is open (owner 2026-11-19: was "the free team setup
 *     once the promo is over" — no marketing door offers the free team home any more);
 *   • the /for-coaches explainer while checkout is gated (BUSINESS_DECISIONS 2026-07-20 D2: never a door
 *     landing on a gated dead end).
 * Pure, so /start (which already holds the checkout answer) keys its card's words off the same decision.
 */
export type CoachDoor = 'premium' | 'gated';

// ⚠ Owner ruling 2026-11-19 (BUSINESS_DECISIONS.md): no marketing door offers a free standalone team home any
// more. Open checkout → Premium, promo or not; the free Basic portal is the one a coach gets by entering a
// tournament, and only a door that comes FROM a tournament may say "free". Do not bring a 'free' door back here.
export function coachStartDoor(checkoutOpen: boolean): CoachDoor {
  return checkoutOpen ? 'premium' : 'gated';
}

export const COACH_DOOR_HREF: Record<CoachDoor, string> = {
  premium: START_DOOR_PATH.premium,
  gated: '/for-coaches',
};

export function coachStartHref(checkoutOpen: boolean): string {
  return COACH_DOOR_HREF[coachStartDoor(checkoutOpen)];
}

/** The rule above, resolved — for the mounts that do not already hold the checkout answer. */
export async function getCoachStartHref(): Promise<string> {
  return coachStartHref(await isCoachesPortalPurchasable());
}

/**
 * Server-resolved config for the top bar's "Get started" menu (Desktop Public UX Phase 1, WI-2). The menu
 * mirrors the /start chooser's gating exactly — it must never promote a door the chooser itself would hide
 * (S1-1 rider: nothing not-yet-live is promoted):
 *   • coachHref — the one coach rule above;
 *   • showLeague — while League Plus is on sale (there is no free League, owner 2026-11-19).
 *
 * Resolve this ONLY in mounts that are already dynamic (the consumer layout, the coach journey chrome) —
 * `getPlanGatingMap` reads cookies + DB, so calling it from the root layout would force every route dynamic.
 * Mounts that can't afford that (the root-mounted tournament strip) use StartMenu's safe defaults instead:
 * "Coach a team" routes through the /start chooser, which applies the rule itself.
 */
export type StartMenuConfig = { coachHref: string; showLeague: boolean };

/** Request-memoized: the /coaches layout and a nested journey layout both ask, and each ask reads plan gating. */
export const getStartMenuConfig = cache(async (): Promise<StartMenuConfig> => {
  // A Club row joins the menu with S3's nav order, not here.
  const [coachHref, showLeague] = await Promise.all([getCoachStartHref(), isPaidDoorOpen('league')]);
  return { coachHref, showLeague };
});
