/**
 * lib/families-audience.ts — WHO AN "EMAIL FAMILIES" SEND REACHES (Club Tier Stage 7c, Asks 6 and 7; build prompt Hard
 * parts 1, 2 and 6). Pure: no database, so the rule is unit-tested and the screen, the server's re-count and the send
 * cannot hold two versions of it.
 *
 * ⚠⚠ ONE AUDIENCE, COUNTED FOUR TIMES. The window's preview, the number on the lime ("Send to 88"), the server's re-count
 * on the press and the send itself all come from `familyAudience`, fed by what the sender confirmed (the kind, and the
 * team or season ids) — never a list from the browser. Its input is built from Families' one world by
 * `loadFamilyAudience` (lib/families-read.ts); there is no second definition of "a live family" anywhere.
 *
 * THE UNIT IS ONE WORD: "families". A family is a HOUSEHOLD — a guardian on a live row, joined with every guardian
 * Families' household rule (`householdOf`: verified co-guardians, the newest link deciding) puts beside them, and
 * joined again wherever two such households share a guardian. A household gets the email at each of its guardians'
 * addresses, but counts once. A guardian with two children on two teams is one family, so one email.
 *
 *   in the audience  — a guardian with a LIVE row (not declined, not withdrawn) that is CURRENT (a rep team's active
 *                      year, a house-league season open or active) and inside the scope. ⚠ Never a tryout-only
 *                      applicant: they hold no roster or registration row, so nothing puts them in.
 *   opted out        — a family EVERY one of whose addresses is on the club's suppression list (through the person).
 *                      Counted, never sent to. A family with one guardian opted out and one not is reached through the
 *                      other.
 *   the sender       — never a recipient (the one club send window's rule). Their address leaves the family it sits
 *                      in; a family that was only them leaves the count, and the window says "You are not counted".
 *
 * A HOUSE-LEAGUE SEASON'S AUDIENCES (Club Tier Stage 9d-1, owner 9d1·1–12 and the build session's ruling, 2026-10-26)
 * read each person's `seasonRows` — every registration of theirs, EVERY status, with its division and team — never the
 * `current` filter: a season is emailed in any status, finished ones included (§0c).
 *   season (everyone) — families with an ACTIVE child in the season, from either door (on a finished season, the
 *                       children who were active when it finished: finishing a season leaves each status as it was).
 *   divisions / teams — families with an active child in one of the divisions or teams (the route admits a team only in
 *                       a PUBLISHED division).
 *   statuses          — families with a child in one of the four Registrations tabs (Ended = declined + withdrawn).
 *   families          — the families of the ticked registrations, any status.
 * A season's email counts toward that season's own three (the claim's bucket is the scope's season).
 */

import { unionFind } from './families-duplicates';
import { FAMILY_LIST_KEYS, isFamilyListKey, type FamilyListKey } from './families-lists';
import { isUuid } from './utils';

/** A row of Families' world is live unless it was declined or withdrawn (a call-up never reaches the world). */
export const isLiveRegStatus = (s: string) => !['declined', 'withdrawn'].includes(s);
/** A rep row is this season's when its program year is the active one. */
export const isCurrentRepYear = (row: any) => row.rep_program_years?.status === 'active';
/** A house-league row is this season's when its season is open for registration or running. */
export const isCurrentLeagueSeason = (row: any) =>
  ['registration_open', 'active'].includes(row.league_seasons?.status ?? '');

/** The four Registrations tabs a season's "By status" offers (Ended = declined + withdrawn). */
export const SEASON_STATUS_KEYS = ['active', 'review', 'waitlist', 'ended'] as const;
export type SeasonStatusKey = (typeof SEASON_STATUS_KEYS)[number];
const isSeasonStatusKey = (x: unknown): x is SeasonStatusKey => (SEASON_STATUS_KEYS as readonly unknown[]).includes(x);

/** A registration's status as its Registrations tab. */
export function seasonStatusKey(status: string): SeasonStatusKey | null {
  if (status === 'active') return 'active';
  if (status === 'pending_review') return 'review';
  if (status === 'waitlisted') return 'waitlist';
  if (status === 'declined' || status === 'withdrawn') return 'ended';
  return null;
}

export type FamilyAudienceScope =
  | { kind: 'every' }
  | { kind: 'teams'; teamIds: readonly string[] }
  /** Everyone in a house-league season: families with an active child (9d-1). */
  | { kind: 'season'; seasonId: string }
  /** One of the Families lists (Owes money …, lib/families-lists.ts): the people on it, joined with their households. */
  | { kind: 'list'; list: FamilyListKey }
  // A season's own door (9d-1): part of one season.
  | { kind: 'season_divisions'; seasonId: string; divisionIds: readonly string[] }
  | { kind: 'season_teams'; seasonId: string; teamIds: readonly string[] }
  | { kind: 'season_statuses'; seasonId: string; statuses: readonly SeasonStatusKey[] }
  | { kind: 'season_families'; seasonId: string; registrationIds: readonly string[] };

/** The season a scope counts toward (the claim's bucket and the footer's season), or null for a club-wide one. */
export function scopeSeasonId(scope: FamilyAudienceScope): string | null {
  return 'seasonId' in scope ? scope.seasonId : null;
}

/** The scopes only a season's own door offers. */
export const isSeasonDoorScope = (scope: FamilyAudienceScope) => scope.kind.startsWith('season_');

const uuidList = (raw: unknown): string[] => {
  const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(',') : [];
  return [...new Set(list.filter((x): x is string => typeof x === 'string').map(x => x.trim()).filter(isUuid))].sort();
};

/** Who, as sent by the window: `kind`, then `teamIds` (comma-separated in a query), `seasonId` or `list`; a season's door
 *  adds `divisionIds`, `statuses` or `registrationIds`. */
export function parseScope(input: {
  kind?: unknown; teamIds?: unknown; seasonId?: unknown; list?: unknown; divisionIds?: unknown; statuses?: unknown; registrationIds?: unknown;
} | null): FamilyAudienceScope | null {
  // A body that is valid JSON but no object (null, a number) is no scope — a 400, not a thrown read of null.kind.
  if (!input || typeof input !== 'object') return null;
  if (input.kind === 'every') return { kind: 'every' };
  // A list the Families tab does not know is no scope at all (a 400), never an empty send.
  if (input.kind === 'list') return isFamilyListKey(input.list) ? { kind: 'list', list: input.list } : null;
  if (input.kind === 'teams') return { kind: 'teams', teamIds: uuidList(input.teamIds) };
  const seasonId = typeof input.seasonId === 'string' ? input.seasonId.trim() : '';
  if (input.kind === 'season') return { kind: 'season', seasonId };
  if (input.kind === 'season_divisions') return { kind: 'season_divisions', seasonId, divisionIds: uuidList(input.divisionIds) };
  if (input.kind === 'season_teams') return { kind: 'season_teams', seasonId, teamIds: uuidList(input.teamIds) };
  if (input.kind === 'season_families') return { kind: 'season_families', seasonId, registrationIds: uuidList(input.registrationIds) };
  if (input.kind === 'season_statuses') {
    const raw = Array.isArray(input.statuses) ? input.statuses : typeof input.statuses === 'string' ? input.statuses.split(',') : [];
    const statuses = SEASON_STATUS_KEYS.filter(k => raw.some(x => (typeof x === 'string' ? x.trim() : x) === k));
    // An unknown status is no scope (a 400), never a quietly smaller audience.
    if (raw.some(x => !isSeasonStatusKey(typeof x === 'string' ? x.trim() : x))) return null;
    return { kind: 'season_statuses', seasonId, statuses };
  }
  return null;
}

/** The scope's own picks are empty ("Pick a team."): the window's prompt, the route's 400. */
export function scopeNeedsPick(scope: FamilyAudienceScope): 'teams' | 'season' | 'divisions' | 'statuses' | 'families' | null {
  if (scope.kind === 'teams' || scope.kind === 'season_teams') return scope.teamIds.length === 0 ? 'teams' : null;
  if ('seasonId' in scope && !scope.seasonId) return 'season';
  if (scope.kind === 'season_divisions') return scope.divisionIds.length === 0 ? 'divisions' : null;
  if (scope.kind === 'season_statuses') return scope.statuses.length === 0 ? 'statuses' : null;
  if (scope.kind === 'season_families') return scope.registrationIds.length === 0 ? 'families' : null;
  return null;
}

/** One person of the club, as the audience needs them (built from Families' world, `loadFamilyAudience`). */
export interface AudiencePerson {
  personId: string;
  /** Their current address, normalized. */
  email: string;
  /** The Families lists they stand on (empty when the read was made without lists). */
  lists: readonly FamilyListKey[];
  /** Their LIVE rep rows. */
  roster: readonly { teamId: string; teamName: string; current: boolean }[];
  /** Their LIVE house-league rows. */
  league: readonly { seasonId: string; seasonName: string; current: boolean }[];
  /** The household's other guardians (Families' `householdOf`), by person. */
  coGuardians: readonly string[];
  /** Their last name, for "the Kim family" when no registration names one. */
  lastName?: string | null;
  /** EVERY house-league registration of theirs, any status, any season (9d-1: a season's own audiences read these). */
  seasonRows?: readonly SeasonRow[];
}

/** One house-league registration, as a season's audiences need it. */
export interface SeasonRow {
  regId: string;
  seasonId: string;
  seasonName: string;
  /** The season's own status (registration_open, active, completed …). */
  seasonStatus: string;
  /** The registration's status (active, pending_review, waitlisted, declined, withdrawn). */
  status: string;
  divisionId: string | null;
  teamId: string | null;
  childFirst: string;
  childLast: string;
  guardianLast: string | null;
}

/** A child the email is about, as "See who gets it" names them. */
export interface AudienceChild { regId: string; first: string; last: string; teamId: string | null }

export interface AudienceFamily {
  /** The addresses the email goes to — not opted out, never the sender's. Sorted. */
  addresses: string[];
  /** This season's rep teams of the family's guardians (for the head coach copy). */
  teamIds: string[];
  /** The household's people, sorted: what a recipient row keeps (never the addresses). */
  personIds: string[];
  /** "Kim" for "the Kim family": a registration's guardian last name, else a guardian's own. */
  familyName: string | null;
  /** A season scope's children in this family (empty for a club-wide scope). */
  children: AudienceChild[];
}

export interface FamilyAudience {
  /** The families that get it — the lime's number. Ordered by first address, so a send's batches are stable. */
  families: AudienceFamily[];
  /** Families in the scope that won't get it: every address opted out of club email. */
  optedOut: number;
  /** Those families, so a window can name one to three and a recipient row can record them. */
  optedOutFamilies: AudienceFamily[];
  /** The sender's own address sat in the audience and was left out. */
  senderSkipped: boolean;
  /** The rep teams whose head coaches a copy goes to: the picked teams with a family in them, or for every family every
   *  team with one. A house-league season copies no one. */
  coachTeamIds: string[];
}

const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();

/** A season scope's own rows of this person: the children who put them in it. Empty for a club-wide scope. */
function seasonRowsIn(p: AudiencePerson, scope: FamilyAudienceScope, picked: ReadonlySet<string>): SeasonRow[] {
  if (!('seasonId' in scope)) return [];
  const rows = (p.seasonRows ?? []).filter(r => r.seasonId === scope.seasonId);
  switch (scope.kind) {
    case 'season': return rows.filter(r => r.status === 'active');
    case 'season_divisions': return rows.filter(r => r.status === 'active' && r.divisionId !== null && picked.has(r.divisionId));
    case 'season_teams': return rows.filter(r => r.status === 'active' && r.teamId !== null && picked.has(r.teamId));
    case 'season_statuses': return rows.filter(r => { const k = seasonStatusKey(r.status); return k !== null && picked.has(k); });
    case 'season_families': return rows.filter(r => picked.has(r.regId));
  }
}

function inScope(p: AudiencePerson, scope: FamilyAudienceScope, picked: ReadonlySet<string>): boolean {
  if (scope.kind === 'every') return p.roster.some(r => r.current) || p.league.some(l => l.current);
  if (scope.kind === 'teams') return p.roster.some(r => r.current && picked.has(r.teamId));
  if (scope.kind === 'list') return p.lists.includes(scope.list);
  return seasonRowsIn(p, scope, picked).length > 0;
}

/** What a scope picked, as one set: teams, divisions, statuses or registrations. */
function pickedOf(scope: FamilyAudienceScope): Set<string> {
  switch (scope.kind) {
    case 'teams': case 'season_teams': return new Set(scope.teamIds);
    case 'season_divisions': return new Set(scope.divisionIds);
    case 'season_statuses': return new Set(scope.statuses);
    case 'season_families': return new Set(scope.registrationIds);
    default: return new Set();
  }
}

const byName = (a: AudienceChild, b: AudienceChild) => a.first.localeCompare(b.first) || a.last.localeCompare(b.last) || a.regId.localeCompare(b.regId);

/** The audience for one scope. Deterministic: the same people, list and scope always give the same families. */
export function familyAudience(
  people: readonly AudiencePerson[],
  scope: FamilyAudienceScope,
  suppressed: ReadonlySet<string>,
  senderEmail: string | null,
): FamilyAudience {
  const byId = new Map(people.map(p => [p.personId, p]));
  const picked = pickedOf(scope);
  const members = people.filter(p => inScope(p, scope, picked));
  const memberIds = new Set(members.map(m => m.personId));

  // Households: each member with their co-guardians, joined wherever two share a guardian.
  const { find, union } = unionFind();
  const touched = new Set<string>();
  for (const m of members) {
    touched.add(m.personId);
    for (const g of m.coGuardians) if (byId.has(g)) { touched.add(g); union(m.personId, g); }
  }
  const households = new Map<string, Set<string>>();
  for (const id of touched) {
    const root = find(id);
    const h = households.get(root) ?? new Set<string>();
    h.add(id);
    households.set(root, h);
  }

  const sender = norm(senderEmail);
  let senderSkipped = false;
  const families: AudienceFamily[] = [];
  const optedOutFamilies: AudienceFamily[] = [];
  const coachTeams = new Set<string>();
  for (const ids of households.values()) {
    const guardians = [...ids].map(id => byId.get(id)!).filter(Boolean);
    let addresses = [...new Set(guardians.map(g => norm(g.email)).filter(Boolean))];
    if (sender && addresses.includes(sender)) {
      senderSkipped = true;
      addresses = addresses.filter(a => a !== sender);
      if (addresses.length === 0) continue;
    }
    const teamIds = [...new Set(guardians.flatMap(g => g.roster.filter(r => r.current).map(r => r.teamId)))].sort();
    for (const t of teamIds) if (scope.kind === 'every' || (scope.kind === 'teams' && picked.has(t))) coachTeams.add(t);
    // The children who put the household in a season scope (a co-guardian outside it brings none of their own).
    const rows = guardians.filter(g => memberIds.has(g.personId)).flatMap(g => seasonRowsIn(g, scope, picked));
    const children = [...new Map(rows.map(r => [r.regId, { regId: r.regId, first: r.childFirst, last: r.childLast, teamId: r.teamId }])).values()].sort(byName);
    const familyName = rows.map(r => r.guardianLast?.trim()).find(Boolean)
      ?? guardians.map(g => g.lastName?.trim()).find(Boolean) ?? null;
    const family = { addresses: [] as string[], teamIds, personIds: [...ids].sort(), familyName, children };
    const reachable = addresses.filter(a => !suppressed.has(a)).sort();
    if (reachable.length === 0) { optedOutFamilies.push(family); continue; }
    families.push({ ...family, addresses: reachable });
  }
  families.sort((a, b) => a.addresses[0].localeCompare(b.addresses[0]));
  optedOutFamilies.sort((a, b) => (a.familyName ?? '').localeCompare(b.familyName ?? '') || a.personIds[0].localeCompare(b.personIds[0]));
  return { families, optedOut: optedOutFamilies.length, optedOutFamilies, senderSkipped, coachTeamIds: [...coachTeams].sort() };
}

/** Families reached (at least one address accepted — 'skipped' is a transport switched off in this environment, not a
 *  failure) and failed (every address decided, none accepted), from the send's results so far: the log's "Reached x of
 *  y" counts FAMILIES, never addresses. */
export function familyCounts(audience: FamilyAudience, results: ReadonlyMap<string, { status: string }>): { reached: number; failed: number } {
  let reached = 0;
  let failed = 0;
  for (const f of audience.families) {
    const statuses = f.addresses.map(a => results.get(a)?.status);
    if (statuses.some(s => s === 'sent' || s === 'skipped')) reached += 1;
    else if (statuses.every(s => s !== undefined)) failed += 1;
  }
  return { reached, failed };
}

export interface AudienceChoices {
  /** Every family — the families in it (those who get it and those opted out), the window's "Every family · 95". */
  every: number;
  /** This season's rep teams with a family on them, by name. Empty: the window offers no "Some rep teams". */
  teams: { teamId: string; teamName: string; families: number }[];
  /** House-league seasons with a family in them (an active child), in ANY status (9d1·6). Empty: no "A house league
   *  season". `status` is the season's own, for the picker's "Registration closed". */
  seasons: { seasonId: string; name: string; status: string; families: number }[];
  /** The Families lists with a family on them, with the families in each (those who get it and those opted out). Empty:
   *  the window offers no "Families from a list" (also empty when the read was made without lists). */
  lists: { list: FamilyListKey; families: number }[];
}

/** What the window's Who offers: which choices exist comes from what the club runs, never from a plan flag alone. */
export function audienceChoices(people: readonly AudiencePerson[], suppressed: ReadonlySet<string>, senderEmail: string | null): AudienceChoices {
  const size = (a: FamilyAudience) => a.families.length + a.optedOut;
  const teams = new Map<string, string>();
  const seasons = new Map<string, { name: string; status: string }>();
  for (const p of people) {
    for (const r of p.roster) if (r.current) teams.set(r.teamId, r.teamName);
    for (const s of p.seasonRows ?? []) if (s.status === 'active') seasons.set(s.seasonId, { name: s.seasonName, status: s.seasonStatus });
  }
  return {
    every: size(familyAudience(people, { kind: 'every' }, suppressed, senderEmail)),
    teams: [...teams].map(([teamId, teamName]) => ({ teamId, teamName, families: size(familyAudience(people, { kind: 'teams', teamIds: [teamId] }, suppressed, senderEmail)) }))
      .filter(t => t.families > 0).sort((a, b) => a.teamName.localeCompare(b.teamName)),
    seasons: [...seasons].map(([seasonId, s]) => ({ seasonId, name: s.name, status: s.status, families: size(familyAudience(people, { kind: 'season', seasonId }, suppressed, senderEmail)) }))
      .filter(s => s.families > 0).sort((a, b) => a.name.localeCompare(b.name)),
    lists: FAMILY_LIST_KEYS
      .map(list => ({ list, families: size(familyAudience(people, { kind: 'list', list }, suppressed, senderEmail)) }))
      .filter(l => l.families > 0),
  };
}

/** Children an audience is about (a season scope), counting the opted-out families too: "10 families · 11 children". */
export const audienceChildren = (a: FamilyAudience) =>
  [...a.families, ...a.optedOutFamilies].reduce((n, f) => n + f.children.length, 0);

/** A season's Who list (9d-1, frame b): each choice's families (those who get it and those opted out). A choice with no
 *  family is left out (absent beats disabled); `teams` are only the PUBLISHED divisions' teams, which the caller passes. */
export interface SeasonChoices {
  everyone: { families: number; children: number };
  divisions: { divisionId: string; name: string; families: number }[];
  teams: { teamId: string; name: string; divisionId: string; families: number }[];
  statuses: { key: SeasonStatusKey; families: number }[];
}

export function seasonChoices(
  people: readonly AudiencePerson[],
  suppressed: ReadonlySet<string>,
  senderEmail: string | null,
  seasonId: string,
  divisions: readonly { id: string; name: string }[],
  publishedTeams: readonly { id: string; name: string; divisionId: string }[],
): SeasonChoices {
  const size = (scope: FamilyAudienceScope) => { const a = familyAudience(people, scope, suppressed, senderEmail); return a.families.length + a.optedOut; };
  const everyone = familyAudience(people, { kind: 'season', seasonId }, suppressed, senderEmail);
  return {
    everyone: { families: everyone.families.length + everyone.optedOut, children: audienceChildren(everyone) },
    divisions: divisions.map(d => ({ divisionId: d.id, name: d.name, families: size({ kind: 'season_divisions', seasonId, divisionIds: [d.id] }) }))
      .filter(d => d.families > 0),
    teams: publishedTeams.map(t => ({ teamId: t.id, name: t.name, divisionId: t.divisionId, families: size({ kind: 'season_teams', seasonId, teamIds: [t.id] }) }))
      .filter(t => t.families > 0),
    statuses: SEASON_STATUS_KEYS.map(key => ({ key, families: size({ kind: 'season_statuses', seasonId, statuses: [key] }) }))
      .filter(s => s.families > 0),
  };
}
