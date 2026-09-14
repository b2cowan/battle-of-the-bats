'use client';
import CoachTabBar from '@/components/coaches/CoachTabBar';
import { practicePlansHref, type PracticePlansSection } from '@/lib/practice-plans-address';

/**
 * The Practice plans room's tab row — Practices · Templates · Drills (practices re-evaluation
 * stage 0, owner ruling D5, 2026-09-14). Practices is the landing; the two libraries are one tap
 * to the side, never above the season's list. Each tab is a real address (`?section=`), the
 * Skills & Goals / Money / Insights idiom, so the plan page's picker and the help can point at one.
 *
 * ⚠ ABSENT, never disabled, for a viewer the page would refuse. Both library reads gate on
 * "Schedule: View + edit" (`canManageSchedule`); an assistant with schedule view alone sees only
 * Practices — and `CoachTabBar` renders nothing for a row of one tab, so the bar itself goes.
 *
 * ⚠ No fourth tab and no overview tab (D8). The next-practice card and the "Needs a plan" chip
 * are the room's whole state; counts of drills and templates are door labels and live on their tabs.
 */
export default function PracticePlansTabs({
  base,
  active,
  showLibrary,
}: {
  base: string;
  active: PracticePlansSection;
  /** Whether this coach may open the two libraries (the reads refuse anyone else). */
  showLibrary: boolean;
}) {
  const tabs: { id: PracticePlansSection; label: string; href: string }[] = [
    { id: 'practices', label: 'Practices', href: practicePlansHref(base) },
    ...(showLibrary
      ? [
          { id: 'templates' as const, label: 'Templates', href: practicePlansHref(base, 'templates') },
          { id: 'drills' as const, label: 'Drills', href: practicePlansHref(base, 'drills') },
        ]
      : []),
  ];
  return <CoachTabBar tabs={tabs} activeId={active} ariaLabel="Practice plans views" />;
}
