'use client';
/**
 * THE RAIN DELAY IN ITS HOME — Tournament admin redesign Stage 3, S5 (A42; ruled 2026-10-09, as drawn).
 *
 * Today's tool on the kit's form window (full screen with ← on a phone): pick the day, narrow it by division or field,
 * push its games still to play later by 30 minutes, an hour, two hours or another amount, cancel any of them, see
 * every new time — then one lime that moves them and says who it tells. One ×, and a row's own "Cancel game" (today
 * the window's Cancel and a row's Cancel meant two different things).
 *
 *   THE CHECK: every moved game against the tournament's own overlap rule (A37 — a red line on the row, and the lime
 *   waits), against the bracket's order (as today), and against the club's other bookings (6a's amber, which warns
 *   and never refuses).
 *   THE ANNOUNCEMENT, kept: a message prefilled from what changed, Post & notify, or Skip.
 *   UNDO after (Part 4's notice): the page puts the whole batch back (`bulk-restore`) — asking first when a message
 *   about the delay was posted, since that message stays.
 *   STORM MODE'S PLACE is reserved at the window's top: its own project, not designed, so it carries no words.
 *
 * Doors: the board's "Running late?" (`?tool=rain-delay`) and Tools → Rain delay in every view (A42).
 */
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Ban } from 'lucide-react';
import KitDialog from '@/components/admin/kit/club/KitDialog';
import { Callout, ClubRow, ClubRowList, RowAction } from '@/components/admin/kit/club/RepKit';
import { CheckChoice, screenParts } from '@/components/admin/tournament/ScreenParts';
import ck from '@/components/admin/kit/club/ClubKit.module.css';
import { formatTime } from '@/lib/utils';
import { addCalendarDays, tournamentToday } from '@/lib/timezone';
import { NIL_TEAM_ID } from '@/lib/schedule-change-classify';
import { planBulkReschedule, SHIFT_PRESET_MINUTES, type PlannedShift, type ReschedulableGame } from '@/lib/schedule-shift';
import { gameLengthMinutes } from '@/lib/booking-length';
import { bracketGameLabel } from '@/lib/playoff-bracket';
import { hasOrgVenueLibrary } from '@/lib/plan-features';
import { overlapGameOf, overlapRefusalWords, refusedOverlapsById } from '@/lib/tournament-overlap';
import { clashLine, clashLineText } from '@/lib/venue-clash-words';
import type { ClashFinding } from '@/lib/venue-clash';
import { RAIN_DELAY_WORDS as RW, SCHEDULE_DAY_WORDS as W, rainDelayMove, shiftWords, teamOrSlotWords } from '@/lib/schedule-words';
import type { Game, Team, Division, Tournament, Venue, OrgPlan } from '@/lib/types';
import rd from './RainDelay.module.css';

/** A club line belongs to a game at a proposed time: one found for another push amount never shows on this one. */
const clubKey = (id: string, to: { date: string; time: string }) => `${id}@${to.date}T${to.time}`;

/** What the rain delay did, for the page's notice and its Undo. */
export interface RainDelayDone {
  shifts: PlannedShift[];
  cancelIds: string[];
  shiftMinutes: number;
  moved: number;
  cancelled: number;
  /** A message about the delay was posted: Undo asks first, because the message stays. */
  posted: boolean;
}

interface ShiftDayModalProps {
  tournament: Tournament;
  orgSlug: string;
  planId?: OrgPlan | null;
  games: Game[];
  teams: Team[];
  divisions: Division[];
  venues: Venue[];
  /** The sport's surface word ("Diamond"). */
  fieldNoun: string;
  /** The page's field keying/labelling, so the filter matches the rest of the schedule. */
  getVenueKey: (g: Game) => string;
  getVenueLabel: (g: Game) => { name: string; sublabel?: string };
  /** Tournament Plus — whether the announcement can also push to fans. */
  canPushFans: boolean;
  onClose: () => void;
  /** The change is applied: the page re-reads its games (the window stays for the announcement). */
  onApplied: () => void;
  /** Posted or skipped: the window closes, and the page says what changed, with Undo. */
  onFinished: (done: RainDelayDone) => void;
}

function weekdayName(dateStr: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).toLocaleDateString('en-CA', { weekday: 'long', timeZone: 'UTC' }) : 'that day';
}
/** The announcement's lead-in for a day that isn't today ("For tomorrow, "). */
function dayContextPhrase(dateStr: string, today: string): string {
  if (dateStr === today) return '';
  if (dateStr === addCalendarDays(today, 1)) return 'For tomorrow, ';
  return `For ${weekdayName(dateStr)}, `;
}
/** Prefill an editable day-of message from what actually changed (kept from today's tool). */
function buildAnnouncementDraft(shifted: number, cancelled: number, shiftMinutes: number, dayCtx: string): { title: string; body: string } {
  const clauses: string[] = [];
  if (shifted > 0) clauses.push(`${shifted} game${shifted !== 1 ? 's have' : ' has'} been pushed back ${shiftWords(shiftMinutes)}`);
  if (cancelled > 0) clauses.push(`${cancelled} game${cancelled !== 1 ? 's have' : ' has'} been cancelled`);
  const core = clauses.length ? clauses.join(', ') : 'the schedule has changed';
  const sentence = dayCtx ? `${dayCtx}${core}.` : `${core.charAt(0).toUpperCase()}${core.slice(1)}.`;
  return { title: RW.announce.draftTitle, body: `${sentence} The updated schedule is live in the app — please check your game times before you head out.` };
}

export default function ShiftDayModal({
  tournament, orgSlug, planId, games, teams, divisions, venues, fieldNoun, getVenueKey, getVenueLabel, canPushFans,
  onClose, onApplied, onFinished,
}: ShiftDayModalProps) {
  const today = tournamentToday();
  const orgQuery = orgSlug ? `?orgSlug=${encodeURIComponent(orgSlug)}` : '';

  // The games still to play, by day, today onward — the days it can move (each in time order).
  const gamesByDay = useMemo(() => {
    const m = new Map<string, Game[]>();
    for (const g of games) {
      if (g.status !== 'scheduled' || !g.date || g.date < today) continue;
      const arr = m.get(g.date);
      if (arr) arr.push(g); else m.set(g.date, [g]);
    }
    for (const arr of m.values()) arr.sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''));
    return m;
  }, [games, today]);
  const availableDays = useMemo(() => [...gamesByDay.keys()].sort(), [gamesByDay]);
  const [selectedDay, setSelectedDay] = useState<string>(availableDays[0] ?? today);
  const [divisionFilter, setDivisionFilter] = useState('all');
  const [venueFilter, setVenueFilter] = useState('all');
  const dayGames = useMemo(() => gamesByDay.get(selectedDay) ?? [], [gamesByDay, selectedDay]);
  const divisionName = (id?: string) => divisions.find(d => d.id === id)?.name ?? '';
  const divisionOptions = useMemo(
    () => [...new Set(dayGames.map(g => g.divisionId).filter(Boolean))].map(id => ({ id, name: divisionName(id) })).sort((a, b) => a.name.localeCompare(b.name)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dayGames, divisions],
  );
  const venueOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const g of dayGames) {
      const key = getVenueKey(g);
      if (!m.has(key)) { const { name, sublabel } = getVenueLabel(g); m.set(key, sublabel && sublabel !== name ? `${name} · ${sublabel}` : name); }
    }
    return [...m.entries()].map(([key, label]) => ({ key, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [dayGames, getVenueKey, getVenueLabel]);
  // Every game the filters show moves, unless its row says Cancel game (the drawing: no picking box per row).
  const visibleGames = dayGames.filter(g =>
    (divisionFilter === 'all' || g.divisionId === divisionFilter) && (venueFilter === 'all' || getVenueKey(g) === venueFilter));

  const [cancelling, setCancelling] = useState<Set<string>>(() => new Set());
  const changeDay = (day: string) => { setSelectedDay(day); setDivisionFilter('all'); setVenueFilter('all'); setCancelling(new Set()); };

  // The shift: a dropdown (22 August, as drawn) — 30 minutes · 1 hour · 2 hours · Another amount.
  const [shiftChoice, setShiftChoice] = useState<string>('60');
  const [customMinutes, setCustomMinutes] = useState(45);
  const shiftMinutes = shiftChoice === 'other' ? customMinutes : Number(shiftChoice);

  const shiftIds = visibleGames.filter(g => !cancelling.has(g.id)).map(g => g.id);
  const cancelIds = visibleGames.filter(g => cancelling.has(g.id)).map(g => g.id);
  const allResched: ReschedulableGame[] = useMemo(() => games.map(g => ({
    id: g.id, date: g.date, time: g.time, status: g.status, isPlayoff: g.isPlayoff, bracketCode: g.bracketCode,
    homePlaceholder: g.homePlaceholder, awayPlaceholder: g.awayPlaceholder,
  })), [games]);
  const shiftKey = shiftIds.join(',');
  const cancelKey = cancelIds.join(',');
  const plan = useMemo(
    () => planBulkReschedule(allResched, { shiftMinutes: shiftIds.length ? shiftMinutes : 0, shiftIds, cancelIds }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allResched, shiftMinutes, shiftKey, cancelKey],
  );
  const shiftToById = new Map(plan.shifts.map(s => [s.id, s.to]));

  // ── The check: the bracket's order, the tournament's own overlap rule, the club's other bookings ──
  const violationCodes = new Set(plan.newViolations.flatMap(v => [v.game, v.feeder]));
  const nameOfTeam = (id: string | null | undefined) => (id ? teams.find(t => t.id === id)?.name : null);
  const refusals = useMemo(() => refusedOverlapsById({
    proposed: [
      ...plan.shifts.map(s => ({ ...overlapGameOf(games.find(g => g.id === s.id)!, nameOfTeam), gameDate: s.to.date, startTime: s.to.time })),
      ...plan.cancelIds.map(id => ({ ...overlapGameOf(games.find(g => g.id === id)!, nameOfTeam), status: 'cancelled' })),
    ],
    existing: games.map(g => overlapGameOf(g, nameOfTeam)),
    divisions,
    tournament,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [plan, games, divisions, tournament, teams]);
  const canCheckClub = hasOrgVenueLibrary(planId ?? null);
  const [clubFindings, setClubFindings] = useState<Record<string, ClashFinding[]>>({});
  useEffect(() => {
    if (!canCheckClub || plan.shifts.length === 0) return;
    const body = plan.shifts.flatMap(s => {
      const g = games.find(x => x.id === s.id);
      if (!g?.venueId) return [];
      const division = divisions.find(d => d.id === g.divisionId);
      return [{
        key: clubKey(g.id, s.to), date: s.to.date, time: s.to.time, venueId: g.venueId, venueFacilityId: g.venueFacilityId ?? null,
        durationMinutes: gameLengthMinutes(g.durationMinutes, division?.settings?.game_duration_minutes, tournament.settings?.game_duration_minutes),
      }];
    });
    if (!body.length) return;
    let live = true;
    const t = window.setTimeout(() => {
      fetch(`/api/admin/tournaments/${encodeURIComponent(tournament.id)}/club-clashes${orgQuery}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ games: body }),
      })
        .then(r => (r.ok ? r.json() : { findings: {} }))
        .then((d: { findings?: Record<string, ClashFinding[]> }) => { if (live) setClubFindings(d.findings ?? {}); })
        .catch(() => { /* no line, never an error on the window */ });
    }, 350);
    return () => { live = false; window.clearTimeout(t); };
  }, [canCheckClub, plan, games, divisions, tournament, orgQuery]);

  const team = (id?: string | null, placeholder?: string | null) =>
    teamOrSlotWords(id && id !== NIL_TEAM_ID ? nameOfTeam(id) : null, placeholder);
  const fieldWords = (g: Game) => {
    const { name, sublabel } = getVenueLabel(g);
    return sublabel && sublabel !== name ? sublabel : name;
  };
  const tells = [...plan.shifts.map(s => s.id), ...plan.cancelIds]
    .some(id => divisions.find(d => d.id === games.find(g => g.id === id)?.divisionId)?.scheduleVisibility === 'published');
  const blocked = plan.newViolations.length > 0;
  const refused = refusals.size > 0;
  const nothingToDo = plan.shifts.length === 0 && plan.cancelIds.length === 0;
  const cancellingPlayoff = visibleGames.some(g => cancelling.has(g.id) && g.isPlayoff);

  // ── Apply, then the announcement step (kept) ──
  const [step, setStep] = useState<'compose' | 'announce'>('compose');
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<RainDelayDone | null>(null);
  const [noticeIds, setNoticeIds] = useState<string[]>([]);
  const [annTitle, setAnnTitle] = useState('');
  const [annBody, setAnnBody] = useState('');
  const [notifyOn, setNotifyOn] = useState(true);
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  async function apply() {
    if (nothingToDo || blocked || refused) return;
    setApplying(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/games${orgQuery}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'bulk-reschedule', tournamentId: tournament.id, shiftMinutes: shiftIds.length ? shiftMinutes : 0, shiftIds, cancelIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? 'Could not move the games.');
      const result: RainDelayDone = {
        shifts: Array.isArray(data.shifts) ? data.shifts : plan.shifts,
        cancelIds: plan.cancelIds,
        shiftMinutes,
        moved: data.shifted ?? plan.shifts.length,
        cancelled: data.cancelled ?? plan.cancelIds.length,
        posted: false,
      };
      setDone(result);
      setNoticeIds(Array.isArray(data.noticeIds) ? data.noticeIds : []);
      const draft = buildAnnouncementDraft(result.moved, result.cancelled, shiftMinutes, dayContextPhrase(selectedDay, today));
      setAnnTitle(draft.title);
      setAnnBody(draft.body);
      setStep('announce');
      onApplied();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setApplying(false);
    }
  }

  async function postAnnouncement() {
    if (!done) return;
    setPosting(true);
    setPostError(null);
    try {
      const res = await fetch(`/api/admin/communications${orgQuery}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          data: {
            tournamentId: tournament.id,
            title: annTitle.trim() || RW.announce.draftTitle,
            body: annBody.trim(),
            pinned: true,
            channelSite: true,
            // Notify intent → fan push (Plus) + staff/coach push (every plan).
            channelPush: notifyOn && canPushFans,
            notifyStaff: notifyOn,
            // Only a message that reaches phones replaces the automatic notices; a site-only post leaves them to send.
            supersedeNoticeIds: notifyOn ? noticeIds : [],
          },
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.error ?? 'Could not post the message.');
      onFinished({ ...done, posted: true });
    } catch (e) {
      setPostError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setPosting(false);
    }
  }

  const dayLabel = W.dayLabel(selectedDay, today);
  const close = () => (done ? onFinished(done) : onClose());

  const composeBody = (
    <>
      {/* STORM MODE'S PLACE (S5, A42): its own project, not designed — the place is kept, and it says nothing. */}
      <div className={rd.stormPlace} data-reserved="storm-mode" />
      {availableDays.length > 1 && (
        <label className={ck.field}>
          <span className={ck.label}>{RW.day}</span>
          <select className={ck.select} value={selectedDay} onChange={e => changeDay(e.target.value)}>
            {availableDays.map(d => <option key={d} value={d}>{RW.dayChoice(W.dayLabel(d, today), gamesByDay.get(d)?.length ?? 0)}</option>)}
          </select>
        </label>
      )}
      {(divisionOptions.length > 1 || venueOptions.length > 1) && (
        <div className={rd.pair}>
          {divisionOptions.length > 1 && (
            <label className={ck.field}>
              <span className={ck.label}>{RW.division}</span>
              <select className={ck.select} value={divisionFilter} onChange={e => { setDivisionFilter(e.target.value); setCancelling(new Set()); }}>
                <option value="all">{RW.allDivisions}</option>
                {divisionOptions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </label>
          )}
          {venueOptions.length > 1 && (
            <label className={ck.field}>
              <span className={ck.label}>{RW.field(fieldNoun)}</span>
              <select className={ck.select} value={venueFilter} onChange={e => { setVenueFilter(e.target.value); setCancelling(new Set()); }}>
                <option value="all">{RW.allFields(fieldNoun)}</option>
                {venueOptions.map(v => <option key={v.key} value={v.key}>{v.label}</option>)}
              </select>
            </label>
          )}
        </div>
      )}
      <div className={rd.pair}>
        <label className={ck.field}>
          <span className={ck.label}>{RW.shift}</span>
          <select className={ck.select} value={shiftChoice} onChange={e => setShiftChoice(e.target.value)}>
            {SHIFT_PRESET_MINUTES.map(m => <option key={m} value={String(m)}>{RW.shiftChoice(m)}</option>)}
            <option value="other">{RW.anotherAmount}</option>
          </select>
        </label>
        {shiftChoice === 'other' && (
          <label className={ck.field}>
            <span className={ck.label}>{RW.minutes}</span>
            <input className={ck.input} type="number" inputMode="numeric" min={1} max={1440} step={5}
              value={customMinutes} onChange={e => setCustomMinutes(Math.max(1, Math.min(1440, Math.trunc(Number(e.target.value) || 0))))} />
          </label>
        )}
      </div>

      {visibleGames.length === 0 ? (
        <p className={rd.empty}>{RW.noMatch}</p>
      ) : (
        <ClubRowList inset label={dayLabel}>
          {visibleGames.map(g => {
            const isCancel = cancelling.has(g.id);
            const to = shiftToById.get(g.id);
            const flagged = !!g.bracketCode && violationCodes.has(g.bracketCode);
            const refusal = refusals.get(g.id);
            const found = to ? clubFindings[clubKey(g.id, to)] : undefined;
            const club = !isCancel && found?.length
              ? clashLineText(clashLine(found, {
                sport: tournament.sport, venueName: venues.find(v => v.id === g.venueId)?.name ?? '',
                facilityName: g.venueFacilityId ? venues.find(v => v.id === g.venueId)?.facilities?.find(f => f.id === g.venueFacilityId)?.name ?? null : null,
              }))
              : null;
            const where = [divisionName(g.divisionId) + (g.isPlayoff && g.bracketCode ? ` ${bracketGameLabel(g.bracketCode)}` : ''), fieldWords(g)].filter(Boolean).join(' · ');
            const refuseWords = refusal ? overlapRefusalWords(refusal, { field: fieldWords(g), noun: fieldNoun, divisions, tournament }) : null;
            return (
              <ClubRow
                key={g.id}
                title={`${team(g.awayTeamId, g.awayPlaceholder)} vs ${team(g.homeTeamId, g.homePlaceholder)}`}
                caption={(
                  <>
                    <span className={isCancel ? rd.cancelled : rd.move}>
                      {isCancel ? RW.cancelled : to ? rainDelayMove(g.time ?? '', to.time, to.date !== g.date) : formatTime(g.time)}
                    </span>
                    {' · '}{where}
                    {flagged && <span className={rd.refuse}><AlertTriangle size={13} aria-hidden /> {RW.beforeFeeder}</span>}
                    {refuseWords && <span className={rd.refuse}><Ban size={13} aria-hidden /> <b>{refuseWords.lead}</b>{refuseWords.rest}</span>}
                    {club && <span className={rd.club}><AlertTriangle size={13} aria-hidden /> {club}</span>}
                  </>
                )}
                beside={(
                  <RowAction onClick={() => setCancelling(prev => { const next = new Set(prev); if (next.has(g.id)) next.delete(g.id); else next.add(g.id); return next; })}>
                    {isCancel ? RW.moveInstead : RW.cancelGame}
                  </RowAction>
                )}
              />
            );
          })}
        </ClubRowList>
      )}
      {blocked && <Callout tone="bad" role="alert" icon={<AlertTriangle size={16} aria-hidden />}>{RW.bracketOrder}</Callout>}
      {cancellingPlayoff && !blocked && <Callout tone="warn" icon={<AlertTriangle size={16} aria-hidden />}>{RW.cancellingPlayoff}</Callout>}
      {error && <Callout tone="bad" role="alert" icon={<AlertTriangle size={16} aria-hidden />}>{error}</Callout>}
    </>
  );

  const announceBody = done && (
    <>
      <Callout tone="olive">{RW.announce.lead(done.moved, done.cancelled)}</Callout>
      <label className={ck.field}>
        <span className={ck.label}>{RW.announce.title}</span>
        <input className={ck.input} value={annTitle} onChange={e => setAnnTitle(e.target.value)} maxLength={120} />
      </label>
      <label className={ck.field}>
        <span className={ck.label}>{RW.announce.body}</span>
        <textarea className={ck.input} rows={4} value={annBody} onChange={e => setAnnBody(e.target.value)} maxLength={600} />
      </label>
      <CheckChoice checked={notifyOn} onChange={setNotifyOn} title={RW.announce.notify(canPushFans)} caption={RW.announce.notifyHint(canPushFans)} />
      {postError && <Callout tone="bad" role="alert" icon={<AlertTriangle size={16} aria-hidden />}>{postError}</Callout>}
    </>
  );

  return (
    <KitDialog
      kind="form"
      title={RW.title}
      identity={<span>{RW.caption(dayLabel, dayGames.length)}</span>}
      onClose={close}
      busy={applying || posting}
      footer={step === 'announce' ? (
        <>
          <button type="button" className={screenParts.plainButton} onClick={() => done && onFinished(done)} disabled={posting}>{RW.announce.skip}</button>
          <button type="button" className={`btn btn-lime ${rd.go}`} onClick={() => void postAnnouncement()} disabled={posting || !annBody.trim()}>
            {posting ? RW.announce.posting : RW.announce.post(notifyOn)}
          </button>
        </>
      ) : dayGames.length > 0 ? (
        <button type="button" className={`btn btn-lime ${rd.go}`} onClick={() => void apply()} disabled={applying || nothingToDo || blocked || refused}>
          {RW.apply(plan.shifts.length, plan.cancelIds.length, tells)}
        </button>
      ) : undefined}
    >
      {step === 'announce' ? announceBody : dayGames.length === 0 ? (
        <>
          <div className={rd.stormPlace} data-reserved="storm-mode" />
          <p className={rd.empty}><b>{RW.noGames}</b> {RW.noGamesBody}</p>
        </>
      ) : composeBody}
    </KitDialog>
  );
}
