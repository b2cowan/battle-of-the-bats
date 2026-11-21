import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { fetchAll, fetchAllIn } from './supabase-paging';
import { readChoices, seasonFormId, CLUB_FORM_BUCKET } from './club-form-server';
import { tickSentence, type QuestionAsked, type QuestionChoice, type QuestionType, type TickKind } from './club-form';
import { tickState, needsTick } from './club-form-signup';
import { liveRow } from './club-form-family';
import {
  answerCellText, ANSWER_COLUMNS_MAX, YES_NO_CHOICES,
  type AnswerCell, type GridQuestion, type RecordAnswers, type RecordAnswer, type RecordDocument, type BoardAnswer, type SeasonAnswerGrid,
} from './club-form-staff-words';
import { FILE_OPENED_ACTION } from './member-audit';
import { writeOrgAuditFirst } from './org-audit';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE CLUB READS ITS SIGN-UP FORM'S ANSWERS (Board Ready Stage 4 Part 3; drawing tab 6; rulings 5, 6, 11, 12, 13).
 *
 *   readSeasonAnswerGrid   the list's columns, filter and export: NON-health answers only, unless `health` (the one opt-in
 *                          export, "Excel with contact details and health answers"). Never a file — a file reads "Attached".
 *   readRegistrationForm   one record's two sections: every answer (health ones too, behind the same Registrations read),
 *                          "No longer asked", and each document's tick
 *   readBoardAnswers       the draft board's note line: only questions turned "Show on the draft board", never health
 *   openFamilyFile         a one-hour DOWNLOAD link to a family's file, each opening in the club's audit log
 *
 * ⚖ WHO (ruling 6, A8): every caller sits behind `houseLeagueRefusal(ctx, 'read')` — the seats that open Registrations.
 * The guard test `tests/unit/club-form-staff-guard.test.ts` holds the callers to that list. Nothing here reaches a push,
 * a bell line or an email (ruling 5).
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

type QRow = {
  id: string; question_type: QuestionType; label: string; choices: unknown; asked: QuestionAsked; health: boolean; on_board: boolean;
  sort_order: number; archived_at: string | null; created_at: string;
};
/** A question with its choices read once (a cell, a filter row and a column all read the same). */
type Q = QRow & { parsed: QuestionChoice[] };
type ARow = {
  question_id: string; subject_id: string | null; value_text: string | null; value_choice_ids: string[] | null;
  value_bool: boolean | null; value_date: string | null; file_id: string | null; removed_at: string | null;
  created_at: string; updated_at: string;
};
/** A registration as the readers need it. `guardian_email` names its sign-up with `signup_ref`, as the family's door does. */
export type StaffRegRow = { id: string; signup_ref: string | null; registered_at: string; guardian_email: string | null };
export const STAFF_REG_COLS = 'id, signup_ref, registered_at, guardian_email';

const Q_COLS = 'id, question_type, label, choices, asked, health, on_board, sort_order, archived_at, created_at';
const A_COLS = 'question_id, subject_id, value_text, value_choice_ids, value_bool, value_date, file_id, removed_at, created_at, updated_at';

async function formQuestions(formId: string): Promise<Q[]> {
  const { data, error } = await supabaseAdmin.from('club_form_questions').select(Q_COLS).eq('form_id', formId).order('sort_order').order('created_at');
  if (error) throw error;
  return ((data ?? []) as QRow[]).map(q => ({ ...q, parsed: readChoices(q.choices) }));
}

const signupKey = (r: Pick<StaffRegRow, 'id' | 'signup_ref'>) => r.signup_ref ?? r.id;
const latest = (a: string | null, b: string | null) => (a && b ? (a > b ? a : b) : a ?? b);

/** What a filter offers for a question: Yes / No, or its choices still offered. */
const gridQuestion = (q: Q): GridQuestion => ({
  id: q.id, label: q.label, type: q.question_type, health: q.health, archived: !!q.archived_at,
  choices: q.question_type === 'yes_no' ? [...YES_NO_CHOICES] : q.parsed.filter(c => c.offered).map(c => ({ id: c.id, label: c.label })),
});

/**
 * Answers (and health answers the family cleared, mig 518) for these registrations and their sign-ups' own (asked once),
 * keyed by registration then question. The sign-up's own rows come through their sign-up by reference, in one read.
 */
async function answersFor(formId: string, regs: readonly StaffRegRow[], questionIds: readonly string[]) {
  const answers = new Map<string, Map<string, ARow>>(regs.map(r => [r.id, new Map()]));
  const clears = new Map<string, Map<string, string>>(regs.map(r => [r.id, new Map()]));
  if (regs.length === 0 || questionIds.length === 0) return { answers, clears };
  const qids = [...questionIds];
  const ids = regs.map(r => r.id);
  const refs = [...new Set(regs.map(signupKey))];
  type Once = ARow & { club_form_submissions: { ref: string } };
  type Clear = { question_id: string; subject_id: string | null; cleared_at: string; club_form_submissions?: { ref: string } | null };
  const [child, once, childClears, onceClears] = await Promise.all([
    fetchAllIn<ARow>(ids, (chunk, a, b) => supabaseAdmin.from('club_form_answers').select(A_COLS)
      .eq('form_id', formId).eq('subject_table', 'league_registrations').in('subject_id', chunk).in('question_id', qids).order('id').range(a, b)),
    fetchAllIn<Once>(refs, (chunk, a, b) => supabaseAdmin.from('club_form_answers').select(`${A_COLS}, club_form_submissions!inner(ref)`)
      .eq('form_id', formId).is('subject_id', null).in('club_form_submissions.ref', chunk).in('question_id', qids).order('id').range(a, b)),
    fetchAllIn<Clear>(ids, (chunk, a, b) => supabaseAdmin.from('club_form_answer_clears').select('question_id, subject_id, cleared_at')
      .eq('form_id', formId).eq('subject_table', 'league_registrations').in('subject_id', chunk).order('id').range(a, b)),
    fetchAllIn<Clear>(refs, (chunk, a, b) => supabaseAdmin.from('club_form_answer_clears').select('question_id, subject_id, cleared_at, club_form_submissions!inner(ref)')
      .eq('form_id', formId).is('subject_id', null).in('club_form_submissions.ref', chunk).order('id').range(a, b)),
  ]);
  for (const a of child) if (a.subject_id) answers.get(a.subject_id)?.set(a.question_id, a);
  for (const c of childClears) if (c.subject_id) clears.get(c.subject_id)?.set(c.question_id, c.cleared_at);
  const byRef = <T extends { club_form_submissions?: { ref: string } | null }>(rows: readonly T[]) => {
    const m = new Map<string, T[]>();
    for (const r of rows) { const ref = r.club_form_submissions?.ref; if (ref) m.set(ref, [...(m.get(ref) ?? []), r]); }
    return m;
  };
  const onceByRef = byRef(once);
  const clearByRef = byRef(onceClears);
  for (const r of regs) {
    for (const a of onceByRef.get(signupKey(r)) ?? []) answers.get(r.id)?.set(a.question_id, a);
    for (const c of clearByRef.get(signupKey(r)) ?? []) clears.get(r.id)?.set(c.question_id, c.cleared_at);
  }
  return { answers, clears };
}

/** The cell a list, a filter and an export read: words, plus the choice ids a filter matches on. */
function cellOf(q: Q, a: ARow | undefined, registeredAt: string, cleared: boolean): AnswerCell {
  // A question added after this child signed up was never asked of them; one they were asked and left (or cleared) wasn't answered.
  if (!a) return { state: q.created_at > registeredAt && !cleared ? 'not_asked' : 'not_answered' };
  if (a.removed_at) return { state: 'removed', at: a.removed_at };
  const byId = new Map(q.parsed.map(c => [c.id, c]));
  const ids = q.question_type === 'yes_no' ? (a.value_bool == null ? [] : [a.value_bool ? 'yes' : 'no']) : (a.value_choice_ids ?? []);
  const text = answerCellText({
    type: q.question_type, text: a.value_text, bool: a.value_bool, date: a.value_date, file: !!a.file_id,
    choices: (a.value_choice_ids ?? []).map(id => { const c = byId.get(id); return { label: c?.label ?? null, offered: c ? c.offered : false }; }),
  });
  // Every choice it held is gone from the question: nothing left to show, so it reads as not answered.
  if (!text) return { state: 'not_answered' };
  return { state: 'answered', text, choiceIds: ids };
}

/** Each live document with its versions newest first (the steps `tickState` reads) and the date a waiver was moved in. */
async function documentSteps(formId: string) {
  const { data: d, error } = await supabaseAdmin.from('club_form_documents')
    .select('id, name, tick_kind, club_form_document_versions(id, version_no, ticks_stand, moved_in, created_at)')
    .eq('form_id', formId).is('archived_at', null).order('sort_order').order('created_at');
  if (error) throw error;
  type V = { id: string; version_no: number; ticks_stand: boolean | null; moved_in: boolean; created_at: string };
  return ((d ?? []) as { id: string; name: string; tick_kind: TickKind; club_form_document_versions: V[] | null }[]).map(x => {
    const mine = [...(x.club_form_document_versions ?? [])].sort((a, b) => b.version_no - a.version_no);
    return {
      id: x.id, name: x.name, tickKind: x.tick_kind,
      steps: mine.map(v => ({ id: v.id, versionNo: v.version_no, ticksStand: v.ticks_stand })),
      // "text as the club held it on {date}": the MOVE's date (the moved-in version's), never the tick's (/legal Part 1).
      movedOn: mine.find(v => v.moved_in)?.created_at ?? null,
    };
  });
}

type TickRow = { document_id: string; version_id: string | null; moved: boolean; subject_id: string };
const ticksOf = (formId: string, ids: readonly string[]) => (ids.length
  ? fetchAllIn<TickRow>(ids, (chunk, a, b) => supabaseAdmin.from('club_form_ticks').select('document_id, version_id, moved, subject_id')
    .eq('form_id', formId).eq('subject_table', 'league_registrations').in('subject_id', chunk).order('id').range(a, b))
  : Promise.resolve([] as TickRow[]));

/**
 * The season's answers as the list, the filter and the export read them. `health: false` (the list, plain Excel/CSV) leaves
 * every health question out of the result entirely — only `hasHealth` says one exists, so the opt-in export is offered;
 * `health: true` is the one opt-in export. File questions are columns that read "Attached" — never the file or its name.
 */
export async function readSeasonAnswerGrid(input: { seasonId: string; regs: readonly StaffRegRow[]; health: boolean }): Promise<SeasonAnswerGrid | null> {
  const formId = await seasonFormId(input.seasonId);
  if (!formId) return null;
  const ids = input.regs.map(r => r.id);
  const [all, tickRows, docs] = await Promise.all([formQuestions(formId), ticksOf(formId, ids), documentSteps(formId)]);
  const qs = all.filter(q => input.health || !q.health);
  const { answers, clears } = await answersFor(formId, input.regs, qs.map(q => q.id));
  const cells: SeasonAnswerGrid['cells'] = {};
  for (const r of input.regs) {
    const mine = answers.get(r.id)!;
    const cleared = clears.get(r.id)!;
    cells[r.id] = Object.fromEntries(qs.map(q => [q.id, cellOf(q, mine.get(q.id), r.registered_at, cleared.has(q.id))]));
  }
  // One pass over the ticks, by child then document (a season of 400 sign-ups and a few documents).
  const ticksBy = new Map<string, Map<string, { versionId: string | null; moved: boolean }[]>>();
  for (const t of tickRows) {
    const byDoc = ticksBy.get(t.subject_id) ?? new Map();
    byDoc.set(t.document_id, [...(byDoc.get(t.document_id) ?? []), { versionId: t.version_id, moved: t.moved }]);
    ticksBy.set(t.subject_id, byDoc);
  }
  const needs = ids.filter(id => docs.some(d => needsTick(tickState(d.steps, ticksBy.get(id)?.get(d.id) ?? []))));
  // An archived question is a column only where someone answered it ("No longer asked"); nobody's answers, no column.
  const answeredArchived = qs.filter(q => q.archived_at && input.regs.some(r => answers.get(r.id)?.has(q.id)));
  return {
    formId,
    // The opt-in export is offered for a live health question (an archived one is in it only where it was answered).
    hasHealth: all.some(q => q.health && !q.archived_at),
    questions: [...qs.filter(q => !q.archived_at), ...answeredArchived].map(gridQuestion),
    cells,
    needsTick: needs,
  };
}

/**
 * One registration's "Sign-up answers" and "Documents" (drawing tab 6 · B, tab 8 · B). Every question the form holds, in its
 * order, health ones included (the record is the one place a health answer shows, ruling 5). Archived questions show only
 * where this family answered them ("No longer asked"). Answers asked once per sign-up name the sign-up's children — the
 * children of the same reference AND family email, as the family's own door groups them (lib/league-signup-status.ts).
 */
export async function readRegistrationForm(input: { seasonId: string; reg: StaffRegRow }): Promise<RecordAnswers | null> {
  const formId = await seasonFormId(input.seasonId);
  if (!formId) return null;
  const sibs = supabaseAdmin.from('league_registrations').select('id, player_first_name, status').eq('season_id', input.seasonId);
  const siblingsRead = input.reg.signup_ref
    ? (input.reg.guardian_email ? sibs.eq('signup_ref', input.reg.signup_ref).eq('guardian_email', input.reg.guardian_email)
      : sibs.eq('signup_ref', input.reg.signup_ref).is('guardian_email', null))
    : sibs.eq('id', input.reg.id);
  const [qs, docs, siblings, ticks] = await Promise.all([
    formQuestions(formId),
    documentSteps(formId),
    siblingsRead.order('registered_at'),
    supabaseAdmin.from('club_form_ticks').select('document_id, version_id, moved, sentence, ticked_at, handed_over_at')
      .eq('form_id', formId).eq('subject_table', 'league_registrations').eq('subject_id', input.reg.id).order('ticked_at', { ascending: false }),
  ]);
  if (siblings.error) throw siblings.error;
  if (ticks.error) throw ticks.error;
  const read = await answersFor(formId, [input.reg], qs.map(q => q.id));
  const answers = read.answers.get(input.reg.id)!;
  const cleared = read.clears.get(input.reg.id)!;
  const fileIds = [...answers.values()].map(a => a.file_id).filter((x): x is string => !!x);
  const files = fileIds.length ? await fetchAll<{ id: string; file_name: string; status: string; size_bytes: number }>((a, b) =>
    supabaseAdmin.from('club_form_files').select('id, file_name, status, size_bytes').in('id', fileIds).order('id').range(a, b)) : [];
  const fileOf = new Map(files.map(f => [f.id, f]));
  const together = ((siblings.data ?? []) as { id: string; player_first_name: string; status: string }[])
    .filter(s => liveRow(s) || s.id === input.reg.id).map(s => s.player_first_name);

  const toAnswer = (q: Q): RecordAnswer => {
    const a = answers.get(q.id);
    const file = a?.file_id ? fileOf.get(a.file_id) : undefined;
    return {
      questionId: q.id, label: q.label, health: q.health, type: q.question_type,
      once: q.asked === 'once' ? together : null,
      cell: cellOf(q, a, input.reg.registered_at, cleared.has(q.id)),
      file: file && file.status === 'attached' && !a?.removed_at ? { id: file.id, name: file.file_name, size: file.size_bytes } : null,
      // /legal Part 2 (f): a health answer the family changed (or cleared) after it was first given says when.
      changedAt: !q.health ? null : latest(cleared.get(q.id) ?? null, a && a.updated_at > a.created_at ? a.updated_at : null),
      archivedAt: q.archived_at,
    };
  };
  const live = qs.filter(q => !q.archived_at).map(toAnswer);
  const archived = qs.filter(q => q.archived_at && answers.has(q.id)).map(toAnswer);

  const trows = (ticks.data ?? []) as { document_id: string; version_id: string | null; moved: boolean; sentence: string; ticked_at: string; handed_over_at: string | null }[];
  const documents: RecordDocument[] = docs.map(d => {
    const mine = trows.filter(t => t.document_id === d.id);
    const last = mine[0];
    const noOf = new Map(d.steps.map(s => [s.id, s.versionNo]));
    return {
      documentId: d.id, name: d.name,
      sentence: last?.sentence ?? tickSentence(d.name, d.tickKind),
      state: tickState(d.steps, mine.map(t => ({ versionId: t.version_id, moved: t.moved }))),
      currentNo: d.steps[0]?.versionNo ?? 1,
      tick: last ? {
        versionNo: last.moved || !last.version_id ? null : noOf.get(last.version_id) ?? null,
        at: last.ticked_at, handedOverAt: last.moved ? null : last.handed_over_at, moved: last.moved,
        movedOn: last.moved ? d.movedOn : null,
      } : null,
    };
  });
  return { answers: live, archived, documents };
}

/**
 * The draft board's answers (ruling 12): questions turned "Show on the draft board" — never a health question (the database
 * refuses that pair; checked again here) — for the division's active players, and the questions themselves for the pool's
 * Filter. Read only where the board already reads the family's notes (`teams-board/route.ts`, behind the same gate).
 */
export async function readBoardAnswers(seasonId: string, divisionId: string): Promise<{ questions: GridQuestion[]; answers: Record<string, BoardAnswer[]> } | null> {
  const [formId, regs] = await Promise.all([
    seasonFormId(seasonId),
    fetchAll<StaffRegRow>((a, b) => supabaseAdmin.from('league_registrations').select(STAFF_REG_COLS)
      .eq('season_id', seasonId).eq('division_id', divisionId).eq('status', 'active').order('id').range(a, b)),
  ]);
  if (!formId) return null;
  const qs = (await formQuestions(formId)).filter(q => q.on_board && !q.health && !q.archived_at);
  if (!qs.length) return null;
  const { answers } = await answersFor(formId, regs, qs.map(q => q.id));
  const out: Record<string, BoardAnswer[]> = {};
  for (const r of regs) {
    const line = qs.flatMap(q => {
      const cell = cellOf(q, answers.get(r.id)?.get(q.id), r.registered_at, false);
      return cell.state === 'answered' ? [{ questionId: q.id, label: q.label, text: cell.text, choiceIds: cell.choiceIds }] : [];
    });
    if (line.length) out[r.id] = line;
  }
  return { questions: qs.map(gridQuestion), answers: out };
}

/** The person's whole answer-columns map (form id → question ids). */
async function columnsMap(userId: string): Promise<Record<string, unknown>> {
  const { data, error } = await supabaseAdmin.from('user_preferences').select('registration_answer_columns').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return ((data as { registration_answer_columns: Record<string, unknown> } | null)?.registration_answer_columns ?? {}) as Record<string, unknown>;
}

/** The answer columns this person chose for this form (ruling 11), kept to questions the list may still show. */
export async function readAnswerColumns(userId: string, formId: string, allowed: readonly string[]): Promise<string[]> {
  const chosen = (await columnsMap(userId))[formId];
  const ids = Array.isArray(chosen) ? chosen.filter((x): x is string => typeof x === 'string') : [];
  return ids.filter(id => allowed.includes(id)).slice(0, ANSWER_COLUMNS_MAX);
}

/** Save this person's answer columns for this form (only this form's key changes). */
export async function saveAnswerColumns(userId: string, formId: string, ids: readonly string[]): Promise<void> {
  const prev = await columnsMap(userId);
  const { error } = await supabaseAdmin.from('user_preferences')
    .upsert({ user_id: userId, registration_answer_columns: { ...prev, [formId]: [...ids] }, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) throw error;
}

/**
 * A one-hour DOWNLOAD link to a family's file on this registration (ruling 9: `Content-Disposition: attachment`; the
 * Privacy Policy's one-hour links), or null when it is not this registration's, not attached, or removed. Each opening is
 * written to the club's audit log FIRST — who, when, the registration and the file's id, never its name or content — and
 * the link is not made when that line can't be written ('unrecorded'; owner call 3, 2026-11-20).
 */
export async function openFamilyFile(input: { orgId: string; actorId: string; seasonId: string; reg: StaffRegRow; fileId: string }): Promise<string | 'unrecorded' | null> {
  const formId = await seasonFormId(input.seasonId);
  if (!formId) return null;
  const { data, error } = await supabaseAdmin.from('club_form_files').select('id, path, file_name, status, subject_id, submission_id')
    .eq('id', input.fileId).eq('form_id', formId).eq('org_id', input.orgId).maybeSingle();
  if (error) throw error;
  const f = data as { id: string; path: string; file_name: string; status: string; subject_id: string | null; submission_id: string | null } | null;
  if (!f || f.status !== 'attached') return null;
  if (f.subject_id !== input.reg.id) {
    // A file asked once per sign-up belongs to the sign-up: it opens from any of its children's records.
    if (f.subject_id || !f.submission_id) return null;
    const { data: sub } = await supabaseAdmin.from('club_form_submissions').select('ref').eq('id', f.submission_id).maybeSingle();
    if ((sub as { ref: string } | null)?.ref !== signupKey(input.reg)) return null;
  }
  // The record first; no line, no link. No target person: the log names the child and the season from the ids at read time.
  if (!(await writeOrgAuditFirst(input.orgId, input.actorId, null, FILE_OPENED_ACTION, { registrationId: input.reg.id, fileId: f.id }))) return 'unrecorded';
  const { data: signed, error: sErr } = await supabaseAdmin.storage.from(CLUB_FORM_BUCKET).createSignedUrl(f.path, 3600, { download: f.file_name });
  if (sErr || !signed?.signedUrl) throw sErr ?? new Error('club-form: no signed link');
  return signed.signedUrl;
}

/** How many removal lines one sweep round clears. */
export const REMOVALS_PER_ROUND = 500;

/** Stored files whose rows went (mig 518's list): deleted, then their lines. Returns how many it cleared. */
export async function clearStorageRemovals(limit = REMOVALS_PER_ROUND): Promise<number> {
  const { data, error } = await supabaseAdmin.from('club_form_storage_removals').select('path').order('created_at').limit(limit);
  if (error) throw error;
  const paths = ((data ?? []) as { path: string }[]).map(r => r.path);
  if (!paths.length) return 0;
  const { error: rmErr } = await supabaseAdmin.storage.from(CLUB_FORM_BUCKET).remove(paths);
  if (rmErr) throw rmErr;
  const { error: delErr } = await supabaseAdmin.from('club_form_storage_removals').delete().in('path', paths);
  if (delErr) throw delErr;
  return paths.length;
}

/** Ruling 10's clock (mig 518 `club_form_retention_sweep`): how many answers it removed. */
export async function runRetentionSweep(): Promise<number> {
  const { data, error } = await supabaseAdmin.rpc('club_form_retention_sweep');
  if (error) throw error;
  return Number(data ?? 0);
}
