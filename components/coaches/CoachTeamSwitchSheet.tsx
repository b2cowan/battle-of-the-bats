'use client';
import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { CoachingAssignment, ClosedCoachingAssignment } from '@/lib/db';
import sheet from './CoachesBottomNav.module.css';

/**
 * THE TEAM SHEET — the phone's team switcher, opened from the team name in the masthead (phone
 * re-evaluation stage 1 · B1, owner ruling 2026-09-21; drawn on the hub's "1 · The first screen"
 * tab and ruled "build as drawn").
 *
 * It is the More sheet's own container and rows, moved: the same `.sheetScrim` / `.dropdown` /
 * `.dropItem` rules from `CoachesBottomNav.module.css`, so the two sheets are one sheet system
 * (one skin in dark and warm, one grab line, one row density) — not a second copy. The rows are
 * the one "Your teams" list built on the §208 walk (2026-09-20): the current team tinted with
 * `aria-current` and no chevron ("you are here", not a door); a team with no live season carries
 * its season's NAME as a quiet trailing qualifier and still opens Season's End. That block used to
 * sit inside More, where it cost 133px above the three tools a coach opens the sheet for; the
 * masthead's name is where TeamSnap and TeamLinkt put the switch, and it is where the walk's
 * owner reached for it.
 *
 * ⚠ POSITIONED BY AN ANCHOR, NOT BY THE NAV. The nav module's sheet rules are `position: absolute;
 * bottom: 100%` against the NAV (its `backdrop-filter` is why the More sheet cannot be `fixed`).
 * This sheet is not inside the nav, so it sits inside `.sheetAnchor` — a zero-height `fixed` box
 * pinned to the bar's top edge — and the same absolute rules resolve against that: the scrim
 * covers the page above the bar, the panel rises from the bar, the bar stays visible and tappable
 * beneath (z-index 260: below the nav's 300, above the autosave pill's 250). Deliberately NOT
 * registered with `useOverlayOpen`: that would hide the bar the sheet is drawn against. The
 * masthead renders it as a SIBLING of the sticky header, outside the header's own stacking
 * context, and passes both boundaries to `useDismissable` — a tap on the bar's More button is
 * an outside pointer-down that closes this sheet before More opens (measured: never both).
 *
 * ⚠ Rendered in-tree, never through a portal: the warm skin is a `[data-coach-warm-enabled]`
 * wrapper above the providers, and a body portal would escape it and paint the dark sheet on the
 * cream page.
 *
 * The desktop never renders this — its switcher is the sidebar's own `<select>` (untouched), and
 * the masthead only offers the button below the nav breakpoint (`useIsPhoneNav`).
 */
export default function CoachTeamSwitchSheet({
  base,
  currentTeamId,
  assignments,
  closedAssignments,
  onClose,
}: {
  /** `/{orgSlug}/coaches` — the rows' hrefs hang off it exactly as the More rows did. */
  base: string;
  currentTeamId: string;
  assignments: CoachingAssignment[];
  closedAssignments: ClosedCoachingAssignment[];
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Focus lands on the first row when the sheet opens — the trigger's `useDismissable` returns it
  // to the name on Escape; a tap-away leaves it where the tap went.
  useEffect(() => {
    panelRef.current?.querySelector<HTMLAnchorElement>('a[role="menuitem"]')?.focus({ preventScroll: true });
  }, []);

  return (
    <div className={sheet.sheetAnchor}>
      {/* The page behind the sheet — a tap on it closes the sheet (as the More sheet's scrim does). */}
      <div className={sheet.sheetScrim} aria-hidden onClick={onClose} />
      <div ref={panelRef} className={sheet.dropdown} role="menu" aria-label="Your teams" id="coach-team-sheet">
        <span className={sheet.sheetGrab} aria-hidden />
        <div className={sheet.dropSectionLabel}>Your teams</div>
        {assignments.map(a => {
          const active = currentTeamId === a.teamId;
          return (
            <Link
              key={a.teamId}
              href={`${base}/teams/${a.teamId}`}
              className={`${sheet.dropItem} ${active ? sheet.dropActive : ''}`}
              role="menuitem"
              aria-current={active ? 'true' : undefined}
              onClick={onClose}
            >
              {a.teamColor && (
                <span style={{ width: 10, height: 10, borderRadius: 2, background: a.teamColor, flexShrink: 0 }} />
              )}
              <span className={sheet.dropItemName}>{a.teamName}</span>
              {!active && <ChevronRight size={14} className={sheet.dropChevron} />}
            </Link>
          );
        })}
        {closedAssignments.map(a => {
          const active = currentTeamId === a.teamId;
          return (
            <Link
              key={a.teamId}
              href={`${base}/teams/${a.teamId}/season-end`}
              className={`${sheet.dropItem} ${active ? sheet.dropActive : ''}`}
              role="menuitem"
              aria-current={active ? 'true' : undefined}
              onClick={onClose}
            >
              {a.teamColor && (
                <span style={{ width: 10, height: 10, borderRadius: 2, background: a.teamColor, flexShrink: 0, opacity: 0.7 }} />
              )}
              <span className={sheet.dropItemName}>{a.teamName}</span>
              <span className={sheet.dropItemMeta}>{a.programYearName}</span>
              {!active && <ChevronRight size={14} className={sheet.dropChevron} />}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
