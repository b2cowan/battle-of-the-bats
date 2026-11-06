import 'server-only';
/**
 * THE TEAM'S PAST PLAYERS — the read behind "Bring back a past player" and every "Same child?" question, and the one
 * write that brings a child back (Club Tier Stage 14 S3; owner rulings 2026-11-04, Asks 4, 5, 9, 12). Words and the
 * match rule live in `lib/past-player-words.ts`.
 *
 * ⚖ The look-back's three answers (CLAUDE.md, "A year parameter is a DECISION"; the drawing's tab 3 panel):
 *   1. RECORD READ FEEDING ONE WRITE — a past entry's name, number, season, family and that season's dues, read only to
 *      add the child to the WORKING season (an instrument never reaches back: nothing here moves money or messages
 *      anyone). Past dues are shown and stay on their own book.
 *   2. NO SUBTREE — nothing opens the old season; a row is a line in a window, never a door.
 *   3. EVERY ROW NAMES ITS SEASON ("Last played the 2025 Season").
 * The picker's GET is registered in `CROSS_SEASON_READERS` (tests/unit/coach-history-endpoint-guard.test.ts).
 *
 * ⚖ Ask 9: THIS team's seasons only — never another team's, never the house league (the cross-team picker is held).
 * Birth date, family and dues need the roster-details grant (`rosterPii`), the grant that hides them on the roster.
 */
import { supabaseAdmin } from './supabase-admin';
import {
  getRepTeamRosterEntriesAllSeasons,
  getRepProgramYears,
  createRepRosterPlayer,
  suggestContinuityLinksBulk,
  ATTENDANCE_GAME_TYPES,
} from './db';
import { readRepMoney } from './families-read';
import { cutoffFor } from './born-years';
import { sameName } from './past-player-words';
import {
  partitionEntries, toPastPlayers, carriedEntryFields, decideAcceptWith, acceptLookupIds,
  type PastPlayersRead, type PastPlayersAccess, type AcceptAnswer, type AcceptDecision,
} from './past-player-rules';
import type { RepProgramYear, RepRosterPlayer } from './types';

/**
 * Read this team's past players for the working season. `withDues` is the picker's read: each latest entry's season book
 * and a call-up's games (the add doors' re-checks need neither). The rules are pure and live in `past-player-rules.ts`;
 * routes import them from there.
 */
export async function readPastPlayers(p: {
  orgId: string;
  team: { id: string; sport: string | null };
  workingSeason: RepProgramYear;
  cutoffs: unknown;
  access: PastPlayersAccess;
  withDues?: boolean;
}): Promise<PastPlayersRead> {
  const [entries, seasons] = await Promise.all([
    getRepTeamRosterEntriesAllSeasons(p.team.id),
    getRepProgramYears(p.team.id),
  ]);
  const working = p.workingSeason;
  const { seasonById, onWorking, latest } = partitionEntries(entries, seasons, working);
  const answeredNo = await answeredNoForSeason(onWorking, latest);

  const callUpIds = [...latest.values()].filter(e => e.status === 'callup').map(e => e.id);
  const [callUpGames, money] = await Promise.all([
    p.withDues ? countCallUpGames(callUpIds) : Promise.resolve(new Map<string, number>()),
    p.withDues && p.access.money && p.access.rosterPii
      ? readRepMoney(p.orgId, [...latest.values()].filter(e => e.status !== 'callup').map(e => ({
          id: e.id,
          program_year_id: e.programYearId,
          rep_program_years: { credit_application: seasonById.get(e.programYearId)?.creditApplication ?? 'next_first' },
        })))
      : Promise.resolve(null),
  ]);

  const past = toPastPlayers({
    latest, seasonById, callUpGames, figures: money?.figures ?? null, access: p.access,
    born: { from: working.bornFromYear ?? null, to: working.bornToYear ?? null },
    cutoff: cutoffFor(p.cutoffs, p.team.sport),
  });

  return {
    past,
    latest,
    onWorking,
    answeredNo,
    hasEarlierSeasons: seasons.some(s => s.id !== working.id && s.year <= working.year),
    workingSeason: { id: working.id, name: working.name, year: working.year },
  };
}

/**
 * Past children a coach already said "no" to for a same-name player who is NOW on this season's roster (the "No, a
 * different child" that added the new player). The add doors leave them out of the question: typing the name again,
 * or pasting it, is not asked a second time. One small read, and only when a past namesake of a rostered player exists.
 */
async function answeredNoForSeason(
  onWorking: ReadonlyMap<string, RepRosterPlayer>,
  latest: ReadonlyMap<string, RepRosterPlayer>,
): Promise<Set<string>> {
  const out = new Set<string>();
  const here = [...onWorking.values()].filter(e => e.status !== 'callup'
    && [...latest.values()].some(p => sameName(e.playerFirstName, e.playerLastName, p.playerFirstName, p.playerLastName)));
  if (here.length === 0) return out;
  const ids = here.map(e => e.childId).join(',');
  const { data, error } = await supabaseAdmin
    .from('child_match_rejections')
    .select('child_a_id, child_b_id')
    .or(`child_a_id.in.(${ids}),child_b_id.in.(${ids})`);
  if (error) throw error;
  const hereById = new Map(here.map(e => [e.childId, e]));
  for (const r of (data ?? []) as { child_a_id: string; child_b_id: string }[]) {
    for (const [w, p] of [[r.child_a_id, r.child_b_id], [r.child_b_id, r.child_a_id]] as const) {
      const mine = hereById.get(w), theirs = latest.get(p);
      if (mine && theirs && sameName(mine.playerFirstName, mine.playerLastName, theirs.playerFirstName, theirs.playerLastName)) out.add(p);
    }
  }
  return out;
}

async function countCallUpGames(playerIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (playerIds.length === 0) return counts;
  const { data, error } = await supabaseAdmin
    .from('rep_team_call_up_appearances')
    .select('player_id')
    .in('player_id', playerIds);
  if (error) throw error;
  for (const r of data ?? []) {
    const id = (r as { player_id: string }).player_id;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

/** The stored "no"s between `childId` and any of `others` (mig 438) — the children a question must leave out. */
async function rejectedChildren(childId: string, others: readonly string[]): Promise<Set<string>> {
  const out = new Set<string>();
  if (others.length === 0) return out;
  const { data, error } = await supabaseAdmin
    .from('child_match_rejections')
    .select('child_a_id, child_b_id')
    .or(`child_a_id.eq.${childId},child_b_id.eq.${childId}`);
  if (error) throw error;
  const wanted = new Set(others);
  for (const r of (data ?? []) as { child_a_id: string; child_b_id: string }[]) {
    const other = r.child_a_id === childId ? r.child_b_id : r.child_a_id;
    if (wanted.has(other)) out.add(other);
  }
  return out;
}

/** Store "not the same child" for each pair (ordered; a repeat is a no-op). Best-effort callers may catch. */
export async function storeNotSameChild(
  childId: string,
  others: readonly string[],
  door: 'single_add' | 'paste_list' | 'tryout_accept' | 'children_queue' | 'split',
  userId: string | null,
): Promise<void> {
  const rows = [...new Set(others)].filter(o => o && o !== childId).map(o => ({
    child_a_id: childId < o ? childId : o,
    child_b_id: childId < o ? o : childId,
    door,
    rejected_by: userId,
  }));
  if (rows.length === 0) return;
  const { error } = await supabaseAdmin
    .from('child_match_rejections')
    .upsert(rows, { onConflict: 'child_a_id,child_b_id', ignoreDuplicates: true });
  if (error) throw error;
}

type BringBackOverrides = Partial<Pick<RepRosterPlayer,
  'playerFirstName' | 'playerLastName' | 'playerDateOfBirth' | 'playerNumber' | 'primaryPosition'
  | 'guardianFirstName' | 'guardianLastName' | 'guardianEmail' | 'guardianPhone' | 'notes'>> & { adminNotes?: string | null };

/**
 * Bring ONE child back onto the working season: a new entry ON THAT CHILD (a fact — Ask 4), copied from their latest
 * entry (typed values win over the copy; a blank box keeps the copy), active, and the history link minted CONFIRMED
 * old → new exactly as the roll mints it (best-effort: the child is set on the entry itself, so a failed link never
 * splits the child). Throws `isChildAlreadyOnSeason` when another door got there first.
 */
export async function bringBackChild(p: {
  orgId: string;
  teamId: string;
  workingSeasonId: string;
  prior: RepRosterPlayer;
  userId: string;
  overrides?: BringBackOverrides;
  displayOrder?: number;
}): Promise<{ player: RepRosterPlayer; linked: boolean }> {
  const copy = carriedEntryFields(p.prior);
  const { adminNotes, ...typedFields } = p.overrides ?? {};
  // A typed value wins; a blank (or all-spaces) box keeps the copy.
  const typed: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(typedFields)) {
    const value = typeof v === 'string' ? v.trim() : v;
    if (value !== null && value !== undefined && value !== '') typed[k] = value;
  }
  const player = await createRepRosterPlayer({
    programYearId: p.workingSeasonId,
    teamId: p.teamId,
    orgId: p.orgId,
    source: 'admin_manual',
    status: 'active',
    ...copy,
    ...(typed as Omit<BringBackOverrides, 'adminNotes'>),
    adminNotes: typeof adminNotes === 'string' && adminNotes.trim() ? adminNotes.trim() : null,
    ...(p.displayOrder !== undefined ? { displayOrder: p.displayOrder } : {}),
  });
  let linked = false;
  // A call-up's entry is never a link side (mig 309); the child is still the same, set on the entry above.
  if (p.prior.status !== 'callup') {
    try {
      const minted = await suggestContinuityLinksBulk(
        [{ orgId: p.orgId, teamId: p.teamId, currentRosterId: player.id, priorRosterId: p.prior.id, confidence: 'high' as const }],
        { status: 'confirmed', decidedBy: p.userId },
      );
      linked = minted.length > 0;
    } catch (e) {
      console.error('[past-players] history link mint failed (non-blocking):', e);
    }
  }
  return { player, linked };
}

/**
 * "Back from the 2025 Season" under a name on the roster, until the team's first game (tab 3). Shown for a child who
 * LEFT and came back: their previous entry on this team is from an older season than the one just before, or they were
 * not active in it (inactive, a call-up). A player who simply rolled up with the team gets no caption. Team-level
 * "first game" (a scheduled game whose start has passed) — attendance is not marked reliably enough to go per player.
 */
export async function returningCaptions(p: {
  teamId: string;
  workingSeason: RepProgramYear;
  workingEntries: readonly RepRosterPlayer[];
}): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const candidates = p.workingEntries.filter(e => e.status === 'active');
  if (candidates.length === 0) return out;
  // The small reads first: a team's first season has no earlier entries to fetch (the roster's busiest read stays light).
  const seasons = await getRepProgramYears(p.teamId);
  const earlier = seasons.filter(s => s.year < p.workingSeason.year).sort((a, b) => b.year - a.year);
  if (earlier.length === 0) return out;
  const [{ count, error }, entries] = await Promise.all([
    supabaseAdmin
      .from('rep_team_events')
      .select('id', { count: 'exact', head: true })
      .eq('program_year_id', p.workingSeason.id)
      .in('event_type', ATTENDANCE_GAME_TYPES)
      .eq('status', 'scheduled')
      .lte('starts_at', new Date().toISOString()),
    getRepTeamRosterEntriesAllSeasons(p.teamId),
  ]);
  if (error) throw error;
  if ((count ?? 0) > 0) return out;

  const yearOf = new Map(seasons.map(s => [s.id, s]));
  const justBefore = earlier[0].id;
  const byChild = new Map<string, RepRosterPlayer>();
  for (const e of entries) {
    const s = yearOf.get(e.programYearId);
    if (!s || s.year >= p.workingSeason.year) continue;
    const prev = byChild.get(e.childId);
    if (!prev || s.year >= (yearOf.get(prev.programYearId)?.year ?? -Infinity)) byChild.set(e.childId, e);
  }
  for (const e of candidates) {
    const prior = byChild.get(e.childId);
    if (!prior) continue;
    if (prior.programYearId === justBefore && prior.status === 'active') continue;
    out[e.id] = yearOf.get(prior.programYearId)!.name;
  }
  return out;
}

/** THE ACCEPT RULE, with its one read: the stored "no"s between the sign-up's child and the children it could be. */
export async function decideAccept(
  read: Pick<PastPlayersRead, 'past' | 'latest' | 'onWorking'>,
  reg: { childId: string; playerFirstName: string; playerLastName: string | null },
  answer: AcceptAnswer,
): Promise<AcceptDecision> {
  const stored = await rejectedChildren(reg.childId, acceptLookupIds(read, reg));
  return decideAcceptWith(read, reg, answer, stored);
}

/**
 * A "yes" at accept: the head coach's returning-player link, CONFIRMED, from this sign-up to the child's latest entry
 * on this team — the board's own "Confirm — same player", so the board shows it and an undo there splits it (S2). The
 * confirm joins the sign-up's child into the past child, and the accept's roster row then takes it.
 */
export async function confirmReturningAtAccept(p: {
  orgId: string; teamId: string; registrationId: string; prior: RepRosterPlayer; userId: string;
}): Promise<void> {
  const { data: existing, error } = await supabaseAdmin
    .from('rep_player_continuity_links')
    .select('id, status')
    .eq('team_id', p.teamId)
    .eq('current_registration_id', p.registrationId)
    .eq('prior_roster_id', p.prior.id)
    .maybeSingle<{ id: string; status: string }>();
  if (error) throw error;
  const now = new Date().toISOString();
  if (existing) {
    if (existing.status === 'confirmed') return;
    const { error: upErr } = await supabaseAdmin
      .from('rep_player_continuity_links')
      .update({ status: 'confirmed', decided_by: p.userId, decided_at: now, updated_at: now })
      .eq('id', existing.id);
    if (upErr) throw upErr;
    return;
  }
  const { error: insErr } = await supabaseAdmin.from('rep_player_continuity_links').insert({
    org_id: p.orgId, team_id: p.teamId,
    current_registration_id: p.registrationId, prior_roster_id: p.prior.id,
    confidence: 'high', status: 'confirmed', decided_by: p.userId, decided_at: now,
  });
  if (insErr) throw insErr;
}

/**
 * A "no" at accept: stored against the children (never asked again), and the board's own SUGGESTED links between this
 * sign-up and those children's entries on this team are rejected too, so the board and the window agree.
 */
export async function rejectAtAccept(p: {
  teamId: string; registrationId: string; childId: string; notSameChildIds: string[]; userId: string;
}): Promise<void> {
  if (p.notSameChildIds.length === 0) return;
  await storeNotSameChild(p.childId, p.notSameChildIds, 'tryout_accept', p.userId);
  const { data: entries, error } = await supabaseAdmin
    .from('rep_roster_players')
    .select('id')
    .eq('team_id', p.teamId)
    .in('child_id', p.notSameChildIds);
  if (error) throw error;
  const ids = (entries ?? []).map(e => (e as { id: string }).id);
  if (ids.length === 0) return;
  const now = new Date().toISOString();
  const { error: upErr } = await supabaseAdmin
    .from('rep_player_continuity_links')
    .update({ status: 'rejected', decided_by: p.userId, decided_at: now, updated_at: now })
    .eq('team_id', p.teamId)
    .eq('current_registration_id', p.registrationId)
    .eq('status', 'suggested')
    .in('prior_roster_id', ids);
  if (upErr) throw upErr;
}
