import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { readQuestionInput } from '@/lib/club-form';
import { badRequest, questionsPlanRefusal, formAuth, seasonNotFound, seasonOf, serverError } from '@/lib/club-form-route';
import { ensureSeasonForm } from '@/lib/club-form-server';
import { houseLeagueRefusal } from '@/lib/house-league-gate';
import { FORM_WORDS as W } from '@/lib/club-form-words';

export const dynamic = 'force-dynamic';

/**
 * ADD A QUESTION (Board Ready Stage 4 Part 1; drawing tab 2). The people who set up a season, while it is live, on a plan
 * with the club's own questions. New questions are optional; a file question is never required and a health question is
 * never on the draft board (lib/club-form.ts `settledQuestion`). It joins the end of the list.
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
  const plan = questionsPlanRefusal(ctx);
  if (plan) return plan;
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return badRequest('Invalid request body');
  const read = readQuestionInput(body, null, randomUUID, { perSubject: true, healthSwitch: true });
  if ('error' in read) return badRequest(read.error);

  const { data: last } = await supabaseAdmin.from('club_form_questions').select('sort_order')
    .eq('form_id', formId).order('sort_order', { ascending: false }).limit(1);
  const sortOrder = ((last ?? [])[0] as { sort_order: number } | undefined)?.sort_order ?? -1;
  const { data, error } = await supabaseAdmin.from('club_form_questions').insert({
    ...read.write, org_id: ctx.org.id, form_id: formId, sort_order: sortOrder + 1, created_by: ctx.user.id,
  }).select('id').single();
  if (error) return serverError(W.addFailed);
  return NextResponse.json({ id: (data as { id: string }).id }, { status: 201 });
}, { route: '/api/admin/house-league/seasons/[seasonId]/form/questions' });
