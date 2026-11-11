'use client';
/**
 * THE EVENT SHEET — the tournament phone's event switcher, opened from the small line under the bar's page name (navigation
 * Phase 3, owner rulings E5 + R1–R4, 2026-11-11; drawings tab 6 and tab 16 "Phase 3 gate"). It replaced the More sheet's
 * native "Current tournament" picker, so each width has ONE way to change event: the sidebar's cell on a computer, this on a
 * phone.
 *
 * ⚖ THE SAME LIST AS THE COMPUTER'S (`EventSwitchItems`, rows from `eventSwitchRows`): the event's logo tile, its name and
 * "dates · phase", the current one olive with a check, finished events at the foot, "All tournaments" last. A person scoped to
 * some events sees only theirs — the list is the tournament context's, which already holds only those.
 *
 * ⚠ THE PORTAL'S SHEET FRAME IN ITS MENU LAYER (`SheetFrame`, D1–D2), the shape `CoachTeamSwitchSheet` wears: the small-caps
 * label and no ×; it stops at the bottom bar's top (`--coach-foot-clear`, which the admin shell defines at 900px and below)
 * and the bar stays lit and live; Escape, the phone's Back, a tap on the dim or past the sheet close it, and focus goes home
 * to the small line (`opener`). Add no dismiss hook of your own — the frame answers the keys. Rendered in-tree as the bar's
 * SIBLING (outside the sticky header's stacking context), never through a portal.
 *
 * Picking an event keeps you on the page (`setCurrentTournament`, as the computer's list does) — a button, because it does
 * not leave the page; "All tournaments" leaves it, so it is a link (the frame's back step must see the navigation).
 */
import { useEffect, useRef, type KeyboardEvent, type MouseEvent, type RefObject } from 'react';
import { useOrg } from '@/lib/org-context';
import { useTournament } from '@/lib/tournament-context';
import { eventSwitchRows } from '@/lib/admin-event-cell';
import { rovingMenuKey } from '@/lib/overlay-hooks';
import { useIsPhoneNav } from '@/lib/hooks/useIsPhoneNav';
import SheetFrame from '@/components/coaches/SheetFrame';
import { EventSwitchItems, focusCurrentItem, SWITCH_ITEMS } from './EventSwitchMenu';

export const ADMIN_EVENT_SHEET_ID = 'admin-event-sheet';

export default function AdminEventSwitchSheet({ base, onClose, opener }: {
  /** `/{orgSlug}/admin` — "All tournaments" opens the Tournaments list under it. */
  base: string;
  onClose: () => void;
  /** The small line that opened the sheet — where focus goes back, and part of the "tap outside" boundary. */
  opener: RefObject<HTMLElement | null>;
}) {
  const { tournaments, currentTournament, setCurrentTournament } = useTournament();
  const { currentOrg } = useOrg();
  const panelRef = useRef<HTMLDivElement>(null);

  // Focus lands on the event you are in (else the first row) once the frame has seated it on the sheet.
  useEffect(() => { focusCurrentItem(panelRef.current); }, []);

  // The door is the phone's (the bar's row is hidden above 900px): a window widened past it shuts the sheet rather than leave
  // it over a computer's page with nothing on screen that opened it. Here, not in the bar: the bar never reads a width.
  const phone = useIsPhoneNav();
  useEffect(() => { if (!phone) onClose(); }, [phone, onClose]);

  const rows = eventSwitchRows(tournaments, currentTournament?.id, currentOrg);
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    rovingMenuKey(e, Array.from(panelRef.current?.querySelectorAll<HTMLElement>(SWITCH_ITEMS) ?? []));
  };
  // Any row closes the sheet — the event you are already in too (the computer's menu does the same); the frame hands focus home.
  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    if ((e.target as Element).closest(SWITCH_ITEMS)) onClose();
  };

  return (
    <SheetFrame ref={panelRef} label="Tournaments" onClose={onClose} opener={opener} role="menu" aria-label="Tournaments"
      id={ADMIN_EVENT_SHEET_ID} onKeyDown={onKeyDown} onClick={onClick}>
      <EventSwitchItems
        rows={rows}
        allHref={`${base}/tournaments/manage`}
        onPick={id => { const t = tournaments.find(x => x.id === id); if (t) setCurrentTournament(t); }}
      />
    </SheetFrame>
  );
}
