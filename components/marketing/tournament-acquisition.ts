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

// The pages where a free event carries no advertising at all: the registration form and the
// score-entry ("official") screens. Someone mid-task is not pitched, and a fixed overlay there
// sits over the form itself. ONE rule for the banner and the Powered-by badge — the badge was
// once left out of it and floated over the register form's fields and submit button (2026-10-16).
export function isAcquisitionHiddenOnPath(pathname: string | null | undefined) {
  return Boolean(pathname?.endsWith('/register') || pathname?.includes('/official'));
}

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
