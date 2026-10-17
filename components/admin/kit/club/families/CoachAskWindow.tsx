'use client';
/**
 * ASK THE COACHES (Club Tier Stage 5b, Ask 4 — hub K4MPu4ni53Ct7yrDcmWJd9 v116 → Stage 5 → P1). The one club send window
 * (the 2026-10-11 ruling — `../SendParts`), unchanged in shape: what sending does in one statement; who it reaches, a row
 * per team with its head coach and how many players the email names ("Nobody to send to" with the reason for a team with
 * no head coach); the sample behind "See <team>'s email"; Last sent … by …; Cancel and the lime that counts the coaches.
 * The server decides on the press (lib/families-coach-ask.ts): colleague mail replying to the sender, a "Your club" bell,
 * one log row claimed before any email goes. ⚠ The words are /marketing's (lib/families-words.ts — drafts as drawn).
 */
import { useCallback, useState } from 'react';
import KitDialog from '../KitDialog';
import ck from '../ClubKit.module.css';
import { repKit, useDeferredLoad, useLatestRead } from '../RepKit';
import { Statement } from '../schedules/ScheduleParts';
import { EmailWordsSample, SendSample, SendStanding } from '../SendParts';
import { FormError, jsonInit, moneyFetch, refusalText } from '../money/MoneyKit';
import LoadingState from '@/components/shared/LoadingState';
import { FAMILY_COACH_ASK_WORDS as W } from '@/lib/families-words';
import type { CoachAskPreview } from '@/lib/families-coach-ask';
import fam from './Families.module.css';

export default function CoachAskWindow({ q, onClose }: {
  /** `orgSlug=…` */
  q: string;
  onClose: () => void;
}) {
  // org-slug-ok: `q` IS the org ("orgSlug=…", passed by the Families tab — the send windows' shape).
  const url = `/api/admin/families/coach-ask?${q}`;
  const [preview, setPreview] = useState<CoachAskPreview | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState<string | null>(null);

  const beginRead = useLatestRead();
  const load = useCallback(async () => {
    const current = beginRead();
    setFailed(false);
    const r = await moneyFetch<CoachAskPreview>(url).catch(() => null);
    if (!current()) return;
    if (!r?.ok) { setFailed(true); return; }
    setPreview(r.data);
  }, [url, beginRead]);
  useDeferredLoad(true, load);

  const teams = preview?.teams ?? [];
  const reachable = teams.filter(t => t.coaches.length > 0);
  const sample = reachable[0] ?? null;

  async function send() {
    if (busy || !preview || reachable.length === 0) return;
    setBusy(true); setError('');
    try {
      const r = await moneyFetch<{ coaches?: number; failed?: number; error?: string }>(url, jsonInit('POST', { teamIds: reachable.map(t => t.teamId) }));
      if (!r.ok) { setError(refusalText(r.data, W.failed)); void load(); return; }
      // Say what didn't go, too: a team whose only head coach's email failed is otherwise silently missed.
      setSent(`${W.sent(r.data.coaches ?? 0)}${r.data.failed ? ` ${W.notDelivered(r.data.failed)}` : ''}`);
      void load();
    } catch {
      setError(W.failed);
    } finally {
      setBusy(false);
    }
  }

  const standing = preview && !sent ? (teams.length === 0 ? W.nothing : reachable.length === 0 ? W.nobodyReachable : null) : null;

  return (
    <KitDialog
      kind="form"
      eyebrow={W.eyebrow}
      title={W.title}
      onClose={onClose}
      busy={busy}
      footerStart={sent ? <p className={ck.hint} role="status">{sent}</p> : standing ? <SendStanding>{standing}</SendStanding> : undefined}
      footer={(
        <>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>{sent ? W.done : W.cancel}</button>
          {!sent && !standing && (
            <button type="button" className="btn btn-lime" onClick={() => void send()} disabled={busy || !preview}>
              {busy ? W.sending : preview ? W.send(preview.coachCount) : W.title}
            </button>
          )}
        </>
      )}
    >
      <FormError>{error}</FormError>
      {failed && !preview ? (
        <p className={repKit.formError}>{W.loadFailed} <button type="button" className={repKit.inlineLink} onClick={() => void load()}>Try again</button></p>
      ) : !preview ? (
        <LoadingState inline label="Loading who this reaches…" />
      ) : (
        <>
          <Statement lead={W.statement} />
          {teams.length > 0 && (
            <div className={repKit.tableFrame}>
              <table className={repKit.table}>
                <thead>
                  <tr>
                    <th scope="col">{W.colTeam}</th>
                    <th scope="col">{W.colCoach}</th>
                    <th scope="col" className={repKit.num}>{W.colPlayers}</th>
                  </tr>
                </thead>
                <tbody>
                  {teams.map(t => (
                    <tr key={t.teamId}>
                      <td><span className={fam.childName}>{t.teamName}</span></td>
                      <td>
                        {t.coaches.length > 0
                          ? t.coaches.map(c => c.name ?? c.email).join(', ')
                          : <><span className={repKit.dim}>{W.nobody}</span><span className={repKit.cellSub}>{t.why}</span></>}
                      </td>
                      <td className={repKit.num}>{t.players.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {sample && (
            <SendSample summary={W.seeEmail(sample.teamName)}>
              <EmailWordsSample w={sample.sample} />
            </SendSample>
          )}
          <dl className={`${fam.read} ${fam.readAfter}`}>
            <dt>{W.lastSent}</dt>
            <dd className={preview.lastSent ? undefined : fam.quiet}>{preview.lastSent ? W.lastSentValue(preview.lastSent.at, preview.lastSent.by) : W.never}</dd>
          </dl>
        </>
      )}
    </KitDialog>
  );
}
