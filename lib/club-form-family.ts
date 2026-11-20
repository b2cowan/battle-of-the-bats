import 'server-only';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { supabaseAdmin } from './supabase-admin';
import { payLinkSecret } from './league-pay-link';
import { isUuid, registrationReference } from './utils';
import { readSignupForm, CLUB_FORM_BUCKET, type SignupVersionRow } from './club-form-server';
import { FILES_PER_SIGNUP, answerError, needsTick, tickState, type AnswerOut, type SignupDocument, type SignupFormView, type SignupQuestion } from './club-form-signup';
import { FAMILY_FORM_WORDS } from './club-form-family-words';
import type { DocumentUploadKind } from './document-upload';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE CLUB'S SIGN-UP FORM — what a FAMILY's requests read and write (Board Ready Stage 4 Part 2; mig 513, 515).
 *
 *   hand-over      a PDF opens through our server, which hands the family a signed receipt (a cookie) naming the version
 *                  and the moment it was handed over; the sign-up's tick carries that time (ruling 18). Nothing is stored
 *                  before the sign-up: the receipt is the family's to bring back. No secret, no receipt (fails closed).
 *   files          one file per request, its type read from its bytes, stored waiting; attached inside the placement
 *                  (mig 515) or deleted — at once on Remove, and within a day if it never joins a sign-up.
 *   Your sign-up   what the family's own page shows and changes (ruling 20): each child's answers (a health answer's
 *                  words are never sent back to the page), the documents that need a tick, a re-tick, a change.
 *
 * Every table is service-role only; the routes in front decide who may ask (a family's signed link, or the public page).
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

// ─── The PDF hand-over receipt ──────────────────────────────────────────────────────────────────────────────────────

/** A receipt is good for a day (seconds): a family that opened the PDF this morning can still sign up tonight. */
export const HANDOVER_MAX_AGE_S = 24 * 60 * 60;

/** One cookie per document (a family can have several PDFs open), scoped to the season's API by the route. */
export const handoverCookieName = (documentId: string) => `fl_ho_${documentId.replace(/-/g, '').slice(0, 16)}`;

function handoverSig(versionId: string, at: number, secret: string): string {
  return createHmac('sha256', secret).update(`club-form-handover:${versionId.toLowerCase()}:${at}`).digest().subarray(0, 16).toString('base64url');
}

/** The receipt for a version handed over at `at` (ms); null where the environment has no secret, so no PDF can be ticked
 *  there — the rule every signed value in the product keeps (it fails closed). */
export function signHandover(versionId: string, at: number): string | null {
  const secret = payLinkSecret();
  return secret ? `${versionId}.${at}.${handoverSig(versionId, at, secret)}` : null;
}

/** When the version was handed over, from the family's receipt; null when there is none, or it is for another version,
 *  forged, older than a day, or the environment has no secret. */
function readHandover(value: string | undefined | null, versionId: string, now = Date.now()): Date | null {
  const secret = payLinkSecret();
  if (!value || !secret) return null;
  const [v, atRaw, sig] = value.split('.');
  const at = Number(atRaw);
  if (v !== versionId || !Number.isFinite(at) || at > now + 60_000 || now - at > HANDOVER_MAX_AGE_S * 1000) return null;
  const want = Buffer.from(handoverSig(versionId, at, secret));
  const got = Buffer.from(sig ?? '');
  return want.length === got.length && timingSafeEqual(want, got) ? new Date(at) : null;
}

/** Every receipt a request carries, read against the PDFs it ticks: document id → hand-over time (or missing). `cookie`
 *  reads one cookie by name (Next's own parser: `(await cookies()).get(name)?.value`). */
export function handoversFrom(cookie: (name: string) => string | undefined, documents: readonly Pick<SignupDocument, 'id' | 'versionId' | 'source'>[]): Map<string, Date> {
  const out = new Map<string, Date>();
  for (const d of documents) {
    if (d.source !== 'pdf') continue;
    const at = readHandover(cookie(handoverCookieName(d.id)), d.versionId);
    if (at) out.set(d.id, at);
  }
  return out;
}

// ─── Family files ───────────────────────────────────────────────────────────────────────────────────────────────────

/** The four kinds a family may attach (ruling 9), read from the bytes by lib/document-upload.ts. */
export const FAMILY_FILE_KINDS: readonly DocumentUploadKind[] = ['pdf', 'jpeg', 'png', 'heic'];

/** A file that waits too long for its sign-up is deleted: the sweep takes those older than 12 hours, and runs often enough
 *  that none outlives a day (ruling 9). */
const WAITING_FILE_MAX_AGE_MS = 12 * 60 * 60 * 1000;

/** Store a family's file, waiting for its sign-up. Paths start with the club's id (lib/org-storage-purge.ts). */
export async function storeFamilyFile(input: {
  orgId: string; formId: string; questionId: string; bytes: Uint8Array; contentType: string; storedName: string; displayName: string;
}): Promise<{ id: string; name: string; size: number }> {
  const path = `${input.orgId}/${input.formId}/files/${randomUUID()}/${input.storedName}`;
  const { error: upErr } = await supabaseAdmin.storage.from(CLUB_FORM_BUCKET).upload(path, input.bytes, { contentType: input.contentType, upsert: false });
  if (upErr) throw upErr;
  const { data, error } = await supabaseAdmin.from('club_form_files').insert({
    org_id: input.orgId, form_id: input.formId, question_id: input.questionId, path,
    file_name: input.displayName.slice(0, 200), size_bytes: input.bytes.byteLength, content_type: input.contentType, status: 'pending',
  }).select('id').single();
  if (error) {
    await supabaseAdmin.storage.from(CLUB_FORM_BUCKET).remove([path]);
    throw error;
  }
  return { id: (data as { id: string }).id, name: input.displayName, size: input.bytes.byteLength };
}

/** Remove deletes at once (ruling 9): a WAITING file of this season's form, its stored file first. False when there was
 *  none. Found through the form's owner, so a Remove never makes a form. */
export async function removeWaitingFile(seasonId: string, fileId: string): Promise<boolean> {
  if (!isUuid(fileId)) return false;
  const { data } = await supabaseAdmin.from('club_form_files').select('id, path, club_forms!inner(owner_id)')
    .eq('id', fileId).eq('status', 'pending').eq('club_forms.owner_table', 'league_seasons').eq('club_forms.owner_id', seasonId).maybeSingle();
  const row = data as { id: string; path: string } | null;
  if (!row) return false;
  // The row goes first, and only while it still waits: a sign-up that claimed it in between keeps its stored file.
  const { data: gone, error } = await supabaseAdmin.from('club_form_files').delete().eq('id', row.id).eq('status', 'pending').select('id');
  if (error) throw error;
  if ((gone ?? []).length === 0) return false;
  const { error: rmErr } = await supabaseAdmin.storage.from(CLUB_FORM_BUCKET).remove([row.path]);
  if (rmErr) throw rmErr;
  return true;
}

/**
 * The files a request attaches, checked together (both form routes): each must be one this form is still holding for
 * that question, used once, and at most five on one child's sign-up or on the sign-up's own questions (ruling 9).
 * `already` counts the files a Change keeps. Returns errors keyed by each use's place.
 */
export async function checkFileUses(formId: string, uses: readonly { answer: AnswerOut; key: string; who: string | null; set: string }[],
  questions: ReadonlyMap<string, SignupQuestion>, already: ReadonlyMap<string, number> = new Map()): Promise<Record<string, string>> {
  const list = uses.filter(u => u.answer.fileId);
  if (list.length === 0) return {};
  const ids = [...new Set(list.map(u => u.answer.fileId!))].filter(isUuid);
  const { data, error } = ids.length
    ? await supabaseAdmin.from('club_form_files').select('id, question_id').eq('form_id', formId).eq('status', 'pending').in('id', ids)
    : { data: [], error: null };
  if (error) throw error;
  const held = new Map(((data ?? []) as { id: string; question_id: string }[]).map(r => [r.id, r.question_id]));
  const errors: Record<string, string> = {};
  const used = new Set<string>();
  const perSet = new Map<string, number>(already);
  for (const u of list) {
    const id = u.answer.fileId!;
    if (held.get(id) !== u.answer.questionId || used.has(id)) errors[u.key] = answerError(questions.get(u.answer.questionId)!, u.who, 'invalid');
    used.add(id);
    perSet.set(u.set, (perSet.get(u.set) ?? 0) + 1);
  }
  for (const [set, n] of perSet) if (n > FILES_PER_SIGNUP) errors[`${set}.files`] = FAMILY_FORM_WORDS.fileTooMany(FILES_PER_SIGNUP);
  return errors;
}

/**
 * Files that never joined a sign-up, deleted (ruling 9: within a day). Stored files first, then their rows; bounded, so
 * one call never runs long (a backlog clears over the next calls). Run by the scheduled job and, as a backstop, on each
 * family upload.
 */
export async function sweepWaitingFiles(opts: { limit?: number } = {}): Promise<{ removed: number; failed: number }> {
  const before = new Date(Date.now() - WAITING_FILE_MAX_AGE_MS).toISOString();
  const { data, error } = await supabaseAdmin.from('club_form_files').select('id, path').eq('status', 'pending').lt('created_at', before)
    .order('created_at').limit(opts.limit ?? 200);
  if (error) throw error;
  const rows = (data ?? []) as { id: string; path: string }[];
  if (rows.length === 0) return { removed: 0, failed: 0 };
  // Rows first, each still waiting and still stale at the moment it goes: a sign-up that claimed one after the read above
  // keeps it, and only the rows this call really deleted have their stored files removed.
  const { data: gone, error: delErr } = await supabaseAdmin.from('club_form_files').delete()
    .in('id', rows.map(r => r.id)).eq('status', 'pending').lt('created_at', before).select('path');
  if (delErr) return { removed: 0, failed: rows.length };
  const paths = ((gone ?? []) as { path: string }[]).map(r => r.path);
  if (paths.length === 0) return { removed: 0, failed: 0 };
  const { error: rmErr } = await supabaseAdmin.storage.from(CLUB_FORM_BUCKET).remove(paths);
  // The rows are gone; a stored file left behind is found by the club purge by its prefix.
  if (rmErr) { console.error('[club-form] a waiting family file was not deleted from storage:', (rmErr as { code?: string }).code ?? 'no code'); return { removed: 0, failed: paths.length }; }
  return { removed: paths.length, failed: 0 };
}

// ─── Your sign-up ───────────────────────────────────────────────────────────────────────────────────────────────────

/** An answer as the family's own page shows it. A health answer is `hidden`: its words never leave the server for a page
 *  opened from an emailed link (Part 2 /legal check); the family can still replace or clear it. */
export type FamilyAnswer = {
  questionId: string; text?: string; choiceIds?: string[]; bool?: boolean; date?: string;
  file?: { name: string | null }; hidden?: true;
};

export type FamilyChild = { child: string; firstName: string; open: boolean; answers: FamilyAnswer[] };

export type FamilyDocumentAsk = {
  document: SignupDocument;
  /** 'again': the club asked for a new tick; 'none': added since the family signed up. */
  state: 'again' | 'none';
  /** The version's reason (families see it beside the tick) and when the club made it. */
  reason: string | null;
  since: string;
  /** The children whose tick it asks for (first names, in sign-up order). */
  children: { child: string; firstName: string }[];
};

export type FamilyFormState = {
  form: SignupFormView;
  children: FamilyChild[];
  once: { open: boolean; answers: FamilyAnswer[] };
  asks: FamilyDocumentAsk[];
  /** Ticks this sign-up made on its own page (for "You ticked … version N on …"), newest per document. */
  ticked: { documentId: string; name: string; versionNo: number; at: string }[];
};

const ANSWER_COLS = 'question_id, subject_id, value_text, value_choice_ids, value_bool, value_date, file_id, removed_at, club_form_files(file_name)';
type AnswerRow = {
  question_id: string; subject_id: string | null; value_text: string | null; value_choice_ids: string[] | null; value_bool: boolean | null;
  value_date: string | null; file_id: string | null; removed_at: string | null; club_form_files: { file_name: string } | null;
};

/** The sign-up's registrations as the form reads them: the link's own rows (`openSignupLink`), in its order. */
export type FamilyRow = { id: string; signup_ref: string | null; division_id: string | null; player_first_name: string; status: string; guardian_email?: string | null };

/** A child who can still act on Your sign-up (not declined, not withdrawn). */
export const liveRow = (r: Pick<FamilyRow, 'status'>) => r.status !== 'declined' && r.status !== 'withdrawn';

/** A child's answers can change until its division has its teams made, never on a finished season (ruling 20). */
export const answersOpen = (r: Pick<FamilyRow, 'division_id'>, teamsMade: ReadonlySet<string>, finished: boolean) =>
  !finished && !(r.division_id && teamsMade.has(r.division_id));

/** The sign-up row a family's page writes against (made on first need for a sign-up from before the form existed). */
export async function ensureSubmission(orgId: string, formId: string, ref: string, guardianEmail: string): Promise<string> {
  const { data, error } = await supabaseAdmin.from('club_form_submissions')
    .upsert({ org_id: orgId, form_id: formId, ref, guardian_email: guardianEmail.trim().toLowerCase() }, { onConflict: 'form_id,ref', ignoreDuplicates: false })
    .select('id').single();
  if (error) throw error;
  return (data as { id: string }).id;
}

/**
 * A sign-up row left holding nothing but a guardian's email (a save that failed, an empty one, the last answer cleared, the
 * only tick undone) is deleted: that row is never kept (/legal 2026-11-20; mig 515's trigger does the same when the last
 * child goes). Never throws: it runs after the family's request already has its answer.
 */
export async function pruneEmptySubmission(formId: string, ref: string): Promise<void> {
  try {
    const { data } = await supabaseAdmin.from('club_form_submissions').select('id').eq('form_id', formId).eq('ref', ref).maybeSingle();
    const id = (data as { id: string } | null)?.id;
    if (!id) return;
    const held = await Promise.all(['club_form_answers', 'club_form_ticks', 'club_form_files'].map(t =>
      supabaseAdmin.from(t).select('id', { count: 'exact', head: true }).eq('submission_id', id)));
    if (held.some(r => r.error || (r.count ?? 0) > 0)) return;
    await supabaseAdmin.from('club_form_submissions').delete().eq('id', id);
  } catch (e) {
    console.error('[club-form] an empty sign-up row was not pruned:', (e as { code?: string })?.code ?? 'no code');
  }
}

/**
 * What Your sign-up shows of the form (ruling 20): each child's answers, the sign-up's own, and the documents that ask
 * the family for a tick. Children who were declined or withdrew are left out. `signupKey`: the sign-up's reference (the
 * link's own); `teamsMade`: the divisions whose teams are published (answers close for a child then); `finished`: the
 * season is over. `read` is the form already read by the caller (one read per request).
 */
export async function familyFormState(input: {
  formId: string; rows: readonly FamilyRow[]; signupKey: string; teamsMade: ReadonlySet<string>; finished: boolean;
  read?: { view: SignupFormView; versions: SignupVersionRow[] };
}): Promise<FamilyFormState> {
  const rows = input.rows.filter(liveRow);
  const ids = rows.map(r => r.id);
  const none = Promise.resolve({ data: [], error: null });
  const [read, answers, onceAnswers, ticks] = await Promise.all([
    input.read ?? readSignupForm(input.formId),
    ids.length ? supabaseAdmin.from('club_form_answers').select(ANSWER_COLS)
      .eq('form_id', input.formId).eq('subject_table', 'league_registrations').in('subject_id', ids).is('removed_at', null) : none,
    // The sign-up's own answers, through its row by reference (no second round to find the row first).
    supabaseAdmin.from('club_form_answers').select(`${ANSWER_COLS}, club_form_submissions!inner(ref)`)
      .eq('form_id', input.formId).is('subject_id', null).is('removed_at', null).eq('club_form_submissions.ref', input.signupKey),
    ids.length ? supabaseAdmin.from('club_form_ticks').select('document_id, version_id, moved, subject_id, ticked_at')
      .eq('form_id', input.formId).eq('subject_table', 'league_registrations').in('subject_id', ids) : none,
  ]);
  if (answers.error) throw answers.error;
  if (onceAnswers.error) throw onceAnswers.error;
  if (ticks.error) throw ticks.error;
  const form = read.view;
  const health = new Map(form.questions.map(q => [q.id, q.health]));
  const shown = (a: AnswerRow): FamilyAnswer[] => {
    if (!health.has(a.question_id)) return []; // a question archived since: Your sign-up asks only what the form asks now
    if (health.get(a.question_id)) return [{ questionId: a.question_id, hidden: true, ...(a.file_id ? { file: { name: null } } : {}) }];
    return [{
      questionId: a.question_id,
      ...(a.value_text != null ? { text: a.value_text } : {}),
      ...(a.value_choice_ids ? { choiceIds: a.value_choice_ids } : {}),
      ...(a.value_bool != null ? { bool: a.value_bool } : {}),
      ...(a.value_date ? { date: a.value_date } : {}),
      ...(a.file_id ? { file: { name: a.club_form_files?.file_name ?? null } } : {}),
    }];
  };
  const childAnswers = (answers.data ?? []) as unknown as AnswerRow[];
  const children: FamilyChild[] = rows.map(r => ({
    child: registrationReference(r.id), firstName: r.player_first_name, open: answersOpen(r, input.teamsMade, input.finished),
    answers: childAnswers.filter(a => a.subject_id === r.id).flatMap(shown),
  }));

  // The documents that ask for a tick: per document, the children whose tick needs one (ruling 8, tab 7).
  const trows = (ticks.data ?? []) as { document_id: string; version_id: string | null; moved: boolean; subject_id: string; ticked_at: string }[];
  const asks: FamilyDocumentAsk[] = [];
  const ticked: FamilyFormState['ticked'] = [];
  for (const d of form.documents) {
    const steps = read.versions.filter(v => v.documentId === d.id);
    const mine = trows.filter(t => t.document_id === d.id);
    const need = rows.map(r => ({ r, state: tickState(steps, mine.filter(t => t.subject_id === r.id).map(t => ({ versionId: t.version_id, moved: t.moved }))) }))
      .filter(x => needsTick(x.state));
    const current = steps.find(v => v.id === d.versionId);
    if (need.length) {
      asks.push({
        document: d, state: need.some(x => x.state === 'again') ? 'again' : 'none', reason: current?.reason ?? null, since: current?.createdAt ?? '',
        children: need.map(x => ({ child: registrationReference(x.r.id), firstName: x.r.player_first_name })),
      });
    } else {
      const last = mine.filter(t => t.version_id === d.versionId).sort((a, b) => b.ticked_at.localeCompare(a.ticked_at))[0];
      if (last && d.versionNo > 1) ticked.push({ documentId: d.id, name: d.name, versionNo: d.versionNo, at: last.ticked_at });
    }
  }
  return {
    form, children, asks, ticked,
    once: { open: children.some(c => c.open), answers: ((onceAnswers.data ?? []) as unknown as AnswerRow[]).flatMap(shown) },
  };
}

/**
 * A family's tick from Your sign-up: one row per child it asks for, on the CURRENT version (with its stored fingerprint
 * and, for a PDF, the hand-over time). Returns the new ticks' ids (for Undo).
 */
export async function recordFamilyTicks(input: {
  orgId: string; formId: string; submissionId: string; guardianEmail: string; registrationIds: readonly string[];
  document: Pick<SignupDocument, 'id' | 'versionId' | 'sentence'>; fingerprint: string; handedOverAt: Date | null;
}): Promise<string[]> {
  const { data, error } = await supabaseAdmin.from('club_form_ticks').insert(input.registrationIds.map(id => ({
    org_id: input.orgId, form_id: input.formId, document_id: input.document.id, version_id: input.document.versionId,
    submission_id: input.submissionId, subject_table: 'league_registrations', subject_id: id,
    guardian_email: input.guardianEmail.trim().toLowerCase(), sentence: input.document.sentence,
    fingerprint: input.fingerprint, handed_over_at: input.handedOverAt?.toISOString() ?? null,
  }))).select('id');
  if (error) throw error;
  return ((data ?? []) as { id: string }[]).map(r => r.id);
}

/** Undo a tick just made on Your sign-up: only this sign-up's own ticks, and only within two minutes of making them. */
const UNDO_WINDOW_MS = 2 * 60 * 1000;
export async function undoFamilyTicks(formId: string, tickIds: readonly string[], registrationIds: readonly string[]): Promise<number> {
  const ids = tickIds.filter(isUuid);
  if (ids.length === 0) return 0;
  const { data, error } = await supabaseAdmin.from('club_form_ticks').delete()
    .eq('form_id', formId).in('id', ids).in('subject_id', [...registrationIds]).eq('moved', false)
    .gt('created_at', new Date(Date.now() - UNDO_WINDOW_MS).toISOString()).select('id');
  if (error) throw error;
  return (data ?? []).length;
}

/**
 * Your sign-up's Change, saved together (mig 515 `club_form_family_answers`): `subject` is the child's registration, or
 * null for the sign-up's own questions. `clear` lists questions whose answer the family emptied. A file the change
 * replaced or cleared is deleted from storage at once.
 */
export async function saveFamilyAnswers(input: {
  formId: string; submissionId: string; subject: string | null; answers: readonly AnswerOut[]; clear: readonly string[];
}): Promise<void> {
  const payload = [...input.answers, ...input.clear.map(questionId => ({ questionId, clear: true }))];
  if (payload.length === 0) return;
  const { data, error } = await supabaseAdmin.rpc('club_form_family_answers', {
    p_form: input.formId, p_submission: input.submissionId, p_subject: input.subject, p_answers: payload,
  });
  if (error) throw error;
  const paths = ((data ?? []) as { removed_path: string | null }[]).map(r => r.removed_path).filter((p): p is string => !!p);
  if (paths.length) {
    const { error: rmErr } = await supabaseAdmin.storage.from(CLUB_FORM_BUCKET).remove(paths);
    // The row already reads "removed"; a stored file left behind is found by the club purge by its prefix.
    if (rmErr) console.error('[club-form] a replaced family file was not deleted from storage:', (rmErr as { code?: string }).code ?? 'no code');
  }
}

/** The database's own codes for "the club changed the form under this page" (mig 515, SQLSTATE class CF). */
const FORM_GONE = { CF001: 'question', CF002: 'document', CF003: 'file' } as const;
export function formGoneError(e: unknown): 'question' | 'document' | 'file' | null {
  return FORM_GONE[String((e as { code?: string })?.code ?? '') as keyof typeof FORM_GONE] ?? null;
}
