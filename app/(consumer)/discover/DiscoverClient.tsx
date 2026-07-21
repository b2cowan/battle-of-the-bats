'use client';

import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import Link from 'next/link';
import {
  Search, Calendar, Users, Trophy, ArrowRight, Building2,
  Layers, LayoutGrid, List, MapPin, SlidersHorizontal, ChevronRight,
} from 'lucide-react';
import type {
  DirectoryItem, DirectoryFacets, DirectoryResult, Timeframe,
  OrgDirectoryResult, TeamDirectoryResult, DirectorySearchResults, SearchEntityType,
} from '@/lib/directory';
import { teamColor, teamInitials } from '@/lib/team-color';
import HomePersonalization from '@/components/consumer/HomePersonalization';
import warm from '@/components/consumer/warmTheme.module.css';
import styles from './page.module.css';

type TimeframeFilter = 'current' | 'completed' | 'all';
type ViewMode = 'grid' | 'list';

const PAGE = 24;
// Mirrors SEARCH_MIN_CHARS in lib/directory.ts (server enforces it too — defense in depth).
// Kept as a local literal because that module is server-only (runtime values can't cross into
// the client bundle); a mismatch is harmless (server just returns empty below threshold).
const SEARCH_MIN_CHARS = 2;

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

// One tournament card recipe, shared by Browse and Search (grid card or list row).
function TournamentCard({ item, view }: { item: DirectoryItem; view: ViewMode }) {
  if (view === 'list') {
    return (
      <Link href={item.href} className={`${styles.card} ${styles.listCard}`}>
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
    );
  }
  return (
    <Link href={item.href} className={styles.card}>
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
  );
}

// ── Organization / Team search rows ─────────────────────────────────────────────
function OrgResultRow({ org }: { org: OrgDirectoryResult }) {
  return (
    <Link href={org.href} className={styles.resultRow}>
      {org.logoUrl ? (
        <img src={org.logoUrl} alt={org.orgName} className={styles.resultLogo} />
      ) : (
        <span className={styles.resultIcon} aria-hidden><Building2 size={18} strokeWidth={1.9} /></span>
      )}
      <span className={styles.resultBody}>
        <span className={styles.resultTitle}>{org.orgName}</span>
        <span className={styles.resultMeta}>Organization</span>
      </span>
      <ChevronRight size={16} strokeWidth={2.2} className={styles.resultArrow} aria-hidden />
    </Link>
  );
}

function TeamResultRow({ team }: { team: TeamDirectoryResult }) {
  return (
    <Link href={team.href} className={styles.resultRow}>
      <span className={styles.resultMono} style={{ background: teamColor(team.teamName, 55, 42) }} aria-hidden>
        {teamInitials(team.teamName)}
      </span>
      <span className={styles.resultBody}>
        <span className={styles.resultTitle}>{team.teamName}</span>
        <span className={styles.resultMeta}>in {team.tournamentName} · {team.orgName}</span>
      </span>
      <ChevronRight size={16} strokeWidth={2.2} className={styles.resultArrow} aria-hidden />
    </Link>
  );
}

// A titled result group (used in the "All" view; header carries the count + "See all").
function ResultGroup({
  title, total, shown, onSeeAll, children,
}: {
  title: string;
  total: number;
  shown: number;
  onSeeAll?: () => void;
  children: ReactNode;
}) {
  return (
    <section className={styles.resultGroup}>
      <div className={styles.resultGroupHead}>
        <p className={styles.resultGroupTitle}>{title} <span className={styles.resultGroupCount}>{total}</span></p>
        {onSeeAll && total > shown && (
          <button type="button" className={styles.headLink} onClick={onSeeAll}>
            See all <ChevronRight size={11} strokeWidth={2.4} aria-hidden />
          </button>
        )}
      </div>
      {children}
      {total > shown && (
        <p className={styles.capNote}>Showing the first {shown} of {total} — keep typing to narrow.</p>
      )}
    </section>
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

  // Unified search (Tournaments / Organizations / Teams) — a lifecycle SEPARATE from the
  // Browse directory fetch below. Active only while a real text query is typed; Browse is
  // never text-filtered anymore (search takes over the view in place, per §3c).
  // `error` marks a failed fetch for a given query so the UI shows a retry affordance instead of
  // an endless spinner (a 5xx returns valid JSON, so it would otherwise pass as a real payload).
  const [searchData, setSearchData] = useState<(DirectorySearchResults & { error?: boolean }) | null>(null);
  const [activeType, setActiveType] = useState<'all' | SearchEntityType>('all');
  const [retryNonce, setRetryNonce] = useState(0);

  // Sport/region selects collapse behind a "Filters" toggle on mobile so the sticky
  // bar doesn't eat the screen before the visitor has scrolled to a single card —
  // desktop always shows them inline (see .moreFilters `display: contents` base rule).
  const [moreOpen, setMoreOpen] = useState(false);

  // Debounce the search box.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(searchInput.trim()), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  const isSearching = debouncedQ.length >= SEARCH_MIN_CHARS;

  // ── Unified search fetch (single debounce/loading lifecycle for all three types) ──
  // Results carry their own `q`; SearchResults only trusts data whose `q` matches the current
  // query, so a superseded/stale payload is never shown. The active chip persists across
  // refinements (displayType falls back to "All" when the chosen type has no results; it's reset
  // to "All" on clearing the box). Bumping retryNonce re-fires the same query after a failure.
  const searchEpochRef = useRef(0);
  useEffect(() => {
    if (!isSearching) return;
    const epoch = ++searchEpochRef.current;
    const query = debouncedQ.slice(0, 80); // matches the server's trim+slice echo and the query prop
    const ctrl = new AbortController();
    fetch(`/api/public/search?q=${encodeURIComponent(debouncedQ)}`, { signal: ctrl.signal })
      .then(r => {
        if (!r.ok) throw new Error(`search failed: ${r.status}`); // a 5xx still returns JSON — don't trust it
        return r.json();
      })
      .then((data: DirectorySearchResults) => {
        if (epoch !== searchEpochRef.current) return; // superseded by a newer query
        setSearchData(data);
      })
      .catch(() => {
        // Ignore aborts (a newer query took over). A real failure gets a query-keyed error payload
        // so SearchResults shows "try again" rather than hanging on the spinner forever.
        if (ctrl.signal.aborted || epoch !== searchEpochRef.current) return;
        setSearchData({
          q: query, error: true,
          tournaments: { items: [], total: 0 },
          organizations: { items: [], total: 0 },
          teams: { items: [], total: 0 },
        });
      });
    // Abort a superseded request so its Supabase scans stop server-side, not just ignored client-side.
    return () => ctrl.abort();
  }, [debouncedQ, isSearching, retryNonce]);

  // ── Browse directory fetch (filters only — sport/region/timeframe; NOT text) ──
  const buildUrl = useCallback((offset: number) => {
    const p = new URLSearchParams();
    p.set('limit', String(PAGE));
    p.set('offset', String(offset));
    if (sport)                 p.set('sport', sport);
    if (province)              p.set('province', province);
    if (timeframe !== 'current') p.set('timeframe', timeframe);
    return `/api/public/tournaments?${p.toString()}`;
  }, [sport, province, timeframe]);

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

  // Browse empty-state copy: text search no longer narrows Browse, so only the directory
  // filters count toward "you filtered and got nothing".
  const isFiltering = sport !== '' || province !== '' || timeframe !== 'current';

  return (
    <div className={`${warm.warmTab} ${styles.page}`}>
      {/* ── Sticky search bar (Home leads with search — R1-3) ── */}
      <div className={styles.filterBar}>
        <div className={styles.controls}>
            {/* Search */}
            <div className={styles.searchWrap}>
              <Search size={15} className={styles.searchIcon} />
              <input
                type="text"
                aria-label="Find a tournament, team, or organization"
                placeholder="Find a Tournament, Team, or Organization"
                value={searchInput}
                onChange={e => {
                  setSearchInput(e.target.value);
                  // Clearing/exiting search resets the chip so the next query starts on the combined view.
                  if (e.target.value.trim().length < SEARCH_MIN_CHARS) setActiveType('all');
                }}
                className={styles.searchInput}
              />
            </div>
          </div>
        </div>

      <div className={styles.homeInner}>
        {/* Account sections — hidden while a text search is active (results take over). */}
        {!isSearching && <HomePersonalization />}

        {isSearching ? (
          <SearchResults
            data={searchData}
            query={debouncedQ.slice(0, 80)}
            activeType={activeType}
            onSelectType={setActiveType}
            onRetry={() => setRetryNonce(n => n + 1)}
          />
        ) : (
          /* ── Browse (the directory always renders beneath — SEO/acquisition funnel) ── */
          <div className={styles.body}>
            <div className={styles.browseSection}>
              <p className={styles.browseHeading}>Browse tournaments</p>

              {/* Timeframe + sport/region filters scope THIS list, so they sit right
                  above it — not up in the search bar, where they read as filtering the
                  search box rather than the tournaments below. */}
              <div className={styles.browseControls}>
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

                  {/* Sport/region toggle — mobile only; desktop shows the selects inline beside */}
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
              </div>

            {items.length === 0 && !refreshing ? (
              <div className={styles.empty}>
                <div className={styles.emptyIcon}><Trophy size={24} /></div>
                <p className={styles.emptyTitle}>
                  {isFiltering ? 'No matches found' : 'No tournaments listed yet'}
                </p>
                <p className={styles.emptySub}>
                  {isFiltering
                    ? 'Try adjusting your filters.'
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
                    <TournamentCard key={item.id} item={item} view={viewMode} />
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
        )}
      </div>
    </div>
  );
}

// ── Search results view (Tournaments / Organizations / Teams with type chips) ────
function SearchResults({
  data, query, activeType, onSelectType, onRetry,
}: {
  data: (DirectorySearchResults & { error?: boolean }) | null;
  query: string;
  activeType: 'all' | SearchEntityType;
  onSelectType: (t: 'all' | SearchEntityType) => void;
  onRetry: () => void;
}) {
  // Only trust a payload whose query matches what's typed now — otherwise a prior query's
  // results would flash while the new fetch is in flight.
  const fresh = data && data.q === query ? data : null;

  if (!fresh) {
    return (
      <div className={styles.body}>
        <p className={styles.browseHeading}>Search results</p>
        <div className={styles.searchLoading}>
          <span className={styles.spinnerSm} /> Searching…
        </div>
      </div>
    );
  }

  // Failed fetch for this exact query → an explicit error + retry, never a stuck spinner.
  if (fresh.error) {
    return (
      <div className={styles.body}>
        <p className={styles.browseHeading} style={{ marginBottom: '1.25rem' }}>Search results</p>
        <div className={styles.empty}>
          <div className={styles.emptyIcon}><Search size={22} /></div>
          <p className={styles.emptyTitle}>Search is unavailable right now</p>
          <p className={styles.emptySub}>Something went wrong — please try again.</p>
          <button type="button" className={styles.loadMoreBtn} style={{ marginTop: '1.25rem' }} onClick={onRetry}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  // One row per entity type — chips, "All" grouping, and single-type views all derive from
  // this, so a fourth type (or a rendering change) is one array entry, not four branches.
  const sections: { key: SearchEntityType; title: string; total: number; shown: number; node: ReactNode }[] = [
    {
      key: 'tournament', title: 'Tournaments',
      total: fresh.tournaments.total, shown: fresh.tournaments.items.length,
      node: (
        <div className={styles.grid}>
          {fresh.tournaments.items.map(item => <TournamentCard key={item.id} item={item} view="grid" />)}
        </div>
      ),
    },
    {
      key: 'org', title: 'Organizations',
      total: fresh.organizations.total, shown: fresh.organizations.items.length,
      node: (
        <div className={styles.resultList}>
          {fresh.organizations.items.map(o => <OrgResultRow key={o.id} org={o} />)}
        </div>
      ),
    },
    {
      key: 'team', title: 'Teams',
      total: fresh.teams.total, shown: fresh.teams.items.length,
      node: (
        <div className={styles.resultList}>
          {fresh.teams.items.map(t => <TeamResultRow key={t.id} team={t} />)}
        </div>
      ),
    },
  ];

  // A chip/group shows ONLY when its type actually returned results — so no visible chip ever
  // silently returns nothing (the binding Teams-chip rule, applied uniformly to all types).
  const withResults = sections.filter(s => s.total > 0);

  // With one type of result, "All" is redundant; with several, it's the default combined view.
  const showAllChip = withResults.length >= 2;
  const displayType: 'all' | SearchEntityType =
    withResults.length === 0 ? 'all'
    : withResults.length === 1 ? withResults[0].key
    : (activeType !== 'all' && sections.some(s => s.key === activeType && s.total > 0) ? activeType : 'all');

  const visible = displayType === 'all' ? withResults : withResults.filter(s => s.key === displayType);

  return (
    <div className={styles.body}>
      <p className={styles.browseHeading} style={{ marginBottom: '1.25rem' }}>Search results</p>

      {withResults.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}><Search size={22} /></div>
          <p className={styles.emptyTitle}>No matches found</p>
          <p className={styles.emptySub}>
            Try a different tournament, team, or organization name.
          </p>
        </div>
      ) : (
        <>
          {/* Type chips */}
          <div className={styles.chipRow}>
            {showAllChip && (
              <button
                type="button"
                onClick={() => onSelectType('all')}
                className={`${styles.filterBtn} ${displayType === 'all' ? styles.filterActive : ''}`}
              >
                All
              </button>
            )}
            {withResults.map(s => (
              <button
                key={s.key}
                type="button"
                onClick={() => onSelectType(s.key)}
                className={`${styles.filterBtn} ${displayType === s.key ? styles.filterActive : ''}`}
              >
                {s.title} <span className={styles.chipCount}>{s.total}</span>
              </button>
            ))}
          </div>

          {/* Combined view = titled groups (with "See all"); a single chip = that group's flat list. */}
          {visible.map(s => (
            <ResultGroup
              key={s.key}
              title={s.title}
              total={s.total}
              shown={s.shown}
              onSeeAll={displayType === 'all' ? () => onSelectType(s.key) : undefined}
            >
              {s.node}
            </ResultGroup>
          ))}
        </>
      )}
    </div>
  );
}
