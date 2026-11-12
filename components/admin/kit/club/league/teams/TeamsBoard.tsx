'use client';
/**
 * THE BOARD (Club Tier Stage 9c, Part 3; redrawn at real size — HOUSE_LEAGUE_DRAFT_BOARD_AT_SCALE, rulings A1–A11).
 *
 * A desk shows "Not on a team" as its own column on the left, sticky once scrolled past the steps with its list scrolling
 * inside it (A1), and the teams in their own grid beside it; a runner drags a player from the pool to any team. When
 * nobody is left the pool folds to one sticky line that is still a drop target, and the teams take the full width (A11).
 * Every player is ONE row everywhere — rating · name · marks · age · ⋯ — and a state (Locked · Moved by you · Asked to
 * withdraw) drops to a second line on that row only (A2). The pool has the one search, a Filter menu and a Sort pick
 * (A3–A5). A row's marks are buttons that open on click (A6 family · A8 note · A9 owing).
 *
 * A phone keeps one row a team (and the pool) and opens a group in place; the opened pool gets Search on its own row,
 * then Filter and Sort. A player's ⋯ holds Move to…, the lock and Put back.
 *
 * Only the people who run the league see a rating, a lock or "Moved by you" (9c·2a, copy §13); the registrar reads the
 * board with no buttons. A note reaches the board only for a reader who can open registrations (A8): the board renders
 * the mark only when the read carried the note.
 *
 * THE ROW'S FIXED PLACES (Board Ready Stage 1 Part 3; drawing 5b option B, rulings A14, A15 — for EVERY club, with or
 * without friend requests): RTG · Player · Together · Note · $ · Age · ⋯, each place headed by its symbol, so a mark
 * lines up down a team. Together is family and confirmed friends in one place: the count is how many of the player's
 * group are on this team, amber "1 of 2" when someone they are to be with is elsewhere. A place the reader can't see is
 * absent, not empty: RTG for the people who see ratings, Note for a reader of Registrations, the friends inside Together
 * for a reader of Registrations (A11 — anyone else still sees the family). A player's ⋯ holds "Keep apart from a
 * friend…" and "Keep together with {friend} again".
 */
import { useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import Link from 'next/link';
import {
  DndContext, DragOverlay, MouseSensor, TouchSensor, rectIntersection, useDraggable, useDroppable, useSensor, useSensors,
  type CollisionDetection, type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, FileText, Lock, MoreHorizontal, Pencil, Trash2, Users } from 'lucide-react';
import { CoachToolbarMenu, CoachToolbarMenuHeading, CoachToolbarMenuItem } from '@/components/coaches/CoachToolbarMenu';
import SingleSelectDropdown from '@/components/coaches/SingleSelectDropdown';
import SheetFrame from '@/components/coaches/SheetFrame';
import SearchField from '@/components/shared/SearchField';
import FilterMenu from '@/components/admin/tournament/FilterMenu';
import frame from '@/components/admin/kit/AdminKitFrame.module.css';
import { useAnchoredMenu, useDismissable } from '@/lib/overlay-hooks';
import { formatLeagueMoney } from '@/lib/league-money';
import { teamAverage } from '@/lib/house-league-draft';
import { coachesLine } from '@/lib/house-league-teams-words';
import { REGS_WORDS } from '@/lib/house-league-money-words';
import { TC_CHIP } from '@/lib/house-league-team-changes-words';
import { TEAMS_WORDS as W } from '@/lib/house-league-teams-screen-words';
import {
  familiesOf, filterCounts, narrowPool, sortPool, togetherOf, type PoolFilter, type PoolSort, type TogetherPerson,
} from '@/lib/house-league-board-pool';
import type { DivisionFriends } from '@/lib/league-friend-draft';
import { dayOf, type BoardLeft, type BoardPlayer, type BoardTeam } from './api';
import css from './Teams.module.css';

export interface BoardRights {
  /** Drag, ⋯, pencils: the people who run the league, on a live season. */
  run: boolean;
  /** Rating chips, averages, locks, "Moved by you" (9c·2a). */
  seeRatings: boolean;
}

export interface PlayerMenuItem { key: 'move' | 'lock' | 'unlock' | 'putBack' | 'apart' | `together:${string}`; label: string }

export interface BoardProps {
  teams: readonly BoardTeam[];
  players: readonly BoardPlayer[];
  ratings: ReadonlyMap<string, number>;
  /** The families' sign-up notes — present only for a reader who can open registrations (A8). */
  notes: Readonly<Record<string, string>> | null;
  /** The division's confirmed friend links and who asked — present only for a reader who can open registrations (A11). */
  friends: DivisionFriends | null;
  left: readonly BoardLeft[];
  published: boolean;
  rights: BoardRights;
  isPhone: boolean;
  divisionName: string;
  /** Registrations' Active tab: where a payment is recorded (the owing mark's link, A9). */
  paymentsHref: string;
  teamName: (id: string | null) => string;
  onDrop: (playerId: string, teamId: string | null) => void;
  onMenu: (player: BoardPlayer, key: PlayerMenuItem['key']) => void;
  /** `how`: "edit" opens straight to the form (the card's pencil); "coach" opens at the coach fields; "delete" opens the delete question (the card's trash can). */
  onOpenTeam: (teamId: string, how?: 'edit' | 'coach' | 'delete') => void;
}

/** The lit group: whose Together window is open (or who was gone to), and every child it lights. */
interface Lit { key: string; ids: ReadonlySet<string> }

/** What the rows share beyond the board's props: who each child is kept with, the lit group and how to reach a child. */
interface RowKit {
  together: ReadonlyMap<string, readonly TogetherPerson[]>;
  byId: ReadonlyMap<string, BoardPlayer>;
  /** The group lit up: while its Together window is open, and after "go to" a name until the next mark is pressed. */
  lit: Lit | null;
  setLit: (lit: Lit | null) => void;
  goTo: (playerId: string) => void;
}

const isMoved = (p: BoardPlayer, published: boolean) => !published && !!p.draftTeamId && p.teamId !== p.draftTeamId;
const rowId = (id: string) => `board-player-${id}`;

/**
 * A player's ⋯ items: only what this player and these rights allow (absent beats disabled). The friend items only for a
 * reader the read gave friends to (A11): Keep apart while a confirmed friend is still kept with them, and Keep together
 * again for each friend kept apart.
 */
export function playerMenu(
  p: BoardPlayer, published: boolean, rights: BoardRights, teamName: (id: string | null) => string,
  friends: readonly TogetherPerson[] = [], nameOf: (id: string) => string = () => '',
): PlayerMenuItem[] {
  if (!rights.run) return [];
  const items: PlayerMenuItem[] = [{ key: 'move', label: W.kid.moveTo }];
  if (!published && p.teamId) items.push(p.locked ? { key: 'unlock', label: 'Unlock' } : { key: 'lock', label: 'Lock to this team' });
  if (isMoved(p, published) && p.draftTeamId) items.push({ key: 'putBack', label: W.kid.putBack(teamName(p.draftTeamId)) });
  const linked = friends.filter(f => f.link);
  if (linked.some(f => !f.link!.apart)) items.push({ key: 'apart', label: W.apart.menu });
  for (const f of linked) if (f.link!.apart) items.push({ key: `together:${f.id}`, label: W.apart.again(nameOf(f.id)) });
  return items;
}

/**
 * The row's places (A2; 5b option B): RTG only for a reader who sees ratings, Note only for a reader the read gave notes
 * to, the ⋯ only for one who runs the league. Together and $ are everyone's.
 */
function columns(rights: BoardRights, notes: boolean): CSSProperties {
  const cols = [
    rights.seeRatings && 'var(--col-rating)', 'minmax(0, 1fr)', 'var(--col-together)', notes && 'var(--col-mark)',
    'var(--col-mark)', 'var(--col-age)', rights.run && 'var(--col-more)',
  ].filter(Boolean).join(' ');
  return { '--cols': cols } as CSSProperties;
}

function RatingChip({ rating }: { rating: number | null }) {
  return (
    <span className={`${css.rating}${rating == null ? ` ${css.ratingNone}` : ''}`} aria-label={W.kid.ratingAria(rating)} role="img">
      {rating ?? '–'}
    </span>
  );
}

/**
 * The column headings, in the table recipe (A2); the same grid as the rows beneath them. Each mark's place is headed by
 * its symbol (5b option B), and the hover names it: RTG (A15: a rating, 5 strongest — "RK" would read backwards).
 */
function ColHead({ rights, notes }: { rights: BoardRights; notes: boolean }) {
  return (
    <div className={css.colHead} aria-hidden>
      {rights.seeRatings && <span title={W.col.ratingHint}>{W.col.rating}</span>}
      <span>{W.col.player}</span>
      <span className={css.place} title={W.col.togetherHint}>{W.col.together}</span>
      {notes && <span className={css.place} title={W.col.note}><FileText size={13} /></span>}
      <span className={css.place} title={W.col.owing}>$</span>
      <span className={css.right}>{W.col.age}</span>
      {rights.run && <span />}
    </div>
  );
}

/**
 * A mark's small window (A6, A8, A9): a click opens it — hover is never the only way in. At a desk it hangs off the
 * mark (placed by `useAnchoredMenu`, so it flips above near the window's foot); on a phone it rises as the house sheet.
 * A pointer-down on the mark or in the window never starts a drag of the row it sits in.
 */
function MarkButton({ label, title, glyph, className, pressed, isPhone, onOpen, onDismiss, children, foot }: {
  label: string;
  title: string;
  glyph: ReactNode;
  className: string;
  pressed?: boolean;
  isPhone: boolean;
  onOpen?: () => void;
  /** Closed by a click away, Escape or the mark itself — not by an action inside the window (`children`'s close). */
  onDismiss?: () => void;
  children: (close: () => void) => ReactNode;
  foot?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const close = () => setOpen(false);
  const dismiss = () => { setOpen(false); onDismiss?.(); };
  const style = useAnchoredMenu(open && !isPhone, button, panel, { minWidth: 260, narrowMinWidth: 220, align: 'start' });
  useDismissable(open && !isPhone, [wrap, panel], dismiss, () => { dismiss(); button.current?.focus(); });
  const body = (
    <>
      <p className={css.popTitle}>{title}</p>
      {children(close)}
      {foot && <p className={css.popFoot}>{foot}</p>}
    </>
  );
  return (
    <span ref={wrap} className={css.markWrap} onPointerDown={e => e.stopPropagation()}>
      <button
        ref={button}
        type="button"
        className={`${css.mark} ${className}${pressed ? ` ${css.markOn}` : ''}`}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => { if (open) dismiss(); else { onOpen?.(); setOpen(true); } }}
      >
        {glyph}
      </button>
      {open && (isPhone
        ? <SheetFrame label={title} onClose={dismiss} opener={button} role="dialog" aria-label={title}><div className={css.popSheet}>{body}</div></SheetFrame>
        : <div ref={panel} className={css.pop} style={style} role="dialog" aria-label={title}>{body}</div>)}
    </span>
  );
}

/** One person's line in the Together window: Together on one team, Kept apart on the board, or Apart. */
function personStatus(p: BoardPlayer, other: BoardPlayer, person: TogetherPerson): { word: string; ok: boolean } {
  if (p.teamId && other.teamId === p.teamId) return { word: W.mark.status.together, ok: true };
  if (person.link?.apart) return { word: W.mark.status.keptApart, ok: false };
  return { word: W.mark.status.apart, ok: false };
}

/** The friend line's quiet sub (desk only, as tab 5 draws it): how it was confirmed, who kept it apart, or why it can't be kept. */
function personSub(person: TogetherPerson): string | null {
  const l = person.link;
  if (!l || person.kind === 'family') return null;
  if (l.apart) return W.mark.linkKeptApart(l.keptApartBy, l.keptApartAt ? dayOf(l.keptApartAt) : '');
  if (person.outcome === 'overCap') return W.mark.linkOverCap;
  if (person.outcome === 'locked') return W.mark.linkLocked;
  return W.mark.linkConfirmed(dayOf(l.confirmedAt), l.bothAsked, l.code);
}

/** Together (5b option B): family and confirmed friends in one place; amber when someone in the group is elsewhere. */
function TogetherPlace({ p, props, kit }: { p: BoardPlayer; props: BoardProps; kit: RowKit }) {
  const people = (kit.together.get(p.id) ?? []).filter(x => kit.byId.has(x.id));
  if (people.length === 0) return <span className={css.place} />;
  const name = `${p.firstName} ${p.lastName}`;
  const onTeam = !!p.teamId;
  const here = onTeam ? people.filter(x => kit.byId.get(x.id)!.teamId === p.teamId).length : people.length;
  const split = onTeam && here < people.length;
  const lit = { key: p.id, ids: new Set([p.id, ...people.map(x => x.id)]) };
  return (
    <span className={css.place}>
      <MarkButton
        label={W.mark.togetherAria(name, here, people.length, onTeam)}
        title={W.mark.togetherTitle(name, here, people.length, onTeam)}
        glyph={<><Users size={14} aria-hidden />{W.mark.togetherCount(here, people.length, split)}</>}
        className={split ? css.markApart : ''}
        pressed={kit.lit?.key === p.id}
        isPhone={props.isPhone}
        onOpen={() => kit.setLit(lit)}
        onDismiss={() => kit.setLit(null)}
        foot={W.mark.familyFoot(props.isPhone)}
      >
        {close => (
          <ul className={css.popList}>
            {people.map(person => {
              const other = kit.byId.get(person.id)!;
              const status = onTeam ? personStatus(p, other, person) : null;
              const sub = props.isPhone ? null : personSub(person);
              return (
                <li key={person.id}>
                  <span className={css.popWho}>
                    <button type="button" className={css.popName} onClick={() => { close(); kit.goTo(person.id); }}>
                      {other.firstName} {other.lastName}
                    </button>
                    <span className={css.popWhere}> · {props.teamName(other.teamId)} · {W.mark.kind[person.kind]}</span>
                    {sub && <span className={css.popSub}>{sub}</span>}
                  </span>
                  {status ? <span className={`${css.popStatus}${status.ok ? '' : ` ${css.popStatusApart}`}`}>{status.word}</span> : <span />}
                </li>
              );
            })}
          </ul>
        )}
      </MarkButton>
    </span>
  );
}

function NotePlace({ p, props }: { p: BoardPlayer; props: BoardProps }) {
  const note = props.notes?.[p.id];
  return (
    <span className={css.place}>
      {note && (
        <MarkButton
          label={W.mark.noteAria(p.firstName)}
          title={W.mark.noteTitle(`${p.firstName} ${p.lastName}`)}
          glyph={<FileText size={14} aria-hidden />}
          className=""
          isPhone={props.isPhone}
          foot={W.mark.noteFoot}
        >
          {() => <p className={css.popQuote}>“{note}”</p>}
        </MarkButton>
      )}
    </span>
  );
}

function OwingPlace({ p, props }: { p: BoardPlayer; props: BoardProps }) {
  const amount = p.owes != null ? formatLeagueMoney(p.owes) : '';
  return (
    <span className={css.place}>
      {p.owes != null && (
        <MarkButton
          label={W.mark.owingAria(amount)}
          title={`${p.firstName} ${p.lastName}`}
          glyph="$"
          className={css.markOwe}
          isPhone={props.isPhone}
        >
          {() => (
            <p className={css.popLine}>
              {W.mark.owingLine(amount)} {W.mark.owingAct} <Link href={props.paymentsHref} className={css.inlineLink}>{W.mark.owingLink}</Link>.
            </p>
          )}
        </MarkButton>
      )}
    </span>
  );
}

function PlayerRow({ p, props, kit, overlay = false }: { p: BoardPlayer; props: BoardProps; kit: RowKit; overlay?: boolean }) {
  const { rights, published, ratings, teamName } = props;
  const rating = ratings.get(p.id) ?? null;
  const moved = rights.run && isMoved(p, published);
  const locked = rights.run && p.locked && !published;
  const friends = props.friends ? (kit.together.get(p.id) ?? []).filter(x => x.kind === 'friend' && kit.byId.has(x.id)) : [];
  const nameOf = (id: string) => { const k = kit.byId.get(id); return k ? `${k.firstName} ${k.lastName}` : ''; };
  const items = playerMenu(p, published, rights, teamName, friends, nameOf);
  const name = `${p.firstName} ${p.lastName}`;
  const lit = !!kit.lit?.ids.has(p.id);
  // TC·6: a small amber chip with words on a child whose family has not been told their team (never on a team card).
  const notTold = rights.run && p.untold;
  const hasState = locked || notTold || !!p.askedToWithdrawAt || (moved && !!p.draftTeamId);
  return (
    <div id={overlay ? undefined : rowId(p.id)} className={`${css.kid}${moved ? ` ${css.kidMoved}` : ''}${lit ? ` ${css.kidLit}` : ''}`}>
      {rights.seeRatings && <RatingChip rating={rating} />}
      <span className={css.kidName}>{name}</span>
      <TogetherPlace p={p} props={props} kit={kit} />
      {props.notes && <NotePlace p={p} props={props} />}
      <OwingPlace p={p} props={props} />
      <span className={css.age}><span aria-hidden>{p.age ?? '–'}</span><span className={css.srOnly}>{W.kid.age(p.age)}</span></span>
      {rights.run && (items.length > 0 ? (
        <CoachToolbarMenu
          variant="glyph"
          label={W.kid.more(name)}
          icon={<MoreHorizontal size={18} aria-hidden />}
          drawerOnPhone
          drawerTitle={name}
          panelMinWidth={260}
          triggerClassName={css.more}
        >
          {props.isPhone && <CoachToolbarMenuHeading>{p.teamId ? teamName(p.teamId) : W.pool.title}</CoachToolbarMenuHeading>}
          {items.map(item => <CoachToolbarMenuItem key={item.key} label={item.label} onSelect={() => props.onMenu(p, item.key)} />)}
        </CoachToolbarMenu>
      ) : <span />)}
      {hasState && (
        <div className={css.states} style={{ gridColumn: rights.seeRatings ? '2 / -1' : '1 / -1' }}>
          {locked && <span className={css.lockBadge}><Lock size={12} aria-hidden />{W.kid.locked}</span>}
          {notTold && <span className={css.notTold}>{TC_CHIP.notTold}</span>}
          {moved && p.draftTeamId && (
            <CoachToolbarMenu
              variant="glyph"
              label={W.kid.moved}
              icon={<span className={css.movedTag}>{W.kid.moved}</span>}
              drawerOnPhone
              drawerTitle={name}
              align="start"
              panelMinWidth={240}
              triggerClassName={css.movedTrigger}
            >
              <CoachToolbarMenuItem label={W.kid.putBack(teamName(p.draftTeamId))} onSelect={() => props.onMenu(p, 'putBack')} />
            </CoachToolbarMenu>
          )}
          {p.askedToWithdrawAt && <span className={css.kidSub}>{W.kid.asked(dayOf(p.askedToWithdrawAt))}</span>}
        </div>
      )}
    </div>
  );
}

function DraggablePlayer({ p, props, kit }: { p: BoardPlayer; props: BoardProps; kit: RowKit }) {
  const { listeners, setNodeRef, isDragging } = useDraggable({ id: p.id });
  return (
    <div ref={setNodeRef} className={`${css.drag}${isDragging ? ` ${css.dragging}` : ''}`} {...listeners}>
      <PlayerRow p={p} props={props} kit={kit} />
    </div>
  );
}

function TeamHead({ team, members, props }: { team: BoardTeam; members: readonly BoardPlayer[]; props: BoardProps }) {
  const names = team.coaches.map(c => c.name);
  // Only a team nobody is on, before publish: the same test the delete itself applies.
  const deletable = props.rights.run && !props.published && members.length === 0;
  // A10: the one home for the count and the average, under the coach line, where you look while placing a player.
  const avg = props.rights.seeRatings ? teamAverage(members.map(m => ({ rating: props.ratings.get(m.id) ?? null }))) : null;
  return (
    <div className={css.cardHead}>
      <span className={css.dot} style={team.color ? { background: team.color } : undefined} aria-hidden />
      <div className={css.cardTitleBlock}>
        <h3 className={css.cardTitle}>{team.name}</h3>
        {names.length > 0
          ? <div className={css.cardCoach}>{coachesLine(names)}</div>
          : props.rights.run
            ? <button type="button" className={css.noCoach} onClick={() => props.onOpenTeam(team.id, 'coach')}>{W.card.noCoach}</button>
            : <div className={`${css.cardCoach} ${css.amberText}`}>{W.card.noCoach}</div>}
        <div className={css.cardStat}>{W.card.foot(members.length, avg)}</div>
      </div>
      {props.rights.run && (
        <button type="button" className={css.iconBtn} aria-label={W.card.edit(team.name)} onClick={() => props.onOpenTeam(team.id, 'edit')}>
          <Pencil size={16} aria-hidden />
        </button>
      )}
      {deletable && (
        <button type="button" className={css.iconBtn} aria-label={W.card.deleteTeam(team.name)} onClick={() => props.onOpenTeam(team.id, 'delete')}>
          <Trash2 size={16} aria-hidden />
        </button>
      )}
    </div>
  );
}

function LeftLines({ team, props }: { team: BoardTeam; props: BoardProps }) {
  const gone = props.left.filter(l => l.teamId === team.id);
  return <>{gone.map(l => <p key={l.id} className={css.leftLine}>{W.kid.left(l.name, dayOf(l.at))}</p>)}</>;
}

function DropCard({ id, className, children, enabled, label }: { id: string; className: string; children: ReactNode; enabled: boolean; label?: string }) {
  const { setNodeRef, isOver } = useDroppable({ id, disabled: !enabled });
  return <section ref={setNodeRef} className={`${className}${isOver ? ` ${css.over}` : ''}`} aria-label={label}>{children}</section>;
}

/** The pool's search, filter and sort, kept for the visit (as Registrations keeps its own), and the rows they leave. */
function usePoolTools(props: BoardProps, pool: readonly BoardPlayer[], families: ReadonlyMap<string, readonly BoardPlayer[]>) {
  const [query, setQuery] = useState('');
  const [rawPicks, setPicks] = useState<readonly PoolFilter[]>([]);
  const [sort, setSort] = useState<PoolSort>('last');
  // The arrow beside Sort reverses the order a sort opens in; picking another sort opens that one in its own order.
  const [reverse, setReverse] = useState(false);
  // An emptied pool hides its tools (it folds), so a search or a tick left behind would hide the next player to land
  // there with no way to clear it: the narrowing goes when the pool empties.
  const empty = pool.length === 0;
  const [wasEmpty, setWasEmpty] = useState(empty);
  if (empty !== wasEmpty) {
    setWasEmpty(empty);
    if (empty) { setQuery(''); setPicks([]); }
  }
  const askedFriend = props.friends ? new Set(props.friends.asked) : null;
  const facts = { ratings: props.ratings, notes: props.notes, families, friends: askedFriend };
  // Absent beats disabled: Not rated only for a reader who sees ratings; Has player notes only when a family wrote one.
  const offer: PoolFilter[] = [
    ...(props.rights.seeRatings ? ['notRated' as const] : []),
    ...(props.notes && Object.keys(props.notes).length > 0 ? ['notes' as const] : []),
    'owing', 'sibling',
    // A11: only for a reader the read gave friends to, and only when a family in the division named one.
    ...(askedFriend && askedFriend.size > 0 ? ['friend' as const] : []),
  ];
  // A tick whose option has gone (no notes now) counts nowhere: not in the list, the button or the count.
  const picks = rawPicks.filter(p => offer.includes(p));
  const counts = filterCounts(pool, offer, facts);
  const label: Record<PoolFilter, string> = { notRated: W.pool.notRated, notes: REGS_WORDS.filterNotes, owing: REGS_WORDS.filterOwing, sibling: W.pool.sibling, friend: W.pool.friend };
  const shown = sortPool(narrowPool(pool, query, picks, facts), sort, props.ratings, { reverse, households: families });
  const sorts: { id: PoolSort; label: string }[] = [
    { id: 'last', label: W.pool.sortBy.last },
    ...(props.rights.seeRatings ? [{ id: 'rating' as const, label: W.pool.sortBy.rating }] : []),
    { id: 'age', label: W.pool.sortBy.age },
    { id: 'family', label: W.pool.sortBy.family },
  ];
  const orderWords = W.pool.sortOrder[sort][reverse ? 1 : 0];
  const search = <SearchField value={query} onChange={setQuery} label={W.pool.search} layout="fill" />;
  const tools = (
    <div className={css.poolTools}>
      <FilterMenu
        groups={[{
          key: 'show', label: W.pool.filterHead,
          options: offer.map(f => ({ key: f, label: label[f], count: counts[f] })),
          selected: picks,
          onToggle: k => setPicks(prev => (prev.includes(k as PoolFilter) ? prev.filter(x => x !== k) : [...prev, k as PoolFilter])),
        }]}
        label={W.pool.filter}
        onLabel={W.pool.filterOn}
        resetLabel={W.pool.filterClear}
        onReset={() => setPicks([])}
      />
      <SingleSelectDropdown label={W.pool.sort} labelSuffix=":" lead options={sorts} value={sort} onChange={v => { setSort(v as PoolSort); setReverse(false); }} />
      <button type="button" className={css.sortDir} onClick={() => setReverse(r => !r)}
        title={orderWords} aria-label={W.pool.sortOrderAria(orderWords)}>
        {reverse ? <ArrowDown size={16} aria-hidden /> : <ArrowUp size={16} aria-hidden />}
      </button>
    </div>
  );
  const narrowed = query.trim() !== '' || picks.length > 0;
  const count = narrowed ? W.pool.shown(shown.length, pool.length) : String(pool.length);
  /** "Go to" a child the search or a tick hides: the narrowing goes first, so the row is there to reach. */
  const reveal = (id: string) => {
    if (pool.some(p => p.id === id) && !shown.some(p => p.id === id)) { setQuery(''); setPicks([]); }
  };
  return { shown, search, tools, count, reveal };
}

/**
 * Where a dragged player lands. dnd-kit measures the drop targets when the drag starts and then shifts each by how far
 * the page has scrolled since — right for the team cards, wrong for the pool, which is sticky and stays put while the
 * page scrolls under it. So the pool (open or folded) is measured live on every move; the cards keep dnd-kit's rects.
 */
const stickyAware: CollisionDetection = args => {
  const node = args.droppableContainers.find(c => c.id === 'pool')?.node.current;
  if (!node) return rectIntersection(args);
  const r = node.getBoundingClientRect();
  const rects = new Map(args.droppableRects);
  rects.set('pool', { top: r.top, left: r.left, right: r.right, bottom: r.bottom, width: r.width, height: r.height });
  return rectIntersection({ ...args, droppableRects: rects });
};
/** The window scrolls only near its top and bottom edge: the pool runs nearly the window's height, so dnd-kit's 20%
 *  band would set the page running while a player is picked from the pool's lower rows. */
const AUTO_SCROLL = { threshold: { x: 0.2, y: 0.1 } };

/** Bring a child's row into view once it has rendered (a group just opened, or the narrowing just cleared). */
const scrollToRow = (id: string) => window.requestAnimationFrame(() =>
  document.getElementById(rowId(id))?.scrollIntoView({ block: 'center', behavior: 'smooth' }));

/** Who each child is kept with, from the board's one read (the same groups the draft deals), and each child by id. */
function useTogether(props: BoardProps): Pick<RowKit, 'together' | 'byId'> {
  const { players, teams, friends } = props;
  const together = useMemo(() => togetherOf(players, teams.map(t => t.id), friends?.links ?? null), [players, teams, friends]);
  const byId = useMemo(() => new Map(players.map(p => [p.id, p])), [players]);
  return { together, byId };
}

function DeskBoard(props: BoardProps) {
  // A mouse drags after 5px; a finger on a touch-width desk board (a tablet) holds first, so a swipe still scrolls the
  // pool's list (the house's hold-and-drag on touch).
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  );
  const [dragId, setDragId] = useState<string | null>(null);
  const [lit, setLit] = useState<Lit | null>(null);
  const { teams, players, rights } = props;
  const pool = players.filter(p => !p.teamId);
  const families = familiesOf(players);
  const tools = usePoolTools(props, pool, families);
  const kit: RowKit = {
    ...useTogether(props), lit, setLit,
    goTo: id => { tools.reveal(id); scrollToRow(id); },
  };
  const row = (p: BoardPlayer) => (rights.run
    ? <DraggablePlayer key={p.id} p={p} props={props} kit={kit} />
    : <PlayerRow key={p.id} p={p} props={props} kit={kit} />);
  const dragging = dragId ? players.find(p => p.id === dragId) ?? null : null;
  const onEnd = (e: DragEndEvent) => {
    setDragId(null);
    if (!e.over) return;
    const target = e.over.id === 'pool' ? null : String(e.over.id);
    const p = players.find(x => x.id === e.active.id);
    if (p && p.teamId !== target) props.onDrop(p.id, target);
  };
  // A11: nobody left (and somebody in the division) — the pool folds to one sticky line, still a drop target.
  const folded = pool.length === 0 && players.length > 0;
  return (
    <DndContext sensors={sensors} collisionDetection={stickyAware} autoScroll={AUTO_SCROLL}
      onDragStart={(e: DragStartEvent) => setDragId(String(e.active.id))} onDragEnd={onEnd} onDragCancel={() => setDragId(null)}>
      <div className={`${css.board}${folded ? ` ${css.boardFolded}` : ''}`} style={columns(rights, !!props.notes)}>
        {folded ? (
          <DropCard id="pool" className={css.poolBar} enabled={rights.run} label={W.pool.title}>
            <b>{W.pool.folded}</b> · {W.pool.foldedCount(players.length)}
          </DropCard>
        ) : players.length > 0 && (
          <DropCard id="pool" className={css.pool} enabled={rights.run} label={W.pool.title}>
            <div className={css.poolHead}>
              <div className={css.poolTitleRow}>
                <h3 className={css.cardTitle}>{W.pool.title}</h3>
                <span className={frame.count} style={{ marginLeft: 0 }}>{tools.count}</span>
              </div>
              {tools.search}
              {tools.tools}
            </div>
            <div className={css.poolList}>
              {/* Inside the list (sticky at its top), so the list's scrollbar narrows the headings as it does the rows. */}
              <ColHead rights={rights} notes={!!props.notes} />
              {tools.shown.length === 0 ? <p className={css.poolEmpty}>{W.pool.noMatch}</p> : tools.shown.map(row)}
            </div>
            {props.published && <p className={css.poolFoot}>{W.pool.hint}</p>}
          </DropCard>
        )}
        <div className={css.teams}>
          {teams.map(team => {
            const members = players.filter(p => p.teamId === team.id);
            return (
              <DropCard key={team.id} id={team.id} className={css.card} enabled={rights.run}>
                <TeamHead team={team} members={members} props={props} />
                {members.length === 0
                  ? <div className={css.emptyDrop}>{rights.run ? W.card.empty : W.pool.empty}</div>
                  : <div className={css.kids}><ColHead rights={rights} notes={!!props.notes} />{members.map(row)}</div>}
                <LeftLines team={team} props={props} />
              </DropCard>
            );
          })}
        </div>
      </div>
      <DragOverlay>{dragging ? <div className={css.overlay} style={columns(rights, !!props.notes)}><PlayerRow p={dragging} props={props} kit={kit} overlay /></div> : null}</DragOverlay>
    </DndContext>
  );
}

function PhoneBoard(props: BoardProps) {
  const [open, setOpen] = useState<string | null>(null);
  const [lit, setLit] = useState<Lit | null>(null);
  const { teams, players } = props;
  const pool = players.filter(p => !p.teamId);
  const families = familiesOf(players);
  const tools = usePoolTools(props, pool, families);
  const kit: RowKit = {
    ...useTogether(props), lit, setLit,
    // A child on another team is in another group: open it, then bring the row into view.
    goTo: id => {
      const p = players.find(x => x.id === id);
      if (!p) return;
      setOpen(p.teamId ?? 'pool');
      tools.reveal(id);
      scrollToRow(id);
    },
  };
  // A group whose team has gone (deleted while it was open) is closed, never the pool under the team's name.
  const team = open && open !== 'pool' ? teams.find(t => t.id === open) ?? null : null;
  if (open === 'pool' || team) {
    const members = team ? players.filter(p => p.teamId === team.id) : tools.shown;
    return (
      <div className={css.phoneTeam} style={columns(props.rights, !!props.notes)}>
        <button type="button" className={css.backBtn} onClick={() => setOpen(null)}>
          <ChevronLeft size={18} aria-hidden />{W.back}
        </button>
        <section className={css.card}>
          {team ? <TeamHead team={team} members={members} props={props} /> : (
            <div className={css.poolHead}>
              <div className={css.poolTitleRow}>
                <h3 className={css.cardTitle}>{W.pool.title}</h3>
                {pool.length > 0 && <span className={frame.count} style={{ marginLeft: 0 }}>{tools.count}</span>}
              </div>
              {pool.length > 0 && <>{tools.search}{tools.tools}</>}
            </div>
          )}
          {members.length === 0
            ? <p className={css.quiet}>{team ? W.card.empty : pool.length > 0 ? W.pool.noMatch : W.pool.empty}</p>
            : <div className={css.kids}><ColHead rights={props.rights} notes={!!props.notes} />{members.map(p => <PlayerRow key={p.id} p={p} props={props} kit={kit} />)}</div>}
          {team && <LeftLines team={team} props={props} />}
        </section>
      </div>
    );
  }
  return (
    <div className={css.phoneList}>
      <button type="button" className={css.phoneRow} onClick={() => setOpen('pool')}>
        <span className={css.phoneRowMain}>
          <span className={css.phoneRowTitle}>{W.pool.title}</span>
        </span>
        {pool.length > 0 && <span className={frame.count} style={{ marginLeft: 0 }}>{pool.length}</span>}
        <ChevronRight size={18} aria-hidden className={css.chev} />
      </button>
      {teams.map(team => {
        const count = players.filter(p => p.teamId === team.id).length;
        const names = team.coaches.map(c => c.name);
        return (
          <button key={team.id} type="button" className={css.phoneRow} onClick={() => setOpen(team.id)} aria-label={W.card.open(team.name)}>
            <span className={css.dot} style={team.color ? { background: team.color } : undefined} aria-hidden />
            <span className={css.phoneRowMain}>
              <span className={css.phoneRowTitle}>{team.name}</span>
              <span className={css.phoneRowSub}>
                {names.length > 0 ? coachesLine(names) : <span className={css.amberText}>{W.card.noCoach}</span>}
                {` · ${count} ${count === 1 ? 'player' : 'players'}`}
              </span>
            </span>
            <ChevronRight size={18} aria-hidden className={css.chev} />
          </button>
        );
      })}
    </div>
  );
}

export default function TeamsBoard(props: BoardProps) {
  return props.isPhone ? <PhoneBoard {...props} /> : <DeskBoard {...props} />;
}
