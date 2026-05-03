'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  Search, Calendar, Users, Trophy, ArrowRight,
  Layers, LayoutGrid, List,
} from 'lucide-react';
import styles from './page.module.css';

interface TournamentData {
  name: string;
  year: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

interface OrgCard {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  tournament: TournamentData | null;
  ageGroupCount: number;
  teamCount: number;
}

type StatusFilter = 'all' | 'active' | 'upcoming' | 'completed';
type ViewMode    = 'grid' | 'list';

const BATCH = 20;

const STATUS_LABELS: Record<string, string> = {
  active:   'Active',
  upcoming: 'Upcoming',
  completed:'Completed',
};

function getStatus(t: TournamentData): 'active' | 'upcoming' | 'completed' {
  const now   = new Date();
  const start = new Date(t.startDate);
  const end   = new Date(t.endDate);
  if (now >= start && now <= end) return 'active';
  if (now < start) return 'upcoming';
  return 'completed';
}

function formatDateRange(startDate: string, endDate: string): string {
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  const start = new Date(startDate).toLocaleDateString('en-CA', opts);
  const end   = new Date(endDate).toLocaleDateString('en-CA', { ...opts, year: 'numeric' });
  return `${start} – ${end}`;
}

function StatusBadge({ status }: { status: 'active' | 'upcoming' | 'completed' }) {
  const cls =
    status === 'active'   ? styles.statusActive   :
    status === 'upcoming' ? styles.statusUpcoming :
    styles.statusDone;
  return (
    <span className={`${styles.statusBadge} ${cls}`}>
      <span className={styles.statusDot} />
      {STATUS_LABELS[status]}
    </span>
  );
}

function OrgLogo({ org, small }: { org: OrgCard; small?: boolean }) {
  const cls = `${styles.cardLogoPlaceholder} ${small ? styles.listLogo : ''}`;
  if (org.logoUrl) {
    return (
      <img
        src={org.logoUrl}
        alt={org.name}
        className={`${small ? styles.listLogo : styles.cardLogo}`}
      />
    );
  }
  return <div className={cls}>{org.name.charAt(0).toUpperCase()}</div>;
}

export default function DiscoverPage() {
  const [orgs,        setOrgs]        = useState<OrgCard[]>([]);
  const [total,       setTotal]       = useState(0);
  const [hasMore,     setHasMore]     = useState(false);
  const [offset,      setOffset]      = useState(0);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search,      setSearch]      = useState('');
  const [filter,      setFilter]      = useState<StatusFilter>('all');
  const [viewMode,    setViewMode]    = useState<ViewMode>('grid');

  const fetchBatch = useCallback(async (batchOffset: number, append: boolean) => {
    if (append) setLoadingMore(true);
    else        setLoading(true);

    try {
      const res  = await fetch(`/api/public/tournaments?limit=${BATCH}&offset=${batchOffset}`);
      const data = await res.json();
      const incoming: OrgCard[] = data.orgs ?? [];

      setOrgs(prev => append ? [...prev, ...incoming] : incoming);
      setTotal(data.total ?? 0);
      setHasMore(data.hasMore ?? false);
      setOffset(batchOffset + BATCH);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => { fetchBatch(0, false); }, [fetchBatch]);

  const filtered = useMemo(() => {
    let result = orgs;

    if (filter !== 'all') {
      result = result.filter(org =>
        org.tournament && getStatus(org.tournament) === filter
      );
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        org =>
          org.name.toLowerCase().includes(q) ||
          (org.tournament?.name ?? '').toLowerCase().includes(q)
      );
    }

    return result;
  }, [orgs, filter, search]);

  const isFiltering = search.trim() !== '' || filter !== 'all';

  return (
    <div className={styles.page}>
      {/* ── Header ── */}
      <div className={styles.header}>
        <div className="container">
          <div className={styles.headerInner}>
            <div>
              <p className={styles.eyebrow}>Discover</p>
              <h1 className={styles.headerTitle}>Browse Tournaments</h1>
              <p className={styles.headerSub}>
                Find public tournaments happening across organizations on this platform.
              </p>
            </div>

            <div className={styles.controls}>
              {/* Search */}
              <div className={styles.searchWrap}>
                <Search size={15} className={styles.searchIcon} />
                <input
                  type="text"
                  placeholder="Search by tournament or org name…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className={styles.searchInput}
                />
              </div>

              {/* Status filters */}
              <div className={styles.filters}>
                {(['all', 'active', 'upcoming', 'completed'] as StatusFilter[]).map(s => (
                  <button
                    key={s}
                    onClick={() => setFilter(s)}
                    className={`${styles.filterBtn} ${filter === s ? styles.filterActive : ''}`}
                  >
                    {s === 'all' ? 'All' : STATUS_LABELS[s]}
                  </button>
                ))}
              </div>

              {/* View toggle */}
              <div className={styles.viewToggle}>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`${styles.viewBtn} ${viewMode === 'grid' ? styles.viewBtnActive : ''}`}
                  title="Grid view"
                >
                  <LayoutGrid size={15} />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`${styles.viewBtn} ${viewMode === 'list' ? styles.viewBtnActive : ''}`}
                  title="List view"
                >
                  <List size={15} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className={styles.body}>
        <div className="container">
          {loading ? (
            <div className={styles.loading}>
              <div className={styles.spinner} />
              Loading tournaments…
            </div>
          ) : filtered.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}><Trophy size={24} /></div>
              <p className={styles.emptyTitle}>
                {isFiltering ? 'No matches found' : 'No tournaments yet'}
              </p>
              <p className={styles.emptySub}>
                {isFiltering
                  ? 'Try adjusting your search or filter.'
                  : 'Check back soon — more tournaments are on their way.'}
              </p>
            </div>
          ) : (
            <>
              <div className={styles.bodyMeta}>
                <p className={styles.resultCount}>
                  {isFiltering
                    ? `${filtered.length} of ${orgs.length} loaded match${filtered.length !== 1 ? 'es' : ''}`
                    : `${filtered.length} tournament${filtered.length !== 1 ? 's' : ''} loaded`}
                </p>
              </div>

              {/* Cards */}
              <div className={viewMode === 'grid' ? styles.grid : styles.list}>
                {filtered.map(org => {
                  const status = org.tournament ? getStatus(org.tournament) : null;

                  return viewMode === 'list' ? (
                    /* ── List row ── */
                    <Link key={org.id} href={`/${org.slug}`} className={`${styles.card} ${styles.listCard}`}>
                      <OrgLogo org={org} small />

                      <div className={styles.listInfo}>
                        <p className={styles.cardOrgName}>{org.name}</p>
                        {org.tournament && (
                          <p className={styles.cardTournamentName}>{org.tournament.name}</p>
                        )}
                      </div>

                      {status && org.tournament && (
                        <div className={styles.listMeta}>
                          <StatusBadge status={status} />
                          <span className={styles.metaItem}>
                            <Calendar size={13} />
                            {formatDateRange(org.tournament.startDate, org.tournament.endDate)}
                          </span>
                          <span className={styles.metaItem}>
                            <Layers size={13} />
                            {org.ageGroupCount} age group{org.ageGroupCount !== 1 ? 's' : ''}
                          </span>
                          <span className={styles.metaItem}>
                            <Users size={13} />
                            {org.teamCount} team{org.teamCount !== 1 ? 's' : ''}
                          </span>
                        </div>
                      )}

                      <ArrowRight size={15} className={styles.listArrow} />
                    </Link>
                  ) : (
                    /* ── Grid card ── */
                    <Link key={org.id} href={`/${org.slug}`} className={styles.card}>
                      <div className={styles.cardTop}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', flex: 1 }}>
                          <OrgLogo org={org} />
                          <div>
                            <p className={styles.cardOrgName}>{org.name}</p>
                            {org.tournament && (
                              <p className={styles.cardTournamentName}>{org.tournament.name}</p>
                            )}
                          </div>
                        </div>
                        {status && <StatusBadge status={status} />}
                      </div>

                      {org.tournament && (
                        <div className={styles.cardMeta}>
                          <span className={styles.metaItem}>
                            <Calendar size={13} />
                            {formatDateRange(org.tournament.startDate, org.tournament.endDate)}
                          </span>
                          <span className={styles.metaItem}>
                            <Layers size={13} />
                            {org.ageGroupCount} age group{org.ageGroupCount !== 1 ? 's' : ''}
                          </span>
                          <span className={styles.metaItem}>
                            <Users size={13} />
                            {org.teamCount} team{org.teamCount !== 1 ? 's' : ''}
                          </span>
                        </div>
                      )}

                      <div className={styles.cardFooter}>
                        <span>View tournament</span>
                        <ArrowRight size={14} />
                      </div>
                    </Link>
                  );
                })}
              </div>

              {/* Load more */}
              {hasMore && (
                <div className={styles.loadMoreWrap}>
                  <button
                    onClick={() => fetchBatch(offset, true)}
                    disabled={loadingMore}
                    className={`btn btn-outline ${styles.loadMoreBtn}`}
                  >
                    {loadingMore ? (
                      <><div className={styles.spinnerSm} />Loading…</>
                    ) : (
                      `Load more (${total - orgs.length} remaining)`
                    )}
                  </button>
                  {isFiltering && (
                    <p className={styles.loadMoreHint}>
                      More results may appear after loading additional tournaments.
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
