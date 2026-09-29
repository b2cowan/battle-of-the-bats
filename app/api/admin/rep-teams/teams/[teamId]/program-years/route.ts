import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getRepProgramYears, createRepProgramYear } from '@/lib/db';
import { projectMembershipsOntoProgramYear } from '@/lib/coach-membership';
import { tellClubTeamStaff } from '@/lib/club-season-notify';
import { resolveClubTeam } from '@/lib/club-team-route';
import { isLiveSeasonStatus } from '@/lib/season-live';
import { withObservability } from '@/lib/observability';

export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ teamId: string }> },) => {
  const { teamId } = await params;
  const resolved = await resolveClubTeam(_req, teamId, { write: false });
  if ('error' in resolved) return resolved.error;
  const { team } = resolved;

  const programYears = await getRepProgramYears(team.id);
  return NextResponse.json({ programYears });
}, { route: '/api/admin/rep-teams/teams/[teamId]/program-years' });

export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ teamId: string }> },) => {
  const { teamId } = await params;
  const resolved = await resolveClubTeam(req, teamId, { write: true });
  if ('error' in resolved) return resolved.error;
  const { ctx, team } = resolved;

  const body = await req.json();
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const year = typeof body.year === 'number' ? Math.floor(body.year) : null;

  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }
  if (!year || year < 2000 || year > 2100) {
    return NextResponse.json({ error: 'year must be a valid calendar year' }, { status: 400 });
  }

  /**
   * ⚖ THE FIRST SEASON ONLY (Club Tier Stage 2, Ask 1 (a), owner 2026-09-28). This door made a
   * BLANK year beside a live one — no roster, budget plan, fee plan, opening balance or player
   * history links — and a Draft made this way became the coach's live season mid-year, emptying
   * their portal. Once a team has any season, the next one comes from Start next season (the roll,
   * `app/api/admin/rep-teams/teams/[teamId]/seasons`), which carries all five.
   */
  const existing = await getRepProgramYears(team.id);
  if (existing.length > 0) {
    return NextResponse.json(
      {
        error: `${team.name} already has a season. Start the next one from the team’s current season, `
          + 'so its roster, budget plan, fee plan and opening balance come with it.',
        code: 'season_exists',
      },
      { status: 409 },
    );
  }

  try {
    // ⚠ LIVE FROM THE START: a season is live when it is draft or active, and "Draft" is no longer a
    // preparation state anywhere a club reads (Ask 1). The first season is created active.
    const programYear = await createRepProgramYear(team.id, ctx!.org.id, {
      name,
      year,
      status: 'active',
      tryoutOpen: body.tryoutOpen === true,
      tryoutDescription: body.tryoutDescription?.trim() || null,
    });
    // M1 (2026-08-16): the new season's staff RECORD is written from the team's memberships the
    // moment the year exists. Before this, a fresh year started with ZERO coach rows and the
    // admin re-added everyone by hand — under the old access model that was also a lock-out
    // window for the whole staff.
    //
    // ⚠ REVERT ON FAILURE, exactly like the rollover path — a draft year counts as LIVE for
    // every coach operation the moment it exists, so a year whose staff projection silently
    // failed would make the team look "between seasons" to its own staff (the ~54 write routes
    // and the live assignments list still read season rows) while memberships insist all is
    // well, and nothing self-heals team-wide. Deleting the year is clean: rows cascade with it.
    try {
      await projectMembershipsOntoProgramYear(team.id, ctx!.org.id, programYear.id);
    } catch (e) {
      console.error('[program-years POST] staff projection failed; deleting the half-created year:', e);
      await supabaseAdmin.from('rep_program_years').delete().eq('id', programYear.id);
      return NextResponse.json(
        { error: 'Could not set up coaching access for the new program year. Nothing was created — please try again.' },
        { status: 500 },
      );
    }
    /* ⚠ THE SECOND CHECK (review 2026-09-28). "No season yet" was read before the insert, so two
       submits at once (a double click, two tabs, two admins) can each create a "first" season in a
       different year — the unique (team, year) key catches only the same year. After the insert the
       team is read again: if an EARLIER-created open season exists, this one withdraws (the later of
       the two always loses, so exactly one survives in every interleaving). */
    try {
      const earlier = (await getRepProgramYears(team.id)).filter(s =>
        s.id !== programYear.id && isLiveSeasonStatus(s.status)
        && (s.createdAt < programYear.createdAt || (s.createdAt === programYear.createdAt && s.id < programYear.id)));
      if (earlier.length > 0) {
        await supabaseAdmin.from('rep_program_years').delete().eq('id', programYear.id);
        return NextResponse.json(
          { error: `${team.name} already has the ${earlier[0].name}. Refresh to see where the team is now.`, code: 'season_exists' },
          { status: 409 },
        );
      }
    } catch (e) {
      console.error('[program-years POST] first-season re-check failed (season kept):', e);
    }

    // The coach is told (a coach invited before the team's first season is already on its staff).
    await tellClubTeamStaff({
      org: ctx!.org, team, actorUserId: ctx!.user.id, action: 'started', seasonName: programYear.name,
    });
    return NextResponse.json({ programYear }, { status: 201 });
  } catch (e: any) {
    if (e?.code === '23505') {
      return NextResponse.json({ error: 'A program year for that calendar year already exists for this team' }, { status: 409 });
    }
    throw e;
  }
}, { route: '/api/admin/rep-teams/teams/[teamId]/program-years' });
