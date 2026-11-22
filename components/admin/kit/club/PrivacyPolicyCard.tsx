'use client';
/**
 * SETTINGS › "Your privacy policy" (Board Ready 4.P, owner 2026-11-21). The web address of the club's own privacy policy:
 * the house-league sign-up form, the tryout sign-up's consent line and the guardian accept page show "{club}'s privacy
 * policy" while it is set, and nothing while it is empty.
 *
 * ⚖ The OWNER'S AND AN ADMIN'S (owner ruling 2026-11-21, "Owner and admin"): the one Settings card an admin can change.
 * `/api/admin/org-settings/privacy-policy` refuses every other seat. It saves by itself (its own Save), apart from the
 * name and web address above, which stay the owner's.
 *
 * The field shows what families are shown (the route reads through `getOrgPrivacyPolicyHref`), so an unsafe value stored
 * before the setting existed reads as empty. The check before Save is the seam's own (`parsePrivacyPolicyInput`); the
 * server checks again. Words: `PRIVACY_POLICY_WORDS`.
 */
import { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { parsePrivacyPolicyInput, PRIVACY_POLICY_WORDS as W } from '@/lib/privacy-policy';
import { SavePill } from './RepKit';
import ck from './ClubKit.module.css';
import styles from './Settings.module.css';

export type PrivacyPolicyView = { url: string | null };

/** The card's read, as the PAGE loads it (with the other cards, so it appears with everything else). A failed read is
 *  null: the card then says it didn't load, rather than show an empty field that would read as "no link". */
export function loadPrivacyPolicy(orgQuery: string): Promise<PrivacyPolicyView | null> {
  return fetch(`/api/admin/org-settings/privacy-policy${orgQuery}`)
    .then(r => (r.ok ? r.json() : Promise.reject(new Error())))
    .then((d: { url?: unknown }) => ({ url: typeof d.url === 'string' ? d.url : null }))
    .catch(() => null);
}

export default function PrivacyPolicyCard({ orgQuery, initial }: { orgQuery: string; initial: PrivacyPolicyView | null }) {
  const [saved, setSaved] = useState<string | null>(initial?.url ?? null);
  const [draft, setDraft] = useState(initial?.url ?? '');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // A failed read says so in the card's place (never an empty field, which would read as "no link").
  if (!initial) {
    return (
      <section className={styles.card} aria-labelledby="settings-privacy">
        <h2 id="settings-privacy" className={styles.cardTitle}>{W.title}</h2>
        <p className={ck.hint} role="alert">{W.loadFailed}</p>
      </section>
    );
  }

  const dirty = draft.trim() !== (saved ?? '');

  async function save() {
    if (saving) return;
    // Every press starts clean: a Retry after the draft went back to the saved value clears the old failure.
    setSaveError(null);
    if (!dirty) return;
    const parsed = parsePrivacyPolicyInput(draft);
    if (!parsed.ok) { setFieldError(parsed.error); return; }
    setFieldError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/org-settings/privacy-policy${orgQuery}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: parsed.value }),
      });
      const body = await res.json().catch(() => ({})) as { url?: unknown; error?: unknown };
      if (res.status === 400 && typeof body.error === 'string') { setFieldError(body.error); return; }
      if (!res.ok) throw new Error();
      const url = typeof body.url === 'string' ? body.url : null;
      setSaved(url);
      setDraft(url ?? '');
    } catch {
      setSaveError('Couldn’t save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={styles.card} aria-labelledby="settings-privacy">
      <h2 id="settings-privacy" className={styles.cardTitle}>{W.title}</h2>
      <div className={ck.field}>
        <label className={ck.label} htmlFor="settings-privacy-url">{W.label}</label>
        <input
          id="settings-privacy-url"
          className={ck.input}
          type="url"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          placeholder="https://"
          value={draft}
          readOnly={saving}
          aria-invalid={fieldError ? true : undefined}
          aria-describedby={fieldError ? 'settings-privacy-error' : 'settings-privacy-hint'}
          onChange={e => { setDraft(e.target.value); setFieldError(null); setSaveError(null); }}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void save(); } }}
        />
        {fieldError ? (
          <span className={styles.fieldRefuse} id="settings-privacy-error" role="alert">
            <AlertCircle size={14} aria-hidden className={styles.fieldRefuseIcon} /><span>{fieldError}</span>
          </span>
        ) : (
          <p className={ck.hint} id="settings-privacy-hint">{W.hint}</p>
        )}
      </div>
      <div className={styles.cardSave}>
        <button type="button" className="btn btn-lime" onClick={() => void save()} disabled={saving || !dirty}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
      {/* `dirty` is the truth, so a refused save reads "Unsaved changes", never "Saved". */}
      <SavePill saving={saving} dirty={dirty} error={saveError} onRetry={() => void save()} />
    </section>
  );
}
