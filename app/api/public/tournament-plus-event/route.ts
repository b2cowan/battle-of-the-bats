import { NextResponse } from 'next/server';
import { getOrganizationBySlug, getPublicTournamentBySlug } from '@/lib/db';
import { writePlatformEvent } from '@/lib/platform-events';
import {
  TOURNAMENT_PLUS_ACQUISITION_SOURCES,
  TOURNAMENT_PLUS_EVENT_TYPES,
  TOURNAMENT_PLUS_MARKETING_SURFACES,
  type TournamentPlusAcquisitionSource,
  type TournamentPlusEventType,
  type TournamentPlusMarketingSurface,
} from '@/lib/tournament-plus-analytics';

const ALLOWED_EVENT_TYPES = new Set<TournamentPlusEventType>(
  TOURNAMENT_PLUS_EVENT_TYPES.filter(type =>
    type === 'tournament_plus_acquisition_cta_viewed' ||
    type === 'tournament_plus_acquisition_cta_clicked'
  )
);
const ALLOWED_SOURCES = new Set<TournamentPlusAcquisitionSource>(TOURNAMENT_PLUS_ACQUISITION_SOURCES);
const ALLOWED_SURFACES = new Set<TournamentPlusMarketingSurface>(TOURNAMENT_PLUS_MARKETING_SURFACES);

type EventBody = {
  eventType?: unknown;
  acquisitionSource?: unknown;
  surface?: unknown;
  orgSlug?: unknown;
  tournamentSlug?: unknown;
  currentPath?: unknown;
  ctaHref?: unknown;
};

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 500) : null;
}

export async function POST(req: Request) {
  let body: EventBody;
  try {
    body = await req.json() as EventBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const eventType = body.eventType as TournamentPlusEventType;
  const acquisitionSource = body.acquisitionSource as TournamentPlusAcquisitionSource;
  const surface = body.surface as TournamentPlusMarketingSurface;
  const orgSlug = stringOrNull(body.orgSlug);
  const tournamentSlug = stringOrNull(body.tournamentSlug);

  if (!ALLOWED_EVENT_TYPES.has(eventType)) {
    return NextResponse.json({ error: 'Invalid eventType' }, { status: 400 });
  }
  if (!ALLOWED_SOURCES.has(acquisitionSource)) {
    return NextResponse.json({ error: 'Invalid acquisitionSource' }, { status: 400 });
  }
  if (!ALLOWED_SURFACES.has(surface)) {
    return NextResponse.json({ error: 'Invalid surface' }, { status: 400 });
  }
  if (!orgSlug) {
    return NextResponse.json({ error: 'Missing orgSlug' }, { status: 400 });
  }

  const org = await getOrganizationBySlug(orgSlug);
  if (!org || !org.isPublic || org.subscriptionStatus === 'canceled') {
    return NextResponse.json({ ok: true });
  }

  const tournament = tournamentSlug
    ? await getPublicTournamentBySlug(org.id, tournamentSlug)
    : null;

  await writePlatformEvent({
    eventType,
    source: 'app',
    orgId: org.id,
    planId: org.planId,
    metadata: {
      acquisitionSource,
      surface,
      orgSlug,
      tournamentSlug,
      tournamentId: tournament?.id ?? null,
      currentPath: stringOrNull(body.currentPath),
      ctaHref: stringOrNull(body.ctaHref),
    },
  });

  return NextResponse.json({ ok: true });
}
