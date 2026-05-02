'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Search, Calendar, Users, Trophy, ArrowRight, Layers } from 'lucide-react';
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

function getStatus(t: TournamentData): 'active' | 'upcoming' | 'completed' {
  const now = new Date();
  const start = new Date(t.startDate);
  const end = new Date(t.endDate);
  if (now >= start && now <= end) return 'active';
  if (now < start) return 'upcoming';
  return 'completed';
}

function formatDateRange(startDate: string, endDate: string): string {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  const startStr = start.toLocaleDateString('en-CA', opts);
  const endStr = end.toLocaleDateString('en-CA', { ...opts, year: 'numeric' });
  return `${startStr} – ${endStr}`;
}

const STATUS_LABELS: Record<string, string> = {
  active:    'Active',
  upcoming:  'Upcoming',
  completed: 'Completed',
};

export default function DiscoverPage() {
  const [orgs, setOrgs]           = useState<OrgCard[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [filter, setFilter]       = useState<StatusFilter>('all');

  useEffect(() => {
    fetch('/api/public/tournaments')
      .then(r => r.json())
      .then(data => setOrgs(data.orgs ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let result = orgs;

    if (filter !== 'all') {
      result = result.filter(org => {
        if (!org.tournament) return false;
        return getStatus(org.tournament) === filter;
      });
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

  return (
    <div className={styles.page}>
      {/* Header */}
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
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className={styles.body}>
        <div className="container">
          {loading ? (
            <div className={styles.loading}>
              <div className={styles.spinner} />
              Loading tournaments…
            </div>
          ) : filtered.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>
                <Trophy size={24} />
              </div>
              <p className={styles.emptyTitle}>
                {search || filter !== 'all' ? 'No matches found' : 'No tournaments yet'}
              </p>
              <p className={styles.emptySub}>
                {search || filter !== 'all'
                  ? 'Try adjusting your search or filter.'
                  : 'Check back soon — more tournaments are on their way.'}
              </p>
            </div>
          ) : (
            <>
              <p className={styles.resultCount}>
                {filtered.length} tournament{filtered.length !== 1 ? 's' : ''} found
              </p>
              <div className={styles.grid}>
                {filtered.map(org => {
                  const status = org.tournament ? getStatus(org.tournament) : null;
                  return (
                    <Link key={org.id} href={`/${org.slug}`} className={styles.card}>
                      {/* Top row */}
                      <div className={styles.cardTop}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', flex: 1 }}>
                          {org.logoUrl ? (
                            <img src={org.logoUrl} alt={org.name} className={styles.cardLogo} />
                          ) : (
                            <div className={styles.cardLogoPlaceholder}>
                              {org.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <p className={styles.cardOrgName}>{org.name}</p>
                            {org.tournament && (
                              <p className={styles.cardTournamentName}>
                                {org.tournament.name} {org.tournament.year}
                              </p>
                            )}
                          </div>
                        </div>

                        {status && (
                          <span className={`${styles.statusBadge} ${
                            status === 'active'    ? styles.statusActive   :
                            status === 'upcoming'  ? styles.statusUpcoming :
                            styles.statusDone
                          }`}>
                            <span className={styles.statusDot} />
                            {STATUS_LABELS[status]}
                          </span>
                        )}
                      </div>

                      {/* Meta */}
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

                      {/* Footer */}
                      <div className={styles.cardFooter}>
                        <span>View tournament</span>
                        <ArrowRight size={14} />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
