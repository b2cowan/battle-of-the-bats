/**
 * The event's cell at the head of the tournament admin's sidebar — the facts it shows, decided ONCE (navigation Phase 2 Part A,
 * owner rulings E1, E10, E12 (2), T3, T5, 2026-11-09 / 2026-11-10). Pure: the server's first paint and the browser read the same
 * rule, so the cell never changes after load.
 */
import { formatEventDateRange } from './timezone.ts';
import { PHASE_LABEL, resolveEventPhase } from './tournament-phase.ts';

type EventLogo = { logoUrl?: string | null; logoAspect?: number | null };

/**
 * ⚖ The tile's picture (E10 + T5): the event's own logo, else the organization's, else the initials (the tile draws them
 * from the event's name when there is no source, when the stored shape is outside 1 : 2 … 2 : 1, or when the file fails).
 * An event that HAS a logo keeps it as the source even when its shape is wrong, so the tile falls to the EVENT's initials —
 * never to the organization's logo, which in the event's cell would read as the club (T5 = A).
 * This deliberately does not copy the public page's plan rule (`resolveTournamentLook`): the sidebar is the organizer's own.
 */
export function eventTileSource(event: EventLogo, org: { logoUrl?: string | null; logoAspect?: number | null } | null | undefined): {
  source: string | null;
  aspect: number | null;
} {
  if (event.logoUrl) return { source: event.logoUrl, aspect: event.logoAspect ?? null };
  if (org?.logoUrl) return { source: org.logoUrl, aspect: org.logoAspect ?? null };
  return { source: null, aspect: null };
}

/**
 * A row's second line in the switch list (T3, owner's change): the event's dates and its phase word — "Nov 1–3, 2026 ·
 * Game day". ⚖ ONE set of words for an event's state (E12 (2)): the phase words (`PHASE_LABEL`), the strip's chip's own,
 * from the same rule (`resolveEventPhase`). An event with no dates says its phase alone.
 */
export function eventSwitchLine(event: {
  status?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  firstGameStarted?: boolean;
}, today?: string): string {
  const phase = resolveEventPhase({
    status: event.status,
    startDate: event.startDate,
    endDate: event.endDate,
    firstGameStarted: Boolean(event.firstGameStarted),
    today,
  });
  const dates = formatEventDateRange(event.startDate, event.endDate, true);
  return dates ? `${dates} · ${PHASE_LABEL[phase]}` : PHASE_LABEL[phase];
}
