import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { updateRepTeam, getRepProgramYears, getNonArchivedRepTeamCount, resolveCoachUserIdentities } from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { teamLimitRefusal } from '@/lib/team-cap';
import { loadClubBoard, loadRosterCounts, loadSeasonRecords, seasonShape } from '@/lib/club-team-board';
import { resolveClubTeam } from '@/lib/club-team-route';
import { canOpenModule } from '@/lib/member-access';
import { withTheClub } from '@/lib/club-money-reads';

export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ teamId: string }> },) => {
  const { teamId } = await params;
  const resolved = await resolveClubTeam(_req, teamId, { write: false });
  if ('error' in resolved) return resolved.error;
  const { ctx, team } = resolved;

  const programYears = await getRepProgramYears(team.id);
  const yearIds = programYears.map(py => py.id);

  // `?light=1` — the team and its seasons only, for the team's sub-pages (Roster, Schedule), which
  // need its name and its live season and none of the board's reads.
  if (new URL(_req.url).searchParams.get('light') === '1') {
    return NextResponse.json({ team: { ...team, pdfLook: undefined }, programYears });
  }

  /* ⚖ "WITH THE CLUB" (Club Tier Stage 3a, Ask 2's other half): for someone who can open Accounting,
     what this team owes the club, its next due, and whether a request waits — opening the team's
     account in Accounting. The club's own records only; the team's cash is the coaches' (D1). Null
     for a member without Accounting (the section is not drawn). A failed read never fails the page.
     Started here so it runs beside the board's reads. */
  const withClubRead = canOpenModule(ctx!, ctx!.org, 'module_accounting')
    ? withTheClub(ctx!.org.id, team.id).catch(e => {
        console.error('[rep-teams team GET] with-the-club read failed:', e);
        return null;
      })
    : Promise.resolve(null);

  /**
   * THE TEAM PAGE'S READ (Club Tier Stage 2, B09 / specimen 2): the board's row for this team, plus
   * every season with its record, players and head coach(es) — by the SAME two rules the board uses
   * (`lib/team-season-figures.ts`). A season's head coach is read from that season's own staff
   * record (`rep_team_coaches`), which is the record of who coached it; the team's CURRENT head
   * coach is the board row's (memberships).
   */
  const [rosterCounts, records, seasonStaff] = await Promise.all([
    loadRosterCounts(yearIds),
    loadSeasonRecords(yearIds),
    yearIds.length === 0
      ? Promise.resolve({ data: [] as { program_year_id: string; user_id: string; coach_role: string }[], error: null })
      : supabaseAdmin
          .from('rep_team_coaches')
          .select('program_year_id, user_id, coach_role')
          .in('program_year_id', yearIds),
  ]);
  if (seasonStaff.error) throw seasonStaff.error;
  // The board row reuses what was just read — every season, its roster count and its record.
  const board = await loadClubBoard(ctx!.org.id, [team], {
    seasonsByTeam: new Map([[team.id, programYears.map(py => ({
      id: py.id, team_id: py.teamId, name: py.name, year: py.year, status: py.status, created_at: py.createdAt,
    }))]]),
    rosterCounts,
    records,
  });
  const staffRows = (seasonStaff.data ?? []) as { program_year_id: string; user_id: string; coach_role: string }[];
  const headIds = [...new Set(staffRows.filter(r => r.coach_role === 'head_coach').map(r => r.user_id))];
  const identities = await resolveCoachUserIdentities(ctx!.org.id, headIds);

  const yearsWithCounts = programYears.map(py => ({
    ...py,
    rosterCount: rosterCounts.get(py.id) ?? 0,
    coachCount: staffRows.filter(r => r.program_year_id === py.id).length,
  }));
  const seasons = programYears.map(py => ({
    ...seasonShape({ id: py.id, team_id: py.teamId, name: py.name, year: py.year, status: py.status, created_at: py.createdAt }, records.get(py.id)),
    rosterCount: rosterCounts.get(py.id) ?? 0,
    headCoaches: staffRows
      .filter(r => r.program_year_id === py.id && r.coach_role === 'head_coach')
      .map(r => ({ userId: r.user_id, name: identities.get(r.user_id)?.displayName ?? null })),
  }));

  const withClub = await withClubRead;

  // pdfLook (a base64 crest) is coach-portal data nothing on this screen reads — stripped.
  const teamJson = { ...team, pdfLook: undefined };
  return NextResponse.json({ team: teamJson, programYears: yearsWithCounts, board: board.get(team.id), seasons, withTheClub: withClub });
}, { route: '/api/admin/rep-teams/teams/[teamId]' });

export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ teamId: string }> },) => {
  const { teamId } = await params;
  const resolved = await resolveClubTeam(req, teamId, { write: true });
  if ('error' in resolved) return resolved.error;
  const { ctx, team } = resolved;

  const body = await req.json();
  const fields: Parameters<typeof updateRepTeam>[1] = {};
  if (typeof body.name === 'string') {
    const name = body.name.trim();
    if (!name || name.length > 100) {
      return NextResponse.json({ error: 'A team name is required (100 characters or fewer).' }, { status: 400 });
    }
    fields.name = name;
  }
  /**
   * THE TEAM'S GROUP (Club Tier Stage 2, B09) — the hub said "assign from the edit form" and this save
   * ignored it, so a team's group could never change. Validated to THIS org (a group id from another
   * club is refused, never written), and a member limited to team groups can move a team only into a
   * group they hold — never to Ungrouped or to a group they cannot see, which would lose the team
   * from their own view.
   */
  if ('groupId' in body) {
    const groupId = body.groupId === null || body.groupId === '' ? null
      : typeof body.groupId === 'string' ? body.groupId : undefined;
    if (groupId === undefined) {
      return NextResponse.json({ error: 'Choose a team group, or none.' }, { status: 400 });
    }
    if (groupId) {
      const { data: group, error: groupError } = await supabaseAdmin
        .from('rep_team_groups').select('id').eq('id', groupId).eq('org_id', ctx!.org.id).maybeSingle();
      if (groupError) throw groupError;
      if (!group) {
        return NextResponse.json({ error: 'That team group isn’t one of this club’s.', code: 'group_not_found' }, { status: 400 });
      }
    }
    if (ctx!.repGroupIds && (!groupId || !ctx!.repGroupIds.includes(groupId))) {
      return NextResponse.json(
        { error: 'You can move a team only into a team group you manage.', code: 'group_out_of_scope' },
        { status: 403 },
      );
    }
    fields.groupId = groupId;
  }
  if (typeof body.sport === 'string') fields.sport = body.sport.trim();
  if ('division' in body) fields.division = body.division?.trim() || null;
  if ('description' in body) fields.description = body.description?.trim() || null;
  if ('color' in body) fields.color = body.color?.trim() || null;
  if (typeof body.isArchived === 'boolean') fields.isArchived = body.isArchived;

  // Capacity enforcement (Club Repackaging): un-archiving returns a team to the org's active
  // (counted) set, so it must respect the plan team cap exactly like create/adopt do. Only the
  // archived→active transition can push a club over; archiving or other field edits are unaffected.
  if (body.isArchived === false && team.isArchived) {
    const cap = ctx!.org.teamLimit;
    if (cap < 9999) {
      const currentCount = await getNonArchivedRepTeamCount(ctx!.org.id);
      if (currentCount >= cap) {
        // Structured next step (Stage 1b): the screen offers the move up in place, or "contact us".
        return teamLimitRefusal(ctx!.org.planId, cap, currentCount);
      }
    }
  }

  const updated = await updateRepTeam(teamId, fields);
  // pdfLook (a base64 crest) is coach-portal data nothing on this screen reads — stripped.
  return NextResponse.json({ team: { ...updated, pdfLook: undefined } });
}, { route: '/api/admin/rep-teams/teams/[teamId]' });
