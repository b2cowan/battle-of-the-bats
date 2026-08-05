/**
 * lib/coach-club-book.ts
 * Club Shared Book — pure logic, no I/O (unit tests: tests/unit/coach-club-book.test.ts).
 *
 * The club layer is the opponent book's SAME read, widened: for a sharing team viewing
 * opponent key K, resolve K against each sharing sibling's own book — through THEIR normalized
 * names and THEIR aliases — and render what comes back labelled by team. There is no club
 * entity, no cross-team FK, and no fuzzy cross-team matcher: a same-club-different-spelling
 * miss shows nothing, which costs a shared note and never costs correctness.
 *
 * Three rulings are enforced here rather than described:
 *   · **Reciprocity** (§8 Q2) — you see the club layer only while you share. `canSeeClubLayer`
 *     is the only door, and it takes the VIEWER's own sharing flag as an input.
 *   · **No blending** (§8 Q5) — records are combined only WITHIN one sibling team, never
 *     across teams. There is deliberately no function here that averages anything.
 *   · **Writes stay home** — nothing in this file produces a mutation of any kind.
 */
import { hasPlanFeature } from './plan-features';
import { buildOpponentBook } from './coach-opponents';
import type { OpponentBookEntry, OpponentGameInput } from './coach-opponents';
import type {
  OrgPlan, Organization, RepTeam, RepTeamOpponent, RepTeamOpponentObservation,
} from './types';

/**
 * What one sibling team may contribute to a single card. The club layer is a briefing, not an
 * archive: without a bound, one team with a decade of notes on a rival becomes the page.
 * `observationCount` still reports the TRUE total, so the "All {n} from {team}" label never
 * promises more than it can show — see `clubTeamExpanderLabel`.
 */
export const CLUB_TEAM_OBSERVATION_CAP = 25;
/** How many of a sibling's observations show before the expander (mockup 8b shows two). */
export const CLUB_TEAM_PREVIEW_COUNT = 2;

// ── The gate ────────────────────────────────────────────────────────────────────────────

export interface ClubBookAccess {
  /** Club plan (§8 Q3). False ⇒ nothing about this feature exists for this org: no switch,
   *  no layer, no locked tease. Absent, not upsold. */
  planIncluded: boolean;
  /** The club admin's switch. */
  orgEnabled: boolean;
  /** This team's own head-coach switch. */
  teamSharing: boolean;
  /** Does the head coach see "Share our book with the club" at all? Two keys, and the admin
   *  turns theirs first — a coach must never be offered a switch that would do nothing. */
  showTeamSwitch: boolean;
  /** ⚠ THE ONLY DOOR to sibling content. Reciprocity lives in this one `&&`. */
  canSeeClubLayer: boolean;
}

export function resolveClubBookAccess(opts: {
  planId: OrgPlan;
  orgEnabled: boolean;
  teamSharing: boolean;
}): ClubBookAccess {
  const planIncluded = hasPlanFeature(opts.planId, 'club_shared_book');
  const orgEnabled = planIncluded && opts.orgEnabled;
  const teamSharing = opts.teamSharing === true;
  return {
    planIncluded,
    orgEnabled,
    teamSharing,
    showTeamSwitch: orgEnabled,
    canSeeClubLayer: orgEnabled && teamSharing,
  };
}

/**
 * The same door, wired straight from the org + team every coach route already resolved.
 *
 * Five routes were assembling the identical three-field record by hand; the DECISION was
 * always in one place, but the WIRING into it was copied. `Pick` rather than the full types so
 * a caller with a partial projection (the admin route has no team at all) can still ask.
 */
export function resolveClubBookAccessFor(
  org: Pick<Organization, 'planId' | 'clubBookSharingEnabled'>,
  team?: Pick<RepTeam, 'shareClubBook'>,
): ClubBookAccess {
  return resolveClubBookAccess({
    planId: org.planId,
    orgEnabled: org.clubBookSharingEnabled,
    teamSharing: team?.shareClubBook === true,
  });
}

// ── Resolving one opponent across the club's books ──────────────────────────────────────

/** A sibling's minted book row, as the batched read returns it. */
export interface SiblingOpponentRow {
  id: string;
  teamId: string;
  normalizedName: string;
  summary: string | null;
}
export interface SiblingAliasRow {
  opponentId: string;
  teamId: string;
  normalizedAlias: string;
}

/** Every merged-away spelling, by the book row that owns it. Both directions of the match —
 *  the card's outward resolve and the list's inward one — need exactly this. */
function groupAliasesByOpponent(rows: SiblingAliasRow[]): Map<string, string[]> {
  const byOpponent = new Map<string, string[]>();
  for (const a of rows) {
    const list = byOpponent.get(a.opponentId) ?? [];
    list.push(a.normalizedAlias);
    byOpponent.set(a.opponentId, list);
  }
  return byOpponent;
}

/** One sibling team's answer to "do you know this opponent?" */
export interface SiblingMatch {
  teamId: string;
  /** Their matched book rows — the observation read's keys. */
  opponentIds: string[];
  /** The normalized names those rows own — the record read's keys, in THEIR key space. */
  keys: string[];
  /**
   * Their book line. When a team wrote under two spellings they never merged and BOTH carry a
   * line, both survive (joined, direct match first) — folding two of their rows into one block
   * must not silently drop half of what a coach wrote, which is the same rule the book's own
   * merge follows (`mergeSummaries` keeps the loser's words as a labelled appendix).
   */
  summary: string | null;
}

/**
 * Resolve the viewer's opponent against every sharing sibling's book.
 *
 * `matchKeys` is the viewer's whole key space for this opponent — the entry's own key PLUS
 * every spelling the viewer has merged into it — so a viewer who calls them "Thunder 12U"
 * still finds a sibling's "Oakville Thunder", and vice versa. Matching then looks BOTH ways
 * on the sibling side too: their canonical name, and their own merged-away spellings.
 *
 * ⚠ Multiple rows in ONE sibling team can match (they wrote under two spellings and never
 * merged them). They are folded into that team's single block rather than dropped: by the
 * viewer's reckoning it is one opponent, and silently discarding the second row would lose a
 * coach's words. Folding stays strictly INSIDE one team — never across teams (§8 Q5).
 */
export function matchSiblingBooks(opts: {
  matchKeys: string[];
  siblingOpponents: SiblingOpponentRow[];
  siblingAliases: SiblingAliasRow[];
}): SiblingMatch[] {
  const wanted = new Set(opts.matchKeys.filter(k => k !== ''));
  if (wanted.size === 0) return [];

  const aliasesByOpponent = groupAliasesByOpponent(opts.siblingAliases);

  const byTeam = new Map<string, { direct: SiblingOpponentRow[]; viaAlias: SiblingOpponentRow[] }>();
  for (const o of opts.siblingOpponents) {
    const direct = wanted.has(o.normalizedName);
    const viaAlias = !direct && (aliasesByOpponent.get(o.id) ?? []).some(a => wanted.has(a));
    if (!direct && !viaAlias) continue;
    const bucket = byTeam.get(o.teamId) ?? { direct: [], viaAlias: [] };
    (direct ? bucket.direct : bucket.viaAlias).push(o);
    byTeam.set(o.teamId, bucket);
  }

  const matches: SiblingMatch[] = [];
  for (const [teamId, bucket] of byTeam) {
    // Stable order regardless of row arrival: direct matches first, then alphabetical. The
    // summary and the alias-key list both depend on this ordering.
    const sortByName = (a: SiblingOpponentRow, b: SiblingOpponentRow) =>
      a.normalizedName.localeCompare(b.normalizedName);
    const rows = [...bucket.direct.sort(sortByName), ...bucket.viaAlias.sort(sortByName)];
    // Every distinct line they wrote, in that order — not just the first one found. Deduped
    // because the same line under two spellings is one thought, not two.
    const lines = [...new Set(
      rows.map(r => r.summary?.trim()).filter((s): s is string => !!s),
    )];
    matches.push({
      teamId,
      opponentIds: rows.map(r => r.id),
      keys: rows.map(r => r.normalizedName),
      summary: lines.length > 0 ? lines.join('\n') : null,
    });
  }
  return matches;
}

// ── One sibling team's block ────────────────────────────────────────────────────────────

export interface ClubBookTeamBlock {
  teamId: string;
  teamName: string;
  /** THEIR record against this opponent — labelled, never merged with anyone else's (§8 Q5). */
  record: { wins: number; losses: number; ties: number };
  /** THEIR book line. */
  summary: string | null;
  /** Newest first, capped at CLUB_TEAM_OBSERVATION_CAP. */
  observations: RepTeamOpponentObservation[];
  /** The true total, which may exceed `observations.length`. */
  observationCount: number;
}

export interface ClubBookBlock {
  teams: ClubBookTeamBlock[];
  /** Every sibling observation on this opponent — the drawer teaser's one number. */
  observationCount: number;
}

/**
 * Combine a sibling team's own book entries for the keys that matched.
 *
 * Within ONE team only: their two un-merged spellings of the same opponent are the same
 * opponent, so their records add. The arithmetic is `buildOpponentBook`'s own — this reads
 * entries it produced rather than re-tallying games, so a club block can never spell a record
 * differently than that team's own page does.
 */
export function combineSiblingRecord(
  entries: OpponentBookEntry[], keys: string[],
): { wins: number; losses: number; ties: number } {
  const wanted = new Set(keys);
  const record = { wins: 0, losses: 0, ties: 0 };
  for (const e of entries) {
    if (!wanted.has(e.key)) continue;
    record.wins += e.record.wins;
    record.losses += e.record.losses;
    record.ties += e.record.ties;
  }
  return record;
}

/** Has this team anything to SAY about the opponent? A block that is only a record adds
 *  nothing to a briefing — the section shows voices, not attendance. */
export function siblingBlockHasContent(
  block: Pick<ClubBookTeamBlock, 'summary' | 'observationCount'>,
): boolean {
  return (block.summary != null && block.summary.trim() !== '') || block.observationCount > 0;
}

/** Richest voice first, then alphabetical — the coach reads the team that knows most, first. */
export function sortClubTeamBlocks(blocks: ClubBookTeamBlock[]): ClubBookTeamBlock[] {
  return [...blocks].sort((a, b) =>
    b.observationCount - a.observationCount || a.teamName.localeCompare(b.teamName));
}

/**
 * The expander's label. Honest when the cap bit: it can only promise what it can show.
 * Returns null when everything a team has is already on screen.
 */
export function clubTeamExpanderLabel(block: ClubBookTeamBlock): string | null {
  const shown = Math.min(CLUB_TEAM_PREVIEW_COUNT, block.observations.length);
  if (block.observations.length <= shown) return null;
  return block.observationCount > block.observations.length
    ? `The latest ${block.observations.length} of ${block.observationCount} from ${block.teamName} ›`
    : `All ${block.observationCount} from ${block.teamName} ›`;
}

/** "— Coach Dana · 12U A" (mockup 8b). The team always travels with the name: an observation
 *  read out of its team's context is how a note gets mistaken for your own. */
export function clubObservationAttribution(
  observation: Pick<RepTeamOpponentObservation, 'createdByName'>, teamName: string,
): string {
  return observation.createdByName ? `${observation.createdByName} · ${teamName}` : teamName;
}

// ── The opponents-list badge ────────────────────────────────────────────────────────────

/**
 * Which of the VIEWER's opponent keys the club has something to say about.
 *
 * The card resolves one key outward into the siblings' key spaces; this resolves every
 * sibling's keys INWARD into the viewer's — through the viewer's own merges, so a sibling's
 * "Thunder 12U" lights the row of a viewer who merged that spelling into "Oakville Thunder".
 * One batched read feeds it; no row queries per row.
 */
export function clubContentKeys(opts: {
  /** The viewer's own book entries — `key` + the spellings merged into each. */
  viewerEntries: { key: string; aliasKeys: string[] }[];
  siblingOpponents: SiblingOpponentRow[];
  siblingAliases: SiblingAliasRow[];
  /** Observation totals by sibling opponent id. */
  observationCounts: Record<string, number>;
}): string[] {
  const viewerKeyFor = new Map<string, string>();
  for (const e of opts.viewerEntries) {
    viewerKeyFor.set(e.key, e.key);
    for (const a of e.aliasKeys) viewerKeyFor.set(a, e.key);
  }

  const aliasesByOpponent = groupAliasesByOpponent(opts.siblingAliases);

  const keys = new Set<string>();
  for (const o of opts.siblingOpponents) {
    const hasContent = (o.summary != null && o.summary.trim() !== '')
      || (opts.observationCounts[o.id] ?? 0) > 0;
    if (!hasContent) continue;
    for (const spelling of [o.normalizedName, ...(aliasesByOpponent.get(o.id) ?? [])]) {
      // An unmerged spelling maps to ITSELF: the viewer's list is keyed on normalized names,
      // so a sibling's spelling the viewer has never seen still lights that row if the viewer
      // happens to have played them under exactly that name.
      keys.add(viewerKeyFor.get(spelling) ?? spelling);
    }
  }
  return [...keys];
}

// ── Assembly ────────────────────────────────────────────────────────────────────────────

/**
 * The six reads the club layer needs, behind an interface.
 *
 * ⚠ **THE SEAM EXISTS FOR ONE TEST.** "Book content never crosses an organization" is this
 * feature's non-negotiable promise, and a promise you can only assert by reading the source is
 * a promise nothing enforces. With this interface, `tests/unit/coach-club-book.test.ts` runs
 * the real assembly against an ADVERSARIAL reader that holds two orgs' data and hands back the
 * other org's rows the moment a call arrives with the wrong `orgId` — the exact failure an
 * unfiltered query would produce. The assembly is the code that ships; only the reads are fake.
 *
 * Every method takes `orgId` FIRST, deliberately: an implementation cannot forget to be
 * org-scoped without dropping a parameter the type demands.
 */
export interface ClubBookReader {
  /** Sharing teams in this org, excluding the viewer's own. */
  siblingTeams(orgId: string, viewerTeamId: string): Promise<{ id: string; name: string }[]>;
  opponents(orgId: string, teamIds: string[]): Promise<RepTeamOpponent[]>;
  aliases(orgId: string, teamIds: string[]): Promise<SiblingAliasRow[]>;
  observations(
    orgId: string, opponentIds: string[], cap: number,
  ): Promise<Record<string, { observations: RepTeamOpponentObservation[]; total: number }>>;
  observationCounts(orgId: string, teamIds: string[]): Promise<Record<string, number>>;
  /**
   * Their games, per team. No `orgId`: the team ids came from `siblingTeams`, which IS the
   * org boundary, and rep_team_events has no org column to filter on anyway — stated here
   * rather than left as an inconsistency for a later reader to "fix" by inventing one.
   */
  gameEventsByTeam(teamIds: string[]): Promise<Record<string, OpponentGameInput[]>>;
}

/**
 * "What does the rest of the club know about this opponent?"
 *
 * Two phases on purpose. The CHEAP read (their opponent rows + aliases) decides which siblings
 * know this team at all; only those siblings pay for the heavy reads (their games, their
 * observations). A club of twenty teams where two have met this opponent runs two game reads,
 * not twenty.
 *
 * Returns null when nothing is there — the section is ABSENT, never an empty shell.
 *
 * ⚠ Callers must have resolved `canSeeClubLayer` first. Reciprocity and the plan gate are the
 * route's decision; this is the assembly, not the door.
 */
export async function buildClubBookBlock(reader: ClubBookReader, opts: {
  orgId: string;
  /** The viewer's team, excluded from its own club layer. */
  viewerTeamId: string;
  /** The viewer's whole key space for this opponent: the entry key + its merged spellings. */
  matchKeys: string[];
  /** Injected, never read from the clock here (date-correctness guardrail). */
  nowIso: string;
}): Promise<ClubBookBlock | null> {
  const { orgId, viewerTeamId, matchKeys, nowIso } = opts;
  const siblings = await reader.siblingTeams(orgId, viewerTeamId);
  if (siblings.length === 0) return null;

  const siblingIds = siblings.map(s => s.id);
  const [siblingOpponents, siblingAliases] = await Promise.all([
    reader.opponents(orgId, siblingIds),
    reader.aliases(orgId, siblingIds),
  ]);

  const matches = matchSiblingBooks({ matchKeys, siblingOpponents, siblingAliases });
  if (matches.length === 0) return null;

  const matchedTeamIds = matches.map(m => m.teamId);
  const matchedOpponentIds = matches.flatMap(m => m.opponentIds);
  const [observationsByOpponent, eventsByTeam] = await Promise.all([
    reader.observations(orgId, matchedOpponentIds, CLUB_TEAM_OBSERVATION_CAP),
    reader.gameEventsByTeam(matchedTeamIds),
  ]);

  const nameById = new Map(siblings.map(s => [s.id, s.name]));
  const blocks: ClubBookTeamBlock[] = [];

  for (const match of matches) {
    // Their record, through their OWN book build — their aliases, their games, the wrapped
    // counting rule — so this number equals the one on their own opponent page.
    const theirEntries = buildOpponentBook({
      events: eventsByTeam[match.teamId] ?? [],
      opponents: siblingOpponents.filter(o => o.teamId === match.teamId),
      aliases: siblingAliases.filter(a => a.teamId === match.teamId),
      nowIso,
    });
    const record = combineSiblingRecord(theirEntries, match.keys);

    // A team's two un-merged spellings are one voice: merge their logs, newest first, then
    // re-apply the cap so folding cannot smuggle past the per-team bound.
    let observationCount = 0;
    const merged: RepTeamOpponentObservation[] = [];
    for (const opponentId of match.opponentIds) {
      const bucket = observationsByOpponent[opponentId];
      if (!bucket) continue;
      observationCount += bucket.total;
      merged.push(...bucket.observations);
    }
    merged.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

    const block: ClubBookTeamBlock = {
      teamId: match.teamId,
      teamName: nameById.get(match.teamId) ?? 'A club team',
      record,
      summary: match.summary,
      observations: merged.slice(0, CLUB_TEAM_OBSERVATION_CAP),
      observationCount,
    };
    if (siblingBlockHasContent(block)) blocks.push(block);
  }

  if (blocks.length === 0) return null;
  return {
    teams: sortClubTeamBlocks(blocks),
    observationCount: blocks.reduce((sum, b) => sum + b.observationCount, 0),
  };
}

/**
 * "How many observations does the rest of the club have on this opponent?" — and NOTHING else.
 *
 * The game drawer's teaser is one line with one number in it (plan §4.3: the drawer stays a
 * glance, no sibling prose inline). Assembling the full block for it meant reading every
 * matched sibling's entire game history — to compute records the drawer never renders — and
 * pulling their observation text across the wire to be counted and discarded.
 *
 * So this shares the CHEAP half of `buildClubBookBlock` — the same sibling resolution, the same
 * org scoping, the same reciprocity precondition — and then stops. No game reads at all, and
 * `cap: 0` means no observation body is fetched either: the count comes from a `head` count.
 * `tests/unit/coach-club-book.test.ts` asserts the heavy reads are never even called.
 */
export async function buildClubObservationCount(reader: ClubBookReader, opts: {
  orgId: string;
  viewerTeamId: string;
  matchKeys: string[];
}): Promise<number> {
  const { orgId, viewerTeamId, matchKeys } = opts;
  const siblings = await reader.siblingTeams(orgId, viewerTeamId);
  if (siblings.length === 0) return 0;

  const siblingIds = siblings.map(s => s.id);
  const [siblingOpponents, siblingAliases] = await Promise.all([
    reader.opponents(orgId, siblingIds),
    reader.aliases(orgId, siblingIds),
  ]);

  const matchedOpponentIds = matchSiblingBooks({ matchKeys, siblingOpponents, siblingAliases })
    .flatMap(m => m.opponentIds);
  if (matchedOpponentIds.length === 0) return 0;

  const totals = await reader.observations(orgId, matchedOpponentIds, 0);
  return Object.values(totals).reduce((sum, t) => sum + t.total, 0);
}

/**
 * Which of the viewer's opponent-list rows the club has something to say about — ONE batched
 * lookup for the whole list, resolved into the viewer's key space through their own merges.
 * Returns [] when the club has nothing (or has no other sharing teams).
 */
export async function buildClubContentKeys(reader: ClubBookReader, opts: {
  orgId: string;
  viewerTeamId: string;
  /**
   * The viewer's own book entries — accepted as a PROMISE so the caller can start this club
   * lookup alongside its own reads instead of after them. Nothing here needs the viewer's
   * entries until the final synchronous combine, so waiting for them first would spend a
   * whole round trip's latency on a dependency that does not exist.
   */
  viewerEntries: { key: string; aliasKeys: string[] }[] | Promise<{ key: string; aliasKeys: string[] }[]>;
}): Promise<string[]> {
  const siblings = await reader.siblingTeams(opts.orgId, opts.viewerTeamId);
  if (siblings.length === 0) return [];
  const siblingIds = siblings.map(s => s.id);

  const [siblingOpponents, siblingAliases, observationCounts, viewerEntries] = await Promise.all([
    reader.opponents(opts.orgId, siblingIds),
    reader.aliases(opts.orgId, siblingIds),
    reader.observationCounts(opts.orgId, siblingIds),
    opts.viewerEntries,
  ]);

  return clubContentKeys({
    viewerEntries,
    siblingOpponents,
    siblingAliases,
    observationCounts,
  });
}
