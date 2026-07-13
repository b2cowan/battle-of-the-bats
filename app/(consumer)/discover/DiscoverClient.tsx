'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  Search, Calendar, Users, Trophy, ArrowRight,
  Layers, LayoutGrid, List, MapPin, SlidersHorizontal,
} from 'lucide-react';
import type { DirectoryItem, DirectoryFacets, DirectoryResult, Timeframe } from '@/lib/directory';
import styles from './page.module.css';

type TimeframeFilter = 'current' | 'completed' | 'all';
type ViewMode = 'grid' | 'list';

const PAGE = 24;

const TIMEFRAME_FILTERS: { value: TimeframeFilter; label: string }[] = [
  { value: 'current',   label: 'Upcoming & live' },
  { value: 'completed', label: 'Completed' },
  { value: 'all',       label: 'All' },
];

const TIMEFRAME_LABELS: Record<Timeframe, string> = {
  upcoming: 'Upcoming',
  live:     'Live',
  completed:'Completed',
};

function formatDateRange(startDate: string | null, endDate: string | null): string {
  if (!startDate) return 'Dates TBA';
  // Parse as UTC noon + format in UTC so the server (Lambda TZ) and the visitor's
  // browser (local TZ) produce the SAME string — no SSR/client hydration drift.
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', timeZone: 'UTC' };
  const start = new Date(startDate + 'T12:00:00Z').toLocaleDateString('en-CA', opts);
  if (!endDate || endDate === startDate) {
    return new Date(startDate + 'T12:00:00Z').toLocaleDateString('en-CA', { ...opts, year: 'numeric' });
  }
  const end = new Date(endDate + 'T12:00:00Z').toLocaleDateString('en-CA', { ...opts, year: 'numeric' });
  return `${start} – ${end}`;
}

function TimeframeBadge({ timeframe }: { timeframe: Timeframe }) {
  const cls =
    timeframe === 'live'     ? styles.statusActive   :
    timeframe === 'upcoming' ? styles.statusUpcoming :
    styles.statusDone;
  return (
    <span className={`${styles.statusBadge} ${cls}`}>
      <span className={styles.statusDot} />
      {TIMEFRAME_LABELS[timeframe]}
    </span>
  );
}

function OrgLogo({ item, small }: { item: DirectoryItem; small?: boolean }) {
  if (item.logoUrl) {
    return (
      <img
        src={item.logoUrl}
        alt={item.orgName}
        className={small ? styles.listLogo : styles.cardLogo}
      />
    );
  }
  return (
    <div className={`${styles.cardLogoPlaceholder} ${small ? styles.listLogo : ''}`}>
      {item.tournamentName.charAt(0).toUpperCase()}
    </div>
  );
}

function MetaRow({ item }: { item: DirectoryItem }) {
  return (
    <>
      <span className={styles.metaItem}>
        <Calendar size={13} />
        {formatDateRange(item.startDate, item.endDate)}
      </span>
      <span className={styles.metaItem}>
        <Trophy size={13} />
        {item.sportLabel}
      </span>
      {item.provinceName && (
        <span className={styles.metaItem}>
          <MapPin size={13} />
          {item.provinceName}
        </span>
      )}
      {item.divisionCount > 0 && (
        <span className={styles.metaItem}>
          <Layers size={13} />
          {item.divisionCount} division{item.divisionCount !== 1 ? 's' : ''}
        </span>
      )}
      {item.teamCount > 0 && (
        <span className={styles.metaItem}>
          <Users size={13} />
          {item.teamCount} team{item.teamCount !== 1 ? 's' : ''}
        </span>
      )}
    </>
  );
}

export default function DiscoverClient({ initial }: { initial: DirectoryResult }) {
  // Seeded from the server-rendered first page so crawlers (and the first paint) see
  // real listings, not a spinner. The first filter-effect run is skipped to avoid a
  // redundant re-fetch of that same default view.
  const [items,       setItems]       = useState<DirectoryItem[]>(initial.items);
  const [total,       setTotal]       = useState(initial.total);
  const [hasMore,     setHasMore]     = useState(initial.hasMore);
  const [refreshing,  setRefreshing]  = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [facets,      setFacets]      = useState<DirectoryFacets>(initial.facets);

  const [searchInput, setSearchInput] = useState('');
  const [debouncedQ,  setDebouncedQ]  = useState('');
  const [sport,       setSport]       = useState('');
  const [province,    setProvince]    = useState('');
  const [timeframe,   setTimeframe]   = useState<TimeframeFilter>('current');
  const [viewMode,    setViewMode]    = useState<ViewMode>('grid');

  // Sport/region selects collapse behind a "Filters" toggle on mobile so the sticky
  // bar doesn't eat the screen before the visitor has scrolled to a single card —
  // desktop always shows them inline (see .moreFilters `display: contents` base rule).
  const [moreOpen, setMoreOpen] = useState(false);

  // Debounce the search box → server query.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(searchInput.trim()), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  const buildUrl = useCallback((offset: number) => {
    const p = new URLSearchParams();
    p.set('limit', String(PAGE));
    p.set('offset', String(offset));
    if (debouncedQ)            p.set('q', debouncedQ);
    if (sport)                 p.set('sport', sport);
    if (province)              p.set('province', province);
    if (timeframe !== 'current') p.set('timeframe', timeframe);
    return `/api/public/tournaments?${p.toString()}`;
  }, [debouncedQ, sport, province, timeframe]);

  // Bumped on every filter change so an in-flight "Load more" can detect that its
  // page is now stale (belongs to a previous filter) and drop it.
  const epochRef = useRef(0);
  // Skip the very first effect run — the SSR seed already holds the default view.
  const didMountRef = useRef(false);

  // Re-fetch from the top whenever a filter changes.
  useEffect(() => {
    if (!didMountRef.current) { didMountRef.current = true; return; }
    epochRef.current += 1;
    let cancelled = false;
    // Soft refresh: keep the current results visible (dimmed) instead of blanking the
    // grid to a spinner on every filter change.
    setRefreshing(true);
    fetch(buildUrl(0))
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        setItems(data.items ?? []);
        setTotal(data.total ?? 0);
        setHasMore(data.hasMore ?? false);
        if (data.facets) setFacets(data.facets);
      })
      .catch(() => { if (!cancelled) { setItems([]); setTotal(0); setHasMore(false); } })
      .finally(() => { if (!cancelled) setRefreshing(false); });
    return () => { cancelled = true; };
  }, [buildUrl]);

  const loadMore = async () => {
    const epoch = epochRef.current;
    setLoadingMore(true);
    try {
      const res  = await fetch(buildUrl(items.length));
      const data = await res.json();
      if (epoch !== epochRef.current) return; // filters changed mid-flight — drop this stale page
      setItems(prev => [...prev, ...(data.items ?? [])]);
      setHasMore(data.hasMore ?? false);
    } catch {
      /* leave current results in place */
    } finally {
      setLoadingMore(false);
    }
  };

  const isFiltering = debouncedQ !== '' || sport !== '' || province !== '' || timeframe !== 'current';

  return (
    <div className={styles.page}>
      {/* ── Header ── */}
      <div className={styles.header}>
        <div className="container">
          <div className={styles.headerInner}>
            <div>
              <p className={styles.eyebrow}>Discover</p>
              <h1 className={styles.headerTitle}>Browse tournaments</h1>
              <p className={styles.headerSub}>
                Find tournaments across the FieldLogicHQ community — live scores, schedules, and standings, free to follow.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Sticky filter bar ── */}
      <div className={styles.filterBar}>
        <div className="container">
          <div className={styles.controls}>
            {/* Search */}
            <div className={styles.searchWrap}>
              <Search size={15} className={styles.searchIcon} />
              <input
                type="text"
                aria-label="Search tournaments"
                placeholder="Search tournaments…"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                className={styles.searchInput}
              />
            </div>

            <div className={`${styles.moreFilters} ${moreOpen ? styles.moreFiltersOpen : ''}`}>
              {/* Sport */}
              {facets.sports.length > 0 && (
                <select
                  className={styles.filterSelect}
                  value={sport}
                  onChange={e => setSport(e.target.value)}
                  aria-label="Filter by sport"
                >
                  <option value="">All sports</option>
                  {facets.sports.map(s => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              )}

              {/* Province */}
              {facets.provinces.length > 0 && (
                <select
                  className={styles.filterSelect}
                  value={province}
                  onChange={e => setProvince(e.target.value)}
                  aria-label="Filter by region"
                >
                  <option value="">All regions</option>
                  {facets.provinces.map(p => (
                    <option key={p.code} value={p.code}>{p.name}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Timeframe + (mobile) sport/region toggle share one row */}
            <div className={styles.filterRow}>
              <div className={styles.filters}>
                {TIMEFRAME_FILTERS.map(t => (
                  <button
                    key={t.value}
                    onClick={() => setTimeframe(t.value)}
                    className={`${styles.filterBtn} ${timeframe === t.value ? styles.filterActive : ''}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Sport/region toggle — mobile only; desktop shows the selects inline above */}
              {(facets.sports.length > 0 || facets.provinces.length > 0) && (
                <button
                  type="button"
                  onClick={() => setMoreOpen(o => !o)}
                  className={`${styles.moreFiltersToggle} ${sport || province ? styles.moreFiltersToggleActive : ''}`}
                  aria-expanded={moreOpen}
                  aria-label="Filters"
                >
                  <SlidersHorizontal size={14} />
                  <span className={styles.moreFiltersLabel}>Filters</span>
                  {(sport || province) && <span className={styles.filterDot} />}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className={styles.body}>
        <div className="container">
          {items.length === 0 && !refreshing ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}><Trophy size={24} /></div>
              <p className={styles.emptyTitle}>
                {isFiltering ? 'No matches found' : 'No tournaments listed yet'}
              </p>
              <p className={styles.emptySub}>
                {isFiltering
                  ? 'Try adjusting your search or filters.'
                  : 'Check back soon — organizers are just getting started.'}
              </p>
            </div>
          ) : (
            <>
              <div className={styles.bodyMeta}>
                <p className={styles.resultCount} aria-live="polite">
                  {refreshing ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className={styles.spinnerSm} style={{ display: 'inline-block' }} /> Updating…
                    </span>
                  ) : (
                    `${total} tournament${total !== 1 ? 's' : ''}`
                  )}
                </p>

                {/* View toggle — a display preference for the results, so it lives with them
                    rather than in the sticky filter bar above. */}
                <div className={styles.viewToggle}>
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`${styles.viewBtn} ${viewMode === 'grid' ? styles.viewBtnActive : ''}`}
                    title="Grid view"
                    aria-label="Grid view"
                  >
                    <LayoutGrid size={15} />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`${styles.viewBtn} ${viewMode === 'list' ? styles.viewBtnActive : ''}`}
                    title="List view"
                    aria-label="List view"
                  >
                    <List size={15} />
                  </button>
                </div>
              </div>

              {/* Cards */}
              <div
                className={viewMode === 'grid' ? styles.grid : styles.list}
                style={{ opacity: refreshing ? 0.45 : 1, transition: 'opacity 0.15s', pointerEvents: refreshing ? 'none' : undefined }}
              >
                {items.map(item => (
                  viewMode === 'list' ? (
                    /* ── List row ── */
                    <Link key={item.id} href={item.href} className={`${styles.card} ${styles.listCard}`}>
                      <OrgLogo item={item} small />
                      <div className={styles.listInfo}>
                        <p className={styles.cardOrgName}>{item.tournamentName}</p>
                        <p className={styles.cardTournamentName}>{item.orgName}</p>
                      </div>
                      <div className={styles.listMeta}>
                        <TimeframeBadge timeframe={item.timeframe} />
                        <MetaRow item={item} />
                      </div>
                      <ArrowRight size={15} className={styles.listArrow} />
                    </Link>
                  ) : (
                    /* ── Grid card ── */
                    <Link key={item.id} href={item.href} className={styles.card}>
                      <div className={styles.cardTop}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                          <OrgLogo item={item} />
                          <div style={{ minWidth: 0 }}>
                            <p className={styles.cardOrgName}>{item.tournamentName}</p>
                            <p className={styles.cardTournamentName}>{item.orgName}</p>
                          </div>
                        </div>
                        <TimeframeBadge timeframe={item.timeframe} />
                      </div>

                      <div className={styles.cardMeta}>
                        <MetaRow item={item} />
                      </div>

                      <div className={styles.cardFooter}>
                        <span>View tournament</span>
                        <ArrowRight size={14} />
                      </div>
                    </Link>
                  )
                ))}
              </div>

              {/* Load more */}
              {hasMore && !refreshing && (
                <div className={styles.loadMoreWrap}>
                  <button
                    onClick={loadMore}
                    disabled={loadingMore}
                    className={styles.loadMoreBtn}
                  >
                    {loadingMore ? (
                      <><div className={styles.spinnerSm} />Loading…</>
                    ) : (
                      `Load more (${total - items.length} remaining)`
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
