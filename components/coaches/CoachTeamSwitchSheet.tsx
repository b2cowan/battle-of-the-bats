'use client';
import { useEffect, useRef, type RefObject } from 'react';
import Link from 'next/link';
import type { CoachingAssignment, ClosedCoachingAssignment } from '@/lib/db';
import { coachTeamRoster, teamSwitchGroups } from '@/lib/coach-team-tile';
import SidebarLogoTile from '@/components/shared/SidebarLogoTile';
import SheetFrame, { SheetLabel } from './SheetFrame';
import sheet from './CoachesBottomNav.module.css';

/**
 * THE TEAM SHEET — the phone's team switcher (phone re-evaluation stage 1 · B1, owner ruling 2026-09-21), opened since
 * navigation Phase 5 (E8, owner 2026-11-12) from the bar's SMALL LINE — the team's name under the page's name, one 44px
 * target over both lines — rather than from a team name that headed the bar.
 *
 * ⚠ THE PORTAL'S SHEET FRAME, WITH THE MORE SHEET'S ROWS (Sheet Frame step 2, owner rulings D1–D2,
 * 2026-10-05). The container, the dim, the grab line, the height cap and the menu LABEL are `SheetFrame`'s
 * — the same sheet as the Tools and Filter sheets — and the ROWS are still the More sheet's
 * (`.dropItem` / `.dropActive` from `CoachesBottomNav.module.css`), so the two sheets keep one row density; the row's WORDS are the
 * computer list's since Phase 5 (F8 — see the note above the rows).
 * Until step 2 the whole sheet was the More sheet's own container, re-anchored outside the nav by a fixed
 * box that hand-copied the bar's height, titled in the small mono section label (a third head style) and,
 * in dark, painted the BAR'S colour rather than the card's. The rows are the one "Your teams" list built
 * on the §208 walk (2026-09-20): the current team tinted with
 * `aria-current`; NO row carries a chevron (owner, §228 walk 2026-09-24: the tint is enough to
 * tell "you are here" from the rest, and every other row is plainly tappable); a team with no live season sits under
 * "No live season" and still opens Season's End. That block used to
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
 * Back close it (before step 5 Back left the page), and every way out hands focus back to the bar's team line
 * (`opener`) — before step 2 a tap on the dim left it on `<body>`. A tap on the bar's More button is an
 * outside pointer-down that closes this sheet before More opens (measured: never both).
 *
 * ⚠ Rendered in-tree, never through a portal: the warm skin is a `[data-coach-warm-enabled]`
 * wrapper above the providers, and a body portal would escape it and paint the dark sheet on the
 * cream page — and would lose `--coach-foot-clear`, sitting under the bar.
 *
 * A computer never renders this — its switcher is the sidebar's team cell (`CoachTeamCell`, the same rows), and the bar
 * only offers the door below the nav breakpoint (`useIsPhoneNav`).
 */
export default function CoachTeamSwitchSheet({
  orgSlug,
  currentTeamId,
  assignments,
  closedAssignments,
  onClose,
  opener,
}: {
  orgSlug: string;
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

  // ⚖ THE COMPUTER LIST'S ROWS (navigation Phase 5, F8, owner 2026-11-12; E10): one source for both widths —
  // `teamSwitchGroups` — so a row is the team's tile (its crest, else its colour, else its initials: the phone's one place a
  // crest shows), its name and its season's words ("2026 Season", "2027 Season · Draft"), under "Your teams" then "No live
  // season". This brings back the "No live season" group the 2026-09-20 walk had folded into a trailing qualifier, on purpose:
  // the phone reads the computer's list now. The current team is TINTED, never checked (owner, §228 walk 2026-09-24: the tint
  // is enough). A team mid-rollover (two live seasons) is ONE row (`coachTeamRoster`, the team cell's own count).
  // A live team opens its Overview; one with no live season opens its season's page, its one door (CLAUDE.md).
  const groups = teamSwitchGroups(orgSlug, coachTeamRoster(assignments, closedAssignments).live, closedAssignments, currentTeamId);

  return (
    <SheetFrame ref={panelRef} label="Your teams" onClose={onClose} opener={opener} role="menu" aria-label="Your teams" id="coach-team-sheet">
      {groups.map(g => (
        <div key={g.label} role="group" aria-label={g.label}>
          {/* "Your teams" is the sheet's own label; any other group ("No live season") is named in the frame's one label
              voice (`SheetLabel`) — never the More sheet's section label — even when it is the only group (every team
              between seasons; /review 2026-11-12). */}
          {g.label !== 'Your teams' && <div aria-hidden><SheetLabel>{g.label}</SheetLabel></div>}
          {g.rows.map(row => (
            <Link
              key={row.teamId}
              href={row.href}
              className={`${sheet.dropItem} ${row.current ? sheet.dropActive : ''}`}
              role="menuitem"
              aria-current={row.current ? 'true' : undefined}
              onClick={onClose}
            >
              <SidebarLogoTile source={row.tile.source} aspect={row.tile.aspect} color={row.tile.color} name={row.name} size={24} />
              <span className={sheet.dropItemText}>
                <span className={sheet.dropItemName}>{row.name}</span>
                {row.line && <span className={sheet.dropItemLine}>{row.line}</span>}
              </span>
            </Link>
          ))}
        </div>
      ))}
    </SheetFrame>
  );
}
