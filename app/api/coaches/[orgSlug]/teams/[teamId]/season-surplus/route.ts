import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import { getCoachingAssignmentsForUser, getRepTeam, getActiveRepProgramYear } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { canViewMoney, canWriteMoney, denyUnless } from '@/lib/coach-capabilities';
import { loadSeasonSettlement } from '@/lib/coach-season-settlement';
import { resolveCoachSeasonRead } from '@/lib/coach-season-read';
import { fmt } from '@/lib/coach-money-summary';

/**
 * The season settlement sheet.
 *
 * ⚠ NOTHING HERE COMPUTES ANYTHING. Every figure comes from `loadSeasonSettlement`, which is
 * also what the payout writes are refused against — so the ceiling and the number on screen can
 * never be two different opinions. The route that stood here before Pass 3 hand-assembled its
 * own breakdown and was, twice, the place the money went wrong.
 *
 * ⚠ The typed pot is GONE. Its column survives in the table as legacy history, read by nothing
 * (pinned by the definition guard); the only thing a coach may write here is the hold-back and
 * a note.
 */

// ⚠ WRITES RESOLVE THE ACTIVE YEAR ONLY (plan §10). Money moves; an archived season renders this
// sheet as a record, with no hold-back field, no row menu and no payout controls.
async function resolveCoachContext(orgSlug: string, teamId: string) {
  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return { error: unauthorized() };
  if (ctx.org.slug !== orgSlug) return { error: forbidden() };

  const team = await getRepTeam(teamId);
  if (!team || team.orgId !== ctx.org.id) {
    return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  }

  const assignments = await getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id);
  const assignment = assignments.find(a => a.teamId === teamId);
  if (!assignment) return { error: forbidden() };

  const programYear = await getActiveRepProgramYear(teamId);
  if (!programYear) {
    return { error: NextResponse.json({ error: 'No active program year' }, { status: 404 }) };
  }

  return { ctx, team, assignment, programYear };
}

// GET /api/coaches/[orgSlug]/teams/[teamId]/season-surplus
export const GET = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachSeasonRead(orgSlug, teamId, req);
  if ('error' in resolved) return resolved.error;
  const { capabilities, programYear, isReadOnly } = resolved;
  const denied = denyUnless(canViewMoney(capabilities), 'You do not have access to team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  const sheet = await loadSeasonSettlement({ programYear, capabilities });
  return NextResponse.json({ ...sheet, readOnly: isReadOnly });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/season-surplus' });

// PUT /api/coaches/[orgSlug]/teams/[teamId]/season-surplus — the hold-back, and a note.
export const PUT = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, assignment, programYear } = resolved;
  const denied = denyUnless(canWriteMoney(assignment.capabilities), 'You do not have access to team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  const body = await req.json();
  const { holdBackAmount = 0, notes = null } = body;

  if (typeof holdBackAmount !== 'number' || !Number.isFinite(holdBackAmount) || holdBackAmount < 0) {
    return NextResponse.json({ error: 'Enter an amount to hold back (0 or more).' }, { status: 400 });
  }
  if (holdBackAmount > 9999999.99) {
    return NextResponse.json({ error: 'That is more than this team could hold back.' }, { status: 400 });
  }

  // ⚠ THE CAP IS THE SURPLUS, and it is checked HERE rather than trusted from the browser: a
  // coach may not hold back money the team owes families. The reader clamps too — this refusal
  // exists so the coach is told, rather than silently given a smaller hold-back than they typed.
  const sheet = await loadSeasonSettlement({ programYear, capabilities: assignment.capabilities });
  if (Math.round(holdBackAmount * 100) > Math.round(sheet.pot.holdBackCap * 100)) {
    return NextResponse.json({
      // Same formatter the screen uses — a refusal that spells money differently from the card
      // it refused against reads like a different system talking.
      error: sheet.pot.holdBackCap > 0.005
        ? `You can hold back at most ${fmt(sheet.pot.holdBackCap)} — the rest is money the team owes families.`
        : 'There is no surplus to hold back — every dollar the team is holding is owed to families.',
      code: 'HOLD_BACK_EXCEEDS_SURPLUS',
      holdBackCap: sheet.pot.holdBackCap,
    }, { status: 409 });
  }

  const { error } = await supabaseAdmin
    .from('rep_season_surplus')
    .upsert(
      {
        program_year_id:  programYear.id,
        hold_back_amount: Math.round(holdBackAmount * 100) / 100,
        notes:            typeof notes === 'string' ? (notes.trim() || null) : null,
        created_by:       ctx.user.id,
        updated_at:       new Date().toISOString(),
      },
      { onConflict: 'program_year_id' },
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(await loadSeasonSettlement({ programYear, capabilities: assignment.capabilities }));
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/season-surplus' });
