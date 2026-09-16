'use client';
import { useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { LibraryCard } from '@/components/coaches/LibraryRow';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';

/**
 * "Bring one forward from a past season" — the owner's 2026-08-01 archive ruling made concrete,
 * ONCE, for the three libraries (drills · templates · circuits; practices re-evaluation stage 4,
 * 2026-09-16 — the third copy of this dialog was the one that earned the extraction).
 *
 * The rule the dialog holds: a row already in the library is SHOWN AND GREYED, never hidden — a
 * coach scanning for something they remember should find it and see why it isn't offered; and a
 * row just added is MARKED IN PLACE rather than removed — a list that reshuffles under a coach's
 * thumb while they add three is how the wrong one gets tapped. The words on the rows say
 * "planned", never "ran" — nothing records what actually happened (D4).
 *
 * Each library brings its own read (`readUrl` + the key its response carries the rows under), its
 * own way of turning a row into the create's body, and its own sentences.
 */
export interface PastSeasonRow {
  key: string;
  alreadyInLibrary: boolean;
}

const errorMessage = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

/** The dialog's state and its two acts — open (read the past seasons) and add (one row). */
export function usePastSeasonImport<Row extends PastSeasonRow>({ readUrl, rowsKey, createUrl, bodyOf, onAdded, noun }: {
  readUrl: string;
  /** The key the read answers under — `drills` · `templates` · `circuits`. */
  rowsKey: string;
  createUrl: string;
  bodyOf: (row: Row) => unknown;
  /** After a successful add — the tab reloads its list. */
  onAdded: () => Promise<void> | void;
  /** "drill" · "template" · "circuit" — the error sentences' word. */
  noun: string;
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState('');
  const [importingKey, setImportingKey] = useState<string | null>(null);

  async function openImport() {
    setOpen(true); setError(''); setRows(null);
    try {
      const res = await fetch(readUrl);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Could not read your past seasons.');
      const json = await res.json();
      setRows(json[rowsKey] ?? []);
    } catch (e) {
      setError(errorMessage(e, 'Could not read your past seasons.'));
    }
  }

  async function add(row: Row) {
    setImportingKey(row.key); setError('');
    try {
      const res = await fetch(createUrl, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bodyOf(row)),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `Could not add that ${noun}.`);
      setRows(list => list?.map(r => (r.key === row.key ? { ...r, alreadyInLibrary: true } : r)) ?? null);
      await onAdded();
    } catch (e) {
      setError(errorMessage(e, `Could not add that ${noun}.`));
    } finally {
      setImportingKey(null);
    }
  }

  return { open, rows, error, importingKey, openImport, add, close: () => setOpen(false) };
}

/** The dialog — one card per row, described by the caller (name · facts · line). */
export function PastSeasonImportDialog<Row extends PastSeasonRow>({
  state, hint, emptyText, describe,
}: {
  state: ReturnType<typeof usePastSeasonImport<Row>>;
  hint: ReactNode;
  emptyText: ReactNode;
  describe: (row: Row) => { name: string; facts: string; line?: string | null };
}) {
  if (!state.open) return null;
  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-label="Add from a past season"
      onPointerDown={e => { if (e.target === e.currentTarget) state.close(); }}>
      <div className={`${styles.modal} ${styles.modalScrollBody}`}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>Add from a past season</h3>
          <button type="button" className={styles.modalCloseBtn} aria-label="Close" onClick={state.close}>
            <X size={18} />
          </button>
        </div>
        <div className={styles.ppDrillWrite}>
          <p className={styles.formHint}>{hint}</p>
          {state.error && <p className={styles.errorText} role="alert">{state.error}</p>}
          {state.rows === null && !state.error && <p className={styles.formHint}>Looking…</p>}
          {state.rows?.length === 0 && <p className={styles.formHint}>{emptyText}</p>}
          {state.rows?.map(row => {
            const d = describe(row);
            return (
              <LibraryCard
                key={row.key}
                name={d.name}
                retired={row.alreadyInLibrary}
                facts={d.facts}
                line={d.line}
                actions={row.alreadyInLibrary
                  ? <span className={styles.libCardFacts}>Already in your library</span>
                  : (
                    <button type="button" className={styles.btnSecondary} disabled={state.importingKey === row.key}
                      onClick={() => state.add(row)}>
                      {state.importingKey === row.key ? 'Adding…' : 'Add'}
                    </button>
                  )}
              />
            );
          })}
        </div>
        <div className={styles.modalFooter}>
          <button type="button" className={styles.btnPrimary} onClick={state.close}>Done</button>
        </div>
      </div>
    </div>
  );
}
