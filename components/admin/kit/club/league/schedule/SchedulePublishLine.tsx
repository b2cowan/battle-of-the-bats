'use client';
import Link from 'next/link';
import { Megaphone } from 'lucide-react';
import { formatStoredDate } from '@/lib/timezone';
import { CHANGES_TO_SEND_WORDS as CW, SCHEDULE_PUBLISH_WORDS as W } from '@/lib/league-schedule-words';
import ck from '../../ClubKit.module.css';
import { repKit } from '../../RepKit';
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
 *     changes still to send, and an honest partial ("reached 99 of 101 families · 2 didn't send. See them" — the
 *     season's Email families history, where the ones it missed are sent again; Part 4).
 */
export default function SchedulePublishLine({ divisionName, games, teamsPublished, publishing, canRun, missedHref }: {
  divisionName: string;
  /** The division's games that are not cancelled (what Publish puts out). */
  games: number;
  teamsPublished: boolean;
  publishing: SchedulePublishing | undefined;
  canRun: boolean;
  /** The season's Email families history ("See them"). */
  missedHref: string;
}) {
  let words: string;
  let missed = 0;
  if (publishing) {
    const day = formatStoredDate(publishing.publishedAt, { withYear: false });
    const { families, reached, failed, held } = publishing;
    // `failed` is every family still to reach (failed, or a send that never started): the history offers them again.
    missed = families == null ? 0 : failed;
    words = families == null ? W.publishedOn(day)
      : missed > 0 ? `${W.publishedOn(day)} · ${W.partial(reached, families, missed)}`
      : W.published(day, families);
    if (held > 0) words += W.notSent(held);
  } else if (!canRun) {
    words = W.draftShort;
  } else {
    words = W.draft(games) + (teamsPublished ? '' : `. ${W.teamsFirst(divisionName)}`);
  }
  return (
    <>
      <p className={s.line}>
        <Megaphone size={15} aria-hidden className={s.lineIcon} />
        <span>{words}{canRun && missed > 0 && <>{' '}<Link className={repKit.inlineLink} href={missedHref} aria-label={W.seeThemAria}>{W.seeThem}</Link></>}</span>
      </p>
      {/* Under the waiting count (f1): what families see meanwhile. */}
      {canRun && publishing && publishing.held > 0 && <p className={ck.hint}>{CW.listNote}</p>}
    </>
  );
}

/** Publish schedule is offered to someone who runs the season, on a draft division with games and published teams. */
export const showPublishButton = (p: { canRun: boolean; published: boolean; teamsPublished: boolean; games: number }) =>
  p.canRun && !p.published && p.teamsPublished && p.games > 0;
