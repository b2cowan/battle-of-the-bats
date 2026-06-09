import 'server-only';
import { supabaseAdmin } from './supabase-admin';

/**
 * Lightweight schedule for org-less Basic coach teams (free-tier Phase 4a, table mig 115).
 *
 * The org-less calendar a coach builds on their team home: practices + games, reused as the team's
 * schedule. Lives on `basic_coach_team_events` keyed on `basic_coach_team_id`.
 *
 * Scope rules (do not widen):
 * - Scheduling/identity only: type / title / opponent / location / start+end / note.
 *   NO scores, attendance, lineups, recurrence, or tournament-game nesting — those are Premium
 *   (the rep_team_events power-calendar).
 * - Ownership is enforced by the CALLER (route) via `userOwnsBasicCoachTeam` before any function
 *   here runs; every mutation here ALSO scopes by `basic_coach_team_id` (defense-in-depth IDOR
 *   guard), mirroring lib/basic-coach-roster.ts.
 *
 * All queries use the service-role client (the table is RLS-enabled with no policies).
 */

export type BasicCoachTeamEvent = {
  id: string;
  basicCoachTeamId: string;
  eventType: 'practice' | 'game' | 'event';
  title: string;
  opponent: string | null;
  location: string | null;
  startsAt: string; // ISO
  endsAt: string | null; // ISO or null
  notes: string | null;
  status: 'scheduled' | 'cancelled';
  createdAt: string;
  updatedAt: string;
};

export type BasicCoachTeamEventInput = {
  eventType?: 'practice' | 'game' | 'event';
  title?: string;
  opponent?: string | null;
  location?: string | null;
  startsAt?: string;
  endsAt?: string | null;
  notes?: string | null;
};

type BasicCoachTeamEventRow = {
  id: string;
  basic_coach_team_id: string;
  event_type: 'practice' | 'game' | 'event';
  title: string;
  opponent: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string | null;
  notes: string | null;
  status: 'scheduled' | 'cancelled';
  created_at: string;
  updated_at: string;
};

const EVENT_COLUMNS =
  'id, basic_coach_team_id, event_type, title, opponent, location, starts_at, ends_at, notes, status, created_at, updated_at';

const EVENT_TYPES = ['practice', 'game', 'event'] as const;

const MAX_LENGTHS: Record<string, { max: number; label: string }> = {
  title: { max: 160, label: 'title' },
  opponent: { max: 160, label: 'opponent' },
  location: { max: 200, label: 'location' },
  notes: { max: 600, label: 'note' },
};

function mapEvent(row: BasicCoachTeamEventRow): BasicCoachTeamEvent {
  return {
    id: row.id,
    basicCoachTeamId: row.basic_coach_team_id,
    eventType: row.event_type,
    title: row.title,
    opponent: row.opponent,
    location: row.location,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    notes: row.notes,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toDbPayload(input: BasicCoachTeamEventInput): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (input.eventType !== undefined) out.event_type = input.eventType;
  if (input.title !== undefined) out.title = input.title;
  if (input.opponent !== undefined) out.opponent = input.opponent;
  if (input.location !== undefined) out.location = input.location;
  if (input.startsAt !== undefined) out.starts_at = input.startsAt;
  if (input.endsAt !== undefined) out.ends_at = input.endsAt;
  if (input.notes !== undefined) out.notes = input.notes;
  return out;
}

/** Parseable timestamp? Accepts any value `new Date()` can read (ISO from the client). */
function isValidTimestamp(value: string): boolean {
  return !Number.isNaN(new Date(value).getTime());
}

/**
 * Normalize a raw request body into an event input. Only keys PRESENT in the body are included
 * (PATCH leaves omitted fields untouched); strings are trimmed and empties become null. Scheduling
 * fields only — any other key is ignored. Returns an `error` on a bad type / unparseable date /
 * end-before-start / over-length field.
 */
export function normalizeBasicCoachTeamEventBody(
  body: Record<string, unknown>,
): { input: BasicCoachTeamEventInput; error?: string } {
  const input: BasicCoachTeamEventInput = {};
  const trimmed = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const trimmedOrNull = (v: unknown) => {
    const s = trimmed(v);
    return s ? s : null;
  };

  if (body.eventType !== undefined) {
    const t = trimmed(body.eventType);
    if (!(EVENT_TYPES as readonly string[]).includes(t)) {
      return { input, error: 'Event type must be practice, game, or event.' };
    }
    input.eventType = t as BasicCoachTeamEventInput['eventType'];
  }
  if (body.title !== undefined) input.title = trimmed(body.title);
  if (body.opponent !== undefined) input.opponent = trimmedOrNull(body.opponent);
  if (body.location !== undefined) input.location = trimmedOrNull(body.location);
  if (body.notes !== undefined) input.notes = trimmedOrNull(body.notes);

  if (body.startsAt !== undefined) {
    const s = trimmed(body.startsAt);
    if (!s || !isValidTimestamp(s)) return { input, error: 'A valid start date/time is required.' };
    input.startsAt = new Date(s).toISOString();
  }
  if (body.endsAt !== undefined) {
    const e = trimmedOrNull(body.endsAt);
    if (e !== null && !isValidTimestamp(e)) return { input, error: 'The end date/time is not valid.' };
    input.endsAt = e ? new Date(e).toISOString() : null;
  }
  // If both present, the end can't precede the start.
  if (input.startsAt && input.endsAt && new Date(input.endsAt) < new Date(input.startsAt)) {
    return { input, error: 'The end time can’t be before the start time.' };
  }

  for (const [key, { max, label }] of Object.entries(MAX_LENGTHS)) {
    const val = (input as Record<string, unknown>)[key];
    if (typeof val === 'string' && val.length > max) {
      return { input, error: `That ${label} is too long (max ${max} characters).` };
    }
  }

  return { input };
}

/** List a team's events, soonest first. */
export async function getBasicCoachTeamEvents(basicCoachTeamId: string): Promise<BasicCoachTeamEvent[]> {
  const { data, error } = await supabaseAdmin
    .from('basic_coach_team_events')
    .select(EVENT_COLUMNS)
    .eq('basic_coach_team_id', basicCoachTeamId)
    .order('starts_at', { ascending: true });

  if (error) throw error;
  return (data ?? []).map(row => mapEvent(row as BasicCoachTeamEventRow));
}

/** Add an event. `title` + `startsAt` are required (validated by the route normalizer). */
export async function createBasicCoachTeamEvent(params: {
  basicCoachTeamId: string;
  createdByUserId: string;
  input: BasicCoachTeamEventInput;
}): Promise<BasicCoachTeamEvent> {
  const title = (params.input.title ?? '').trim();
  if (!title) throw new Error('An event title is required.');
  if (!params.input.startsAt) throw new Error('A valid start date/time is required.');

  const eventType = params.input.eventType ?? 'practice';
  const payload = toDbPayload({ ...params.input, title });
  // Only games carry an opponent — clear it for practice/event (defense-in-depth; UI already nulls it).
  if (eventType !== 'game') payload.opponent = null;
  const { data, error } = await supabaseAdmin
    .from('basic_coach_team_events')
    .insert({
      ...payload,
      event_type: eventType,
      basic_coach_team_id: params.basicCoachTeamId,
      created_by_user_id: params.createdByUserId,
    })
    .select(EVENT_COLUMNS)
    .single<BasicCoachTeamEventRow>();

  if (error) throw error;
  return mapEvent(data);
}

/** Edit an event. Scoped by team id. Returns null if no such row in the team. */
export async function updateBasicCoachTeamEvent(params: {
  eventId: string;
  basicCoachTeamId: string;
  input: BasicCoachTeamEventInput;
}): Promise<BasicCoachTeamEvent | null> {
  const payload = toDbPayload(params.input);
  if (Object.keys(payload).length === 0) {
    const { data, error } = await supabaseAdmin
      .from('basic_coach_team_events')
      .select(EVENT_COLUMNS)
      .eq('id', params.eventId)
      .eq('basic_coach_team_id', params.basicCoachTeamId)
      .maybeSingle();
    if (error) throw error;
    return data ? mapEvent(data as BasicCoachTeamEventRow) : null;
  }
  if ('title' in payload && !String(payload.title ?? '').trim()) {
    throw new Error('An event title is required.');
  }
  // If this PATCH switches the type to non-game, clear any opponent so a stale matchup can't linger.
  if (payload.event_type !== undefined && payload.event_type !== 'game') payload.opponent = null;

  const { data, error } = await supabaseAdmin
    .from('basic_coach_team_events')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', params.eventId)
    .eq('basic_coach_team_id', params.basicCoachTeamId)
    .select(EVENT_COLUMNS)
    .maybeSingle();

  if (error) throw error;
  return data ? mapEvent(data as BasicCoachTeamEventRow) : null;
}

/** Remove an event. Scoped by team id. Returns true if a row was deleted. */
export async function deleteBasicCoachTeamEvent(params: {
  eventId: string;
  basicCoachTeamId: string;
}): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('basic_coach_team_events')
    .delete()
    .eq('id', params.eventId)
    .eq('basic_coach_team_id', params.basicCoachTeamId)
    .select('id');

  if (error) throw error;
  return (data?.length ?? 0) > 0;
}
