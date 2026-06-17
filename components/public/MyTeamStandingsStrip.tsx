'use client';
/**
 * components/public/MyTeamStandingsStrip.tsx
 * Renders the followed team's at-a-glance summary above the standings table (J6-028):
 * rank in division, live/last score, and next game — the data the page already
 * computed but never showed. Answers "where are we / next / latest" in one strip.
 */
import { Star } from 'lucide-react';
import type { Game, Division, PublicTeam } from '@/lib/types';
import { formatTime } from '@/lib/utils';
import styles from './MyTeamStandingsStrip.module.css';

function rankLabel(n: number) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

interface Props {
  team: Pick<PublicTeam, 'id' | 'name'>;
  rank: number | null;
  division: Division | null;
  liveGame: Game | null;
  nextGame: Game | null | undefined;
  latestScore: Game | null;
  today: string;
  showJump: boolean;
  onJump?: () => void;
}

export default function MyTeamStandingsStrip({
  team, rank, division, liveGame, nextGame, latestScore, today, showJump, onJump,
}: Props) {
  const scoreStr = (g: Game) => {
    const isHome = g.homeTeamId === team.id;
    const mine = (isHome ? g.homeScore : g.awayScore) ?? 0;
    const opp = (isHome ? g.awayScore : g.homeScore) ?? 0;
    return `${mine}-${opp}`;
  };
  const dateLabel = (g: Game) =>
    g.date === today ? 'Today' : new Date(`${g.date}T12:00:00`).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });

  return (
    <div className={styles.strip}>
      <div className={styles.head}>
        <Star size={14} className={styles.star} fill="currentColor" />
        <span>{team.name}</span>
        {rank != null && (
          <span className={styles.rank}>{rankLabel(rank)}{division ? ` · ${division.name}` : ''}</span>
        )}
      </div>
      <div className={styles.facts}>
        {liveGame ? (
          <span className={styles.live}><span className={styles.liveDot} /> LIVE <strong>{scoreStr(liveGame)}</strong></span>
        ) : latestScore ? (
          <span>Last: <strong>{scoreStr(latestScore)}</strong></span>
        ) : null}
        {nextGame && (
          <span>Next: <strong>{dateLabel(nextGame)}{nextGame.time ? ` · ${formatTime(nextGame.time)}` : ''}</strong></span>
        )}
      </div>
      {showJump && onJump && (
        <button type="button" className={styles.jump} onClick={onJump}>View my division</button>
      )}
    </div>
  );
}
