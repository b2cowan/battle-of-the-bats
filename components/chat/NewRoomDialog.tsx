'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Plus, Loader2, Check } from 'lucide-react';
import styles from './NewRoomDialog.module.css';

/**
 * "New room" composer for Tournament Chat division rooms. The organizer names the room and picks the
 * division(s) it covers; membership then auto-maintains from those divisions. Presentational — the
 * page owns the create call + busy/error state, and mounts this only while open (so the form starts
 * fresh each time). Tokens-only styling.
 */

export type DivisionOption = { id: string; name: string; teamCount: number };

type Props = {
  divisions: DivisionOption[];
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onCreate: (name: string, divisionIds: string[]) => void;
};

const MAX_NAME = 80;

export default function NewRoomDialog({ divisions, busy, error, onCancel, onCreate }: Props) {
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const nameRef = useRef<HTMLInputElement>(null);

  // Focus the name field on open (mounted fresh, so no state reset needed).
  useEffect(() => {
    const t = setTimeout(() => nameRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, []);

  // Escape cancels (unless a create is in flight).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onCancel(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [busy, onCancel]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const coveredTeams = useMemo(
    () => divisions.filter((d) => selectedSet.has(d.id)).reduce((sum, d) => sum + d.teamCount, 0),
    [divisions, selectedSet],
  );

  const canSubmit = name.trim().length > 0 && selected.length > 0 && !busy;
  const noDivisions = divisions.length === 0;

  function toggle(id: string) {
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  function submit() {
    if (!canSubmit) return;
    onCreate(name.trim(), selected);
  }

  return (
    <div className={styles.backdrop} role="presentation" onClick={() => { if (!busy) onCancel(); }}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-label="Create a division room"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.head}>
          <span className={styles.title}><Plus size={15} aria-hidden /> New room</span>
          <button type="button" className={styles.closeBtn} onClick={onCancel} disabled={busy} aria-label="Cancel">
            <X size={16} aria-hidden />
          </button>
        </div>

        <div className={styles.body}>
          <label className={styles.field}>
            <span className={styles.label}>Room name</span>
            <input
              ref={nameRef}
              type="text"
              className={styles.input}
              value={name}
              maxLength={MAX_NAME}
              placeholder="e.g. Championship, U12 Coaches"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && canSubmit) submit(); }}
              disabled={busy}
            />
          </label>

          <div className={styles.field}>
            <span className={styles.label}>Divisions this room covers</span>
            {noDivisions ? (
              <p className={styles.note}>
                This tournament has no divisions yet. Add divisions in Event Settings to create a division room.
              </p>
            ) : (
              <div className={styles.divList} role="group" aria-label="Divisions">
                {divisions.map((d) => {
                  const on = selectedSet.has(d.id);
                  return (
                    <button
                      key={d.id}
                      type="button"
                      className={`${styles.divRow}${on ? ` ${styles.divRowOn}` : ''}`}
                      onClick={() => toggle(d.id)}
                      aria-pressed={on}
                      disabled={busy}
                    >
                      <span className={styles.check} aria-hidden>{on ? <Check size={13} /> : null}</span>
                      <span className={styles.divName}>{d.name}</span>
                      <span className={styles.divCount}>{d.teamCount} {d.teamCount === 1 ? 'team' : 'teams'}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {!noDivisions && (
            <p className={styles.summary}>
              {selected.length === 0
                ? 'Select at least one division.'
                : `Covers ${coveredTeams} ${coveredTeams === 1 ? 'team' : 'teams'} across ${selected.length} ${selected.length === 1 ? 'division' : 'divisions'}. Their coaches join automatically.`}
            </p>
          )}

          {error && <p className={styles.error}>{error}</p>}
        </div>

        <div className={styles.foot}>
          <button type="button" className="btn btn-ghost btn-data" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn btn-lime btn-data" onClick={submit} disabled={!canSubmit}>
            {busy ? <><Loader2 size={14} className={styles.spin} aria-hidden /> Creating…</> : <><Plus size={14} aria-hidden /> Create room</>}
          </button>
        </div>
      </div>
    </div>
  );
}
