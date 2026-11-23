import { withObservability } from '@/lib/observability';
import { requireSponsorships } from '@/lib/club-sponsorships-auth';
import { ensureSponsorshipForm } from '@/lib/club-form-server';
import { openDocumentFile } from '@/lib/club-form-editor';

/** A sponsorship form document's PDF, for the club: a link signed for one hour (Board Ready Stage 6, ask 8). */
export const dynamic = 'force-dynamic';

export const GET = withObservability(async (req: Request, { params }: { params: Promise<{ documentId: string }> }) => {
  const gate = await requireSponsorships(req);
  if ('failure' in gate) return gate.failure;
  const formId = await ensureSponsorshipForm(gate.ctx.org.id);
  const { documentId } = await params;
  return openDocumentFile(formId, documentId, req);
}, { route: '/api/admin/sponsorships/form/documents/[documentId]/file' });
