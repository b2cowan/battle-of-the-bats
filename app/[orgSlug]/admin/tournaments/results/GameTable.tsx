'use client';
/**
 * THE GAME ROW AT A DESK — Sidebar Strip & Grid Width Stage 3, Ask 16 (owner 2026-10-17, as recommended; hub
 * https://claude.ai/artifact/5s1QP7HHsctVso78u5tUjC screen 15). The Schedule's Day and All games and Results read their
 * games down columns: When · Game · Field · Division · Status · arrow, under ONE heading row per frame, rows 60 tall
 * (81 as the stacked row). A busy game day is read down the Field and the Division — the exception register's K row
 * to the standard's C5 "One booking row".
 *
 * Phones, and any list too narrow for the columns (a tablet, a small laptop with the sidebar open), keep today's
 * stacked row EXACTLY — the caller renders the kit's `ClubRow` there; `useGameTableFits` says which.
 *
 * Its own component, never `ClubRow` (~40 importers). The Game column is Results' `GameTeams`, so a win still reads as
 * today's green score. Each row is ONE control: the Game cell's button stretches its cover over the whole row; only
 * the Status column's own action (Results' Finalize) sits above the cover, so the two targets touch and never overlap.
 */
import { useId, useState, type CSSProperties, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import type { Division, Game, Team, Venue } from '@/lib/types';
import { repKit } from '@/components/admin/kit/club/RepKit';
import { GAME_TABLE_HEADINGS as H, gameWhenLines } from '@/lib/game-day-words';
import { bracketRoundLabel } from '@/lib/playoff-bracket';
import { gamePoolId } from '@/lib/schedule-day';
import { VENUE_FACILITY_SEPARATOR, resolveGameVenueParts } from '@/lib/venue-label';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import { useWidthAtLeast } from '@/lib/hooks/useWidthAtLeast';
import styles from './GameTable.module.css';

/** The drawing's columns (hub screen 15), in px. The CSS reads the template from here, so the width the row needs
 *  (`MIN_WIDTH`) and the columns it draws are one set of numbers. */
const COL = { when: 92, gameMin: 254, gameMax: 314, fieldMin: 190, divisionMin: 120, arrow: 16, gap: 13.6, padX: 17.6 };
/** The Status column: the Day view's chips ("Pending review", "Tight turnover"), Results' Finalize. */
const STATUS_WIDTH = { day: 124, results: 112 } as const;
export type GameTableKind = keyof typeof STATUS_WIDTH;

const columns = (status: number) =>
  ({ '--game-table-cols': `${COL.when}px minmax(${COL.gameMin}px, ${COL.gameMax}px) minmax(${COL.fieldMin}px, 1fr) minmax(${COL.divisionMin}px, 0.7fr) ${status}px ${COL.arrow}px` }) as CSSProperties;
const COLUMNS: Record<GameTableKind, CSSProperties> = { day: columns(STATUS_WIDTH.day), results: columns(STATUS_WIDTH.results) };
/** The list width the columns need at their floors: the tracks, five gaps, the row's padding, the frame's border —
 *  taken at the wider Status column, so the Schedule and Results switch rows at the same width and never disagree in
 *  one window (measured 2026-10-17: at 1,024 with the strip, Results' list was 890 wide, the Schedule's needed 902). */
const MIN_WIDTH = Math.ceil(COL.when + COL.gameMin + COL.fieldMin + COL.divisionMin + Math.max(...Object.values(STATUS_WIDTH))
  + COL.arrow + 5 * COL.gap + 2 * COL.padX + 2);

/**
 * Whether the game row fits where the list sits: never on a phone (≤640, today's stacked row), and above it only
 * while the list is wide enough for the columns at their floors. `ref` goes on the element that holds the list (the
 * same width whichever row it renders). Read before the first paint, so a tablet never flashes the wrong row.
 */
export function useGameTableFits(hold = false) {
  // The phone answer is the media query's, ready on a client mount before any element is measured.
  const phone = useIsPhone();
  const { ref, atLeast } = useWidthAtLeast(MIN_WIDTH);
  const live = !phone && atLeast !== false;
  // `hold`: Results' score editor is open. The two forms put it in different places, so a flip (the sidebar folded,
  // the window dragged across the line) would remount it and drop the typed score — keep the form until it closes.
  const [shown, setShown] = useState(live);
  if (!hold && shown !== live) setShown(live);
  return { ref, fits: hold ? shown : live };
}

type Ctx = { teams: Team[]; divisions: Division[]; venues: Venue[] };

/** Field: the venue over the facility or diamond. A free-text place splits at the stored line's separator. A
 *  single-surface venue often names its one facility after itself: "Lions Diamond" over "Lions Diamond" says nothing. */
function fieldLines(ctx: Ctx, g: Game): { main: string; sub: string } {
  const parts = resolveGameVenueParts(g, ctx.venues);
  const [main = '', ...rest] = parts ? [parts.venue, parts.facility ?? ''] : (g.location ?? '').split(VENUE_FACILITY_SEPARATOR);
  const sub = rest.join(VENUE_FACILITY_SEPARATOR);
  return { main, sub: sub.trim().toLowerCase() === main.trim().toLowerCase() ? '' : sub };
}

/** Division: the division over the pool (a pool game, the Timeline's reading of it) or the playoff round. */
function divisionLines(ctx: Ctx, g: Game): { main: string; sub: string } {
  const division = ctx.divisions.find(d => d.id === g.divisionId);
  if (g.isPlayoff) return { main: division?.name ?? '', sub: bracketRoundLabel(g.bracketCode) };
  const poolId = gamePoolId(g, id => ctx.teams.find(t => t.id === id)?.poolId);
  const pool = poolId ? division?.pools?.find(p => p.id === poolId) : undefined;
  return { main: division?.name ?? '', sub: pool?.name ?? '' };
}

function Lines({ id, lines, className }: { id: string; lines: { main: string; sub: string }; className: string }) {
  return (
    <span role="cell" id={id} className={className}>
      {lines.main}
      {/* The space parts the two lines for a screen reader ("8:30 a.m. Fri, Jun 12"); the block line hides it on screen. */}
      {lines.sub && <>{' '}<small className={styles.sub}>{lines.sub}</small></>}
    </span>
  );
}

export type GameTableRow = {
  g: Game;
  /** The Game cell: the caller's `GameTeams` (Results' two teams with their scores), read the caller's way. */
  game: ReactNode;
  /** What the stacked row's trail holds today: the Day's state chip, Results' Finalize or its Forfeit / Tie chip. */
  status?: ReactNode;
  onOpen: () => void;
  /** The row opens a window (the Schedule's game window); Results opens its editor in place. */
  opensDialog?: boolean;
  /** Shown in the row's place, the whole row wide (Results' score editor). */
  editor?: ReactNode;
};
export type GameTableGroup = { key: string; band?: { name: string; count: ReactNode }; rows: GameTableRow[] };

export default function GameTable({ kind, label, groups, teams, divisions, venues, today }: {
  kind: GameTableKind;
  /** The table's name for assistive tech (the day, the lens). */
  label: string;
  groups: GameTableGroup[];
  teams: Team[];
  divisions: Division[];
  venues: Venue[];
  /** Results: a game on another day says its day under the clock. The Schedule's rows are a day's, or in day bands. */
  today?: string;
}) {
  const ctx: Ctx = { teams, divisions, venues };
  return (
    <div
      role="table"
      aria-label={label}
      className={`${repKit.rowFrame} ${styles.table}`}
      data-row-list="frame"
      style={COLUMNS[kind]}
    >
      <div role="rowgroup">
        <div role="row" className={styles.head}>
          <span role="columnheader">{H.when}</span>
          <span role="columnheader">{H.game}</span>
          <span role="columnheader">{H.field}</span>
          <span role="columnheader">{H.division}</span>
          <span role="columnheader">{H.status}</span>
          <span aria-hidden />
        </div>
      </div>
      {groups.map(group => (
        <div key={group.key} role="rowgroup" aria-label={group.band?.name}>
          {group.band && (
            <div role="row" className={`${repKit.rowBand} ${styles.band}`}>
              <span role="cell" aria-colspan={5}>
                <span role="heading" aria-level={3}>
                  {group.band.name}
                  <span className={repKit.rowBandCount}> {group.band.count}</span>
                </span>
              </span>
            </div>
          )}
          {group.rows.map(row => row.editor ? (
            <div key={row.g.id} role="row" className={styles.editorRow}>
              <div role="cell" aria-colspan={5}>{row.editor}</div>
            </div>
          ) : (
            <GameTableRowView key={row.g.id} ctx={ctx} row={row} today={today} />
          ))}
        </div>
      ))}
    </div>
  );
}

function GameTableRowView({ ctx, row, today }: { ctx: Ctx; row: GameTableRow; today?: string }) {
  const { g } = row;
  // The row's one control is named by its game (the teams); the rest of the row describes it, so a keyboard or screen
  // reader user tabbing down the list hears the whole line, as the stacked row's button gave it.
  const id = useId();
  const cell = (name: string) => `${id}-${name}`;
  return (
    <div role="row" className={styles.row} data-row-list-row>
      <Lines id={cell('when')} className={styles.when} lines={gameWhenLines(g.date, g.time, today)} />
      <span role="cell" className={styles.game}>
        <button
          type="button"
          className={styles.door}
          onClick={row.onOpen}
          aria-haspopup={row.opensDialog ? 'dialog' : undefined}
          aria-describedby={['when', 'field', 'division', 'status'].map(cell).join(' ')}
        >
          {row.game}
        </button>
      </span>
      <Lines id={cell('field')} className={styles.cell} lines={fieldLines(ctx, g)} />
      <Lines id={cell('division')} className={styles.cell} lines={divisionLines(ctx, g)} />
      <span role="cell" id={cell('status')} className={styles.status}>{row.status}</span>
      <ChevronRight size={16} className={styles.arrow} aria-hidden />
    </div>
  );
}
