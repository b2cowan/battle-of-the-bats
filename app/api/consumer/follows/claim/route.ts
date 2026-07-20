/**
 * POST /api/consumer/follows/claim
 *
 * Attaches the follows a device already holds (read client-side from localStorage,
 * lib/follow.ts) onto the signed-in account as fan_follows rows (source='device_reconcile').
 * This is the "claim your device follows" step — ONLY ever called from an explicit user
 * action (a pre-checked list they confirm), never silently on login, because a device may
 * be shared (unified-app guardrail: never auto-merge follows on a shared family device).
 *
 * Identity comes from the session (getAuthenticatedUser) — the client says WHICH follows to
 * claim, never WHOSE account to claim them onto. Phase 6 extends this to all three follow
 * types; each is validated through its own eligibility gate before recording.
 *
 * Body: {
 *   follows?:     { teamId, orgSlug, tournamentSlug }[],
 *   tournaments?: { orgSlug, tournamentSlug }[],
 *   orgs?:        { orgSlug }[],
 * }
 * Returns: { claimed, claimedTournaments, claimedOrgs } — the ids actually recorded.
 */
import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { followEntity, teamBelongsToTournament, resolveFollowableTournament } from '@/lib/fan-follows';
import { resolveFollowableOrgBySlug } from '@/lib/directory';
import { withObservability } from '@/lib/observability';

interface TeamClaimItem { teamId?: string; orgSlug?: string; tournamentSlug?: string; }
interface TournamentClaimItem { orgSlug?: string; tournamentSlug?: string; }
interface OrgClaimItem { orgSlug?: string; }

const MAX_CLAIM = 100; // sanity cap per type — a device won't legitimately follow more than this

export const POST = withObservability(async (req: Request) => {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });

  let body: { follows?: TeamClaimItem[]; tournaments?: TournamentClaimItem[]; orgs?: OrgClaimItem[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const teamItems = Array.isArray(body.follows) ? body.follows.slice(0, MAX_CLAIM) : [];
  const tournItems = Array.isArray(body.tournaments) ? body.tournaments.slice(0, MAX_CLAIM) : [];
  const orgItems = Array.isArray(body.orgs) ? body.orgs.slice(0, MAX_CLAIM) : [];

  const claimed: string[] = [];
  const claimedTournaments: string[] = [];
  const claimedOrgs: string[] = [];

  // Per-row resilience throughout (skip a single bad/transient row, keep going) — same posture
  // as the invite reconciler. Every target is validated before recording: never trust the client's list.
  for (const { teamId, orgSlug, tournamentSlug } of teamItems) {
    if (!teamId || !orgSlug || !tournamentSlug) continue;
    const ok = await teamBelongsToTournament(orgSlug, tournamentSlug, teamId).catch(() => false);
    if (!ok) continue;
    try {
      await followEntity({ userId: user.id, entityType: 'team', entityId: teamId, source: 'device_reconcile' });
      claimed.push(teamId);
    } catch { /* skip */ }
  }

  for (const { orgSlug, tournamentSlug } of tournItems) {
    if (!orgSlug || !tournamentSlug) continue;
    const t = await resolveFollowableTournament(orgSlug, tournamentSlug).catch(() => null);
    if (!t) continue;
    try {
      await followEntity({ userId: user.id, entityType: 'tournament', entityId: t.id, source: 'device_reconcile' });
      claimedTournaments.push(t.id);
    } catch { /* skip */ }
  }

  for (const { orgSlug } of orgItems) {
    if (!orgSlug) continue;
    const org = await resolveFollowableOrgBySlug(orgSlug).catch(() => null);
    if (!org) continue;
    try {
      await followEntity({ userId: user.id, entityType: 'org', entityId: org.id, source: 'device_reconcile' });
      claimedOrgs.push(org.id);
    } catch { /* skip */ }
  }

  return NextResponse.json({ claimed, claimedTournaments, claimedOrgs });
}, { route: '/api/consumer/follows/claim' });
