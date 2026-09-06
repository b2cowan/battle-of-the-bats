'use client';
import { useRef, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import coach from '@/app/[orgSlug]/coaches/coaches.module.css';
import CoachModalHeader from './CoachModalHeader';
import CoachCollapseSection from './CoachCollapseSection';
import { useOverlayOpenIfAvailable } from '@/lib/coaches-overlay';
import type { RoomNeighbour } from '@/lib/room-neighbours';
import { useDialogFloor } from './useDialogFloor';
import s from './RoomShell.module.css';

/**
 * THE ROOM — the one overlay every money record opens (List · Room · Question, owner-ruled
 * 2026-09-02; plan `docs/projects/active/COACH_MONEY_LIST_ROOM_QUESTION_PLAN.md`).
 *
 * Anatomy, in order: header (name + status chip) · tiles · the action row · the record's own
 * table (children) · History fold · the record's reference fields (`fields`) · a pinned foot with
 * the once-in-a-record doors and the named Prev / Next. Desktop: a centered overlay at the dues
 * drawer's width. Phone: the shared `.modalOverlay` rule makes it a full-screen sheet with a back
 * arrow, no opt-in.
 *
 * ⚖⚖ **PLAN, THEN ACTUAL, THEN IDENTITY — and `fields` is the slot that ordering needed** (owner,
 * 2026-09-06). A room tells three stories in a row: what is OWED (the record's own table), what
 * money actually MOVED (History), and what the record IS (its fields). The first two are one
 * conversation and belong adjacent — a bill's schedule says "$540.00 still owing" on a $1,000
 * piece, and the answer to *why* is a payment in the History fold. Until this slot existed the
 * fields could only sit inside `children`, which put the least-visited block in the room on the
 * most-travelled path between those two, and pushed the fold below the cut of an ordinary laptop
 * screen — where it also opens itself the moment a payment lands, off-screen.
 *
 * ⚠ ONE ROOM USES IT TODAY (the team bill's). Sponsor and drive rooms have no reference block, so
 * they are unaffected; a room that gains one puts it HERE rather than at the end of its body.
 *
 * ⚠ THE ACCESSIBILITY FLOOR SHIPS HERE, NOT PER SURFACE (D7): dialog role, a label naming the
 * record, Escape closes, Tab is trapped, focus lands on the room and returns to the opener —
 * `useDialogFloor`, which a Question modal can stand on too. Every money overlay before this one
 * lacked all five.
 *
 * ⚠ CLOSE IS BUSY-GATED. While a write is in flight (`busy`), Escape, the backdrop and the X all
 * refuse. The consumer passes its guarded closer (`useDiscardGuard`) as `onClose`; this shell
 * never decides whether typed work may be lost.
 *
 * Addressability is the consumer's (`useRoomAddress`); the `sentinel`/`loaded` pair renders the
 * `data-room` attributes the layout sweep's `ready` selector waits on, so a sweep can never pass
 * on a room that has not drawn.
 */

export type RoomTone = 'good' | 'warn' | 'danger';

export interface RoomTile {
  label: string;
  value: ReactNode;
  tone?: RoomTone;
}

export interface RoomNav {
  prev: RoomNeighbour | null;
  next: RoomNeighbour | null;
  /** 1-based position in the walked list. */
  index: number;
  total: number;
  /** The plural the count reads with — "bills", "families", "drives". */
  noun: string;
  onSelect: (id: string) => void;
}

export interface RoomHistory {
  /** The figures the closed fold carries beside its title ("$1,250.00 received · 1 payout"). */
  meta?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}

export interface RoomShellProps {
  open: boolean;
  /** The consumer's guarded closer. Never called while `busy`. */
  onClose: () => void;
  /** Names the record for assistive tech — "Avery Test — dues record". */
  ariaLabel: string;
  title: ReactNode;
  /** A status chip beside the title (the `.badge*` family). */
  status?: ReactNode;
  tiles?: RoomTile[];
  /** The action row above the table: a quiet Edit door and the one Record door. */
  actions?: ReactNode;
  /**
   * The record's quiet facts — a sponsor's note and tags, a drive's participation fraction —
   * seated on the LEFT of the action row (owner, §135 walk 2026-09-03).
   *
   * ⚠⚠ IT SHARES THE DOORS' ROW RATHER THAN TAKING ITS OWN. Both rooms drew this as a full line
   * under the buttons, which spent a whole row of a height-capped overlay on a half-empty one —
   * the doors are right-aligned, so the space beside them was already there. It CLAMPS to one
   * line, because the sponsor note is free text with no length limit: left to wrap it would push
   * the doors down and cost more rows than it saved, which is the opposite of the point.
   * ⚠ Passed here rather than rendered by each room, so the two rooms cannot drift apart on it.
   */
  facts?: ReactNode;
  /** The plain-text form of `facts`, for the `title` a one-line clamp owes whoever wrote the
   *  note it cut. Composed nodes cannot supply their own, so the room passes it. */
  factsTitle?: string;
  /** The record's own table and body. */
  children: ReactNode;
  history?: RoomHistory;
  /**
   * What the record IS — its filing, who it is paid to, its tags, its note. Rendered BELOW the
   * History fold, because it is reference material: set once when the record is created, corrected
   * rarely, and read on purpose rather than passed through. See the anatomy note above.
   *
   * ⚠ NOT A SECOND `children`. Anything that answers "where does this stand" or "what happened"
   * belongs above the fold, in the record's own table.
   */
  fields?: ReactNode;
  /** Once-in-a-record doors for the foot — the guarded Delete. */
  footer?: ReactNode;
  nav?: RoomNav;
  busy?: boolean;
  /** The open record's id — when it changes while the room stays open (Prev/Next), focus is
   *  re-seated on the room so the trap and the arrow keys keep working. */
  recordKey?: string | null;
  width?: 'default' | 'wide';
  /** `data-room="<sentinel>"` for the layout sweep's ready selector. */
  sentinel?: string;
  /** `false` while the record is still loading — the sweep waits for `loaded`. */
  loaded?: boolean;
}

export default function RoomShell({
  open,
  onClose,
  ariaLabel,
  title,
  status,
  tiles,
  actions,
  facts,
  factsTitle,
  children,
  history,
  fields,
  footer,
  nav,
  busy = false,
  recordKey = null,
  width = 'default',
  sentinel,
  loaded = true,
}: RoomShellProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Scroll-lock + bottom-nav hiding ride the portal's shared counter, never a private body lock.
  useOverlayOpenIfAvailable(open);
  useDialogFloor(open, panelRef, {
    onClose,
    busy,
    walk: nav ? { prev: nav.prev?.id ?? null, next: nav.next?.id ?? null, onSelect: nav.onSelect } : null,
    focusKey: recordKey,
  });

  if (!open) return null;

  const requestClose = () => { if (!busy) onClose(); };
  const hasFoot = Boolean(footer) || Boolean(nav);

  return (
    <div
      className={coach.modalOverlay}
      onPointerDown={event => { if (event.target === event.currentTarget) requestClose(); }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        aria-busy={busy || undefined}
        className={`${s.room} ${width === 'wide' ? s.roomWide : ''}`}
        data-room={sentinel}
        data-room-state={loaded ? 'loaded' : 'loading'}
        onClick={event => event.stopPropagation()}
      >
        {/* The portal's one modal header (back arrow on a phone, X on a desktop); the status chip
            rides inside the title so it stays beside the name at every width. */}
        <CoachModalHeader
          titleTag="h2"
          title={<span className={s.titleRow}>{title}{status}</span>}
          onClose={requestClose}
          closeAriaLabel="Close"
          closeIconSize={18}
        />

        <div className={s.body}>
          {tiles && tiles.length > 0 && (
            <div className={s.tiles}>
              {tiles.map(tile => (
                <div key={tile.label} className={s.tile}>
                  <span className={s.tileLabel}>{tile.label}</span>
                  <span className={s.tileValue} data-tone={tile.tone}>{tile.value}</span>
                </div>
              ))}
            </div>
          )}
          {(actions || facts) && (
            <div className={s.actions}>
              {/* `title` carries the full text for a note the clamp has cut — the one affordance
                  a truncation owes the person who wrote it. The facts are composed nodes, so the
                  plain-text form comes alongside rather than being stringified out of them. */}
              {facts && <p className={s.facts} title={factsTitle}>{facts}</p>}
              {actions && <div className={s.actionDoors}>{actions}</div>}
            </div>
          )}
          {children}
          {history && (
            <div className={s.history}>
              {/* The portal's own collapsible section, closed by default — the record's table is
                  the room's one open view, and history is read on demand.
                  ⚠⚠ KEYED ON `defaultOpen`, AND THAT IS NOT A TIDY-UP (Phase C). The section seeds
                  its own `open` from `defaultOpen` ONCE, at mount — right for a page section, and
                  useless here: the room stays mounted while a coach records a payment, so a fold
                  asked to open itself AFTER the fact simply would not. Re-keying remounts it in the
                  state the consumer is now asking for. It flips at most twice in a record's life
                  (a payment lands; the walk moves to another record), and the consequence of the
                  second flip is exactly right — the next record's history opens closed. */}
              <CoachCollapseSection
                key={history.defaultOpen ? 'open' : 'shut'}
                sectionId={`${sentinel ?? 'room'}-history`}
                title="History"
                meta={history.meta}
                defaultOpen={history.defaultOpen ?? false}
              >
                {history.children}
              </CoachCollapseSection>
            </div>
          )}
          {/* What the record IS — last, and read on purpose. See `fields` and the anatomy note. */}
          {fields}
        </div>

        {hasFoot && (
          <div className={s.foot}>
            <div className={s.footDoors}>{footer}</div>
            {nav && (
              <nav className={s.nav} aria-label={`Other ${nav.noun}`}>
                <button
                  type="button"
                  className={s.navBtn}
                  disabled={!nav.prev || busy}
                  aria-label={nav.prev ? `Previous: ${nav.prev.label}` : 'No previous record'}
                  onClick={() => { if (nav.prev) nav.onSelect(nav.prev.id); }}
                >
                  <ChevronLeft size={16} aria-hidden />
                  <span className={s.navLabel}>{nav.prev?.label ?? 'Start'}</span>
                </button>
                <span className={s.navCount}>{nav.index} of {nav.total} {nav.noun}</span>
                <button
                  type="button"
                  className={s.navBtn}
                  disabled={!nav.next || busy}
                  aria-label={nav.next ? `Next: ${nav.next.label}` : 'No next record'}
                  onClick={() => { if (nav.next) nav.onSelect(nav.next.id); }}
                >
                  <span className={s.navLabel}>{nav.next?.label ?? 'End'}</span>
                  <ChevronRight size={16} aria-hidden />
                </button>
              </nav>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
