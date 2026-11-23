import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { refused, requireSponsorships } from '@/lib/club-sponsorships-auth';
import { createSponsor, readSponsors, SponsorCapReached, targetsBelong } from '@/lib/club-sponsorships-server';
import { isOwnSponsorLogo } from '@/lib/sponsor-logo';
import { HOME_STRIP_MAX, homePlacesShowing, parseSponsorInput, placeShowing, SPONSOR_LIST_MAX } from '@/lib/club-sponsorships';
import { SPONSORSHIPS_WORDS as W } from '@/lib/club-sponsorships-words';
import { tournamentToday } from '@/lib/timezone';

/**
 * ADD A SPONSOR (Board Ready Stage 6, Part 1; round 1 tab 8): a business with no deal, typed by the club, with its places
 * ("Shows on", the club by default). Up to 100 in the list (ask 11; the database's trigger holds it too); a 21st club
 * place showing today is refused, because the home strip shows 20.
 */
export const dynamic = 'force-dynamic';

export const POST = withObservability(async (req: Request) => {
  const gate = await requireSponsorships(req);
  if ('failure' in gate) return gate.failure;
  const { org, user } = gate.ctx;
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  const parsed = parseSponsorInput(body ?? {});
  if (!parsed.ok) return refused(parsed.error);
  const v = parsed.value;
  if (v.logoUrl && !isOwnSponsorLogo(v.logoUrl, org.id)) return refused(W.say.failed);
  if (!(await targetsBelong(org.id, v.places))) return refused(W.sponsor.errTarget);
  const list = await readSponsors(org.id);
  if (list.length >= SPONSOR_LIST_MAX) return refused(W.sponsor.errCap, 409, 'cap');
  const today = tournamentToday(new Date());
  if (v.places.some(p => p.kind === 'club' && placeShowing(p, today)) && homePlacesShowing(list, today) >= HOME_STRIP_MAX) {
    return refused(W.sponsor.errHomeFull, 409, 'home_full');
  }
  try {
    const id = await createSponsor(org.id, user.id, v);
    return NextResponse.json({ id }, { status: 201 });
  } catch (e) {
    if (e instanceof SponsorCapReached) return refused(W.sponsor.errCap, 409, 'cap');
    throw e;
  }
}, { route: '/api/admin/sponsorships/sponsors' });
