'use client';
import React, { useMemo, useState } from 'react';
import { X, CloudRain, AlertTriangle, Trophy, Check, Undo2, MapPin } from 'lucide-react';
import { formatTime } from '@/lib/utils';
import { tournamentToday } from '@/lib/timezone';
import {
  planBulkReschedule,
  SHIFT_PRESET_MINUTES,
  type ReschedulableGame,
} from '@/lib/schedule-shift';
import type { Game, Team, Division } from '@/lib/types';

const NIL_UUID = '00000000-0000-0000-0000-000000000000';

interface ShiftDayModalProps {
  tournamentId: string;
  orgSlug: string;
  games: Game[];
  teams: Team[];
  divisions: Division[];
  /** Reuse the page's venue keying/labeling so the modal filter matches the rest of the schedule. */
  getVenueKey: (g: Game) => string;
  getVenueLabel: (g: Game) => { name: string; sublabel?: string };
  /** Tournament Plus+ — controls whether the notify step can also push anonymous fans. */
  canPushFans: boolean;
  onClose: () => void;
  /** Called after the change is applied so the page can refresh its games. */
  onApplied: () => void;
}

/** Sport-neutral duration wording for the prefilled announcement ("1 hour", "30 minutes"). */
function humanDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const parts = [];
  if (h > 0) parts.push(`${h} hour${h !== 1 ? 's' : ''}`);
  if (m > 0) parts.push(`${m} minute${m !== 1 ? 's' : ''}`);
  return parts.join(' ') || '0 minutes';
}

/** Parse a 'YYYY-MM-DD' wall-clock date into a UTC Date (so weekday/formatting never drift by zone). */
function ymdToUTC(dateStr: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null;
}

/** 'YYYY-MM-DD' + N calendar days, as a 'YYYY-MM-DD' string. */
function addDaysStr(dateStr: string, days: number): string {
  const d = ymdToUTC(dateStr);
  if (!d) return dateStr;
  d.setUTCDate(d.getUTCDate() + days);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function weekdayDate(dateStr: string): string {
  const d = ymdToUTC(dateStr);
  return d ? d.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }) : dateStr;
}

function weekdayName(dateStr: string): string {
  const d = ymdToUTC(dateStr);
  return d ? d.toLocaleDateString('en-CA', { weekday: 'long', timeZone: 'UTC' }) : 'that day';
}

/** Friendly picker label: "Today · Sat Jul 11", "Tomorrow · Sun Jul 12", or "Sat Jul 18". */
function dayLabel(dateStr: string, today: string): string {
  const wd = weekdayDate(dateStr);
  if (dateStr === today) return `Today · ${wd}`;
  if (dateStr === addDaysStr(today, 1)) return `Tomorrow · ${wd}`;
  return wd;
}

/** Sentence lead-in that names the day for a future change (empty for today, which reads naturally). */
function dayContextPhrase(dateStr: string, today: string): string {
  if (dateStr === today) return '';
  if (dateStr === addDaysStr(today, 1)) return 'For tomorrow, ';
  return `For ${weekdayName(dateStr)}, `;
}

/** Prefill an editable day-of message from what actually changed (sport-neutral, day-aware). */
function buildAnnouncementDraft(shifted: number, cancelled: number, shiftMinutes: number, dayCtx: string): { title: string; body: string } {
  const clauses: string[] = [];
  if (shifted > 0) clauses.push(`${shifted} game${shifted !== 1 ? 's have' : ' has'} been pushed back ${humanDuration(shiftMinutes)}`);
  if (cancelled > 0) clauses.push(`${cancelled} game${cancelled !== 1 ? 's have' : ' has'} been cancelled`);
  const core = clauses.length ? clauses.join(', ') : 'the schedule has changed';
  const sentence = dayCtx ? `${dayCtx}${core}.` : `${core.charAt(0).toUpperCase()}${core.slice(1)}.`;
  return {
    title: 'Schedule update',
    body: `${sentence} The updated schedule is live in the app — please check your game times before you head out.`,
  };
}

/**
 * "Rain delay" — bulk shift/cancel of a rained-out (or otherwise disrupted) day. Pick a day
 * (today or any upcoming day that still has games), push its remaining games by a chosen amount
 * and/or cancel some, preview the before → after, and apply it in one atomic action (the server
 * enforces bracket order + all-or-nothing). Also covers running behind or a bad forecast.
 */
export default function ShiftDayModal({ tournamentId, orgSlug, games, teams, divisions, getVenueKey, getVenueLabel, canPushFans, onClose, onApplied }: ShiftDayModalProps) {
  const today = tournamentToday();

  // Not-yet-played games grouped by day, today onward — the days you can adjust (each sorted by time).
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
  const defaultDay = availableDays[0] ?? today;

  const [selectedDay, setSelectedDay] = useState<string>(defaultDay);
  const [divisionFilter, setDivisionFilter] = useState<string>('all');
  const [venueFilter, setVenueFilter] = useState<string>('all');
  const dayGames = gamesByDay.get(selectedDay) ?? [];

  // Full set (any date/status) so the bracket-order guard can see every feeder.
  const allResched: ReschedulableGame[] = useMemo(
    () => games.map((g) => ({
      id: g.id, date: g.date, time: g.time, status: g.status,
      isPlayoff: g.isPlayoff, bracketCode: g.bracketCode,
      homePlaceholder: g.homePlaceholder, awayPlaceholder: g.awayPlaceholder,
    })),
    [games],
  );

  const divisionName = (id?: string) => divisions.find((d) => d.id === id)?.name ?? 'Division';

  // Division + venue filter options present in the SELECTED day's games (each shown only when >1).
  const divisionOptions = useMemo(() => {
    const ids = new Set<string>();
    for (const g of dayGames) if (g.divisionId) ids.add(g.divisionId);
    return [...ids].map((id) => ({ id, name: divisionName(id) })).sort((a, b) => a.name.localeCompare(b.name));
  }, [dayGames, divisions]);

  const venueOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const g of dayGames) {
      const key = getVenueKey(g);
      if (!m.has(key)) {
        const { name, sublabel } = getVenueLabel(g);
        m.set(key, sublabel ? `${name} · ${sublabel}` : name);
      }
    }
    return [...m.entries()].map(([key, label]) => ({ key, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [dayGames, getVenueKey, getVenueLabel]);

  const multiDivision = divisionOptions.length > 1;

  // The games shown + acted on = the selected day's games narrowed by the active filters.
  const visibleGames = useMemo(() => dayGames.filter((g) =>
    (divisionFilter === 'all' || g.divisionId === divisionFilter) &&
    (venueFilter === 'all' || getVenueKey(g) === venueFilter),
  ), [dayGames, divisionFilter, venueFilter, getVenueKey]);

  const [included, setIncluded] = useState<Set<string>>(() => new Set((gamesByDay.get(defaultDay) ?? []).map((g) => g.id)));
  const [cancelling, setCancelling] = useState<Set<string>>(() => new Set());

  // Reset the working selection to a set of games (select-all default), clearing any cancels.
  const resetSelection = (list: Game[]) => {
    setIncluded(new Set(list.map((g) => g.id)));
    setCancelling(new Set());
  };
  const visibleFor = (day: string, divF: string, venF: string) =>
    (gamesByDay.get(day) ?? []).filter((g) =>
      (divF === 'all' || g.divisionId === divF) && (venF === 'all' || getVenueKey(g) === venF));

  // Switching the day clears the filters + resets the selection to that day's full slate.
  const changeDay = (day: string) => {
    setSelectedDay(day);
    setDivisionFilter('all');
    setVenueFilter('all');
    resetSelection(gamesByDay.get(day) ?? []);
  };
  const changeDivisionFilter = (v: string) => { setDivisionFilter(v); resetSelection(visibleFor(selectedDay, v, venueFilter)); };
  const changeVenueFilter = (v: string) => { setVenueFilter(v); resetSelection(visibleFor(selectedDay, divisionFilter, v)); };
  const [shiftMinutes, setShiftMinutes] = useState<number>(60);
  const [customMode, setCustomMode] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ shifted: number; cancelled: number } | null>(null);

  // B3 hand-off: after the shift lands, prompt to announce + notify (fans + coaches).
  const [step, setStep] = useState<'compose' | 'announce' | 'done'>('compose');
  const [annTitle, setAnnTitle] = useState('');
  const [annBody, setAnnBody] = useState('');
  const [notifyOn, setNotifyOn] = useState(true);
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  const shiftIds = useMemo(() => [...included].filter((id) => !cancelling.has(id)), [included, cancelling]);
  const cancelIds = useMemo(() => [...included].filter((id) => cancelling.has(id)), [included, cancelling]);

  const plan = useMemo(
    () => planBulkReschedule(allResched, { shiftMinutes, shiftIds, cancelIds }),
    [allResched, shiftMinutes, shiftIds, cancelIds],
  );

  const shiftToById = useMemo(() => new Map(plan.shifts.map((s) => [s.id, s.to])), [plan.shifts]);

  // Bracket codes involved in a NEW ordering violation → flag those rows and block apply.
  const violationCodes = useMemo(() => {
    const set = new Set<string>();
    for (const v of plan.newViolations) { set.add(v.game); set.add(v.feeder); }
    return set;
  }, [plan.newViolations]);

  const cancellingPlayoff = useMemo(
    () => dayGames.some((g) => cancelIds.includes(g.id) && g.isPlayoff),
    [dayGames, cancelIds],
  );

  const nameFor = (teamId?: string, placeholder?: string) => {
    if (teamId && teamId !== NIL_UUID) {
      const t = teams.find((x) => x.id === teamId);
      if (t) return t.name;
    }
    return placeholder || 'TBD';
  };
  const gameLabel = (g: Game) => `${nameFor(g.homeTeamId, g.homePlaceholder)} vs ${nameFor(g.awayTeamId, g.awayPlaceholder)}`;

  const allSelected = visibleGames.length > 0 && visibleGames.every((g) => included.has(g.id));
  const toggleAll = () => setIncluded(allSelected ? new Set() : new Set(visibleGames.map((g) => g.id)));
  const toggleGame = (id: string) => setIncluded((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleCancel = (id: string) => {
    setIncluded((prev) => new Set(prev).add(id)); // marking cancel implies included
    setCancelling((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const nothingToDo = shiftIds.length === 0 && cancelIds.length === 0;
  const blocked = plan.newViolations.length > 0;

  const shiftLabel = (m: number) => {
    if (m % 60 === 0) return `${m / 60}h`;
    if (m < 60) return `${m}m`;
    return `${Math.floor(m / 60)}h ${m % 60}m`;
  };

  async function apply() {
    setApplying(true);
    setError(null);
    try {
      const orgQuery = orgSlug ? `?orgSlug=${encodeURIComponent(orgSlug)}` : '';
      const res = await fetch(`/api/admin/games${orgQuery}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'bulk-reschedule',
          tournamentId,
          shiftMinutes: shiftIds.length > 0 ? shiftMinutes : 0,
          shiftIds,
          cancelIds,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? 'Could not adjust the games.');
      const r = { shifted: data.shifted ?? shiftIds.length, cancelled: data.cancelled ?? cancelIds.length };
      setResult(r);
      const draft = buildAnnouncementDraft(r.shifted, r.cancelled, shiftMinutes, dayContextPhrase(selectedDay, today));
      setAnnTitle(draft.title);
      setAnnBody(draft.body);
      setStep('announce');
      onApplied();
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong.');
    } finally {
      setApplying(false);
    }
  }

  async function postAnnouncement() {
    setPosting(true);
    setPostError(null);
    try {
      const orgQuery = orgSlug ? `?orgSlug=${encodeURIComponent(orgSlug)}` : '';
      const res = await fetch(`/api/admin/communications${orgQuery}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          data: {
            tournamentId,
            title: annTitle.trim() || 'Schedule update',
            body: annBody.trim(),
            pinned: true,
            channelSite: true,
            // Notify intent → fan push (Plus only) + staff/coach push (all tiers, free operational).
            channelPush: notifyOn && canPushFans,
            notifyStaff: notifyOn,
          },
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.error ?? 'Could not post the announcement.');
      setStep('done');
    } catch (e: any) {
      setPostError(e?.message ?? 'Something went wrong.');
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={result ? onClose : undefined}>
      <div className="modal" style={{ maxWidth: '560px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CloudRain size={16} style={{ color: 'var(--logic-lime)' }} /> Rain delay
          </h3>
          <button className="btn btn-ghost btn-data" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>

        {step === 'done' ? (
          /* ── Done (announcement posted) ───────────────────────────────────── */
          <div style={{ textAlign: 'center', padding: '0.5rem 0 0.25rem' }}>
            <div style={{
              width: '44px', height: '44px', margin: '0 auto 0.75rem',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: '50%', color: 'var(--success)',
              background: 'rgba(var(--success-rgb),0.12)', border: '1px solid rgba(var(--success-rgb),0.35)',
            }}><Check size={22} /></div>
            <p style={{ fontWeight: 700, color: 'var(--logic-lime)', marginBottom: '0.35rem' }}>Schedule updated &amp; posted</p>
            <p style={{ fontSize: '0.85rem', color: 'var(--white-60)' }}>
              The new times are live and {notifyOn ? 'everyone who opted in has been notified.' : 'the update is on the public schedule.'}
            </p>
            <button className="btn btn-primary btn-data" onClick={onClose} style={{ marginTop: '1.25rem', minWidth: '160px' }}>Done</button>
          </div>
        ) : step === 'announce' && result ? (
          /* ── Announce hand-off (B3) ───────────────────────────────────────── */
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.7rem', marginBottom: '0.9rem', borderRadius: '8px', background: 'rgba(var(--success-rgb),0.1)', border: '1px solid rgba(var(--success-rgb),0.3)', fontSize: '0.83rem', color: 'var(--success)' }}>
              <Check size={16} style={{ flexShrink: 0 }} />
              <span>
                {result.shifted > 0 && <>{result.shifted} game{result.shifted !== 1 ? 's' : ''} moved{result.cancelled > 0 ? ' · ' : '.'}</>}
                {result.cancelled > 0 && <>{result.cancelled} cancelled.</>} Now let people know.
              </span>
            </div>

            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--white-70)', display: 'block', marginBottom: '0.3rem' }}>Message title</label>
            <input
              className="form-input"
              value={annTitle}
              onChange={(e) => setAnnTitle(e.target.value)}
              style={{ width: '100%', marginBottom: '0.7rem' }}
              maxLength={120}
            />
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--white-70)', display: 'block', marginBottom: '0.3rem' }}>Message</label>
            <textarea
              className="form-textarea"
              value={annBody}
              onChange={(e) => setAnnBody(e.target.value)}
              rows={4}
              style={{ width: '100%', marginBottom: '0.7rem', resize: 'vertical' }}
              maxLength={600}
            />

            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.83rem', color: 'var(--white-70)', cursor: 'pointer' }}>
              <input type="checkbox" checked={notifyOn} onChange={(e) => setNotifyOn(e.target.checked)} style={{ marginTop: '0.15rem' }} />
              <span>
                Send a notification{canPushFans ? ' to opted-in fans and your staff/coaches' : ' to your staff and coaches'}
                <span style={{ display: 'block', color: 'var(--white-50)', fontSize: '0.76rem' }}>
                  {canPushFans
                    ? 'Pushes to fans following the tournament and your coaches. It also pins to the public schedule.'
                    : 'Pushes to your staff and portal coaches, and pins to the public schedule. Fan push needs Tournament Plus.'}
                </span>
              </span>
            </label>

            {postError && <p style={{ marginTop: '0.7rem', fontSize: '0.82rem', color: 'var(--danger)' }}>{postError}</p>}

            <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button className="btn btn-ghost btn-data" onClick={onClose} disabled={posting}>Skip</button>
              <button className="btn btn-primary btn-data" onClick={postAnnouncement} disabled={posting || !annBody.trim()} style={{ minWidth: '150px' }}>
                {posting ? 'Posting…' : notifyOn ? 'Post & notify' : 'Post to schedule'}
              </button>
            </div>
          </div>
        ) : dayGames.length === 0 ? (
          /* ── Empty ────────────────────────────────────────────────────────── */
          <div style={{ padding: '1rem 0', textAlign: 'center', color: 'var(--white-60)' }}>
            <p style={{ marginBottom: '0.25rem', fontWeight: 600 }}>No upcoming games to adjust.</p>
            <p style={{ fontSize: '0.85rem' }}>This tool moves or cancels not-yet-played games for a chosen day. Once games are scheduled, come back here for a rain delay or a running-behind day.</p>
            <button className="btn btn-ghost btn-data" onClick={onClose} style={{ marginTop: '1rem' }}>Close</button>
          </div>
        ) : (
          <>
            <p style={{ fontSize: '0.82rem', color: 'var(--white-60)', marginTop: 0, marginBottom: '0.85rem' }}>
              Rain, heat, or running behind? Move or cancel a day&rsquo;s games at once, then let everyone know.
            </p>

            {/* ── Day to adjust ─────────────────────────────────────────────── */}
            <div style={{ marginBottom: '0.85rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--white-70)', display: 'block', marginBottom: '0.4rem' }}>Day to adjust</label>
              {availableDays.length > 1 ? (
                <select className="form-select" value={selectedDay} onChange={(e) => changeDay(e.target.value)} style={{ width: '100%' }}>
                  {availableDays.map((d) => {
                    const n = gamesByDay.get(d)?.length ?? 0;
                    return <option key={d} value={d}>{dayLabel(d, today)} — {n} game{n !== 1 ? 's' : ''}</option>;
                  })}
                </select>
              ) : (
                <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{dayLabel(selectedDay, today)}</div>
              )}
            </div>

            {/* ── Filters: division + venue (each shown only when the day has more than one) ── */}
            {(divisionOptions.length > 1 || venueOptions.length > 1) && (
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.85rem' }}>
                {divisionOptions.length > 1 && (
                  <div style={{ flex: '1 1 45%', minWidth: '140px' }}>
                    <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--white-55)', display: 'block', marginBottom: '0.25rem' }}>Division</label>
                    <select className="form-select" value={divisionFilter} onChange={(e) => changeDivisionFilter(e.target.value)} style={{ width: '100%' }}>
                      <option value="all">All divisions</option>
                      {divisionOptions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                )}
                {venueOptions.length > 1 && (
                  <div style={{ flex: '1 1 45%', minWidth: '140px' }}>
                    <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--white-55)', display: 'block', marginBottom: '0.25rem' }}>Venue</label>
                    <select className="form-select" value={venueFilter} onChange={(e) => changeVenueFilter(e.target.value)} style={{ width: '100%' }}>
                      <option value="all">All venues</option>
                      {venueOptions.map((v) => <option key={v.key} value={v.key}>{v.label}</option>)}
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* ── Shift amount ──────────────────────────────────────────────── */}
            <div style={{ marginBottom: '0.85rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--white-70)', display: 'block', marginBottom: '0.4rem' }}>
                Push games later by
              </label>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                {SHIFT_PRESET_MINUTES.map((m) => (
                  <button
                    key={m}
                    className={`btn btn-data ${!customMode && shiftMinutes === m ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => { setCustomMode(false); setShiftMinutes(m); }}
                  >+{shiftLabel(m)}</button>
                ))}
                <button
                  className={`btn btn-data ${customMode ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setCustomMode(true)}
                >Custom</button>
                {customMode && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                    <input
                      type="number" min={1} max={1440} step={5}
                      value={Number.isFinite(shiftMinutes) ? shiftMinutes : ''}
                      onChange={(e) => setShiftMinutes(Math.max(0, Math.min(1440, Math.trunc(Number(e.target.value) || 0))))}
                      style={{ width: '80px' }}
                      className="form-input"
                      aria-label="Custom minutes"
                    />
                    <span style={{ fontSize: '0.8rem', color: 'var(--white-60)' }}>min</span>
                  </span>
                )}
              </div>
            </div>

            {/* ── Game list ─────────────────────────────────────────────────── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
              <button className="btn btn-ghost btn-data" onClick={toggleAll} style={{ fontSize: '0.78rem' }}>
                {allSelected ? 'Select none' : 'Select all'}
              </button>
              <span style={{ fontSize: '0.78rem', color: 'var(--white-50)' }}>
                {visibleGames.length} game{visibleGames.length !== 1 ? 's' : ''}
                {(divisionFilter !== 'all' || venueFilter !== 'all') && visibleGames.length !== dayGames.length ? ` of ${dayGames.length}` : ''}
              </span>
            </div>

            <div style={{ maxHeight: '42vh', overflowY: 'auto', border: '1px solid var(--white-10)', borderRadius: '8px' }}>
              {visibleGames.length === 0 ? (
                <div style={{ padding: '1.1rem 0.7rem', textAlign: 'center', fontSize: '0.82rem', color: 'var(--white-50)' }}>No games match these filters.</div>
              ) : visibleGames.map((g) => {
                const isIncluded = included.has(g.id);
                const isCancel = cancelling.has(g.id);
                const to = shiftToById.get(g.id);
                const flagged = g.bracketCode ? violationCodes.has(g.bracketCode) : false;
                const movedToNextDay = to && to.date !== g.date;
                const v = getVenueLabel(g);
                return (
                  <div
                    key={g.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.6rem',
                      padding: '0.55rem 0.7rem',
                      borderBottom: '1px solid var(--white-05)',
                      opacity: isIncluded ? 1 : 0.5,
                      background: flagged ? 'rgba(var(--danger-rgb),0.08)' : undefined,
                    }}
                  >
                    <input type="checkbox" checked={isIncluded} onChange={() => toggleGame(g.id)} aria-label={`Include ${gameLabel(g)}`} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {g.isPlayoff && <Trophy size={12} style={{ color: 'var(--logic-lime)', flexShrink: 0 }} />}
                        {gameLabel(g)}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--white-55)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span style={{ textDecoration: isCancel ? 'line-through' : undefined }}>{formatTime(g.time)}</span>
                        {isIncluded && !isCancel && to && (
                          <span style={{ color: 'var(--logic-lime)' }}>→ {formatTime(to.time)}{movedToNextDay ? ' (next day)' : ''}</span>
                        )}
                        {isIncluded && isCancel && <span style={{ color: 'var(--danger)' }}>Cancelled</span>}
                        {flagged && (
                          <span style={{ color: 'var(--danger)', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                            <AlertTriangle size={11} /> before its feeder
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--white-45)', display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {multiDivision && <><span style={{ color: 'var(--white-55)', fontWeight: 600 }}>{divisionName(g.divisionId)}</span><span aria-hidden>·</span></>}
                        <MapPin size={10} style={{ flexShrink: 0 }} aria-hidden />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.sublabel ? `${v.name} · ${v.sublabel}` : v.name}</span>
                      </div>
                    </div>
                    <button
                      className="btn btn-ghost btn-data"
                      onClick={() => toggleCancel(g.id)}
                      title={isCancel ? 'Keep this game (move instead)' : 'Cancel this game'}
                      style={{ fontSize: '0.72rem', color: isCancel ? 'var(--logic-lime)' : 'var(--danger)', flexShrink: 0 }}
                    >
                      {isCancel ? <><Undo2 size={12} /> Keep</> : 'Cancel'}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* ── Warnings ──────────────────────────────────────────────────── */}
            {blocked && (
              <div style={{ marginTop: '0.7rem', padding: '0.55rem 0.7rem', borderRadius: '8px', background: 'rgba(var(--danger-rgb),0.1)', border: '1px solid rgba(var(--danger-rgb),0.35)', fontSize: '0.8rem', color: 'var(--danger)', display: 'flex', gap: '0.5rem' }}>
                <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                <span>This would schedule a playoff game before the games that feed it. Adjust the times or which games you&rsquo;re moving so every playoff game stays after its feeders.</span>
              </div>
            )}
            {cancellingPlayoff && !blocked && (
              <div style={{ marginTop: '0.7rem', padding: '0.55rem 0.7rem', borderRadius: '8px', background: 'rgba(var(--warning-rgb),0.1)', border: '1px solid rgba(var(--warning-rgb),0.35)', fontSize: '0.8rem', color: 'var(--warning)', display: 'flex', gap: '0.5rem' }}>
                <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                <span>You&rsquo;re cancelling a playoff game. Its spot in the bracket will need to be resolved by hand afterwards.</span>
              </div>
            )}
            {error && (
              <p style={{ marginTop: '0.7rem', fontSize: '0.82rem', color: 'var(--danger)' }}>{error}</p>
            )}

            {/* ── Footer ────────────────────────────────────────────────────── */}
            <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--white-70)' }}>
                {shiftIds.length > 0 && <>{shiftIds.length} moving +{shiftLabel(shiftMinutes)}</>}
                {shiftIds.length > 0 && cancelIds.length > 0 && ' · '}
                {cancelIds.length > 0 && <>{cancelIds.length} cancelled</>}
                {nothingToDo && 'Nothing selected'}
              </span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-ghost btn-data" onClick={onClose} disabled={applying}>Cancel</button>
                <button className="btn btn-primary btn-data" onClick={apply} disabled={applying || nothingToDo || blocked} style={{ minWidth: '130px' }}>
                  {applying ? 'Applying…' : 'Apply changes'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
