'use client';
import { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle2, Info, Users, Calendar, Trophy, Megaphone, Tag, DollarSign, TrendingUp, MapPin, BookUser, BookOpen } from 'lucide-react';
import Link from 'next/link';
import { useTournament } from '@/lib/tournament-context';
import { useOrg } from '@/lib/org-context';
import { LiveEventLog } from '@/components/admin/LiveEventLog';
import styles from './dashboard.module.css';

type DivisionStat = {
  id: string;
  name: string;
  capacity: number | null;
  accepted: number;
  pending: number;
  waitlist: number;
};

type PaymentCounts = {
  paid: number;
  depositPaid: number;
  pending: number;
  pastDue: number;
  noSchedule: number;
};

type DashboardStats = {
  ageGroups: number;
  teams: number;
  scheduled: number;
  completed: number;
  announcements: number;
  publishChecklist: PublishChecklist;
  registration: {
    totalCapacity: number;
    totalAccepted: number;
    totalPending: number;
    totalWaitlist: number;
    byDivision: DivisionStat[];
  };
  payment: {
    hasFeeSchedule: boolean;
    totalExpected: number;
    totalCollected: number;
    counts: PaymentCounts;
  };
};

type PublishChecklist = {
  hasDates: boolean;
  hasDivisions: boolean;
  hasPublicContact: boolean;
  hasOpenDivision: boolean;
  hasBranding: boolean;
  ready: boolean;
};

const EMPTY_STATS: DashboardStats = {
  ageGroups: 0,
  teams: 0,
  scheduled: 0,
  completed: 0,
  announcements: 0,
  publishChecklist: {
    hasDates: false,
    hasDivisions: false,
    hasPublicContact: false,
    hasOpenDivision: false,
    hasBranding: false,
    ready: false,
  },
  registration: { totalCapacity: 0, totalAccepted: 0, totalPending: 0, totalWaitlist: 0, byDivision: [] },
  payment: { hasFeeSchedule: false, totalExpected: 0, totalCollected: 0, counts: { paid: 0, depositPaid: 0, pending: 0, pastDue: 0, noSchedule: 0 } },
};

function fmt(n: number) {
  return n.toLocaleString('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 });
}

function GaugeBar({ value, max, danger }: { value: number; max: number; danger?: boolean }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const color = danger ? 'var(--danger-light)' : pct >= 100 ? 'var(--logic-lime)' : pct >= 75 ? '#f6c453' : 'var(--blueprint-blue)';
  return (
    <div className={styles.gaugeWrap}>
      <div className={styles.gaugeTrack}>
        <div className={styles.gaugeFill} style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className={styles.gaugePct} style={{ color }}>{pct}%</span>
    </div>
  );
}

export default function AdminDashboard() {
  const { currentTournament } = useTournament();
  const { currentOrg } = useOrg();
  const base = `/${currentOrg?.slug ?? 'milton-bats'}/admin/tournaments`;
  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);
  const [statsError, setStatsError] = useState('');

  useEffect(() => {
    const tournamentId = currentTournament?.id;
    if (!tournamentId) return;
    const controller = new AbortController();
    async function fetchStats(id: string) {
      try {
        const res = await fetch(`/api/admin/tournament-dashboard?tournamentId=${encodeURIComponent(id)}`, { signal: controller.signal });
        const data = await res.json().catch(() => null) as Partial<DashboardStats> & { error?: string } | null;
        if (!res.ok) throw new Error(data?.error ?? 'Unable to load dashboard stats.');
        setStats({
          ageGroups:     data?.ageGroups     ?? 0,
          teams:         data?.teams         ?? 0,
          scheduled:     data?.scheduled     ?? 0,
          completed:     data?.completed     ?? 0,
          announcements: data?.announcements ?? 0,
          publishChecklist: {
            hasDates:         data?.publishChecklist?.hasDates         ?? false,
            hasDivisions:     data?.publishChecklist?.hasDivisions     ?? false,
            hasPublicContact: data?.publishChecklist?.hasPublicContact ?? false,
            hasOpenDivision:  data?.publishChecklist?.hasOpenDivision  ?? false,
            hasBranding:      data?.publishChecklist?.hasBranding      ?? false,
            ready:            data?.publishChecklist?.ready            ?? false,
          },
          registration: data?.registration ?? EMPTY_STATS.registration,
          payment:       data?.payment      ?? EMPTY_STATS.payment,
        });
        setStatsError('');
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setStats(EMPTY_STATS);
        setStatsError(err instanceof Error ? err.message : 'Unable to load dashboard stats.');
      }
    }
    void fetchStats(tournamentId);
    return () => controller.abort();
  }, [currentTournament?.id]);

  const status        = currentTournament?.status ?? 'draft';
  const isDraft       = status === 'draft';
  const isActive      = status === 'active';
  const isCompleted   = status === 'completed';
  const isLive        = isActive || isCompleted;

  const statusColor = { active: 'var(--logic-lime)', draft: 'rgba(148,163,184,0.55)', completed: '#f6c453', archived: 'rgba(148,163,184,0.3)' }[status] ?? 'rgba(148,163,184,0.55)';
  const visibleStats  = currentTournament?.id ? stats : EMPTY_STATS;
  const checklist     = visibleStats.publishChecklist;
  const reg           = visibleStats.registration;
  const pay           = visibleStats.payment;

  // Draft stats: only show what's relevant during setup
  const draftCards = [
    { label: 'Age Groups', value: visibleStats.ageGroups,     icon: Tag,       key: 'age-groups'    },
    { label: 'News Posts', value: visibleStats.announcements, icon: Megaphone, key: 'announcements' },
  ];

  // Live stats: full picture
  const liveCards = [
    { label: 'Teams',     value: visibleStats.teams,     icon: Users,    key: 'teams'    },
    { label: 'Scheduled', value: visibleStats.scheduled, icon: Calendar, key: 'schedule' },
    { label: 'Completed', value: visibleStats.completed, icon: Trophy,   key: 'results'  },
  ];

  const checklistItems = [
    { key: 'dates',         done: checklist.hasDates,         label: 'Tournament dates added',                  desc: 'Set a start and end date so teams know when the event runs.',              href: `${base}/manage`,      action: 'Edit dates'       },
    { key: 'divisions',     done: checklist.hasDivisions,     label: 'At least one age group or division',      desc: 'Create the divisions teams can register for.',                             href: `${base}/age-groups`,  action: 'Manage divisions' },
    { key: 'contact',       done: checklist.hasPublicContact, label: 'Public contact email selected',           desc: 'Choose the email coaches can use for tournament questions.',               href: `${base}/contacts`,    action: 'Manage contacts'  },
    { key: 'open-division', done: checklist.hasOpenDivision,  label: 'Registration open for at least one division', desc: 'Open a division when you are ready for teams to register.',          href: `${base}/age-groups`,  action: 'Open divisions'   },
  ];

  const setupLinks = [
    { href: `${base}/venues`,     icon: MapPin,    label: 'Venues',            desc: 'Add playing fields and addresses'       },
    { href: `${base}/age-groups`, icon: Tag,       label: 'Age Groups',        desc: 'Set up divisions and capacities'        },
    { href: `${base}/contacts`,   icon: BookUser,  label: 'Contacts',          desc: 'Add coordinators and public email'      },
    { href: `${base}/rules`,      icon: BookOpen,  label: 'Rules & Resources', desc: 'Upload documents for teams'             },
  ];

  return (
    <div className={styles.page}>
      <header className="flex items-center justify-between border-b border-blueprint-blue/60 pb-4 mb-8">
        <div>
          <div className="hud-label mb-1">{currentOrg?.name ?? 'Admin'}</div>
          <h1 className="font-sans font-extrabold text-2xl uppercase tracking-tighter text-fl-text">
            {currentTournament?.name ?? currentOrg?.name ?? 'Admin'}
          </h1>
        </div>
        <div className="hidden md:flex items-center font-mono text-xs font-bold" style={{ color: statusColor }}>
          {status.toUpperCase()}
        </div>
      </header>

      {currentTournament?.id && statsError && (
        <div className="mb-4 text-xs" style={{ color: 'var(--data-gray)' }}>Dashboard counts are unavailable right now.</div>
      )}

      {/* ── DRAFT DASHBOARD ─────────────────────────────── */}
      {isDraft && (
        <>
          {/* Minimal stats — only what matters during setup */}
          <div className={styles.statsGrid} style={{ marginBottom: '2rem' }}>
            {draftCards.map(card => (
              <Link key={card.label} href={`${base}/${card.key}`} className={`card ${styles.statCard}`} id={`dashboard-${card.label.toLowerCase().replace(/\s/g, '-')}`}>
                <div className={styles.statIcon}><card.icon size={22} /></div>
                <div>
                  <div className={styles.statNum}>{card.value}</div>
                  <div className={styles.statLabel}>{card.label}</div>
                </div>
              </Link>
            ))}
          </div>

          {/* Launch checklist */}
          <section className={styles.publishChecklist}>
            <div className={styles.checklistHeader}>
              <div>
                <h2 className={styles.sectionTitle}>Draft Launch Checklist</h2>
                <p>Complete these items before activating registration and the public tournament page.</p>
              </div>
              <span className={checklist.ready ? styles.readyPill : styles.draftPill}>
                {checklist.ready ? 'Ready to activate' : 'Draft only'}
              </span>
            </div>

            <div className={styles.checklistGrid}>
              {checklistItems.map(item => {
                const Icon = item.done ? CheckCircle2 : AlertCircle;
                return (
                  <Link key={item.key} href={item.href} className={`${styles.checklistItem} ${item.done ? styles.checklistDone : ''}`}>
                    <div className={styles.checklistIcon}><Icon size={18} /></div>
                    <div className={styles.checklistBody}>
                      <strong>{item.label}</strong>
                      <span>{item.desc}</span>
                      <em>{item.done ? 'Complete' : item.action}</em>
                    </div>
                  </Link>
                );
              })}

              <Link href={`${base}/settings/branding`} className={`${styles.checklistNudge} ${checklist.hasBranding ? styles.nudgeDone : ''}`}>
                <div className={styles.checklistIcon}>
                  {checklist.hasBranding ? <CheckCircle2 size={18} /> : <Info size={18} />}
                </div>
                <div className={styles.checklistBody}>
                  <strong style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    Public site & branding
                    <span className={styles.nudgeTag}>Optional</span>
                  </strong>
                  <span>
                    {checklist.hasBranding
                      ? 'Logo, banner, or color theme configured for this tournament.'
                      : 'Set a logo, banner, and color theme for your public tournament page.'}
                  </span>
                  <em style={{ color: checklist.hasBranding ? 'var(--logic-lime)' : 'var(--data-gray)' }}>
                    {checklist.hasBranding ? 'Customized' : 'Customize branding →'}
                  </em>
                </div>
              </Link>
            </div>

            <div className={styles.checklistFooter}>
              <span>
                {checklist.ready
                  ? 'Everything required by the activation rules is ready.'
                  : 'Activation will stay blocked until every required item is complete.'}
              </span>
              <Link href={`${base}/manage`} className="btn btn-primary btn-sm">
                Activate when ready
              </Link>
            </div>
          </section>

          {/* Setup quick links */}
          <div className={styles.setupLinks}>
            {setupLinks.map(link => (
              <Link key={link.label} href={link.href} className={styles.setupLink}>
                <div className={styles.setupLinkIcon}><link.icon size={15} /></div>
                <div className={styles.setupLinkBody}>
                  <strong>{link.label}</strong>
                  <span>{link.desc}</span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      {/* ── LIVE DASHBOARD (active) ──────────────────────── */}
      {isActive && currentTournament?.id && (
        <>
          <div className={styles.statsGrid}>
            {liveCards.map(card => (
              <Link key={card.label} href={`${base}/${card.key}`} className={`card ${styles.statCard}`} id={`dashboard-${card.label.toLowerCase().replace(/\s/g, '-')}`}>
                <div className={styles.statIcon}><card.icon size={22} /></div>
                <div>
                  <div className={styles.statNum}>{card.value}</div>
                  <div className={styles.statLabel}>{card.label}</div>
                </div>
              </Link>
            ))}
          </div>

          <div className={styles.analyticsGrid}>
            {/* Registration panel */}
            <section className={styles.analyticsPanel}>
              <div className={styles.panelHeader}>
                <Users size={16} style={{ color: 'var(--logic-lime)' }} />
                <h2 className={styles.sectionTitle} style={{ margin: 0 }}>Registration</h2>
                <Link href={`${base}/teams`} className={styles.panelLink}>View teams →</Link>
              </div>
              {reg.totalCapacity > 0 ? (
                <div className={styles.mainGauge}>
                  <div className={styles.gaugeFigures}>
                    <span className={styles.gaugeMain}>{reg.totalAccepted}</span>
                    <span className={styles.gaugeOf}>/ {reg.totalCapacity}</span>
                    <span className={styles.gaugeLabel}>accepted</span>
                  </div>
                  <GaugeBar value={reg.totalAccepted} max={reg.totalCapacity} />
                </div>
              ) : (
                <div className={styles.mainGauge}>
                  <span className={styles.gaugeMain}>{reg.totalAccepted}</span>
                  <span className={styles.gaugeLabel}>teams accepted (no capacity set)</span>
                </div>
              )}
              {(reg.totalPending > 0 || reg.totalWaitlist > 0) && (
                <div className={styles.subStats}>
                  {reg.totalPending  > 0 && <span className={styles.subStat}><span className="badge badge-warning">{reg.totalPending}</span> Pending</span>}
                  {reg.totalWaitlist > 0 && <span className={styles.subStat}><span className="badge badge-neutral">{reg.totalWaitlist}</span> Waitlist</span>}
                </div>
              )}
              {reg.byDivision.length > 1 && (
                <div className={styles.divisionTable}>
                  {reg.byDivision.map(d => (
                    <div key={d.id} className={styles.divisionRow}>
                      <span className={styles.divisionName}>{d.name}</span>
                      <span className={styles.divisionCount}>{d.accepted}{d.capacity ? `/${d.capacity}` : ''}</span>
                      {d.capacity && <GaugeBar value={d.accepted} max={d.capacity} danger={d.accepted >= d.capacity} />}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Payment panel */}
            <section className={styles.analyticsPanel}>
              <div className={styles.panelHeader}>
                <DollarSign size={16} style={{ color: 'var(--logic-lime)' }} />
                <h2 className={styles.sectionTitle} style={{ margin: 0 }}>Payments</h2>
                <Link href={`${base}/teams`} className={styles.panelLink}>View teams →</Link>
              </div>
              {pay.hasFeeSchedule ? (
                <>
                  <div className={styles.mainGauge}>
                    <div className={styles.gaugeFigures}>
                      <span className={styles.gaugeMain}>{fmt(pay.totalCollected)}</span>
                      <span className={styles.gaugeOf}>/ {fmt(pay.totalExpected)}</span>
                      <span className={styles.gaugeLabel}>collected</span>
                    </div>
                    <GaugeBar value={pay.totalCollected} max={pay.totalExpected} />
                  </div>
                  {(pay.totalExpected - pay.totalCollected) > 0 && (
                    <div className={styles.outstandingRow}>
                      <TrendingUp size={13} style={{ color: '#f6c453' }} />
                      <span>{fmt(pay.totalExpected - pay.totalCollected)} outstanding</span>
                    </div>
                  )}
                  <div className={styles.paymentBreakdown}>
                    {pay.counts.paid        > 0 && <div className={styles.payRow}><span className="badge badge-success">{pay.counts.paid}</span><span>Paid in full</span></div>}
                    {pay.counts.depositPaid > 0 && <div className={styles.payRow}><span className="badge badge-primary">{pay.counts.depositPaid}</span><span>Deposit paid</span></div>}
                    {pay.counts.pending     > 0 && <div className={styles.payRow}><span className="badge badge-warning">{pay.counts.pending}</span><span>Pending</span></div>}
                    {pay.counts.pastDue     > 0 && <div className={styles.payRow}><span className="badge badge-danger">{pay.counts.pastDue}</span><span>Past due</span></div>}
                  </div>
                </>
              ) : (
                <div className={styles.emptyPanel}>
                  <span>No fee schedule configured.</span>
                  <Link href={`${base}/manage`} className={styles.panelLink}>Set up fees →</Link>
                </div>
              )}
            </section>
          </div>

          <div className={styles.recentEvents}>
            <h2 className={styles.sectionTitle}>Recent Activity</h2>
            <LiveEventLog tournamentId={currentTournament.id} />
          </div>
        </>
      )}

      {/* ── COMPLETED DASHBOARD ──────────────────────────── */}
      {isCompleted && currentTournament?.id && (
        <>
          <div className={styles.statsGrid}>
            {liveCards.map(card => (
              <Link key={card.label} href={`${base}/${card.key}`} className={`card ${styles.statCard}`} id={`dashboard-${card.label.toLowerCase().replace(/\s/g, '-')}`}>
                <div className={styles.statIcon}><card.icon size={22} /></div>
                <div>
                  <div className={styles.statNum}>{card.value}</div>
                  <div className={styles.statLabel}>{card.label}</div>
                </div>
              </Link>
            ))}
          </div>

          <div className={styles.analyticsGrid}>
            <section className={styles.analyticsPanel}>
              <div className={styles.panelHeader}>
                <Users size={16} style={{ color: 'var(--logic-lime)' }} />
                <h2 className={styles.sectionTitle} style={{ margin: 0 }}>Final Registration</h2>
                <Link href={`${base}/teams`} className={styles.panelLink}>View teams →</Link>
              </div>
              <div className={styles.mainGauge}>
                <div className={styles.gaugeFigures}>
                  <span className={styles.gaugeMain}>{reg.totalAccepted}</span>
                  {reg.totalCapacity > 0 && <><span className={styles.gaugeOf}>/ {reg.totalCapacity}</span></>}
                  <span className={styles.gaugeLabel}>teams</span>
                </div>
                {reg.totalCapacity > 0 && <GaugeBar value={reg.totalAccepted} max={reg.totalCapacity} />}
              </div>
              {reg.byDivision.length > 1 && (
                <div className={styles.divisionTable}>
                  {reg.byDivision.map(d => (
                    <div key={d.id} className={styles.divisionRow}>
                      <span className={styles.divisionName}>{d.name}</span>
                      <span className={styles.divisionCount}>{d.accepted}{d.capacity ? `/${d.capacity}` : ''}</span>
                      {d.capacity && <GaugeBar value={d.accepted} max={d.capacity} danger={false} />}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className={styles.analyticsPanel}>
              <div className={styles.panelHeader}>
                <DollarSign size={16} style={{ color: '#f6c453' }} />
                <h2 className={styles.sectionTitle} style={{ margin: 0 }}>Final Payments</h2>
                <Link href={`${base}/teams`} className={styles.panelLink}>View teams →</Link>
              </div>
              {pay.hasFeeSchedule ? (
                <>
                  <div className={styles.mainGauge}>
                    <div className={styles.gaugeFigures}>
                      <span className={styles.gaugeMain}>{fmt(pay.totalCollected)}</span>
                      <span className={styles.gaugeOf}>/ {fmt(pay.totalExpected)}</span>
                      <span className={styles.gaugeLabel}>collected</span>
                    </div>
                    <GaugeBar value={pay.totalCollected} max={pay.totalExpected} />
                  </div>
                  {(pay.totalExpected - pay.totalCollected) > 0 && (
                    <div className={styles.outstandingRow}>
                      <TrendingUp size={13} style={{ color: '#f6c453' }} />
                      <span>{fmt(pay.totalExpected - pay.totalCollected)} still outstanding</span>
                    </div>
                  )}
                </>
              ) : (
                <div className={styles.emptyPanel}><span>No fee schedule was configured.</span></div>
              )}
            </section>
          </div>

          {/* Wrap-up summary card */}
          <div className={styles.wrapUpCard}>
            <div className={styles.wrapUpIcon}><Trophy size={22} /></div>
            <div className={styles.wrapUpBody}>
              <h2>Tournament Complete</h2>
              <p>
                {visibleStats.teams} team{visibleStats.teams !== 1 ? 's' : ''} registered
                {visibleStats.completed > 0 ? ` · ${visibleStats.completed} games completed` : ''}
                {pay.hasFeeSchedule && pay.totalExpected > 0 ? ` · ${fmt(pay.totalCollected)} collected` : ''}
              </p>
            </div>
            <Link href={`${base}/results`} className={styles.panelLink} style={{ flexShrink: 0 }}>
              View results →
            </Link>
          </div>
        </>
      )}

      {/* ── ARCHIVED ────────────────────────────────────── */}
      {status === 'archived' && (
        <div style={{ padding: '2rem 0', color: 'var(--data-gray)', fontSize: '0.85rem' }}>
          This tournament is archived. View historical results in{' '}
          <Link href={`${base}/archives`} style={{ color: 'var(--blueprint-blue)' }}>Past Tournaments</Link>.
        </div>
      )}
    </div>
  );
}
