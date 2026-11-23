import { withObservability } from '@/lib/observability';
import { requireSponsorships } from '@/lib/club-sponsorships-auth';
import { ensureSponsorshipForm } from '@/lib/club-form-server';
import { addDocument } from '@/lib/club-form-editor';

/** ADD A DOCUMENT to the club's sponsorship form (Board Ready Stage 6, ask 8). Never behind a plan gate (Stage 4). */
export const dynamic = 'force-dynamic';

export const POST = withObservability(async (req: Request) => {
  const gate = await requireSponsorships(req);
  if ('failure' in gate) return gate.failure;
  const formId = await ensureSponsorshipForm(gate.ctx.org.id);
  return addDocument(gate.ctx, formId, req);
}, { route: '/api/admin/sponsorships/form/documents' });
