'use client';
import { useId, type RefObject } from 'react';
import SheetFrame from '@/components/coaches/SheetFrame';
import { positionGroups, ordinal, type PositionChip } from '@/lib/lineup-position-groups';
import { playerDisplayName } from '@/lib/coach-roster-name';
import { BENCH_POSITION } from '@/lib/lineup-analysis';
import type { LineupPlayerRow } from '@/lib/lineup-grid';
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
 * Escape, Back, the dim and the grab line close; focus returns to the pill (`opener`).
 *
 * ⚖ ON THE PORTAL'S SHEET FRAME, IN THE MENU LAYER (Sheet Frame step 4, owner 2026-10-06). Picking a
 * position loses nothing if a thumb strays onto the bar, so the sheet sits ON the bar, the bar lit and
 * live, and it is never modal — it claimed `aria-modal` and held the keyboard while the bar stayed
 * tappable until step 4. The frame owns its keys (as it does every sheet's since step 5: Escape, Back,
 * focus in and home, Tab past the end closes it, a tap on the bar closes it first) and draws its grab
 * line as the record head's 44px
 * Close (`grabCloses`, D3). The record head is the player and the inning; the chips' 14px inset is the
 * content's own (`.body`). Only ever rendered at ≤640 (the editor and the console gate it on
 * `useIsPhone`), inside the frame's breakpoint; the desktop keeps its `<select>`.
 *
 * ⚠ The `data-position-sheet` marker stays on a wrapper: the layout sweep finds the dialog INSIDE it.
 * ⚠ Rendered in-tree, never through a portal (the warm skin is a wrapper above the providers).
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
  /** The pill that opened it — focus goes home to it (a tap on iOS never focused it). */
  opener: RefObject<HTMLElement | null>;
}

export default function LineupPositionSheet({
  row, inning, inningCount, periodLabel, sportPack, pitcherCap, onPick, onClose, opener,
}: LineupPositionSheetProps) {
  const nameId = useId();
  const subId = useId();

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
    <div data-position-sheet style={{ display: 'contents' }}>
      <SheetFrame grabCloses onClose={onClose} opener={opener} role="dialog" aria-labelledby={nameId} aria-describedby={subId}>
        <div className={own.body}>
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
      </SheetFrame>
    </div>
  );
}
