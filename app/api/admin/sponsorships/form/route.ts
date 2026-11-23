import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { requireSponsorships } from '@/lib/club-sponsorships-auth';
import { ensureSponsorshipForm, readForm } from '@/lib/club-form-server';
import { badRequest, questionsOnPlan, questionsPlanRefusal } from '@/lib/club-form-route';
import { reorderForm } from '@/lib/club-form-editor';

/**
 * THE CLUB'S SPONSORSHIP FORM (Board Ready Stage 6, Part 1; ask 8): Setup › Sponsorship form, Stage 4's editor with no
 * "for each child" groups and no Health switch. One per club, made on first need (mig 525). Anyone who opens Sponsorships
 * reads and changes it (round 2 tab 3). The business fields it starts with are fixed in the product, not rows here.
 *   GET   the form with COUNTS only, and whether the plan carries the club's own questions.
 *   POST  { action: 'reorder', kind, ids }.
 */
export const dynamic = 'force-dynamic';

export const GET = withObservability(async (req: Request) => {
  const gate = await requireSponsorships(req);
  if ('failure' in gate) return gate.failure;
  const formId = await ensureSponsorshipForm(gate.ctx.org.id);
  const form = await readForm(formId);
  return NextResponse.json({ form, canEdit: true, questionsOnPlan: questionsOnPlan(gate.ctx), clubName: gate.ctx.org.name });
}, { route: '/api/admin/sponsorships/form' });

export const POST = withObservability(async (req: Request) => {
  const gate = await requireSponsorships(req);
  if ('failure' in gate) return gate.failure;
  const formId = await ensureSponsorshipForm(gate.ctx.org.id);
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return badRequest('Invalid request body');
  if (body.action === 'reorder') return reorderForm(formId, body, () => questionsPlanRefusal(gate.ctx));
  return badRequest('Unknown action');
}, { route: '/api/admin/sponsorships/form' });
