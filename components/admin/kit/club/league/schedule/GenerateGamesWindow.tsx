'use client';
import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import KitDialog from '../../KitDialog';
import ck from '../../ClubKit.module.css';
import { repKit } from '../../RepKit';
import LoadingState from '@/components/shared/LoadingState';
import { formatInOrgZone, formatStoredDate, utcToZonedInputs } from '@/lib/timezone';
import { formatTimeRange } from '@/lib/utils';
import { permitAfterSave } from '@/lib/permit-words';
import { LEAGUE_TIME_WORDS, rowChanges, type LeagueTime, type LeagueTimeRow } from '@/lib/league-time';
import {
  GENERATE_WORDS as W, matchupHints, spanWords, warningWords,
  type GenerateCheckReply, type GeneratePlanReply, type GenerateSaveReply, type Through,
} from '@/lib/league-game-generator';
import type { LeagueTeam } from '@/lib/types';
import s from '../time/LeagueTime.module.css';
import g from './GenerateGames.module.css';

/**
 * GENERATE GAMES (House League Stage 9d-2a step 5; frames c1–c4, k3, k4; ruling 9d2·3 + the owner's amendment, plan
 * HOUSE_LEAGUE_STAGE9_PLAN.md §0h). Two steps and a check, one window:
 *   1 · WHEN AND WHERE is the division's game time, read from House league's time (c1) — never typed here. A division with
 *       none is given some of house league's time not given yet, a whole row at a time (k3; part of a row is House league's
 *       time's job, behind the door); with nothing to give, who can give it is named (k4).
 *   2 · MATCH-UPS: once or twice through (c2); the counts and the hints are the server's plan for each choice.
 *   · THE CHECK (c3): passing, warning (save anyway) or blocking (nothing is saved). A Save is live (9d2a·A): the games are on
 *     the public schedule at once, and families aren't emailed (9d2a·F).
 * Only divisions with no games are offered (9d2·11). The free League plan never opens this window (9d2a·B).
 */
type Level = 'time' | 'matchups' | 'check';

export interface GenerateDivision { id: string; name: string; teams: readonly LeagueTeam[] }

/** The division's rows of a kind of use, or house league's rows not given yet, with their schedule's dates. */
function rowsOf(time: LeagueTime, pick: (row: LeagueTimeRow) => boolean) {
  return time.sources.flatMap(source => source.stretches.flatMap(stretch => stretch.rows
    .filter(pick)
    .map(row => ({ key: `${source.scheduleId}|${stretch.key}|${row.key}`, row, dates: source.dates }))));
}
const slotCount = (row: LeagueTimeRow) => row.parts.reduce((n, p) => n + p.slotIds.length, 0);

export default function GenerateGamesWindow({
  seasonName, divisions, divisionId: first, through: firstThrough, time, api, orgQuery, schedulesHref, onTimeChanged, onOpenTime, onSaved, onClose,
}: {
  seasonName: string;
  /** The divisions Generate can take: two teams or more, no games yet. */
  divisions: readonly GenerateDivision[];
  divisionId: string;
  through?: Through;
  /** House league's time as the page read it; null while it reads. */
  time: LeagueTime | null;
  /** `/api/admin/house-league/seasons/{id}`, and the org's `?orgSlug=`. */
  api: string;
  orgQuery: string;
  /** The club's Schedules, for an owner or an admin (k4's door); null for a league admin. */
  schedulesHref: string | null;
  /** House league's time changed (k3's Give): the page reads it again. */
  onTimeChanged: () => Promise<unknown>;
  /** A door to House league's time on this division's game time; the page opens Generate again when it closes. */
  onOpenTime: (divisionId: string, through: Through) => void;
  onSaved: (said: string, permit: { title: string; sentence: string } | null) => void;
  onClose: () => void;
}) {
  const [divisionId, setDivisionId] = useState(first);
  const [level, setLevel] = useState<Level>('time');
  const [through, setThrough] = useState<Through>(firstThrough ?? 1);
  const [plan, setPlan] = useState<GeneratePlanReply | null>(null);
  const [planFailed, setPlanFailed] = useState(false);
  const [check, setCheck] = useState<GenerateCheckReply | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkFailed, setCheckFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const [seeGames, setSeeGames] = useState(false);

  const division = divisions.find(d => d.id === divisionId) ?? divisions[0];
  const name = division?.name ?? '';
  const teamName = useCallback((id: string) => division?.teams.find(t => t.id === id)?.name ?? '', [division]);
  const post = useCallback((body: Record<string, unknown>) => fetch(`${api}/schedule/generate${orgQuery}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ divisionId: division?.id, ...body }),
  }).catch(() => null), [api, orgQuery, division?.id]);

  const gameRows = useMemo(() => (time && division ? rowsOf(time, r => r.use?.divisionId === division.id && r.use.kind === 'games') : []), [time, division]);
  const openRows = useMemo(() => (time ? rowsOf(time, r => !r.use) : []), [time]);
  const otherHolds = !!time && !!division && rowsOf(time, r => !!r.use && r.use.divisionId !== division.id).length > 0;

  const loadPlan = useCallback(async () => {
    setPlanFailed(false);
    const r = await post({ step: 'plan' });
    const data = r?.ok ? (await r.json().catch(() => null)) as GeneratePlanReply | null : null;
    if (data) setPlan(data);
    else {
      const refusal = r ? (await r.json().catch(() => null)) as { error?: string } | null : null;
      if (refusal?.error) setError(refusal.error);
      setPlanFailed(true);
    }
  }, [post]);
  /** Step 2 reads its plan as it opens (again when the game time changed: `fresh`). */
  const toMatchups = (fresh = false) => {
    setError(null);
    setLevel('matchups');
    if (fresh || !plan) { setPlan(null); void loadPlan(); }
  };

  if (!division) {
    return (
      <KitDialog kind="form" title={W.titleTime} onClose={onClose}
        footer={<button type="button" className="btn btn-lime" onClick={onClose}>{W.close}</button>}>
        <p>{W.noneLeft}</p>
      </KitDialog>
    );
  }

  const chosen = plan ? (through === 2 ? plan.twice : plan.once) : null;
  const pickDivision = (id: string) => {
    setDivisionId(id);
    setPlan(null); setCheck(null); setPicked(new Set()); setError(null);
  };
  const errorLine = error && <p className={repKit.formError} role="alert">{error}</p>;

  /** k3's Next: the rows ticked become this division's game time (House league's time's own write), then step 2. */
  async function giveAndGoOn() {
    if (!time) return;
    const changes = openRows.filter(r => picked.has(r.key)).flatMap(r => rowChanges(r.row, { divisionId: division.id, kind: 'games' }));
    setBusy(true);
    setError(null);
    const r = await fetch(`${api}/time${orgQuery}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ changes }),
    }).catch(() => null);
    const data = (r ? await r.json().catch(() => null) : null) as { error?: string } | null;
    await onTimeChanged();
    setBusy(false);
    if (!r?.ok) { setError(data?.error ?? LEAGUE_TIME_WORDS.giveFailed); return; }
    setPicked(new Set());
    toMatchups(true);
  }

  async function runCheck() {
    setChecking(true);
    setCheckFailed(false);
    setError(null);
    const r = await post({ step: 'check', through });
    const data = r?.ok ? (await r.json().catch(() => null)) as GenerateCheckReply | null : null;
    setChecking(false);
    if (!data) {
      const refusal = r ? (await r.json().catch(() => null)) as { error?: string } | null : null;
      if (refusal?.error) setError(refusal.error);
      setCheckFailed(true);
      return;
    }
    setCheck(data);
    setSeeGames(false);
    setLevel('check');
  }

  async function save() {
    if (!check) return;
    setBusy(true);
    setError(null);
    const r = await post({ step: 'save', through, slotIds: check.slotIds });
    const data = (r ? await r.json().catch(() => null) : null) as (GenerateSaveReply & { error?: string; code?: string }) | null;
    setBusy(false);
    if (r?.ok && data) {
      onSaved(W.saved(data.saved), permitAfterSave(data.permitLines, 'game'));
      return;
    }
    setError(data?.error ?? W.failed);
    // The game time moved under the check: step 2 reads the plan again.
    if (data?.code === 'changed' || data?.code === 'blocked') { setCheck(null); toMatchups(true); setError(data.error ?? W.failed); }
  }

  const back = <button type="button" className="btn btn-outline" onClick={() => { setError(null); setLevel(level === 'check' ? 'matchups' : 'time'); }} disabled={busy}>{W.back}</button>;
  const cancel = <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>{W.cancel}</button>;
  const divisionLine = (
    <div className={g.division}>
      {divisions.length > 1 ? (
        <label className={ck.field}>
          <span className={ck.label}>{W.division}</span>
          <select className={ck.select} value={division.id} onChange={e => pickDivision(e.target.value)} disabled={busy}>
            {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </label>
      ) : <span className={ck.rowTitle}>{name}</span>}
      <span className={g.figure}>{W.teams(division.teams.length)}</span>
    </div>
  );

  let eyebrow = W.eyebrow(seasonName, 1);
  let title: string = W.titleTime;
  let body: React.ReactNode;
  let footer: React.ReactNode;
  let footerStart: React.ReactNode = null;

  if (level === 'time') {
    if (!time) {
      body = <>{divisionLine}<LoadingState inline label="Loading house league’s time…" /></>;
      footer = cancel;
    } else if (gameRows.length) {
      // c1: the division's game time, as House league's time gave it.
      const slots = gameRows.reduce((n, r) => n + slotCount(r.row), 0);
      const dates = [...new Set(gameRows.map(r => r.dates))].join('; ');
      const lengths = new Set(gameRows.flatMap(r => r.row.parts.map(p => p.minutes)));
      body = <>
        {errorLine}
        {divisionLine}
        <h3 className={s.stretchTitle}>{W.gameTime(name)}</h3>
        <div className={ck.list}>
          {gameRows.map(({ key, row }) => (
            <div key={key} className={ck.row}>
              <div className={ck.rowMain}>
                <span className={s.detail}>{row.detail}</span>
                <span className={s.hoursUnder}>{W.gamesAWeek(row.parts.length)}</span>
              </div>
              <span className={s.hours}>{W.gamesAWeek(row.parts.length)}</span>
            </div>
          ))}
        </div>
        <p className={ck.hint}>{W.slotsInAll(dates, slots)}</p>
        <button type="button" className={s.lineDoor} onClick={() => onOpenTime(division.id, through)}>{W.changeIt}</button>
      </>;
      footerStart = <span>{lengths.size === 1 ? W.eachGame([...lengths][0]) : W.eachGameMixed}</span>;
      footer = <>{cancel}<button type="button" className="btn btn-lime" onClick={() => toMatchups()}>{W.next}</button></>;
    } else if (openRows.length) {
      // k3: none yet — give it some of house league's time not given yet, a row at a time.
      body = <>
        {errorLine}
        {divisionLine}
        <p className={s.emptyNote}>{W.noTime(name)}</p>
        <fieldset className={s.choices}>
          <legend className={s.stretchTitle}>{W.notGiven}</legend>
          {openRows.map(({ key, row }) => (
            <label key={key} className={s.choice}>
              <input type="checkbox" checked={picked.has(key)} disabled={busy}
                onChange={() => setPicked(p => { const n = new Set(p); if (n.has(key)) n.delete(key); else n.add(key); return n; })} />
              <span className={ck.rowMain}>
                <span>{row.detail}</span>
              </span>
              <span className={g.figure}>{W.slots(slotCount(row))}</span>
            </label>
          ))}
        </fieldset>
        <p className={ck.hint}>
          {W.notOffered}
          <button type="button" className={s.lineDoor} onClick={() => onOpenTime(division.id, through)}>{W.divideFirst}</button>.
        </p>
      </>;
      footerStart = <span>{W.givenFoot(name)}</span>;
      footer = <>{cancel}<button type="button" className="btn btn-lime" disabled={busy || picked.size === 0} onClick={() => void giveAndGoOn()}>{busy ? W.giving : W.next}</button></>;
    } else {
      // k4: nothing to give. An owner or an admin gives house league more; a league admin is told who can.
      const noneGiven = time.sources.length === 0;
      body = <>
        {divisionLine}
        <div className={s.empty}>
          {schedulesHref
            ? <><p className={s.emptyNote}>{noneGiven ? LEAGUE_TIME_WORDS.noneGivenClub : LEAGUE_TIME_WORDS.noneLeftClub}</p>
                <p className={ck.hint}>{noneGiven ? LEAGUE_TIME_WORDS.noneGivenClubHint : W.noneLeftClubHint}</p></>
            : <p className={s.emptyNote}>{noneGiven ? LEAGUE_TIME_WORDS.noneGivenLeagueAdmin : W.noneLeftLeagueAdmin}</p>}
          {!schedulesHref && otherHolds && (
            <button type="button" className={s.lineDoor} onClick={() => onOpenTime(division.id, through)}>{W.takeBack}</button>
          )}
        </div>
      </>;
      footerStart = <span>{schedulesHref ? LEAGUE_TIME_WORDS.nothingSaved : W.nothingSaved}</span>;
      footer = schedulesHref
        ? <><button type="button" className="btn btn-outline" onClick={onClose}>{W.close}</button>
            <Link href={schedulesHref} className="btn btn-lime">{noneGiven ? LEAGUE_TIME_WORDS.giveSome : LEAGUE_TIME_WORDS.giveMore}</Link></>
        : <button type="button" className="btn btn-lime" onClick={onClose}>{W.close}</button>;
    }
  } else if (level === 'matchups') {
    // c2: once or twice through; the counts are the server's plan for each choice.
    eyebrow = W.eyebrow(seasonName, 2);
    title = W.titleMatchups;
    body = <>
      {errorLine}
      <p className={ck.rowTitle}>{W.everyTeam(name)}</p>
      <div className={g.through}>
        <label className={ck.field}>
          <select className={ck.select} aria-label={W.everyTeam(name)} value={through} disabled={checking}
            onChange={e => { setThrough(Number(e.target.value) === 2 ? 2 : 1); setCheckFailed(false); }}>
            <option value={1}>{W.once}</option>
            <option value={2}>{W.twice}</option>
          </select>
        </label>
        {chosen && <span className={g.figure}>{W.counts(chosen.gamesEach, chosen.needed)}</span>}
      </div>
      {!plan && !planFailed && <LoadingState inline label="Loading the match-ups…" />}
      {chosen && <div className={g.hints}>{matchupHints(division.teams.length, chosen).map(h => <p key={h} className={ck.hint}>{h}</p>)}</div>}
      {(planFailed || checkFailed) && <p className={ck.hint} role="status">{W.checkFailed}</p>}
    </>;
    footerStart = chosen ? (
      <span>{!chosen.block && chosen.firstDay && chosen.lastDay
        ? W.stepFoot(chosen.needed, chosen.slotCount, spanWords(chosen.firstDay, chosen.lastDay))
        : W.stepFootBlocked}</span>
    ) : null;
    footer = <>
      {back}
      {planFailed
        ? <button type="button" className="btn btn-lime" onClick={() => void loadPlan()}>{W.tryAgain}</button>
        : <button type="button" className="btn btn-lime" onClick={() => void runCheck()} disabled={checking || !plan}>
            {checking ? W.checking : checkFailed ? W.tryAgain : W.check}
          </button>}
    </>;
  } else if (check) {
    // c3: the check — blocking, warning or passing.
    eyebrow = W.checkedEyebrow(seasonName);
    const p = check.plan;
    const n = p.placed;
    const facts = [
      p.firstDay && p.lastDay ? W.span(spanWords(p.firstDay, p.lastDay, true), p.weeks) : null,
      W.everyTeamPlays(p.gamesEach, p.home.min, p.home.max),
      p.share ? W.everyTeamGets(p.share.min, p.share.max, p.share) : null,
      check.health != null ? W.health(check.health) : null,
    ].filter((x): x is string => !!x);
    const gamesList = (
      <>
        <button type="button" className={s.lineDoor} aria-expanded={seeGames} onClick={() => setSeeGames(v => !v)}>{W.seeGames(n)}</button>
        {seeGames && (
          <ol className={g.games}>
            {check.games.map(x => (
              <li key={`${x.scheduledAt}|${x.place}`}>
                <span>{formatInOrgZone(x.scheduledAt, { weekday: 'short', month: 'short', day: 'numeric' })} · {formatTimeRange(utcToZonedInputs(x.scheduledAt).time, utcToZonedInputs(x.endsAt).time)}</span>
                <span>{teamName(x.homeTeamId)} vs {teamName(x.awayTeamId)}</span>
                <span className={s.detail}>{x.place}</span>
              </li>
            ))}
          </ol>
        )}
      </>
    );
    const saveButton = <button type="button" className="btn btn-lime" onClick={() => void save()} disabled={busy}>{busy ? W.saving : W.save(n)}</button>;
    if (p.block) {
      title = W.blockTitle(name);
      const b = p.block;
      body = <>
        {errorLine}
        <p>{b.kind === 'short'
          ? W.blockShort(b.needed, name, b.have, b.lastDay ? formatStoredDate(b.lastDay, { withYear: false }) : null)
          : b.kind === 'crowded' ? W.blockCrowded(b.placed, b.needed) : W.blockTeams(name)}</p>
        {b.kind !== 'teams' && <p className={ck.hint}>{W.blockHint(name, through === 2)}</p>}
      </>;
      footerStart = <span>{W.nothingSaved}</span>;
      footer = <>{back}{b.kind !== 'teams' && (
        <button type="button" className="btn btn-lime" onClick={() => onOpenTime(division.id, through)}>{W.giveMoreTime(name)}</button>
      )}</>;
    } else if (check.warnings.length) {
      title = W.warnTitle(n, check.warnings.length);
      body = <>
        {errorLine}
        <ul className={g.warnings}>
          {check.warnings.map((w, i) => (
            <li key={i}>
              <span>{warningWords(w, name, teamName)}</span>
              {w.kind === 'permit' && w.line && <span className={s.detail}>{w.line}</span>}
            </li>
          ))}
        </ul>
        <h3 className={s.stretchTitle}>{W.elsePasses}</h3>
        <div className={g.facts}>{facts.map(f => <p key={f} className={ck.hint}>{f}</p>)}</div>
        {gamesList}
      </>;
      footerStart = <span>{W.warnFoot} {W.passFoot(n)}</span>;
      footer = <>{back}{saveButton}</>;
    } else {
      title = W.ready(n);
      body = <>
        {errorLine}
        <div className={g.facts}>{facts.map(f => <p key={f} className={ck.hint}>{f}</p>)}</div>
        {gamesList}
      </>;
      footerStart = <span>{W.passFoot(n)}</span>;
      footer = <>{back}{saveButton}</>;
    }
  }

  return (
    <KitDialog kind="form" size="medium" eyebrow={eyebrow} title={title} onClose={onClose} busy={busy || checking}
      levelKey={`${level}:${division.id}`} footer={footer} footerStart={footerStart}>
      {body}
    </KitDialog>
  );
}
