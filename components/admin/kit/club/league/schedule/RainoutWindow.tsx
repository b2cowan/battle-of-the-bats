'use client';
/**
 * RAINOUT (House League 9e-2; rulings 9e·10 to 9e·14; drawings HOUSE_LEAGUE_STAGE9E_DRAWINGS.html, the Rainout tab, r2–r3;
 * words HOUSE_LEAGUE_STAGE9E_COPY.md Part C via `RAIN_WORDS`). One window calls off a day's games across divisions: the
 * day, postpone (the default) or cancel, which games (each published division's, ticked), an optional line for the
 * email, and "Email the families now" (ticked). The list and the sentences under it are the preview: there is no second
 * screen. Then the result, in the same window: told (no Undo — emails can't be taken back), one send failed, or held
 * (Put all back, which works until the changes are sent).
 * The window reads the season itself (`GET …/rainout`): a rainout spans divisions and the page is scoped to one. The
 * press carries each game as the window saw it; a game changed since is refused and nothing is written.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import KitDialog, { DialogCancel } from '../../KitDialog';
import ck from '../../ClubKit.module.css';
import { repKit } from '../../RepKit';
import { SendRow, SendRows } from '../../SendParts';
import { Statement } from '../../schedules/ScheduleParts';
import FormTable, { type FormTableGroup, type FormTableRow } from '@/components/shared/FormTable';
import { ViewSwitch } from '@/components/coaches/kit';
import { CheckChoice } from '@/components/admin/tournament/ScreenParts';
import LoadingState from '@/components/shared/LoadingState';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import { formatShortWeekdayDate } from '@/lib/timezone';
import {
  RAIN_LINE_MAX, RAIN_WORDS as W, rainDays, rainList, rainOpenDay, rainPractices, rainSummary, shortDivision,
  type RainSendDivision, type RainSource, type RainVerb,
} from '@/lib/league-rainout';
import { PutBackQuestion, rainoutAction } from './RainoutParts';
import { reachedLine } from '@/lib/league-schedule-words';
import r from './Rainout.module.css';

type Result =
  | { kind: 'sent'; verb: RainVerb; day: string; games: number; teams: number; divisions: RainSendDivision[] }
  | { kind: 'held'; verb: RainVerb; day: string; games: number; teams: number; rainoutId: string };

export default function RainoutWindow({ seasonName, api, orgQuery, teamName, schedulesHref, onChanged, onNotice, onOpenChanges, onNewDates, onClose }: {
  seasonName: string;
  /** `/api/admin/house-league/seasons/{id}/schedule` */
  api: string;
  orgQuery: string;
  teamName: (teamId: string) => string;
  /** The club's Schedules (where a practice on the club's time changes), or null when this person can't open them. */
  schedulesHref: string | null;
  /** Games changed: the page reads the season again. */
  onChanged: () => void;
  /** A passing sentence for the page ("12 games put back. Nothing was sent."). */
  onNotice: (said: string) => void;
  onOpenChanges: (divisionId: string | null) => void;
  /** "Give them new dates": the page shows that division's "Needs a new date". */
  onNewDates: (divisionId: string) => void;
  onClose: () => void;
}) {
  const phone = useIsPhone();
  const [source, setSource] = useState<RainSource | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [day, setDay] = useState<string | null>(null);
  const [place, setPlace] = useState('');
  const [verb, setVerb] = useState<RainVerb>('postponed');
  const [ticked, setTicked] = useState<Set<string>>(() => new Set());
  const [emailNow, setEmailNow] = useState(true);
  const [line, setLine] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [askBack, setAskBack] = useState(false);
  const url = `${api}/rainout${orgQuery}`;

  const read = useCallback(async (): Promise<RainSource | null> => {
    const res = await fetch(url, { cache: 'no-store' }).catch(() => null);
    const data = res?.ok ? await res.json().catch(() => null) : null;
    return (data as { source?: RainSource } | null)?.source ?? null;
  }, [url]);

  /** Every listed game of a day and place is ticked: a rainout is usually the whole day (r2), and a filter resets ticks. */
  const tickAll = (src: RainSource, d: string | null, p: string) =>
    new Set(d ? rainList(src, d, p || null).divisions.flatMap(x => x.games.map(g => g.id)) : []);

  useEffect(() => {
    let live = true;
    void read().then(src => {
      if (!live) return;
      if (!src) { setLoadFailed(true); return; }
      const open = rainOpenDay(src);
      setSource(src); setDay(open); setTicked(tickAll(src, open, ''));
    });
    return () => { live = false; };
  }, [read]);

  const days = useMemo(() => (source ? rainDays(source) : []), [source]);
  const list = useMemo(() => (source && day ? rainList(source, day, place || null) : null), [source, day, place]);
  const sum = useMemo(() => (source ? rainSummary(source, ticked) : null), [source, ticked]);
  const practices = useMemo(() => (source && day ? rainPractices(source, day) : null), [source, day]);

  function pickDay(d: string) {
    if (!source) return;
    setDay(d); setPlace(''); setTicked(tickAll(source, d, ''));
  }
  function pickPlace(p: string) {
    if (!source) return;
    setPlace(p); setTicked(tickAll(source, day, p));
  }
  const tick = useCallback((ids: readonly string[], on: boolean) => setTicked(prev => {
    const next = new Set(prev);
    for (const id of ids) { if (on) next.add(id); else next.delete(id); }
    return next;
  }), []);

  async function press() {
    if (!source || !day || !sum || sum.games === 0) return;
    setBusy(true); setError(null);
    const games = source.games.filter(g => ticked.has(g.id)).map(g => ({ id: g.id, seen: g.seen }));
    const res = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verb, day, line, games, emailNow }),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => null) : null;
    if (!res?.ok || !data) {
      setError((data as { error?: string } | null)?.error ?? W.errChanged);
      // Refused because a game moved on: read again, keeping the ticks that still name a game listed on this day and
      // place (r5); a day with nothing left falls back to the next day with games, every game ticked.
      if (res?.status === 409) {
        const src = await read();
        if (src) {
          const still = rainDays(src).some(d => d.day === day) ? day : rainOpenDay(src);
          const listedNow = new Set(still ? rainList(src, still, place || null).divisions.flatMap(x => x.games.map(g => g.id)) : []);
          setSource(src);
          if (still === day) setTicked(prev => new Set([...prev].filter(id => listedNow.has(id))));
          else { setDay(still); setPlace(''); setTicked(tickAll(src, still, '')); }
        }
      }
      setBusy(false);
      return;
    }
    setBusy(false);
    onChanged();
    const d = data as { rainoutId: string; held: boolean; games: number; teams: number; divisions?: RainSendDivision[] };
    setResult(d.held
      ? { kind: 'held', verb, day, games: d.games, teams: d.teams, rainoutId: d.rainoutId }
      : { kind: 'sent', verb, day, games: d.games, teams: d.teams, divisions: d.divisions ?? [] });
  }

  /** The held sheet: Send the changes, or Put all back. */
  async function act(action: 'send' | 'back') {
    if (result?.kind !== 'held') return;
    setBusy(true); setError(null);
    const res = await rainoutAction<{ divisions?: RainSendDivision[] }>(api, orgQuery, result.rainoutId, action);
    setBusy(false); setAskBack(false);
    if (!res.ok) { setError(res.error); return; }
    onChanged();
    if (action === 'back') { onNotice(W.backDone(result.games)); onClose(); return; }
    setResult({ ...result, kind: 'sent', divisions: res.data.divisions ?? [] });
  }

  // The list as the form table reads it (memoized: typing the line re-renders the window).
  const rows: FormTableRow[] = useMemo(() => (list?.divisions ?? []).flatMap(d => d.games.map(g => {
    const name = W.game(teamName(g.homeTeamId), teamName(g.awayTeamId));
    const where = W.gameWhere(g.scheduledAt, g.place, g.field);
    return {
      key: g.id, group: d.id, name, cells: { when: where }, phoneLine: where,
      ticked: ticked.has(g.id), onTick: (on: boolean) => tick([g.id], on), tickLabel: name,
    };
  })), [list, ticked, teamName, tick]);
  const groups: FormTableGroup[] = useMemo(() => (list?.divisions ?? []).map(d => {
    const n = d.games.filter(g => ticked.has(g.id)).length;
    return {
      key: d.id, label: d.name, count: W.divCounts(d.games.length, d.teams),
      state: n === 0 ? 'none' : n === d.games.length ? 'all' : 'some',
      onTick: on => tick(d.games.map(g => g.id), on), tickLabel: W.everyGame(d.name),
      phoneFigure: W.divOf(n, d.games.length),
    };
  }), [list, ticked, tick]);

  // ── The result ──────────────────────────────────────────────────────────────────────────────────────────────────
  if (result) {
    const title = W.doneTitle(result.verb, result.games);
    const eyebrow = formatShortWeekdayDate(result.day);
    const errorLine = error && <p className={repKit.formError} role="alert">{error}</p>;
    if (result.kind === 'held') {
      return (
        <>
          <KitDialog kind="form" eyebrow={eyebrow} title={title} onClose={onClose} busy={busy}
            footer={(
              <>
                <button type="button" className="btn btn-outline" disabled={busy} onClick={() => setAskBack(true)}>{W.back(result.games)}</button>
                <button type="button" className="btn btn-lime" disabled={busy} onClick={() => void act('send')}>{busy ? W.sending : W.heldSend}</button>
              </>
            )}>
            {errorLine}
            <div className={`${ck.notice} ${ck.noticeGood}`} aria-live="polite">
              <CheckCircle2 size={16} aria-hidden /><span className={ck.noticeBody}>{W.heldBody(result.games)}</span>
            </div>
            <p className={ck.hint}>{W.heldUndo(result.games)}</p>
          </KitDialog>
          {askBack && (
            <PutBackQuestion games={result.games} verb={result.verb} busy={busy} onYes={() => void act('back')} onClose={() => setAskBack(false)} />
          )}
        </>
      );
    }
    const told = result.divisions.filter(d => d.outcome === 'told');
    const failed = result.divisions.filter(d => d.outcome === 'failed');
    const already = result.divisions.filter(d => d.outcome === 'already');
    const emails = told.reduce((n, d) => n + d.emails, 0);
    // A division whose read failed doesn't know its games: the whole rainout's count stands in.
    const failedGames = failed.reduce((n, d) => n + d.games, 0) || result.games;
    const missed = told.reduce((n, d) => n + d.missed, 0);
    const line = failed.length === 0
      ? (told.length === 0 && already.length > 0 ? W.failAgain : W.doneSent(emails, told, result.teams))
      : told.length + already.length === 0
        ? W.failAll(result.verb, failedGames)
        : W.failSome([...told, ...already].map(d => d.name), emails, failed.map(d => d.name), result.verb, failedGames);
    return (
      <KitDialog kind="form" eyebrow={eyebrow} title={title} onClose={onClose}
        footer={(
          <>
            <DialogCancel>{W.done}</DialogCancel>
            {failed.length > 0
              ? <button type="button" className="btn btn-lime" onClick={() => { onOpenChanges(failed[0].divisionId); onClose(); }}>{W.failOpen}</button>
              : result.verb === 'postponed' && told.length > 0 && <button type="button" className="btn btn-lime" onClick={() => { onNewDates(told[0].divisionId); onClose(); }}>{W.doneDates}</button>}
          </>
        )}>
        <div className={`${ck.notice} ${failed.length ? ck.noticeWarn : ck.noticeGood}`} aria-live="polite">
          {failed.length ? <AlertTriangle size={16} aria-hidden /> : <CheckCircle2 size={16} aria-hidden />}
          <span className={ck.noticeBody}>{line}</span>
        </div>
        {missed > 0 && (
          <div className={`${ck.notice} ${ck.noticeWarn}`}>
            <AlertTriangle size={16} aria-hidden /><span className={ck.noticeBody}>{reachedLine(emails - missed, emails, missed)}</span>
          </div>
        )}
        {failed.length === 0 && told.length > 0 && <p className={ck.hint}>{W.doneNoUndo(result.verb)}</p>}
      </KitDialog>
    );
  }

  // ── The window ──────────────────────────────────────────────────────────────────────────────────────────────────
  const listed = list?.divisions ?? [];
  const places = list?.places ?? [];
  const placeViews = [{ id: '', label: W.allPlaces }, ...places.map(p => ({ id: p, label: p }))];
  const families = emailNow && sum ? sum.families : null;
  const mail = !sum || sum.games === 0 ? null
    : !emailNow ? W.sumHold
    : sum.emails === 0 ? W.sumNone(sum.teams)
    : phone ? W.sumPhone(sum.games, sum.emails, sum.families, sum.divisions, sum.multi)
    : sum.divisions > 1 ? W.sumMail(sum.emails, sum.families, sum.divisions, sum.multi, sum.teams)
    : W.sumOne(sum.emails, sum.families, sum.teams);
  const left = RAIN_LINE_MAX - line.length;
  const total = sum ? W.sum(sum.games, sum.teams, sum.divisions) : '';
  const today = source?.today ?? '';
  const club = practices ? { count: practices.club, ...W.pracClub(practices.club) } : null;
  const hand = practices ? { count: practices.hand, ...W.pracHand(practices.hand) } : null;

  return (
    <KitDialog kind="form" size="medium" eyebrow={seasonName} title={W.title} onClose={onClose} busy={busy}
      dirty={!busy && (line.length > 0 || verb !== 'postponed')}
      footerStart={source && days.length > 0
        ? <span>{busy ? W.sending : sum?.games === 0 ? W.tickOne : phone ? W.footPhone : W.foot}</span>
        : undefined}
      footer={(
        <>
          <DialogCancel>{W.close}</DialogCancel>
          {source && days.length > 0 && sum && (
            <button type="button" className="btn btn-lime" disabled={busy || sum.games === 0} onClick={() => void press()}>
              {busy ? W.sending : phone ? W.goPhone(verb, sum.games, families) : W.go(verb, sum.games, families)}
            </button>
          )}
        </>
      )}>
      {error && <p className={repKit.formError} role="alert">{error}</p>}
      {loadFailed && <p className={ck.hint} role="alert">{W.loadFailed}</p>}
      {!source && !loadFailed && <LoadingState inline label={W.title} />}
      {source && days.length === 0 && <p className={ck.hint}>{W.noneAtAll}</p>}
      {source && day && days.length > 0 && (<>
        <label className={ck.field}>
          <span className={ck.label}>{W.day}</span>
          <select className={ck.select} value={day} onChange={e => pickDay(e.target.value)} disabled={busy}>
            {days.map(d => (
              <option key={d.day} value={d.day}>{phone ? W.dayValuePhone(d.day, today) : W.dayValue(d.day, today, d.games)}</option>
            ))}
          </select>
        </label>

        <p className={repKit.factsLabel} id="rainout-what-label">{W.what}</p>
        <SendRows group={{ radio: true, labelledBy: 'rainout-what-label' }}>
          <SendRow title={W.postpone} sub={phone ? W.postponeSubPhone : W.postponeSub}
            pick={{ checked: verb === 'postponed', onChange: on => on && setVerb('postponed'), radio: 'rainout-what' }} />
          <SendRow title={W.cancel} sub={phone ? W.cancelSubPhone : W.cancelSub}
            pick={{ checked: verb === 'cancelled', onChange: on => on && setVerb('cancelled'), radio: 'rainout-what' }} />
        </SendRows>

        <p className={repKit.factsLabel}>{W.which}</p>
        {places.length > 1 && (placeViews.length <= 3
          ? <ViewSwitch views={placeViews} value={place} onChange={pickPlace} label={W.which} />
          : (
            <label className={ck.field}>
              <span className={repKit.srOnly}>{W.which}</span>
              <select className={ck.select} value={place} onChange={e => pickPlace(e.target.value)} disabled={busy}>
                {placeViews.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
              </select>
            </label>
          ))}
        {listed.length === 0 ? <p className={ck.hint}>{W.none}</p> : (
          <FormTable
            ariaLabel={W.which}
            leadLabel={W.colGame}
            columns={[{ key: 'when', label: W.colWhen }]}
            rows={rows}
            groups={groups}
            closing={{ label: total, cells: { when: '' }, phone: total }}
          />
        )}
        {list?.drafts.map(name => <p key={name} className={ck.hint}>{W.draft(phone ? shortDivision(name) : name)}</p>)}

        {mail && <Statement lead={mail} rest={emailNow && sum && sum.emails > 0 ? W.sumCap : undefined} />}

        {practices && (phone
          ? <p className={r.practices}>{W.pracPhone(practices.club, practices.hand)}</p>
          : (
            <p className={r.practices}>
              {day === today ? W.pracToday : W.pracDay(day)}
              {club && club.count > 0 && <> {club.lead}{schedulesHref ? <Link href={schedulesHref}>{club.link}</Link> : club.link}{club.tail}</>}
              {hand && hand.count > 0 && <> {hand.lead}{hand.link}{hand.tail}</>}
            </p>
          ))}

        <CheckChoice checked={emailNow} onChange={setEmailNow} title={W.email} caption={W.emailHelp} disabled={busy} />

        <label className={ck.field}>
          <span className={ck.label}>{W.lineLabel}</span>
          <span className={r.lineStack}>
            <input className={ck.input} type="text" value={line} maxLength={RAIN_LINE_MAX} placeholder={W.linePlaceholder}
              onChange={e => setLine(e.target.value)} disabled={busy} aria-describedby="rainout-line-hint" />
            <span id="rainout-line-hint" className={ck.hint}>{W.lineHint}{!emailNow && <> {W.lineHeld}</>}</span>
            {line.length > 0 && <span className={r.counter} aria-live="polite">{W.lineCount(left)}</span>}
          </span>
        </label>
      </>)}
    </KitDialog>
  );
}
