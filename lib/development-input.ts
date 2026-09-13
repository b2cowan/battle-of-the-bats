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
import type { MeasurableAim, MeasurableHeadline, MeasurableKind, RepDevelopmentGoalStatus, RepTeamMeasurableType } from './types';
import { isValidRecordDate } from './measurable-format';
import {
  MEASURABLE_AIMS, MEASURABLE_HEADLINES, MEASURABLE_KINDS, defaultHeadlineFor, definitionChange, headlineOptionsFor,
  type DefinitionChange,
} from './measurable-definition';

export type InputResult<F> = { fields: F } | { error: string };

export const GOAL_STATUSES: ReadonlyArray<RepDevelopmentGoalStatus> = ['working', 'achieved', 'parked'];
/** The coach's own words for the focus area. Long enough for a sentence, short enough to scan. */
export const MAX_FOCUS_AREA_LEN = 80;
export const FOCUS_AREA_ERROR = `Focus area is required (max ${MAX_FOCUS_AREA_LEN} characters).`;
export const MAX_TYPE_NAME_LEN = 40;
export const MAX_UNIT_LEN = 20;
export const MAX_METHOD_LEN = 600;
export const MAX_DESCRIPTORS = 10;
export const MAX_DESCRIPTOR_LEN = 60;
export const MAX_ATTEMPTS = 5;
export const MAX_GOAL_NOTE_LEN = 280;
export const MAX_READING_NOTE_LEN = 200;
export const MAX_SESSION_NOTE_LEN = 200;
export const MAX_READING_VALUE = 99999;

const obj = (raw: unknown): Record<string, unknown> =>
  (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;

// ── Metric definitions (rep_team_measurable_types) ───────────────────────────────────────────────

/** A whole definition, as a create sends it — every field present, defaults already applied. */
export interface MeasurableTypeCreateFields {
  kind: MeasurableKind;
  name: string;
  /** Required on a test; null on a skill. */
  unit: string | null;
  aim: MeasurableAim;
  rangeFrom: number | null;
  rangeTo: number | null;
  method: string | null;
  attemptsPerSession: number;
  headline: MeasurableHeadline;
  descriptors: string[];
}
/** A patch: any subset of the definition — never the kind — plus retire/restore. */
export type MeasurableTypeFields = Partial<Omit<MeasurableTypeCreateFields, 'kind'>> & { isActive?: boolean };

const UNIT_ERROR = `Unit is required (max ${MAX_UNIT_LEN} characters) — e.g. "seconds" or "mph".`;

/**
 * The per-field rules, ONE place. `create` takes a whole definition with defaults for what a bare
 * "name + unit" quick-add omits (the session chip and the profile still create a test that way):
 * kind test · aim record only · one attempt · headline last · no method. `patch` takes any subset
 * but never nothing, never the kind (a skill cannot become a test — define a new metric), and a
 * field it names is validated as if new — an empty unit cannot be patched in. The CROSS-field rules
 * (a range needs edges, a skill has no unit …) live in `validateDefinitionShape`, which `create`
 * runs on the whole and a patch runs on the MERGED definition (`applyDefinitionPatch`), so a patch
 * that turns a test into a range aim without edges is refused on the shape it would leave behind.
 */
export function readMeasurableTypeInput(raw: unknown, mode: 'create'): InputResult<MeasurableTypeCreateFields>;
export function readMeasurableTypeInput(raw: unknown, mode: 'patch'): InputResult<MeasurableTypeFields>;
export function readMeasurableTypeInput(raw: unknown, mode: 'create' | 'patch'): InputResult<MeasurableTypeFields> {
  const body = obj(raw);
  const fields: MeasurableTypeFields = {};

  let kind: MeasurableKind = 'test';
  if (body.kind !== undefined) {
    if (mode === 'patch') return { error: 'The kind of a metric cannot be changed — define a new one.' };
    if (typeof body.kind !== 'string' || !MEASURABLE_KINDS.includes(body.kind as MeasurableKind)) {
      return { error: 'Kind must be a measured test or an observed skill.' };
    }
    kind = body.kind as MeasurableKind;
  }

  if (mode === 'create' || body.name !== undefined) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name || name.length > MAX_TYPE_NAME_LEN) {
      return { error: `Name is required (max ${MAX_TYPE_NAME_LEN} characters).` };
    }
    fields.name = name;
  }
  if (body.unit !== undefined) {
    if (body.unit === null) fields.unit = null;
    else {
      const unit = typeof body.unit === 'string' ? body.unit.trim() : '';
      if (!unit || unit.length > MAX_UNIT_LEN) return { error: UNIT_ERROR };
      fields.unit = unit;
    }
  } else if (mode === 'create') {
    // A test needs a unit; a skill has none. Absent on a create means "none", which the shape check
    // below refuses for a test with the same sentence the old reader used.
    fields.unit = null;
  }
  if (body.aim !== undefined) {
    if (typeof body.aim !== 'string' || !MEASURABLE_AIMS.includes(body.aim as MeasurableAim)) {
      return { error: 'Aim must be lower, higher, within a range, or record only.' };
    }
    fields.aim = body.aim as MeasurableAim;
  }
  for (const key of ['rangeFrom', 'rangeTo'] as const) {
    if (body[key] === undefined) continue;
    if (body[key] === null) { fields[key] = null; continue; }
    const v = typeof body[key] === 'number' ? body[key] : NaN;
    if (!Number.isFinite(v) || v < 0 || v > MAX_READING_VALUE) return { error: 'A range edge must be a number between 0 and 99,999.' };
    fields[key] = v;
  }
  if (body.method !== undefined) {
    const method = typeof body.method === 'string' ? body.method.trim() : '';
    if (method.length > MAX_METHOD_LEN) return { error: `The method is too long (max ${MAX_METHOD_LEN} characters).` };
    fields.method = method || null;
  }
  if (body.attemptsPerSession !== undefined) {
    const n = body.attemptsPerSession;
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > MAX_ATTEMPTS) {
      return { error: `Attempts per session must be a whole number from 1 to ${MAX_ATTEMPTS}.` };
    }
    fields.attemptsPerSession = n;
  }
  if (body.headline !== undefined) {
    if (typeof body.headline !== 'string' || !MEASURABLE_HEADLINES.includes(body.headline as MeasurableHeadline)) {
      return { error: 'Headline must be best, average, last, or attempts in range.' };
    }
    fields.headline = body.headline as MeasurableHeadline;
  }
  if (body.descriptors !== undefined) {
    if (!Array.isArray(body.descriptors) || body.descriptors.some(d => typeof d !== 'string')) {
      return { error: 'Descriptors must be a list of words.' };
    }
    const list = (body.descriptors as string[]).map(d => d.trim()).filter(Boolean);
    if (list.length > MAX_DESCRIPTORS) return { error: `At most ${MAX_DESCRIPTORS} descriptors.` };
    if (list.some(d => d.length > MAX_DESCRIPTOR_LEN)) return { error: `A descriptor is at most ${MAX_DESCRIPTOR_LEN} characters.` };
    fields.descriptors = list;
  }
  if (mode === 'patch' && body.isActive !== undefined) {
    if (typeof body.isActive !== 'boolean') return { error: 'isActive must be a boolean' };
    fields.isActive = body.isActive;
  }

  if (mode === 'patch') {
    if (Object.keys(fields).length === 0) return { error: 'Nothing to update' };
    return { fields };
  }

  const aim = fields.aim ?? 'record';
  const whole: MeasurableTypeCreateFields = {
    kind,
    name: fields.name!,
    unit: fields.unit ?? null,
    aim,
    rangeFrom: fields.rangeFrom ?? null,
    rangeTo: fields.rangeTo ?? null,
    method: fields.method ?? null,
    attemptsPerSession: fields.attemptsPerSession ?? 1,
    headline: fields.headline ?? defaultHeadlineFor(aim),
    descriptors: fields.descriptors ?? [],
  };
  const shape = validateDefinitionShape(whole);
  if (shape) return { error: shape };
  return { fields: whole };
}

/**
 * The cross-field rules a whole definition must satisfy — the same ones the table's CHECKs hold
 * (mig 293), said in the coach's words so the refusal reads on screen. Null = valid.
 */
export function validateDefinitionShape(d: MeasurableTypeCreateFields): string | null {
  if (d.kind === 'test' && !d.unit) return UNIT_ERROR;
  if (d.kind === 'skill' && d.unit) return 'An observed skill has no unit — it records what you saw, not a number.';
  if (d.kind === 'skill' && (d.aim !== 'record' || d.rangeFrom != null || d.rangeTo != null || d.attemptsPerSession !== 1 || d.headline !== 'last')) {
    return 'An observed skill has no aim, range, attempts or headline — those belong to a measured test.';
  }
  if (d.kind === 'test' && d.descriptors.length > 0) return 'Descriptors belong to an observed skill; a measured test records a number.';
  if (d.aim === 'range') {
    if (d.rangeFrom == null || d.rangeTo == null) return 'A range needs both edges — From and To, in the unit.';
    if (!(d.rangeFrom < d.rangeTo)) return 'From must be lower than To.';
  } else if (d.rangeFrom != null || d.rangeTo != null) {
    return 'From and To only apply when the aim is a range.';
  }
  if (!headlineOptionsFor(d.aim).includes(d.headline)) {
    if (d.aim === 'range') return 'A range test has no best attempt — its headline is attempts in range, the average, or the last.';
    if (d.aim === 'record') return 'A record-only test has no best attempt — choose the average or the last.';
    return 'Attempts in range is a headline for a range test only.';
  }
  return null;
}

/**
 * A patch applied to the definition it names: merge, re-validate the whole, and answer the
 * "changing a definition later" rule (owner ruling 3) for the route to enforce — a unit or method
 * change on a test with readings is a SUCCESSOR, never an in-place edit.
 *
 * Two conveniences, both so the editor does not have to send three fields to change one:
 *   · moving to or from a range aim re-points a headline the new aim does not admit onto the
 *     ruled default, and clears the edges when the aim stops being a range;
 *   · restore is refused on a definition that was REPLACED — the successor carries its name.
 */
export function applyDefinitionPatch(
  current: RepTeamMeasurableType,
  fields: MeasurableTypeFields,
  hasReadings: boolean,
): { next: MeasurableTypeCreateFields & { isActive: boolean }; change: DefinitionChange } | { error: string } {
  if (fields.isActive === true && current.replacedById) {
    return { error: 'This definition was replaced by a newer one, which carries its name. Edit that one instead.' };
  }
  const aim = fields.aim ?? current.aim;
  const aimChanged = aim !== current.aim;
  let headline = fields.headline ?? current.headline;
  if (aimChanged && fields.headline === undefined && !headlineOptionsFor(aim).includes(headline)) headline = defaultHeadlineFor(aim);
  const clearEdges = aimChanged && aim !== 'range' && fields.rangeFrom === undefined && fields.rangeTo === undefined;
  const next: MeasurableTypeCreateFields & { isActive: boolean } = {
    kind: current.kind,
    name: fields.name ?? current.name,
    unit: fields.unit !== undefined ? fields.unit : current.unit,
    aim,
    rangeFrom: clearEdges ? null : fields.rangeFrom !== undefined ? fields.rangeFrom : current.rangeFrom,
    rangeTo: clearEdges ? null : fields.rangeTo !== undefined ? fields.rangeTo : current.rangeTo,
    method: fields.method !== undefined ? fields.method : current.method,
    attemptsPerSession: fields.attemptsPerSession ?? current.attemptsPerSession,
    headline,
    descriptors: fields.descriptors ?? current.descriptors,
    isActive: fields.isActive ?? current.isActive,
  };
  const shape = validateDefinitionShape(next);
  if (shape) return { error: shape };
  return { next, change: definitionChange(current, { unit: fields.unit, method: fields.method }, hasReadings) };
}

// ── Goals ────────────────────────────────────────────────────────────────────────────────────────

/**
 * The focus text rule, ONE home. `readFocusArea` in `development-goal-input.ts` (the create
 * route's server-only helper) wraps this in a response; the patch reader below calls it directly.
 */
export function readFocusAreaText(raw: unknown): InputResult<string> {
  const body = obj(raw);
  const focusArea = typeof body.focusArea === 'string' ? body.focusArea.trim() : '';
  if (!focusArea || focusArea.length > MAX_FOCUS_AREA_LEN) return { error: FOCUS_AREA_ERROR };
  return { fields: focusArea };
}

export interface GoalPatchFields {
  focusArea?: string;
  note?: string | null;
  status?: RepDevelopmentGoalStatus;
  /** Present = set it (null clears back to "the coach hasn't said"). Ownership and the error message are
   *  `verifyFocusTag`'s (development-goal-input.ts) — the route calls it whenever this is present. */
  tagId?: string | null;
}

export function readGoalPatchInput(raw: unknown): InputResult<GoalPatchFields> {
  const body = obj(raw);
  const fields: GoalPatchFields = {};
  if (body.tagId !== undefined) {
    fields.tagId = typeof body.tagId === 'string' && body.tagId.trim() ? body.tagId.trim() : null;
  }
  if (body.focusArea !== undefined) {
    const area = readFocusAreaText(body);
    if ('error' in area) return area;
    fields.focusArea = area.fields;
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

  // Absent or null = a single reading. Present = a real id — an empty string is refused rather than
  // quietly filed as "no session" (/review 2026-09-12; the inline code it replaced looked it up
  // and answered 400).
  let sessionId: string | null = null;
  if (body.sessionId != null) {
    if (typeof body.sessionId !== 'string' || !body.sessionId) return { error: 'Invalid sessionId' };
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
