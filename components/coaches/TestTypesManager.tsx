'use client';
import { useState } from 'react';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';
import type { RepTeamMeasurableType } from '@/lib/types';

/** The "add a new test type" fields — ONE implementation for the inline log flow, the manage
 *  surfaces, and the session screen. Lives HERE (not in PlayerDevelopmentSection) so the
 *  import graph stays acyclic: PlayerDevelopmentSection → TestTypesManager, never back. */
export function NewTypeFields({ idPrefix, name, unit, onName, onUnit, onAdd }: {
  idPrefix: string;
  name: string;
  unit: string;
  onName: (v: string) => void;
  onUnit: (v: string) => void;
  onAdd: () => void;
}) {
  return (
    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
      <div className={styles.field} style={{ flex: '1 1 160px' }}>
        <label className={styles.label} htmlFor={`${idPrefix}-name`}>New test name</label>
        <input id={`${idPrefix}-name`} className={styles.input} type="text" value={name}
          onChange={e => onName(e.target.value)} maxLength={40} placeholder="e.g. 60-yd sprint" />
      </div>
      <div className={styles.field} style={{ flex: '0 1 120px' }}>
        <label className={styles.label} htmlFor={`${idPrefix}-unit`}>Unit</label>
        <input id={`${idPrefix}-unit`} className={styles.input} type="text" value={unit}
          onChange={e => onUnit(e.target.value)} maxLength={20} placeholder="seconds" />
      </div>
      <button type="button" className="btn btn-ghost" style={{ fontSize: '0.8rem' }} onClick={onAdd}>
        Add test
      </button>
    </div>
  );
}

/**
 * ONE test-type manager (list + rename/retire/restore + add) for every surface that curates
 * the measurable-type library — the 3A player-card dialog and the 3B Development hub card.
 * Rows use the tag-manager class idiom; action buttons keep the btn-ghost chrome the 3A
 * dialog shipped with. `onTypesChanged` takes an UPDATER (prev → next), never a snapshot —
 * a stale-prop overwrite here silently dropped concurrent type creations (3B review fix).
 */
export default function TestTypesManager({ apiBase, types, canWrite, onTypesChanged }: {
  /** …/api/coaches/{org}/teams/{team}/development/measurable-types */
  apiBase: string;
  types: RepTeamMeasurableType[];
  canWrite: boolean;
  onTypesChanged: (update: (prev: RepTeamMeasurableType[]) => RepTeamMeasurableType[]) => void;
}) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameName, setRenameName] = useState('');
  const [renameUnit, setRenameUnit] = useState('');
  const [newName, setNewName] = useState('');
  const [newUnit, setNewUnit] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function patchType(typeId: string, body: { name?: string; unit?: string; isActive?: boolean }) {
    if (busy) return;
    setErr('');
    setBusy(true);
    try {
      const res = await fetch(`${apiBase}/${typeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json) {
        setErr(json?.error ?? 'Could not update the test — try again.');
        return;
      }
      setRenamingId(null);
      onTypesChanged(prev => prev.map(t => t.id === json.type.id ? json.type : t));
    } catch {
      setErr('Could not update the test — try again.');
    } finally {
      setBusy(false);
    }
  }

  async function addType() {
    if (busy) return;
    if (!newName.trim() || !newUnit.trim()) {
      setErr('Give the test a name and a unit (like seconds).');
      return;
    }
    setErr('');
    setBusy(true);
    try {
      const res = await fetch(apiBase, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, unit: newUnit }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json) {
        setErr(json?.error ?? 'Could not add the test — try again.');
        return;
      }
      setNewName('');
      setNewUnit('');
      onTypesChanged(prev => [...prev, json.type].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)));
    } catch {
      setErr('Could not add the test — try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {types.length === 0 && (
        <p className={styles.detailPlaceholder}>
          {canWrite ? 'No tests yet — add your first below (like "60-yd sprint" in seconds).' : 'No tests yet.'}
        </p>
      )}
      {types.map(t => (
        <div key={t.id} className={styles.tagManagerRow}>
          {renamingId === t.id ? (
            <span className={styles.tagManagerName} style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              <input className={styles.input} style={{ maxWidth: 160 }} type="text" value={renameName}
                onChange={e => setRenameName(e.target.value)} maxLength={40} aria-label="Test name" />
              <input className={styles.input} style={{ maxWidth: 100 }} type="text" value={renameUnit}
                onChange={e => setRenameUnit(e.target.value)} maxLength={20} aria-label="Unit" />
            </span>
          ) : (
            <>
              <span className={styles.tagManagerName}>{t.name}{!t.isActive && ' (retired)'}</span>
              <span className={styles.miniRowMeta}>{t.unit}</span>
            </>
          )}
          {canWrite && (
            <span className={styles.tagManagerActions}>
              {renamingId === t.id ? (
                <>
                  <button type="button" className="btn btn-ghost" style={{ fontSize: '0.75rem' }} disabled={busy}
                    onClick={() => {
                      if (!renameName.trim() || !renameUnit.trim()) { setErr('The test needs a name and a unit.'); return; }
                      patchType(t.id, { name: renameName, unit: renameUnit });
                    }}>
                    Save
                  </button>
                  <button type="button" className="btn btn-ghost" style={{ fontSize: '0.75rem' }}
                    onClick={() => { setRenamingId(null); setErr(''); }}>
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className="btn btn-ghost" style={{ fontSize: '0.72rem', padding: '0.15rem 0.45rem' }}
                    onClick={() => { setRenamingId(t.id); setRenameName(t.name); setRenameUnit(t.unit); setErr(''); }}>
                    Rename
                  </button>
                  <button type="button" className="btn btn-ghost" style={{ fontSize: '0.72rem', padding: '0.15rem 0.45rem' }}
                    disabled={busy} onClick={() => patchType(t.id, { isActive: !t.isActive })}>
                    {t.isActive ? 'Retire' : 'Restore'}
                  </button>
                </>
              )}
            </span>
          )}
        </div>
      ))}
      {canWrite && (
        <div style={{ marginTop: '0.7rem' }}>
          <NewTypeFields idPrefix="test-types-manager" name={newName} unit={newUnit}
            onName={setNewName} onUnit={setNewUnit} onAdd={addType} />
        </div>
      )}
      {err && <p className={styles.errorText} role="alert" style={{ marginTop: '0.5rem' }}>{err}</p>}
      <p className={styles.devCardNote} style={{ marginTop: '0.6rem' }}>
        Retired tests keep their logged history — they just leave the picker.
      </p>
    </>
  );
}
