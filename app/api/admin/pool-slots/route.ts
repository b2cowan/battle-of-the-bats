import { getAuthContextWithScope, unauthorized, forbidden, scopeGuard } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { supabaseAdmin } from '@/lib/supabase-admin';

function mapSlot(s: any, teamNames = new Map<string, string>()) {
  return {
    id: s.id,
    poolId: s.pool_id,
    tournamentId: s.tournament_id,
    divisionId: s.division_id,
    slotNumber: s.slot_number,
    displayName: s.display_name,
    teamId: s.team_id ?? null,
    teamName: s.team_id ? teamNames.get(s.team_id) ?? null : null,
  };
}

async function getTeamNamesForSlots(slots: Array<{ team_id?: string | null }>) {
  const teamIds = [...new Set(slots.map(slot => slot.team_id).filter(Boolean))] as string[];
  if (teamIds.length === 0) return new Map<string, string>();

  const { data, error } = await supabaseAdmin
    .from('teams')
    .select('id, name')
    .in('id', teamIds);
  if (error) throw error;

  return new Map((data ?? []).map(team => [team.id as string, team.name as string]));
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const orgSlug = url.searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithScope({ orgSlug });
  if (!ctx) return unauthorized();

  const tournamentId = url.searchParams.get('tournamentId');
  const divisionId = url.searchParams.get('divisionId');

  if (!tournamentId) return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });

  const denied = scopeGuard(ctx, tournamentId);
  if (denied) return denied;

  let query = supabaseAdmin
    .from('pool_slots')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('slot_number', { ascending: true });

  if (divisionId) query = query.eq('division_id', divisionId);

  const { data, error } = await query;
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });

  try {
    const slots = data ?? [];
    const teamNames = await getTeamNamesForSlots(slots);
    return new Response(JSON.stringify(slots.map(slot => mapSlot(slot, teamNames))), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Unknown error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

export async function POST(req: Request) {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithScope({ orgSlug });
  if (!ctx) return unauthorized();

  if (!hasCapability(ctx.role, ctx.capabilities, 'manage_schedule_structure')) return forbidden();

  try {
    const body = await req.json();
    const { action } = body;

    // ── ensure ────────────────────────────────────────────────────────────────
    // Creates missing slot records for each requested pool. Idempotent.
    // Body: { action, tournamentId, divisionId, pools: [{ poolId, slotCount, namePrefix }] }
    // Returns: { slots: PoolSlot[] }
    if (action === 'ensure') {
      const { tournamentId, divisionId, pools } = body as {
        tournamentId: string;
        divisionId: string;
        pools: { poolId: string; slotCount: number; namePrefix: string }[];
      };

      const denied = scopeGuard(ctx, tournamentId);
      if (denied) return denied;

      const allCreated: any[] = [];

      for (const pool of pools) {
        const { poolId, slotCount, namePrefix } = pool;

        const { data: existing } = await supabaseAdmin
          .from('pool_slots')
          .select('slot_number')
          .eq('pool_id', poolId);

        const existingNums = new Set((existing ?? []).map((s: any) => s.slot_number));

        const toInsert = [];
        for (let n = 1; n <= slotCount; n++) {
          if (!existingNums.has(n)) {
            toInsert.push({
              pool_id: poolId,
              tournament_id: tournamentId,
              division_id: divisionId,
              slot_number: n,
              display_name: `${namePrefix} Team ${n}`,
            });
          }
        }

        if (toInsert.length > 0) {
          const { error } = await supabaseAdmin.from('pool_slots').insert(toInsert);
          if (error) throw error;
        }

        // Return all slots for this pool up to slotCount
        const { data: poolSlots, error: fetchError } = await supabaseAdmin
          .from('pool_slots')
          .select('*')
          .eq('pool_id', poolId)
          .lte('slot_number', slotCount)
          .order('slot_number');

        if (fetchError) throw fetchError;
        allCreated.push(...(poolSlots ?? []));
      }

      const teamNames = await getTeamNamesForSlots(allCreated);
      return new Response(JSON.stringify({ slots: allCreated.map(slot => mapSlot(slot, teamNames)) }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // ── sync-capacity ─────────────────────────────────────────────────────────
    // Brings each pool's slot count into line with slotCount.
    // Inserts missing slots; removes empty slots above slotCount; never deletes filled slots.
    // Body: { action, tournamentId, divisionId, pools: [{ poolId, slotCount, namePrefix }] }
    // Returns: { slots: PoolSlot[], warnings: string[] }
    if (action === 'sync-capacity') {
      const { tournamentId, divisionId, pools } = body as {
        tournamentId: string;
        divisionId: string;
        pools: { poolId: string; slotCount: number; namePrefix: string }[];
      };

      const denied = scopeGuard(ctx, tournamentId);
      if (denied) return denied;

      const allSlots: any[] = [];
      const warnings: string[] = [];

      for (const { poolId, slotCount, namePrefix } of pools) {
        const { data: existing } = await supabaseAdmin
          .from('pool_slots')
          .select('id, slot_number, team_id')
          .eq('pool_id', poolId)
          .order('slot_number', { ascending: true });

        const existingSlots = existing ?? [];
        const existingNums = new Set(existingSlots.map((s: any) => s.slot_number));

        const toInsert: any[] = [];
        for (let n = 1; n <= slotCount; n++) {
          if (!existingNums.has(n)) {
            toInsert.push({
              pool_id:       poolId,
              tournament_id: tournamentId,
              division_id:  divisionId,
              slot_number:   n,
              display_name:  namePrefix ? `${namePrefix} Team ${n}` : `Team ${n}`,
            });
          }
        }
        if (toInsert.length > 0) {
          const { error } = await supabaseAdmin.from('pool_slots').insert(toInsert);
          if (error) throw error;
        }

        const above       = existingSlots.filter((s: any) => s.slot_number > slotCount);
        const filledAbove = above.filter((s: any) => s.team_id !== null);
        const emptyAbove  = above.filter((s: any) => s.team_id === null);

        if (filledAbove.length > 0) {
          warnings.push(`Pool has ${filledAbove.length} filled slot(s) above the new capacity — those were kept.`);
        }
        if (emptyAbove.length > 0) {
          const { error } = await supabaseAdmin.from('pool_slots').delete().in('id', emptyAbove.map((s: any) => s.id));
          if (error) throw error;
        }

        const { data: finalSlots, error: finalErr } = await supabaseAdmin
          .from('pool_slots')
          .select('*')
          .eq('pool_id', poolId)
          .order('slot_number', { ascending: true });
        if (finalErr) throw finalErr;
        allSlots.push(...(finalSlots ?? []));
      }

      const teamNames = await getTeamNamesForSlots(allSlots);
      return Response.json({ slots: allSlots.map(slot => mapSlot(slot, teamNames)), warnings });
    }

    // ── assign ────────────────────────────────────────────────────────────────
    // Assigns a team to a slot. If this fills the last empty slot in the pool,
    // bulk-updates all games in the pool with real team IDs (atomic flip).
    // Body: { action, slotId, teamId }
    if (action === 'assign') {
      const { slotId, teamId } = body as { slotId: string; teamId: string };

      const { data: slot, error: slotErr } = await supabaseAdmin
        .from('pool_slots').select('*').eq('id', slotId).single();
      if (slotErr || !slot) throw slotErr ?? new Error('Slot not found');

      const denied = scopeGuard(ctx, slot.tournament_id);
      if (denied) return denied;

      // Set team on this slot
      const { error: updateErr } = await supabaseAdmin
        .from('pool_slots').update({ team_id: teamId }).eq('id', slotId);
      if (updateErr) throw updateErr;

      // Check if all slots in this pool are now assigned
      const { data: unassigned } = await supabaseAdmin
        .from('pool_slots').select('id').eq('pool_id', slot.pool_id).is('team_id', null);

      if ((unassigned ?? []).length === 0) {
        // All slots filled — cascade team IDs onto games
        const { data: allSlots } = await supabaseAdmin
          .from('pool_slots').select('id, team_id').eq('pool_id', slot.pool_id);

        for (const s of allSlots ?? []) {
          if (!s.team_id) continue;
          await supabaseAdmin.from('games').update({ home_team_id: s.team_id }).eq('home_slot_id', s.id);
          await supabaseAdmin.from('games').update({ away_team_id: s.team_id }).eq('away_slot_id', s.id);
        }
      }

      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // ── unassign ──────────────────────────────────────────────────────────────
    // Removes a team from a slot. Clears all game team IDs for the whole pool
    // (public reverts to slot-name display).
    // Body: { action, slotId }
    if (action === 'unassign') {
      const { slotId } = body as { slotId: string };

      const { data: slot, error: slotErr } = await supabaseAdmin
        .from('pool_slots').select('*').eq('id', slotId).single();
      if (slotErr || !slot) throw slotErr ?? new Error('Slot not found');

      const denied = scopeGuard(ctx, slot.tournament_id);
      if (denied) return denied;

      // Clear game team IDs for the entire pool (reverts public display to slot names)
      const { data: poolSlots } = await supabaseAdmin
        .from('pool_slots').select('id').eq('pool_id', slot.pool_id);

      for (const s of poolSlots ?? []) {
        await supabaseAdmin.from('games').update({ home_team_id: null }).eq('home_slot_id', s.id);
        await supabaseAdmin.from('games').update({ away_team_id: null }).eq('away_slot_id', s.id);
      }

      // Clear the slot assignment
      const { error: clearErr } = await supabaseAdmin
        .from('pool_slots').update({ team_id: null }).eq('id', slotId);
      if (clearErr) throw clearErr;

      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // ── swap ──────────────────────────────────────────────────────────────────
    // Swaps team assignments between two slots. Both must be in the same pool.
    // Body: { action, slotAId, slotBId }
    if (action === 'swap') {
      const { slotAId, slotBId } = body as { slotAId: string; slotBId: string };

      const [{ data: slotA }, { data: slotB }] = await Promise.all([
        supabaseAdmin.from('pool_slots').select('*').eq('id', slotAId).single(),
        supabaseAdmin.from('pool_slots').select('*').eq('id', slotBId).single(),
      ]);

      if (!slotA || !slotB) throw new Error('One or both slots not found');

      const denied = scopeGuard(ctx, slotA.tournament_id);
      if (denied) return denied;

      // Clear game team IDs for the pool before swapping (pool may drop below fully-assigned)
      const { data: poolSlots } = await supabaseAdmin
        .from('pool_slots').select('id').eq('pool_id', slotA.pool_id);

      for (const s of poolSlots ?? []) {
        await supabaseAdmin.from('games').update({ home_team_id: null }).eq('home_slot_id', s.id);
        await supabaseAdmin.from('games').update({ away_team_id: null }).eq('away_slot_id', s.id);
      }

      // Swap
      await supabaseAdmin.from('pool_slots').update({ team_id: slotB.team_id }).eq('id', slotAId);
      await supabaseAdmin.from('pool_slots').update({ team_id: slotA.team_id }).eq('id', slotBId);

      // Re-check if pool is now fully assigned and cascade if so
      const { data: unassigned } = await supabaseAdmin
        .from('pool_slots').select('id').eq('pool_id', slotA.pool_id).is('team_id', null);

      if ((unassigned ?? []).length === 0) {
        const { data: allSlots } = await supabaseAdmin
          .from('pool_slots').select('id, team_id').eq('pool_id', slotA.pool_id);

        for (const s of allSlots ?? []) {
          if (!s.team_id) continue;
          await supabaseAdmin.from('games').update({ home_team_id: s.team_id }).eq('home_slot_id', s.id);
          await supabaseAdmin.from('games').update({ away_team_id: s.team_id }).eq('away_slot_id', s.id);
        }
      }

      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // ── rename ────────────────────────────────────────────────────────────────
    // Renames a slot's display name and cascades to game placeholders.
    // Body: { action, slotId, displayName }
    if (action === 'rename') {
      const { slotId, displayName } = body as { slotId: string; displayName: string };

      const { data: slot, error: slotErr } = await supabaseAdmin
        .from('pool_slots').select('tournament_id').eq('id', slotId).single();
      if (slotErr || !slot) throw slotErr ?? new Error('Slot not found');

      const denied = scopeGuard(ctx, slot.tournament_id);
      if (denied) return denied;

      await Promise.all([
        supabaseAdmin.from('pool_slots').update({ display_name: displayName }).eq('id', slotId),
        supabaseAdmin.from('games').update({ home_placeholder: displayName }).eq('home_slot_id', slotId),
        supabaseAdmin.from('games').update({ away_placeholder: displayName }).eq('away_slot_id', slotId),
      ]);

      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

  } catch (err: any) {
    console.error('Pool Slots API error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Unknown error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
