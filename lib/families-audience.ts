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

export type FamilyAudienceScope =
  | { kind: 'every' }
  | { kind: 'teams'; teamIds: readonly string[] }
  | { kind: 'season'; seasonId: string }
  /** One of the Families lists (Owes money …, lib/families-lists.ts): the people on it, joined with their households. */
  | { kind: 'list'; list: FamilyListKey };

/** Who, as sent by the window: `kind`, then `teamIds` (comma-separated in a query), `seasonId` or `list`. */
export function parseScope(input: { kind?: unknown; teamIds?: unknown; seasonId?: unknown; list?: unknown } | null): FamilyAudienceScope | null {
  // A body that is valid JSON but no object (null, a number) is no scope — a 400, not a thrown read of null.kind.
  if (!input || typeof input !== 'object') return null;
  if (input.kind === 'every') return { kind: 'every' };
  // A list the Families tab does not know is no scope at all (a 400), never an empty send.
  if (input.kind === 'list') return isFamilyListKey(input.list) ? { kind: 'list', list: input.list } : null;
  if (input.kind === 'teams') {
    const raw = Array.isArray(input.teamIds) ? input.teamIds : typeof input.teamIds === 'string' ? input.teamIds.split(',') : [];
    const teamIds = [...new Set(raw.filter((x): x is string => typeof x === 'string').map(x => x.trim()).filter(isUuid))].sort();
    return { kind: 'teams', teamIds };
  }
  if (input.kind === 'season') {
    return { kind: 'season', seasonId: typeof input.seasonId === 'string' ? input.seasonId.trim() : '' };
  }
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
}

interface AudienceFamily {
  /** The addresses the email goes to — not opted out, never the sender's. Sorted. */
  addresses: string[];
  /** This season's rep teams of the family's guardians (for the head coach copy). */
  teamIds: string[];
}

export interface FamilyAudience {
  /** The families that get it — the lime's number. Ordered by first address, so a send's batches are stable. */
  families: AudienceFamily[];
  /** Families in the scope that won't get it: every address opted out of club email. */
  optedOut: number;
  /** The sender's own address sat in the audience and was left out. */
  senderSkipped: boolean;
  /** The rep teams whose head coaches a copy goes to: the picked teams with a family in them, or for every family every
   *  team with one. A house-league season copies no one. */
  coachTeamIds: string[];
}

const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();

function inScope(p: AudiencePerson, scope: FamilyAudienceScope, teamIds: ReadonlySet<string>): boolean {
  if (scope.kind === 'every') return p.roster.some(r => r.current) || p.league.some(l => l.current);
  if (scope.kind === 'teams') return p.roster.some(r => r.current && teamIds.has(r.teamId));
  if (scope.kind === 'list') return p.lists.includes(scope.list);
  return p.league.some(l => l.current && l.seasonId === scope.seasonId);
}

/** The audience for one scope. Deterministic: the same people, list and scope always give the same families. */
export function familyAudience(
  people: readonly AudiencePerson[],
  scope: FamilyAudienceScope,
  suppressed: ReadonlySet<string>,
  senderEmail: string | null,
): FamilyAudience {
  const byId = new Map(people.map(p => [p.personId, p]));
  const picked = new Set(scope.kind === 'teams' ? scope.teamIds : []);
  const members = people.filter(p => inScope(p, scope, picked));

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
  let optedOut = 0;
  let senderSkipped = false;
  const families: AudienceFamily[] = [];
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
    const reachable = addresses.filter(a => !suppressed.has(a)).sort();
    if (reachable.length === 0) { optedOut += 1; continue; }
    families.push({ addresses: reachable, teamIds });
  }
  families.sort((a, b) => a.addresses[0].localeCompare(b.addresses[0]));
  return { families, optedOut, senderSkipped, coachTeamIds: [...coachTeams].sort() };
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
  /** House-league seasons open or running with a family in them. Empty: no "A house league season". */
  seasons: { seasonId: string; name: string; families: number }[];
  /** The Families lists with a family on them, with the families in each (those who get it and those opted out). Empty:
   *  the window offers no "Families from a list" (also empty when the read was made without lists). */
  lists: { list: FamilyListKey; families: number }[];
}

/** What the window's Who offers: which choices exist comes from what the club runs, never from a plan flag alone. */
export function audienceChoices(people: readonly AudiencePerson[], suppressed: ReadonlySet<string>, senderEmail: string | null): AudienceChoices {
  const size = (a: FamilyAudience) => a.families.length + a.optedOut;
  const teams = new Map<string, string>();
  const seasons = new Map<string, string>();
  for (const p of people) {
    for (const r of p.roster) if (r.current) teams.set(r.teamId, r.teamName);
    for (const l of p.league) if (l.current) seasons.set(l.seasonId, l.seasonName);
  }
  return {
    every: size(familyAudience(people, { kind: 'every' }, suppressed, senderEmail)),
    teams: [...teams].map(([teamId, teamName]) => ({ teamId, teamName, families: size(familyAudience(people, { kind: 'teams', teamIds: [teamId] }, suppressed, senderEmail)) }))
      .filter(t => t.families > 0).sort((a, b) => a.teamName.localeCompare(b.teamName)),
    seasons: [...seasons].map(([seasonId, name]) => ({ seasonId, name, families: size(familyAudience(people, { kind: 'season', seasonId }, suppressed, senderEmail)) }))
      .filter(s => s.families > 0).sort((a, b) => a.name.localeCompare(b.name)),
    lists: FAMILY_LIST_KEYS
      .map(list => ({ list, families: size(familyAudience(people, { kind: 'list', list }, suppressed, senderEmail)) }))
      .filter(l => l.families > 0),
  };
}
