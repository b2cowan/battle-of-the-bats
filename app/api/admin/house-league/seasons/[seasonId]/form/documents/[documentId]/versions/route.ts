import { withObservability } from '@/lib/observability';
import { ensureSeasonForm } from '@/lib/club-form-server';
import { addDocumentVersion } from '@/lib/club-form-editor';
import { formAuth, seasonNotFound, seasonOf } from '@/lib/club-form-route';
import { houseLeagueRefusal } from '@/lib/house-league-gate';

export const dynamic = 'force-dynamic';

/**
 * REPLACE WITH A NEW VERSION (Board Ready Stage 4 Part 1; drawing tab 3; ruling 8). The new words (a PDF of the same kind,
 * or the typed text) become the next version; every earlier version and its ticks are kept. The club says what it means for
 * families who ticked the one before: "Their tick stands" (`ticksStand: true`) or "They must tick again" (`false`, with a
 * reason families see). Tick-again sign-ups read "Needs a new tick" (Part 3); places aren't affected; nobody is emailed.
 */
export const POST = withObservability(async (req: Request, { params }: { params: Promise<{ seasonId: string; documentId: string }> }) => {
  const ctx = await formAuth(req);
  const err = houseLeagueRefusal(ctx, 'run');
  if (err || !ctx) return err!;
  const season = await seasonOf(params, ctx);
  if (!season) return seasonNotFound();
  const refused = houseLeagueRefusal(ctx, 'run', season);
  if (refused) return refused;
  const formId = await ensureSeasonForm(season.id);
  const { documentId } = await params;
  return addDocumentVersion(ctx, formId, documentId, req);
}, { route: '/api/admin/house-league/seasons/[seasonId]/form/documents/[documentId]/versions' });
