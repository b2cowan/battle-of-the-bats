'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Copy, Check, Ban, RefreshCw } from 'lucide-react';
import { useConfirm } from '@/components/coaches/ConfirmProvider';
import { useDiscardGuard } from '@/components/coaches/useDiscardGuard';
import { useOverlayOpen } from '@/lib/coaches-overlay';
import type { SetupItemStatus } from './TryoutSetupChecklist';
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
  /** Explicit per-component write gate (WI-11) — a no-op while tryouts is all-or-nothing. */
  canWrite?: boolean;
  onError?: (msg: string) => void;
  /** Reports {done, summary} to the checklist row whenever the links change (2026-08-17). */
  onStatus?: (s: SetupItemStatus) => void;
}

function statusOf(e: Evaluator): { label: string; live: boolean } {
  if (e.revokedAt) return { label: 'Turned off', live: false };
  if (new Date(e.expiresAt).getTime() < Date.now()) return { label: 'Expired', live: false };
  return { label: 'Active', live: true };
}

/** "until Sat 6:00 pm" — the link's lifetime belongs beside its status (WI-8). */
function expiryLabel(e: Evaluator): string {
  return new Date(e.expiresAt).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' });
}

export default function TryoutEvaluatorsCard({ apiBase, canWrite = true, onError, onStatus }: Props) {
  const confirm = useConfirm();
  const [evaluators, setEvaluators] = useState<Evaluator[]>([]);
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [freshLink, setFreshLink] = useState<string | null>(null);
  /** Whose link the show-once modal is presenting — "Link ready for {name}" on mint AND reissue. */
  const [freshFor, setFreshFor] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [reissuingId, setReissuingId] = useState<string | null>(null);

  useOverlayOpen(open);
  // Light guard (WI-2): one typed name is still typed work — but once the link is minted the
  // modal is a done-screen and closes silently (the BudgetStarterSheet post-save exemption).
  const guardedClose = useDiscardGuard({
    dirty: !freshLink && name.trim().length > 0,
    close: () => setOpen(false),
    noun: 'evaluator link',
  });

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

  const onStatusRef = useRef(onStatus);
  useEffect(() => { onStatusRef.current = onStatus; }, [onStatus]);
  useEffect(() => {
    if (loading) return;
    const live = evaluators.filter(e => statusOf(e).live).length;
    onStatusRef.current?.({
      done: live > 0,
      summary: live > 0
        ? `${live} helper${live === 1 ? '' : 's'} invited`
        : evaluators.length > 0
          ? `${evaluators.length} link${evaluators.length === 1 ? '' : 's'} expired or off`
          : null,
    });
  }, [loading, evaluators]);

  function openAdd() {
    setName('');
    setFormError(null);
    setFreshLink(null);
    setFreshFor('');
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
      setFreshFor(name.trim());
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

  async function revoke(e: Evaluator) {
    // Instant outward-facing destruction deserves an ask — and the ask names who (WI-8).
    const ok = await confirm({
      title: `Turn off ${e.evaluatorName ?? 'this evaluator'}’s link?`,
      message: `${e.evaluatorName ?? 'They'} loses scoring access immediately. ${e.candidatesScored > 0 ? `Their ${e.candidatesScored} scored player${e.candidatesScored === 1 ? '' : 's'} are kept.` : 'Nothing they’ve done is lost — they haven’t scored yet.'}`,
      confirmText: 'Turn off link',
      cancelText: 'Cancel',
      tone: 'danger',
    });
    if (!ok) return;
    setRevokingId(e.id);
    try {
      const res = await fetch(`${apiBase}/${e.id}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error ?? 'Failed to turn off link'); }
      setEvaluators(prev => prev.map(x => (x.id === e.id ? { ...x, revokedAt: new Date().toISOString() } : x)));
    } catch (err: any) {
      fail(err.message ?? 'Failed to turn off link.');
    } finally {
      setRevokingId(null);
    }
  }

  /** Fresh link, SAME identity (WI-8): their scores stay attached — a second "evaluator" for the
   *  same person would double-count their opinion in the rankings. */
  async function reissue(e: Evaluator) {
    if (reissuingId) return;
    // Reissuing a deliberately turned-off link REVIVES it — that must never happen silently
    // from an icon whose tooltip only promises "new link".
    if (e.revokedAt) {
      const ok = await confirm({
        title: `Give ${e.evaluatorName ?? 'this evaluator'} a new link?`,
        message: `You turned their link off. A new link gives ${e.evaluatorName ?? 'them'} scoring access again (their earlier scores are kept).`,
        confirmText: 'Create new link',
        cancelText: 'Cancel',
        tone: 'warning',
      });
      if (!ok) return;
    }
    setReissuingId(e.id);
    try {
      const res = await fetch(`${apiBase}/${e.id}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to issue a new link');
      setEvaluators(prev => prev.map(x => (x.id === e.id ? { ...x, expiresAt: data.session.expiresAt, revokedAt: null } : x)));
      setName('');
      setFormError(null);
      setCopied(false);
      setFreshFor(e.evaluatorName ?? 'this evaluator');
      setFreshLink(`${window.location.origin}/tryout-score/${data.token}`);
      setOpen(true);
    } catch (err: any) {
      fail(err.message ?? 'Failed to issue a new link.');
    } finally {
      setReissuingId(null);
    }
  }

  if (loading) return null;

  // Row-body form (2026-08-17): the checklist row bar owns the title/status; this renders only
  // the manager — the link list, its actions, and the mint/reissue modal.
  return (
    <>
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
                    <span style={{ color: st.live ? 'var(--logic-lime)' : 'var(--home-dim, rgba(255,255,255,0.4))' }}>{st.label}</span>
                    {st.live && <> · until {expiryLabel(e)}</>}
                    {' · '}{e.candidatesScored} scored
                  </div>
                </div>
                {canWrite && (
                  <div className={styles.sessionActions}>
                    <button
                      type="button"
                      className={styles.iconBtn}
                      onClick={() => reissue(e)}
                      disabled={reissuingId === e.id}
                      aria-label={`New link for ${e.evaluatorName ?? 'this evaluator'} — their scores are kept`}
                      title="New link (their scores are kept)"
                    >
                      <RefreshCw size={15} />
                    </button>
                    {st.live && (
                      <button
                        type="button"
                        className={`${styles.iconBtn} ${styles.iconDanger}`}
                        onClick={() => revoke(e)}
                        disabled={revokingId === e.id}
                        aria-label="Turn off link"
                        title="Turn off link"
                      >
                        <Ban size={15} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {canWrite && (
        <div className={styles.actions}>
          <button type="button" className={styles.addBtn} onClick={openAdd}><Plus size={14} /> Add evaluator</button>
        </div>
      )}

      {open && (
        <div className={styles.scrim} onClick={() => !saving && guardedClose()}>
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
                {formError && <p style={{ color: 'var(--danger-light)', fontSize: '0.82rem', margin: '0 0 0.5rem' }}>{formError}</p>}
                <div className={styles.modalActions}>
                  <button type="button" className="btn btn-ghost" onClick={() => guardedClose()} disabled={saving}>Cancel</button>
                  <button type="button" className="btn btn-primary" onClick={create} disabled={saving}>{saving ? 'Creating…' : 'Create link'}</button>
                </div>
              </>
            ) : (
              <>
                <h3 className={styles.modalTitle}>Link ready for {freshFor}</h3>
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
    </>
  );
}
