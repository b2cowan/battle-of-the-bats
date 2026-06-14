'use client';
import { Trophy } from 'lucide-react';
import { Game, PublicTeam } from '@/lib/types';
import { teamInitials, teamColorFromName } from '@/lib/teamBadge';
import { formatTime } from '@/lib/utils';
import { bracketRoundInfo } from '@/lib/playoff-bracket';
import styles from '@/app/[orgSlug]/standings/standings.module.css';

interface Props {
  games: Game[];
  teams: PublicTeam[];
  requireFinalization: boolean;
}

type BracketRound = {
  key: string;
  label: string;
  order: number;
  games: Game[];
};

function buildRounds(playoffGames: Game[]): BracketRound[] {
  const map = new Map<string, BracketRound>();
  for (const g of playoffGames) {
    const raw = (g.bracketCode || 'PLAYOFF').toUpperCase();
    // Keep 3rd place as its own key — the tree renders it as a separate sub-section.
    const info = (raw === '3RD' || raw === 'P3')
      ? { key: '3RD', title: '3rd Place', rank: 2.5 }
      : bracketRoundInfo(g.bracketCode || 'PLAYOFF');
    if (!map.has(info.key)) {
      map.set(info.key, { key: info.key, label: info.title, order: info.rank, games: [] });
    }
    map.get(info.key)!.games.push(g);
  }
  for (const round of map.values()) {
    round.games.sort((a, b) => (a.bracketCode || '').localeCompare(b.bracketCode || ''));
  }
  return Array.from(map.values()).sort((a, b) => a.order - b.order);
}

function teamName(teams: PublicTeam[], id?: string | null): string {
  if (!id) return 'TBD';
  return teams.find(t => t.id === id)?.name ?? 'TBD';
}

function getOutcome(g: Game): 'home' | 'away' | 'tie' | null {
  if (g.homeScore == null || g.awayScore == null) return null;
  if (g.homeScore > g.awayScore) return 'home';
  if (g.awayScore > g.homeScore) return 'away';
  return 'tie';
}

function statusLabel(g: Game, requireFinalization: boolean) {
  if (g.status === 'completed') return 'Final';
  if (g.status === 'submitted') return requireFinalization ? 'Pending' : 'Final';
  return null;
}

// ─── Matchup card used in both desktop tree and mobile list ──────────────────

function MatchupCard({
  game,
  teams,
  requireFinalization,
  compact = false,
}: {
  game: Game;
  teams: PublicTeam[];
  requireFinalization: boolean;
  compact?: boolean;
}) {
  const outcome = getOutcome(game);
  const scored = outcome !== null;
  const label = statusLabel(game, requireFinalization);

  const homeName = game.homeTeamId ? teamName(teams, game.homeTeamId) : (game.homePlaceholder ?? 'TBD');
  const awayName = game.awayTeamId ? teamName(teams, game.awayTeamId) : (game.awayPlaceholder ?? 'TBD');

  const homeWon = outcome === 'home';
  const awayWon = outcome === 'away';
  const homeTbd = !game.homeTeamId;
  const awayTbd = !game.awayTeamId;

  return (
    <div className={`${styles.bracketMatchup} ${compact ? styles.bracketMatchupCompact : ''}`}>
      {label && (
        <div className={styles.bracketMatchupStatus}>
          <span className={`badge ${label === 'Final' ? 'badge-success' : 'badge-warning'}`}>{label}</span>
          {game.date && <span className={styles.bracketMatchupDate}>{game.date.slice(5).replace('-', '/')}</span>}
          {game.time && <span className={styles.bracketMatchupDate}>{formatTime(game.time)}</span>}
        </div>
      )}
      {!label && game.date && (
        <div className={styles.bracketMatchupStatus}>
          <span className={styles.bracketMatchupDate}>{game.date.slice(5).replace('-', '/')}</span>
          {game.time && <span className={styles.bracketMatchupDate}>{formatTime(game.time)}</span>}
        </div>
      )}
      <div className={`${styles.bracketTeam} ${awayWon ? styles.bracketTeamWon : ''} ${awayTbd ? styles.bracketTeamTbd : ''}`}>
        {!awayTbd && (
          <span
            className={styles.bracketTeamBadge}
            style={{ backgroundColor: teamColorFromName(awayName) }}
          >
            {teamInitials(awayName)}
          </span>
        )}
        <span className={styles.bracketTeamName}>{awayName}</span>
        {scored && !awayTbd && (
          <span className={`${styles.bracketScore} ${awayWon ? styles.bracketScoreWon : styles.bracketScoreLost}`}>
            {game.awayScore}
          </span>
        )}
      </div>
      <div className={styles.bracketDivider} />
      <div className={`${styles.bracketTeam} ${homeWon ? styles.bracketTeamWon : ''} ${homeTbd ? styles.bracketTeamTbd : ''}`}>
        {!homeTbd && (
          <span
            className={styles.bracketTeamBadge}
            style={{ backgroundColor: teamColorFromName(homeName) }}
          >
            {teamInitials(homeName)}
          </span>
        )}
        <span className={styles.bracketTeamName}>{homeName}</span>
        {scored && !homeTbd && (
          <span className={`${styles.bracketScore} ${homeWon ? styles.bracketScoreWon : styles.bracketScoreLost}`}>
            {game.homeScore}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Desktop: visual bracket tree ────────────────────────────────────────────

function BracketTree({ rounds, teams, requireFinalization }: {
  rounds: BracketRound[];
  teams: PublicTeam[];
  requireFinalization: boolean;
}) {
  // Separate 3rd-place game from main bracket rounds
  const mainRounds = rounds.filter(r => r.key !== '3RD');
  const thirdRound = rounds.find(r => r.key === '3RD');

  return (
    <div className={styles.bracketTreeOuter}>
      <div className={styles.bracketTree} style={{ '--bracket-rounds': mainRounds.length } as React.CSSProperties}>
        {mainRounds.map((round, roundIdx) => {
          const isLast = roundIdx === mainRounds.length - 1;
          // Pair games: consecutive pairs of games in this round connect to one game in next round
          const pairs: Game[][] = [];
          for (let i = 0; i < round.games.length; i += 2) {
            pairs.push(round.games.slice(i, i + 2));
          }
          return (
            <div key={round.key} className={styles.bracketRound}>
              <div className={styles.bracketRoundLabel}>{round.label}</div>
              <div className={styles.bracketRoundGames}>
                {pairs.map((pair, pairIdx) => (
                  <div
                    key={pairIdx}
                    className={`${styles.bracketBranch} ${!isLast && pair.length === 2 ? styles.bracketBranchConnected : ''}`}
                    data-single={pair.length === 1 || undefined}
                  >
                    {pair.map(game => (
                      <MatchupCard
                        key={game.id}
                        game={game}
                        teams={teams}
                        requireFinalization={requireFinalization}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {thirdRound && thirdRound.games.length > 0 && (
        <div className={styles.bracketThirdPlace}>
          <div className={styles.bracketThirdLabel}>{thirdRound.label}</div>
          {thirdRound.games.map(game => (
            <MatchupCard
              key={game.id}
              game={game}
              teams={teams}
              requireFinalization={requireFinalization}
              compact
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Mobile: rounds as grouped list ──────────────────────────────────────────

function BracketList({ rounds, teams, requireFinalization }: {
  rounds: BracketRound[];
  teams: PublicTeam[];
  requireFinalization: boolean;
}) {
  const allRounds = [...rounds].sort((a, b) => a.order - b.order);
  return (
    <div className={styles.bracketList}>
      {allRounds.map(round => (
        <div key={round.key} className={styles.bracketListRound}>
          <div className={styles.bracketListRoundLabel}>{round.label}</div>
          {round.games.map(game => (
            <MatchupCard
              key={game.id}
              game={game}
              teams={teams}
              requireFinalization={requireFinalization}
              compact
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── Public export ────────────────────────────────────────────────────────────

// ─── Champion spotlight — the decided final's winner ─────────────────────────

function getChampionName(playoffGames: Game[], teams: PublicTeam[]): string | null {
  // The decided final's winner — for double elimination that is the grand-final
  // reset (if played), then the grand final, otherwise the single-elim final.
  const decided = (g?: Game) =>
    !!g && (g.status === 'completed' || g.status === 'submitted') && !!getOutcome(g) && getOutcome(g) !== 'tie';
  const byCode = (code: string) => playoffGames.find(g => (g.bracketCode || '').toUpperCase() === code);
  const finalGame = [byCode('GF2'), byCode('GF'), byCode('FIN')].find(decided);
  if (!finalGame) return null;
  const outcome = getOutcome(finalGame);
  if (!outcome || outcome === 'tie') return null;
  const winnerId = outcome === 'home' ? finalGame.homeTeamId : finalGame.awayTeamId;
  const placeholder = outcome === 'home' ? finalGame.homePlaceholder : finalGame.awayPlaceholder;
  return winnerId ? teamName(teams, winnerId) : (placeholder ?? null);
}

export default function PublicBracketView({ games, teams, requireFinalization }: Props) {
  const playoffGames = games.filter(g => g.isPlayoff);
  if (playoffGames.length === 0) return null;

  const rounds = buildRounds(playoffGames);
  const champion = getChampionName(playoffGames, teams);

  return (
    <>
      {champion && (
        <div className={styles.bracketChampion}>
          <Trophy size={22} className={styles.bracketChampionIcon} />
          <div className={styles.bracketChampionBody}>
            <span className={styles.bracketChampionLabel}>Champion</span>
            <span className={styles.bracketChampionName}>
              <span className={styles.bracketChampionBadge} style={{ backgroundColor: teamColorFromName(champion) }}>
                {teamInitials(champion)}
              </span>
              {champion}
            </span>
          </div>
        </div>
      )}
      {/* Desktop */}
      <div className={styles.bracketDesktop}>
        <BracketTree rounds={rounds} teams={teams} requireFinalization={requireFinalization} />
      </div>
      {/* Mobile — swipeable round-by-round carousel */}
      <div className={styles.bracketMobile}>
        <BracketList rounds={rounds} teams={teams} requireFinalization={requireFinalization} />
      </div>
    </>
  );
}
