import { supabase } from './supabase';
import { supabaseAdmin } from './supabase-admin';
import { createClient as createBrowserSupabaseClient } from './supabase-browser';
import { Tournament, TournamentStatus, Diamond, Contact, AgeGroup, Pool, Team, Game, Announcement, PlayoffConfig, RuleSection, RuleItem, Resource, Organization, OrganizationMember, OrgPlan, OrgRole, TournamentArchive, OrgPublicSiteContent, AccountingLedger, AccountingEntry, LedgerSummary, AccountingEntryStatus, AccountingEntryType, LeagueSeason, LeagueDivision, LeagueTeam, LeagueRegistration, LeagueGame, LeagueStandingsRow, LeagueSeasonSummary, LeagueRegistrationStatus, LeagueSeasonStatus, LeaguePractice, LeaguePracticeStatus, RepTeam, RepProgramYear, RepProgramYearStatus, RepTeamCoach, RepTryoutRegistration, RepTryoutRegistrationStatus, RepRosterPlayer, RepRosterStatus, RepTeamEvent, RepEventType, RepEventStatus, RepDocumentTemplate, RepDocumentType, RepPlayerDocument, RepDocumentStatus, RepCostAllocation, RepAllocationSplit, RepAllocationInstallment, RepPlayerDuesSchedule, RepPlayerDuesInstallment, RepTeamExpense } from './types';

// Use the SSR browser client (cookie-based session) for writes that need auth;
// falls back to anon client on the server where there is no window.
function authClient() {
  return typeof window !== 'undefined' ? createBrowserSupabaseClient() : supabase;
}

// --- Tournaments ---
export async function getTournaments(): Promise<Tournament[]> {
  const { data, error } = await supabase.from('tournaments').select('*').order('year', { ascending: false });
  if (error || !data) {
    if (error) console.error('getTournaments error', error);
    return [];
  }
  return data.map(mapTournament);
}

export async function getTournament(id: string): Promise<Tournament | null> {
  const { data, error } = await supabase.from('tournaments').select('*').eq('id', id).single();
  if (error || !data) {
    if (error) console.error('getTournament error', error);
    return null;
  }
  return mapTournament(data);
}

export async function saveTournament(t: Omit<Tournament, 'id'>): Promise<Tournament | null> {
  if (t.isActive && t.organizationId) {
    await authClient().from('tournaments')
      .update({ is_active: false, status: 'completed' })
      .eq('organization_id', t.organizationId);
  }

  const { data, error } = await authClient()
    .from('tournaments')
    .insert({
      year: t.year,
      name: t.name,
      slug: t.slug,
      status: t.status ?? (t.isActive ? 'active' : 'draft'),
      is_active: t.isActive,
      start_date: t.startDate,
      end_date: t.endDate,
    })
    .select()
    .single();

  if (error) {
    console.error('saveTournament error', error);
    return null;
  }

  return mapTournament(data);
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
  await authClient().from('contacts').insert(rows);
}

export async function cloneDiamonds(targetTid: string, sourceDiamonds: Diamond[]): Promise<void> {
  if (sourceDiamonds.length === 0) return;
  const rows = sourceDiamonds.map(d => ({
    tournament_id: targetTid,
    name: d.name,
    address: d.address,
    notes: d.notes
  }));
  await authClient().from('diamonds').insert(rows);
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

  const { data: groups, error } = await authClient().from('age_groups').insert(rows).select();
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
      const { error: poolError } = await authClient().from('pools').insert(poolRows);
      if (poolError) {
        console.error('Pool initialization error:', poolError);
        throw poolError;
      }
    }
  }
}

export async function updateTournament(id: string, t: Partial<Tournament>): Promise<void> {
  if (t.isActive) {
    const { data: existing } = await supabase.from('tournaments').select('organization_id').eq('id', id).single();
    if (existing?.organization_id) {
      await authClient().from('tournaments')
        .update({ is_active: false, status: 'completed' })
        .eq('organization_id', existing.organization_id)
        .neq('id', id);
    }
  }

  const updates: any = {};
  if (t.year !== undefined) updates.year = t.year;
  if (t.name !== undefined) updates.name = t.name;
  if (t.slug !== undefined) updates.slug = t.slug;
  if (t.status !== undefined) { updates.status = t.status; updates.is_active = t.status === 'active'; }
  if (t.isActive !== undefined) updates.is_active = t.isActive;
  if (t.startDate !== undefined) updates.start_date = t.startDate;
  if (t.endDate !== undefined) updates.end_date = t.endDate;
  await authClient().from('tournaments').update(updates).eq('id', id);
}

export async function deleteTournament(id: string): Promise<void> {
  await authClient().from('tournaments').delete().eq('id', id);
}

export async function setActiveTournament(id: string): Promise<void> {
  const { data: t } = await supabase.from('tournaments').select('organization_id').eq('id', id).single();
  if (t?.organization_id) {
    await authClient().from('tournaments')
      .update({ is_active: false, status: 'completed' })
      .eq('organization_id', t.organization_id)
      .neq('id', id);
  }
  await authClient().from('tournaments').update({ is_active: true, status: 'active' }).eq('id', id);
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
  return data.map((d: any) => ({ id: d.id, tournamentId: d.tournament_id, name: d.name, address: d.address, notes: d.notes }));
}

export async function saveDiamond(d: Omit<Diamond, 'id'>): Promise<void> {
  await authClient().from('diamonds').insert({
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
  await authClient().from('diamonds').update(updates).eq('id', id);
}

export async function deleteDiamond(id: string): Promise<void> {
  await authClient().from('diamonds').delete().eq('id', id);
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
  return data.map((c: any) => ({
    id: c.id,
    tournamentId: c.tournament_id,
    name: c.name,
    email: c.email,
    phone: c.phone,
    role: c.role
  }));
}

export async function saveContact(c: Omit<Contact, 'id'>): Promise<void> {
  await authClient().from('contacts').insert({
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
  await authClient().from('contacts').update(updates).eq('id', id);
}

export async function deleteContact(id: string): Promise<void> {
  await authClient().from('contacts').delete().eq('id', id);
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
  return data.map((g: any) => ({
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
  await authClient().from('age_groups').insert({
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
  await authClient().from('age_groups').update(updates).eq('id', id);
}

export async function deleteAgeGroup(id: string): Promise<void> {
  await authClient().from('age_groups').delete().eq('id', id);
}

// --- Pools ---
export async function getPools(ageGroupId: string): Promise<Pool[]> {
  const { data, error } = await supabase
    .from('pools')
    .select('*')
    .eq('age_group_id', ageGroupId)
    .order('display_order', { ascending: true });
  if (error || !data) return [];
  return data.map((p: any) => ({
    id: p.id,
    ageGroupId: p.age_group_id,
    name: p.name,
    order: p.display_order
  }));
}

export async function savePool(p: Omit<Pool, 'id'>): Promise<string> {
  const { data, error } = await authClient().from('pools').insert({
    age_group_id: p.ageGroupId,
    name: p.name,
    display_order: p.order
  }).select().single();
  if (error) throw error;
  return data.id;
}

export async function updatePool(id: string, name: string): Promise<void> {
  await authClient().from('pools').update({ name }).eq('id', id);
}

export async function deletePool(id: string): Promise<void> {
  await authClient().from('pools').delete().eq('id', id);
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
  return data.map((t: any) => ({
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
  const { error } = await authClient().from('teams').insert(payload);
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
  const { error } = await authClient().from('teams').update(updates).eq('id', id);
  if (error) throw error;
}

export async function deleteTeam(id: string): Promise<void> {
  await authClient().from('teams').delete().eq('id', id);
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
  return data.map((g: any) => ({
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
  await authClient().from('games').insert({
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

  const { error } = await authClient().from('games').update(updates).eq('id', id);
  if (error) throw error;

  // Trigger advancement
  if (g.status === 'completed' || (g.homeScore !== undefined && g.awayScore !== undefined)) {
    const fullGame = (await getGames()).find(x => x.id === id);
    if (fullGame) await advancePlayoffs(fullGame);
  }
}

export async function deleteGame(id: string): Promise<void> {
  await authClient().from('games').delete().eq('id', id);
}

export async function getStandings(ageGroupId: string, config?: PlayoffConfig) {
  const games = await getGames();
  const teams = await getTeams();
  const groupTeams = teams.filter(t => t.ageGroupId === ageGroupId && t.status === 'accepted');
  const groupGames = games.filter(g =>
    g.ageGroupId === ageGroupId &&
    (g.status === 'completed' || g.status === 'submitted') &&
    !g.isPlayoff
  );

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
      rd: rf - ra,
      hasPendingGame: teamGames.some(g => g.status === 'submitted'),
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
  return data.map((a: any) => ({
    id: a.id,
    tournamentId: a.tournament_id,
    title: a.title,
    body: a.body,
    date: a.published_at,
    pinned: a.pinned,
    ageGroupIds: a.age_group_ids ?? null,
  }));
}

export async function saveAnnouncement(a: Omit<Announcement, 'id'>): Promise<void> {
  await authClient().from('announcements').insert({
    tournament_id: a.tournamentId,
    title: a.title,
    body: a.body,
    published_at: a.date,
    pinned: a.pinned || false,
    age_group_ids: a.ageGroupIds?.length ? a.ageGroupIds : null,
  });
}

export async function updateAnnouncement(id: string, a: Partial<Announcement>): Promise<void> {
  const updates: any = {};
  if (a.tournamentId !== undefined) updates.tournament_id = a.tournamentId;
  if (a.title !== undefined) updates.title = a.title;
  if (a.body !== undefined) updates.body = a.body;
  if (a.date !== undefined) updates.published_at = a.date;
  if (a.pinned !== undefined) updates.pinned = a.pinned;
  if (a.ageGroupIds !== undefined) updates.age_group_ids = a.ageGroupIds?.length ? a.ageGroupIds : null;
  const { error } = await authClient().from('announcements').update(updates).eq('id', id);
  if (error) throw error;
}

export async function deleteAnnouncement(id: string): Promise<void> {
  await authClient().from('announcements').delete().eq('id', id);
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
    await authClient().from('contacts').insert(rows);
  }

  if (options.diamonds) {
    const names = ['Memorial Park D1', 'Memorial Park D2', 'Lions Field', 'South Common', 'Milton Sports Center'];
    const rows = names.map((name, i) => ({
      tournament_id: tid,
      name,
      address: `${100 + i} Main St, Milton, ON`,
      notes: i % 2 === 0 ? 'Lighted field' : ''
    }));
    await authClient().from('diamonds').insert(rows);
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

      const { error: teamError } = await authClient().from('teams').insert(teamRows);
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
    await authClient().from('games').insert(gameRows);
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

// --- Rules ---
export async function getRules(tournamentId: string): Promise<RuleSection[]> {
  const { data, error } = await supabase
    .from('rules')
    .select('*, rule_items(*)')
    .eq('tournament_id', tournamentId)
    .order('display_order', { ascending: true });

  if (error || !data) return [];

  return data.map((r: any) => ({
    id: r.id,
    tournamentId: r.tournament_id,
    title: r.title,
    icon: r.icon,
    order: r.display_order,
    items: (r.rule_items || []).map((i: any) => ({
      id: i.id,
      ruleId: i.rule_id,
      content: i.content,
      order: i.display_order
    })).sort((a: any, b: any) => a.order - b.order),
    ageGroupIds: r.age_group_ids ?? null,
  }));
}

export async function saveRuleSection(r: Omit<RuleSection, 'id' | 'items'>): Promise<string | null> {
  const { data, error } = await authClient()
    .from('rules')
    .insert({
      tournament_id: r.tournamentId,
      title: r.title,
      icon: r.icon,
      display_order: r.order,
      age_group_ids: r.ageGroupIds?.length ? r.ageGroupIds : null,
    })
    .select()
    .single();

  if (error) {
    console.error('saveRuleSection error', error);
    return null;
  }
  return data.id;
}

export async function updateRuleSection(id: string, r: Partial<RuleSection>): Promise<void> {
  const updates: any = {};
  if (r.title !== undefined) updates.title = r.title;
  if (r.icon !== undefined) updates.icon = r.icon;
  if (r.order !== undefined) updates.display_order = r.order;
  if (r.ageGroupIds !== undefined) updates.age_group_ids = r.ageGroupIds?.length ? r.ageGroupIds : null;
  const { error } = await authClient().from('rules').update(updates).eq('id', id);
  if (error) throw error;
}

export async function deleteRuleSection(id: string): Promise<void> {
  await authClient().from('rules').delete().eq('id', id);
}

// ── Public Site Module ────────────────────────────────────────────────────────

export async function getOrgPublicSiteContent(orgId: string): Promise<OrgPublicSiteContent | null> {
  const { data } = await supabase
    .from('org_public_site_content')
    .select('*')
    .eq('org_id', orgId)
    .maybeSingle();
  if (!data) return null;
  return {
    id:                       data.id,
    orgId:                    data.org_id,
    tagline:                  data.tagline             ?? null,
    description:              data.description         ?? null,
    contactEmail:             data.contact_email       ?? null,
    socialInstagram:          data.social_instagram    ?? null,
    socialFacebook:           data.social_facebook     ?? null,
    socialX:                  data.social_x            ?? null,
    socialWebsite:            data.social_website      ?? null,
    showUpcomingTournaments:  data.show_upcoming_tournaments,
    showArchivesLink:         data.show_archives_link,
    createdAt:                data.created_at,
    updatedAt:                data.updated_at,
  };
}

export async function upsertOrgPublicSiteContent(
  orgId: string,
  content: Partial<Omit<OrgPublicSiteContent, 'id' | 'orgId' | 'createdAt' | 'updatedAt'>>,
): Promise<void> {
  await supabaseAdmin
    .from('org_public_site_content')
    .upsert(
      {
        org_id:                   orgId,
        tagline:                  content.tagline             ?? null,
        description:              content.description         ?? null,
        contact_email:            content.contactEmail        ?? null,
        social_instagram:         content.socialInstagram     ?? null,
        social_facebook:          content.socialFacebook      ?? null,
        social_x:                 content.socialX             ?? null,
        social_website:           content.socialWebsite       ?? null,
        show_upcoming_tournaments: content.showUpcomingTournaments ?? true,
        show_archives_link:        content.showArchivesLink   ?? true,
        updated_at:               new Date().toISOString(),
      },
      { onConflict: 'org_id' },
    );
}

export async function saveRuleItem(item: Omit<RuleItem, 'id'>): Promise<void> {
  await authClient().from('rule_items').insert({
    rule_id: item.ruleId,
    content: item.content,
    display_order: item.order
  });
}

export async function updateRuleItem(id: string, item: Partial<RuleItem>): Promise<void> {
  const updates: any = {};
  if (item.content !== undefined) updates.content = item.content;
  if (item.order !== undefined) updates.display_order = item.order;
  await authClient().from('rule_items').update(updates).eq('id', id);
}

export async function deleteRuleItem(id: string): Promise<void> {
  await authClient().from('rule_items').delete().eq('id', id);
}

// --- Resources ---
export async function getResources(tournamentId: string): Promise<Resource[]> {
  const { data, error } = await supabase
    .from('resources')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('display_order', { ascending: true });

  if (error || !data) return [];

  return data.map((r: any) => ({
    id: r.id,
    tournamentId: r.tournament_id,
    label: r.label,
    url: r.url,
    order: r.display_order
  }));
}

export async function saveResource(r: Omit<Resource, 'id'>): Promise<void> {
  await authClient().from('resources').insert({
    tournament_id: r.tournamentId,
    label: r.label,
    url: r.url,
    display_order: r.order
  });
}

export async function updateResource(id: string, r: Partial<Resource>): Promise<void> {
  const updates: any = {};
  if (r.label !== undefined) updates.label = r.label;
  if (r.url !== undefined) updates.url = r.url;
  if (r.order !== undefined) updates.display_order = r.order;
  await authClient().from('resources').update(updates).eq('id', id);
}

export async function deleteResource(id: string): Promise<void> {
  // Get the resource first to see if it has a file to delete
  const { data: res } = await supabase.from('resources').select('*').eq('id', id).single();

  if (res && res.url.includes('supabase.co')) {
    try {
      // Extract filename from public URL
      // Format: .../public/resources/filename.ext
      const parts = res.url.split('/');
      const fileName = parts[parts.length - 1].split('?')[0]; // Remove query params

      await supabase.storage.from('resources').remove([fileName]);
    } catch (err) {
      console.error('Error removing file from storage:', err);
    }
  }

  const { error } = await authClient().from('resources').delete().eq('id', id);
  if (error) throw error;
}

export async function uploadResourceFile(file: File): Promise<string | null> {
  try {
    const cleanName = file.name.replace(/[^\w\s\.\-]/gi, '').replace(/\s+/g, '_');
    const fileName = `${Date.now()}-${cleanName}`;
    const filePath = fileName;

    const { error } = await supabase.storage
      .from('resources')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('Supabase Storage Error:', error);
      throw error;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('resources')
      .getPublicUrl(filePath);

    return publicUrl;
  } catch (err) {
    console.error('uploadResourceFile catch:', err);
    return null;
  }
}

export async function seedRulesAndResources(tournamentId: string) {
  console.log('Seeding rules for tournament:', tournamentId);
  // Hardcoded data from app/rules/page.tsx
  const RULES_SECTIONS = [
    {
      icon: 'Shield',
      title: 'General Tournament Rules',
      items: [
        'All games are governed by Softball Canada official rules unless otherwise specified.',
        'Each team must provide 1 scorekeeper and 1 base umpire per game.',
        'A minimum of 8 players are required to start a game; fewer than 8 results in a forfeit.',
        'Teams must be ready to play 10 minutes before their scheduled game time.',
        'A 10-run mercy rule applies after 4 innings (3.5 innings if home team is ahead).',
        'Games are 6 innings or 90 minutes maximum. No new inning starts after time expires.',
        'Protests must be filed with the tournament director before the end of the disputed game.',
      ],
    },
    {
      icon: 'BookOpen',
      title: 'Eligibility & Age Divisions',
      items: [
        'Players must meet the age requirement for their division as of January 1st of the tournament year.',
        'U11: Ages 9–11 | U13: Ages 11–13 | U15: Ages 13–15 | U17: Ages 15–17 | U19: Ages 17–19',
        'Each player may only be registered on one team per division.',
        'Proof of age (birth certificate or government ID) may be requested at any time.',
        'Player callups from lower divisions require tournament director approval.',
        'Overage players are not permitted under any circumstances.',
      ],
    },
    {
      icon: 'AlertCircle',
      title: 'Code of Conduct',
      items: [
        'Respect for all players, coaches, umpires, and spectators is mandatory.',
        'Any player, coach, or spectator ejected from a game may not return to the facility that day.',
        'Aggressive or threatening behaviour will result in immediate removal from the tournament.',
        'Consumption of alcohol or use of tobacco/cannabis is strictly prohibited in the playing area.',
        'All disputes must be handled through official channels — no confrontations with umpires.',
        'Coaches are responsible for the behaviour of their players and spectators.',
      ],
    },
    {
      icon: 'CheckCircle',
      title: 'Equipment & Uniforms',
      items: [
        'All bats must be certified for play under current Softball Canada regulations.',
        'Players must wear matching team uniforms with visible numbers.',
        'Helmets with face guards are mandatory for all batters and base runners.',
        'Catchers must wear full protective equipment (helmet, chest protector, shin guards).',
        'Cleats with metal spikes are NOT permitted for U11 and U13 divisions.',
        'Teams must supply their own game balls — one new ball per game minimum.',
      ],
    },
  ];

  const RESOURCES = [
    { label: 'Softball Canada Official Rules (PDF)', url: 'https://www.softball.ca/en/rules' },
    { label: 'Tournament Bracket Format', url: '#' },
    { label: 'Field Map & Directions', url: '#' },
    { label: 'Player Registration Form', url: '#' },
    { label: 'Medical Waiver Form', url: '#' },
  ];

  try {
    // Seed Rules
    for (let i = 0; i < RULES_SECTIONS.length; i++) {
      const s = RULES_SECTIONS[i];
      const ruleId = await saveRuleSection({
        tournamentId,
        title: s.title,
        icon: s.icon,
        order: i
      });
      console.log('Saved section:', s.title, 'ID:', ruleId);
      if (ruleId) {
        for (let j = 0; j < s.items.length; j++) {
          await saveRuleItem({
            ruleId,
            content: s.items[j],
            order: j
          });
        }
      }
    }

    // Seed Resources
    for (let i = 0; i < RESOURCES.length; i++) {
      const r = RESOURCES[i];
      await saveResource({
        tournamentId,
        label: r.label,
        url: r.url,
        order: i
      });
    }
    console.log('Seeding complete');
  } catch (err) {
    console.error('Seeding error:', err);
    throw err;
  }
}

// ── Organizations ─────────────────────────────────────────────────────────────

export async function getOrganizationBySlug(slug: string): Promise<Organization | null> {
  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('slug', slug)
    .single();
  if (error || !data) return null;
  return mapOrg(data);
}

export async function getOrganizationByUserId(userId: string): Promise<Organization | null> {
  const { data, error } = await supabase
    .from('organization_members')
    .select('organizations(*)')
    .eq('user_id', userId)
    .single();
  if (error || !data) return null;
  const org = (data as any).organizations;
  return org ? mapOrg(org) : null;
}

export async function getOrgMembership(
  userId: string,
  orgId: string
): Promise<OrganizationMember | null> {
  const { data, error } = await supabase
    .from('organization_members')
    .select('*')
    .eq('user_id', userId)
    .eq('organization_id', orgId)
    .single();
  if (error || !data) return null;
  return mapMember(data);
}

export async function getTournamentsByOrg(orgId: string): Promise<Tournament[]> {
  const { data, error } = await supabase
    .from('tournaments')
    .select('*')
    .eq('organization_id', orgId)
    .order('year', { ascending: false });
  if (error) return [];
  return (data || []).map(mapTournament);
}

export async function getActiveTournamentByOrg(orgId: string): Promise<Tournament | null> {
  const ts = await getTournamentsByOrg(orgId);
  return ts.find(t => t.status === 'active') ?? null;
}

export async function getTournamentBySlug(orgId: string, slug: string): Promise<Tournament | null> {
  const { data, error } = await supabase
    .from('tournaments')
    .select('*')
    .eq('organization_id', orgId)
    .eq('slug', slug)
    .neq('status', 'archived')
    .single();
  if (error || !data) {
    if (error) console.error('getTournamentBySlug error', error);
    return null;
  }
  return mapTournament(data);
}

// Server-side only (uses service role key) ────────────────────────────────────

export async function createOrganization(
  name: string,
  slug: string,
  planId: OrgPlan = 'starter'
): Promise<Organization> {
  const limit = planId === 'elite' ? 999 : planId === 'pro' ? 2 : 1;
  const { data, error } = await supabaseAdmin
    .from('organizations')
    .insert({ name, slug, plan_id: planId, tournament_limit: limit })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return mapOrg(data);
}

export async function createOrganizationMember(
  orgId: string,
  userId: string,
  role: OrgRole = 'owner'
): Promise<OrganizationMember> {
  const { data, error } = await supabaseAdmin
    .from('organization_members')
    .insert({ organization_id: orgId, user_id: userId, role, accepted_at: new Date().toISOString() })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return mapMember(data);
}

// ── Row mappers ───────────────────────────────────────────────────────────────

function mapOrg(r: any): Organization {
  return {
    id:                   r.id,
    name:                 r.name,
    slug:                 r.slug,
    logoUrl:              r.logo_url ?? undefined,
    planId:               r.plan_id,
    stripeCustomerId:     r.stripe_customer_id ?? undefined,
    stripeSubscriptionId: r.stripe_subscription_id ?? undefined,
    subscriptionStatus:   r.subscription_status ?? 'active',
    tournamentLimit:      r.tournament_limit ?? 1,
    isPublic:             r.is_public ?? true,
    createdAt:            r.created_at,
    themePreset:          r.theme_preset ?? undefined,
    themePrimary:         r.theme_primary ?? undefined,
    themeAccent:          r.theme_accent ?? undefined,
    heroBannerUrl:        r.hero_banner_url ?? undefined,
    themeFont:            r.theme_font ?? 'system',
    themeCardStyle:       r.theme_card_style ?? 'default',
    enabledAddons:        r.enabled_addons ?? [],
  };
}

function mapMember(r: any): OrganizationMember {
  return {
    id:             r.id,
    organizationId: r.organization_id,
    userId:         r.user_id,
    role:           r.role,
    invitedAt:      r.invited_at,
    acceptedAt:     r.accepted_at ?? undefined,
  };
}

function mapTournament(r: any): Tournament {
  const status: TournamentStatus = r.status ?? (r.is_active ? 'active' : 'completed');
  return {
    id:             r.id,
    organizationId: r.organization_id ?? undefined,
    year:           r.year,
    name:           r.name,
    slug:           r.slug ?? '',
    status,
    isActive:       status === 'active',
    startDate:      r.start_date ?? undefined,
    endDate:        r.end_date ?? undefined,
    contactEmail:   r.contact_email ?? undefined,
  };
}

function mapArchive(r: any): TournamentArchive {
  return {
    id:              r.id,
    tournamentId:    r.tournament_id ?? null,
    orgId:           r.org_id,
    tournamentName:  r.tournament_name,
    season:          r.season,
    division:        r.division ?? undefined,
    finalSnapshot:   r.final_snapshot,
    winnerTeamId:    r.winner_team_id ?? undefined,
    winnerTeamName:  r.winner_team_name ?? undefined,
    runnerUpName:    r.runner_up_name ?? undefined,
    totalTeams:      r.total_teams ?? undefined,
    totalGames:      r.total_games ?? undefined,
    integrityHash:   r.integrity_hash,
    sealedAt:        r.sealed_at,
    sealedBy:        r.sealed_by ?? undefined,
  };
}

// ── Tournament Archives ───────────────────────────────────────────────────────

export async function getArchivesByOrg(orgId: string): Promise<TournamentArchive[]> {
  const { data, error } = await supabase
    .from('tournament_archives')
    .select('*')
    .eq('org_id', orgId)
    .order('sealed_at', { ascending: false });
  if (error || !data) {
    if (error) console.error('getArchivesByOrg error', error);
    return [];
  }
  return data.map(mapArchive);
}

export async function getArchiveById(id: string): Promise<TournamentArchive | null> {
  const { data, error } = await supabase
    .from('tournament_archives')
    .select('*')
    .eq('id', id)
    .single();
  if (error || !data) {
    if (error) console.error('getArchiveById error', error);
    return null;
  }
  return mapArchive(data);
}

// ── Accounting Module ─────────────────────────────────────────────────────────

export async function getOrgLedger(orgId: string): Promise<AccountingLedger | null> {
  const { data } = await supabaseAdmin
    .from('accounting_ledgers')
    .select('*')
    .eq('org_id', orgId)
    .eq('entity_type', 'org')
    .is('entity_id', null)
    .maybeSingle();
  return data ? mapLedger(data) : null;
}

export async function getOrCreateOrgLedger(orgId: string, orgName: string): Promise<AccountingLedger> {
  const existing = await getOrgLedger(orgId);
  if (existing) return existing;
  const { data } = await supabaseAdmin
    .from('accounting_ledgers')
    .insert({ org_id: orgId, entity_type: 'org', entity_id: null, name: `${orgName} — General` })
    .select()
    .single();
  return mapLedger(data!);
}

export async function getOrgAllLedgers(orgId: string): Promise<AccountingLedger[]> {
  const { data } = await supabaseAdmin
    .from('accounting_ledgers')
    .select('*')
    .eq('org_id', orgId)
    .eq('is_archived', false)
    .order('created_at', { ascending: true });
  return (data ?? []).map(mapLedger);
}

export async function getLedgerById(ledgerId: string, orgId: string): Promise<AccountingLedger | null> {
  const { data } = await supabaseAdmin
    .from('accounting_ledgers')
    .select('*')
    .eq('id', ledgerId)
    .eq('org_id', orgId)
    .maybeSingle();
  return data ? mapLedger(data) : null;
}

export async function getOrCreateTournamentLedger(
  orgId: string,
  tournamentId: string,
  tournamentName: string
): Promise<AccountingLedger> {
  const { data: existing } = await supabaseAdmin
    .from('accounting_ledgers')
    .select('*')
    .eq('org_id', orgId)
    .eq('entity_type', 'tournament')
    .eq('entity_id', tournamentId)
    .maybeSingle();
  if (existing) return mapLedger(existing);
  const { data } = await supabaseAdmin
    .from('accounting_ledgers')
    .insert({ org_id: orgId, entity_type: 'tournament', entity_id: tournamentId, name: tournamentName })
    .select()
    .single();
  return mapLedger(data!);
}

export async function getLedgerEntries(
  ledgerId: string,
  opts: { status?: AccountingEntryStatus; limit?: number; offset?: number } = {}
): Promise<AccountingEntry[]> {
  let q = supabaseAdmin
    .from('accounting_entries')
    .select('*')
    .eq('ledger_id', ledgerId)
    .order('entry_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (opts.status) q = q.eq('status', opts.status);
  if (opts.limit)  q = q.limit(opts.limit);
  if (opts.offset) q = q.range(opts.offset, opts.offset + (opts.limit ?? 50) - 1);
  const { data } = await q;
  return (data ?? []).map(mapEntry);
}

export async function createEntry(
  ledgerId: string,
  input: Pick<AccountingEntry, 'entryDate' | 'description' | 'amount' | 'entryType' | 'status' | 'category'>,
  createdBy: string
): Promise<AccountingEntry> {
  const { data } = await supabaseAdmin
    .from('accounting_entries')
    .insert({
      ledger_id:   ledgerId,
      entry_date:  input.entryDate,
      description: input.description,
      amount:      input.amount,
      entry_type:  input.entryType,
      status:      input.status,
      category:    input.category ?? null,
      created_by:  createdBy,
    })
    .select()
    .single();
  return mapEntry(data!);
}

export async function updateEntry(
  entryId: string,
  ledgerId: string,
  input: Partial<Pick<AccountingEntry, 'entryDate' | 'description' | 'amount' | 'entryType' | 'status' | 'category'>>
): Promise<void> {
  await supabaseAdmin
    .from('accounting_entries')
    .update({
      ...(input.entryDate   !== undefined && { entry_date:  input.entryDate }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.amount      !== undefined && { amount:      input.amount }),
      ...(input.entryType   !== undefined && { entry_type:  input.entryType }),
      ...(input.status      !== undefined && { status:      input.status }),
      ...(input.category    !== undefined && { category:    input.category }),
      updated_at: new Date().toISOString(),
    })
    .eq('id', entryId)
    .eq('ledger_id', ledgerId);
}

export async function voidEntry(entryId: string, ledgerId: string): Promise<void> {
  await supabaseAdmin
    .from('accounting_entries')
    .update({ status: 'void', updated_at: new Date().toISOString() })
    .eq('id', entryId)
    .eq('ledger_id', ledgerId);
}

export async function getLedgerSummary(
  ledger: AccountingLedger,
  opts: { from?: string; to?: string } = {}
): Promise<LedgerSummary> {
  let q = supabaseAdmin
    .from('accounting_entries')
    .select('entry_type, status, amount')
    .eq('ledger_id', ledger.id)
    .neq('status', 'void');
  if (opts.from) q = q.gte('entry_date', opts.from);
  if (opts.to)   q = q.lte('entry_date', opts.to);
  const { data } = await q;
  const rows: { entry_type: string; status: string; amount: number }[] = (data ?? []) as any;
  const sum = (type: AccountingEntryType, status: AccountingEntryStatus) =>
    rows.filter(r => r.entry_type === type && r.status === status)
        .reduce((acc: number, r) => acc + Number(r.amount), 0);
  const postedIncome   = sum('income',  'posted') + sum('transfer_in',  'posted');
  const postedExpenses = sum('expense', 'posted') + sum('transfer_out', 'posted');
  return {
    ledger,
    postedIncome,
    postedExpenses,
    pendingIncome:   sum('income',  'pending'),
    pendingExpenses: sum('expense', 'pending'),
    netPosted:       postedIncome - postedExpenses,
    incomeOnly:      sum('income',  'posted'),
    expensesOnly:    sum('expense', 'posted'),
  };
}

function mapLedger(row: any): AccountingLedger {
  return {
    id:         row.id,
    orgId:      row.org_id,
    entityType: row.entity_type,
    entityId:   row.entity_id ?? null,
    name:       row.name,
    currency:   row.currency,
    isArchived: row.is_archived,
    createdAt:  row.created_at,
  };
}

function mapEntry(row: any): AccountingEntry {
  return {
    id:             row.id,
    ledgerId:       row.ledger_id,
    entryDate:      row.entry_date,
    description:    row.description,
    amount:         Number(row.amount),
    entryType:      row.entry_type,
    status:         row.status,
    category:       row.category ?? null,
    linkedEntryId:  row.linked_entry_id ?? null,
    sourceModule:   row.source_module ?? null,
    sourceEntityId: row.source_entity_id ?? null,
    createdBy:      row.created_by,
    createdAt:      row.created_at,
    updatedAt:      row.updated_at,
  };
}

// ── House League Module ───────────────────────────────────────────────────────

// ─── Input shapes ─────────────────────────────────────────────────────────────

export interface LeagueSeasonInput {
  name: string;
  slug: string;
  sport?: string;
  ageGroup?: string | null;
  description?: string | null;
  registrationFee?: number | null;
  autoGenerateFees?: boolean;
  autoApproveUnderCapacity?: boolean;
  autoPromoteWaitlist?: boolean;
  registrationOpenAt?: string | null;
  registrationCloseAt?: string | null;
  seasonStartDate?: string | null;
  seasonEndDate?: string | null;
  waiverText?: string | null;
}

export interface LeagueTeamInput {
  name: string;
  color?: string | null;
  coachName?: string | null;
  sortOrder?: number;
}

export interface LeagueGameInput {
  seasonId: string;
  divisionId: string;
  homeTeamId: string;
  awayTeamId: string;
  scheduledAt?: string | null;
  location?: string | null;
  notes?: string | null;
}

export interface PublicRegistrationInput {
  seasonId: string;
  divisionId: string | null;
  playerFirstName: string;
  playerLastName: string;
  playerDateOfBirth?: string | null;
  playerJerseyPref?: string | null;
  playerPositionPref?: string | null;
  playerNotes?: string | null;
  guardianFirstName: string;
  guardianLastName: string;
  guardianEmail: string;
  guardianPhone?: string | null;
  status?: LeagueRegistrationStatus;
  waitlistPosition?: number | null;
  source?: 'public_form' | 'admin_manual';
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

function mapLeagueSeason(row: any): LeagueSeason {
  return {
    id:                        row.id,
    orgId:                     row.org_id,
    name:                      row.name,
    slug:                      row.slug,
    sport:                     row.sport,
    ageGroup:                  row.age_group ?? null,
    status:                    row.status,
    description:               row.description ?? null,
    registrationFee:           row.registration_fee != null ? Number(row.registration_fee) : null,
    autoGenerateFees:          row.auto_generate_fees,
    autoApproveUnderCapacity:  row.auto_approve_under_capacity,
    autoPromoteWaitlist:       row.auto_promote_waitlist,
    registrationOpenAt:        row.registration_open_at ?? null,
    registrationCloseAt:       row.registration_close_at ?? null,
    seasonStartDate:           row.season_start_date ?? null,
    seasonEndDate:             row.season_end_date ?? null,
    waiverText:                row.waiver_text ?? null,
    draftState:                row.draft_state ?? null,
    createdAt:                 row.created_at,
    updatedAt:                 row.updated_at,
  };
}

function mapLeagueDivision(row: any): LeagueDivision {
  return {
    id:        row.id,
    seasonId:  row.season_id,
    name:      row.name,
    capacity:  row.capacity ?? null,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

function mapLeagueTeam(row: any): LeagueTeam {
  return {
    id:         row.id,
    seasonId:   row.season_id,
    divisionId: row.division_id,
    name:       row.name,
    color:      row.color ?? null,
    coachName:  row.coach_name ?? null,
    sortOrder:  row.sort_order,
    createdAt:  row.created_at,
  };
}

function mapLeagueRegistration(row: any): LeagueRegistration {
  return {
    id:                  row.id,
    seasonId:            row.season_id,
    divisionId:          row.division_id ?? null,
    playerFirstName:     row.player_first_name,
    playerLastName:      row.player_last_name,
    playerDateOfBirth:   row.player_date_of_birth ?? null,
    playerJerseyPref:    row.player_jersey_pref ?? null,
    playerPositionPref:  row.player_position_pref ?? null,
    playerNotes:         row.player_notes ?? null,
    guardianFirstName:   row.guardian_first_name,
    guardianLastName:    row.guardian_last_name,
    guardianEmail:       row.guardian_email,
    guardianPhone:       row.guardian_phone ?? null,
    status:              row.status,
    waitlistPosition:    row.waitlist_position ?? null,
    teamId:              row.team_id ?? null,
    registrationFeePaid: row.registration_fee_paid,
    feeEntryId:          row.fee_entry_id ?? null,
    adminNotes:          row.admin_notes ?? null,
    source:              row.source,
    registeredAt:        row.registered_at,
    updatedAt:           row.updated_at,
  };
}

function mapLeagueGame(row: any): LeagueGame {
  return {
    id:          row.id,
    seasonId:    row.season_id,
    divisionId:  row.division_id,
    homeTeamId:  row.home_team_id,
    awayTeamId:  row.away_team_id,
    scheduledAt: row.scheduled_at ?? null,
    location:    row.location ?? null,
    homeScore:   row.home_score ?? null,
    awayScore:   row.away_score ?? null,
    status:      row.status,
    notes:       row.notes ?? null,
    createdAt:   row.created_at,
    updatedAt:   row.updated_at,
  };
}

// ─── Season helpers ───────────────────────────────────────────────────────────

export async function getLeagueSeasons(orgId: string): Promise<LeagueSeason[]> {
  const { data } = await supabaseAdmin
    .from('league_seasons')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });
  return (data ?? []).map(mapLeagueSeason);
}

export async function getLeagueSeasonBySlug(orgId: string, slug: string): Promise<LeagueSeason | null> {
  const { data } = await supabaseAdmin
    .from('league_seasons')
    .select('*')
    .eq('org_id', orgId)
    .eq('slug', slug)
    .maybeSingle();
  return data ? mapLeagueSeason(data) : null;
}

export async function getLeagueSeasonById(seasonId: string, orgId: string): Promise<LeagueSeason | null> {
  const { data } = await supabaseAdmin
    .from('league_seasons')
    .select('*')
    .eq('id', seasonId)
    .eq('org_id', orgId)
    .maybeSingle();
  return data ? mapLeagueSeason(data) : null;
}

export async function createLeagueSeason(orgId: string, input: LeagueSeasonInput): Promise<LeagueSeason> {
  const { data } = await supabaseAdmin
    .from('league_seasons')
    .insert({
      org_id:                      orgId,
      name:                        input.name,
      slug:                        input.slug,
      sport:                       input.sport ?? 'softball',
      age_group:                   input.ageGroup ?? null,
      description:                 input.description ?? null,
      registration_fee:            input.registrationFee ?? null,
      auto_generate_fees:          input.autoGenerateFees ?? false,
      auto_approve_under_capacity: input.autoApproveUnderCapacity ?? false,
      auto_promote_waitlist:       input.autoPromoteWaitlist ?? false,
      registration_open_at:        input.registrationOpenAt ?? null,
      registration_close_at:       input.registrationCloseAt ?? null,
      season_start_date:           input.seasonStartDate ?? null,
      season_end_date:             input.seasonEndDate ?? null,
      waiver_text:                 input.waiverText ?? null,
    })
    .select()
    .single();
  return mapLeagueSeason(data!);
}

export async function updateLeagueSeason(
  seasonId: string,
  orgId: string,
  input: Partial<LeagueSeasonInput> & { status?: LeagueSeasonStatus }
): Promise<void> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.name                      !== undefined) patch.name                        = input.name;
  if (input.slug                      !== undefined) patch.slug                        = input.slug;
  if (input.sport                     !== undefined) patch.sport                       = input.sport;
  if (input.ageGroup                  !== undefined) patch.age_group                   = input.ageGroup;
  if (input.description               !== undefined) patch.description                 = input.description;
  if (input.registrationFee           !== undefined) patch.registration_fee            = input.registrationFee;
  if (input.autoGenerateFees          !== undefined) patch.auto_generate_fees          = input.autoGenerateFees;
  if (input.autoApproveUnderCapacity  !== undefined) patch.auto_approve_under_capacity = input.autoApproveUnderCapacity;
  if (input.autoPromoteWaitlist       !== undefined) patch.auto_promote_waitlist       = input.autoPromoteWaitlist;
  if (input.registrationOpenAt        !== undefined) patch.registration_open_at        = input.registrationOpenAt;
  if (input.registrationCloseAt       !== undefined) patch.registration_close_at       = input.registrationCloseAt;
  if (input.seasonStartDate           !== undefined) patch.season_start_date           = input.seasonStartDate;
  if (input.seasonEndDate             !== undefined) patch.season_end_date             = input.seasonEndDate;
  if (input.waiverText                !== undefined) patch.waiver_text                 = input.waiverText;
  if (input.status                    !== undefined) patch.status                      = input.status;
  await supabaseAdmin
    .from('league_seasons')
    .update(patch)
    .eq('id', seasonId)
    .eq('org_id', orgId);
}

// ─── Division helpers ─────────────────────────────────────────────────────────

export async function getDivisionsForSeason(seasonId: string): Promise<LeagueDivision[]> {
  const { data } = await supabaseAdmin
    .from('league_divisions')
    .select('*')
    .eq('season_id', seasonId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  return (data ?? []).map(mapLeagueDivision);
}

export async function createDivision(
  seasonId: string,
  input: { name: string; capacity?: number | null; sortOrder?: number }
): Promise<LeagueDivision> {
  const { data } = await supabaseAdmin
    .from('league_divisions')
    .insert({
      season_id:  seasonId,
      name:       input.name,
      capacity:   input.capacity ?? null,
      sort_order: input.sortOrder ?? 0,
    })
    .select()
    .single();
  return mapLeagueDivision(data!);
}

export async function updateDivision(
  divisionId: string,
  input: Partial<{ name: string; capacity: number | null; sortOrder: number }>
): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (input.name      !== undefined) patch.name       = input.name;
  if (input.capacity  !== undefined) patch.capacity   = input.capacity;
  if (input.sortOrder !== undefined) patch.sort_order = input.sortOrder;
  await supabaseAdmin.from('league_divisions').update(patch).eq('id', divisionId);
}

export async function deleteDivision(divisionId: string): Promise<void> {
  // Guard: caller must verify no active registrations before calling
  await supabaseAdmin.from('league_divisions').delete().eq('id', divisionId);
}

// ─── Team helpers ─────────────────────────────────────────────────────────────

export async function getTeamsForSeason(seasonId: string): Promise<LeagueTeam[]> {
  const { data } = await supabaseAdmin
    .from('league_teams')
    .select('*')
    .eq('season_id', seasonId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  return (data ?? []).map(mapLeagueTeam);
}

export async function getTeamsForDivision(divisionId: string): Promise<LeagueTeam[]> {
  const { data } = await supabaseAdmin
    .from('league_teams')
    .select('*')
    .eq('division_id', divisionId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  return (data ?? []).map(mapLeagueTeam);
}

export async function createLeagueTeam(
  seasonId: string,
  divisionId: string,
  input: LeagueTeamInput
): Promise<LeagueTeam> {
  const { data } = await supabaseAdmin
    .from('league_teams')
    .insert({
      season_id:   seasonId,
      division_id: divisionId,
      name:        input.name,
      color:       input.color ?? null,
      coach_name:  input.coachName ?? null,
      sort_order:  input.sortOrder ?? 0,
    })
    .select()
    .single();
  return mapLeagueTeam(data!);
}

export async function updateLeagueTeam(teamId: string, input: Partial<LeagueTeamInput>): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (input.name      !== undefined) patch.name       = input.name;
  if (input.color     !== undefined) patch.color      = input.color;
  if (input.coachName !== undefined) patch.coach_name = input.coachName;
  if (input.sortOrder !== undefined) patch.sort_order = input.sortOrder;
  await supabaseAdmin.from('league_teams').update(patch).eq('id', teamId);
}

export async function deleteLeagueTeam(teamId: string): Promise<void> {
  // Guard: caller must verify no assigned players before calling
  await supabaseAdmin.from('league_teams').delete().eq('id', teamId);
}

// ─── Registration helpers ─────────────────────────────────────────────────────

export async function getRegistrationsForSeason(
  seasonId: string,
  opts: { status?: LeagueRegistrationStatus } = {}
): Promise<LeagueRegistration[]> {
  let q = supabaseAdmin
    .from('league_registrations')
    .select('*')
    .eq('season_id', seasonId)
    .order('registered_at', { ascending: false });
  if (opts.status) q = q.eq('status', opts.status);
  const { data } = await q;
  return (data ?? []).map(mapLeagueRegistration);
}

export async function getRegistrationsForDivision(
  divisionId: string,
  opts: { status?: LeagueRegistrationStatus } = {}
): Promise<LeagueRegistration[]> {
  let q = supabaseAdmin
    .from('league_registrations')
    .select('*')
    .eq('division_id', divisionId)
    .order('registered_at', { ascending: false });
  if (opts.status) q = q.eq('status', opts.status);
  const { data } = await q;
  return (data ?? []).map(mapLeagueRegistration);
}

export async function createRegistration(input: PublicRegistrationInput): Promise<LeagueRegistration> {
  const { data } = await supabaseAdmin
    .from('league_registrations')
    .insert({
      season_id:            input.seasonId,
      division_id:          input.divisionId ?? null,
      player_first_name:    input.playerFirstName,
      player_last_name:     input.playerLastName,
      player_date_of_birth: input.playerDateOfBirth ?? null,
      player_jersey_pref:   input.playerJerseyPref ?? null,
      player_position_pref: input.playerPositionPref ?? null,
      player_notes:         input.playerNotes ?? null,
      guardian_first_name:  input.guardianFirstName,
      guardian_last_name:   input.guardianLastName,
      guardian_email:       input.guardianEmail,
      guardian_phone:       input.guardianPhone ?? null,
      status:               input.status ?? 'pending_review',
      waitlist_position:    input.waitlistPosition ?? null,
      source:               input.source ?? 'public_form',
    })
    .select()
    .single();
  return mapLeagueRegistration(data!);
}

export async function updateRegistrationStatus(
  registrationId: string,
  status: LeagueRegistrationStatus,
  adminNotes?: string
): Promise<void> {
  const patch: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (adminNotes !== undefined) patch.admin_notes = adminNotes;
  // Clear waitlist_position when moving out of waitlist
  if (status !== 'waitlisted') patch.waitlist_position = null;
  await supabaseAdmin.from('league_registrations').update(patch).eq('id', registrationId);
}

export async function assignRegistrationToTeam(registrationId: string, teamId: string): Promise<void> {
  await supabaseAdmin
    .from('league_registrations')
    .update({ team_id: teamId, updated_at: new Date().toISOString() })
    .eq('id', registrationId);
}

export async function bulkAssignTeams(
  assignments: Array<{ registrationId: string; teamId: string }>
): Promise<void> {
  await Promise.all(assignments.map(a => assignRegistrationToTeam(a.registrationId, a.teamId)));
}

export async function getWaitlistForDivision(divisionId: string): Promise<LeagueRegistration[]> {
  const { data } = await supabaseAdmin
    .from('league_registrations')
    .select('*')
    .eq('division_id', divisionId)
    .eq('status', 'waitlisted')
    .order('waitlist_position', { ascending: true });
  return (data ?? []).map(mapLeagueRegistration);
}

export async function promoteFromWaitlist(registrationId: string): Promise<void> {
  await supabaseAdmin
    .from('league_registrations')
    .update({ status: 'active', waitlist_position: null, updated_at: new Date().toISOString() })
    .eq('id', registrationId);
}

// ─── Game helpers ─────────────────────────────────────────────────────────────

export async function getGamesForDivision(divisionId: string): Promise<LeagueGame[]> {
  const { data } = await supabaseAdmin
    .from('league_games')
    .select('*')
    .eq('division_id', divisionId)
    .order('scheduled_at', { ascending: true });
  return (data ?? []).map(mapLeagueGame);
}

export async function getGamesForSeason(seasonId: string): Promise<LeagueGame[]> {
  const { data } = await supabaseAdmin
    .from('league_games')
    .select('*')
    .eq('season_id', seasonId)
    .neq('status', 'cancelled')
    .order('scheduled_at', { ascending: true });
  return (data ?? []).map(mapLeagueGame);
}

// ─── League practices ─────────────────────────────────────────────────────────

function mapLeaguePractice(row: Record<string, unknown>): LeaguePractice {
  return {
    id:                row.id as string,
    seasonId:          row.season_id as string,
    divisionId:        row.division_id as string | null,
    teamId:            row.team_id as string,
    scheduledAt:       row.scheduled_at as string | null,
    endsAt:            row.ends_at as string | null,
    location:          row.location as string | null,
    notes:             row.notes as string | null,
    status:            row.status as LeaguePracticeStatus,
    recurrenceGroupId: row.recurrence_group_id as string | null,
    createdAt:         row.created_at as string,
    updatedAt:         row.updated_at as string,
  };
}

export async function getPracticesForTeam(teamId: string): Promise<LeaguePractice[]> {
  const { data } = await supabaseAdmin
    .from('league_practices')
    .select('*')
    .eq('team_id', teamId)
    .order('scheduled_at', { ascending: true });
  return (data ?? []).map(mapLeaguePractice);
}

export async function getPracticesForSeason(seasonId: string): Promise<LeaguePractice[]> {
  const { data } = await supabaseAdmin
    .from('league_practices')
    .select('*')
    .eq('season_id', seasonId)
    .order('scheduled_at', { ascending: true });
  return (data ?? []).map(mapLeaguePractice);
}

interface LeaguePracticeInput {
  seasonId: string;
  divisionId: string | null;
  teamId: string;
  scheduledAt: string | null;
  endsAt: string | null;
  location: string | null;
  notes: string | null;
  recurrenceGroupId?: string | null;
}

export async function createPractices(inputs: LeaguePracticeInput[]): Promise<LeaguePractice[]> {
  const { data } = await supabaseAdmin
    .from('league_practices')
    .insert(inputs.map(i => ({
      season_id:           i.seasonId,
      division_id:         i.divisionId ?? null,
      team_id:             i.teamId,
      scheduled_at:        i.scheduledAt ?? null,
      ends_at:             i.endsAt ?? null,
      location:            i.location ?? null,
      notes:               i.notes ?? null,
      recurrence_group_id: i.recurrenceGroupId ?? null,
    })))
    .select();
  return (data ?? []).map(mapLeaguePractice);
}

export async function cancelPractice(
  practiceId: string,
  scope: 'one' | 'remaining' | 'all',
): Promise<void> {
  const patch = { status: 'cancelled', updated_at: new Date().toISOString() };

  if (scope === 'one') {
    await supabaseAdmin.from('league_practices').update(patch).eq('id', practiceId);
    return;
  }

  const { data: p } = await supabaseAdmin
    .from('league_practices')
    .select('recurrence_group_id, scheduled_at')
    .eq('id', practiceId)
    .single();

  if (!p?.recurrence_group_id) {
    await supabaseAdmin.from('league_practices').update(patch).eq('id', practiceId);
    return;
  }

  if (scope === 'all') {
    await supabaseAdmin
      .from('league_practices')
      .update(patch)
      .eq('recurrence_group_id', p.recurrence_group_id);
  } else {
    await supabaseAdmin
      .from('league_practices')
      .update(patch)
      .eq('recurrence_group_id', p.recurrence_group_id)
      .gte('scheduled_at', p.scheduled_at!);
  }
}

export async function createLeagueGame(input: LeagueGameInput): Promise<LeagueGame> {
  const { data } = await supabaseAdmin
    .from('league_games')
    .insert({
      season_id:    input.seasonId,
      division_id:  input.divisionId,
      home_team_id: input.homeTeamId,
      away_team_id: input.awayTeamId,
      scheduled_at: input.scheduledAt ?? null,
      location:     input.location ?? null,
      notes:        input.notes ?? null,
    })
    .select()
    .single();
  return mapLeagueGame(data!);
}

export async function updateLeagueGame(
  gameId: string,
  input: Partial<LeagueGameInput> & { homeScore?: number | null; awayScore?: number | null; status?: string; notes?: string | null }
): Promise<void> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.scheduledAt !== undefined) patch.scheduled_at = input.scheduledAt;
  if (input.location    !== undefined) patch.location     = input.location;
  if (input.homeScore   !== undefined) patch.home_score   = input.homeScore;
  if (input.awayScore   !== undefined) patch.away_score   = input.awayScore;
  if (input.status      !== undefined) patch.status       = input.status;
  if (input.notes       !== undefined) patch.notes        = input.notes;
  await supabaseAdmin.from('league_games').update(patch).eq('id', gameId);
}

export async function enterGameResult(gameId: string, homeScore: number, awayScore: number): Promise<void> {
  await supabaseAdmin
    .from('league_games')
    .update({ home_score: homeScore, away_score: awayScore, status: 'completed', updated_at: new Date().toISOString() })
    .eq('id', gameId);
}

// ─── Standings (computed, not stored) ────────────────────────────────────────

export async function computeStandings(divisionId: string): Promise<LeagueStandingsRow[]> {
  const [teams, games] = await Promise.all([
    getTeamsForDivision(divisionId),
    getGamesForDivision(divisionId),
  ]);
  const completedGames = games.filter(g => g.status === 'completed');

  const rows: LeagueStandingsRow[] = teams.map(team => {
    let wins = 0, losses = 0, ties = 0, runsFor = 0, runsAgainst = 0;
    for (const g of completedGames) {
      const isHome = g.homeTeamId === team.id;
      const isAway = g.awayTeamId === team.id;
      if (!isHome && !isAway) continue;
      const tf = isHome ? (g.homeScore ?? 0) : (g.awayScore ?? 0);
      const ta = isHome ? (g.awayScore ?? 0) : (g.homeScore ?? 0);
      runsFor     += tf;
      runsAgainst += ta;
      if      (tf > ta) wins++;
      else if (tf < ta) losses++;
      else              ties++;
    }
    return {
      team,
      gamesPlayed:     wins + losses + ties,
      wins,
      losses,
      ties,
      points:          wins * 2 + ties,
      runsFor,
      runsAgainst,
      runDifferential: runsFor - runsAgainst,
    };
  });

  return rows.sort((a, b) =>
    b.points - a.points ||
    b.runDifferential - a.runDifferential ||
    b.runsFor - a.runsFor
  );
}

// ─── Season summary ───────────────────────────────────────────────────────────

export async function getLeagueSeasonSummary(season: LeagueSeason): Promise<LeagueSeasonSummary> {
  const [divisions, teams, regs] = await Promise.all([
    getDivisionsForSeason(season.id),
    getTeamsForSeason(season.id),
    getRegistrationsForSeason(season.id),
  ]);
  return {
    season,
    divisionCount:           divisions.length,
    activeRegistrationCount: regs.filter(r => r.status === 'active').length,
    waitlistCount:           regs.filter(r => r.status === 'waitlisted').length,
    pendingReviewCount:      regs.filter(r => r.status === 'pending_review').length,
    teamCount:               teams.length,
  };
}

// ─── League season ledger helpers ─────────────────────────────────────────────

export async function getLeagueSeasonLedger(
  orgId: string,
  seasonId: string,
): Promise<AccountingLedger | null> {
  const { data } = await supabaseAdmin
    .from('accounting_ledgers')
    .select('*')
    .eq('org_id', orgId)
    .eq('entity_type', 'league_season')
    .eq('entity_id', seasonId)
    .maybeSingle();
  return data ? mapLedger(data) : null;
}

export async function getOrCreateLeagueSeasonLedger(
  orgId: string,
  seasonId: string,
  seasonName: string
): Promise<AccountingLedger> {
  const { data: existing } = await supabaseAdmin
    .from('accounting_ledgers')
    .select('*')
    .eq('org_id', orgId)
    .eq('entity_type', 'league_season')
    .eq('entity_id', seasonId)
    .maybeSingle();
  if (existing) return mapLedger(existing);
  const { data } = await supabaseAdmin
    .from('accounting_ledgers')
    .insert({ org_id: orgId, entity_type: 'league_season', entity_id: seasonId, name: seasonName })
    .select()
    .single();
  return mapLedger(data!);
}

export async function createLeagueRegistrationFeeEntry(
  orgId: string,
  seasonId: string,
  seasonName: string,
  regId: string,
  playerName: string,
  amount: number,
  status: AccountingEntryStatus,
  createdBy: string,
): Promise<AccountingEntry> {
  const ledger = await getOrCreateLeagueSeasonLedger(orgId, seasonId, seasonName);
  const { data } = await supabaseAdmin
    .from('accounting_entries')
    .insert({
      ledger_id:        ledger.id,
      entry_date:       new Date().toISOString().slice(0, 10),
      description:      `${playerName} — registration fee`,
      amount,
      entry_type:       'income',
      status,
      category:         'registration_fee',
      source_module:    'league_registration',
      source_entity_id: regId,
      created_by:       createdBy,
    })
    .select()
    .single();
  await supabaseAdmin
    .from('league_registrations')
    .update({ fee_entry_id: data!.id, updated_at: new Date().toISOString() })
    .eq('id', regId);
  return mapEntry(data!);
}

// ── Rep Teams Module ──────────────────────────────────────────────────────────

function mapRepTeam(r: any): RepTeam {
  return {
    id: r.id,
    orgId: r.org_id,
    name: r.name,
    slug: r.slug,
    sport: r.sport,
    ageGroup: r.age_group,
    description: r.description,
    color: r.color,
    isArchived: r.is_archived,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function getRepTeams(orgId: string): Promise<RepTeam[]> {
  const { data, error } = await supabaseAdmin
    .from('rep_teams')
    .select('*')
    .eq('org_id', orgId)
    .order('name');
  if (error) throw error;
  return (data ?? []).map(mapRepTeam);
}

export async function getRepTeam(teamId: string): Promise<RepTeam | null> {
  const { data, error } = await supabaseAdmin
    .from('rep_teams')
    .select('*')
    .eq('id', teamId)
    .single();
  if (error) return null;
  return mapRepTeam(data);
}

export async function getRepTeamBySlug(orgId: string, slug: string): Promise<RepTeam | null> {
  const { data, error } = await supabaseAdmin
    .from('rep_teams')
    .select('*')
    .eq('org_id', orgId)
    .eq('slug', slug)
    .single();
  if (error) return null;
  return mapRepTeam(data);
}

export async function createRepTeam(orgId: string, fields: {
  name: string;
  slug: string;
  sport: string;
  ageGroup?: string | null;
  description?: string | null;
  color?: string | null;
}): Promise<RepTeam> {
  const { data, error } = await supabaseAdmin
    .from('rep_teams')
    .insert({
      org_id: orgId,
      name: fields.name,
      slug: fields.slug,
      sport: fields.sport,
      age_group: fields.ageGroup ?? null,
      description: fields.description ?? null,
      color: fields.color ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return mapRepTeam(data);
}

export async function updateRepTeam(teamId: string, fields: {
  name?: string;
  sport?: string;
  ageGroup?: string | null;
  description?: string | null;
  color?: string | null;
  isArchived?: boolean;
}): Promise<RepTeam> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (fields.name !== undefined) patch.name = fields.name;
  if (fields.sport !== undefined) patch.sport = fields.sport;
  if (fields.ageGroup !== undefined) patch.age_group = fields.ageGroup;
  if (fields.description !== undefined) patch.description = fields.description;
  if (fields.color !== undefined) patch.color = fields.color;
  if (fields.isArchived !== undefined) patch.is_archived = fields.isArchived;
  const { data, error } = await supabaseAdmin
    .from('rep_teams')
    .update(patch)
    .eq('id', teamId)
    .select()
    .single();
  if (error) throw error;
  return mapRepTeam(data);
}

export async function deleteRepTeam(teamId: string): Promise<void> {
  const { error } = await supabaseAdmin.from('rep_teams').delete().eq('id', teamId);
  if (error) throw error;
}

export async function bulkRenameTeamSlugs(
  orgId: string,
  renames: Array<{ teamId: string; newSlug: string }>,
): Promise<void> {
  if (renames.length === 0) return;

  // Snapshot current slugs for best-effort rollback on failure
  const { data: snapshot } = await supabaseAdmin
    .from('rep_teams')
    .select('id, slug')
    .in('id', renames.map(r => r.teamId))
    .eq('org_id', orgId);
  const original = new Map((snapshot ?? []).map(r => [r.id as string, r.slug as string]));

  try {
    // Phase 1: move every changing team to a guaranteed-unique temp slug.
    // This resolves any circular dependency (A→B, B→C, C→A) by vacating
    // all "departing" slugs before any "arriving" ones are written.
    for (const { teamId } of renames) {
      const { error } = await supabaseAdmin
        .from('rep_teams')
        .update({ slug: `__tmp_${teamId}` })
        .eq('id', teamId)
        .eq('org_id', orgId);
      if (error) throw error;
    }

    // Phase 2: apply final slugs — all target slots are now free
    for (const { teamId, newSlug } of renames) {
      const { error } = await supabaseAdmin
        .from('rep_teams')
        .update({ slug: newSlug, updated_at: new Date().toISOString() })
        .eq('id', teamId)
        .eq('org_id', orgId);
      if (error) throw error;
    }
  } catch (err) {
    // Best-effort rollback: restore original slugs so no team is stuck with a __tmp_ slug
    for (const { teamId } of renames) {
      const prev = original.get(teamId);
      if (prev) {
        try {
          await supabaseAdmin
            .from('rep_teams')
            .update({ slug: prev })
            .eq('id', teamId)
            .eq('org_id', orgId);
        } catch {
          // ignore rollback errors — the admin will see teams with __tmp_ slugs
          // and can re-run the rename to recover
        }
      }
    }
    throw err;
  }
}

// Program Years

function mapRepProgramYear(r: any): RepProgramYear {
  return {
    id: r.id,
    teamId: r.team_id,
    orgId: r.org_id,
    name: r.name,
    year: r.year,
    status: r.status,
    tryoutOpen: r.tryout_open,
    tryoutDescription: r.tryout_description,
    budgetAmount: r.budget_amount != null ? Number(r.budget_amount) : null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function getRepProgramYears(teamId: string): Promise<RepProgramYear[]> {
  const { data, error } = await supabaseAdmin
    .from('rep_program_years')
    .select('*')
    .eq('team_id', teamId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapRepProgramYear);
}

export async function getRepProgramYear(yearId: string): Promise<RepProgramYear | null> {
  const { data, error } = await supabaseAdmin
    .from('rep_program_years')
    .select('*')
    .eq('id', yearId)
    .single();
  if (error) return null;
  return mapRepProgramYear(data);
}

export async function createRepProgramYear(teamId: string, orgId: string, fields: {
  name: string;
  year: number;
  tryoutOpen?: boolean;
  tryoutDescription?: string | null;
}): Promise<RepProgramYear> {
  const { data, error } = await supabaseAdmin
    .from('rep_program_years')
    .insert({
      team_id: teamId,
      org_id: orgId,
      name: fields.name,
      year: fields.year,
      tryout_open: fields.tryoutOpen ?? false,
      tryout_description: fields.tryoutDescription ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return mapRepProgramYear(data);
}

export async function updateRepProgramYear(yearId: string, fields: {
  name?: string;
  status?: RepProgramYearStatus;
  tryoutOpen?: boolean;
  tryoutDescription?: string | null;
  budgetAmount?: number | null;
}): Promise<RepProgramYear> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (fields.name !== undefined) patch.name = fields.name;
  if (fields.status !== undefined) patch.status = fields.status;
  if (fields.tryoutOpen !== undefined) patch.tryout_open = fields.tryoutOpen;
  if (fields.tryoutDescription !== undefined) patch.tryout_description = fields.tryoutDescription;
  if (fields.budgetAmount !== undefined) patch.budget_amount = fields.budgetAmount;
  const { data, error } = await supabaseAdmin
    .from('rep_program_years')
    .update(patch)
    .eq('id', yearId)
    .select()
    .single();
  if (error) throw error;
  return mapRepProgramYear(data);
}

// Team Coaches

function mapRepTeamCoach(r: any): RepTeamCoach {
  return {
    id: r.id,
    programYearId: r.program_year_id,
    teamId: r.team_id,
    orgId: r.org_id,
    userId: r.user_id,
    coachRole: r.coach_role,
    createdAt: r.created_at,
  };
}

export async function getRepTeamCoaches(programYearId: string): Promise<RepTeamCoach[]> {
  const { data, error } = await supabaseAdmin
    .from('rep_team_coaches')
    .select('*')
    .eq('program_year_id', programYearId)
    .order('created_at');
  if (error) throw error;
  return (data ?? []).map(mapRepTeamCoach);
}

export async function addRepTeamCoach(
  programYearId: string,
  teamId: string,
  orgId: string,
  userId: string,
  coachRole: 'head_coach' | 'assistant_coach' = 'head_coach',
): Promise<RepTeamCoach> {
  const { data, error } = await supabaseAdmin
    .from('rep_team_coaches')
    .insert({ program_year_id: programYearId, team_id: teamId, org_id: orgId, user_id: userId, coach_role: coachRole })
    .select()
    .single();
  if (error) throw error;
  return mapRepTeamCoach(data);
}

export async function removeRepTeamCoach(coachId: string): Promise<void> {
  const { error } = await supabaseAdmin.from('rep_team_coaches').delete().eq('id', coachId);
  if (error) throw error;
}

// Tryout Registrations

function mapRepTryoutRegistration(r: any): RepTryoutRegistration {
  return {
    id: r.id,
    programYearId: r.program_year_id,
    teamId: r.team_id,
    orgId: r.org_id,
    playerFirstName: r.player_first_name,
    playerLastName: r.player_last_name,
    playerDateOfBirth: r.player_date_of_birth,
    playerNotes: r.player_notes,
    guardianFirstName: r.guardian_first_name,
    guardianLastName: r.guardian_last_name,
    guardianEmail: r.guardian_email,
    guardianPhone: r.guardian_phone,
    status: r.status,
    adminNotes: r.admin_notes,
    submittedAt: r.submitted_at,
    updatedAt: r.updated_at,
  };
}

export async function getRepTryoutRegistrations(programYearId: string): Promise<RepTryoutRegistration[]> {
  const { data, error } = await supabaseAdmin
    .from('rep_tryout_registrations')
    .select('*')
    .eq('program_year_id', programYearId)
    .order('registered_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapRepTryoutRegistration);
}

export async function getRepTryoutRegistration(regId: string): Promise<RepTryoutRegistration | null> {
  const { data, error } = await supabaseAdmin
    .from('rep_tryout_registrations')
    .select('*')
    .eq('id', regId)
    .single();
  if (error) return null;
  return mapRepTryoutRegistration(data);
}

export async function createRepTryoutRegistration(fields: {
  programYearId: string;
  teamId: string;
  orgId: string;
  playerFirstName: string;
  playerLastName: string;
  playerDateOfBirth?: string | null;
  playerNotes?: string | null;
  guardianFirstName: string;
  guardianLastName: string;
  guardianEmail: string;
  guardianPhone?: string | null;
}): Promise<RepTryoutRegistration> {
  const { data, error } = await supabaseAdmin
    .from('rep_tryout_registrations')
    .insert({
      program_year_id: fields.programYearId,
      team_id: fields.teamId,
      org_id: fields.orgId,
      player_first_name: fields.playerFirstName,
      player_last_name: fields.playerLastName,
      player_date_of_birth: fields.playerDateOfBirth ?? null,
      player_notes: fields.playerNotes ?? null,
      guardian_first_name: fields.guardianFirstName,
      guardian_last_name: fields.guardianLastName,
      guardian_email: fields.guardianEmail,
      guardian_phone: fields.guardianPhone ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return mapRepTryoutRegistration(data);
}

export async function updateRepTryoutRegistrationStatus(
  regId: string,
  status: RepTryoutRegistrationStatus,
  adminNotes?: string | null,
): Promise<RepTryoutRegistration> {
  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (adminNotes !== undefined) patch.admin_notes = adminNotes;
  const { data, error } = await supabaseAdmin
    .from('rep_tryout_registrations')
    .update(patch)
    .eq('id', regId)
    .select()
    .single();
  if (error) throw error;
  return mapRepTryoutRegistration(data);
}

// Roster Players

function mapRepRosterPlayer(r: any): RepRosterPlayer {
  return {
    id: r.id,
    programYearId: r.program_year_id,
    orgId: r.org_id,
    tryoutRegistrationId: r.tryout_registration_id,
    playerFirstName: r.player_first_name,
    playerLastName: r.player_last_name,
    playerDateOfBirth: r.player_date_of_birth,
    jerseyNumber: r.jersey_number,
    position: r.position,
    status: r.status,
    guardianFirstName: r.guardian_first_name,
    guardianLastName: r.guardian_last_name,
    guardianEmail: r.guardian_email,
    guardianPhone: r.guardian_phone,
    adminNotes: r.admin_notes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function getRepRosterPlayers(programYearId: string): Promise<RepRosterPlayer[]> {
  const { data, error } = await supabaseAdmin
    .from('rep_roster_players')
    .select('*')
    .eq('program_year_id', programYearId)
    .order('player_last_name');
  if (error) throw error;
  return (data ?? []).map(mapRepRosterPlayer);
}

export async function getRepRosterPlayer(playerId: string): Promise<RepRosterPlayer | null> {
  const { data, error } = await supabaseAdmin
    .from('rep_roster_players')
    .select('*')
    .eq('id', playerId)
    .single();
  if (error) return null;
  return mapRepRosterPlayer(data);
}

export async function createRepRosterPlayer(fields: {
  programYearId: string;
  orgId: string;
  tryoutRegistrationId?: string | null;
  playerFirstName: string;
  playerLastName: string;
  playerDateOfBirth?: string | null;
  jerseyNumber?: string | null;
  position?: string | null;
  guardianFirstName?: string | null;
  guardianLastName?: string | null;
  guardianEmail?: string | null;
  guardianPhone?: string | null;
  adminNotes?: string | null;
}): Promise<RepRosterPlayer> {
  const { data, error } = await supabaseAdmin
    .from('rep_roster_players')
    .insert({
      program_year_id: fields.programYearId,
      org_id: fields.orgId,
      tryout_registration_id: fields.tryoutRegistrationId ?? null,
      player_first_name: fields.playerFirstName,
      player_last_name: fields.playerLastName,
      player_date_of_birth: fields.playerDateOfBirth ?? null,
      jersey_number: fields.jerseyNumber ?? null,
      position: fields.position ?? null,
      guardian_first_name: fields.guardianFirstName ?? null,
      guardian_last_name: fields.guardianLastName ?? null,
      guardian_email: fields.guardianEmail ?? null,
      guardian_phone: fields.guardianPhone ?? null,
      admin_notes: fields.adminNotes ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return mapRepRosterPlayer(data);
}

export async function updateRepRosterPlayer(playerId: string, fields: {
  playerFirstName?: string;
  playerLastName?: string;
  playerDateOfBirth?: string | null;
  jerseyNumber?: string | null;
  position?: string | null;
  status?: RepRosterStatus;
  guardianFirstName?: string | null;
  guardianLastName?: string | null;
  guardianEmail?: string | null;
  guardianPhone?: string | null;
  adminNotes?: string | null;
}): Promise<RepRosterPlayer> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (fields.playerFirstName !== undefined) patch.player_first_name = fields.playerFirstName;
  if (fields.playerLastName !== undefined) patch.player_last_name = fields.playerLastName;
  if (fields.playerDateOfBirth !== undefined) patch.player_date_of_birth = fields.playerDateOfBirth;
  if (fields.jerseyNumber !== undefined) patch.jersey_number = fields.jerseyNumber;
  if (fields.position !== undefined) patch.position = fields.position;
  if (fields.status !== undefined) patch.status = fields.status;
  if (fields.guardianFirstName !== undefined) patch.guardian_first_name = fields.guardianFirstName;
  if (fields.guardianLastName !== undefined) patch.guardian_last_name = fields.guardianLastName;
  if (fields.guardianEmail !== undefined) patch.guardian_email = fields.guardianEmail;
  if (fields.guardianPhone !== undefined) patch.guardian_phone = fields.guardianPhone;
  if (fields.adminNotes !== undefined) patch.admin_notes = fields.adminNotes;
  const { data, error } = await supabaseAdmin
    .from('rep_roster_players')
    .update(patch)
    .eq('id', playerId)
    .select()
    .single();
  if (error) throw error;
  return mapRepRosterPlayer(data);
}

export async function deleteRepRosterPlayer(playerId: string): Promise<void> {
  const { error } = await supabaseAdmin.from('rep_roster_players').delete().eq('id', playerId);
  if (error) throw error;
}

// Team Events

function mapRepTeamEvent(r: any): RepTeamEvent {
  return {
    id: r.id,
    programYearId: r.program_year_id,
    orgId: r.org_id,
    eventType: r.event_type,
    title: r.title,
    scheduledAt: r.scheduled_at,
    endsAt: r.ends_at,
    location: r.location,
    opponent: r.opponent,
    notes: r.notes,
    status: r.status,
    parentEventId: r.parent_event_id,
    recurrenceParentId: r.recurrence_parent_id,
    recurrenceRule: r.recurrence_rule,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function getRepTeamEvents(programYearId: string): Promise<RepTeamEvent[]> {
  const { data, error } = await supabaseAdmin
    .from('rep_team_events')
    .select('*')
    .eq('program_year_id', programYearId)
    .order('scheduled_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapRepTeamEvent);
}

export async function createRepTeamEvent(fields: {
  programYearId: string;
  orgId: string;
  eventType: RepEventType;
  title: string;
  scheduledAt?: string | null;
  endsAt?: string | null;
  location?: string | null;
  opponent?: string | null;
  notes?: string | null;
  parentEventId?: string | null;
  recurrenceParentId?: string | null;
  recurrenceRule?: Record<string, unknown> | null;
}): Promise<RepTeamEvent> {
  const { data, error } = await supabaseAdmin
    .from('rep_team_events')
    .insert({
      program_year_id: fields.programYearId,
      org_id: fields.orgId,
      event_type: fields.eventType,
      title: fields.title,
      scheduled_at: fields.scheduledAt ?? null,
      ends_at: fields.endsAt ?? null,
      location: fields.location ?? null,
      opponent: fields.opponent ?? null,
      notes: fields.notes ?? null,
      parent_event_id: fields.parentEventId ?? null,
      recurrence_parent_id: fields.recurrenceParentId ?? null,
      recurrence_rule: fields.recurrenceRule ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return mapRepTeamEvent(data);
}

export async function updateRepTeamEvent(eventId: string, fields: {
  eventType?: RepEventType;
  title?: string;
  scheduledAt?: string | null;
  endsAt?: string | null;
  location?: string | null;
  opponent?: string | null;
  notes?: string | null;
  status?: RepEventStatus;
}): Promise<RepTeamEvent> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (fields.eventType !== undefined) patch.event_type = fields.eventType;
  if (fields.title !== undefined) patch.title = fields.title;
  if (fields.scheduledAt !== undefined) patch.scheduled_at = fields.scheduledAt;
  if (fields.endsAt !== undefined) patch.ends_at = fields.endsAt;
  if (fields.location !== undefined) patch.location = fields.location;
  if (fields.opponent !== undefined) patch.opponent = fields.opponent;
  if (fields.notes !== undefined) patch.notes = fields.notes;
  if (fields.status !== undefined) patch.status = fields.status;
  const { data, error } = await supabaseAdmin
    .from('rep_team_events')
    .update(patch)
    .eq('id', eventId)
    .select()
    .single();
  if (error) throw error;
  return mapRepTeamEvent(data);
}

export async function deleteRepTeamEvent(eventId: string): Promise<void> {
  const { error } = await supabaseAdmin.from('rep_team_events').delete().eq('id', eventId);
  if (error) throw error;
}

// Document Templates

function mapRepDocumentTemplate(r: any): RepDocumentTemplate {
  return {
    id: r.id,
    orgId: r.org_id,
    name: r.name,
    description: r.description,
    documentType: r.document_type,
    isRequired: r.is_required,
    isActive: r.is_active,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function getRepDocumentTemplates(orgId: string): Promise<RepDocumentTemplate[]> {
  const { data, error } = await supabaseAdmin
    .from('rep_document_templates')
    .select('*')
    .eq('org_id', orgId)
    .order('name');
  if (error) throw error;
  return (data ?? []).map(mapRepDocumentTemplate);
}

export async function createRepDocumentTemplate(fields: {
  orgId: string;
  name: string;
  description?: string | null;
  documentType: RepDocumentType;
  isRequired?: boolean;
}): Promise<RepDocumentTemplate> {
  const { data, error } = await supabaseAdmin
    .from('rep_document_templates')
    .insert({
      org_id: fields.orgId,
      name: fields.name,
      description: fields.description ?? null,
      document_type: fields.documentType,
      is_required: fields.isRequired ?? true,
    })
    .select()
    .single();
  if (error) throw error;
  return mapRepDocumentTemplate(data);
}

export async function updateRepDocumentTemplate(templateId: string, fields: {
  name?: string;
  description?: string | null;
  documentType?: RepDocumentType;
  isRequired?: boolean;
  isActive?: boolean;
}): Promise<RepDocumentTemplate> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (fields.name !== undefined) patch.name = fields.name;
  if (fields.description !== undefined) patch.description = fields.description;
  if (fields.documentType !== undefined) patch.document_type = fields.documentType;
  if (fields.isRequired !== undefined) patch.is_required = fields.isRequired;
  if (fields.isActive !== undefined) patch.is_active = fields.isActive;
  const { data, error } = await supabaseAdmin
    .from('rep_document_templates')
    .update(patch)
    .eq('id', templateId)
    .select()
    .single();
  if (error) throw error;
  return mapRepDocumentTemplate(data);
}

export async function deleteRepDocumentTemplate(templateId: string): Promise<void> {
  const { error } = await supabaseAdmin.from('rep_document_templates').delete().eq('id', templateId);
  if (error) throw error;
}

// Player Documents

function mapRepPlayerDocument(r: any): RepPlayerDocument {
  return {
    id: r.id,
    rosterPlayerId: r.roster_player_id,
    orgId: r.org_id,
    templateId: r.template_id,
    documentType: r.document_type,
    fileName: r.file_name,
    storagePath: r.storage_path,
    mimeType: r.mime_type,
    status: r.status,
    adminNotes: r.admin_notes,
    uploadedBy: r.uploaded_by,
    uploadedAt: r.uploaded_at,
    reviewedBy: r.reviewed_by,
    reviewedAt: r.reviewed_at,
    updatedAt: r.updated_at,
  };
}

export async function getRepPlayerDocuments(rosterPlayerId: string): Promise<RepPlayerDocument[]> {
  const { data, error } = await supabaseAdmin
    .from('rep_player_documents')
    .select('*')
    .eq('roster_player_id', rosterPlayerId)
    .order('uploaded_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapRepPlayerDocument);
}

export async function createRepPlayerDocument(fields: {
  rosterPlayerId: string;
  orgId: string;
  templateId?: string | null;
  documentType: RepDocumentType;
  fileName: string;
  storagePath: string;
  mimeType: string;
  uploadedBy?: string | null;
}): Promise<RepPlayerDocument> {
  const { data, error } = await supabaseAdmin
    .from('rep_player_documents')
    .insert({
      roster_player_id: fields.rosterPlayerId,
      org_id: fields.orgId,
      template_id: fields.templateId ?? null,
      document_type: fields.documentType,
      file_name: fields.fileName,
      storage_path: fields.storagePath,
      mime_type: fields.mimeType,
      uploaded_by: fields.uploadedBy ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return mapRepPlayerDocument(data);
}

export async function updateRepPlayerDocumentStatus(
  docId: string,
  status: RepDocumentStatus,
  reviewedBy: string | null,
  adminNotes?: string | null,
): Promise<RepPlayerDocument> {
  const patch: Record<string, unknown> = {
    status,
    reviewed_by: reviewedBy,
    reviewed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (adminNotes !== undefined) patch.admin_notes = adminNotes;
  const { data, error } = await supabaseAdmin
    .from('rep_player_documents')
    .update(patch)
    .eq('id', docId)
    .select()
    .single();
  if (error) throw error;
  return mapRepPlayerDocument(data);
}

export async function deleteRepPlayerDocument(docId: string): Promise<void> {
  const { error } = await supabaseAdmin.from('rep_player_documents').delete().eq('id', docId);
  if (error) throw error;
}

// Cost Allocations

function mapRepCostAllocation(r: any): RepCostAllocation {
  return {
    id: r.id,
    orgId: r.org_id,
    programYearId: r.program_year_id,
    description: r.description,
    totalAmount: Number(r.total_amount),
    allocationMethod: r.allocation_method,
    entryId: r.entry_id,
    notes: r.notes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function getRepCostAllocations(programYearId: string): Promise<RepCostAllocation[]> {
  const { data, error } = await supabaseAdmin
    .from('rep_cost_allocations')
    .select('*')
    .eq('program_year_id', programYearId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapRepCostAllocation);
}

export async function createRepCostAllocation(fields: {
  orgId: string;
  programYearId: string;
  description: string;
  totalAmount: number;
  allocationMethod: 'equal' | 'manual';
  entryId?: string | null;
  notes?: string | null;
}): Promise<RepCostAllocation> {
  const { data, error } = await supabaseAdmin
    .from('rep_cost_allocations')
    .insert({
      org_id: fields.orgId,
      program_year_id: fields.programYearId,
      description: fields.description,
      total_amount: fields.totalAmount,
      allocation_method: fields.allocationMethod,
      entry_id: fields.entryId ?? null,
      notes: fields.notes ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return mapRepCostAllocation(data);
}

// Allocation Splits

function mapRepAllocationSplit(r: any): RepAllocationSplit {
  return {
    id: r.id,
    allocationId: r.allocation_id,
    repTeamId: r.rep_team_id,
    amount: Number(r.amount),
    createdAt: r.created_at,
  };
}

export async function getRepAllocationSplits(allocationId: string): Promise<RepAllocationSplit[]> {
  const { data, error } = await supabaseAdmin
    .from('rep_allocation_splits')
    .select('*')
    .eq('allocation_id', allocationId);
  if (error) throw error;
  return (data ?? []).map(mapRepAllocationSplit);
}

export async function createRepAllocationSplit(fields: {
  allocationId: string;
  repTeamId: string;
  amount: number;
}): Promise<RepAllocationSplit> {
  const { data, error } = await supabaseAdmin
    .from('rep_allocation_splits')
    .insert({ allocation_id: fields.allocationId, rep_team_id: fields.repTeamId, amount: fields.amount })
    .select()
    .single();
  if (error) throw error;
  return mapRepAllocationSplit(data);
}

// Allocation Installments

function mapRepAllocationInstallment(r: any): RepAllocationInstallment {
  return {
    id: r.id,
    splitId: r.split_id,
    dueDate: r.due_date,
    amount: Number(r.amount),
    paid: r.paid,
    paidAt: r.paid_at,
    entryId: r.entry_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function getRepAllocationInstallments(splitId: string): Promise<RepAllocationInstallment[]> {
  const { data, error } = await supabaseAdmin
    .from('rep_allocation_installments')
    .select('*')
    .eq('split_id', splitId)
    .order('due_date');
  if (error) throw error;
  return (data ?? []).map(mapRepAllocationInstallment);
}

export async function createRepAllocationInstallment(fields: {
  splitId: string;
  dueDate: string;
  amount: number;
}): Promise<RepAllocationInstallment> {
  const { data, error } = await supabaseAdmin
    .from('rep_allocation_installments')
    .insert({ split_id: fields.splitId, due_date: fields.dueDate, amount: fields.amount })
    .select()
    .single();
  if (error) throw error;
  return mapRepAllocationInstallment(data);
}

export async function markRepAllocationInstallmentPaid(
  installmentId: string,
  entryId: string | null,
): Promise<RepAllocationInstallment> {
  const { data, error } = await supabaseAdmin
    .from('rep_allocation_installments')
    .update({ paid: true, paid_at: new Date().toISOString(), entry_id: entryId, updated_at: new Date().toISOString() })
    .eq('id', installmentId)
    .select()
    .single();
  if (error) throw error;
  return mapRepAllocationInstallment(data);
}

// Player Dues Schedules

function mapRepPlayerDuesSchedule(r: any): RepPlayerDuesSchedule {
  return {
    id: r.id,
    programYearId: r.program_year_id,
    rosterPlayerId: r.roster_player_id,
    orgId: r.org_id,
    totalAmount: Number(r.total_amount),
    notes: r.notes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function getRepPlayerDuesSchedules(programYearId: string): Promise<RepPlayerDuesSchedule[]> {
  const { data, error } = await supabaseAdmin
    .from('rep_player_dues_schedules')
    .select('*')
    .eq('program_year_id', programYearId)
    .order('created_at');
  if (error) throw error;
  return (data ?? []).map(mapRepPlayerDuesSchedule);
}

export async function getRepPlayerDuesSchedule(
  playerId: string,
  programYearId: string,
): Promise<RepPlayerDuesSchedule | null> {
  const { data, error } = await supabaseAdmin
    .from('rep_player_dues_schedules')
    .select('*')
    .eq('roster_player_id', playerId)
    .eq('program_year_id', programYearId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapRepPlayerDuesSchedule(data);
}

export async function createRepPlayerDuesSchedule(fields: {
  programYearId: string;
  rosterPlayerId: string;
  orgId: string;
  totalAmount: number;
  notes?: string | null;
}): Promise<RepPlayerDuesSchedule> {
  const { data, error } = await supabaseAdmin
    .from('rep_player_dues_schedules')
    .insert({
      program_year_id: fields.programYearId,
      roster_player_id: fields.rosterPlayerId,
      org_id: fields.orgId,
      total_amount: fields.totalAmount,
      notes: fields.notes ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return mapRepPlayerDuesSchedule(data);
}

export async function updateRepPlayerDuesSchedule(scheduleId: string, fields: {
  totalAmount?: number;
  notes?: string | null;
}): Promise<RepPlayerDuesSchedule> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (fields.totalAmount !== undefined) patch.total_amount = fields.totalAmount;
  if (fields.notes !== undefined) patch.notes = fields.notes;
  const { data, error } = await supabaseAdmin
    .from('rep_player_dues_schedules')
    .update(patch)
    .eq('id', scheduleId)
    .select()
    .single();
  if (error) throw error;
  return mapRepPlayerDuesSchedule(data);
}

// Player Dues Installments

function mapRepPlayerDuesInstallment(r: any): RepPlayerDuesInstallment {
  return {
    id: r.id,
    duesScheduleId: r.dues_schedule_id,
    dueDate: r.due_date,
    amount: Number(r.amount),
    paid: r.paid,
    paidAt: r.paid_at,
    entryId: r.entry_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function getRepPlayerDuesInstallments(duesScheduleId: string): Promise<RepPlayerDuesInstallment[]> {
  const { data, error } = await supabaseAdmin
    .from('rep_player_dues_installments')
    .select('*')
    .eq('dues_schedule_id', duesScheduleId)
    .order('due_date');
  if (error) throw error;
  return (data ?? []).map(mapRepPlayerDuesInstallment);
}

export async function createRepPlayerDuesInstallment(fields: {
  duesScheduleId: string;
  dueDate: string;
  amount: number;
}): Promise<RepPlayerDuesInstallment> {
  const { data, error } = await supabaseAdmin
    .from('rep_player_dues_installments')
    .insert({ dues_schedule_id: fields.duesScheduleId, due_date: fields.dueDate, amount: fields.amount })
    .select()
    .single();
  if (error) throw error;
  return mapRepPlayerDuesInstallment(data);
}

export async function markRepPlayerDuesInstallmentPaid(
  installmentId: string,
  entryId: string | null,
): Promise<RepPlayerDuesInstallment> {
  const { data, error } = await supabaseAdmin
    .from('rep_player_dues_installments')
    .update({ paid: true, paid_at: new Date().toISOString(), entry_id: entryId, updated_at: new Date().toISOString() })
    .eq('id', installmentId)
    .select()
    .single();
  if (error) throw error;
  return mapRepPlayerDuesInstallment(data);
}

// Team Expenses

function mapRepTeamExpense(r: any): RepTeamExpense {
  return {
    id: r.id,
    programYearId: r.program_year_id,
    orgId: r.org_id,
    description: r.description,
    amount: Number(r.amount),
    expenseDate: r.expense_date,
    category: r.category,
    entryId: r.entry_id,
    notes: r.notes,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function getRepTeamExpenses(programYearId: string): Promise<RepTeamExpense[]> {
  const { data, error } = await supabaseAdmin
    .from('rep_team_expenses')
    .select('*')
    .eq('program_year_id', programYearId)
    .order('expense_date', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapRepTeamExpense);
}

export async function createRepTeamExpense(fields: {
  programYearId: string;
  orgId: string;
  description: string;
  amount: number;
  expenseDate: string;
  category?: string | null;
  entryId?: string | null;
  notes?: string | null;
  createdBy?: string | null;
}): Promise<RepTeamExpense> {
  const { data, error } = await supabaseAdmin
    .from('rep_team_expenses')
    .insert({
      program_year_id: fields.programYearId,
      org_id: fields.orgId,
      description: fields.description,
      amount: fields.amount,
      expense_date: fields.expenseDate,
      category: fields.category ?? null,
      entry_id: fields.entryId ?? null,
      notes: fields.notes ?? null,
      created_by: fields.createdBy ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return mapRepTeamExpense(data);
}

export async function updateRepTeamExpense(expenseId: string, fields: {
  description?: string;
  amount?: number;
  expenseDate?: string;
  category?: string | null;
  entryId?: string | null;
  notes?: string | null;
}): Promise<RepTeamExpense> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (fields.description !== undefined) patch.description = fields.description;
  if (fields.amount !== undefined) patch.amount = fields.amount;
  if (fields.expenseDate !== undefined) patch.expense_date = fields.expenseDate;
  if (fields.category !== undefined) patch.category = fields.category;
  if (fields.entryId !== undefined) patch.entry_id = fields.entryId;
  if (fields.notes !== undefined) patch.notes = fields.notes;
  const { data, error } = await supabaseAdmin
    .from('rep_team_expenses')
    .update(patch)
    .eq('id', expenseId)
    .select()
    .single();
  if (error) throw error;
  return mapRepTeamExpense(data);
}

export async function deleteRepTeamExpense(expenseId: string): Promise<void> {
  const { error } = await supabaseAdmin.from('rep_team_expenses').delete().eq('id', expenseId);
  if (error) throw error;
}
