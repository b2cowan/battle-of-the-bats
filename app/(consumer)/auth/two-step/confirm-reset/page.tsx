'use client';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { StartColumn, StartFoot, StartHead, accountForm } from '@/components/auth/AccountForm';
import LoadingState from '@/components/shared/LoadingState';
import { formatInOrgZone } from '@/lib/timezone';
import { formatTime } from '@/lib/utils';

/**
 * CONFIRM THE RESET OF YOUR TWO-STEP SIGN-IN (Board Ready · two-step sign-in, Part 3; drawings tab 7). The page the link in
 * support's email opens. Nothing happens on opening it: the button POSTs, so an email scanner that fetches the link
 * confirms nothing. No sign-in: the person has lost their phone, and the link in their inbox is the proof asked for.
 * Words are drafts for Part 4's copy pass.
 */

function whenWords(iso: string): string {
  const day = formatInOrgZone(iso, { month: 'long', day: 'numeric' });
  const clock = formatInOrgZone(iso, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  return `${day} at ${formatTime(clock)}`;
}

function ConfirmReset() {
  const token = useSearchParams().get('token') ?? '';
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setFailed(null);
    try {
      const res = await fetch('/api/auth/two-step/confirm-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json().catch(() => ({})) as { runsAt?: string; error?: string };
      if (!res.ok || !data.runsAt) { setFailed(data.error ?? 'That didn’t go through. Try again in a moment.'); return; }
      setDone(data.runsAt);
    } catch {
      setFailed('That didn’t go through. Try again in a moment.');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <StartColumn>
        <StartHead title="The reset is confirmed" sub={`Your two-step sign-in will be reset on ${whenWords(done)}.`} />
        <div className={accountForm.form}>
          <div className={accountForm.callout}>
            <strong>Found your phone?</strong>{' '}
            Sign in with a code from your app before then, and the reset is cancelled.
          </div>
          <p className={accountForm.hint}>
            After the reset, sign in with your password and set up two-step sign-in on your new phone.
          </p>
          <StartFoot>
            <Link href="/auth/login" className={accountForm.textBtn}>Go to sign in</Link>
          </StartFoot>
        </div>
      </StartColumn>
    );
  }

  return (
    <StartColumn>
      <StartHead
        title="Confirm the reset of your two-step sign-in"
        sub="You asked FieldLogicHQ support to reset two-step sign-in on your account."
      />
      <div className={accountForm.form}>
        <p className={accountForm.hint}>
          Once you confirm, the reset happens 24 hours later. If you own a club, we tell its other admins and treasurer
          first. Signing in with a code from your app, or a backup code, during that time cancels it.
        </p>
        {failed && <div className={accountForm.noticeError} role="alert">{failed}</div>}
        <button type="button" className={accountForm.primary} onClick={() => void confirm()} disabled={busy || !token} id="two-step-confirm-reset">
          {busy ? 'Confirming…' : 'Confirm the reset'}
        </button>
        <p className={accountForm.hint}>Didn’t ask for this? Close this page: nothing changes.</p>
      </div>
    </StartColumn>
  );
}

export default function ConfirmResetPage() {
  return (
    <Suspense fallback={<StartColumn><LoadingState label="Loading…" /></StartColumn>}>
      <ConfirmReset />
    </Suspense>
  );
}
