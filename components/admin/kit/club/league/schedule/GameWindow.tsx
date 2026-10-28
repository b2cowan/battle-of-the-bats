'use client';
import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Ban, CalendarPlus, CalendarX2, RotateCcw } from 'lucide-react';
import KitDialog from '../../KitDialog';
import ck from '../../ClubKit.module.css';
import { NoticePill, RecordAction, RecordDelete, repKit } from '../../RepKit';
import WhereField from '@/components/venue/WhereField';
import DateInput from '@/components/shared/DateInput';
import TimeInput from '@/components/shared/TimeInput';
import { formatInOrgZone, utcToZonedInputs } from '@/lib/timezone';
import { formatTimeRange } from '@/lib/utils';
import { fieldNounFor } from '@/lib/sports';
import { whereWords } from '@/lib/club-calendar-view';
import { EMPTY_WHERE, whereLibraryBody, whereOfLibraryRow, type WhereValue } from '@/lib/where-field';
import {
  GAME_WINDOW_WORDS as W, SEASON_PUBLIC_WORDS, asksScores, gameStateWords, gameWindowDoors, scoresToSave, type SeasonBooking,
} from '@/lib/league-season-calendar';
import type { ClubVenueOption, LeagueGame, LeagueTeam } from '@/lib/types';
import { useLeagueLine } from './useLeagueLine';
import s from '../time/LeagueTime.module.css';
import g from './GameWindow.module.css';

/**
 * A GAME'S WINDOW, READ FIRST (9d-2a step 4, frame b4; plan HOUSE_LEAGUE_STAGE9_PLAN.md §0h). One window for every view
 * a game opens from — List, Week, Month and Needs a new date — and for Add › A game.
 *
 * ⚖ A RECORD READS FIRST AND EDITS WHOLE (owner 2026-10-01): When · Where · Home · Away · Notes, and the pencil turns the
 * whole record into its form, ✓ in the same spot. A reader (the registrar, anyone on a finished season) gets the facts and
 * nothing else: no pencil, no doors, no foot.
 * ⚖ ✓ SAVES; NOTHING SAVES AS YOU TYPE. Until 9d-2b a saved game is on the public schedule at once (9d2a·A), and a change
 * families can see is held until ✓ (the ruled exception to "edit autosaves", 2026-10-09); the league's own refusal also
 * needs the whole when and where before it can answer. The save sends only what changed, so a score on a game that
 * already clashes is a record, never a move the route re-checks (its own rule, which the old form's every-field save broke).
 * ⚖ THE STATUS DROPDOWN IS GONE: a state is a door at the end of the body (`gameWindowDoors`). Postpone and Cancel ask
 * first, in the window, "Keep it" against the act — never "Cancel", which would read as the opposite. A postponed game
 * reads "Was {its date}" and offers "Give it a new date": the same form, whose ✓ puts it back on (9d2·10). There is no
 * "Moved" (9d2a·D). A cancelled game is put back on (9d2a·E). A score is the pencil's, asked once the game has started.
 * ⚖ DELETE STAYS ON EVERY STATE until 9d-2b: 9d2·9 is "Delete before publishing, Cancel after", and nothing is published
 * yet. Moving a game is to any date and time, as before: the drawing's "time the division holds" needs 9d-2b's slot link
 * (an owner ask, plan §9).
 */
type Mode = 'read' | 'edit' | 'redate' | 'postpone' | 'cancel' | 'delete';

interface Draft {
  homeTeamId: string;
  awayTeamId: string;
  date: string;
  time: string;
  endTime: string;
  where: WhereValue;
  homeScore: string;
  awayScore: string;
  notes: string;
}

function draftOf(game: LeagueGame | null, teams: readonly LeagueTeam[], venues: ClubVenueOption[]): Draft {
  if (!game) {
    return {
      homeTeamId: teams[0]?.id ?? '', awayTeamId: teams[1]?.id ?? '', date: '', time: '18:00', endTime: '',
      where: EMPTY_WHERE, homeScore: '', awayScore: '', notes: '',
    };
  }
  const start = game.scheduledAt ? utcToZonedInputs(game.scheduledAt) : null;
  return {
    homeTeamId: game.homeTeamId, awayTeamId: game.awayTeamId,
    date: start?.date ?? '', time: start?.time ?? '', endTime: game.endsAt ? utcToZonedInputs(game.endsAt).time : '',
    where: whereOfLibraryRow(game, venues),
    homeScore: game.homeScore != null ? String(game.homeScore) : '', awayScore: game.awayScore != null ? String(game.awayScore) : '',
    notes: game.notes ?? '',
  };
}

/** "Thu, Jun 17, 2027 · 6:00–7:30 p.m." */
function whenWords(game: LeagueGame): string | null {
  if (!game.scheduledAt) return null;
  const start = utcToZonedInputs(game.scheduledAt);
  return `${formatInOrgZone(game.scheduledAt, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} · ${formatTimeRange(start.time, game.endsAt ? utcToZonedInputs(game.endsAt).time : null)}`;
}

export default function GameWindow({ game, booking, divisionId, divisionName, teams, venues, sport, api, orgQuery, checkPath, orgSlug, canRun, onChanged, onCreated, onDeleted, onClose }: {
  /** The game, or null for Add › A game. */
  game: LeagueGame | null;
  /** The game as the views draw it: its place's words and "Time from" (`gameSlotOf`). */
  booking: SeasonBooking | null;
  /** The division a new game goes into (an existing one keeps its own). */
  divisionId: string;
  divisionName: string;
  /** The game's division's teams. */
  teams: readonly LeagueTeam[];
  venues: ClubVenueOption[];
  sport: string | null | undefined;
  /** `/api/admin/house-league/seasons/{id}/schedule`, and the org's `?orgSlug=`. */
  api: string;
  orgQuery: string;
  checkPath: string;
  orgSlug: string;
  /** Runs the season (owner, admin, league admin on a live season). */
  canRun: boolean;
  /** A write landed: the page reads the season again (awaited, so the window reads what was saved). */
  onChanged: () => Promise<unknown>;
  /** Add's Create: the window closes; the league's warning, if any, is the page's to say. */
  onCreated: (warning: string | null) => void;
  onDeleted: () => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<Mode>(game ? 'read' : 'edit');
  const [draft, setDraft] = useState<Draft>(() => draftOf(game, teams, venues));
  const [seed, setSeed] = useState<Draft>(draft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  /** "Has the game started?" is asked of the moment the window opened (a render stays pure). */
  const [openedAt] = useState(() => Date.now());

  const creating = !game;
  const editing = mode === 'edit' || mode === 'redate';
  const doors = game ? gameWindowDoors(game.status) : null;
  const team = (id: string) => teams.find(t => t.id === id)?.name ?? '';
  const name = game ? W.title(team(game.homeTeamId) || W.home, team(game.awayTeamId) || W.away) : W.addTitle;
  const scored = !!game && asksScores(game, openedAt);
  const scores = scored ? scoresToSave(draft.homeScore, draft.awayScore) : null;
  /** Something typed that closing would lose (the window asks first). */
  const dirty = editing && JSON.stringify(draft) !== JSON.stringify(seed);
  const held = editing && scored && !scores ? W.bothScores : null;

  // The league's line under Venue (Club Tier Stage 6a), checked only while the form is open: a postponed game given a new
  // date holds a slot again, so it is checked as one.
  const { refused, line, checking, lineIsCurrent } = useLeagueLine({
    checkPath, sport, where: draft.where, venues, kind: 'game',
    occurrence: editing ? { date: draft.date, startTime: draft.time, endTime: draft.endTime } : null,
    excludeGameId: game?.id ?? null,
  });

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => { setDraft(d => ({ ...d, [k]: v })); setError(null); };
  const openForm = (next: 'edit' | 'redate') => {
    const d = draftOf(game, teams, venues);
    setDraft(d); setSeed(d); setError(null); setWarning(null); setMode(next);
  };

  /** One write; its error is said in the window, which stays where it was. */
  async function write(method: 'POST' | 'PATCH' | 'DELETE', body?: Record<string, unknown>) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${api}${game ? `/${game.id}` : ''}${orgQuery}`, {
        method, ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
      });
      const data = await res.json().catch(() => ({}));
      // A game someone else already deleted is what Delete asked for.
      if (!res.ok && !(method === 'DELETE' && res.status === 404)) {
        setError(data.error ?? 'Couldn’t save. Try again.');
        return null;
      }
      return data as { warnings?: string[] };
    } catch {
      setError('The connection dropped. Check it and try again.');
      return null;
    } finally {
      setSaving(false);
    }
  }

  /** What the form sends: only what changed (a re-date always puts the game back on). */
  function changes(): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    if (creating || draft.homeTeamId !== seed.homeTeamId || draft.awayTeamId !== seed.awayTeamId) {
      out.homeTeamId = draft.homeTeamId; out.awayTeamId = draft.awayTeamId;
    }
    if (creating || mode === 'redate' || draft.date !== seed.date || draft.time !== seed.time || draft.endTime !== seed.endTime) {
      out.scheduledDate = draft.date || undefined; out.scheduledTime = draft.time || undefined; out.endTime = draft.endTime || null;
    }
    if (creating || JSON.stringify(draft.where) !== JSON.stringify(seed.where)) Object.assign(out, whereLibraryBody(draft.where));
    if (creating || draft.notes !== seed.notes) out.notes = draft.notes.trim() || null;
    if (scores && (draft.homeScore !== seed.homeScore || draft.awayScore !== seed.awayScore)) Object.assign(out, scores);
    if (creating) { out.status = 'scheduled'; out.divisionId = divisionId; }
    if (mode === 'redate') out.status = 'scheduled';
    return out;
  }

  async function save() {
    if (held || refused || saving) return;
    // ✓ on an unchanged form is Done — except a re-date, whose ✓ puts the game back on even on its old date.
    if (!creating && !dirty && mode !== 'redate') { setMode('read'); return; }
    if (!(await lineIsCurrent())) return;
    const data = await write(creating ? 'POST' : 'PATCH', changes());
    if (!data) return;
    const first = Array.isArray(data.warnings) && data.warnings.length ? data.warnings[0] : null;
    if (creating) { onCreated(first); return; }
    await onChanged();
    setWarning(first);
    setMode('read');
  }

  async function act(status: 'postponed' | 'cancelled' | 'scheduled') {
    if (!(await write('PATCH', { status }))) {
      // A question that failed goes back to the record, where its error is said.
      setMode('read');
      return;
    }
    await onChanged();
    setMode('read');
    if (status === 'scheduled') setSaid(W.putBackSaid);
  }

  async function remove() {
    if (!(await write('DELETE'))) { setMode('read'); return; }
    onDeleted();
  }

  // ── The questions: a level inside the window, "Keep it" against the act ─────────────────────────────────────
  if (game && (mode === 'postpone' || mode === 'cancel' || mode === 'delete')) {
    const scoredGame = game.status === 'completed' && game.homeScore != null && game.awayScore != null;
    const q = mode === 'postpone' ? { title: W.postponeAsk(name), says: W.postponeSays, yes: W.postpone, cls: 'btn btn-lime', go: () => void act('postponed') }
      : mode === 'cancel' ? { title: W.cancelAsk(name), says: W.cancelSays, yes: W.cancel, cls: 'btn btn-danger', go: () => void act('cancelled') }
      : { title: W.deleteAsk(name), says: W.deleteSays(scoredGame), yes: W.deleteYes, cls: 'btn btn-danger', go: () => void remove() };
    return (
      <KitDialog kind="form" size="medium" eyebrow={W.eyebrow(divisionName)} title={q.title} onClose={onClose} busy={saving}
        back={{ label: name, onBack: () => setMode('read') }} levelKey={mode}
        footer={<>
          <button type="button" className="btn btn-outline" onClick={() => setMode('read')} disabled={saving}>{W.keep}</button>
          <button type="button" className={q.cls} onClick={q.go} disabled={saving}>{saving ? W.saving : q.yes}</button>
        </>}>
        <p>{q.says}</p>
      </KitDialog>
    );
  }

  const fact = (label: string, value: ReactNode) => <div><dt>{label}</dt><dd>{value}</dd></div>;
  const errorLine = error && <p className={repKit.formError} role="alert">{error}</p>;

  // ── Add › A game, and the pencil's form ─────────────────────────────────────────────────────────────────────
  if (editing) {
    const noun = fieldNounFor(sport);
    const inClub = venues.length > 0;
    const form = (
      <>
        {errorLine}
        <div className={g.pair}>
          <label className={ck.field}>
            <span className={ck.label}>{W.homeTeam}</span>
            <select className={ck.select} value={draft.homeTeamId} onChange={e => set('homeTeamId', e.target.value)}>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
          <label className={ck.field}>
            <span className={ck.label}>{W.awayTeam}</span>
            <select className={ck.select} value={draft.awayTeamId} onChange={e => set('awayTeamId', e.target.value)}>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
        </div>
        <div className={g.three}>
          <label className={ck.field}>
            <span className={ck.label}>{W.date}</span>
            <DateInput className={ck.input} value={draft.date} onChange={v => set('date', v)} />
          </label>
          <label className={ck.field}>
            <span className={ck.label}>{W.time}</span>
            <TimeInput className={ck.input} value={draft.time} onChange={v => set('time', v)} />
          </label>
          <label className={ck.field}>
            <span className={ck.label}>{W.endTime}</span>
            <TimeInput className={ck.input} value={draft.endTime} onChange={v => set('endTime', v)} />
          </label>
        </div>
        <WhereField
          idPrefix="hl-game"
          sport={sport}
          value={draft.where}
          onChange={w => set('where', w)}
          clubVenues={venues}
          inClub={inClub}
          classes={{ field: ck.field, label: ck.label, input: ck.input, select: ck.select, hint: ck.hint }}
          line={line}
          footHint={!inClub ? (
            <p className={ck.hint}>
              Typed locations can&apos;t be checked for double-bookings.{' '}
              <Link href={`/${orgSlug}/admin/org/venues`}>Set up your {noun.toLowerCase()}s once</Link> to pick them from a list.
            </p>
          ) : null}
        />
        {scored && (
          <div className={g.pair}>
            <label className={ck.field}>
              <span className={ck.label}>{W.score(team(draft.homeTeamId) || W.home)}</span>
              <input type="number" min={0} inputMode="numeric" className={ck.input} value={draft.homeScore} onChange={e => set('homeScore', e.target.value)} />
            </label>
            <label className={ck.field}>
              <span className={ck.label}>{W.score(team(draft.awayTeamId) || W.away)}</span>
              <input type="number" min={0} inputMode="numeric" className={ck.input} value={draft.awayScore} onChange={e => set('awayScore', e.target.value)} />
            </label>
          </div>
        )}
        {held && <p className={ck.hint} role="status">{held}</p>}
        <label className={ck.field}>
          <span className={ck.label}>{W.notes}</span>
          <textarea className={ck.textarea} value={draft.notes} onChange={e => set('notes', e.target.value)} rows={2} />
        </label>
      </>
    );

    if (creating) {
      return (
        <KitDialog kind="form" size="medium" eyebrow={W.eyebrow(divisionName)} title={W.addTitle} onClose={onClose} busy={saving} dirty={dirty}
          footer={<>
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="button" className="btn btn-lime" onClick={() => void save()} disabled={saving || refused || checking}>
              {saving ? W.saving : W.create}
            </button>
          </>}>
          {form}
        </KitDialog>
      );
    }
    return (
      <KitDialog kind="form" size="medium" record eyebrow={W.eyebrow(divisionName)} title={name} onClose={onClose} busy={saving} dirty={dirty}
        levelKey={mode} edit={{ editing: true, label: W.edit, onToggle: () => void save(), disabled: saving || refused || checking || !!held }}>
        {form}
      </KitDialog>
    );
  }

  // ── The record, read ────────────────────────────────────────────────────────────────────────────────────────
  const g0 = game!;
  const when = whenWords(g0);
  const where = booking ? whereWords(booking) : g0.location ?? '';
  const timeFrom = canRun ? booking?.clubSchedule?.scheduleName ?? null : null;
  const state = gameStateWords(g0);
  return (
    <KitDialog kind="form" size="medium" record eyebrow={W.eyebrow(divisionName)} title={name} identity={state} onClose={onClose} busy={saving}
      levelKey="read" status={said ? <NoticePill inline message={said} onDone={() => setSaid(null)} /> : undefined}
      edit={canRun && doors?.pencil ? { editing: false, label: W.edit, onToggle: () => openForm('edit') } : undefined}>
      {errorLine}
      <dl className={s.facts}>
        {fact(W.when, when ? (g0.status === 'postponed' ? SEASON_PUBLIC_WORDS.was(when) : when) : SEASON_PUBLIC_WORDS.dateToCome)}
        {where && fact(W.where, where)}
        {fact(W.home, team(g0.homeTeamId))}
        {fact(W.away, team(g0.awayTeamId))}
        {timeFrom && fact(W.timeFrom, W.timeFromValue(timeFrom))}
        {g0.notes ? fact(W.notes, g0.notes) : !canRun && fact(W.notes, W.none)}
      </dl>
      {warning && <p className={ck.hint} role="status">{W.possibleClash(warning)}</p>}
      {canRun && doors && (
        <div className={g.doors}>
          {doors.giveDate && <RecordAction icon={<CalendarPlus size={13} aria-hidden />} onClick={() => openForm('redate')} disabled={saving}>{W.giveDate}</RecordAction>}
          {doors.putBack && <RecordAction icon={<RotateCcw size={13} aria-hidden />} onClick={() => void act('scheduled')} disabled={saving}>{W.putBack}</RecordAction>}
          {doors.postpone && <RecordAction icon={<CalendarX2 size={13} aria-hidden />} onClick={() => setMode('postpone')} disabled={saving}>{W.postpone}</RecordAction>}
          {doors.cancel && <RecordAction icon={<Ban size={13} aria-hidden />} onClick={() => setMode('cancel')} disabled={saving}>{W.cancel}</RecordAction>}
          <RecordDelete onClick={() => setMode('delete')} disabled={saving}>{W.deleteDoor}</RecordDelete>
        </div>
      )}
    </KitDialog>
  );
}
