import type { Metadata } from 'next';
import { requirePlatformAreaView } from '@/lib/platform-auth';
import { getStaffFreeTime } from '@/lib/free-time-list';
import { grantsEnabled } from '@/lib/entitlement-grants';
import FreeTimeClient from './FreeTimeClient';

export const metadata: Metadata = { title: 'Free time — Support console' };

/**
 * FREE TIME — everyone with staff-given free time running, in one list (Support console Stage 4, owner rulings Q4 + Q7 +
 * Q8, 2026-10-25; owner 2026-11-19: no tabs). One row per club, soonest end first, with an
 * "Ending in 14 days" filter: the list Today's "Free time ending" opens and counts (`lib/free-time-list.ts`, so the two
 * numbers are one). An old link carrying a `view` is read the same way (the list has one view).
 *
 * ⚠ NOTHING ON IT ACTS: no bulk end, no bulk extend. Free time is given, changed and ended on a club's record. Rows open
 * the record's Free time list. A red line while the switch is off (owner ruling Q9).
 */
export default async function FreeTimePage({ searchParams }: { searchParams: Promise<{ ending?: string }> }) {
  await requirePlatformAreaView('free_time');
  const { ending } = await searchParams;
  const staff = await getStaffFreeTime();

  return <FreeTimeClient initialEnding={ending === '14'} switchOn={grantsEnabled()} staff={staff} />;
}
