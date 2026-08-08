import 'server-only';
import { isCoachesPortalPurchasable } from './plan-gating-server';

/**
 * Server-resolved config for the "Run a tournament" persona menu (Desktop Public UX Phase 1,
 * WI-2). The menu mirrors the /start chooser's gating exactly — it must never promote a door
 * the chooser itself would hide (S1-1 rider: nothing not-yet-live is promoted):
 *   • coachHref — the live free-team setup when team checkout is open, else the /for-coaches
 *     explainer (the same flip the chooser's "Coach a team" card makes);
 *   • showLeague — League Starter is an unlisted capped beta; the menu row only exists while
 *     the flag is on.
 *
 * Resolve this ONLY in mounts that are already dynamic (the consumer layout, the coach
 * journey chrome) — `getPlanGatingMap` reads cookies + DB, so calling it from the root
 * layout would force every route dynamic. Mounts that can't afford that (the root-mounted
 * tournament strip) use StartMenu's safe defaults instead: "Coach a team" routes through the
 * /start chooser, which applies the gate itself.
 */
export type StartMenuConfig = { coachHref: string; showLeague: boolean };

export async function getStartMenuConfig(): Promise<StartMenuConfig> {
  const teamCheckoutOpen = await isCoachesPortalPurchasable();
  return {
    coachHref: teamCheckoutOpen ? '/start/team' : '/for-coaches',
    showLeague: process.env.LEAGUE_STARTER_BETA === 'true',
  };
}
