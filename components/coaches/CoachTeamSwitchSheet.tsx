'use client';
import { useEffect, useRef, type RefObject } from 'react';
import Link from 'next/link';
import type { CoachingAssignment, ClosedCoachingAssignment } from '@/lib/db';
import SheetFrame from './SheetFrame';
import sheet from './CoachesBottomNav.module.css';

/**
 * THE TEAM SHEET — the phone's team switcher, opened from the team name in the masthead (phone
 * re-evaluation stage 1 · B1, owner ruling 2026-09-21; drawn on the hub's "1 · The first screen"
 * tab and ruled "build as drawn").
 *
 * ⚠ THE PORTAL'S SHEET FRAME, WITH THE MORE SHEET'S ROWS (Sheet Frame step 2, owner rulings D1–D2,
 * 2026-10-05). The container, the dim, the grab line, the height cap and the menu LABEL are `SheetFrame`'s
 * — the same sheet as the Tools and Filter sheets — and the ROWS are still the More sheet's
 * (`.dropItem` / `.dropActive` from `CoachesBottomNav.module.css`), so the two sheets keep one row density.
 * Until step 2 the whole sheet was the More sheet's own container, re-anchored outside the nav by a fixed
 * box that hand-copied the bar's height, titled in the small mono section label (a third head style) and,
 * in dark, painted the BAR'S colour rather than the card's. The rows are the one "Your teams" list built
 * on the §208 walk (2026-09-20): the current team tinted with
 * `aria-current`; NO row carries a chevron (owner, §228 walk 2026-09-24: the tint is enough to
 * tell "you are here" from the rest, and every other row is plainly tappable); a team with no live season carries
 * its season's NAME as a quiet trailing qualifier and still opens Season's End. That block used to
 * sit inside More, where it cost 133px above the three tools a coach opens the sheet for; the
 * masthead's name is where TeamSnap and TeamLinkt put the switch, and it is where the walk's
 * owner reached for it.
 *
 * ⚠ A MENU, SO IT SITS ON TOP OF THE BAR (D1): a stray tap on the bar loses nothing. The frame stops at
 * the bar's top (`--coach-foot-clear`, inherited because it renders in-tree inside `.coachesShell`) at
 * z-index 260 — under the nav's 300, over the autosave pill's 250 — so the bar stays visible and
 * tappable. Deliberately NOT registered with `useOverlayOpen`: that would hide the bar it sits on. The
 * masthead renders it as a SIBLING of the sticky header, outside the header's own stacking context. The
 * frame answers its keys (Sheet Frame step 5): a tap on the dim closes it cleanly, Escape and the phone's
 * Back close it (before step 5 Back left the page), and every way out hands focus back to the team name
 * (`opener`) — before step 2 a tap on the dim left it on `<body>`. A tap on the bar's More button is an
 * outside pointer-down that closes this sheet before More opens (measured: never both).
 *
 * ⚠ Rendered in-tree, never through a portal: the warm skin is a `[data-coach-warm-enabled]`
 * wrapper above the providers, and a body portal would escape it and paint the dark sheet on the
 * cream page — and would lose `--coach-foot-clear`, sitting under the bar.
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
  opener,
}: {
  /** `/{orgSlug}/coaches` — the rows' hrefs hang off it exactly as the More rows did. */
  base: string;
  currentTeamId: string;
  assignments: CoachingAssignment[];
  closedAssignments: ClosedCoachingAssignment[];
  onClose: () => void;
  /** The team name that opened the sheet — where a tap on the dim hands focus back. */
  opener: RefObject<HTMLElement | null>;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Focus lands on the first row when the sheet opens (after the frame seats it on the sheet); the frame
  // returns it to the name however the sheet closes.
  useEffect(() => {
    panelRef.current?.querySelector<HTMLAnchorElement>('a[role="menuitem"]')?.focus({ preventScroll: true });
  }, []);

  return (
    <SheetFrame ref={panelRef} label="Your teams" onClose={onClose} opener={opener} role="menu" aria-label="Your teams" id="coach-team-sheet">
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
          </Link>
        );
      })}
    </SheetFrame>
  );
}
