import { supabase } from './supabase';
import { Tournament, Diamond, Contact, AgeGroup, Pool, Team, Game, Announcement, PlayoffConfig } from './types';

// --- Tournaments ---
export async function getTournaments(): Promise<Tournament[]> {
  const { data, error } = await supabase.from('tournaments').select('*').order('year', { ascending: false });
  if (error || !data) { 
    if (error) console.error('getTournaments error', error); 
    return []; 
  }
  return data.map(t => ({ 
    id: t.id, 
    year: t.year, 
    name: t.name, 
    isActive: t.is_active,
    startDate: t.start_date,
    endDate: t.end_date
  }));
}

export async function getTournament(id: string): Promise<Tournament | null> {
  const { data, error } = await supabase.from('tournaments').select('*').eq('id', id).single();
  if (error || !data) { 
    if (error) console.error('getTournament error', error); 
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
  if (error || !data) { 
    if (error) console.error('getDiamonds error', error); 
    return []; 
  }
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
  if (error || !data) { 
    if (error) console.error('getContacts error', error); 
    return []; 
  }
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
  if (error || !data) { 
    if (error) console.error('getAgeGroups error', error); 
    return []; 
  }
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
    playoffConfig: g.playoff_config,
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
    pool_names: g.poolNames,
    playoff_config: g.playoffConfig || { type: 'single', crossover: 'standard', hasThirdPlace: false, teamsQualifying: 4 }
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
  if (g.playoffConfig !== undefined) updates.playoff_config = g.playoffConfig;
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
  if (error || !data) return [];
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
  if (error || !data) { 
    if (error) console.error('getTeams error', error); 
    return []; 
  }
  return data.map(t => ({
    id: t.id,
    tournamentId: t.tournament_id,
    ageGroupId: t.age_group_id,
    name: t.name,
    coach: t.coach,
    email: t.email,
    players: t.players || [],
    status: t.status || 'accepted',
    paymentStatus: t.payment_status || 'paid',
    registered_at: t.registered_at, // Map to registeredAt if needed
    registeredAt: t.registered_at,
    adminNotes: t.admin_notes,
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
    status: t.status || 'accepted',
    payment_status: t.paymentStatus || 'paid',
    registered_at: t.registeredAt || new Date().toISOString(),
    admin_notes: t.adminNotes,
    pool_id: t.poolId
  };
  if (t.id) payload.id = t.id;
  const { error } = await supabase.from('teams').insert(payload);
  if (error) throw error;
}

export async function updateTeam(id: string, t: Partial<Team>): Promise<void> {
  const updates: any = {};
  if (t.tournamentId !== undefined) updates.tournament_id = t.tournamentId;
  if (t.ageGroupId !== undefined)   updates.age_group_id = t.ageGroupId;
  if (t.name !== undefined)         updates.name = t.name;
  if (t.coach !== undefined)        updates.coach = t.coach;
  if (t.email !== undefined)        updates.email = t.email;
  if (t.players !== undefined)      updates.players = t.players;
  if (t.status !== undefined)       updates.status = t.status;
  if (t.paymentStatus !== undefined) updates.payment_status = t.paymentStatus;
  if (t.registeredAt !== undefined) updates.registered_at = t.registeredAt;
  if (t.adminNotes !== undefined)    updates.admin_notes = t.adminNotes;
  if (t.poolId !== undefined)       updates.pool_id        = t.poolId;
  const { error } = await supabase.from('teams').update(updates).eq('id', id);
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
  if (error || !data) { 
    if (error) console.error('getGames error', error); 
    return []; 
  }
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
    isPlayoff: g.is_playoff,
    bracketId: g.bracket_id,
    bracketCode: g.bracket_code,
    homePlaceholder: g.home_placeholder,
    awayPlaceholder: g.away_placeholder,
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
    is_playoff: g.isPlayoff || false,
    bracket_id: g.bracketId,
    bracket_code: g.bracketCode,
    home_placeholder: g.homePlaceholder,
    away_placeholder: g.awayPlaceholder,
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
  if (g.isPlayoff !== undefined) updates.is_playoff = g.isPlayoff;
  if (g.bracketId !== undefined) updates.bracket_id = g.bracketId;
  if (g.bracketCode !== undefined) updates.bracket_code = g.bracketCode;
  if (g.homePlaceholder !== undefined) updates.home_placeholder = g.homePlaceholder;
  if (g.awayPlaceholder !== undefined) updates.away_placeholder = g.awayPlaceholder;
  if (g.notes !== undefined) updates.notes = g.notes;
  
  const { error } = await supabase.from('games').update(updates).eq('id', id);
  if (error) throw error;

  // Trigger advancement
  if (g.status === 'completed' || (g.homeScore !== undefined && g.awayScore !== undefined)) {
    const fullGame = (await getGames()).find(x => x.id === id);
    if (fullGame) await advancePlayoffs(fullGame);
  }
}

export async function deleteGame(id: string): Promise<void> {
  await supabase.from('games').delete().eq('id', id);
}

export async function getStandings(ageGroupId: string, config?: PlayoffConfig) {
  const games = await getGames();
  const teams = await getTeams();
  const groupTeams = teams.filter(t => t.ageGroupId === ageGroupId && t.status === 'accepted');
  const groupGames = games.filter(g => g.ageGroupId === ageGroupId && g.status === 'completed' && !g.isPlayoff);

  const teamStats = groupTeams.map(t => {
    const teamGames = groupGames.filter(g => g.homeTeamId === t.id || g.awayTeamId === t.id);
    let wins = 0, losses = 0, ties = 0, rf = 0, ra = 0;

    teamGames.forEach(g => {
      const isHome = g.homeTeamId === t.id;
      const tScore = isHome ? (g.homeScore || 0) : (g.awayScore || 0);
      const oScore = isHome ? (g.awayScore || 0) : (g.homeScore || 0);
      
      rf += tScore;
      ra += oScore;
      if (tScore > oScore) wins++;
      else if (tScore < oScore) losses++;
      else ties++;
    });

    return {
      teamId: t.id,
      teamName: t.name,
      poolId: t.poolId,
      gp: teamGames.length,
      w: wins,
      l: losses,
      t: ties,
      pts: (wins * 2) + ties,
      rf,
      ra,
      rd: rf - ra
    };
  });

  const breakers = config?.tieBreakers || ['h2h', 'rd', 'rf', 'ra'];

  function breakTies(tiedTeams: any[], breakerIndex: number): any[] {
    if (tiedTeams.length <= 1 || breakerIndex >= breakers.length) return tiedTeams;

    const breaker = breakers[breakerIndex];
    
    // Skip H2H if 3+ teams are tied
    if (breaker === 'h2h' && tiedTeams.length >= 3) {
      return breakTies(tiedTeams, breakerIndex + 1);
    }

    let sorted = [...tiedTeams];
    if (breaker === 'h2h') {
      // Compare the two teams directly
      const t1 = tiedTeams[0];
      const t2 = tiedTeams[1];
      const h2hGames = groupGames.filter(g => 
        (g.homeTeamId === t1.teamId && g.awayTeamId === t2.teamId) ||
        (g.homeTeamId === t2.teamId && g.awayTeamId === t1.teamId)
      );
      let t1Wins = 0, t2Wins = 0;
      h2hGames.forEach(g => {
        const t1Score = g.homeTeamId === t1.teamId ? (g.homeScore || 0) : (g.awayScore || 0);
        const t2Score = g.homeTeamId === t2.teamId ? (g.homeScore || 0) : (g.awayScore || 0);
        if (t1Score > t2Score) t1Wins++;
        else if (t2Score > t1Score) t2Wins++;
      });
      if (t1Wins !== t2Wins) {
        return t1Wins > t2Wins ? [t1, t2] : [t2, t1];
      }
    } else if (breaker === 'rf') {
      sorted.sort((a, b) => b.rf - a.rf);
    } else if (breaker === 'ra') {
      sorted.sort((a, b) => a.ra - b.ra);
    } else if (breaker === 'rd') {
      sorted.sort((a, b) => b.rd - a.rd);
    }

    // After sorting by current breaker, group them again if still tied
    const results: any[] = [];
    let i = 0;
    while (i < sorted.length) {
      const current = sorted[i];
      const subGroup = [current];
      let j = i + 1;
      while (j < sorted.length) {
        const next = sorted[j];
        const stillTied = breaker === 'h2h' ? false : (
          breaker === 'rf' ? next.rf === current.rf :
          breaker === 'ra' ? next.ra === current.ra :
          next.rd === current.rd
        );
        if (stillTied) {
          subGroup.push(next);
          j++;
        } else break;
      }
      
      if (subGroup.length > 1) {
        results.push(...breakTies(subGroup, breakerIndex + 1));
      } else {
        results.push(current);
      }
      i = j;
    }
    return results;
  }

  // Initial sort by Points
  const byPoints: Record<number, any[]> = {};
  teamStats.forEach(s => {
    if (!byPoints[s.pts]) byPoints[s.pts] = [];
    byPoints[s.pts].push(s);
  });

  const finalStandings: any[] = [];
  Object.keys(byPoints).sort((a, b) => Number(b) - Number(a)).forEach(pts => {
    finalStandings.push(...breakTies(byPoints[Number(pts)], 0));
  });

  return finalStandings;
}

// --- Announcements ---
export async function getAnnouncements(tournamentId?: string): Promise<Announcement[]> {
  let query = supabase.from('announcements').select('*')
    .order('pinned', { ascending: false })
    .order('published_at', { ascending: false });
  if (tournamentId) query = query.eq('tournament_id', tournamentId);
  const { data, error } = await query;
  if (error || !data) { 
    if (error) console.error('getAnnouncements error', error); 
    return []; 
  }
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
    const defaultTeamNames = ['Milton Bats', 'Oakville Angels', 'Burlington Bulls', 'Mississauga Tigers', 'Hamilton Heat', 'Brampton Blazers', 'Toronto Titans', 'Guelph Gryphons', 'Kitchener Panthers', 'London Badgers', 'Windsor Selects', 'Whitby Eagles'];
    const defaultCoaches = ['Coach Bob', 'Coach Alice', 'Coach Charlie', 'Coach Diana', 'Coach Ed', 'Coach Fiona', 'Coach Greg', 'Coach Heather', 'Coach Ian', 'Coach Jack', 'Coach Ken', 'Coach Leo'];
    
    for (const group of ageGroups) {
      const capacity = group.capacity || 8;
      const teamRows: any[] = [];
      
      // Seed up to capacity
      for (let i = 0; i < capacity; i++) {
        const nameBase = defaultTeamNames[i % defaultTeamNames.length];
        const coachBase = defaultCoaches[i % defaultCoaches.length];
        
        teamRows.push({
          tournament_id: tid,
          age_group_id: group.id,
          name: `${nameBase} ${group.name} ${i + 1}`,
          coach: coachBase,
          email: `coach${i}@example.com`,
          players: [],
          status: 'accepted',
          payment_status: 'paid',
          registered_at: new Date().toISOString()
        });
      }

      // Add 2 waitlist teams per division
      for (let i = 0; i < 2; i++) {
        teamRows.push({
          tournament_id: tid,
          age_group_id: group.id,
          name: `Waitlist Team ${i + 1} ${group.name}`,
          coach: `Waitlist Coach ${i + 1}`,
          email: `waitlist${i + 1}@example.com`,
          players: [],
          status: 'waitlist',
          payment_status: 'pending',
          registered_at: new Date().toISOString()
        });
      }

      const { error: teamError } = await supabase.from('teams').insert(teamRows);
      if (teamError) {
        console.error('Team seeding error:', teamError);
        throw teamError;
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

export async function advancePlayoffs(game: Game) {
  if (game.status !== 'completed') return;

  const games = await getGames(game.tournamentId);
  const playoffGames = games.filter(g => g.isPlayoff && g.ageGroupId === game.ageGroupId);
  
  if (playoffGames.length === 0) return;

  // 1. Advance winners/losers within the bracket
  if (game.isPlayoff && game.bracketCode) {
    const winnerId = (game.homeScore || 0) > (game.awayScore || 0) ? game.homeTeamId : game.awayTeamId;
    const loserId = (game.homeScore || 0) > (game.awayScore || 0) ? game.awayTeamId : game.homeTeamId;

    for (const pg of playoffGames) {
      const updates: Partial<Game> = {};
      if (pg.homePlaceholder === 'Winner ' + game.bracketCode) updates.homeTeamId = winnerId;
      if (pg.awayPlaceholder === 'Winner ' + game.bracketCode) updates.awayTeamId = winnerId;
      if (pg.homePlaceholder === 'Loser ' + game.bracketCode) updates.homeTeamId = loserId;
      if (pg.awayPlaceholder === 'Loser ' + game.bracketCode) updates.awayTeamId = loserId;

      if (Object.keys(updates).length > 0) {
        await updateGame(pg.id, updates);
      }
    }
  }

  // 2. Check if all pool games are done to fill initial seeds
  const poolGames = games.filter(g => g.ageGroupId === game.ageGroupId && !g.isPlayoff);
  const allPoolDone = poolGames.every(g => g.status === 'completed');

  if (allPoolDone && poolGames.length > 0) {
    const ageGroup = (await getAgeGroups(game.tournamentId)).find(g => g.id === game.ageGroupId);
    const standings = await getStandings(game.ageGroupId, ageGroup?.playoffConfig);
    const pools = ageGroup?.pools || [];

    for (const pg of playoffGames) {
      const updates: Partial<Game> = {};
      
      const resolvePlaceholder = (ph?: string) => {
        if (!ph) return null;
        
        if (ph.startsWith('Seed #')) {
          const rank = parseInt(ph.replace('Seed #', ''));
          return standings[rank - 1]?.teamId;
        }

        const match = ph.match(/(\d+)\w+ Pool (.+)/);
        if (match) {
          const rank = parseInt(match[1]);
          const poolName = match[2];
          const pool = pools.find(p => p.name === poolName);
          const poolStandings = standings.filter(s => s.poolId === pool?.id);
          return poolStandings[rank - 1]?.teamId;
        }
        
        return null;
      };

      const hId = resolvePlaceholder(pg.homePlaceholder);
      const aId = resolvePlaceholder(pg.awayPlaceholder);
      
      if (hId) updates.homeTeamId = hId;
      if (aId) updates.awayTeamId = aId;

      if (Object.keys(updates).length > 0) {
        await updateGame(pg.id, updates);
      }
    }
  }
}
