'use client';
/**
 * SEND REMINDERS (Club Tier Stage 3a, specimen 6 — Ask 4; C16, J4-015, J4-030). One door on Allocations,
 * and "Remind {team}" inside a team's bill (`teamId`).
 *
 * It ASKS FIRST: the preview names every team, who gets the email (its head coaches and any staff the
 * head coach has given the team's money — never the person sending), what each owes with a Late chip,
 * and says plainly who can't be reached and why. Overdue installments are INCLUDED — they are the reason
 * to send. "Last sent" stops two people sending the same wave twice; the server claims a wave before
 * any email goes (`just_sent`), and the button is held while the send is in flight anyway. Manual only
 * in 3a. The email's reply-to is the sender (no payment-instructions setting, ruled 2026-09-30).
 *
 * ⚠ The words are /marketing's (lib/club-money-words.ts holds the email's; these are drafts).
 */
import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import KitDialog from '../KitDialog';
import ck from '../ClubKit.module.css';
import { Callout, RepChip, repKit } from '../RepKit';
import { reminderEmailLines, reminderEmailSubject } from '@/lib/club-money-words';
import { pluralize } from '@/lib/utils';
import { FormError, day, daysLateWords, jsonInit, money, moneyFetch, moneyKit, refusalText } from './MoneyKit';
import type { ReminderPreview, ReminderLine } from '@/lib/club-money-reminders';

const lineWords = (l: ReminderLine) =>
  `${l.allocation}${l.of > 1 ? `, ${l.number} of ${l.of}` : ''} · ${money(l.amount)} · ${l.daysLate > 0 ? daysLateWords(l.daysLate) : day(l.dueDate)}`;

export default function RemindersWindow({ q, orgName, senderName, team, onClose, onSent }: {
  q: string;
  orgName: string;
  /** The sender, as the email's reply-to names them. */
  senderName: string;
  /** The single-team variant (a team's bill): only that team. */
  team?: { id: string; name: string };
  onClose: () => void;
  onSent: (text: string) => void;
}) {
  const [preview, setPreview] = useState<ReminderPreview | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const url = `/api/admin/accounting/reminders?${q}${team ? `&teamId=${encodeURIComponent(team.id)}` : ''}`;

  const load = useCallback(async () => {
    const r = await moneyFetch<ReminderPreview>(url).catch(() => null);
    if (!r?.ok) { setFailed(true); return; }
    setFailed(false);
    setPreview(r.data);
  }, [url]);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => { void load(); });
    return () => window.cancelAnimationFrame(frame);
  }, [load]);

  async function send() {
    if (busy || !preview) return;
    setBusy(true); setError('');
    try {
      const r = await moneyFetch<{ teams?: number; recipients?: number; failed?: number; error?: string }>(url, jsonInit('POST', { teamIds: preview.teams.map(t => t.teamId) }));
      if (!r.ok) {
        setError(refusalText(r.data, 'The reminders couldn’t be sent. Please try again.'));
        void load();
        return;
      }
      const sent = r.data.recipients ?? 0;
      const failedTo = r.data.failed ?? 0;
      onSent(`${pluralize(sent, 'reminder')} sent to the coaches of ${pluralize(r.data.teams ?? 0, 'team')}.${failedTo > 0 ? ` ${failedTo} couldn’t be delivered.` : ''}`);
    } catch {
      setError('The reminders couldn’t be sent. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  const teams = preview?.teams ?? [];
  const sample = teams[0];
  const sampleLines = sample ? reminderEmailLines({ orgName, teamName: sample.teamName, senderName, lines: sample.lines }) : null;
  const sampleName = sample?.recipients.find(r => r.isHeadCoach)?.name ?? sample?.recipients[0]?.name ?? sample?.teamName;

  return (
    <KitDialog
      kind="form"
      eyebrow={team ? 'A team’s bill' : 'Allocations'}
      title={team ? `Remind ${team.name}` : 'Send reminders'}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>Cancel</button>
          {/* Until the preview arrives the button claims nothing — "Nothing to send" was a guess (/design 2026-10-01). */}
          <button type="button" className="btn btn-lime" onClick={() => void send()} disabled={busy || !preview || teams.length === 0}>
            {busy ? 'Sending…' : !preview ? (failed ? 'Send reminders' : 'Loading…') : teams.length === 0 ? 'Nothing to send' : `Send ${pluralize(teams.length, 'reminder')}`}
          </button>
        </>
      }
    >
      <FormError>{error}</FormError>
      {failed ? (
        <p className={repKit.formError}>The preview didn’t load. <button type="button" className={repKit.inlineLink} onClick={() => void load()}>Try again</button></p>
      ) : !preview ? (
        <p className={ck.loading}>Loading…</p>
      ) : (
        <>
          <div className={ck.field}>
            <span className={ck.label}>Remind about</span>
            <span className={moneyKit.lede}>Overdue, and due in the next {preview.windowDays} days</span>
          </div>
          {teams.length > 0 && (
            <>
              <p className={repKit.factsLabel}>Who gets one · {pluralize(teams.length, 'team')}</p>
              <div className={moneyKit.lines}>
                {teams.map(t => (
                  <div key={t.teamId} className={moneyKit.line}>
                    <div className={moneyKit.lineMain}>
                      <span className={moneyKit.lineTitle}>{t.teamName} · {t.recipients.map(r => r.name ?? r.email).join(', ')}</span>
                      <span className={moneyKit.lineSub}>{t.lines.map(lineWords).join(' — and ')}</span>
                    </div>
                    {t.overdueCount > 0 && <span className={moneyKit.lineEnd}><RepChip tone="bad">Late</RepChip></span>}
                  </div>
                ))}
              </div>
            </>
          )}
          {preview.unreachable.length > 0 && (
            <Callout tone="warn" role="note" icon={<AlertTriangle size={16} aria-hidden />}>
              <b>Nobody to send to · {pluralize(preview.unreachable.length, 'team')}</b>
              {preview.unreachable.map(u => (
                <span key={u.teamId} className={repKit.calloutSub}>
                  {u.teamName} {u.whyWords}, so its reminder ({u.lines.map(lineWords).join('; ')}) can’t go.
                </span>
              ))}
              <span className={repKit.calloutSub}>Name or chase them from each team’s Coaches page.</span>
            </Callout>
          )}
          {teams.length === 0 && preview.unreachable.length === 0 && (
            <p className={moneyKit.lead1}>Nothing is overdue or due in the next {preview.windowDays} days{team ? ` for ${team.name}` : ''}, so there is nothing to remind anyone about.</p>
          )}
          <p className={ck.hint}>
            Each coach gets one email listing what their team owes; a reply comes to you.
            {preview.lastSent ? ` Last sent ${day(preview.lastSent.at)}${preview.lastSent.by ? ` by ${preview.lastSent.by}` : ''}.` : ' None sent yet.'}
          </p>
          {sample && sampleLines && (
            <details className={moneyKit.facts}>
              <summary className={repKit.inlineLink}>See {sampleName}’s email</summary>
              <p><b>{reminderEmailSubject({ orgName, teamName: sample.teamName })}</b></p>
              <p>{sampleLines.intro}</p>
              <ul className={repKit.factList}>{sampleLines.items.map(i => <li key={i}>{i}</li>)}</ul>
              <p>{sampleLines.total}</p>
              <p>{sampleLines.outro}</p>
            </details>
          )}
        </>
      )}
    </KitDialog>
  );
}
