import 'server-only';
import { isCoachesPortalPurchasable } from './plan-gating-server';
import { isFoundingSeasonPromoActive } from './plan-config';
import { START_DOOR_PATH } from './start-door';

/**
 * THE ONE "COACH A TEAM" RULE (The first look, rule 8 / F14, owner 2026-10-19: one door per thing). Every
 * "Coach a team" — the /start card, the top bar's Get started menu and the coach demo's start button — leads
 * where this says, so the doors can never disagree about which product a coach is starting again:
 *   • Coach Premium while team checkout is open AND the Founding Season promo runs (owner-approved 2026-09-07:
 *     the coach door opens the product every "Start free" advertises; the free Basic team stays reachable as
 *     /start's quiet line beneath the cards);
 *   • the free team setup when checkout is open and the promo is over;
 *   • the /for-coaches explainer while checkout is gated (BUSINESS_DECISIONS 2026-07-20 D2: never a "Free" door
 *     landing on a gated dead end).
 * Pure, so /start (which already holds both answers) keys its card's words off the same decision.
 */
export type CoachDoor = 'premium' | 'free' | 'gated';

export function coachStartDoor(checkoutOpen: boolean, promoActive: boolean): CoachDoor {
  if (!checkoutOpen) return 'gated';
  return promoActive ? 'premium' : 'free';
}

export const COACH_DOOR_HREF: Record<CoachDoor, string> = {
  premium: START_DOOR_PATH.premium,
  free: START_DOOR_PATH.team,
  gated: '/for-coaches',
};

export function coachStartHref(checkoutOpen: boolean, promoActive: boolean): string {
  return COACH_DOOR_HREF[coachStartDoor(checkoutOpen, promoActive)];
}

/** The rule above, resolved — for the mounts that do not already hold the checkout answer. */
export async function getCoachStartHref(): Promise<string> {
  return coachStartHref(await isCoachesPortalPurchasable(), isFoundingSeasonPromoActive('team'));
}

/**
 * Server-resolved config for the top bar's "Get started" menu (Desktop Public UX Phase 1, WI-2). The menu
 * mirrors the /start chooser's gating exactly — it must never promote a door the chooser itself would hide
 * (S1-1 rider: nothing not-yet-live is promoted):
 *   • coachHref — the one coach rule above;
 *   • showLeague — League Starter is an unlisted capped beta; the menu row only exists while the flag is on.
 *
 * Resolve this ONLY in mounts that are already dynamic (the consumer layout, the coach journey chrome) —
 * `getPlanGatingMap` reads cookies + DB, so calling it from the root layout would force every route dynamic.
 * Mounts that can't afford that (the root-mounted tournament strip) use StartMenu's safe defaults instead:
 * "Coach a team" routes through the /start chooser, which applies the rule itself.
 */
export type StartMenuConfig = { coachHref: string; showLeague: boolean };

export async function getStartMenuConfig(): Promise<StartMenuConfig> {
  return {
    coachHref: await getCoachStartHref(),
    showLeague: process.env.LEAGUE_STARTER_BETA === 'true',
  };
}
