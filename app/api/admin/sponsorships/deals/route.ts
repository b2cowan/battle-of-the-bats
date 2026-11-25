import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { refused, requireSponsorships } from '@/lib/club-sponsorships-auth';
import { readPackages, readPlaceTargets, readSettings } from '@/lib/club-sponsorships-server';
import {
  createBareSponsor, createDeal, readDeals, readOfferBars, readSponsorContacts, readStandingPaidOn, rememberSponsorEmail,
} from '@/lib/club-sponsorship-deals-server';
import { actorOf, dealLinkUrl, findTarget, offerContactOf, OFFER_ERRORS } from '@/lib/club-sponsorship-deal-actions';
import { offerNewDeal, offerSendCheck, paidReasonRefusal } from '@/lib/club-sponsorship-offer-send';
import { bandOf, dealHolds, emailBarFor, holdingDeals, parseOfferInput, takenOf, type ClubDeal, type DealState } from '@/lib/club-sponsorship-deals';
import { packageFull } from '@/lib/club-sponsorships';
import { DEAL_WORDS } from '@/lib/club-sponsorship-deal-words';
import { SPONSORSHIPS_WORDS } from '@/lib/club-sponsorships-words';
import { payLinkSecret } from '@/lib/sponsor-deal-link';
import { OfferEmailRefused } from '@/lib/sponsor-offer-email';
import { loadFiscalSetting, resolveFiscalYear } from '@/lib/club-fiscal-year-server';
import { fiscalYearOf, fiscalYearOptions } from '@/lib/club-fiscal-year';
import { againCallout, againRows, againYears, offeredIn } from '@/lib/club-sponsorship-offer-again';
import { tournamentToday } from '@/lib/timezone';

/**
 * SPONSORSHIPS › DEALS (Board Ready Stage 6, Part 2; round 1 tabs 3 and 5).
 *   GET  — one fiscal year's deals (a deal belongs to the year it was offered in, its income lands in that year's books),
 *          the Year pill's years, the money band (before GST/HST), and what the Offer window needs: the packages with what
 *          has taken them (ask 7: Full counts paid, invoiced and offered deals that hold a place today, Part 4a ruling 1A), each business with why it
 *          can't be emailed (ask 13), the places with who holds them (ask 6: warns, never blocks).
 *   POST — Offer a deal. A full or archived package is refused (no business opens a link for a place that has gone); a send
 *          waits for the mailing address and refuses a stopped or family-opted-out address (409, its code). The email goes
 *          out before the CASL record is written; an email that fails removes the deal (nothing was offered). Every check and
 *          the make → email → record steps are the shared step's (lib/club-sponsorship-offer-send.ts, Part 4a). "They paid us"
 *          for a business on the list rests on its payments (`paidReasonRefusal`).
 */
export const dynamic = 'force-dynamic';

const STATE_WORD: Record<DealState, string> = { offered: 'offered', form_received: 'form received', invoiced: 'invoiced', paid: 'paid', withdrawn: 'withdrawn' };
const W = DEAL_WORDS;

/** A deal as the list reads it: never its link version (the link itself is the deal page's, on its own read). */
function publicDeal(d: ClubDeal & { linkVersion: number }): ClubDeal {
  const copy: Partial<ClubDeal & { linkVersion: number }> = { ...d };
  delete copy.linkVersion;
  return copy as ClubDeal;
}

export const GET = withObservability(async (req: Request) => {
  const gate = await requireSponsorships(req);
  if ('failure' in gate) return gate.failure;
  const orgId = gate.ctx.org.id;
  const today = tournamentToday(new Date());
  const [{ setting, year }, all, packages, contacts, bars, targets, settings] = await Promise.all([
    resolveFiscalYear(req, orgId, today), readDeals(orgId), readPackages(orgId), readSponsorContacts(orgId), readOfferBars(orgId),
    readPlaceTargets(orgId), readSettings(orgId),
  ]);
  const inYear = all.filter(d => d.offeredOn >= year.firstDay && d.offeredOn <= year.lastDay);
  const perYear: Record<string, number> = {};
  for (const d of all) { const k = fiscalYearOf(d.offeredOn, setting).key; perYear[k] = (perYear[k] ?? 0) + 1; }
  const years = fiscalYearOptions(setting, today, perYear).filter(y => y.current || (perYear[y.key] ?? 0) > 0 || y.key === year.key);

  // What holds a place today (ruling 1A): this fiscal year's deals, and an earlier one only while its last day hasn't passed.
  const current = fiscalYearOf(today, setting);
  const holding = holdingDeals(all, today, current);

  // Offer again's callout (11A): on the current year only, while any of last year's rows can still be offered.
  let again: { lastYear: string; sponsored: number; left: number } | null = null;
  const spans = againYears(today, setting);
  if (year.key === current.key && offeredIn(all, spans.lastYear).length > 0) {
    const input = {
      today, clubName: gate.ctx.org.name, deals: all, packages, targets, contacts, bars, registered: settings.registered,
      paidOn: await readStandingPaidOn(orgId, today), ...spans,
    };
    const c = againCallout(input, againRows(input));
    if (c.left > 0) again = { lastYear: spans.lastYear.name, ...c };
  }
  const live = inYear.filter(d => d.state !== 'withdrawn');
  const sum = (ds: readonly ClubDeal[]) => ({ amount: Math.round(ds.reduce((s, d) => s + d.amount * 100, 0)) / 100, count: ds.length });
  const figures = {
    deals: sum(live),
    paid: sum(live.filter(d => d.state === 'paid')),
    invoiced: sum(live.filter(d => d.state === 'invoiced')),
    waiting: sum(live.filter(d => d.state === 'offered' || d.state === 'form_received')),
  };

  // Each business's grey line in the picker: its latest deal ("2026 · Team sponsor, paid"), else "no deals yet".
  const latestBy = new Map<string, ClubDeal>();
  for (const d of all) latestBy.set(d.sponsorId, d);
  const sponsors = contacts.map(c => {
    const last = latestBy.get(c.id);
    return {
      ...c,
      bar: emailBarFor(c.email, bars.stops, bars.family),
      caption: last ? W.offer.pastDeal(fiscalYearOf(last.offeredOn, setting).name, last.packageName, STATE_WORD[last.state]) : null,
    };
  });

  return NextResponse.json({
    year: { key: year.key, name: year.name },
    years,
    deals: inYear.map(publicDeal).map(d => ({ ...d, band: bandOf(d) })),
    figures,
    packages: packages.filter(p => !p.archivedAt).map(p => {
      const taken = takenOf(holding, p.id);
      return { ...p, taken, full: packageFull(p, taken) };
    }),
    sponsors,
    targets,
    holds: dealHolds(holding),
    registered: settings.registered,
    hasMailingAddress: !!settings.mailingAddress,
    hasContact: !!(await offerContactOf(orgId, settings)),
    linksOn: !!payLinkSecret(),
    again,
    today,
  });
}, { route: '/api/admin/sponsorships/deals' });

export const POST = withObservability(async (req: Request) => {
  const gate = await requireSponsorships(req);
  if ('failure' in gate) return gate.failure;
  const { org } = gate.ctx;
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  const today = tournamentToday(new Date());
  const parsed = parseOfferInput(body ?? {}, today, OFFER_ERRORS);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error, field: parsed.field ?? null }, { status: 400 });
  const v = parsed.value;

  const [packages, targets, settings, contacts, all, fiscal] = await Promise.all([
    readPackages(org.id), readPlaceTargets(org.id), readSettings(org.id), readSponsorContacts(org.id), readDeals(org.id), loadFiscalSetting(org.id),
  ]);
  const pkg = packages.find(p => p.id === v.packageId);
  if (!pkg) return refused(W.offer.errPkg);
  if (pkg.archivedAt) return refused(W.offer.errArchived, 409, 'archived');
  if (packageFull(pkg, takenOf(holdingDeals(all, today, fiscalYearOf(today, fiscal)), pkg.id))) return refused(W.offer.fullReason, 409, 'full');
  const target = findTarget(targets, pkg.placeKind, v.targetId);
  if (!target) return NextResponse.json({ error: W.offer.errTarget, field: 'target' }, { status: 400 });

  const existing = v.sponsorId ? contacts.find(c => c.id === v.sponsorId) ?? null : null;
  if (v.sponsorId && !existing) return refused(SPONSORSHIPS_WORDS.say.notFound, 404, 'not_found');
  const to = v.email ?? existing?.email ?? null;
  // The send's own clearance: the address and the contact the checks passed, or null for "Make the link only".
  let cleared: { to: string; contactEmail: string } | null = null;

  if (v.send) {
    const check = await offerSendCheck({ orgId: org.id, settings, to, sponsorId: existing?.id });
    if (!check.ok) {
      return check.block.code === 'no_email'
        ? NextResponse.json({ error: check.block.error, field: 'email' }, { status: 400 })
        : refused(check.block.error, check.block.status, check.block.code);
    }
    cleared = check;
    // "They paid us" rests on the payments the server can see (/legal must-fix 5; every single offer, owner 2026-11-25).
    const refusal = v.reason === 'paid_recently' && existing ? await paidReasonRefusal(org.id, existing.id, v.reasonOn!, today) : null;
    if (refusal) return NextResponse.json({ error: refusal, field: 'reasonOn' }, { status: 400 });
  }
  if (!payLinkSecret()) return refused(W.offer.noSecret, 503, 'no_secret');

  const by = await actorOf(gate.ctx);
  const sponsorId = existing ? existing.id : await createBareSponsor(org.id, by.userId, v.newName!, to);
  if (existing && v.email && !existing.email) await rememberSponsorEmail(org.id, existing.id, v.email);

  const newDeal = {
    sponsorId, pkg: { id: pkg.id, name: pkg.name, items: pkg.items, logoOnSite: pkg.logoOnSite, placeKind: pkg.placeKind },
    targetId: target.id, targetName: target.name, endsOn: v.endsOn, amount: v.amount,
    chargeTax: settings.registered && v.chargeTax, offeredOn: today, offeredTo: to,
  };

  if (!cleared) {
    const dealId = await createDeal(org.id, by, newDeal);
    return NextResponse.json({ id: dealId, link: dealLinkUrl(org.slug, dealId, 0) }, { status: 201 });
  }

  const sent = await offerNewDeal({
    orgId: org.id, orgSlug: org.slug, by, deal: newDeal, to: cleared.to, reason: v.reason!, reasonOn: v.reasonOn!, note: v.note,
    settings, contactEmail: cleared.contactEmail, province: existing?.province ?? null, today,
  });
  if (!sent.ok) {
    if (!(sent.cause instanceof OfferEmailRefused)) console.error('[sponsorships] offer email failed:', (sent.cause as Error)?.message ?? 'no message');
    return refused(sent.block.error, sent.block.status, sent.block.code);
  }
  return NextResponse.json({ id: sent.dealId, ...(sent.unconfirmed ? { unconfirmed: true } : {}) }, { status: 201 });
}, { route: '/api/admin/sponsorships/deals' });
