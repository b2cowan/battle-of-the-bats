'use client';

import { useId, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import KitDialog, { DialogCancel } from '@/components/shared/KitDialog';
import PasswordInput from '@/components/auth/PasswordInput';
import { coachWarmAttr } from '@/lib/coach-warm-preview';
import styles from './security.module.css';

export type SecurityView = {
  on: boolean;
  /** A lost phone part-way replaced: the old authenticator is gone, the new one not finished. */
  replacing: boolean;
  onSince: string | null;
  /** Some seat covers the person (staff, or a club seat in its 14 days or past them): Turn off is absent. */
  covered: boolean;
  reason: string | null;
  graceNotice: { lead: string; by: string } | null;
  requiredNow: boolean;
  backupCodesLeft: number;
  hasPassword: boolean;
};

const SELF = '/account/security';
const setUpHref = (extra: string) => `/auth/two-step?${extra ? `${extra}&` : ''}next=${encodeURIComponent(SELF)}`;

type Ask = null | 'turnOff' | 'signOutOthers' | 'password';

/**
 * The Sign-in & security section's cards (drawings tab 5). The server already decided every state; this only runs the
 * actions. Turn off, Change password and the set-up links can be refused for a stale code: the one window
 * (components/shared/CodeAgainProvider.tsx) asks and sends the press again, so nothing here handles that refusal.
 */
export default function SecurityClient({ view }: { view: SecurityView }) {
  const router = useRouter();
  const [ask, setAsk] = useState<Ask>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null);

  async function run(url: string, body: unknown, done: string): Promise<boolean> {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body ?? {}),
      });
      const data = await res.json().catch(() => ({})) as { error?: string; othersSignedOut?: boolean; signedBackIn?: boolean; needsCode?: boolean };
      if (!res.ok) {
        setNotice({ tone: 'bad', text: data.error ?? 'Something went wrong. Try again.' });
        return false;
      }
      // A new password ends every session; the server signs this device back in. When it could not, or the person
      // has two-step on (the new session is password-only), the page's own gate takes over after a refresh.
      if (data.signedBackIn === false) {
        setNotice({ tone: 'good', text: 'Your password is changed. Sign in again with the new one.' });
        router.refresh();
        return true;
      }
      if (data.needsCode) router.refresh();
      setNotice({ tone: 'good', text: data.othersSignedOut === false ? `${done} We couldn’t sign out your other devices: use “Sign out everywhere else”.` : done });
      return true;
    } catch {
      setNotice({ tone: 'bad', text: 'Something went wrong. Try again.' });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    if (await run('/api/auth/two-step/turn-off', {}, 'Two-step sign-in is off. Signing in asks only for your password.')) {
      setAsk(null);
      router.refresh();
    }
  }

  async function signOutOthers() {
    if (await run('/api/auth/sign-out-others', {}, 'Your other devices are signed out. This one stays signed in.')) setAsk(null);
  }

  return (
    <div className={styles.stack}>
      {view.graceNotice && (
        <div className={styles.callout} role="status">
          <strong>{view.graceNotice.lead}</strong>
          <span>Set it up by {view.graceNotice.by}. After that, you’ll be asked to set it up before you can open the club’s pages.</span>
        </div>
      )}

      {notice && !(ask === 'password' && notice.tone === 'bad') && <p className={notice.tone === 'good' ? styles.noticeGood : styles.noticeBad} role={notice.tone === 'good' ? 'status' : 'alert'}>{notice.text}</p>}

      <section className={styles.card} aria-labelledby="sec-two-step">
        <h3 id="sec-two-step" className={styles.head}>
          <span>Two-step sign-in</span>
          <span className={view.on ? styles.chipOn : styles.chipOff}>{view.on ? 'On' : 'Off'}</span>
        </h3>
        {view.on ? (
          <>
            <p className={styles.body}>
              {view.replacing
                ? 'You’re setting up a new phone. Until it’s finished, signing in asks for a backup code.'
                : <>{view.onSince ? `On since ${view.onSince}. ` : ''}Signing in asks for a code from your authenticator app.</>}
            </p>
            {view.covered && view.reason && <p className={styles.fine}>{view.reason}, so it can’t be turned off.</p>}
            <div className={styles.acts}>
              <Link href={setUpHref('replace=1')} className={styles.btn}>{view.replacing ? 'Finish setting up my new phone' : 'Set up a new phone'}</Link>
              <Link href={setUpHref('step=codes')} className={styles.btn}>New backup codes</Link>
              {!view.covered && <button type="button" className={styles.btn} onClick={() => setAsk('turnOff')}>Turn off</button>}
            </div>
            <p className={styles.fine}>
              {view.backupCodesLeft} of 10 backup codes left. New codes replace the old ones.
              {!view.covered && ' Turning it off, getting new codes or setting up a new phone asks for a code first.'}
            </p>
          </>
        ) : (
          <>
            {!(view.graceNotice || view.requiredNow) && (
              <p className={styles.body}>Turn it on so a stolen password isn’t enough to sign in as you.</p>
            )}
            <div className={styles.acts}>
              <Link href={setUpHref('')} className={styles.btnLime}>Turn on two-step sign-in</Link>
            </div>
          </>
        )}
      </section>

      <section className={styles.card} aria-labelledby="sec-devices">
        <h3 id="sec-devices" className={styles.head}>Signed in on other devices</h3>
        <p className={`${styles.body} ${styles.wideOnly}`}>Sign out everywhere except this device, if a phone or computer is lost or shared.</p>
        <div className={styles.acts}>
          <button type="button" className={styles.btn} onClick={() => setAsk('signOutOthers')}>Sign out everywhere else</button>
        </div>
      </section>

      {view.hasPassword && (
        <section className={styles.card} aria-labelledby="sec-password">
          <h3 id="sec-password" className={styles.head}>Password</h3>
          <p className={styles.body}>Change the password you sign in with.</p>
          <div className={styles.acts}>
            <button type="button" className={styles.btn} onClick={() => setAsk('password')}>Change password</button>
          </div>
        </section>
      )}

      {/* The windows wear the portal's warm palette: it hangs off this marker, and the account page's own shell only
          carries the --home-* tokens, so without it the window paints in the dark default (the Feedback window's fix). */}
      <div style={{ display: 'contents' }} {...coachWarmAttr}>
      {ask === 'turnOff' && (
        <KitDialog
          kind="question"
          title="Turn off two-step sign-in?"
          busy={busy}
          onClose={() => setAsk(null)}
          footer={(
            <>
              <DialogCancel />
              <button type="button" className="btn btn-danger" disabled={busy} onClick={() => void turnOff()}>
                {busy ? 'Turning off…' : 'Turn off'}
              </button>
            </>
          )}
        >
          <p className={styles.dialogText}>
            Signing in will ask only for your password. Your authenticator app and your backup codes stop working.
          </p>
        </KitDialog>
      )}

      {ask === 'signOutOthers' && (
        <KitDialog
          kind="question"
          title="Sign out everywhere else?"
          busy={busy}
          onClose={() => setAsk(null)}
          footer={(
            <>
              <DialogCancel />
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void signOutOthers()}>
                {busy ? 'Signing out…' : 'Sign out everywhere else'}
              </button>
            </>
          )}
        >
          <p className={styles.dialogText}>Every other phone, tablet and computer signed in to this account is signed out. This one stays signed in.</p>
        </KitDialog>
      )}

      {ask === 'password' && <ChangePasswordWindow busy={busy} onClose={() => setAsk(null)} onSave={async (current, next) => {
        if (await run('/api/auth/password', { current, next }, 'Your password is changed. Your other devices were signed out.')) setAsk(null);
      }} error={notice?.tone === 'bad' ? notice.text : null} />}
      </div>
    </div>
  );
}

/** Change password (ask 7): the current one, then the new one. A code is asked too when two-step is on (the window). */
function ChangePasswordWindow({ busy, onClose, onSave, error }: {
  busy: boolean;
  onClose: () => void;
  onSave: (current: string, next: string) => Promise<void>;
  error: string | null;
}) {
  const id = useId();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  return (
    <KitDialog
      kind="form"
      title="Change password"
      busy={busy}
      dirty={current !== '' || next !== ''}
      onClose={onClose}
      footer={(
        <>
          <DialogCancel />
          <button type="submit" form={id} className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save password'}</button>
        </>
      )}
    >
      <form id={id} className={styles.form} onSubmit={event => { event.preventDefault(); if (current && next) void onSave(current, next); }}>
        {error && <p className={styles.noticeBad} role="alert">{error}</p>}
        <label className={styles.field} htmlFor={`${id}-current`}>
          <span className={styles.label}>Current password</span>
          <PasswordInput id={`${id}-current`} className={styles.input} value={current} onChange={e => setCurrent(e.target.value)} autoComplete="current-password" required />
        </label>
        <label className={styles.field} htmlFor={`${id}-next`}>
          <span className={styles.label}>New password</span>
          <PasswordInput id={`${id}-next`} className={styles.input} value={next} onChange={e => setNext(e.target.value)} autoComplete="new-password" minLength={8} required />
          <span className={styles.fine}>At least 8 characters. Saving signs out your other devices.</span>
        </label>
      </form>
    </KitDialog>
  );
}
