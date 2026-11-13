'use client';
/**
 * ⚖ THE PLAYER SWITCH LIST, ON A COMPUTER (navigation Phase 5b, D3 + A2, owner 2026-11-12): what the player's name ▾ opens in the
 * strip ("← Roster │ Avery Test ▾"). The shipped switch window — the event list's and the team cell's (`SidebarMenu`, its
 * keyboard contract and its 320px, here `under` the name, 2px down) — with the roster sheet's rows: the player's name, then
 * "#12" in the list's trailing slot (`convWhatOptLive`). One line, not the event list's two: the roster the page already loads
 * has only the name and the number. Head "Players"; the current player olive with a check; 44px rows with hairlines; a long
 * roster scrolls inside the window's height cap. No foot row: the strip's arrow already leads to Roster.
 *
 * Picking SAVES FIRST AND GOES (`onPick` is the page's `switchTo`): a pending edit is saved, a save already out waits, a save that
 * cannot land keeps the coach on the page with the pill saying so — and the TAB is kept (the page's `hrefFor`). The rows are links
 * (a modified click opens a player in a new tab) carrying `data-saves-first`, so the unsaved-changes guard lets them through.
 * The phone and tablet open the roster sheet instead (`CoachPlayerSwitchSheet`) — the chrome's split, 900.
 */
import Link from 'next/link';
import { type RefObject } from 'react';
import { Check } from 'lucide-react';
import SidebarMenu from '@/components/shared/SidebarMenu';
import type { RosterSheetPlayer } from './CoachPlayerSwitchSheet';
import coachKit from '@/app/[orgSlug]/coaches/coaches.module.css';
import list from '@/components/shared/SidebarSwitchList.module.css';

const WIDTH = 320;

export default function CoachPlayerSwitchMenu({ open, anchorRef, players, currentPlayerId, hrefFor, onPick, onClose }: {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  players: RosterSheetPlayer[];
  currentPlayerId: string;
  hrefFor: (id: string) => string;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <SidebarMenu
      open={open}
      anchorRef={anchorRef}
      label="Players"
      placement="under"
      width={WIDTH}
      className={coachKit.convWhatList}
      onClose={onClose}
    >
      <div className={coachKit.convWhatGroup} aria-hidden>Players</div>
      {open && players.map(p => { // rows are built only while open (the page re-renders on every edit; the menu renders nothing closed)
        const current = p.id === currentPlayerId;
        return (
          <Link
            key={p.id}
            href={hrefFor(p.id)}
            role="menuitem"
            tabIndex={-1}
            className={`${coachKit.convWhatOpt} ${list.switchRow}`}
            aria-current={current ? 'true' : undefined}
            data-saves-first=""
            onClick={e => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
              e.preventDefault();
              // The player you are on: picking them again only closes the list (the team cell's rule).
              if (!current) onPick(p.id);
            }}
          >
            <span className={list.switchText}>
              <span className={`${coachKit.convWhatOptName}${current ? ` ${list.switchCurrent}` : ''}`}>{p.name}</span>
            </span>
            {p.number && <span className={coachKit.convWhatOptLive}>#{p.number}</span>}
            {current && <Check size={16} aria-hidden className={list.switchIcon} />}
          </Link>
        );
      })}
    </SidebarMenu>
  );
}
