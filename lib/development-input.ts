/**
 * What the development routes ACCEPT — in one place, pure, and tested (development lifecycle
 * Phase 0, F21).
 *
 * ⚠ Every route below validated its body inline, which is why nothing exercised them: the
 * 40-character name, the 20-character unit, the 0–99,999 value, the fat-fingered-year date, the
 * status vocabulary and the "nothing to update" refusal each lived in exactly one route's `try`
 * block, reachable only through a signed-in request. They are readers now — a route parses the
 * JSON, hands the object here, and wraps the answer. The error strings are the ones the screens
 * already show; they moved, they did not change.
 *
 * ⚠ Reads only what needs no database. A tag's ownership (`verifyFocusTag`), a type's existence
 * and a session's season stay in the route, where the query is.
 */
import type { RepDevelopmentGoalStatus } from './types';
import { isValidRecordDate } from './measurable-format';

export type InputResult<F> = { fields: F } | { error: string };

export const GOAL_STATUSES: ReadonlyArray<RepDevelopmentGoalStatus> = ['working', 'achieved', 'parked'];
export const MAX_TYPE_NAME_LEN = 40;
export const MAX_UNIT_LEN = 20;
export const MAX_GOAL_NOTE_LEN = 280;
export const MAX_READING_NOTE_LEN = 200;
export const MAX_SESSION_NOTE_LEN = 200;
export const MAX_READING_VALUE = 99999;

const obj = (raw: unknown): Record<string, unknown> =>
  (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;

// ── Measurable types ─────────────────────────────────────────────────────────────────────────────

export interface MeasurableTypeFields { name?: string; unit?: string; isActive?: boolean }

/**
 * `create` requires a name and a unit; `patch` takes any subset (but not none). A patch that names
 * a field still validates it — an empty unit cannot be patched in.
 */
export function readMeasurableTypeInput(raw: unknown, mode: 'create' | 'patch'): InputResult<MeasurableTypeFields> {
  const body = obj(raw);
  const fields: MeasurableTypeFields = {};
  if (mode === 'create' || body.name !== undefined) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name || name.length > MAX_TYPE_NAME_LEN) {
      return { error: `Name is required (max ${MAX_TYPE_NAME_LEN} characters).` };
    }
    fields.name = name;
  }
  if (mode === 'create' || body.unit !== undefined) {
    const unit = typeof body.unit === 'string' ? body.unit.trim() : '';
    if (!unit || unit.length > MAX_UNIT_LEN) {
      return { error: `Unit is required (max ${MAX_UNIT_LEN} characters) — e.g. "seconds" or "mph".` };
    }
    fields.unit = unit;
  }
  if (mode === 'patch' && body.isActive !== undefined) {
    if (typeof body.isActive !== 'boolean') return { error: 'isActive must be a boolean' };
    fields.isActive = body.isActive;
  }
  if (Object.keys(fields).length === 0) return { error: 'Nothing to update' };
  return { fields };
}

// ── Goals ────────────────────────────────────────────────────────────────────────────────────────

export interface GoalPatchFields {
  focusArea?: string;
  note?: string | null;
  status?: RepDevelopmentGoalStatus;
  /** Present = set it (null clears back to "the coach hasn't said"). Ownership is the route's check. */
  tagId?: string | null;
}

export function readGoalPatchInput(raw: unknown): InputResult<GoalPatchFields> {
  const body = obj(raw);
  const fields: GoalPatchFields = {};
  if (body.tagId !== undefined) {
    fields.tagId = typeof body.tagId === 'string' && body.tagId.trim() ? body.tagId.trim() : null;
  }
  if (body.focusArea !== undefined) {
    const focusArea = typeof body.focusArea === 'string' ? body.focusArea.trim() : '';
    if (!focusArea || focusArea.length > 80) return { error: 'Focus area is required (max 80 characters).' };
    fields.focusArea = focusArea;
  }
  if (body.note !== undefined) {
    const note = typeof body.note === 'string' ? body.note.trim() : '';
    if (note.length > MAX_GOAL_NOTE_LEN) return { error: `Note is too long (max ${MAX_GOAL_NOTE_LEN} characters).` };
    fields.note = note || null;
  }
  if (body.status !== undefined) {
    if (typeof body.status !== 'string' || !GOAL_STATUSES.includes(body.status as RepDevelopmentGoalStatus)) {
      return { error: 'Invalid status' };
    }
    fields.status = body.status as RepDevelopmentGoalStatus;
  }
  if (Object.keys(fields).length === 0) return { error: 'Nothing to update' };
  return { fields };
}

// ── Readings ─────────────────────────────────────────────────────────────────────────────────────

export interface MeasurableFields {
  measurableTypeId: string;
  value: number;
  recordedOn: string;
  note: string | null;
  /** Named, not verified — the route proves it is this team's session in this season. */
  sessionId: string | null;
}

export function readMeasurableInput(raw: unknown): InputResult<MeasurableFields> {
  const body = obj(raw);
  const measurableTypeId = typeof body.measurableTypeId === 'string' ? body.measurableTypeId : '';
  if (!measurableTypeId) return { error: 'measurableTypeId is required' };

  // A number, finite, in range. A string "8.4" is refused rather than coerced — the screens send
  // numbers, and coercion is how a blank becomes a fabricated zero.
  const value = typeof body.value === 'number' ? body.value : NaN;
  if (!Number.isFinite(value) || value < 0 || value > MAX_READING_VALUE) {
    return { error: 'Value must be a number between 0 and 99,999.' };
  }

  const recordedOn = typeof body.recordedOn === 'string' ? body.recordedOn : '';
  if (!isValidRecordDate(recordedOn)) {
    return { error: 'recordedOn must be a valid YYYY-MM-DD date — check the year.' };
  }

  const note = typeof body.note === 'string' ? body.note.trim() : '';
  if (note.length > MAX_READING_NOTE_LEN) return { error: `Note is too long (max ${MAX_READING_NOTE_LEN} characters).` };

  let sessionId: string | null = null;
  if (body.sessionId != null) {
    if (typeof body.sessionId !== 'string') return { error: 'Invalid sessionId' };
    sessionId = body.sessionId;
  }
  return { fields: { measurableTypeId, value, recordedOn, note: note || null, sessionId } };
}

// ── Sessions ─────────────────────────────────────────────────────────────────────────────────────

export interface SessionPatchFields { sessionDate?: string; note?: string | null; eventId?: string | null }

/** The event id is named, not verified — the route proves it sits on this team's season schedule. */
export function readSessionPatchInput(raw: unknown): InputResult<SessionPatchFields> {
  const body = obj(raw);
  const fields: SessionPatchFields = {};
  if (body.sessionDate !== undefined) {
    const date = typeof body.sessionDate === 'string' ? body.sessionDate : '';
    if (!isValidRecordDate(date)) return { error: 'sessionDate must be a valid YYYY-MM-DD date — check the year.' };
    fields.sessionDate = date;
  }
  if (body.note !== undefined) {
    const note = typeof body.note === 'string' ? body.note.trim() : '';
    if (note.length > MAX_SESSION_NOTE_LEN) return { error: `Note is too long (max ${MAX_SESSION_NOTE_LEN} characters).` };
    fields.note = note || null;
  }
  if (body.eventId !== undefined) {
    if (body.eventId === null) fields.eventId = null;
    else if (typeof body.eventId === 'string' && body.eventId) fields.eventId = body.eventId;
    else return { error: 'eventId must be an event id or null' };
  }
  if (Object.keys(fields).length === 0) return { error: 'Nothing to update' };
  return { fields };
}
