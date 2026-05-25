import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import {
  getBasicCoachTeamsForUser,
  getPendingTournamentRegistrationForUser,
  linkTournamentRegistrationToBasicCoachTeam,
} from '@/lib/basic-coach-teams';

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

async function requireCoachUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id || !user.email) return null;
  return { id: user.id, email: user.email };
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireCoachUser();
    if (!user) return json({ error: 'Sign in required.' }, 401);

    const url = new URL(req.url);
    const registrationId = url.searchParams.get('registrationId');

    const [teams, pendingRegistration] = await Promise.all([
      getBasicCoachTeamsForUser(user.id),
      registrationId
        ? getPendingTournamentRegistrationForUser(user.id, user.email, registrationId)
        : Promise.resolve(null),
    ]);

    return json({
      user: { id: user.id, email: user.email },
      teams,
      pendingRegistration,
    });
  } catch (error) {
    console.error('[coaches basic-teams GET] error:', error);
    return json({ error: 'Could not load coach teams.' }, 500);
  }
}

export async function POST(req: NextRequest) {
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
    const status = message.includes('not linked') || message.includes('not linked to your coach account')
      ? 403
      : 500;
    console.error('[coaches basic-teams POST] error:', error);
    return json({ error: message }, status);
  }
}
