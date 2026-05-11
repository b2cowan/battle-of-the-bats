'use client';
import { useState, useEffect, useCallback } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Plus, X, Trophy, Swords, Shield, Dumbbell, Users, MoreHorizontal } from 'lucide-react';
import Link from 'next/link';
import { useCoaches } from '@/lib/coaches-context';
import styles from '../../../coaches.module.css';
import type { RepTeamEvent, RepEventType } from '@/lib/types';

// ── Constants ──────────────────────────────────────────────────────────────────

const EVENT_COLORS: Record<RepEventType, string> = {
  external_tournament: '#f97316',
  tournament_game:     '#f59e0b',
  scrimmage:           '#3b82f6',
  league_game:         '#22c55e',
  practice:            '#a855f7',
  team_event:          '#6b7280',
};

const EVENT_LABELS: Record<RepEventType, string> = {
  external_tournament: 'Tournament',
  tournament_game:     'Game (Tournament)',
  scrimmage:           'Scrimmage',
  league_game:         'League Game',
  practice:            'Practice',
  team_event:          'Team Event',
};

const EVENT_ICONS: Record<RepEventType, React.ElementType> = {
  external_tournament: Trophy,
  tournament_game:     Trophy,
  scrimmage:           Swords,
  league_game:         Shield,
  practice:            Dumbbell,
  team_event:          Users,
};

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

type ViewMode = 'list' | 'week' | 'month';

interface EventForm {
  eventType: RepEventType;
  name: string;
  description: string;
  startsAt: string;
  endsAt: string;
  location: string;
  opponent: string;
  homeAway: string;
  parentEventId: string;
  isRecurring: boolean;
  dayOfWeek: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
}

const BLANK_FORM: EventForm = {
  eventType: 'practice',
  name: '',
  description: '',
  startsAt: '',
  endsAt: '',
  location: '',
  opponent: '',
  homeAway: '',
  parentEventId: '',
  isRecurring: false,
  dayOfWeek: '1',
  startDate: '',
  endDate: '',
  startTime: '',
  endTime: '',
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-CA', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function fmtDateInput(iso: string) {
  return iso.slice(0, 10);
}

function fmtTimeInput(iso: string) {
  return new Date(iso).toTimeString().slice(0, 5);
}

function isoFromInputs(date: string, time: string) {
  return `${date}T${time}`;
}

function monthKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function weekKey(iso: string) {
  const d = new Date(iso);
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return monday.toISOString().slice(0, 10);
}

// ── Components ────────────────────────────────────────────────────────────────

function EventChip({ event, onClick }: { event: RepTeamEvent; onClick: () => void }) {
  const color = EVENT_COLORS[event.eventType];
  const Icon = EVENT_ICONS[event.eventType];
  return (
    <button
      className={styles.eventChip}
      style={{ borderLeftColor: color }}
      onClick={onClick}
    >
      <Icon size={12} style={{ color, flexShrink: 0 }} />
      <span className={styles.eventChipTime}>
        {event.startsAt ? fmtTime(event.startsAt) : ''}
      </span>
      <span className={styles.eventChipName}>{event.name}</span>
      {event.result && (
        <span className={styles.eventChipResult} style={{
          color: event.result === 'win' ? '#22c55e' : event.result === 'loss' ? '#ef4444' : '#f59e0b',
        }}>
          {event.result.toUpperCase()}
        </span>
      )}
    </button>
  );
}

function WLTWidget({ events }: { events: RepTeamEvent[] }) {
  const games = events.filter(e => e.eventType === 'league_game' && e.result);
  const w = games.filter(e => e.result === 'win').length;
  const l = games.filter(e => e.result === 'loss').length;
  const t = games.filter(e => e.result === 'tie').length;
  if (!games.length) return null;
  return (
    <div className={styles.wltWidget}>
      <span className={styles.wltLabel}>Season Record</span>
      <div className={styles.wltRow}>
        <span className={styles.wltW}>{w}<small>W</small></span>
        <span className={styles.wltSep}>–</span>
        <span className={styles.wltL}>{l}<small>L</small></span>
        {t > 0 && <><span className={styles.wltSep}>–</span><span className={styles.wltT}>{t}<small>T</small></span></>}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CoachesSchedulePage({
  params,
}: {
  params: { orgSlug: string; teamId: string };
}) {
  const { orgSlug, teamId } = params;
  const { assignments, loading: ctxLoading } = useCoaches();

  const [events, setEvents] = useState<RepTeamEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [view, setView] = useState<ViewMode>('list');
  const [cursorDate, setCursorDate] = useState(() => new Date().toISOString().slice(0, 10));

  const [selectedEvent, setSelectedEvent] = useState<RepTeamEvent | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addTypeMenuOpen, setAddTypeMenuOpen] = useState(false);
  const [form, setForm] = useState<EventForm>(BLANK_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ eventId: string; isRecurring: boolean } | null>(null);

  const base = `/${orgSlug}/coaches/teams/${teamId}`;

  const assignment = assignments.find(a => a.teamId === teamId);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/events`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setEvents(data.events ?? []);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load events');
    } finally {
      setLoading(false);
    }
  }, [orgSlug, teamId]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  // ── Add event ───────────────────────────────────────────────────────────────

  function openAddForm(type: RepEventType) {
    setAddTypeMenuOpen(false);
    setForm({ ...BLANK_FORM, eventType: type });
    setSaveError('');
    setShowAddForm(true);
  }

  async function handleSave() {
    setSaveError('');
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        eventType: form.eventType,
        name: form.name.trim(),
        description: form.description.trim() || null,
        location: form.location.trim() || null,
        opponent: form.opponent.trim() || null,
        homeAway: form.homeAway || null,
        parentEventId: form.parentEventId || null,
      };

      if (form.eventType === 'practice' && form.isRecurring) {
        body.isRecurring = true;
        body.recurrenceRule = {
          dayOfWeek: Number(form.dayOfWeek),
          startDate: form.startDate,
          endDate: form.endDate,
          startTime: form.startTime,
          endTime: form.endTime || null,
        };
      } else {
        if (!form.startsAt || (!form.isRecurring && form.eventType === 'practice' && !form.startTime)) {
          const d = form.startDate || form.startsAt?.slice(0, 10);
          const t = form.startTime || form.startsAt?.slice(11, 16);
          body.startsAt = d && t ? isoFromInputs(d, t) : form.startsAt;
        } else {
          body.startsAt = form.startsAt;
        }
        body.endsAt = form.endsAt || null;
      }

      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(d.error ?? 'Save failed');
      }
      setShowAddForm(false);
      await fetchEvents();
    } catch (e: any) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  }

  // ── Score entry ─────────────────────────────────────────────────────────────

  const [scoreForm, setScoreForm] = useState<{ homeScore: string; awayScore: string; result: string } | null>(null);

  async function handleScoreSave() {
    if (!selectedEvent || !scoreForm) return;
    setSaving(true);
    try {
      const hs = Number(scoreForm.homeScore);
      const as = Number(scoreForm.awayScore);
      const res = await fetch(`/api/coaches/${orgSlug}/teams/${teamId}/events/${selectedEvent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          homeScore: hs,
          awayScore: as,
          result: scoreForm.result || (hs > as ? 'win' : hs < as ? 'loss' : 'tie'),
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Save failed');
      const { event: updated } = await res.json();
      setSelectedEvent(updated);
      setScoreForm(null);
      await fetchEvents();
    } catch (e: any) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  }

  // ── Delete ──────────────────────────────────────────────────────────────────

  async function handleDelete(eventId: string, scope: 'one' | 'remaining' | 'all') {
    setSaving(true);
    try {
      const res = await fetch(
        `/api/coaches/${orgSlug}/teams/${teamId}/events/${eventId}?scope=${scope}`,
        { method: 'DELETE' },
      );
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Delete failed');
      setDeleteConfirm(null);
      setSelectedEvent(null);
      await fetchEvents();
    } catch (e: any) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  }

  // ── Rendering ───────────────────────────────────────────────────────────────

  if (ctxLoading) return <p className={styles.muted}>Loading…</p>;
  if (!assignment) {
    return (
      <div className={styles.notAssigned}>
        <h2>Team not found</h2>
        <p>You are not assigned to this team.</p>
      </div>
    );
  }

  // Group events for month/week views
  const eventsByMonth: Record<string, RepTeamEvent[]> = {};
  const eventsByWeek: Record<string, RepTeamEvent[]> = {};
  for (const e of events) {
    if (!e.startsAt) continue;
    const mk = monthKey(e.startsAt);
    const wk = weekKey(e.startsAt);
    (eventsByMonth[mk] ??= []).push(e);
    (eventsByWeek[wk] ??= []).push(e);
  }

  // Navigator helpers for month/week
  function navigate(dir: -1 | 1) {
    const d = new Date(cursorDate + 'T00:00:00');
    if (view === 'month') {
      d.setMonth(d.getMonth() + dir);
    } else {
      d.setDate(d.getDate() + dir * 7);
    }
    setCursorDate(d.toISOString().slice(0, 10));
  }

  const curMonth = cursorDate.slice(0, 7);
  const curWeek  = weekKey(cursorDate + 'T00:00:00');

  function renderListView() {
    if (!events.length) {
      return <div className={styles.emptyState}>No events scheduled yet. Use "Add Event" to get started.</div>;
    }
    const grouped: Record<string, RepTeamEvent[]> = {};
    for (const e of events) {
      const mk = monthKey(e.startsAt);
      (grouped[mk] ??= []).push(e);
    }
    return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([mk, evts]) => {
      const label = new Date(mk + '-01').toLocaleDateString('en-CA', { month: 'long', year: 'numeric' });
      return (
        <div key={mk} className={styles.calMonthGroup}>
          <div className={styles.calMonthLabel}>{label}</div>
          <div className={styles.calEventList}>
            {evts.map(e => (
              <EventChip key={e.id} event={e} onClick={() => setSelectedEvent(e)} />
            ))}
          </div>
        </div>
      );
    });
  }

  function renderWeekView() {
    const weekStart = new Date(curWeek + 'T00:00:00');
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    });
    return (
      <div className={styles.calWeekGrid}>
        {days.map(day => {
          const key = day.toISOString().slice(0, 10);
          const dayEvents = events.filter(e => e.startsAt?.slice(0, 10) === key);
          return (
            <div key={key} className={styles.calWeekDay}>
              <div className={styles.calWeekDayLabel}>
                {day.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' })}
              </div>
              <div className={styles.calWeekDayEvents}>
                {dayEvents.length === 0
                  ? <span className={styles.calWeekEmpty}>—</span>
                  : dayEvents.map(e => (
                    <EventChip key={e.id} event={e} onClick={() => setSelectedEvent(e)} />
                  ))
                }
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  function renderMonthView() {
    const [yr, mo] = curMonth.split('-').map(Number);
    const firstDay = new Date(yr, mo - 1, 1);
    const lastDay  = new Date(yr, mo, 0);
    const startPad = firstDay.getDay();
    const cells: (Date | null)[] = [
      ...Array(startPad).fill(null),
      ...Array.from({ length: lastDay.getDate() }, (_, i) => new Date(yr, mo - 1, i + 1)),
    ];
    while (cells.length % 7 !== 0) cells.push(null);

    return (
      <div className={styles.calMonthGrid}>
        {DAYS_OF_WEEK.map(d => (
          <div key={d} className={styles.calMonthHeader}>{d.slice(0, 3)}</div>
        ))}
        {cells.map((day, i) => {
          if (!day) return <div key={i} className={styles.calMonthCell} />;
          const key = day.toISOString().slice(0, 10);
          const dayEvents = events.filter(e => e.startsAt?.slice(0, 10) === key);
          const isToday = key === new Date().toISOString().slice(0, 10);
          return (
            <div key={key} className={`${styles.calMonthCell} ${isToday ? styles.calMonthCellToday : ''}`}>
              <span className={styles.calMonthDayNum}>{day.getDate()}</span>
              <div className={styles.calMonthDayEvents}>
                {dayEvents.slice(0, 3).map(e => (
                  <button
                    key={e.id}
                    className={styles.calMonthEventDot}
                    style={{ background: EVENT_COLORS[e.eventType] }}
                    title={e.name}
                    onClick={() => setSelectedEvent(e)}
                  >
                    {e.name.slice(0, 14)}
                  </button>
                ))}
                {dayEvents.length > 3 && (
                  <span className={styles.calMonthMoreDots}>+{dayEvents.length - 3} more</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  const needsOpponent = (t: RepEventType) => ['tournament_game', 'scrimmage', 'league_game'].includes(t);
  const needsRecurrence = (t: RepEventType) => t === 'practice';

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <div className={styles.headerIcon}><Calendar size={22} /></div>
          <div>
            <nav className={styles.breadcrumb}>
              <Link href={`/${orgSlug}/coaches`}>Portal</Link>
              <span>/</span>
              <Link href={base}>{assignment.teamName}</Link>
              <span>/</span>
              <span>Schedule</span>
            </nav>
            <h1 className={styles.pageTitle}>Team Calendar</h1>
            <p className={styles.pageSub}>{assignment.programYearName}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* View toggle */}
          <div className={styles.viewToggle}>
            {(['list', 'week', 'month'] as ViewMode[]).map(v => (
              <button
                key={v}
                className={`${styles.viewToggleBtn} ${view === v ? styles.viewToggleBtnActive : ''}`}
                onClick={() => setView(v)}
              >
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
          {/* Add event */}
          <div className={styles.addEventWrap}>
            <button className={styles.btnPrimary} onClick={() => setAddTypeMenuOpen(v => !v)}>
              <Plus size={15} /> Add Event
            </button>
            {addTypeMenuOpen && (
              <div className={styles.addEventMenu}>
                {(Object.keys(EVENT_LABELS) as RepEventType[]).map(t => {
                  const Icon = EVENT_ICONS[t];
                  return (
                    <button key={t} className={styles.addEventMenuItem} onClick={() => openAddForm(t)}>
                      <Icon size={14} style={{ color: EVENT_COLORS[t] }} />
                      {EVENT_LABELS[t]}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* W/L/T widget */}
      <WLTWidget events={events} />

      {/* Navigator for week/month */}
      {view !== 'list' && (
        <div className={styles.calNav}>
          <button className={styles.calNavBtn} onClick={() => navigate(-1)}><ChevronLeft size={16} /></button>
          <span className={styles.calNavLabel}>
            {view === 'month'
              ? new Date(curMonth + '-01').toLocaleDateString('en-CA', { month: 'long', year: 'numeric' })
              : (() => {
                const start = new Date(curWeek + 'T00:00:00');
                const end = new Date(curWeek + 'T00:00:00');
                end.setDate(end.getDate() + 6);
                return `${start.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}`;
              })()
            }
          </span>
          <button className={styles.calNavBtn} onClick={() => navigate(1)}><ChevronRight size={16} /></button>
        </div>
      )}

      {/* Calendar body */}
      {loading
        ? <p className={styles.muted}>Loading events…</p>
        : error
          ? <p className={styles.errorText}>{error}</p>
          : view === 'list'  ? renderListView()
          : view === 'week'  ? renderWeekView()
          : renderMonthView()
      }

      {/* ── Detail slide-over ─────────────────────────────────────────────── */}
      {selectedEvent && (
        <div className={styles.modalOverlay} onClick={() => { setSelectedEvent(null); setScoreForm(null); setSaveError(''); }}>
          <div className={styles.slideOver} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                {(() => { const Icon = EVENT_ICONS[selectedEvent.eventType]; return <Icon size={16} style={{ color: EVENT_COLORS[selectedEvent.eventType] }} />; })()}
                <span className={styles.eventTypePill} style={{ background: EVENT_COLORS[selectedEvent.eventType] + '22', color: EVENT_COLORS[selectedEvent.eventType] }}>
                  {EVENT_LABELS[selectedEvent.eventType]}
                </span>
              </div>
              <button className={styles.modalCloseBtn} onClick={() => { setSelectedEvent(null); setScoreForm(null); }}>
                <X size={18} />
              </button>
            </div>
            <h2 className={styles.slideOverTitle}>{selectedEvent.name}</h2>

            <dl className={styles.slideOverDetails}>
              {selectedEvent.startsAt && (
                <>
                  <dt>Date</dt>
                  <dd>{fmtDate(selectedEvent.startsAt)}</dd>
                  <dt>Time</dt>
                  <dd>{fmtTime(selectedEvent.startsAt)}{selectedEvent.endsAt ? ` – ${fmtTime(selectedEvent.endsAt)}` : ''}</dd>
                </>
              )}
              {selectedEvent.location && <><dt>Location</dt><dd>{selectedEvent.location}</dd></>}
              {selectedEvent.opponent && <><dt>Opponent</dt><dd>{selectedEvent.opponent}</dd></>}
              {selectedEvent.homeAway && <><dt>Home/Away</dt><dd style={{ textTransform: 'capitalize' }}>{selectedEvent.homeAway}</dd></>}
              {selectedEvent.description && <><dt>Notes</dt><dd>{selectedEvent.description}</dd></>}
              {selectedEvent.isRecurring && <><dt>Recurring</dt><dd>Yes (weekly practice)</dd></>}
            </dl>

            {/* Score */}
            {(selectedEvent.eventType === 'league_game' || selectedEvent.eventType === 'tournament_game' || selectedEvent.eventType === 'scrimmage') && (
              <div className={styles.scoreSection}>
                {selectedEvent.homeScore != null ? (
                  <div className={styles.scoreDisplay}>
                    <span className={styles.scoreNum} style={{ color: '#22c55e' }}>{selectedEvent.homeScore}</span>
                    <span className={styles.scoreSep}>–</span>
                    <span className={styles.scoreNum} style={{ color: '#ef4444' }}>{selectedEvent.awayScore}</span>
                    {selectedEvent.result && (
                      <span className={styles.resultBadge} style={{
                        color: selectedEvent.result === 'win' ? '#22c55e' : selectedEvent.result === 'loss' ? '#ef4444' : '#f59e0b',
                      }}>
                        {selectedEvent.result.toUpperCase()}
                      </span>
                    )}
                    <button className={styles.btnGhost} onClick={() => setScoreForm({ homeScore: String(selectedEvent.homeScore ?? ''), awayScore: String(selectedEvent.awayScore ?? ''), result: selectedEvent.result ?? '' })}>
                      Edit score
                    </button>
                  </div>
                ) : (
                  <button className={styles.btnSecondary} onClick={() => setScoreForm({ homeScore: '', awayScore: '', result: '' })}>
                    Enter score
                  </button>
                )}
                {scoreForm && (
                  <div className={styles.scoreForm}>
                    <div className={styles.scoreFormRow}>
                      <input className={styles.input} style={{ width: '5rem' }} type="number" min={0} placeholder="Home" value={scoreForm.homeScore} onChange={e => setScoreForm(s => s && ({ ...s, homeScore: e.target.value }))} />
                      <span>–</span>
                      <input className={styles.input} style={{ width: '5rem' }} type="number" min={0} placeholder="Away" value={scoreForm.awayScore} onChange={e => setScoreForm(s => s && ({ ...s, awayScore: e.target.value }))} />
                      <select className={styles.select} style={{ width: '8rem' }} value={scoreForm.result} onChange={e => setScoreForm(s => s && ({ ...s, result: e.target.value }))}>
                        <option value="">Auto</option>
                        <option value="win">Win</option>
                        <option value="loss">Loss</option>
                        <option value="tie">Tie</option>
                      </select>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className={styles.btnPrimary} disabled={saving} onClick={handleScoreSave}>Save</button>
                      <button className={styles.btnGhost} onClick={() => setScoreForm(null)}>Cancel</button>
                    </div>
                    {saveError && <p className={styles.errorText}>{saveError}</p>}
                  </div>
                )}
              </div>
            )}

            {/* Add game slot for tournaments */}
            {selectedEvent.eventType === 'external_tournament' && (
              <div style={{ marginTop: '1rem' }}>
                <button className={styles.btnSecondary} onClick={() => {
                  setSelectedEvent(null);
                  openAddForm('tournament_game');
                  setForm(f => ({ ...f, parentEventId: selectedEvent.id, name: `${selectedEvent.name} – Game` }));
                }}>
                  + Add Game Slot
                </button>
              </div>
            )}

            {/* Delete */}
            <div className={styles.slideOverActions}>
              {!deleteConfirm ? (
                <button className={styles.btnDanger} onClick={() => setDeleteConfirm({ eventId: selectedEvent.id, isRecurring: selectedEvent.isRecurring })}>
                  Delete
                </button>
              ) : (
                <div className={styles.deleteConfirm}>
                  <p className={styles.deleteConfirmMsg}>
                    {deleteConfirm.isRecurring
                      ? 'Delete this recurring practice:'
                      : `Delete "${selectedEvent.name}"?`
                    }
                  </p>
                  <div className={styles.deleteConfirmBtns}>
                    {deleteConfirm.isRecurring ? (
                      <>
                        <button className={styles.btnDanger} disabled={saving} onClick={() => handleDelete(deleteConfirm.eventId, 'one')}>This only</button>
                        <button className={styles.btnDanger} disabled={saving} onClick={() => handleDelete(deleteConfirm.eventId, 'remaining')}>This & future</button>
                        <button className={styles.btnDanger} disabled={saving} onClick={() => handleDelete(deleteConfirm.eventId, 'all')}>All</button>
                      </>
                    ) : (
                      <button className={styles.btnDanger} disabled={saving} onClick={() => handleDelete(deleteConfirm.eventId, 'one')}>Confirm delete</button>
                    )}
                    <button className={styles.btnGhost} onClick={() => setDeleteConfirm(null)}>Cancel</button>
                  </div>
                  {saveError && <p className={styles.errorText}>{saveError}</p>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Add event modal ────────────────────────────────────────────────── */}
      {showAddForm && (
        <div className={styles.modalOverlay} onClick={() => setShowAddForm(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Add {EVENT_LABELS[form.eventType]}</h3>
              <button className={styles.modalCloseBtn} onClick={() => setShowAddForm(false)}><X size={16} /></button>
            </div>

            <div className={styles.formGrid}>
              <div className={`${styles.field} ${styles.formGridFull}`}>
                <label className={styles.label}>Name *</label>
                <input className={styles.input} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder={`${EVENT_LABELS[form.eventType]} name`} />
              </div>

              {needsRecurrence(form.eventType) && (
                <div className={`${styles.field} ${styles.formGridFull}`}>
                  <label className={styles.label}>
                    <input type="checkbox" checked={form.isRecurring} onChange={e => setForm(f => ({ ...f, isRecurring: e.target.checked }))} style={{ marginRight: '0.4rem' }} />
                    Recurring (weekly)
                  </label>
                </div>
              )}

              {form.eventType === 'practice' && form.isRecurring ? (
                <>
                  <div className={styles.field}>
                    <label className={styles.label}>Day of Week *</label>
                    <select className={styles.select} value={form.dayOfWeek} onChange={e => setForm(f => ({ ...f, dayOfWeek: e.target.value }))}>
                      {DAYS_OF_WEEK.map((d, i) => <option key={i} value={i}>{d}</option>)}
                    </select>
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Start Time *</label>
                    <input className={styles.input} type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>End Time</label>
                    <input className={styles.input} type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Start Date *</label>
                    <input className={styles.input} type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>End Date *</label>
                    <input className={styles.input} type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
                  </div>
                </>
              ) : (
                <>
                  <div className={styles.field}>
                    <label className={styles.label}>Start *</label>
                    <input className={styles.input} type="datetime-local" value={form.startsAt} onChange={e => setForm(f => ({ ...f, startsAt: e.target.value }))} />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>End</label>
                    <input className={styles.input} type="datetime-local" value={form.endsAt} onChange={e => setForm(f => ({ ...f, endsAt: e.target.value }))} />
                  </div>
                </>
              )}

              <div className={`${styles.field} ${styles.formGridFull}`}>
                <label className={styles.label}>Location</label>
                <input className={styles.input} value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Field, arena, etc." />
              </div>

              {needsOpponent(form.eventType) && (
                <>
                  <div className={styles.field}>
                    <label className={styles.label}>Opponent</label>
                    <input className={styles.input} value={form.opponent} onChange={e => setForm(f => ({ ...f, opponent: e.target.value }))} placeholder="Team name" />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Home / Away</label>
                    <select className={styles.select} value={form.homeAway} onChange={e => setForm(f => ({ ...f, homeAway: e.target.value }))}>
                      <option value="">—</option>
                      <option value="home">Home</option>
                      <option value="away">Away</option>
                      <option value="neutral">Neutral</option>
                    </select>
                  </div>
                </>
              )}

              <div className={`${styles.field} ${styles.formGridFull}`}>
                <label className={styles.label}>Notes</label>
                <textarea className={styles.textarea} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
              </div>
            </div>

            {saveError && <p className={styles.errorText} style={{ marginTop: '0.75rem' }}>{saveError}</p>}

            <div className={styles.modalFooter}>
              <button className={styles.btnGhost} onClick={() => setShowAddForm(false)}>Cancel</button>
              <button className={styles.btnPrimary} disabled={saving || !form.name.trim()} onClick={handleSave}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
