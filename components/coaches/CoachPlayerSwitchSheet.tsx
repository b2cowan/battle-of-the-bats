'use client';
import { useEffect, useRef, type RefObject } from 'react';
import Link from 'next/link';
import SheetFrame from './SheetFrame';
import sheet from './CoachesBottomNav.module.css';

/** One roster row the sheet lists — the player route's own `roster` payload. */
export interface RosterSheetPlayer { id: string; name: string; number: string | null }

/**
 * THE ROSTER SHEET — the player switcher at 900 and below, opened from the player's NAME ▾ in the team bar
 * (phone re-evaluation stage 5 · F2, owner ruling 2026-09-23, "build as redrawn"; the hub's "5 · People" tab).
 * ⚖ It follows the CHROME's split, not the content's (navigation Phase 5b, D8, owner 2026-11-12): a tablet wears the phone's bar,
 * so it gets the sheet too, and the computer's name ▾ opens the switch list (`CoachPlayerSwitchMenu`). The `<select>` is gone.
 *
 * ⚠ WHY A SHEET AND NOT THE PREV/NEXT STEPPER FIRST DRAWN. The 13 September dropdown was reasoned in
 * the code as "a native select — the sidebar's team switcher is one too": it exists to MATCH the team
 * switcher. Stage 1 · B1 turned that switcher into a name + chevron + sheet, so honouring the ruling
 * today is this. The stepper traded random access for sequential access (eight presses to reach the
 * ninth player) and was withdrawn on the owner's read.
 *
 * ⚠ THE TEAM SHEET'S TWIN, ON THE PORTAL'S ONE SHEET FRAME — not a container of its own. The dim, the
 * container, the grab line, the height cap and the menu LABEL are `SheetFrame`'s (Sheet Frame step 2,
 * 2026-10-05 — until then the More sheet's own container, with its mono section label and, in dark, the
 * bar's colour); the row density is the More sheet's (`.dropItem` from `CoachesBottomNav.module.css`),
 * exactly as `CoachTeamSwitchSheet` uses them; nothing here is styled locally. It is a MENU (tap a name,
 * it acts, it closes), so under the sheet frame's D1 it sits on top of the bar with the nav visible and
 * tappable, and it does NOT enrol in `useOverlayOpen` — that would hide the bar the sheet sits on. A tap
 * on the dim hands focus back to the player's name (`opener`). No search box: the roster list itself has
 * none, and twelve names fit on one screen.
 *
 * The rows: the coach's own order (the route's active players — a call-up or a departed player is
 * never listed); the current player tinted with `aria-current`; no chevrons on any row (owner, 2026-09-24 —
 * the tint alone says "you are here", as on the team sheet); the jersey number as the quiet trailing qualifier. Each row opens that player ON THE TAB
 * THE COACH WAS READING — `href` is built by the page, which owns the tab and the way back.
 *
 * ⚖ PICKING A PLAYER SAVES FIRST AND GOES (navigation Phase 5b, A6·3, owner 2026-11-12) — as the computer's list does. Until then
 * the rows were links the page's `UnsavedChangesGuard` stopped to ask "Leave without saving?" while an edit sat inside the
 * autosave's pause; the record autosaves, so the honest move is to save it. `onPick` is the page's `switchTo` (a save already out
 * waits; a save that cannot land keeps the coach on the page with the pill saying so). The rows STAY LINKS — a long-press or a
 * modified click still opens a player in a new tab, and the address is the row's own — and carry `data-saves-first`, which tells
 * the guard this link saves for itself. A modified click is left to the browser.
 */
export default function CoachPlayerSwitchSheet({
  players,
  currentPlayerId,
  hrefFor,
  onPick,
  onClose,
  opener,
}: {
  players: RosterSheetPlayer[];
  currentPlayerId: string;
  /** The address for a player — the page keeps the coach's `?tab=` and way back on it. */
  hrefFor: (id: string) => string;
  /** Save a pending edit, then open that player (the page's `switchTo`). */
  onPick: (id: string) => void;
  onClose: () => void;
  /** The player's name that opened the sheet — where a tap on the dim hands focus back. */
  opener: RefObject<HTMLElement | null>;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Focus lands on the current row when the sheet opens (the team sheet lands on its first row;
  // here "where am I in the list" is the useful answer). The frame returns it to the name however the
  // sheet closes.
  useEffect(() => {
    const panel = panelRef.current;
    const here = panel?.querySelector<HTMLAnchorElement>('a[aria-current="true"]')
      ?? panel?.querySelector<HTMLAnchorElement>('a[role="menuitem"]');
    here?.focus({ preventScroll: true });
    here?.scrollIntoView({ block: 'nearest' });
  }, []);

  return (
    <SheetFrame ref={panelRef} label="Players" onClose={onClose} opener={opener} role="menu" aria-label="Players" id="coach-player-sheet">
      {players.map(p => {
        const active = p.id === currentPlayerId;
        return (
          <Link
            key={p.id}
            href={hrefFor(p.id)}
            className={`${sheet.dropItem} ${active ? sheet.dropActive : ''}`}
            role="menuitem"
            aria-current={active ? 'true' : undefined}
            data-saves-first=""
            onClick={e => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
              e.preventDefault();
              onClose();
              onPick(p.id);
            }}
          >
            <span className={sheet.dropItemName}>{p.name}</span>
            {p.number && <span className={sheet.dropItemMeta}>#{p.number}</span>}
          </Link>
        );
      })}
    </SheetFrame>
  );
}
