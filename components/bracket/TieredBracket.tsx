'use client';

import type { Game, PublicTeam, Venue } from '@/lib/types';
import { formatPoolName } from '@/lib/utils';
import { groupGamesByBracketId, inferGamePool } from '@/lib/playoff-bracket';
import { LogicSyncBracket } from './LogicSyncBracket';

interface Pool { id: string; name: string }

interface TieredBracketProps {
  /** Playoff games for the active division (already filtered by the caller). */
  games: Game[];
  teams: PublicTeam[];
  /** Division pools — drives the per-pool split when the bracket is pool-seeded. */
  pools: Pool[];
  tournamentId: string;
  orgSlug: string;
  tournamentSlug: string;
  venues: Venue[];
  highlightTeamId?: string;
  requireFinalization?: boolean;
}

/** Centered divider header used to title each pool / tier section. */
function SectionHeader({ name }: { name: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
      <div style={{ height: '1px', flex: 1, background: 'linear-gradient(to right, transparent, var(--primary))' }} />
      <h2 className="display-sm" style={{ color: 'var(--primary-light)' }}>{name}</h2>
      <div style={{ height: '1px', flex: 1, background: 'linear-gradient(to left, transparent, var(--primary))' }} />
    </div>
  );
}

/**
 * Renders a division's playoff games as one or more bracket diagrams, splitting
 * the SAME way the Schedule tab does so every surface (Schedule + Standings)
 * stays in lockstep:
 *   1. Pool-seeded bracket (≥2 pools referenced) → one diagram per pool.
 *   2. Otherwise tiered/per-bracket (≥2 independent bracket_ids reusing codes)
 *      → one diagram per group (titled by the tier label).
 *   3. Otherwise a single bracket.
 * Each diagram resolves live venue field labels and links cards to the public
 * game-detail page.
 */
export function TieredBracket({
  games, teams, pools, tournamentId, orgSlug, tournamentSlug, venues, highlightTeamId, requireFinalization = true,
}: TieredBracketProps) {
  const bracketProps = { teams, tournamentId, orgSlug, tournamentSlug, venues, highlightTeamId, requireFinalization };

  const bracketHasPools = pools.length >= 2 && games.some(g =>
    pools.some(p => {
      const bare = p.name.replace(/^Pool\s+/i, '').trim();
      return g.homePlaceholder?.includes(`Pool ${bare}`) || g.awayPlaceholder?.includes(`Pool ${bare}`);
    })
  );

  if (bracketHasPools) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
        {pools.map(pool => {
          const poolGames = games.filter(g => inferGamePool(g, games, pools) === pool.name);
          if (poolGames.length === 0) return null;
          return (
            <div key={pool.id}>
              <SectionHeader name={`${formatPoolName(pool.name)} Playoffs`} />
              <LogicSyncBracket games={poolGames} {...bracketProps} />
            </div>
          );
        })}
      </div>
    );
  }

  // Tiered (or per-bracket) split: pools don't drive it, but the games span ≥2
  // independent brackets (each tier its own bracket_id, reusing codes) — render
  // one bracket per group so tiers stay separate (the Standings parity fix).
  const bracketGroups = groupGamesByBracketId(games);
  if (bracketGroups.length > 1) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
        {bracketGroups.map((grp, i) => (
          <div key={grp.key}>
            <SectionHeader name={grp.label || `Bracket ${i + 1}`} />
            <LogicSyncBracket games={grp.games} {...bracketProps} />
          </div>
        ))}
      </div>
    );
  }

  return <LogicSyncBracket games={games} {...bracketProps} />;
}
