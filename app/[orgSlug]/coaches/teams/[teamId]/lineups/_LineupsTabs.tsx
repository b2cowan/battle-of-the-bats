'use client';
import CoachTabBar from '@/components/coaches/CoachTabBar';
import { lineupsHref, type LineupsSection } from '@/lib/lineups-address';

/**
 * The Lineups room's tab row — Games · Templates (the hub brought level with the Practice plans
 * room, owner ask 2026-09-18). Games is the landing; the template library is one tap to the side,
 * never above the season's list. Each tab is a real address (`?section=`), the Practice plans /
 * Skills & Goals / Money / Insights idiom, so the template editor's back door and the help can
 * point at one.
 *
 * ⚠ This replaced the dark SEGMENTED control (`segChoice`) the hub wore since 2026-07-08. That
 * control is the portal's word for a VIEW switch on one list (List ⇄ Depth chart, 9-player ⇄
 * everyone bats); two rooms of different content are hub tabs, and every other hub already said
 * so. The two tabs are always offered — viewing templates is a read every coach with the lineups
 * duty holds — so `CoachTabBar`'s one-tab collapse never fires here.
 */
export default function LineupsTabs({ base, active }: { base: string; active: LineupsSection }) {
  const tabs: { id: LineupsSection; label: string; href: string }[] = [
    { id: 'games', label: 'Games', href: lineupsHref(base) },
    { id: 'templates', label: 'Templates', href: lineupsHref(base, 'templates') },
  ];
  return <CoachTabBar tabs={tabs} activeId={active} ariaLabel="Lineups views" />;
}
