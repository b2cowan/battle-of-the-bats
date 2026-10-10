import { NextRequest, NextResponse } from 'next/server';
import { populateTournamentFrom } from '@/lib/db';
import { PopulateFailed, type SetupAreas } from '@/lib/tournament-setup-copy';
import { REUSE_WORDS } from '@/lib/after-event-words';
import { getAuthContextWithScope, forbidden, scopeGuard, unauthorized } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasPlanFeature, requiresTournamentPlusCopy } from '@/lib/plan-features';
import { writePlatformEvent } from '@/lib/platform-events';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';

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

export const POST = withObservability(async (req: NextRequest, { params }: RouteParams) => {
  const orgSlug = req.nextUrl.searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithScope({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_tournaments')) return forbidden();
  // Filling a draft's setup is setting up a tournament: the capability every create and reuse path asks (Stage 5).
  if (!hasCapability(ctx.role, ctx.capabilities, 'create_tournaments')) return forbidden();

  const { tournamentId: destinationTournamentId } = await params;

  // Scope guard: destination must belong to this org
  const denied = scopeGuard(ctx, destinationTournamentId);
  if (denied) return denied;

  const body = await req.json().catch(() => ({})) as {
    sourceTournamentId?: unknown;
    /** The reuse step's five areas (Stage 5's "into this draft"); absent = all five, as before. */
    areas?: Partial<Record<keyof SetupAreas, unknown>>;
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
  // The source too is one this member may see (a member limited to certain tournaments copies only from those).
  const sourceDenied = scopeGuard(ctx, sourceTournamentId);
  if (sourceDenied) return sourceDenied;

  const areas: SetupAreas = body.areas && typeof body.areas === 'object'
    ? {
      structure: body.areas.structure === true,
      venues: body.areas.venues === true,
      registration: body.areas.registration === true,
      publicPresence: body.areas.publicPresence === true,
      content: body.areas.content === true,
    }
    : { structure: true, venues: true, registration: true, publicPresence: true, content: true };
  if (!Object.values(areas).some(Boolean)) return json({ error: REUSE_WORDS.nothingChosenDoor }, 400);

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
  if (destError) { console.error('[populate-from] destination read', destError); return json({ error: REUSE_WORDS.intoFailed }, 500); }
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
  if (sourceError) { console.error('[populate-from] source read', sourceError); return json({ error: REUSE_WORDS.intoFailed }, 500); }
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
    const result = await populateTournamentFrom(destinationTournamentId, sourceTournamentId, ctx.org.id, areas);

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
    // One step that finishes or leaves the draft as it was (F80): the words say which, never the database's.
    console.error('[populate-from] failed', error);
    // Inside the step every failure is a PopulateFailed that knows whether the draft is as it was; anything else
    // stopped before it wrote (the step's own reads), so the draft is untouched.
    const tookBack = error instanceof PopulateFailed ? error.tookBack : true;
    return json({ error: tookBack ? REUSE_WORDS.intoFailed : REUSE_WORDS.intoFailedPartly }, 500);
  }
}, { route: '/api/admin/tournaments/[tournamentId]/populate-from' });
