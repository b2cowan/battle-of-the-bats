import { withObservability } from '@/lib/observability';
import { ensureSeasonForm } from '@/lib/club-form-server';
import { addDocument } from '@/lib/club-form-editor';
import { formAuth, seasonNotFound, seasonOf } from '@/lib/club-form-route';
import { houseLeagueRefusal } from '@/lib/house-league-gate';

export const dynamic = 'force-dynamic';

/**
 * ADD A DOCUMENT (Board Ready Stage 4 Part 1; drawing tab 3; rulings 2 and 8). A PDF (multipart, checked from its bytes,
 * up to 8 MB) or typed text (JSON). Its words are version 1. NEVER behind a plan gate (documents and their ticks are on
 * every plan). Every document is required; it has no Required switch.
 */
export const POST = withObservability(async (req: Request, { params }: { params: Promise<{ seasonId: string }> }) => {
  const ctx = await formAuth(req);
  const err = houseLeagueRefusal(ctx, 'run');
  if (err || !ctx) return err!;
  const season = await seasonOf(params, ctx);
  if (!season) return seasonNotFound();
  const refused = houseLeagueRefusal(ctx, 'run', season);
  if (refused) return refused;
  const formId = await ensureSeasonForm(season.id);
  return addDocument(ctx, formId, req);
}, { route: '/api/admin/house-league/seasons/[seasonId]/form/documents' });
