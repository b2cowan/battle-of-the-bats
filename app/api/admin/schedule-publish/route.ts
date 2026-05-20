import { getAuthContextWithScope, unauthorized, forbidden, scopeGuard } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { sendEmail, schedulePublishedHtml, SITE_URL } from '@/lib/email';
import { hasPlanFeature } from '@/lib/plan-features';
import type { OrgPlan } from '@/lib/types';

// POST /api/admin/schedule-publish
// Body: { tournamentId, ageGroupIds: string[], visibility: 'published_generic' | 'published_teams', notify: boolean }
export async function POST(req: Request) {
  const ctx = await getAuthContextWithScope();
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'create_tournaments')) return forbidden();

  try {
    const { tournamentId, ageGroupIds, visibility, notify } = await req.json() as {
      tournamentId: string;
      ageGroupIds: string[];
      visibility: 'published_generic' | 'published_teams';
      notify: boolean;
    };

    if (!tournamentId || !ageGroupIds?.length || !visibility) {
      return Response.json({ error: 'tournamentId, ageGroupIds, and visibility are required' }, { status: 400 });
    }

    const denied = scopeGuard(ctx, tournamentId);
    if (denied) return denied;

    // Update schedule_visibility for all specified age groups.
    const { error: updateError } = await supabaseAdmin
      .from('age_groups')
      .update({ schedule_visibility: visibility })
      .in('id', ageGroupIds)
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

    // Fetch the published age group names for the email body.
    const { data: ageGroupRows } = await supabaseAdmin
      .from('age_groups')
      .select('id, name')
      .in('id', ageGroupIds);

    const ageGroupNameMap = Object.fromEntries((ageGroupRows ?? []).map(ag => [ag.id, ag.name]));

    // Fetch accepted teams in the published age groups.
    const { data: teams } = await supabaseAdmin
      .from('teams')
      .select('id, name, coach, email, age_group_id')
      .eq('tournament_id', tournamentId)
      .in('age_group_id', ageGroupIds)
      .eq('status', 'accepted');

    const scheduleUrl = `${SITE_URL}/${ctx.org.slug}/${tournament.slug}/schedule`;
    const contactEmail = ctx.org.contactEmail ?? undefined;
    const showTeamNames = visibility === 'published_teams';

    let notified = 0;
    for (const team of teams ?? []) {
      if (!team.email) continue;
      const divisions = [ageGroupNameMap[team.age_group_id] ?? team.age_group_id];
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
