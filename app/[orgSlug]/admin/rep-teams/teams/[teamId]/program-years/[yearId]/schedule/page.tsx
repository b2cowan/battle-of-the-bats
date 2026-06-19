'use client';
import { useState, useEffect, useCallback, use } from 'react';
import { Calendar, ChevronLeft, ChevronRight, X, Trophy, Swords, Shield, Dumbbell, Users } from 'lucide-react';
import Link from 'next/link';
import { useOrg } from '@/lib/org-context';
import styles from '../../../../../rep-teams.module.css';
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

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-CA', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit', hour12: true });
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

// ── Event chip ────────────────────────────────────────────────────────────────

function EventChip({ event, onClick }: { event: RepTeamEvent; onClick: () => void }) {
  const color = EVENT_COLORS[event.eventType];
  const Icon = EVENT_ICONS[event.eventType];
  const cancelled = event.status === 'cancelled';
  return (
    <button
      className={styles.eventChip}
      style={{ borderLeftColor: color, ...(cancelled ? { opacity: 0.55 } : {}) }}
      onClick={onClick}
    >
      <Icon size={12} style={{ color, flexShrink: 0 }} />
      <span className={styles.eventChipTime}>{fmtTime(event.startsAt)}</span>
      <span className={styles.eventChipName} style={cancelled ? { textDecoration: 'line-through' } : undefined}>{event.name}</span>
      {cancelled ? (
        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#f59e0b' }}>CANCELLED</span>
      ) : event.result && (
        <span style={{
          fontSize: '0.7rem', fontWeight: 700,
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

export default function AdminSchedulePage({
  params: paramsPromise,
}: {
  params: Promise<{ orgSlug: string; teamId: string; yearId: string }>;
}) {
  const params = use(paramsPromise);
  const { orgSlug, teamId, yearId } = params;
  const { loading: orgLoading, currentOrg } = useOrg();
  const orgQuery = currentOrg?.slug ? `?orgSlug=${encodeURIComponent(currentOrg.slug)}` : '';
  const orgParam = currentOrg?.slug ? `&orgSlug=${encodeURIComponent(currentOrg.slug)}` : '';

  const [events, setEvents] = useState<RepTeamEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [teamName, setTeamName] = useState('');
  const [yearName, setYearName] = useState('');

  const [view, setView] = useState<ViewMode>('list');
  const [cursorDate, setCursorDate] = useState(() => new Date().toISOString().slice(0, 10));

  const [selectedEvent, setSelectedEvent] = useState<RepTeamEvent | null>(null);

  const base = `/${orgSlug}/admin/rep-teams`;
  const apiBase = `/api/admin/rep-teams/teams/${teamId}/program-years/${yearId}/events`;

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${apiBase}${orgQuery}`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setEvents(data.events ?? []);
      if (data.programYear) {
        setYearName(data.programYear.name ?? '');
      }
    } catch (e: any) {
      setError(e.message ?? 'Failed to load events');
    } finally {
      setLoading(false);
    }
  }, [apiBase, orgQuery]);

  useEffect(() => {
    fetch(`/api/admin/rep-teams/teams/${teamId}${orgQuery}`)
      .then(r => r.json())
      .then(d => { if (d.team) setTeamName(d.team.name); })
      .catch(() => {});
  }, [teamId, orgQuery]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  function navigate(dir: -1 | 1) {
    const d = new Date(cursorDate + 'T00:00:00');
    if (view === 'month') d.setMonth(d.getMonth() + dir);
    else d.setDate(d.getDate() + dir * 7);
    setCursorDate(d.toISOString().slice(0, 10));
  }

  const curMonth = cursorDate.slice(0, 7);
  const curWeek  = weekKey(cursorDate + 'T00:00:00');

  function renderListView() {
    if (!events.length) return <div className={styles.emptyStateState}>No events yet.</div>;
    const grouped: Record<string, RepTeamEvent[]> = {};
    for (const e of events) { const mk = monthKey(e.startsAt); (grouped[mk] ??= []).push(e); }
    return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([mk, evts]) => {
      const label = new Date(mk + '-01').toLocaleDateString('en-CA', { month: 'long', year: 'numeric' });
      return (
        <div key={mk} className={styles.calMonthGroup}>
          <div className={styles.calMonthLabel}>{label}</div>
          <div className={styles.calEventList}>
            {evts.map(e => <EventChip key={e.id} event={e} onClick={() => setSelectedEvent(e)} />)}
          </div>
        </div>
      );
    });
  }

  function renderWeekView() {
    const weekStart = new Date(curWeek + 'T00:00:00');
    const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(d.getDate() + i); return d; });
    return (
      <div className={styles.calWeekGrid}>
        {days.map(day => {
          const key = day.toISOString().slice(0, 10);
          const dayEvents = events.filter(e => e.startsAt?.slice(0, 10) === key);
          return (
            <div key={key} className={styles.calWeekDay}>
              <div className={styles.calWeekDayLabel}>{day.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
              <div className={styles.calWeekDayEvents}>
                {dayEvents.length === 0 ? <span className={styles.calWeekEmpty}>—</span>
                  : dayEvents.map(e => <EventChip key={e.id} event={e} onClick={() => setSelectedEvent(e)} />)}
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
    const cells: (Date | null)[] = [...Array(startPad).fill(null), ...Array.from({ length: lastDay.getDate() }, (_, i) => new Date(yr, mo - 1, i + 1))];
    while (cells.length % 7 !== 0) cells.push(null);
    return (
      <div className={styles.calMonthGrid}>
        {DAYS_OF_WEEK.map(d => <div key={d} className={styles.calMonthHeader}>{d.slice(0, 3)}</div>)}
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
                  <button key={e.id} className={styles.calMonthEventDot} style={{ background: EVENT_COLORS[e.eventType] }} title={e.name} onClick={() => setSelectedEvent(e)}>
                    {e.name.slice(0, 14)}
                  </button>
                ))}
                {dayEvents.length > 3 && <span className={styles.calMonthMoreDots}>+{dayEvents.length - 3} more</span>}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (orgLoading) return <div className={styles.emptyState}>Loading…</div>;

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div>
          <nav className={styles.breadcrumb}>
            <Link href={base}>Rep Teams</Link>
            <span>/</span>
            <Link href={`${base}/teams/${teamId}`}>{teamName || 'Team'}</Link>
            <span>/</span>
            <span>{yearName || 'Program Year'}</span>
            <span>/</span>
            <span>Schedule</span>
          </nav>
          <h1 className={styles.pageTitle}>
            <Calendar size={20} style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
            Team Calendar
          </h1>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div className={styles.viewToggle}>
            {(['list', 'week', 'month'] as ViewMode[]).map(v => (
              <button key={v} className={`${styles.viewToggleBtn} ${view === v ? styles.viewToggleBtnActive : ''}`} onClick={() => setView(v)}>
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--white-35)', alignSelf: 'center' }}>
            Read-only
          </span>
        </div>
      </div>

      <WLTWidget events={events} />

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

      {loading ? <div className={styles.emptyState}>Loading events…</div>
        : error ? <div className={styles.emptyState} style={{ color: '#ef4444' }}>{error}</div>
        : view === 'list' ? renderListView()
        : view === 'week' ? renderWeekView()
        : renderMonthView()
      }

      {/* Detail slide-over */}
      {selectedEvent && (
        <div className={styles.modalOverlay} onClick={() => setSelectedEvent(null)}>
          <div className={styles.slideOver} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                {(() => { const Icon = EVENT_ICONS[selectedEvent.eventType]; return <Icon size={16} style={{ color: EVENT_COLORS[selectedEvent.eventType] }} />; })()}
                <span className={styles.eventTypePill} style={{ background: EVENT_COLORS[selectedEvent.eventType] + '22', color: EVENT_COLORS[selectedEvent.eventType] }}>
                  {EVENT_LABELS[selectedEvent.eventType]}
                </span>
              </div>
              <button className={styles.modalCloseBtn} onClick={() => setSelectedEvent(null)}><X size={18} /></button>
            </div>
            <h2 className={styles.slideOverTitle}>{selectedEvent.name}</h2>
            <dl className={styles.slideOverDetails}>
              <dt>Date</dt><dd>{fmtDate(selectedEvent.startsAt)}</dd>
              <dt>Time</dt><dd>{fmtTime(selectedEvent.startsAt)}{selectedEvent.endsAt ? ` – ${fmtTime(selectedEvent.endsAt)}` : ''}</dd>
              {selectedEvent.location && <><dt>Location</dt><dd>{selectedEvent.location}</dd></>}
              {selectedEvent.opponent && <><dt>Opponent</dt><dd>{selectedEvent.opponent}</dd></>}
              {selectedEvent.homeAway && <><dt>Home/Away</dt><dd style={{ textTransform: 'capitalize' }}>{selectedEvent.homeAway}</dd></>}
              {selectedEvent.homeScore != null && <><dt>Score</dt><dd>{selectedEvent.homeScore}–{selectedEvent.awayScore} <strong style={{ color: selectedEvent.result === 'win' ? '#22c55e' : selectedEvent.result === 'loss' ? '#ef4444' : '#f59e0b' }}>{selectedEvent.result?.toUpperCase()}</strong></dd></>}
              {selectedEvent.description && <><dt>Notes</dt><dd>{selectedEvent.description}</dd></>}
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}
