'use client';
import { Megaphone } from 'lucide-react';
import { formatStoredDate } from '@/lib/timezone';
import { SCHEDULE_PUBLISH_WORDS as W } from '@/lib/league-schedule-words';
import s from '../time/LeagueTime.module.css';

/** A published division's facts from the schedule read (the route's `schedulePublishing`). */
export interface SchedulePublishing { publishedAt: string; families: number | null; reached: number; failed: number; held: number }

/**
 * THE DIVISION'S PUBLISH LINE (House League 9d-2b Part 2, frame e1). The header has no subtitle slot (F3: a live fact
 * moves to the body it describes), so the draft / published fact is one quiet line under the time line, as the time line
 * is. Publish schedule itself is the header's button (`showPublishButton`).
 *   · Draft — "Draft · 45 games · families see nothing yet"; and, for someone who runs the season while the division's
 *     teams aren't published, why there is no button (9d2·8). A reader sees "Draft" alone.
 *   · Published — "Published May 25 · 101 families told" (the backfill (9d2b·A) told nobody: the date alone), the
 *     changes still to send, and an honest partial ("reached 99 of 101 families · 2 didn't send.").
 */
export default function SchedulePublishLine({ divisionName, games, teamsPublished, publishing, canRun }: {
  divisionName: string;
  /** The division's games that are not cancelled (what Publish puts out). */
  games: number;
  teamsPublished: boolean;
  publishing: SchedulePublishing | undefined;
  canRun: boolean;
}) {
  let words: string;
  if (publishing) {
    const day = formatStoredDate(publishing.publishedAt, { withYear: false });
    const { families, reached, failed, held } = publishing;
    words = families == null ? W.publishedOn(day)
      : failed > 0 ? `${W.publishedOn(day)} · ${W.partial(reached, families, failed)}`
      : W.published(day, families);
    if (held > 0) words += W.notSent(held);
  } else if (!canRun) {
    words = W.draftShort;
  } else {
    words = W.draft(games) + (teamsPublished ? '' : `. ${W.teamsFirst(divisionName)}`);
  }
  return (
    <p className={s.line}>
      <Megaphone size={15} aria-hidden className={s.lineIcon} />
      <span>{words}</span>
    </p>
  );
}

/** Publish schedule is offered to someone who runs the season, on a draft division with games and published teams. */
export const showPublishButton = (p: { canRun: boolean; published: boolean; teamsPublished: boolean; games: number }) =>
  p.canRun && !p.published && p.teamsPublished && p.games > 0;
