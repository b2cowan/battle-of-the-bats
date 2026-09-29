'use client';
/**
 * The refused-save notice (Club Tier Stage 2, specimen 4 frame C): "Northfield Minor Ball closed the
 * 2026 Season a minute ago, so this change wasn't saved." + the one door, the season's page.
 *
 * Mounted once by the team layout. It installs the portal's season-refusal watcher
 * (`lib/season-refusal-watch.ts`) and shows the notice when a save for THIS team came back with the
 * coded `season_not_live` answer — above the page, which it does not touch: the screen and every
 * value the coach typed stay on screen. The door is the team's closed-season page (it already knows
 * its season — no year parameter). Leaving the page clears it; the next page loads the season gate.
 * A white card with the live-red edge (tinted panels retired 2026-09-21).
 */
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import {
  SEASON_NOT_LIVE_EVENT, installSeasonRefusalWatch, isForTeam, type SeasonNotLiveDetail,
} from '@/lib/season-refusal-watch';
import css from './CoachSeasonRefusalNotice.module.css';

export default function CoachSeasonRefusalNotice({ teamId, closedHref }: { teamId: string; closedHref: string }) {
  const pathname = usePathname();
  const [refusal, setRefusal] = useState<SeasonNotLiveDetail | null>(null);
  const [shownOn, setShownOn] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    installSeasonRefusalWatch();
    const onRefusal = (e: Event) => {
      const detail = (e as CustomEvent<SeasonNotLiveDetail>).detail;
      if (!detail || !isForTeam(detail.url, teamId)) return;
      setRefusal(detail);
      setShownOn(window.location.pathname);
    };
    window.addEventListener(SEASON_NOT_LIVE_EVENT, onRefusal);
    return () => window.removeEventListener(SEASON_NOT_LIVE_EVENT, onRefusal);
  }, [teamId]);

  // Bring it into view once, so a coach deep in a long form sees why the save didn't land.
  useEffect(() => {
    if (refusal) ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [refusal]);

  // The notice belongs to the page it happened on; another page loads the season gate instead.
  if (!refusal || shownOn !== pathname) return null;

  return (
    <div ref={ref} className={css.notice} role="alert">
      <AlertTriangle size={16} aria-hidden className={css.icon} />
      <div className={css.body}>
        <p className={css.text}>{refusal.error}</p>
        <Link href={closedHref} className="btn btn-outline btn-sm">
          {refusal.seasonName ? `Open the ${refusal.seasonName}` : 'Open the season’s page'}
        </Link>
      </div>
    </div>
  );
}
