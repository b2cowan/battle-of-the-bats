import 'server-only';
import { supabaseAdmin } from './supabase-admin';

/**
 * Manual fee ledger for org-less Basic coach teams (free-tier Phase 4b, table mig 116).
 *
 * Scope rules (do not widen):
 * - Coach-self-recorded tracking only: label / amount / paid-unpaid / optional player link / note.
 *   NO Stripe, online collection, partial payments, installments, reminders, dues automation, budget,
 *   or accounting entries. Those stay Premium / future payment-processing work.
 * - A fee may link to one `basic_coach_team_players` row, or have `playerId=null` for a team-wide
 *   / unassigned charge. Player deletes retain the fee and null the link.
 * - Ownership is enforced by the CALLER (route) via `userOwnsBasicCoachTeam`; every mutation here
 *   ALSO scopes by `basic_coach_team_id`, and any supplied `playerId` must belong to the same team.
 *
 * All queries use the service-role client (the table is RLS-enabled with no policies).
 */

export type BasicCoachTeamFee = {
  id: string;
  basicCoachTeamId: string;
  playerId: string | null;
  label: string;
  amount: number;
  status: 'unpaid' | 'paid';
  markedPaidAt: string | null;
  notes: string | null;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type BasicCoachTeamFeeInput = {
  playerId?: string | null;
  label?: string;
  amount?: string;
  status?: 'unpaid' | 'paid';
  notes?: string | null;
};

type BasicCoachTeamFeeRow = {
  id: string;
  basic_coach_team_id: string;
  player_id: string | null;
  label: string;
  amount: number | string;
  status: 'unpaid' | 'paid';
  marked_paid_at: string | null;
  notes: string | null;
  display_order: number;
  created_at: string;
  updated_at: string;
};

type BasicCoachTeamFeeStatusRow = Pick<BasicCoachTeamFeeRow, 'status' | 'marked_paid_at'>;

const FEE_COLUMNS =
  'id, basic_coach_team_id, player_id, label, amount, status, marked_paid_at, notes, display_order, created_at, updated_at';

const STATUSES = ['unpaid', 'paid'] as const;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_AMOUNT = 99999999.99;

const MAX_LENGTHS: Record<string, { max: number; label: string }> = {
  label: { max: 160, label: 'label' },
  notes: { max: 600, label: 'note' },
};

export const BASIC_COACH_FEE_PLAYER_SCOPE_ERROR = 'That player does not belong to this team.';

function mapFee(row: BasicCoachTeamFeeRow): BasicCoachTeamFee {
  return {
    id: row.id,
    basicCoachTeamId: row.basic_coach_team_id,
    playerId: row.player_id,
    label: row.label,
    amount: Number(row.amount),
    status: row.status,
    markedPaidAt: row.marked_paid_at,
    notes: row.notes,
    displayOrder: row.display_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toDbPayload(input: BasicCoachTeamFeeInput): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (input.playerId !== undefined) out.player_id = input.playerId;
  if (input.label !== undefined) out.label = input.label;
  if (input.amount !== undefined) out.amount = input.amount;
  if (input.status !== undefined) out.status = input.status;
  if (input.notes !== undefined) out.notes = input.notes;
  return out;
}

function normalizeMoney(value: unknown): { amount?: string; error?: string } {
  const raw = typeof value === 'number'
    ? String(value)
    : typeof value === 'string'
      ? value.trim()
      : '';

  if (!raw) return { error: 'A fee amount is required.' };
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) {
    return { error: 'Amount must be a dollar value with up to two decimals.' };
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > MAX_AMOUNT) {
    return { error: 'Amount must be between $0.00 and $99,999,999.99.' };
  }
  return { amount: n.toFixed(2) };
}

/**
 * Normalize a raw request body into a fee input. Only keys PRESENT in the body are included
 * (PATCH leaves omitted fields untouched); strings are trimmed and empties become null. Manual
 * ledger fields only; any other key is ignored. Returns an `error` on bad status, player id,
 * amount format, or over-length field.
 */
export function normalizeBasicCoachTeamFeeBody(
  body: Record<string, unknown>,
): { input: BasicCoachTeamFeeInput; error?: string } {
  const input: BasicCoachTeamFeeInput = {};
  const trimmed = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const trimmedOrNull = (v: unknown) => {
    const s = trimmed(v);
    return s ? s : null;
  };

  if (body.playerId !== undefined) {
    const playerId = trimmedOrNull(body.playerId);
    if (playerId !== null && !UUID_RE.test(playerId)) {
      return { input, error: 'Player selection is not valid.' };
    }
    input.playerId = playerId;
  }
  if (body.label !== undefined) input.label = trimmed(body.label);
  if (body.amount !== undefined) {
    const { amount, error } = normalizeMoney(body.amount);
    if (error) return { input, error };
    input.amount = amount;
  }
  if (body.status !== undefined) {
    const status = trimmed(body.status);
    if (!(STATUSES as readonly string[]).includes(status)) {
      return { input, error: 'Status must be unpaid or paid.' };
    }
    input.status = status as BasicCoachTeamFeeInput['status'];
  }
  if (body.notes !== undefined) input.notes = trimmedOrNull(body.notes);

  for (const [key, { max, label }] of Object.entries(MAX_LENGTHS)) {
    const val = (input as Record<string, unknown>)[key];
    if (typeof val === 'string' && val.length > max) {
      return { input, error: `That ${label} is too long (max ${max} characters).` };
    }
  }

  return { input };
}

async function assertPlayerBelongsToTeam(basicCoachTeamId: string, playerId: string | null | undefined) {
  if (!playerId) return;
  const { data, error } = await supabaseAdmin
    .from('basic_coach_team_players')
    .select('id')
    .eq('id', playerId)
    .eq('basic_coach_team_id', basicCoachTeamId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(BASIC_COACH_FEE_PLAYER_SCOPE_ERROR);
}

/** List a team's manual fees, grouped in app code by player/team-wide. */
export async function getBasicCoachTeamFees(basicCoachTeamId: string): Promise<BasicCoachTeamFee[]> {
  const { data, error } = await supabaseAdmin
    .from('basic_coach_team_fees')
    .select(FEE_COLUMNS)
    .eq('basic_coach_team_id', basicCoachTeamId)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []).map(row => mapFee(row as BasicCoachTeamFeeRow));
}

/** Add a manual fee to the end of the team's ledger. `label` + `amount` are required. */
export async function createBasicCoachTeamFee(params: {
  basicCoachTeamId: string;
  createdByUserId: string;
  input: BasicCoachTeamFeeInput;
}): Promise<BasicCoachTeamFee> {
  const label = (params.input.label ?? '').trim();
  if (!label) throw new Error('A fee label is required.');
  if (params.input.amount === undefined) throw new Error('A fee amount is required.');
  await assertPlayerBelongsToTeam(params.basicCoachTeamId, params.input.playerId);

  const { data: top, error: topError } = await supabaseAdmin
    .from('basic_coach_team_fees')
    .select('display_order')
    .eq('basic_coach_team_id', params.basicCoachTeamId)
    .order('display_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (topError) throw topError;
  const nextOrder = (top?.display_order ?? -1) + 1;

  const status = params.input.status ?? 'unpaid';
  const payload = toDbPayload({ ...params.input, label, status });
  const { data, error } = await supabaseAdmin
    .from('basic_coach_team_fees')
    .insert({
      ...payload,
      basic_coach_team_id: params.basicCoachTeamId,
      marked_paid_at: status === 'paid' ? new Date().toISOString() : null,
      created_by_user_id: params.createdByUserId,
      display_order: nextOrder,
    })
    .select(FEE_COLUMNS)
    .single<BasicCoachTeamFeeRow>();

  if (error) throw error;
  return mapFee(data);
}

export const BASIC_COACH_FEE_NO_PLAYERS_ERROR = 'Add players to your roster before charging everyone.';
export const BASIC_COACH_FEE_TOO_MANY_PLAYERS_ERROR = 'That roster is too large for a single bulk fee.';
const MAX_BULK_PLAYERS = 200;

/**
 * Convenience bulk-create: add the SAME fee to EVERY player on the roster as
 * independent per-player rows (one fee each, marked paid individually later).
 * The N-row insert is a single statement, so it's atomic — either every player
 * gets the fee or none do (no half-populated ledger on failure). Still scoped
 * to manual ledger fields only; no installment/automation semantics.
 */
export async function createBasicCoachTeamFeesForAllPlayers(params: {
  basicCoachTeamId: string;
  createdByUserId: string;
  input: BasicCoachTeamFeeInput;
}): Promise<BasicCoachTeamFee[]> {
  const label = (params.input.label ?? '').trim();
  if (!label) throw new Error('A fee label is required.');
  if (params.input.amount === undefined) throw new Error('A fee amount is required.');

  const { data: players, error: playersError } = await supabaseAdmin
    .from('basic_coach_team_players')
    .select('id')
    .eq('basic_coach_team_id', params.basicCoachTeamId);
  if (playersError) throw playersError;
  const playerIds = (players ?? []).map(row => (row as { id: string }).id);
  if (playerIds.length === 0) throw new Error(BASIC_COACH_FEE_NO_PLAYERS_ERROR);
  if (playerIds.length > MAX_BULK_PLAYERS) throw new Error(BASIC_COACH_FEE_TOO_MANY_PLAYERS_ERROR);

  const { data: top, error: topError } = await supabaseAdmin
    .from('basic_coach_team_fees')
    .select('display_order')
    .eq('basic_coach_team_id', params.basicCoachTeamId)
    .order('display_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (topError) throw topError;
  let nextOrder = (top?.display_order ?? -1) + 1;

  const status = params.input.status ?? 'unpaid';
  const markedPaidAt = status === 'paid' ? new Date().toISOString() : null;
  const notes = params.input.notes ?? null;
  const rows = playerIds.map(playerId => ({
    basic_coach_team_id: params.basicCoachTeamId,
    player_id: playerId,
    label,
    amount: params.input.amount,
    status,
    marked_paid_at: markedPaidAt,
    notes,
    created_by_user_id: params.createdByUserId,
    display_order: nextOrder++,
  }));

  const { data, error } = await supabaseAdmin
    .from('basic_coach_team_fees')
    .insert(rows)
    .select(FEE_COLUMNS);
  if (error) throw error;
  return (data ?? [])
    .map(row => mapFee(row as BasicCoachTeamFeeRow))
    .sort((a, b) => a.displayOrder - b.displayOrder);
}

/** Edit a fee. Scoped by team id. Returns null if no such row in the team. */
export async function updateBasicCoachTeamFee(params: {
  feeId: string;
  basicCoachTeamId: string;
  input: BasicCoachTeamFeeInput;
}): Promise<BasicCoachTeamFee | null> {
  await assertPlayerBelongsToTeam(params.basicCoachTeamId, params.input.playerId);
  const payload = toDbPayload(params.input);

  if (Object.keys(payload).length === 0) {
    const { data, error } = await supabaseAdmin
      .from('basic_coach_team_fees')
      .select(FEE_COLUMNS)
      .eq('id', params.feeId)
      .eq('basic_coach_team_id', params.basicCoachTeamId)
      .maybeSingle();
    if (error) throw error;
    return data ? mapFee(data as BasicCoachTeamFeeRow) : null;
  }
  if ('label' in payload && !String(payload.label ?? '').trim()) {
    throw new Error('A fee label is required.');
  }
  if (payload.status === 'paid') {
    const { data: current, error: currentError } = await supabaseAdmin
      .from('basic_coach_team_fees')
      .select('status, marked_paid_at')
      .eq('id', params.feeId)
      .eq('basic_coach_team_id', params.basicCoachTeamId)
      .maybeSingle<BasicCoachTeamFeeStatusRow>();
    if (currentError) throw currentError;
    if (!current) return null;
    payload.marked_paid_at = current.status === 'paid' && current.marked_paid_at
      ? current.marked_paid_at
      : new Date().toISOString();
  }
  if (payload.status === 'unpaid') payload.marked_paid_at = null;

  const { data, error } = await supabaseAdmin
    .from('basic_coach_team_fees')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', params.feeId)
    .eq('basic_coach_team_id', params.basicCoachTeamId)
    .select(FEE_COLUMNS)
    .maybeSingle();

  if (error) throw error;
  return data ? mapFee(data as BasicCoachTeamFeeRow) : null;
}

/** Remove a fee. Scoped by team id. Returns true if a row was deleted. */
export async function deleteBasicCoachTeamFee(params: {
  feeId: string;
  basicCoachTeamId: string;
}): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('basic_coach_team_fees')
    .delete()
    .eq('id', params.feeId)
    .eq('basic_coach_team_id', params.basicCoachTeamId)
    .select('id');

  if (error) throw error;
  return (data?.length ?? 0) > 0;
}
