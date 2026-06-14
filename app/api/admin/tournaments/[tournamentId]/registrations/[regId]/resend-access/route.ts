import { NextRequest, NextResponse } from 'next/server';
import { coachAccessReminderHtml, sendEmail } from '@/lib/email';
import { getAuthContextWithScope, forbidden, scopeGuard, unauthorized } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';

type RouteParams = { params: Promise<{ tournamentId: string; regId: string }> };

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export const POST = withObservability(async (req: NextRequest, { params }: RouteParams) => {
  const orgSlug = req.nextUrl.searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithScope({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_tournaments')) return forbidden();
  if (
    !hasCapability(ctx.role, ctx.capabilities, 'manage_registrations') &&
    !hasCapability(ctx.role, ctx.capabilities, 'create_tournaments')
  ) {
    return forbidden();
  }

  const { tournamentId, regId } = await params;
  const denied = scopeGuard(ctx, tournamentId);
  if (denied) return denied;

  // Fetch the team (registration) and its tournament in parallel
  const [{ data: team, error: teamError }, { data: tournament, error: tournamentError }] = await Promise.all([
    supabaseAdmin
      .from('teams')
      .select('id, name, coach, email, tournament_id')
      .eq('id', regId)
      .maybeSingle(),
    supabaseAdmin
      .from('tournaments')
      .select('id, name, org_id')
      .eq('id', tournamentId)
      .maybeSingle(),
  ]);

  if (teamError) return json({ error: teamError.message }, 500);
  if (tournamentError) return json({ error: tournamentError.message }, 500);
  if (!tournament || tournament.org_id !== ctx.org.id) return forbidden();
  if (!team || team.tournament_id !== tournamentId) {
    return json({ error: 'Registration not found in this tournament.' }, 404);
  }

  const email = (team.email ?? '').trim().toLowerCase();
  if (!email) {
    return json({ error: 'This registration has no email address.' }, 400);
  }

  const origin = req.headers.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL ?? '';
  const joinUrl = `${origin}/coaches/join?registrationId=${encodeURIComponent(regId)}&email=${encodeURIComponent(email)}&next=${encodeURIComponent('/coaches/tournaments')}`;
  const loginUrl = `${origin}/auth/login?next=${encodeURIComponent('/coaches/tournaments')}`;

  try {
    await sendEmail(
      email,
      `Your FieldLogicHQ registration dashboard — ${team.name}`,
      coachAccessReminderHtml({
        teamName: team.name,
        coachName: team.coach ?? '',
        tournamentName: tournament.name,
        joinUrl,
        loginUrl,
      }),
    );
  } catch (err) {
    console.error('[resend-access] email send failed:', err);
    return json({ error: 'Access link email could not be sent. Please try again.' }, 500);
  }

  return json({ ok: true });
}, { route: '/api/admin/tournaments/[tournamentId]/registrations/[regId]/resend-access' });
