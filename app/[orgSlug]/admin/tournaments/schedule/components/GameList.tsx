'use client';
import { useState } from 'react';
import { ChevronDown, ChevronUp, MapPin, Trophy, Pencil, X, AlertCircle, Trash2, Check } from 'lucide-react';
import { Game, Team, AgeGroup, Diamond } from '@/lib/types';
import { formatTime, formatPoolName } from '@/lib/utils';
import { scoreSubmissionSummary } from '@/lib/tournament-score-audit';
import { Pool } from '@/lib/types';
import s from '@/app/admin/admin-common.module.css';
import styles from '../schedule-admin.module.css';

interface GameListProps {
  games: Game[];
  teams: Team[];
  ageGroups: AgeGroup[];
  diamonds: Diamond[];
  viewMode: 'pool' | 'playoff';
  groupByPool: boolean;
  pools?: Pool[];
  onEdit?: (g: Game) => void;
  onScore?: (g: Game) => void;
  onFinalize?: (id: string) => void;
  onDelete?: (id: string) => void;
  onCancel?: (id: string) => void;
  onSchedule?: (id: string) => void;
  onSave?: (gameId: string, data: { date: string; time: string; diamondId: string; notes: string }) => Promise<void>;
  onCreateVenue?: () => void;
  mode: 'planning' | 'scoring';
}

type EditFields = { date: string; time: string; diamondId: string; notes: string };

export default function GameList({
  games, teams, ageGroups, diamonds, viewMode, groupByPool, pools: poolsProp,
  onEdit, onScore, onFinalize, onDelete, onCancel, onSchedule, onSave, onCreateVenue, mode
}: GameListProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editState, setEditState] = useState<Record<string, EditFields>>({});
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [saveErrors, setSaveErrors] = useState<Record<string, string>>({});

  const getTeamName = (id: string) => teams.find(t => t.id === id)?.name ?? null;
  const resolveTeam = (id: string, placeholder?: string) => getTeamName(id) ?? placeholder ?? 'TBD';
  const getDiamondName = (id?: string) => id ? (diamonds.find(d => d.id === id)?.name ?? '') : '';

  function toggleExpand(id: string, game?: Game) {
    const isExpanding = !expanded.has(id);
    setExpanded(prev => {
      const set = new Set(prev);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return set;
    });
    // Initialize edit state the first time a planning-mode row expands
    if (isExpanding && game && mode === 'planning') {
      setEditState(prev => {
        if (prev[id]) return prev;
        return {
          ...prev,
          [id]: {
            date: game.date ?? '',
            time: game.time ?? '',
            diamondId: game.diamondId ?? '',
            notes: game.notes ?? '',
          },
        };
      });
    }
  }

  function formatDate(d: string) {
    return new Date(d + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function formatShortDate(d: string) {
    return new Date(d + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
  }

  const getPlayoffPriority = (code?: string) => {
    if (!code) return 99;
    if (/^FIN/i.test(code)) return 4;
    if (/^3RD/i.test(code)) return 3;
    if (/^SF/i.test(code)) return 2;
    if (/^QF/i.test(code)) return 1;
    return 5; // Custom/manually-added rounds appear after standard rounds
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
    if (status === 'submitted') return <span className="badge badge-warning">Pending Review</span>;
    if (status === 'cancelled') return <span className="badge badge-danger">Cancelled</span>;
    return <span className="badge badge-neutral">Scheduled</span>;
  }

  const renderRow = (g: Game) => {
    const isExpanded = expanded.has(g.id);
    const hasScoredResult = mode === 'scoring'
      && (g.status === 'completed' || g.status === 'submitted')
      && g.homeScore != null
      && g.awayScore != null;
    const scoreAuditSummary = hasScoredResult
      ? scoreSubmissionSummary({
          source: g.scoreSubmissionSource,
          email: g.scoreSubmittedByEmail,
          submittedAt: g.scoreSubmittedAt,
        })
      : '';

    // ── SCORING MODE ──────────────────────────────────────────────────────────
    if (mode === 'scoring') {
      return (
        <div key={g.id} className={`${s.row} ${isExpanded ? styles.expanded : ''}`}>
          <div className={s.rowMain} onClick={() => toggleExpand(g.id, g)} style={{ cursor: 'pointer', gap: '1rem' }}>
            {/* Date + Time */}
            <div style={{ flex: '0 0 120px' }}>
              <div style={{ fontFamily: 'var(--font-data)', fontWeight: 700, fontSize: '0.8rem', color: 'var(--fl-text)', letterSpacing: '0.01em' }}>
                {g.date ? formatDate(g.date) : 'TBD'}
              </div>
              <div style={{ fontFamily: 'var(--font-data)', fontSize: '0.68rem', color: 'var(--data-gray)', marginTop: '1px' }}>
                {g.time ? formatTime(g.time) : '—'}
              </div>
            </div>
            {/* Location */}
            <div style={{ flex: '0 0 140px', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: 'var(--data-gray)', fontFamily: 'var(--font-data)' }}>
                <MapPin size={11} style={{ flexShrink: 0 }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {g.diamondId ? getDiamondName(g.diamondId) : (g.location || 'TBD')}
                </span>
              </div>
            </div>
            {/* Teams */}
            <div style={{ flex: '2 1 0', minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flex: 1, minWidth: 0, overflow: 'hidden' }}>
                <div style={{ fontFamily: 'var(--font-data)', fontSize: '0.85rem', fontWeight: 700, color: hasScoredResult && (g.awayScore ?? 0) > (g.homeScore ?? 0) ? 'var(--white)' : 'var(--fl-text)', textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                  {resolveTeam(g.awayTeamId, g.awayPlaceholder)}
                </div>
                {hasScoredResult && (
                  <div style={{ marginTop: '3px', fontSize: '0.75rem', fontWeight: 900, color: (g.awayScore ?? 0) > (g.homeScore ?? 0) ? 'var(--success)' : (g.awayScore === g.homeScore) ? 'var(--warning)' : 'var(--danger)', fontFamily: 'var(--font-data)', letterSpacing: '0.05em' }}>
                    {(g.awayScore ?? 0) > (g.homeScore ?? 0) ? 'W' : (g.awayScore === g.homeScore) ? 'T' : 'L'} {g.awayScore}
                  </div>
                )}
              </div>
              <div style={{ color: 'var(--white-30)', fontFamily: 'var(--font-data)', fontWeight: 900, fontSize: '0.6rem', letterSpacing: '0.12em', flexShrink: 0 }}>VS</div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flex: 1, minWidth: 0, overflow: 'hidden' }}>
                <div style={{ fontFamily: 'var(--font-data)', fontSize: '0.85rem', fontWeight: 700, color: hasScoredResult && (g.homeScore ?? 0) > (g.awayScore ?? 0) ? 'var(--white)' : 'var(--fl-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                  {resolveTeam(g.homeTeamId, g.homePlaceholder)}
                </div>
                {hasScoredResult && (
                  <div style={{ marginTop: '3px', fontSize: '0.75rem', fontWeight: 900, color: (g.homeScore ?? 0) > (g.awayScore ?? 0) ? 'var(--success)' : (g.homeScore === g.awayScore) ? 'var(--warning)' : 'var(--danger)', fontFamily: 'var(--font-data)', letterSpacing: '0.05em' }}>
                    {(g.homeScore ?? 0) > (g.awayScore ?? 0) ? 'W' : (g.homeScore === g.awayScore) ? 'T' : 'L'} {g.homeScore}
                  </div>
                )}
              </div>
            </div>
            {/* Scoring actions */}
            <div className="flex justify-end items-center gap-2">
              {(g.homeSlotId || g.awaySlotId) && !g.isPlayoff && (
                <span className="badge badge-neutral" style={{ fontSize: '0.65rem', letterSpacing: '0.05em', flexShrink: 0 }}>SLOT</span>
              )}
              <div className="flex items-center gap-2">
                {onScore && (
                  <button className="btn btn-primary btn-sm" onClick={(e) => { e.stopPropagation(); onScore(g); }} title={g.status === 'completed' ? 'Edit Score' : g.status === 'submitted' ? 'Edit Submitted Score' : 'Enter Score'} style={{ padding: '8px', borderRadius: '2px', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Trophy size={16} />
                  </button>
                )}
                {onFinalize && g.status === 'submitted' && (
                  <button className="btn btn-success btn-sm" onClick={(e) => { e.stopPropagation(); onFinalize(g.id); }} title="Finalize Score" style={{ fontSize: '0.7rem', padding: '4px 8px' }}>
                    Finalize
                  </button>
                )}
                <div style={{ width: '90px', display: 'flex', justifyContent: 'center' }}>{statusBadge(g.status)}</div>
              </div>
            </div>
            <div style={{ width: 24, textAlign: 'right' }}>
              <button className={s.iconBtn}>{isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}</button>
            </div>
          </div>
          {isExpanded && (
            <div className={s.expandedRow}>
              <div className={s.expandedContent}>
                <div className={s.expandedInfo}>
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-label" style={{ fontSize: '0.65rem' }}>Notes</span>
                      <p className="text-sm text-white-60 mt-1">{g.notes || '—'}</p>
                    </div>
                    {scoreAuditSummary && (
                      <div className="flex flex-col gap-1">
                        <span className="text-label" style={{ fontSize: '0.65rem' }}>Score submission</span>
                        <p className="text-sm text-white-60 mt-1">{scoreAuditSummary}</p>
                      </div>
                    )}
                  </div>
                </div>
                <div className={s.expandedActions}>
                  <div className="flex gap-2">
                    {onEdit && <button className="btn btn-ghost btn-sm" onClick={() => onEdit(g)} title="Edit Details"><Pencil size={14} /></button>}
                    {g.status === 'scheduled' && onCancel && (
                      <button className="btn btn-ghost btn-sm text-danger" onClick={() => onCancel(g.id)} title="Cancel Game"><X size={14} /></button>
                    )}
                    {g.status === 'cancelled' && onSchedule && (
                      <button className="btn btn-ghost btn-sm" onClick={() => onSchedule(g.id)} title="Revert to Scheduled"><AlertCircle size={14} /></button>
                    )}
                    {onDelete && <button className="btn btn-danger btn-sm" onClick={() => onDelete(g.id)} title="Delete Game"><Trash2 size={14} /></button>}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    // ── PLANNING MODE ─────────────────────────────────────────────────────────
    const edit = editState[g.id] ?? {
      date: g.date ?? '',
      time: g.time ?? '',
      diamondId: g.diamondId ?? '',
      notes: g.notes ?? '',
    };
    const isSaving = saving.has(g.id);

    const handleDiscard = () => {
      setEditState(prev => ({
        ...prev,
        [g.id]: { date: g.date ?? '', time: g.time ?? '', diamondId: g.diamondId ?? '', notes: g.notes ?? '' },
      }));
      setSaveErrors(prev => { const n = { ...prev }; delete n[g.id]; return n; });
      setExpanded(prev => { const next = new Set(prev); next.delete(g.id); return next; });
    };

    const handleSave = async () => {
      if (!onSave) return;
      setSaving(prev => new Set(prev).add(g.id));
      setSaveErrors(prev => { const n = { ...prev }; delete n[g.id]; return n; });
      try {
        await onSave(g.id, edit);
        setEditState(prev => { const n = { ...prev }; delete n[g.id]; return n; });
        setExpanded(prev => { const next = new Set(prev); next.delete(g.id); return next; });
      } catch {
        setSaveErrors(prev => ({ ...prev, [g.id]: 'Save failed — please try again.' }));
      } finally {
        setSaving(prev => { const next = new Set(prev); next.delete(g.id); return next; });
      }
    };

    const isCompleted = g.status === 'completed';

    return (
      <div key={g.id} className={`${s.row} ${isExpanded ? styles.expanded : ''}`}>
        {/* ── Compact planning row ── */}
        <div
          className={s.rowMain}
          onClick={isCompleted ? undefined : () => toggleExpand(g.id, g)}
          style={{ cursor: isCompleted ? 'default' : 'pointer', gap: '1rem' }}
        >
          {/* Date + Time — single line */}
          <div style={{ flex: '0 0 150px', fontFamily: 'var(--font-data)', whiteSpace: 'nowrap', overflow: 'hidden' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--fl-text)' }}>
              {g.date ? formatShortDate(g.date) : 'TBD'}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--data-gray)', marginLeft: '0.4rem' }}>
              {g.time ? `· ${formatTime(g.time)}` : '· —'}
            </span>
          </div>

          {/* Location */}
          <div style={{ flex: '0 0 130px', display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden', fontFamily: 'var(--font-data)', fontSize: '0.72rem', color: 'var(--data-gray)' }}>
            <MapPin size={11} style={{ flexShrink: 0, opacity: 0.55 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {g.diamondId ? getDiamondName(g.diamondId) : (g.location || '—')}
            </span>
          </div>

          {/* Matchup */}
          <div style={{ flex: '2 1 0', minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.65rem' }}>
            <div style={{ flex: 1, textAlign: 'right', fontFamily: 'var(--font-data)', fontSize: '0.82rem', fontWeight: 700, color: 'var(--fl-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {resolveTeam(g.awayTeamId, g.awayPlaceholder)}
            </div>
            <div style={{ fontFamily: 'var(--font-data)', fontSize: '0.58rem', fontWeight: 900, color: 'var(--white-25)', letterSpacing: '0.1em', flexShrink: 0 }}>VS</div>
            <div style={{ flex: 1, fontFamily: 'var(--font-data)', fontSize: '0.82rem', fontWeight: 700, color: 'var(--fl-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {resolveTeam(g.homeTeamId, g.homePlaceholder)}
            </div>
          </div>

          {/* Fixed-width status area — always present so matchup column never shifts */}
          <div style={{ flex: '0 0 96px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.35rem' }}>
            {g.status !== 'scheduled' && statusBadge(g.status)}
            {(g.homeSlotId || g.awaySlotId) && !g.isPlayoff && (
              <span className="badge badge-neutral" style={{ fontSize: '0.6rem', letterSpacing: '0.04em' }}>SLOT</span>
            )}
          </div>

          {/* Chevron — hidden for completed games */}
          {!isCompleted ? (
            <button
              className={s.iconBtn}
              onClick={e => { e.stopPropagation(); toggleExpand(g.id, g); }}
              style={{ flexShrink: 0 }}
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          ) : (
            <div style={{ width: 28, flexShrink: 0 }} />
          )}
        </div>

        {/* ── Inline edit panel ── */}
        {isExpanded && (
          <div className={styles.inlineForm}>
            <div className={styles.inlineFormBody}>
              {/* Date */}
              <div className={styles.formField}>
                <label className={styles.formLabel}>Date</label>
                <input
                  type="date"
                  className={styles.formInput}
                  value={edit.date}
                  onChange={e => setEditState(prev => ({ ...prev, [g.id]: { ...prev[g.id], date: e.target.value } }))}
                />
              </div>
              {/* Time */}
              <div className={styles.formField}>
                <label className={styles.formLabel}>Time</label>
                <input
                  type="time"
                  className={styles.formInput}
                  value={edit.time}
                  onChange={e => setEditState(prev => ({ ...prev, [g.id]: { ...prev[g.id], time: e.target.value } }))}
                />
              </div>
              {/* Venue */}
              <div className={styles.formField}>
                <label className={styles.formLabel}>Venue</label>
                <select
                  className={styles.formSelect}
                  value={edit.diamondId}
                  onChange={e => {
                    if (e.target.value === '__create__') {
                      onCreateVenue?.();
                    } else {
                      setEditState(prev => ({ ...prev, [g.id]: { ...prev[g.id], diamondId: e.target.value } }));
                    }
                  }}
                >
                  <option value="">— TBD —</option>
                  {diamonds.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  <option disabled>──────────</option>
                  <option value="__create__">＋ Add venue…</option>
                </select>
              </div>
              {/* Notes — full width */}
              <div className={`${styles.formField} ${styles.formFieldFull}`}>
                <label className={styles.formLabel}>Notes</label>
                <textarea
                  className={styles.formTextarea}
                  value={edit.notes}
                  onChange={e => setEditState(prev => ({ ...prev, [g.id]: { ...prev[g.id], notes: e.target.value } }))}
                  placeholder="Optional game notes…"
                  rows={2}
                />
              </div>
            </div>

            {/* Footer */}
            <div className={styles.inlineFormFooter}>
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                {onCancel && g.status === 'scheduled' && (
                  <button className="btn btn-ghost btn-sm" style={{ color: 'var(--warning, #f59e0b)', fontSize: '0.72rem' }} onClick={() => onCancel(g.id)}>
                    <X size={13} /> Cancel Game
                  </button>
                )}
                {onSchedule && g.status === 'cancelled' && (
                  <button className="btn btn-ghost btn-sm" style={{ fontSize: '0.72rem' }} onClick={() => onSchedule(g.id)}>
                    <AlertCircle size={13} /> Reinstate
                  </button>
                )}
                {onDelete && (
                  <button className="btn btn-danger btn-sm" style={{ fontSize: '0.72rem' }} onClick={() => onDelete(g.id)}>
                    <Trash2 size={13} /> Delete
                  </button>
                )}
                {saveErrors[g.id] && (
                  <span className={styles.saveError}>{saveErrors[g.id]}</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                <button className="btn btn-ghost btn-sm" style={{ fontSize: '0.72rem' }} onClick={handleDiscard}>
                  Discard
                </button>
                <button
                  className="btn btn-lime btn-data btn-sm"
                  disabled={isSaving || !onSave}
                  onClick={handleSave}
                  style={{ fontSize: '0.72rem' }}
                >
                  {isSaving ? 'Saving…' : <><Check size={13} /> Save</>}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const firstGameGroupId = games[0]?.ageGroupId;
  const currentAgeGroup = ageGroups.find(g => g.id === firstGameGroupId);
  const pools = currentAgeGroup?.pools || [];

  return (
    <div>
      <div className={s.tableHeader} style={{ gap: '1rem' }}>
        <div style={{ flex: '0 0 150px' }}>Date</div>
        <div style={{ flex: '0 0 130px' }}>Location</div>
        <div style={{ flex: '2 1 0', textAlign: 'center' }}>Matchup</div>
        <div style={{ flex: '0 0 96px' }} />
        <div style={{ flex: '0 0 28px' }} />
      </div>

      <div className={s.compactListContent}>
        {/* Playoff View */}
        {viewMode === 'playoff' && (() => {
          function groupByRound(gList: Game[]) {
            const rounds: Record<string, Game[]> = {};
            gList.forEach(g => {
              const code = g.bracketCode || 'OTHER';
              let prefix: string;
              if (/^QF/i.test(code)) prefix = 'QF';
              else if (/^SF/i.test(code)) prefix = 'SF';
              else if (/^(FIN|IF|3RD)$/i.test(code)) prefix = 'FIN';
              else if (code === 'OTHER') prefix = 'OTHER';
              else prefix = code;
              if (!rounds[prefix]) rounds[prefix] = [];
              rounds[prefix].push(g);
            });
            const standardOrder = ['QF', 'SF', 'FIN'];
            const standardLabels: Record<string, string> = { QF: 'Quarterfinals', SF: 'Semifinals', FIN: 'Finals' };
            const activeStandard = standardOrder.filter(r => rounds[r]);
            const customKeys = Object.keys(rounds).filter(k => !standardOrder.includes(k) && k !== 'OTHER');
            return [
              ...activeStandard.map(r => ({ key: r, label: standardLabels[r], games: rounds[r] })),
              ...customKeys.map(k => ({ key: k, label: k, games: rounds[k] })),
              ...(rounds['OTHER'] ? [{ key: 'OTHER', label: 'Additional Games', games: rounds['OTHER'] }] : []),
            ];
          }

          // Detect pool-split bracket from placeholder data + per-pool bracketIds
          const activePools = poolsProp || [];
          const hasPoolPlaceholders = activePools.length >= 2 && sortedGames.some(g =>
            activePools.some(p => {
              const bare = p.name.replace(/^Pool\s+/i, '').trim();
              const tag = `Pool ${bare}`;
              return g.homePlaceholder?.includes(tag) || g.awayPlaceholder?.includes(tag);
            })
          );

          if (hasPoolPlaceholders) {
            // Group games by bracketId; infer pool name from direct placeholders
            const byBracketId: Record<string, Game[]> = {};
            sortedGames.forEach(g => {
              const bid = g.bracketId || 'default';
              if (!byBracketId[bid]) byBracketId[bid] = [];
              byBracketId[bid].push(g);
            });

            const poolSections: Array<{ poolName: string; games: Game[] }> = [];
            Object.entries(byBracketId).forEach(([, bGames]) => {
              let poolName: string | null = null;
              for (const g of bGames) {
                for (const p of activePools) {
                  const bare = p.name.replace(/^Pool\s+/i, '').trim();
                  if (g.homePlaceholder?.includes(`Pool ${bare}`) || g.awayPlaceholder?.includes(`Pool ${bare}`)) {
                    poolName = p.name;
                    break;
                  }
                }
                if (poolName) break;
              }
              poolSections.push({ poolName: poolName || 'Other', games: bGames });
            });

            // Sort by pool name then render
            poolSections.sort((a, b) => a.poolName.localeCompare(b.poolName));

            return poolSections.map(({ poolName, games: poolGames }) => (
              <div key={poolName}>
                <div className={s.poolSubHeader} style={{ marginTop: '1rem' }}>
                  <div className={s.poolDot} style={{ background: 'var(--logic-lime)' }} />
                  <span className={s.poolSubLabel} style={{ color: 'var(--logic-lime)', fontSize: '0.7rem' }}>
                    {formatPoolName(poolName)} PLAYOFFS
                  </span>
                  <span className={s.poolSubCount}>({poolGames.length})</span>
                </div>
                {groupByRound(poolGames).map(({ key, label, games: rGames }) => (
                  <div key={key} className={s.poolSubSection}>
                    <div className={s.poolSubHeader} style={{ paddingLeft: '1.5rem' }}>
                      <div className={s.poolDot} style={{ background: 'var(--white-20)' }} />
                      <span className={s.poolSubLabel}>{label}</span>
                      <span className={s.poolSubCount}>({rGames.length})</span>
                    </div>
                    {rGames.map(g => renderRow(g))}
                  </div>
                ))}
              </div>
            ));
          }

          // Flat playoff view (standard/reseed crossover)
          return groupByRound(sortedGames).map(({ key, label, games: rGames }) => (
            <div key={key} className={s.poolSubSection}>
              <div className={s.poolSubHeader}>
                <div className={s.poolDot} style={{ background: 'var(--logic-lime)' }} />
                <span className={s.poolSubLabel}>{label}</span>
                <span className={s.poolSubCount}>({rGames.length})</span>
              </div>
              {rGames.map(g => renderRow(g))}
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
                  <div className={s.poolDot} style={{ background: p.id === 'unassigned' ? 'var(--danger)' : 'var(--logic-lime)' }} />
                  <span className={s.poolSubLabel} style={{ color: p.id === 'unassigned' ? 'var(--danger)' : undefined }}>
                    {p.id === 'unassigned' ? 'UNASSIGNED' : formatPoolName(p.name).toUpperCase()}
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
          <div>
            {sortedGames.map(g => renderRow(g))}
          </div>
        )}
      </div>
    </div>
  );
}
