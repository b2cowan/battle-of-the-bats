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
import { PART_WORDS as P, SCHEDULE_REFUSALS as R, SCHEDULE_SCREEN_WORDS as W, billPhrase, moneyCents as money, withoutReviewReply, type ChangeGroup, type EmailWords } from '@/lib/club-schedule-words';
import { isStale, oneWeekdayOf, type ScheduleView } from '@/lib/club-schedule-view';
import type { SendKind } from '@/lib/club-schedule-send';
import { getsPlainEmail } from '@/lib/club-schedule-money-audience';
import { HAND_BACK_WORDS, type CreditMove } from '@/lib/club-hand-back-words';
import { TIME_HANDOFF_WORDS, type LeagueTimeLine } from '@/lib/league-time-handoff';
import { hoursOf } from '@/lib/league-time';
import { Statement } from './ScheduleParts';
import { ChangeTeamBlock } from './ChangeGroups';
import { EmailWordsSample, MailView, SendDoor, SendDoors, SendRow, SendRows, useSendLevel } from '../SendParts';
import sch from './Schedules.module.css';
import LoadingState from '@/components/shared/LoadingState';
import DateInput from '@/components/shared/DateInput';

interface PreviewTeam {
  /** `money`: can open the team's Money — the bill goes only to them (owner 2026-11-13). */
  teamId: string; teamName: string; recipients: { userId: string; name: string | null; email: string; isHeadCoach: boolean; money: boolean }[];
  slots: number; lines: string[];
  /** changes: the same changes as groups — the row shows these, as the page's Needs attention row does (owner 2026-11-17). */
  groups: ChangeGroup[];
  bill: { cents: number; installments: { dueDate: string; amount: number }[] } | null;
  billedCents: number | null;
  /** Stage 11d, Ask 8: time the club moved off the team, and how it settles (a credit off what it owes; the rest owed back). */
  lost: { cents: number; creditCents: number; payCents: number; moves: CreditMove[] } | null;
  sample: EmailWords | null;
  /** A mixed team's email for the coaches who can't open Money — the same words without the bill. */
  plainSample: EmailWords | null;
}
interface Preview {
  kind: SendKind; version: number; statement: string; teams: PreviewTeam[];
  unreachable: { teamId: string; teamName: string; sentence: string }[];
  /** Finalize / changes: a team emailed its slots whose bill reaches nobody who can open Money. */
  billNotTold: { teamId: string; teamName: string; sentence: string }[];
  blockers: { code: string; error: string }[];
  correctionBlocked: { code: string; error: string } | null;
  /** P9 B: a permit billed from this send at its own price (money readers only). */
  newPrices?: { permitName: string; fullHour: number }[];
  replyBy: string | null;
  lastSent: { at: string; by: string | null } | null;
  handedBack: { teamId: string; teamName: string; lines: string[] }[];
  recipientCount: number;
  correction: { billed: Record<string, number>; lost: Record<string, number> } | null;
  /** Stage 11b Part 5 (h4): the house-league teams whose practices move or are cancelled, and the plan the POST returns. */
  league: {
    teams: { teamId: string; teamName: string; lines: string[]; group: string; coaches: { userId: string | null; name: string | null; email: string }[]; families: number; households: string[]; sample: EmailWords }[];
    /** House League 9d-2b Part 5: a division's games that move with its time or leave it — no tick, they email nobody here. */
    games?: { key: string; name: string; line: string; sub: string }[];
    seen: string;
  } | null;
  /** Stage 13d (A2): who hears the time-given bell, and the week's hours this send gives or takes back. Null: house league
   *  gets nothing from this send, so the line is held off. */
  leagueTime?: LeagueTimeLine | null;
  /** Phase 8 (Session 3, drawing tab 5): each added part this Send the changes takes with it — a first send carries its bill
   *  line (its bill's figure to a money reader only). */
  parts?: {
    id: string; label: string; name: string; version: number; first: boolean; billSet: boolean;
    line: { minutes: number; permitNames: string[]; teamNames: string[]; bill: { cents: number; teamNames: string[]; payments: number; firstDue: string | null } | null } | null;
  }[];
}

/** "1.5 hours", "1 hour" — a part's time on its bill line. */


/** What the window holds that the person chose: the teams they unticked and the "Bill the corrections" switch. It rides the
 *  page through Bill it… and back, so a round trip never resets it (owner 2026-11-17, walk §538 call C1). */
export interface SendKeep { unticked: string[]; corrections: boolean }

export default function SendWindow({ q, view, start, bill, keep, canMoney, onSent, onStale, onClose, onBillPart }: {
  q: string;
  view: ScheduleView;
  /** What opened it: Send on a draft (`draft`), Finalize and send (`final`), Send the changes (`changes`), or Send the bill
   *  on a final schedule that was finalized without one (`bill`, with its terms in `bill`). */
  start: 'draft' | 'final' | 'changes' | 'bill';
  /** The late bill's terms, as Bill the teams filled them in — they ride on the preview and the send; nothing is stored before. */
  bill?: object;
  /** What the window held when it was last left for Bill it… (the page keeps it); absent = the defaults. */
  keep?: SendKeep;
  /** Whether the sender holds the club's Accounting: without it a bill set on a part is shown as "Bill set" and the send is held. */
  canMoney: boolean;
  onSent: (text: string) => void;
  /** The schedule changed under the window: the page re-reads it. */
  onStale?: () => void;
  onClose: () => void;
  /** An added part's "Bill it…" / "Change…" (drawing tab 5): Bill the teams for that part, then back here. Absent for a
   *  reader without the club's Accounting — they see "Not billed" or "Bill set", and no door. */
  onBillPart?: (partId: string, keep: SendKeep) => void;
}) {
  const [kind, setKind] = useState<SendKind>(start !== 'draft' ? start : view.bill ? 'review' : 'final');
  const [replyBy, setReplyBy] = useState(view.schedule.replyBy ?? addCalendarDays(tournamentToday(), 7));
  const [preview, setPreview] = useState<Preview | null>(null);
  const [failed, setFailed] = useState(false);
  const [unticked, setUnticked] = useState<Set<string>>(() => new Set(keep?.unticked));
  const [corrections, setCorrections] = useState(keep?.corrections ?? true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const url = `/api/admin/schedules/${encodeURIComponent(view.schedule.id)}/send?${q}`;
  const billParam = kind === 'bill' && bill ?`&bill=${encodeURIComponent(JSON.stringify(bill))}` : '';
  // Bill the corrections off: the preview's emails and lines drop the correction and the credit, as the send will.
  const correctionsParam = kind === 'changes' && !corrections ? '&corrections=0' : '';
  const beginRead = useLatestRead();
  // /design 2026-11-13: while a read is out (the corrections switch moved, the reply date changed), Send waits for it, so
  // what is pressed is what the window says.
  const [reading, setReading] = useState(true);
  const load = useCallback(async () => {
    const current = beginRead();
    setFailed(false);
    setReading(true);
    const r = await moneyFetch<Preview>(`${url}&kind=${kind}${kind === 'review' && isCalendarDate(replyBy) ? `&replyBy=${replyBy}` : ''}${billParam}${correctionsParam}`).catch(() => null);
    if (!current()) return;
    setReading(false);
    if (!r?.ok) { setFailed(true); setError(refusalText(r?.data, W.previewFailed2)); return; }
    setError('');
    setPreview(r.data);
  }, [url, kind, replyBy, billParam, correctionsParam, beginRead]);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => { void load(); });
    return () => window.cancelAnimationFrame(frame);
  }, [load]);

  const shown = preview && preview.kind === kind ? preview : null;
  const teams = shown?.teams ?? [];
  const ticked = teams.filter(t => !unticked.has(t.teamId));
  // A team the user unticked is not emailed at all, so it has no bill to warn about.
  const billNotTold = (shown?.billNotTold ?? []).filter(u => !unticked.has(u.teamId));
  // A house-league team's row reaches its coaches and its households (9d2·2); unticked, neither is emailed (its practices
  // still move — the send is the schedule's, the email is the row's).
  const league = shown?.league?.teams ?? [];
  const leagueGames = shown?.league?.games ?? [];
  const leagueTime = shown?.leagueTime ?? null;
  const leagueTicked = league.filter(t => !unticked.has(t.teamId));
  const gamesOnly = kind === 'changes' && ticked.length === 0 && leagueTicked.length === 0 && leagueGames.length > 0;
  // A family with children on two ticked teams gets one email: households are counted once (opaque keys from the server).
  const people = ticked.reduce((n, t) => n + t.recipients.length, 0) + leagueTicked.reduce((n, t) => n + t.coaches.length, 0)
    + new Set(leagueTicked.flatMap(t => t.households)).size;
  const oneWeekday = oneWeekdayOf(view.slots);
  // A one-weekday schedule counts each team's DAYS ("25 Sundays" — a team can hold two slots a Sunday).
  const daysOf = useMemo(() => {
    const out = new Map<string, Set<string>>();
    for (const x of view.slots) for (const t of x.teamIds) (out.get(t) ?? out.set(t, new Set()).get(t)!).add(x.day);
    return out;
  }, [view.slots]);
  // With no rep team in the send, the sample is the first house-league coach's email.
  const sample: PreviewTeam | null = teams[0] ?? (league[0] ? {
    teamId: league[0].teamId, teamName: league[0].teamName, slots: 0, lines: league[0].lines, groups: [], bill: null, billedCents: null, lost: null,
    recipients: league[0].coaches.map(c => ({ userId: c.userId ?? '', name: c.name, email: c.email, isHeadCoach: false, money: true })),
    sample: league[0].sample, plainSample: null,
  } : null);
  // ⚖ Who gets which email (owner 2026-11-13): on a mixed team the bill's email goes only to the coaches who can open Money,
  // and the rest get the same words without it — the door names someone who actually gets the email it opens.
  const getsSample = (t: PreviewTeam) => t.recipients.filter(r => !getsPlainEmail(t, r));
  const getsPlain = (t: PreviewTeam) => t.recipients.filter(r => getsPlainEmail(t, r));
  // /design 2026-11-13: both doors open ONE team's two emails, so the pair compares like with like — a ticked mixed team
  // when there is one, else the first team (one door).
  const plainTeam = ticked.find(t => t.plainSample) ?? null;
  // With no mixed team ticked the door opens a ticked team's email, never one the sender has unticked.
  const doorTeam = plainTeam ?? ticked.find(t => t.sample) ?? sample;
  const sampleName = doorTeam ? (getsSample(doorTeam).find(r => r.isHeadCoach)?.name ?? getsSample(doorTeam)[0]?.name ?? doorTeam.teamName) : null;
  const plainName = plainTeam ? (getsPlain(plainTeam)[0]?.name ?? getsPlain(plainTeam)[0]?.email ?? plainTeam.teamName) : null;
  const [variant, setVariant] = useState<'money' | 'plain'>('money');
  const firstParts = (shown?.parts ?? []).filter(p => p.first);
  // A part's bill line, under its figure: what the time is, and — for a sender without the club's Accounting, whose Send is held
  // while a bill is set — who sends this one, said before they press (owner 2026-11-17, walk §538 call C4).
  const partBillSub = (p: (typeof firstParts)[number]) => {
    const time = p.line ? P.billLineTime(hoursOf(p.line.minutes), p.line.permitNames, p.line.teamNames) : '';
    const who = !canMoney && p.billSet ? P.billNeedsAccounting : '';
    return time && who ? <>{time}<br />{who}</> : time || who || undefined;
  };
  // The switch shows for a correction of the schedule's own, and ALSO whenever one is blocked (a sent part's correction can block
  // the send while the schedule has none of its own): the blocked send says why and can turn the billing off.
  const correctionShown = kind === 'changes' && (!!shown?.correctionBlocked
    || (!!shown?.correction && (Object.keys(shown.correction.billed).length > 0 || Object.keys(shown.correction.lost).length > 0)));
  const blocked = (shown?.blockers.length ?? 0) > 0 || (kind === 'changes' && corrections && !!shown?.correctionBlocked);

  async function send() {
    if (busy || !shown || blocked || reading || failed) return;
    setBusy(true); setError('');
    try {
      const r = await moneyFetch<{ teams: number; people: number; failed: number; version: number; checks: { clashes: number }; notAll?: string }>(url, jsonInit('POST', {
        kind, version: shown.version, teamIds: ticked.map(t => t.teamId), replyBy: kind === 'review' ? replyBy : null,
        billCorrections: kind === 'changes' ? corrections : undefined,
        bill,
        ...(kind === 'changes' ? { leagueTeamIds: leagueTicked.map(t => t.teamId), leagueSeen: shown.league?.seen ?? '', parts: (shown.parts ?? []).map(p => ({ id: p.id, version: p.version })) } : {}),
      }));
      if (!r.ok) { if (isStale(r.data)) onStale?.(); setError(refusalText(r.data, R.notSaved)); void load(); setBusy(false); return; }
      const text = [gamesOnly ? W.sentNoticeGamesOnly : kind === 'bill' ? W.billSentNotice(r.data.people, r.data.teams, r.data.failed) : W.sentNotice(r.data.people, r.data.teams, r.data.failed), r.data.checks.clashes ? W.sentClash(r.data.checks.clashes) : '', r.data.notAll ?? ''].filter(Boolean).join(' ');
      onSent(text);
    } catch {
      setError(R.notSaved);
      setBusy(false);
    }
  }

  const statement = shown?.statement ?? '';
  const cut = statement.indexOf('. ');
  const title = kind === 'bill' ? W.billSendTitle : kind === 'changes' ? W.changesTitle : start === 'final' ? W.finalizeTitle : kind === 'review' ? W.reviewTitle : W.sendTitle;
  const lv = useSendLevel(title);
  // Only the head coach answers a review (owner 2026-11-14, Q-E): an email that goes only to others reads without the reply.
  const forThem = (to: readonly { isHeadCoach: boolean }[], words: EmailWords) =>
    kind === 'review' && to.length > 0 && !to.some(r => r.isHeadCoach) ? withoutReviewReply(words, shown?.replyBy ?? null) : words;
  const mail = lv.level !== 'email' ? null
    : variant === 'plain' && plainTeam?.plainSample ? { to: getsPlain(plainTeam), words: forThem(getsPlain(plainTeam), plainTeam.plainSample) }
    : doorTeam?.sample ? { to: getsSample(doorTeam), words: forThem(getsSample(doorTeam), doorTeam.sample) } : null;
  const lime = !shown ? W.sendTo(0)
    : kind === 'bill' ? W.billSendGo(people)
    : kind === 'review' ? W.sendToCoaches(people)
    : kind === 'changes' ? gamesOnly ? W.sendToLeagueAdmins : W.sendToPeople(people)
    : start === 'final' ? W.finalizeGo(people) : W.sendTo(people);
  const head = kind === 'review' ? W.whoReviews(ticked.length, people) : kind === 'changes' ? gamesOnly ? W.whoChangesGamesOnly : W.whoChanges(people)
    : W.whoTold(people);
  const teamLine = (t: PreviewTeam, i: number) => {
    // Send the changes: the row's changes are its groups, below the label (`changesBelow`); this line says the rest.
    if (kind === 'changes') return '';
    if (kind === 'bill') return t.bill ? billPhrase(t.bill.cents, t.bill.installments.length) : '';
    const slots = W.teamSlots(t.slots, daysOf.get(t.teamId)?.size ?? 0, oneWeekday);
    if (kind === 'review') return t.bill ? `${slots} · ${billPhrase(t.bill.cents, t.bill.installments.length)}` : slots;
    return i === 0 ? `${W.staffNote} · ${slots}` : slots;
  };
  // The row does NOT name who gets it without the bill (owner 2026-11-13): the question is whether the team is told and
  // whether someone on it can see the money — a head coach always can. The one "See the email … gets" door stays below.
  // Twenty teams is a long list: a row names the head coach(es) only (or the first person, with no head coach marked);
  // the rest of the staff is a small count on the second line (owner 2026-11-13).
  const leads = (t: PreviewTeam) => {
    const heads = t.recipients.filter(r => r.isHeadCoach);
    return heads.length ? heads : t.recipients.slice(0, 1);
  };
  /** ⚖ Send the changes: the team's changes as the page said them — groups, each run opening to its dates — and each money
   *  line on its own line under them, never trailing the last date (owner 2026-11-17, artifact YLos6rKun1mA612uRsChsG).
   *  Drawn below the row's label: Show dates must not tick or untick the team. */
  const changesBelow = (t: PreviewTeam) => {
    if (kind !== 'changes') return null;
    // D7: both money lines plain, as the built lines are.
    const money2 = [t.billedCents ? W.billedCorrection(money(t.billedCents)) : '', t.lost ? HAND_BACK_WORDS.lostLine({ teamName: t.teamName, ...t.lost }) : ''].filter(Boolean);
    return (
      <div className={sch.chSend}>
        <ChangeTeamBlock team={t} />
        {money2.map(line => <p key={line} className={sch.chMoney}>{line}</p>)}
      </div>
    );
  };
  const teamSub = (t: PreviewTeam, i: number) => {
    const line = teamLine(t, i);
    const more = t.recipients.length - leads(t).length;
    return more > 0 ? <>{line}{line && <br />}{W.alsoTold(more)}</> : line;
  };

  return (
    <KitDialog
      kind="form"
      {...(mail ? lv.dialog : {})}
      eyebrow={view.schedule.name}
      title={title}
      onClose={onClose}
      busy={busy}
      footer={(
        <>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>{W.cancel}</button>
          <button type="button" className="btn btn-lime" onClick={() => void send()} disabled={busy || !shown || blocked || reading || failed} aria-busy={reading || undefined}>{busy ? W.sending : lime}</button>
        </>
      )}
    >
      <FormError>{error}</FormError>
      {start === 'draft' && !mail && (
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
      ) : mail ? (
        <MailView to={mail.to.map(r => r.name ?? r.email).join(', ')} subject={mail.words.subject}>
          <EmailWordsSample w={mail.words} />
        </MailView>
      ) : (
        <>
          <Statement lead={cut > 0 ? statement.slice(0, cut + 1) : statement} rest={cut > 0 ? statement.slice(cut + 2) : undefined} />
          {kind === 'review' && (
            <label className={ck.field} htmlFor="send-reply">
              <span className={ck.label}>{W.replyBy}</span>
              <DateInput id="send-reply" className={ck.input} value={replyBy} min={tournamentToday()} onChange={v => setReplyBy(v)} />
            </label>
          )}
          {shown.blockers.length > 0 && (
            <Callout tone="bad" role="alert" icon={<AlertTriangle size={16} aria-hidden />}>
              {shown.blockers.map(b => <span key={b.code + b.error} className={repKit.calloutSub}>{b.error}</span>)}
            </Callout>
          )}
          {(teams.length > 0 || league.length > 0 || leagueGames.length > 0 || !!leagueTime) && (
            <>
              <p className={repKit.factsLabel}>{head}</p>
              <SendRows>
                {teams.map((t, i) => (
                  <SendRow key={t.teamId}
                    title={<><b>{t.teamName}</b> · {leads(t).map(r => r.name ?? r.email).join(', ')}</>}
                    sub={teamSub(t, i)}
                    below={changesBelow(t)}
                    pick={{
                      checked: !unticked.has(t.teamId),
                      onChange: checked => setUnticked(u => { const n = new Set(u); if (checked) n.delete(t.teamId); else n.add(t.teamId); return n; }),
                    }} />
                ))}
                {/* h4: "Reds · Sundays from Nov 8: Field 1 → Field 3, …" over "House league · U9 Rookie · 2 coaches and 11 families". */}
                {league.map(t => (
                  <SendRow key={t.teamId}
                    title={<><b>{t.teamName}</b> · {t.lines.join('; ')}</>}
                    sub={t.group}
                    pick={{
                      checked: !unticked.has(t.teamId),
                      onChange: checked => setUnticked(u => { const n = new Set(u); if (checked) n.delete(t.teamId); else n.add(t.teamId); return n; }),
                    }} />
                ))}
                {/* h4 (9d2·13): "U9 Rookie games · Sun, Nov 15: Field 2 → Field 4" over who sends them to families. No tick:
                    the games move with the send, and families hear from the league admin, never from here. */}
                {leagueGames.map(g => (
                  <SendRow key={g.key} title={<><b>{g.name}</b> · {g.line}</>} sub={g.sub} />
                ))}
                {/* Stage 13d (A2, drawing tab 2 note 3): "House league · Jules Moreau, league admin: 2 hours a week to divide" over
                    "bell". No tick: the bell goes with the send. With no league admin, owners and admins hear it. */}
                {leagueTime && (() => {
                  const T = TIME_HANDOFF_WORDS.whoTold, named = leagueTime.leagueAdmins.length > 0;
                  const what = T.what(leagueTime.givenMinutes, leagueTime.takenMinutes);
                  return (
                    <SendRow
                      title={<><b>{T.title}</b>{named ? <> · {T.who(leagueTime.leagueAdmins)}: {what}</> : <>: {T.who([])}, {T.byBell}</>}</>}
                      sub={named ? T.how : what} />
                  );
                })()}
              </SendRows>
            </>
          )}
          {shown.unreachable.length > 0 && (
            <Callout tone="warn" role="note" icon={<AlertTriangle size={16} aria-hidden />}>
              <b>{W.nobodyHead(shown.unreachable.length)}</b>
              {shown.unreachable.map(u => <span key={u.teamId} className={repKit.calloutSub}>{u.sentence}</span>)}
            </Callout>
          )}
          {/* Finalize / changes: a team emailed its slots whose bill reaches nobody who can open Money — information, never a
              blocker (owner 2026-11-13). */}
          {billNotTold.length > 0 && (
            <Callout tone="warn" role="note" icon={<AlertTriangle size={16} aria-hidden />}>
              <b>{W.billNotToldHead(billNotTold.length)}</b>
              {billNotTold.map(u => <span key={u.teamId} className={repKit.calloutSub}>{u.sentence}</span>)}
            </Callout>
          )}
          {/* Phase 8 (drawing tab 5, note 2): each unsent part's bill of its own — "Not billed · Bill it…", then the figure and
              "Change…". The window it opens is the whole Bill the teams, for that part. */}
          {kind === 'changes' && firstParts.map(p => (
            <div key={p.id}>
              <p className={repKit.factsLabel}>{P.billLineHead(p.label)}</p>
              <SendRows>
                <SendRow
                  title={<b>{p.line?.bill ? P.billLineSet(money(p.line.bill.cents), p.line.bill.teamNames, p.line.bill.payments, p.line.bill.firstDue ? formatStoredDate(p.line.bill.firstDue, { withYear: false }) : null) : p.billSet ? P.billedNoFigure : P.notBilled}</b>}
                  sub={partBillSub(p)}
                  below={onBillPart ? <button type="button" className={sch.door} onClick={() => onBillPart(p.id, { unticked: [...unticked], corrections })} disabled={busy}>{p.billSet ? P.billChange : P.billIt}</button> : null} />
              </SendRows>
            </div>
          ))}
          {correctionShown && shown && (
            <label className={sch.switchLine}>
              <input type="checkbox" checked={corrections} onChange={e => setCorrections(e.target.checked)} />
              <span>
                <b>{W.billCorrections}</b>
                <span className={repKit.calloutSub}>{corrections ? W.billCorrectionsOn : W.billCorrectionsOff}</span>
                {corrections && !!shown.newPrices?.length && (
                  <span className={repKit.calloutSub}>{W.billNewPermitPrice(shown.newPrices.map(x => ({ name: x.permitName, hour: money(Math.round(x.fullHour * 100)) })))}</span>
                )}
                {corrections && shown.correctionBlocked && <span className={repKit.formError}>{shown.correctionBlocked.error}</span>}
              </span>
            </label>
          )}
          {/* Tab 5, note 3: with added parts and nothing to correct, the switch is absent — said once, so its absence reads. */}
          {kind === 'changes' && firstParts.length > 0 && !correctionShown && <p className={ck.hint}>{P.correctionsOnlyOwn(view.schedule.name)}</p>}
          <p className={ck.hint}>
            {gamesOnly ? <>{W.changesHintLeagueGames}{' '}</> : <>
              {kind === 'review' ? W.reviewHint : kind === 'changes' ? W.changesHint : kind === 'bill' ? W.billSendHint : W.emailHint}{' '}
              {league.length > 0 ? <>{W.changesHintLeague}{' '}</> : leagueGames.length > 0 && <>{W.changesHintLeagueGames}{' '}</>}
            </>}
            {shown.lastSent ? W.lastSent(formatStoredDate(shown.lastSent.at), shown.lastSent.by) : W.notSentYet}
          </p>
          {/* The email door, and — for a mixed team — the door to the email its coaches without Money get. A lone door stays left. */}
          {(doorTeam?.sample || plainName) && (
            <SendDoors>
              {doorTeam?.sample && (
                <SendDoor onOpen={() => { setVariant('money'); lv.open('email'); }}>
                  {plainName ? W.seeMoneyEmail(sampleName ?? doorTeam.teamName) : W.seeEmail(sampleName ?? doorTeam.teamName)}
                </SendDoor>
              )}
              {plainName && <SendDoor onOpen={() => { setVariant('plain'); lv.open('email'); }}>{W.seePlainEmail(plainName)}</SendDoor>}
            </SendDoors>
          )}
        </>
      )}
    </KitDialog>
  );
}
