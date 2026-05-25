import { getAuthContextWithScope, unauthorized, forbidden, scopeGuard } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { sendEmail, schedulePublishedHtml, SITE_URL } from '@/lib/email';
import { hasPlanFeature } from '@/lib/plan-features';
import type { OrgPlan } from '@/lib/types';

// POST /api/admin/schedule-publish
// Body: { tournamentId, divisionIds: string[], visibility: 'published_generic' | 'published_teams', notify: boolean }
export async function POST(req: Request) {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithScope({ orgSlug });
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'create_tournaments')) return forbidden();

  try {
    const { tournamentId, divisionIds, visibility, notify } = await req.json() as {
      tournamentId: string;
      divisionIds: string[];
      visibility: 'published_generic' | 'published_teams';
      notify: boolean;
    };

    if (!tournamentId || !divisionIds?.length || !visibility) {
      return Response.json({ error: 'tournamentId, divisionIds, and visibility are required' }, { status: 400 });
    }

    const denied = scopeGuard(ctx, tournamentId);
    if (denied) return denied;

    // Update schedule_visibility for all specified divisions.
    const { error: updateError } = await supabaseAdmin
      .from('divisions')
      .update({ schedule_visibility: visibility })
      .in('id', divisionIds)
      .eq('tournament_id', tournamentId);

    if (updateError) throw updateError;

    if (!notify) {
      return Response.json({ success: true, notified: 0 });
    }

    // Plan gate: require tournament_plus for notifications.
    if (!hasPlanFeature(ctx.org.planId as OrgPlan, 'schedule_notification')) {
      return Response.json({ success: true, notified: 0, notifySkipped: true });
    }

    // Fetch tournament details for the email.
    const { data: tournament } = await supabaseAdmin
      .from('tournaments')
      .select('name, slug')
      .eq('id', tournamentId)
      .single();

    if (!tournament) throw new Error('Tournament not found');

    // Fetch the published division names for the email body.
    const { data: divisionRows } = await supabaseAdmin
      .from('divisions')
      .select('id, name')
      .in('id', divisionIds);

    const divisionNameMap = Object.fromEntries((divisionRows ?? []).map(ag => [ag.id, ag.name]));

    // Fetch accepted teams in the published divisions.
    const { data: teams } = await supabaseAdmin
      .from('teams')
      .select('id, name, coach, email, division_id')
      .eq('tournament_id', tournamentId)
      .in('division_id', divisionIds)
      .eq('status', 'accepted');

    const scheduleUrl = `${SITE_URL}/${ctx.org.slug}/${tournament.slug}/schedule`;
    const contactEmail = ctx.org.contactEmail ?? undefined;
    const showTeamNames = visibility === 'published_teams';

    let notified = 0;
    for (const team of teams ?? []) {
      if (!team.email) continue;
      const divisions = [divisionNameMap[team.division_id] ?? team.division_id];
      const html = schedulePublishedHtml({
        tournamentName: tournament.name,
        coachName: team.coach || team.name,
        divisions,
        showTeamNames,
        scheduleUrl,
        contactEmail,
      });
      await sendEmail(team.email, `Schedule Published — ${tournament.name}`, html);
      notified++;
    }

    return Response.json({ success: true, notified });

  } catch (err: unknown) {
    console.error('[schedule-publish] Error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ error: message }, { status: 500 });
  }
}
