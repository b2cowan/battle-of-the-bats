'use client';
import { useEffect, useRef } from 'react';
import Link from 'next/link';
import sheet from './CoachesBottomNav.module.css';

/** One roster row the sheet lists — the player route's own `roster` payload. */
export interface RosterSheetPlayer { id: string; name: string; number: string | null }

/**
 * THE ROSTER SHEET — the phone's player switcher, opened from the player's NAME in the page header
 * (phone re-evaluation stage 5 · F2, owner ruling 2026-09-23, "build as redrawn"; the hub's
 * "5 · People" tab). The desktop and the 641–768 band keep the Switch player `<select>`.
 *
 * ⚠ WHY A SHEET AND NOT THE PREV/NEXT STEPPER FIRST DRAWN. The 13 September dropdown was reasoned in
 * the code as "a native select — the sidebar's team switcher is one too": it exists to MATCH the team
 * switcher. Stage 1 · B1 turned that switcher into a name + chevron + sheet, so honouring the ruling
 * today is this. The stepper traded random access for sequential access (eight presses to reach the
 * ninth player) and was withdrawn on the owner's read.
 *
 * ⚠ THE TEAM SHEET'S TWIN, AND A THIRD CALLER ON ONE SHEET SYSTEM — not a fourth container. The
 * anchor, scrim, panel, grab line and row density are the More sheet's own rules from
 * `CoachesBottomNav.module.css`, exactly as `CoachTeamSwitchSheet` uses them; nothing here is styled
 * locally. It is a MENU (tap a name, it acts, it closes), so under the drawer-layers ruling
 * (2026-09-23) it stops at the bar's top with the nav visible, undimmed and tappable, and it does
 * NOT enrol in `useOverlayOpen` — that would hide the bar the sheet is drawn against. No search box:
 * the roster list itself has none, and twelve names fit on one screen.
 *
 * The rows: the coach's own order (the route's active players — a call-up or a departed player is
 * never listed); the current player tinted with `aria-current`; no chevrons on any row (owner, 2026-09-24 —
 * the tint alone says "you are here", as on the team sheet); the jersey number as the quiet trailing qualifier. Each row opens that player ON THE TAB
 * THE COACH WAS READING — `href` is built by the page, which owns the tab and the way back.
 *
 * ⚠ THE ROWS ARE LINKS, AND THAT IS HOW THEY ASK THE UNSAVED-CHANGES QUESTION. The `<select>` had to
 * ask by hand because a select is not a link and the page's `UnsavedChangesGuard` intercepts anchor
 * clicks only (/review, 2026-09-13). A row here IS an anchor, so the guard's capture-phase listener
 * sees it first and asks — a second, hand-written ask would never run (the guard stops the click
 * before it reaches the row). Nothing to add; do not "fix" it by turning the rows into buttons.
 */
export default function CoachPlayerSwitchSheet({
  players,
  currentPlayerId,
  hrefFor,
  onClose,
}: {
  players: RosterSheetPlayer[];
  currentPlayerId: string;
  /** The address for a player — the page keeps the coach's `?tab=` and way back on it. */
  hrefFor: (id: string) => string;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Focus lands on the current row when the sheet opens (the team sheet lands on its first row;
  // here "where am I in the list" is the useful answer). The trigger's `useDismissable` returns it
  // to the name on Escape; a tap-away leaves it where the tap went.
  useEffect(() => {
    const panel = panelRef.current;
    const here = panel?.querySelector<HTMLAnchorElement>('a[aria-current="true"]')
      ?? panel?.querySelector<HTMLAnchorElement>('a[role="menuitem"]');
    here?.focus({ preventScroll: true });
    here?.scrollIntoView({ block: 'nearest' });
  }, []);

  return (
    <div className={sheet.sheetAnchor}>
      {/* The page behind the sheet — a tap on it closes the sheet (as the team sheet's scrim does). */}
      <div className={sheet.sheetScrim} aria-hidden onClick={onClose} />
      <div ref={panelRef} className={sheet.dropdown} role="menu" aria-label="Players" id="coach-player-sheet">
        <span className={sheet.sheetGrab} aria-hidden />
        <div className={sheet.dropSectionLabel}>Players</div>
        {players.map(p => {
          const active = p.id === currentPlayerId;
          return (
            <Link
              key={p.id}
              href={hrefFor(p.id)}
              className={`${sheet.dropItem} ${active ? sheet.dropActive : ''}`}
              role="menuitem"
              aria-current={active ? 'true' : undefined}
              onClick={onClose}
            >
              <span className={sheet.dropItemName}>{p.name}</span>
              {p.number && <span className={sheet.dropItemMeta}>#{p.number}</span>}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
