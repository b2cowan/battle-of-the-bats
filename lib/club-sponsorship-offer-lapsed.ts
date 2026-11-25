import 'server-only';
/**
 * IS THIS OFFER STILL OPEN? (Board Ready Stage 6; owner 2026-11-25, with the Full fix.) An offer from an earlier fiscal year
 * whose place has gone back (`offerLapsed`) takes no answers from its link, and the club can't email or invoice it: the
 * package may already be sold to someone else. The business's page, its link's routes and the deal's own presses ask here.
 */
import { loadFiscalSetting } from './club-fiscal-year-server';
import { fiscalYearOf } from './club-fiscal-year';
import { linkTakesForm, offerLapsed, type ClubDeal } from './club-sponsorship-deals';
import { tournamentToday } from './timezone';

export async function offerLapsedNow(orgId: string, deal: Pick<ClubDeal, 'state' | 'offeredOn' | 'endsOn'>, today = tournamentToday()): Promise<boolean> {
  if (!linkTakesForm(deal)) return false;
  return offerLapsed(deal, today, fiscalYearOf(today, await loadFiscalSetting(orgId)));
}
