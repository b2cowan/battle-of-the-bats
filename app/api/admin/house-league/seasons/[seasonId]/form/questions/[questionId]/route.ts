import { withObservability } from '@/lib/observability';
import { SEASON_FORM_SHAPE } from '@/lib/club-form';
import { ensureSeasonForm } from '@/lib/club-form-server';
import { deleteQuestion, patchQuestion } from '@/lib/club-form-editor';
import { questionsPlanRefusal, formAuth, seasonNotFound, seasonOf } from '@/lib/club-form-route';
import { houseLeagueRefusal } from '@/lib/house-league-gate';

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
  return patchQuestion(formId, questionId, req, SEASON_FORM_SHAPE);
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
  return deleteQuestion(formId, questionId);
}, { route: '/api/admin/house-league/seasons/[seasonId]/form/questions/[questionId]' });
