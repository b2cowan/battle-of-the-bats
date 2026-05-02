import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized } from '@/lib/api-auth';

export async function POST(req: Request) {
  const auth = await getAuthContext();
  if (!auth) return unauthorized();

  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      return new Response(JSON.stringify({ error: "Environment variables missing on server." }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(url, key);
    const { action, id, data } = await req.json();

    if (action === 'save') {
      const { error } = await supabase.from('age_groups').insert({
        tournament_id: data.tournamentId,
        name: data.name,
        min_age: data.minAge,
        max_age: data.maxAge,
        display_order: data.order,
        contact_id: data.contactId,
        is_closed: data.isClosed,
        capacity: data.capacity,
        pool_count: data.poolCount,
        pool_names: data.poolNames,
        requires_pool_selection: data.requiresPoolSelection,
        playoff_config: data.playoffConfig
      });
      if (error) throw error;
    } 
    
    else if (action === 'update' && id) {
      // 1. Update Age Group
      const { error: agError } = await supabase.from('age_groups').update({
        name: data.name,
        min_age: data.minAge,
        max_age: data.maxAge,
        display_order: data.order,
        contact_id: data.contactId,
        is_closed: data.isClosed,
        capacity: data.capacity,
        pool_count: data.poolCount,
        pool_names: data.poolNames,
        requires_pool_selection: data.requiresPoolSelection,
        playoff_config: data.playoffConfig
      }).eq('id', id);
      if (agError) throw agError;

      // 2. Manage Pools
      const newPoolCount = data.poolCount || 0;
      const newNames = (data.poolNames || '').split(',').map((n: string) => n.trim());
      
      const { data: existingPools } = await supabase.from('pools').select('*').eq('age_group_id', id).order('display_order', { ascending: true });
      const pools = existingPools || [];

      if (newPoolCount < 2) {
        // If pools are disabled, delete all existing pools
        if (pools.length > 0) {
          const toDelete = pools.map(p => p.id);
          await supabase.from('pools').delete().in('id', toDelete);
        }
      } else {
        // Update/Add
        for (let i = 0; i < newPoolCount; i++) {
          const name = newNames[i] || String.fromCharCode(65 + i);
          if (pools[i]) {
            await supabase.from('pools').update({ name, display_order: i }).eq('id', pools[i].id);
          } else {
            await supabase.from('pools').insert({ age_group_id: id, name, display_order: i });
          }
        }
        // Remove extra
        if (pools.length > newPoolCount) {
          const toDelete = pools.slice(newPoolCount).map(p => p.id);
          await supabase.from('pools').delete().in('id', toDelete);
        }
      }
    }

    else if (action === 'delete' && id) {
      const { error } = await supabase.from('age_groups').delete().eq('id', id);
      if (error) throw error;
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err: any) {
    console.error('Age Group Admin Error:', err);
    return new Response(JSON.stringify({ error: err.message || "Unknown server error" }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
