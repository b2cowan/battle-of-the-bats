'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ArrowRight, CalendarDays, CheckCircle2, Copy, ExternalLink, FileText, Printer, RefreshCw, Trophy, Users, X } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { usePageTitle } from '@/lib/usePageTitle';
import { hasPlanFeature, requiresTournamentPlusCopy } from '@/lib/plan-features';
import { useTournament } from '@/lib/tournament-context';
import type { Tournament, CloneCopiedCounts } from '@/lib/types';
import { copiedSummary } from '@/lib/utils';
import CollapsibleCard from '@/components/admin/CollapsibleCard';
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

type RepeatSetupForm = {
  name: string;
  slug: string;
  year: string;
  startDate: string;
  endDate: string;
  autoSlug: boolean;
};

type CloneResponse = {
  tournament?: Tournament;
  copied?: CloneCopiedCounts;
  error?: string;
};

type RepeatSetupSuccess = {
  sourceName: string;
  tournament: Tournament;
  copied?: CloneCopiedCounts;
};

const REPEAT_SETUP_INCLUDED = [
  'Divisions, pools, and empty slot structure',
  'Venues and playing surfaces',
  'Rules, resources, and registration questions',
  'Fee setup, public page settings, and branding',
  'Welcome content for the new draft',
];

const REPEAT_SETUP_EXCLUDED = [
  'Teams, registrations, and waitlists',
  'Games, scores, standings, and champions',
  'Payments, files, reminders, and message history',
  'Archived summaries or private admin notes',
];

const REPEAT_SETUP_COPY_GROUPS = ['structure', 'venues', 'registration', 'publicPresence', 'content'];

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

function buildRepeatSetupForm(tournament: Tournament): RepeatSetupForm {
  const nextYear = (tournament.year || new Date().getFullYear()) + 1;
  const suggestedName = tournament.name.includes(String(tournament.year))
    ? tournament.name.replace(String(tournament.year), String(nextYear))
    : `${tournament.name} ${nextYear}`;

  return {
    name: suggestedName,
    slug: slugify(suggestedName),
    year: String(nextYear),
    startDate: '',
    endDate: '',
    autoSlug: true,
  };
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}



export default function TournamentSummaryPage() {
  const { currentOrg } = useOrg();
  usePageTitle('Post-Event Summary');
  const { currentTournament, setCurrentTournament, refresh } = useTournament();
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [state, setState] = useState<LoadState>('idle');
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState('');
  const [cloneWorking, setCloneWorking] = useState(false);
  const [repeatSetupOpen, setRepeatSetupOpen] = useState(false);
  const [repeatSetupForm, setRepeatSetupForm] = useState<RepeatSetupForm | null>(null);
  const [repeatSetupError, setRepeatSetupError] = useState('');
  const [repeatSetupSuccess, setRepeatSetupSuccess] = useState<RepeatSetupSuccess | null>(null);

  const tournamentId = currentTournament?.id;
  const hasSummary = Boolean(currentOrg && hasPlanFeature(currentOrg.planId, 'post_tournament_summary'));
  const canClone = Boolean(currentOrg && hasPlanFeature(currentOrg.planId, 'tournament_cloning'));
  const subscriptionHref = `/${currentOrg?.slug ?? 'admin'}/admin/tournaments/settings/subscription`;
  const tournamentAdminBase = `/${currentOrg?.slug ?? 'admin'}/admin/tournaments`;
  const orgQuery = currentOrg?.slug ? `?orgSlug=${encodeURIComponent(currentOrg.slug)}` : '';
  const repeatSetupNextSteps = [
    { label: 'Review event settings', href: `${tournamentAdminBase}/settings/event`, detail: 'Confirm dates, fees, and public contact details.' },
    { label: 'Check divisions', href: `${tournamentAdminBase}/divisions`, detail: 'Adjust division names, capacity, pools, and fee overrides.' },
    { label: 'Confirm venues', href: `${tournamentAdminBase}/venues`, detail: 'Make sure locations and playing surfaces still apply.' },
    { label: 'Open draft dashboard', href: `${tournamentAdminBase}/dashboard`, detail: 'Use the launch checklist before activating registration.' },
  ];
  const activeRepeatSetupSuccess = (repeatSetupSuccess && currentTournament?.id === repeatSetupSuccess.tournament.id) ? repeatSetupSuccess : null;
  const completionRatio = useMemo(() => {
    if (!summary) return '0%';
    return percent(summary.scheduleTotals.completed, summary.scheduleTotals.total);
  }, [summary]);

  useEffect(() => {
    if (!tournamentId || !hasSummary || activeRepeatSetupSuccess) return;
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
  }, [hasSummary, tournamentId, orgQuery, activeRepeatSetupSuccess]);

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

  function openRepeatSetup() {
    if (!currentTournament || !canClone) return;
    setRepeatSetupForm(buildRepeatSetupForm(currentTournament));
    setRepeatSetupError('');
    setRepeatSetupOpen(true);
  }

  function closeRepeatSetup() {
    if (cloneWorking) return;
    setRepeatSetupOpen(false);
    setRepeatSetupError('');
  }

  function updateRepeatSetupForm(update: Partial<RepeatSetupForm>) {
    setRepeatSetupForm(form => form ? { ...form, ...update } : form);
  }

  async function handleRepeatSetupSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!currentTournament || !tournamentId || !repeatSetupForm) return;

    const name = repeatSetupForm.name.trim().replace(/\s+/g, ' ');
    const slug = slugify(repeatSetupForm.slug);
    const year = Number(repeatSetupForm.year);
    const startDate = repeatSetupForm.startDate || null;
    const endDate = repeatSetupForm.endDate || null;

    if (!name) {
      setRepeatSetupError('Enter a tournament name.');
      return;
    }
    if (!slug) {
      setRepeatSetupError('Enter a public link.');
      return;
    }
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      setRepeatSetupError('Choose a valid tournament year.');
      return;
    }
    if (startDate && endDate && endDate < startDate) {
      setRepeatSetupError('End date cannot be before start date.');
      return;
    }

    setCloneWorking(true);
    setMessage('');
    setRepeatSetupError('');
    const sourceName = currentTournament.name;
    try {
      const res = await fetch(`/api/admin/tournaments/${encodeURIComponent(tournamentId)}/clone${orgQuery}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          slug,
          year,
          startDate,
          endDate,
          options: {
            includeDivisions: true,
            includePools: true,
            includeSlots: true,
            includeVenues: true,
            includeBranding: true,
            includePublicPages: true,
            includeWelcome: true,
            includeRulesResources: true,
            includeRegistrationFields: true,
            includeFeeSchedule: true,
          },
          analytics: {
            sourceSurface: 'summary',
            selectedCopyGroups: REPEAT_SETUP_COPY_GROUPS,
            warningCount: 0,
            warningKeys: [],
          },
        }),
      });
      const data = await res.json() as CloneResponse;
      if (!res.ok) throw new Error(data.error ?? 'Unable to create the next tournament draft.');
      if (!data.tournament) throw new Error('No tournament was returned.');
      setCurrentTournament(data.tournament);
      await refresh();
      setRepeatSetupSuccess({ sourceName, tournament: data.tournament, copied: data.copied });
      setRepeatSetupOpen(false);
    } catch (error) {
      setRepeatSetupError(error instanceof Error ? error.message : 'Unable to create the next tournament draft.');
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
            <p className={styles.pageSub}>{currentTournament.name} recap</p>
          </div>
        </div>

        <div className={styles.lockedCard}>
          <h2>Upgrade to keep the post-event record working for you</h2>
          <p>{requiresTournamentPlusCopy('post_tournament_summary')}</p>
          <Link href={subscriptionHref} className="btn btn-lime btn-data" onClick={() => void trackSummaryAction('renewal_cta_clicked')}>Review Tournament Plus</Link>
        </div>
      </div>
    );
  }

  if (activeRepeatSetupSuccess) {
    return (
      <div className={styles.page}>
        <div className={styles.pageHeader}>
          <div className={styles.headerIcon}><CheckCircle2 size={21} /></div>
          <div>
            <h1 className={styles.pageTitle}>Next tournament draft created</h1>
            <p className={styles.pageSub}>{activeRepeatSetupSuccess.tournament.name} now starts from {activeRepeatSetupSuccess.sourceName}</p>
          </div>
        </div>

        <section className={styles.successHero}>
          <div className={styles.successHeader}>
            <span className={styles.successBadge}>Tournament Plus</span>
            <h2>Reuse the setup, then review before launch.</h2>
            <p>
              The new tournament is a draft. Teams, registrations, games, scores, and payment history stayed behind so next year starts clean.
            </p>
          </div>

          <div className={styles.successGrid}>
            <div className={styles.successPanel}>
              <h3>Copied forward</h3>
              <ul className={styles.copySummaryList}>
                {copiedSummary(activeRepeatSetupSuccess.copied).map(item => (
                  <li key={item}><CheckCircle2 size={14} /> {item}</li>
                ))}
              </ul>
            </div>
            <div className={styles.successPanel}>
              <h3>Next checks</h3>
              <div className={styles.nextStepList}>
                {repeatSetupNextSteps.map(step => (
                  <Link key={step.href} href={step.href} className={styles.nextStepLink}>
                    <span>
                      <strong>{step.label}</strong>
                      <small>{step.detail}</small>
                    </span>
                    <ArrowRight size={15} />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.headerIcon}><FileText size={21} /></div>
        <div>
          <h1 className={styles.pageTitle}>Post-Event Summary</h1>
          <p className={styles.pageSub}>{currentTournament.name} · {dateRange(summary)}</p>
        </div>
      </div>

      {state === 'loading' && (
        <div className="empty-state"><RefreshCw className="spin" /><p>Loading summary...</p></div>
      )}

      {state === 'error' && (
        <div className="alert alert-danger">{message}</div>
      )}

      {state === 'ready' && summary && (
        <>
          {/* ── ZONE 1 · RECAP ─────────────────────────────────── */}
          {summary.divisions.some(division => division.champion) && (
            <section className={styles.championBand}>
              <span className={styles.championBandLabel}><Trophy size={14} /> Champions</span>
              <div className={styles.championBandList}>
                {summary.divisions.filter(division => division.champion).map(division => (
                  <span key={division.id} className={styles.championChip}>
                    <strong>{division.champion!.championTeamName}</strong>
                    <span className={styles.championChipDiv}>{division.name}</span>
                  </span>
                ))}
              </div>
            </section>
          )}

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
              <small>{completionRatio} complete - {summary.scheduleTotals.playoffGames} playoff games</small>
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

          {/* ── ZONE 2 · SHARE THE RESULTS ─────────────────────── */}
          <section className={styles.sharePanel}>
            <h2 className={styles.zoneTitle}>Share the results</h2>
            <div className={styles.shareActions}>
              <button type="button" className="btn btn-outline btn-data" onClick={() => copyPublicLink(summary.publicLinks.standings, 'Standings link')}>
                <Copy size={14} /> {copied === 'Standings link' ? 'Copied' : 'Copy standings link'}
              </button>
              <Link className="btn btn-outline btn-data" href={summary.publicLinks.standings} target="_blank">
                <ExternalLink size={14} /> Public standings
              </Link>
              <button type="button" className="btn btn-ghost btn-data" onClick={() => { void trackSummaryAction('print'); window.print(); }}>
                <Printer size={14} /> Print
              </button>
            </div>
          </section>

          {/* Value reflection — visible, no ask (the real anti-churn line) */}
          <p className={styles.valueReflection}>
            Your saved summary, shareable public results, and reusing this setup next year all come with Tournament Plus.
          </p>

          {/* ── ZONE 3 · WHAT'S NEXT (opt-in) ──────────────────── */}
          <CollapsibleCard title="What's next" icon={<ArrowRight size={15} />} defaultOpen={false} className={styles.whatsNextCard}>
            <div className={styles.whatsNextPrimary}>
              <div>
                <strong>Start next year from this setup</strong>
                <p>Create a clean draft with your divisions, venues, fees, and public settings carried forward. Teams, scores, and payments stay behind.</p>
              </div>
              {canClone ? (
                <button type="button" className="btn btn-lime btn-data" onClick={openRepeatSetup} disabled={cloneWorking}>
                  <RefreshCw size={14} /> {cloneWorking ? 'Creating draft...' : 'Reuse this setup'}
                </button>
              ) : (
                <Link className="btn btn-outline btn-data" href={subscriptionHref}>
                  <ArrowRight size={14} /> Review repeat-event setup
                </Link>
              )}
            </div>
            {!canClone && <p className={styles.whatsNextNote}>{requiresTournamentPlusCopy('tournament_cloning')}</p>}
            <p className={styles.discoveryLine}>
              FieldLogicHQ also runs season-long leagues and full club operations — registrations, house league, rep teams, and accounting.{' '}
              <Link href="/pricing" target="_blank" className={styles.discoveryLink}>See what League Plus and Club include →</Link>
            </p>
          </CollapsibleCard>
        </>
      )}

      {repeatSetupOpen && repeatSetupForm && (
        <div className="modal-overlay" onClick={closeRepeatSetup}>
          <div className={`modal ${styles.repeatModal}`} role="dialog" aria-modal="true" aria-labelledby="repeat-setup-title" onClick={event => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 id="repeat-setup-title">Reuse this tournament setup</h3>
                <p className={styles.repeatModalIntro}>Create a clean draft from {currentTournament.name}. You can review everything before publishing.</p>
              </div>
              <button type="button" className="btn btn-ghost btn-data" onClick={closeRepeatSetup} aria-label="Close repeat-event setup" disabled={cloneWorking}>
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleRepeatSetupSubmit}>
              <div className={styles.repeatModalBody}>
                <div className={styles.repeatFormGrid}>
                  <label className={styles.fieldLabel}>
                    Tournament name *{' '}
                    <input
                      className="form-input"
                      value={repeatSetupForm.name}
                      onChange={event => {
                        const name = event.target.value;
                        setRepeatSetupForm(form => form ? {
                          ...form,
                          name,
                          ...(form.autoSlug ? { slug: slugify(name) } : {}),
                        } : form);
                      }}
                      placeholder="e.g. Battle of the Bats 2027"
                    />
                  </label>
                  <label className={styles.fieldLabel}>
                    Year *{' '}
                    <input
                      className="form-input"
                      type="number"
                      min="2000"
                      max="2100"
                      value={repeatSetupForm.year}
                      onChange={event => updateRepeatSetupForm({ year: event.target.value })}
                    />
                  </label>
                  <label className={styles.fieldLabel}>
                    Public link *{' '}
                    <input
                      className="form-input"
                      value={repeatSetupForm.slug}
                      onChange={event => updateRepeatSetupForm({
                        slug: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-'),
                        autoSlug: false,
                      })}
                      placeholder="battle-of-the-bats-2027"
                    />
                  </label>
                  <label className={styles.fieldLabel}>
                    Start date <span>optional</span>
                    <input
                      className="form-input"
                      type="date"
                      value={repeatSetupForm.startDate}
                      onChange={event => updateRepeatSetupForm({ startDate: event.target.value })}
                    />
                  </label>
                  <label className={styles.fieldLabel}>
                    End date <span>optional</span>
                    <input
                      className="form-input"
                      type="date"
                      value={repeatSetupForm.endDate}
                      min={repeatSetupForm.startDate || undefined}
                      onChange={event => updateRepeatSetupForm({ endDate: event.target.value })}
                    />
                  </label>
                </div>

                <div className={styles.copyGrid}>
                  <div className={styles.copyPanel}>
                    <h4>Carried forward</h4>
                    <ul className={styles.copyList}>
                      {REPEAT_SETUP_INCLUDED.map(item => (
                        <li key={item}><span className={styles.checkDot} /> {item}</li>
                      ))}
                    </ul>
                  </div>
                  <div className={styles.copyPanel}>
                    <h4>Never copied</h4>
                    <ul className={styles.copyList}>
                      {REPEAT_SETUP_EXCLUDED.map(item => (
                        <li key={item}><span className={styles.neverDot} /> {item}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <p className={styles.modalNote}>
                  The draft stays private until you activate it from the launch checklist.
                </p>

                {repeatSetupError && (
                  <div className={styles.modalError}>{repeatSetupError}</div>
                )}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-ghost btn-data" onClick={closeRepeatSetup} disabled={cloneWorking}>Cancel</button>
                <button type="submit" className="btn btn-lime btn-data" disabled={cloneWorking}>
                  <RefreshCw size={14} /> {cloneWorking ? 'Creating draft...' : 'Create next tournament'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
