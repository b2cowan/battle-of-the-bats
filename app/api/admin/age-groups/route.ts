import { getAuthContextWithScope, unauthorized, forbidden, scopeGuard } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { supabaseAdmin } from '@/lib/supabase-admin';

type ApiPool = {
  id: string;
  ageGroupId: string;
  name: string;
  order: number;
};

type DbPool = {
  id: string;
  name: string;
  display_order: number;
};

export async function GET(req: Request) {
  const ctx = await getAuthContextWithScope();
  if (!ctx) return unauthorized();

  const tournamentId = new URL(req.url).searchParams.get('tournamentId');
  if (!tournamentId) return Response.json([]);

  const denied = scopeGuard(ctx, tournamentId);
  if (denied) return denied;

  const { data, error } = await supabaseAdmin
    .from('age_groups')
    .select('*, pools(*)')
    .eq('tournament_id', tournamentId)
    .order('display_order', { ascending: true });

  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json((data ?? []).map(group => ({
    id: group.id,
    tournamentId: group.tournament_id,
    name: group.name,
    minAge: group.min_age,
    maxAge: group.max_age,
    order: group.display_order,
    contactId: group.contact_id,
    isClosed: group.is_closed,
    capacity: group.capacity,
    poolCount: group.pool_count,
    poolNames: group.pool_names,
    requiresPoolSelection: group.requires_pool_selection,
    playoffConfig: group.playoff_config,
    depositAmount: group.deposit_amount ?? null,
    depositDueDate: group.deposit_due_date ?? null,
    totalFeeAmount: group.total_fee_amount ?? null,
    totalFeeDueDate: group.total_fee_due_date ?? null,
    pools: ((group.pools ?? [])
      .map((pool: { id: string; age_group_id: string; name: string; display_order: number }) => ({
        id: pool.id,
        ageGroupId: pool.age_group_id,
        name: pool.name,
        order: pool.display_order,
      })) as ApiPool[])
      .sort((a, b) => a.order - b.order),
  })));
}

export async function POST(req: Request) {
  const ctx = await getAuthContextWithScope();
  if (!ctx) return unauthorized();

  if (!hasCapability(ctx.role, ctx.capabilities, 'create_tournaments')) return forbidden();

  try {
    const { action, id, data } = await req.json();

    if (action === 'save') {
      const denied = scopeGuard(ctx, data.tournamentId);
      if (denied) return denied;

      const { data: insertedGroup, error } = await supabaseAdmin.from('age_groups').insert({
        tournament_id:           data.tournamentId,
        name:                    data.name,
        min_age:                 data.minAge,
        max_age:                 data.maxAge,
        display_order:           data.order,
        contact_id:              data.contactId,
        is_closed:               data.isClosed,
        capacity:                data.capacity,
        pool_count:              data.poolCount,
        pool_names:              data.poolNames,
        requires_pool_selection: data.requiresPoolSelection,
        playoff_config:          data.playoffConfig,
        deposit_amount:          data.depositAmount ?? null,
        deposit_due_date:        data.depositDueDate ?? null,
        total_fee_amount:        data.totalFeeAmount ?? null,
        total_fee_due_date:      data.totalFeeDueDate ?? null,
      }).select('id').single();
      if (error) throw error;

      const poolCount = data.poolCount || 0;
      if (insertedGroup?.id && poolCount >= 2) {
        const names = (data.poolNames || '').split(',').map((n: string) => n.trim());
        const poolRows = Array.from({ length: poolCount }).map((_, index) => ({
          age_group_id: insertedGroup.id,
          name: names[index] || String.fromCharCode(65 + index),
          display_order: index,
        }));
        const { error: poolError } = await supabaseAdmin.from('pools').insert(poolRows);
        if (poolError) throw poolError;
      }
    }

    else if (action === 'update' && id) {
      const { data: ag } = await supabaseAdmin
        .from('age_groups')
        .select('tournament_id')
        .eq('id', id)
        .single();

      if (ag) {
        const denied = scopeGuard(ctx, ag.tournament_id);
        if (denied) return denied;
      }

      const { error: agError } = await supabaseAdmin.from('age_groups').update({
        name:                    data.name,
        min_age:                 data.minAge,
        max_age:                 data.maxAge,
        display_order:           data.order,
        contact_id:              data.contactId,
        is_closed:               data.isClosed,
        capacity:                data.capacity,
        pool_count:              data.poolCount,
        pool_names:              data.poolNames,
        requires_pool_selection: data.requiresPoolSelection,
        playoff_config:          data.playoffConfig,
        deposit_amount:          data.depositAmount ?? null,
        deposit_due_date:        data.depositDueDate ?? null,
        total_fee_amount:        data.totalFeeAmount ?? null,
        total_fee_due_date:      data.totalFeeDueDate ?? null,
      }).eq('id', id);
      if (agError) throw agError;

      const newPoolCount = data.poolCount || 0;
      const newNames = (data.poolNames || '').split(',').map((n: string) => n.trim());

      const { data: existingPools } = await supabaseAdmin
        .from('pools')
        .select('*')
        .eq('age_group_id', id)
        .order('display_order', { ascending: true });

      const pools: DbPool[] = existingPools || [];

      if (newPoolCount < 2) {
        if (pools.length > 0) {
          await supabaseAdmin.from('pools').delete().in('id', pools.map(p => p.id));
        }
      } else {
        for (let i = 0; i < newPoolCount; i++) {
          const name = newNames[i] || String.fromCharCode(65 + i);
          if (pools[i]) {
            await supabaseAdmin.from('pools').update({ name, display_order: i }).eq('id', pools[i].id);
          } else {
            await supabaseAdmin.from('pools').insert({ age_group_id: id, name, display_order: i });
          }
        }
        if (pools.length > newPoolCount) {
          await supabaseAdmin.from('pools').delete().in('id', pools.slice(newPoolCount).map(p => p.id));
        }
      }
    }

    else if (action === 'delete' && id) {
      const { data: ag } = await supabaseAdmin
        .from('age_groups')
        .select('tournament_id')
        .eq('id', id)
        .single();

      if (ag) {
        const denied = scopeGuard(ctx, ag.tournament_id);
        if (denied) return denied;
      }

      const { error } = await supabaseAdmin.from('age_groups').delete().eq('id', id);
      if (error) throw error;
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err: unknown) {
    console.error('Age Group Admin Error:', err);
    const message = err instanceof Error ? err.message : 'Unknown server error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
