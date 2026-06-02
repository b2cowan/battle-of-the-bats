import { NextRequest, NextResponse } from 'next/server';
import { cloneTournament, type CloneTournamentOptions } from '@/lib/db';
import { getAuthContextWithScope, forbidden, scopeGuard, unauthorized } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasPlanFeature, requiresTournamentPlusCopy } from '@/lib/plan-features';
import { writePlatformEvent } from '@/lib/platform-events';
import { supabaseAdmin } from '@/lib/supabase-admin';

type RouteParams = { params: Promise<{ tournamentId: string }> };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const COPY_GROUPS = ['structure', 'venues', 'registration', 'publicPresence', 'content'] as const;
const WARNING_KEYS = [
  'source_draft',
  'source_active',
  'source_older_than_one_year',
  'draft_year_before_source',
  'registration_setup_review',
  'public_content_review',
] as const;
const SOURCE_SURFACES = [
  'summary',
  'sidebar_create',
  'manage_tournaments_new_button',
  'manage_tournaments_row',
  'unknown',
] as const;

type CloneBody = {
  name?: unknown;
  slug?: unknown;
  year?: unknown;
  startDate?: unknown;
  endDate?: unknown;
  options?: Partial<Record<
    | 'includeDivisions'
    | 'includePools'
    | 'includeSlots'
    | 'includeVenues'
    | 'includeBranding'
    | 'includePublicPages'
    | 'includeWelcome'
    | 'includeRulesResources'
    | 'includeRegistrationFields'
    | 'includeFeeSchedule',
    unknown
  >>;
  analytics?: {
    sourceSurface?: unknown;
    selectedCopyGroups?: unknown;
    warningCount?: unknown;
    warningKeys?: unknown;
  };
};

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function normalizeDate(value: unknown) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' || !DATE_RE.test(value)) return undefined;
  return value;
}

function boolOption(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback;
}

function cleanList(value: unknown, allowed: readonly string[]) {
  if (!Array.isArray(value)) return undefined;
  const seen = new Set<string>();
  const cleaned = value
    .filter((item): item is string => typeof item === 'string' && allowed.includes(item))
    .filter(item => {
      if (seen.has(item)) return false;
      seen.add(item);
      return true;
    });
  return cleaned.length ? cleaned : undefined;
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

function selectedCopyGroupsFromOptions(input: {
  includeDivisions: boolean;
  includePools: boolean;
  includeSlots: boolean;
  includeVenues: boolean;
  includeBranding: boolean;
  includePublicPages: boolean;
  includeWelcome: boolean;
  includeRulesResources: boolean;
  includeRegistrationFields: boolean;
  includeFeeSchedule: boolean;
}) {
  return [
    input.includeDivisions || input.includePools || input.includeSlots ? 'structure' : '',
    input.includeVenues ? 'venues' : '',
    input.includeRegistrationFields || input.includeFeeSchedule ? 'registration' : '',
    input.includeBranding || input.includePublicPages ? 'publicPresence' : '',
    input.includeWelcome || input.includeRulesResources ? 'content' : '',
  ].filter(Boolean);
}

async function trackCloneEvent(input: {
  orgId: string;
  userId: string;
  userEmail?: string | null;
  planId: string;
  sourceTournamentId: string;
  sourceTournamentStatus?: string | null;
  sourceTournamentYear?: number | null;
  sourceSurface?: string;
  targetYear?: number;
  targetTournamentId?: string;
  status: 'attempted' | 'blocked' | 'completed';
  selectedCopyGroups?: string[];
  warningCount?: number;
  warningKeys?: string[];
  copied?: unknown;
}) {
  await writePlatformEvent({
    eventType: 'tournament_plus_feature_used',
    source: 'app',
    orgId: input.orgId,
    actorUserId: input.userId,
    actorEmail: input.userEmail,
    planId: input.planId,
    metadata: {
      feature: 'tournament_cloning',
      action: 'clone_tournament',
      sourceTournamentId: input.sourceTournamentId,
      sourceTournamentStatus: input.sourceTournamentStatus ?? null,
      sourceTournamentYear: input.sourceTournamentYear ?? null,
      sourceSurface: input.sourceSurface ?? 'unknown',
      targetTournamentId: input.targetTournamentId,
      targetYear: input.targetYear,
      status: input.status,
      selectedCopyGroups: input.selectedCopyGroups ?? [],
      warningCount: input.warningCount ?? 0,
      warningKeys: input.warningKeys ?? [],
      copied: input.copied,
    },
  });
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const orgSlug = req.nextUrl.searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithScope({ orgSlug });
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_tournaments')) return forbidden();
  if (!hasCapability(ctx.role, ctx.capabilities, 'create_tournaments')) return forbidden();

  const { tournamentId } = await params;
  const denied = scopeGuard(ctx, tournamentId);
  if (denied) return denied;

  const body = await req.json() as CloneBody;
  const name = typeof body.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : '';
  const slug = typeof body.slug === 'string' && body.slug.trim()
    ? slugify(body.slug)
    : slugify(name);
  const year = typeof body.year === 'number'
    ? body.year
    : Number.parseInt(String(body.year ?? new Date().getFullYear()), 10);
  const startDate = normalizeDate(body.startDate);
  const endDate = normalizeDate(body.endDate);

  if (!name) return json({ error: 'Tournament name is required.' }, 400);
  if (!slug || !SLUG_RE.test(slug)) return json({ error: 'Tournament URL must contain lowercase letters, numbers, and hyphens.' }, 400);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return json({ error: 'Choose a valid tournament year.' }, 400);
  if (startDate === undefined || endDate === undefined) return json({ error: 'Tournament dates must use YYYY-MM-DD format.' }, 400);
  if (startDate && endDate && endDate < startDate) return json({ error: 'End date cannot be before start date.' }, 400);

  const { data: sourceMeta, error: sourceMetaError } = await supabaseAdmin
    .from('tournaments')
    .select('id, year, status')
    .eq('id', tournamentId)
    .eq('org_id', ctx.org.id)
    .maybeSingle();
  if (sourceMetaError) return json({ error: sourceMetaError.message }, 500);
  if (!sourceMeta) return json({ error: 'Source tournament not found.' }, 404);

  const selected = body.options ?? {};
  const includeDivisions = boolOption(selected.includeDivisions, true);
  const includePools = includeDivisions && boolOption(selected.includePools, true);
  const includeSlots = includePools && boolOption(selected.includeSlots, true);
  const includeVenues = boolOption(selected.includeVenues, true);
  const includeBranding = boolOption(selected.includeBranding, true);
  const includePublicPages = boolOption(selected.includePublicPages, true);
  const includeWelcome = boolOption(selected.includeWelcome, true);
  const includeRulesResources = boolOption(selected.includeRulesResources, true);
  const includeRegistrationFields = boolOption(selected.includeRegistrationFields, true);
  const includeFeeSchedule = boolOption(selected.includeFeeSchedule, true);
  const derivedCopyGroups = selectedCopyGroupsFromOptions({
    includeDivisions,
    includePools,
    includeSlots,
    includeVenues,
    includeBranding,
    includePublicPages,
    includeWelcome,
    includeRulesResources,
    includeRegistrationFields,
    includeFeeSchedule,
  });
  const analytics = {
    sourceSurface: cleanSourceSurface(body.analytics?.sourceSurface),
    selectedCopyGroups: cleanList(body.analytics?.selectedCopyGroups, COPY_GROUPS) ?? derivedCopyGroups,
    warningCount: cleanWarningCount(body.analytics?.warningCount),
    warningKeys: cleanList(body.analytics?.warningKeys, WARNING_KEYS) ?? [],
  };

  await trackCloneEvent({
    orgId: ctx.org.id,
    userId: ctx.user.id,
    userEmail: ctx.user.email,
    planId: ctx.org.planId,
    sourceTournamentId: tournamentId,
    sourceTournamentStatus: sourceMeta.status,
    sourceTournamentYear: sourceMeta.year,
    targetYear: year,
    ...analytics,
    status: 'attempted',
  });

  if (!hasPlanFeature(ctx.org.planId, 'tournament_cloning')) {
    await trackCloneEvent({
      orgId: ctx.org.id,
      userId: ctx.user.id,
      userEmail: ctx.user.email,
      planId: ctx.org.planId,
      sourceTournamentId: tournamentId,
      sourceTournamentStatus: sourceMeta.status,
      sourceTournamentYear: sourceMeta.year,
      targetYear: year,
      ...analytics,
      status: 'blocked',
    });
    return json({ error: requiresTournamentPlusCopy('tournament_cloning') }, 403);
  }

  const [{ count, error: countError }, { count: slugCount, error: slugError }] = await Promise.all([
    supabaseAdmin
      .from('tournaments')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', ctx.org.id)
      .neq('status', 'archived'),
    supabaseAdmin
      .from('tournaments')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', ctx.org.id)
      .eq('slug', slug)
      .neq('status', 'archived'),
  ]);

  if (countError) return json({ error: countError.message }, 500);
  if (slugError) return json({ error: slugError.message }, 500);
  if (ctx.org.tournamentLimit < 9999 && (count ?? 0) >= ctx.org.tournamentLimit) {
    return json({ error: `Your plan allows ${ctx.org.tournamentLimit} tournament slot${ctx.org.tournamentLimit === 1 ? '' : 's'}. Archive another tournament before cloning.` }, 403);
  }
  if ((slugCount ?? 0) > 0) return json({ error: 'A non-archived tournament already uses this URL.' }, 409);

  try {
    const result = await cloneTournament(tournamentId, ctx.org.id, {
      name,
      slug,
      year,
      startDate,
      endDate,
      includeDivisions,
      includePools,
      includeSlots,
      includeVenues,
      includeBranding,
      includePublicPages,
      includeWelcome,
      includeRulesResources,
      includeRegistrationFields,
      includeFeeSchedule,
    } satisfies CloneTournamentOptions);

    await trackCloneEvent({
      orgId: ctx.org.id,
      userId: ctx.user.id,
      userEmail: ctx.user.email,
      planId: ctx.org.planId,
      sourceTournamentId: tournamentId,
      sourceTournamentStatus: sourceMeta.status,
      sourceTournamentYear: sourceMeta.year,
      targetYear: year,
      targetTournamentId: result.tournament.id,
      ...analytics,
      status: 'completed',
      copied: result.copied,
    });

    return json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to clone tournament.';
    return json({ error: message }, 500);
  }
}
