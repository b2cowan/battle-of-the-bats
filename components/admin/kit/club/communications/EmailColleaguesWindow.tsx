'use client';
/**
 * EMAIL COACHES · EMAIL THE BOARD (Club Communications Stage 1, Session 3; coach drawing tabs 2–5 and 7, Stage 1 drawing
 * tab 8). ONE window for the club's two colleague mails, on the shipped send window's parts (`../SendParts`): what sending
 * does in one statement; Who — a row each, each with its LIVE count; Subject and Message; the lines under the box that say
 * who can read the email afterwards; the reply choice (R2–R4); "See who gets it" and "See the email" as the window's other
 * two levels; Last sent; and the foot — the count sentence left, Cancel and the lime that counts who it reaches, right.
 *
 * ⚖ The window only DRAWS what the server answers. Who may send, which groups this seat is offered, who is in each group and
 * what the recount compares are the server's (`lib/club-group-email.ts`, `lib/club-group-email-rules.ts`); a group that was
 * not offered is not drawn, and one posted by hand is refused anyway. No response carries a recipient's address, so none is shown:
 * people are names and a team or role line (legal §2c, T17).
 *
 * At Send the server reads the group again and compares the PEOPLE, not the count: if anyone was added or taken off, nothing
 * goes, the foot says who changed, and the lime takes the new count to be pressed again (coach ask 11). A press that lost to
 * "just sent" says so in the lime's place.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import KitDialog, { DialogCancel } from '../KitDialog';
import ck from '../ClubKit.module.css';
import { repKit, useLatestRead } from '../RepKit';
import { Statement } from '../schedules/ScheduleParts';
import { MailView, SendDoor, SendDoors, SendRow, SendRows, SendStanding, SendWhoList, useSendLevel } from '../SendParts';
import { FormError, jsonInit, moneyFetch, refusalText } from '../money/MoneyKit';
import LoadingState from '@/components/shared/LoadingState';
import SublinedChoice from '@/components/coaches/SublinedChoice';
import shared from '@/app/[orgSlug]/coaches/coaches.module.css';
import { FAMILY_EMAIL_WORDS as W, SEND_VIEW_WORDS as VW, inThisYear } from '@/lib/families-words';
import { GROUP, RECORD, SAY, WINDOW as CW, type ColleagueKind, type ReplyChoices } from '@/lib/club-group-email-words';
import { formatStoredDate } from '@/lib/timezone';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import { ReplyChoice, useReplyChoice } from './ReplyParts';

interface Person { key: string; name: string; line: string | null }
interface LeagueSeason { id: string; name: string; count: number; divisions: { id: string; name: string; count: number }[] }
interface Options {
  kind: ColleagueKind;
  replies: ReplyChoices;
  senderNamed: boolean;
  lastSent: { at: string; by: string | null; subject: string | null; reached: number } | null;
  pick: Person[];
  copy: boolean;
  // coaches
  groups?: { all: { count: number } | null; rep: { count: number; headCount: number } | null; league: LeagueSeason[] | null };
  tournament?: { name: string } | null;
  // board
  offered?: boolean;
  count?: number;
}
interface Audience {
  count: number; people: Person[]; noAddress: number; invited: string[]; pending: number; pendingNamed: Person[] | null;
}
type Choice = 'all' | 'rep' | 'league' | 'picked' | 'board_all' | 'board_picked';

/** "Send again to these people" (a record's door): the window opens on the pick, with the subject copied and no message. */
export interface SendAgain { keys: string[]; subject: string | null; dropped: number }

const WHO_SEARCH_FROM = 8;

export default function EmailColleaguesWindow({ kind, q, slug, eyebrow, again, onClose, onSent }: {
  kind: ColleagueKind;
  /** `orgSlug=…` */
  q: string;
  slug: string;
  /** The small line above the title: "Communications" when opened there. */
  eyebrow: string;
  again?: SendAgain;
  onClose: () => void;
  onSent: (text: string) => void;
}) {
  const phone = useIsPhone();
  const board = kind === 'board';
  const base = `/api/admin/club-emails?${q}`;

  const [options, setOptions] = useState<Options | null>(null);
  const [failed, setFailed] = useState(false);
  const [choice, setChoice] = useState<Choice | null>(again ? (board ? 'board_picked' : 'picked') : null);
  const [repHead, setRepHead] = useState(false);
  const [seasonId, setSeasonId] = useState('');
  const [divisionId, setDivisionId] = useState('');
  const [pickKeys, setPickKeys] = useState<string[]>(again?.keys ?? []);
  const [search, setSearch] = useState('');
  const [subject, setSubject] = useState(again?.subject ?? '');
  const [message, setMessage] = useState('');
  const [audience, setAudience] = useState<{ key: string; a: Audience } | null>(null);
  const [countFailed, setCountFailed] = useState(false);
  const [mail, setMail] = useState<{ html: string; fromName: string } | 'failed' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [standing, setStanding] = useState<string | null>(null);
  const [changed, setChanged] = useState<{ text: string; who: string } | null>(null);
  const lv = useSendLevel(VW.backToMessage);
  // The board opens on "Replies come to me" (owner 2026-11-20, as /legal recommends: the club's inbox is often shared).
  const reply = useReplyChoice(options?.replies ?? null, board ? 'sender' : undefined);

  // ── What the window offers this seat ──
  const beginOptions = useLatestRead();
  const loadOptions = useCallback(async () => {
    const current = beginOptions();
    setFailed(false);
    const r = await moneyFetch<Options>(`${base}&kind=${kind}`).catch(() => null);
    if (!current()) return;
    if (!r?.ok) { setFailed(true); return; }
    setOptions(r.data);
  }, [base, kind, beginOptions]);
  useEffect(() => {
    const t = window.setTimeout(() => { void loadOptions(); }, 0);
    return () => window.clearTimeout(t);
  }, [loadOptions]);

  const g = options?.groups ?? null;
  const seasons = g?.league ?? [];
  // The first group this seat is offered is chosen (a club with one group has its row already chosen — drawing tab 2).
  const first: Choice | null = !options ? null : board ? 'board_all' : g?.all ? 'all' : g?.rep ? 'rep' : seasons.length > 0 ? 'league' : 'picked';
  const chosen: Choice | null = choice ?? first;
  const season = seasons.find(s => s.id === seasonId) ?? seasons[0] ?? null;

  /** The group as the server reads it, or null while the sender has not picked yet (the foot then asks for a pick). */
  const groupBody = useMemo((): Record<string, unknown> | null => {
    if (!options || !chosen) return null;
    switch (chosen) {
      case 'board_all': return { kind, group: 'board_all' };
      case 'board_picked': return pickKeys.length > 0 ? { kind, group: 'board_picked', keys: pickKeys } : null;
      case 'all': return { kind, group: 'coaches_all' };
      case 'rep': return { kind, group: repHead ? 'rep_head' : 'rep_staff' };
      case 'league': return season ? (divisionId && season.divisions.some(d => d.id === divisionId)
        ? { kind, group: 'league_division', seasonId: season.id, divisionId } : { kind, group: 'league_season', seasonId: season.id }) : null;
      case 'picked': return pickKeys.length > 0 ? { kind, group: 'coaches_picked', keys: pickKeys } : null;
    }
  }, [options, chosen, kind, repHead, season, divisionId, pickKeys]);
  const whoKey = JSON.stringify(groupBody);
  const picking = chosen === 'picked' || chosen === 'board_picked';

  // ── Who it reaches: read again on every change of Who, never summed in the browser. A tick waits a moment. ──
  const beginCount = useLatestRead();
  const count = useCallback(async () => {
    // Begun first, so a response still on its way for a group the sender has since left can never land.
    const current = beginCount();
    if (!groupBody) return;
    setCountFailed(false);
    const r = await moneyFetch<Audience>(base, jsonInit('POST', { action: 'count', ...groupBody })).catch(() => null);
    if (!current()) return;
    if (!r?.ok) { setCountFailed(true); return; }
    setAudience({ key: whoKey, a: r.data });
  }, [groupBody, base, whoKey, beginCount]);
  // A press that comes back "changed" re-counts with the LATEST count, not the one its closure was made with.
  const countNow = useRef(count);
  useEffect(() => { countNow.current = count; }, [count]);
  useEffect(() => {
    const t = window.setTimeout(() => { void count(); }, picking ? 250 : 0);
    return () => window.clearTimeout(t);
  }, [count, picking]);

  const ready = !!audience && audience.key === whoKey && !countFailed;
  const a = ready ? audience!.a : null;
  const nobodyPicked = options !== null && groupBody === null;

  // ── The foot ──
  const nobody = nobodyPicked ? (board ? SAY.pickMembers : SAY.pickCoaches)
    : a && a.count === 0 ? (board ? SAY.nobodyBoard : SAY.nobodyCoaches) : null;
  // R1: a sender with no name on file is refused, so the lime is absent and the foot says what to add (said up front, not after Send).
  const held = standing ?? (options && !options.senderNamed ? SAY.needName : null) ?? nobody;
  const counting = options && groupBody && !ready && !countFailed ? CW.counting : null;
  const sentence = a && a.count > 0 ? [
    board ? CW.boardFoot(a.count) : CW.coachFoot(a.count),
    a.invited.length > 0 ? CW.invitedCoaches(a.invited.length) : null,
    a.pending > 0 ? CW.invitedMembers(a.pending) : null,
    a.noAddress > 0 ? CW.noAddressCoaches(a.noAddress) : null,
  ].filter(Boolean).join(' ') : null;

  async function send() {
    if (busy || !a || held || !groupBody) return;
    if (!subject.trim()) { setError(SAY.needSubject); return; }
    if (!message.trim()) { setError(SAY.needMessage); return; }
    setBusy(true); setError(''); setChanged(null);
    try {
      const r = await moneyFetch<{
        reached?: number; failed?: number; count?: number; copy?: string | null; missedNamed?: string[] | null;
        people?: Person[]; code?: string; error?: string;
      }>(base, jsonInit('POST', {
        action: 'send', ...groupBody, subject, body: message, expected: a.people.map(p => ({ key: p.key, name: p.name })),
        ...reply.fields,
      }));
      if (r.ok) {
        const reached = r.data.reached ?? 0, of = r.data.count ?? a.count, missed = of - reached;
        const said = [
          CW.sent(kind, reached, of),
          missed > 0 ? CW.missed(missed, r.data.missedNamed && r.data.missedNamed.length > 0 ? r.data.missedNamed.join(', ') : null) : null,
          r.data.copy === 'sent' ? RECORD.copySent : r.data.copy === 'failed' ? RECORD.copyFailed : r.data.copy === 'already_listed' ? RECORD.copyListed : null,
        ].filter(Boolean).join(' ');
        onSent(said);
        return;
      }
      const code = r.data?.code;
      if (!code && r.status >= 500) { setError(W.unknown); return; }
      if (code === 'just_sent') setStanding(refusalText(r.data, SAY.failed));
      else if (code === 'changed') {
        // The people changed while the sender wrote: nothing went; the new people replace the old, and the lime takes them.
        setChanged({ text: refusalText(r.data, SAY.failed), who: whoKey });
        if (r.data.people) setAudience({ key: whoKey, a: { ...a, count: r.data.count ?? r.data.people.length, people: r.data.people } });
        void countNow.current();
      } else { setError(refusalText(r.data, SAY.failed)); if (code === 'nobody') void countNow.current(); }
    } catch {
      // No answer: it may have gone. Say so, rather than inviting a second press.
      setError(W.unknown);
    } finally {
      setBusy(false);
    }
  }

  // ── The two levels behind the form ──
  async function openEmail() {
    if (!groupBody) return;
    lv.open('email');
    setMail(null);
    const r = await moneyFetch<{ html: string; fromName: string }>(base, jsonInit('POST', {
      action: 'preview', ...groupBody, subject: subject.trim() || undefined, body: message.trim() || undefined, ...reply.fields,
    })).catch(() => null);
    setMail(r?.ok ? r.data : 'failed');
  }
  const canSeeWho = !!a && a.count > 0;
  const showMail = lv.level === 'email' && !!groupBody;
  const showWho = lv.level === 'who' && canSeeWho;
  const showForm = !showMail && !showWho;

  const clubName = options?.replies.club?.name ?? '';
  const address = reply.address ?? '';
  const statement = !options || !reply.address ? null : board ? CW.boardStatement(reply.mode, clubName, address)
    : phone ? CW.coachStatementPhone(reply.mode) : CW.coachStatement(reply.mode, clubName, address);

  const last = options?.lastSent ?? null;
  const lastDate = last ? formatStoredDate(last.at, { withYear: !inThisYear(last.at) }) : '';
  const title = board ? CW.boardTitle : CW.coachTitle;
  const toggleKey = (key: string) => { setPickKeys(ks => ks.includes(key) ? ks.filter(k => k !== key) : [...ks, key]); setStanding(null); setError(''); };
  const pickOf = (c: Choice) => { setChoice(c); setStanding(null); setError(''); };

  return (
    <KitDialog
      kind="form"
      size="medium"
      {...(showForm ? {} : lv.dialog)}
      eyebrow={eyebrow}
      title={title}
      onClose={onClose}
      busy={busy}
      dirty={subject !== (again?.subject ?? '') || message.trim() !== ''}
      discardAsk={CW.discardAsk}
      footerStart={held ? <SendStanding>{held}</SendStanding>
        : changed?.who === whoKey ? <SendStanding>{changed.text}</SendStanding>
        : counting ? <p className={ck.hint} role="status">{counting}</p>
        : sentence ? <p className={ck.hint} role="status">{sentence}</p> : undefined}
      footer={(
        <>
          <DialogCancel>{W.cancel}</DialogCancel>
          {!held && !counting && ready && a && a.count > 0 && (
            <button type="button" className="btn btn-lime" onClick={() => void send()} disabled={busy}>
              {busy ? W.sending : W.send(a.count)}
            </button>
          )}
        </>
      )}
    >
      <FormError>{error}</FormError>
      {countFailed && options && showForm && (
        <p className={repKit.formError}>{CW.countFailed} <button type="button" className={repKit.inlineLink} onClick={() => void count()}>{W.tryAgain}</button></p>
      )}
      {failed ? (
        <p className={repKit.formError}>{CW.countFailed} <button type="button" className={repKit.inlineLink} onClick={() => void loadOptions()}>{W.tryAgain}</button></p>
      ) : !options ? (
        <LoadingState inline label="Loading who this reaches…" />
      ) : showMail ? (
        <>
          <MailView from={mail && mail !== 'failed' ? mail.fromName : undefined} subject={subject.trim() || W.subject}
            to={CW.mailTo(kind, a?.count ?? 0)} onTo={canSeeWho ? () => lv.open('who') : undefined}>
            {mail === null ? <LoadingState inline label={CW.loadingEmail} />
              : mail === 'failed' ? <p className={repKit.formError} role="alert">{CW.mailFailed}</p>
              // Our own rendering of the email, every word escaped (`renderColleagueEmail`); no scripts run in it.
              : <MailFrame html={mail.html} title={subject.trim() || W.subject} />}
          </MailView>
          <p className={ck.hint}>{CW.mailNote}</p>
        </>
      ) : showWho && a ? (
        <SendWhoList head={CW.whoHead(kind, a.count)} items={[
          ...a.people.map(p => ({ title: p.name, sub: p.line ?? undefined })),
          ...a.invited.map(line => ({ title: line, sub: CW.wontInvited, off: true })),
          ...(a.pendingNamed ?? []).map(p => ({ title: p.name, sub: CW.wontInvited, off: true })),
          ...(a.noAddress > 0 ? [{ title: CW.wontNoEmail(a.noAddress), off: true }] : []),
        ]} />
      ) : (
        <>
          {statement ? <Statement lead={statement} /> : null}
          <p className={repKit.factsLabel} id="email-colleagues-who-label">{W.who}</p>
          {board ? boardWho() : coachWho()}
          <label className={ck.field} htmlFor="email-colleagues-subject" style={{ marginTop: '0.9rem' }}>
            <span className={ck.label}>{W.subject}<span className={ck.required} aria-hidden>*</span></span>
            <input id="email-colleagues-subject" className={ck.input} value={subject} maxLength={200}
              onChange={e => { setSubject(e.target.value); setError(''); setStanding(null); }} aria-required data-autofocus="" />
          </label>
          <label className={ck.field} htmlFor="email-colleagues-body">
            <span className={ck.label}>{W.message}<span className={ck.required} aria-hidden>*</span></span>
            <textarea id="email-colleagues-body" className={ck.textarea} value={message} maxLength={5000} rows={7}
              placeholder={W.messagePlaceholder}
              onChange={e => { setMessage(e.target.value); setError(''); setStanding(null); }} aria-required />
          </label>
          {/* Who can read this afterwards, and what it is not for (legal C7; Stage 1 ask 11). */}
          <p className={ck.hint}>{board ? CW.boardReaders : CW.readers}</p>
          <p className={ck.hint}>{CW.notToPromote}</p>
          {again && again.dropped > 0 && <p className={ck.hint}>{CW.againDropped(again.dropped)}</p>}
          <ReplyChoice idBase="email-colleagues" replies={options.replies} state={reply} offerCopy={!board && options.copy} />
          <SendDoors>
            {canSeeWho && <SendDoor onOpen={() => lv.open('who')}>{W.seeWho}</SendDoor>}
            {groupBody && <SendDoor onOpen={() => void openEmail()}>{W.seeEmail}</SendDoor>}
          </SendDoors>
          {last && (
            <p className={ck.hint}>{`${CW.lastSent} ${CW.lastSentValue(lastDate, last.by, last.subject, last.reached, kind)}.`}</p>
          )}
          {!board && options.tournament && (
            // The one pointer line, only while a tournament is running: its coaches are emailed from the tournament.
            <p className={ck.hint}>
              {CW.tournamentPointer(options.tournament.name)}{' '}
              <Link className={repKit.inlineLink} href={`/${slug}/admin/tournaments/communication`}>{CW.tournamentPointerLink}</Link>
            </p>
          )}
        </>
      )}
    </KitDialog>
  );

  // ── Coaches' Who (coach drawing tabs 2 and 5) ──
  function coachWho() {
    if (!g) return null;
    const leagueCount = season ? (divisionId ? season.divisions.find(d => d.id === divisionId)?.count ?? season.count : season.count) : 0;
    const row = (c: Choice, title: React.ReactNode, sub: React.ReactNode, off?: boolean) => (
      <SendRow key={c} title={title} sub={sub} off={off} pick={{ checked: chosen === c, onChange: on => on && pickOf(c), radio: 'email-colleagues-who' }} />
    );
    return (
      <>
        <SendRows group={{ radio: true, labelledBy: 'email-colleagues-who-label' }}>
          {g.all && row('all', <>{GROUP.coachesAll}{GROUP.count(g.all.count)}</>, GROUP.coachesAllSub, g.all.count === 0)}
          {g.rep && row('rep', <>{GROUP.repStaff}{GROUP.count(repHead ? g.rep.headCount : g.rep.count)}</>, GROUP.repStaffSub, g.rep.count === 0)}
          {seasons.length > 0 && row('league', <>{GROUP.league}{GROUP.count(leagueCount)}</>, season?.name, leagueCount === 0)}
          {row('picked', GROUP.picked, GROUP.pickedSub)}
        </SendRows>
        {chosen === 'rep' && g.rep && (
          <SendRows group={{ radio: true, label: GROUP.repStaff }}>
            <SendRow title={<>{GROUP.repEveryone}{GROUP.count(g.rep.count)}</>}
              pick={{ checked: !repHead, onChange: on => { if (on) { setRepHead(false); setStanding(null); } }, radio: 'email-colleagues-rep' }} />
            <SendRow title={<>{GROUP.repHeadOnly}{GROUP.count(g.rep.headCount)}</>}
              pick={{ checked: repHead, onChange: on => { if (on) { setRepHead(true); setStanding(null); } }, radio: 'email-colleagues-rep' }} />
          </SendRows>
        )}
        {chosen === 'league' && season && (
          <>
            {seasons.length > 1 && (
              <div className={ck.field}>
                <label className={ck.label} htmlFor="email-colleagues-season">{GROUP.seasonLabel}</label>
                <SublinedChoice id="email-colleagues-season" label={GROUP.seasonLabel} variant="toolbar"
                  triggerClassName={`${ck.select} ${shared.convChoiceToolbarField}`}
                  options={seasons.map(s => ({ value: s.id, name: s.name, sub: s.count === 0 ? GROUP.noCoachesYet : String(s.count) }))}
                  value={season.id}
                  onChange={v => { setSeasonId(v); setDivisionId(''); setStanding(null); }} />
              </div>
            )}
            {season.divisions.length > 0 && (
              <div className={ck.field}>
                <label className={ck.label} htmlFor="email-colleagues-division">{GROUP.divisionLabel}</label>
                <SublinedChoice id="email-colleagues-division" label={GROUP.divisionLabel} variant="toolbar"
                  triggerClassName={`${ck.select} ${shared.convChoiceToolbarField}`}
                  options={[{ value: '', name: GROUP.everyDivision, sub: String(season.count) },
                    ...season.divisions.map(d => ({ value: d.id, name: d.name, sub: d.count === 0 ? GROUP.noCoachesYet : String(d.count) }))]}
                  value={divisionId}
                  onChange={v => { setDivisionId(v); setStanding(null); }} />
              </div>
            )}
          </>
        )}
        {chosen === 'picked' && pickRows()}
      </>
    );
  }

  // ── The board's Who (Stage 1 drawing tab 8) ──
  function boardWho() {
    const everyone = options?.count ?? 0;
    return (
      <>
        <SendRows group={{ radio: true, labelledBy: 'email-colleagues-who-label' }}>
          <SendRow title={<>{GROUP.boardAll}{GROUP.count(everyone)}</>} sub={GROUP.boardAllSub}
            pick={{ checked: chosen === 'board_all', onChange: on => on && pickOf('board_all'), radio: 'email-colleagues-who' }} />
          <SendRow title={GROUP.boardPicked} sub={GROUP.boardPickedSub}
            pick={{ checked: chosen === 'board_picked', onChange: on => on && pickOf('board_picked'), radio: 'email-colleagues-who' }} />
        </SendRows>
        {chosen === 'board_picked' && pickRows()}
      </>
    );
  }

  // ── The one-off pick: ticks from the live list, for this email only (coach drawing tab 5) ──
  function pickRows() {
    const people = options?.pick ?? [];
    const t = search.trim().toLowerCase();
    const shown = t ? people.filter(p => `${p.name} ${p.line ?? ''}`.toLowerCase().includes(t)) : people;
    return (
      <>
        <p className={ck.hint}>{GROUP.pickNote}</p>
        {people.length > WHO_SEARCH_FROM && (
          <>
            <input type="search" className={ck.input} value={search} onChange={e => setSearch(e.target.value)}
              placeholder={CW.pickedSearch} aria-label={CW.pickedSearch} />
            {t && shown.length === 0 && <p className={ck.hint} role="status">{VW.noMatch(search.trim())}</p>}
          </>
        )}
        {shown.length > 0 && (
          <SendRows group={{ label: board ? GROUP.boardPicked : GROUP.picked }}>
            {shown.map(p => (
              <SendRow key={p.key} title={p.name} sub={p.line ?? undefined}
                pick={{ checked: pickKeys.includes(p.key), onChange: () => toggleKey(p.key) }} />
            ))}
          </SendRows>
        )}
      </>
    );
  }
}

/** The email as it will arrive, drawn from the server's own rendering in a frame that runs nothing and grows to its content. */
function MailFrame({ html, title }: { html: string; title: string }) {
  const [height, setHeight] = useState(360);
  return (
    <iframe
      title={title} srcDoc={html} sandbox="allow-same-origin" style={{ width: '100%', border: 0, height }}
      onLoad={e => {
        const h = e.currentTarget.contentDocument?.documentElement?.scrollHeight;
        if (h) setHeight(Math.min(Math.max(h, 200), 1400));
      }}
    />
  );
}
