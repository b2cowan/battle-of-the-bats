import { withObservability } from '@/lib/observability';
import { ensureSeasonForm } from '@/lib/club-form-server';
import { openDocumentFile } from '@/lib/club-form-editor';
import { formAuth, seasonNotFound, seasonOf } from '@/lib/club-form-route';
import { houseLeagueRefusal } from '@/lib/house-league-gate';

export const dynamic = 'force-dynamic';

/**
 * A DOCUMENT'S PDF, FOR THE CLUB (Board Ready Stage 4 Part 1). `?version=` names a version (the current one without it).
 * Anyone who can open the season may read the club's own documents; the path comes from the version row, never the
 * request, and the link it redirects to is signed for one hour (the published Privacy Policy's promise). Opened in a tab:
 * a club's own document, not a family's file (those download, Part 3).
 */
export const GET = withObservability(async (req: Request, { params }: { params: Promise<{ seasonId: string; documentId: string }> }) => {
  const ctx = await formAuth(req);
  const err = houseLeagueRefusal(ctx, 'read');
  if (err || !ctx) return err!;
  const season = await seasonOf(params, ctx);
  if (!season) return seasonNotFound();
  const refused = houseLeagueRefusal(ctx, 'read', season);
  if (refused) return refused;
  const formId = await ensureSeasonForm(season.id);
  const { documentId } = await params;
  return openDocumentFile(formId, documentId, req);
}, { route: '/api/admin/house-league/seasons/[seasonId]/form/documents/[documentId]/file' });
