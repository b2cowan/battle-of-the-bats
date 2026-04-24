import { supabase } from './supabase';
import { Tournament, Diamond, Contact, AgeGroup, Team, Game, Announcement } from './types';

// --- Tournaments ---
export async function getTournaments(): Promise<Tournament[]> {
  const { data, error } = await supabase.from('tournaments').select('*').order('year', { ascending: false });
  if (error) { console.error('getTournaments error', error); return []; }
  return data.map(t => ({ id: t.id, year: t.year, name: t.name, isActive: t.is_active }));
}

export async function saveTournament(t: Omit<Tournament, 'id'>): Promise<void> {
  await supabase.from('tournaments').insert({ year: t.year, name: t.name, is_active: t.isActive });
}

export async function updateTournament(id: string, t: Partial<Tournament>): Promise<void> {
  const updates: any = {};
  if (t.year !== undefined) updates.year = t.year;
  if (t.name !== undefined) updates.name = t.name;
  if (t.isActive !== undefined) updates.is_active = t.isActive;
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
export async function getDiamonds(): Promise<Diamond[]> {
  const { data, error } = await supabase.from('diamonds').select('*').order('name', { ascending: true });
  if (error) { console.error('getDiamonds error', error); return []; }
  return data.map(d => ({ id: d.id, name: d.name, address: d.address, notes: d.notes }));
}

export async function saveDiamond(d: Omit<Diamond, 'id'>): Promise<void> {
  await supabase.from('diamonds').insert(d);
}

export async function updateDiamond(id: string, d: Partial<Diamond>): Promise<void> {
  await supabase.from('diamonds').update(d).eq('id', id);
}

export async function deleteDiamond(id: string): Promise<void> {
  await supabase.from('diamonds').delete().eq('id', id);
}

// --- Contacts ---
export async function getContacts(): Promise<Contact[]> {
  const { data, error } = await supabase.from('contacts').select('*').order('name', { ascending: true });
  if (error) { console.error('getContacts error', error); return []; }
  return data; // fields match
}

export async function saveContact(c: Omit<Contact, 'id'>): Promise<void> {
  await supabase.from('contacts').insert(c);
}

export async function updateContact(id: string, c: Partial<Contact>): Promise<void> {
  await supabase.from('contacts').update(c).eq('id', id);
}

export async function deleteContact(id: string): Promise<void> {
  await supabase.from('contacts').delete().eq('id', id);
}

// --- Age Groups ---
export async function getAgeGroups(): Promise<AgeGroup[]> {
  const { data, error } = await supabase.from('age_groups').select('*').order('display_order', { ascending: true });
  if (error) { console.error('getAgeGroups error', error); return []; }
  return data.map(g => ({
    id: g.id,
    name: g.name,
    minAge: g.min_age,
    maxAge: g.max_age,
    order: g.display_order,
    contactId: g.contact_id,
    isClosed: g.is_closed,
    capacity: g.capacity
  }));
}

export async function saveAgeGroup(g: Omit<AgeGroup, 'id'>): Promise<void> {
  await supabase.from('age_groups').insert({
    name: g.name,
    min_age: g.minAge,
    max_age: g.maxAge,
    display_order: g.order,
    contact_id: g.contactId,
    is_closed: g.isClosed || false,
    capacity: g.capacity
  });
}

export async function updateAgeGroup(id: string, g: Partial<AgeGroup>): Promise<void> {
  const updates: any = {};
  if (g.name !== undefined) updates.name = g.name;
  if (g.minAge !== undefined) updates.min_age = g.minAge;
  if (g.maxAge !== undefined) updates.max_age = g.maxAge;
  if (g.order !== undefined) updates.display_order = g.order;
  if (g.contactId !== undefined) updates.contact_id = g.contactId;
  if (g.isClosed !== undefined) updates.is_closed = g.isClosed;
  if (g.capacity !== undefined) updates.capacity = g.capacity;
  await supabase.from('age_groups').update(updates).eq('id', id);
}

export async function deleteAgeGroup(id: string): Promise<void> {
  await supabase.from('age_groups').delete().eq('id', id);
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
    players: t.players || []
  }));
}

export async function saveTeam(t: Omit<Team, 'id'> & { id?: string }): Promise<void> {
  const payload: any = {
    tournament_id: t.tournamentId,
    age_group_id: t.ageGroupId,
    name: t.name,
    coach: t.coach,
    email: t.email,
    players: t.players || []
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
  await supabase.from('teams').update(updates).eq('id', id);
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
export async function getAnnouncements(): Promise<Announcement[]> {
  const { data, error } = await supabase.from('announcements').select('*')
    .order('pinned', { ascending: false })
    .order('published_at', { ascending: false });
  if (error) { console.error('getAnnouncements error', error); return []; }
  return data.map(a => ({
    id: a.id,
    title: a.title,
    body: a.body,
    date: a.published_at,
    pinned: a.pinned
  }));
}

export async function saveAnnouncement(a: Omit<Announcement, 'id'>): Promise<void> {
  await supabase.from('announcements').insert({
    title: a.title,
    body: a.body,
    published_at: a.date,
    pinned: a.pinned || false
  });
}

export async function updateAnnouncement(id: string, a: Partial<Announcement>): Promise<void> {
  const updates: any = {};
  if (a.title !== undefined) updates.title = a.title;
  if (a.body !== undefined) updates.body = a.body;
  if (a.date !== undefined) updates.published_at = a.date;
  if (a.pinned !== undefined) updates.pinned = a.pinned;
  await supabase.from('announcements').update(updates).eq('id', id);
}

export async function deleteAnnouncement(id: string): Promise<void> {
  await supabase.from('announcements').delete().eq('id', id);
}
