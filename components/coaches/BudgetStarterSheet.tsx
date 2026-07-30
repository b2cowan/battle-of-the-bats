'use client';
import { useMemo, useState } from 'react';
import { ArrowRight, Check, X } from 'lucide-react';
import { useOverlayOpen } from '@/lib/coaches-overlay';
import CoachModalHeader from '@/components/coaches/CoachModalHeader';
import { useDiscardGuard } from '@/components/coaches/useDiscardGuard';
import type { BudgetCategoryWithItems } from '@/lib/types';
import shared from '@/app/[orgSlug]/coaches/coaches.module.css';
import styles from './BudgetStarterSheet.module.css';

/**
 * Chunk G — the first-season budget starter (mockups artifact 77f5175e = binding).
 *
 * Five tap-only questions seed a worksheet of standard budget lines; the coach prices
 * only what they know. Priced rows become real budget lines through the EXISTING line
 * write route, one by one, with per-row failure reporting (Batch 2 rule — never a
 * silent all-or-nothing). Unpriced rows are deliberately NOT written anywhere: a budget
 * line cannot exist without an amount (DB CHECK > 0), so "still to price" is the derived
 * checklist on the Budget page, not stored rows.
 *
 * D-G1 (owner, binding): the product never proposes a dollar figure. No numeric
 * placeholder, no suggested amount, no prefill. The one calculation here — entry fees
 * per event × tournament count — multiplies two numbers the coach themselves supplied,
 * and shows its arithmetic in full (ratified as the D2 rider).
 */

type YesNo = 'yes' | 'no' | null;

interface Answers {
  tournaments: number | null;
  travel: YesNo;
  officials: YesNo;
  training: YesNo;
  uniforms: YesNo;
}

const BLANK_ANSWERS: Answers = { tournaments: null, travel: null, officials: null, training: null, uniforms: null };

interface WorksheetRow {
  /** budget_items.id — the stable identity a row is merged/deduped on. */
  itemId: string;
  itemName: string;
  categoryId: string;
  categoryName: string;
  /** Coach-typed line total (non-entry-fee rows). */
  amount: string;
  /** Coach-typed per-tournament cost (entry-fees row with 2+ tournaments only). */
  perEvent: string;
  entryFees: boolean;
  chipAdded: boolean;
  status: 'idle' | 'saving' | 'saved' | 'error';
  error?: string;
}

interface SeedRef { categoryId: string; categoryName: string; itemId: string; itemName: string }

/** Question → seeded default item, matched by NAME within platform defaults (never a
 *  hardcoded id). A default item somehow missing just skips its row — never throws. */
function findDefaultItem(categories: BudgetCategoryWithItems[], catName: string, itemName: string): SeedRef | null {
  for (const c of categories) {
    if (!c.isDefault || c.name.toLowerCase() !== catName.toLowerCase()) continue;
    const item = c.items.find(i => i.isDefault && !i.isMisc && i.name.toLowerCase() === itemName.toLowerCase());
    if (item) return { categoryId: c.id, categoryName: c.name, itemId: item.id, itemName: item.name };
  }
  return null;
}

function fmt(n: number) {
  return `$${n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function BudgetStarterSheet({
  orgSlug,
  teamId,
  categories,
  onClose,
  onOpenSample,
  onCreated,
}: {
  orgSlug: string;
  teamId: string;
  categories: BudgetCategoryWithItems[];
  onClose: () => void;
  /** Step-3 quiet door into the sample sheet (parent swaps the sheets). */
  onOpenSample: () => void;
  /** Called after any lines were written so the page behind refreshes. */
  onCreated: () => Promise<void> | void;
}) {
  useOverlayOpen(true);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [answers, setAnswers] = useState<Answers>(BLANK_ANSWERS);
  const [rows, setRows] = useState<WorksheetRow[]>([]);
  const [saving, setSaving] = useState(false);

  const count = answers.tournaments ?? 0;

  // ── Seeding ────────────────────────────────────────────────────────────────
  const seeds = useMemo(() => {
    const list: Array<{ ref: SeedRef | null; entryFees: boolean }> = [];
    if (count > 0) list.push({ ref: findDefaultItem(categories, 'Tournaments', 'Entry Fees'), entryFees: true });
    if (answers.travel === 'yes') list.push({ ref: findDefaultItem(categories, 'Tournaments', 'Travel'), entryFees: false });
    if (answers.uniforms === 'yes') list.push({ ref: findDefaultItem(categories, 'Tournaments', 'Uniforms'), entryFees: false });
    if (answers.officials === 'yes') list.push({ ref: findDefaultItem(categories, 'Officials', 'Umpire Fees'), entryFees: false });
    if (answers.training === 'yes') list.push({ ref: findDefaultItem(categories, 'Training', 'Off-Season Training'), entryFees: false });
    return list.filter((s): s is { ref: SeedRef; entryFees: boolean } => s.ref !== null);
  }, [categories, count, answers.travel, answers.uniforms, answers.officials, answers.training]);

  /** Build step-2 rows from the answers, preserving anything the coach already typed,
   *  chip-added, or saved — going Back and re-answering must never wipe their work. */
  function buildRows() {
    setRows(prev => {
      const prevById = new Map(prev.map(r => [r.itemId, r]));
      const seeded: WorksheetRow[] = seeds.map(s => {
        const existing = prevById.get(s.ref.itemId);
        if (existing) return existing;
        return { ...s.ref, amount: '', perEvent: '', entryFees: s.entryFees, chipAdded: false, status: 'idle' };
      });
      const seededIds = new Set(seeded.map(r => r.itemId));
      const kept = prev.filter(r =>
        !seededIds.has(r.itemId) && (r.chipAdded || r.status === 'saved' || r.amount || r.perEvent));
      return [...seeded, ...kept];
    });
  }

  function addCategoryRows(cat: BudgetCategoryWithItems) {
    setRows(prev => {
      const have = new Set(prev.map(r => r.itemId));
      const added: WorksheetRow[] = cat.items
        .filter(i => i.isDefault && !i.isMisc && !have.has(i.id))
        .map(i => ({
          itemId: i.id, itemName: i.name, categoryId: cat.id, categoryName: cat.name,
          amount: '', perEvent: '', entryFees: false, chipAdded: true, status: 'idle',
        }));
      return [...prev, ...added];
    });
  }

  const alsoCategories = useMemo(() => {
    const inRows = new Set(rows.map(r => r.categoryId));
    return categories.filter(c => c.isDefault && !inRows.has(c.id) && c.items.some(i => i.isDefault && !i.isMisc));
  }, [categories, rows]);

  // ── Pricing ────────────────────────────────────────────────────────────────
  // The ×N helper is honest only when N is exact: "6+" stores 6, so at 6+ the coach
  // types their season total for entries directly (multiplying by a floor would
  // silently understate a 9-tournament season — review finding).
  function effectiveAmount(row: WorksheetRow): number {
    if (row.entryFees && count > 1 && count <= 5) {
      const per = parseFloat(row.perEvent);
      return per > 0 ? Math.round(per * count * 100) / 100 : 0;
    }
    const amt = parseFloat(row.amount);
    return amt > 0 ? amt : 0;
  }

  const pricedRows = rows.filter(r => r.status !== 'saved' && effectiveAmount(r) > 0);
  const blankRows = rows.filter(r => r.status !== 'saved' && effectiveAmount(r) === 0);
  const savedRows = rows.filter(r => r.status === 'saved');
  // Derived, never accumulated: a saved row keeps its typed values, so the total is
  // always recomputable from rows — one source of truth for one number.
  const savedTotal = savedRows.reduce((s, r) => Math.round((s + effectiveAmount(r)) * 100) / 100, 0);

  // ── Dirtiness (for the discard guard) ─────────────────────────────────────
  const answeredCount = [
    answers.tournaments !== null, answers.travel !== null, answers.officials !== null,
    answers.training !== null, answers.uniforms !== null,
  ].filter(Boolean).length;
  const typedCount = rows.filter(r => r.status !== 'saved' && (r.amount || r.perEvent)).length;
  // Saved work is safe; a done-screen close loses nothing.
  const dirty = step !== 3 && (answeredCount > 0 || typedCount > 0);
  const detail = [
    answeredCount > 0 && `${answeredCount} answer${answeredCount === 1 ? '' : 's'}`,
    typedCount > 0 && `${typedCount} amount${typedCount === 1 ? '' : 's'}`,
  ].filter(Boolean).join(' and ') || undefined;
  const close = useDiscardGuard({ dirty, close: onClose, noun: 'starting budget', detail });

  // ── Create ─────────────────────────────────────────────────────────────────
  async function handleCreate() {
    if (pricedRows.length === 0) {
      // Nothing priced is a legitimate outcome: the blanks surface on the page's
      // checklist (derived — nothing to write).
      setStep(3);
      return;
    }
    setSaving(true);
    const toSave = [...pricedRows];
    let wroteAny = false;
    let failures = 0;
    // SEQUENTIAL on purpose, and load-bearing: the lines POST leaves sort_order at its
    // default and the read path orders by sort_order with no tiebreaker, so write order
    // IS the coach's on-screen order. Parallelizing these would scramble the worksheet
    // order they just arranged. (≤~15 rows; per-row outcomes need the loop anyway.)
    for (const row of toSave) {
      setRows(prev => prev.map(r => r.itemId === row.itemId ? { ...r, status: 'saving', error: undefined } : r));
      try {
        const total = effectiveAmount(row);
        const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/budget-plan/lines`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            description: row.itemName,
            categoryId: row.categoryId,
            itemId: row.itemId,
            totalAmount: total,
            // The coach's own arithmetic, kept visible on the line ("4 × $600").
            notes: row.entryFees && count > 1 && count <= 5 ? `${count} × $${row.perEvent}` : null,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? 'Failed to save this line');
        wroteAny = true;
        setRows(prev => prev.map(r => r.itemId === row.itemId ? { ...r, status: 'saved' } : r));
      } catch (e: unknown) {
        failures++;
        setRows(prev => prev.map(r => r.itemId === row.itemId
          ? { ...r, status: 'error', error: e instanceof Error ? e.message : 'Failed to save this line' }
          : r));
      }
    }
    setSaving(false);
    if (wroteAny) await onCreated();
    // A failure keeps the worksheet open with the failed rows' reasons visible;
    // saved rows are marked ✓ and never re-submitted (per-row outcomes, Batch 2 rule).
    if (failures === 0) setStep(3);
  }

  const ctaLabel = pricedRows.length > 0 && blankRows.length > 0
    ? `Add ${pricedRows.length} priced line${pricedRows.length === 1 ? '' : 's'} · keep ${blankRows.length} on checklist`
    : pricedRows.length > 0
      ? `Add ${pricedRows.length} priced line${pricedRows.length === 1 ? '' : 's'}`
      : blankRows.length > 0
        ? `Keep ${blankRows.length} on your checklist`
        : 'Add lines';

  // ── Render ─────────────────────────────────────────────────────────────────
  const grouped = useMemo(() => {
    const map = new Map<string, WorksheetRow[]>();
    for (const r of rows) {
      if (!map.has(r.categoryName)) map.set(r.categoryName, []);
      map.get(r.categoryName)!.push(r);
    }
    return [...map.entries()];
  }, [rows]);

  function yesNo(field: keyof Pick<Answers, 'travel' | 'officials' | 'training' | 'uniforms'>) {
    const value = answers[field];
    return (
      <div className={shared.segChoice}>
        {(['yes', 'no'] as const).map(v => (
          <button
            key={v}
            type="button"
            className={`${shared.segBtn} ${value === v ? shared.segBtnActive : ''}`}
            onClick={() => setAnswers(a => ({ ...a, [field]: v }))}
          >
            {v === 'yes' ? 'Yes' : 'No'}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={shared.modalOverlay} onClick={close}>
      <div className={shared.modal} style={{ paddingBottom: 0 }} onClick={e => e.stopPropagation()}>
        <CoachModalHeader title="Your starting budget" onClose={close} />

        {step === 1 && (
          <>
            <p className={styles.stepLine}>Step 1 of 2 — your season</p>
            <p className={styles.intro}>Tap through — you can change everything later.</p>

            <div className={styles.question}>
              <p className={styles.questionText}>How many tournaments will you enter?</p>
              <div className={shared.segChoice}>
                {[0, 1, 2, 3, 4, 5, 6].map(n => (
                  <button
                    key={n}
                    type="button"
                    className={`${shared.segBtn} ${answers.tournaments === n ? shared.segBtnActive : ''}`}
                    onClick={() => setAnswers(a => ({ ...a, tournaments: n }))}
                  >
                    {n === 6 ? '6+' : n}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.question}>
              <p className={styles.questionText}>Will any of them mean hotels or real travel?</p>
              {yesNo('travel')}
            </div>

            <div className={styles.question}>
              <p className={styles.questionText}>Does the team pay game officials directly?</p>
              {yesNo('officials')}
              <p className={styles.questionHint}>In some leagues the club or league covers this.</p>
            </div>

            <div className={styles.question}>
              <p className={styles.questionText}>Will you run an off-season or indoor training block?</p>
              {yesNo('training')}
            </div>

            <div className={styles.question}>
              <p className={styles.questionText}>Does the team provide uniforms or shared gear?</p>
              {yesNo('uniforms')}
            </div>

            <div className={`${shared.modalFooter} ${styles.footerFlush}`}>
              <button type="button" className={shared.btnGhost} onClick={close}>Cancel</button>
              <button type="button" className={shared.btnPrimary} onClick={() => { buildRows(); setStep(2); }}>
                Next — your lines <ArrowRight size={14} />
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <p className={styles.stepLine}>Step 2 of 2 — price what you know</p>
            <p className={styles.intro}>
              These lines come from your answers. Only fill in what you know — blank lines go on
              your checklist to price later.
            </p>

            {rows.length === 0 && (
              <p className={styles.noneNote}>
                Nothing to add from these answers — pick a category below, or keep your checklist
                and add lines any time.
              </p>
            )}

            {grouped.map(([catName, catRows]) => (
              <div key={catName}>
                <p className={styles.wsGroup}>{catName}</p>
                {catRows.map(row => {
                  const showHelper = row.entryFees && count > 1 && count <= 5;
                  const eff = effectiveAmount(row);
                  return (
                    <div key={row.itemId} className={`${styles.wsRow} ${row.status === 'saved' ? styles.wsRowSaved : ''}`}>
                      <div className={styles.wsTop}>
                        <span className={styles.wsName}>{row.itemName}</span>
                        {row.status === 'saved' ? (
                          <span className={styles.wsSaved}><Check size={12} aria-hidden /> Added</span>
                        ) : (
                          <button
                            type="button"
                            className={styles.wsRemove}
                            aria-label={`Remove ${row.itemName}`}
                            onClick={() => setRows(prev => prev.filter(r => r.itemId !== row.itemId))}
                          >
                            <X size={13} />
                          </button>
                        )}
                      </div>
                      {row.status !== 'saved' && (showHelper ? (
                        <>
                          <label className={styles.amtLabel} htmlFor={`starter-per-${row.itemId}`}>
                            About what does one entry cost you?
                          </label>
                          <div className={styles.amtRow}>
                            <span className={styles.cur} aria-hidden>$</span>
                            <input
                              id={`starter-per-${row.itemId}`}
                              className={styles.amtInput}
                              type="number"
                              min="0.01"
                              step="0.01"
                              inputMode="decimal"
                              value={row.perEvent}
                              onChange={e => setRows(prev => prev.map(r =>
                                r.itemId === row.itemId ? { ...r, perEvent: e.target.value } : r))}
                            />
                            <span className={styles.mathNote}>
                              × {count} tournaments{eff > 0 && <> = <strong>{fmt(eff)}</strong></>}
                            </span>
                          </div>
                          <p className={styles.blankNote}>Your numbers, multiplied — change either any time.</p>
                        </>
                      ) : (
                        <div className={styles.amtRow}>
                          <span className={styles.cur} aria-hidden>$</span>
                          <input
                            className={styles.amtInput}
                            type="number"
                            min="0.01"
                            step="0.01"
                            inputMode="decimal"
                            aria-label={`${row.itemName} amount`}
                            value={row.amount}
                            onChange={e => setRows(prev => prev.map(r =>
                              r.itemId === row.itemId ? { ...r, amount: e.target.value } : r))}
                          />
                          {eff === 0 && (
                            <span className={styles.leaveBlank}>leave blank to price later</span>
                          )}
                        </div>
                      ))}
                      {row.status === 'error' && row.error && (
                        <p className={styles.rowError}>{row.error} — fix or remove this line and try again.</p>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}

            {alsoCategories.length > 0 && (
              <>
                <p className={styles.alsoLabel}>Also worth checking:</p>
                <div className={styles.alsoRow}>
                  {alsoCategories.map(c => (
                    <button key={c.id} type="button" className={styles.alsoChip} onClick={() => addCategoryRows(c)}>
                      + {c.name}
                    </button>
                  ))}
                </div>
              </>
            )}

            <div className={`${shared.modalFooter} ${styles.footerFlush}`}>
              <button type="button" className={shared.btnGhost} onClick={() => setStep(1)}>Back</button>
              <button
                type="button"
                className={shared.btnPrimary}
                disabled={saving || (pricedRows.length === 0 && blankRows.length === 0)}
                onClick={handleCreate}
              >
                {saving ? 'Adding…' : ctaLabel}
              </button>
            </div>
          </>
        )}

        {step === 3 && (
          <div className={styles.doneWrap}>
            <div className={styles.doneTick}><Check size={22} aria-hidden /></div>
            <p className={styles.doneHead}>
              {savedRows.length > 0 ? 'Your starting budget is in.' : 'Your checklist is ready.'}
            </p>
            <p className={styles.doneMeta}>
              {savedRows.length > 0 ? (
                <>
                  {savedRows.length} line{savedRows.length === 1 ? '' : 's'} — <strong>{fmt(savedTotal)}</strong>,
                  all your numbers{blankRows.length > 0 && (
                    <> — and {blankRows.length} item{blankRows.length === 1 ? '' : 's'} on your checklist to price
                    when you know {blankRows.length === 1 ? 'it' : 'them'}</>
                  )}.
                </>
              ) : (
                <>
                  Nothing priced yet — {blankRows.length > 0
                    ? `${blankRows.length} item${blankRows.length === 1 ? '' : 's'} are waiting on your checklist. `
                    : ''}Price lines whenever you know the numbers.
                </>
              )}
            </p>
            <div className={styles.doneActions}>
              <button type="button" className={`${shared.btnPrimary} ${shared.block640}`} onClick={onClose}>
                See my budget
              </button>
              <button type="button" className={styles.doneSampleLink} onClick={onOpenSample}>
                See a sample budget
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
