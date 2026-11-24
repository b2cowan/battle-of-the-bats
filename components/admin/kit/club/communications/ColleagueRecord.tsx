'use client';
/**
 * ONE COACH OR BOARD EMAIL'S RECORD (Club Communications Stage 1, Session 2; coach drawing tab 6, Stage 1 drawing tabs 3
 * and 8). Read-only, opened from Communications' list. The server shapes it for this reader (`readColleagueEmail`): a
 * league seat's record of a wider coach email names only its house-league coaches and counts the rest; a board email opens
 * only for its sender, its recipients, the owner and the admins. Names and lines only, never an address.
 *
 * "Send to the N it missed" (ask 14) when this reader may finish it; otherwise who can. "Send again to these people" (Session 3)
 * opens the coach or board window with the pick filled in, the subject copied and the message empty; it sends nothing.
 */
import { useCallback, useState } from 'react';
import type { EmailLogRow } from '@/lib/families-emails-log';
import { RECORD, type ColleagueKind } from '@/lib/club-group-email-words';
import type { SendAgain } from './EmailColleaguesWindow';
import { FAMILY_EMAILS_TAB_WORDS as W } from '@/lib/families-words';
import LoadingState from '@/components/shared/LoadingState';
import KitDialog, { DialogCancel } from '../KitDialog';
import ck from '../ClubKit.module.css';
import { ClubRow, ClubRowList, RepChip, repKit, useDeferredLoad } from '../RepKit';
import { jsonInit, moneyFetch, refusalText } from '../money/MoneyKit';
import { SendStanding } from '../SendParts';
import fam from '../families/Families.module.css';
import { subjectText } from '../families/EmailLog';

interface Person { name: string; line: string | null; status: 'pending' | 'sent' | 'failed' }
interface Detail {
  subject: string | null; body: string | null; label: string; senderName: string | null; sentAt: string;
  count: number; reached: number; failed: number; state: 'sending' | 'stopped' | 'done';
  replies: string; copy: string | null; note: string; wordsCleared: string | null; namesCleared: string | null;
  people: Person[]; others: { label: string; sub: string; sent: number; failed: number; pending: number } | null;
  finish: { may: boolean; line: string | null } | null;
}

export function ColleagueRecord({ row, eyebrow, q, canSendAgain, onSendAgain, onClose, onFinished }: {
  row: EmailLogRow;
  eyebrow: string;
  /** The reader may write to this email's group now (the server asks again). */
  canSendAgain: boolean;
  onSendAgain: (kind: ColleagueKind, again: SendAgain) => void;
  /** `orgSlug=…` */
  q: string;
  onClose: () => void;
  onFinished: (text: string) => void;
}) {
  const path = `/api/admin/club-emails/${encodeURIComponent(row.id)}`;
  const url = `${path}?${q}`;
  const [detail, setDetail] = useState<Detail | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const read = useCallback(async () => {
    const r = await moneyFetch<Detail>(url).catch(() => null);
    if (!r?.ok) { setFailed(true); return; }
    setDetail(r.data);
  }, [url]);
  useDeferredLoad(true, read);

  const state = detail?.state ?? row.state;
  const reached = detail?.reached ?? row.counts?.reached ?? 0;
  const count = detail?.count ?? row.counts?.families ?? 0;
  const missed = Math.max(0, count - reached);
  // Words the clock deleted can't be sent again (T25): no button to a refusal.
  // Nobody missed (every person has it, only the last mark failed) still closes: the server marks it done and sends nothing.
  const mayFinish = state === 'stopped' && !!detail?.finish?.may && !detail.wordsCleared;
  const statusWord = (s: Person['status']) => s === 'sent' ? RECORD.statusSent : s === 'failed' ? RECORD.statusFailed
    : state === 'sending' ? RECORD.statusSending : RECORD.statusPending;

  async function sendAgain() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const res = await moneyFetch<{ kind?: ColleagueKind; keys?: string[]; dropped?: number; subject?: string | null; error?: string; code?: string }>(`${path}/again?${q}`);
      if (res.ok && res.data.kind && res.data.keys) {
        onSendAgain(res.data.kind, { keys: res.data.keys, subject: res.data.subject ?? null, dropped: res.data.dropped ?? 0 });
        return;
      }
      setError(refusalText(res.data, RECORD.againFailed));
    } catch {
      setError(RECORD.againFailed);
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const res = await moneyFetch<{ tried?: number; reached?: number; failed?: number; copy?: string | null; error?: string; code?: string }>(url, jsonInit('POST', { action: 'finish' }));
      if (res.ok) {
        const said = res.data.tried === 0 ? RECORD.finishedNone : RECORD.finished(res.data.reached ?? 0, res.data.failed ?? 0);
        // The copy the sender asked for goes with the finish; a copy that did not go is said now, not left for the next read.
        onFinished(res.data.copy === 'failed' ? `${said} ${RECORD.copyFailed}` : said);
        return;
      }
      setError(refusalText(res.data, RECORD.finishUnsure));
      // Someone else took it (or it is no longer stopped): read the record again so it stops offering the finish.
      if (res.status === 409) void read();
    } catch {
      setError(RECORD.finishUnsure);
    } finally {
      setBusy(false);
    }
  }

  const who = detail ? detail.people.length + (detail.others ? detail.others.sent + detail.others.failed + detail.others.pending : 0) : 0;
  return (
    <KitDialog kind="form" record size="medium" eyebrow={eyebrow} title={subjectText(detail ? { ...row, subject: detail.subject } : row)} onClose={onClose} busy={busy}
      footerStart={error ? <SendStanding>{error}</SendStanding>
        : mayFinish ? <p className={ck.hint}>{missed > 0 ? RECORD.finishHint(missed) : RECORD.finishNoneHint}</p>
        : state === 'stopped' && missed > 0 && detail?.finish?.line ? <p className={ck.hint}>{detail.finish.line}</p> : undefined}
      footer={mayFinish ? (
        <>
          <DialogCancel>{W.close}</DialogCancel>
          <button type="button" className="btn btn-lime" onClick={() => void finish()} disabled={busy}>
            {busy ? RECORD.finishing : missed > 0 ? RECORD.finish(missed) : RECORD.finishNone}
          </button>
        </>
      ) : undefined}>
      <dl className={fam.read}>
        <dt>{W.factSent}</dt><dd>{W.sentAt(row.sentAt)}</dd>
        <dt>{W.factBy}</dt><dd className={row.by ? undefined : fam.quiet}>{row.by ?? '—'}</dd>
        <dt>{W.factTo}</dt><dd>{row.to}</dd>
        <dt>{W.factReached}</dt>
        <dd>
          {state === 'stopped' && <span className={fam.chipGap}><RepChip tone="warn">{W.stoppedChip}</RepChip></span>}
          {state === 'sending' ? W.sending : W.reached(reached, count)}
        </dd>
      </dl>
      <div className={fam.readAfter} />
      {failed ? <p className={repKit.formError}>{W.loadFailed}</p>
        : !detail ? <LoadingState inline label="Loading the email…" />
        : (
          <>
            {detail.wordsCleared ? <p className={`${ck.hint} ${fam.quiet}`}>{detail.wordsCleared}</p>
              : <p className={fam.emailBody}>{detail.body}</p>}
            {detail.namesCleared ? <p className={ck.hint}>{detail.namesCleared}</p> : (
              <>
                <p className={fam.divider}>{RECORD.whoWent(who)}</p>
                <ClubRowList label={RECORD.whoWent(who)}>
                  {detail.people.map((p, i) => (
                    <ClubRow key={`${p.name}:${i}`} title={p.name} caption={p.line ?? undefined}
                      trail={p.status === 'failed' ? <RepChip tone="warn">{statusWord(p.status)}</RepChip> : <span className={fam.quiet}>{statusWord(p.status)}</span>} />
                  ))}
                  {detail.others && (
                    <ClubRow key="others" title={detail.others.label} caption={detail.others.sub}
                      trail={<span className={fam.quiet}>{[`${detail.others.sent} ${RECORD.statusSent.toLowerCase()}`, detail.others.failed ? RECORD.othersFailed(detail.others.failed) : null].filter(Boolean).join(' · ')}</span>} />
                  )}
                </ClubRowList>
              </>
            )}
            <p className={ck.hint}>{detail.replies}{detail.copy ? ` · ${detail.copy}` : ''}</p>
            <p className={ck.hint}>{detail.note}</p>
            {canSendAgain && !detail.namesCleared && (
              <p className={ck.hint}>
                <button type="button" className={repKit.inlineLink} onClick={() => void sendAgain()} disabled={busy}>{RECORD.sendAgain}</button>
              </p>
            )}
          </>
        )}
    </KitDialog>
  );
}
