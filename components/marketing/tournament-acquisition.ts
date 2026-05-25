import type {
  TournamentPlusAcquisitionSource,
  TournamentPlusEventType,
  TournamentPlusMarketingSurface,
} from '@/lib/tournament-plus-analytics';

export type TournamentAcquisitionPayload = {
  eventType: Extract<TournamentPlusEventType, 'tournament_plus_acquisition_cta_viewed' | 'tournament_plus_acquisition_cta_clicked'>;
  acquisitionSource: TournamentPlusAcquisitionSource;
  surface: TournamentPlusMarketingSurface;
  orgSlug: string;
  tournamentSlug?: string | null;
  currentPath?: string | null;
  ctaHref?: string | null;
};

export function buildTournamentAcquisitionHref(input: {
  source: TournamentPlusAcquisitionSource;
  orgSlug: string;
  tournamentSlug?: string | null;
  surface?: TournamentPlusMarketingSurface;
}) {
  const params = new URLSearchParams({
    source: input.source,
    orgSlug: input.orgSlug,
  });
  if (input.tournamentSlug) params.set('tournamentSlug', input.tournamentSlug);
  if (input.surface) params.set('surface', input.surface);
  return `/pricing?${params.toString()}`;
}

export function buildTeamWorkspaceAcquisitionHref(input: {
  source: TournamentPlusAcquisitionSource;
  orgSlug: string;
  tournamentSlug?: string | null;
  surface?: TournamentPlusMarketingSurface;
}) {
  const params = new URLSearchParams({
    billing: 'annual',
    source: input.source,
    orgSlug: input.orgSlug,
  });
  if (input.tournamentSlug) params.set('tournamentSlug', input.tournamentSlug);
  if (input.surface) params.set('surface', input.surface);
  return `/coaches/start?${params.toString()}`;
}

export function trackTournamentAcquisition(payload: TournamentAcquisitionPayload) {
  try {
    void fetch('/api/public/tournament-plus-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {
    // Best-effort analytics should never affect public tournament UX.
  }
}
