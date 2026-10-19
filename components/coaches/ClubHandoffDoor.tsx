'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import QuestionShell, { QuestionCancel } from '@/components/coaches/QuestionShell';
import type { MoneyDataNotice } from '@/components/coaches/MoneyImportMenu';
import { useRecordMoneySignal } from '@/lib/coach-record-money';
import { FAMILY_HANDOFF_COACH_WORDS as W } from '@/lib/families-words';
import type { CoachHandoffView } from '@/lib/families-payment';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE CLUB'S HAND-OFF, OPENED FROM ITS BELL OR ITS EMAIL (Club Tier Stage 5c, Ask 28 — the only coach-side change).
 *
 * A payment the club received for one of this team's players reaches the head coach as a "Your club" bell and an email.
 * Both link here, to the Money hub's Player dues, with `?handoff=`:
 *   · RECORD IT opens the coach's OWN Record money — the one recording conversation, through the hub's one signal —
 *     locked on the player ("A family paid their dues — Riley Reyes", "Owes $100.00 · sent by the club · Oct 19") with
 *     the club's amount, day received, how and a note naming who at the club took it. The coach presses Save; the save
 *     carries the hand-off's id. Nothing else on the coach's screen changes.
 *   · NOT RECEIVED (the bell's second button and the email's second link, `&handoffAnswer=not-received`) asks once,
 *     then tells the club.
 * A hand-off already answered, gone, or for a closed season says so in the hub's notice line and opens nothing.
 * The address is put back to plain Player dues either way, so a reload never opens it twice.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
export default function ClubHandoffDoor({ orgSlug, teamId, canWrite, onNotice }: {
  orgSlug: string;
  teamId: string;
  canWrite: boolean;
  onNotice: (n: MoneyDataNotice) => void;
}) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const signal = useRecordMoneySignal();
  const handoffId = params.get('handoff');
  const answer = params.get('handoffAnswer');
  const [asking, setAsking] = useState<CoachHandoffView | null>(null);
  const [busy, setBusy] = useState(false);
  const opened = useRef<string | null>(null);
  const url = (id: string) => `/api/coaches/${encodeURIComponent(orgSlug)}/teams/${encodeURIComponent(teamId)}/club-handoffs/${encodeURIComponent(id)}`;

  useEffect(() => {
    // The address was scrubbed: the next click on the same link is a new arrival, not this one again.
    if (!handoffId) { opened.current = null; return; }
    if (!canWrite || !signal || opened.current === handoffId) return;
    opened.current = handoffId;
    // The address goes back to plain Player dues at once: a reload or Back never opens it a second time.
    const qp = new URLSearchParams(params.toString());
    qp.delete('handoff');
    qp.delete('handoffAnswer');
    router.replace(`${pathname}?${qp.toString()}`, { scroll: false });
    void (async () => {
      const res = await fetch(url(handoffId)).catch(() => null);
      const data = res?.ok ? ((await res.json()) as { handoff: CoachHandoffView }).handoff : null;
      if (!data) { onNotice({ text: W.gone, tone: 'bad' }); return; }
      if (data.state === 'recorded') { onNotice({ text: W.alreadyRecorded, tone: 'ok' }); return; }
      if (data.state === 'not_received') { onNotice({ text: W.alreadyNotReceived, tone: 'ok' }); return; }
      if (!data.liveSeason) { onNotice({ text: W.wrongSeason, tone: 'bad' }); return; }
      if (!data.playerId) { onNotice({ text: W.gone, tone: 'bad' }); return; }
      if (answer === 'not-received') { setAsking(data); return; }
      signal.request({
        branch: 'dues',
        lock: { subject: data.playerName, detail: W.lockDetail(data.owes, data.sentDay) },
        ids: { duesPlayerId: data.playerId },
        amount: data.amountValue,
        prefill: { receivedDate: data.receivedDate, method: data.method ?? undefined, note: data.note },
        claims: { handoffId: data.id },
      });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per hand-off id; the rest is read at that moment
  }, [handoffId, canWrite, signal]);

  if (!asking) return null;
  const sayNotReceived = async () => {
    setBusy(true);
    const res = await fetch(url(asking.id), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answer: 'not_received' }),
    }).catch(() => null);
    const body = res ? await res.json().catch(() => ({})) as { said?: string; error?: string } : {};
    setBusy(false);
    setAsking(null);
    onNotice(res?.ok ? { text: body.said ?? W.saidNotReceived, tone: 'ok' } : { text: body.error ?? W.failed, tone: 'bad' });
  };
  return (
    <QuestionShell open onClose={() => setAsking(null)} ariaLabel={W.askTitle} title={W.askTitle} busy={busy}
      footer={<>
        <QuestionCancel className={styles.btnSecondary}>{W.askCancel}</QuestionCancel>
        <button type="button" className={styles.btnPrimary} disabled={busy} onClick={() => void sayNotReceived()}>{W.askAct}</button>
      </>}>
      <p>{W.askBody(asking.amount, asking.playerName)}</p>
    </QuestionShell>
  );
}
