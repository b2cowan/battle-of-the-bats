import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { requireSponsorships } from '@/lib/club-sponsorships-auth';
import { readPackages, readPlaceTargets, readSettings, readSponsors } from '@/lib/club-sponsorships-server';
import { readDeals } from '@/lib/club-sponsorship-deals-server';
import { dealPlaceLabel } from '@/lib/club-sponsorship-deal-actions';
import { sponsorshipFormQuestionCount } from '@/lib/club-form-server';
import { holdingDeals, takenOf } from '@/lib/club-sponsorship-deals';
import { loadFiscalSetting } from '@/lib/club-fiscal-year-server';
import { fiscalYearOf } from '@/lib/club-fiscal-year';
import { DEAL_WORDS } from '@/lib/club-sponsorship-deal-words';
import { tournamentToday } from '@/lib/timezone';

/**
 * THE SPONSORSHIPS PLACE'S ONE READ (Board Ready Stage 6, Parts 1 and 2): the packages with what has taken them, the
 * sponsors with their places, the names of every place, the invoice details, and how far the three steps are. Anyone who
 * opens Sponsorships reads all of it (round 2 tab 3); `changesInvoice` says whether this reader may change Invoice details.
 * Part 2: a package's Taken counts its paid, invoiced and offered deals that hold a place today (ask 7; Part 4a ruling 1A:
 * this fiscal year's, and an earlier one only while its last day hasn't passed), "Taken by" names the same deals, and
 * each sponsor's deals are summed up for its window's "From the deal" line and its Deal door.
 */
export const dynamic = 'force-dynamic';

export const GET = withObservability(async (req: Request) => {
  const gate = await requireSponsorships(req);
  if ('failure' in gate) return gate.failure;
  const orgId = gate.ctx.org.id;
  const [packages, sponsors, settings, targets, formQuestions, deals, fiscal] = await Promise.all([
    readPackages(orgId), readSponsors(orgId), readSettings(orgId), readPlaceTargets(orgId), sponsorshipFormQuestionCount(orgId), readDeals(orgId),
    loadFiscalSetting(orgId),
  ]);
  const today = tournamentToday(new Date());
  const live = holdingDeals(deals, today, fiscalYearOf(today, fiscal));
  // Each deal behind a sponsor: its package and invoice number (the window's "From the deal · Division sponsor, invoice 2027-014").
  // A withdrawn deal is listed too (marked): it shows nowhere, but it still keeps the business from being removed.
  const sponsorDeals: Record<string, { id: string; packageName: string; invoice: string | null; withdrawn: boolean }[]> = {};
  for (const d of deals) (sponsorDeals[d.sponsorId] ??= []).push({ id: d.id, packageName: d.packageName, invoice: d.invoice?.number ?? null, withdrawn: d.state === 'withdrawn' });
  return NextResponse.json({
    packages: packages.map(p => ({
      ...p,
      taken: takenOf(live, p.id),
      takenBy: live.filter(d => d.packageId === p.id).map(d => ({
        id: d.id, name: d.businessName,
        caption: [DEAL_WORDS.list.band[d.state], dealPlaceLabel(d) ?? DEAL_WORDS.list.theClub].join(' · '),
      })),
    })),
    sponsors,
    sponsorDeals,
    settings,
    targets,
    formQuestions,
    changesInvoice: gate.changesInvoice,
    today,
  });
}, { route: '/api/admin/sponsorships' });
