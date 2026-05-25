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

async function trackCloneEvent(input: {
  orgId: string;
  userId: string;
  userEmail?: string | null;
  planId: string;
  sourceTournamentId: string;
  targetTournamentId?: string;
  status: 'attempted' | 'blocked' | 'completed';
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
      targetTournamentId: input.targetTournamentId,
      status: input.status,
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

  await trackCloneEvent({
    orgId: ctx.org.id,
    userId: ctx.user.id,
    userEmail: ctx.user.email,
    planId: ctx.org.planId,
    sourceTournamentId: tournamentId,
    status: 'attempted',
  });

  if (!hasPlanFeature(ctx.org.planId, 'tournament_cloning')) {
    await trackCloneEvent({
      orgId: ctx.org.id,
      userId: ctx.user.id,
      userEmail: ctx.user.email,
      planId: ctx.org.planId,
      sourceTournamentId: tournamentId,
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
    const selected = body.options ?? {};
    const includeDivisions = boolOption(selected.includeDivisions, true);
    const includePools = includeDivisions && boolOption(selected.includePools, true);
    const includeSlots = includePools && boolOption(selected.includeSlots, true);
    const result = await cloneTournament(tournamentId, ctx.org.id, {
      name,
      slug,
      year,
      startDate,
      endDate,
      includeDivisions,
      includePools,
      includeSlots,
      includeVenues: boolOption(selected.includeVenues, true),
      includeBranding: boolOption(selected.includeBranding, true),
      includePublicPages: boolOption(selected.includePublicPages, true),
      includeWelcome: boolOption(selected.includeWelcome, true),
      includeRulesResources: boolOption(selected.includeRulesResources, true),
      includeRegistrationFields: boolOption(selected.includeRegistrationFields, true),
      includeFeeSchedule: boolOption(selected.includeFeeSchedule, true),
    } satisfies CloneTournamentOptions);

    await trackCloneEvent({
      orgId: ctx.org.id,
      userId: ctx.user.id,
      userEmail: ctx.user.email,
      planId: ctx.org.planId,
      sourceTournamentId: tournamentId,
      targetTournamentId: result.tournament.id,
      status: 'completed',
      copied: result.copied,
    });

    return json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to clone tournament.';
    return json({ error: message }, 500);
  }
}
