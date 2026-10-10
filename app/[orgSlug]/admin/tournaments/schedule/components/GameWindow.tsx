'use client';
/**
 * THE GAME WINDOW — Tournament admin redesign Stage 3, S2 (A35, A36), ruled 2026-10-09. A game opens THAT game.
 *
 * Before: a game had three ways in and none of them was the game — the row folded open into an edit form (a played
 * game's row did nothing), a separate Add Game window added, and an Edit Game window existed that nothing opened; the
 * score lived on another page (F74). Now ONE window — the kit's form window (KitDialog): full screen with ← on a
 * phone, 640 at a desk — opened from a row of the day, a timeline block or a bracket card, and from Add game to create.
 *
 *   READS FIRST: when and where (day, start, length by THE chain, the venue and its diamond); the score, with ONE door
 *   to Results' editor (one score editor in the product); the bracket slots it sits in, or its pool and Keep; who sees
 *   it. ONE PENCIL turns the whole game into its form and ✓ turns it back (owner, 1 October).
 *
 *   SAVING (24 September; S2): an unpublished game saves as it is edited. A PUBLISHED game holds a change to when or
 *   where until ✓, which asks once — its teams are told (the coaches portal keeps that save for the same reason). Its
 *   other fields save as they are edited. A red line holds the value: the tournament's own overlap is refused under
 *   the diamond before anything saves (A37), and ✓ stays in the form until it is fixed. A club booking is 6a's amber
 *   line, read from the save's own reply (`crossProgram`) — it warns, never refuses.
 *
 *   Venue + Diamond is the club's ONE field (Club Tier 6a, Ask 13), worn as built: the tournament's venues are its
 *   program venues, typed words its typed row (`lib/tournament-where.ts`).
 *
 * The window holds no data of its own beyond the form: the page reads, writes and decides who may.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Info } from 'lucide-react';
import KitDialog from '@/components/admin/kit/club/KitDialog';
import { Callout, NoticePill, RecordDelete, RepChip, SavePill } from '@/components/admin/kit/club/RepKit';
import { CheckChoice, RecordSection, screenParts } from '@/components/admin/tournament/ScreenParts';
import WhereField, { WhereLine } from '@/components/venue/WhereField';
import { useRecordAutosave } from '@/components/coaches/useRecordAutosave';
import ck from '@/components/admin/kit/club/ClubKit.module.css';
import type { Division, Game, PoolSlot, Team, Tournament, Venue } from '@/lib/types';
import { resolveGameTiming } from '@/lib/schedule-conflict';
import { bracketGameLabel, buildPlaceholderOptions, descendantBracketCodes } from '@/lib/playoff-bracket';
import { samePlace, tournamentSourceLine, tournamentVenueOptions } from '@/lib/tournament-where';
import type { WhereValue } from '@/lib/where-field';
import {
  changesOf, emptyGameForm, formOfGame, lengthOfBox, startsInUrgentLane, whenWhereChanged, type GamePatch, type GameWindowForm,
} from '@/lib/game-window-form';
import { scheduleStateOf, type ScheduleState } from '@/lib/schedule-day';
import { GAME_WINDOW_WORDS as G, SCHEDULE_DAY_WORDS as W, slotWords } from '@/lib/schedule-words';
import { scoreSubmissionSummary } from '@/lib/tournament-score-audit';
import type { ClashLine } from '@/lib/venue-clash-words';
import { formatShortWeekdayDate } from '@/lib/timezone';
import { formatTime } from '@/lib/utils';
import { fieldNounFor } from '@/lib/sports';
import { GameTeams } from '../../results/ResultsList';
import { useOverlapLine } from './useOverlapLine';
import gw from './GameWindow.module.css';

/** A save's reply: the club's amber line for this game, when it lands on another program's booking. */
export type GameSaveReply = { crossLine: ClashLine | null };

// ── The window ───────────────────────────────────────────────────────────────────────────────────────────────

export type GameStep = { name: string; onStep: () => void } | null;

export interface GameWindowContext {
  tournament: Tournament | null;
  divisions: Division[];
  teams: Team[];
  venues: Venue[];
  games: Game[];
  /** The event's days, for the Day dropdown. */
  days: string[];
  today: string;
  nowMs: number;
  orgSlug: string;
  /** Results, with this game's editor open (the board's rows' own link). */
  resultsHref: (gameId: string) => string;
  canAlertFollowers: boolean;
  canBuildBracket: boolean;
  hasRoundRobinStage: boolean;
  hasPlayoffStage: boolean;
}

export default function GameWindow({
  game, ctx, canWrite, steps, onSave, onCreate, onClose, onCancelGame, onReinstate, onToggleKeep, onDelete,
  onEditBracket, loadSlots, createDefaults, askMove, notice, onNoticeDone,
}: {
  /** The game to read and edit, or null to create one (Add game). */
  game: Game | null;
  ctx: GameWindowContext;
  canWrite: boolean;
  steps?: { prev: GameStep; next: GameStep; position: string; positionWide: string };
  onSave: (gameId: string, patch: GamePatch) => Promise<GameSaveReply>;
  onCreate: (form: GameWindowForm) => Promise<void>;
  onClose: () => void;
  onCancelGame: (g: Game) => void;
  onReinstate: (g: Game) => void;
  onToggleKeep: (g: Game, keep: boolean) => void;
  onDelete: (g: Game) => void;
  onEditBracket: (g: Game) => void;
  /** A division's pool slots (Add game's slot-based round robin). */
  loadSlots: (divisionId: string) => Promise<PoolSlot[]>;
  createDefaults: { divisionId: string; stage: 'pool' | 'playoff'; date: string };
  /** The published-game question (A36): resolves true to move. The page owns the window it asks in. */
  askMove: (g: Game, startsWithinHours: boolean) => Promise<boolean>;
  /** The page's notice after a move or a cancel (with Undo), shown in the window's corner while it is open. */
  notice?: { key: number; message: string; action?: { label: string; onAction: () => void } } | null;
  onNoticeDone?: () => void;
}) {
  const creating = game === null;
  const noun = fieldNounFor(ctx.tournament?.sport);
  const venueOptions = useMemo(() => tournamentVenueOptions(ctx.venues), [ctx.venues]);

  // ── The form, re-seeded when the window steps to another game (or the game is re-read with nothing unsaved) ──
  const seed = useCallback(
    () => (game ? formOfGame(game, ctx.venues) : emptyGameForm(createDefaults.divisionId, createDefaults.stage, createDefaults.date)),
    [game, ctx.venues, createDefaults.divisionId, createDefaults.stage, createDefaults.date],
  );
  const [formFor, setFormFor] = useState<string>(game?.id ?? 'new');
  const [serverSig, setServerSig] = useState(() => JSON.stringify(seed()));
  const [form, setForm] = useState<GameWindowForm>(seed);
  const [saved, setSaved] = useState<GameWindowForm>(seed);
  const [editing, setEditing] = useState(creating);
  const [crossLine, setCrossLine] = useState<GameSaveReply['crossLine']>(null);
  const [leaveError, setLeaveError] = useState('');
  const [creatingBusy, setCreatingBusy] = useState(false);
  const formRef = useRef(form);
  const savedRef = useRef(saved);
  const forRef = useRef(formFor);
  useEffect(() => { formRef.current = form; savedRef.current = saved; forRef.current = formFor; });

  const division = ctx.divisions.find(d => d.id === form.divisionId) ?? null;
  const published = !creating && division?.scheduleVisibility === 'published' && game?.status === 'scheduled';
  const isPlayoff = creating ? form.stage === 'playoff' : !!game?.isPlayoff;

  // ── The tournament's own overlap (A37), checked as the form changes — the rule every writer and the server read.
  // Refused on a known diamond; two matching TYPED names only warn (the field says a typed place isn't checked). ──
  const { refused: overlaps, line: overlapLine } = useOverlapLine({
    active: editing, id: game?.id ?? '__new__', date: form.date, time: form.time, where: form.where,
    divisionId: form.divisionId || null, durationMinutes: lengthOfBox(form.durationMinutes),
    games: ctx.games, teams: ctx.teams, divisions: ctx.divisions, tournament: ctx.tournament, noun,
  });
  const movePending = !creating && whenWhereChanged(form, saved);
  // It holds only what THIS edit places — a new game, or a change of day, start, place or length — as the server
  // does. A game already sharing its diamond from before the rule still shows the red line (it is true) but never
  // traps ✓ while only its notes or teams change.
  const refused = overlaps && (creating || movePending || form.durationMinutes !== saved.durationMinutes);
  // Day, start and place wait: for ✓'s question on a published game, and while the overlap refuses them.
  const holdWhenWhere = published || refused;

  // ── Autosave (an unpublished game; a published game's other fields) — ONE save at a time, Teams' record's chain ──
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const write = useCallback(() => {
    const id = game?.id;
    const run = chain.current.catch(() => {}).then(async () => {
      if (!id || forRef.current !== id) return;
      const f = formRef.current;
      const s = savedRef.current;
      const patch = changesOf(f, s, { whenWhere: !holdWhenWhere, playoff: isPlayoff });
      if (Object.keys(patch).length === 0) return;
      const reply = await onSave(id, patch);
      if (forRef.current !== id) return;
      // The SAVED game moves by what was sent; held fields keep their saved values.
      const next: GameWindowForm = holdWhenWhere ? { ...f, date: s.date, time: s.time, where: s.where } : { ...f };
      savedRef.current = next;
      setSaved(next);
      if ('date' in patch || 'venueId' in patch || 'time' in patch) setCrossLine(reply.crossLine);
      setLeaveError('');
    });
    chain.current = run;
    return run;
  }, [game?.id, holdWhenWhere, isPlayoff, onSave]);
  const sig = JSON.stringify(form);
  const { saving, dirty, saveError, touch, settle, handleSave } = useRecordAutosave({
    enabled: canWrite && !creating, loading: false, sig, blocked: null, write, failText: 'Couldn’t save',
  });

  const incoming = JSON.stringify(seed());
  const id = game?.id ?? 'new';
  if (id !== formFor || (!creating && incoming !== serverSig && !dirty && !saving && !movePending)) {
    // Stepped to another game, or this one was re-read with nothing unsaved: start from the server, reading.
    if (id !== formFor) { setEditing(creating); setCrossLine(null); }
    setFormFor(id);
    setServerSig(incoming);
    setForm(seed());
    setSaved(seed());
    setLeaveError('');
    settle();
  }

  const set = (patch: Partial<GameWindowForm>) => { setForm(f => ({ ...f, ...patch })); setLeaveError(''); touch(); };

  /** Send what is unsaved (never a held move), then go. A failed save stays put, its reason in the save word. */
  const flushThen = async (go: () => void) => {
    if (!canWrite || creating) { go(); return; }
    try { await write(); setLeaveError(''); go(); } catch (e) { setLeaveError(e instanceof Error ? e.message : 'Couldn’t save'); }
  };

  /** A held move of a published game: ask once (A36), then send it — or put the saved day, start and place back. */
  const settleMove = async (): Promise<boolean> => {
    if (!game || !movePending) return true;
    if (refused) return false;
    const yes = published ? await askMove(game, startsInUrgentLane(form.date, form.time, Date.now())) : true;
    if (!yes) {
      const s = savedRef.current;
      setForm(f => ({ ...f, date: s.date, time: s.time, where: s.where }));
      return true;
    }
    try {
      const f = formRef.current;
      const reply = await onSave(game.id, changesOf(f, savedRef.current, { whenWhere: true, playoff: isPlayoff }));
      const next = { ...f };
      savedRef.current = next;
      setSaved(next);
      setCrossLine(reply.crossLine);
      return true;
    } catch (e) {
      setLeaveError(e instanceof Error ? e.message : 'Couldn’t save');
      return false;
    }
  };

  const toggleEdit = () => {
    if (!editing) { setEditing(true); return; }
    if (refused) return; // the red line holds the value: ✓ stays in the form until it is fixed (1 October)
    void flushThen(async () => {
      if (!(await settleMove())) return;
      if (JSON.stringify(formRef.current) !== JSON.stringify(savedRef.current) && !published) return;
      setEditing(false);
    });
  };
  const leave = (go: () => void) => {
    void flushThen(async () => {
      if (movePending && !refused && !(await settleMove())) return;
      go();
    });
  };

  // ── Create (Add game): Save asks, it never autosaves (24 September) ──
  const [slots, setSlots] = useState<PoolSlot[] | null>(null);
  const slotsFor = useRef('');
  useEffect(() => {
    if (!creating || form.stage !== 'pool' || !form.divisionId || slotsFor.current === form.divisionId) return;
    slotsFor.current = form.divisionId;
    let live = true;
    loadSlots(form.divisionId).then(list => { if (live) setSlots(list); }).catch(() => { if (live) setSlots([]); });
    return () => { live = false; };
  }, [creating, form.stage, form.divisionId, loadSlots]);
  const create = async () => {
    if (refused || creatingBusy || !form.divisionId) return;
    setCreatingBusy(true);
    setLeaveError('');
    try { await onCreate(formRef.current); } catch (e) { setLeaveError(e instanceof Error ? e.message : 'Couldn’t save'); } finally { setCreatingBusy(false); }
  };

  // ── What the window says ──
  const teamName = (tid?: string | null, ph?: string | null) => (tid && ctx.teams.find(t => t.id === tid)?.name) || slotWords(ph) || 'TBD';
  const divisionName = division?.name ?? '';
  const state: ScheduleState | null = game ? scheduleStateOf(game, ctx.divisions, ctx.tournament, ctx.nowMs, ctx.today) : null;
  const round = game?.isPlayoff && game.bracketCode ? bracketGameLabel(game.bracketCode) : W.stages.pool;
  const title = creating ? G.addGame : G.vs(teamName(game!.awayTeamId, game!.awayPlaceholder), teamName(game!.homeTeamId, game!.homePlaceholder));
  const chip = state && state !== 'final' && state !== 'scheduled' ? W.states[state] : null;
  const identity = creating ? undefined : (
    <span className={gw.head}>
      <span>{[divisionName, round].filter(Boolean).join(' · ')}</span>
      {chip && <RepChip tone={state === 'pendingReview' ? 'warn' : state === 'playingNow' ? 'good' : 'neutral'}>{chip}</RepChip>}
      {editing && !creating && <span>· editing</span>}
    </span>
  );

  // The length the game plays for, by THE chain (A39), and where the number comes from (said once, in the form).
  const timing = resolveGameTiming(division, ctx.tournament, lengthOfBox(saved.durationMinutes));
  const inheritedLen = resolveGameTiming(division, ctx.tournament, null).durationMinutes;
  const inheritedBy = typeof division?.settings?.game_duration_minutes === 'number' && division.settings.game_duration_minutes > 0 ? 'division' : 'event';
  const placeWords = (w: WhereValue) => {
    // A venue and its diamond of one name read once (Results' rule: 'Maple Field 1', never twice).
    if (w.source === 'club') return [w.location, w.fieldNumber !== w.location ? w.fieldNumber : ''].filter(Boolean).join(' · ');
    return w.location.trim() || G.noPlace;
  };

  // ── The lines under the field: the tournament's own refusal (red), a short gap (busy), the club's booking (amber) ──
  // The tournament's own line while editing; the club's amber line (from the last save's reply) while the place stands.
  const line: ReactNode = overlapLine
    ?? (crossLine && samePlace(form.where, saved.where) ? <WhereLine tone={crossLine.tone} lead={crossLine.lead} rest={crossLine.rest} /> : null);

  const playedOrWaiting = !!game && ['completed', 'submitted', 'forfeit'].includes(game.status);

  // ── Read first ──
  const readBody = game && (
    <>
      <RecordSection title={G.sections.whenWhere}>
        <dl className={gw.facts}>
          <div><dt>{G.facts.when}</dt><dd>{saved.date ? `${formatShortWeekdayDate(saved.date)}${saved.time ? ` · ${formatTime(saved.time)}` : ''}` : G.noDate}</dd></div>
          <div><dt>{G.facts.length}</dt><dd>{G.minutes(timing.durationMinutes)}</dd></div>
          <div><dt>{G.facts.where}</dt><dd>{placeWords(saved.where)}</dd></div>
        </dl>
        {line && !editing && line}
      </RecordSection>

      <RecordSection title={G.sections.score}>
        {state === 'cancelled' ? (
          <p className={gw.whoText}>{W.states.cancelled}</p>
        ) : state === 'final' || state === 'forfeit' || state === 'pendingReview' ? (
          <>
            {state !== 'final' && <RepChip tone={state === 'pendingReview' ? 'warn' : 'neutral'}>{W.states[state]}</RepChip>}
            <div className={gw.scoreTeams}><GameTeams teams={ctx.teams} g={game} scored /></div>
            {state === 'pendingReview' && (
              <p className={gw.audit}>{scoreSubmissionSummary({ source: game.scoreSubmissionSource, email: game.scoreSubmittedByEmail, submittedAt: game.scoreSubmittedAt })}</p>
            )}
          </>
        ) : (
          <dl className={gw.facts}>
            <div>
              <dt>{game.time ? (state === 'scheduled' ? G.score.startsAt(formatTime(game.time)) : G.score.startedAt(formatTime(game.time))) : G.noDate}</dt>
              <dd>{state === 'scheduled' ? G.score.notPlayed : G.score.notScored}</dd>
            </div>
          </dl>
        )}
        {state !== 'cancelled' && (
          <Link className={gw.door} href={ctx.resultsHref(game.id)}>
            {state === 'final' || state === 'forfeit' ? G.doors.edit : state === 'pendingReview' ? G.doors.review : G.doors.enter}
            <span aria-hidden>›</span>
          </Link>
        )}
      </RecordSection>

      {game.isPlayoff ? (
        <RecordSection title={G.sections.bracket}>
          <dl className={gw.facts}>
            {[game.awayPlaceholder, game.homePlaceholder].map((ph, i) => {
              const tid = i === 0 ? game.awayTeamId : game.homeTeamId;
              const named = tid ? ctx.teams.find(t => t.id === tid)?.name : null;
              return ph ? <div key={i}><dt>{slotWords(ph)}</dt><dd>{named ?? G.undecided}</dd></div> : null;
            })}
          </dl>
          {canWrite && ctx.canBuildBracket && (
            <button type="button" className={gw.door} onClick={() => leave(() => onEditBracket(game))}>
              {G.doors.bracket}<span aria-hidden>›</span>
            </button>
          )}
        </RecordSection>
      ) : game.status === 'scheduled' && canWrite ? (
        <RecordSection title={G.sections.roundRobin}>
          <CheckChoice checked={!!game.generatorLocked} onChange={keep => onToggleKeep(game, keep)} title={G.keep} caption={G.keepCaption} />
        </RecordSection>
      ) : null}

      <RecordSection title={G.sections.whoSees}>
        <p className={gw.whoText}>
          {division?.scheduleVisibility !== 'published' ? G.whoSees.unpublished(divisionName)
            // A played game is never announced; a cancelled one only when it is put back on.
            : playedOrWaiting ? G.whoSees.played(divisionName)
              : !ctx.canAlertFollowers ? G.whoSees.publishedNoAlerts(divisionName)
                : game.status === 'cancelled' ? G.whoSees.cancelledAlerts(divisionName)
                  : G.whoSees.publishedAlerts(divisionName)}
        </p>
      </RecordSection>

      {canWrite && (game.status === 'scheduled' || game.status === 'cancelled') && (
        <RecordSection>
          <div className={gw.actions}>
            {game.status === 'scheduled'
              ? <button type="button" className={`${screenParts.plainButton} ${gw.amber}`} onClick={() => leave(() => onCancelGame(game))}>{G.cancelGame}</button>
              : <button type="button" className={screenParts.plainButton} onClick={() => leave(() => onReinstate(game))}>{G.reinstateGame}</button>}
          </div>
        </RecordSection>
      )}
      {canWrite && (
        <RecordSection>
          <RecordDelete onClick={() => leave(() => onDelete(game))}>{G.deleteGame}</RecordDelete>
        </RecordSection>
      )}
    </>
  );

  // ── The form the pencil opens (and Add game's) ──
  const dayChoices = Array.from(new Set([...ctx.days, ...(form.date ? [form.date] : [])])).sort();
  const divisionTeams = ctx.teams.filter(t => t.divisionId === form.divisionId);
  const field = (label: string, control: ReactNode, wide = false) => (
    <label className={ck.field} style={wide ? { gridColumn: '1 / -1' } : undefined}>
      <span className={ck.label}>{label}</span>
      {control}
    </label>
  );

  // A playoff side: a seed, a winner or loser of an earlier game, or a known team (the Add window's rule, kept).
  const playoffSide = (isHome: boolean) => {
    const pDiv = ctx.divisions.find(d => d.id === form.divisionId);
    const seedCount = pDiv?.playoffConfig?.teamsQualifying || divisionTeams.length || 8;
    const groupId = game?.bracketId ?? null;
    const groupGames = ctx.games.filter(x => x.isPlayoff && x.divisionId === form.divisionId && (!groupId || x.bracketId === groupId));
    const blocked = game?.bracketCode
      ? descendantBracketCodes(game.bracketCode, groupGames.map(x => ({ code: x.bracketCode || '', refs: [x.homePlaceholder, x.awayPlaceholder] })))
      : new Set<string>();
    const codes = groupGames.filter(x => x.bracketCode && x.id !== game?.id && !blocked.has(x.bracketCode)).map(x => x.bracketCode as string);
    const opts = buildPlaceholderOptions(seedCount, codes);
    const assigned = new Set(groupGames.filter(x => x.id !== game?.id).flatMap(x => [x.homePlaceholder, x.awayPlaceholder]).filter((x): x is string => !!x));
    const teamId = isHome ? form.homeTeamId : form.awayTeamId;
    const ph = isHome ? form.homePlaceholder : form.awayPlaceholder;
    const otherPh = isHome ? form.awayPlaceholder : form.homePlaceholder;
    const value = teamId ? `team:${teamId}` : ph ? `ph:${ph}` : '';
    const avail = (s: string) => s === ph || (!assigned.has(s) && s !== otherPh);
    const onPick = (v: string) => {
      const tid = v.startsWith('team:') ? v.slice(5) : '';
      const p = v.startsWith('ph:') ? v.slice(3) : '';
      set(isHome ? { homeTeamId: tid, homePlaceholder: p } : { awayTeamId: tid, awayPlaceholder: p });
    };
    return (
      <select className={ck.select} value={value} disabled={playedOrWaiting} onChange={e => onPick(e.target.value)}>
        <option value="">{G.fields.choose}</option>
        {opts.seeds.filter(avail).length > 0 && <optgroup label={G.fields.seeds}>{opts.seeds.filter(avail).map(s => <option key={s} value={`ph:${s}`}>{slotWords(s)}</option>)}</optgroup>}
        {opts.winners.filter(avail).length > 0 && <optgroup label={G.fields.winners}>{opts.winners.filter(avail).map(s => <option key={s} value={`ph:${s}`}>{slotWords(s)}</option>)}</optgroup>}
        {opts.losers.filter(avail).length > 0 && <optgroup label={G.fields.losers}>{opts.losers.filter(avail).map(s => <option key={s} value={`ph:${s}`}>{slotWords(s)}</option>)}</optgroup>}
        {divisionTeams.length > 0 && <optgroup label={G.fields.teams}>{divisionTeams.map(t => <option key={t.id} value={`team:${t.id}`}>{t.name}</option>)}</optgroup>}
      </select>
    );
  };
  const teamSelect = (isHome: boolean) => (
    <select className={ck.select} value={isHome ? form.homeTeamId : form.awayTeamId} disabled={playedOrWaiting}
      onChange={e => set(isHome ? { homeTeamId: e.target.value } : { awayTeamId: e.target.value })}>
      <option value="">{G.fields.choose}</option>
      {divisionTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
    </select>
  );
  const slotSelect = (isHome: boolean) => (
    <select className={ck.select} value={isHome ? form.homeSlotId : form.awaySlotId}
      onChange={e => set(isHome ? { homeSlotId: e.target.value } : { awaySlotId: e.target.value })}>
      <option value="">{G.fields.choose}</option>
      {(slots ?? []).map(s => <option key={s.id} value={s.id}>{s.displayName}</option>)}
    </select>
  );
  const slotGame = !!game && !game.isPlayoff && (!!game.homeSlotId || !!game.awaySlotId);
  const sides = isPlayoff
    ? <div className={gw.pair}>{field(G.fields.away, playoffSide(false))}{field(G.fields.home, playoffSide(true))}</div>
    : slotGame
      ? <dl className={gw.facts}><div><dt>{G.fields.away}</dt><dd>{teamName(game!.awayTeamId, game!.awayPlaceholder)}</dd></div><div><dt>{G.fields.home}</dt><dd>{teamName(game!.homeTeamId, game!.homePlaceholder)}</dd></div></dl>
      : creating && (slots?.length ?? 0) > 0
        ? <div className={gw.pair}>{field(G.fields.awaySlot, slotSelect(false))}{field(G.fields.homeSlot, slotSelect(true))}</div>
        : <div className={gw.pair}>{field(G.fields.away, teamSelect(false))}{field(G.fields.home, teamSelect(true))}</div>;

  const formBody = (
    <div className={gw.form}>
      {published && (
        <div className={gw.note}>
          <Callout flush icon={<Info size={16} aria-hidden />}>
            {ctx.canAlertFollowers ? G.editingNote.alerts(divisionName) : G.editingNote.noAlerts(divisionName)}
          </Callout>
        </div>
      )}
      {creating && (
        <div className={gw.pair}>
          {field(G.fields.division, (
            <select className={ck.select} value={form.divisionId} onChange={e => { slotsFor.current = ''; setSlots(null); set({ divisionId: e.target.value, homeTeamId: '', awayTeamId: '', homeSlotId: '', awaySlotId: '', homePlaceholder: '', awayPlaceholder: '' }); }}>
              <option value="">{G.fields.choose}</option>
              {ctx.divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          ))}
          {ctx.hasRoundRobinStage && ctx.hasPlayoffStage && field(G.fields.stage, (
            <select className={ck.select} value={form.stage} onChange={e => set({ stage: e.target.value as 'pool' | 'playoff', homeTeamId: '', awayTeamId: '', homePlaceholder: '', awayPlaceholder: '' })}>
              <option value="pool">{W.stages.pool}</option>
              <option value="playoff">{W.stages.playoff}</option>
            </select>
          ))}
        </div>
      )}
      <div className={gw.pair}>
        {field(G.fields.day, (
          <select className={ck.select} value={form.date} onChange={e => set({ date: e.target.value })}>
            {!form.date && <option value="">{G.noDate}</option>}
            {dayChoices.map(d => <option key={d} value={d}>{W.dayLabel(d, ctx.today)}</option>)}
          </select>
        ))}
        {field(G.fields.start, <input className={ck.input} type="time" value={form.time} onChange={e => set({ time: e.target.value })} />)}
      </div>
      {field(G.fields.length, (
        <input className={ck.input} type="number" inputMode="numeric" min={5} max={600} step={5}
          placeholder={G.inheritedLength(inheritedBy, divisionName, inheritedLen)}
          value={form.durationMinutes} onChange={e => set({ durationMinutes: e.target.value })} />
      ))}
      {sides}
      <div className={gw.where}>
        <WhereField
          idPrefix={`game-${game?.id ?? 'new'}`}
          sport={ctx.tournament?.sport}
          value={form.where}
          onChange={where => set({ where })}
          clubVenues={venueOptions}
          inClub={venueOptions.length > 0}
          clubGroupLabel={G.venueGroup}
          sourceLine={tournamentSourceLine(form.where, ctx.venues, G.venueSource)}
          classes={{ field: ck.field, label: ck.label, input: ck.input, select: ck.select, hint: ck.label }}
          line={line}
        />
      </div>
      {field(G.fields.notes, (
        <input className={ck.input} placeholder={G.fields.notesPlaceholder} value={form.notes} onChange={e => set({ notes: e.target.value })} />
      ))}
    </div>
  );

  // The save word: transient. A refused value says why it has not saved (red, as a held field does); a published
  // game's move waiting for ✓ is plain "Unsaved changes" — the note above the form already says ✓ asks first.
  const heldWords = refused ? G.held.refused(noun.toLowerCase()) : null;

  if (creating) {
    return (
      <KitDialog
        kind="form"
        title={G.addGame}
        onClose={onClose}
        busy={creatingBusy}
        footer={(
          <>
            <button type="button" className={screenParts.plainButton} onClick={onClose} disabled={creatingBusy}>{G.cancel}</button>
            <button type="button" className={`btn btn-lime ${gw.create}`} onClick={() => void create()} disabled={creatingBusy || refused || !form.divisionId}>
              {G.addGame}
            </button>
          </>
        )}
      >
        {formBody}
        {leaveError && <p className={gw.audit} role="alert">{leaveError}</p>}
      </KitDialog>
    );
  }

  return (
    <KitDialog
      kind="form"
      title={title}
      ariaLabel={title}
      identity={identity}
      status={canWrite ? (
        // The page's notice ("Moved to 5:30 p.m. · Diamond 3 · Undo") takes the corner once the save word is at rest.
        notice && !(saving || dirty || movePending || heldWords || leaveError || saveError)
          ? <NoticePill inline key={notice.key} message={notice.message} action={notice.action} onDone={onNoticeDone ?? (() => {})} />
          : <SavePill inline saving={saving} dirty={dirty || movePending || !!heldWords} error={leaveError || saveError || null}
              held={heldWords} onRetry={() => void handleSave()} />
      ) : undefined}
      edit={canWrite ? { editing, onToggle: toggleEdit, label: G.editGame } : undefined}
      onClose={() => leave(onClose)}
      steps={steps ? {
        prev: steps.prev ? { name: steps.prev.name, onStep: () => leave(steps.prev!.onStep) } : null,
        next: steps.next ? { name: steps.next.name, onStep: () => leave(steps.next!.onStep) } : null,
        position: steps.position,
        positionWide: steps.positionWide,
        noun: G.noun,
      } : undefined}
    >
      {editing ? formBody : readBody}
    </KitDialog>
  );
}
