import { NextRequest, NextResponse } from 'next/server';
import { coachAccessReminderHtml, sendEmail } from '@/lib/email';
import { getAuthContextWithScope, forbidden, scopeGuard, unauthorized } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasPlanFeature } from '@/lib/plan-features';
import { resolveTournamentChatParticipants } from '@/lib/chat-resolvers';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';

/**
 * One-click "remind coaches to sign up" from the tournament dashboard's Chat Adoption panel.
 *
 * Batches the SAME access-link email the single-team `resend-access` route already sends, over every
 * "Not yet joined" team that has a contact email (i.e. no coach has claimed their portal yet — the
 * prerequisite for Tournament Chat). Reuses the canonical participant resolver so the target set
 * matches the panel's own "not yet joined" count exactly. Guarded to Tournament Plus+ (the only tiers
 * that have a chat room to fill) as defense-in-depth behind the panel's own gating.
 */

type RouteParams = { params: Promise<{ tournamentId: string }> };

// Safety ceiling — a tournament this large is unusual; keeps a single click from firing an unbounded
// blast. Anything beyond this is skipped (reported back), never silently dropped.
const MAX_REMINDERS = 500;

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
  // Only tiers that actually have a chat room to fill can send the chat-adoption nudge.
  if (!hasPlanFeature(ctx.org.planId, 'tournament_chat')) return forbidden();

  const { tournamentId } = await params;
  const denied = scopeGuard(ctx, tournamentId);
  if (denied) return denied;

  const { data: tournament, error: tournamentError } = await supabaseAdmin
    .from('tournaments')
    .select('id, name, org_id')
    .eq('id', tournamentId)
    .maybeSingle<{ id: string; name: string; org_id: string }>();
  if (tournamentError) return json({ error: tournamentError.message }, 500);
  if (!tournament || tournament.org_id !== ctx.org.id) return forbidden();

  // "Not yet joined" teams (no coach with a completed login) — the same set the panel shows.
  let pending;
  try {
    ({ pending } = await resolveTournamentChatParticipants(tournamentId));
  } catch (err) {
    console.error('[chat/remind-signups] participant resolve failed:', err);
    return json({ error: 'Could not work out which teams to remind. Please try again.' }, 500);
  }

  const remindable = pending.filter(p => (p.email ?? '').trim() !== '');
  const skippedNoEmail = pending.length - remindable.length;
  const targets = remindable.slice(0, MAX_REMINDERS);
  const skippedOverCap = remindable.length - targets.length;

  if (targets.length === 0) {
    return json({ ok: true, sent: 0, failed: 0, skippedNoEmail, skippedOverCap, notJoined: pending.length });
  }

  const origin = req.headers.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL ?? '';
  const loginUrl = `${origin}/auth/login?next=${encodeURIComponent('/coaches/tournaments')}`;

  const results = await Promise.allSettled(targets.map(async (team) => {
    const email = (team.email ?? '').trim().toLowerCase();
    const joinUrl = `${origin}/coaches/join?registrationId=${encodeURIComponent(team.teamId)}&email=${encodeURIComponent(email)}&next=${encodeURIComponent('/coaches/tournaments')}`;
    await sendEmail(
      email,
      `Your FieldLogicHQ registration dashboard — ${team.teamName}`,
      coachAccessReminderHtml({
        teamName: team.teamName,
        coachName: team.coachName ?? '',
        tournamentName: tournament.name,
        joinUrl,
        loginUrl,
      }),
    );
  }));

  const sent = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.length - sent;
  if (failed > 0) {
    console.error(`[chat/remind-signups] ${failed}/${results.length} reminder emails failed for tournament ${tournamentId}`);
  }

  return json({ ok: true, sent, failed, skippedNoEmail, skippedOverCap, notJoined: pending.length });
}, { route: '/api/admin/tournaments/[tournamentId]/chat/remind-signups' });
