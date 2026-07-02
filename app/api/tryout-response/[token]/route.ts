import { NextResponse } from 'next/server';
import {
  getRepTryoutRegistrationByOfferToken,
  recordTryoutOfferResponse,
  getRepTeam,
  getRepProgramYear,
  getRepTeamCoachUserIds,
  TryoutOfferError,
} from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { notify } from '@/lib/notify';
import { withObservability } from '@/lib/observability';
import type { RepTryoutRegistration } from '@/lib/types';

/**
 * No-account guardian offer-response endpoint (Phase 2B.5). The URL token is the ONLY credential.
 *
 * GET is READ-ONLY (email link scanners auto-follow GET links, so it must never mutate) — it returns
 * just enough to render the response page. The Accept/Decline mutation is a POST triggered by an
 * explicit on-page button. Recording a response NEVER changes roster status — the coach still
 * finalizes (D1); we only stamp the family's answer and notify the coach.
 */

async function orgInfo(orgId: string): Promise<{ orgName: string | null; orgLogoUrl: string | null; orgSlug: string | null }> {
  const { data } = await supabaseAdmin
    .from('organizations')
    .select('name, logo_url, slug')
    .eq('id', orgId)
    .maybeSingle();
  return { orgName: data?.name ?? null, orgLogoUrl: data?.logo_url ?? null, orgSlug: data?.slug ?? null };
}

/** Public, minimal view of the offer for the response page. */
async function viewFor(reg: RepTryoutRegistration) {
  const [team, programYear, brand] = await Promise.all([
    getRepTeam(reg.teamId),
    getRepProgramYear(reg.programYearId),
    orgInfo(reg.orgId),
  ]);
  const expired = !!reg.offerExpiresAt && new Date(reg.offerExpiresAt).getTime() < Date.now() && !reg.offerRespondedAt;
  const state: 'open' | 'expired' | 'responded' | 'closed' =
    reg.status !== 'offered' ? 'closed'
    : reg.offerRespondedAt ? 'responded'
    : expired ? 'expired'
    : 'open';
  return {
    state,
    response: reg.offerResponse, // 'accepted' | 'declined' | null
    playerFirstName: reg.playerFirstName,
    playerLastName: reg.playerLastName,
    teamName: team?.name ?? '',
    yearName: programYear?.name ?? '',
    orgName: brand.orgName,
    orgLogoUrl: brand.orgLogoUrl,
    respondBy: reg.offerExpiresAt
      ? new Date(reg.offerExpiresAt).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })
      : null,
  };
}

export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ token: string }> },) => {
  const { token } = await params;
  const reg = await getRepTryoutRegistrationByOfferToken(token);
  if (!reg) return NextResponse.json({ state: 'invalid' }, { status: 404 });
  return NextResponse.json(await viewFor(reg));
}, { route: '/api/tryout-response/[token]' });

export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ token: string }> },) => {
  const { token } = await params;
  const body = await req.json().catch(() => ({}));
  const raw = typeof body.response === 'string' ? body.response : '';
  const response = raw === 'accept' || raw === 'accepted' ? 'accepted'
    : raw === 'decline' || raw === 'declined' ? 'declined'
    : null;
  if (!response) return NextResponse.json({ error: 'bad_response' }, { status: 400 });

  let updated: RepTryoutRegistration;
  try {
    updated = await recordTryoutOfferResponse(token, response);
  } catch (e) {
    if (e instanceof TryoutOfferError) {
      const status = e.code === 'not_found' ? 404 : e.code === 'expired' ? 410 : 409;
      return NextResponse.json({ error: e.code, message: e.message }, { status });
    }
    throw e;
  }

  // Flag the coaching staff — they finalize the roster spot (D1/D2: no automatic roster/email).
  try {
    const [coachUserIds, brand] = await Promise.all([
      getRepTeamCoachUserIds(updated.teamId),
      orgInfo(updated.orgId),
    ]);
    const who = `${updated.playerFirstName} ${updated.playerLastName}`.trim();
    const verb = response === 'accepted' ? 'accepted' : 'declined';
    await notify({
      orgId: updated.orgId,
      eventType: 'tryout_offer_response',
      title: `Tryout offer ${verb}`,
      body: response === 'accepted'
        ? `${who}'s family accepted the offer. Confirm to add them to the roster.`
        : `${who}'s family declined the offer.`,
      link: brand.orgSlug ? `/${brand.orgSlug}/coaches/teams/${updated.teamId}/tryouts` : undefined,
      userIds: coachUserIds.length ? coachUserIds : undefined,
    });
  } catch (e) {
    console.error('[notify] tryout offer response:', e);
  }

  return NextResponse.json({ ok: true, state: 'responded', response });
}, { route: '/api/tryout-response/[token]' });
