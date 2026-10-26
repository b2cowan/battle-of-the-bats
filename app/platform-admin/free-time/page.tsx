import type { Metadata } from 'next';
import { requirePlatformAreaView } from '@/lib/platform-auth';
import { getFoundingSeasonDeskData } from '@/lib/founding-season-desk';
import { getStaffFreeTime } from '@/lib/free-time-list';
import { grantsEnabled } from '@/lib/entitlement-grants';
import { formatShortDay } from '@/lib/free-time';
import {
  FOUNDING_SEASON_END,
  FOUNDING_SEASON_END_LABEL,
  FOUNDING_SEASON_NEXT_YEAR_LABEL,
  isFoundingSeasonCardWindowOpen,
} from '@/lib/plan-config';
import FreeTimeClient, { type FreeTimeView } from './FreeTimeClient';

export const metadata: Metadata = { title: 'Free time — Support console' };

/**
 * FREE TIME — everyone with free time running, in one list (Support console Stage 4, owner rulings Q4 + Q7 + Q8,
 * 2026-10-25; drawings 5eawvGUPwQVPoWiAV7vQY5, "Free time, one list"). It took the Founding season desk's place in the
 * menu, and keeps that desk whole as its Founding Season view.
 *
 *   • Everyone — both groups, each account once per group;
 *   • Founding Season — the desk: band, summer note, card and 2028-choice columns. Read from where Founding lives today
 *     (its access is the club's plan until the turn-off decision, Q4), its end read as the last free day;
 *   • Given by staff — one row per club, soonest end first, with an "Ending in 14 days" filter: the list Today's
 *     "Free time ending" opens and counts (`lib/free-time-list.ts`, so the two numbers are one).
 *
 * ⚠ NOTHING ON IT ACTS: no bulk end, no bulk extend. Free time is given, changed and ended on a club's record. Rows open
 * the record's Free time list. A red line while the switch is off (owner ruling Q9).
 */
export default async function FreeTimePage({ searchParams }: { searchParams: Promise<{ view?: string; ending?: string }> }) {
  await requirePlatformAreaView('free_time');
  const { view, ending } = await searchParams;
  const [{ rows, totals }, staff] = await Promise.all([getFoundingSeasonDeskData(), getStaffFreeTime()]);
  const initialView: FreeTimeView = view === 'founding' || view === 'staff' ? view : 'everyone';

  // A Founding account that also has staff free time running says so on its Founding row.
  const staffFreeTime: Record<string, string> = {};
  for (const c of staff) staffFreeTime[c.orgId] = `${c.freeOn.replace(', the whole plan', '')} free through ${formatShortDay(c.lastDay)}`;

  return (
    <FreeTimeClient
      initialView={initialView}
      initialEnding={ending === '14'}
      switchOn={grantsEnabled()}
      staff={staff}
      desk={{
        rows,
        totals,
        freeSeasonEndsLabel: FOUNDING_SEASON_END_LABEL,
        nextYearLabel: FOUNDING_SEASON_NEXT_YEAR_LABEL,
        freeSeasonEndsIso: FOUNDING_SEASON_END,
        cardWindowOpen: isFoundingSeasonCardWindowOpen(),
        staffFreeTime,
      }}
    />
  );
}
