import { withObservability } from '@/lib/observability';
import { requireSponsorships } from '@/lib/club-sponsorships-auth';
import { ensureSponsorshipForm } from '@/lib/club-form-server';
import { addDocumentVersion } from '@/lib/club-form-editor';

/** REPLACE a sponsorship form document with a new version (Board Ready Stage 6, ask 8; Stage 4 ruling 8). */
export const dynamic = 'force-dynamic';

export const POST = withObservability(async (req: Request, { params }: { params: Promise<{ documentId: string }> }) => {
  const gate = await requireSponsorships(req);
  if ('failure' in gate) return gate.failure;
  const formId = await ensureSponsorshipForm(gate.ctx.org.id);
  const { documentId } = await params;
  return addDocumentVersion(gate.ctx, formId, documentId, req);
}, { route: '/api/admin/sponsorships/form/documents/[documentId]/versions' });
