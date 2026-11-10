'use client';
/**
 * MOVE A PLAYER (Club Tier Stage 9c, Part 3; copy §5, §6). "Move {name} to…" lists the division's teams with what each
 * would read with them ("2 players · avg 3.5 → 3.0 with Jaya", the averages for the people who see ratings), the team they
 * are on ("Now here"), Not on a team, and the lock. A pick is immediate and silent, before and after publishing (TC·1: the
 * held "Move and email" window is gone; families are told from the Teams screen's banner).
 */
import { Check, Lock } from 'lucide-react';
import KitDialog from '../../KitDialog';
import { teamAverage } from '@/lib/house-league-draft';
import { TEAMS_WORDS as W } from '@/lib/house-league-teams-screen-words';
import type { BoardPlayer, BoardTeam } from './api';
import css from './Teams.module.css';

export function MoveSheet({ player, teams, players, ratings, seeRatings, divisionName, published, onPick, onLock, onClose }: {
  player: BoardPlayer;
  teams: readonly BoardTeam[];
  players: readonly BoardPlayer[];
  ratings: ReadonlyMap<string, number>;
  seeRatings: boolean;
  divisionName: string;
  published: boolean;
  onPick: (teamId: string | null) => void;
  onLock: (locked: boolean) => void;
  onClose: () => void;
}) {
  const name = `${player.firstName} ${player.lastName}`;
  const rating = ratings.get(player.id) ?? null;
  const r = (p: BoardPlayer) => ({ rating: ratings.get(p.id) ?? null });
  return (
    <KitDialog kind="question" title={W.move.sheetTitle(name)} identity={W.move.sheetSub(rating, divisionName, seeRatings)} onClose={onClose}>
      <ul className={css.moveList}>
        {teams.map(t => {
          const members = players.filter(p => p.teamId === t.id && p.id !== player.id);
          const here = player.teamId === t.id;
          const avg = seeRatings ? teamAverage(members.map(r)) : null;
          const after = seeRatings ? teamAverage([...members.map(r), { rating }]) : null;
          return (
            <li key={t.id}>
              <button type="button" className={`${css.moveRow}${here ? ` ${css.moveHere}` : ''}`} disabled={here} onClick={() => onPick(t.id)}>
                <span className={css.dot} style={t.color ? { background: t.color } : undefined} aria-hidden />
                <span className={css.phoneRowMain}>
                  <span className={css.phoneRowTitle}>{t.name}</span>
                  <span className={css.phoneRowSub}>{here ? W.move.current : W.move.team(members.length, avg, after, player.firstName)}</span>
                </span>
                {here && <Check size={18} aria-hidden />}
              </button>
            </li>
          );
        })}
        {player.teamId && (
          <li>
            <button type="button" className={css.moveRow} onClick={() => onPick(null)}>
              <span className={css.phoneRowMain}>
                <span className={css.phoneRowTitle}>{W.move.off}</span>
                <span className={css.phoneRowSub}>{W.move.offSub(player.firstName)}</span>
              </span>
            </button>
          </li>
        )}
        {!published && player.teamId && (
          <li>
            <button type="button" className={css.moveRow} onClick={() => onLock(!player.locked)}>
              <Lock size={16} aria-hidden />
              <span className={css.phoneRowMain}>
                <span className={css.phoneRowTitle}>{player.locked ? 'Unlock' : 'Lock to this team'}</span>
                {!player.locked && <span className={css.phoneRowSub}>{'A locked player stays on this team when you run the draft, and their rating counts toward the team’s average.'}</span>}
              </span>
            </button>
          </li>
        )}
      </ul>
    </KitDialog>
  );
}
