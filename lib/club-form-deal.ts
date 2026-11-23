import 'server-only';
/**
 * THE SPONSORSHIP FORM, AS A BUSINESS'S LINK READS AND WRITES IT (Board Ready Stage 6 Part 2; mig 526 widened the
 * subject to 'club_sponsor_deals'). The engine-side twin of lib/club-form-family.ts for a deal: what the business's own
 * page shows of its answers (Change, Stage 4 ruling 20), the files it may attach, and Remove for a waiting file. Every
 * read is ONE deal's (subject_table 'club_sponsor_deals', subject_id = the deal) of ONE club's sponsorship form, so a
 * link never reads another deal's answers. The club's own read of these answers is `readDealAnswers` in
 * lib/club-form-staff.ts (the Stage 4 guard); this file is the link's, and never serves a staff screen.
 */
import { supabaseAdmin } from './supabase-admin';
import { CLUB_FORM_BUCKET } from './club-form-server';
import { FILES_PER_SIGNUP, answerError, type AnswerOut, type SignupQuestion } from './club-form-signup';
import { SPONSOR_LINK_WORDS } from './sponsor-link-words';
import { isUuid } from './utils';

export const DEAL_SUBJECT = 'club_sponsor_deals';

/** One saved answer as the business's page shows it (a file by its name only). */
export type DealLinkAnswer = {
  questionId: string; text?: string; choiceIds?: string[]; bool?: boolean; date?: string;
  file?: { id: string; name: string; size: number; type: string };
};

type Row = {
  question_id: string; value_text: string | null; value_choice_ids: string[] | null; value_bool: boolean | null; value_date: string | null;
  file_id: string | null; club_form_files: { file_name: string; size_bytes: number; content_type: string; status: string } | null;
};

/** The deal's saved answers, and the document versions it has ticked (a ticked current version isn't asked again). */
export async function dealLinkFormState(formId: string, dealId: string): Promise<{ answers: DealLinkAnswer[]; tickedVersions: string[] }> {
  const [a, t] = await Promise.all([
    supabaseAdmin.from('club_form_answers')
      .select('question_id, value_text, value_choice_ids, value_bool, value_date, file_id, club_form_files(file_name, size_bytes, content_type, status)')
      .eq('form_id', formId).eq('subject_table', DEAL_SUBJECT).eq('subject_id', dealId).is('removed_at', null),
    supabaseAdmin.from('club_form_ticks').select('version_id').eq('form_id', formId).eq('subject_table', DEAL_SUBJECT).eq('subject_id', dealId),
  ]);
  if (a.error) throw a.error;
  if (t.error) throw t.error;
  const answers = ((a.data ?? []) as unknown as Row[]).flatMap((r): DealLinkAnswer[] => {
    const f = Array.isArray(r.club_form_files) ? r.club_form_files[0] : r.club_form_files;
    if (r.file_id && (!f || f.status !== 'attached')) return [];
    return [{
      questionId: r.question_id,
      ...(r.value_text != null ? { text: r.value_text } : {}),
      ...(r.value_choice_ids ? { choiceIds: r.value_choice_ids } : {}),
      ...(r.value_bool != null ? { bool: r.value_bool } : {}),
      ...(r.value_date ? { date: r.value_date } : {}),
      ...(r.file_id && f ? { file: { id: r.file_id, name: f.file_name, size: f.size_bytes, type: f.content_type } } : {}),
    }];
  });
  const tickedVersions = [...new Set(((t.data ?? []) as { version_id: string | null }[]).map(r => r.version_id).filter((x): x is string => !!x))];
  return { answers, tickedVersions };
}

/**
 * The files a send attaches, checked: each is one this form holds WAITING for that question, or one already attached to
 * THIS deal for that question (a Change keeps it); used once; at most five (ruling 9). Errors keyed by each answer's place.
 */
export async function checkDealFileUses(formId: string, dealId: string, answers: readonly AnswerOut[], questions: ReadonlyMap<string, SignupQuestion>,
  key: (questionId: string) => string): Promise<Record<string, string>> {
  const list = answers.filter(a => a.fileId);
  if (list.length === 0) return {};
  const ids = [...new Set(list.map(a => a.fileId!))].filter(isUuid);
  const { data, error } = ids.length
    ? await supabaseAdmin.from('club_form_files').select('id, question_id, status, subject_table, subject_id').eq('form_id', formId).in('id', ids)
    : { data: [], error: null };
  if (error) throw error;
  const ok = new Map<string, string>();
  for (const r of (data ?? []) as { id: string; question_id: string; status: string; subject_table: string | null; subject_id: string | null }[]) {
    if (r.status === 'pending' || (r.status === 'attached' && r.subject_table === DEAL_SUBJECT && r.subject_id === dealId)) ok.set(r.id, r.question_id);
  }
  const errors: Record<string, string> = {};
  const used = new Set<string>();
  for (const a of list) {
    const id = a.fileId!;
    if (ok.get(id) !== a.questionId || used.has(id)) errors[key(a.questionId)] = answerError(questions.get(a.questionId)!, null, 'invalid');
    used.add(id);
  }
  if (used.size > FILES_PER_SIGNUP) errors['files'] = SPONSOR_LINK_WORDS.fileTooMany(FILES_PER_SIGNUP);
  return errors;
}

/** Remove deletes at once: a WAITING file of this club's sponsorship form, its stored file after the row. False when none. */
export async function removeWaitingDealFile(orgId: string, fileId: string): Promise<boolean> {
  if (!isUuid(fileId)) return false;
  const { data } = await supabaseAdmin.from('club_form_files').select('id, path, club_forms!inner(owner_id)')
    .eq('id', fileId).eq('status', 'pending').eq('club_forms.owner_table', 'organizations').eq('club_forms.owner_id', orgId).maybeSingle();
  const row = data as { id: string; path: string } | null;
  if (!row) return false;
  const { data: gone, error } = await supabaseAdmin.from('club_form_files').delete().eq('id', row.id).eq('status', 'pending').select('id');
  if (error) throw error;
  if ((gone ?? []).length === 0) return false;
  const { error: rmErr } = await supabaseAdmin.storage.from(CLUB_FORM_BUCKET).remove([row.path]);
  if (rmErr) throw rmErr;
  return true;
}
