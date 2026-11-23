import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { throttleSignupFiles } from '@/lib/public-form-throttle';
import { dealForLink } from '@/lib/sponsor-link-route';
import { checkDocumentUpload } from '@/lib/document-upload';
import { FORM_LIMITS } from '@/lib/club-form';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { isUuid } from '@/lib/utils';
import { FAMILY_FILE_KINDS, storeFamilyFile, sweepWaitingFiles } from '@/lib/club-form-family';
import { FAMILY_FORM_WORDS as W } from '@/lib/club-form-family-words';
import { isPhoto, sizeLine } from '@/lib/club-form-signup';
import { linkTakesForm } from '@/lib/club-sponsorship-deals';

export const dynamic = 'force-dynamic';

/**
 * POST /api/public/sponsorship/[token]/files — the business attaches ONE file to a file question of the club's
 * sponsorship form, the moment it is chosen (Board Ready Stage 6 Part 2; the family form's ruling 9 as it is). Multipart:
 * `questionId`, `file`. Throttled first; the token's deal only, while its offer takes the form; the question must be a
 * live FILE question of THIS club's sponsorship form; up to 8 MB, the type read from its bytes; stored WAITING (it joins
 * the deal inside the send, mig 526, or is swept within a day). The answer names the file only by its id.
 */
export const POST = withObservability(async (req: Request, { params }: { params: Promise<{ token: string }> }) => {
  const throttled = throttleSignupFiles(req);
  if (throttled) return throttled;
  const { token } = await params;
  const at = await dealForLink(token);
  if ('failure' in at) return at.failure;
  const { org, deal } = at;
  if (!linkTakesForm(deal)) return NextResponse.json({ error: W.fileFailed, code: 'closed' }, { status: 409 });

  const declared = Number(req.headers.get('content-length') ?? 0);
  if (declared > FORM_LIMITS.fileBytes + 64 * 1024) return NextResponse.json({ error: W.fileTooBig(sizeLine(declared), false), code: 'too_big' }, { status: 413 });
  let form: FormData;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: W.fileFailed }, { status: 400 }); }
  const questionId = String(form.get('questionId') ?? '');
  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: W.fileFailed }, { status: 400 });
  if (file.size > FORM_LIMITS.fileBytes) return NextResponse.json({ error: W.fileTooBig(sizeLine(file.size), isPhoto(file)), code: 'too_big' }, { status: 413 });

  const { data: q, error: qErr } = isUuid(questionId)
    ? await supabaseAdmin.from('club_form_questions').select('id, form_id, club_forms!inner(owner_id)').eq('id', questionId).eq('question_type', 'file')
      .is('archived_at', null).eq('club_forms.owner_table', 'organizations').eq('club_forms.owner_id', org.id).maybeSingle()
    : { data: null, error: null };
  if (qErr) throw qErr;
  if (!q) return NextResponse.json({ error: 'The club changed this question. Reload the page.', code: 'question_gone' }, { status: 409 });
  const row = q as { id: string; form_id: string };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const checked = checkDocumentUpload(bytes, file.name || 'file', FAMILY_FILE_KINDS);
  if (!checked) return NextResponse.json({ error: W.fileWrongType, code: 'type' }, { status: 415 });
  try {
    const stored = await storeFamilyFile({ orgId: org.id, formId: row.form_id, questionId: row.id, bytes, ...checked });
    await sweepWaitingFiles({ limit: 20 }).catch(e => console.error('[sponsorship-link] backstop sweep failed:', (e as { code?: string })?.code ?? 'no code'));
    return NextResponse.json({ id: stored.id, name: stored.name, size: stored.size }, { status: 201 });
  } catch (e) {
    // Never the error object: a storage error can echo the file's name, which the business typed.
    console.error('[sponsorship-link] storing a business file failed:', (e as { code?: string })?.code ?? 'no code');
    return NextResponse.json({ error: W.fileFailed }, { status: 500 });
  }
}, { route: '/api/public/sponsorship/[token]/files' });
