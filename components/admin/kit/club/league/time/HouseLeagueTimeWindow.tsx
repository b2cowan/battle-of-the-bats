'use client';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CalendarPlus, ChevronRight, Undo2 } from 'lucide-react';
import KitDialog, { DialogReason } from '../../KitDialog';
import ck from '../../ClubKit.module.css';
import { RecordAction, repKit, useDeferredLoad } from '../../RepKit';
import LoadingState from '@/components/shared/LoadingState';
import { CoachToolbarMenu, CoachToolbarMenuItem, CoachToolbarMenuSeparator } from '@/components/coaches/CoachToolbarMenu';
import { screenParts } from '@/components/admin/tournament/ScreenParts';
import { houseLeagueUse } from '@/lib/club-schedule-words';
import {
  groupTick, hasNotGiven, hoursAWeek, hoursOf, keyOfUse, leaguePiece, partTick, pieceChanges, pieceDayWords, pieceMinutes,
  piecePartWords, practicesRemovedBy, rowChanges, toggleParts, LEAGUE_TIME_WORDS as W,
  type LeagueTime, type LeagueTimeChange, type LeagueUse, type PiecePart, type PieceStage, type PieceStretch, type Tick,
} from '@/lib/league-time';
import { formatTimeRange } from '@/lib/utils';
import s from './LeagueTime.module.css';

/**
 * HOUSE LEAGUE'S TIME (Club Tier Stage 11b Part 3, frame k2; words HOUSE_LEAGUE_STAGE9D2_11B_COPY.md). Everything the
 * club gave house league, by the club's stretches, and how it is divided: each division's game time and practice time,
 * and Not given yet — which offers Give it to (one pair per division, then Choose parts…) to whoever runs the season. The
 * registrar reads it with no Give it to. The server (lib/league-time-server.ts) decides what is shown and refuses a Save
 * that went stale.
 *
 * ⚖ A DIVISION'S PIECE IS A LEVEL, never a second window (drawings "A piece's window", ruled 2026-10-27): a division's
 * row › opens it behind "← House league's time". Its parts are grouped without their use, so a part can be mixed ("8 of
 * 12 dates"); a part another division holds has no box, its holder a link to that piece (Back returns). Ticks STAGE —
 * per part, per weekday, per stretch, tri-state — and ONE Save sends them all (mig 394: every change or none). Cancel
 * and Back leave the level and drop its ticks; × asks first while anything is staged. Saving time back that has
 * practices still to come asks first, in red, naming the teams — and never promises a notice (Part 5 tells them).
 * Choose parts… asks whose piece in one small step, then opens it with nothing new ticked.
 *
 * ⚖ Nothing to give (k4, adapted 2026-10-27, then /ux + /design): the club gave nothing → a league admin reads who can
 * give it (no link); an owner or an admin reads the same fact with the lime Give house league time (the club's
 * Schedules). Everything divided is not empty: the divisions' rows show with no Not given yet, and an owner or an admin
 * gets k4's "no time left" with Give house league more time as the body's rare door.
 * ⚖ A Save says what it saw (`from`, per slot): else the server refuses `changed` and the window reads again.
 */

type Level =
  | { kind: 'top' }
  | { kind: 'choose'; pick: string | null }
  | { kind: 'piece'; use: LeagueUse; stage: PieceStage };

export default function HouseLeagueTimeWindow({ orgSlug, seasonId, seasonName, canDivide, schedulesHref, onClose, onChanged }: {
  orgSlug: string;
  seasonId: string;
  seasonName: string;
  /** Runs this season (owner, admin, league admin on a live season): Give it to and the piece's ticks show. */
  canDivide: boolean;
  /** The club's Schedules, when this member builds them (an owner or an admin on a plan with the scheduler). */
  schedulesHref: string | null;
  onClose: () => void;
  /** A Save landed: the page reads its time line again. */
  onChanged?: () => void;
}) {
  const [time, setTime] = useState<LeagueTime | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [levels, setLevels] = useState<Level[]>([{ kind: 'top' }]);
  /** The question on Save: the practices it would remove, and the changes waiting on the answer. */
  const [asking, setAsking] = useState<{ changes: LeagueTimeChange[]; teams: string[]; count: number; parts: number; all: boolean; minutes: number } | null>(null);
  const router = useRouter();
  const url = `/api/admin/house-league/seasons/${seasonId}/time?orgSlug=${encodeURIComponent(orgSlug)}`;

  const load = useCallback(async () => {
    const r = await fetch(url, { cache: 'no-store' }).catch(() => null);
    const data = r ? await r.json().catch(() => null) : null;
    if (!r?.ok || !data) { setFailed((data as { error?: string } | null)?.error ?? W.loadFailed); return; }
    setTime(data as LeagueTime);
  }, [url]);

  useDeferredLoad(true, load);

  const level = levels[levels.length - 1];
  const below = levels[levels.length - 2] ?? null;
  const divisionName = useMemo(() => new Map((time?.divisions ?? []).map(d => [d.id, d.name])), [time]);
  const labelOfUse = (u: LeagueUse) => houseLeagueUse(divisionName.get(u.divisionId) ?? W.aDivision, u.kind);
  const levelLabel = (l: Level) => (l.kind === 'piece' ? labelOfUse(l.use) : l.kind === 'choose' ? W.choose.title : W.title);

  const push = (l: Level) => { setFailed(null); setLevels(ls => [...ls, l]); };
  const up = () => { setFailed(null); setLevels(ls => (ls.length > 1 ? ls.slice(0, -1) : ls)); };
  const setStage = (stage: PieceStage) => setLevels(ls => ls.map((l, i) => (i === ls.length - 1 && l.kind === 'piece' ? { ...l, stage } : l)));

  /** One Save: every change or none. True when it landed. */
  async function save(changes: LeagueTimeChange[]): Promise<boolean> {
    setBusy(true);
    setFailed(null);
    const r = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ changes }),
    }).catch(() => null);
    const data = r ? await r.json().catch(() => null) : null;
    if (!r?.ok) setFailed((data as { error?: string } | null)?.error ?? W.giveFailed);
    await load();
    setBusy(false);
    if (r?.ok) onChanged?.();
    return !!r?.ok;
  }

  const piece = useMemo(() => (time && level.kind === 'piece' ? leaguePiece(time.sources, level.use) : []), [time, level]);

  async function savePiece(confirmed = false) {
    if (level.kind !== 'piece' || !time) return;
    const changes = pieceChanges(piece, level.use, level.stage);
    if (!changes.length) return;
    const removed = practicesRemovedBy(changes, time.practices);
    if (removed.length && !confirmed) {
      const back = allParts(piece).filter(p => level.stage[p.key] === 'none');
      const allMine = allParts(piece).filter(p => p.mine.length);
      setAsking({
        changes, count: removed.length, parts: back.length, all: back.length > 0 && back.length === allMine.length,
        teams: [...new Set(removed.map(p => p.team).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'en-CA', { numeric: true })),
        minutes: back.reduce((n, p) => n + p.minutes, 0),
      });
      return;
    }
    setAsking(null);
    // Landed: back up a level. Refused: the ticks went stale with the time — the level reads again, nothing staged.
    if (await save(changes)) up(); else setStage({});
  }

  const empty = time !== null && time.sources.length === 0;
  // Everything divided: an owner or an admin can give house league more (k4's own sentence, where it is true).
  const allDivided = !!time && !empty && !hasNotGiven(time.sources);
  const staged = levels.some(l => l.kind === 'piece' && Object.keys(l.stage).length > 0);

  // ── The level on screen: its head, body and foot ──────────────────────────────────────────────────────────────
  let title: ReactNode = W.title;
  let identity: ReactNode = null;
  let body: ReactNode;
  let footer: ReactNode;
  let footerStart: ReactNode = null;

  if (level.kind === 'piece' && time) {
    const count = Object.keys(level.stage).length;
    const division = divisionName.get(level.use.divisionId) ?? W.aDivision;
    title = labelOfUse(level.use);
    identity = hoursAWeek(pieceMinutes(piece, level.stage));
    body = (
      <PieceLevel stretches={piece} stage={level.stage} canTick={canDivide} hint={canDivide ? W.piece.hint(division, level.use.kind) : null}
        manySources={time.sources.length > 1} label={title as string}
        labelOfUse={labelOfUse} onStage={setStage} onOpen={use => push({ kind: 'piece', use, stage: {} })} />
    );
    if (canDivide) {
      footerStart = count ? W.piece.changes(count) : W.nothingSaved;
      footer = <>
        <button type="button" className="btn btn-outline" onClick={up} disabled={busy}>{W.piece.cancel}</button>
        <button type="button" className="btn btn-lime" onClick={() => void savePiece()} disabled={busy || !count}>{W.piece.save}</button>
      </>;
    }
  } else if (level.kind === 'choose' && time) {
    title = W.choose.title;
    body = (
      <fieldset className={s.choices}>
        <legend className={ck.hint}>{W.choose.hint}</legend>
        {time.divisions.flatMap(d => (['games', 'practices'] as const).map(kind => {
          const k = `${d.id}:${kind}`;
          return (
            <label key={k} className={s.choice}>
              <input type="radio" name="league-time-choose" checked={level.pick === k}
                onChange={() => setLevels(ls => ls.map((l, i) => (i === ls.length - 1 ? { kind: 'choose', pick: k } : l)))} />
              <span>{houseLeagueUse(d.name, kind)}</span>
            </label>
          );
        }))}
      </fieldset>
    );
    footer = <>
      <button type="button" className="btn btn-outline" onClick={up}>{W.piece.cancel}</button>
      <button type="button" className="btn btn-lime" disabled={!level.pick} onClick={() => {
        const [divisionId, kind] = (level.pick ?? '').split(':');
        // The piece replaces the step: its Back goes to House league's time, not to the question already answered.
        setLevels(ls => [...ls.slice(0, -1), { kind: 'piece', use: { divisionId, kind: kind as LeagueUse['kind'] }, stage: {} }]);
      }}>{W.choose.next}</button>
    </>;
  } else {
    footer = empty
      ? <>
          <button type="button" className={schedulesHref ? 'btn btn-outline' : 'btn btn-lime'} onClick={onClose}>{W.close}</button>
          {schedulesHref && <Link href={schedulesHref} className="btn btn-lime">{W.giveSome}</Link>}
        </>
      : <button type="button" className="btn btn-lime" onClick={onClose}>{W.done}</button>;
    footerStart = time && !empty ? W.foot : null;
    body = <>
      {!time && !failed && <LoadingState inline label="Loading house league’s time…" />}
      {empty && (schedulesHref
        ? <div className={s.empty}><p className={s.emptyNote}>{W.noneGivenClub}</p><p className={ck.hint}>{W.noneGivenClubHint}</p></div>
        : <div className={s.empty}><p className={s.emptyNote}>{W.noneGivenLeagueAdmin}</p></div>)}
      {time && time.sources.map(source => (
        <section key={source.scheduleId} className={s.source}>
          <p className={ck.hint}>{W.source(source.name, source.dates, source.venues)}. {W.hoursLine}</p>
          {source.stretches.map(stretch => (
            <div key={stretch.key} className={s.stretch}>
              <h3 className={s.stretchTitle}>{stretch.title}</h3>
              <div className={ck.list}>
                {stretch.rows.map(row => (
                  <div key={row.key} className={ck.row}>
                    <div className={ck.rowMain}>
                      <span className={ck.rowTitle}>{row.label}</span>
                      <span className={s.detail}>{row.detail}</span>
                      <span className={s.hoursUnder}>{hoursAWeek(row.minutesAWeek)}</span>
                    </div>
                    <span className={s.hours}>{hoursAWeek(row.minutesAWeek)}</span>
                    {!row.use && canDivide && time.divisions.length > 0 && (
                      <CoachToolbarMenu label={W.giveItTo} overWindow align="end" disabled={busy} drawerOnPhone drawerTitle={W.giveItTo}>
                        {time.divisions.flatMap(d => (['games', 'practices'] as const).map(kind => (
                          <CoachToolbarMenuItem key={`${d.id}:${kind}`} label={houseLeagueUse(d.name, kind)}
                            onSelect={() => void save(rowChanges(row, { divisionId: d.id, kind }))} />
                        )))}
                        <CoachToolbarMenuSeparator />
                        <CoachToolbarMenuItem label={W.chooseParts} onSelect={() => push({ kind: 'choose', pick: null })} />
                      </CoachToolbarMenu>
                    )}
                    {row.use && (
                      <button type="button" className={s.open} aria-label={W.piece.open(row.label)}
                        onClick={() => push({ kind: 'piece', use: row.use!, stage: {} })}>
                        <ChevronRight size={16} aria-hidden />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      ))}
      {allDivided && schedulesHref && (
        <div className={s.more}>
          <p className={ck.hint}>{W.noneLeftClub}</p>
          <RecordAction icon={<CalendarPlus size={13} aria-hidden />} onClick={() => router.push(schedulesHref)}>{W.giveMore}</RecordAction>
        </div>
      )}
    </>;
  }

  const levelKey = level.kind === 'piece' ? `piece:${keyOfUse(level.use)}:${levels.length}` : `${level.kind}:${levels.length}`;
  const hasFoot = footer != null || footerStart != null;

  return (
    <>
      <KitDialog kind="form" size="medium" eyebrow={level.kind === 'top' ? seasonName : null} title={title} identity={identity}
        onClose={onClose} busy={busy} dirty={staged} footer={footer} footerStart={footerStart}
        back={below ? { label: levelLabel(below), onBack: up } : undefined} levelKey={levelKey}>
        {failed && (hasFoot && level.kind !== 'top'
          ? <DialogReason className={repKit.formError}>{failed}</DialogReason>
          : <p className={`${ck.notice} ${ck.noticeBad}`} role="alert">{failed}</p>)}
        {body}
      </KitDialog>
      {asking && level.kind === 'piece' && (
        <KitDialog kind="question" onClose={() => setAsking(null)} busy={busy}
          title={W.ask.title(divisionName.get(level.use.divisionId) ?? W.aDivision, level.use.kind, asking.parts, asking.all)}
          footer={<>
            <button type="button" className="btn btn-outline" onClick={() => setAsking(null)} disabled={busy}>{W.piece.cancel}</button>
            <button type="button" className="btn btn-danger" onClick={() => void savePiece(true)} disabled={busy}>{W.ask.confirm(asking.count)}</button>
          </>}>
          <p>{W.ask.body(asking.minutes)}</p>
          <p className={`${ck.notice}`}>{W.ask.note(asking.teams)}</p>
        </KitDialog>
      )}
    </>
  );
}

const allParts = (stretches: readonly PieceStretch[]) => stretches.flatMap(x => x.days.flatMap(d => d.parts));

/** A box that can be some-ticked (a weekday, a stretch, a mixed part). */
function TickBox({ tick, onToggle, label }: { tick: Tick; onToggle: () => void; label: string }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (ref.current) ref.current.indeterminate = tick === 'mixed'; }, [tick]);
  return <input ref={ref} type="checkbox" className={screenParts.check22} checked={tick === 'on'} onChange={onToggle} aria-label={label} />;
}

/**
 * A DIVISION'S PIECE (drawings "A piece's window" b–g): each stretch, its weekdays, their parts. Whoever runs the season
 * ticks; the registrar reads only the parts the piece holds, with no boxes (g).
 */
function PieceLevel({ stretches, stage, canTick, hint, manySources, label, labelOfUse, onStage, onOpen }: {
  stretches: PieceStretch[];
  stage: PieceStage;
  canTick: boolean;
  hint: string | null;
  manySources: boolean;
  label: string;
  labelOfUse: (u: LeagueUse) => string;
  onStage: (stage: PieceStage) => void;
  onOpen: (use: LeagueUse) => void;
}) {
  const mineAnywhere = allParts(stretches).some(p => p.mine.length);

  if (!canTick) {
    const rows = stretches
      .map(x => ({ x, parts: x.days.flatMap(d => d.parts).filter(p => p.mine.length) }))
      .filter(r => r.parts.length);
    if (!rows.length) return <p className={ck.hint}>{W.piece.nothing(label)}</p>;
    return (
      <div className={s.piece}>
        {rows.map(({ x, parts }) => (
          <section key={x.key} className={s.pieceStretch}>
            <h3 className={s.stretchTitle}>{manySources ? `${x.source} · ${x.title}` : x.title}</h3>
            {parts.map(p => {
              const all = p.mine.length + p.free.length + p.held.reduce((n, h) => n + h.slotIds.length, 0);
              return (
                <div key={p.key} className={s.part}>
                  <span className={s.partText}>{pieceDayWords(p.weekday)} · {piecePartWords(p)}</span>
                  <span className={s.partRight}>{p.mine.length < all ? W.piece.ofDates(p.mine.length, all) : hoursOf(p.minutes)}</span>
                </div>
              );
            })}
          </section>
        ))}
      </div>
    );
  }

  /** What a part says on its right (a desk) or under it (a phone). */
  const right = (p: PiecePart, tick: Tick | null) => {
    if (tick === null) {
      const holder = p.held[0]?.use;
      return holder
        ? <button type="button" className={s.holder} onClick={() => onOpen(holder)}>{W.piece.heldBy(labelOfUse(holder))}</button>
        : null;
    }
    return tick === 'mixed' ? W.piece.ofDates(p.mine.length, p.mine.length + p.free.length) : hoursOf(p.minutes);
  };

  return (
    <div className={s.piece}>
      {hint && <p className={ck.hint}>{hint}</p>}
      {stretches.map(x => {
        const parts = x.days.flatMap(d => d.parts);
        const sTick = groupTick(parts, stage);
        const title = manySources ? `${x.source} · ${x.title}` : x.title;
        return (
          <section key={x.key} className={s.pieceStretch}>
            <div className={s.stretchHead}>
              {sTick && <TickBox tick={sTick} label={W.piece.tickAll(title)} onToggle={() => onStage(toggleParts(parts, stage))} />}
              <h3 className={s.stretchTitle}>{title}</h3>
            </div>
            {x.days.map(d => {
              const dTick = groupTick(d.parts, stage);
              const day = pieceDayWords(d.weekday);
              return (
                <div key={d.weekday} className={s.day}>
                  <div className={s.weekday}>
                    {dTick ? <TickBox tick={dTick} label={W.piece.tickAll(day)} onToggle={() => onStage(toggleParts(d.parts, stage))} /> : <span className={s.noBox} />}
                    <span>{day}</span>
                  </div>
                  {d.parts.map(p => {
                    const tick = partTick(p, stage);
                    const words = right(p, tick);
                    const clock = formatTimeRange(p.start, p.end);
                    const changed = p.key in stage;
                    const inner = <>
                      {tick ? <TickBox tick={tick} label={`${day} · ${piecePartWords(p)}`} onToggle={() => onStage(toggleParts([p], stage))} /> : <span className={s.noBox} />}
                      <span className={s.partText}>
                        <span>{clock}<span className={s.placeDesk}> · {p.place}</span></span>
                        <small className={s.partUnder}>{p.place}{words ? <> · {words}</> : null}</small>
                      </span>
                      <span className={s.partRight}>{words}</span>
                    </>;
                    const className = `${s.part} ${s.partSub}${changed ? ` ${s.partChanged}` : ''}${tick ? '' : ` ${s.partHeld}`}`;
                    // A part with a box is its own tick target, the whole row; a held part's only control is its holder.
                    return tick
                      ? <label key={p.key} className={className}>{inner}</label>
                      : <div key={p.key} className={className}>{inner}</div>;
                  })}
                </div>
              );
            })}
          </section>
        );
      })}
      {mineAnywhere && (
        <div className={s.more}>
          <RecordAction icon={<Undo2 size={13} aria-hidden />}
            onClick={() => onStage(Object.fromEntries(allParts(stretches).filter(p => p.mine.length).map(p => [p.key, 'none' as const])))}>
            {W.piece.giveAllBack}
          </RecordAction>
        </div>
      )}
    </div>
  );
}
