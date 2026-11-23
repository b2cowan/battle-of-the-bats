import { NextResponse } from 'next/server';
import { houseLeagueAccess } from '@/lib/house-league-access';
import { withObservability } from '@/lib/observability';
import { friendMaxFor } from '@/lib/league-friends';
import { copyForm, ensureSeasonForm, formIsEmpty, latestFormToCopy, readForm, seasonSignupCounts } from '@/lib/club-form-server';
import { reorderForm } from '@/lib/club-form-editor';
import { badRequest, questionsOnPlan, questionsPlanRefusal, formAuth, seasonNotFound, seasonOf, serverError } from '@/lib/club-form-route';
import { houseLeagueRefusal } from '@/lib/house-league-gate';
import { FORM_WORDS as W } from '@/lib/club-form-words';

export const dynamic = 'force-dynamic';

/**
 * A SEASON'S SIGN-UP FORM (Board Ready Stage 4 Part 1; drawing tabs 1–4, 9).
 *
 *   GET   the form page's whole read: questions and documents with COUNTS (never an answer or a family), what the locked
 *         card lists, how many sign-ups a new question would miss, whether this person may change it, whether the plan
 *         carries the club's own questions, and the season an empty form can copy from.
 *   POST  { action: 'reorder', kind: 'questions' | 'documents', ids } — each move saves; the order is the one sent.
 *         { action: 'copy', fromSeasonId } — an empty form takes another season's questions and documents, never answers.
 */
export const GET = withObservability(async (req: Request, { params }: { params: Promise<{ seasonId: string }> }) => {
  const ctx = await formAuth(req);
  const err = houseLeagueRefusal(ctx, 'read');
  if (err || !ctx) return err!;
  const season = await seasonOf(params, ctx);
  if (!season) return seasonNotFound();
  const refused = houseLeagueRefusal(ctx, 'read', season);
  if (refused) return refused;
  const formId = await ensureSeasonForm(season.id);
  const [form, counts] = await Promise.all([readForm(formId), seasonSignupCounts(season.id)]);
  const access = houseLeagueAccess(ctx, ctx.org, season);
  const empty = formIsEmpty(form);
  const copyFrom = empty && access.run ? await latestFormToCopy(ctx.org.id, season.id) : null;
  return NextResponse.json({
    form,
    counts,
    canEdit: access.run,
    finished: access.finished,
    questionsOnPlan: questionsOnPlan(ctx),
    fixed: { friendMax: friendMaxFor(ctx.org.planId, season.friendRequestsMax), askEmailConsent: season.askEmailConsent, clubName: ctx.org.name },
    season: { id: season.id, name: season.name },
    copyFrom: copyFrom ? { seasonId: copyFrom.seasonId, name: copyFrom.name, questions: copyFrom.questions, documents: copyFrom.documents } : null,
  });
}, { route: '/api/admin/house-league/seasons/[seasonId]/form' });

export const POST = withObservability(async (req: Request, { params }: { params: Promise<{ seasonId: string }> }) => {
  const ctx = await formAuth(req);
  const err = houseLeagueRefusal(ctx, 'run');
  if (err || !ctx) return err!;
  const season = await seasonOf(params, ctx);
  if (!season) return seasonNotFound();
  const refused = houseLeagueRefusal(ctx, 'run', season);
  if (refused) return refused;
  const formId = await ensureSeasonForm(season.id);
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return badRequest('Invalid request body');

  if (body.action === 'reorder') return reorderForm(formId, body, () => questionsPlanRefusal(ctx));

  if (body.action === 'copy') {
    const fromSeasonId = typeof body.fromSeasonId === 'string' ? body.fromSeasonId : '';
    const current = await readForm(formId);
    // Only an empty form copies (drawing tab 4): a form with its own questions or documents is the club's to build.
    if (!formIsEmpty(current)) {
      return NextResponse.json({ error: 'This season’s form already has questions or documents.' }, { status: 409 });
    }
    const source = await latestFormToCopy(ctx.org.id, season.id);
    if (!source || source.seasonId !== fromSeasonId) return NextResponse.json({ error: 'There’s no earlier form to copy.' }, { status: 404 });
    try {
      // Without the club's own questions on the plan, only the documents come across (documents are on every plan).
      const added = await copyForm({ orgId: ctx.org.id, fromFormId: source.formId, toFormId: formId, userId: ctx.user.id, questions: questionsOnPlan(ctx) });
      return NextResponse.json({ ok: true, added });
    } catch (e) {
      console.error('[club-form] copy failed:', (e as { code?: string })?.code ?? 'no code');
      return serverError(W.copyFailed);
    }
  }

  return badRequest('Unknown action');
}, { route: '/api/admin/house-league/seasons/[seasonId]/form' });
