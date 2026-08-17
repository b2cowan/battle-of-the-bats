'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Trash2, Pencil, X, ChevronUp, ChevronDown, AlertTriangle, Info } from 'lucide-react';
import { useDiscardGuard, snapshotEqual } from '@/components/coaches/useDiscardGuard';
import { useConfirm } from '@/components/coaches/ConfirmProvider';
import { useOverlayOpen } from '@/lib/coaches-overlay';
import type { RepTryoutRubric, RepTryoutRubricCategory } from '@/lib/types';
import type { SetupItemStatus } from './TryoutSetupChecklist';
import day from './TryoutDayCard.module.css';
import styles from './TryoutRubricCard.module.css';

interface Props {
  /** The rubric API base, e.g. `/api/coaches/{orgSlug}/teams/{teamId}/tryout-rubric`. */
  apiBase: string;
  /** Explicit per-component write gate (WI-11) — a no-op while tryouts is all-or-nothing. */
  canWrite?: boolean;
  onError?: (msg: string) => void;
  /** Reports {done, summary} to the checklist row whenever the scorecard changes (2026-08-17). */
  onStatus?: (s: SetupItemStatus) => void;
}

/** `uid` and `noteOpen` are UI-only and deliberately OUTSIDE the dirty snapshot — a row that
 *  merely opened its note field has not been edited. */
interface CatDraft { uid: string; key?: string; label: string; weight: number; instructions: string; noteOpen: boolean }

let uidSeq = 0;
const nextUid = () => `c${++uidSeq}`;

const toDraft = (c: RepTryoutRubricCategory): CatDraft => ({
  uid: nextUid(),
  key: c.key,
  // Stored weights are free-form non-negative numbers; the stepper works in whole steps. Round
  // but never CAP — capping a stored 8 would silently change what the scorecard means.
  label: c.label,
  weight: Math.max(0, Math.round(c.weight)),
  instructions: c.instructions ?? '',
  noteOpen: false,
});

/**
 * Each category's share of the whole scorecard, as whole percents that sum to exactly 100.
 *
 * This is the number the ranking actually uses: the composite is a weight-NORMALISED mean
 * (`lib/tryout-scoring.ts`), so a raw weight is meaningless on its own — six 1s and six 3s are
 * the identical scorecard. Largest-remainder rather than plain rounding, so the footer never
 * has to explain a total of 99%.
 */
function shares(weights: number[]): number[] {
  const total = weights.reduce((a, w) => a + Math.max(0, w), 0);
  if (total <= 0) return weights.map(() => 0);
  const floors = weights.map(w => Math.floor((Math.max(0, w) / total) * 100));
  const order = weights
    .map((w, i) => ({ i, rem: (Math.max(0, w) / total) * 100 - floors[i] }))
    .sort((a, b) => b.rem - a.rem);
  const spare = 100 - floors.reduce((a, b) => a + b, 0);
  for (let k = 0; k < spare; k++) floors[order[k % order.length].i]++;
  return floors;
}

/** An even split as whole percents — what the screen must show whenever the switch is ON,
 *  because it is what will be SAVED. */
function evenShares(n: number): number[] {
  if (n <= 0) return [];
  const base = Math.floor(100 / n);
  const spare = 100 - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < spare ? 1 : 0));
}

/** "Is this scorecard weighted equally?" — derived from the weights themselves, so the switch
 *  needs no stored state of its own and no migration. */
const isEqual = (cats: { weight: number }[]) =>
  cats.length > 0 && cats[0].weight > 0 && cats.every(c => c.weight === cats[0].weight);

/** "Has the coach actually shaped this?" — an uneven split, or any category parked on
 *  notes-only. All-equal-but-not-1 is NOT shaping: resetting it changes nothing the coach can
 *  see, so confirming would be noise. */
const isTuned = (cats: { weight: number }[]) =>
  cats.some(c => c.weight === 0 || c.weight !== cats[0].weight);

export default function TryoutRubricCard({ apiBase, canWrite = true, onError, onStatus }: Props) {
  const [rubric, setRubric] = useState<RepTryoutRubric | null>(null);
  const [starter, setStarter] = useState<{ scaleMax: number; categories: RepTryoutRubricCategory[] } | null>(null);
  const [hasScores, setHasScores] = useState(false);
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [scaleMax, setScaleMax] = useState(5);
  const [cats, setCats] = useState<CatDraft[]>([]);
  const [equal, setEqual] = useState(true);
  // Whatever openBuilder seeded — the rubric being edited OR the starter draft. Our prefill is
  // not the coach's work, so an untouched seeded form still closes silently (Chunk G rider).
  const [baseline, setBaseline] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const confirm = useConfirm();
  useOverlayOpen(open);

  // ONE shape for the dirty baseline and the live form (the one-mapping rule, Chunk A D4),
  // minus the UI-only row fields.
  const snapshot = useCallback(
    () => JSON.stringify({
      name,
      scaleMax,
      cats: cats.map(c => ({ key: c.key, label: c.label, weight: c.weight, instructions: c.instructions })),
    }),
    [name, scaleMax, cats],
  );

  const catCount = cats.filter(c => c.label.trim()).length;
  const guardedClose = useDiscardGuard({
    dirty: baseline != null && !snapshotEqual(snapshot(), baseline),
    close: () => setOpen(false),
    noun: 'scorecard',
    detail: catCount > 0 ? `${catCount} categor${catCount === 1 ? 'y' : 'ies'} and how they count` : undefined,
  });

  const onErrorRef = useRef(onError);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);
  const fail = useCallback((m: string) => { if (onErrorRef.current) onErrorRef.current(m); else console.error(m); }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(apiBase);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to load scorecard');
      setRubric(data.rubric ?? null);
      setStarter(data.starter ?? null);
      setHasScores(!!data.hasScores);
    } catch (e: any) {
      fail(e.message ?? 'Failed to load scorecard.');
    } finally {
      setLoading(false);
    }
  }, [apiBase, fail]);

  useEffect(() => { load(); }, [load]);

  const onStatusRef = useRef(onStatus);
  useEffect(() => { onStatusRef.current = onStatus; }, [onStatus]);
  useEffect(() => {
    if (loading) return;
    const n = rubric?.categories.length ?? 0;
    onStatusRef.current?.({
      done: n > 0,
      summary: n > 0 ? `${n} categor${n === 1 ? 'y' : 'ies'} · scored 1–${rubric!.scaleMax}` : null,
    });
  }, [loading, rubric]);

  function openBuilder() {
    const seedCats = rubric && rubric.categories.length > 0
      ? rubric.categories.map(toDraft)
      : (starter?.categories ?? []).map(toDraft);
    const seedName = rubric && rubric.categories.length > 0 ? (rubric.name ?? '') : '';
    const seedScale = rubric && rubric.categories.length > 0 ? rubric.scaleMax : (starter?.scaleMax ?? 5);

    setName(seedName);
    setScaleMax(seedScale);
    setCats(seedCats);
    setEqual(seedCats.length === 0 || isEqual(seedCats));
    setBaseline(JSON.stringify({
      name: seedName,
      scaleMax: seedScale,
      cats: seedCats.map(c => ({ key: c.key, label: c.label, weight: c.weight, instructions: c.instructions })),
    }));
    setFormError(null);
    setOpen(true);
  }

  const addCat = () =>
    setCats(cs => [...cs, { uid: nextUid(), label: '', weight: cs.length ? cs[0].weight : 1, instructions: '', noteOpen: false }]);
  const removeCat = (uid: string) => setCats(cs => cs.filter(c => c.uid !== uid));
  const patchCat = (uid: string, patch: Partial<CatDraft>) =>
    setCats(cs => cs.map(c => (c.uid === uid ? { ...c, ...patch } : c)));
  const stepWeight = (uid: string, delta: number) =>
    setCats(cs => cs.map(c => (c.uid === uid ? { ...c, weight: Math.max(0, c.weight + delta) } : c)));

  /** Reorder is a real control, not a nicety: this order is the order evaluators tap through
   *  on a phone, outdoors, once a year. */
  const moveCat = (index: number, delta: number) =>
    setCats(cs => {
      const to = index + delta;
      if (to < 0 || to >= cs.length) return cs;
      const next = [...cs];
      [next[index], next[to]] = [next[to], next[index]];
      return next;
    });

  /** Turning weighting OFF just switches mode. Turning it back ON is the deliberate "start
   *  over" path (owner ruling 2026-08-17) — it DISCARDS the tuning, so it confirms first, but
   *  only when there is real shaping to lose. */
  async function toggleEqual() {
    if (equal) { setEqual(false); return; }
    if (isTuned(cats)) {
      const pct = shares(cats.map(c => c.weight));
      const parts = cats.map((c, i) => `${c.label.trim() || `Category ${i + 1}`} ${c.weight > 0 ? `${pct[i]}%` : 'notes only'}`);
      const shown = parts.slice(0, 3).join(', ') + (parts.length > 3 ? `, +${parts.length - 3} more` : '');
      const even = 100 % cats.length === 0 ? `${Math.round(100 / cats.length)}% each` : 'an even split';
      const ok = await confirm({
        title: 'Start over with an even split?',
        message: `Your weighting (${shown}) will be replaced with ${even}. You can't undo this.`,
        confirmText: 'Reset to equal',
        cancelText: 'Keep my weighting',
        tone: 'warning',
      });
      if (!ok) return;
    }
    setCats(cs => cs.map(c => ({ ...c, weight: 1 })));
    setEqual(true);
  }

  async function save() {
    // A row with SUBSTANCE but no name must BLOCK, not silently vanish from the payload (WI-2).
    // Substance = an EXISTING category (its `key` means evaluators may already have scored it —
    // dropping it severs those scores from the rubric), typed instructions, or a weight the
    // coach moved off the default. Only a brand-new row that never got anything but its default
    // may drop silently — that row is genuinely empty.
    const orphanIdx = cats.findIndex(c => !c.label.trim() && (c.key || c.instructions.trim() || (!equal && c.weight !== 1)));
    if (orphanIdx !== -1) {
      setFormError(`Category ${orphanIdx + 1} needs a name before you can save it — name it or remove the row.`);
      return;
    }
    const named = cats.filter(c => c.label.trim());
    if (named.length === 0) { setFormError('Add at least one scoring category.'); return; }
    const categories = named.map(c => ({
      key: c.key,
      label: c.label.trim(),
      // While the switch is on, an even split is what the screen promised — so it is what gets
      // written, whatever the rows happen to be carrying.
      weight: equal ? 1 : Math.max(0, c.weight),
      instructions: c.instructions.trim() || undefined,
    }));
    setSaving(true);
    setFormError(null);
    try {
      const res = await fetch(apiBase, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, scaleMax, categories }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.errors?.categories ?? data.error ?? 'Failed to save scorecard');
      setRubric(data.rubric);
      setOpen(false);
    } catch (e: any) {
      setFormError(e.message ?? 'Failed to save scorecard.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return null;

  const hasRubric = !!rubric && rubric.categories.length > 0;
  const readPct = hasRubric ? shares(rubric!.categories.map(c => c.weight)) : [];
  const readEqual = hasRubric && isEqual(rubric!.categories);

  const evenPct = evenShares(cats.length);
  const livePct = equal ? evenPct : shares(cats.map(c => c.weight));
  const rankedCount = cats.filter(c => c.weight > 0).length;
  const allNotesOnly = !equal && cats.length > 0 && rankedCount === 0;
  // Only stated when the split divides cleanly — "20% each" over 5 categories is true, "34% each"
  // over 3 is not, and a figure that is almost right is worse than none.
  const evenEach = cats.length > 0 && 100 % cats.length === 0 ? evenPct[0] : null;
  const previewCats = cats.filter(c => c.label.trim());

  // Row-body form (2026-08-17): the checklist row bar owns the title/status; this renders only
  // the manager — the category list, its actions, and the builder modal.
  return (
    <>
      {hasRubric ? (
        <>
          <div className={styles.readMeta}>
            Scale 1–{rubric!.scaleMax} · {readEqual ? 'weighted equally' : 'custom weighting'}
            {rubric!.name ? ` · ${rubric!.name}` : ''}
          </div>
          <div className={day.sessionList}>
            {rubric!.categories.map((c, i) => (
              <div key={c.key} className={day.sessionRow}>
                <div className={day.sessionMain}>
                  <div className={day.sessionWhen}>{c.label}</div>
                  {c.instructions && <div className={day.sessionMeta}>{c.instructions}</div>}
                </div>
                <div className={c.weight > 0 ? styles.readShare : styles.readShareMuted}>
                  {c.weight > 0 ? `${readPct[i]}%` : 'Notes only'}
                </div>
              </div>
            ))}
          </div>
          {canWrite && (
            <div className={day.actions}>
              <button type="button" className={day.addBtn} onClick={openBuilder}><Pencil size={14} /> Edit scorecard</button>
            </div>
          )}
        </>
      ) : (
        <>
          <p className={day.empty}>No scorecard yet. Set one up before scoring players.</p>
          {canWrite && (
            <div className={day.actions}>
              <button type="button" className="btn btn-primary" style={{ fontSize: '0.85rem' }} onClick={openBuilder}>Set up scorecard</button>
            </div>
          )}
        </>
      )}

      {open && (
        <div className={styles.scrim} onClick={() => !saving && guardedClose()}>
          <div
            className={styles.modal}
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="rubric-builder-title"
          >
            <div className={styles.head}>
              <h3 className={styles.title} id="rubric-builder-title">Evaluation scorecard</h3>
              <button type="button" className={styles.closeBtn} onClick={() => !saving && guardedClose()} aria-label="Close">
                <X size={16} />
              </button>
            </div>

            <div className={styles.body}>
              <div className={styles.grid}>
                <div>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="rubric-name">
                      Name <span className={styles.labelSoft}>· optional</span>
                    </label>
                    <input className={styles.input} id="rubric-name" value={name} maxLength={120}
                      onChange={e => setName(e.target.value)} placeholder="e.g. U15 AAA tryout scorecard" />
                  </div>

                  <div className={styles.field}>
                    <span className={styles.label} id="rubric-scale-label">Rating scale</span>
                    <div className={styles.seg} role="group" aria-labelledby="rubric-scale-label">
                      {[5, 10].map(s => (
                        <button
                          key={s}
                          type="button"
                          className={`${styles.segBtn} ${scaleMax === s ? styles.segOn : ''}`}
                          aria-pressed={scaleMax === s}
                          onClick={() => setScaleMax(s)}
                        >
                          1–{s}
                        </button>
                      ))}
                    </div>
                    <p className={styles.hint}>
                      {scaleMax === 5
                        ? '1–5 is faster to tap in the field.'
                        : '1–10 separates similar players more finely.'}
                    </p>
                  </div>

                  <div className={styles.field}>
                    <span className={styles.label}>How categories count</span>
                    <div className={styles.toggleRow}>
                      <button
                        type="button"
                        className={`${styles.track} ${equal ? styles.trackOn : ''}`}
                        role="switch"
                        aria-checked={equal}
                        aria-label="Count every category equally"
                        onClick={toggleEqual}
                      />
                      <span className={styles.toggleText}>
                        <span className={styles.toggleLabel}>Count every category equally</span>
                        <span className={styles.toggleHint}>
                          {equal
                            ? `All ${cats.length} categor${cats.length === 1 ? 'y counts' : 'ies count'} the same${evenEach != null ? ` — ${evenEach}% each` : ''}.`
                            : 'Set each category’s share below. Switching this back on resets them to an even split.'}
                        </span>
                      </span>
                    </div>

                    {allNotesOnly && (
                      <p className={styles.noteWarn}>
                        <AlertTriangle size={14} style={{ flex: '0 0 auto', marginTop: 2 }} />
                        <span>
                          Every category is set to notes only, so there’s nothing left to rank on — the board
                          will fall back to counting them all equally. Give at least one category a share, or
                          switch equal counting back on.
                        </span>
                      </p>
                    )}
                    {hasScores && (
                      <p className={styles.noteInfo}>
                        <Info size={14} style={{ flex: '0 0 auto', marginTop: 2 }} />
                        <span>Players have already been scored — changing how categories count re-orders your board.</span>
                      </p>
                    )}
                  </div>

                  <div className={`${styles.field} ${styles.fieldLast}`}>
                    <span className={styles.label}>
                      Categories <span className={styles.labelSoft}>· the order your helpers score them in</span>
                    </span>
                    <ul className={styles.cats}>
                      {cats.map((c, i) => {
                        const notesOnly = !equal && c.weight === 0;
                        const rowName = c.label.trim() || `category ${i + 1}`;
                        return (
                          <li key={c.uid} className={styles.cat}>
                            <div className={styles.catTop}>
                              <span className={styles.grip}>
                                <button type="button" className={styles.gripBtn} disabled={i === 0}
                                  onClick={() => moveCat(i, -1)} aria-label={`Move ${rowName} up`}>
                                  <ChevronUp size={11} strokeWidth={3} />
                                </button>
                                <button type="button" className={styles.gripBtn} disabled={i === cats.length - 1}
                                  onClick={() => moveCat(i, 1)} aria-label={`Move ${rowName} down`}>
                                  <ChevronDown size={11} strokeWidth={3} />
                                </button>
                              </span>
                              <span className={styles.catName}>
                                <input className={styles.input} value={c.label} maxLength={60}
                                  aria-label={`Category ${i + 1} name`}
                                  placeholder="Category name"
                                  onChange={e => patchCat(c.uid, { label: e.target.value })} />
                              </span>
                              <button type="button" className={styles.iconBtn} onClick={() => removeCat(c.uid)}
                                aria-label={`Remove ${rowName}`}>
                                <Trash2 size={15} />
                              </button>
                            </div>

                            <div className={styles.share}>
                              {!equal && (
                                <span className={styles.stepper} role="group" aria-label={`${rowName} — share of the total`}>
                                  <button type="button" className={styles.stepBtn} disabled={c.weight <= 0}
                                    onClick={() => stepWeight(c.uid, -1)} aria-label={`Less weight for ${rowName}`}>−</button>
                                  <span className={styles.stepVal}>{c.weight}</span>
                                  <button type="button" className={styles.stepBtn}
                                    onClick={() => stepWeight(c.uid, 1)} aria-label={`More weight for ${rowName}`}>+</button>
                                </span>
                              )}
                              {notesOnly ? (
                                <>
                                  <span className={styles.notesOnly}>Notes only · not ranked</span>
                                  <span className={styles.pctMuted}>—</span>
                                </>
                              ) : (
                                <>
                                  <span className={styles.bar}>
                                    <span className={styles.barFill} style={{ width: `${livePct[i] ?? 0}%` }} />
                                  </span>
                                  <span className={equal ? `${styles.pct} ${styles.pctEqual}` : styles.pct}>
                                    {livePct[i] ?? 0}%
                                  </span>
                                </>
                              )}
                            </div>

                            <div className={styles.noteLine}>
                              {c.noteOpen ? (
                                <input className={styles.input} style={{ fontSize: '0.82rem' }} value={c.instructions}
                                  maxLength={500} autoFocus
                                  aria-label={`Note for evaluators on ${rowName}`}
                                  placeholder="What should evaluators look for?"
                                  onChange={e => patchCat(c.uid, { instructions: e.target.value })}
                                  onBlur={() => patchCat(c.uid, { noteOpen: false })} />
                              ) : c.instructions.trim() ? (
                                <span className={styles.noteRead}>
                                  <span className={styles.noteReadLabel}>Note</span>
                                  <span className={styles.noteReadText}>{c.instructions}</span>
                                  <button type="button" className={styles.noteBtn}
                                    onClick={() => patchCat(c.uid, { noteOpen: true })}>Edit</button>
                                </span>
                              ) : (
                                <button type="button" className={styles.noteBtn}
                                  onClick={() => patchCat(c.uid, { noteOpen: true })}>
                                  + Add a note for evaluators
                                </button>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                    <button type="button" className={styles.addBtn} onClick={addCat}>
                      <Plus size={13} /> Add category
                    </button>
                    {formError && <p className={styles.formError}>{formError}</p>}
                  </div>
                </div>

                <div className={styles.preview}>
                  <span className={styles.previewCap}>What your helpers will see</span>
                  <div className={styles.phone}>
                    <div className={styles.phoneHead}>
                      <span className={styles.phoneBib}>#14</span>
                      <span className={styles.phoneName}>Player 14</span>
                    </div>
                    <div className={styles.phoneBody}>
                      {previewCats.length === 0 ? (
                        <p className={styles.previewEmpty}>Name a category to see it here.</p>
                      ) : previewCats.map(c => (
                        <div key={c.uid}>
                          <div className={styles.pCatLabel}>{c.label}</div>
                          {c.instructions.trim() && <div className={styles.pCatHint}>{c.instructions}</div>}
                          <div className={styles.pScale} aria-hidden>
                            {Array.from({ length: scaleMax }, (_, n) => <span key={n}>{n + 1}</span>)}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className={styles.phoneFoot}>
                      Shares never appear here — helpers score every category, and the scorecard decides what each is worth.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.foot}>
              <span className={styles.summary}>
                <b>{cats.length}</b> categor{cats.length === 1 ? 'y' : 'ies'} · scored <b>1–{scaleMax}</b><br />
                {equal
                  ? `Weighted equally${evenEach != null ? ` · ${evenEach}% each` : ''}`
                  : rankedCount > 0
                    ? <>
                        <b>{rankedCount}</b> ranked · shares total <b>100%</b>
                        {rankedCount < cats.length && ` · ${cats.length - rankedCount} notes only`}
                      </>
                    : 'Nothing ranked'}
              </span>
              <span className={styles.footActions}>
                <button type="button" className="btn btn-ghost" onClick={() => guardedClose()} disabled={saving}>Cancel</button>
                <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save scorecard'}</button>
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
