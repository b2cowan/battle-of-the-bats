import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { refused, requireSponsorships } from '@/lib/club-sponsorships-auth';
import { offerClubCheck, offerNewDeal } from '@/lib/club-sponsorship-offer-send';
import { readAgainInput } from '@/lib/club-sponsorship-offer-again-server';
import { actorOf } from '@/lib/club-sponsorship-deal-actions';
import { AGAIN_MAX_ROWS, againRows, placeForPress } from '@/lib/club-sponsorship-offer-again';
import { dealHolds, holdingDeals, takenOf } from '@/lib/club-sponsorship-deals';
import { offeredPackageToday } from '@/lib/club-sponsorship-deals-server';
import { packageFull } from '@/lib/club-sponsorships';
import { DEAL_WORDS } from '@/lib/club-sponsorship-deal-words';
import { SPONSORSHIPS_WORDS } from '@/lib/club-sponsorships-words';
import { OfferEmailRefused } from '@/lib/sponsor-offer-email';
import { FixedWindowRateLimiter } from '@/lib/rate-limit';
import { isCalendarDate, tournamentToday } from '@/lib/timezone';
import { isUuid } from '@/lib/utils';

/**
 * OFFER AGAIN — THE BATCH (Board Ready Stage 6, Part 4a; owner rulings 1A–12A, 2026-11-25; drawing tabs 2–4). Not "Send the link
 * again" (deals/[dealId]/again, a different feature on one unpaid offer): this offers THIS year's packages to LAST year's
 * sponsors, one new deal per row.
 *   GET  — the window's rows in their three groups (2A), worked out by lib/club-sponsorship-offer-again.ts, with what the rows'
 *          pickers need (the places' holders, for "Taken: …").
 *   POST — the press: { rows: [{ dealId, targetId?, endsOn? }] }, at most 100. Every row is worked out AGAIN here, from the
 *          database, at the press (/legal 2026-11-25 must-fixes 1–2): a row the read no longer calls Ready, a place that isn't
 *          one of its own choices, a package that has filled, or a bar that appeared since the window opened is not sent.
 *          Each row stands alone (10A): make the deal, email it, keep its offer record ("They paid us in the last 2 years",
 *          dated by the business's latest payment that still stands, 8A); an email that didn't go removes only that deal.
 *          One press per club at a time (drawing F7).
 *          A request ends at about 30 seconds on the host, so one request stops STARTING rows after `PRESS_BUDGET_MS` and
 *          answers `later`: the rows it didn't reach, which the window posts next. Sends are spaced (the mail service
 *          limits how many it takes a second).
 */
export const dynamic = 'force-dynamic';

const A = DEAL_WORDS.again;
/** No row is STARTED after this long; the slowest row (two tries at the mail service) then still ends inside the request. */
const PRESS_BUDGET_MS = 13_000;
const SEND_GAP_MS = 600;
const sending = new Set<string>();
// A long press arrives as several requests, a few a minute.
const presses = new FixedWindowRateLimiter(60_000, 20);

export const GET = withObservability(async (req: Request) => {
  const gate = await requireSponsorships(req);
  if ('failure' in gate) return gate.failure;
  const { org } = gate.ctx;
  const today = tournamentToday(new Date());
  const input = await readAgainInput(org, today);
  const club = await offerClubCheck(org.id, input.settings);
  return NextResponse.json({
    thisYear: input.thisYear.name,
    lastYear: input.lastYear.name,
    rows: againRows(input),
    holds: dealHolds(holdingDeals(input.deals, today, input.thisYear)),
    blocked: club.ok ? null : club.block.error,
    today,
  });
}, { route: '/api/admin/sponsorships/deals/offer-again' });

type Asked = { dealId: string; targetId: string | null; endsOn: string | null | undefined };

function readAsked(body: unknown): Asked[] | null {
  const list = (body as { rows?: unknown } | null)?.rows;
  if (!Array.isArray(list) || list.length === 0 || list.length > AGAIN_MAX_ROWS) return null;
  const seen = new Set<string>();
  const out: Asked[] = [];
  for (const r of list as Record<string, unknown>[]) {
    if (!r || !isUuid(r.dealId) || seen.has(r.dealId)) return null;
    seen.add(r.dealId);
    // Absent: the row's own last day. Empty: the club cleared the field, so no last day.
    const endsOn = typeof r.endsOn === 'string' ? r.endsOn.trim() || null : undefined;
    if (endsOn && !isCalendarDate(endsOn)) return null;
    out.push({ dealId: r.dealId, targetId: isUuid(r.targetId) ? r.targetId : null, endsOn });
  }
  return out;
}

export const POST = withObservability(async (req: Request) => {
  const gate = await requireSponsorships(req);
  if ('failure' in gate) return gate.failure;
  const { org } = gate.ctx;
  const asked = readAsked(await req.json().catch(() => null));
  if (!asked) return refused(SPONSORSHIPS_WORDS.say.failed, 400, 'bad_rows');
  if (sending.has(org.id) || !presses.take(org.id)) return refused(A.busy, 429, 'busy');
  sending.add(org.id);
  const startedAt = Date.now();
  try {
    const today = tournamentToday(new Date());
    // Read at the press, never kept from the window: the rows, the payments the reason rests on, the stops and the places.
    const input = await readAgainInput(org, today);
    const club = await offerClubCheck(org.id, input.settings);
    if (!club.ok) return refused(club.block.error, club.block.status, club.block.code);
    const rowsBy = new Map(againRows(input).map(r => [r.dealId, r]));
    const packages = new Map(input.packages.map(p => [p.id, p]));
    const holding = holdingDeals(input.deals, today, input.thisYear).map(d => ({ packageId: d.packageId, state: d.state, sponsorId: d.sponsorId }));
    const by = await actorOf(gate.ctx);

    // A row this read no longer lists (offered since the window opened) is still named.
    const nameOf = new Map(input.deals.map(d => [d.id, d.businessName]));
    const failed: { dealId: string; name: string; why: string }[] = [];
    /** Made and recorded, the mail service silent: named apart, never called a failure. */
    const unconfirmed: string[] = [];
    let sentCount = 0;
    let attempts = 0;
    const madeToday: string[] = [];
    let done = 0;
    for (const a of asked) {
      if (done > 0 && Date.now() - startedAt > PRESS_BUDGET_MS) break;
      done++;
      const row = rowsBy.get(a.dealId);
      const fail = (why: string) => failed.push({ dealId: a.dealId, name: nameOf.get(a.dealId) ?? '', why });
      const pkg = row ? packages.get(row.packageId) : undefined;
      if (!row || !pkg) { fail(A.failChanged); continue; }
      if (packageFull(pkg, takenOf(holding, pkg.id))) { fail(A.failFull); continue; }
      // "Ready" is this press's own read: the package on sale, the address unbarred, the payment inside two years.
      const place = row.group === 'ready' ? placeForPress(row.place, a.targetId) : null;
      if (!row.email || !row.paidOn || !place) { fail(A.failChanged); continue; }
      const endsOn = row.lastDayPassed && a.endsOn !== undefined ? a.endsOn : row.endsOn;
      if (endsOn && endsOn < today) { fail(A.failPastDay); continue; }
      const contact = input.contacts.find(c => c.id === row.sponsorId) ?? null;
      try {
        // Today's deals for this business and package: the ones this read saw, plus the ones this request has made.
        const known = input.deals.filter(d => d.sponsorId === row.sponsorId && d.packageId === pkg.id && d.offeredOn === today && d.state !== 'withdrawn').length
          + madeToday.filter(m => m === `${row.sponsorId} ${pkg.id}`).length;
        if (await offeredPackageToday(org.id, row.sponsorId, pkg.id, today) > known) { fail(A.failChanged); continue; }
        if (attempts++ > 0) await new Promise(resolve => setTimeout(resolve, SEND_GAP_MS));
        const sent = await offerNewDeal({
          orgId: org.id, orgSlug: org.slug, by, to: row.email, reason: 'paid_recently', reasonOn: row.paidOn, note: null,
          settings: input.settings, contactEmail: club.contactEmail, province: contact?.province ?? null, today,
          deal: {
            sponsorId: row.sponsorId, pkg: { id: pkg.id, name: pkg.name, items: pkg.items, logoOnSite: pkg.logoOnSite, placeKind: pkg.placeKind },
            targetId: place.targetId, targetName: place.targetName, endsOn, amount: row.price, chargeTax: row.chargeTax,
            offeredOn: today, offeredTo: row.email,
          },
        });
        if (!sent.ok) {
          if (!(sent.cause instanceof OfferEmailRefused)) console.error('[sponsorships] offer again email failed:', (sent.cause as Error)?.message ?? 'no message');
          fail(A.failEmail);
          continue;
        }
        madeToday.push(`${row.sponsorId} ${pkg.id}`);
        holding.push({ packageId: pkg.id, state: 'offered', sponsorId: row.sponsorId });
        if (sent.unconfirmed) unconfirmed.push(row.businessName);
        else sentCount++;
      } catch (e) {
        // One row's failure never takes the others' results with it (10A).
        console.error('[sponsorships] offer again row failed:', (e as Error)?.message ?? 'no message');
        fail(A.failError);
      }
    }
    const later = asked.slice(done).map(a => a.dealId);
    return NextResponse.json({ sent: sentCount, failed, unconfirmed, later }, { status: sentCount || unconfirmed.length ? 201 : 200 });
  } finally {
    sending.delete(org.id);
  }
}, { route: '/api/admin/sponsorships/deals/offer-again' });
