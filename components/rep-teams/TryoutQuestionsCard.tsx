'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { checkEmail } from '@/lib/site-field-checks';
import {
  TRYOUT_CONTACT_HINT,
  ANOTHER_HEAD_SET_IT,
  ONLY_A_HEAD_COACH_CHANGES,
  tryoutContactNudge,
  tryoutContactSetLine,
  tryoutContactUnsetLine,
} from '@/lib/tryout-contact-rules';
import SaveStatusPill from '@/components/coaches/SaveStatusPill';
import shared from '@/app/[orgSlug]/coaches/coaches.module.css';
import type { SetupItemStatus } from './TryoutSetupChecklist';
import styles from './TryoutQuestionsCard.module.css';

/**
 * Tryouts › Set up, the fourth row: "Questions from families" (Club Tier Stage 4c-2 Part B, Asks 1–3; words
 * CLUB_TIER_STAGE4C2_COPY.md §H). Optional — it never counts toward "2 required".
 *
 * A head coach gives this team's tryout page their own address for families' questions. It SAVES ON LEAVING THE FIELD,
 * only when complete and valid — never part-typed; the server refuses the coach's sign-in address (H5) and a malformed
 * one (H6) and the field keeps what was typed, with the reason under it. The role-address nudge (H7) sits under the
 * hint, quiet. An assistant with tryouts access reads it ("set by …") and cannot change it (H9). The address ends with
 * the setter's head-coach role, so the row reports the server's LIVE answer, never a cached one.
 */

interface View {
  email: string | null;
  setByName: string | null;
  setByYou: boolean;
  resetAt: string | null;
  canChange: boolean;
  clubAddress: string | null;
}

export default function TryoutQuestionsCard({ apiBase, onStatus }: {
  /** `/api/coaches/{org}/teams/{team}/tryout-contact` */
  apiBase: string;
  onStatus?: (s: SetupItemStatus) => void;
}) {
  const [view, setView] = useState<View | null>(null);
  const [draft, setDraft] = useState('');
  const [refusal, setRefusal] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // What the last failed save tried — Retry repeats THAT (a failed Remove is retried as a Remove).
  const lastTry = useRef<{ method: 'PUT' | 'DELETE'; email?: string } | null>(null);

  const onStatusRef = useRef(onStatus);
  useEffect(() => { onStatusRef.current = onStatus; }, [onStatus]);

  const accept = useCallback((v: View) => {
    setView(v);
    setDraft(v.email ?? '');
    onStatusRef.current?.(v.email
      ? { done: true, summary: tryoutContactSetLine(v.email, v.setByYou, v.setByName) }
      : { done: false, summary: tryoutContactUnsetLine(v.clubAddress, v.resetAt, undefined, v.canChange) });
  }, []);

  useEffect(() => {
    let live = true;
    fetch(apiBase)
      .then(async res => { const j = await res.json().catch(() => ({})); if (!res.ok) throw new Error(j.error); return j as View; })
      .then(v => { if (live) accept(v); })
      .catch(() => { if (live) setSaveError('Couldn’t load the address'); });
    return () => { live = false; };
  }, [apiBase, accept]);

  async function send(method: 'PUT' | 'DELETE', email?: string) {
    if (saving) return;
    lastTry.current = { method, email };
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(apiBase, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: method === 'PUT' ? JSON.stringify({ email }) : undefined,
      });
      const j = await res.json().catch(() => ({}));
      if (res.status === 400 && typeof j.error === 'string') { setRefusal(j.error); return; }
      if (!res.ok) throw new Error(j.error);
      setRefusal(null);
      accept(j as View);
    } catch {
      // H12: the house pill says so; the page keeps what it showed.
      setSaveError('Couldn’t save');
    } finally {
      setSaving(false);
    }
  }

  /** On leaving the field: only a complete, valid, changed address is sent. */
  function commit() {
    if (!view?.canChange || saving) return;
    const typed = draft.trim();
    // An emptied field is not a Remove (that is its own door): it puts back what families see now.
    if (!typed) { setDraft(view.email ?? ''); setRefusal(null); return; }
    if (typed === (view.email ?? '')) { setRefusal(null); return; }
    const checked = checkEmail(typed);
    if (!checked.ok) { setRefusal(checked.error); return; }
    void send('PUT', typed);
  }

  if (!view) {
    // H11 — loading.
    return (
      <div className={styles.body}>
        <label className={shared.field}>
          <span className={shared.label}>Address for tryout questions</span>
          <input className={shared.input} type="email" disabled placeholder="tryouts@yourclub.ca" />
        </label>
        <p className={shared.formHint}>{saveError ?? 'Loading the address…'}</p>
      </div>
    );
  }

  if (!view.canChange) {
    // H9 — an assistant with tryouts access reads it.
    return (
      <div className={styles.body}>
        <p className={shared.formHint}>{ONLY_A_HEAD_COACH_CHANGES}</p>
      </div>
    );
  }

  const nudge = !refusal ? tryoutContactNudge(draft.trim()) : null;
  const anotherSetIt = !!view.email && !view.setByYou;
  return (
    <div className={styles.body}>
      <label className={shared.field}>
        <span className={shared.label}>Address for tryout questions</span>
        <input
          className={`${shared.input} ${styles.field}`}
          type="email"
          inputMode="email"
          autoComplete="off"
          placeholder="tryouts@yourclub.ca"
          value={draft}
          onChange={e => { setDraft(e.target.value); setRefusal(null); }}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }}
          disabled={saving}
          aria-invalid={!!refusal}
          aria-describedby="tryout-questions-hint"
        />
      </label>
      {refusal && <p className={styles.held} role="alert">{refusal}</p>}
      <p id="tryout-questions-hint" className={shared.formHint}>{TRYOUT_CONTACT_HINT}</p>
      {nudge && <p className={shared.formHint}>{nudge}</p>}
      {anotherSetIt && <p className={shared.formHint}>{ANOTHER_HEAD_SET_IT}</p>}
      {view.email && (
        <button type="button" className={`${shared.linkBtnAccent} ${styles.remove}`} onClick={() => send('DELETE')} disabled={saving}>
          Remove and use the club&rsquo;s address
        </button>
      )}
      {/* A refused address is never "Saved", and its red reason already says what happened: the pill leaves while the
          refusal stands (only an error persists) and comes back at rest for the next save. */}
      {!refusal && (
        <SaveStatusPill
          saving={saving}
          dirty={false}
          error={saveError}
          onRetry={() => { const t = lastTry.current; if (t) void send(t.method, t.email); }}
        />
      )}
    </div>
  );
}
