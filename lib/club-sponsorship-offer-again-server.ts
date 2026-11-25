import 'server-only';
/**
 * OFFER AGAIN — WHAT IT READS (Board Ready Stage 6, Part 4a). The batch window and its press (2A–10A) read here, and one old
 * deal's Offer again (12A) is worked out here from the deal page's own reads, so they can't disagree. The Deals callout (11A)
 * builds the same input from the reads its list already has. The two-year reason is worked out from the business's payments
 * (`readStandingPaidOn`), at the moment of reading — the press reads it again rather than trusting the window (/legal
 * 2026-11-25 must-fixes 1 and 2).
 */
import { readPackages, readPlaceTargets, readSettings } from './club-sponsorships-server';
import { readDeals, readOfferBars, readSponsorContacts, readStandingPaidOn } from './club-sponsorship-deals-server';
import { loadFiscalSetting } from './club-fiscal-year-server';
import { againYears, canOfferAgainOne, isOldPaidDeal, notReplaced, offeredIn, placeForPress, type OfferPrefill } from './club-sponsorship-offer-again';
import { fiscalYearOf, type FiscalSetting } from './club-fiscal-year';
import { DEAL_WORDS } from './club-sponsorship-deal-words';
import type { ClubDeal } from './club-sponsorship-deals';
import type { PlaceTargets } from './club-sponsorships';

type Org = { id: string; name: string };

export async function readAgainInput(org: Org, today: string) {
  const [setting, deals, packages, targets, contacts, bars, paidOn, settings] = await Promise.all([
    loadFiscalSetting(org.id), readDeals(org.id), readPackages(org.id), readPlaceTargets(org.id), readSponsorContacts(org.id),
    readOfferBars(org.id), readStandingPaidOn(org.id, today), readSettings(org.id),
  ]);
  return {
    today, clubName: org.name, deals, packages, targets, contacts, bars, paidOn, registered: settings.registered, settings,
    ...againYears(today, setting),
  };
}

/**
 * Offer again on ONE old deal (Part 4a ruling 12A): a PAID deal from an earlier fiscal year that nothing held this year has
 * replaced, whose business can be emailed on a reason that still holds (/legal 2026-11-25 must-fix 5). Its fill is the batch row's
 * (lib/club-sponsorship-offer-again.ts): this year's price, the place as asks 3, 5 and 6 find it, the last day as ask 4, the
 * Charge switch as ask 9, and the business's latest payment that still stands as the reason's day. Null = not offered, and
 * nothing more is read for a deal that never could be.
 */
export async function offerAgainFill(org: Org, deal: ClubDeal, page: {
  today: string; fiscal: FiscalSetting; deals: readonly ClubDeal[]; targets: PlaceTargets;
  bars: Awaited<ReturnType<typeof readOfferBars>>; registered: boolean;
}): Promise<OfferPrefill | null> {
  const years = againYears(page.today, page.fiscal);
  if (!isOldPaidDeal(deal, years.thisYear)) return null;
  const dealYear = fiscalYearOf(deal.offeredOn, page.fiscal);
  if (!notReplaced(offeredIn(page.deals, dealYear), page.deals, page.today, years.thisYear).some(d => d.id === deal.id)) return null;
  const [packages, contacts, paidOn] = await Promise.all([readPackages(org.id), readSponsorContacts(org.id), readStandingPaidOn(org.id, page.today)]);
  const row = canOfferAgainOne(deal, {
    today: page.today, clubName: org.name, deals: page.deals, packages, targets: page.targets, contacts, bars: page.bars, paidOn,
    registered: page.registered, ...years,
  }, dealYear);
  if (!row || !row.paidOn) return null;
  const oldDivision = deal.placeKind === 'division' ? page.targets.divisions.find(x => x.id === deal.targetId) : null;
  const lastYearPlace = deal.placeKind === 'club' ? null
    : oldDivision ? DEAL_WORDS.again.teamGroup(oldDivision.name, oldDivision.seasonName) : deal.targetName;
  return {
    sponsorId: row.sponsorId, packageId: row.packageId, targetId: placeForPress(row.place, null)?.targetId ?? null,
    amount: row.price, endsOn: row.endsOn, chargeTax: row.chargeTax, paidOn: row.paidOn, lastYearPlace,
  };
}
