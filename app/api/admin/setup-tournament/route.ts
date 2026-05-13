import { createClient } from '@supabase/supabase-js';
import { getAuthContext, unauthorized, requireCapability } from '@/lib/api-auth';

export async function POST(req: Request) {
  const auth = await getAuthContext();
  if (!auth) return unauthorized();

  const denied = await requireCapability(auth, 'create_tournaments');
  if (denied) return denied;

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

    const debug: string[] = [];
    const log = (msg: string, data?: any) => {
      const line = data ? `${msg} ${JSON.stringify(data)}` : msg;
      console.log(`[Setup API] ${line}`);
      debug.push(line);
    };

    const { tournament, divisions, announcement, seedData, scheduleParams, migration } = body;
    const allowSeedData = process.env.NEXT_PUBLIC_ENABLE_DEV_TOOLS === 'true';
    const effectiveSeedData = allowSeedData ? seedData : null;
    const slug = String(tournament?.slug ?? '').trim().toLowerCase();

    if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      return Response.json({ error: 'Tournament URL must contain lowercase letters, numbers, and hyphens.' }, { status: 400 });
    }

    const { count: slugCount, error: slugError } = await supabase
      .from('tournaments')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', auth.org.id)
      .eq('slug', slug)
      .neq('status', 'archived');

    if (slugError) throw slugError;
    if ((slugCount ?? 0) > 0) {
      return Response.json({ error: 'A tournament with this URL already exists.' }, { status: 409 });
    }

    // 1. Create Tournament (always starts as draft; activate explicitly from the Tournaments page)
    const { data: newTnt, error: tntError } = await supabase
      .from('tournaments')
      .insert({
        year:            tournament.year,
        name:            tournament.name,
        slug,
        status:          'draft',
        is_active:       false,
        start_date:      tournament.startDate,
        end_date:        tournament.endDate,
        organization_id: auth.org.id,
      })
      .select()
      .single();

    if (tntError) {
      log('Tournament Create Error', tntError);
      throw tntError;
    }
    const tid = newTnt.id;
    log('Created Tournament', tid);

    // 2. Initialize Divisions & Pools
    if (divisions && divisions.length > 0) {
      const defaults: Record<string, any> = {
        'U9': { min: 7, max: 9, order: 1 },
        'U11': { min: 9, max: 11, order: 2 },
        'U13': { min: 11, max: 13, order: 3 },
        'U15': { min: 13, max: 15, order: 4 },
        'U17': { min: 15, max: 17, order: 5 },
        'U19': { min: 17, max: 19, order: 6 },
        'Open': { min: 0, max: 99, order: 1 },
        'Competitive': { min: 0, max: 99, order: 2 },
        'Recreational': { min: 0, max: 99, order: 3 },
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
          const poolCount = Number(g.pool_count ?? 0);
          for (let i = 0; i < poolCount; i++) {
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
          if (poolError) {
            log('Pool Insert Error', poolError);
            throw poolError;
          }
          log(`Initialized ${poolRows.length} pools`);
        }
      }
    }

    // 3.5 Handle Migration
    if (migration && migration.sourceTournamentId) {
      console.log('Handling migration from tournament:', migration.sourceTournamentId);
      
      if (migration.migrateDiamonds) {
        const { data: sourceDiamonds } = await supabase
          .from('diamonds')
          .select('*')
          .eq('tournament_id', migration.sourceTournamentId);
        
        if (sourceDiamonds && sourceDiamonds.length > 0) {
          const rows = sourceDiamonds.map(d => ({
            tournament_id: tid,
            name: d.name,
            address: d.address,
            notes: d.notes
          }));
          const { error: dErr } = await supabase.from('diamonds').insert(rows);
          if (dErr) console.error('Migration Error: Failed to clone diamonds', dErr);
          else console.log(`Migrated ${rows.length} diamonds`);
        }
      }

      if (migration.contactIds && migration.contactIds.length > 0) {
        const { data: sourceContacts } = await supabase
          .from('contacts')
          .select('*')
          .in('id', migration.contactIds);
        
        if (sourceContacts && sourceContacts.length > 0) {
          const rows = sourceContacts.map(c => ({
            tournament_id: tid,
            name: c.name,
            email: c.email,
            phone: c.phone,
            role: c.role
          }));
          const { error: cErr } = await supabase.from('contacts').insert(rows);
          if (cErr) console.error('Migration Error: Failed to clone contacts', cErr);
          else console.log(`Migrated ${rows.length} contacts`);
        }
      }
    }

    // 4. Seed Data
    if (effectiveSeedData && Object.values(effectiveSeedData).some(v => v)) {
      log('Seeding Data', effectiveSeedData);
      const { data: ageGroups } = await supabase.from('age_groups').select('*, pools(*)').eq('tournament_id', tid);
      
      if (ageGroups && ageGroups.length > 0) {
        if (effectiveSeedData.contacts) {
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

        if (effectiveSeedData.diamonds) {
          const names = ['Memorial Park D1', 'Memorial Park D2', 'Lions Field', 'South Common', 'Milton Sports Center'];
          const rows = names.map((name, i) => ({
            tournament_id: tid,
            name,
            address: `${100 + i} Main St, Milton, ON`,
            notes: i % 2 === 0 ? 'Lighted field' : ''
          }));
          await supabase.from('diamonds').insert(rows);
        }

        if (effectiveSeedData.registrations) {
          const teamNames = ['Milton Bats', 'Oakville Angels', 'Burlington Bulls', 'Mississauga Tigers', 'Hamilton Heat', 'Brampton Blazers', 'Toronto Titans', 'Guelph Gryphons'];
          const coaches = ['Coach Bob', 'Coach Alice', 'Coach Charlie', 'Coach Diana', 'Coach Ed', 'Coach Fiona', 'Coach Greg', 'Coach Heather'];
          
          for (const group of ageGroups) {
            const groupPools = group.pools || [];
            
            const teamRows = teamNames.map((name, i) => {
              const poolObj = groupPools.length > 0 ? groupPools[i % groupPools.length] : null;
              return {
                tournament_id: tid,
                age_group_id: group.id,
                name: `${name} ${group.name}`,
                coach: coaches[i],
                email: `coach${i}@example.com`,
                players: [],
                pool_id: poolObj?.id
              };
            });
            const { error: insertError } = await supabase.from('teams').insert(teamRows);
            if (insertError) console.error(`Error inserting teams for group ${group.name}:`, insertError);
          }
        }

        if (effectiveSeedData.schedule || effectiveSeedData.results) {
          log('Seeding schedule/results for tournament:', tid);
          
          // 1. Fetch teams that were just created
          const { data: allTeams, error: teamsFetchError } = await supabase
            .from('teams')
            .select('*')
            .eq('tournament_id', tid);
          
          if (teamsFetchError) {
            log('Teams Fetch Error', teamsFetchError);
          }

          // 2. Fetch diamonds
          const { data: diamonds, error: diamondsFetchError } = await supabase
            .from('diamonds')
            .select('*')
            .eq('tournament_id', tid);
            
          if (diamondsFetchError) {
            log('Diamonds Fetch Error', diamondsFetchError);
          }
          
          log(`Schedule Seed: Found ${allTeams?.length || 0} teams and ${diamonds?.length || 0} diamonds`);

          if (allTeams && allTeams.length >= 2 && diamonds && diamonds.length > 0) {
            log('Starting schedule generation');
            const gameRows: any[] = [];
            const duration = scheduleParams?.gameDuration || 90;
            const turnover = scheduleParams?.turnoverTime || 15;
            const gamesPerTeam = scheduleParams?.gamesPerTeam || 3;
            
            const scheduleStartStr = scheduleParams?.startDate || tournament.startDate || new Date().toISOString().split('T')[0];
            const dayStartStr = scheduleParams?.startTime || '08:00';
            const dayEndStr = scheduleParams?.endTime || '20:30';

            const [startHour, startMin] = dayStartStr.split(':').map(Number);
            const [endHour, endMin] = dayEndStr.split(':').map(Number);
            const dailyLimitMinutes = (endHour * 60 + endMin) || (20 * 60 + 30);
            
            if (duration <= 0) {
              log('Error: Invalid game duration', duration);
              throw new Error('Invalid game duration');
            }

            let currentMinute = (startHour * 60 + startMin);
            let diamondIdx = 0;
            let currentDayOffset = 0;
            const teamBusySlots = new Map<string, Set<string>>(); // teamId -> Set<date + time>

            for (const group of ageGroups) {
              const groupPools = group.pools || [];
              const groupTeams = allTeams.filter(t => t.age_group_id === group.id);
              if (groupTeams.length < 2) continue;

              log(`Seeding matches for ${group.name}...`);

              // We'll iterate through pools. If no pools, we treat it as one big pool.
              const poolsToProcess = groupPools.length > 0 ? groupPools : [{ id: null, name: 'General' }];
              const selectedPairs: [any, any][] = [];
              const teamGameCounts = new Map<string, number>();

              for (const pool of poolsToProcess) {
                const pTeams = pool.id 
                  ? groupTeams.filter(t => t.pool_id === pool.id)
                  : groupTeams;
                
                if (pTeams.length < 2) continue;

                log(`Pool ${pool.name || 'All'}: ${pTeams.length} teams`);

                // Generate limited matchups
                for (let i = 0; i < pTeams.length; i++) {
                  for (let j = i + 1; j < pTeams.length; j++) {
                    const t1 = pTeams[i];
                    const t2 = pTeams[j];
                    
                    const c1 = teamGameCounts.get(t1.id) || 0;
                    const c2 = teamGameCounts.get(t2.id) || 0;

                    if (c1 < gamesPerTeam && c2 < gamesPerTeam) {
                      selectedPairs.push([t1, t2]);
                      teamGameCounts.set(t1.id, c1 + 1);
                      teamGameCounts.set(t2.id, c2 + 1);
                    }
                  }
                }
              }

              // Shuffle pairs to spread them out naturally
              for (let i = selectedPairs.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [selectedPairs[i], selectedPairs[j]] = [selectedPairs[j], selectedPairs[i]];
              }

              const lastTeamTime = new Map<string, number>();

              for (const [home, away] of selectedPairs) {
                let slotFound = false;
                let attempts = 0;

                while (!slotFound && attempts < 200) {
                  attempts++;
                  
                  if (currentMinute + duration > dailyLimitMinutes) {
                    currentDayOffset++;
                    currentMinute = (startHour * 60 + startMin);
                    diamondIdx = 0;
                  }

                  const hour = Math.floor(currentMinute / 60);
                  const min = currentMinute % 60;
                  const timeStr = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
                  const diamond = diamonds[diamondIdx % diamonds.length];

                  const gameDate = new Date(scheduleStartStr + 'T12:00:00');
                  gameDate.setDate(gameDate.getDate() + currentDayOffset);
                  const dateStr = gameDate.toISOString().split('T')[0];
                  const timeKey = `${dateStr} ${timeStr}`;
                  const absoluteMinute = (currentDayOffset * 24 * 60) + currentMinute;

                  const isHomeBusy = teamBusySlots.get(home.id)?.has(timeKey);
                  const isAwayBusy = teamBusySlots.get(away.id)?.has(timeKey);
                  
                  // Back-to-back check: Must have at least ONE slot gap
                  // (currentMinute - lastTime) must be > (duration + turnover)
                  const lastH = lastTeamTime.get(home.id) ?? -9999;
                  const lastA = lastTeamTime.get(away.id) ?? -9999;
                  const hasGapH = absoluteMinute > lastH + (duration + turnover);
                  const hasGapA = absoluteMinute > lastA + (duration + turnover);

                  if (!isHomeBusy && !isAwayBusy && hasGapH && hasGapA) {
                    gameRows.push({
                      tournament_id: tid,
                      age_group_id: group.id,
                      home_team_id: home.id,
                      away_team_id: away.id,
                      game_date: dateStr,
                      game_time: timeStr,
                      location: diamond.name,
                      diamond_id: diamond.id,
                      status: effectiveSeedData.results ? 'completed' : 'scheduled',
                      home_score: effectiveSeedData.results ? Math.floor(Math.random() * 8) : null,
                      away_score: effectiveSeedData.results ? Math.floor(Math.random() * 8) : null
                    });

                    if (!teamBusySlots.has(home.id)) teamBusySlots.set(home.id, new Set());
                    if (!teamBusySlots.has(away.id)) teamBusySlots.set(away.id, new Set());
                    teamBusySlots.get(home.id)!.add(timeKey);
                    teamBusySlots.get(away.id)!.add(timeKey);
                    
                    lastTeamTime.set(home.id, absoluteMinute);
                    lastTeamTime.set(away.id, absoluteMinute);

                    slotFound = true;
                  }

                  diamondIdx++;
                  if (diamondIdx % diamonds.length === 0) {
                    currentMinute += (duration + turnover);
                  }
                }
              }
            }

            if (gameRows.length > 0) {
              log(`Inserting ${gameRows.length} games...`);
              const { error: gameError } = await supabase.from('games').insert(gameRows);
              if (gameError) log('Game Insert Error', gameError);
              else log('Games inserted successfully');
            } else {
              log('No games generated for any group');
            }
          } else {
            log('Skipping schedule seed: not enough teams/diamonds', { 
              teamCount: allTeams?.length, 
              diamondCount: diamonds?.length 
            });
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

    return new Response(JSON.stringify({ success: true, id: tid, slug, name: tournament.name, debug }), {
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
