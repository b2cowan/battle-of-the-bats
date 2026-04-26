import { supabase } from './supabase';
import { Tournament, Diamond, Contact, AgeGroup, Pool, Team, Game, Announcement } from './types';

// --- Tournaments ---
export async function getTournaments(): Promise<Tournament[]> {
  const { data, error } = await supabase.from('tournaments').select('*').order('year', { ascending: false });
  if (error) { console.error('getTournaments error', error); return []; }
  return data.map(t => ({ 
    id: t.id, 
    year: t.year, 
    name: t.name, 
    isActive: t.is_active,
    startDate: t.start_date,
    endDate: t.end_date
  }));
}

export async function saveTournament(t: Omit<Tournament, 'id'>): Promise<Tournament | null> {
  if (t.isActive) {
    // Ensure only one is active
    await supabase.from('tournaments').update({ is_active: false }).neq('id', '00000000-0000-0000-0000-000000000000');
  }

  const { data, error } = await supabase
    .from('tournaments')
    .insert({ 
      year: t.year, 
      name: t.name, 
      is_active: t.isActive,
      start_date: t.startDate,
      end_date: t.endDate
    })
    .select()
    .single();
  
  if (error) {
    console.error('saveTournament error', error);
    return null;
  }
  
  return { 
    id: data.id, 
    year: data.year, 
    name: data.name, 
    isActive: data.is_active,
    startDate: data.start_date,
    endDate: data.end_date
  };
}

export async function cloneContacts(targetTid: string, sourceContacts: Contact[]): Promise<void> {
  if (sourceContacts.length === 0) return;
  const rows = sourceContacts.map(c => ({
    tournament_id: targetTid,
    name: c.name,
    email: c.email,
    phone: c.phone,
    role: c.role
  }));
  await supabase.from('contacts').insert(rows);
}

export async function cloneDiamonds(targetTid: string, sourceDiamonds: Diamond[]): Promise<void> {
  if (sourceDiamonds.length === 0) return;
  const rows = sourceDiamonds.map(d => ({
    tournament_id: targetTid,
    name: d.name,
    address: d.address,
    notes: d.notes
  }));
  await supabase.from('diamonds').insert(rows);
}

export async function initializeAgeGroups(targetTid: string, selectedDivisions: { name: string, capacity: number, poolCount: number, poolNames?: string, requiresPoolSelection: boolean }[]): Promise<void> {
  if (selectedDivisions.length === 0) return;
  
  const defaults: Record<string, { min: number, max: number, order: number }> = {
    'U11': { min: 9, max: 11, order: 1 },
    'U13': { min: 11, max: 13, order: 2 },
    'U15': { min: 13, max: 15, order: 3 },
    'U17': { min: 15, max: 17, order: 4 },
    'U19': { min: 17, max: 19, order: 5 },
  };

  const rows = selectedDivisions.map(div => {
    const config = defaults[div.name] || { min: 0, max: 99, order: 10 };
    return {
      tournament_id: targetTid,
      name: div.name,
      min_age: config.min,
      max_age: config.max,
      display_order: config.order,
      is_closed: false,
      capacity: div.capacity,
      pool_count: div.poolCount,
      pool_names: div.poolNames,
      requires_pool_selection: div.requiresPoolSelection
    };
  });
  
  const { data: groups, error } = await supabase.from('age_groups').insert(rows).select();
  if (error) {
    console.error('initializeAgeGroups error:', error);
    throw error;
  }

  // 3. Create real pool records for each group (Batch)
  if (groups && groups.length > 0) {
    const poolRows: any[] = [];
    for (const g of groups) {
      const pCount = g.pool_count || 1;
      const names = (g.pool_names || '').split(',').map((n: string) => n.trim()).filter(Boolean);
      for (let i = 0; i < pCount; i++) {
        const name = names[i] || String.fromCharCode(65 + i);
        poolRows.push({
          age_group_id: g.id,
          name: name.startsWith('Pool ') ? name.replace('Pool ', '') : name, // Normalize: store 'A' instead of 'Pool A'
          display_order: i
        });
      }
    }

    if (poolRows.length > 0) {
      const { error: poolError } = await supabase.from('pools').insert(poolRows);
      if (poolError) {
        console.error('Pool initialization error:', poolError);
        throw poolError;
      }
    }
  }
}

export async function updateTournament(id: string, t: Partial<Tournament>): Promise<void> {
  if (t.isActive) {
    // Ensure only one is active
    await supabase.from('tournaments').update({ is_active: false }).neq('id', '00000000-0000-0000-0000-000000000000');
  }

  const updates: any = {};
  if (t.year !== undefined) updates.year = t.year;
  if (t.name !== undefined) updates.name = t.name;
  if (t.isActive !== undefined) updates.is_active = t.isActive;
  if (t.startDate !== undefined) updates.start_date = t.startDate;
  if (t.endDate !== undefined) updates.end_date = t.endDate;
  await supabase.from('tournaments').update(updates).eq('id', id);
}

export async function deleteTournament(id: string): Promise<void> {
  await supabase.from('tournaments').delete().eq('id', id);
}

export async function setActiveTournament(id: string): Promise<void> {
  // Set all to false, then set one to true
  await supabase.from('tournaments').update({ is_active: false }).neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('tournaments').update({ is_active: true }).eq('id', id);
}

// --- Diamonds ---
export async function getDiamonds(tournamentId?: string): Promise<Diamond[]> {
  let query = supabase.from('diamonds').select('*').order('name', { ascending: true });
  if (tournamentId) query = query.eq('tournament_id', tournamentId);
  const { data, error } = await query;
  if (error) { console.error('getDiamonds error', error); return []; }
  return data.map(d => ({ id: d.id, tournamentId: d.tournament_id, name: d.name, address: d.address, notes: d.notes }));
}

export async function saveDiamond(d: Omit<Diamond, 'id'>): Promise<void> {
  await supabase.from('diamonds').insert({
    tournament_id: d.tournamentId,
    name: d.name,
    address: d.address,
    notes: d.notes
  });
}

export async function updateDiamond(id: string, d: Partial<Diamond>): Promise<void> {
  const updates: any = {};
  if (d.tournamentId !== undefined) updates.tournament_id = d.tournamentId;
  if (d.name !== undefined) updates.name = d.name;
  if (d.address !== undefined) updates.address = d.address;
  if (d.notes !== undefined) updates.notes = d.notes;
  await supabase.from('diamonds').update(updates).eq('id', id);
}

export async function deleteDiamond(id: string): Promise<void> {
  await supabase.from('diamonds').delete().eq('id', id);
}

// --- Contacts ---
export async function getContacts(tournamentId?: string): Promise<Contact[]> {
  let query = supabase.from('contacts').select('*').order('name', { ascending: true });
  if (tournamentId) query = query.eq('tournament_id', tournamentId);
  const { data, error } = await query;
  if (error) { console.error('getContacts error', error); return []; }
  return data.map(c => ({
    id: c.id,
    tournamentId: c.tournament_id,
    name: c.name,
    email: c.email,
    phone: c.phone,
    role: c.role
  }));
}

export async function saveContact(c: Omit<Contact, 'id'>): Promise<void> {
  await supabase.from('contacts').insert({
    tournament_id: c.tournamentId,
    name: c.name,
    email: c.email,
    phone: c.phone,
    role: c.role
  });
}

export async function updateContact(id: string, c: Partial<Contact>): Promise<void> {
  const updates: any = {};
  if (c.tournamentId !== undefined) updates.tournament_id = c.tournamentId;
  if (c.name !== undefined) updates.name = c.name;
  if (c.email !== undefined) updates.email = c.email;
  if (c.phone !== undefined) updates.phone = c.phone;
  if (c.role !== undefined) updates.role = c.role;
  await supabase.from('contacts').update(updates).eq('id', id);
}

export async function deleteContact(id: string): Promise<void> {
  await supabase.from('contacts').delete().eq('id', id);
}

// --- Age Groups ---
export async function getAgeGroups(tournamentId?: string): Promise<AgeGroup[]> {
  let query = supabase.from('age_groups').select('*, pools(*)').order('display_order', { ascending: true });
  if (tournamentId) query = query.eq('tournament_id', tournamentId);
  const { data, error } = await query;
  if (error) { console.error('getAgeGroups error', error); return []; }
  return data.map(g => ({
    id: g.id,
    tournamentId: g.tournament_id,
    name: g.name,
    minAge: g.min_age,
    maxAge: g.max_age,
    order: g.display_order,
    contactId: g.contact_id,
    isClosed: g.is_closed,
    capacity: g.capacity,
    poolCount: g.pool_count,
    poolNames: g.pool_names,
    requiresPoolSelection: g.requires_pool_selection,
    pools: (g.pools || []).map((p: any) => ({
      id: p.id,
      ageGroupId: p.age_group_id,
      name: p.name,
      order: p.display_order
    })).sort((a: any, b: any) => a.order - b.order)
  }));
}

export async function saveAgeGroup(g: Omit<AgeGroup, 'id'>): Promise<void> {
  await supabase.from('age_groups').insert({
    tournament_id: g.tournamentId,
    name: g.name,
    min_age: g.minAge,
    max_age: g.maxAge,
    display_order: g.order,
    contact_id: g.contactId,
    is_closed: g.isClosed || false,
    capacity: g.capacity,
    pool_count: g.poolCount || 1,
    pool_names: g.poolNames
  });
}

export async function updateAgeGroup(id: string, g: Partial<AgeGroup>): Promise<void> {
  const updates: any = {};
  if (g.tournamentId !== undefined) updates.tournament_id = g.tournamentId;
  if (g.name !== undefined) updates.name = g.name;
  if (g.minAge !== undefined) updates.min_age = g.minAge;
  if (g.maxAge !== undefined) updates.max_age = g.maxAge;
  if (g.order !== undefined) updates.display_order = g.order;
  if (g.contactId !== undefined) updates.contact_id = g.contactId;
  if (g.isClosed !== undefined) updates.is_closed = g.isClosed;
  if (g.capacity !== undefined) updates.capacity = g.capacity;
  if (g.poolCount !== undefined) updates.pool_count = g.poolCount;
  if (g.poolNames !== undefined) updates.pool_names = g.poolNames;
  if (g.requiresPoolSelection !== undefined) updates.requires_pool_selection = g.requiresPoolSelection;
  await supabase.from('age_groups').update(updates).eq('id', id);
}

export async function deleteAgeGroup(id: string): Promise<void> {
  await supabase.from('age_groups').delete().eq('id', id);
}

// --- Pools ---
export async function getPools(ageGroupId: string): Promise<Pool[]> {
  const { data, error } = await supabase
    .from('pools')
    .select('*')
    .eq('age_group_id', ageGroupId)
    .order('display_order', { ascending: true });
  if (error) return [];
  return data.map(p => ({
    id: p.id,
    ageGroupId: p.age_group_id,
    name: p.name,
    order: p.display_order
  }));
}

export async function savePool(p: Omit<Pool, 'id'>): Promise<string> {
  const { data, error } = await supabase.from('pools').insert({
    age_group_id: p.ageGroupId,
    name: p.name,
    display_order: p.order
  }).select().single();
  if (error) throw error;
  return data.id;
}

export async function updatePool(id: string, name: string): Promise<void> {
  await supabase.from('pools').update({ name }).eq('id', id);
}

export async function deletePool(id: string): Promise<void> {
  await supabase.from('pools').delete().eq('id', id);
}

// --- Teams ---
export async function getTeams(tournamentId?: string): Promise<Team[]> {
  let query = supabase.from('teams').select('*').order('name', { ascending: true });
  if (tournamentId) query = query.eq('tournament_id', tournamentId);
  const { data, error } = await query;
  if (error) { console.error('getTeams error', error); return []; }
  return data.map(t => ({
    id: t.id,
    tournamentId: t.tournament_id,
    ageGroupId: t.age_group_id,
    name: t.name,
    coach: t.coach,
    email: t.email,
    players: t.players || [],
    pool: t.pool,
    poolId: t.pool_id
  }));
}

export async function saveTeam(t: Omit<Team, 'id'> & { id?: string }): Promise<void> {
  const payload: any = {
    tournament_id: t.tournamentId,
    age_group_id: t.ageGroupId,
    name: t.name,
    coach: t.coach,
    email: t.email,
    players: t.players || [],
    pool: t.pool,
    pool_id: t.poolId
  };
  if (t.id) payload.id = t.id;
  await supabase.from('teams').insert(payload);
}

export async function updateTeam(id: string, t: Partial<Team>): Promise<void> {
  const updates: any = {};
  if (t.tournamentId !== undefined) updates.tournament_id = t.tournamentId;
  if (t.ageGroupId !== undefined) updates.age_group_id = t.ageGroupId;
  if (t.name !== undefined) updates.name = t.name;
  if (t.coach !== undefined) updates.coach = t.coach;
  if (t.email !== undefined) updates.email = t.email;
  if (t.players !== undefined) updates.players = t.players;
  if (t.pool !== undefined) updates.pool = t.pool;
  if (t.poolId !== undefined) updates.pool_id = t.poolId;
  await supabase.from('teams').update(updates).eq('id', id);
}

export async function migratePoolTeams(ageGroupId: string, oldPool: string, newPool: string): Promise<void> {
  const { error } = await supabase
    .from('teams')
    .update({ pool: newPool })
    .eq('age_group_id', ageGroupId)
    .eq('pool', oldPool);
  if (error) throw error;
}

export async function saveRegistration(r: any): Promise<void> {
  const { error } = await supabase.from('registrations').insert(r);
  if (error) throw error;
}

export async function deleteTeam(id: string): Promise<void> {
  await supabase.from('teams').delete().eq('id', id);
}

// --- Games ---
export async function getGames(tournamentId?: string): Promise<Game[]> {
  let query = supabase.from('games').select('*').order('game_date', { ascending: true }).order('game_time', { ascending: true });
  if (tournamentId) query = query.eq('tournament_id', tournamentId);
  const { data, error } = await query;
  if (error) { console.error('getGames error', error); return []; }
  return data.map(g => ({
    id: g.id,
    tournamentId: g.tournament_id,
    ageGroupId: g.age_group_id,
    homeTeamId: g.home_team_id,
    awayTeamId: g.away_team_id,
    date: g.game_date,
    time: g.game_time,
    location: g.location,
    diamondId: g.diamond_id,
    homeScore: g.home_score,
    awayScore: g.away_score,
    status: g.status,
    notes: g.notes
  }));
}

export async function saveGame(g: Omit<Game, 'id'>): Promise<void> {
  await supabase.from('games').insert({
    tournament_id: g.tournamentId,
    age_group_id: g.ageGroupId,
    home_team_id: g.homeTeamId,
    away_team_id: g.awayTeamId,
    game_date: g.date,
    game_time: g.time,
    location: g.location,
    diamond_id: g.diamondId,
    home_score: g.homeScore,
    away_score: g.awayScore,
    status: g.status || 'scheduled',
    notes: g.notes
  });
}

export async function updateGame(id: string, g: Partial<Game>): Promise<void> {
  const updates: any = {};
  if (g.tournamentId !== undefined) updates.tournament_id = g.tournamentId;
  if (g.ageGroupId !== undefined) updates.age_group_id = g.ageGroupId;
  if (g.homeTeamId !== undefined) updates.home_team_id = g.homeTeamId;
  if (g.awayTeamId !== undefined) updates.away_team_id = g.awayTeamId;
  if (g.date !== undefined) updates.game_date = g.date;
  if (g.time !== undefined) updates.game_time = g.time;
  if (g.location !== undefined) updates.location = g.location;
  if (g.diamondId !== undefined) updates.diamond_id = g.diamondId;
  if (g.homeScore !== undefined) updates.home_score = g.homeScore;
  if (g.awayScore !== undefined) updates.away_score = g.awayScore;
  if (g.status !== undefined) updates.status = g.status;
  if (g.notes !== undefined) updates.notes = g.notes;
  await supabase.from('games').update(updates).eq('id', id);
}

export async function deleteGame(id: string): Promise<void> {
  await supabase.from('games').delete().eq('id', id);
}

// --- Announcements ---
export async function getAnnouncements(tournamentId?: string): Promise<Announcement[]> {
  let query = supabase.from('announcements').select('*')
    .order('pinned', { ascending: false })
    .order('published_at', { ascending: false });
  if (tournamentId) query = query.eq('tournament_id', tournamentId);
  const { data, error } = await query;
  if (error) { console.error('getAnnouncements error', error); return []; }
  return data.map(a => ({
    id: a.id,
    tournamentId: a.tournament_id,
    title: a.title,
    body: a.body,
    date: a.published_at,
    pinned: a.pinned
  }));
}

export async function saveAnnouncement(a: Omit<Announcement, 'id'>): Promise<void> {
  await supabase.from('announcements').insert({
    tournament_id: a.tournamentId,
    title: a.title,
    body: a.body,
    published_at: a.date,
    pinned: a.pinned || false
  });
}

export async function updateAnnouncement(id: string, a: Partial<Announcement>): Promise<void> {
  const updates: any = {};
  if (a.tournamentId !== undefined) updates.tournament_id = a.tournamentId;
  if (a.title !== undefined) updates.title = a.title;
  if (a.body !== undefined) updates.body = a.body;
  if (a.date !== undefined) updates.published_at = a.date;
  if (a.pinned !== undefined) updates.pinned = a.pinned;
  await supabase.from('announcements').update(updates).eq('id', id);
}

export async function deleteAnnouncement(id: string): Promise<void> {
  await supabase.from('announcements').delete().eq('id', id);
}

// --- Seeding ---
export async function seedTournamentData(tid: string, options: { 
  contacts?: boolean, diamonds?: boolean, registrations?: boolean, schedule?: boolean, results?: boolean 
}) {
  const ageGroups = await getAgeGroups(tid);
  if (ageGroups.length === 0) return;

  if (options.contacts) {
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

  if (options.diamonds) {
    const names = ['Memorial Park D1', 'Memorial Park D2', 'Lions Field', 'South Common', 'Milton Sports Center'];
    const rows = names.map((name, i) => ({
      tournament_id: tid,
      name,
      address: `${100 + i} Main St, Milton, ON`,
      notes: i % 2 === 0 ? 'Lighted field' : ''
    }));
    await supabase.from('diamonds').insert(rows);
  }

  if (options.registrations) {
    const teamNames = ['Milton Bats', 'Oakville Angels', 'Burlington Bulls', 'Mississauga Tigers', 'Hamilton Heat', 'Brampton Blazers', 'Toronto Titans', 'Guelph Gryphons'];
    const coaches = ['Coach Bob', 'Coach Alice', 'Coach Charlie', 'Coach Diana', 'Coach Ed', 'Coach Fiona', 'Coach Greg', 'Coach Heather'];
    
    for (const group of ageGroups) {
      const rows = teamNames.map((name, i) => {
        const teamPool = group.poolCount && group.poolCount > 1 
          ? String.fromCharCode(65 + (i % group.poolCount)) // A, B, C...
          : undefined;

        return {
          tournament_id: tid,
          age_group_id: group.id,
          name: `${name} ${group.name}${teamPool ? ' (' + teamPool + ')' : ''}`,
          coach: coaches[i],
          email: `coach${i}@example.com`,
          players: [],
          pool: teamPool
        };
      });
      const { error: teamError } = await supabase.from('teams').insert(rows);
      if (teamError) {
        console.error('Team seeding error:', teamError);
        throw teamError;
      }
      
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
      
      // Add 2 waitlist teams per division
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
      regRows.push({
        tournament_id: tid,
        team_name: `Waitlist Team 2 ${group.name}`,
        coach_name: 'Waitlist Coach 2',
        email: `waitlist2@example.com`,
        age_group_id: group.id,
        status: 'waitlist',
        payment_status: 'pending',
        registered_at: new Date().toISOString()
      });

      const { error: regError } = await supabase.from('registrations').insert(regRows);
      if (regError) {
        console.error('Registration seeding error:', regError);
        throw regError;
      }
    }
  }

  if (options.schedule || options.results) {
    const teams = await getTeams(tid);
    const diamonds = await getDiamonds(tid);
    if (teams.length < 2 || diamonds.length === 0) return;

    const gameRows = [];
    const tnt = await supabase.from('tournaments').select('*').eq('id', tid).single();
    const baseDate = tnt.data?.start_date || new Date().toISOString().split('T')[0];

    for (const group of ageGroups) {
      const groupTeams = teams.filter(t => t.ageGroupId === group.id);
      if (groupTeams.length < 2) continue;

      // Simple 2 games per division for seed
      for (let i = 0; i < 2; i++) {
        const home = groupTeams[i % groupTeams.length];
        const away = groupTeams[(i + 1) % groupTeams.length];
        const diamond = diamonds[i % diamonds.length];
        
        gameRows.push({
          tournament_id: tid,
          age_group_id: group.id,
          home_team_id: home.id,
          away_team_id: away.id,
          game_date: baseDate,
          game_time: `${9 + i}:00`,
          location: diamond.name,
          diamond_id: diamond.id,
          status: options.results ? 'final' : 'scheduled',
          home_score: options.results ? Math.floor(Math.random() * 10) : null,
          away_score: options.results ? Math.floor(Math.random() * 10) : null
        });
      }
    }
    await supabase.from('games').insert(gameRows);
  }
}
