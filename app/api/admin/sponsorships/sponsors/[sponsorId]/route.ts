import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { isUuid } from '@/lib/utils';
import { refused, requireSponsorships } from '@/lib/club-sponsorships-auth';
import { deleteSponsor, homePlacesShowingNow, logoFileExists, readSponsor, removeLogoFile, targetsBelong, updateSponsor } from '@/lib/club-sponsorships-server';
import { sponsorHasAnyDeal } from '@/lib/club-sponsorship-deals-server';
import { isOwnSponsorLogo } from '@/lib/sponsor-logo';
import { HOME_STRIP_MAX, parseSponsorInput, placeShowing, sponsorHasDeal } from '@/lib/club-sponsorships';
import { SPONSORSHIPS_WORDS as W } from '@/lib/club-sponsorships-words';
import { tournamentToday } from '@/lib/timezone';

/**
 * ONE SPONSOR (Board Ready Stage 6, Part 1; round 1 tab 8). PATCH saves the record window's edit (it saves as you go): the
 * name, the logo, the link and the TYPED places — a place from a deal is the deal's and is never sent or changed here.
 * DELETE removes the sponsor and its logo, refused while a deal shows it ("Withdraw or end the deal first").
 */
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ sponsorId: string }> };
const notFound = () => NextResponse.json({ error: W.say.notFound, code: 'not_found' }, { status: 404 });

export const PATCH = withObservability(async (req: Request, { params }: Params) => {
  const gate = await requireSponsorships(req);
  if ('failure' in gate) return gate.failure;
  const { org } = gate.ctx;
  const { sponsorId } = await params;
  if (!isUuid(sponsorId)) return notFound();
  const current = await readSponsor(org.id, sponsorId);
  if (!current) return notFound();
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  // The fields sent are merged over the stored sponsor (as a package's are), so a partial body never clears a field.
  const parsed = parseSponsorInput({
    name: current.name, link: current.link, logoUrl: current.logoUrl,
    places: current.places.filter(p => p.source === 'typed').map(p => ({ id: p.id, kind: p.kind, targetId: p.targetId, endsOn: p.endsOn })),
    ...(body ?? {}),
  });
  if (!parsed.ok) return refused(parsed.error);
  const v = parsed.value;
  if (v.logoUrl && v.logoUrl !== current.logoUrl && !isOwnSponsorLogo(v.logoUrl, org.id)) return refused(W.say.failed);
  // A new address must still name a file. Saving one that has been deleted would break the logo and then delete the one in use.
  if (v.logoUrl && v.logoUrl !== current.logoUrl && !(await logoFileExists(org.id, v.logoUrl))) return refused(W.say.logoGone, 409, 'logo_gone');
  if (!(await targetsBelong(org.id, v.places))) return refused(W.sponsor.errTarget);
  const today = tournamentToday(new Date());
  const wasHome = current.places.some(p => p.kind === 'club' && placeShowing(p, today));
  const willHome = v.places.some(p => p.kind === 'club' && placeShowing(p, today)) || current.places.some(p => p.source === 'deal' && p.kind === 'club' && placeShowing(p, today));
  if (!wasHome && willHome && (await homePlacesShowingNow(org.id, today)) >= HOME_STRIP_MAX) {
    return refused(W.sponsor.errHomeFull, 409, 'home_full');
  }
  const keepLogo = v.logoUrl === current.logoUrl;
  await updateSponsor(org.id, sponsorId, v, { keepLogo });
  if (!keepLogo && current.logoUrl) await removeLogoFile(org.id, current.logoUrl);
  // The saved sponsor, so the window keys its new places by the ids the server gave them.
  return NextResponse.json({ sponsor: await readSponsor(org.id, sponsorId) });
}, { route: '/api/admin/sponsorships/sponsors/[sponsorId]' });

export const DELETE = withObservability(async (req: Request, { params }: Params) => {
  const gate = await requireSponsorships(req);
  if ('failure' in gate) return gate.failure;
  const { org } = gate.ctx;
  const { sponsorId } = await params;
  if (!isUuid(sponsorId)) return notFound();
  const current = await readSponsor(org.id, sponsorId);
  if (!current) return notFound();
  // Part 2: any deal, withdrawn ones too — its offers (the CASL record) and invoice numbers stay on record with the business.
  if (sponsorHasDeal(current) || (await sponsorHasAnyDeal(org.id, sponsorId))) return refused(W.sponsor.noRemoveDeals, 409, 'deal');
  await deleteSponsor(org.id, sponsorId);
  return NextResponse.json({ ok: true });
}, { route: '/api/admin/sponsorships/sponsors/[sponsorId]' });
