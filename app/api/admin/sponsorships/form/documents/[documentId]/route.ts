import { withObservability } from '@/lib/observability';
import { requireSponsorships } from '@/lib/club-sponsorships-auth';
import { ensureSponsorshipForm } from '@/lib/club-form-server';
import { patchDocument } from '@/lib/club-form-editor';

/** ONE DOCUMENT of the club's sponsorship form (Board Ready Stage 6, ask 8): its autosave or archive. */
export const dynamic = 'force-dynamic';

export const PATCH = withObservability(async (req: Request, { params }: { params: Promise<{ documentId: string }> }) => {
  const gate = await requireSponsorships(req);
  if ('failure' in gate) return gate.failure;
  const formId = await ensureSponsorshipForm(gate.ctx.org.id);
  const { documentId } = await params;
  return patchDocument(formId, documentId, req);
}, { route: '/api/admin/sponsorships/form/documents/[documentId]' });
