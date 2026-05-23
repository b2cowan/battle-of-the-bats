'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, Copy, ExternalLink, FileText, Printer, RefreshCw, Trophy, Users } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { hasPlanFeature, requiresTournamentPlusCopy } from '@/lib/plan-features';
import { useTournament } from '@/lib/tournament-context';
import type { Tournament } from '@/lib/types';
import styles from './summary.module.css';

type SummaryData = {
  tournament: {
    id: string;
    name: string;
    slug: string | null;
    year: number | null;
    status: string | null;
    startDate: string | null;
    endDate: string | null;
  };
  registrationTotals: {
    total: number;
    accepted: number;
    pending: number;
    waitlist: number;
    rejected: number;
  };
  paymentTotals: {
    expected: number;
    collected: number;
    outstanding: number;
    paidInFull: number;
    depositComplete: number;
    pastDue: number;
  };
  scheduleTotals: {
    total: number;
    completed: number;
    submitted: number;
    scheduled: number;
    cancelled: number;
    playoffGames: number;
  };
  divisions: Array<{
    id: string;
    name: string;
    capacity: number | null;
    registrations: {
      total: number;
      accepted: number;
      pending: number;
      waitlist: number;
      rejected: number;
    };
    games: {
      total: number;
      completed: number;
    };
    standingsLeader: {
      teamId: string;
      teamName: string;
      gp: number;
      w: number;
      l: number;
      t: number;
      pts: number;
      rf: number;
      ra: number;
      rd: number;
    } | null;
    champion: {
      championTeamId: string | null;
      championTeamName: string;
      runnerUpTeamId: string | null;
      runnerUpTeamName: string;
    } | null;
  }>;
  archive: {
    sealed: boolean;
    sealedAt: string | null;
    count: number;
  };
  publicLinks: {
    home: string;
    standings: string;
    schedule: string;
    teams: string;
  };
};

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(value);
}

function percent(part: number, total: number) {
  if (total <= 0) return '0%';
  return `${Math.round((part / total) * 100)}%`;
}

function dateRange(summary: SummaryData | null) {
  if (!summary?.tournament.startDate && !summary?.tournament.endDate) return 'Dates not set';
  if (summary.tournament.startDate && summary.tournament.endDate) {
    return `${summary.tournament.startDate} to ${summary.tournament.endDate}`;
  }
  return summary.tournament.startDate ?? summary.tournament.endDate ?? 'Dates not set';
}

export default function TournamentSummaryPage() {
  const { currentOrg } = useOrg();
  const { currentTournament, setCurrentTournament, refresh } = useTournament();
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [state, setState] = useState<LoadState>('idle');
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState('');
  const [cloneWorking, setCloneWorking] = useState(false);

  const tournamentId = currentTournament?.id;
  const hasSummary = Boolean(currentOrg && hasPlanFeature(currentOrg.planId, 'post_tournament_summary'));
  const canClone = Boolean(currentOrg && hasPlanFeature(currentOrg.planId, 'tournament_cloning'));
  const subscriptionHref = `/${currentOrg?.slug ?? 'admin'}/admin/tournaments/settings/subscription`;
  const orgQuery = currentOrg?.slug ? `?orgSlug=${encodeURIComponent(currentOrg.slug)}` : '';
  const completionRatio = useMemo(() => {
    if (!summary) return '0%';
    return percent(summary.scheduleTotals.completed, summary.scheduleTotals.total);
  }, [summary]);

  useEffect(() => {
    if (!tournamentId || !hasSummary) return;
    const id = tournamentId;
    let cancelled = false;
    async function load() {
      setState('loading');
      setMessage('');
      try {
        const res = await fetch(`/api/admin/tournaments/${encodeURIComponent(id)}/summary${orgQuery}`, { cache: 'no-store' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Unable to load tournament summary.');
        if (!cancelled) {
          setSummary(data as SummaryData);
          setState('ready');
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : 'Unable to load tournament summary.');
          setState('error');
        }
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [hasSummary, tournamentId, orgQuery]);

  function slugify(value: string) {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
  }

  async function trackSummaryAction(action: 'print' | 'share_public_results' | 'renewal_cta_clicked') {
    if (!tournamentId) return;
    try {
      await fetch(`/api/admin/tournaments/${encodeURIComponent(tournamentId)}/summary${orgQuery}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
    } catch {
      // Analytics should never block the organizer's recap workflow.
    }
  }

  async function handleStartNextTournament() {
    if (!currentTournament || !tournamentId) return;
    const nextYear = (currentTournament.year || new Date().getFullYear()) + 1;
    const suggestedName = currentTournament.name.includes(String(currentTournament.year))
      ? currentTournament.name.replace(String(currentTournament.year), String(nextYear))
      : `${currentTournament.name} ${nextYear}`;
    const name = window.prompt('Name for the next tournament draft', suggestedName)?.trim();
    if (!name) return;
    const slug = window.prompt('URL slug for the new tournament', slugify(name))?.trim();
    if (!slug) return;

    setCloneWorking(true);
    setMessage('');
    try {
      const res = await fetch(`/api/admin/tournaments/${encodeURIComponent(tournamentId)}/clone${orgQuery}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          slug,
          year: nextYear,
          startDate: null,
          endDate: null,
          options: {
            includeDivisions: true,
            includePools: true,
            includeSlots: true,
            includeVenues: true,
            includeContacts: true,
            includeBranding: true,
            includePublicPages: true,
            includeWelcome: true,
            includeRulesResources: true,
            includeRegistrationFields: true,
            includeFeeSchedule: true,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Unable to clone tournament.');
      setCurrentTournament(data.tournament as Tournament);
      await refresh();
      setMessage('Next tournament draft created.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to clone tournament.');
    } finally {
      setCloneWorking(false);
    }
  }

  async function copyPublicLink(path: string, label: string) {
    const href = `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(href);
      setCopied(label);
      window.setTimeout(() => setCopied(''), 1800);
      void trackSummaryAction('share_public_results');
    } catch {
      setMessage('Unable to copy the link from this browser.');
    }
  }

  if (!currentTournament) {
    return (
      <div className={styles.page}>
        <p className={styles.muted}>Select a tournament from the sidebar to view its post-event summary.</p>
      </div>
    );
  }

  if (!hasSummary) {
    return (
      <div className={styles.page}>
        <div className={styles.pageHeader}>
          <div className={styles.headerIcon}><FileText size={21} /></div>
          <div>
            <h1 className={styles.pageTitle}>Post-Event Summary</h1>
            <p className={styles.pageSub}>{currentTournament.name} recap and renewal planning</p>
          </div>
        </div>

        <div className={styles.lockedCard}>
          <h2>Upgrade to keep the post-event record working for you</h2>
          <p>{requiresTournamentPlusCopy('post_tournament_summary')}</p>
          <Link href={subscriptionHref} className="btn btn-primary" onClick={() => void trackSummaryAction('renewal_cta_clicked')}>Review Tournament Plus</Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.headerIcon}><FileText size={21} /></div>
        <div>
          <h1 className={styles.pageTitle}>Post-Event Summary</h1>
          <p className={styles.pageSub}>{currentTournament.name} recap and renewal planning</p>
        </div>
        <button
          type="button"
          className={`btn btn-outline btn-sm ${styles.printBtn}`}
          onClick={() => {
            void trackSummaryAction('print');
            window.print();
          }}
        >
          <Printer size={14} /> Print
        </button>
      </div>

      {state === 'loading' && (
        <div className="empty-state"><RefreshCw className="spin" /><p>Loading summary...</p></div>
      )}

      {state === 'error' && (
        <div className="alert alert-danger">{message}</div>
      )}

      {state === 'ready' && summary && (
        <>
          <section className={styles.hero}>
            <div>
              <span className={styles.eyebrow}>Tournament recap</span>
              <h2>{summary.tournament.name}</h2>
              <p>{dateRange(summary)} - {summary.tournament.status ?? 'status unknown'}</p>
            </div>
            <div className={styles.heroStats}>
              <strong>{completionRatio}</strong>
              <span>games completed</span>
            </div>
          </section>

          <section className={styles.metricGrid}>
            <div className={styles.metricCard}>
              <Users size={18} />
              <span>Registered teams</span>
              <strong>{summary.registrationTotals.total}</strong>
              <small>{summary.registrationTotals.accepted} accepted - {summary.registrationTotals.waitlist} waitlisted</small>
            </div>
            <div className={styles.metricCard}>
              <CalendarDays size={18} />
              <span>Schedule progress</span>
              <strong>{summary.scheduleTotals.completed}/{summary.scheduleTotals.total}</strong>
              <small>{summary.scheduleTotals.playoffGames} playoff games</small>
            </div>
            <div className={styles.metricCard}>
              <Trophy size={18} />
              <span>Divisions</span>
              <strong>{summary.divisions.length}</strong>
              <small>{summary.divisions.filter(division => division.champion).length} champions detected</small>
            </div>
            <div className={styles.metricCard}>
              <FileText size={18} />
              <span>Payment readiness</span>
              <strong>{formatMoney(summary.paymentTotals.collected)}</strong>
              <small>{formatMoney(summary.paymentTotals.outstanding)} outstanding - {summary.paymentTotals.pastDue} past due</small>
            </div>
          </section>

          <section className={styles.actionsPanel}>
            <div>
              <h2>Keep momentum after the final game</h2>
              <p>Share the public record, print this recap, or start next year from the setup that already worked.</p>
            </div>
            <div className={styles.actionButtons}>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => copyPublicLink(summary.publicLinks.standings, 'Standings link')}>
                <Copy size={14} /> {copied === 'Standings link' ? 'Copied' : 'Copy standings link'}
              </button>
              <Link className="btn btn-outline btn-sm" href={summary.publicLinks.standings} target="_blank">
                <ExternalLink size={14} /> Public standings
              </Link>
              <Link className="btn btn-outline btn-sm" href={subscriptionHref} onClick={() => void trackSummaryAction('renewal_cta_clicked')}>
                Keep Plus active
              </Link>
              <button type="button" className="btn btn-primary btn-sm" onClick={handleStartNextTournament} disabled={!canClone || cloneWorking}>
                <RefreshCw size={14} /> {cloneWorking ? 'Creating draft...' : 'Start next tournament'}
              </button>
              {!canClone && <span className={styles.actionNote}>{requiresTournamentPlusCopy('tournament_cloning')}</span>}
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2>Division recap</h2>
              <p>Champions are detected from completed playoff final games when available. Otherwise, the standings leader is shown.</p>
            </div>
            <div className={styles.divisionList}>
              {summary.divisions.map(division => (
                <article key={division.id} className={styles.divisionCard}>
                  <div className={styles.divisionHeader}>
                    <div>
                      <h3>{division.name}</h3>
                      <p>{division.registrations.accepted} accepted teams - {division.games.completed}/{division.games.total} games completed</p>
                    </div>
                    {division.champion ? (
                      <span className={styles.championBadge}>{division.champion.championTeamName}</span>
                    ) : division.standingsLeader ? (
                      <span className={styles.leaderBadge}>Leader: {division.standingsLeader.teamName}</span>
                    ) : (
                      <span className={styles.neutralBadge}>No result yet</span>
                    )}
                  </div>
                  <div className={styles.divisionStats}>
                    <span>{division.registrations.pending} pending</span>
                    <span>{division.registrations.waitlist} waitlist</span>
                    <span>{division.capacity ? `${division.registrations.accepted}/${division.capacity} capacity` : 'No capacity set'}</span>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
