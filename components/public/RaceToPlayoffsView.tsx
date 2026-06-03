'use client';
import { Trophy, Star } from 'lucide-react';
import { Team } from '@/lib/types';
import { teamInitials, teamColorFromName } from '@/lib/teamBadge';
import type { PlayoffConfig, Pool } from '@/lib/types';
import styles from '@/app/[orgSlug]/standings/standings.module.css';

export type RaceStandingRow = {
  id: string;
  name: string;
  teamId: string;
  poolId?: string;
  w: number;
  l: number;
  t: number;
  rd: number;
  pts: number;
};

interface RaceToPlayoffsViewProps {
  standings: RaceStandingRow[];
  pools: Pool[];
  playoffConfig?: PlayoffConfig;
  followedTeamId: string | null;
  teams: Team[];
  gamesStarted: boolean;
}

function TeamBadge({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const bg = teamColorFromName(name);
  const initials = teamInitials(name);
  return (
    <span
      className={size === 'lg' ? styles.podiumBadgeLg : size === 'sm' ? styles.podiumBadgeSm : styles.podiumBadge}
      style={{ backgroundColor: bg }}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}

const POSITION_LABELS: Record<number, string> = { 1: '1ST', 2: '2ND', 3: '3RD' };
const POSITION_COLORS: Record<number, string> = {
  1: 'var(--warning)',       // gold
  2: '#94a3b8',              // silver
  3: '#b45309',              // bronze
};

function rdLabel(rd: number) {
  if (rd > 0) return `+${rd}`;
  return String(rd);
}

interface RaceSectionProps {
  rows: RaceStandingRow[];
  teamsQualifying: number;
  followedTeamId: string | null;
  gamesStarted: boolean;
  label?: string;
}

function RaceSection({ rows, teamsQualifying, followedTeamId, gamesStarted, label }: RaceSectionProps) {
  const podiumRows = rows.slice(0, Math.min(3, rows.length));
  const listRows   = rows.slice(3);
  // Cutoff is meaningful only when some teams advance and some don't
  const showCutoff = teamsQualifying > 0 && teamsQualifying < rows.length && gamesStarted;
  // If the cutoff falls inside the podium zone (pos 1-3), show it between podium and list.
  // Otherwise show it before the correct list row.
  const cutoffInPodium = showCutoff && teamsQualifying <= 3;

  return (
    <div className={styles.raceSection}>
      {label && <p className={styles.raceSectionLabel}>{label}</p>}

      {/* Podium — top 3 cards */}
      {podiumRows.length > 0 && gamesStarted && (
        <div className={styles.podium}>
          {/* DOM order: 2nd · 1st · 3rd — CSS keeps 1st visually centred/tallest */}
          {([1, 0, 2] as const).map((orderIdx) => {
            const row = podiumRows[orderIdx];
            if (!row) return <div key={orderIdx} className={styles.podiumSlotEmpty} />;
            const pos = orderIdx + 1;
            const isYou = row.id === followedTeamId;
            return (
              <div
                key={row.id}
                data-pos={pos}
                data-you={isYou || undefined}
                className={`${styles.podiumCard} ${isYou ? styles.podiumCardYou : ''}`}
              >
                <span className={styles.podiumPosition} style={{ color: POSITION_COLORS[pos] }}>
                  {POSITION_LABELS[pos]}
                </span>
                {pos === 1 && <Trophy size={14} className={styles.podiumTrophy} />}
                <TeamBadge name={row.name} size="lg" />
                <span className={styles.podiumName}>{row.name}</span>
                <div className={styles.podiumPtsRow}>
                  <span className={styles.podiumPts}>{row.pts}</span>
                  <span className={styles.podiumPtsLabel}>pts</span>
                </div>
                <span className={styles.podiumRecord}>
                  {row.w}-{row.l}-{row.t}&nbsp;·&nbsp;RD&nbsp;
                  <span className={row.rd > 0 ? styles.rdPositive : row.rd < 0 ? styles.rdNegative : ''}>
                    {rdLabel(row.rd)}
                  </span>
                </span>
                {isYou && (
                  <span className={styles.youChip}>
                    <Star size={10} fill="currentColor" /> YOU
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Cutoff bar between podium and list when qualifying ≤ 3 */}
      {cutoffInPodium && listRows.length > 0 && (
        <PlayoffCutoffBar count={teamsQualifying} />
      )}

      {/* List rows — 4th place and below (or all rows when games not started) */}
      {(listRows.length > 0 || (!gamesStarted && rows.length > 0)) && (
        <div className={styles.raceList}>
          {(!gamesStarted ? rows : listRows).map((row, idx) => {
            const pos = gamesStarted ? idx + 4 : idx + 1;
            const isYou = row.id === followedTeamId;
            // Draw cutoff BEFORE this row when it falls inside the list zone
            const drawCutoffHere = showCutoff && !cutoffInPodium && pos === teamsQualifying + 1;

            return (
              <div key={row.id}>
                {drawCutoffHere && <PlayoffCutoffBar count={teamsQualifying} />}
                <div className={`${styles.raceRow} ${isYou ? styles.raceRowYou : ''}`}>
                  <span className={styles.raceRank}>{pos}</span>
                  <TeamBadge name={row.name} size="sm" />
                  <span className={styles.raceName}>{row.name}</span>
                  <span className={styles.raceRecord}>{row.w}-{row.l}-{row.t}</span>
                  <span className={`${styles.raceRd} ${row.rd > 0 ? styles.rdPositive : row.rd < 0 ? styles.rdNegative : ''}`}>
                    {rdLabel(row.rd)}
                  </span>
                  <span className="badge badge-primary">{row.pts}</span>
                  {isYou && <Star size={11} className={styles.raceYouStar} fill="currentColor" />}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PlayoffCutoffBar({ count }: { count: number }) {
  return (
    <div className={styles.playoffCutoff} aria-hidden="true">
      <span className={styles.playoffCutoffInner}>
        <span className={styles.playoffCutoffX}>✕</span>
        <span className={styles.playoffCutoffLabel}>PLAYOFF CUTOFF&nbsp;·&nbsp;TOP</span>
        <span className={styles.playoffCutoffCount}>{count} ADVANCE</span>
      </span>
    </div>
  );
}

export default function RaceToPlayoffsView({
  standings,
  pools,
  playoffConfig,
  followedTeamId,
  gamesStarted,
}: RaceToPlayoffsViewProps) {
  const teamsQualifying = playoffConfig?.teamsQualifying ?? 0;
  const crossover = playoffConfig?.crossover ?? 'none';
  const combinePools = crossover !== 'none' || pools.length <= 1;

  const sortRows = (rows: RaceStandingRow[]) =>
    [...rows].sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      if (b.rd !== a.rd) return b.rd - a.rd;
      return 0;
    });

  if (combinePools) {
    const combined = sortRows(standings);
    const totalTeams = combined.length;
    return (
      <div>
        <div className={styles.raceHeader}>
          <Trophy size={16} className={styles.raceHeaderIcon} />
          <span className={styles.raceHeaderTitle}>RACE TO PLAYOFFS</span>
          {teamsQualifying > 0 && (
            <span className={styles.raceHeaderSub}>
              · Top {teamsQualifying} of {totalTeams} advance
            </span>
          )}
        </div>
        <RaceSection
          rows={combined}
          teamsQualifying={teamsQualifying}
          followedTeamId={followedTeamId}
          gamesStarted={gamesStarted}
        />
      </div>
    );
  }

  // Per-pool sections
  return (
    <div>
      <div className={styles.raceHeader}>
        <Trophy size={16} className={styles.raceHeaderIcon} />
        <span className={styles.raceHeaderTitle}>RACE TO PLAYOFFS</span>
        {teamsQualifying > 0 && (
          <span className={styles.raceHeaderSub}>
            · Top {teamsQualifying} per pool advance
          </span>
        )}
      </div>
      {pools.map(pool => {
        const poolRows = sortRows(standings.filter(s => s.poolId === pool.id));
        if (poolRows.length === 0) return null;
        return (
          <RaceSection
            key={pool.id}
            rows={poolRows}
            teamsQualifying={teamsQualifying}
            followedTeamId={followedTeamId}
            gamesStarted={gamesStarted}
            label={pool.name}
          />
        );
      })}
    </div>
  );
}
