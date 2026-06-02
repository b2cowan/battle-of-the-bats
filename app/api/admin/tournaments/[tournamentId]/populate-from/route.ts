import { NextRequest, NextResponse } from 'next/server';
import { populateTournamentFrom } from '@/lib/db';
import { getAuthContextWithScope, forbidden, scopeGuard, unauthorized } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasPlanFeature, requiresTournamentPlusCopy } from '@/lib/plan-features';
import { writePlatformEvent } from '@/lib/platform-events';
import { supabaseAdmin } from '@/lib/supabase-admin';

type RouteParams = { params: Promise<{ tournamentId: string }> };
const COPY_GROUPS = ['structure', 'venues', 'registration', 'publicPresence', 'content'] as const;
const WARNING_KEYS = [
  'source_draft',
  'source_active',
  'source_older_than_one_year',
  'draft_year_before_source',
  'registration_setup_review',
  'public_content_review',
] as const;
const SOURCE_SURFACES = ['draft_dashboard', 'unknown'] as const;

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

function cleanList(value: unknown, allowed: readonly string[]) {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value
    .filter((item): item is string => typeof item === 'string' && allowed.includes(item))
    .filter(item => {
      if (seen.has(item)) return false;
      seen.add(item);
      return true;
    });
}

function cleanSourceSurface(value: unknown) {
  return typeof value === 'string' && SOURCE_SURFACES.includes(value as typeof SOURCE_SURFACES[number])
    ? value
    : 'unknown';
}

function cleanWarningCount(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(20, Math.trunc(value)));
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const orgSlug = req.nextUrl.searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithScope({ orgSlug });
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_tournaments')) return forbidden();

  const { tournamentId: destinationTournamentId } = await params;

  // Scope guard: destination must belong to this org
  const denied = scopeGuard(ctx, destinationTournamentId);
  if (denied) return denied;

  const body = await req.json() as {
    sourceTournamentId?: unknown;
    analytics?: {
      sourceSurface?: unknown;
      selectedCopyGroups?: unknown;
      warningCount?: unknown;
      warningKeys?: unknown;
    };
  };
  const sourceTournamentId = typeof body.sourceTournamentId === 'string' ? body.sourceTournamentId.trim() : '';
  const analytics = {
    sourceSurface: cleanSourceSurface(body.analytics?.sourceSurface),
    selectedCopyGroups: cleanList(body.analytics?.selectedCopyGroups, COPY_GROUPS),
    warningCount: cleanWarningCount(body.analytics?.warningCount),
    warningKeys: cleanList(body.analytics?.warningKeys, WARNING_KEYS),
  };

  if (!sourceTournamentId) return json({ error: 'sourceTournamentId is required.' }, 400);
  if (sourceTournamentId === destinationTournamentId) {
    return json({ error: 'Source and destination must be different tournaments.' }, 400);
  }

  if (!hasPlanFeature(ctx.org.planId, 'tournament_cloning')) {
    return json({ error: requiresTournamentPlusCopy('tournament_cloning') }, 403);
  }

  // Verify destination is a draft in this org
  const { data: destination, error: destError } = await supabaseAdmin
    .from('tournaments')
    .select('id, status, name')
    .eq('id', destinationTournamentId)
    .eq('org_id', ctx.org.id)
    .maybeSingle();
  if (destError) return json({ error: destError.message }, 500);
  if (!destination) return json({ error: 'Destination tournament not found.' }, 404);
  if (destination.status !== 'draft') {
    return json({ error: 'You can only populate a draft tournament. Activate it first if you want to update settings.' }, 409);
  }

  // Verify source exists in this org
  const { data: source, error: sourceError } = await supabaseAdmin
    .from('tournaments')
    .select('id, name, year, status')
    .eq('id', sourceTournamentId)
    .eq('org_id', ctx.org.id)
    .maybeSingle();
  if (sourceError) return json({ error: sourceError.message }, 500);
  if (!source) return json({ error: 'Source tournament not found.' }, 404);

  await writePlatformEvent({
    eventType: 'tournament_plus_feature_used',
    source: 'app',
    orgId: ctx.org.id,
    actorUserId: ctx.user.id,
    actorEmail: ctx.user.email,
    planId: ctx.org.planId,
    metadata: {
      feature: 'tournament_cloning',
      action: 'populate_tournament_from',
      sourceTournamentId,
      destinationTournamentId,
      sourceTournamentStatus: source.status ?? null,
      sourceTournamentYear: source.year ?? null,
      ...analytics,
      status: 'attempted',
    },
  });

  try {
    const result = await populateTournamentFrom(destinationTournamentId, sourceTournamentId, ctx.org.id);

    await writePlatformEvent({
      eventType: 'tournament_plus_feature_used',
      source: 'app',
      orgId: ctx.org.id,
      actorUserId: ctx.user.id,
      actorEmail: ctx.user.email,
      planId: ctx.org.planId,
      metadata: {
        feature: 'tournament_cloning',
        action: 'populate_tournament_from',
        sourceTournamentId,
        destinationTournamentId,
        sourceTournamentStatus: source.status ?? null,
        sourceTournamentYear: source.year ?? null,
        ...analytics,
        status: 'completed',
        copied: result.copied,
      },
    });

    return json({ success: true, copied: result.copied });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to populate tournament.';
    return json({ error: message }, 500);
  }
}
