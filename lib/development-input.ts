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
import { isRecordId as isId } from './development-address';
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
export const MAX_GOAL_SUCCESS_LEN = 280;
export const MAX_READING_NOTE_LEN = 200;
export const MAX_SESSION_NOTE_LEN = 200;
export const MAX_READING_VALUE = 99999;
export const MAX_NOT_ASSESSED_REASON_LEN = 120;
export const MAX_OBSERVATION_NOTE_LEN = 600;
export const MAX_REVIEW_NOTE_LEN = 600;

/** A list of ids, deduped in order; null when the value is not a list of ids. */
function readIdList(raw: unknown): string[] | null {
  if (!Array.isArray(raw) || raw.some(v => !isId(v))) return null;
  return [...new Set(raw as string[])];
}
/** A YYYY-MM-DD date or a refusal, with the field named. */
function readDate(raw: unknown, field: string): InputResult<string> {
  const v = typeof raw === 'string' ? raw : '';
  if (!isValidRecordDate(v)) return { error: `${field} must be a valid YYYY-MM-DD date — check the year.` };
  return { fields: v };
}
/** Trimmed text, null when blank, refused when too long. */
function readText(raw: unknown, max: number, what: string): InputResult<string | null> {
  const v = typeof raw === 'string' ? raw.trim() : '';
  if (v.length > max) return { error: `${what} is too long (max ${max} characters).` };
  return { fields: v || null };
}

const obj = (raw: unknown): Record<string, unknown> =>
  (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;

// ── A general player note (rep_player_notes, mig 296 — the Notes tab's one write) ────────────────
export const MAX_PLAYER_NOTE_LEN = 600;

export interface PlayerNoteFields {
  notedOn: string;
  body: string;
  goalId: string | null;
  eventId: string | null;
}
/**
 * The note's body is REQUIRED (a note with no words is not a note); the date defaults to today on
 * the form, so an absent one here is a client bug and refused. `goalId` / `eventId` are proved to
 * belong to the player / the season by the route, not here — this only reads the shape.
 */
export function readPlayerNoteInput(raw: unknown, mode: 'create'): InputResult<PlayerNoteFields>;
export function readPlayerNoteInput(raw: unknown, mode: 'patch'): InputResult<Partial<PlayerNoteFields>>;
export function readPlayerNoteInput(raw: unknown, mode: 'create' | 'patch'): InputResult<Partial<PlayerNoteFields>> {
  const o = obj(raw);
  const out: Partial<PlayerNoteFields> = {};
  if (mode === 'create' || 'notedOn' in o) {
    const d = readDate(o.notedOn, 'Date');
    if ('error' in d) return d;
    out.notedOn = d.fields;
  }
  if (mode === 'create' || 'body' in o) {
    const b = readText(o.body, MAX_PLAYER_NOTE_LEN, 'The note');
    if ('error' in b) return b;
    if (!b.fields) return { error: 'Write the note first.' };
    out.body = b.fields;
  }
  // On create the two links are always decided (absent = none); on patch an absent key means
  // "leave it", the same convention the goal and observation patches use.
  if (mode === 'create' || 'goalId' in o) {
    if (o.goalId != null && !isId(o.goalId)) return { error: 'Invalid goal.' };
    out.goalId = (o.goalId as string | null) ?? null;
  }
  if (mode === 'create' || 'eventId' in o) {
    if (o.eventId != null && !isId(o.eventId)) return { error: 'Invalid event.' };
    out.eventId = (o.eventId as string | null) ?? null;
  }
  return { fields: out };
}

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
      return { error: 'Kind must be a test or a skill.' };
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
  if (d.kind === 'skill' && d.unit) return 'A skill has no unit — it records what you saw, not a number.';
  if (d.kind === 'skill' && (d.aim !== 'record' || d.rangeFrom != null || d.rangeTo != null || d.attemptsPerSession !== 1 || d.headline !== 'last')) {
    return 'A skill has no aim, range, attempts or headline — those belong to a test.';
  }
  if (d.kind === 'test' && d.descriptors.length > 0) return 'Descriptors belong to a skill; a test records a number.';
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
 * "changing a definition later" rule (owner ruling 3, unit-only since 2026-09-14) for the route to
 * enforce — a unit change on a test with readings is a SUCCESSOR, never an in-place edit.
 *
 * ⚠ A RETIRED definition is a record (owner, 2026-09-14, B12): only its name and its retired flag
 * may change. The sheet shows every other field as a value, and this is where that is HELD — a
 * direct call that re-aims a retired test would silently reinterpret every result it holds.
 *
 * Two conveniences, both so the editor does not have to send three fields to change one:
 *   · moving to or from a range aim re-points a headline the new aim does not admit onto the
 *     ruled default, and clears the edges when the aim stops being a range;
 *   · restore is refused on a definition that was REPLACED — the successor carries its name.
 */
const RETIRED_EDITABLE: ReadonlySet<keyof MeasurableTypeFields> = new Set(['name', 'isActive']);
export const RETIRED_EDIT_MESSAGE = 'A retired metric is a record — restore it to change anything but its name.';

export function applyDefinitionPatch(
  current: RepTeamMeasurableType,
  fields: MeasurableTypeFields,
  hasReadings: boolean,
): { next: MeasurableTypeCreateFields & { isActive: boolean }; change: DefinitionChange } | { error: string } {
  if (fields.isActive === true && current.replacedById) {
    return { error: 'This definition was replaced by a newer one, which carries its name. Edit that one instead.' };
  }
  if (!current.isActive && (Object.keys(fields) as (keyof MeasurableTypeFields)[]).some(k => fields[k] !== undefined && !RETIRED_EDITABLE.has(k))) {
    return { error: RETIRED_EDIT_MESSAGE };
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
  return { next, change: definitionChange(current, { unit: fields.unit }, hasReadings) };
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

/**
 * The goal's Phase 2 extras — "what success looks like" and the next review date — as the add
 * form and the edit form both send them (mockup screen 4, under "More"). Both optional; null clears.
 */
export interface GoalExtrasFields { success?: string | null; reviewOn?: string | null }
export function readGoalExtrasInput(raw: unknown): InputResult<GoalExtrasFields> {
  const body = obj(raw);
  const fields: GoalExtrasFields = {};
  if (body.success !== undefined) {
    const t = readText(body.success, MAX_GOAL_SUCCESS_LEN, 'What success looks like');
    if ('error' in t) return t;
    fields.success = t.fields;
  }
  if (body.reviewOn !== undefined) {
    if (body.reviewOn === null || body.reviewOn === '') fields.reviewOn = null;
    else {
      const d = readDate(body.reviewOn, 'Review on');
      if ('error' in d) return d;
      fields.reviewOn = d.fields;
    }
  }
  return { fields };
}

export interface GoalPatchFields extends GoalExtrasFields {
  focusArea?: string;
  note?: string | null;
  status?: RepDevelopmentGoalStatus;
  /** Required WITH a status (Phase 2): a status change is a review, dated by the coach's own day. */
  reviewedOn?: string;
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
    // A status change is a REVIEW (F08) — dated by the client's own day, never the server's clock
    // (a server "today" is UTC, and an evening tap would land on tomorrow).
    const on = readDate(body.reviewedOn, 'Reviewed on');
    if ('error' in on) return { error: 'A status change is a review — say which day it was reviewed on.' };
    fields.reviewedOn = on.fields;
  }
  const extras = readGoalExtrasInput(body);
  if ('error' in extras) return extras;
  Object.assign(fields, extras.fields);
  if (Object.keys(fields).length === 0) return { error: 'Nothing to update' };
  return { fields };
}

// ── Goal reviews (append-only dated events — F08; status required, never prose — F19) ───────────

export interface GoalReviewFields {
  reviewedOn: string;
  status: RepDevelopmentGoalStatus;
  note: string | null;
  nextReviewOn: string | null;
  evidenceMeasurableIds: string[];
  evidenceObservationIds: string[];
}

export function readGoalReviewInput(raw: unknown): InputResult<GoalReviewFields> {
  const body = obj(raw);
  if (typeof body.status !== 'string' || !GOAL_STATUSES.includes(body.status as RepDevelopmentGoalStatus)) {
    return { error: 'Choose a status for the goal — Working on it, Achieved or Parked.' };
  }
  const on = readDate(body.reviewedOn, 'Reviewed on');
  if ('error' in on) return on;
  const note = readText(body.note, MAX_REVIEW_NOTE_LEN, 'The review note');
  if ('error' in note) return note;
  let nextReviewOn: string | null = null;
  if (body.nextReviewOn != null && body.nextReviewOn !== '') {
    const d = readDate(body.nextReviewOn, 'Next review');
    if ('error' in d) return d;
    nextReviewOn = d.fields;
  }
  const evidenceMeasurableIds = body.evidenceMeasurableIds === undefined ? [] : readIdList(body.evidenceMeasurableIds);
  const evidenceObservationIds = body.evidenceObservationIds === undefined ? [] : readIdList(body.evidenceObservationIds);
  if (!evidenceMeasurableIds || !evidenceObservationIds) return { error: 'Evidence must be a list of record ids.' };
  return {
    fields: {
      reviewedOn: on.fields, status: body.status as RepDevelopmentGoalStatus, note: note.fields, nextReviewOn,
      evidenceMeasurableIds, evidenceObservationIds,
    },
  };
}

// ── Observations (what was seen, in a stated setting — plan §7) ─────────────────────────────────

export interface ObservationCreateFields {
  /** Named, not verified — the route proves it is this team's SKILL (and the database refuses a test). */
  measurableTypeId: string;
  observedOn: string;
  note: string | null;
  descriptor: string | null;
  goalId: string | null;
  sessionId: string | null;
}
export type ObservationPatchFields = Partial<Omit<ObservationCreateFields, 'measurableTypeId' | 'sessionId'>>;

/**
 * A note OR a descriptor — at least one (the table's CHECK): "With a reminder" is itself what was
 * seen. The descriptor is the skill's own word, verified against the definition by the route.
 */
export function readObservationInput(raw: unknown, mode: 'create'): InputResult<ObservationCreateFields>;
export function readObservationInput(raw: unknown, mode: 'patch'): InputResult<ObservationPatchFields>;
export function readObservationInput(raw: unknown, mode: 'create' | 'patch'): InputResult<ObservationCreateFields | ObservationPatchFields> {
  const body = obj(raw);
  const fields: ObservationPatchFields & { measurableTypeId?: string; sessionId?: string | null } = {};
  if (body.measurableTypeId !== undefined) {
    if (mode === 'patch') return { error: 'The skill an observation names cannot be changed — record a new one.' };
    if (!isId(body.measurableTypeId)) return { error: 'measurableTypeId is required' };
    fields.measurableTypeId = body.measurableTypeId;
  } else if (mode === 'create') return { error: 'measurableTypeId is required' };
  if (mode === 'create' || body.observedOn !== undefined) {
    const d = readDate(body.observedOn, 'Observed on');
    if ('error' in d) return d;
    fields.observedOn = d.fields;
  }
  if (body.note !== undefined) {
    const t = readText(body.note, MAX_OBSERVATION_NOTE_LEN, 'What you saw');
    if ('error' in t) return t;
    fields.note = t.fields;
  }
  if (body.descriptor !== undefined) {
    const t = readText(body.descriptor, MAX_DESCRIPTOR_LEN, 'The descriptor');
    if ('error' in t) return t;
    fields.descriptor = t.fields;
  }
  if (body.goalId !== undefined) {
    if (body.goalId === null || body.goalId === '') fields.goalId = null;
    else if (isId(body.goalId)) fields.goalId = body.goalId;
    else return { error: 'Invalid goalId' };
  }
  if (mode === 'create') {
    if (body.sessionId != null) {
      if (!isId(body.sessionId)) return { error: 'Invalid sessionId' };
      fields.sessionId = body.sessionId;
    } else fields.sessionId = null;
    if (!fields.note && !fields.descriptor) return { error: 'Say what you saw, or choose a descriptor.' };
    return {
      fields: {
        measurableTypeId: fields.measurableTypeId!, observedOn: fields.observedOn!,
        note: fields.note ?? null, descriptor: fields.descriptor ?? null, goalId: fields.goalId ?? null, sessionId: fields.sessionId ?? null,
      },
    };
  }
  if (Object.keys(fields).length === 0) return { error: 'Nothing to update' };
  return { fields };
}

/**
 * The PATCH an edit should send — ONLY the fields the coach changed, or null when nothing did.
 * Both observation sheets (the player's page and the session grid) read it before writing, so an
 * unchanged edit closes without a request and a saved descriptor the skill has since dropped is
 * never re-sent by accident (the route refuses a word not on the list — the coach did not touch it,
 * and the refusal named it; /review 2026-09-15). Empty strings are the form's blanks: they compare
 * as null against the record and are sent as null.
 */
export function observationEditPatch(
  existing: { observedOn: string; note: string | null; descriptor: string | null; goalId: string | null },
  next: { observedOn: string; note: string; descriptor: string; goalId: string | null },
): ObservationPatchFields | null {
  const patch: ObservationPatchFields = {};
  const note = next.note.trim() || null;
  const descriptor = next.descriptor || null;
  if (next.observedOn !== existing.observedOn) patch.observedOn = next.observedOn;
  if (note !== existing.note) patch.note = note;
  if (descriptor !== existing.descriptor) patch.descriptor = descriptor;
  if ((next.goalId ?? null) !== existing.goalId) patch.goalId = next.goalId ?? null;
  return Object.keys(patch).length === 0 ? null : patch;
}

// ── Not assessed (a state with a neutral reason, never a value) ─────────────────────────────────

export interface NotAssessedFields { playerId: string; measurableTypeId: string; reason: string | null }
export function readNotAssessedInput(raw: unknown): InputResult<NotAssessedFields> {
  const body = obj(raw);
  if (!isId(body.playerId)) return { error: 'playerId is required' };
  if (!isId(body.measurableTypeId)) return { error: 'measurableTypeId is required' };
  const reason = readText(body.reason, MAX_NOT_ASSESSED_REASON_LEN, 'The reason');
  if ('error' in reason) return reason;
  return { fields: { playerId: body.playerId, measurableTypeId: body.measurableTypeId, reason: reason.fields } };
}

// ── Readings ─────────────────────────────────────────────────────────────────────────────────────

export interface MeasurableFields {
  measurableTypeId: string;
  value: number;
  recordedOn: string;
  note: string | null;
  /** Named, not verified — the route proves it is this team's session in this season. */
  sessionId: string | null;
  /** 1–5 within its session (owner ruling: every attempt is recorded); a single reading is always 1. */
  attemptNo: number;
}

/** A correction (plan §9): the value, and the note if it changed. Never the attempt, test, session or date. */
export interface MeasurableCorrectionFields { value: number; note?: string | null }
export function readMeasurableCorrectionInput(raw: unknown): InputResult<MeasurableCorrectionFields> {
  const body = obj(raw);
  const value = typeof body.value === 'number' ? body.value : NaN;
  if (!Number.isFinite(value) || value < 0 || value > MAX_READING_VALUE) {
    return { error: 'Value must be a number between 0 and 99,999.' };
  }
  const fields: MeasurableCorrectionFields = { value };
  if (body.note !== undefined) {
    const t = readText(body.note, MAX_READING_NOTE_LEN, 'Note');
    if ('error' in t) return t;
    fields.note = t.fields;
  }
  return { fields };
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
  // The attempt within its session — absent = 1. A second attempt needs a session to belong to:
  // a single result is one attempt, and "attempt 2 of nothing" would be a row the screens cannot
  // place. The bound here (1..MAX_ATTEMPTS) is the ONLY server-side ceiling: the session's plan is a
  // floor the row may run past with its "+" (re-evaluation stage 2, C2), and the definition no
  // longer bounds anything.
  let attemptNo = 1;
  if (body.attemptNo !== undefined) {
    const a = body.attemptNo;
    if (typeof a !== 'number' || !Number.isInteger(a) || a < 1 || a > MAX_ATTEMPTS) {
      return { error: `Attempt must be a whole number from 1 to ${MAX_ATTEMPTS}.` };
    }
    if (a > 1 && !sessionId) return { error: 'A second attempt belongs to a session — a result outside one is a single attempt.' };
    attemptNo = a;
  }
  return { fields: { measurableTypeId, value, recordedOn, note: note || null, sessionId, attemptNo } };
}

// ── Sessions ─────────────────────────────────────────────────────────────────────────────────────

/**
 * The session's scope — both lists, each at least one id (the table's CHECK is both-or-neither) —
 * and, since the count moved onto the session (re-evaluation stage 2, C1), the attempts PLANNED per
 * test: a map of metric id → 1..5 whose keys are all in `metricIds` (a count for a metric that is
 * not in the plan is a contradiction, refused). Absent = no count claimed, which is what a session
 * from before the count says and what a client that never learned the count still sends.
 */
export interface SessionScopeFields { metricIds: string[]; playerIds: string[]; attempts: Record<string, number> | null }
function readScope(raw: unknown): InputResult<SessionScopeFields> {
  const body = obj(raw);
  const metricIds = readIdList(body.metricIds);
  const playerIds = readIdList(body.playerIds);
  if (!metricIds || !playerIds) return { error: 'A scope names the metrics and the players — both as lists of ids.' };
  if (metricIds.length === 0) return { error: 'Choose at least one metric to record.' };
  if (playerIds.length === 0) return { error: 'Choose at least one player who is here.' };
  let attempts: Record<string, number> | null = null;
  if (body.attempts != null) {
    if (typeof body.attempts !== 'object' || Array.isArray(body.attempts)) return { error: 'Attempts per test must be a map of metric id → count.' };
    const inScope = new Set(metricIds);
    attempts = {};
    for (const [id, n] of Object.entries(body.attempts as Record<string, unknown>)) {
      if (!inScope.has(id)) return { error: 'A count belongs to a test in the plan — add the test first.' };
      if (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > MAX_ATTEMPTS) {
        return { error: `Attempts must be a whole number from 1 to ${MAX_ATTEMPTS}.` };
      }
      attempts[id] = n;
    }
    // A plan of skills alone claims no count — stored as null, the same as a session that never
    // planned one, so "null = no count claimed" stays one meaning (/review 2026-09-15).
    if (Object.keys(attempts).length === 0) attempts = null;
  }
  return { fields: { metricIds, playerIds, attempts } };
}

export interface SessionCreateFields {
  sessionDate: string;
  note: string | null;
  /** Named, not verified — the route proves it sits on this team's season schedule. */
  eventId: string | null;
  /** Null = no scope stated (the pre-Phase-2 shape, still allowed). Ids named, not verified. */
  scope: SessionScopeFields | null;
}

/** "Start session" — the date (required), the note, the event and the scope (mockup screen 3). */
export function readSessionCreateInput(raw: unknown): InputResult<SessionCreateFields> {
  const body = obj(raw);
  const d = readDate(body.sessionDate, 'sessionDate');
  if ('error' in d) return d;
  const note = readText(body.note, MAX_SESSION_NOTE_LEN, 'Note');
  if ('error' in note) return note;
  let eventId: string | null = null;
  if (body.eventId != null && body.eventId !== '') {
    if (!isId(body.eventId)) return { error: 'eventId must be an event id or null' };
    eventId = body.eventId;
  }
  let scope: SessionScopeFields | null = null;
  if (body.scope != null) {
    const sc = readScope(body.scope);
    if ('error' in sc) return sc;
    scope = sc.fields;
  }
  return { fields: { sessionDate: d.fields, note: note.fields, eventId, scope } };
}

export interface SessionPatchFields {
  sessionDate?: string;
  note?: string | null;
  eventId?: string | null;
  scope?: SessionScopeFields;
  /**
   * With a scope change that DROPS a test the session already holds results for (C9): the metric
   * ids whose results in this session are deleted too. Absent = keep them (the default the confirm
   * offers — deleting a whole session keeps its results, and a plan change is never more
   * destructive than that). Only ids OUTSIDE the new scope qualify; observations are never deleted
   * this way (a written note about a child stays with the player).
   */
  dropResultsFor?: string[];
}

/** The event id is named, not verified — the route proves it sits on this team's season schedule. */
export function readSessionPatchInput(raw: unknown): InputResult<SessionPatchFields> {
  const body = obj(raw);
  const fields: SessionPatchFields = {};
  if (body.scope !== undefined) {
    const sc = readScope(body.scope);
    if ('error' in sc) return sc;
    fields.scope = sc.fields;
  }
  if (body.dropResultsFor !== undefined) {
    const ids = readIdList(body.dropResultsFor);
    if (!ids) return { error: 'dropResultsFor must be a list of metric ids.' };
    if (!fields.scope) return { error: 'Results are dropped with the plan change that removes their test.' };
    if (ids.some(id => fields.scope!.metricIds.includes(id))) return { error: 'A test still in the plan keeps its results.' };
    fields.dropResultsFor = ids;
  }
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
