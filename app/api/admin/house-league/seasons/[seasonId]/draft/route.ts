import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { getLeagueSeasonById, getRegistrationsForDivision, bulkAssignTeams } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type { LeagueDraftState } from '@/lib/types';
import { withObservability } from '@/lib/observability';

function gate(ctx: Awaited<ReturnType<typeof getAuthContextWithRole>>) {
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_house_league')) return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_house_league')) return forbidden();
  return null;
}

async function loadDraft(seasonId: string): Promise<LeagueDraftState | null> {
  const { data } = await supabaseAdmin
    .from('league_seasons')
    .select('draft_state')
    .eq('id', seasonId)
    .single();
  return (data?.draft_state as LeagueDraftState | null) ?? null;
}

async function saveDraft(seasonId: string, state: LeagueDraftState | null): Promise<void> {
  await supabaseAdmin
    .from('league_seasons')
    .update({ draft_state: state })
    .eq('id', seasonId);
}

function advance(pickNumber: number, pickOrder: string[]): { currentTeamId: string; round: number } {
  const idx = (pickNumber - 1) % pickOrder.length;
  return {
    currentTeamId: pickOrder[idx],
    round: Math.ceil(pickNumber / pickOrder.length),
  };
}

async function getRemainingPlayers(divisionId: string, pickedIds: Set<string>) {
  const all = await getRegistrationsForDivision(divisionId, { status: 'active' });
  return all.filter(r => !pickedIds.has(r.id));
}

export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ seasonId: string }> },) => {
  const ctx = await getAuthContextWithRole();
  const err = gate(ctx);
  if (err) return err;

  const { seasonId } = await params;
  const season = await getLeagueSeasonById(seasonId, ctx!.org.id);
  if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });

  const draft = await loadDraft(seasonId);
  if (!draft) return NextResponse.json({ draft: null, remainingPlayers: [] });

  const pickedIds = new Set(draft.picks.map(p => p.registrationId));
  const remainingPlayers = await getRemainingPlayers(draft.divisionId, pickedIds);

  return NextResponse.json({ draft, remainingPlayers });
}, { route: '/api/admin/house-league/seasons/[seasonId]/draft' });

export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ seasonId: string }> },) => {
  const ctx = await getAuthContextWithRole();
  const err = gate(ctx);
  if (err) return err;

  // Auth seam: only admins now; future coach-room token path added here
  if (ctx!.role !== 'owner' && ctx!.role !== 'league_admin') return forbidden();

  const { seasonId } = await params;
  const season = await getLeagueSeasonById(seasonId, ctx!.org.id);
  if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });

  const body = await req.json();
  const { action } = body;

  if (action === 'start') {
    const { divisionId, pickOrder } = body;
    if (!divisionId || !Array.isArray(pickOrder) || pickOrder.length === 0) {
      return NextResponse.json({ error: 'divisionId and pickOrder required' }, { status: 400 });
    }

    const { currentTeamId, round } = advance(1, pickOrder);
    const newDraft: LeagueDraftState = {
      draftId: crypto.randomUUID(),
      divisionId,
      round,
      pickNumber: 1,
      currentTeamId,
      pickOrder,
      picks: [],
    };

    await saveDraft(seasonId, newDraft);

    const all = await getRegistrationsForDivision(divisionId, { status: 'active' });
    const remainingPlayers = all.filter(r => !r.teamId);

    return NextResponse.json({ draft: newDraft, remainingPlayers });
  }

  if (action === 'pick') {
    const { registrationId } = body;
    if (!registrationId) {
      return NextResponse.json({ error: 'registrationId required' }, { status: 400 });
    }

    const draft = await loadDraft(seasonId);
    if (!draft) return NextResponse.json({ error: 'No active draft' }, { status: 409 });

    const pickedIds = new Set(draft.picks.map(p => p.registrationId));
    if (pickedIds.has(registrationId)) {
      return NextResponse.json({ error: 'Player already picked' }, { status: 409 });
    }

    const newPick = {
      round: draft.round,
      pickNumber: draft.pickNumber,
      teamId: draft.currentTeamId,
      registrationId,
    };
    const picks = [...draft.picks, newPick];
    const nextPickNumber = draft.pickNumber + 1;
    const { currentTeamId, round } = advance(nextPickNumber, draft.pickOrder);

    const updated: LeagueDraftState = { ...draft, pickNumber: nextPickNumber, round, currentTeamId, picks };
    await saveDraft(seasonId, updated);

    const newPickedIds = new Set(picks.map(p => p.registrationId));
    const remainingPlayers = await getRemainingPlayers(draft.divisionId, newPickedIds);

    return NextResponse.json({ draft: updated, remainingPlayers });
  }

  if (action === 'undo') {
    const draft = await loadDraft(seasonId);
    if (!draft) return NextResponse.json({ error: 'No active draft' }, { status: 409 });
    if (!draft.picks.length) {
      return NextResponse.json({ error: 'No picks to undo' }, { status: 409 });
    }

    const picks = draft.picks.slice(0, -1);
    const newPickNumber = draft.pickNumber - 1;
    const { currentTeamId, round } = advance(newPickNumber, draft.pickOrder);

    const updated: LeagueDraftState = { ...draft, pickNumber: newPickNumber, round, currentTeamId, picks };
    await saveDraft(seasonId, updated);

    const pickedIds = new Set(picks.map(p => p.registrationId));
    const remainingPlayers = await getRemainingPlayers(draft.divisionId, pickedIds);

    return NextResponse.json({ draft: updated, remainingPlayers });
  }

  if (action === 'finalize') {
    const draft = await loadDraft(seasonId);
    if (!draft) return NextResponse.json({ error: 'No active draft' }, { status: 409 });

    if (draft.picks.length > 0) {
      await bulkAssignTeams(
        draft.picks.map(p => ({ registrationId: p.registrationId, teamId: p.teamId }))
      );
    }

    await saveDraft(seasonId, null);
    return NextResponse.json({ ok: true, assignedCount: draft.picks.length });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}, { route: '/api/admin/house-league/seasons/[seasonId]/draft' });
