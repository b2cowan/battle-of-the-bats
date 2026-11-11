'use client';
/**
 * SETTINGS › TWO-STEP SIGN-IN (Board Ready · two-step sign-in, Part 3; drawings tab 8 "The setting"). The club's two
 * switches, both off by default: "Require it for the board" and "Also require it for coaches".
 *
 *   - The OWNER changes them; an admin reads them (ruled 2026-11-11: admins reach Settings for this card alone, read-only).
 *   - The owner must have two-step on first (the route refuses, and the card says so before the press).
 *   - Turning one OFF asks first, in the house question window. The route then asks for the owner's code through the ONE
 *     "type your code again" window (components/shared/CodeAgainProvider.tsx answers the refusal and re-sends the press),
 *     and emails the club's other owners, admins and treasurer.
 *   - On, the row says since when and when everyone's 14 days end.
 *
 * Words are drafts for Part 4's copy pass.
 */
import { useState } from 'react';
import Link from 'next/link';
import { formatStoredDate } from '@/lib/timezone';
import { TWO_STEP_FRESH_CODE } from '@/lib/code-again';
import KitDialog from './KitDialog';
import ck from './ClubKit.module.css';
import styles from './Settings.module.css';

type Which = 'board' | 'coaches';
export type TwoStepSwitches = {
  board: { since: string | null };
  coaches: { since: string | null };
  graceDays: number;
  canChange: boolean;
  ownerHasTwoStep: boolean | null;
  isTestOrganization: boolean;
};

export function loadTwoStepSwitches(orgQuery: string): Promise<TwoStepSwitches | null> {
  return fetch(`/api/admin/org-settings/two-step${orgQuery}`)
    .then(r => (r.ok ? r.json() : Promise.reject(new Error())))
    .catch(() => null);
}

const ROWS: Record<Which, { label: string; who: string; askTitle: string; askBody: string }> = {
  board: {
    label: 'Require it for the board',
    who: 'Owner, admins, treasurer, registrars and league admins.',
    askTitle: 'Stop requiring two-step sign-in for the board?',
    askBody: 'People who have it on keep it. New board members won’t be asked to set it up. We’ll email your club’s other admins and treasurer that you turned it off.',
  },
  coaches: {
    label: 'Also require it for coaches',
    who: 'Every coach on your club’s teams.',
    askTitle: 'Stop requiring two-step sign-in for coaches?',
    askBody: 'Coaches who have it on keep it. New coaches won’t be asked to set it up. We’ll email your club’s other admins and treasurer that you turned it off.',
  },
};

function addDays(iso: string, days: number): string {
  return new Date(Date.parse(iso) + days * 86_400_000).toISOString();
}

export default function TwoStepRequirementCard({ orgQuery, initial }: { orgQuery: string; initial: TwoStepSwitches | null }) {
  const [data, setData] = useState<TwoStepSwitches | null>(initial);
  const [busy, setBusy] = useState<Which | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [askOff, setAskOff] = useState<Which | null>(null);

  if (!data) return null;

  async function change(which: Which, on: boolean) {
    setBusy(which);
    setError(null);
    try {
      const res = await fetch(`/api/admin/org-settings/two-step${orgQuery}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ which, on }),
      });
      const body = await res.json().catch(() => ({})) as Partial<TwoStepSwitches> & { error?: string; code?: string };
      // The one window asked for the code and the person said no: nothing changed.
      if (res.status === 401 && body.code === TWO_STEP_FRESH_CODE) { setError('Nothing changed. Turning it off needs your code.'); return; }
      if (!res.ok || !body.board) { setError(body.error ?? 'That didn’t save. Try again.'); return; }
      setData(body as TwoStepSwitches);
      setAskOff(null);
    } catch {
      setError('That didn’t save. Try again.');
    } finally {
      setBusy(null);
    }
  }

  const ownerNeedsOwn = data.canChange && data.ownerHasTwoStep === false;

  return (
    <section className={styles.card} aria-labelledby="settings-two-step">
      <h2 id="settings-two-step" className={styles.cardTitle}>Two-step sign-in</h2>
      <p className={ck.hint}>Anyone can turn on two-step sign-in for their own account. You can also make it required.</p>
      {!data.canChange && <p className={ck.hint}>Only the owner changes this.</p>}
      {data.isTestOrganization && <p className={ck.hint}>This is a test organization: a requirement here never applies.</p>}
      {ownerNeedsOwn && (
        <div className={`${ck.notice} ${ck.noticeWarn}`} role="status">
          <div className={ck.noticeBody}>
            Turn on two-step sign-in for your own account first. Then you can turn a requirement on or off.{' '}
            <Link href="/account/security">Open Sign-in &amp; security</Link>
          </div>
        </div>
      )}
      {(['board', 'coaches'] as const).map(which => {
        const row = ROWS[which];
        const since = data[which].since;
        const on = Boolean(since);
        const until = since ? addDays(since, data.graceDays) : null;
        // "Has until" is true for people already seated when it was turned on; someone who joins later gets their own 14 days.
        const stillRunning = until !== null && Date.parse(until) > Date.now();
        const sub = on && since && until
          ? stillRunning
            ? `${row.who} On since ${formatStoredDate(since, { withYear: false })}. Everyone already in a seat has until ${formatStoredDate(until, { withYear: false })}; anyone new gets ${data.graceDays} days.`
            : `${row.who} On since ${formatStoredDate(since, { withYear: false })}. Anyone new gets ${data.graceDays} days to set it up.`
          : `${row.who} They get ${data.graceDays} days to set it up.`;
        const disabled = !data.canChange || busy !== null || ownerNeedsOwn;
        return (
          <div className={ck.switchRow} key={which}>
            <div className={ck.switchText}>
              <span className={ck.switchName} id={`two-step-switch-${which}`}>{row.label}</span>
              <p className={ck.hint}>{sub}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={on}
              aria-labelledby={`two-step-switch-${which}`}
              className={ck.switch}
              disabled={disabled}
              id={`two-step-switch-${which}-btn`}
              onClick={() => { if (on) setAskOff(which); else void change(which, true); }}
            />
          </div>
        );
      })}
      {error && !askOff && (
        <div className={`${ck.notice} ${ck.noticeBad}`} role="alert">
          <div className={ck.noticeBody}>{error}</div>
        </div>
      )}

      {askOff && (
        <KitDialog
          kind="question"
          title={ROWS[askOff].askTitle}
          onClose={() => { if (!busy) { setAskOff(null); setError(null); } }}
          busy={busy !== null}
          footer={
            <>
              <button type="button" className="btn btn-outline" onClick={() => { setAskOff(null); setError(null); }} disabled={busy !== null}>Cancel</button>
              <button type="button" className="btn btn-danger" onClick={() => void change(askOff, false)} disabled={busy !== null} data-autofocus="" id="two-step-stop-requiring">
                {busy ? 'Saving…' : 'Stop requiring it'}
              </button>
            </>
          }
        >
          <p>{ROWS[askOff].askBody}</p>
          {error && <p role="alert">{error}</p>}
        </KitDialog>
      )}
    </section>
  );
}
