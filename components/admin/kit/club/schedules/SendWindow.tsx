'use client';
/**
 * SEND — the schedule, its review, its changes (Club Tier Stage 11a, part B — hub Stages 10 + 11, specimens 9 "Send the
 * schedule", 10 "Send the changes", 14 step 5 "Send for review"; Asks 7, 9, 14, 23, 24; build question B).
 *
 * ⚖ THE REMINDERS WINDOW'S SHAPE (Ask 9 — one send window and one log shape for every club send): what sending does in
 * ONE statement (the server's words); who is told, a row per team — its head coaches and the staff its head coach gave
 * schedule access, ticked, with what that team gets under them; Nobody to send to, with the reminders' reasons; a sample
 * email ("See 15U AAA's email"); "Last sent … by …"; Cancel and the lime that COUNTS ("Send to 11"). The server
 * recomputes everything on the press and claims the send before any email goes; a newer version refuses.
 * ⚖ The club's coaches only — never the venue's bookings contact (owner 2026-10-12, walk §300 W7: "this is between clubs
 * and their coaches"; it amends Ask 7). The venue keeps the contact; the Export is how a club hands a venue the schedule.
 *
 *   draft      — Send · For review first (the default when a bill rides with it — Ask 24) or Final now.
 *   in review  — Finalize and send: it books every slot and bills every team in one step; the window says so and asks
 *                nothing more (the one ask is this window).
 *   changes    — only the teams the changes touch; a team that handed time back is said, never emailed (it did it
 *                itself); Bill the corrections — off, the time gained is never billed and the baseline moves on (part A's
 *                note 2); a team that lost time is told what it is owed back (build question B).
 * ⚠ A reader without the club's Accounting never sees a team's bill here (the route strips it); a send that would carry
 * one is refused with the reason, in the blocker callout.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import KitDialog from '../KitDialog';
import ck from '../ClubKit.module.css';
import { Callout, repKit, useLatestRead } from '../RepKit';
import { FormError, jsonInit, moneyFetch, refusalText } from '../money/MoneyKit';
import { addCalendarDays, formatStoredDate, isCalendarDate, tournamentToday } from '@/lib/timezone';
import { SCHEDULE_REFUSALS as R, SCHEDULE_SCREEN_WORDS as W, billPhrase, moneyCents as money, type EmailWords } from '@/lib/club-schedule-words';
import { isStale, oneWeekdayOf, type ScheduleView } from '@/lib/club-schedule-view';
import type { SendKind } from '@/lib/club-schedule-send';
import { HAND_BACK_WORDS, type CreditMove } from '@/lib/club-hand-back-words';
import { Statement } from './ScheduleParts';
import sch from './Schedules.module.css';
import LoadingState from '@/components/shared/LoadingState';

interface PreviewTeam {
  teamId: string; teamName: string; recipients: { userId: string; name: string | null; email: string; isHeadCoach: boolean }[];
  slots: number; lines: string[]; bill: { cents: number; installments: { dueDate: string; amount: number }[] } | null;
  billedCents: number | null;
  /** Stage 11d, Ask 8: time the club moved off the team, and how it settles (a credit off what it owes; the rest owed back). */
  lost: { cents: number; creditCents: number; payCents: number; moves: CreditMove[] } | null;
  sample: EmailWords | null;
}
interface Preview {
  kind: SendKind; version: number; statement: string; teams: PreviewTeam[];
  unreachable: { teamId: string; teamName: string; sentence: string }[];
  blockers: { code: string; error: string }[];
  correctionBlocked: { code: string; error: string } | null;
  replyBy: string | null;
  lastSent: { at: string; by: string | null } | null;
  handedBack: { teamId: string; teamName: string; lines: string[] }[];
  recipientCount: number;
  correction: { billed: Record<string, number>; lost: Record<string, number> } | null;
}


function Sample({ w }: { w: EmailWords }) {
  return (
    <div className={sch.sample}>
      <p><b>{w.subject}</b></p>
      <p>{w.greeting}</p>
      {w.paragraphs.map(p => <p key={p}>{p}</p>)}
      {w.lists.map((l, i) => (
        <div key={i}>
          {l.title && <p><b>{l.title}</b></p>}
          <ul>{l.items.map(it => <li key={it}>{it}</li>)}</ul>
        </div>
      ))}
      {w.link && <p><u>{w.link.label}</u></p>}
      {w.outro && <p>{w.outro}</p>}
    </div>
  );
}

export default function SendWindow({ q, view, start, onSent, onStale, onClose }: {
  q: string;
  view: ScheduleView;
  /** What opened it: Send on a draft (`draft`), Finalize and send (`final`), Send the changes (`changes`). */
  start: 'draft' | 'final' | 'changes';
  onSent: (text: string) => void;
  /** The schedule changed under the window: the page re-reads it. */
  onStale?: () => void;
  onClose: () => void;
}) {
  const [kind, setKind] = useState<SendKind>(start === 'changes' ? 'changes' : start === 'final' ? 'final' : view.bill ? 'review' : 'final');
  const [replyBy, setReplyBy] = useState(view.schedule.replyBy ?? addCalendarDays(tournamentToday(), 7));
  const [preview, setPreview] = useState<Preview | null>(null);
  const [failed, setFailed] = useState(false);
  const [unticked, setUnticked] = useState<Set<string>>(() => new Set());
  const [corrections, setCorrections] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const url = `/api/admin/schedules/${encodeURIComponent(view.schedule.id)}/send?${q}`;
  const beginRead = useLatestRead();
  const load = useCallback(async () => {
    const current = beginRead();
    setFailed(false);
    const r = await moneyFetch<Preview>(`${url}&kind=${kind}${kind === 'review' && isCalendarDate(replyBy) ? `&replyBy=${replyBy}` : ''}`).catch(() => null);
    if (!current()) return;
    if (!r?.ok) { setFailed(true); setError(refusalText(r?.data, W.previewFailed2)); return; }
    setError('');
    setPreview(r.data);
  }, [url, kind, replyBy, beginRead]);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => { void load(); });
    return () => window.cancelAnimationFrame(frame);
  }, [load]);

  const shown = preview && preview.kind === kind ? preview : null;
  const teams = shown?.teams ?? [];
  const ticked = teams.filter(t => !unticked.has(t.teamId));
  const people = ticked.reduce((n, t) => n + t.recipients.length, 0);
  const oneWeekday = oneWeekdayOf(view.slots);
  // A one-weekday schedule counts each team's DAYS ("25 Sundays" — a team can hold two slots a Sunday).
  const daysOf = useMemo(() => {
    const out = new Map<string, Set<string>>();
    for (const x of view.slots) for (const t of x.teamIds) (out.get(t) ?? out.set(t, new Set()).get(t)!).add(x.day);
    return out;
  }, [view.slots]);
  const sample = teams[0] ?? null;
  const sampleName = sample ? (sample.recipients.find(r => r.isHeadCoach)?.name ?? sample.recipients[0]?.name ?? sample.teamName) : null;
  const blocked = (shown?.blockers.length ?? 0) > 0 || (kind === 'changes' && corrections && !!shown?.correctionBlocked);

  async function send() {
    if (busy || !shown || blocked) return;
    setBusy(true); setError('');
    try {
      const r = await moneyFetch<{ teams: number; people: number; failed: number; version: number; checks: { clashes: number } }>(url, jsonInit('POST', {
        kind, version: view.schedule.version, teamIds: ticked.map(t => t.teamId), replyBy: kind === 'review' ? replyBy : null,
        billCorrections: kind === 'changes' ? corrections : undefined,
      }));
      if (!r.ok) { if (isStale(r.data)) onStale?.(); setError(refusalText(r.data, R.notSaved)); void load(); setBusy(false); return; }
      const text = [W.sentNotice(r.data.people, r.data.teams, r.data.failed), r.data.checks.clashes ? W.sentClash(r.data.checks.clashes) : ''].filter(Boolean).join(' ');
      onSent(text);
    } catch {
      setError(R.notSaved);
      setBusy(false);
    }
  }

  const statement = shown?.statement ?? '';
  const cut = statement.indexOf('. ');
  const title = kind === 'changes' ? W.changesTitle : start === 'final' ? W.finalizeTitle : kind === 'review' ? W.reviewTitle : W.sendTitle;
  const lime = !shown ? W.sendTo(0)
    : kind === 'review' ? W.sendToCoaches(people)
    : kind === 'changes' ? W.sendToPeople(people)
    : start === 'final' ? W.finalizeGo(people) : W.sendTo(people);
  const head = kind === 'review' ? W.whoReviews(ticked.length, people) : kind === 'changes' ? W.whoChanges(people)
    : W.whoTold(people);
  const teamLine = (t: PreviewTeam, i: number) => {
    if (kind === 'changes') {
      // D7: both money lines plain, as the built lines are.
      const money2 = [t.billedCents ? W.billedCorrection(money(t.billedCents)) : '', t.lost ? HAND_BACK_WORDS.lostLine({ teamName: t.teamName, ...t.lost }) : ''].filter(Boolean);
      return [t.lines.join('; '), ...money2].join(' · ');
    }
    const slots = W.teamSlots(t.slots, daysOf.get(t.teamId)?.size ?? 0, oneWeekday);
    if (kind === 'review') return t.bill ? `${slots} · ${billPhrase(t.bill.cents, t.bill.installments.length)}` : slots;
    return i === 0 ? `${W.staffNote} · ${slots}` : slots;
  };

  return (
    <KitDialog
      kind="form"
      eyebrow={view.schedule.name}
      title={title}
      onClose={onClose}
      busy={busy}
      footer={(
        <>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>{W.cancel}</button>
          <button type="button" className="btn btn-lime" onClick={() => void send()} disabled={busy || !shown || blocked}>{busy ? W.sending : lime}</button>
        </>
      )}
    >
      <FormError>{error}</FormError>
      {start === 'draft' && (
        <label className={ck.field} htmlFor="send-kind">
          <span className={ck.label}>{W.sendHow}</span>
          <select id="send-kind" className={ck.select} value={kind} onChange={e => setKind(e.target.value as SendKind)}>
            <option value="review">{W.sendReview}</option>
            <option value="final">{W.sendFinal}</option>
          </select>
          <span className={ck.hint}>{kind === 'review' ? W.sendReviewHint : W.sendFinalHint}</span>
        </label>
      )}
      {failed && !shown ? (
        <p className={repKit.formError}>{W.previewFailed2} <button type="button" className={repKit.inlineLink} onClick={() => void load()}>{W.tryAgain}</button></p>
      ) : !shown ? (
        <LoadingState inline label="Loading the preview…" />
      ) : (
        <>
          <Statement lead={cut > 0 ? statement.slice(0, cut + 1) : statement} rest={cut > 0 ? statement.slice(cut + 2) : undefined} />
          {kind === 'review' && (
            <label className={ck.field} htmlFor="send-reply">
              <span className={ck.label}>{W.replyBy}</span>
              <input id="send-reply" type="date" className={ck.input} value={replyBy} min={tournamentToday()} onChange={e => setReplyBy(e.target.value)} />
            </label>
          )}
          {shown.blockers.length > 0 && (
            <Callout tone="bad" role="alert" icon={<AlertTriangle size={16} aria-hidden />}>
              {shown.blockers.map(b => <span key={b.code + b.error} className={repKit.calloutSub}>{b.error}</span>)}
            </Callout>
          )}
          {teams.length > 0 && (
            <>
              <p className={repKit.factsLabel}>{head}</p>
              <div className={sch.sendRows}>
                {teams.map((t, i) => (
                  <label key={t.teamId} className={sch.sendRow}>
                    <input type="checkbox" checked={!unticked.has(t.teamId)}
                      onChange={e => setUnticked(u => { const n = new Set(u); if (e.target.checked) n.delete(t.teamId); else n.add(t.teamId); return n; })} />
                    <span className={sch.sendRowMain}>
                      <b>{t.teamName}</b> · {t.recipients.map(r => r.name ?? r.email).join(', ')}
                      <small>{teamLine(t, i)}</small>
                    </span>
                  </label>
                ))}
              </div>
            </>
          )}
          {shown.unreachable.length > 0 && (
            <Callout tone="warn" role="note" icon={<AlertTriangle size={16} aria-hidden />}>
              <b>{W.nobodyHead(shown.unreachable.length)}</b>
              {shown.unreachable.map(u => <span key={u.teamId} className={repKit.calloutSub}>{u.sentence}</span>)}
            </Callout>
          )}
          {kind === 'changes' && shown.correction && (Object.keys(shown.correction.billed).length > 0 || Object.keys(shown.correction.lost).length > 0) && (
            <label className={sch.switchLine}>
              <input type="checkbox" checked={corrections} onChange={e => setCorrections(e.target.checked)} />
              <span>
                <b>{W.billCorrections}</b>
                <span className={repKit.calloutSub}>{corrections ? W.billCorrectionsOn : W.billCorrectionsOff}</span>
                {corrections && shown.correctionBlocked && <span className={repKit.formError}>{shown.correctionBlocked.error}</span>}
              </span>
            </label>
          )}
          <p className={ck.hint}>
            {kind === 'review' ? W.reviewHint : kind === 'changes' ? W.changesHint : W.emailHint}{' '}
            {shown.lastSent ? W.lastSent(formatStoredDate(shown.lastSent.at), shown.lastSent.by) : W.notSentYet}
          </p>
          {sample?.sample && (
            <details className={sch.details}>
              <summary className={repKit.inlineLink}>{W.seeEmail(sampleName ?? sample.teamName)}</summary>
              <Sample w={sample.sample} />
            </details>
          )}
        </>
      )}
    </KitDialog>
  );
}
