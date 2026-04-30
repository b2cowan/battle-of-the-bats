'use client';
import React, { useState } from 'react';
import { ChevronDown, ChevronUp, MapPin, Trophy, Pencil, X, AlertCircle, Trash2, MoreVertical } from 'lucide-react';
import { Game, Team, AgeGroup, Diamond } from '@/lib/types';
import { formatTime } from '@/lib/utils';
import s from '@/app/admin/admin-common.module.css';
import styles from '../schedule-admin.module.css';

interface GameListProps {
  games: Game[];
  teams: Team[];
  ageGroups: AgeGroup[];
  diamonds: Diamond[];
  viewMode: 'pool' | 'playoff';
  groupByPool: boolean;
  onEdit?: (g: Game) => void;
  onScore?: (g: Game) => void;
  onDelete?: (id: string) => void;
  onCancel?: (id: string) => void;
  onSchedule?: (id: string) => void;
  mode: 'planning' | 'scoring';
}

export default function GameList({
  games, teams, ageGroups, diamonds, viewMode, groupByPool,
  onEdit, onScore, onDelete, onCancel, onSchedule, mode
}: GameListProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const getTeamName = (id: string) => teams.find(t => t.id === id)?.name ?? 'TBD';
  const getGroupName = (id: string) => ageGroups.find(g => g.id === id)?.name ?? '—';
  const getDiamondName = (id?: string) => id ? (diamonds.find(d => d.id === id)?.name ?? '') : '';

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const set = new Set(prev);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return set;
    });
  }

  function formatDate(d: string) {
    return new Date(d + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  const getPlayoffPriority = (code?: string) => {
    if (!code) return 99;
    if (/^FIN/.test(code)) return 5;
    if (/^3RD/.test(code)) return 4;
    if (/^SF/.test(code)) return 3;
    if (/^QF/.test(code)) return 2;
    return 1; // Opening rounds
  };

  const sortedGames = [...games].sort((a, b) => {
    if (a.date !== b.date) return (a.date || '9999').localeCompare(b.date || '9999');
    if (a.time !== b.time) return (a.time || '99:99').localeCompare(b.time || '99:99');
    if (viewMode === 'playoff') {
      return getPlayoffPriority(a.bracketCode) - getPlayoffPriority(b.bracketCode);
    }
    return 0;
  });

  function statusBadge(status: string) {
    if (status === 'completed') return <span className="badge badge-success">Final</span>;
    if (status === 'cancelled') return <span className="badge badge-danger">Cancelled</span>;
    return <span className="badge badge-warning">Scheduled</span>;
  }

  const renderActions = (g: Game, isMobile: boolean) => (
    <div className={isMobile ? s.mobileMenu : s.desktopActions}>
      {onScore && (
        <button
          className="btn btn-primary btn-sm"
          onClick={(e) => { e.stopPropagation(); onScore(g); setOpenMenu(null); }}
          title={g.status === 'completed' ? 'Edit Score' : 'Enter Score'}
        >
          <Trophy size={14} />
        </button>
      )}
      {onEdit && (
        <button
          className="btn btn-ghost btn-sm"
          onClick={(e) => { e.stopPropagation(); onEdit(g); setOpenMenu(null); }}
          title="Edit Details"
        >
          <Pencil size={14} />
        </button>
      )}

      {g.status === 'scheduled' ? (
        onCancel && (
          <button
            className="btn btn-ghost btn-sm text-danger"
            onClick={(e) => { e.stopPropagation(); onCancel(g.id); setOpenMenu(null); }}
            title="Cancel Game"
          >
            <X size={14} />
          </button>
        )
      ) : (
        onSchedule && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={(e) => { e.stopPropagation(); onSchedule(g.id); setOpenMenu(null); }}
            title="Revert to Scheduled"
          >
            <AlertCircle size={14} />
          </button>
        )
      )}

      {onDelete && (
        <button
          className="btn btn-danger btn-sm"
          onClick={(e) => { e.stopPropagation(); onDelete(g.id); setOpenMenu(null); }}
          title="Delete Game"
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );

  const renderRow = (g: Game) => {
    const isExpanded = expanded.has(g.id);
    return (
      <div key={g.id} className={`${s.row} ${isExpanded ? styles.expanded : ''}`}>
        <div className={s.rowMain} onClick={() => toggleExpand(g.id)} style={{ cursor: 'pointer', gap: '1rem' }}>
          {/* 1. Date */}
          <div style={{ flex: '0 0 110px' }} className={styles.cell}>
            <strong>{g.date ? formatDate(g.date) : 'TBD Date'}</strong>
          </div>

          {/* 2. Time */}
          <div style={{ flex: '0 0 90px' }} className={styles.cell}>
            {g.time ? formatTime(g.time) : 'TBD Time'}
          </div>

          {/* 3. Diamond */}
          <div style={{ flex: '0 0 150px' }} className={styles.cell}>
            <div className="flex items-center gap-1 text-white-60 text-sm">
              <MapPin size={12} /> {g.diamondId ? getDiamondName(g.diamondId) : (g.location || 'TBD')}
            </div>
          </div>

          {/* 4. Teams (Horizontal) */}
          <div style={{ flex: '3 1 500px', minWidth: 0, display: 'flex', justifyContent: 'center' }} className={styles.cell}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '48px', width: '100%', justifyContent: 'center' }}>
              {/* Away Team Stack */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: '0.9rem',
                  color: mode === 'scoring' && g.status === 'completed' && (g.awayScore ?? 0) > (g.homeScore ?? 0) ? '#ffffff' : 'rgba(255,255,255,0.6)',
                  fontWeight: mode === 'scoring' && g.status === 'completed' && (g.awayScore ?? 0) > (g.homeScore ?? 0) ? 900 : 400,
                  textAlign: 'center',
                  width: '100%',
                  lineHeight: '1.2'
                }}>
                  {getTeamName(g.awayTeamId) || g.awayPlaceholder || 'TBD'}
                </div>
                {mode === 'scoring' && g.status === 'completed' && (
                  <div style={{
                    marginTop: '6px',
                    fontSize: '1rem',
                    fontWeight: 900,
                    color: (g.awayScore ?? 0) > (g.homeScore ?? 0) ? 'var(--success)' : (g.awayScore === g.homeScore) ? 'var(--warning)' : 'var(--danger)',
                    fontFamily: 'var(--font-display)',
                    letterSpacing: '0.05em'
                  }}>
                    {(g.awayScore ?? 0) > (g.homeScore ?? 0) ? 'W' : (g.awayScore === g.homeScore) ? 'T' : 'L'} {g.awayScore}
                  </div>
                )}
              </div>

              {/* VS Separator */}
              <div style={{
                color: 'rgba(255,255,255,0.4)',
                fontWeight: 900,
                fontStyle: 'italic',
                fontSize: '11px',
                letterSpacing: '0.1em',
                flexShrink: 0
              }}>VS</div>

              {/* Home Team Stack */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: '0.9rem',
                  color: mode === 'scoring' && g.status === 'completed' && (g.homeScore ?? 0) > (g.awayScore ?? 0) ? '#ffffff' : 'rgba(255,255,255,0.6)',
                  fontWeight: mode === 'scoring' && g.status === 'completed' && (g.homeScore ?? 0) > (g.awayScore ?? 0) ? 900 : 400,
                  textAlign: 'center',
                  width: '100%',
                  lineHeight: '1.2'
                }}>
                  {getTeamName(g.homeTeamId) || g.homePlaceholder || 'TBD'}
                </div>
                {mode === 'scoring' && g.status === 'completed' && (
                  <div style={{
                    marginTop: '6px',
                    fontSize: '1rem',
                    fontWeight: 900,
                    color: (g.homeScore ?? 0) > (g.awayScore ?? 0) ? 'var(--success)' : (g.homeScore === g.awayScore) ? 'var(--warning)' : 'var(--danger)',
                    fontFamily: 'var(--font-display)',
                    letterSpacing: '0.05em'
                  }}>
                    {(g.homeScore ?? 0) > (g.awayScore ?? 0) ? 'W' : (g.homeScore === g.awayScore) ? 'T' : 'L'} {g.homeScore}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end items-center gap-2">
            {mode === 'scoring' ? (
              <div className="flex items-center">
                {onScore && (
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={(e) => { e.stopPropagation(); onScore(g); }}
                    title={g.status === 'completed' ? 'Edit Score' : 'Enter Score'}
                    style={{ padding: '8px', borderRadius: '8px', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '30px' }}
                  >
                    <Trophy size={16} />
                  </button>
                )}
                <div style={{ width: '90px', display: 'flex', justifyContent: 'center' }}>
                  {statusBadge(g.status)}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className={s.desktopOnly}>
                  {renderActions(g, false)}
                </div>
                <div className={s.mobileOnly} style={{ position: 'relative' }}>
                  <button
                    className={s.iconBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenMenu(openMenu === g.id ? null : g.id);
                    }}
                  >
                    <MoreVertical size={20} />
                  </button>
                  {openMenu === g.id && (
                    <div className={s.dropdownMenu}>
                      {renderActions(g, true)}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div style={{ width: 24, textAlign: 'right' }}>
            <button className={s.iconBtn}>
              {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>
          </div>
        </div>

        {isExpanded && (
          <div className={s.expandedRow}>
            <div className={s.expandedContent}>
              <div className={s.expandedInfo}>
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-label" style={{ fontSize: '0.65rem' }}>Notes</span>
                    <p className="text-sm text-white-60 mt-1">{g.notes || ''}</p>
                  </div>
                </div>
              </div>

              <div className={s.expandedActions}>
                {mode === 'scoring' && (
                  <div className="flex gap-2">
                    {onEdit && (
                      <button className="btn btn-ghost btn-sm" onClick={() => onEdit(g)} title="Edit Details">
                        <Pencil size={14} />
                      </button>
                    )}

                    {g.status === 'scheduled' ? (
                      onCancel && (
                        <button className="btn btn-ghost btn-sm text-danger" onClick={() => onCancel(g.id)} title="Cancel Game">
                          <X size={14} />
                        </button>
                      )
                    ) : (
                      onSchedule && (
                        <button className="btn btn-ghost btn-sm" onClick={() => onSchedule(g.id)} title="Revert to Scheduled">
                          <AlertCircle size={14} />
                        </button>
                      )
                    )}

                    {onDelete && (
                      <button className="btn btn-danger btn-sm" onClick={() => onDelete(g.id)} title="Delete Game">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const firstGameGroupId = games[0]?.ageGroupId;
  const currentAgeGroup = ageGroups.find(g => g.id === firstGameGroupId);
  const ageGroupName = currentAgeGroup?.name || 'All Games';
  const pools = currentAgeGroup?.pools || [];

  return (
    <div className={s.groupSection}>
      <div className={s.groupHeader}>
        <strong>{ageGroupName}</strong>
        <span className="badge badge-purple">{sortedGames.length} Game{sortedGames.length !== 1 ? 's' : ''}</span>
      </div>

      <div className={s.compactListContent}>
        {/* Playoff View */}
        {viewMode === 'playoff' && (() => {
          const rounds: Record<string, Game[]> = {};
          const roundOrder = ['QF', 'SF', '3RD', 'FIN', 'CON'];
          const roundNames: Record<string, string> = {
            'QF': 'Quarterfinals',
            'SF': 'Semifinals',
            '3RD': 'Consolation / 3rd Place',
            'FIN': 'Championship',
            'CON': 'Consolation'
          };

          sortedGames.forEach(g => {
            const code = g.bracketCode || 'OTHER';
            const prefix = roundOrder.find(p => code.startsWith(p)) || 'OTHER';
            if (!rounds[prefix]) rounds[prefix] = [];
            rounds[prefix].push(g);
          });

          const activeRounds = roundOrder.filter(r => rounds[r]);
          if (rounds['OTHER']) activeRounds.push('OTHER');

          return activeRounds.map(r => (
            <div key={r} className={s.poolSubSection}>
              <div className={s.poolSubHeader}>
                <div className={s.poolDot} style={{ background: 'var(--purple-light)' }} />
                <span className={s.poolSubLabel}>{roundNames[r] || 'Additional Games'}</span>
                <span className={s.poolSubCount}>({rounds[r].length})</span>
              </div>
              {rounds[r].map(g => renderRow(g))}
            </div>
          ));
        })()}

        {/* Pool View with Grouping */}
        {viewMode === 'pool' && groupByPool && pools.length >= 2 && (() => {
          const byPool = sortedGames.reduce((acc, g) => {
            // Try to find which pool this game belongs to based on teams
            const homeTeam = teams.find(t => t.id === g.homeTeamId);
            const awayTeam = teams.find(t => t.id === g.awayTeamId);
            const pid = homeTeam?.poolId || awayTeam?.poolId || 'unassigned';
            if (!acc[pid]) acc[pid] = [];
            acc[pid].push(g);
            return acc;
          }, {} as Record<string, Game[]>);

          return [{ id: 'unassigned', name: 'Unassigned' }, ...pools].map(p => {
            const poolGames = byPool[p.id] || [];
            if (poolGames.length === 0) return null;

            return (
              <div key={p.id} className={s.poolSubSection}>
                <div className={s.poolSubHeader}>
                  <div className={s.poolDot} style={{ background: p.id === 'unassigned' ? 'var(--danger-light)' : 'var(--purple-light)' }} />
                  <span className={s.poolSubLabel} style={{ color: p.id === 'unassigned' ? 'var(--danger-light)' : undefined }}>
                    {p.id === 'unassigned' ? 'UNASSIGNED' : `POOL ${p.name}`}
                  </span>
                  <span className={s.poolSubCount}>({poolGames.length})</span>
                </div>
                {poolGames.map(g => renderRow(g))}
              </div>
            );
          });
        })()}

        {/* Pool View Flat or Single Pool */}
        {viewMode === 'pool' && (!groupByPool || pools.length < 2) && (
          <div className="space-y-1">
            {sortedGames.map(g => renderRow(g))}
          </div>
        )}
      </div>
    </div>
  );
}
