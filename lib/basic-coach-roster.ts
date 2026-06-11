import 'server-only';
import { supabaseAdmin } from './supabase-admin';

/**
 * Master roster for org-less Basic coach teams (free-tier Phase 3, table mig 114).
 *
 * The PERSISTENT, IDENTITY-ONLY roster a coach builds once on their team home and reuses
 * across events. Lives on `basic_coach_team_players` keyed on `basic_coach_team_id`.
 *
 * Scope rules (do not widen):
 * - Identity only: name / jersey # / optional guardian contact / optional DOB / note + order.
 *   NO attendance, lineups, positions, dues, or documents — those are Premium (FT strategy §10/§12).
 * - `date_of_birth` is minor PII: optional, purpose-driven, consent-gated in the UI (FT §5/§14).
 * - Ownership is enforced by the CALLER (route) via `userOwnsBasicCoachTeam` before any function
 *   here runs; every mutation here ALSO scopes by `basic_coach_team_id` as defense-in-depth, so a
 *   valid session can never touch a player row that belongs to a different team.
 *
 * All queries use the service-role client (the table is RLS-enabled with no policies).
 */

export type BasicCoachTeamPlayer = {
  id: string;
  basicCoachTeamId: string;
  name: string;
  jerseyNumber: string | null;
  dateOfBirth: string | null; // 'YYYY-MM-DD' or null
  guardianName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  notes: string | null;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
};

/** A normalized create/update payload — already trimmed + null-coerced by the route. */
export type BasicCoachTeamPlayerInput = {
  name?: string;
  jerseyNumber?: string | null;
  dateOfBirth?: string | null;
  guardianName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  notes?: string | null;
};

type BasicCoachTeamPlayerRow = {
  id: string;
  basic_coach_team_id: string;
  name: string;
  jersey_number: string | null;
  date_of_birth: string | null;
  guardian_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  notes: string | null;
  display_order: number;
  created_at: string;
  updated_at: string;
};

const PLAYER_COLUMNS =
  'id, basic_coach_team_id, name, jersey_number, date_of_birth, guardian_name, contact_email, contact_phone, notes, display_order, created_at, updated_at';

function mapPlayer(row: BasicCoachTeamPlayerRow): BasicCoachTeamPlayer {
  return {
    id: row.id,
    basicCoachTeamId: row.basic_coach_team_id,
    name: row.name,
    jerseyNumber: row.jersey_number,
    dateOfBirth: row.date_of_birth,
    guardianName: row.guardian_name,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    notes: row.notes,
    displayOrder: row.display_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Translate the camelCase input into a snake_case DB payload, skipping `undefined` keys
 *  (so PATCH only writes the fields the caller actually provided). `name` is never nulled. */
function toDbPayload(input: BasicCoachTeamPlayerInput): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (input.name !== undefined) out.name = input.name;
  if (input.jerseyNumber !== undefined) out.jersey_number = input.jerseyNumber;
  if (input.dateOfBirth !== undefined) out.date_of_birth = input.dateOfBirth;
  if (input.guardianName !== undefined) out.guardian_name = input.guardianName;
  if (input.contactEmail !== undefined) out.contact_email = input.contactEmail;
  if (input.contactPhone !== undefined) out.contact_phone = input.contactPhone;
  if (input.notes !== undefined) out.notes = input.notes;
  return out;
}

/** True for 'YYYY-MM-DD' that also parses to a real calendar date. */
function isValidDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/**
 * Normalize a raw request body into a player input. Only keys PRESENT in the body are included
 * (so PATCH leaves omitted fields untouched); strings are trimmed and empties become null.
 * Identity fields only — any other key in the body is ignored ("roster fields scoped to Basic").
 * Returns an `error` string on an invalid DOB.
 */
// Server-side length caps (slightly above the editor's maxLength so trimming never false-rejects
// a legitimate client). The UI enforces shorter limits; these are the backstop for a direct API
// call, so an authenticated coach can't bloat storage on their own rows by bypassing the form.
const MAX_LENGTHS: Record<string, { max: number; label: string }> = {
  name: { max: 160, label: 'name' },
  jerseyNumber: { max: 16, label: 'jersey number' },
  guardianName: { max: 160, label: 'guardian name' },
  contactEmail: { max: 200, label: 'contact email' },
  contactPhone: { max: 40, label: 'contact phone' },
  notes: { max: 600, label: 'note' },
};

export function normalizeBasicCoachTeamPlayerBody(
  body: Record<string, unknown>,
): { input: BasicCoachTeamPlayerInput; error?: string } {
  const input: BasicCoachTeamPlayerInput = {};
  const trimmed = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const trimmedOrNull = (v: unknown) => {
    const s = trimmed(v);
    return s ? s : null;
  };

  if (body.name !== undefined) input.name = trimmed(body.name);
  if (body.jerseyNumber !== undefined) input.jerseyNumber = trimmedOrNull(body.jerseyNumber);
  if (body.guardianName !== undefined) input.guardianName = trimmedOrNull(body.guardianName);
  if (body.contactEmail !== undefined) input.contactEmail = trimmedOrNull(body.contactEmail);
  if (body.contactPhone !== undefined) input.contactPhone = trimmedOrNull(body.contactPhone);
  if (body.notes !== undefined) input.notes = trimmedOrNull(body.notes);
  if (body.dateOfBirth !== undefined) {
    const dob = trimmedOrNull(body.dateOfBirth);
    if (dob !== null && !isValidDateString(dob)) {
      return { input, error: 'Date of birth must be a valid date (YYYY-MM-DD).' };
    }
    input.dateOfBirth = dob;
  }

  for (const [key, { max, label }] of Object.entries(MAX_LENGTHS)) {
    const val = (input as Record<string, unknown>)[key];
    if (typeof val === 'string' && val.length > max) {
      return { input, error: `That ${label} is too long (max ${max} characters).` };
    }
  }

  return { input };
}

/** List a team's master roster, ordered by the coach's display order then creation. */
export async function getBasicCoachTeamPlayers(basicCoachTeamId: string): Promise<BasicCoachTeamPlayer[]> {
  const { data, error } = await supabaseAdmin
    .from('basic_coach_team_players')
    .select(PLAYER_COLUMNS)
    .eq('basic_coach_team_id', basicCoachTeamId)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []).map(row => mapPlayer(row as BasicCoachTeamPlayerRow));
}

/** Add a player to the end of a team's roster. `name` is required (trimmed by the route). */
export async function createBasicCoachTeamPlayer(params: {
  basicCoachTeamId: string;
  createdByUserId: string;
  input: BasicCoachTeamPlayerInput;
}): Promise<BasicCoachTeamPlayer> {
  const name = (params.input.name ?? '').trim();
  if (!name) throw new Error('A player name is required.');

  // Append: one past the current highest display_order (robust against gaps).
  const { data: top, error: topError } = await supabaseAdmin
    .from('basic_coach_team_players')
    .select('display_order')
    .eq('basic_coach_team_id', params.basicCoachTeamId)
    .order('display_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (topError) throw topError;
  const nextOrder = (top?.display_order ?? -1) + 1;

  const payload = toDbPayload({ ...params.input, name });
  const { data, error } = await supabaseAdmin
    .from('basic_coach_team_players')
    .insert({
      ...payload,
      basic_coach_team_id: params.basicCoachTeamId,
      created_by_user_id: params.createdByUserId,
      display_order: nextOrder,
    })
    .select(PLAYER_COLUMNS)
    .single<BasicCoachTeamPlayerRow>();

  if (error) throw error;
  return mapPlayer(data);
}

/** Update a player. Scoped by team id (defense-in-depth). Returns null if no such row in the team. */
export async function updateBasicCoachTeamPlayer(params: {
  playerId: string;
  basicCoachTeamId: string;
  input: BasicCoachTeamPlayerInput;
}): Promise<BasicCoachTeamPlayer | null> {
  const payload = toDbPayload(params.input);
  // Guard against an all-undefined patch nulling `name`: only write what was provided.
  if (Object.keys(payload).length === 0) {
    // Nothing to change — return the current row (still team-scoped).
    const { data, error } = await supabaseAdmin
      .from('basic_coach_team_players')
      .select(PLAYER_COLUMNS)
      .eq('id', params.playerId)
      .eq('basic_coach_team_id', params.basicCoachTeamId)
      .maybeSingle();
    if (error) throw error;
    return data ? mapPlayer(data as BasicCoachTeamPlayerRow) : null;
  }
  if ('name' in payload && !String(payload.name ?? '').trim()) {
    throw new Error('A player name is required.');
  }

  const { data, error } = await supabaseAdmin
    .from('basic_coach_team_players')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', params.playerId)
    .eq('basic_coach_team_id', params.basicCoachTeamId)
    .select(PLAYER_COLUMNS)
    .maybeSingle();

  if (error) throw error;
  return data ? mapPlayer(data as BasicCoachTeamPlayerRow) : null;
}

/** Remove a player. Scoped by team id. Returns true if a row was deleted. */
export async function deleteBasicCoachTeamPlayer(params: {
  playerId: string;
  basicCoachTeamId: string;
}): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('basic_coach_team_players')
    .delete()
    .eq('id', params.playerId)
    .eq('basic_coach_team_id', params.basicCoachTeamId)
    .select('id');

  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

/**
 * Persist a new display order. `orderedIds` is the full set of the team's player ids in their
 * new order; only ids that actually belong to the team are written (each update is team-scoped),
 * so a stray/foreign id is silently ignored rather than re-parenting a row.
 */
export async function reorderBasicCoachTeamPlayers(params: {
  basicCoachTeamId: string;
  orderedIds: string[];
}): Promise<void> {
  const now = new Date().toISOString();
  for (let i = 0; i < params.orderedIds.length; i++) {
    const { error } = await supabaseAdmin
      .from('basic_coach_team_players')
      .update({ display_order: i, updated_at: now })
      .eq('id', params.orderedIds[i])
      .eq('basic_coach_team_id', params.basicCoachTeamId);
    if (error) throw error;
  }
}

// ── Per-event roster SNAPSHOT (free-tier Phase 5j) ──────────────────────────────────────────────
//
// THE MASTER/SNAPSHOT SEAM. A tournament coach submits selected MASTER players into the per-event
// snapshot table `tournament_roster_players` (mig 110). This builder produces the snapshot rows
// ONLY — it is a PURE function with NO DB access, and it deliberately does NOT call
// `updateBasicCoachTeamPlayer` (or any master write). The free master roster
// (`basic_coach_team_players`) is IDENTITY-ONLY and is never mutated by a submission:
//   - `name` ALWAYS comes from the master (a coach cannot rename a player in the snapshot).
//   - organizer-required DOB / jersey overrides and the snapshot-only `position` live on the event
//     COPY alone. "Require DOB" prompts the coach to fill it for THIS snapshot — it never writes
//     back to the master (whose DOB stays optional + consent-gated; FT strategy §5/§14).
// The route writes the returned rows + the org/tournament/team/source/created_by columns.

/** A coach's per-player selection for an event-roster submission. Field overrides default to the
 *  master value when omitted (`undefined`); an explicit empty string clears the field for this
 *  snapshot only. `position` is snapshot-only (the master has no position column). */
export type SnapshotPlayerSelection = {
  sourcePlayerId: string;
  jerseyNumber?: string | null;
  dateOfBirth?: string | null;
  position?: string | null;
  notes?: string | null;
};

/** A normalized snapshot row (camelCase content only — the route adds the DB scope columns). */
export type SnapshotRosterRow = {
  name: string;
  jerseyNumber: string | null;
  dateOfBirth: string | null;
  position: string | null;
  notes: string | null;
  sourcePlayerId: string;
};

/** The subset of parsed organizer requirements this builder enforces (app-layer, server-side). */
export type SnapshotRosterRequirements = {
  requireDob: boolean;
  requireJersey: boolean;
  requireWaiver: boolean;
  effectiveMinPlayers: number;
  maxPlayers: number | null;
};

// Snapshot-side caps. `tournament_roster_players` has a `position` column the master lacks; the
// others mirror the master caps so a submitted override can never exceed what the master allows.
const SNAPSHOT_JERSEY_MAX = 16;
const SNAPSHOT_POSITION_MAX = 40;
const SNAPSHOT_NOTES_MAX = 600;

/**
 * Build the per-event roster snapshot rows from the coach's master roster + their selections,
 * enforcing the organizer's requirements (required DOB/jersey, min/max count, waiver). Returns
 * `{ rows }` on success or `{ rows: [], error }` with a coach-facing message on the first failure.
 *
 * IDOR/integrity: every selection must reference a player ON THIS TEAM's master roster
 * (`masterPlayers` is already team-scoped by the caller); a foreign or duplicate id is rejected.
 */
export function buildTournamentRosterSnapshot(params: {
  masterPlayers: BasicCoachTeamPlayer[];
  selections: SnapshotPlayerSelection[];
  requirements: SnapshotRosterRequirements;
  waiverAccepted: boolean;
}): { rows: SnapshotRosterRow[]; error?: string } {
  const { masterPlayers, selections, requirements, waiverAccepted } = params;

  if (!Array.isArray(selections) || selections.length === 0) {
    return { rows: [], error: 'Select at least one player to submit.' };
  }

  const byId = new Map(masterPlayers.map(p => [p.id, p]));
  const seen = new Set<string>();
  const rows: SnapshotRosterRow[] = [];

  // Override default-to-master: `undefined` keeps the master value; an explicit blank clears it.
  const overrideOrMaster = (value: unknown, master: string | null): string | null => {
    if (value === undefined) return master;
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  };

  for (const sel of selections) {
    const id = typeof sel?.sourcePlayerId === 'string' ? sel.sourcePlayerId : '';
    const master = byId.get(id);
    if (!master) return { rows: [], error: 'A selected player is not on your team roster.' };
    if (seen.has(id)) return { rows: [], error: 'A player was selected more than once.' };
    seen.add(id);

    const jersey = overrideOrMaster(sel.jerseyNumber, master.jerseyNumber);
    // position is snapshot-only — no master fallback.
    const position = typeof sel.position === 'string' && sel.position.trim() ? sel.position.trim() : null;
    const notes = overrideOrMaster(sel.notes, master.notes);

    let dob: string | null;
    if (sel.dateOfBirth === undefined) {
      dob = master.dateOfBirth;
    } else {
      dob = typeof sel.dateOfBirth === 'string' && sel.dateOfBirth.trim() ? sel.dateOfBirth.trim() : null;
      if (dob !== null && !isValidDateString(dob)) {
        return { rows: [], error: `Enter a valid date of birth for ${master.name} (YYYY-MM-DD).` };
      }
    }

    if (requirements.requireDob && !dob) {
      return { rows: [], error: `A date of birth is required for every player (missing for ${master.name}).` };
    }
    if (requirements.requireJersey && !jersey) {
      return { rows: [], error: `A jersey number is required for every player (missing for ${master.name}).` };
    }
    if (jersey && jersey.length > SNAPSHOT_JERSEY_MAX) {
      return { rows: [], error: `That jersey number is too long (max ${SNAPSHOT_JERSEY_MAX} characters).` };
    }
    if (position && position.length > SNAPSHOT_POSITION_MAX) {
      return { rows: [], error: `That position is too long (max ${SNAPSHOT_POSITION_MAX} characters).` };
    }
    if (notes && notes.length > SNAPSHOT_NOTES_MAX) {
      return { rows: [], error: `That note is too long (max ${SNAPSHOT_NOTES_MAX} characters).` };
    }

    rows.push({ name: master.name, jerseyNumber: jersey, dateOfBirth: dob, position, notes, sourcePlayerId: id });
  }

  if (rows.length < requirements.effectiveMinPlayers) {
    return { rows: [], error: `This tournament requires at least ${requirements.effectiveMinPlayers} players on the roster.` };
  }
  if (requirements.maxPlayers != null && rows.length > requirements.maxPlayers) {
    return { rows: [], error: `This tournament allows at most ${requirements.maxPlayers} players on the roster.` };
  }
  if (requirements.requireWaiver && waiverAccepted !== true) {
    return { rows: [], error: 'You must acknowledge the waiver before submitting your roster.' };
  }

  return { rows };
}
