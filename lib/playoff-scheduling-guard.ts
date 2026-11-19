import type { Game } from './types';

export interface ScheduledStart {
  date?: string | null;
  time?: string | null;
}

export function getRoundRobinCompletion(
  games: (Pick<Game, 'date' | 'time' | 'isPlayoff' | 'status'> & { durationMinutes?: number | null })[],
  gameDurationMinutes: number,
): Date | null {
  // A game's own length first, then the default (the game-order rule's chain): the generator drafts after pool play
  // ENDS by the same clock the server refuses by.
  let latest: Date | null = null;

  for (const game of games) {
    if (game.isPlayoff || game.status === 'cancelled' || !game.date || !game.time) continue;
    const start = scheduledStartDate(game);
    if (!start) continue;
    const ownMinutes = typeof game.durationMinutes === 'number' && game.durationMinutes > 0 ? game.durationMinutes : gameDurationMinutes;
    const end = new Date(start.getTime() + Math.max(0, ownMinutes) * 60_000);
    if (!latest || end > latest) latest = end;
  }

  return latest;
}

export function startsBeforeRoundRobinCompletion(
  item: ScheduledStart,
  roundRobinCompletion: Date | null,
): boolean {
  if (!roundRobinCompletion || !item.date || !item.time) return false;
  const start = scheduledStartDate(item);
  return Boolean(start && start.getTime() < roundRobinCompletion.getTime());
}

export function filterStartsAfterRoundRobinCompletion<TItem extends ScheduledStart>(
  items: TItem[],
  roundRobinCompletion: Date | null,
): TItem[] {
  if (!roundRobinCompletion) return items;
  return items.filter(item => !startsBeforeRoundRobinCompletion(item, roundRobinCompletion));
}

function scheduledStartDate(item: ScheduledStart): Date | null {
  if (!item.date || !item.time) return null;
  const date = new Date(`${item.date}T${item.time}`);
  return Number.isNaN(date.getTime()) ? null : date;
}
