import { NextResponse } from 'next/server';
import { denyUnless, canManageSchedule } from '@/lib/coach-capabilities';
import { resolveFamilyCoachContext } from '@/lib/family-coach-route';
import { withObservability } from '@/lib/observability';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { resolveTrustedAppOrigin } from '@/lib/app-origin';
import { getTeamFamilyAccess } from '@/lib/family-access';

/**
 * "Share game link" — the coach's one deliberate act that brings a single game's public
 * page into existence (owner ruling #16).
 *
 * POST shares, DELETE un-shares. Practices are refused: a standing weekly practice
 * location is exactly the thing ruling #16 reserved for the Public-link setting, not
 * something a per-game share should be able to publish sideways.
 *
 * ⚠ LIVE SEASON ONLY — never joins the season-read rail.
 */


/** The event must belong to this team AND be a game. */
async function loadShareableEvent(teamId: string, eventId: string) {
  const { data, error } = await supabaseAdmin
    .from('rep_team_events')
    .select('id, team_id, event_type, family_shared_at')
    .eq('id', eventId)
    .eq('team_id', teamId)
    .maybeSingle();
  if (error) throw error;
  return data as { id: string; event_type: string; family_shared_at: string | null } | null;
}

export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; eventId: string }> },) => {
  const { orgSlug, teamId, eventId } = await params;
  const resolved = await resolveFamilyCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, team, assignment } = resolved;

  // Sharing is a schedule act, so it rides the schedule capability rather than the
  // guardian-contacts one — an assistant who runs the schedule can share a game without
  // being trusted with family contact details.
  const denied = denyUnless(canManageSchedule(assignment.capabilities), 'Only coaches who manage the schedule can share a game.');
  if (denied) return denied;

  const event = await loadShareableEvent(teamId, eventId);
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (event.event_type === 'practice') {
    return NextResponse.json({
      error: 'practice_not_shareable',
      message: 'Practices aren’t shared individually. Set Schedule visibility to Public link to publish the whole schedule.',
    }, { status: 400 });
  }

  const access = await getTeamFamilyAccess(teamId);
  if (access?.scheduleVisibility === 'staff') {
    return NextResponse.json({
      error: 'visibility_staff_only',
      message: 'Schedule visibility is set to Staff only, so a shared game page wouldn’t open for anyone. Change it to Families or Public link first.',
    }, { status: 409 });
  }

  const { error } = await supabaseAdmin
    .from('rep_team_events')
    .update({
      family_shared_at: event.family_shared_at ?? new Date().toISOString(),
      family_shared_by: ctx.user.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', eventId)
    .eq('team_id', teamId);
  if (error) throw error;

  const origin = resolveTrustedAppOrigin(req);
  return NextResponse.json({ ok: true, url: `${origin}/${orgSlug}/teams/${team.slug}/games/${eventId}` });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/events/[eventId]/share' });

/** Stop sharing. The page stops existing immediately — the link a family bookmarked 404s,
 *  which is the honest meaning of un-sharing. */
export const DELETE = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; eventId: string }> },) => {
  const { orgSlug, teamId, eventId } = await params;
  const resolved = await resolveFamilyCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { assignment } = resolved;

  const denied = denyUnless(canManageSchedule(assignment.capabilities), 'Only coaches who manage the schedule can share a game.');
  if (denied) return denied;

  const { error } = await supabaseAdmin
    .from('rep_team_events')
    .update({ family_shared_at: null, family_shared_by: null, updated_at: new Date().toISOString() })
    .eq('id', eventId)
    .eq('team_id', teamId);
  if (error) throw error;

  return NextResponse.json({ ok: true });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/events/[eventId]/share' });
