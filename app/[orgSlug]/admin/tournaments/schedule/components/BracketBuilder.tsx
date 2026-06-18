'use client';
import React, { useState, useEffect, useRef } from 'react';
import { Division, Team, Venue } from '@/lib/types';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, Trash2, GripVertical, Trophy } from 'lucide-react';
import { formatPoolName } from '@/lib/utils';
import { teamColor } from '@/lib/team-color';
import BracketConnectors from './BracketConnectors';
import BracketZoomFrame from './BracketZoomFrame';
import styles from './BracketBuilder.module.css';

interface Slot {
  label: string;
}

export interface Matchup {
  id: string;
  code: string;
  roundName: string;
  home: Slot;
  away: Slot;
  date: string;
  time: string;
  venueId: string;
  venueFacilityId?: string;
  scheduleFacilityLaneId?: string | null;
  scheduleFacilityLaneLabel?: string | null;
  location?: string;
  pool?: string;
  sourceGameId?: string;
}

interface Round {
  id: string;
  name: string;
  matchups: Matchup[];
}

interface BracketBuilderProps {
  division: Division;
  teams: Team[];
  venues: Venue[];
  defaultDate?: string;
  templatePreview: any[];
  baseOptions: string[];
  /**
   * Optional per-group participant options (group name → option labels). Used by
   * Tiered Brackets to scope each tier's matchup dropdowns to its global seeds
   * (e.g. "Tier 2" → ["Seed #6", … "Seed #9"]). When absent, split groups fall
   * back to filtering baseOptions by the "Pool X" label convention.
   */
  groupOptions?: Record<string, string[]>;
  onPreviewChange: (preview: any[]) => void;
  crossover?: string;
  /** Optional display mapping for participant labels (e.g. "Seed #1" → team name). */
  labelFor?: (raw: string) => string;
  /**
   * When set, the matchup whose `sourceGameId` matches is opened (its inline
   * editor expands) and scrolled into view — used to jump straight to a specific
   * game when the editor is entered from a List-view row. Re-applied whenever the
   * id changes (so re-clicking the same row after closing re-focuses it).
   */
  focusSourceGameId?: string;
}

function SortableMatchup({ matchup, options, usedOptions, venues, isFinal, labelFor, editing, onSelect, onClose, onUpdateCode, onUpdate, onDelete }: {
  matchup: Matchup,
  options: string[],
  usedOptions: Set<string>,
  venues: Venue[],
  isFinal?: boolean,
  labelFor?: (raw: string) => string,
  editing: boolean,
  onSelect: () => void,
  onClose: () => void,
  onUpdateCode: (newCode: string) => void,
  onUpdate: (m: Matchup) => void,
  onDelete: () => void
}) {
  const display = labelFor ?? ((s: string) => s);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: matchup.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    ...(isDragging ? { zIndex: 100 } : {}),
  };

  const homeOptions = options.filter(opt => opt === matchup.home.label || !usedOptions.has(opt));
  const awayOptions = options.filter(opt => opt === matchup.away.label || !usedOptions.has(opt));
  const homeIsTeam = !!matchup.home.label && !/^(?:winner|loser)\s/i.test(matchup.home.label);
  const awayIsTeam = !!matchup.away.label && !/^(?:winner|loser)\s/i.test(matchup.away.label);

  // Resolve a short field label for the compact card meta line.
  const fieldLabel = (() => {
    if (matchup.scheduleFacilityLaneId) return matchup.scheduleFacilityLaneLabel || matchup.location || 'TBD';
    if (matchup.venueFacilityId) {
      for (const v of venues) {
        const f = v.facilities?.find(f => f.id === matchup.venueFacilityId);
        if (f) return f.name;
      }
    }
    return venues.find(v => v.id === matchup.venueId)?.name ?? '';
  })();

  // ── Compact card (default): click anywhere to open the editor ──
  if (!editing) {
    const meta = [matchup.time, fieldLabel].filter(Boolean).join(' · ');
    return (
      <div
        ref={setNodeRef}
        style={style}
        data-matchup-id={matchup.id}
        className={`${styles.compactCard} ${isFinal ? styles.matchupCardFinal : ''} ${isDragging ? styles.matchupCardDragging : ''}`}
        role="button"
        tabIndex={0}
        onClick={onSelect}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); } }}
      >
        <div className={styles.compactHead}>
          <span {...attributes} {...listeners} className={styles.dragHandle} onClick={e => e.stopPropagation()} title="Drag to reorder">
            <GripVertical size={12} />
          </span>
          <span className={styles.compactCode}>{matchup.code}</span>
        </div>
        <div className={styles.compactTeams}>
          <span className={styles.compactTeamRow}>
            {homeIsTeam && <span className={styles.teamColorDot} style={{ background: teamColor(display(matchup.home.label)) }} aria-hidden />}
            {display(matchup.home.label) || 'TBD'}
          </span>
          <span className={styles.compactTeamRow}>
            {awayIsTeam && <span className={styles.teamColorDot} style={{ background: teamColor(display(matchup.away.label)) }} aria-hidden />}
            {display(matchup.away.label) || 'TBD'}
          </span>
        </div>
        <div className={`${styles.compactMeta} ${meta ? '' : styles.compactMetaEmpty}`}>
          {meta || 'Tap to schedule'}
        </div>
      </div>
    );
  }

  // ── Expanded editor (when this card is selected) ──
  return (
    <div
      ref={setNodeRef}
      style={style}
      data-matchup-id={matchup.id}
      className={`${styles.matchupCard} ${styles.matchupCardEditing} ${isDragging ? styles.matchupCardDragging : ''} ${isFinal ? styles.matchupCardFinal : ''}`}
    >
      <div className={styles.matchupHeader}>
        <div className="flex items-center gap-2">
          <div {...attributes} {...listeners} className={styles.dragHandle}>
            <GripVertical size={14} />
          </div>
          <input
            type="text"
            value={matchup.code}
            onChange={e => onUpdateCode(e.target.value)}
            className={styles.codeInput}
            placeholder="Code (e.g. QF1)"
          />
        </div>
        <button className={styles.deleteBtn} onClick={onDelete}><Trash2 size={14} /></button>
      </div>

      <div className={styles.matchupBody}>
        <div className={styles.teamRow}>
          <span className={styles.teamLabel}>Home</span>
          {homeIsTeam && <span className={styles.teamColorDot} style={{ background: teamColor(display(matchup.home.label)) }} aria-hidden />}
          <select
            value={matchup.home.label}
            onChange={e => onUpdate({ ...matchup, home: { label: e.target.value } })}
            className={styles.teamInput}
          >
            <option value="">Select Team...</option>
            {homeOptions.map((opt, i) => <option key={`${opt}-${i}`} value={opt}>{display(opt)}</option>)}
          </select>
        </div>
        <div className={styles.teamRow}>
          <span className={styles.teamLabel}>Away</span>
          {awayIsTeam && <span className={styles.teamColorDot} style={{ background: teamColor(display(matchup.away.label)) }} aria-hidden />}
          <select
            value={matchup.away.label}
            onChange={e => onUpdate({ ...matchup, away: { label: e.target.value } })}
            className={styles.teamInput}
          >
            <option value="">Select Team...</option>
            {awayOptions.map((opt, i) => <option key={`${opt}-${i}`} value={opt}>{display(opt)}</option>)}
          </select>
        </div>
      </div>

      <div className={styles.matchupFooter}>
        <input type="date" value={matchup.date} onChange={e => onUpdate({...matchup, date: e.target.value})} className={styles.dateInput} />
        <input type="time" value={matchup.time} onChange={e => onUpdate({...matchup, time: e.target.value})} className={styles.timeInput} />
        <select
          value={matchup.scheduleFacilityLaneId ? `lane:${matchup.scheduleFacilityLaneId}` : (matchup.venueFacilityId || matchup.venueId)}
          onChange={e => {
            const val = e.target.value;
            if (val.startsWith('lane:')) {
              onUpdate({ ...matchup, venueId: '', venueFacilityId: undefined });
              return;
            }
            let parentVenueId = '';
            let facilityId = '';
            for (const v of venues) {
              const fac = v.facilities?.find(f => f.id === val);
              if (fac) { parentVenueId = v.id; facilityId = fac.id; break; }
            }
            if (!parentVenueId && venues.find(v => v.id === val)) parentVenueId = val;
            onUpdate({
              ...matchup,
              venueId: parentVenueId,
              venueFacilityId: facilityId || undefined,
              scheduleFacilityLaneId: null,
              scheduleFacilityLaneLabel: null,
              location: '',
            });
          }}
          className={styles.fieldSelect}
        >
          <option value="">Field…</option>
          {matchup.scheduleFacilityLaneId && (
            <option value={`lane:${matchup.scheduleFacilityLaneId}`}>
              {matchup.scheduleFacilityLaneLabel || matchup.location || 'TBD facility'}
            </option>
          )}
          {venues.filter(v => (v.facilities?.length ?? 0) > 0).map(v => (
            <optgroup key={v.id} label={v.name}>
              {v.facilities!.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </optgroup>
          ))}
          {venues.filter(v => (v.facilities?.length ?? 0) === 0).map(v => (
            <option key={v.id} value={v.id}>{v.name}</option>
          ))}
        </select>
      </div>
      <button className={styles.doneBtn} onClick={onClose}>Done</button>
    </div>
  );
}

// Wraps a single bracket (the whole non-split tree, or one pool's tree in split
// mode) with its own measured connector overlay. Each instance has its own ref so
// split-pool brackets each draw their own lines (codes repeat across pools, but
// only this bracket's matchups are passed in, so refs resolve within the pool).
function ConnectedBracket({ matchups, finalIds, scale, children }: {
  matchups: Matchup[];
  finalIds: Set<string>;
  scale: number;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div ref={ref} style={{ position: 'relative', width: 'max-content', margin: '0 auto' }}>
      <BracketConnectors canvasRef={ref} matchups={matchups} finalIds={finalIds} scale={scale} />
      {children}
    </div>
  );
}

export default function BracketBuilder({ teams, venues, defaultDate, templatePreview, baseOptions, groupOptions, onPreviewChange, crossover, labelFor, focusSourceGameId }: BracketBuilderProps) {
  const [rounds, setRounds] = useState<Round[]>([]);
  // Which game's editor is open (compact-card → click to edit). Zoom + drag-pan
  // live in the shared BracketZoomFrame that wraps the render.
  const [editingId, setEditingId] = useState<string | null>(null);

  // Convert templatePreview to rounds when templatePreview changes
  useEffect(() => {
    setEditingId(null);
    if (!templatePreview || templatePreview.length === 0) {
      setRounds([]);
      return;
    }

    const roundNames = Array.from(new Set(templatePreview.map(p => p.round)));
    const initialRounds = roundNames.map((name, i) => ({
      id: `r${i + 1}-${crypto.randomUUID()}`,
      name: String(name),
      matchups: templatePreview.filter(p => p.round === name).map(p => ({
        id: crypto.randomUUID(),
        code: p.code,
        roundName: String(name),
        home: { label: p.home },
        away: { label: p.away },
        date: p.date || defaultDate || '',
        time: p.time || '',
        venueId: p.venueId || '',
        venueFacilityId: p.venueFacilityId || undefined,
        scheduleFacilityLaneId: p.scheduleFacilityLaneId ?? null,
        scheduleFacilityLaneLabel: p.scheduleFacilityLaneLabel ?? null,
        location: p.location || '',
        pool: p.pool,
        sourceGameId: p.sourceGameId,
      }))
    }));
    setRounds(initialRounds);
  }, [templatePreview, defaultDate]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    const preview = rounds.flatMap(r =>
      r.matchups.map(m => ({
        round:           r.name,
        home:            m.home.label,
        away:            m.away.label,
        code:            m.code,
        date:            m.date,
        time:            m.time,
        venueId:         m.venueId,
        venueFacilityId: m.venueFacilityId,
        scheduleFacilityLaneId: m.scheduleFacilityLaneId ?? null,
        scheduleFacilityLaneLabel: m.scheduleFacilityLaneLabel ?? null,
        location: m.location ?? '',
        pool:            m.pool,
        sourceGameId:    m.sourceGameId,
      }))
    );
    onPreviewChange(preview);
  }, [rounds, onPreviewChange]);

  // Jump to a specific game when entered from a List-view row: open its inline
  // editor and scroll its card into view. Runs once the rounds are populated and
  // re-runs if the requested id changes.
  useEffect(() => {
    if (!focusSourceGameId) return;
    const target = rounds.flatMap(r => r.matchups).find(m => m.sourceGameId === focusSourceGameId);
    if (!target) return;
    setEditingId(target.id);
    const el = document.querySelector<HTMLElement>(`[data-matchup-id="${target.id}"]`);
    if (el) requestAnimationFrame(() => el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' }));
  }, [focusSourceGameId, rounds]);

  // A new matchup's code MUST be unique across the WHOLE bracket — `Winner <code>`
  // / `Loser <code>` references resolve by exact code, so two rounds sharing a code
  // (the old `name.substring(0,2)` scheme made "Round 1" and "Round 2" both "RO1")
  // would cross-wire advancement. Code by round position + a collision-free suffix.
  const nextMatchupCode = (rs: Round[], roundIdx: number): string => {
    const used = new Set(rs.flatMap(r => r.matchups.map(m => m.code)));
    let n = 1;
    let code = `R${roundIdx + 1}-${n}`;
    while (used.has(code)) { n++; code = `R${roundIdx + 1}-${n}`; }
    return code;
  };

  const addMatchup = (roundId: string) => {
    setRounds(rounds.map((r, idx) => {
      if (r.id === roundId) {
        return {
          ...r,
          matchups: [...r.matchups, {
            id: crypto.randomUUID(),
            code: nextMatchupCode(rounds, idx),
            roundName: r.name,
            home: { label: '' },
            away: { label: '' },
            date: defaultDate || '',
            time: '',
            venueId: '',
            pool: r.matchups[0]?.pool
          }]
        };
      }
      return r;
    }));
  };

  const addMatchupForPool = (roundId: string, poolName: string) => {
    setRounds(rounds.map((r, idx) => {
      if (r.id === roundId) {
        return {
          ...r,
          matchups: [...r.matchups, {
            id: crypto.randomUUID(),
            code: nextMatchupCode(rounds, idx),
            roundName: r.name,
            home: { label: '' },
            away: { label: '' },
            date: defaultDate || '',
            time: '',
            venueId: '',
            pool: poolName
          }]
        };
      }
      return r;
    }));
  };

  const addRound = () => {
    setRounds(prev => [...prev, { id: `r${crypto.randomUUID()}`, name: `Round ${prev.length + 1}`, matchups: [] }]);
  };

  const addRoundForPool = (poolName: string) => {
    const newRound: Round = {
      id: `r${crypto.randomUUID()}`,
      name: `Round ${rounds.length + 1}`,
      matchups: [{
        id: crypto.randomUUID(),
        code: `R${rounds.length + 1}`,
        roundName: `Round ${rounds.length + 1}`,
        home: { label: '' },
        away: { label: '' },
        date: defaultDate || '',
        time: '',
        venueId: '',
        pool: poolName
      }]
    };
    setRounds(prev => [...prev, newRound]);
  };

  const deleteRound = (roundId: string) => {
    setRounds(rounds.filter(r => r.id !== roundId));
  };

  // In split mode: remove only this pool's matchups from the round.
  // If the round has no matchups left globally, remove it entirely.
  const deleteRoundForPool = (roundId: string, poolName: string) => {
    setRounds(prev => {
      return prev.reduce<Round[]>((acc, r) => {
        if (r.id !== roundId) { acc.push(r); return acc; }
        const remaining = r.matchups.filter(m => m.pool !== poolName);
        if (remaining.length > 0) {
          acc.push({ ...r, matchups: remaining });
        }
        return acc;
      }, []);
    });
  };

  const updateMatchupCode = (matchupId: string, oldCode: string, newCode: string) => {
    setRounds(rounds.map(r => ({
      ...r,
      matchups: r.matchups.map(m => {
        if (m.id === matchupId) {
          return { ...m, code: newCode };
        }
        const homeLabel = m.home.label === `Winner ${oldCode}` ? `Winner ${newCode}`
                        : m.home.label === `Loser ${oldCode}` ? `Loser ${newCode}`
                        : m.home.label;
        const awayLabel = m.away.label === `Winner ${oldCode}` ? `Winner ${newCode}`
                        : m.away.label === `Loser ${oldCode}` ? `Loser ${newCode}`
                        : m.away.label;
        return { ...m, home: { label: homeLabel }, away: { label: awayLabel } };
      })
    })));
  };

  const updateMatchup = (roundId: string, matchup: Matchup) => {
    setRounds(rounds.map(r => {
      if (r.id === roundId) {
        return { ...r, matchups: r.matchups.map(m => m.id === matchup.id ? { ...matchup, pool: m.pool } : m) };
      }
      return r;
    }));
  };

  const deleteMatchup = (roundId: string, matchupId: string) => {
    setRounds(rounds.map(r => {
      if (r.id === roundId) {
        return { ...r, matchups: r.matchups.filter(m => m.id !== matchupId) };
      }
      return r;
    }));
  };

  const handleDragEnd = (event: any, roundId: string) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      setRounds(rounds.map(r => {
        if (r.id === roundId) {
          const oldIndex = r.matchups.findIndex(m => m.id === active.id);
          const newIndex = r.matchups.findIndex(m => m.id === over.id);
          return { ...r, matchups: arrayMove(r.matchups, oldIndex, newIndex) };
        }
        return r;
      }));
    }
  };

  const allUsedOptions = new Set(rounds.flatMap(r => r.matchups.flatMap(m => [m.home.label, m.away.label].filter(l => l))));

  // Group keys come from the preview's `pool` field — the pool name in
  // No-Crossover mode or the tier name in Tiered mode — so tiered brackets (which
  // may have no division pools at all) still render as separate grouped brackets.
  const groupNames = Array.from(
    new Set(rounds.flatMap(r => r.matchups.map(m => m.pool)).filter((p): p is string => !!p)),
  );
  const isSplitMode = (crossover === 'none' || crossover === 'tiers') && groupNames.length > 0;

  // ── Layout helpers: fork double-elim (seed · winners/losers · finals), flat otherwise ──
  const bandOf = (round: Round): 'seed' | 'winners' | 'losers' | 'finals' | 'flat' => {
    const code = (round.matchups[0]?.code || '').toUpperCase();
    if (/^GF/.test(code)) return 'finals';
    if (/^LB/.test(code)) return 'losers';
    const wb = code.match(/^WB(\d+)/);
    if (wb) return parseInt(wb[1], 10) === 1 ? 'seed' : 'winners';
    return 'flat';
  };
  const isForkRounds = (rs: Round[]) => rs.some(r => /^(WB|LB|GF)/i.test(r.matchups[0]?.code || ''));

  const optionsForRound = (round: Round, poolName?: string) => {
    // Per-group seed options: prefer an explicit groupOptions map (Tiered mode →
    // each tier's global Seed #N range); otherwise fall back to filtering
    // baseOptions by the "Pool X" label convention (No-Crossover pools).
    const base = !poolName
      ? baseOptions
      : groupOptions?.[poolName]
        ?? baseOptions.filter(o => o.includes(`Pool ${poolName.replace(/^Pool\s+/i, '').trim()}`));
    const refs = rounds
      .flatMap(r => r.matchups)
      .filter(m => m.code && !round.matchups.some(rm => rm.id === m.id) && (!poolName || m.pool === poolName))
      .flatMap(m => [`Winner ${m.code}`, `Loser ${m.code}`]);
    return Array.from(new Set([...base, ...refs]));
  };

  const renderColumn = (round: Round, roundOptions: string[], isFinal: boolean, onAdd: () => void, onDel: () => void) => (
    <div key={round.id} className={styles.roundColumn}>
      <div className={styles.roundHeader}>
        <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '0.5rem' }}>
          <textarea
            value={round.name}
            onChange={e => setRounds(rounds.map(r => r.id === round.id ? { ...r, name: e.target.value } : r))}
            className={styles.roundTitleInput}
            maxLength={40}
            rows={1}
            ref={el => { if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; } }}
          />
          <button className={styles.deleteBtn} onClick={onDel} title="Delete Round" style={{ padding: '0.25rem', opacity: 0.3 }}>
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      <div className={styles.matchupList}>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleDragEnd(e, round.id)}>
          <SortableContext items={round.matchups} strategy={verticalListSortingStrategy}>
            {round.matchups.map(m => (
              <SortableMatchup
                key={m.id}
                matchup={m}
                options={roundOptions}
                usedOptions={allUsedOptions}
                venues={venues}
                labelFor={labelFor}
                isFinal={isFinal}
                editing={editingId === m.id}
                onSelect={() => setEditingId(m.id)}
                onClose={() => setEditingId(null)}
                onUpdateCode={(newCode) => updateMatchupCode(m.id, m.code, newCode)}
                onUpdate={(newM) => updateMatchup(round.id, newM)}
                onDelete={() => deleteMatchup(round.id, m.id)}
              />
            ))}
          </SortableContext>
        </DndContext>
        <button className={styles.addBtn} onClick={onAdd}><Plus size={16} /> Add Matchup</button>
      </div>
    </div>
  );

  const colFor = (round: Round, poolName: string | undefined, isFinal: boolean) => renderColumn(
    round,
    optionsForRound(round, poolName),
    isFinal,
    () => (poolName ? addMatchupForPool(round.id, poolName) : addMatchup(round.id)),
    () => (poolName ? deleteRoundForPool(round.id, poolName) : deleteRound(round.id)),
  );

  const renderBands = (rs: Round[], poolName?: string) => (
    <div className={styles.fork}>
      <div className={styles.forkSeed}>{rs.filter(r => bandOf(r) === 'seed').map(r => colFor(r, poolName, false))}</div>
      <div className={styles.forkMiddle}>
        <div>
          <div className={`${styles.bandTag} ${styles.bandTagWin}`}>Winners</div>
          <div className={styles.band}>{rs.filter(r => bandOf(r) === 'winners').map(r => colFor(r, poolName, false))}</div>
        </div>
        <div>
          <div className={`${styles.bandTag} ${styles.bandTagLoss}`}>Losers</div>
          <div className={styles.band}>{rs.filter(r => bandOf(r) === 'losers').map(r => colFor(r, poolName, false))}</div>
        </div>
      </div>
      <div className={styles.forkFinals}>{rs.filter(r => bandOf(r) === 'finals').map(r => colFor(r, poolName, true))}</div>
    </div>
  );

  const finalIdsOf = (rs: Round[]) => new Set(
    (isForkRounds(rs)
      ? rs.filter(r => bandOf(r) === 'finals').flatMap(r => r.matchups)
      : (rs[rs.length - 1]?.matchups ?? [])
    ).map(m => m.id)
  );

  return (
    <BracketZoomFrame fitKey={rounds.map(r => r.id).join('|')} hint="Drag empty space to scroll · click a game to edit">
      {(zoom) => (
      isSplitMode ? (
        <div className={styles.splitBrackets}>
          {groupNames.map(poolName => {
            const poolRounds = rounds.map(r => ({
              ...r,
              matchups: r.matchups.filter(m => m.pool === poolName)
            })).filter(r => r.matchups.length > 0);
            const poolMatchups = poolRounds.flatMap(r => r.matchups);

            return (
              <div key={poolName} className={styles.poolSection}>
                <div className={styles.poolHeader}>
                  <Trophy size={18} />
                  <span>{crossover === 'tiers' ? poolName : `${formatPoolName(poolName)} Playoffs`}</span>
                </div>

                <ConnectedBracket matchups={poolMatchups} finalIds={finalIdsOf(poolRounds)} scale={zoom}>
                  {isForkRounds(poolRounds) ? renderBands(poolRounds, poolName) : (
                    <div className={styles.canvas}>
                      {poolRounds.map((round, i) => colFor(round, poolName, i === poolRounds.length - 1))}
                    </div>
                  )}
                </ConnectedBracket>

                <button
                  className={styles.addBtn}
                  onClick={() => addRoundForPool(poolName)}
                  style={{ marginTop: '1rem', alignSelf: 'flex-start' }}
                >
                  <Plus size={16} /> Add Round
                </button>
              </div>
            );
          })}
        </div>
      ) : isForkRounds(rounds) ? (
        <ConnectedBracket matchups={rounds.flatMap(r => r.matchups)} finalIds={finalIdsOf(rounds)} scale={zoom}>
          {renderBands(rounds)}
        </ConnectedBracket>
      ) : (
        <ConnectedBracket matchups={rounds.flatMap(r => r.matchups)} finalIds={finalIdsOf(rounds)} scale={zoom}>
          <div className={styles.canvas}>
            {rounds.map((round, index) => colFor(round, undefined, index === rounds.length - 1))}
            <div className={styles.addRoundColLeft}>
              <button className={styles.addRoundBtnSimple} onClick={addRound} title="Add Round">
                <Plus size={20} />
              </button>
            </div>
          </div>
        </ConnectedBracket>
      )
      )}
    </BracketZoomFrame>
  );
}
