'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase-browser';
import { twoStepStepUrl } from '@/lib/two-step-paths';
import { Field, StartFoot, StartHead, accountForm } from './AccountForm';

/**
 * THE CODE STEP (Board Ready · two-step sign-in, drawings tab 3). A state of the one shared sign-in page, after the
 * password, for a person who has turned two-step on; the password-reset page shows it too, before the new password
 * (a reset never skips it). Twelve doors sign people in and every one hands off here (lib/auth.ts).
 *
 *   code        "Enter your code": one numeric field (one-time-code autofill, never six boxes). A wrong code paints the
 *               red notice only, as the wrong password does.
 *   backup      "Use a backup code": one of the ten saved at set-up; ours, checked on the server.
 *   afterBackup "You're in": how many are left, and the offer to set up a new phone.
 *
 * "Use a different account" signs out THIS device only.
 *
 *   lostPhone   "Lost your phone?" (Part 2, drawings tab 4): a backup code first, then the club or support. Which version
 *               is decided by the server from the account's seats after the password matched, and it never names the
 *               club or anyone in it. The support address is shown as copyable text, not only a mail link.
 */

type Mode = 'code' | 'backup' | 'afterBackup' | 'lostPhone';
type LostPhone = { version: 'club' | 'support'; supportEmail: string } | 'loading' | 'failed';

/**
 * A code was accepted: our server hears of it (Part 3, tab 7 — signing in with a real code cancels a waiting support reset;
 * the route reads the session's own proof). Best effort: it never holds up the sign-in.
 */
async function tellProved(): Promise<void> {
  // Not awaited by the sign-in (keepalive outlives the navigation that follows): it never holds the next page up.
  try { void fetch('/api/auth/two-step/proved', { method: 'POST', keepalive: true }).catch(() => {}); } catch { /* the sign-in goes on */ }
}

export default function TwoStepCodeStep({ email, next, onDone, onDifferentAccount, showDifferentAccount = true, offerNewPhone = true }: {
  email: string | null;
  /** Where the person was going; carried into "Set up my new phone" and new backup codes. */
  next: string | null;
  /** The code (or "I still have it") is done: go on. */
  onDone: () => void | Promise<void>;
  /** After this device signed out: back to the password. */
  onDifferentAccount?: () => void;
  showDifferentAccount?: boolean;
  /** "Set up my new phone" and "Get new backup codes" after a backup code. Off on the password reset: they would leave
   *  the reset before the new password is saved. */
  offerNewPhone?: boolean;
}) {
  const [mode, setMode] = useState<Mode>('code');
  const [code, setCode] = useState('');
  const [backup, setBackup] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState<number | null>(null);
  const [lost, setLost] = useState<LostPhone>('loading');
  const [copied, setCopied] = useState(false);

  async function openLostPhone() {
    setMode('lostPhone');
    setError(null);
    setLost('loading');
    try {
      const res = await fetch('/api/auth/two-step/lost-phone');
      const data = await res.json().catch(() => null) as { version?: 'club' | 'support'; supportEmail?: string } | null;
      setLost(res.ok && data?.version && data.supportEmail ? { version: data.version, supportEmail: data.supportEmail } : 'failed');
    } catch {
      setLost('failed');
    }
  }

  async function copyAddress(address: string) {
    try { await navigator.clipboard.writeText(address); setCopied(true); window.setTimeout(() => setCopied(false), 2000); } catch { /* the address is on screen to type */ }
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const digits = code.replace(/\s+/g, '');
    if (!/^\d{6}$/.test(digits)) { setError('wrong'); return; }
    setBusy(true);
    try {
      const supabase = createClient();
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const factor = factors?.totp?.find(f => f.status === 'verified');
      // No authenticator to check against: the person is replacing a lost phone. A backup code is the way in.
      if (!factor) { setMode('backup'); setError('noApp'); setBusy(false); return; }
      const { error: vErr } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: digits });
      if (vErr) {
        setError(vErr.status === 429 ? 'too_many' : 'wrong');
        setBusy(false);
        return;
      }
      await tellProved();
      await onDone();
    } catch {
      setError('unavailable');
      setBusy(false);
    }
  }

  async function submitBackup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/auth/two-step/backup-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: backup }),
      });
      const data = await res.json().catch(() => ({})) as { left?: number; code?: string };
      if (!res.ok) {
        setError(res.status === 429 ? 'too_many' : data.code === 'wrong_code' ? 'wrongBackup' : 'unavailable');
        setBusy(false);
        return;
      }
      setLeft(data.left ?? 0);
      await tellProved();
      setMode('afterBackup');
      setBusy(false);
    } catch {
      setError('unavailable');
      setBusy(false);
    }
  }

  async function differentAccount() {
    setBusy(true);
    // This device only: another device of the same person stays signed in.
    await createClient().auth.signOut({ scope: 'local' });
    setBusy(false);
    onDifferentAccount?.();
  }

  const notice = error === 'wrong' ? (
    <div className={accountForm.noticeError} role="alert">
      <strong>That code didn’t work.</strong>{' '}
      The codes change every 30 seconds. Type the one showing now.
    </div>
  ) : error === 'wrongBackup' ? (
    <div className={accountForm.noticeError} role="alert">
      <strong>That backup code didn’t work.</strong>{' '}
      Each code works once. Check it against the ones you saved.
    </div>
  ) : error === 'noApp' ? (
    <div className={accountForm.noticeWarn} role="status">
      <strong>Your old phone was removed.</strong>{' '}
      You started setting up a new one. Use a backup code, then finish setting up the new phone.
    </div>
  ) : error === 'too_many' ? (
    <div className={accountForm.noticeWarn} role="alert">
      <strong>Too many tries.</strong>{' '}
      Wait a few minutes, then try again.
    </div>
  ) : error === 'unavailable' ? (
    <div className={accountForm.noticeWarn} role="alert">
      <strong>We couldn’t check that code.</strong>{' '}
      Try again in a moment.
    </div>
  ) : null;

  const foot = showDifferentAccount && (
    <StartFoot legal>
      <p>
        Not you?{' '}
        <button type="button" className={accountForm.textBtn} onClick={differentAccount} disabled={busy}>
          Use a different account
        </button>
      </p>
    </StartFoot>
  );

  if (mode === 'lostPhone') {
    const address = lost !== 'loading' && lost !== 'failed' ? lost.supportEmail : null;
    const club = lost !== 'loading' && lost !== 'failed' && lost.version === 'club';
    const emailUs = address ? (
      <>
        Email{' '}
        <button type="button" className={accountForm.textBtn} onClick={() => void copyAddress(address)} aria-label={`Copy ${address}`}>
          <strong>{address}</strong>
        </button>
        {copied ? ' (copied)' : ''} from this account’s address.
      </>
    ) : null;
    return (
      <>
        <StartHead title="Lost your phone?" sub="Here’s how to get back in." />
        <div className={accountForm.form}>
          <div>
            <strong>Use a backup code</strong>
            <p className={accountForm.hint}>
              You saved ten when you set up two-step sign-in.{club ? ' One gets you in, and then you can set up your new phone.' : ''}
            </p>
          </div>
          <button type="button" className={accountForm.secondary} onClick={() => { setMode('backup'); setError(null); }}>
            Use a backup code
          </button>
          {lost === 'loading' ? null : lost === 'failed' ? (
            <div className={accountForm.noticeWarn} role="alert">
              <strong>We couldn’t load the rest of this page.</strong>{' '}
              Try again in a moment.
            </div>
          ) : club ? (
            <>
              <div>
                <strong>No codes? Ask your club</strong>
                <p className={accountForm.hint}>
                  Your club’s owner or an admin can reset your two-step sign-in. Then sign in with your password and set it up
                  on your new phone.
                </p>
              </div>
              <div>
                <strong>Are you the club’s owner?</strong>
                <p className={accountForm.hint}>
                  {emailUs} We confirm by email, tell your club’s other admins and treasurer that you asked, and reset it 24 hours
                  later.
                </p>
              </div>
            </>
          ) : (
            <div>
              <strong>No codes? Email us</strong>
              <p className={accountForm.hint}>
                {emailUs} We confirm by email and reset it 24 hours later.
              </p>
            </div>
          )}
          <StartFoot split>
            <button type="button" className={accountForm.textBtn} onClick={() => { setMode('code'); setError(null); }}>
              Back to the code
            </button>
            <span />
          </StartFoot>
        </div>
        {foot}
      </>
    );
  }

  if (mode === 'afterBackup') {
    const n = left ?? 0;
    return (
      <>
        <StartHead
          title="You’re in"
          sub={<>That code won’t work again. You have {n} backup {n === 1 ? 'code' : 'codes'} left.</>}
        />
        <div className={accountForm.form}>
          <div className={accountForm.callout}>
            <strong>Do you still have your authenticator app?</strong>{' '}
            If your phone is lost or replaced, set up the new one now.
          </div>
          {offerNewPhone ? (
            <>
              <a className={accountForm.primary} href={twoStepStepUrl('set_up', next, { replace: '1' })}>
                Set up my new phone
              </a>
              <button type="button" className={accountForm.secondary} onClick={() => onDone()} id="two-step-continue">
                I still have it, continue
              </button>
              <a className={accountForm.textBtn} href={twoStepStepUrl('set_up', next, { step: 'codes' })}>
                Get new backup codes
              </a>
            </>
          ) : (
            <button type="button" className={accountForm.primary} onClick={() => onDone()} id="two-step-continue">
              Continue to your new password
            </button>
          )}
        </div>
      </>
    );
  }

  if (mode === 'backup') {
    return (
      <>
        <StartHead title="Use a backup code" sub="Type one of the codes you saved when you set up two-step sign-in." />
        <form onSubmit={submitBackup} className={accountForm.form}>
          <Field id="two-step-backup" label="Backup code">
            <input
              id="two-step-backup"
              className={accountForm.input}
              value={backup}
              onChange={e => setBackup(e.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="XXXX-XXXX"
              aria-invalid={error === 'wrongBackup' ? true : undefined}
              autoFocus
            />
          </Field>
          {notice}
          <button type="submit" className={accountForm.primary} disabled={busy || backup.trim() === ''} id="two-step-backup-submit">
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
          <StartFoot split>
            <button type="button" className={accountForm.textBtn} onClick={() => { setMode('code'); setError(null); }}>
              Use my authenticator app
            </button>
            <button type="button" className={accountForm.textBtn} onClick={() => void openLostPhone()}>
              Lost your phone?
            </button>
          </StartFoot>
        </form>
        {foot}
      </>
    );
  }

  return (
    <>
      <StartHead
        title="Enter your code"
        sub={<>{email ? <>Signing in as <strong>{email}</strong>. </> : null}Type the 6-digit code from your authenticator app.</>}
      />
      <form onSubmit={submitCode} className={accountForm.form}>
        <Field id="two-step-code" label="Code">
          <input
            id="two-step-code"
            className={accountForm.input}
            value={code}
            onChange={e => setCode(e.target.value.replace(/[^\d\s]/g, '').slice(0, 7))}
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]*"
            placeholder="6-digit code"
            aria-invalid={error === 'wrong' ? true : undefined}
            autoFocus
          />
        </Field>
        {notice}
        <button type="submit" className={accountForm.primary} disabled={busy} id="two-step-submit">
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <StartFoot split>
          <button type="button" className={accountForm.textBtn} onClick={() => { setMode('backup'); setError(null); }}>
            Use a backup code
          </button>
          <button type="button" className={accountForm.textBtn} onClick={() => void openLostPhone()}>
            Lost your phone?
          </button>
        </StartFoot>
      </form>
      {foot}
    </>
  );
}
