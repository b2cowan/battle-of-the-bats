'use client';
import Link from 'next/link';
import { Megaphone } from 'lucide-react';
import { formatStoredDate } from '@/lib/timezone';
import { CHANGES_TO_SEND_WORDS as CW, SCHEDULE_PUBLISH_WORDS as W } from '@/lib/league-schedule-words';
import ck from '../../ClubKit.module.css';
import { RepChip, repKit } from '../../RepKit';
import s from '../time/LeagueTime.module.css';

/** A published division's facts from the schedule read (the route's `schedulePublishing`). */
export interface SchedulePublishing { publishedAt: string; families: number | null; reached: number; failed: number; held: number }

/**
 * THE DIVISION'S PUBLISH STATE (House League 9d-2b Part 2, frame e1; redrawn 2026-10-31). The state itself is a chip beside
 * the page's title (`SchedulePublishTag`, in the header's `titleChips` slot): Draft, or Published. Publish schedule is the
 * header's button (`showPublishButton`). This line says only what the chip does not, and is ABSENT when there is nothing
 * more to say (F3: a live fact moves to the body it describes, never dropped):
 *   · Draft — for someone who runs the season while the division's teams aren't published, why there is no button
 *     (9d2·8). Otherwise nothing: what Publish does is said in its own window.
 *   · Published — when and how many families were told ("Told 101 families on May 25"; the backfill (9d2b·A) told nobody:
 *     "On the public schedule since May 25"), the changes still to send, and an honest partial ("Told 99 of 101 families
 *     on May 25 · 2 didn't send. See them" — the season's Email families history, where the ones it missed are sent again).
 */
export default function SchedulePublishLine({ divisionName, teamsPublished, publishing, canRun, missedHref }: {
  divisionName: string;
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
    words = families == null ? W.wentLiveOn(day)
      : missed > 0 ? W.partialOn(day, reached, families, missed)
      : W.toldOn(day, families);
    if (held > 0) words += W.notSent(held);
  } else if (canRun && !teamsPublished) {
    words = W.teamsFirst(divisionName);
  } else {
    return null;
  }
  return (
    <>
      <p className={s.line}>
        <Megaphone size={15} aria-hidden className={s.lineIcon} />
        <span>{words}{canRun && missed > 0 && <>{' '}<Link className={repKit.inlineLink} href={missedHref} aria-label={W.seeThemAria}>{W.seeThem}</Link></>}</span>
      </p>
      {/* Under the waiting count (f1): what families see meanwhile. */}
      {canRun && publishing && publishing.held > 0 && <p className={`${ck.hint} ${s.lineNote}`}>{CW.listNote}</p>}
    </>
  );
}

/** The state beside the page's title: the one state chip, the word alone (Draft · Published). */
export function SchedulePublishTag({ published }: { published: boolean }) {
  return <RepChip tone={published ? 'good' : 'neutral'}>{published ? W.tagPublished : W.tagDraft}</RepChip>;
}

/** Publish schedule is offered to someone who runs the season, on a draft division with games and published teams. */
export const showPublishButton = (p: { canRun: boolean; published: boolean; teamsPublished: boolean; games: number }) =>
  p.canRun && !p.published && p.teamsPublished && p.games > 0;
