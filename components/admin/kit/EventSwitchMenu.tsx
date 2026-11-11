'use client';
/**
 * EventSwitchMenu — the list the event's cell opens (navigation Phase 2 Part A; drawings tab 14, owner rulings T3 and T6,
 * 2026-11-10). ONE window, under the cell while the sidebar is open and beside the 40px tile while it is folded (where the
 * strip's menu opened before); it replaced the native `<select id="admin-tournament-select">` and the strip's tile menu.
 *
 * ⚖ ITS ROWS ARE THE PORTAL'S STANDARD TWO-LINE DROPDOWN ROW (owner's change to T3): `SublinedChoice`'s list — the same
 * classes (`convWhat*`, coaches.module.css), so it cannot drift from it — the event's name 14px semibold, its dates and phase
 * word on a 12px tertiary line ("Nov 1–3, 2026 · Game day", `eventSwitchLine`), 44px rows with a hairline between them, the
 * olive tint under a pointer and on keyboard focus. The current event's name is olive with an olive check on the right. The
 * head is that list's group band ("Tournaments"); "All tournaments" at the foot opens the Tournaments list. ⚖ Since navigation
 * Phase 3 (owner 2026-11-11) the event's 24px logo tile leads every row, here and in the phone's sheet (`EventSwitchItems`).
 *
 * ⚖ ITS KEYBOARD CONTRACT AND PLACEMENT ARE THE SHARED SIDEBAR MENU'S (`SidebarMenu`, placement `cell` — navigation Phase 4,
 * Step 0): focus lands on the current event; the arrows rove; Escape, Tab and a press outside close it; under the open cell,
 * beside the folded tile. The coach team cell wears the same window and the same rows' classes.
 */
import Link from 'next/link';
import { type RefObject } from 'react';
import { Check, Trophy } from 'lucide-react';
import type { EventSwitchRow } from '@/lib/admin-event-cell';
import SidebarLogoTile from '@/components/shared/SidebarLogoTile';
import SidebarMenu from '@/components/shared/SidebarMenu';
import coachKit from '@/app/[orgSlug]/coaches/coaches.module.css';
import styles from '@/components/shared/SidebarSwitchList.module.css';

/** The drawing's window: 320 wide (T3), 2px below the open cell, 8px beside the folded tile, 8px clear of the window's edges. */
const WIDTH = 320;

export default function EventSwitchMenu({ open, anchorRef, rows, allHref, onPick, onClose }: {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  rows: readonly EventSwitchRow[];
  /** The Tournaments list (E3): the foot row. */
  allHref: string;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <SidebarMenu
      open={open}
      anchorRef={anchorRef}
      label="Tournaments"
      placement="cell"
      width={WIDTH}
      className={coachKit.convWhatList}
      onClose={onClose}
    >
      <div className={coachKit.convWhatGroup} aria-hidden>Tournaments</div>
      <EventSwitchItems rows={rows} allHref={allHref} onPick={onPick} roving />
    </SidebarMenu>
  );
}

/**
 * ⚖ THE LIST'S ROWS, ONCE (navigation Phase 3, owner 2026-11-11): worn by this menu on a computer and by the bar's sheet on a
 * phone (`AdminEventSwitchSheet`), so the two lists are one. Each row leads with the event's tile (R2, widened to both widths),
 * then its name and "dates · phase", the current one olive with a check; "All tournaments" at the foot, its trophy in a box the
 * tile's width so the words line up. `roving`: the menu's arrows own the keys (every item `tabIndex={-1}`); the sheet leaves
 * the rows in the Tab order, and Tab past the last closes it (the frame's menu layer).
 */
export function EventSwitchItems({ rows, allHref, onPick, roving = false }: {
  rows: readonly EventSwitchRow[];
  allHref: string;
  onPick: (id: string) => void;
  roving?: boolean;
}) {
  const tabIndex = roving ? -1 : undefined;
  return (
    <>
      {rows.map(row => (
        <button
          key={row.id}
          type="button"
          role="menuitem"
          tabIndex={tabIndex}
          className={`${coachKit.convWhatOpt} ${styles.switchRow}`}
          aria-current={row.current ? 'true' : undefined}
          onClick={() => { if (!row.current) onPick(row.id); }}
        >
          <SidebarLogoTile source={row.source} aspect={row.aspect} name={row.name} size={24} />
          <span className={styles.switchText}>
            <span className={`${coachKit.convWhatOptName}${row.current ? ` ${styles.switchCurrent}` : ''}`}>{row.name}</span>
            <span className={coachKit.convWhatOptSub}>{row.line}</span>
          </span>
          {row.current && <Check size={16} aria-hidden className={styles.switchIcon} />}
        </button>
      ))}
      <Link href={allHref} role="menuitem" tabIndex={tabIndex} className={`${coachKit.convWhatOpt} ${styles.switchRow} ${styles.switchAll}`}>
        <span className={styles.switchAllIcon} aria-hidden><Trophy size={15} className={styles.switchIcon} /></span>
        <span className={styles.switchAllText}>All tournaments</span>
      </Link>
    </>
  );
}
