'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import BrandLockup from '@/components/shared/BrandLockup';
import { StartFoot, StartHead, accountForm } from '@/components/auth/AccountForm';
import { signOut } from '@/lib/auth';
import { ACCEPTANCE_WORDS, SCREEN_WORDS as W } from '@/lib/legal-acceptance-rules';
import { PRIVACY_TITLE, TERMS_TITLE } from '@/lib/legal-words';
import type { CancelDoorPlan } from '@/lib/legal-acceptance-plans';
import { useLegalLinks } from './LegalLinksProvider';
import TermsTickRow, { useTermsTick } from './TermsTickRow';
import styles from './TermsAcceptScreen.module.css';

/**
 * THE SIGN-IN SCREEN (GST/HST Stage 6 step 6.3, Chunk B, ruling R3; drawings tab 4, asks 3A, 7A, 8A, 9A). Rendered by
 * `TermsAcceptGate` INSTEAD of a signed-in shell. The one account step's column on the portal's paper, FieldLogicHQ's lockup
 * above the head (the Terms are ours, not the club's), §20 (2)'s words, the box, Continue off until it is ticked, and the
 * foot row with the account and Sign out — always. No nav and no legal foot line (the line and the box already link both).
 *
 *   · Saving: the button reads "Saving…" and stays off.
 *   · A failed save (5a): the box stays ticked; the line sits above the button; Continue comes back.
 *   · The Terms moved while it was open: §20's line, the box un-ticked, the page re-reads (the links then open the new words).
 *   · "We've updated our Terms" + a paid plan (5e): the cancel door under the box, reaching a billing page the gate lets
 *     through without agreeing. Several plans: a short list of them.
 */
export default function TermsAcceptScreen({ email, updated, plans, fixedWarm }: {
  email: string | null;
  /** The person agreed to an earlier published version: "We've updated our Terms". */
  updated: boolean;
  /** The paid plans they own — the cancel door's destinations (only ever given on "updated"). */
  plans: CancelDoorPlan[];
  fixedWarm: boolean;
}) {
  const router = useRouter();
  const links = useLegalLinks();
  const tick = useTermsTick();
  const [phase, setPhase] = useState<'idle' | 'saving' | 'failed' | 'changed'>('idle');
  const [listOpen, setListOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const words = updated ? W.updated : W.published;
  const saving = phase === 'saving';
  const doorPlans = updated ? plans : [];

  async function accept(e: React.FormEvent) {
    e.preventDefault();
    if (!tick.ticked || saving) return;
    setPhase('saving');
    try {
      const res = await fetch('/api/legal/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ termsVersion: tick.fields.termsVersion }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        // The shell takes over at the same address: the layout reads the new acceptance.
        router.refresh();
        return;
      }
      if ((data as { code?: unknown }).code === 'terms_changed') {
        tick.refusal(data); // un-ticks, and the next tick sends the version now current
        setPhase('changed');
        router.refresh(); // the page re-reads: the links open the new words
        return;
      }
      setPhase('failed');
    } catch {
      setPhase('failed');
    }
  }

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      // A full load, so every client cache and context resets (the wall's sign-out does the same).
      window.location.assign('/discover');
    }
  }

  const link = (href: string | undefined, label: string) =>
    href ? <a className={styles.inlineLink} href={href} target="_blank" rel="noopener noreferrer">{label}</a> : label;
  const sub = words.line.map((part, i) =>
    part === TERMS_TITLE ? <span key={i}>{link(links?.termsHref, part)}</span>
      : part === PRIVACY_TITLE ? <span key={i}>{link(links?.privacyHref, part)}</span>
      : <span key={i}>{part}</span>);

  return (
    <div className={fixedWarm ? styles.paperWarm : styles.paper} data-terms-screen>
      <div className={accountForm.column}>
        <div className={styles.mark}><BrandLockup href={null} tone={fixedWarm ? 'warm' : 'follow'} size={18} /></div>
        <StartHead title={words.title} sub={sub} />

        <form className={accountForm.form} onSubmit={accept}>
          <TermsTickRow tick={tick} id="terms-screen-box" disabled={saving} />

          {phase === 'failed' && <p className={accountForm.error} role="alert">{W.saveFailed}</p>}
          {phase === 'changed' && <p className={accountForm.noticeWarn} role="status">{ACCEPTANCE_WORDS.refuseChangedWindow}</p>}

          {doorPlans.length > 0 && (
            <div className={styles.door}>
              <p className={styles.doorLine}>
                {W.cancelDoor[0]}
                {doorPlans.length === 1 ? (
                  <a className={styles.doorLink} href={doorPlans[0].billingHref}>{W.cancelDoor[1]}</a>
                ) : (
                  <button type="button" className={styles.doorLink} aria-expanded={listOpen} onClick={() => setListOpen(o => !o)}>
                    {W.cancelDoor[1]}
                  </button>
                )}
                {W.cancelDoor[2]}
              </p>
              {doorPlans.length > 1 && listOpen && (
                <ul className={styles.doorList}>
                  {doorPlans.map(p => (
                    <li key={p.billingHref}><a className={styles.doorLink} href={p.billingHref}>{p.name}</a></li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <button type="submit" className={accountForm.primary} disabled={!tick.ticked || saving}>
            {saving ? W.saving : W.continue}
          </button>
        </form>

        <StartFoot>
          {email && <p>{W.signedInAs} <b className={styles.email}>{email}</b></p>}
          <p>
            <button type="button" className={accountForm.footLink} onClick={handleSignOut} disabled={signingOut}>{W.signOut}</button>
          </p>
        </StartFoot>
      </div>
    </div>
  );
}
