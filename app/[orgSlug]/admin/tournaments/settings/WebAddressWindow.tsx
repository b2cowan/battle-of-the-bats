'use client';
/**
 * THE WEB ADDRESS'S WINDOW — Settings & access's fourth door (Tournament admin redesign Stage 5 addendum, A75, owner
 * 2026-10-12). The workspace's address is the first part of every link (fieldlogichq.ca/<address>/…); it was changed
 * from one event's settings, where it never belonged. The owner changes it here on Tournament and Tournament Plus; League
 * and Club keep it in the organization's Settings, so this door is absent there.
 *
 *   the form   Address, with "fieldlogichq.ca/" before it; the whole link under it (this event's, so the change reads);
 *              today's hint; the amber line once it differs; Cancel and the lime Change the address
 *   asking     Change the address asks once more, naming both addresses (nothing redirects to the new one), in the
 *              kit's question window over the form
 *   the move   the same server call and validation as before (PATCH /api/admin/org-settings, owner-only); on success
 *              the admin moves to the new address's Settings & access — with the window still open, as KitDialog's
 *              header requires of a button that closes a window and navigates
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import KitDialog from '@/components/admin/kit/club/KitDialog';
import { Callout } from '@/components/admin/kit/club/RepKit';
import ck from '@/components/admin/kit/club/ClubKit.module.css';
import { WEB_ADDRESS_WORDS as W } from '@/lib/web-address-words';
import { cleanSlugInput, isSlug } from '@/lib/slug';
import { useClubPublicOrigin } from '@/lib/use-club-public-origin';
import styles from './settings-access.module.css';

export default function WebAddressWindow({ orgName, current, eventSlug, onClose }: {
  orgName: string;
  /** The address today. */
  current: string;
  /** The event on screen, so the whole link under the field reads as one the owner knows. */
  eventSlug?: string | null;
  onClose: () => void;
}) {
  const router = useRouter();
  // The club's own web address while one is handed out (Club Tier 4e): the words then say its links keep working.
  const publicOrigin = useClubPublicOrigin(current);
  const ownAddress = publicOrigin && typeof window !== 'undefined' && publicOrigin !== window.location.origin
    ? publicOrigin.replace(/^https?:\/\//, '')
    : null;
  const [value, setValue] = useState(current);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const next = value.trim().toLowerCase();
  const changed = next !== current;
  const valid = next.length > 0 && isSlug(next);

  async function change() {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/org-settings?orgSlug=${encodeURIComponent(current)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: next }),
      });
      const data = await res.json().catch(() => ({})) as { slug?: string };
      if (!res.ok || !data.slug) {
        setError(res.status === 409 ? W.taken : W.failed);
        setAsking(false);
        setBusy(false);
        return;
      }
      // The admin's address holds the old one — move to the new one's Settings & access, the window still open.
      router.push(`/${data.slug}/admin/tournaments/settings`);
      router.refresh();
    } catch {
      setError(W.failed);
      setAsking(false);
      setBusy(false);
    }
  }

  return (
    <>
      <KitDialog
        kind="form"
        title={W.name}
        identity={W.identity(orgName)}
        onClose={onClose}
        busy={busy}
        footer={(
          <>
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>{W.cancel}</button>
            <button type="button" className="btn btn-lime" onClick={() => setAsking(true)} disabled={busy || !changed || !valid}
              aria-haspopup="dialog">
              {W.change}
            </button>
          </>
        )}
      >
        <div className={ck.field}>
          <label className={ck.label} htmlFor="web-address">{W.field}<span className={ck.required} aria-hidden>*</span></label>
          <div className={styles.addressBox}>
            <span className={styles.addressPrefix} aria-hidden>fieldlogichq.ca/</span>
            <input
              id="web-address"
              className={styles.addressInput}
              type="text"
              value={value}
              onChange={e => { setValue(cleanSlugInput(e.target.value)); setError(''); }}
              autoComplete="off"
              spellCheck={false}
              required
              maxLength={60}
            />
          </div>
          <p className={styles.addressPreview}>
            fieldlogichq.ca/<b>{next || '…'}</b>{eventSlug ? `/${eventSlug}` : ''}
          </p>
          <p className={ck.hint}>{ownAddress ? W.hintOwn(ownAddress) : W.hint}</p>
          {value.length > 0 && !valid && <p className={styles.addressBad}>{W.invalid}</p>}
          {error && <p className={styles.addressBad} role="alert">{error}</p>}
        </div>
        {changed && valid && (
          <Callout tone="warn" flush icon={<AlertTriangle size={16} aria-hidden />}>{W.warning}</Callout>
        )}
      </KitDialog>

      {asking && (
        <KitDialog
          kind="question"
          title={W.askTitle}
          onClose={() => { if (!busy) setAsking(false); }}
          busy={busy}
          footer={(
            <>
              <button type="button" className="btn btn-outline" onClick={() => setAsking(false)} disabled={busy}>{W.cancel}</button>
              <button type="button" className="btn btn-lime" onClick={() => void change()} disabled={busy}>{W.change}</button>
            </>
          )}
        >
          <p>{ownAddress ? W.askBodyOwn(current, next, ownAddress) : W.askBody(current, next)}</p>
        </KitDialog>
      )}
    </>
  );
}
