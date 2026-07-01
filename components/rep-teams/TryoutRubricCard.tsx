'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { ListChecks, Plus, Trash2, Pencil } from 'lucide-react';
import type { RepTryoutRubric, RepTryoutRubricCategory } from '@/lib/types';
import styles from './TryoutDayCard.module.css';

interface Props {
  /** The rubric API base, e.g. `/api/coaches/{orgSlug}/teams/{teamId}/tryout-rubric`. */
  apiBase: string;
  onError?: (msg: string) => void;
}

interface CatDraft { key?: string; label: string; weight: string; instructions: string }

const toDraft = (c: RepTryoutRubricCategory): CatDraft => ({
  key: c.key, label: c.label, weight: String(c.weight), instructions: c.instructions ?? '',
});

export default function TryoutRubricCard({ apiBase, onError }: Props) {
  const [rubric, setRubric] = useState<RepTryoutRubric | null>(null);
  const [starter, setStarter] = useState<{ scaleMax: number; categories: RepTryoutRubricCategory[] } | null>(null);
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [scaleMax, setScaleMax] = useState(5);
  const [cats, setCats] = useState<CatDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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
    } catch (e: any) {
      fail(e.message ?? 'Failed to load scorecard.');
    } finally {
      setLoading(false);
    }
  }, [apiBase, fail]);

  useEffect(() => { load(); }, [load]);

  function openBuilder() {
    if (rubric && rubric.categories.length > 0) {
      setName(rubric.name ?? '');
      setScaleMax(rubric.scaleMax);
      setCats(rubric.categories.map(toDraft));
    } else {
      setName('');
      setScaleMax(starter?.scaleMax ?? 5);
      setCats((starter?.categories ?? []).map(toDraft));
    }
    setFormError(null);
    setOpen(true);
  }

  const addCat = () => setCats(cs => [...cs, { label: '', weight: '1', instructions: '' }]);
  const removeCat = (i: number) => setCats(cs => cs.filter((_, idx) => idx !== i));
  const updateCat = (i: number, field: keyof CatDraft, val: string) =>
    setCats(cs => cs.map((c, idx) => (idx === i ? { ...c, [field]: val } : c)));

  async function save() {
    const categories = cats
      .filter(c => c.label.trim())
      .map(c => ({
        key: c.key,
        label: c.label.trim(),
        weight: Number(c.weight) >= 0 ? Number(c.weight) : 1,
        instructions: c.instructions.trim() || undefined,
      }));
    if (categories.length === 0) { setFormError('Add at least one scoring category.'); return; }
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

  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <div>
          <h3 className={styles.title}><ListChecks size={16} /> Evaluation scorecard</h3>
          <p className={styles.subtitle}>What you rate players on at tryouts.</p>
        </div>
      </div>

      {hasRubric ? (
        <>
          <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', marginBottom: '0.6rem' }}>
            Scale 1–{rubric!.scaleMax}{rubric!.name ? ` · ${rubric!.name}` : ''}
          </div>
          <div className={styles.sessionList}>
            {rubric!.categories.map(c => (
              <div key={c.key} className={styles.sessionRow}>
                <div className={styles.sessionMain}>
                  <div className={styles.sessionWhen}>{c.label}</div>
                  {c.instructions && <div className={styles.sessionMeta}>{c.instructions}</div>}
                </div>
                <div className={styles.sessionMeta} style={{ whiteSpace: 'nowrap' }}>weight {c.weight}</div>
              </div>
            ))}
          </div>
          <div className={styles.actions}>
            <button type="button" className={styles.addBtn} onClick={openBuilder}><Pencil size={14} /> Edit scorecard</button>
          </div>
        </>
      ) : (
        <>
          <p className={styles.empty}>No scorecard yet. Set one up before scoring players.</p>
          <div className={styles.actions}>
            <button type="button" className="btn btn-primary" style={{ fontSize: '0.85rem' }} onClick={openBuilder}>Set up scorecard</button>
          </div>
        </>
      )}

      {open && (
        <div className={styles.scrim} onClick={() => !saving && setOpen(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Evaluation scorecard</h3>

            <div className={styles.field}>
              <label className={styles.label}>Name <span style={{ color: 'rgba(255,255,255,0.35)' }}>· optional</span></label>
              <input className={styles.input} value={name} maxLength={120}
                onChange={e => setName(e.target.value)} placeholder="e.g. U15 AAA tryout scorecard" />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Rating scale</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {[5, 10].map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setScaleMax(s)}
                    className={styles.addBtn}
                    style={scaleMax === s ? { borderStyle: 'solid', borderColor: 'var(--logic-lime, #a3e635)', color: '#f0f0f0' } : {}}
                  >
                    1–{s}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Categories</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {cats.map((c, i) => (
                  <div key={i} style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '0.6rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <input className={styles.input} style={{ flex: 1 }} value={c.label} maxLength={60}
                        placeholder="Category (e.g. Hitting)" onChange={e => updateCat(i, 'label', e.target.value)} />
                      <input className={styles.input} style={{ width: 74 }} type="number" min={0} step={1} value={c.weight}
                        title="Weight" onChange={e => updateCat(i, 'weight', e.target.value)} />
                      <button type="button" className={`${styles.iconBtn} ${styles.iconDanger}`} onClick={() => removeCat(i)} aria-label="Remove category"><Trash2 size={15} /></button>
                    </div>
                    <input className={styles.input} style={{ marginTop: '0.4rem', fontSize: '0.82rem' }} value={c.instructions} maxLength={500}
                      placeholder="Note for evaluators (optional)" onChange={e => updateCat(i, 'instructions', e.target.value)} />
                  </div>
                ))}
              </div>
              <button type="button" className={styles.addBtn} style={{ marginTop: '0.5rem' }} onClick={addCat}><Plus size={14} /> Add category</button>
            </div>

            {formError && <p style={{ color: '#f87171', fontSize: '0.82rem', margin: '0 0 0.5rem' }}>{formError}</p>}

            <div className={styles.modalActions}>
              <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)} disabled={saving}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save scorecard'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
