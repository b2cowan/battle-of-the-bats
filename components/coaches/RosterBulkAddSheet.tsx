'use client';
import { useMemo, useRef, useState } from 'react';
import { ArrowLeftRight, Download, FileSpreadsheet, Pencil, TriangleAlert, Upload, X } from 'lucide-react';
import { useOverlayOpen } from '@/lib/coaches-overlay';
import CoachModalHeader from '@/components/coaches/CoachModalHeader';
import { useConfirm } from '@/components/coaches/ConfirmProvider';
import { generateCSV, downloadCSVBlob } from '@/lib/export';
import {
  parseRosterPaste,
  validateDraftRoster,
  committableRows,
  BULK_ROSTER_TEMPLATE_HEADERS,
  MAX_BULK_ROSTER_ROWS,
  type DraftRosterPlayer,
  type ValidatedDraftRow,
  type ExistingRosterEntry,
} from '@/lib/coach-roster-bulk';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';
import type { RepRosterPlayer } from '@/lib/types';

type Tab = 'paste' | 'file';

/**
 * Add a whole roster at once (Batch 2, P0 #7) — the fix for "fifteen players is fifteen
 * open-fill-save-close round trips".
 *
 * Two ways in, one review step. A pasted list parses in the browser (no round trip, works on a
 * phone with no file picker); an uploaded `.csv`/`.xlsx` is parsed server-side by the existing
 * import parsers. Both produce the same draft rows, which the coach corrects in the preview table
 * before anything is written — including jersey clashes, which the single-player form only ever
 * reported *after* saving.
 */
export default function RosterBulkAddSheet({
  orgSlug,
  teamId,
  teamName,
  existingPlayers,
  onClose,
  onAdded,
}: {
  orgSlug: string;
  teamId: string;
  teamName: string;
  existingPlayers: ExistingRosterEntry[];
  onClose: () => void;
  onAdded: (players: RepRosterPlayer[], message: string) => void;
}) {
  useOverlayOpen(true);
  const confirm = useConfirm();

  const [tab, setTab] = useState<Tab>('paste');
  const [pasteText, setPasteText] = useState('');
  /** null = still collecting input; an array = the coach is reviewing. */
  const [draft, setDraft] = useState<DraftRosterPlayer[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');

  // Warnings are recomputed against the live roster on every edit, so fixing a clashing jersey
  // in the preview clears its flag immediately.
  const rows: ValidatedDraftRow[] = useMemo(
    () => (draft ? validateDraftRoster(draft, existingPlayers) : []),
    [draft, existingPlayers],
  );
  const ready = committableRows(rows);
  const blockedCount = rows.length - ready.length;

  // Parsed once per edit and reused by both the button label and the Preview action — parsing in
  // the render body meant re-reading the whole paste on every unrelated re-render, then again on
  // the click.
  const pastedRows = useMemo(() => parseRosterPaste(pasteText), [pasteText]);

  function reviewPaste() {
    if (pastedRows.length === 0) { setError('Add at least one player, one per line.'); return; }
    setError('');
    setDraft(pastedRows);
  }

  async function reviewFile(file: File) {
    setBusy(true); setError(''); setFileName(file.name);
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/roster/bulk/preview`, { method: 'POST', body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'That file could not be read.');
      const parsed = (data.rows ?? []) as DraftRosterPlayer[];
      if (parsed.length === 0) throw new Error('That file has no player rows.');
      setDraft(parsed);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'That file could not be read.');
      setFileName('');
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    if (ready.length === 0) return;
    setBusy(true); setError('');
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/roster/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ players: ready }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Those players could not be added.');

      const created = (data.created ?? []) as RepRosterPlayer[];
      const failed = (data.failed ?? []) as { name: string }[];
      const skipped = (data.skipped ?? []) as { rowNumber: number }[];
      // Raised server-side against the CURRENT roster, so this catches a clash another coach
      // created while this sheet was open — the client's preview couldn't have known.
      const warnings = (data.warnings ?? []) as { warning: string }[];
      const trailing = [
        failed.length ? `${failed.length} couldn’t be added (${failed.map(f => f.name).join(', ')})` : '',
        skipped.length ? `${skipped.length} skipped for a missing first name` : '',
        warnings.length ? `Worth a look: ${warnings[0].warning}${warnings.length > 1 ? ` (+${warnings.length - 1} more)` : ''}` : '',
      ].filter(Boolean).join(' · ');

      if (created.length === 0) {
        // Every row failed — the request succeeded but the coach got nothing. Never dress that
        // up as a success.
        setError(trailing || 'No players could be added. Please try again.');
        return;
      }
      onAdded(
        created,
        `${created.length} ${created.length === 1 ? 'player' : 'players'} added to ${teamName}.${trailing ? ` ${trailing}.` : ''}`,
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Those players could not be added.');
    } finally {
      setBusy(false);
    }
  }

  function updateRow(index: number, patch: Partial<DraftRosterPlayer>) {
    setDraft(prev => prev?.map((row, i) => (i === index ? { ...row, ...patch } : row)) ?? prev);
  }
  function removeRow(index: number) {
    setDraft(prev => {
      const next = prev?.filter((_, i) => i !== index) ?? [];
      return next.length ? next : null;
    });
  }

  function downloadTemplate() {
    downloadCSVBlob(
      'roster-template.csv',
      generateCSV([...BULK_ROSTER_TEMPLATE_HEADERS], [
        ['Jordan', 'Smith', '12', '', '', '', '', '', '', ''],
        ['Avery', 'Chen', '8', '', '', '', '', '', '', ''],
      ]),
    );
  }

  async function switchTab(next: Tab) {
    if (next === tab) return;
    // Don't silently bin a reviewed list because of a mis-tap on the adjacent tab — the coach may
    // have hand-fixed several rows by this point.
    if (draft && draft.length > 0 && !(await confirm({
      title: 'Discard these players?',
      message: `You’ve reviewed ${draft.length} ${draft.length === 1 ? 'player' : 'players'}. Switching will clear them.`,
      confirmText: 'Discard',
      cancelText: 'Keep them',
      tone: 'danger',
    }))) return;
    setTab(next);
    setDraft(null);
    setError('');
    setFileName('');
  }

  /**
   * Flip first and last names across the whole preview. A pasted list exported "Last, First" is
   * indistinguishable from "First Last" line by line, so rather than guess wrong per row, the
   * coach fixes the whole batch in one tap.
   */
  function swapNames() {
    setDraft(prev => prev?.map(row => ({
      ...row, playerFirstName: row.playerLastName, playerLastName: row.playerFirstName,
    })) ?? prev);
  }

  const reviewing = draft !== null;

  return (
    <div className={styles.modalOverlay} onPointerDown={e => { if (e.target === e.currentTarget) (onClose)?.(); }}>
      <div className={`${styles.modal} ${styles.modalScrollBody}`} onClick={e => e.stopPropagation()}>
        <CoachModalHeader title="Add players" onClose={onClose} closeAriaLabel="Close add players">
          {reviewing && (
            <span className={styles.discToggleMeta}>
              {rows.length} read{blockedCount > 0 ? ` · ${blockedCount} to fix` : ''}
            </span>
          )}
        </CoachModalHeader>

        <div className={styles.formGrid}>
          <div className={`${styles.formGridFull} ${styles.formBody}`}>
            <div className={`${styles.segChoice} ${styles.segChoiceFull}`} role="tablist" aria-label="How to add players">
              <button type="button" role="tab" aria-selected={tab === 'paste'}
                className={`${styles.segBtn}${tab === 'paste' ? ` ${styles.segBtnActive}` : ''}`}
                onClick={() => { void switchTab('paste'); }}>Paste a list</button>
              <button type="button" role="tab" aria-selected={tab === 'file'}
                className={`${styles.segBtn}${tab === 'file' ? ` ${styles.segBtnActive}` : ''}`}
                onClick={() => { void switchTab('file'); }}>Upload a file</button>
            </div>

            {error && <p className={styles.errorText} role="alert">{error}</p>}

            {/* ── Input step ─────────────────────────────────────────────── */}
            {!reviewing && tab === 'paste' && (
              <div className={styles.field}>
                <label className={styles.label} htmlFor="bulk-paste">One player per line</label>
                <textarea
                  id="bulk-paste"
                  className={`${styles.textarea} ${styles.bulkPasteArea}`}
                  value={pasteText}
                  autoFocus
                  onChange={e => setPasteText(e.target.value)}
                  placeholder={'12 Jordan Smith\n8 Avery Chen\nRiley Novak\nSam Okafor 21'}
                />
                <p className={styles.formHint}>
                  A number before or after the name becomes their jersey. No number is fine — you can
                  add positions, birthdates, and parent contacts per player afterwards.
                </p>
                {/* The parser stops at the ceiling; say so rather than silently dropping the tail. */}
                {pastedRows.length >= MAX_BULK_ROSTER_ROWS && (
                  <p className={styles.errorText}>
                    Only the first {MAX_BULK_ROSTER_ROWS} players will be read — add the rest in a second batch.
                  </p>
                )}
              </div>
            )}

            {!reviewing && tab === 'file' && (
              <>
                <div className={styles.bulkDrop}>
                  <FileSpreadsheet size={26} aria-hidden style={{ color: 'var(--logic-lime)' }} />
                  <p className={styles.bulkDropTitle}>Choose a spreadsheet</p>
                  <p className={styles.bulkDropSub}>Excel or CSV. Columns are matched by their headings.</p>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".csv,.xlsx,.xlsm,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    style={{ display: 'none' }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) void reviewFile(f); e.target.value = ''; }}
                  />
                  <button type="button" className={styles.btnSecondary} disabled={busy}
                    onClick={() => fileRef.current?.click()}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.4rem' }}>
                    <Upload size={14} /> {busy ? 'Reading…' : 'Choose file'}
                  </button>
                </div>
                <p className={styles.formHint} style={{ textAlign: 'center' }}>
                  Don’t have one?{' '}
                  <button type="button" className={`${styles.linkBtn} ${styles.linkBtnAccent}`} onClick={downloadTemplate}>
                    <Download size={12} /> Download a template
                  </button>
                </p>
                <section className={styles.formSection}>
                  <h4 className={styles.formSectionTitle}>Columns we look for</h4>
                  <p className={styles.discNote} style={{ margin: 0 }}>
                    First name · Last name · Jersey · Position · Date of birth · Guardian first name ·
                    Guardian last name · Guardian email · Guardian phone · Notes. Only <strong>first
                    name</strong> is required — anything missing is simply left blank.
                  </p>
                </section>
              </>
            )}

            {/* ── Review step ────────────────────────────────────────────── */}
            {reviewing && (
              <>
                <button type="button" className={styles.discToggle} onClick={() => setDraft(null)}>
                  <span className={styles.discToggleIcon}><Pencil size={13} aria-hidden /></span>
                  {tab === 'paste' ? 'Edit the list' : `Choose a different file${fileName ? ` — ${fileName}` : ''}`}
                </button>

                <div className={styles.bulkPreview}>
                  <div className={styles.bulkPreviewHead}>
                    <span>Check before adding</span>
                    <button type="button" className={`${styles.linkBtn} ${styles.linkBtnAccent}`} onClick={swapNames}>
                      <ArrowLeftRight size={12} /> Swap first / last
                    </button>
                  </div>
                  {rows.map((row, index) => (
                    <div
                      key={index}
                      className={`${styles.bulkRow}${row.errors.length ? ` ${styles.bulkRowError}` : ''}`}
                    >
                      <input
                        className={styles.input} value={row.playerNumber} maxLength={10}
                        aria-label={`Jersey number, row ${index + 1}`} placeholder="#"
                        onChange={e => updateRow(index, { playerNumber: e.target.value })}
                      />
                      <input
                        className={styles.input} value={row.playerFirstName} maxLength={60}
                        aria-label={`First name, row ${index + 1}`} placeholder="First name"
                        onChange={e => updateRow(index, { playerFirstName: e.target.value })}
                      />
                      <input
                        className={styles.input} value={row.playerLastName} maxLength={60}
                        aria-label={`Last name, row ${index + 1}`} placeholder="Last name"
                        onChange={e => updateRow(index, { playerLastName: e.target.value })}
                      />
                      <button type="button" className={styles.bulkRowRemove}
                        aria-label={`Remove row ${index + 1}`} onClick={() => removeRow(index)}>
                        <X size={15} />
                      </button>
                      {row.errors.map(message => (
                        <span key={message} className={`${styles.bulkFlag} ${styles.bulkFlagError}`}>
                          <TriangleAlert size={12} aria-hidden /> {message}
                        </span>
                      ))}
                      {row.warnings.map(message => (
                        <span key={message} className={`${styles.bulkFlag} ${styles.bulkFlagWarn}`}>
                          <TriangleAlert size={12} aria-hidden /> {message}
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
                <p className={styles.formHint}>
                  Positions, birthdates, and parent contacts can be filled in per player once
                  everyone’s on the list.
                </p>
              </>
            )}
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          {reviewing ? (
            <button type="button" className="btn btn-lime" onClick={commit} disabled={busy || ready.length === 0}>
              {busy ? 'Adding…' : `Add ${ready.length} ${ready.length === 1 ? 'player' : 'players'}`}
            </button>
          ) : (
            <button
              type="button" className="btn btn-lime" onClick={reviewPaste}
              disabled={tab !== 'paste' || busy || pastedRows.length === 0}
            >
              {pastedRows.length > 0 ? `Preview ${pastedRows.length} ${pastedRows.length === 1 ? 'player' : 'players'}` : 'Preview players'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
