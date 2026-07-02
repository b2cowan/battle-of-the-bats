'use client';
import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useCoaches } from '@/lib/coaches-context';
import { useOrg } from '@/lib/org-context';
import { ArrowRight, Building2, Cake, Calendar, CheckCircle2, Circle, DollarSign, MinusCircle, Trophy, Users, Wallet } from 'lucide-react';
import UpgradeSummaryBanner from '@/components/coaches/UpgradeSummaryBanner';
import SeasonRecordWidget from '@/components/coaches/SeasonRecordWidget';
import HelpButton from '@/components/help/HelpButton';
import HelpTooltip from '@/components/help/HelpTooltip';
import { useHelpDrawer } from '@/components/help/help-drawer-context';
import { getCoachGuidance } from '@/lib/coach-guidance';
import styles from '../../coaches.module.css';
import type { RepRosterPlayer, RepTeamEvent } from '@/lib/types';

const GAME_EVENT_TYPES = ['league_game', 'tournament_game', 'scrimmage'];

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
  // Whole days until the next event (computed at load; null when nothing upcoming) → stat strip.
  const [nextEventDays, setNextEventDays] = useState<number | null>(null);
  const [seasonGames, setSeasonGames] = useState<RepTeamEvent[]>([]);
  // Events in the next 7 days (grouped) for the "This week" line.
  const [weekSummary, setWeekSummary] = useState<{ practices: number; games: number; other: number; total: number } | null>(null);
  // Active players with no guardian email (blocks dues reminders + announcements) → Roster nudge.
  const [missingEmailCount, setMissingEmailCount] = useState(0);
  // Whether the next game already has a lineup set → Next-up tile flag (null = unknown / not a game).
  const [nextLineupReady, setNextLineupReady] = useState<boolean | null>(null);
  const [duesOutstanding, setDuesOutstanding] = useState<number | null>(null);
  const [duesOverdueCount, setDuesOverdueCount] = useState(0);
  // Paid vs total dues installments → the Dues snapshot mini-gauge.
  const [duesProgress, setDuesProgress] = useState<{ paid: number; total: number } | null>(null);
  // Season budget vs actual spend → Budget tile.
  const [budget, setBudget] = useState<{ amount: number | null; spent: number } | null>(null);
  // Player birthdays in the next 7 days → a small "this week" touch.
  const [birthdays, setBirthdays] = useState<{ name: string; inDays: number }[]>([]);
  // In/Late/Out/No-reply headcount for the next event → Next-up tile.
  const [nextAttendance, setNextAttendance] = useState<{ in: number; late: number; out: number; noReply: number } | null>(null);
  // Tournament registrations summary → Tournaments tile.
  const [tournaments, setTournaments] = useState<{ count: number; pending: number; nextDate: string | null; liveNow: boolean; owed: number; owingCount: number } | null>(null);
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
      const budgetData: { budgetAmount?: number | null; totalExpenses?: number } = await budgetRes.json();
      const activePlayers = (rosterData.players ?? []).filter(player => player.status === 'active');
      const events = eventsData.events ?? [];
      const games = events.filter(event => GAME_EVENT_TYPES.includes(event.eventType));
      setSeasonGames(games);
      setMissingEmailCount(activePlayers.filter(p => !p.guardianEmail?.trim()).length);

      setSetupStats({
        activeRosterCount: activePlayers.length,
        positionedRosterCount: activePlayers.filter(player => (
          Boolean(player.playerNumber) && (Boolean(player.primaryPosition) || Boolean(player.secondaryPosition))
        )).length,
        eventCount: events.length,
        gameCount: games.length,
        budgetSet: budgetData.budgetAmount != null,
      });
      setBudget({ amount: budgetData.budgetAmount ?? null, spent: budgetData.totalExpenses ?? 0 });

      // Next upcoming event for the snapshot
      const now = Date.now();
      const upcoming = events
        .filter(e => e.status === 'scheduled' && new Date(e.startsAt).getTime() >= now)
        .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
      const nextUp = upcoming[0] ?? null;
      setNextEvent(nextUp);
      setNextEventDays(nextUp ? Math.max(0, Math.ceil((new Date(nextUp.startsAt).getTime() - now) / 86400000)) : null);

      // Events in the next 7 days, grouped for the "This week" line.
      const weekAhead = now + 7 * 86400000;
      const thisWeek = events.filter(e => {
        const t = new Date(e.startsAt).getTime();
        return e.status === 'scheduled' && t >= now && t <= weekAhead;
      });
      const wkGames = thisWeek.filter(e => GAME_EVENT_TYPES.includes(e.eventType)).length;
      const wkPractices = thisWeek.filter(e => e.eventType === 'practice').length;
      setWeekSummary({ games: wkGames, practices: wkPractices, other: thisWeek.length - wkGames - wkPractices, total: thisWeek.length });

      // Player birthdays in the next 7 days (active roster).
      const today0 = new Date(); today0.setHours(0, 0, 0, 0);
      const upcomingBdays = activePlayers
        .map(p => {
          const dob = p.playerDateOfBirth;
          if (!dob) return null;
          const d = new Date(`${dob}T00:00:00`);
          if (Number.isNaN(d.getTime())) return null;
          const next = new Date(today0.getFullYear(), d.getMonth(), d.getDate());
          if (next.getTime() < today0.getTime()) next.setFullYear(today0.getFullYear() + 1);
          const inDays = Math.round((next.getTime() - today0.getTime()) / 86400000);
          return inDays >= 0 && inDays <= 7 ? { name: (p.playerFirstName || 'Player').trim(), inDays } : null;
        })
        .filter((b): b is { name: string; inDays: number } => b !== null)
        .sort((a, b) => a.inDays - b.inDays);
      setBirthdays(upcomingBdays);

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

  // Next-game lineup readiness for the "Next up" tile — only when the next event is a game.
  // "Ready" = at least one player has a position assigned in the saved lineup.
  useEffect(() => {
    setNextLineupReady(null);
    if (!nextEvent || !GAME_EVENT_TYPES.includes(nextEvent.eventType)) return;
    let cancelled = false;
    fetch(`/api/coaches/${orgSlug}/teams/${teamId}/events/${nextEvent.id}/lineup`)
      .then(res => (res.ok ? res.json() : null))
      .then(json => {
        if (cancelled || !json) return;
        const entries = (json.entries ?? []) as { inningPositions?: Record<string, string> }[];
        setNextLineupReady(entries.some(e => Object.values(e.inningPositions ?? {}).some(Boolean)));
      })
      .catch(() => {});
    return () => { cancelled = true; };
    // Keyed on the event's id/type (not the object identity) so a fresh loadSetup doesn't re-fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgSlug, teamId, nextEvent?.id, nextEvent?.eventType]);

  // In/Late/Out/No-reply headcount for the next event → shown on the Next-up tile (once the coach
  // has marked at least one player). Active players with no mark count as "no reply".
  useEffect(() => {
    setNextAttendance(null);
    if (!nextEvent) return;
    let cancelled = false;
    fetch(`/api/coaches/${orgSlug}/teams/${teamId}/events/${nextEvent.id}/attendance`)
      .then(res => (res.ok ? res.json() : null))
      .then(json => {
        if (cancelled || !json) return;
        const rows = (json.attendance ?? []) as { status?: string }[];
        const total = ((json.players ?? []) as unknown[]).length;
        const c = { in: 0, late: 0, out: 0, noReply: 0 };
        rows.forEach(r => {
          if (r.status === 'attending') c.in += 1;
          else if (r.status === 'late') c.late += 1;
          else if (r.status === 'absent') c.out += 1;
        });
        c.noReply = Math.max(0, total - c.in - c.late - c.out);
        setNextAttendance(c.in + c.late + c.out > 0 ? c : null);
      })
      .catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgSlug, teamId, nextEvent?.id]);

  // Tournament registrations summary (count, next date, pending, live today) → Tournaments tile.
  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    fetch(`/api/coaches/${orgSlug}/teams/${teamId}/tournament-history`)
      .then(res => (res.ok ? res.json() : null))
      .then(json => {
        if (cancelled || !json) return;
        const hist = (json.history ?? []) as {
          registration: { status: string };
          tournament: { startDate: string | null; endDate: string | null } | null;
          amountDue?: number | null;
        }[];
        const todayStr = new Date().toISOString().slice(0, 10);
        let count = 0; let pending = 0; let liveNow = false; let nextDate: string | null = null;
        let owed = 0; let owingCount = 0;
        for (const h of hist) {
          count += 1;
          if (h.registration.status === 'pending') pending += 1;
          const s = h.tournament?.startDate ?? null;
          const e = h.tournament?.endDate ?? s;
          if (s && e && s <= todayStr && todayStr <= e) liveNow = true;
          if (s && (e ?? s) >= todayStr && (!nextDate || s < nextDate)) nextDate = s;
          if ((h.amountDue ?? 0) > 0) { owed += h.amountDue ?? 0; owingCount += 1; }
        }
        setTournaments({ count, pending, nextDate, liveNow, owed, owingCount });
      })
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
  // The season label drops a leading copy of the team name so the subtitle doesn't repeat the
  // title — orgs often name a program year "<Team> <Year>" (e.g. "Blue Jays 2026").
  const teamNameTrim = assignment.teamName?.trim() ?? '';
  const yearNameTrim = assignment.programYearName?.trim() ?? '';
  // Only strip when the team name is a WHOLE-WORD prefix (next char is a separator or the end),
  // so a team like "Jay" doesn't mangle a season "Jays 2026" into "s 2026".
  const afterTeam = teamNameTrim && yearNameTrim.toLowerCase().startsWith(teamNameTrim.toLowerCase())
    ? yearNameTrim.slice(teamNameTrim.length)
    : null;
  const seasonLabel = afterTeam !== null && (afterTeam === '' || /^[\s\-–—]/.test(afterTeam))
    ? (afterTeam.replace(/^[\s\-–—]+/, '').trim() || yearNameTrim)
    : yearNameTrim;
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
  // Hold the panel until the setup status is actually known — otherwise a still-loading page
  // computes "incomplete" (roster/optional default to not-done) and flashes the setup panel
  // before the live dashboard. The snapshot tiles below already show their own loading state.
  const showSetupPanel = !setupLoading && !allSatisfied;

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
      flag: (!setupLoading && missingEmailCount > 0)
        ? { text: `${missingEmailCount} missing email`, tone: 'warn' as 'ok' | 'warn' }
        : null,
      headcount: null as { in: number; late: number; out: number; noReply: number } | null,
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
      flag: (nextEvent && GAME_EVENT_TYPES.includes(nextEvent.eventType) && nextLineupReady !== null)
        ? (nextLineupReady
            ? { text: 'Lineup ready', tone: 'ok' as 'ok' | 'warn' }
            : { text: 'Lineup not set', tone: 'warn' as 'ok' | 'warn' })
        : null,
      headcount: nextAttendance,
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
      flag: null as { text: string; tone: 'ok' | 'warn' } | null,
      headcount: null as { in: number; late: number; out: number; noReply: number } | null,
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
    {
      key: 'budget',
      label: 'Budget',
      icon: Wallet,
      value: setupLoading ? '…'
        : (!budget || budget.amount == null) ? 'No budget'
          : formatMoney(budget.amount - budget.spent),
      sub: (!budget || budget.amount == null)
        ? 'Set a budget'
        : `${formatMoney(budget.spent)} of ${formatMoney(budget.amount)} spent`,
      href: `${base}/accounting/budget-vs-actual`,
      tone: (budget && budget.amount != null && budget.spent > budget.amount ? 'danger' : 'default') as 'default' | 'danger',
      flag: null as { text: string; tone: 'ok' | 'warn' } | null,
      headcount: null as { in: number; late: number; out: number; noReply: number } | null,
      // Spent vs budgeted this season.
      progress: (!setupLoading && budget && budget.amount != null && budget.amount > 0)
        ? {
            value: Math.min(budget.spent, budget.amount),
            total: budget.amount,
            label: `${Math.round((budget.spent / budget.amount) * 100)}%`,
            title: `${formatMoney(budget.spent)} spent of ${formatMoney(budget.amount)} budget`,
            tone: (budget.spent > budget.amount ? 'danger' : 'default') as 'default' | 'danger',
          }
        : null,
    },
    {
      key: 'tournaments',
      label: 'Tournaments',
      icon: Trophy,
      value: tournaments == null ? '…'
        : tournaments.liveNow ? 'Live now'
          : tournaments.nextDate ? formatEventDate(`${tournaments.nextDate}T00:00:00`)
            : tournaments.count > 0 ? 'None upcoming'
              : 'None yet',
      sub: tournaments && tournaments.count > 0
        ? `${tournaments.count} registered${tournaments.pending > 0 ? ` · ${tournaments.pending} pending` : ''}`
        : 'Register for a tournament',
      href: `${base}/tournaments`,
      tone: 'default' as const,
      flag: (tournaments && tournaments.owingCount > 0)
        ? { text: `${formatMoney(tournaments.owed)} in fees due · ${tournaments.owingCount} to pay`, tone: 'warn' as 'ok' | 'warn' }
        : null,
      headcount: null as { in: number; late: number; out: number; noReply: number } | null,
      progress: null,
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
              {/* Status badge only when it's NOT the everyday "active" case — an active team
                  needs no label; draft/completed/archived seasons get one so it's noticed. */}
              {assignment.programYearStatus !== 'active' && (
                <span className={`${styles.badge} ${STATUS_CSS[assignment.programYearStatus] ?? styles.badgeDraft}`}>
                  {STATUS_LABEL[assignment.programYearStatus] ?? assignment.programYearStatus}
                </span>
              )}
              {teamDivision && (
                <span className={`${styles.badge} ${styles.badgeManual}`}>{teamDivision}</span>
              )}
            </div>
            <p className={styles.pageSub}>
              {seasonLabel} -{' '}
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

      {/* Headline stat strip — a clean, scannable summary line above the tiles (run-mode only). */}
      {!showSetupPanel && setupStats && (
        <div className={styles.statStrip}>
          <span className={styles.statStripItem}><strong>{setupStats.activeRosterCount}</strong> Players</span>
          <span className={styles.statStripDot} aria-hidden>·</span>
          <span className={styles.statStripItem}><strong>{setupStats.eventCount}</strong> Events</span>
          {nextEventDays != null && (
            <>
              <span className={styles.statStripDot} aria-hidden>·</span>
              <span className={styles.statStripItem}>
                {nextEventDays === 0 ? 'Next: Today' : nextEventDays === 1 ? 'Next: Tomorrow' : <><strong>{nextEventDays}</strong> days away</>}
              </span>
            </>
          )}
        </div>
      )}

      {/* Your team at a glance — run-mode snapshot of real data (replaces the old
          quick-links grid, which just duplicated the sidebar). */}
      <section aria-labelledby="snapshot-title">
        <p className={styles.sectionKicker} id="snapshot-title">Your team at a glance</p>
        <div className={styles.snapshotGrid}>
          {snapshotCards.map(card => {
            const Icon = card.icon;
            return (
              <Link
                key={card.key}
                href={card.href}
                className={`${styles.snapshotCard}${card.key === 'schedule' ? ` ${styles.snapshotCardWide}` : ''}`}
              >
                <span className={styles.snapshotHead}>
                  <span className={styles.snapshotHeadLabel}><Icon size={14} aria-hidden /> {card.label}</span>
                  <ArrowRight size={13} className={styles.snapshotHeadArrow} aria-hidden />
                </span>
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
                {card.flag && (
                  <span className={styles.snapshotFlag} data-tone={card.flag.tone}>{card.flag.text}</span>
                )}
                {card.headcount && (
                  <span className={styles.snapshotHeadcount} aria-label="Attendance for the next event">
                    <span data-s="in">{card.headcount.in} in</span>
                    {card.headcount.late > 0 && <span data-s="late">{card.headcount.late} late</span>}
                    <span data-s="out">{card.headcount.out} out</span>
                    {card.headcount.noReply > 0 && <span data-s="noreply">{card.headcount.noReply} no&nbsp;reply</span>}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </section>

      {/* This week — events in the next 7 days + any player birthdays. */}
      {((weekSummary && weekSummary.total > 0) || birthdays.length > 0) && (
        <div className={styles.weekStrip}>
          {weekSummary && weekSummary.total > 0 && (
            <span className={styles.weekItem}>
              <Calendar size={13} aria-hidden /> This week:{' '}
              {[
                weekSummary.games > 0 ? `${weekSummary.games} game${weekSummary.games === 1 ? '' : 's'}` : null,
                weekSummary.practices > 0 ? `${weekSummary.practices} practice${weekSummary.practices === 1 ? '' : 's'}` : null,
                weekSummary.other > 0 ? `${weekSummary.other} other` : null,
              ].filter(Boolean).join(' · ')}
            </span>
          )}
          {birthdays.length > 0 && (
            <span className={styles.weekItem}>
              <Cake size={13} aria-hidden />{' '}
              {birthdays.length === 1
                ? `${birthdays[0].name}’s birthday${birthdays[0].inDays === 0 ? ' today' : birthdays[0].inDays === 1 ? ' tomorrow' : ''}`
                : `${birthdays.length} birthdays this week`}
            </span>
          )}
        </div>
      )}

      {/* Season record — recent form, scoring, streak. Self-labeled ("Season Record"), so it
          flows directly below the tiles without a redundant section header. */}
      <SeasonRecordWidget events={seasonGames} teamId={teamId} />
    </div>
  );
}
