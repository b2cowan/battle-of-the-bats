import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { FORM_LIMITS, isTicked, type TickKind } from '@/lib/club-form';
import { ensureSeasonForm, readDocument } from '@/lib/club-form-server';
import { badRequest, conflict, formAuth, seasonNotFound, seasonOf, serverError } from '@/lib/club-form-route';
import { houseLeagueRefusal } from '@/lib/house-league-gate';
import { FORM_WORDS as W } from '@/lib/club-form-words';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ seasonId: string; documentId: string }> };

/**
 * ONE DOCUMENT (Board Ready Stage 4 Part 1; drawing tab 3). The record's autosave (name, the tick) or { archived: true }.
 * A document is never deleted: an archived one leaves the sign-up page and its ticks stay on each registration. The tick's
 * words lock once anyone has ticked (each tick keeps the sentence it was given; changing what families agree to is a new
 * version, not an edit). The words families read change only through Replace (`./versions`).
 */
export const PATCH = withObservability(async (req: Request, { params }: Params) => {
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
  const ticked = isTicked(doc);
  if (tickKind !== doc.tickKind && ticked) return conflict('Families have ticked it, so its tick stays as it is.');
  const { error } = await supabaseAdmin.from('club_form_documents').update({ name, tick_kind: tickKind, updated_at: at })
    .eq('id', documentId).eq('form_id', formId);
  if (error) return serverError(W.saveFailed);
  return NextResponse.json({ ok: true });
}, { route: '/api/admin/house-league/seasons/[seasonId]/form/documents/[documentId]' });
