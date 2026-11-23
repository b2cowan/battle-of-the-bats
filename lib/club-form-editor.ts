import 'server-only';
/**
 * A CLUB FORM'S EDITOR WRITES — the one body each editor route runs once its own gate has passed (Board Ready Stage 6,
 * Part 1: lifted from the season form's routes, Stage 4 Part 1, so the club's sponsorship form edits through the same
 * code). Every function takes the form id its route resolved and the form's SHAPE, and returns the response. The gates
 * stay in the routes: the season's (`houseLeagueRefusal`, read in the route body by the house-league gate guard) and
 * Sponsorships' (`requireSponsorships`). Nothing here reads who is asking beyond the org and the user it is given.
 */
import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { supabaseAdmin } from './supabase-admin';
import { isUuid } from './utils';
import { canDeleteQuestion, currentVersion, FORM_LIMITS, isTicked, readQuestionInput, type FormShape, type TickKind } from './club-form';
import { CLUB_FORM_BUCKET, documentPath, fingerprintOf, readDocument, readQuestion, readVersionRow } from './club-form-server';
import { badRequest, conflict, readDocumentUpload, serverError } from './club-form-route';
import { FORM_WORDS as W } from './club-form-words';

type Who = { org: { id: string }; user: { id: string } };

/** `{ action: 'reorder', kind, ids }` — the order sent, in one statement (mig 513 `club_form_reorder`). */
export async function reorderForm(formId: string, body: Record<string, unknown>, questionsRefusal: () => Response | null): Promise<Response> {
  const kind = body.kind;
  const ids = body.ids;
  // Every id once, each a real id (a duplicate would take an arbitrary place; a malformed one is a 400, never a 500).
  if ((kind !== 'questions' && kind !== 'documents') || !Array.isArray(ids) || ids.length > 200
    || ids.some(i => !isUuid(i)) || new Set(ids).size !== ids.length) {
    return badRequest('Invalid order');
  }
  if (kind === 'questions') { const plan = questionsRefusal(); if (plan) return plan; }
  const table = kind === 'questions' ? 'club_form_questions' : 'club_form_documents';
  const { data: rows, error } = await supabaseAdmin.from(table).select('id').eq('form_id', formId).in('id', ids as string[]);
  if (error) return serverError(W.orderFailed);
  if ((rows ?? []).length !== new Set(ids as string[]).size) return badRequest('Invalid order');
  const { error: moveErr } = await supabaseAdmin.rpc('club_form_reorder', { p_form: formId, p_kind: kind, p_ids: ids });
  if (moveErr) return serverError(W.orderFailed);
  return NextResponse.json({ ok: true });
}

/** Add a question at the end. New questions are optional; the shape decides Asked, Health and the draft board. */
export async function addQuestion(who: Who, formId: string, req: Request, shape: FormShape): Promise<Response> {
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return badRequest('Invalid request body');
  const read = readQuestionInput(body, null, randomUUID, shape);
  if ('error' in read) return badRequest(read.error);
  const { data: last } = await supabaseAdmin.from('club_form_questions').select('sort_order')
    .eq('form_id', formId).order('sort_order', { ascending: false }).limit(1);
  const sortOrder = ((last ?? [])[0] as { sort_order: number } | undefined)?.sort_order ?? -1;
  const { data, error } = await supabaseAdmin.from('club_form_questions').insert({
    ...read.write, org_id: who.org.id, form_id: formId, sort_order: sortOrder + 1, created_by: who.user.id,
  }).select('id').single();
  if (error) return serverError(W.addFailed);
  return NextResponse.json({ id: (data as { id: string }).id }, { status: 201 });
}

/** The question record's autosave (any field), or `{ archived: true }` (its answers stay under "No longer asked"). */
export async function patchQuestion(formId: string, questionId: string, req: Request, shape: FormShape): Promise<Response> {
  const existing = await readQuestion(formId, questionId);
  if (!existing) return NextResponse.json({ error: 'Question not found' }, { status: 404 });
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return badRequest('Invalid request body');
  const at = new Date().toISOString();
  if (body.archived === true) {
    const { error } = await supabaseAdmin.from('club_form_questions').update({ archived_at: existing.archivedAt ?? at, updated_at: at })
      .eq('id', questionId).eq('form_id', formId);
    if (error) return serverError(W.archiveFailed);
    return NextResponse.json({ ok: true });
  }
  if (existing.archivedAt) return conflict('This question is archived.');
  const read = readQuestionInput(body, existing, randomUUID, shape);
  if ('error' in read) return badRequest(read.error);
  const { error } = await supabaseAdmin.from('club_form_questions').update({ ...read.write, updated_at: at })
    .eq('id', questionId).eq('form_id', formId);
  if (error) return serverError(W.saveFailed);
  return NextResponse.json({ ok: true });
}

/** Delete a question nobody has answered (the database refuses otherwise: answers have no cascade). */
export async function deleteQuestion(formId: string, questionId: string): Promise<Response> {
  const existing = await readQuestion(formId, questionId);
  if (!existing) return NextResponse.json({ error: 'Question not found' }, { status: 404 });
  if (!canDeleteQuestion(existing)) return conflict('People have answered it, so it can only be archived.');
  // A file someone chose but never sent, and the record of one replaced or removed, hold the question; they go with it,
  // stored file first, by status (a file attached in the meantime is neither deleted nor stripped of its stored file).
  const { data: dropped } = await supabaseAdmin.from('club_form_files').delete().eq('question_id', questionId).in('status', ['pending', 'removed']).select('path');
  const paths = ((dropped ?? []) as { path: string }[]).map(f => f.path);
  if (paths.length) await supabaseAdmin.storage.from(CLUB_FORM_BUCKET).remove(paths);
  const { error } = await supabaseAdmin.from('club_form_questions').delete().eq('id', questionId).eq('form_id', formId);
  // 23503: an answer arrived between the count and the delete; the database kept the question.
  if (error) return error.code === '23503' ? conflict('People have answered it, so it can only be archived.') : serverError(W.deleteFailed);
  return NextResponse.json({ ok: true });
}

/** Add a document: a PDF (multipart, checked from its bytes, up to 8 MB) or typed text. Its words are version 1. */
export async function addDocument(who: Who, formId: string, req: Request): Promise<Response> {
  const read = await readDocumentUpload(req);
  if ('error' in read) return NextResponse.json({ error: read.error }, { status: read.status });
  const { fields } = read;
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
    org_id: who.org.id, form_id: formId, name, source_kind: source, tick_kind: tickKind, sort_order: sortOrder, created_by: who.user.id,
  }).select('id').single();
  if (error) return serverError(W.addFailed);
  const docId = (doc as { id: string }).id;
  let path: string | null = null;
  if (pdf) {
    path = documentPath(who.org.id, formId, docId);
    const up = await supabaseAdmin.storage.from(CLUB_FORM_BUCKET).upload(path, pdf.bytes, { contentType: 'application/pdf' });
    if (up.error) {
      await supabaseAdmin.from('club_form_documents').delete().eq('id', docId);
      return serverError(W.addFailed);
    }
  }
  const { error: vErr } = await supabaseAdmin.from('club_form_document_versions').insert({
    org_id: who.org.id, document_id: docId, version_no: 1,
    body_text: pdf ? null : text, file_path: path, file_name: pdf?.displayName ?? null, file_size: pdf?.size ?? null,
    fingerprint: fingerprintOf(pdf ? pdf.bytes : text), created_by: who.user.id,
  });
  if (vErr) {
    if (path) await supabaseAdmin.storage.from(CLUB_FORM_BUCKET).remove([path]);
    await supabaseAdmin.from('club_form_documents').delete().eq('id', docId);
    return serverError(W.addFailed);
  }
  return NextResponse.json({ id: docId }, { status: 201 });
}

/** The document record's autosave (name, the tick) or `{ archived: true }`. The tick's words lock once anyone has ticked. */
export async function patchDocument(formId: string, documentId: string, req: Request): Promise<Response> {
  const doc = await readDocument(formId, documentId);
  if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return badRequest('Invalid request body');
  const at = new Date().toISOString();
  if (body.archived === true) {
    const { error } = await supabaseAdmin.from('club_form_documents').update({ archived_at: doc.archivedAt ?? at, updated_at: at })
      .eq('id', documentId).eq('form_id', formId);
    if (error) return serverError(W.docArchiveFailed);
    return NextResponse.json({ ok: true });
  }
  if (doc.archivedAt) return conflict('This document is archived.');
  const name = 'name' in body ? (typeof body.name === 'string' ? body.name.trim() : '') : doc.name;
  if (!name) return badRequest(W.docHeldName);
  if (name.length > FORM_LIMITS.docName) return badRequest(`Keep the name under ${FORM_LIMITS.docName} characters.`);
  const tickKind: TickKind = 'tickKind' in body ? (body.tickKind === 'read_agree' ? 'read_agree' : 'read') : doc.tickKind;
  if (tickKind !== doc.tickKind && isTicked(doc)) return conflict('Families have ticked it, so its tick stays as it is.');
  const { error } = await supabaseAdmin.from('club_form_documents').update({ name, tick_kind: tickKind, updated_at: at })
    .eq('id', documentId).eq('form_id', formId);
  if (error) return serverError(W.saveFailed);
  return NextResponse.json({ ok: true });
}

/** Replace with a new version; every earlier version and its ticks are kept (ruling 8). */
export async function addDocumentVersion(who: Who, formId: string, documentId: string, req: Request): Promise<Response> {
  const doc = await readDocument(formId, documentId);
  if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  if (doc.archivedAt) return conflict('This document is archived.');
  const current = currentVersion(doc);
  if (!current) return conflict('This document has no version to replace.');
  const read = await readDocumentUpload(req);
  if ('error' in read) return NextResponse.json({ error: read.error }, { status: read.status });
  const { fields } = read;
  const pdf = doc.source === 'pdf' ? read.pdf : null;
  // The club answers for the version it saw, with the ticks on it now (/review 2026-11-20; ruling 8).
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
    path = documentPath(who.org.id, formId, documentId);
    const up = await supabaseAdmin.storage.from(CLUB_FORM_BUCKET).upload(path, pdf.bytes, { contentType: 'application/pdf' });
    if (up.error) return serverError(W.replaceFailed);
  }
  const { error } = await supabaseAdmin.from('club_form_document_versions').insert({
    org_id: who.org.id, document_id: documentId, version_no: current.versionNo + 1,
    body_text: text, file_path: path, file_name: pdf?.displayName ?? null, file_size: pdf?.size ?? null,
    fingerprint, reason, ticks_stand: ticksStand, created_by: who.user.id,
  });
  if (error) {
    if (path) await supabaseAdmin.storage.from(CLUB_FORM_BUCKET).remove([path]);
    return error.code === '23505' ? conflict('Someone replaced it a moment ago. Close it and open it again.') : serverError(W.replaceFailed);
  }
  await supabaseAdmin.from('club_form_documents').update({ updated_at: new Date().toISOString() }).eq('id', documentId);
  return NextResponse.json({ ok: true }, { status: 201 });
}

/** A document's PDF for the club: the path from the version row, never the request; the link is signed for one hour. */
export async function openDocumentFile(formId: string, documentId: string, req: Request): Promise<Response> {
  const { data: doc } = await supabaseAdmin.from('club_form_documents').select('id').eq('id', documentId).eq('form_id', formId).maybeSingle();
  if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  const version = await readVersionRow(documentId, new URL(req.url).searchParams.get('version'));
  if (!version?.file_path) return NextResponse.json({ error: 'File not found' }, { status: 404 });
  const { data, error } = await supabaseAdmin.storage.from(CLUB_FORM_BUCKET).createSignedUrl(version.file_path, 3600);
  if (error || !data?.signedUrl) return NextResponse.json({ error: 'The file didn’t open. Try again.' }, { status: 500 });
  return new NextResponse(null, {
    status: 302,
    headers: { Location: data.signedUrl, 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' },
  });
}
