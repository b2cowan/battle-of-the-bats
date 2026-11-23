import { withObservability } from '@/lib/observability';
import { SEASON_FORM_SHAPE } from '@/lib/club-form';
import { addQuestion } from '@/lib/club-form-editor';
import { questionsPlanRefusal, formAuth, seasonNotFound, seasonOf } from '@/lib/club-form-route';
import { ensureSeasonForm } from '@/lib/club-form-server';
import { houseLeagueRefusal } from '@/lib/house-league-gate';

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
  return addQuestion(ctx, formId, req, SEASON_FORM_SHAPE);
}, { route: '/api/admin/house-league/seasons/[seasonId]/form/questions' });
