import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { chunked } from './supabase-paging';
import { loadRegistrationMoneyLines } from './league-money-read';
import { receivedOf } from './league-money';
import { registrationOwes } from './league-price';
import { tournamentToday } from './timezone';
import { coachNameParts } from './house-league-coach-invites';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * TEAMS & DRAFT — THE ONE READ AND THE WRITES (Club Tier Stage 9c, Parts 2-4).
 *
 * `readDivisionBoard` is the board, the setup window, the Publish window's checks and the draft's input, all from one read
 * (build prompt Part 2: "the setup window's lines come from the same read as the draft"). It carries no rating: a rating is
 * added by the board route, through lib/house-league-ratings.ts, only for a reader the gate lets see it (9c·2a).
 *
 * Every team change goes through mig 377's functions, which lock the division: the draft (`league_division_draft_apply`),
 * "Take all players off teams" (`league_division_clear`), one player (`league_team_place`) and Publish
 * (`league_division_publish`). Nothing here writes `team_id` directly.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

export type CoachState = 'waiting' | 'invited' | 'joined' | 'expired' | 'failed';

export interface BoardCoach {
  id: string;
  name: string;
  /** The two parts of the typed name, for the edit form (a coach from before mig 381 is split at the first space). */
  firstName: string;
  lastName: string;
  email: string;
  state: CoachState;
  invitedAt: string | null;
}

export interface BoardTeam {
  id: string;
  name: string;
  color: string | null;
  coaches: BoardCoach[];
}

export interface BoardPlayer {
  id: string;
  firstName: string;
  lastName: string;
  /** Age today, or null when no date of birth was given. */
  age: number | null;
  teamId: string | null;
  locked: boolean;
  /** The team the last draft dealt them to: before publishing, a different team is "Moved by you". */
  draftTeamId: string | null;
  /** What they still owe (staff only), or null when nothing is owed. */
  owes: number | null;
  askedToWithdrawAt: string | null;
  guardianFirstName: string;
  guardianLastName: string;
  /** Trimmed and lower-cased: the household key (a family is one guardian email, never a surname). */
  guardianEmail: string;
}

export interface BoardLeft {
  id: string;
  name: string;
  teamId: string;
  at: string;
}

export interface BoardEmails {
  /** Families written an email at Publish, and how many of those went (the result line's "{n} families emailed"). */
  atPublish: number;
  atPublishSent: number;
  /** Every email of the division not yet sent — failed, never started, or held by a send that died ("Send the {n} again"). */
  unsent: number;
}

export interface DivisionBoard {
  division: { id: string; name: string; publishedAt: string | null };
  fingerprint: string;
  teams: BoardTeam[];
  players: BoardPlayer[];
  notDrafted: { review: { id: string; name: string }[]; waitlisted: number };
  left: BoardLeft[];
  emails: BoardEmails;
}

export interface DivisionTab {
  id: string;
  name: string;
  accepted: number;
  capacity: number | null;
  publishedAt: string | null;
}

/** The coach's line under their name (copy §2.2). There is no "didn't arrive": the product cannot see a bounce. It can see
 *  a send that failed (mig 379): "Invite didn't send · Send again". */
export function coachState(
  row: { invited_at: string | null; expires_at: string | null; accepted_at: string | null; invite_failed_at?: string | null },
  now: Date = new Date(),
): CoachState {
  if (row.accepted_at) return 'joined';
  if (!row.invited_at) return 'waiting';
  if (row.invite_failed_at) return 'failed';
  if (row.expires_at && new Date(row.expires_at).getTime() <= now.getTime()) return 'expired';
  return 'invited';
}

/** Age in whole years on `today` (YYYY-MM-DD), from a date of birth (YYYY-MM-DD). */
export function ageOn(dateOfBirth: string | null | undefined, today: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateOfBirth ?? '');
  const t = /^(\d{4})-(\d{2})-(\d{2})/.exec(today);
  if (!m || !t) return null;
  let age = Number(t[1]) - Number(m[1]);
  if (Number(t[2]) < Number(m[2]) || (t[2] === m[2] && Number(t[3]) < Number(m[3]))) age -= 1;
  return age >= 0 && age < 120 ? age : null;
}

/** The season's divisions as tabs: each with its accepted count and whether it is published. */
export async function readDivisionTabs(seasonId: string): Promise<DivisionTab[]> {
  const { data: divisions, error } = await supabaseAdmin.from('league_divisions')
    .select('id, name, capacity, teams_published_at').eq('season_id', seasonId).order('sort_order').order('created_at');
  if (error) throw new Error(`Couldn't read divisions: ${error.message}`);
  const { data: regs, error: regError } = await supabaseAdmin.from('league_registrations')
    .select('division_id').eq('season_id', seasonId).eq('status', 'active');
  if (regError) throw new Error(`Couldn't read registrations: ${regError.message}`);
  const counts = new Map<string, number>();
  for (const r of regs ?? []) if (r.division_id) counts.set(r.division_id, (counts.get(r.division_id) ?? 0) + 1);
  return (divisions ?? []).map(d => ({
    id: d.id, name: d.name, capacity: d.capacity ?? null, accepted: counts.get(d.id) ?? 0,
    publishedAt: d.teams_published_at ?? null,
  }));
}

const BOARD_REG_COLUMNS =
  'id, status, player_first_name, player_last_name, player_date_of_birth, team_id, team_locked_at, draft_team_id, '
  + 'previous_team_id, team_changed_at, fee_amount, withdraw_requested_at, guardian_first_name, guardian_last_name, guardian_email';

/** One division's board. The season and division are the caller's, already proven to be this org's. */
export async function readDivisionBoard(
  season: { id: string; registrationFee: number | null },
  divisionId: string,
  now: Date = new Date(),
): Promise<DivisionBoard | null> {
  const { data: division, error: divError } = await supabaseAdmin.from('league_divisions')
    .select('id, name, teams_published_at').eq('id', divisionId).eq('season_id', season.id).maybeSingle();
  if (divError) throw new Error(`Couldn't read the division: ${divError.message}`);
  if (!division) return null;

  // The fingerprint is read BEFORE the rows: a change landing between them makes the window look stale (refused on its
  // press), never fresh over old rows (/review 2026-10-25).
  const fingerprintRes = await supabaseAdmin.rpc('league_division_fingerprint', { p_division: divisionId });
  const [teamsRes, regsRes, emailsRes] = await Promise.all([
    supabaseAdmin.from('league_teams').select('id, name, color').eq('division_id', divisionId)
      .order('sort_order').order('created_at'),
    supabaseAdmin.from('league_registrations').select(BOARD_REG_COLUMNS).eq('season_id', season.id)
      .eq('division_id', divisionId).order('player_last_name').order('player_first_name'),
    supabaseAdmin.from('league_placement_emails').select('status, kind, created_at').eq('division_id', divisionId),
  ]);
  for (const r of [teamsRes, regsRes, fingerprintRes, emailsRes] as { error: { message: string } | null }[]) {
    if (r.error) throw new Error(`Couldn't read the board: ${r.error.message}`);
  }
  const teamRows = (teamsRes.data ?? []) as { id: string; name: string; color: string | null }[];
  const teamIds = teamRows.map(t => t.id);
  const coachRows = teamIds.length === 0 ? [] : await readCoachRows(teamIds);

  const regs = (regsRes.data ?? []) as unknown as {
    id: string; status: string; player_first_name: string; player_last_name: string; player_date_of_birth: string | null;
    team_id: string | null; team_locked_at: string | null; draft_team_id: string | null; previous_team_id: string | null;
    team_changed_at: string | null; fee_amount: number | null; withdraw_requested_at: string | null;
    guardian_first_name: string | null; guardian_last_name: string | null; guardian_email: string | null;
  }[];
  const accepted = regs.filter(r => r.status === 'active');
  const lines = await loadRegistrationMoneyLines(accepted.map(r => r.id));
  const today = tournamentToday();

  const players: BoardPlayer[] = accepted.map(r => {
    const price = registrationOwes({ feeAmount: r.fee_amount }, season) ?? 0;
    const owes = Math.max(0, Math.round((price - receivedOf(lines.get(r.id) ?? [])) * 100) / 100);
    return {
      id: r.id, firstName: r.player_first_name, lastName: r.player_last_name,
      age: ageOn(r.player_date_of_birth, today),
      teamId: r.team_id, locked: !!r.team_locked_at, draftTeamId: r.draft_team_id,
      owes: owes > 0 ? owes : null, askedToWithdrawAt: r.withdraw_requested_at,
      guardianFirstName: r.guardian_first_name ?? '', guardianLastName: r.guardian_last_name ?? '', guardianEmail: (r.guardian_email ?? '').trim().toLowerCase(),
    };
  });

  const inDivision = new Set(teamIds);
  const left: BoardLeft[] = regs
    .filter(r => (r.status === 'declined' || r.status === 'withdrawn') && r.previous_team_id && inDivision.has(r.previous_team_id) && r.team_changed_at)
    .map(r => ({ id: r.id, name: `${r.player_first_name} ${r.player_last_name}`, teamId: r.previous_team_id!, at: r.team_changed_at! }));

  const emailRows = (emailsRes.data ?? []) as { status: string; kind: string; created_at: string }[];
  const publishedAt = division.teams_published_at as string | null;
  const atPublish = publishedAt
    ? emailRows.filter(e => e.kind === 'placed' && new Date(e.created_at).getTime() === new Date(publishedAt).getTime())
    : [];
  const emails: BoardEmails = {
    atPublish: atPublish.length,
    atPublishSent: atPublish.filter(e => e.status === 'sent' || e.status === 'skipped').length,
    unsent: emailRows.filter(e => e.status === 'failed' || e.status === 'pending' || e.status === 'sending').length,
  };

  return {
    division: { id: division.id, name: division.name, publishedAt },
    fingerprint: fingerprintRes.data as string,
    teams: teamRows.map(t => ({
      id: t.id, name: t.name, color: t.color,
      coaches: coachRows.filter(c => c.team_id === t.id).map(c => ({
        id: c.id, name: c.name, ...coachNameParts(c), email: c.email, state: coachState(c, now), invitedAt: c.invited_at,
      })),
    })),
    players,
    notDrafted: {
      review: regs.filter(r => r.status === 'pending_review')
        .map(r => ({ id: r.id, name: `${r.player_first_name} ${r.player_last_name}` })),
      waitlisted: regs.filter(r => r.status === 'waitlisted').length,
    },
    left,
    emails,
  };
}

/**
 * The families' sign-up notes for one division's accepted players (A8), as id → note, blank notes left out. NOT part of
 * the board: the draft and Publish read `readDivisionBoard` too, and a note goes only to a reader who can already open
 * that registration. The board route adds it behind the same gate the registrations read uses;
 * tests/unit/house-league-board-notes-guard.test.ts holds both ends.
 */
export async function readBoardNotes(seasonId: string, divisionId: string): Promise<Record<string, string>> {
  const { data, error } = await supabaseAdmin.from('league_registrations').select('id, player_notes')
    .eq('season_id', seasonId).eq('division_id', divisionId).eq('status', 'active');
  if (error) throw new Error(`Couldn't read the notes: ${error.message}`);
  const out: Record<string, string> = {};
  for (const r of (data ?? []) as { id: string; player_notes: string | null }[]) {
    const note = (r.player_notes ?? '').trim();
    if (note) out[r.id] = note;
  }
  return out;
}

interface CoachRow {
  id: string; team_id: string; name: string; first_name: string | null; last_name: string | null; email: string;
  invited_at: string | null; expires_at: string | null; accepted_at: string | null; invite_failed_at: string | null;
}

async function readCoachRows(teamIds: readonly string[]): Promise<CoachRow[]> {
  const out: CoachRow[] = [];
  for (const chunk of chunked([...teamIds])) {
    const { data, error } = await supabaseAdmin.from('league_team_coaches')
      .select('id, team_id, name, first_name, last_name, email, invited_at, expires_at, accepted_at, invite_failed_at')
      .in('team_id', chunk).is('removed_at', null).order('created_at');
    if (error) throw new Error(`Couldn't read coaches: ${error.message}`);
    out.push(...((data ?? []) as CoachRow[]));
  }
  return out;
}

// ── The writes ───────────────────────────────────────────────────────────────────────────────

/** What the draft, clear and publish functions refuse with, as the routes word them (copy §4.3, §7.3). */
export type DivisionRefusal = 'finished' | 'published' | 'changed';

export async function applyDraft(
  orgId: string, seasonId: string, divisionId: string, fingerprint: string, deal: ReadonlyMap<string, string>,
): Promise<DivisionRefusal | null> {
  const regs = [...deal.keys()];
  const { data, error } = await supabaseAdmin.rpc('league_division_draft_apply', {
    p_org: orgId, p_season: seasonId, p_division: divisionId, p_fingerprint: fingerprint,
    p_regs: regs, p_teams: regs.map(r => deal.get(r)!),
  });
  if (error) throw new Error(`The draft didn't save: ${error.message}`);
  return (data as DivisionRefusal | null) ?? null;
}

export async function clearDivision(
  orgId: string, seasonId: string, divisionId: string, fingerprint: string,
): Promise<DivisionRefusal | null> {
  const { data, error } = await supabaseAdmin.rpc('league_division_clear', {
    p_org: orgId, p_season: seasonId, p_division: divisionId, p_fingerprint: fingerprint,
  });
  if (error) throw new Error(`Couldn't take players off teams: ${error.message}`);
  return (data as DivisionRefusal | null) ?? null;
}

export type PlaceRefusal = 'finished' | 'not_accepted' | 'no_division' | 'team' | 'published';

/**
 * One player onto a team (or off it, with null). Before publishing it is immediate and silent. After publishing it is
 * refused unless `confirmed` (the held window, 9c·12); then the returned email row is the family's email, to send.
 */
export async function placePlayer(
  orgId: string, seasonId: string, registrationId: string, teamId: string | null, confirmed: boolean, actorId: string,
): Promise<{ refusal: PlaceRefusal } | { emailId: string | null }> {
  const { data, error } = await supabaseAdmin.rpc('league_team_place', {
    p_org: orgId, p_season: seasonId, p_registration: registrationId, p_team: teamId, p_confirmed: confirmed, p_actor: actorId,
  });
  if (error) throw new Error(`Couldn't move the player: ${error.message}`);
  const row = (Array.isArray(data) ? data[0] : data) as { refusal: PlaceRefusal | null; email: string | null } | undefined;
  if (row?.refusal) return { refusal: row.refusal };
  return { emailId: row?.email ?? null };
}

export type LockRefusal = 'no_team' | 'published';

/**
 * Lock a player to the team they are on, or unlock them (9c·3). Before publishing only: a lock is held against a draft,
 * and there is no draft after it. Null when it landed, else why not. A lock that races a Publish is taken back (Publish
 * clears every lock in its own transaction, so one written just after it would linger on a published division).
 */
export async function setLock(seasonId: string, registrationId: string, locked: boolean): Promise<LockRefusal | null> {
  const { data: reg, error } = await supabaseAdmin.from('league_registrations')
    .select('division_id, team_id, status').eq('id', registrationId).eq('season_id', seasonId).maybeSingle();
  if (error) throw new Error(`Couldn't read the player: ${error.message}`);
  if (!reg || reg.status !== 'active' || !reg.team_id || !reg.division_id) return 'no_team';
  const published = async () => {
    const { data: div } = await supabaseAdmin.from('league_divisions').select('teams_published_at').eq('id', reg.division_id).maybeSingle();
    return !!div?.teams_published_at;
  };
  if (await published()) return 'published';
  const { data: updated, error: updateError } = await supabaseAdmin.from('league_registrations')
    .update({ team_locked_at: locked ? new Date().toISOString() : null })
    .eq('id', registrationId).eq('season_id', seasonId).eq('team_id', reg.team_id).eq('status', 'active')
    .select('id');
  if (updateError) throw new Error(`Couldn't ${locked ? 'lock' : 'unlock'} the player: ${updateError.message}`);
  if ((updated ?? []).length === 0) return 'no_team';
  if (locked && await published()) {
    await supabaseAdmin.from('league_registrations').update({ team_locked_at: null }).eq('id', registrationId);
    return 'published';
  }
  return null;
}
