import type { Metadata } from 'next';
import { requirePlatformAreaView } from '@/lib/platform-auth';
import { getFoundingSeasonDeskData } from '@/lib/founding-season-desk';
import {
  FOUNDING_SEASON_END,
  FOUNDING_SEASON_END_LABEL,
  FOUNDING_SEASON_NEXT_YEAR_LABEL,
  isFoundingSeasonCardWindowOpen,
} from '@/lib/plan-config';
import FoundingSeasonDeskClient from './FoundingSeasonDeskClient';

export const metadata: Metadata = {
  title: 'Founding Season — Platform Admin',
};

/**
 * THE FOUNDING SEASON DESK — every free account in one list, and the two columns the September 2027
 * conversion actually runs on: has this account got a card, and has it chosen a plan for next season.
 *
 * Built because the alternative was a spreadsheet. Nothing in the product turns a comp off by
 * itself, card-on-file lived only in Stripe until migration 283, and on October 1, 2027 somebody has
 * to convert or close every one of these accounts.
 *
 * ⚠ READ ONLY, AND THAT IS THE DESIGN (owner-approved 2026-09-07). Every action this page implies
 * already exists elsewhere — Bulk Operations changes plans, the org detail page cancels, Email
 * Campaigns sends the reminder — and this page links to them. A desk that can act is a desk that can
 * convert the wrong account; how the turn-off itself runs is a Phase 3 decision due May 2027.
 *
 * ⚠ NOT IN THE LAYOUT SWEEP. `scripts/layout-screens.mjs` covers coach and marketing screens only,
 * so no platform-admin control has ever been measured against a tap floor. The phone shape here is
 * measured by hand (361 / 390 / 768) and the table carries the console's own `.table-cards` recipe.
 */
export default async function FoundingSeasonPage() {
  await requirePlatformAreaView('founding_season');
  const { rows, totals } = await getFoundingSeasonDeskData();

  return (
    <FoundingSeasonDeskClient
      rows={rows}
      totals={totals}
      freeSeasonEndsLabel={FOUNDING_SEASON_END_LABEL}
      nextYearLabel={FOUNDING_SEASON_NEXT_YEAR_LABEL}
      freeSeasonEndsIso={FOUNDING_SEASON_END}
      cardWindowOpen={isFoundingSeasonCardWindowOpen()}
    />
  );
}
