'use client';
/**
 * THE VISIBILITY ROW — whether the club's site is online and whether the directory lists it (Public site builder, ruled
 * 2026-10-21; moved in from Settings with the same switches, sentences and "Take it offline?").
 *
 * ⚖ The OWNER's alone (Option A). The owner gets the two switch rows; an admin reads the same two facts as text, with
 * one sentence saying who changes them — never a greyed switch (absent beats disabled). The server says the same: the
 * org-settings route refuses an admin the switch and the listing (lib/public-site-access.ts). The web address is not
 * here any more: it moved into its own row just above (Club Tier Stage 4e, ask 1), which holds both the FieldLogicHQ
 * address and the club's own, so the address is said in one place.
 */
import { useState } from 'react';
import KitDialog from '@/components/admin/kit/club/KitDialog';
import ck from '@/components/admin/kit/club/ClubKit.module.css';
import { PUBLIC_SITE_WORDS as W } from '@/lib/public-site-words';
import styles from './public-site.module.css';

export default function VisibilityPanel({ clubName, noun, address, on, listed, isOwner, onSwitch }: {
  clubName: string;
  /** "club", "league" or "organization": the directory's name in the switch's label. */
  noun: string;
  /** The site's address as families type it, without the scheme. */
  address: string;
  on: boolean;
  /** The stored directory choice (it lists the club only while the site is on). */
  listed: boolean;
  isOwner: boolean;
  /** Saves one switch; resolves once the org has been read again. Throws with the reason when refused. */
  onSwitch: (body: { isPublic?: boolean; isDiscoverable?: boolean }) => Promise<void>;
}) {
  const [busy, setBusy] = useState<'site' | 'directory' | null>(null);
  const [askOffline, setAskOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function flip(which: 'site' | 'directory', value: boolean) {
    setBusy(which);
    setError(null);
    try {
      await onSwitch(which === 'site' ? { isPublic: value } : { isDiscoverable: value });
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : W.switchFailed);
    } finally {
      setBusy(null);
      setAskOffline(false);
    }
  }

  const shownListed = on && listed;

  if (!isOwner) {
    return (
      <>
        <dl className={styles.facts}>
          <div><dt>{W.siteSwitch}</dt><dd>{on ? W.onlineWord : W.offlineWord}</dd></div>
          <div><dt>{W.directorySwitch(noun)}</dt><dd>{shownListed ? W.yes : W.no}</dd></div>
        </dl>
        <p className={ck.hint}>{W.visibilityAdmin}</p>
      </>
    );
  }

  return (
    <div>
      <div className={ck.switchRow}>
        <div className={ck.switchText}>
          <span className={ck.switchName} id="site-switch-label">{W.siteSwitch}</span>
          <p className={ck.hint}>{on ? W.siteOnHint(clubName, address) : W.siteOffHint(clubName, address)}</p>
        </div>
        <button type="button" role="switch" aria-checked={on} aria-labelledby="site-switch-label" className={ck.switch}
          disabled={busy !== null} onClick={() => (on ? setAskOffline(true) : void flip('site', true))} />
      </div>
      <div className={`${ck.switchRow}${on ? '' : ` ${ck.switchRowOff}`}`}>
        <div className={ck.switchText}>
          <span className={ck.switchName} id="site-switch-directory-label">{W.directorySwitch(noun)}</span>
          <p className={ck.hint}>{on ? W.directoryHint(clubName) : W.directoryOffHint}</p>
        </div>
        <button type="button" role="switch" aria-checked={shownListed} aria-labelledby="site-switch-directory-label" className={ck.switch}
          disabled={!on || busy !== null} onClick={() => void flip('directory', !listed)} />
      </div>
      {error && <p className={styles.fieldError} role="alert">{error}</p>}

      {askOffline && (
        <KitDialog
          kind="question"
          title={W.offlineAsk(clubName)}
          onClose={() => setAskOffline(false)}
          busy={busy === 'site'}
          footer={
            <>
              <button type="button" className="btn btn-outline" onClick={() => setAskOffline(false)} disabled={busy === 'site'} data-autofocus="">{W.keepOnline}</button>
              <button type="button" className="btn btn-danger" onClick={() => void flip('site', false)} disabled={busy === 'site'}>
                {busy === 'site' ? W.takingOffline : W.takeOffline}
              </button>
            </>
          }
        >
          <p>{W.offlineAskBody}</p>
        </KitDialog>
      )}
    </div>
  );
}
