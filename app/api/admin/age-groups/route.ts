import { getAuthContextWithScope, unauthorized, forbidden, scopeGuard } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: Request) {
  const ctx = await getAuthContextWithScope();
  if (!ctx) return unauthorized();

  if (!hasCapability(ctx.role, ctx.capabilities, 'create_tournaments')) return forbidden();

  try {
    const { action, id, data } = await req.json();

    if (action === 'save') {
      const denied = scopeGuard(ctx, data.tournamentId);
      if (denied) return denied;

      const { error } = await supabaseAdmin.from('age_groups').insert({
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
      });
      if (error) throw error;
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
      }).eq('id', id);
      if (agError) throw agError;

      const newPoolCount = data.poolCount || 0;
      const newNames = (data.poolNames || '').split(',').map((n: string) => n.trim());

      const { data: existingPools } = await supabaseAdmin
        .from('pools')
        .select('*')
        .eq('age_group_id', id)
        .order('display_order', { ascending: true });

      const pools: any[] = existingPools || [];

      if (newPoolCount < 2) {
        if (pools.length > 0) {
          await supabaseAdmin.from('pools').delete().in('id', pools.map((p: any) => p.id));
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
          await supabaseAdmin.from('pools').delete().in('id', pools.slice(newPoolCount).map((p: any) => p.id));
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

  } catch (err: any) {
    console.error('Age Group Admin Error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Unknown server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
