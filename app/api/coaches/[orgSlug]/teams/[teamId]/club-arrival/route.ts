import { NextResponse } from 'next/server';
import { resolveCoachTeamRead } from '@/lib/coach-team-read';
import { getEntitledTeamMembership, listActiveStaffUserIds } from '@/lib/coach-membership';
import { getLatestClosedRepProgramYear } from '@/lib/db';
import { loadRosterCounts } from '@/lib/club-team-board';
import { clubSeasonStartedCard, clubWelcomeCard } from '@/lib/club-season-notice';
import { orgManagesOwnSeasons } from '@/lib/season-doors';
import { memberDisplayName } from '@/lib/member-names';
import { normalizeGuardianEmail } from '@/lib/guardian-email';
import { formatStoredDate } from '@/lib/timezone';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE CLUB TEAM'S ONE-TIME OVERVIEW CARDS (Club Tier Stage 2, specimens 4 and 6).
 *
 *   started — "{Club} started the {season}": the first time a coach opens a season the CLUB rolled
 *             into, what actually came with the team. Its facts are read from the SEASON ITSELF
 *             (the roster by the one roster rule, whether a budget plan and a fee plan exist,
 *             whether an opening balance is set) — never assumed, so a roll that left the budget
 *             plan behind says so by leaving it out.
 *   welcome — "Welcome to {team}, {name}": the first days after a coach the club INVITED accepts —
 *             who named them, as what, and that the team is already there.
 * Each is null when it does not apply; the Overview shows at most one (a newcomer is welcomed, not
 * told a season started before they arrived) and dismisses it for good on that device.
 *
 * ⚠ CLUB TEAMS ONLY — a standalone portal's head coach rolls their own season and joins nobody's.
 * ⚠ The team's WORKING season, never a year the caller names (the HISTORY_ENDPOINTS rule); a working
 * season that is closed answers two nulls (the closed-season page carries its own note).
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
const STARTED_FOR_DAYS = 60;
const WELCOME_FOR_DAYS = 30;
const DAY = 86_400_000;

export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachTeamRead(orgSlug, teamId);
  if ('error' in resolved) return resolved.error;
  const { ctx, team, programYear, isReadOnly } = resolved;

  const none = NextResponse.json({ started: null, welcome: null });
  if (isReadOnly || orgManagesOwnSeasons(ctx.org)) return none;

  const membership = await getEntitledTeamMembership(ctx.org, teamId, ctx.user.id);
  if (!membership) return none;
  const now = Date.now();

  // ── welcome: a club invitation this person accepted for this team, recently ──
  const email = normalizeGuardianEmail(ctx.user.email ?? '');
  const { data: invite } = email
    ? await supabaseAdmin
        .from('assistant_invite_tokens')
        .select('coach_role, accepted_at, created_at')
        .eq('team_id', teamId)
        .eq('sent_by', 'club')
        .eq('status', 'accepted')
        // The club's door stores the address lowercased (never an ilike: "_" is a wildcard there).
        .eq('invited_email', email)
        .order('accepted_at', { ascending: false })
        .limit(1)
        .maybeSingle<{ coach_role: 'head_coach' | 'assistant_coach'; accepted_at: string | null; created_at: string }>()
    : { data: null };
  const welcomeDue = !!invite?.accepted_at && now - new Date(invite.accepted_at).getTime() < WELCOME_FOR_DAYS * DAY;

  // ── started: a season the club rolled into while this person was already on the staff ──
  const seasonCreated = new Date(programYear.createdAt).getTime();
  const startedDue = !welcomeDue
    && seasonCreated >= new Date(membership.createdAt).getTime()
    && now - seasonCreated < STARTED_FOR_DAYS * DAY;
  if (!welcomeDue && !startedDue) return none;

  const [rosterCounts, staff] = await Promise.all([
    loadRosterCounts([programYear.id]),
    welcomeDue ? listActiveStaffUserIds(teamId) : Promise.resolve([] as string[]),
  ]);
  const players = rosterCounts.get(programYear.id) ?? 0;

  if (welcomeDue && invite) {
    const name = await memberDisplayName(ctx.org.id, ctx.user.id);
    const card = clubWelcomeCard({
      teamName: team.name,
      firstName: name?.trim().split(/\s+/)[0] || null,
      clubName: ctx.org.name,
      roleWord: invite.coach_role === 'head_coach' ? 'head coach' : 'an assistant coach',
      // "named you … on" is the day the club named them (the invitation), not the day they accepted.
      namedOn: formatStoredDate(invite.created_at, { withYear: false }),
      players,
      otherStaff: staff.filter(id => id !== ctx.user.id).length,
    });
    return NextResponse.json({ started: null, welcome: { key: `club_welcome:${membership.id}`, ...card } });
  }

  // A club's FIRST season carried nothing, so it has nothing to report beyond the bell's own notice.
  const previous = await getLatestClosedRepProgramYear(teamId);
  if (!previous) return none;
  const [budget, fees] = await Promise.all([
    supabaseAdmin.from('rep_budget_lines').select('id', { count: 'exact', head: true }).eq('program_year_id', programYear.id),
    supabaseAdmin.from('rep_player_dues_schedules').select('id', { count: 'exact', head: true }).eq('program_year_id', programYear.id),
  ]);
  const card = clubSeasonStartedCard({
    clubName: ctx.org.name,
    seasonName: programYear.name,
    previousSeasonName: previous.name,
    carried: {
      players,
      budgetPlan: (budget.count ?? 0) > 0,
      feePlan: (fees.count ?? 0) > 0,
      openingBalance: programYear.openingBalance != null,
    },
  });
  return NextResponse.json({ started: { key: `club_started:${programYear.id}`, ...card }, welcome: null });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/club-arrival' });
