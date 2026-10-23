'use client';
/**
 * THE "COACHES ON TEAM PAGES" ROW — who the club lists under Coaches on every team's public page (mig 352; drawings ruled
 * 2026-10-23, words COACH_NAMES_CLUB_POLICY_COPY.md).
 *
 * ⚖ The OWNER's alone (ask A2). The owner gets four choices in one framed list (the product's radio); an admin reads the same
 * facts as text with one sentence saying who changes them — never a greyed radio (absent beats disabled). The server says
 * the same: `/api/admin/org/coach-names` refuses an admin the write.
 *
 * "Coaches choose" and "No coach names" only take names away or hand the choice back, so they save at once. The two
 * "always" choices PUBLISH people's names, so they hold and ask first, with the real count; the list stays on the old
 * choice until "List them" (controlled radio: Not now, Escape and a tap outside all leave it there). A choice that would
 * newly list no one has nothing to ask and saves at once.
 */
import { useState } from 'react';
import KitDialog from '@/components/admin/kit/club/KitDialog';
import ck from '@/components/admin/kit/club/ClubKit.module.css';
import { SendRows, SendRow } from '@/components/admin/kit/club/SendParts';
import { COACH_NAMES_WORDS as W, COACH_NAMES_CHOICES, coachNamesAdminFacts, coachNamesWindow, type NewlyListedCounts } from '@/lib/coach-names-words';
import type { CoachNamesPolicy } from '@/lib/coach-names-policy';
import styles from './public-site.module.css';

export default function CoachNamesPanel({ orgSlug, policy, isOwner, onSave }: {
  orgSlug: string;
  policy: CoachNamesPolicy;
  isOwner: boolean;
  /** Saves the choice (the page's pill shows Saved / the failure and its Retry); throws when refused. */
  onSave: (next: CoachNamesPolicy) => Promise<void>;
}) {
  // What the radio shows while a save is open; null at rest (the saved choice shows).
  const [pending, setPending] = useState<CoachNamesPolicy | null>(null);
  const [asking, setAsking] = useState<{ candidate: CoachNamesPolicy; title: string; body: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(next: CoachNamesPolicy) {
    setPending(next);
    setBusy(true);
    setError(null);
    try {
      await onSave(next);
    } catch {
      // The page's pill carries the failure and its Retry; the radio goes back to the saved choice.
    } finally {
      setPending(null);
      setBusy(false);
      setAsking(null);
    }
  }

  async function pick(next: CoachNamesPolicy) {
    if (next === (pending ?? policy) || busy) return;
    if (next !== 'heads_always' && next !== 'heads_and_assistants_always') return void save(next);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/org/coach-names?orgSlug=${encodeURIComponent(orgSlug)}&policy=${next}`);
      const data = await res.json().catch(() => null) as { newlyListed?: NewlyListedCounts } | null;
      if (!res.ok || !data?.newlyListed) throw new Error('counts');
      const w = coachNamesWindow(next, data.newlyListed);
      setBusy(false);
      if (w) setAsking({ candidate: next, ...w });
      else await save(next);
    } catch {
      setBusy(false);
      setError(W.saveFailed);
    }
  }

  if (!isOwner) {
    const facts = coachNamesAdminFacts(policy);
    return (
      <>
        <p className={ck.hint}>{W.lead}</p>
        <dl className={styles.facts}>
          <div><dt>{W.listedLabel}</dt><dd>{facts.listed}</dd></div>
          {facts.choose && <div><dt>{W.chooseLabel}</dt><dd>{facts.choose}</dd></div>}
        </dl>
        <p className={ck.hint}>{W.ownerSentence}</p>
      </>
    );
  }

  const shown = pending ?? policy;
  return (
    <div>
      <p className={ck.hint}>{W.lead}</p>
      <SendRows group={{ radio: true, label: W.groupLabel }}>
        {COACH_NAMES_CHOICES.map(c => (
          <SendRow key={c.value} title={c.name} sub={c.sub}
            pick={{ checked: shown === c.value, onChange: () => void pick(c.value), radio: 'coach-names-policy' }} />
        ))}
      </SendRows>
      <p className={ck.hint}>{W.hint}</p>
      {error && <p className={styles.fieldError} role="alert">{error}</p>}

      {asking && (
        <KitDialog
          kind="question"
          title={asking.title}
          onClose={() => setAsking(null)}
          busy={busy}
          footer={
            <>
              <button type="button" className="btn btn-outline" onClick={() => setAsking(null)} disabled={busy} data-autofocus="">{W.notNow}</button>
              <button type="button" className="btn btn-lime" onClick={() => void save(asking.candidate)} disabled={busy}>{W.listThem}</button>
            </>
          }
        >
          <p>{asking.body}</p>
        </KitDialog>
      )}
    </div>
  );
}
