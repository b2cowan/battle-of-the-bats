import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import { getCoachingAssignmentsForUser, getRepTeam, getActiveRepProgramYear } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { canWriteMoney, denyUnless } from '@/lib/coach-capabilities';
import { loadSeasonSettlement } from '@/lib/coach-season-settlement';
import { tournamentToday } from '@/lib/timezone';

/**
 * What one family takes from the season's surplus (owner Call 10) — and the one act next to it
 * that is NOT an adjustment at all: forgiving a balance.
 *
 * ⚠ FORGIVENESS IS A CREDIT, not a row in the adjustments table. It genuinely reduces what a
 * family owes, which is precisely what a credit does, so it reuses the one credit mechanism
 * (credit_type 'forgiven', mig 233) and is excluded from owed-back by type. It is granted HERE
 * because this is the screen where a coach decides it; the manual Add-credit picker deliberately
 * does not offer the type, so every forgiveness has one door and one story.
 *
 * ⚠ THE FORGIVEN AMOUNT IS DERIVED, NEVER TYPED. It is exactly what the family still has to send
 * at the moment of the click, read from the shared settlement (which reads the shared credit
 * model). A client-supplied figure could forgive more than is owed — inventing relief the team
 * never gave — and would then count as that family's share, already received.
 *
 * ⚠ ACTIVE YEAR ONLY. There is no season parameter here and there must not be one: an archived
 * season is a record.
 */

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

const KINDS = ['even', 'fixed', 'no_share', 'forgive', 'unforgive'] as const;
type Kind = typeof KINDS[number];

// POST /api/coaches/[orgSlug]/teams/[teamId]/season-surplus/adjustments
export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, team, assignment, programYear } = resolved;
  const denied = denyUnless(canWriteMoney(assignment.capabilities), 'You do not have permission to change team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  const body = await req.json();
  const { playerId, kind, amount = 0, note = null } = body as
    { playerId?: string; kind?: Kind; amount?: number; note?: string | null };

  if (!playerId || typeof playerId !== 'string') {
    return NextResponse.json({ error: 'playerId is required' }, { status: 400 });
  }
  if (!kind || !KINDS.includes(kind)) {
    return NextResponse.json({ error: 'Invalid choice' }, { status: 400 });
  }
  if (kind === 'fixed' && (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0 || amount > 9999999.99)) {
    return NextResponse.json({ error: 'Enter an amount for this family (0 or more).' }, { status: 400 });
  }

  // Tenancy: the player must be on THIS season's roster.
  const { data: playerRow } = await supabaseAdmin
    .from('rep_roster_players')
    .select('id, player_first_name, player_last_name')
    .eq('id', playerId)
    .eq('program_year_id', programYear.id)
    .maybeSingle();
  if (!playerRow) {
    return NextResponse.json({ error: 'Player not found in this season' }, { status: 404 });
  }

  const noteText = typeof note === 'string' && note.trim() ? note.trim() : null;

  if (kind === 'even') {
    // An even share is the default and needs no record — a stored default is a fact that can go
    // stale against a rule that later changes.
    const { error } = await supabaseAdmin
      .from('rep_season_refund_adjustments')
      .delete()
      .eq('program_year_id', programYear.id)
      .eq('player_id', playerId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else if (kind === 'fixed' || kind === 'no_share') {
    const { error } = await supabaseAdmin
      .from('rep_season_refund_adjustments')
      .upsert({
        program_year_id: programYear.id,
        player_id:       playerId,
        org_id:          team.orgId,
        team_id:         team.id,
        kind,
        amount:          kind === 'fixed' ? Math.round((amount ?? 0) * 100) / 100 : 0,
        note:            noteText,
        created_by:      ctx.user.id,
        updated_at:      new Date().toISOString(),
      }, { onConflict: 'program_year_id,player_id' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else if (kind === 'forgive') {
    const sheet = await loadSeasonSettlement({ programYear, capabilities: assignment.capabilities });
    const row = sheet.rows.find(r => r.playerId === playerId);
    const owing = row?.leftToSend ?? 0;
    if (owing <= 0.005) {
      return NextResponse.json({ error: 'This family has nothing left to send — there is no balance to forgive.' }, { status: 409 });
    }
    const { error } = await supabaseAdmin
      .from('rep_dues_credits')
      .insert({
        program_year_id: programYear.id,
        player_id:       playerId,
        amount:          Math.round(owing * 100) / 100,
        description:     'Balance forgiven',
        credit_type:     'forgiven',
        credit_date:     tournamentToday(),
        notes:           noteText,
        created_by:      ctx.user.id,
      });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // ⚠ ONE FORGIVENESS PER FAMILY PER SEASON, re-checked AFTER the write. `owing` was read before
    // the insert, so two clicks land two full-balance credits against the same debt. The extra one
    // is harmless to the arithmetic (a forgiveness larger than the debt evaporates — the credit
    // model clamps it), but it is a permanent duplicate in a family's money record, and this was
    // the one write in this feature without the post-write re-check its siblings all carry. The
    // loser deletes ITSELF, keeping the earliest.
    const { data: forgiven } = await supabaseAdmin
      .from('rep_dues_credits')
      .select('id, created_at')
      .eq('program_year_id', programYear.id)
      .eq('player_id', playerId)
      .eq('credit_type', 'forgiven')
      .order('created_at');
    const extras = (forgiven ?? []).slice(1);
    if (extras.length > 0) {
      await supabaseAdmin.from('rep_dues_credits').delete().in('id', extras.map(c => c.id));
    }
  } else {
    // Undo: remove only the forgiveness this screen granted. ⚠ Scoped to credit_type 'forgiven'
    // so an undo can never delete a family's earned rebate.
    const { error } = await supabaseAdmin
      .from('rep_dues_credits')
      .delete()
      .eq('program_year_id', programYear.id)
      .eq('player_id', playerId)
      .eq('credit_type', 'forgiven');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(await loadSeasonSettlement({ programYear, capabilities: assignment.capabilities }));
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/season-surplus/adjustments' });
