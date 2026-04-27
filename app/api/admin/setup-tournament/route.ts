import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      console.error("Setup API Error: Missing environment variables", { url: !!url, key: !!key });
      return new Response(JSON.stringify({ 
        error: `Environment variables missing on server. URL: ${!!url}, KEY: ${!!key}. Please check Amplify settings.` 
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(url, key);
    const body = await req.json().catch(() => null);
    
    if (!body) {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { tournament, divisions, announcement, seedData } = body;

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

    // 4. Seed Data
    if (seedData && Object.values(seedData).some(v => v)) {
      const { data: ageGroups } = await supabase.from('age_groups').select('*, pools(*)').eq('tournament_id', tid);
      
      if (ageGroups && ageGroups.length > 0) {
        if (seedData.contacts) {
          const roles = ['Tournament Director', 'Registrar', 'Head Umpire', 'Diamond Manager', 'Volunteer Coordinator'];
          const names = ['John Smith', 'Sarah Jenkins', 'Mike Miller', 'Lisa Wong', 'David Chen'];
          const rows = names.map((name, i) => ({
            tournament_id: tid,
            name,
            email: `${name.toLowerCase().replace(' ', '.')}@example.com`,
            phone: `555-010${i}`,
            role: roles[i]
          }));
          await supabase.from('contacts').insert(rows);
        }

        if (seedData.diamonds) {
          const names = ['Memorial Park D1', 'Memorial Park D2', 'Lions Field', 'South Common', 'Milton Sports Center'];
          const rows = names.map((name, i) => ({
            tournament_id: tid,
            name,
            address: `${100 + i} Main St, Milton, ON`,
            notes: i % 2 === 0 ? 'Lighted field' : ''
          }));
          await supabase.from('diamonds').insert(rows);
        }

        if (seedData.registrations) {
          const teamNames = ['Milton Bats', 'Oakville Angels', 'Burlington Bulls', 'Mississauga Tigers', 'Hamilton Heat', 'Brampton Blazers', 'Toronto Titans', 'Guelph Gryphons'];
          const coaches = ['Coach Bob', 'Coach Alice', 'Coach Charlie', 'Coach Diana', 'Coach Ed', 'Coach Fiona', 'Coach Greg', 'Coach Heather'];
          
          for (const group of ageGroups) {
            const groupPools = group.pools || [];
            
            const teamRows = teamNames.map((name, i) => {
              const poolObj = groupPools.length > 0 ? groupPools[i % groupPools.length] : null;
              return {
                tournament_id: tid,
                age_group_id: group.id,
                name: `${name} ${group.name}${poolObj ? ' (' + poolObj.name + ')' : ''}`,
                coach: coaches[i],
                email: `coach${i}@example.com`,
                players: [],
                pool_id: poolObj?.id
              };
            });
            await supabase.from('teams').insert(teamRows);
            
            const regRows = teamNames.map((name, i) => ({
              tournament_id: tid,
              team_name: `${name} ${group.name}`,
              coach_name: coaches[i],
              email: `coach${i}@example.com`,
              age_group_id: group.id,
              status: 'accepted',
              payment_status: 'paid',
              registered_at: new Date().toISOString()
            }));
            
            // Add 2 waitlist teams
            regRows.push({
              tournament_id: tid,
              team_name: `Waitlist Team 1 ${group.name}`,
              coach_name: 'Waitlist Coach 1',
              email: `waitlist1@example.com`,
              age_group_id: group.id,
              status: 'waitlist',
              payment_status: 'pending',
              registered_at: new Date().toISOString()
            });
            
            await supabase.from('registrations').insert(regRows);
          }
        }
      }
    }

    // 5. Announcement
    if (announcement) {
      await supabase.from('announcements').insert({
        tournament_id: tid,
        title: 'Welcome!',
        body: announcement.body,
        published_at: new Date().toISOString(),
        pinned: true
      });
    }

    return new Response(JSON.stringify({ success: true, id: tid }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    console.error('Setup Tournament Error:', err);
    return new Response(JSON.stringify({ error: err.message || "Unknown server error" }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
