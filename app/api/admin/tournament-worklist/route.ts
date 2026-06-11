import { forbidden, getAuthContextWithScope, scopeGuard, unauthorized } from '@/lib/api-auth';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { hasCapability } from '@/lib/roles';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';

/**
 * Lightweight "needs-you" counts for the admin nav worklist (B5).
 * Deliberately minimal (two count queries) since it's fetched shell-wide on a
 * timer — the heavy stats live in /api/admin/tournament-dashboard.
 *
 *  registrations → teams pending accept/reject
 *  results       → games submitted (a score is in, awaiting Finalize)
 *
 * The counts self-adjust by lifecycle: pending registrations dominate pre-event,
 * games-to-finalize appear on game day — so the nav follows the phase without
 * extra logic.
 */
export const GET = withObservability(async (req: Request) => {
  const searchParams = new URL(req.url).searchParams;
  const orgSlug = searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithScope({ orgSlug });
  if (!ctx) return unauthorized();

  if (!hasCapability(ctx.role, ctx.capabilities, 'module_tournaments')) return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_tournaments')) return forbidden();

  const tournamentId = searchParams.get('tournamentId');
  if (!tournamentId) {
    return Response.json({ error: 'Missing tournamentId' }, { status: 400 });
  }

  const denied = scopeGuard(ctx, tournamentId);
  if (denied) return denied;

  const [pendingRes, finalizeRes] = await Promise.all([
    supabaseAdmin
      .from('teams')
      .select('id', { count: 'exact', head: true })
      .eq('tournament_id', tournamentId)
      .eq('status', 'pending'),
    supabaseAdmin
      .from('games')
      .select('id', { count: 'exact', head: true })
      .eq('tournament_id', tournamentId)
      .eq('status', 'submitted'),
  ]);

  const err = pendingRes.error ?? finalizeRes.error;
  if (err) {
    console.error('[tournament-worklist] query failed', err);
    return Response.json({ error: err.message }, { status: 500 });
  }

  return Response.json({
    registrations: pendingRes.count ?? 0,
    results: finalizeRes.count ?? 0,
  });
}, { route: '/api/admin/tournament-worklist' });
