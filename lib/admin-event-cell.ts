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
 * ⚖ Finished events sink to the foot of the switch list (owner, 2026-11-11): the events you are working in come first, in the
 * order the organization already keeps them; Completed (and Archived) follow, in that same order. A stable partition — it
 * never reorders within either group, and it reads the same phase the row's second line prints, so the word and the place agree.
 */
export function eventSwitchOrder<T extends EventFacts>(events: readonly T[], today?: string): T[] {
  const done = (e: T) => {
    const { phase } = eventPhaseOf(e, today);
    return phase === 'completed' || phase === 'archived';
  };
  return [...events.filter(e => !done(e)), ...events.filter(done)];
}

/**
 * A row's second line in the switch list (T3, owner's change): the event's dates and its phase word — "Nov 1–3, 2026 ·
 * Game day". An event with no dates says its phase alone.
 */
export function eventSwitchLine(event: EventFacts, today?: string): string {
  const { label, dates } = eventPhaseOf(event, today);
  return dates ? `${dates} · ${label}` : label;
}

/** One row of the switch list: the event's name, its line, whether it is the one on screen, and its tile's picture. */
export type EventSwitchRow = { id: string; name: string; line: string; current: boolean; source: string | null; aspect: number | null };

/**
 * ⚖ ONE LIST OF EVENTS AT BOTH WIDTHS (navigation Phase 3, owner 2026-11-11): the sidebar's menu on a computer and the bar's
 * sheet on a phone build their rows here, so the two can never disagree on the order, the words or the picture. The tile
 * leads every row at both widths (owner, R2 widened: "the logos down the list would be a nice addition") — the event's own
 * logo, else the organization's, else the event's initials, the cell's own rule (`eventTileSource`).
 */
export function eventSwitchRows<T extends EventFacts & EventLogo & { id: string; name: string }>(
  events: readonly T[],
  currentId: string | null | undefined,
  org: { logoUrl?: string | null; logoAspect?: number | null } | null | undefined,
  today?: string,
): EventSwitchRow[] {
  return eventSwitchOrder(events, today).map(t => ({
    id: t.id, name: t.name, line: eventSwitchLine(t, today), current: t.id === currentId, ...eventTileSource(t, org),
  }));
}
