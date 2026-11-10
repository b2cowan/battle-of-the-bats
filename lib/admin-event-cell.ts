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

type EventFacts = {
  status?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  firstGameStarted?: boolean;
};

/**
 * ⚖ ONE set of words for an event's state (E12 (2)), read by the switch list's rows and the strip's facts (navigation Phase 2
 * Part B) alike, so the two can never disagree: the event's dates ("Nov 1–3, 2026", or null with none) and its phase, from
 * the board's one rule (`resolveEventPhase`: the dates, or the first game having started, until it is marked complete), in
 * the phase words (`PHASE_LABEL`).
 */
export function eventPhaseOf(event: EventFacts, today?: string) {
  const phase = resolveEventPhase({
    status: event.status,
    startDate: event.startDate,
    endDate: event.endDate,
    firstGameStarted: Boolean(event.firstGameStarted),
    today,
  });
  return { phase, label: PHASE_LABEL[phase], dates: formatEventDateRange(event.startDate, event.endDate, true) || null };
}

/**
 * A row's second line in the switch list (T3, owner's change): the event's dates and its phase word — "Nov 1–3, 2026 ·
 * Game day". An event with no dates says its phase alone.
 */
export function eventSwitchLine(event: EventFacts, today?: string): string {
  const { label, dates } = eventPhaseOf(event, today);
  return dates ? `${dates} · ${label}` : label;
}
