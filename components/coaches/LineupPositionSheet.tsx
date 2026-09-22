'use client';
import { useId, useRef } from 'react';
import { useDialogFloor } from '@/components/coaches/useDialogFloor';
import { positionGroups, ordinal, type PositionChip } from '@/lib/lineup-position-groups';
import { playerDisplayName } from '@/lib/coach-roster-name';
import { BENCH_POSITION } from '@/lib/lineup-analysis';
import type { LineupPlayerRow } from '@/lib/lineup-grid';
import sheet from './CoachesBottomNav.module.css';
import own from './LineupPositionSheet.module.css';

/**
 * THE POSITION SHEET — one player's position in one inning, chosen from the foot of the screen
 * (phone re-evaluation stage 3 · D5, owner ruling 2026-09-21 on the third read: "remove the
 * chevrons like the calendar period selector; tapping opens a drawer from the bottom grouped by
 * our groups"). The phone's lineup list (`LineupInningList`) shows this inning's position as a
 * chevron-less pill; tapping it raises this. The grid's native `<select>` offers every code flat;
 * this offers them BY THE CHART — the same reason the inning inspector's picker became a list
 * carrying the chart's facts (D9): a coach choosing a position wants to see Best and Never, not
 * scroll a wheel.
 *
 * What it shows, in order: the player's name; "Inning 2 of 6 · playing CF · 3B in the 1st, LF in
 * the 3rd" (this inning's standing and the two neighbours, so the pick is made looking at both);
 * **Bench** as a 52px row; then chips (44px tall, 72 wide, wrapping) grouped by the depth chart's
 * THREE STATES — `Best` in rank order (`playerPositionPrefs().preferred`: Primary and Secondary
 * ARE ranks 1 and 2; the rank is the chip's second line), `Fine — anywhere not Never` (the sport's
 * roster vocabulary in neither list; the mound with "doesn't pitch" / "2 of 4 used" / "at cap"
 * from the pitcher profile and the reconciled cap), `Never` (red; ALLOWED and named, never
 * confirmed — D9's rule, the grid has no confirm either); and **Leave open** as a quiet row under
 * "Or". The current choice is filled and says "now". A chip carries a second line ONLY where the
 * chart has a fact (B6's rule). The owner's words were "primary, never, sometimes" — the product's
 * chart has three states (Best ranked / blank = fine / Never), so the sheet uses those. The
 * grouping itself is the pure `positionGroups` in lib/lineup-position-groups.ts.
 *
 * A tap applies through the editor's ONE `setPosition` mutation (one undo step) and closes;
 * Escape and the scrim close; focus returns to the pill (the floor's own restore).
 *
 * The fourth member of the phone's ONE sheet system (More · the team switcher · a player's RSVP ·
 * this): the nav module's own container — `.sheetAnchor` / `.sheetScrim` / `.dropdown` /
 * `.sheetGrab` from `CoachesBottomNav.module.css` — so the four share one skin, one grab line, one
 * radius. The anchor's foot is the BAR's top, as More's is: the builder is a page under the bar,
 * not a dialog over it. What differs is written in `LineupPositionSheet.module.css`. Only ever
 * rendered at ≤640 (the editor gates it on `useIsPhone`), where the nav module's sheet rules
 * exist; the desktop keeps its `<select>`.
 *
 * ⚠ Its own `useDialogFloor` (Escape, the Tab trap, focus back to the pill on close). ⚠ Not
 * registered with `useOverlayOpen` — none of the four sheets is. ⚠ Rendered in-tree, never
 * through a portal (the warm skin is a wrapper above the providers).
 */
export interface LineupPositionSheetProps {
  row: LineupPlayerRow;
  inning: number;
  inningCount: number;
  periodLabel: string;
  sportPack: { positions: string[]; fieldPositions: string[]; pitcherPosition: string | null };
  /** The effective per-game pitching cap for this row (player and team caps reconciled by the editor). */
  pitcherCap: number | null;
  /** The pick: a code, `Bench`, or `''` for Leave open. The caller writes it AND closes the sheet. */
  onPick: (code: string) => void;
  onClose: () => void;
}

export default function LineupPositionSheet({
  row, inning, inningCount, periodLabel, sportPack, pitcherCap, onPick, onClose,
}: LineupPositionSheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const nameId = useId();
  const subId = useId();
  useDialogFloor(true, panelRef, { onClose });

  const name = playerDisplayName(row.player);
  const current = row.inningPositions[String(inning)] ?? '';
  const prev = inning > 1 ? (row.inningPositions[String(inning - 1)] ?? '') : '';
  const next = inning < inningCount ? (row.inningPositions[String(inning + 1)] ?? '') : '';
  const standing = current === BENCH_POSITION ? 'on the bench' : current ? `playing ${current}` : 'open';
  const neighbours = [
    prev ? `${prev} in the ${ordinal(inning - 1)}` : null,
    next ? `${next} in the ${ordinal(inning + 1)}` : null,
  ].filter(Boolean).join(', ');
  const subline = `${periodLabel} ${inning} of ${inningCount} · ${standing}${neighbours ? ` · ${neighbours}` : ''}`;
  const { best, fine, never } = positionGroups(row, sportPack, pitcherCap, current);

  const chip = (c: PositionChip, tone?: 'never') => {
    const on = current === c.code;
    return (
      <button key={c.code} type="button" className={own.chip} aria-pressed={on} data-tone={tone ?? c.tone} onClick={() => onPick(c.code)}>
        <b>{c.code}</b>
        {on ? <small>now</small> : c.note ? <small>{c.note}</small> : null}
      </button>
    );
  };

  return (
    <div className={`${sheet.sheetAnchor} ${own.floor}`} data-position-sheet>
      <div className={sheet.sheetScrim} aria-hidden onClick={onClose} />
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`${sheet.dropdown} ${own.panel}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={nameId}
        aria-describedby={subId}
      >
        {/* The grab line is a real control at the floor — a tap on it closes, like the scrim. */}
        <button type="button" className={own.grabBtn} aria-label="Close" onClick={onClose}>
          <span className={sheet.sheetGrab} aria-hidden />
        </button>
        <div id={nameId} className={own.name}>{name}</div>
        <div id={subId} className={own.sub}>{subline}</div>
        <button type="button" className={own.benchRow} aria-pressed={current === BENCH_POSITION} onClick={() => onPick(BENCH_POSITION)}>
          <span className={own.benchMark} aria-hidden>▭</span>
          <span>{BENCH_POSITION}</span>
          {current === BENCH_POSITION && <small>now</small>}
        </button>
        {best.length > 0 && (
          <>
            <div className={own.groupHead}>Best</div>
            <div className={own.chips} role="group" aria-label="Best positions, in rank order">{best.map(c => chip(c))}</div>
          </>
        )}
        {fine.length > 0 && (
          <>
            <div className={own.groupHead}>Fine — anywhere not Never</div>
            <div className={own.chips} role="group" aria-label="Fine — anywhere not Never">{fine.map(c => chip(c))}</div>
          </>
        )}
        {never.length > 0 && (
          <>
            <div className={own.groupHead} data-tone="never">Never</div>
            <div className={own.chips} role="group" aria-label="Never on their chart">{never.map(c => chip(c, 'never'))}</div>
          </>
        )}
        <div className={own.groupHead}>Or</div>
        <button type="button" className={own.quietRow} aria-pressed={current === ''} onClick={() => onPick('')}>
          Leave open{current === '' && <small> · now</small>}
        </button>
      </div>
    </div>
  );
}
