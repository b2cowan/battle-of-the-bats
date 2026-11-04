'use client';
/**
 * THE LOOK ROW'S "TOURNAMENTS" PART — the club's one rule for its tournaments' look (Public tournament pages Stage 1a,
 * the drawing's tabs 1–2, ruled 2026-11-02; mig 426). (The preview switch it waited behind went with Stage 8 Part 4b.)
 *
 * ⚖ Ask 13: whoever may edit the club's Look sets it (owner or admin), NOT the owner alone — so it lives in the Look row
 * and reads as the rest of that row does: a reader who may not write sees the rule in words, never a greyed radio.
 *
 * The default saves at once (switching back never asks: every tournament's own look returns as it was). *Always* asks
 * first when any tournament has colours of its own, naming them; the radio stays on the old choice until "Use the club's
 * look" (Not now, Escape and a tap outside all leave it). With none to name it saves at once.
 */
import { useState } from 'react';
import KitDialog from '@/components/admin/kit/club/KitDialog';
import ck from '@/components/admin/kit/club/ClubKit.module.css';
import { repKit } from '@/components/admin/kit/club/RepKit';
import { SendRows, SendRow } from '@/components/admin/kit/club/SendParts';
import { tournamentLookChoices, tournamentLookQuestion, tournamentLookWords, type LookNoun } from '@/lib/tournament-look-words';
import type { TournamentLookPolicy } from '@/lib/tournament-look';
import styles from './public-site.module.css';

type Question = NonNullable<ReturnType<typeof tournamentLookQuestion>>;

export default function TournamentLookPart({ orgSlug, noun, policy, readOnly, onSave }: {
  orgSlug: string;
  noun: LookNoun;
  policy: TournamentLookPolicy;
  readOnly: boolean;
  /** Saves the rule through the Look row's queue (its pill carries a failure and Retry); never throws. */
  onSave: (next: TournamentLookPolicy) => Promise<unknown>;
}) {
  const choices = tournamentLookChoices(noun);
  const words = tournamentLookWords(noun);
  // What the radio shows while a save is open; null at rest (the saved rule shows).
  const [pending, setPending] = useState<TournamentLookPolicy | null>(null);
  const [asking, setAsking] = useState<Question | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shown = pending ?? policy;

  async function save(next: TournamentLookPolicy) {
    setAsking(null);
    setPending(next);
    try { await onSave(next); } finally { setPending(null); }
  }

  async function pick(next: TournamentLookPolicy) {
    if (next === shown || checking || pending) return;
    setError(null);
    if (next !== 'always_club') return void save(next);
    setChecking(true);
    try {
      const res = await fetch(`/api/admin/org/tournament-look?orgSlug=${encodeURIComponent(orgSlug)}`);
      const data = await res.json().catch(() => null) as { current?: { name: string; live: boolean }[]; finished?: number } | null;
      if (!res.ok || !Array.isArray(data?.current) || typeof data?.finished !== 'number') throw new Error('list');
      const q = tournamentLookQuestion(noun, { current: data.current, finished: data.finished });
      setChecking(false);
      if (q) setAsking(q);
      else await save(next);
    } catch {
      setChecking(false);
      setError(words.listFailed);
    }
  }

  const title = <h3 className={styles.lookPartTitle} id="site-tournament-look">{words.partTitle}</h3>;
  if (readOnly) {
    const chosen = choices.find(c => c.value === policy) ?? choices[0];
    return (
      <div className={styles.lookPart}>
        {title}
        <p className={styles.readable}><strong>{chosen.name}.</strong> {chosen.sub}</p>
        <p className={ck.hint}>{words.hint}</p>
      </div>
    );
  }
  return (
    <div className={styles.lookPart}>
      {title}
      <SendRows group={{ radio: true, labelledBy: 'site-tournament-look' }}>
        {choices.map(c => (
          <SendRow key={c.value} title={c.name} sub={c.sub}
            pick={{ checked: shown === c.value, onChange: () => void pick(c.value), radio: 'tournament-look-policy' }} />
        ))}
      </SendRows>
      <p className={ck.hint}>{words.hint}</p>
      {error && <p className={styles.fieldError} role="alert">{error}</p>}

      {asking && (
        <KitDialog
          kind="question"
          title={asking.title}
          onClose={() => setAsking(null)}
          footerStart={<span className={repKit.footNote}>{asking.kept}</span>}
          footer={
            <>
              <button type="button" className="btn btn-outline" onClick={() => setAsking(null)} data-autofocus="">{asking.notNow}</button>
              <button type="button" className="btn btn-lime" onClick={() => void save('always_club')}>{asking.confirm}</button>
            </>
          }
        >
          <p>{asking.sentence.map((p, i) => (typeof p === 'string' ? p : <em key={i}>{p.name}</em>))}</p>
        </KitDialog>
      )}
    </div>
  );
}
