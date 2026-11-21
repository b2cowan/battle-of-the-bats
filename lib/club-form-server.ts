import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { supabaseAdmin } from './supabase-admin';
import { isUuid } from './utils';
import {
  currentVersion, isLiveDocument, isLiveQuestion, tickSentence,
  type DocumentSource, type FormFacts, type DocumentVersion, type FormDocument, type FormQuestion, type QuestionAsked, type QuestionChoice,
  type QuestionType, type TickKind,
} from './club-form';
import type { SignupDocument, SignupFormView, SignupQuestion } from './club-form-signup';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE CLUB'S SIGN-UP FORM — reads and writes (Board Ready Stage 4 Part 1; mig 513). Pure rules: `lib/club-form.ts`.
 *
 *   ensureSeasonForm   the season's form, made on first need by `club_form_for_season` (the waiver moves in with it)
 *   readForm           questions and documents, with COUNTS of answers and ticks — never an answer, never a tick's family
 *   seasonFormFacts    what the Registration block, the checklist and Start next season say about a form
 *   signupFormView     the form as a family meets it (Part 2): live questions, live documents at their current version
 *                      (a sign-up's answers, files and ticks are saved inside the placement: mig 515, lib/club-form-family.ts)
 *   copyForm           questions and documents into another form; NEVER answers (/legal)
 *
 * Every table is service-role only: this module is the one way in, and the routes in front of it decide who may ask.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

export const CLUB_FORM_BUCKET = 'club-form-files';

/** SHA-256, hex, of the exact bytes of a PDF or the UTF-8 text (the SQL move computes the same for text). */
export function fingerprintOf(data: string | Uint8Array): string {
  return createHash('sha256').update(typeof data === 'string' ? Buffer.from(data, 'utf8') : data).digest('hex');
}

/** The season's form id, made on first need (with the waiver moved in when the season was made with one). */
export async function ensureSeasonForm(seasonId: string): Promise<string> {
  const { data, error } = await supabaseAdmin.rpc('club_form_for_season', { p_season: seasonId, p_moved: false });
  if (error) throw error;
  if (!data) throw new Error('club_form_for_season: no season');
  return data as string;
}

type QuestionRow = {
  id: string; question_type: QuestionType; label: string; help_text: string | null; choices: unknown; required: boolean;
  asked: QuestionAsked; health: boolean; on_board: boolean; sort_order: number; archived_at: string | null;
};
type DocumentRow = {
  id: string; name: string; source_kind: DocumentSource; tick_kind: TickKind; sort_order: number; archived_at: string | null;
};
type VersionRow = {
  id: string; document_id: string; version_no: number; created_at: string; body_text: string | null; file_name: string | null;
  file_size: number | null; reason: string | null; ticks_stand: boolean | null; moved_in: boolean; file_path: string | null;
  fingerprint: string;
};

const QUESTION_COLS = 'id, question_type, label, help_text, choices, required, asked, health, on_board, sort_order, archived_at';
const DOCUMENT_COLS = 'id, name, source_kind, tick_kind, sort_order, archived_at';
const VERSION_COLS = 'id, document_id, version_no, created_at, body_text, file_name, file_size, reason, ticks_stand, moved_in, file_path, fingerprint';

/** Choices read back defensively: a malformed entry is dropped, never shown as "undefined". */
export function readChoices(raw: unknown): QuestionChoice[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap(c => {
    const r = c as Record<string, unknown>;
    return typeof r?.id === 'string' && typeof r?.label === 'string' ? [{ id: r.id, label: r.label, offered: r.offered !== false }] : [];
  });
}

function toQuestion(r: QuestionRow, answers: number): FormQuestion {
  return {
    id: r.id, type: r.question_type, label: r.label, helpText: r.help_text, choices: readChoices(r.choices),
    required: r.required, asked: r.asked, health: r.health, onBoard: r.on_board, sortOrder: r.sort_order,
    archivedAt: r.archived_at, answers,
  };
}

function toVersion(v: VersionRow, ticks: number, families: number): DocumentVersion {
  return {
    id: v.id, versionNo: v.version_no, createdAt: v.created_at, bodyText: v.body_text, fileName: v.file_name,
    fileSize: v.file_size, reason: v.reason, ticksStand: v.ticks_stand, movedIn: v.moved_in, fingerprint: v.fingerprint, ticks, families,
  };
}

export type ClubForm = {
  id: string; questions: FormQuestion[]; documents: FormDocument[];
  /** When the retention clock removed the family files and health answers (Stage 4 Part 3, ruling 10), else null. */
  removedAt?: string | null;
};

/**
 * The form as the club's page reads it: every question and document, archived ones included (the page shows the live
 * ones; a record opened from elsewhere can still read an archived one), each with COUNTS only.
 */
export async function readForm(formId: string): Promise<ClubForm> {
  const [q, d, counts, removed] = await Promise.all([
    supabaseAdmin.from('club_form_questions').select(QUESTION_COLS).eq('form_id', formId).order('sort_order').order('created_at'),
    supabaseAdmin.from('club_form_documents').select(DOCUMENT_COLS).eq('form_id', formId).order('sort_order').order('created_at'),
    // The database counts (mig 513 `club_form_counts`): no answer and no guardian's email comes back, only numbers.
    supabaseAdmin.rpc('club_form_counts', { p_form: formId }),
    // Stage 4 Part 3: the clock removes a finished season's files and health answers in one run; the form page names the day.
    supabaseAdmin.from('club_form_answers').select('removed_at').eq('form_id', formId).not('removed_at', 'is', null)
      .order('removed_at', { ascending: false }).limit(1),
  ]);
  if (q.error) throw q.error;
  if (d.error) throw d.error;
  if (counts.error) throw counts.error;
  const docs = (d.data ?? []) as DocumentRow[];
  const versions = docs.length
    ? await supabaseAdmin.from('club_form_document_versions').select(VERSION_COLS).in('document_id', docs.map(x => x.id)).order('version_no', { ascending: false })
    : { data: [] as VersionRow[], error: null };
  if (versions.error) throw versions.error;

  const count = new Map<string, { n: number; families: number }>();
  for (const c of (counts.data ?? []) as { kind: string; id: string; n: number; families: number | null }[]) {
    count.set(`${c.kind}:${c.id}`, { n: c.n, families: c.families ?? 0 });
  }
  const byDoc = new Map<string, VersionRow[]>();
  for (const v of (versions.data ?? []) as VersionRow[]) byDoc.set(v.document_id, [...(byDoc.get(v.document_id) ?? []), v]);

  return {
    id: formId,
    removedAt: ((removed.data ?? []) as { removed_at: string }[])[0]?.removed_at ?? null,
    questions: ((q.data ?? []) as QuestionRow[]).map(r => toQuestion(r, count.get(`question:${r.id}`)?.n ?? 0)),
    documents: docs.map(r => ({
      id: r.id, name: r.name, source: r.source_kind, tickKind: r.tick_kind, sortOrder: r.sort_order, archivedAt: r.archived_at,
      versions: (byDoc.get(r.id) ?? []).map(v => {
        const c = count.get(`version:${v.id}`);
        return toVersion(v, c?.n ?? 0, c?.families ?? 0);
      }),
      movedTicks: count.get(`moved:${r.id}`)?.n ?? 0,
      movedFamilies: count.get(`moved:${r.id}`)?.families ?? 0,
    })),
  };
}

/** One question of a form, with its answer COUNT; null when it isn't this form's. */
export async function readQuestion(formId: string, questionId: string): Promise<FormQuestion | null> {
  if (!isUuid(questionId)) return null;
  const [{ data, error }, answers] = await Promise.all([
    supabaseAdmin.from('club_form_questions').select(QUESTION_COLS).eq('form_id', formId).eq('id', questionId).maybeSingle(),
    supabaseAdmin.from('club_form_answers').select('id', { count: 'exact', head: true }).eq('question_id', questionId),
  ]);
  if (error) throw error;
  if (answers.error) throw answers.error;
  return data ? toQuestion(data as QuestionRow, answers.count ?? 0) : null;
}

/** One document of a form, with its versions and tick COUNTS; null when it isn't this form's. (The form read is four
 *  queries and counts in the database, so one document reads through it.) */
export async function readDocument(formId: string, documentId: string): Promise<FormDocument | null> {
  if (!isUuid(documentId)) return null;
  const form = await readForm(formId);
  return form.documents.find(d => d.id === documentId) ?? null;
}

/** One version row, with the storage path (server only: a path never leaves the server). */
export async function readVersionRow(documentId: string, versionId?: string | null): Promise<VersionRow | null> {
  if (!isUuid(documentId) || (versionId != null && !isUuid(versionId))) return null;
  let query = supabaseAdmin.from('club_form_document_versions').select(VERSION_COLS).eq('document_id', documentId);
  query = versionId ? query.eq('id', versionId) : query.order('version_no', { ascending: false }).limit(1);
  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? [])[0] as VersionRow | undefined) ?? null;
}

export function factsOf(form: Pick<ClubForm, 'questions' | 'documents'>): FormFacts {
  return {
    questions: form.questions.filter(isLiveQuestion).length,
    documents: form.documents.filter(isLiveDocument).map(d => d.name),
    print: formPrint(form),
    // Stage 4 Part 3 (ruling 10): the finish confirm says the clock will remove family files and health answers.
    removesOnClock: form.questions.some(q => q.health || q.type === 'file'),
  };
}

/** The form facts of a season (made on first need). */
export async function seasonFormFacts(seasonId: string): Promise<FormFacts> {
  return factsOf(await readForm(await ensureSeasonForm(seasonId)));
}

/**
 * How many sign-ups a question added now would read "Not asked" on (drawing tab 2's foot): children for a question asked
 * for each child, sign-ups for one asked once. Declined and withdrawn sign-ups aren't counted.
 */
export async function seasonSignupCounts(seasonId: string): Promise<{ children: number; signups: number }> {
  const { data, error } = await supabaseAdmin.rpc('club_form_season_signups', { p_season: seasonId });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as { children: number; signups: number } | null;
  return { children: row?.children ?? 0, signups: row?.signups ?? 0 };
}

/**
 * The form as a FAMILY meets it (Part 2, drawing tab 5): the live questions with their offered choices (no counts, no
 * "draft board" mark) and the live documents at their current version — typed text in full, a PDF by its size only
 * (its path never leaves the server; families open it through the hand-over route). In the form's order.
 */
export async function signupFormView(formId: string): Promise<SignupFormView> {
  return (await readSignupForm(formId)).view;
}

/** A version of a live document, as the server-side family readers use it (its path never reaches a page). */
export type SignupVersionRow = { id: string; documentId: string; versionNo: number; ticksStand: boolean | null; reason: string | null; createdAt: string; fingerprint: string; filePath: string | null };

/**
 * The family's view of the form AND every version of its live documents (newest first) in the same two reads, for the
 * server-side readers that need a version's history, fingerprint or stored path (Your sign-up's ticks, the hand-over).
 */
export async function readSignupForm(formId: string): Promise<{ view: SignupFormView; versions: SignupVersionRow[] }> {
  const [q, d] = await Promise.all([
    supabaseAdmin.from('club_form_questions').select(QUESTION_COLS).eq('form_id', formId).is('archived_at', null).order('sort_order').order('created_at'),
    supabaseAdmin.from('club_form_documents').select(DOCUMENT_COLS).eq('form_id', formId).is('archived_at', null).order('sort_order').order('created_at'),
  ]);
  if (q.error) throw q.error;
  if (d.error) throw d.error;
  const docs = (d.data ?? []) as DocumentRow[];
  const { data: vs, error: vErr } = docs.length
    ? await supabaseAdmin.from('club_form_document_versions').select(VERSION_COLS).in('document_id', docs.map(x => x.id)).order('version_no', { ascending: false })
    : { data: [] as VersionRow[], error: null };
  if (vErr) throw vErr;
  const latest = new Map<string, VersionRow>();
  for (const v of (vs ?? []) as VersionRow[]) if (!latest.has(v.document_id)) latest.set(v.document_id, v);

  const questions: SignupQuestion[] = ((q.data ?? []) as QuestionRow[]).map(r => ({
    id: r.id, type: r.question_type, label: r.label, helpText: r.help_text,
    choices: readChoices(r.choices).filter(c => c.offered).map(c => ({ id: c.id, label: c.label })),
    required: r.required && r.question_type !== 'file', asked: r.asked, health: r.health,
  }));
  const documents: SignupDocument[] = docs.flatMap(x => {
    const v = latest.get(x.id);
    if (!v) return [];
    return [{
      id: x.id, name: x.name, tickKind: x.tick_kind, sentence: tickSentence(x.name, x.tick_kind), source: x.source_kind,
      versionId: v.id, versionNo: v.version_no, text: v.body_text, fileSize: v.file_path ? v.file_size : null,
      fileName: v.file_path ? v.file_name : null,
    }];
  });
  const versions = ((vs ?? []) as VersionRow[]).map(v => ({
    id: v.id, documentId: v.document_id, versionNo: v.version_no, ticksStand: v.ticks_stand, reason: v.reason, createdAt: v.created_at,
    fingerprint: v.fingerprint, filePath: v.file_path,
  }));
  return { view: { questions, documents, stamp: signupStamp(questions, documents) }, versions };
}

/** What a family acts on, printed (see SignupFormView.stamp): a typo fix leaves it alone, a new question changes it. */
function signupStamp(questions: readonly SignupQuestion[], documents: readonly Pick<SignupDocument, 'id' | 'versionId'>[]): string {
  const qs = questions.map(x => [x.id, x.type, x.required, x.asked, x.health, x.choices.map(c => c.id).join(',')].join('|'));
  return fingerprintOf(`${qs.join('\n')}#${documents.map(x => `${x.id}:${x.versionId}`).join('\n')}`).slice(0, 16);
}

/** True when a form has nothing of its own yet: no live question, no live document (the empty form's copy, Start next
 *  season's line). */
export function formIsEmpty(form: Pick<ClubForm, 'questions' | 'documents'>): boolean {
  return !form.questions.some(isLiveQuestion) && !form.documents.some(isLiveDocument);
}

/** The latest earlier season of the club whose form has questions or documents of its own (the empty form's copy). Three
 *  reads whatever the number of seasons: the seasons, their forms, and the live questions and documents of those forms. */
export async function latestFormToCopy(orgId: string, seasonId: string): Promise<{ seasonId: string; name: string; formId: string; questions: number; documents: number } | null> {
  const { data: seasons, error } = await supabaseAdmin.from('league_seasons').select('id, name')
    .eq('org_id', orgId).neq('id', seasonId).order('created_at', { ascending: false }).limit(20);
  if (error) throw error;
  const list = (seasons ?? []) as { id: string; name: string }[];
  if (list.length === 0) return null;
  const { data: forms, error: fErr } = await supabaseAdmin.from('club_forms').select('id, owner_id')
    .eq('owner_table', 'league_seasons').in('owner_id', list.map(x => x.id));
  if (fErr) throw fErr;
  const formOf = new Map(((forms ?? []) as { id: string; owner_id: string }[]).map(f => [f.owner_id, f.id]));
  const formIds = [...formOf.values()];
  if (formIds.length === 0) return null;
  const [q, d] = await Promise.all([
    supabaseAdmin.from('club_form_questions').select('form_id').in('form_id', formIds).is('archived_at', null),
    supabaseAdmin.from('club_form_documents').select('form_id, club_form_document_versions!inner(id)').in('form_id', formIds).is('archived_at', null),
  ]);
  if (q.error) throw q.error;
  if (d.error) throw d.error;
  const tally = (rows: { form_id: string }[]) => rows.reduce((m, r) => m.set(r.form_id, (m.get(r.form_id) ?? 0) + 1), new Map<string, number>());
  const qs = tally((q.data ?? []) as { form_id: string }[]);
  const ds = tally((d.data ?? []) as { form_id: string }[]);
  for (const s of list) {
    const formId = formOf.get(s.id);
    if (!formId) continue;
    const questions = qs.get(formId) ?? 0, documents = ds.get(formId) ?? 0;
    if (questions + documents > 0) return { seasonId: s.id, name: s.name, formId, questions, documents };
  }
  return null;
}

/**
 * Copy a form's live questions and documents into another form, AFTER whatever it already holds (drawing tab 4). Each
 * document's current version becomes version 1 of the copy (a PDF is copied in storage, so neither season's file depends
 * on the other's). Never answers, never ticks (/legal). Returns what was added.
 */
export async function copyForm(input: {
  orgId: string; fromFormId: string; toFormId: string; userId: string | null;
  /** The source form when the caller has already read it (Start next season does). */
  from?: ClubForm;
  /** False on a plan without the club's own questions: only the documents come across. */
  questions?: boolean;
}): Promise<{ questions: number; documents: number }> {
  const [from, to] = await Promise.all([input.from ?? readForm(input.fromFormId), readForm(input.toFormId)]);
  const nextQ = Math.max(-1, ...to.questions.map(q => q.sortOrder)) + 1;
  const nextD = Math.max(-1, ...to.documents.map(d => d.sortOrder)) + 1;
  const questions = input.questions === false ? [] : from.questions.filter(isLiveQuestion);
  if (questions.length) {
    const { error } = await supabaseAdmin.from('club_form_questions').insert(questions.map((q, i) => ({
      org_id: input.orgId, form_id: input.toFormId, question_type: q.type, label: q.label, help_text: q.helpText,
      // Only the choices still offered come across; their ids are fresh to this form's question but stable from here.
      choices: q.choices.filter(c => c.offered).map(c => ({ id: c.id, label: c.label, offered: true })),
      required: q.required, asked: q.asked, health: q.health, on_board: q.onBoard, sort_order: nextQ + i, created_by: input.userId,
    })));
    if (error) throw error;
  }
  const docs = from.documents.filter(isLiveDocument);
  // Every current version in one read (its text or its file's path).
  const { data: srcRows, error: srcErr } = docs.length
    ? await supabaseAdmin.from('club_form_document_versions').select(VERSION_COLS).in('id', docs.map(d => currentVersion(d)!.id))
    : { data: [], error: null };
  if (srcErr) throw srcErr;
  const srcOf = new Map(((srcRows ?? []) as VersionRow[]).map(v => [v.id, v]));
  let added = 0;
  for (const [i, d] of docs.entries()) {
    const src = srcOf.get(currentVersion(d)!.id);
    if (!src) continue;
    const { data: doc, error } = await supabaseAdmin.from('club_form_documents').insert({
      org_id: input.orgId, form_id: input.toFormId, name: d.name, source_kind: d.source, tick_kind: d.tickKind,
      sort_order: nextD + i, created_by: input.userId,
    }).select('id').single();
    if (error) throw error;
    const docId = (doc as { id: string }).id;
    let filePath: string | null = null;
    if (src.file_path) {
      filePath = documentPath(input.orgId, input.toFormId, docId);
      const { error: cpErr } = await supabaseAdmin.storage.from(CLUB_FORM_BUCKET).copy(src.file_path, filePath);
      if (cpErr) { await supabaseAdmin.from('club_form_documents').delete().eq('id', docId); throw cpErr; }
    }
    const { error: vErr } = await supabaseAdmin.from('club_form_document_versions').insert({
      org_id: input.orgId, document_id: docId, version_no: 1, body_text: src.body_text, file_path: filePath,
      file_name: src.file_name, file_size: src.file_size, fingerprint: src.fingerprint, created_by: input.userId,
    });
    if (vErr) {
      if (filePath) await supabaseAdmin.storage.from(CLUB_FORM_BUCKET).remove([filePath]);
      await supabaseAdmin.from('club_form_documents').delete().eq('id', docId);
      throw vErr;
    }
    added++;
  }
  return { questions: questions.length, documents: added };
}

/** The season's form id, or null when it has none — a READ (`ensureSeasonForm` makes one). The one lookup (Stage 4 Part 3). */
export async function seasonFormId(seasonId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin.from('club_forms').select('id').eq('owner_table', 'league_seasons').eq('owner_id', seasonId).maybeSingle();
  if (error) throw error;
  return (data as { id: string } | null)?.id ?? null;
}

/**
 * Remove every stored file of a season's form (its documents' PDFs and any file a family attached) — called BEFORE the
 * season's rows go: the fast path. Since Part 3 (mig 518) the rows' own triggers also list every path for the six-hourly
 * sweep, so a failed removal here is caught there; the club purge still finds the files by prefix.
 */
export async function removeSeasonFormFiles(seasonId: string): Promise<void> {
  const formId = await seasonFormId(seasonId).catch(() => null);
  if (!formId) return;
  const [{ data: docs }, { data: files }] = await Promise.all([
    supabaseAdmin.from('club_form_documents').select('club_form_document_versions(file_path)').eq('form_id', formId),
    supabaseAdmin.from('club_form_files').select('path').eq('form_id', formId),
  ]);
  const paths = [
    ...((docs ?? []) as { club_form_document_versions: { file_path: string | null }[] | null }[])
      .flatMap(d => (d.club_form_document_versions ?? []).map(v => v.file_path).filter((p): p is string => !!p)),
    ...((files ?? []) as { path: string }[]).map(x => x.path),
  ];
  if (paths.length) await supabaseAdmin.storage.from(CLUB_FORM_BUCKET).remove(paths);
}

/** Where a document's PDF is kept: under the club's id, so deleting the club finds it (lib/org-storage-purge.ts). */
export function documentPath(orgId: string, formId: string, documentId: string): string {
  return `${orgId}/${formId}/documents/${documentId}/${randomUUID()}.pdf`;
}

/**
 * The fingerprint of a form's content, for Start next season's "From {season}" mark (it clears once the club edits the
 * form): the live questions and documents, by content, in order.
 */
export function formPrint(form: Pick<ClubForm, 'questions' | 'documents'>): string {
  const q = form.questions.filter(isLiveQuestion).map(x => [x.type, x.label, x.helpText ?? '', x.choices.filter(c => c.offered).map(c => c.label).join('/'), x.required, x.asked, x.health, x.onBoard].join('|'));
  // By content, not version number: a copied document is version 1 of its source's version 2 and prints the same (the
  // copy keeps the fingerprint); a replaced one prints differently.
  const d = form.documents.filter(isLiveDocument).map(x => [x.name, x.source, x.tickKind, currentVersion(x)?.fingerprint ?? ''].join('|'));
  return fingerprintOf(`${q.join('\n')}#${d.join('\n')}`).slice(0, 16);
}
