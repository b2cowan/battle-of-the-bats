import { AgeGroup, Team, Game, Announcement, Diamond, Tournament } from './types';

const KEYS = {
  AGE_GROUPS:    'botb_age_groups',
  TEAMS:         'botb_teams',
  GAMES:         'botb_games',
  ANNOUNCEMENTS: 'botb_announcements',
  DIAMONDS:      'botb_diamonds',
  TOURNAMENTS:   'botb_tournaments',
} as const;

function read<T>(key: string): T[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function write<T>(key: string, data: T[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(data));
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ─── Tournaments ───────────────────────────────────────────────────────────────

export function getTournaments(): Tournament[] {
  return read<Tournament>(KEYS.TOURNAMENTS).sort((a, b) => b.year - a.year);
}

export function getActiveTournament(): Tournament | null {
  return getTournaments().find(t => t.isActive) ?? getTournaments()[0] ?? null;
}

export function saveTournament(t: Omit<Tournament, 'id'>): Tournament {
  const tournaments = read<Tournament>(KEYS.TOURNAMENTS);
  const newT: Tournament = { ...t, id: generateId() };
  // If this is active, deactivate others
  const updated = t.isActive
    ? tournaments.map(x => ({ ...x, isActive: false }))
    : tournaments;
  write(KEYS.TOURNAMENTS, [...updated, newT]);
  return newT;
}

export function updateTournament(id: string, updates: Partial<Omit<Tournament, 'id'>>): void {
  let tournaments = read<Tournament>(KEYS.TOURNAMENTS);
  if (updates.isActive) {
    tournaments = tournaments.map(t => ({ ...t, isActive: false }));
  }
  write(KEYS.TOURNAMENTS, tournaments.map(t => t.id === id ? { ...t, ...updates } : t));
}

export function deleteTournament(id: string): void {
  write(KEYS.TOURNAMENTS, read<Tournament>(KEYS.TOURNAMENTS).filter(t => t.id !== id));
}

export function setActiveTournament(id: string): void {
  const tournaments = read<Tournament>(KEYS.TOURNAMENTS);
  write(KEYS.TOURNAMENTS, tournaments.map(t => ({ ...t, isActive: t.id === id })));
}

// ─── Age Groups ────────────────────────────────────────────────────────────────

export function getAgeGroups(): AgeGroup[] {
  return read<AgeGroup>(KEYS.AGE_GROUPS).sort((a, b) => a.order - b.order);
}

export function saveAgeGroup(group: Omit<AgeGroup, 'id'>): AgeGroup {
  const groups = getAgeGroups();
  const newGroup: AgeGroup = { ...group, id: generateId() };
  write(KEYS.AGE_GROUPS, [...groups, newGroup]);
  return newGroup;
}

export function updateAgeGroup(id: string, updates: Partial<Omit<AgeGroup, 'id'>>): void {
  const groups = getAgeGroups();
  write(KEYS.AGE_GROUPS, groups.map(g => g.id === id ? { ...g, ...updates } : g));
}

export function deleteAgeGroup(id: string): void {
  write(KEYS.AGE_GROUPS, getAgeGroups().filter(g => g.id !== id));
}

// ─── Teams ─────────────────────────────────────────────────────────────────────

export function getTeams(tournamentId?: string): Team[] {
  const teams = read<Team>(KEYS.TEAMS);
  if (!tournamentId) return teams;
  return teams.filter(t => t.tournamentId === tournamentId);
}

export function saveTeam(team: Omit<Team, 'id'> & { id?: string }): Team {
  const teams = read<Team>(KEYS.TEAMS);
  const newTeam: Team = { id: generateId(), ...team };
  if (team.id) newTeam.id = team.id;
  write(KEYS.TEAMS, [...teams, newTeam]);
  return newTeam;
}

export function updateTeam(id: string, updates: Partial<Omit<Team, 'id'>>): void {
  const teams = read<Team>(KEYS.TEAMS);
  write(KEYS.TEAMS, teams.map(t => t.id === id ? { ...t, ...updates } : t));
}

export function deleteTeam(id: string): void {
  write(KEYS.TEAMS, read<Team>(KEYS.TEAMS).filter(t => t.id !== id));
}

// ─── Games ─────────────────────────────────────────────────────────────────────

export function getGames(tournamentId?: string): Game[] {
  const games = read<Game>(KEYS.GAMES).sort((a, b) =>
    new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime()
  );
  if (!tournamentId) return games;
  return games.filter(g => g.tournamentId === tournamentId);
}

export function saveGame(game: Omit<Game, 'id'>): Game {
  const games = read<Game>(KEYS.GAMES);
  const newGame: Game = { ...game, id: generateId() };
  write(KEYS.GAMES, [...games, newGame]);
  return newGame;
}

export function updateGame(id: string, updates: Partial<Omit<Game, 'id'>>): void {
  const games = read<Game>(KEYS.GAMES);
  write(KEYS.GAMES, games.map(g => g.id === id ? { ...g, ...updates } : g));
}

export function deleteGame(id: string): void {
  write(KEYS.GAMES, read<Game>(KEYS.GAMES).filter(g => g.id !== id));
}

// ─── Announcements ─────────────────────────────────────────────────────────────

export function getAnnouncements(): Announcement[] {
  return read<Announcement>(KEYS.ANNOUNCEMENTS).sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });
}

export function saveAnnouncement(ann: Omit<Announcement, 'id'>): Announcement {
  const anns = read<Announcement>(KEYS.ANNOUNCEMENTS);
  const newAnn: Announcement = { ...ann, id: generateId() };
  write(KEYS.ANNOUNCEMENTS, [...anns, newAnn]);
  return newAnn;
}

export function updateAnnouncement(id: string, updates: Partial<Omit<Announcement, 'id'>>): void {
  const anns = read<Announcement>(KEYS.ANNOUNCEMENTS);
  write(KEYS.ANNOUNCEMENTS, anns.map(a => a.id === id ? { ...a, ...updates } : a));
}

export function deleteAnnouncement(id: string): void {
  write(KEYS.ANNOUNCEMENTS, read<Announcement>(KEYS.ANNOUNCEMENTS).filter(a => a.id !== id));
}

// ─── Diamonds ──────────────────────────────────────────────────────────────────

export function getDiamonds(): Diamond[] {
  return read<Diamond>(KEYS.DIAMONDS).sort((a, b) => a.name.localeCompare(b.name));
}

export function saveDiamond(diamond: Omit<Diamond, 'id'>): Diamond {
  const diamonds = getDiamonds();
  const newDiamond: Diamond = { ...diamond, id: generateId() };
  write(KEYS.DIAMONDS, [...diamonds, newDiamond]);
  return newDiamond;
}

export function updateDiamond(id: string, updates: Partial<Omit<Diamond, 'id'>>): void {
  const diamonds = read<Diamond>(KEYS.DIAMONDS);
  write(KEYS.DIAMONDS, diamonds.map(d => d.id === id ? { ...d, ...updates } : d));
}

export function deleteDiamond(id: string): void {
  write(KEYS.DIAMONDS, read<Diamond>(KEYS.DIAMONDS).filter(d => d.id !== id));
}

// ─── Seed Data ─────────────────────────────────────────────────────────────────

export function seedDefaultData(): void {
  if (typeof window === 'undefined') return;
  if (localStorage.getItem('botb_seeded_v2')) return;

  const currentYear = new Date().getFullYear();

  // Clear old seed flag to allow re-seed with new schema
  localStorage.removeItem('botb_seeded');

  const ageGroups: AgeGroup[] = [
    { id: generateId(), name: 'U11', minAge: 9,  maxAge: 11, order: 1 },
    { id: generateId(), name: 'U13', minAge: 11, maxAge: 13, order: 2 },
    { id: generateId(), name: 'U15', minAge: 13, maxAge: 15, order: 3 },
    { id: generateId(), name: 'U17', minAge: 15, maxAge: 17, order: 4 },
    { id: generateId(), name: 'U19', minAge: 17, maxAge: 19, order: 5 },
  ];
  write(KEYS.AGE_GROUPS, ageGroups);

  const tournament: Tournament = {
    id: generateId(),
    year: currentYear,
    name: `Battle of the Bats ${currentYear}`,
    isActive: true,
  };
  write(KEYS.TOURNAMENTS, [tournament]);

  const announcement: Announcement = {
    id: generateId(),
    title: `Welcome to Battle of the Bats ${currentYear}!`,
    body: `We are thrilled to announce the Battle of the Bats ${currentYear} softball tournament hosted by the Milton Bats. Registration is now open for all age groups from U11 through U19. Stay tuned for schedule announcements and team updates!`,
    date: new Date().toISOString(),
    pinned: true,
  };
  write(KEYS.ANNOUNCEMENTS, [announcement]);

  localStorage.setItem('botb_seeded_v2', 'true');
}
