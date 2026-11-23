import { withObservability } from '@/lib/observability';
import { requireSponsorships } from '@/lib/club-sponsorships-auth';
import { ensureSponsorshipForm } from '@/lib/club-form-server';
import { questionsPlanRefusal } from '@/lib/club-form-route';
import { deleteQuestion, patchQuestion } from '@/lib/club-form-editor';
import { BUSINESS_FORM_SHAPE } from '@/lib/club-form';

/** ONE QUESTION of the club's sponsorship form (Board Ready Stage 6, ask 8): PATCH the autosave or archive; DELETE while unanswered. */
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ questionId: string }> };

export const PATCH = withObservability(async (req: Request, { params }: Params) => {
  const gate = await requireSponsorships(req);
  if ('failure' in gate) return gate.failure;
  const formId = await ensureSponsorshipForm(gate.ctx.org.id);
  const plan = questionsPlanRefusal(gate.ctx);
  if (plan) return plan;
  const { questionId } = await params;
  return patchQuestion(formId, questionId, req, BUSINESS_FORM_SHAPE);
}, { route: '/api/admin/sponsorships/form/questions/[questionId]' });

export const DELETE = withObservability(async (req: Request, { params }: Params) => {
  const gate = await requireSponsorships(req);
  if ('failure' in gate) return gate.failure;
  const formId = await ensureSponsorshipForm(gate.ctx.org.id);
  const plan = questionsPlanRefusal(gate.ctx);
  if (plan) return plan;
  const { questionId } = await params;
  return deleteQuestion(formId, questionId);
}, { route: '/api/admin/sponsorships/form/questions/[questionId]' });
