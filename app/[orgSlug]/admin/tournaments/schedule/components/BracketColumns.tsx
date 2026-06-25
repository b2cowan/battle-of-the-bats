'use client';
import React, { useRef } from 'react';
import { Calendar, Clock, MapPin, Trophy, Pencil, Trash2 } from 'lucide-react';
import { bracketRoundInfo, computeBracketColumns, displayBracketRefs, displayRoundTitle } from '@/lib/playoff-bracket';
import { resolveGameVenueLabel } from '@/lib/venue-label';
import { formatTime } from '@/lib/utils';
import BracketConnectors from './BracketConnectors';
import BracketZoomFrame from './BracketZoomFrame';
import styles from '../schedule-admin.module.css';

/**
 * Group games into ordered round columns via the shared bracketRoundInfo(), so
 * single elimination, double elimination (winners/losers/grand final), and
 * consolation all render as ordered columns. Connectors are inferred from the
 * Winner/Loser placeholders, so they follow any format. Used by both the main
 * Schedule playoff View and the (read-only) auto-generator preview.
 */
export function buildBracketColumns(games: any[]) {
  const sortByCode = (a: any, b: any) => {
    if (/^FIN/i.test(a.bracketCode || '') && /^3RD/i.test(b.bracketCode || '')) return -1;
    if (/^3RD/i.test(a.bracketCode || '') && /^FIN/i.test(b.bracketCode || '')) return 1;
    return (a.bracketCode || '').localeCompare(b.bracketCode || '');
  };
  const colMap = computeBracketColumns(games);
  const groups = new Map<string, { key: string; title: string; rank: number; games: any[] }>();
  for (const g of games) {
    let info = colMap.get(g.id) || bracketRoundInfo(g.bracketCode || '');
    // The "if necessary" reset is its own column just right of the Grand Final.
    if ((g.bracketCode || '').toUpperCase() === 'GF2') {
      info = { key: 'GF2', title: 'Grand Final Game 2 (If Necessary)', rank: 501 };
    }
    let grp = groups.get(info.key);
    if (!grp) { grp = { key: info.key, title: info.title, rank: info.rank, games: [] }; groups.set(info.key, grp); }
    grp.games.push(g);
  }
  return [...groups.values()]
    .sort((a, b) => a.rank - b.rank)
    .map(grp => ({ key: grp.key, title: grp.title, games: grp.games.sort(sortByCode) }));
}

/**
 * Read-only bracket diagram. Pass `readOnly` to drop the per-game edit/delete
 * affordances (the auto-generator preview shows structure only — editing happens
 * inline on the main screen via BracketEditor). Pass `venues` (with facilities)
 * so location labels resolve live instead of from the stored snapshot.
 */
export default function BracketColumns({ columns, onEdit, onDelete, formatDate, readOnly = false, venues }: any) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const connectorMatchups = columns.flatMap((c: any) => c.games).map((g: any) => ({
    id: g.id,
    code: g.bracketCode || '',
    home: { label: g.homePlaceholder || '' },
    away: { label: g.awayPlaceholder || '' },
  }));
  const gfFinalCols = columns.filter((c: any) => c.key === 'GF' || c.key === 'GF2');
  const finalCol = columns.find((c: any) => c.title === 'Finals') ?? columns[columns.length - 1];
  const finalGameIds = new Set<string>(
    (gfFinalCols.length ? gfFinalCols.flatMap((c: any) => c.games) : (finalCol?.games ?? [])).map((g: any) => g.id),
  );

  // Double elimination → a shared SEED round (round 1) first, then the bracket
  // FORKS into the winners bracket (top) and losers bracket (bottom), with the
  // grand final on the far right. Keeping round 1 shared (instead of inside the
  // winners tier) means every downstream feed flows forward (rightward), never
  // back under the seed games. Other formats stay flat.
  const isDoubleElim = columns.some((c: any) => /^LB\d/.test(c.key || ''));
  const indexed = columns.map((col: any, idx: number) => ({ col, idx }));
  const wbRound = (key: string) => { const m = /^WB(\d+)$/.exec(key || ''); return m ? parseInt(m[1], 10) : null; };
  const seedCols = indexed.filter(({ col }: any) => wbRound(col.key) === 1);
  const winnersCols = indexed.filter(({ col }: any) => (wbRound(col.key) ?? 0) >= 2);
  const losersCols = indexed.filter(({ col }: any) => /^LB\d/.test(col.key || ''));
  const gfCols = indexed.filter(({ col }: any) => col.key === 'GF' || col.key === 'GF2');
  const hasLoserPath = connectorMatchups.some((m: any) =>
    /^loser\s/i.test(m.home.label) || /^loser\s/i.test(m.away.label));

  const renderColumn = ({ col, idx }: any) => (
        <div key={idx} className={styles.readBracketColumn}>
          <div style={{
            textAlign: 'center',
            color: 'var(--logic-lime)',
            fontFamily: 'var(--font-data)',
            fontSize: '0.8rem',
            fontWeight: 900,
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            marginBottom: '1.5rem',
            opacity: 0.7,
            padding: '2px 4px',
          }}>
            {displayRoundTitle(col.title)}
          </div>

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: (col.title === 'Finals' || col.key === 'GF') ? 'center' : 'space-around',
            flex: 1,
            gap: (col.title === 'Finals' || col.key === 'GF') ? '2.5rem' : '1.5rem'
          }}>
            {col.games.map((g: any) => {
              const isFinalGame = finalGameIds.has(g.id);
              return (
              <div key={g.id} style={{ position: 'relative' }}>
                <div className="card" data-matchup-id={g.id} style={{
                  padding: '0.75rem',
                  border: isFinalGame
                    ? '1px solid rgba(var(--logic-lime-rgb), 0.55)'
                    : '1px solid rgba(var(--blueprint-blue-rgb), 0.2)',
                  background: 'var(--surface)',
                  position: 'relative', zIndex: 1,
                  boxShadow: isFinalGame
                    ? '0 0 0 1px rgba(var(--logic-lime-rgb), 0.28), 0 6px 20px rgba(var(--logic-lime-rgb), 0.14)'
                    : 'var(--shadow-sm)',
                  borderRadius: '2px'
                }}>
                  <div className="flex-between" style={{ marginBottom: '7px' }}>
                    <div style={{
                      fontSize: '0.6rem', fontWeight: 900, color: 'var(--logic-lime)',
                      background: 'rgba(var(--blueprint-blue-rgb), 0.1)', padding: '2px 8px',
                      borderRadius: '2px', border: '1px solid rgba(var(--blueprint-blue-rgb), 0.2)', letterSpacing: '0.02em'
                    }}>{displayBracketRefs(g.bracketCode)}</div>
                    {!readOnly && (
                      <div className="flex gap-1.5">
                        <button className="btn btn-ghost btn-sm" onClick={() => onEdit(g)} title="Edit" style={{
                          height: '24px', width: '24px', padding: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: 'var(--white-03)'
                        }}><Pencil size={11} /></button>
                        <button className="btn btn-ghost btn-sm text-danger" onClick={() => onDelete(g.id)} title="Delete" style={{
                          height: '24px', width: '24px', padding: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: 'var(--white-03)'
                        }}><Trash2 size={11} /></button>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{
                        width: '28px', fontSize: '0.55rem', fontWeight: 900, color: 'var(--data-gray)',
                        textAlign: 'center', background: 'rgba(var(--blueprint-blue-rgb), 0.1)', padding: '1px 0',
                        borderRadius: '2px', border: '1px solid rgba(var(--blueprint-blue-rgb), 0.2)', letterSpacing: '0.02em'
                      }}>VIS</div>
                      <div style={{
                        fontWeight: '700', fontSize: '0.85rem', color: 'var(--white)',
                        flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                      }}>
                        {displayBracketRefs(g.awayPlaceholder) || 'TBD'}
                      </div>
                    </div>
                    <div style={{ height: '1px', background: 'var(--white-03)' }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{
                        width: '28px', fontSize: '0.55rem', fontWeight: 900, color: 'var(--data-gray)',
                        textAlign: 'center', background: 'rgba(var(--blueprint-blue-rgb), 0.1)', padding: '1px 0',
                        borderRadius: '2px', border: '1px solid rgba(var(--blueprint-blue-rgb), 0.2)', letterSpacing: '0.02em'
                      }}>HOM</div>
                      <div style={{
                        fontWeight: '700', fontSize: '0.85rem', color: 'var(--white)',
                        flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                      }}>
                        {displayBracketRefs(g.homePlaceholder) || 'TBD'}
                      </div>
                    </div>
                  </div>

                  <div style={{
                    display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '0.4rem',
                    paddingTop: '0.6rem', borderTop: '1px solid var(--white-5)',
                    fontSize: '0.7rem', color: 'var(--white-40)'
                  }}>
                    <div className="flex items-center" style={{ gap: '5px' }}><Calendar size={10} className="text-primary-light opacity-50" /> {g.date ? formatDate(g.date) : 'TBD'}</div>
                    <div className="flex items-center" style={{ gap: '5px', justifyContent: 'flex-end' }}><Clock size={10} className="text-primary-light opacity-50" /> {g.time ? formatTime(g.time) : 'TBD'}</div>
                    <div className="flex items-center" style={{ gap: '5px', gridColumn: 'span 2' }}><MapPin size={10} className="text-primary-light opacity-50" /> {(venues ? resolveGameVenueLabel(g, venues) : g.location) || 'TBD'}</div>
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        </div>
  );

  return (
    <div className={styles.readBracketWrap}>
      {hasLoserPath && (
        <div className={styles.bracketLegend}>
          <span><i className={styles.legendWin} /> Winner advances</span>
          <span><i className={styles.legendLoss} /> Loser drops down</span>
        </div>
      )}
      <BracketZoomFrame fitKey={columns.map((c: any) => `${c.key}:${c.games.length}`).join('|')}>
        {(zoom: number) => (
        <div ref={canvasRef} className={`${styles.readBracketCanvas}${isDoubleElim ? ` ${styles.readBracketCanvasTiered}` : ''}`}>
          <BracketConnectors canvasRef={canvasRef} matchups={connectorMatchups} finalIds={finalGameIds} scale={zoom} />
        {isDoubleElim ? (
          <>
            {seedCols.length > 0 && (
              <div className={styles.bracketSeedColumn}>
                {seedCols.map(renderColumn)}
              </div>
            )}
            <div className={styles.bracketSplit}>
              {winnersCols.length > 0 && (
                <div className={styles.bracketTier}>
                  <div className={styles.bracketTierLabel}><Trophy size={11} /> Winners Bracket</div>
                  <div className={styles.bracketTierRow}>{winnersCols.map(renderColumn)}</div>
                </div>
              )}
              <div className={styles.bracketTier}>
                <div className={styles.bracketTierLabel}>Losers Bracket</div>
                <div className={styles.bracketTierRow}>{losersCols.map(renderColumn)}</div>
              </div>
            </div>
            {gfCols.length > 0 && (
              <div className={styles.bracketGfSection}>
                <div className={styles.bracketGfRow}>{gfCols.map(renderColumn)}</div>
              </div>
            )}
          </>
        ) : (
          columns.map((col: any, idx: number) => renderColumn({ col, idx }))
        )}
        </div>
        )}
      </BracketZoomFrame>
    </div>
  );
}
