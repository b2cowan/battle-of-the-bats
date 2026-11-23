import { withObservability } from '@/lib/observability';
import { ensureSeasonForm } from '@/lib/club-form-server';
import { patchDocument } from '@/lib/club-form-editor';
import { formAuth, seasonNotFound, seasonOf } from '@/lib/club-form-route';
import { houseLeagueRefusal } from '@/lib/house-league-gate';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ seasonId: string; documentId: string }> };

/**
 * ONE DOCUMENT (Board Ready Stage 4 Part 1; drawing tab 3). The record's autosave (name, the tick) or { archived: true }.
 * A document is never deleted: an archived one leaves the sign-up page and its ticks stay on each registration. The tick's
 * words lock once anyone has ticked (each tick keeps the sentence it was given; changing what families agree to is a new
 * version, not an edit). The words families read change only through Replace (`./versions`).
 */
export const PATCH = withObservability(async (req: Request, { params }: Params) => {
  const ctx = await formAuth(req);
  const err = houseLeagueRefusal(ctx, 'run');
  if (err || !ctx) return err!;
  const season = await seasonOf(params, ctx);
  if (!season) return seasonNotFound();
  const refused = houseLeagueRefusal(ctx, 'run', season);
  if (refused) return refused;
  const formId = await ensureSeasonForm(season.id);
  const { documentId } = await params;
  return patchDocument(formId, documentId, req);
}, { route: '/api/admin/house-league/seasons/[seasonId]/form/documents/[documentId]' });
