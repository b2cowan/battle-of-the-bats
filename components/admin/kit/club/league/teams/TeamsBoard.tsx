'use client';
/**
 * THE BOARD (Club Tier Stage 9c, Part 3; copy §1.4; drawings a, c, f). A desk shows "Not on a team" and every team as cards
 * in one wrapping grid, and a runner drags a player between them. A phone shows one row a team (and the pool) and opens a
 * team's players in place; a player's ⋯ holds Move to…, the lock and Put back. Only the people who run the league see a
 * rating, a lock or "Moved by you" (9c·2a, copy §13); the registrar reads the board with no buttons.
 */
import { useState, type ReactNode } from 'react';
import { DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';
import { ChevronLeft, ChevronRight, Lock, MoreHorizontal, Pencil } from 'lucide-react';
import { CoachToolbarMenu, CoachToolbarMenuHeading, CoachToolbarMenuItem } from '@/components/coaches/CoachToolbarMenu';
import frame from '@/components/admin/kit/AdminKitFrame.module.css';
import { formatLeagueMoney } from '@/lib/league-money';
import { clubDay } from '@/lib/league-registration-state';
import { teamAverage } from '@/lib/house-league-draft';
import { coachesLine } from '@/lib/house-league-teams-words';
import { TEAMS_WORDS as W } from '@/lib/house-league-teams-screen-words';
import type { BoardLeft, BoardPlayer, BoardTeam } from './api';
import css from './Teams.module.css';

export interface BoardRights {
  /** Drag, ⋯, pencils: the people who run the league, on a live season. */
  run: boolean;
  /** Rating chips, averages, locks, "Moved by you" (9c·2a). */
  seeRatings: boolean;
}

export interface PlayerMenuItem { key: 'move' | 'lock' | 'unlock' | 'putBack'; label: string }

export interface BoardProps {
  teams: readonly BoardTeam[];
  players: readonly BoardPlayer[];
  ratings: ReadonlyMap<string, number>;
  left: readonly BoardLeft[];
  published: boolean;
  rights: BoardRights;
  isPhone: boolean;
  teamName: (id: string | null) => string;
  onDrop: (playerId: string, teamId: string | null) => void;
  onMenu: (player: BoardPlayer, key: PlayerMenuItem['key']) => void;
  onOpenTeam: (teamId: string, atCoach?: boolean) => void;
}

const isMoved = (p: BoardPlayer, published: boolean) => !published && !!p.draftTeamId && p.teamId !== p.draftTeamId;

/** A player's ⋯ items: only what this player and these rights allow (absent beats disabled). */
export function playerMenu(p: BoardPlayer, published: boolean, rights: BoardRights, teamName: (id: string | null) => string): PlayerMenuItem[] {
  if (!rights.run) return [];
  const items: PlayerMenuItem[] = [{ key: 'move', label: W.kid.moveTo }];
  if (!published && p.teamId) items.push(p.locked ? { key: 'unlock', label: 'Unlock' } : { key: 'lock', label: 'Lock to this team' });
  if (isMoved(p, published) && p.draftTeamId) items.push({ key: 'putBack', label: W.kid.putBack(teamName(p.draftTeamId)) });
  return items;
}

function RatingChip({ rating }: { rating: number | null }) {
  return (
    <span className={`${css.rating}${rating == null ? ` ${css.ratingNone}` : ''}`} aria-label={W.kid.ratingAria(rating)} role="img">
      {rating ?? '–'}
    </span>
  );
}

function PlayerRow({ p, props, drag }: { p: BoardPlayer; props: BoardProps; drag?: ReactNode }) {
  const { rights, published, ratings, teamName } = props;
  const rating = ratings.get(p.id) ?? null;
  const moved = rights.run && isMoved(p, published);
  const sub = [
    W.kid.age(p.age),
    rights.seeRatings && rating == null ? W.kid.notRated : null,
    p.owes != null ? W.kid.owes(formatLeagueMoney(p.owes)) : null,
  ].filter(Boolean).join(' · ');
  const items = playerMenu(p, published, rights, teamName);
  const name = `${p.firstName} ${p.lastName}`;
  return (
    <div className={`${css.kid}${moved ? ` ${css.kidMoved}` : ''}`}>
      {drag}
      {rights.seeRatings && <RatingChip rating={rating} />}
      <div className={css.kidMain}>
        <div className={css.kidName}>
          {name}
          {rights.run && p.locked && !published && (
            <span className={css.lockBadge}><Lock size={12} aria-hidden />{W.kid.locked}</span>
          )}
        </div>
        <div className={css.kidSub}>{sub}</div>
        {p.askedToWithdrawAt && <div className={css.kidSub}>{W.kid.asked(clubDay(p.askedToWithdrawAt))}</div>}
      </div>
      {moved && p.draftTeamId && (
        <button type="button" className={css.movedTag} onClick={() => props.onMenu(p, 'putBack')} title={W.kid.putBack(teamName(p.draftTeamId))}>
          {W.kid.moved}
        </button>
      )}
      {items.length > 0 && (
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
      )}
    </div>
  );
}

function DraggablePlayer({ p, props }: { p: BoardPlayer; props: BoardProps }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: p.id });
  return (
    <div ref={setNodeRef} className={`${css.drag}${isDragging ? ` ${css.dragging}` : ''}`} {...listeners} {...attributes}>
      <PlayerRow p={p} props={props} />
    </div>
  );
}

function TeamHead({ team, props }: { team: BoardTeam; props: BoardProps }) {
  const names = team.coaches.map(c => c.name);
  return (
    <div className={css.cardHead}>
      <span className={css.dot} style={team.color ? { background: team.color } : undefined} aria-hidden />
      <div className={css.cardTitleBlock}>
        <h3 className={css.cardTitle}>{team.name}</h3>
        {names.length > 0
          ? <div className={css.cardCoach}>{coachesLine(names)}</div>
          : props.rights.run
            ? <button type="button" className={css.noCoach} onClick={() => props.onOpenTeam(team.id, true)}>{W.card.noCoach}</button>
            : <div className={`${css.cardCoach} ${css.amberText}`}>{W.card.noCoach}</div>}
      </div>
      {props.rights.run && (
        <button type="button" className={css.iconBtn} aria-label={W.card.edit(team.name)} onClick={() => props.onOpenTeam(team.id)}>
          <Pencil size={16} aria-hidden />
        </button>
      )}
    </div>
  );
}

function CardFoot({ team, members, props }: { team: BoardTeam; members: readonly BoardPlayer[]; props: BoardProps }) {
  const avg = props.rights.seeRatings ? teamAverage(members.map(m => ({ rating: props.ratings.get(m.id) ?? null }))) : null;
  const gone = props.left.filter(l => l.teamId === team.id);
  return (
    <>
      {gone.map(l => <p key={l.id} className={css.leftLine}>{W.kid.left(l.name, clubDay(l.at))}</p>)}
      <div className={css.cardFoot}>{W.card.foot(members.length, avg)}</div>
    </>
  );
}

function DropCard({ id, className, children, enabled }: { id: string; className: string; children: ReactNode; enabled: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id, disabled: !enabled });
  return <section ref={setNodeRef} className={`${className}${isOver ? ` ${css.over}` : ''}`}>{children}</section>;
}

function DeskBoard(props: BoardProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const [dragId, setDragId] = useState<string | null>(null);
  const { teams, players, rights } = props;
  const pool = players.filter(p => !p.teamId);
  const row = (p: BoardPlayer) => (rights.run ? <DraggablePlayer key={p.id} p={p} props={props} /> : <PlayerRow key={p.id} p={p} props={props} />);
  const dragging = dragId ? players.find(p => p.id === dragId) ?? null : null;
  const onEnd = (e: DragEndEvent) => {
    setDragId(null);
    if (!e.over) return;
    const target = e.over.id === 'pool' ? null : String(e.over.id);
    const p = players.find(x => x.id === e.active.id);
    if (p && p.teamId !== target) props.onDrop(p.id, target);
  };
  return (
    <DndContext sensors={sensors} onDragStart={(e: DragStartEvent) => setDragId(String(e.active.id))} onDragEnd={onEnd} onDragCancel={() => setDragId(null)}>
      <div className={css.board}>
        <DropCard id="pool" className={`${css.card} ${css.poolCard}`} enabled={rights.run}>
          <div className={css.cardHead}>
            <h3 className={css.cardTitle}>{W.pool.title}</h3>
            {pool.length > 0 && <span className={frame.count} style={{ marginLeft: 0 }}>{pool.length}</span>}
          </div>
          {pool.length === 0 ? <p className={css.quiet}>{W.pool.empty}</p> : <div className={css.kids}>{pool.map(row)}</div>}
          {props.published && <p className={css.quiet}>{W.pool.hint}</p>}
        </DropCard>
        {teams.map(team => {
          const members = players.filter(p => p.teamId === team.id);
          return (
            <DropCard key={team.id} id={team.id} className={css.card} enabled={rights.run}>
              <TeamHead team={team} props={props} />
              {members.length === 0
                ? <div className={css.emptyDrop}>{rights.run ? W.card.empty : W.pool.empty}</div>
                : <div className={css.kids}>{members.map(row)}</div>}
              <CardFoot team={team} members={members} props={props} />
            </DropCard>
          );
        })}
      </div>
      <DragOverlay>{dragging ? <div className={css.overlay}><PlayerRow p={dragging} props={props} /></div> : null}</DragOverlay>
    </DndContext>
  );
}

function PhoneBoard(props: BoardProps) {
  const [open, setOpen] = useState<string | null>(null);
  const { teams, players } = props;
  const pool = players.filter(p => !p.teamId);
  if (open) {
    const team = open === 'pool' ? null : teams.find(t => t.id === open) ?? null;
    const members = players.filter(p => (team ? p.teamId === team.id : !p.teamId));
    return (
      <div className={css.phoneTeam}>
        <button type="button" className={css.backBtn} onClick={() => setOpen(null)}>
          <ChevronLeft size={18} aria-hidden />{W.back}
        </button>
        <section className={css.card}>
          {team ? <TeamHead team={team} props={props} /> : (
            <div className={css.cardHead}><h3 className={css.cardTitle}>{W.pool.title}</h3></div>
          )}
          {members.length === 0
            ? <p className={css.quiet}>{team ? W.card.empty : W.pool.empty}</p>
            : <div className={css.kids}>{members.map(p => <PlayerRow key={p.id} p={p} props={props} />)}</div>}
          {team && <CardFoot team={team} members={members} props={props} />}
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
