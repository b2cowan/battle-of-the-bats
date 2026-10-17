import { getAuthContextWithScope, unauthorized, forbidden, scopeGuard, requireTournamentInOrg, requireWritableTournament } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { POOL_SLOT_REFUSALS, ensureOutsideDivision, readEnsureRequest } from '@/lib/pool-slots-ensure';

function badRequest(error: string) {
  return new Response(JSON.stringify({ error }), { status: 400, headers: { 'Content-Type': 'application/json' } });
}

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

export const GET = withObservability(async (req: Request) => {
  const url = new URL(req.url);
  const orgSlug = url.searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithScope({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();

  const tournamentId = url.searchParams.get('tournamentId');
  const divisionId = url.searchParams.get('divisionId');

  if (!tournamentId) return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });

  const denied = scopeGuard(ctx, tournamentId);
  if (denied) return denied;

  const wrongOrg = await requireTournamentInOrg(ctx, tournamentId);
  if (wrongOrg) return wrongOrg;

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
}, { route: '/api/admin/pool-slots' });

export const POST = withObservability(async (req: Request) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithScope({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();

  if (!hasCapability(ctx.role, ctx.capabilities, 'manage_schedule_structure')) return forbidden();

  try {
    const body = await req.json();
    const { action } = body;

    // ── ensure ────────────────────────────────────────────────────────────────
    // Creates missing slot records for each requested pool. Idempotent. Its one caller is the schedule
    // generator's save (Generator.tsx), which sends the selected division's own pools.
    // Body: { action, tournamentId, divisionId, pools: [{ poolId, slotCount, namePrefix }] }
    // Returns: { slots: PoolSlot[] }
    //
    // The division must be the tournament's and every pool the division's (lib/pool-slots-ensure.ts). Until
    // 2026-10-16 neither was checked: another organization's pool got spots added, and its spots and team names
    // came back. The route's other writes — sync-capacity, assign, unassign, swap, rename — had no caller since their
    // screens moved and the same class of hole (sync-capacity deleted another organization's empty spots; rename
    // rewrote game labels by spot id, unlocked); they were removed.
    if (action === 'ensure') {
      const read = readEnsureRequest(body);
      if (!read.ok) return badRequest(read.error);
      const { tournamentId, divisionId, pools } = read;

      const refused = await requireWritableTournament(ctx, tournamentId);
      if (refused) return refused;

      const [{ data: division, error: divisionErr }, { data: poolRows, error: poolErr }] = await Promise.all([
        supabaseAdmin.from('divisions').select('tournament_id').eq('id', divisionId).maybeSingle(),
        pools.length
          ? supabaseAdmin.from('pools').select('id, division_id').in('id', [...new Set(pools.map(p => p.poolId))])
          : Promise.resolve({ data: [] as Array<{ id: string; division_id: string }>, error: null }),
      ]);
      if (divisionErr) throw divisionErr;
      if (poolErr) throw poolErr;
      if (ensureOutsideDivision(read, division, poolRows ?? [])) return badRequest(POOL_SLOT_REFUSALS.outside);

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

    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

  } catch (err: any) {
    console.error('Pool Slots API error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Unknown error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}, { route: '/api/admin/pool-slots' });
