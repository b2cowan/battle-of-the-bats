'use client';
import React, { useState, useEffect } from 'react';
import { AgeGroup, Team, Diamond } from '@/lib/types';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, Trash2, GripVertical } from 'lucide-react';
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
  diamondId: string;
}

interface Round {
  id: string;
  name: string;
  matchups: Matchup[];
}

interface BracketBuilderProps {
  ageGroup: AgeGroup;
  teams: Team[];
  diamonds: Diamond[];
  defaultDate?: string;
  templatePreview: any[];
  baseOptions: string[];
  onPreviewChange: (preview: any[]) => void;
}

function SortableMatchup({ matchup, options, usedOptions, diamonds, onUpdateCode, onUpdate, onDelete }: { 
  matchup: Matchup, 
  options: string[],
  usedOptions: Set<string>,
  diamonds: Diamond[], 
  onUpdateCode: (newCode: string) => void,
  onUpdate: (m: Matchup) => void,
  onDelete: () => void 
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: matchup.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const homeOptions = options.filter(opt => opt === matchup.home.label || !usedOptions.has(opt));
  const awayOptions = options.filter(opt => opt === matchup.away.label || !usedOptions.has(opt));

  return (
    <div ref={setNodeRef} style={style} className={styles.matchupCard}>
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
          <select 
            value={matchup.home.label} 
            onChange={e => onUpdate({ ...matchup, home: { label: e.target.value } })}
            className={styles.teamInput}
          >
            <option value="">Select Team...</option>
            {homeOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>
        <div className={styles.teamRow}>
          <span className={styles.teamLabel}>Away</span>
          <select 
            value={matchup.away.label} 
            onChange={e => onUpdate({ ...matchup, away: { label: e.target.value } })}
            className={styles.teamInput}
          >
            <option value="">Select Team...</option>
            {awayOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>
      </div>

      <div className={styles.matchupFooter}>
        <input type="date" value={matchup.date} onChange={e => onUpdate({...matchup, date: e.target.value})} className={styles.dateInput} />
        <input type="time" value={matchup.time} onChange={e => onUpdate({...matchup, time: e.target.value})} className={styles.timeInput} />
        <select value={matchup.diamondId} onChange={e => onUpdate({...matchup, diamondId: e.target.value})} className={styles.fieldSelect}>
          <option value="">Field...</option>
          {diamonds.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>
    </div>
  );
}

export default function BracketBuilder({ ageGroup, teams, diamonds, defaultDate, templatePreview, baseOptions, onPreviewChange }: BracketBuilderProps) {
  const [rounds, setRounds] = useState<Round[]>([]);

  // Convert templatePreview to rounds when templatePreview changes
  useEffect(() => {
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
        diamondId: p.diamondId || ''
      }))
    }));
    setRounds(initialRounds);
  }, [templatePreview, defaultDate]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    // Flatten rounds into preview array
    const preview = rounds.flatMap(r => 
      r.matchups.map(m => ({
        round: r.name,
        home: m.home.label,
        away: m.away.label,
        code: m.code,
        date: m.date,
        time: m.time,
        diamondId: m.diamondId
      }))
    );
    onPreviewChange(preview);
  }, [rounds, onPreviewChange]);

  const addMatchup = (roundId: string) => {
    setRounds(rounds.map(r => {
      if (r.id === roundId) {
        return {
          ...r,
          matchups: [...r.matchups, {
            id: crypto.randomUUID(),
            code: `${r.name.substring(0, 2).toUpperCase()}${r.matchups.length + 1}`,
            roundName: r.name,
            home: { label: '' },
            away: { label: '' },
            date: defaultDate || '',
            time: '',
            diamondId: ''
          }]
        };
      }
      return r;
    }));
  };

  const addRound = () => {
    setRounds([{ id: `r${crypto.randomUUID()}`, name: `Round ${rounds.length + 1}`, matchups: [] }, ...rounds]);
  };

  const deleteRound = (roundId: string) => {
    setRounds(rounds.filter(r => r.id !== roundId));
  };

  const updateMatchupCode = (matchupId: string, oldCode: string, newCode: string) => {
    setRounds(rounds.map(r => ({
      ...r,
      matchups: r.matchups.map(m => {
        if (m.id === matchupId) {
          return { ...m, code: newCode };
        }
        // Cascade update to dependents
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
        return { ...r, matchups: r.matchups.map(m => m.id === matchup.id ? matchup : m) };
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

  // Calculate all used options across all rounds
  const allUsedOptions = new Set(rounds.flatMap(r => r.matchups.flatMap(m => [m.home.label, m.away.label].filter(l => l))));

  return (
    <div className={styles.builderContainer}>
      <div className={styles.canvas}>
        <div className={styles.addRoundColLeft}>
          <button className={styles.addRoundBtnSimple} onClick={addRound} title="Add Round Before">
            <Plus size={20} />
          </button>
        </div>
        {rounds.map((round, index) => {
          // Calculate options available for THIS round
          // Round 0: Only baseOptions
          // Round > 0: baseOptions + winners/losers from prev rounds
          const previousMatchups = rounds.slice(0, index).flatMap(r => r.matchups);
          const previousOptions = previousMatchups.flatMap(m => m.code ? [`Winner ${m.code}`, `Loser ${m.code}`] : []);
          const roundOptions = [...baseOptions, ...previousOptions];

          return (
            <div key={round.id} className={styles.roundColumn}>
              <div className={styles.roundHeader}>
                <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '0.5rem' }}>
                  <input 
                    type="text" 
                    value={round.name} 
                    onChange={e => setRounds(rounds.map(r => r.id === round.id ? { ...r, name: e.target.value } : r))}
                    className={styles.roundTitleInput}
                  />
                  <button className={styles.deleteBtn} onClick={() => deleteRound(round.id)} title="Delete Round" style={{ padding: '0.25rem', opacity: 0.3 }}>
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
                        diamonds={diamonds} 
                        onUpdateCode={(newCode) => updateMatchupCode(m.id, m.code, newCode)}
                        onUpdate={(newM) => updateMatchup(round.id, newM)}
                        onDelete={() => deleteMatchup(round.id, m.id)}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
                
                <button className={styles.addBtn} onClick={() => addMatchup(round.id)}>
                  <Plus size={16} /> Add Matchup
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
