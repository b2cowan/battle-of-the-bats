import { NextResponse } from 'next/server';
import { getLeagueSeasonBySlug } from '@/lib/db';
import { isPublicLeagueSeason } from '@/lib/league-game-changes-server';
import { resolvePublicLeagueContext } from '@/lib/public-league';
import { withObservability } from '@/lib/observability';
import { throttleSignupFiles } from '@/lib/public-form-throttle';
import { isFinishedLeagueSeason } from '@/lib/house-league-access';
import { checkDocumentUpload } from '@/lib/document-upload';
import { FORM_LIMITS } from '@/lib/club-form';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { isUuid } from '@/lib/utils';
import { FAMILY_FILE_KINDS, storeFamilyFile, sweepWaitingFiles } from '@/lib/club-form-family';
import { FAMILY_FORM_WORDS as W } from '@/lib/club-form-family-words';
import { isPhoto, sizeLine } from '@/lib/club-form-signup';

export const dynamic = 'force-dynamic';

/**
 * POST /api/league/[orgSlug]/[seasonSlug]/form/files — a family attaches ONE file to a file question, the moment it is
 * chosen (Board Ready Stage 4 Part 2; ruling 9; drawing tab 5). Multipart: `questionId`, `file`. Public, no sign-in: the
 * sign-up page and Your sign-up both use it.
 *
 *   • rate-limited on its own budget (`throttleSignupFiles`);
 *   • the question must be a live FILE question of this season's form;
 *   • up to 8 MB, and a PDF, JPEG, PNG or HEIC as read FROM ITS BYTES (`checkDocumentUpload`), never from its name or the
 *     type the browser claimed; stored with the type the bytes say;
 *   • stored WAITING: it joins a registration only inside the placement (mig 515) or a Change, and a file that never does
 *     is deleted within a day (`sweepWaitingFiles`, which also runs here as a backstop, a few at a time).
 * The answer names the file only by its id: nothing about any other family's file is ever said.
 */
export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; seasonSlug: string }> },) => {
  const { orgSlug, seasonSlug } = await params;
  const throttled = throttleSignupFiles(req);
  if (throttled) return throttled;

  const org = await resolvePublicLeagueContext(orgSlug);
  if (!org) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const season = await getLeagueSeasonBySlug(org.id, seasonSlug);
  if (!isPublicLeagueSeason(season)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (isFinishedLeagueSeason(season)) return NextResponse.json({ error: W.fileFailed, code: 'finished' }, { status: 409 });

  // A body far over the limit is refused before it is read into memory (the form's own fields fit well inside 64 KB).
  const declared = Number(req.headers.get('content-length') ?? 0);
  if (declared > FORM_LIMITS.fileBytes + 64 * 1024) return NextResponse.json({ error: W.fileTooBig(sizeLine(declared), false), code: 'too_big' }, { status: 413 });

  let form: FormData;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: W.fileFailed }, { status: 400 }); }
  const questionId = String(form.get('questionId') ?? '');
  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: W.fileFailed }, { status: 400 });
  if (file.size > FORM_LIMITS.fileBytes) return NextResponse.json({ error: W.fileTooBig(sizeLine(file.size), isPhoto(file)), code: 'too_big' }, { status: 413 });

  // One read: a live FILE question of this season's form (a question gone or changed is refused, never stored against).
  const { data: q, error: qErr } = isUuid(questionId)
    ? await supabaseAdmin.from('club_form_questions').select('id, form_id, club_forms!inner(owner_id)').eq('id', questionId).eq('question_type', 'file')
      .is('archived_at', null).eq('club_forms.owner_table', 'league_seasons').eq('club_forms.owner_id', season.id).maybeSingle()
    : { data: null, error: null };
  if (qErr) throw qErr;
  if (!q) return NextResponse.json({ error: 'The club changed this question. Reload the page.', code: 'question_gone' }, { status: 409 });
  const formId = (q as { form_id: string }).form_id;

  const bytes = new Uint8Array(await file.arrayBuffer());
  const checked = checkDocumentUpload(bytes, file.name || 'file', FAMILY_FILE_KINDS);
  if (!checked) return NextResponse.json({ error: W.fileWrongType, code: 'type' }, { status: 415 });

  try {
    const stored = await storeFamilyFile({ orgId: org.id, formId, questionId: q.id, bytes, ...checked });
    // The backstop for files that never joined a sign-up (the scheduled job is the main sweep). Awaited: work left running
    // after the answer can be dropped on the host. A failure here never fails the upload.
    await sweepWaitingFiles({ limit: 20 }).catch(e => console.error('[club-form-files] backstop sweep failed:', (e as { code?: string })?.code ?? 'no code'));
    return NextResponse.json({ id: stored.id, name: stored.name, size: stored.size }, { status: 201 });
  } catch (e) {
    // Never the error object: a storage error can echo the file's name, which a family typed.
    console.error('[club-form-files] storing a family file failed:', (e as { code?: string; statusCode?: string })?.code ?? (e as { statusCode?: string })?.statusCode ?? 'no code');
    return NextResponse.json({ error: W.fileFailed }, { status: 500 });
  }
}, { route: '/api/league/[orgSlug]/[seasonSlug]/form/files' });
