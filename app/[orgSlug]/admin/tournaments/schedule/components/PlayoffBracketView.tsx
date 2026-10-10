'use client';
/** The schedule's Bracket view (split pools, tiered brackets, or one diagram). Moved out of the schedule page, Stage 3 Part 0. */
import { Trophy } from 'lucide-react';
import { formatPoolName } from '@/lib/utils';
import { groupGamesByBracketId } from '@/lib/playoff-bracket';
import { useKitStyle } from '@/components/admin/AdminKitProvider';
import { KIT_INK } from '@/components/admin/kit/kit-inline';
import BracketColumns, { buildBracketColumns } from './BracketColumns';

function inferGamePool(game: any, allGames: any[], pools: any[]): string | null {
  // Direct: placeholder contains "Pool X"
  for (const pool of pools) {
    const bare = pool.name.replace(/^Pool\s+/i, '').trim();
    const tag = `Pool ${bare}`;
    if (game.homePlaceholder?.includes(tag) || game.awayPlaceholder?.includes(tag)) {
      return pool.name;
    }
  }
  // Transitive: "Winner SF1" → find that game's pool.
  // Match by bracketId (set per-pool in executeCreate) to avoid code collisions.
  const ph = game.homePlaceholder || game.awayPlaceholder || '';
  const winnerCode = ph.match(/(?:Winner|Loser) ([\w-]+)/)?.[1];
  if (winnerCode) {
    const source = allGames.find((g: any) =>
      g.bracketCode === winnerCode &&
      g.isPlayoff &&
      g.id !== game.id &&
      (game.bracketId ? g.bracketId === game.bracketId : true)
    );
    if (source) return inferGamePool(source, allGames, pools);
  }
  // BracketId sibling fallback: for manually-added rounds with no placeholder,
  // find any sibling game in the same bracketId group that has a direct pool match.
  if (game.bracketId) {
    for (const sibling of allGames) {
      if (sibling.id === game.id || sibling.bracketId !== game.bracketId || !sibling.isPlayoff) continue;
      for (const pool of pools) {
        const bare = pool.name.replace(/^Pool\s+/i, '').trim();
        const tag = `Pool ${bare}`;
        if (sibling.homePlaceholder?.includes(tag) || sibling.awayPlaceholder?.includes(tag)) {
          return pool.name;
        }
      }
    }
  }
  return null;
}

// Detect split mode from game data: any playoff game whose placeholder names a pool
function hasSplitPoolGames(games: any[], pools: any[]): boolean {
  return pools.length >= 2 && games.some(g =>
    pools.some((p: any) => {
      const bare = p.name.replace(/^Pool\s+/i, '').trim();
      const tag = `Pool ${bare}`;
      return g.homePlaceholder?.includes(tag) || g.awayPlaceholder?.includes(tag);
    })
  );
}

export default function PlayoffBracketView({ games, teams, division, venues, canBuildManualBracket, onBuildBracket, onStartFromStandings, onEdit, onDelete, getGroupName, formatDate, statusBadge }: any) {
  const kx = useKitStyle();
  // Row-invariant kit patches — the two "one diagram per group" layouts below (split pools,
  // tiered brackets) share one section-title recipe: an eyebrow over each bracket diagram.
  const sectionTitleIconStyle = kx({ color: 'var(--logic-lime)' }, KIT_INK.accent);
  const sectionTitleStyle = kx(
    { color: 'var(--logic-lime)', fontFamily: 'var(--font-data)', fontSize: '0.85rem', fontWeight: 900, textTransform: 'uppercase' as const, letterSpacing: '0.1em', margin: 0 },
    { ...KIT_INK.eyebrowAccent, fontSize: '0.85rem' },
  );
  const sectionTitleRuleStyle = kx({ flex: 1, height: '1px', background: 'linear-gradient(to right, var(--blueprint-blue), transparent)' }, { background: 'linear-gradient(to right, var(--home-line), transparent)' });
  const otherTitleStyle = kx({ color: 'var(--white-40)', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase' as const, margin: 0 }, KIT_INK.tertiary);

  if (games.length === 0) {
    return (
      <div className="empty-state" style={{ padding: '4rem' }}>
        <Trophy size={48} />
        <p>No playoff bracket yet</p>
        <p className="text-sm text-muted" style={{ maxWidth: '34rem', margin: '0 auto' }}>
          A bracket is rounds of games wired together — each game feeds its winner (or loser) into the next.
          Build one here; the rounds and matchups link up automatically.
        </p>
        {canBuildManualBracket && onBuildBracket && (
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', justifyContent: 'center', marginTop: '1.25rem' }}>
            <button type="button" className="btn btn-lime btn-data" onClick={onBuildBracket}>
              <Trophy size={14} /> Build bracket
            </button>
            {onStartFromStandings && (
              <button type="button" className="btn btn-outline btn-data" onClick={onStartFromStandings}>
                Start from standings (1 v 8, 2 v 7…)
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  const pools = division?.pools || [];
  const isSplitMode = hasSplitPoolGames(games, pools);

  if (isSplitMode) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', gap: '3rem',
        padding: '2rem 0.75rem',
      }}>
        {pools.map((pool: any) => {
          const poolGames = games.filter((g: any) => inferGamePool(g, games, pools) === pool.name);
          if (poolGames.length === 0) return null;
          const columns = buildBracketColumns(poolGames);
          return (
            <div key={pool.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <Trophy size={16} style={sectionTitleIconStyle} />
                <h3 style={sectionTitleStyle}>
                  {formatPoolName(pool.name)} Playoffs
                </h3>
                <div style={sectionTitleRuleStyle} />
              </div>
              <BracketColumns columns={columns} onEdit={onEdit} onDelete={onDelete} formatDate={formatDate} venues={venues} />
            </div>
          );
        })}
        {(() => {
          const unassigned = games.filter((g: any) => inferGamePool(g, games, pools) === null);
          if (unassigned.length === 0) return null;
          return (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <h3 style={otherTitleStyle}>Other</h3>
              </div>
              <BracketColumns columns={buildBracketColumns(unassigned)} onEdit={onEdit} onDelete={onDelete} formatDate={formatDate} venues={venues} />
            </div>
          );
        })()}
      </div>
    );
  }

  // Tiered (or per-bracket) layout: when pools don't drive the split but the games
  // span ≥2 independent brackets (each tier is its own bracket_id, reusing codes),
  // render one diagram per bracket so tiers don't cross-wire into a single tree.
  const bracketGroups = groupGamesByBracketId(games);
  if (bracketGroups.length > 1) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem', padding: '2rem 0.75rem 0' }}>
        {bracketGroups.map((grp, i) => (
          <div key={grp.key}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <Trophy size={16} style={sectionTitleIconStyle} />
              <h3 style={sectionTitleStyle}>
                {grp.label || `Bracket ${i + 1}`}
              </h3>
              <div style={sectionTitleRuleStyle} />
            </div>
            <BracketColumns columns={buildBracketColumns(grp.games)} onEdit={onEdit} onDelete={onDelete} formatDate={formatDate} venues={venues} />
          </div>
        ))}
      </div>
    );
  }

  // Standard flat layout
  const columns = buildBracketColumns(games);
  return (
    <div style={{ padding: '2rem 0.75rem 0' }}>
      <BracketColumns columns={columns} onEdit={onEdit} onDelete={onDelete} formatDate={formatDate} venues={venues} />
    </div>
  );
}
