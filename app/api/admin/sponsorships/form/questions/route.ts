import { withObservability } from '@/lib/observability';
import { requireSponsorships } from '@/lib/club-sponsorships-auth';
import { ensureSponsorshipForm } from '@/lib/club-form-server';
import { questionsPlanRefusal } from '@/lib/club-form-route';
import { addQuestion } from '@/lib/club-form-editor';
import { BUSINESS_FORM_SHAPE } from '@/lib/club-form';

/** ADD A QUESTION to the club's sponsorship form (Board Ready Stage 6, ask 8): asked once, never health, never on a board. */
export const dynamic = 'force-dynamic';

export const POST = withObservability(async (req: Request) => {
  const gate = await requireSponsorships(req);
  if ('failure' in gate) return gate.failure;
  const formId = await ensureSponsorshipForm(gate.ctx.org.id);
  const plan = questionsPlanRefusal(gate.ctx);
  if (plan) return plan;
  return addQuestion(gate.ctx, formId, req, BUSINESS_FORM_SHAPE);
}, { route: '/api/admin/sponsorships/form/questions' });
