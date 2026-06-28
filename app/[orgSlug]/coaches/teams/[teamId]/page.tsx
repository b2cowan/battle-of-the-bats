'use client';
import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useCoaches } from '@/lib/coaches-context';
import { useOrg } from '@/lib/org-context';
import { ArrowRight, Building2, Calendar, CheckCircle2, Circle, DollarSign, MinusCircle, Users } from 'lucide-react';
import UpgradeSummaryBanner from '@/components/coaches/UpgradeSummaryBanner';
import HelpButton from '@/components/help/HelpButton';
import HelpTooltip from '@/components/help/HelpTooltip';
import { useHelpDrawer } from '@/components/help/help-drawer-context';
import { getCoachGuidance } from '@/lib/coach-guidance';
import styles from '../../coaches.module.css';
import type { RepRosterPlayer, RepTeamEvent } from '@/lib/types';

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  active: 'Active',
  completed: 'Completed',
  archived: 'Archived',
};

const STATUS_CSS: Record<string, string> = {
  draft: styles.badgeDraft,
  active: styles.badgeActive,
  completed: styles.badgeCompleted,
  archived: styles.badgeArchived,
};

interface SetupStats {
  activeRosterCount: number;
  positionedRosterCount: number;
  eventCount: number;
  gameCount: number;
  budgetSet: boolean;
}

interface SetupItem {
  /** Stable id used for skip persistence. */
  key: string;
  label: string;
  /** Live status line shown once complete (e.g. "5 active players"). */
  detail: string;
  /** What/why one-liner shown while the step is still open. */
  desc: string;
  /** Verb shown on the right while the step is open (e.g. "Add players"). */
  action: string;
  href: string;
  complete: boolean;
  /** 'core' counts toward setup %; 'optional' sits in its own group, no nag. */
  group: 'core' | 'optional';
  help: { title: string; body: string };
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function formatEventDate(value: string): string {
  return new Date(value).toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatMoney(amount: number): string {
  return amount.toLocaleString('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 });
}

export default function TeamOverviewPage({
  params,
}: {
  params: Promise<{ orgSlug: string; teamId: string }>;
}) {
  const { orgSlug, teamId } = use(params);
  const { assignments, loading } = useCoaches();
  const { currentOrg } = useOrg();
  const { openHelp } = useHelpDrawer();
  const base = `/${orgSlug}/coaches/teams/${teamId}`;
  const [setupStats, setSetupStats] = useState<SetupStats | null>(null);
  const [setupLoading, setSetupLoading] = useState(true);
  const [setupError, setSetupError] = useState('');
  const [teamDivision, setTeamDivision] = useState<string | null>(null);
  // Run-mode snapshot ("Your team at a glance")
  const [nextEvent, setNextEvent] = useState<RepTeamEvent | null>(null);
  const [duesOutstanding, setDuesOutstanding] = useState<number | null>(null);
  const [duesOverdueCount, setDuesOverdueCount] = useState(0);
  // Paid vs total dues installments → the Dues snapshot mini-gauge.
  const [duesProgress, setDuesProgress] = useState<{ paid: number; total: number } | null>(null);
  // Optional setup steps the coach has chosen to skip (per-team, remembered locally).
  const [skippedSteps, setSkippedSteps] = useState<Set<string>>(new Set());
  // Contextual org-invite banner (only when an org has actually invited this team)
  const [orgInvite, setOrgInvite] = useState<{ orgName: string } | null>(null);

  const loadSetup = useCallback(async () => {
    setSetupLoading(true);
    setSetupError('');
    try {
      const [rosterRes, eventsRes, budgetRes, duesRes] = await Promise.all([
        fetch(`/api/coaches/${orgSlug}/teams/${teamId}/roster`),
        fetch(`/api/coaches/${orgSlug}/teams/${teamId}/events`),
        fetch(`/api/coaches/${orgSlug}/teams/${teamId}/budget`),
        fetch(`/api/coaches/${orgSlug}/teams/${teamId}/dues`),
      ]);

      if (!rosterRes.ok || !eventsRes.ok || !budgetRes.ok) {
        throw new Error('Setup status could not be loaded');
      }

      const rosterData: { players?: RepRosterPlayer[] } = await rosterRes.json();
      const eventsData: { events?: RepTeamEvent[] } = await eventsRes.json();
      const budgetData: { budgetAmount?: number | null } = await budgetRes.json();
      const activePlayers = (rosterData.players ?? []).filter(player => player.status === 'active');
      const events = eventsData.events ?? [];
      const games = events.filter(event => ['league_game', 'tournament_game', 'scrimmage'].includes(event.eventType));

      setSetupStats({
        activeRosterCount: activePlayers.length,
        positionedRosterCount: activePlayers.filter(player => (
          Boolean(player.playerNumber) && (Boolean(player.primaryPosition) || Boolean(player.secondaryPosition))
        )).length,
        eventCount: events.length,
        gameCount: games.length,
        budgetSet: budgetData.budgetAmount != null,
      });

      // Next upcoming event for the snapshot
      const now = Date.now();
      const upcoming = events
        .filter(e => e.status === 'scheduled' && new Date(e.startsAt).getTime() >= now)
        .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
      setNextEvent(upcoming[0] ?? null);

      // Dues outstanding + overdue count (best-effort — dues failure never breaks the page)
      if (duesRes.ok) {
        const duesData: { players?: Array<{ outstanding?: number; installments?: Array<{ paidAt: string | null; dueDate: string }> }> } = await duesRes.json();
        const players = duesData.players ?? [];
        const totalOutstanding = players.reduce((s, p) => s + (p.outstanding ?? 0), 0);
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const overdue = players.reduce((n, p) => n + (p.installments ?? []).filter(i => !i.paidAt && new Date(`${i.dueDate}T00:00:00`) < today).length, 0);
        let paidInst = 0; let totalInst = 0;
        players.forEach(p => (p.installments ?? []).forEach(i => { totalInst += 1; if (i.paidAt) paidInst += 1; }));
        setDuesOutstanding(Math.round(totalOutstanding * 100) / 100);
        setDuesOverdueCount(overdue);
        setDuesProgress(totalInst > 0 ? { paid: paidInst, total: totalInst } : null);
      } else {
        setDuesOutstanding(null);
        setDuesProgress(null);
        // Reset the overdue count too, else a prior success could leave the Dues card
        // tinted danger ("—" in red) after a later dues-only fetch failure.
        setDuesOverdueCount(0);
      }
    } catch (error: unknown) {
      setSetupError(errorMessage(error, 'Setup status could not be loaded'));
    } finally {
      setSetupLoading(false);
    }
  }, [orgSlug, teamId]);

  useEffect(() => {
    if (!loading) void Promise.resolve().then(loadSetup);
  }, [loading, loadSetup]);

  // Hydrate skipped optional steps (per team). Best-effort — never breaks the page.
  const skipStorageKey = `coach-setup-skipped:${teamId}`;
  useEffect(() => {
    void Promise.resolve().then(() => {
      try {
        const raw = localStorage.getItem(skipStorageKey);
        if (raw) setSkippedSteps(new Set(JSON.parse(raw) as string[]));
      } catch { /* ignore */ }
    });
  }, [skipStorageKey]);

  const toggleSkip = useCallback((key: string) => {
    setSkippedSteps(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      try { localStorage.setItem(skipStorageKey, JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  }, [skipStorageKey]);

  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    fetch(`/api/coaches/${orgSlug}/teams/${teamId}`)
      .then(res => (res.ok ? res.json() : null))
      .then(json => { if (!cancelled && json?.team) setTeamDivision(json.team.division ?? null); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [loading, orgSlug, teamId]);

  // Org-invite banner — show only when an organization has actually invited this team
  // to connect (org-initiated). Self-serve linking lives quietly in Settings otherwise.
  const isWorkspaceOrg = currentOrg?.accountKind === 'team_workspace' || currentOrg?.planId === 'team';
  useEffect(() => {
    if (loading || !isWorkspaceOrg) return;
    let cancelled = false;
    fetch(`/api/coaches/${orgSlug}/team-links`, { cache: 'no-store' })
      .then(res => (res.ok ? res.json() : null))
      .then(json => {
        if (cancelled || !json?.links) return;
        const invited = (json.links as Array<{ status: string; linkedOrg?: { name?: string } | null }>).find(l => l.status === 'invited');
        if (invited) setOrgInvite({ orgName: invited.linkedOrg?.name ?? 'An organization' });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [loading, isWorkspaceOrg, orgSlug]);

  if (loading) return <p className={styles.muted}>Loading...</p>;

  const assignment = assignments.find(a => a.teamId === teamId);

  if (!assignment) {
    return (
      <div className={styles.notAssigned}>
        <h2>Team not found</h2>
        <p>You are not assigned to this team.</p>
      </div>
    );
  }

  const isTeamWorkspace = currentOrg?.accountKind === 'team_workspace' || currentOrg?.planId === 'team';
  const helpHref = `/${orgSlug}/coaches/help`;
  // Required = the spine of a team (season is automatic, roster is the one true must).
  // Everything else is OPTIONAL: pointed to, auto-checks when done, skippable, and never
  // blocks reaching 100% / retiring the panel.
  const setupItems: SetupItem[] = [
    {
      key: 'season',
      label: 'Confirm season',
      detail: `${assignment.programYearName} is active`,
      desc: 'Your current season — everything below is tracked against it.',
      action: 'View',
      href: base,
      complete: true,
      group: 'core',
      help: { title: 'Season', body: 'A season groups your roster, schedule, dues, and budget for one year. When the year ends you start a new season from Settings and last year becomes read-only history.' },
    },
    {
      key: 'roster',
      label: 'Add your roster',
      detail: setupStats ? `${setupStats.activeRosterCount} active player${setupStats.activeRosterCount === 1 ? '' : 's'}` : 'Roster status',
      desc: 'Add your players — everything else (schedule, dues, lineups, announcements) builds on the roster.',
      action: 'Add players',
      href: `${base}/roster`,
      complete: (setupStats?.activeRosterCount ?? 0) > 0,
      group: 'core',
      help: { title: 'Roster', body: 'Your team list. Add each player once; you can include a jersey number, positions, and a parent/guardian contact email (needed for dues reminders and announcements).' },
    },
    {
      key: 'schedule',
      label: 'Build your schedule',
      detail: setupStats ? `${setupStats.eventCount} event${setupStats.eventCount === 1 ? '' : 's'} scheduled` : 'Schedule status',
      desc: 'Add practices, games, and team events to one calendar your whole season reads from.',
      action: 'Add events',
      href: `${base}/schedule`,
      complete: (setupStats?.eventCount ?? 0) > 0,
      group: 'optional',
      help: { title: 'Schedule', body: 'One calendar for practices, games, and events. On Premium you can set repeating events and sync the calendar to your phone. Games here are what you take attendance and set lineups on.' },
    },
    {
      key: 'positions',
      label: 'Add jerseys & positions',
      detail: setupStats ? `${setupStats.positionedRosterCount} of ${setupStats.activeRosterCount} player${setupStats.activeRosterCount === 1 ? '' : 's'} set up` : 'Roster details',
      desc: 'Add jersey numbers and field positions so lineups and game sheets fill in automatically.',
      action: 'Add details',
      href: `${base}/roster`,
      complete: Boolean(setupStats && setupStats.activeRosterCount > 0 && setupStats.positionedRosterCount === setupStats.activeRosterCount),
      group: 'optional',
      help: { title: 'Jerseys & positions', body: 'A jersey number and one or two positions per player. They flow into your game-day lineups and batting order so you are not retyping them each game.' },
    },
    {
      key: 'lineups',
      label: 'Prepare game lineups',
      detail: setupStats ? `${setupStats.gameCount} game${setupStats.gameCount === 1 ? '' : 's'} or scrimmage${setupStats.gameCount === 1 ? '' : 's'}` : 'Game status',
      desc: 'Once a game is on the calendar, set the batting order and field positions before game day.',
      action: 'Add a game',
      href: `${base}/schedule`,
      complete: (setupStats?.gameCount ?? 0) > 0,
      group: 'optional',
      help: { title: 'Game lineups', body: 'Open a game from the Schedule to set the batting order and positions per inning, then print or share the lineup card. Needs at least one game on the calendar first.' },
    },
    {
      key: 'budget',
      label: 'Set a budget',
      detail: setupStats?.budgetSet ? 'Budget is set' : 'No budget yet',
      desc: 'Set a season budget and dues to track who has paid and send automatic reminders.',
      action: 'Set budget',
      href: `${base}/accounting`,
      complete: Boolean(setupStats?.budgetSet),
      group: 'optional',
      help: { title: 'Budget & dues', body: 'Plan your season costs, charge dues per player (one-off or installments), and track payments. Premium can email overdue reminders automatically.' },
    },
  ];
  const coreItems = setupItems.filter(item => item.group === 'core');
  const optionalItems = setupItems.filter(item => item.group === 'optional');
  // A step counts toward the status bar when it's done OR (for optional steps) skipped —
  // so the bar reflects EVERY setup decision, and skipping a step "checks it off".
  const isSkipped = (item: SetupItem) => item.group === 'optional' && !item.complete && skippedSteps.has(item.key);
  const isSatisfied = (item: SetupItem) => item.complete || isSkipped(item);
  const satisfiedCount = setupItems.filter(isSatisfied).length;
  const totalCount = setupItems.length;
  // Required (roster) gates "you're ready"; the panel itself retires only once EVERY
  // step is done-or-skipped, so the coach explicitly clears each optional step.
  const requiredDone = coreItems.every(item => item.complete);
  const allSatisfied = setupItems.every(isSatisfied);
  const showSetupPanel = !allSatisfied;

  // While the roster is missing, lead with the "build your roster" guidance; after that
  // the remaining items are all optional, so the header just labels them as such.
  const guidance = getCoachGuidance('roster', { base, helpHref });

  // Snapshot ("Your team at a glance") cards — real data, link into each section.
  // While the first load is in flight, show a neutral "…" rather than flashing a
  // misleading "Nothing scheduled" / "—" before the data arrives.
  const snapshotCards = [
    {
      key: 'roster',
      label: 'Roster',
      icon: Users,
      value: setupLoading ? '…' : String(setupStats?.activeRosterCount ?? 0),
      sub: 'active players',
      href: `${base}/roster`,
      tone: 'default' as const,
      // Jersey + position readiness across the active roster.
      progress: (!setupLoading && setupStats && setupStats.activeRosterCount > 0)
        ? {
            value: setupStats.positionedRosterCount,
            total: setupStats.activeRosterCount,
            label: `${setupStats.positionedRosterCount}/${setupStats.activeRosterCount}`,
            title: `${setupStats.positionedRosterCount} of ${setupStats.activeRosterCount} players have a jersey number and position`,
            tone: 'default' as 'default' | 'danger',
          }
        : null,
    },
    {
      key: 'schedule',
      label: 'Next up',
      icon: Calendar,
      value: setupLoading ? '…' : nextEvent ? formatEventDate(nextEvent.startsAt) : 'Nothing scheduled',
      sub: nextEvent ? (nextEvent.opponent ? `vs ${nextEvent.opponent}` : (nextEvent.name || 'Upcoming event')) : 'Add an event',
      href: `${base}/schedule`,
      tone: 'default' as const,
      progress: null,
    },
    {
      key: 'dues',
      label: 'Dues',
      icon: DollarSign,
      value: setupLoading ? '…' : duesOutstanding == null ? '—' : duesOutstanding > 0 ? formatMoney(duesOutstanding) : 'All paid',
      sub: duesOutstanding == null
        ? 'Set up dues'
        : duesOverdueCount > 0
          ? `${duesOverdueCount} overdue`
          : duesOutstanding > 0 ? 'outstanding' : 'nothing owed',
      href: `${base}/accounting`,
      tone: (duesOverdueCount > 0 ? 'danger' : 'default') as 'default' | 'danger',
      // Paid vs total installments collected this season.
      progress: (!setupLoading && duesProgress)
        ? {
            value: duesProgress.paid,
            total: duesProgress.total,
            label: `${duesProgress.paid}/${duesProgress.total} paid`,
            title: `${duesProgress.paid} of ${duesProgress.total} dues installments paid`,
            tone: (duesOverdueCount > 0 ? 'danger' : 'default') as 'default' | 'danger',
          }
        : null,
    },
  ];

  const renderSetupRow = (item: SetupItem) => {
    const skipped = isSkipped(item);
    const Icon = item.complete ? CheckCircle2 : skipped ? MinusCircle : Circle;
    const descText = setupLoading
      ? 'Checking…'
      : item.complete
        ? item.detail
        : skipped
          ? 'Skipped — you can set this up anytime.'
          : item.desc;
    return (
      <div
        key={item.key}
        className={styles.setupItem}
        data-complete={item.complete ? 'true' : 'false'}
        data-skipped={skipped ? 'true' : 'false'}
      >
        <Icon size={16} className={item.complete ? styles.setupIconDone : styles.setupIconTodo} />
        <span className={styles.setupItemText}>
          <span className={styles.setupItemHead}>
            <Link href={item.href} className={styles.setupItemLabel}>{item.label}</Link>
            <HelpTooltip title={item.help.title} body={item.help.body} />
          </span>
          <span className={styles.setupItemDesc}>{descText}</span>
        </span>
        {item.complete ? (
          <span className={styles.setupItemDone}>Done</span>
        ) : item.group === 'optional' ? (
          skipped ? (
            <button type="button" className={styles.setupItemSkipUndo} onClick={() => toggleSkip(item.key)}>
              Skipped · Undo
            </button>
          ) : (
            <span className={styles.setupItemOptActions}>
              <Link href={item.href} className={styles.setupItemAction}>{item.action} →</Link>
              <button type="button" className={styles.setupItemSkip} onClick={() => toggleSkip(item.key)}>Skip</button>
            </span>
          )
        ) : (
          <Link href={item.href} className={styles.setupItemAction}>{item.action} →</Link>
        )}
      </div>
    );
  };

  return (
    <div className={styles.page}>
      <UpgradeSummaryBanner orgSlug={orgSlug} teamId={teamId} />

      {/* Contextual org invitation — only when an org actually invited this team */}
      {orgInvite && (
        <div className={styles.orgInviteBanner} role="status">
          <Building2 size={18} className={styles.orgInviteIcon} aria-hidden />
          <div className={styles.orgInviteText}>
            <p className={styles.orgInviteTitle}>{orgInvite.orgName} invited your team to connect</p>
            <p className={styles.orgInviteBody}>Review the invitation to join their organization, or keep running independently.</p>
          </div>
          <Link href={`/${orgSlug}/coaches/link-org`} className="btn btn-lime btn-sm">Review invite</Link>
        </div>
      )}

      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <h1 className={styles.pageTitle}>{assignment.teamName}</h1>
              {isTeamWorkspace && <span className={styles.titlePremiumBadge}>Premium</span>}
              <span className={`${styles.badge} ${STATUS_CSS[assignment.programYearStatus] ?? styles.badgeDraft}`}>
                {STATUS_LABEL[assignment.programYearStatus] ?? assignment.programYearStatus}
              </span>
              {teamDivision && (
                <span className={`${styles.badge} ${styles.badgeManual}`}>{teamDivision}</span>
              )}
            </div>
            <p className={styles.pageSub}>
              {assignment.programYearName} -{' '}
              {assignment.coachRole === 'head_coach' ? 'Head Coach' : 'Assistant Coach'}
            </p>
          </div>
        </div>
        <div className={styles.identityHelp}>
          <HelpButton
            iconOnly
            label="Coaches Portal Premium"
            help={{ module: 'coaches', sectionIds: ['premium-portal-tour', 'premium'], fullGuideHref: `${helpHref}#premium-portal-tour` }}
          />
        </div>
      </div>

      {/* Get set up — the status bar tracks EVERY step (required + optional); a step is
          "checked off" when it's done OR skipped, so the bar reads 100% only once the coach
          has decided on each. The panel retires at 100% (page flips to run-mode). */}
      {showSetupPanel && (
        <section className={styles.setupPanel} aria-labelledby="season-setup-title">
          <div className={styles.setupHeader}>
            <div>
              <p className={styles.setupKicker}>Get set up · {satisfiedCount} of {totalCount}</p>
              <h2 id="season-setup-title" className={styles.setupTitle}>
                {requiredDone ? 'Finish your setup' : guidance.headline}
              </h2>
            </div>
            <span className={styles.setupProgress}>{Math.round((satisfiedCount / totalCount) * 100)}%</span>
          </div>
          <div
            className={styles.setupSegments}
            role="img"
            aria-label={`${satisfiedCount} of ${totalCount} setup steps done or skipped`}
          >
            {setupItems.map(item => (
              <span
                key={item.key}
                className={`${styles.setupSegment} ${item.complete ? styles.setupSegmentDone : isSkipped(item) ? styles.setupSegmentSkipped : ''}`}
              />
            ))}
          </div>
          <p className={styles.setupNext}>
            {requiredDone
              ? "Your team is ready to run. Tick off or skip each optional step below — skipping counts, so you can clear setup with the tools you'll actually use."
              : guidance.context}
          </p>
          {!requiredDone && guidance.cta && (
            <Link href={guidance.cta.href} className={`btn btn-lime btn-sm ${styles.setupNextCta}`}>
              {guidance.cta.label} <ArrowRight size={14} />
            </Link>
          )}
          {setupError && <p className={styles.errorText}>{setupError}</p>}

          {/* Required steps — hidden once complete so the panel focuses on what's left */}
          {!requiredDone && (
            <div className={styles.setupList}>
              {coreItems.map(renderSetupRow)}
            </div>
          )}

          {/* Optional steps — pointed to, auto-checked when done, or skip to check off */}
          {optionalItems.length > 0 && (
            <>
              <p className={styles.setupGroupLabel}>Optional — set up or skip</p>
              <div className={styles.setupList}>
                {optionalItems.map(renderSetupRow)}
              </div>
            </>
          )}

          <p className={styles.setupGuideFooter}>
            <button type="button" className={styles.setupGuideLink} onClick={() => openHelp({ module: 'coaches', sectionIds: ['premium-portal-tour', 'premium'], label: 'Setup guide', fullGuideHref: `${helpHref}#premium-portal-tour` })}>
              Open the setup guide →
            </button>
          </p>
        </section>
      )}

      {/* Your team at a glance — run-mode snapshot of real data (replaces the old
          quick-links grid, which just duplicated the sidebar). */}
      <section aria-labelledby="snapshot-title">
        <p className={styles.sectionKicker} id="snapshot-title">Your team at a glance</p>
        <div className={styles.snapshotGrid}>
          {snapshotCards.map(card => {
            const Icon = card.icon;
            return (
              <Link key={card.key} href={card.href} className={styles.snapshotCard}>
                <span className={styles.snapshotHead}><Icon size={14} aria-hidden /> {card.label}</span>
                <span className={styles.snapshotValue} data-tone={card.tone}>{card.value}</span>
                <span className={styles.snapshotSub}>{card.sub}</span>
                {card.progress && (
                  <span className={styles.snapshotBar} title={card.progress.title}>
                    <span className={styles.snapshotBarTrack}>
                      <span
                        className={styles.snapshotBarFill}
                        data-tone={card.progress.tone}
                        style={{ width: `${card.progress.total > 0 ? Math.round((card.progress.value / card.progress.total) * 100) : 0}%` }}
                      />
                    </span>
                    <span className={styles.snapshotBarPct}>{card.progress.label}</span>
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
