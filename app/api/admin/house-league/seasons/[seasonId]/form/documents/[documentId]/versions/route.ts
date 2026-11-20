import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { FORM_LIMITS, currentVersion } from '@/lib/club-form';
import { CLUB_FORM_BUCKET, documentPath, ensureSeasonForm, fingerprintOf, readDocument } from '@/lib/club-form-server';
import { badRequest, conflict, readDocumentUpload, formAuth, seasonNotFound, seasonOf, serverError } from '@/lib/club-form-route';
import { houseLeagueRefusal } from '@/lib/house-league-gate';
import { FORM_WORDS as W } from '@/lib/club-form-words';

export const dynamic = 'force-dynamic';

/**
 * REPLACE WITH A NEW VERSION (Board Ready Stage 4 Part 1; drawing tab 3; ruling 8). The new words (a PDF of the same kind,
 * or the typed text) become the next version; every earlier version and its ticks are kept. The club says what it means for
 * families who ticked the one before: "Their tick stands" (`ticksStand: true`) or "They must tick again" (`false`, with a
 * reason families see). Tick-again sign-ups read "Needs a new tick" (Part 3); places aren't affected; nobody is emailed.
 */
export const POST = withObservability(async (req: Request, { params }: { params: Promise<{ seasonId: string; documentId: string }> }) => {
  const ctx = await formAuth(req);
  const err = houseLeagueRefusal(ctx, 'run');
  if (err || !ctx) return err!;
  const season = await seasonOf(params, ctx);
  if (!season) return seasonNotFound();
  const refused = houseLeagueRefusal(ctx, 'run', season);
  if (refused) return refused;
  const formId = await ensureSeasonForm(season.id);
  const { documentId } = await params;
  const doc = await readDocument(formId, documentId);
  if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  if (doc.archivedAt) return conflict('This document is archived.');
  const current = currentVersion(doc);
  if (!current) return conflict('This document has no version to replace.');

  const read = await readDocumentUpload(req);
  if ('error' in read) return NextResponse.json({ error: read.error }, { status: read.status });
  const { fields } = read;
  // A file rides only with a PDF document (a typed one is replaced by its text).
  const pdf = doc.source === 'pdf' ? read.pdf : null;
  // The club answers for the version it saw, with the ticks on it now: a Replace opened before someone else replaced it,
  // or before families ticked, asks again rather than deciding for the club (/review 2026-11-20; ruling 8).
  if (fields.fromVersion !== String(current.versionNo)) return conflict('Someone replaced it a moment ago. Close it and open it again.');
  const asked = fields.ticksStand === 'true' || fields.ticksStand === 'false';
  const ticksBefore = current.ticks + (current.versionNo === 1 ? doc.movedTicks : 0);
  if (ticksBefore > 0 && !asked) return conflict('Families have ticked it since you opened this. Close it and open it again to say what their tick means.');
  const ticksStand = fields.ticksStand !== 'false';
  const reason = (fields.reason ?? '').trim() || null;
  if (!ticksStand && !reason) return badRequest(W.replaceReasonHeld);
  if (reason && reason.length > FORM_LIMITS.reason) return badRequest(`Keep it under ${FORM_LIMITS.reason} characters.`);

  let text: string | null = null;
  if (doc.source === 'pdf') {
    if (!pdf) return badRequest(W.docHeldFile);
  } else {
    text = (fields.text ?? '').trim();
    if (!text) return badRequest(W.docHeldText);
    if (text.length > FORM_LIMITS.docText) return badRequest(`Keep the text under ${FORM_LIMITS.docText.toLocaleString('en-CA')} characters.`);
  }
  const fingerprint = fingerprintOf(pdf ? pdf.bytes : text!);
  if (current.fingerprint === fingerprint) return badRequest(W.replaceSame);

  let path: string | null = null;
  if (pdf) {
    path = documentPath(ctx.org.id, formId, documentId);
    const up = await supabaseAdmin.storage.from(CLUB_FORM_BUCKET).upload(path, pdf.bytes, { contentType: 'application/pdf' });
    if (up.error) return serverError(W.replaceFailed);
  }
  const { error } = await supabaseAdmin.from('club_form_document_versions').insert({
    org_id: ctx.org.id, document_id: documentId, version_no: current.versionNo + 1,
    body_text: text, file_path: path, file_name: pdf?.displayName ?? null, file_size: pdf?.size ?? null,
    fingerprint, reason, ticks_stand: ticksStand, created_by: ctx.user.id,
  });
  if (error) {
    if (path) await supabaseAdmin.storage.from(CLUB_FORM_BUCKET).remove([path]);
    // 23505: someone else replaced it a moment ago; their version stands.
    return error.code === '23505' ? conflict('Someone replaced it a moment ago. Close it and open it again.') : serverError(W.replaceFailed);
  }
  await supabaseAdmin.from('club_form_documents').update({ updated_at: new Date().toISOString() }).eq('id', documentId);
  return NextResponse.json({ ok: true }, { status: 201 });
}, { route: '/api/admin/house-league/seasons/[seasonId]/form/documents/[documentId]/versions' });
