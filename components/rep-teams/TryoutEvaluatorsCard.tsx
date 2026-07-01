'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Users, Plus, Copy, Check, Ban } from 'lucide-react';
import styles from './TryoutDayCard.module.css';

interface Evaluator {
  id: string;
  evaluatorName: string | null;
  expiresAt: string;
  revokedAt: string | null;
  candidatesScored: number;
  createdAt: string;
}

interface Props {
  /** Evaluators API base, e.g. `/api/coaches/{orgSlug}/teams/{teamId}/tryout-evaluators`. */
  apiBase: string;
  onError?: (msg: string) => void;
}

function statusOf(e: Evaluator): { label: string; live: boolean } {
  if (e.revokedAt) return { label: 'Turned off', live: false };
  if (new Date(e.expiresAt).getTime() < Date.now()) return { label: 'Expired', live: false };
  return { label: 'Active', live: true };
}

export default function TryoutEvaluatorsCard({ apiBase, onError }: Props) {
  const [evaluators, setEvaluators] = useState<Evaluator[]>([]);
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [freshLink, setFreshLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const onErrorRef = useRef(onError);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);
  const fail = useCallback((m: string) => { if (onErrorRef.current) onErrorRef.current(m); else console.error(m); }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(apiBase);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to load evaluators');
      setEvaluators(data.evaluators ?? []);
    } catch (e: any) {
      fail(e.message ?? 'Failed to load evaluators.');
    } finally {
      setLoading(false);
    }
  }, [apiBase, fail]);

  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setName('');
    setFormError(null);
    setFreshLink(null);
    setCopied(false);
    setOpen(true);
  }

  async function create() {
    if (!name.trim()) { setFormError('Add the evaluator’s name.'); return; }
    setSaving(true);
    setFormError(null);
    try {
      const res = await fetch(apiBase, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evaluatorName: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.errors?.evaluatorName ?? data.error ?? 'Failed to create link');
      setEvaluators(prev => [data.session, ...prev]);
      setFreshLink(`${window.location.origin}/tryout-score/${data.token}`);
    } catch (e: any) {
      setFormError(e.message ?? 'Failed to create link.');
    } finally {
      setSaving(false);
    }
  }

  async function copyLink() {
    if (!freshLink) return;
    try {
      await navigator.clipboard.writeText(freshLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      fail('Couldn’t copy automatically — select the link and copy it.');
    }
  }

  async function revoke(id: string) {
    setRevokingId(id);
    try {
      const res = await fetch(`${apiBase}/${id}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error ?? 'Failed to turn off link'); }
      setEvaluators(prev => prev.map(e => (e.id === id ? { ...e, revokedAt: new Date().toISOString() } : e)));
    } catch (e: any) {
      fail(e.message ?? 'Failed to turn off link.');
    } finally {
      setRevokingId(null);
    }
  }

  if (loading) return null;

  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <div>
          <h3 className={styles.title}><Users size={16} /> Evaluators</h3>
          <p className={styles.subtitle}>Share a scoring link with an assistant — no account needed.</p>
        </div>
      </div>

      {evaluators.length === 0 ? (
        <p className={styles.empty}>No evaluators yet. Add one to let a helper score players on their own phone.</p>
      ) : (
        <div className={styles.sessionList}>
          {evaluators.map(e => {
            const st = statusOf(e);
            return (
              <div key={e.id} className={styles.sessionRow}>
                <div className={styles.sessionMain}>
                  <div className={styles.sessionWhen}>{e.evaluatorName ?? 'Evaluator'}</div>
                  <div className={styles.sessionMeta}>
                    <span style={{ color: st.live ? 'var(--logic-lime, #a3e635)' : 'rgba(255,255,255,0.4)' }}>{st.label}</span>
                    {' · '}{e.candidatesScored} scored
                  </div>
                </div>
                {st.live && (
                  <button
                    type="button"
                    className={`${styles.iconBtn} ${styles.iconDanger}`}
                    onClick={() => revoke(e.id)}
                    disabled={revokingId === e.id}
                    aria-label="Turn off link"
                    title="Turn off link"
                  >
                    <Ban size={15} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className={styles.actions}>
        <button type="button" className={styles.addBtn} onClick={openAdd}><Plus size={14} /> Add evaluator</button>
      </div>

      {open && (
        <div className={styles.scrim} onClick={() => !saving && setOpen(false)}>
          <div className={styles.modal} onClick={ev => ev.stopPropagation()}>
            {!freshLink ? (
              <>
                <h3 className={styles.modalTitle}>Add an evaluator</h3>
                <div className={styles.field}>
                  <label className={styles.label}>Evaluator name</label>
                  <input className={styles.input} value={name} maxLength={80} autoFocus
                    placeholder="e.g. Coach Dave" onChange={e => setName(e.target.value)} />
                </div>
                <p className={styles.subtitle} style={{ margin: '0 0 0.6rem' }}>
                  They’ll get a private link that works for 48 hours. No login, no app.
                </p>
                {formError && <p style={{ color: '#f87171', fontSize: '0.82rem', margin: '0 0 0.5rem' }}>{formError}</p>}
                <div className={styles.modalActions}>
                  <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)} disabled={saving}>Cancel</button>
                  <button type="button" className="btn btn-primary" onClick={create} disabled={saving}>{saving ? 'Creating…' : 'Create link'}</button>
                </div>
              </>
            ) : (
              <>
                <h3 className={styles.modalTitle}>Link ready for {name.trim()}</h3>
                <p className={styles.subtitle} style={{ margin: '0 0 0.6rem' }}>
                  Copy it now and text or email it to them — for their privacy we don’t show it again.
                </p>
                <div className={styles.field}>
                  <input className={styles.input} readOnly value={freshLink} onFocus={e => e.currentTarget.select()} />
                </div>
                <div className={styles.modalActions}>
                  <button type="button" className={styles.addBtn} onClick={copyLink}>
                    {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy link</>}
                  </button>
                  <button type="button" className="btn btn-primary" onClick={() => setOpen(false)}>Done</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
