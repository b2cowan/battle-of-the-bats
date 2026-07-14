/**
 * POST /api/consumer/follows/claim
 *
 * Attaches the teams a device already follows (read client-side from localStorage,
 * lib/follow.ts) onto the signed-in account as fan_follows rows (source='device_reconcile').
 * This is the "claim your device follows" step — ONLY ever called from an explicit user
 * action (a pre-checked list they confirm), never silently on login, because a device may
 * be shared (unified-app guardrail: never auto-merge follows on a shared family device).
 *
 * Identity comes from the session (getAuthenticatedUser) — the client says WHICH teams to
 * claim, never WHOSE account to claim them onto.
 *
 * Body: { follows: { teamId, orgSlug, tournamentSlug }[] }
 * Returns: { claimed: string[] }  — teamIds actually recorded (validated + deduped)
 */
import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { followEntity } from '@/lib/fan-follows';
import { withObservability } from '@/lib/observability';
import { teamBelongsToTournament } from '../route';

interface ClaimItem { teamId?: string; orgSlug?: string; tournamentSlug?: string; }

const MAX_CLAIM = 100; // sanity cap — a device won't legitimately follow more than this

export const POST = withObservability(async (req: Request) => {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });

  let body: { follows?: ClaimItem[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const items = Array.isArray(body.follows) ? body.follows.slice(0, MAX_CLAIM) : [];
  const claimed: string[] = [];

  for (const item of items) {
    const { teamId, orgSlug, tournamentSlug } = item;
    if (!teamId || !orgSlug || !tournamentSlug) continue;
    // Validate each team is real before recording — never trust the client's team list blindly.
    const ok = await teamBelongsToTournament(orgSlug, tournamentSlug, teamId).catch(() => false);
    if (!ok) continue;
    try {
      await followEntity({ userId: user.id, entityType: 'team', entityId: teamId, source: 'device_reconcile' });
      claimed.push(teamId);
    } catch {
      // Skip a single bad row (e.g. transient) and keep going — same per-row resilience
      // as the invite reconciler.
    }
  }

  return NextResponse.json({ claimed });
}, { route: '/api/consumer/follows/claim' });
