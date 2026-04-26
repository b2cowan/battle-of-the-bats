import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Use the Service Role Key to bypass RLS for administrative setup
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { tournament, divisions, announcement, seedData } = await req.json();

    // 1. Create Tournament
    const { data: newTnt, error: tntError } = await supabase
      .from('tournaments')
      .insert({
        year: tournament.year,
        name: tournament.name,
        is_active: tournament.isActive,
        start_date: tournament.startDate,
        end_date: tournament.endDate
      })
      .select()
      .single();

    if (tntError) throw tntError;
    const tid = newTnt.id;

    // 2. Initialize Divisions & Pools
    if (divisions && divisions.length > 0) {
      const defaults: Record<string, any> = {
        'U11': { min: 9, max: 11, order: 1 },
        'U13': { min: 11, max: 13, order: 2 },
        'U15': { min: 13, max: 15, order: 3 },
        'U17': { min: 15, max: 17, order: 4 },
        'U19': { min: 17, max: 19, order: 5 },
      };

      const groupRows = divisions.map((div: any) => {
        const config = defaults[div.name] || { min: 0, max: 99, order: 10 };
        return {
          tournament_id: tid,
          name: div.name,
          min_age: config.min,
          max_age: config.max,
          display_order: config.order,
          capacity: div.capacity,
          pool_count: div.poolCount,
          pool_names: div.poolNames,
          requires_pool_selection: div.requiresPoolSelection
        };
      });

      const { data: insertedGroups, error: groupError } = await supabase
        .from('age_groups')
        .insert(groupRows)
        .select();

      if (groupError) throw groupError;

      // 3. Create Pools for each group
      if (insertedGroups) {
        const poolRows: any[] = [];
        for (const g of insertedGroups) {
          const names = (g.pool_names || '').split(',').map((n: string) => n.trim()).filter(Boolean);
          for (let i = 0; i < (g.pool_count || 1); i++) {
            const name = names[i] || String.fromCharCode(65 + i);
            poolRows.push({
              age_group_id: g.id,
              name: name.startsWith('Pool ') ? name.replace('Pool ', '') : name,
              display_order: i
            });
          }
        }

        if (poolRows.length > 0) {
          const { error: poolError } = await supabase.from('pools').insert(poolRows);
          if (poolError) throw poolError;
        }
      }
    }

    // 4. Announcement
    if (announcement) {
      await supabase.from('announcements').insert({
        tournament_id: tid,
        title: 'Welcome!',
        body: announcement.body,
        published_at: new Date().toISOString(),
        pinned: true
      });
    }

    return NextResponse.json({ success: true, id: tid });
  } catch (err: any) {
    console.error('Setup Tournament Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
