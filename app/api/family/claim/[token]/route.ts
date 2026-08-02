import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { withObservability } from '@/lib/observability';
import {
  checkNoLoginRateLimit,
  isPlausibleNoLoginToken,
  tooManyRequests,
} from '@/lib/no-login-token';
import { GUARDIAN_AGE_BANDS, GUARDIAN_TIER_ENABLED, claimGuardianInvite } from '@/lib/family-guardian';
import { FamilyLinkError } from '@/lib/family-access';
import { followEntity } from '@/lib/fan-follows';
import { clientIpFrom } from '@/lib/rate-limit';

/**
 * Claim a coach-sent guardian invite.
 *
 * This is the on-ramp that carries the SAME trust as the platform's existing behaviour: the
 * coach chose the address, it was already on the player's roster row, and it already receives
 * team email. A claim from a session verified as that exact address therefore needs no second
 * approval — the invite was the approval (amended ruling #14).
 *
 * A claim from a DIFFERENT address does not fail; it becomes an ordinary queued request so a
 * parent who signed up with another email still gets in, with the coach's eyes on it.
 *
 * POST only — a link scanner following the URL from an email must not be able to claim
 * anything on the recipient's behalf.
 */

export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ token: string }> },) => {
  const { token } = await params;

  const verdict = await checkNoLoginRateLimit('family_join_request', req);
  if (!verdict.allowed) return tooManyRequests(verdict);

  if (!GUARDIAN_TIER_ENABLED) {
    return NextResponse.json({ error: 'guardian_tier_unavailable' }, { status: 404 });
  }
  if (!isPlausibleNoLoginToken(token)) {
    return NextResponse.json({ error: 'invalid' }, { status: 404 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: 'sign_in_required' }, { status: 401 });

  // Consent is collected HERE, on the claim, not at invite time — the coach sending an invite
  // is not the parent agreeing to anything. Same two required consents and the same age band
  // the request path asks for, so both on-ramps produce the same evidence.
  const body = await req.json().catch(() => ({}));
  const ageBand = body?.ageBand;
  if (!GUARDIAN_AGE_BANDS.includes(ageBand)) {
    return NextResponse.json({ error: 'age_band_required' }, { status: 400 });
  }
  if (body?.consentDataCollection !== true || body?.consentGuardian !== true) {
    return NextResponse.json({ error: 'consent_required' }, { status: 400 });
  }

  try {
    const outcome = await claimGuardianInvite({
      token,
      userId: user.id,
      userEmail: user.email,
      ageBand,
      consentIp: clientIpFrom(req),
    });
    // One shape for expired / already-claimed / unknown — a holder of a dead link learns only
    // that it is dead.
    if (!outcome) return NextResponse.json({ error: 'invalid' }, { status: 404 });

    // Plant the follow so the team appears where a consumer already looks. Presentation only:
    // the verified LINK is the authorization, so a failure here costs a shortcut, not access.
    try {
      await followEntity({
        userId: user.id, entityType: 'rep_team', entityId: outcome.repTeamId, source: 'manual',
      });
    } catch (e) {
      console.error('[family-claim] follow plant failed (non-fatal):', e);
    }

    return NextResponse.json({ ok: true, status: outcome.status, repTeamId: outcome.repTeamId });
  } catch (e) {
    if (e instanceof FamilyLinkError) {
      return NextResponse.json({ error: e.code, message: e.message }, { status: 409 });
    }
    throw e;
  }
}, { route: '/api/family/claim/[token]' });
