import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { isPlatformAdminEmail } from '@/lib/platform-auth';
import {
  getBasicCoachTeamsForUser,
  getCoachTeamContextsForUser,
  getPendingTournamentRegistrationForUser,
  linkTournamentRegistrationToBasicCoachTeam,
  canUserAccessTournamentRegistration,
} from '@/lib/basic-coach-teams';
import { withObservability } from '@/lib/observability';
import { excludeActivePremiumUpgrades } from '@/lib/coach-team-page';

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

async function requireCoachUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id || !user.email) return null;
  // FieldLogicHQ staff are NOT coaches. Never expose a platform-admin session as a
  // coach identity: this endpoint feeds the public register form's email prefill, the
  // portal shell, and the join flow — a staff email must not leak into any of them.
  if (await isPlatformAdminEmail(user.email)) return null;
  // Account name (post name-parity) — the register form prefills/locks the registrant's
  // First/Last from this so a logged-in coach registers as themselves.
  const md = (user.user_metadata ?? {}) as Record<string, unknown>;
  const pick = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : '');
  let firstName = pick(md.first_name);
  let lastName = pick(md.last_name);
  const name = pick(md.full_name) || pick(md.display_name) || `${firstName} ${lastName}`.trim();
  // Legacy/partial metadata may carry only a full name — split it so callers always get
  // first/last components (first token = first name, remainder = last name). Prevents a
  // register-form lock+empty deadlock for full_name-only accounts.
  if (!firstName && !lastName && name) {
    const parts = name.split(/\s+/).filter(Boolean);
    firstName = parts[0] ?? '';
    lastName = parts.slice(1).join(' ');
  }
  return { id: user.id, email: user.email, firstName, lastName, name };
}

export const GET = withObservability(async (req: NextRequest) => {
  try {
    const user = await requireCoachUser();
    if (!user) return json({ error: 'Sign in required.' }, 401);

    const url = new URL(req.url);
    const registrationId = url.searchParams.get('registrationId');
    // The team-scoped shell passes ?context=1 for the richer per-team context (lifecycle
    // chip, activated features, registration ids). The register-prefill / join callers omit
    // it and don't pay for the extra tournament-dates lookup.
    const wantContext = url.searchParams.get('context') === '1';

    const [teams, teamContexts, pendingRegistration, access] = await Promise.all([
      getBasicCoachTeamsForUser(user.id),
      wantContext
        ? getCoachTeamContextsForUser({ userId: user.id, email: user.email })
        : Promise.resolve(null),
      registrationId
        ? getPendingTournamentRegistrationForUser(user.id, user.email, registrationId)
        : Promise.resolve(null),
      registrationId
        ? canUserAccessTournamentRegistration({ userId: user.id, email: user.email, registrationId })
        : Promise.resolve(null),
    ]);

    // Which of these teams are the free-team SHADOW of a LIVE paid portal (mig 297 / Part C of
    // "your team in your own tournament"). The public register form's picker labels them so a
    // Premium coach recognizes their portal team rather than minting a stray free one; a canceled
    // portal's team is an ordinary free team again and is not labelled.
    // Fails soft: a label is a nicety; the team list is what the register form and join page need.
    let portalTeamIds: string[] = [];
    try {
      const freeOnly = new Set((await excludeActivePremiumUpgrades(teams)).map(t => t.id));
      portalTeamIds = teams.filter(t => !freeOnly.has(t.id)).map(t => t.id);
    } catch (err) {
      console.error('[coaches basic-teams GET] portal-team labels unavailable (non-fatal):', err);
    }

    return json({
      user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, name: user.name },
      teams,
      portalTeamIds,
      ...(wantContext ? { teamContexts } : {}),
      pendingRegistration,
      // Already linked to this account → the join page skips the "choose team" interstitial.
      alreadyLinked: Boolean(access),
    });
  } catch (error) {
    console.error('[coaches basic-teams GET] error:', error);
    return json({ error: 'Could not load coach teams.' }, 500);
  }
}, { route: '/api/coaches/basic-teams' });

export const POST = withObservability(async (req: NextRequest) => {
  try {
    const user = await requireCoachUser();
    if (!user) return json({ error: 'Sign in required.' }, 401);

    const body = await req.json().catch(() => ({})) as {
      registrationId?: unknown;
      basicCoachTeamId?: unknown;
    };

    const registrationId = typeof body.registrationId === 'string' ? body.registrationId.trim() : '';
    const basicCoachTeamId = typeof body.basicCoachTeamId === 'string' && body.basicCoachTeamId.trim()
      ? body.basicCoachTeamId.trim()
      : null;

    if (!registrationId) {
      return json({ error: 'Registration is required.' }, 400);
    }

    const result = await linkTournamentRegistrationToBasicCoachTeam({
      userId: user.id,
      userEmail: user.email,
      registrationId,
      basicCoachTeamId,
      linkSource: 'registration_flow',
    });

    return json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not link registration.';
    const status = message.includes('already been claimed')
      ? 409
      : message.includes('not linked')
        ? 403
        : 500;
    console.error('[coaches basic-teams POST] error:', error);
    return json({ error: message }, status);
  }
}, { route: '/api/coaches/basic-teams' });
