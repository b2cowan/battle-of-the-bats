import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { canDeleteQuestion, readQuestionInput } from '@/lib/club-form';
import { CLUB_FORM_BUCKET, ensureSeasonForm, readQuestion } from '@/lib/club-form-server';
import { badRequest, conflict, questionsPlanRefusal, formAuth, seasonNotFound, seasonOf, serverError } from '@/lib/club-form-route';
import { houseLeagueRefusal } from '@/lib/house-league-gate';
import { FORM_WORDS as W } from '@/lib/club-form-words';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ seasonId: string; questionId: string }> };

/**
 * ONE QUESTION (Board Ready Stage 4 Part 1; drawing tabs 2 and 7; ruling 7).
 *
 *   PATCH   the record's autosave (any field), or { archived: true } — Archive keeps every answer under "No longer asked".
 *           Type and "Asked" are refused once anyone has answered; a renamed choice renames its answers (ids); a removed
 *           choice stays on the answers that chose it.
 *   DELETE  only while nobody has answered it (the database refuses otherwise: answers have no cascade).
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
  const plan = questionsPlanRefusal(ctx);
  if (plan) return plan;
  const { questionId } = await params;
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

  const read = readQuestionInput(body, existing, randomUUID, { perSubject: true, healthSwitch: true });
  if ('error' in read) return badRequest(read.error);
  const { error } = await supabaseAdmin.from('club_form_questions').update({ ...read.write, updated_at: at })
    .eq('id', questionId).eq('form_id', formId);
  if (error) return serverError(W.saveFailed);
  return NextResponse.json({ ok: true });
}, { route: '/api/admin/house-league/seasons/[seasonId]/form/questions/[questionId]' });

export const DELETE = withObservability(async (req: Request, { params }: Params) => {
  const ctx = await formAuth(req);
  const err = houseLeagueRefusal(ctx, 'run');
  if (err || !ctx) return err!;
  const season = await seasonOf(params, ctx);
  if (!season) return seasonNotFound();
  const refused = houseLeagueRefusal(ctx, 'run', season);
  if (refused) return refused;
  const formId = await ensureSeasonForm(season.id);
  const plan = questionsPlanRefusal(ctx);
  if (plan) return plan;
  const { questionId } = await params;
  const existing = await readQuestion(formId, questionId);
  if (!existing) return NextResponse.json({ error: 'Question not found' }, { status: 404 });
  if (!canDeleteQuestion(existing)) return conflict('People have answered it, so it can only be archived.');
  // A file a family chose but never sent (Part 2) holds the question; it goes with it, stored file first.
  const { data: pending } = await supabaseAdmin.from('club_form_files').select('id, path').eq('question_id', questionId).eq('status', 'pending');
  const paths = ((pending ?? []) as { path: string }[]).map(f => f.path);
  if (paths.length) {
    await supabaseAdmin.storage.from(CLUB_FORM_BUCKET).remove(paths);
    await supabaseAdmin.from('club_form_files').delete().in('path', paths);
  }
  const { error } = await supabaseAdmin.from('club_form_questions').delete().eq('id', questionId).eq('form_id', formId);
  // 23503: an answer arrived between the count and the delete; the database kept the question.
  if (error) return error.code === '23503' ? conflict('People have answered it, so it can only be archived.') : serverError(W.deleteFailed);
  return NextResponse.json({ ok: true });
}, { route: '/api/admin/house-league/seasons/[seasonId]/form/questions/[questionId]' });
