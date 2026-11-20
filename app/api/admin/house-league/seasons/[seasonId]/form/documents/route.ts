import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { FORM_LIMITS, type TickKind } from '@/lib/club-form';
import { CLUB_FORM_BUCKET, documentPath, ensureSeasonForm, fingerprintOf } from '@/lib/club-form-server';
import { badRequest, readDocumentUpload, formAuth, seasonNotFound, seasonOf, serverError } from '@/lib/club-form-route';
import { houseLeagueRefusal } from '@/lib/house-league-gate';
import { FORM_WORDS as W } from '@/lib/club-form-words';

export const dynamic = 'force-dynamic';

/**
 * ADD A DOCUMENT (Board Ready Stage 4 Part 1; drawing tab 3; rulings 2 and 8). A PDF (multipart, checked from its bytes,
 * up to 8 MB) or typed text (JSON). Its words are version 1. NEVER behind a plan gate (documents and their ticks are on
 * every plan). Every document is required; it has no Required switch.
 */
export const POST = withObservability(async (req: Request, { params }: { params: Promise<{ seasonId: string }> }) => {
  const ctx = await formAuth(req);
  const err = houseLeagueRefusal(ctx, 'run');
  if (err || !ctx) return err!;
  const season = await seasonOf(params, ctx);
  if (!season) return seasonNotFound();
  const refused = houseLeagueRefusal(ctx, 'run', season);
  if (refused) return refused;
  const formId = await ensureSeasonForm(season.id);
  const read = await readDocumentUpload(req);
  if ('error' in read) return NextResponse.json({ error: read.error }, { status: read.status });
  const { fields } = read;
  // A file rides only with a PDF document (a typed one never stores one).
  const pdf = fields.source === 'pdf' ? read.pdf : null;

  const name = (fields.name ?? '').trim();
  if (!name) return badRequest(W.docHeldName);
  if (name.length > FORM_LIMITS.docName) return badRequest(`Keep the name under ${FORM_LIMITS.docName} characters.`);
  const source = fields.source === 'pdf' ? 'pdf' : fields.source === 'text' ? 'text' : null;
  if (!source) return badRequest('Choose what families read.');
  const tickKind: TickKind = fields.tickKind === 'read_agree' ? 'read_agree' : 'read';
  const text = (fields.text ?? '').trim();
  if (source === 'text' && !text) return badRequest(W.docHeldText);
  if (source === 'text' && text.length > FORM_LIMITS.docText) return badRequest(`Keep the text under ${FORM_LIMITS.docText.toLocaleString('en-CA')} characters.`);
  if (source === 'pdf' && !pdf) return badRequest(W.docHeldFile);

  const { data: last } = await supabaseAdmin.from('club_form_documents').select('sort_order')
    .eq('form_id', formId).order('sort_order', { ascending: false }).limit(1);
  const sortOrder = (((last ?? [])[0] as { sort_order: number } | undefined)?.sort_order ?? -1) + 1;
  const { data: doc, error } = await supabaseAdmin.from('club_form_documents').insert({
    org_id: ctx.org.id, form_id: formId, name, source_kind: source, tick_kind: tickKind, sort_order: sortOrder, created_by: ctx.user.id,
  }).select('id').single();
  if (error) return serverError(W.addFailed);
  const docId = (doc as { id: string }).id;

  let path: string | null = null;
  if (pdf) {
    path = documentPath(ctx.org.id, formId, docId);
    const up = await supabaseAdmin.storage.from(CLUB_FORM_BUCKET).upload(path, pdf.bytes, { contentType: 'application/pdf' });
    if (up.error) {
      await supabaseAdmin.from('club_form_documents').delete().eq('id', docId);
      return serverError(W.addFailed);
    }
  }
  const { error: vErr } = await supabaseAdmin.from('club_form_document_versions').insert({
    org_id: ctx.org.id, document_id: docId, version_no: 1,
    body_text: pdf ? null : text, file_path: path, file_name: pdf?.displayName ?? null, file_size: pdf?.size ?? null,
    fingerprint: fingerprintOf(pdf ? pdf.bytes : text), created_by: ctx.user.id,
  });
  if (vErr) {
    if (path) await supabaseAdmin.storage.from(CLUB_FORM_BUCKET).remove([path]);
    await supabaseAdmin.from('club_form_documents').delete().eq('id', docId);
    return serverError(W.addFailed);
  }
  return NextResponse.json({ id: docId }, { status: 201 });
}, { route: '/api/admin/house-league/seasons/[seasonId]/form/documents' });
