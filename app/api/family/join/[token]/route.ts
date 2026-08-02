import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { withObservability } from '@/lib/observability';
import {
  checkNoLoginRateLimit,
  isPlausibleNoLoginToken,
  tooManyRequests,
} from '@/lib/no-login-token';
import {
  FamilyLinkError,
  getEnabledFamilyOrg,
  getOwnLinkForUserTeam,
  requestFamilyFollow,
  resolveTeamByFamilyLinkToken,
} from '@/lib/family-access';
import { followEntity } from '@/lib/fan-follows';
import {
  GUARDIAN_AGE_BANDS,
  guardianConsentText,
  GUARDIAN_TIER_ENABLED,
  requestGuardianLink,
} from '@/lib/family-guardian';
import { clientIpFrom } from '@/lib/rate-limit';

/**
 * The team family link — the ONLY door into the family layer.
 *
 * GET  → who this link belongs to, and nothing else.
 * POST → lodge a request with the coach (requires a signed-in account).
 *
 * What this endpoint deliberately never returns: any roster content. Not a player list,
 * not a count, not a "did you mean" match. The requester types a relationship and waits;
 * all matching happens on the coach's side. That is owner ruling #3 — there is no public
 * search for a team or a child, and a link that answered "is Maya on this team?" would be
 * one by accident.
 *
 * GET is read-only so a link scanner following the URL from an email cannot create
 * anything, mirroring the tryout-offer rail's posture.
 */

function notFound() {
  // One shape for "no such link", "link was reset" and "team is not premium". A caller
  // holding a guessed URL must not be able to tell these apart.
  return NextResponse.json({ state: 'invalid' }, { status: 404 });
}

export const GET = withObservability(async (req: Request,
  { params }: { params: Promise<{ token: string }> },) => {
  const { token } = await params;

  const verdict = await checkNoLoginRateLimit('family_join_view', req);
  if (!verdict.allowed) return tooManyRequests(verdict);

  if (!isPlausibleNoLoginToken(token)) return notFound();

  const team = await resolveTeamByFamilyLinkToken(token);
  if (!team) return notFound();

  const org = await getEnabledFamilyOrg(team.orgId, team.repTeamId);
  if (!org) return notFound();

  // Is this visitor already known to this team? Answered only for the SIGNED-IN caller
  // about THEMSELVES — never a lookup anyone can run about anyone else.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Their ACTUAL state, not just verified-or-nothing. A family member who already asked
  // and came back to the same link was previously shown the whole request form again, and
  // only learned they had already applied by submitting and being refused.
  let existingStatus: string | null = null;
  if (user) {
    const link = await getOwnLinkForUserTeam(user.id, team.repTeamId);
    existingStatus = link ? link.status : null;
  }

  return NextResponse.json({
    state: 'open',
    teamName: team.teamName,
    orgName: org.name,
    orgLogoUrl: org.logoUrl,
    signedIn: !!user,
    signedInEmail: user?.email ?? null,
    existingStatus,
    // The page asks the server rather than reading a bundle constant, so the switch cannot be
    // flipped from the browser and the UI can never offer a path the API will refuse.
    guardianTierEnabled: GUARDIAN_TIER_ENABLED,
  });
}, { route: '/api/family/join/[token]' });

export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ token: string }> },) => {
  const { token } = await params;

  const verdict = await checkNoLoginRateLimit('family_join_request', req);
  if (!verdict.allowed) return tooManyRequests(verdict);

  if (!isPlausibleNoLoginToken(token)) return notFound();

  const team = await resolveTeamByFamilyLinkToken(token);
  if (!team) return notFound();

  const org = await getEnabledFamilyOrg(team.orgId, team.repTeamId);
  if (!org) return notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: 'sign_in_required' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const role = body?.role;

  // ── The GUARDIAN path (built, switched OFF by default) ──
  // While `GUARDIAN_TIER_ENABLED` is off this refuses BEFORE writing anything, so no guardian
  // link and no consent record can be created by a direct API call any more than by the UI.
  // The refusal is the same honest message the page shows.
  if (role === 'guardian') {
    if (!GUARDIAN_TIER_ENABLED) {
      return NextResponse.json({
        error: 'guardian_tier_unavailable',
        message: 'Connecting as a player’s parent or guardian isn’t open yet. Following the team is available now.',
      }, { status: 409 });
    }

    // Both name parts — a coach approving on a team with two children sharing a first name
    // must not have to guess which one this adult belongs to.
    const playerFirstName = typeof body?.playerFirstName === 'string' ? body.playerFirstName.trim() : '';
    const playerLastName = typeof body?.playerLastName === 'string' ? body.playerLastName.trim() : '';
    const ageBand = body?.ageBand;
    if (!playerFirstName || !playerLastName) {
      return NextResponse.json({ error: 'player_name_required' }, { status: 400 });
    }
    if (!GUARDIAN_AGE_BANDS.includes(ageBand)) {
      return NextResponse.json({ error: 'age_band_required' }, { status: 400 });
    }
    // Both required consents must be affirmative. Checked server-side because a consent the
    // client merely claimed is not a consent.
    if (body?.consentDataCollection !== true || body?.consentGuardian !== true) {
      return NextResponse.json({ error: 'consent_required' }, { status: 400 });
    }

    try {
      const status = await requestGuardianLink({
        orgId: team.orgId,
        repTeamId: team.repTeamId,
        userId: user.id,
        email: user.email,
        playerFirstName,
        playerLastName,
        relationship: typeof body?.relationship === 'string' ? body.relationship.trim().slice(0, 40) || null : null,
        ageBand,
        // Server-captured only — never taken from the request body.
        consentIp: clientIpFrom(req),
        consentText: guardianConsentText(org.name),
      });
      return NextResponse.json({ ok: true, status, teamName: team.teamName });
    } catch (e) {
      if (e instanceof FamilyLinkError) {
        return NextResponse.json({ error: e.code, message: e.message }, { status: 409 });
      }
      throw e;
    }
  }

  if (role !== 'follower') {
    return NextResponse.json({ error: 'bad_role' }, { status: 400 });
  }

  const relationshipRaw = typeof body?.relationship === 'string' ? body.relationship.trim() : '';
  // Display label only — capped, never used for authorization, never matched to a roster.
  const relationship = relationshipRaw ? relationshipRaw.slice(0, 40) : null;

  try {
    const link = await requestFamilyFollow({
      orgId: team.orgId,
      repTeamId: team.repTeamId,
      userId: user.id,
      email: user.email,
      relationship,
    });

    // Plant the follow at REQUEST time so the team is already in their Following while
    // they wait. It grants nothing — the family view checks the verified link, not the
    // follow — so a pending request shows a card whose page politely says "waiting".
    try {
      await followEntity({ userId: user.id, entityType: 'rep_team', entityId: team.repTeamId, source: 'manual' });
    } catch (e) {
      console.error('[family-join] follow plant failed (non-fatal):', e);
    }

    return NextResponse.json({ ok: true, status: link.status, teamName: team.teamName });
  } catch (e) {
    if (e instanceof FamilyLinkError) {
      return NextResponse.json({ error: e.code, message: e.message }, { status: 409 });
    }
    throw e;
  }
}, { route: '/api/family/join/[token]' });
