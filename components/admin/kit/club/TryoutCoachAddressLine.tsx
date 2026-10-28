'use client';
import { useEffect, useState } from 'react';
import KitDialog from './KitDialog';
import { Callout, repKit } from './RepKit';
import styles from './TryoutCoachAddressLine.module.css';
import { possessive } from '@/lib/utils';

/**
 * The admin team Tryouts page, Sign-ups section: where THIS page's tryout questions go when a head coach set their own
 * address (Club Tier Stage 4c-2 Part B, Ask 2; words CLUB_TIER_STAGE4C2_COPY.md E14–E21). Absent when no coach
 * address is live. "Use the club's address" asks once (the drawn window, buttons together at the foot's right); the
 * coach's row then says the club put its own back, and they may set one again. Nothing is sent (E20).
 *
 * On a phone the line stacks with the button under it at 44 px, and the footer clause drops (E15).
 */
interface View { email: string | null; setByName: string | null; clubAddress: string | null }

export default function TryoutCoachAddressLine({ api, teamName, canWrite, onDone }: {
  /** `/api/admin/rep-teams/teams/{id}/tryout-contact?orgSlug=…` */
  api: string;
  teamName: string;
  canWrite: boolean;
  /** The page's notice (E21): good after the reset, bad when it failed. */
  onDone: (tone: 'good' | 'bad', text: string, action?: { label: string; run: () => void }) => void;
}) {
  const [view, setView] = useState<View | null>(null);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);

  const [readNo, setReadNo] = useState(0);
  useEffect(() => {
    let live = true;
    fetch(api, { cache: 'no-store' })
      .then(res => (res.ok ? res.json() : null))
      .then(v => { if (live && v) setView(v as View); })
      .catch(() => {});
    return () => { live = false; };
  }, [api, readNo]);

  if (!view?.email) return null;
  const who = view.setByName ?? 'The head coach';
  const club = view.clubAddress;

  async function reset() {
    setBusy(true);
    try {
      const res = await fetch(api, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expectedEmail: view?.email }),
      });
      if (res.status === 409) {
        // The coach changed or removed it since this page loaded: say so, and show what is there now.
        const j = await res.json().catch(() => ({}));
        setAsking(false);
        setReadNo(n => n + 1);
        onDone('bad', typeof j.error === 'string' ? j.error : 'Couldn’t change the address. Try again.');
        return;
      }
      if (!res.ok) throw new Error();
      const j = await res.json().catch(() => ({})) as { undo?: unknown };
      const undo = j.undo;
      setView(v => (v ? { ...v, email: null, setByName: null } : v));
      setAsking(false);
      onDone(
        'good',
        club ? `Tryout questions now go to ${club}.` : 'This tryout page now shows no questions address.',
        undo ? { label: 'Undo', run: () => void putBack(undo) } : undefined,
      );
    } catch {
      onDone('bad', 'Couldn’t change the address. Try again.');
    } finally {
      setBusy(false);
    }
  }

  /** The notice's Undo: the coach's address comes back as it was, and the card reappears. */
  async function putBack(undo: unknown) {
    try {
      const res = await fetch(api, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ undo }),
      });
      if (res.ok) {
        setReadNo(n => n + 1);
        onDone('good', `${possessive(who)} address is back on this tryout page.`);
        return;
      }
      const j = await res.json().catch(() => ({}));
      onDone('bad', typeof j.error === 'string' ? j.error : 'Couldn’t put the address back. Try again.');
    } catch {
      onDone('bad', 'Couldn’t put the address back. Try again.');
    }
  }

  const button = club ?'Use the club’s address' : 'Remove this address';
  return (
    <>
      {/* The drawn card (the house callout: olive edge, its one action at the right, under the words on a phone). */}
      <Callout
        flush
        action={canWrite ? (
          <button type="button" className="btn btn-outline" onClick={() => setAsking(true)}>{button}</button>
        ) : undefined}
      >
        <p className={styles.first}>Tryout questions on this page go to {view.email}</p>
        <p className={repKit.windowNote}>
          Set by {who}, head coach.
          <span className={styles.deskOnly}>
            {club
              ? ` Your footer and the club’s Tryouts page keep ${club}.`
              : ' The club has no questions address, so without this one the page shows none.'}
          </span>
        </p>
      </Callout>
      {asking && (
        <KitDialog
          kind="question"
          // E16; with no club address, E16b — the question matches its button (E14b).
          title={club
            ? `Use the club’s address on ${possessive(teamName)} tryout page?`
            : `Remove this address from ${possessive(teamName)} tryout page?`}
          onClose={() => setAsking(false)}
          busy={busy}
          footer={
            <>
              <button type="button" className="btn btn-outline" onClick={() => setAsking(false)} disabled={busy}>Keep it</button>
              <button type="button" className="btn btn-lime" onClick={() => void reset()} disabled={busy}>{button}</button>
            </>
          }
        >
          <p>
            {who} set {view.email} for tryout questions.
            {club ? ` The page will show ${club} instead` : ' The page will show no address instead'}, and {who} will see
            that the club changed it.
          </p>
        </KitDialog>
      )}
    </>
  );
}
