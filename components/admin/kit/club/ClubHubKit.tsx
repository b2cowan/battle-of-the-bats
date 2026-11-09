'use client';
/**
 * THE CLUB HUB on the kit — "Overview" (Club Tier Stage 1, screens session; ratified specimens 1–2,
 * built to club hub v8). Rendered by `AdminHub` (its old hub branch went with Admin Design Continuity
 * Part B, area 2).
 *
 *   The club today — the joined band above This morning (Stage 13b, A1; `ClubBand`): cash, what is owed, this week, who is
 *                    needed. For the owner and the club admin, from its own route after This morning has rendered.
 *   This morning   — the president's brief: COUNTS the person can act on. A card
 *                    is a door only where its page opens for this person; the treasurer's two are
 *                    plain counts until Stage 3a gives them their screens (owner, 2026-09-26). When
 *                    every count is zero the strip is one line. (Counts, not money, because the club's figures were
 *                    known-wrong until Stage 3 — C04, Stage 1's rule. Stage 3 shipped, so that reason has EXPIRED; the
 *                    money lives in the band above, and this strip is unchanged because it is the right first look.)
 *   Your programs  — the club's programs in the plan-aware order (what it RUNS first — the same
 *                    order the rail and the phone bar read, `useAdminKitNav`).
 *   The quiet rows — what the plan carries but the club does not run yet (never a tile, never a
 *                    banner: this replaces "First tournament setup", G01); Organization, with the
 *                    team-capacity readout beside Plan & billing (v8); the owner's setup progress
 *                    while it is unfinished; and "You also coach…" for someone who really coaches here.
 *
 * ⚠ Not drawn, added and flagged at build time: the owner's "Setup: n of 5 · Continue setup" line
 * (the checklist tells the owner "you can come back to this from Overview", and the drawn hub had no
 * door), and the league and tournament registration counts today's hub shows in its attention box
 * (a club that runs either keeps that signal; drawn clubs run neither).
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { PLAN_BILLING_WORDS as W } from '@/lib/plan-billing-words';
import billing from '@/components/billing/Billing.module.css';
import { IN_PLACE_RETURN_PARAM, isInPlaceReturn } from '@/lib/workspace-upgrade';
import {
  Users, DollarSign, Contact, Globe, CalendarDays, Trophy, Building2, UserCheck, Lock, ListChecks,
  RefreshCw, Pencil, UserPlus, ExternalLink, type LucideIcon,
} from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { hasCapability, hasBillingAccess } from '@/lib/roles';
import { hasModuleEntitlement, isClubPlan } from '@/lib/module-entitlements';
import { usePageTitle } from '@/lib/usePageTitle';
import { usePlanGating } from '@/lib/use-plan-gating';
import { closedProgramPlansSentence } from '@/lib/plan-config';
import { joinWithAnd, pluralize, possessive } from '@/lib/utils';
import { CoachCard, CoachDoorCard, CoachEyebrow, CoachFigure, CoachChip, kit } from '@/components/coaches/kit';
import { useAdminKitNav } from '../useAdminKitNav';
import { useClubBrief, briefProgramCount, type BriefKey, type ClubBrief } from './ClubBriefProvider';
import { accountingTabs, kitCountText, type AdminProgramKey } from '@/lib/admin-kit-nav';
import ck from './ClubKit.module.css';
import styles from './ClubHub.module.css';
import frame from '../AdminKitFrame.module.css';
import LoadingState from '@/components/shared/LoadingState';
import PageNotice from '@/components/shared/PageNotice';
import WhatsNewNote from './WhatsNewNote';
import ClubBand from './ClubBand';
import ClubStillToDo, { type StillToDoChecklist } from './ClubStillToDo';
import { useBoardPeople } from '@/lib/use-board-people';
import { boardOwnerName, seasonStarterShort } from '@/lib/board-people';
import { NOT_YOURS_WORDS } from '@/lib/not-yours-words';
import { LEAGUE_RUNNER_ROLES } from '@/lib/house-league-access';
import { PERMIT_WORDS as PW, outsideCardWords } from '@/lib/permit-words';
import { permitDoor } from '@/lib/permit-dates-off-view';

/** The org's own word for itself on its hub: a Club is a club; a League Plus org, a league. */
function orgNoun(planId: string | undefined): string {
  if (isClubPlan(planId)) return 'club';
  if (planId === 'league') return 'league';
  return 'organization';
}

type BriefCardSpec = {
  key: BriefKey;
  label: string;
  /** The line under the figure — facts only (a count of teams, an age), never an amount. */
  sub: (n: number, brief: ClubBrief) => string;
  /** Where the card opens, or null when this person cannot open that page. */
  href: (base: string, brief: ClubBrief, can: { repTeams: boolean; accounting: boolean }) => string | null;
};

const BRIEF_CARDS: BriefCardSpec[] = [
  {
    key: 'tryoutApplications',
    label: 'Tryout applications',
    sub: (n, b) => {
      if (n === 0) return 'nothing waiting';
      const teams = b.detail.tryoutApplications?.teams ?? 0;
      return teams > 0 ? `waiting on a decision · ${pluralize(teams, 'team')}` : 'waiting on a decision';
    },
    // Opens the tryouts of the team with the OLDEST application (specimen 1's note).
    href: (base, b, can) => {
      if (!can.repTeams) return null;
      const oldest = b.detail.tryoutApplications?.oldest;
      return oldest
        ? `${base}/rep-teams/teams/${oldest.teamId}/program-years/${oldest.programYearId}/tryouts`
        : `${base}/rep-teams`;
    },
  },
  {
    key: 'paymentRequests',
    label: 'Payment requests',
    sub: (n, b) => {
      if (n === 0) return 'nothing waiting';
      const days = b.detail.paymentRequests?.oldestDays;
      const held = b.detail.paymentRequests?.holdingPayout ?? 0;
      const age = days == null ? 'from coaches' : `oldest waiting ${days === 0 ? 'today' : pluralize(days, 'day')}`;
      // ⚖ Club Tier Stage 3a, Ask 5b: a request holding up a team's payout to families is the one thing
      // waiting on the club that holds up families' money, so the door names it.
      return held > 0 ? `${age} · ${held} holding up a payout` : age;
    },
    // ⚖ A DOOR since Club Tier Stage 3a (Stage 1's ruling held them as plain counts until the treasurer
    // had the screens): the Payment requests tab.
    href: (base, _b, can) => (can.accounting ? `${base}/accounting/payment-requests` : null),
  },
  {
    key: 'installmentsDue',
    label: 'Installments due',
    sub: (n, b) => {
      if (n === 0) return 'none in the next 14 days';
      const overdue = b.detail.installmentsDue?.overdue ?? 0;
      return overdue > 0 ? `in the next 14 days · ${overdue} overdue` : 'in the next 14 days';
    },
    // Allocations on Coming due: the same 14-day window with the overdue band, so the count and the
    // bands agree (the one definition, S3A-05).
    href: (base, _b, can) => (can.accounting ? `${base}/accounting/allocations?view=coming-due` : null),
  },
  {
    key: 'assistantCoaches',
    label: 'Assistant coaches',
    sub: n => (n === 0 ? 'nothing waiting' : 'awaiting your approval'),
    href: (base, _b, can) => (can.repTeams ? `${base}/rep-teams/assistant-coaches` : null),
  },
];

const PROGRAM_ICON: Record<AdminProgramKey, LucideIcon> = {
  'rep-teams': Users,
  accounting: DollarSign,
  families: Contact,
  'public-site': Globe,
  'house-league': CalendarDays,
  tournaments: Trophy,
};

type Attention = { pendingTournamentCount: number; pendingLeagueCount: number; openLeagueSeasonId: string | null };
type Checklist = StillToDoChecklist;

export default function ClubHubKit() {
  const params = useSearchParams();
  const router = useRouter();
  const [arrivedFromUpgrade] = useState(() => isInPlaceReturn(params));
  const { currentOrg, userRole, userCapabilities, canOpen, loading } = useOrg();
  usePageTitle('Overview');
  const { base, programs, alsoOnPlan, permitsLink } = useAdminKitNav();
  const { status, brief, reload, outside } = useClubBrief();
  // The locked-programs note says which plans are closed from the LIVE gate (BUSINESS_DECISIONS 2026-09-28).
  const gating = usePlanGating();
  const closedPlansLine = gating ? closedProgramPlansSentence(gating) : null;
  const slug = currentOrg?.slug ?? '';
  const isOwner = userRole === 'owner';
  // The board by name (Stage 13a: names only), read only by those who see a named sentence: an admin (the locked rows'
  // "Ask Morgan Ellis") and a non-runner on a club not running house league yet ("… starts one", on the quiet row or, when
  // the program leads for them under Ask 8, its card).
  // From the brief's ANSWER only: before it (or when it fails) the shape is the plan's guess, which reads a Club plan's
  // running league as "not running" and would say "No season yet" to a registrar whose league has seasons (/review).
  const leagueNotRunning = !!brief && !brief.shape.runsHouseLeague && canOpen('module_house_league');
  const board = useBoardPeople(
    userRole === 'admin'
    || (!!userRole && !LEAGUE_RUNNER_ROLES.includes(userRole) && leagueNotRunning),
  );
  const canManageBilling = hasBillingAccess(userRole, userCapabilities);
  const club = isClubPlan(currentOrg?.planId);
  const showUpgradeSetup = arrivedFromUpgrade && isOwner && club;
  const noun = orgNoun(currentOrg?.planId);
  useEffect(() => {
    if (!showUpgradeSetup || !slug || !params.has(IN_PLACE_RETURN_PARAM)) return;
    const query = new URLSearchParams(params.toString());
    query.delete(IN_PLACE_RETURN_PARAM);
    router.replace(`/${slug}/admin${query.size ? `?${query}` : ''}`, { scroll: false });
  }, [showUpgradeSetup, slug, params, router]);

  // Today's hub's two registration counts (its attention box) — kept for the club that runs a house
  // league or hosts tournaments. Only asked where the person can open that program.
  const [attention, setAttention] = useState<Attention | null>(null);
  const wantsAttention = canOpen('module_tournaments') || canOpen('module_house_league');
  useEffect(() => {
    if (!slug || !wantsAttention) return;
    let stale = false;
    fetch(`/api/admin/attention-summary?orgSlug=${encodeURIComponent(slug)}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (!stale && d) setAttention(d as Attention); })
      .catch(() => {});
    return () => { stale = true; };
  }, [slug, wantsAttention]);

  // The owner's setup progress, while it is unfinished (a Club's checklist — A11). A club ADMIN reads the same list, read-only,
  // as "Still to do" (Stage 13b, A2); the owner's "Setup: n of 5" line is theirs alone.
  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const isAdmin = userRole === 'admin';
  useEffect(() => {
    if (!slug || !(isOwner || isAdmin) || !club) return;
    let stale = false;
    fetch(`/api/admin/org/club-checklist?orgSlug=${encodeURIComponent(slug)}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (!stale && d) setChecklist(d as Checklist); })
      .catch(() => {});
    return () => { stale = true; };
  }, [slug, isOwner, isAdmin, club]);

  // "You also coach 13U AA" — only for someone who really coaches a team HERE (the sidebar door's
  // own check, J4-047): an owner who coaches nothing sees no line and no dead end.
  const [assignmentRows, setAssignmentRows] = useState<{ teamId?: string; teamName?: string }[]>([]);
  const [teamRead, setTeamRead] = useState<'loading' | 'ready' | 'error'>('loading');
  const [teamReadRevision, setTeamReadRevision] = useState(0);
  useEffect(() => {
    if (!slug) return;
    const controller = new AbortController();
    fetch(`/api/coaches/${slug}/assignments`, { cache: 'no-store', signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error('Assignments unavailable'); return r.json(); })
      .then(d => {
        if (controller.signal.aborted || !d) return;
        setAssignmentRows([...(Array.isArray(d.assignments) ? d.assignments : []), ...(Array.isArray(d.closedAssignments) ? d.closedAssignments : [])]);
        setTeamRead('ready');
      })
      .catch(() => { if (!controller.signal.aborted) setTeamRead('error'); });
    return () => controller.abort();
  }, [slug, teamReadRevision]);
  const coachedTeams = [...new Set(assignmentRows.map(r => r.teamName).filter((n): n is string => !!n))];
  const upgradeTeams = [...new Map(assignmentRows.filter((r): r is { teamId: string; teamName: string } => !!r.teamId && !!r.teamName).map(r => [r.teamId, r])).values()];

  if (loading || !userRole || !currentOrg) {
    return <LoadingState label="Loading the overview…" />;
  }

  const canOpenRepTeams = canOpen('module_rep_teams');
  const canSeeMembers = (isOwner || hasCapability(userRole, userCapabilities, 'module_members')) && canOpen('module_members');
  const canManageMembers = hasCapability(userRole, userCapabilities, 'manage_members');
  const canRunLeague = LEAGUE_RUNNER_ROLES.includes(userRole);
  const canCreateTournaments = hasCapability(userRole, userCapabilities, 'create_tournaments');
  // ⚖ J10-016 + Ask 7 = A (Club Tier Stage 13a): an ADMIN keeps the owner's areas as locked rows that name the owner; for
  // anyone else they go, and the section with them when it would hold nothing but locks (F-NAV-10).
  // A tournament-plan org (the free League Starter) has no /admin/org pages at all, so there is nothing to lock.
  const showsLockedRows = userRole === 'admin' && currentOrg.planId !== 'tournament';

  // The setup list a coach sees after becoming a club: the board and public-site steps reuse the checklist's own destinations.
  const stepHref = (key: string, fallback: string) => checklist?.steps?.find(step => step.key === key)?.href ?? fallback;
  const setupSteps = [
    { title: W.clubUpgrade.addressStep, help: `${W.clubUpgrade.addressValue(slug)} · ${W.clubUpgrade.addressStepHelp}`, action: W.clubUpgrade.change, Icon: Pencil, href: `${base}/org/settings` },
    { title: W.clubUpgrade.staffStep, help: W.clubUpgrade.staffHelp, action: W.clubUpgrade.invite, Icon: UserPlus, href: stepHref('board', `${base}/org/members`) },
    { title: W.clubUpgrade.publicStep, help: W.clubUpgrade.publicHelp, action: W.clubUpgrade.open, Icon: ExternalLink, href: stepHref('public', `${base}/public-site`) },
  ];

  // ── This morning ─────────────────────────────────────────────────────────────────────────────
  const briefCards = brief ? BRIEF_CARDS.filter(c => brief.counts[c.key] !== undefined) : [];
  const extraCards: { key: string; label: string; n: number; sub: string; href: string }[] = [];
  if (attention && canOpen('module_house_league') && attention.pendingLeagueCount > 0) {
    extraCards.push({
      key: 'league', label: 'League registrations', n: attention.pendingLeagueCount, sub: 'waiting for review',
      href: attention.openLeagueSeasonId ? `${base}/house-league/seasons/${attention.openLeagueSeasonId}/registrations` : `${base}/house-league`,
    });
  }
  if (attention && canOpen('module_tournaments') && attention.pendingTournamentCount > 0) {
    extraCards.push({
      key: 'tournament', label: 'Tournament registrations', n: attention.pendingTournamentCount, sub: 'waiting for review',
      href: `${base}/tournaments/registrations`,
    });
  }
  // "Outside the permit" (Club Tier 13c Session B, C3 = A): only while true, after the cards that exist (a fifth wraps).
  // Owner and admin only — the provider asks for no one else. Its door is a door only for someone who can open Permits:
  // one permit → that permit with its notice; two or more → Permits, whose flagged rows say which.
  if (outside && outside.count > 0 && permitsLink) {
    extraCards.push({
      key: 'outside-permit', label: PW.outside, n: outside.count, sub: outsideCardWords(outside.count, outside.days, outside.venues),
      href: permitDoor(permitsLink.href, outside.permitIds),
    });
  }
  const anythingWaits = briefCards.some(c => (brief?.counts[c.key] ?? 0) > 0) || extraCards.length > 0;
  const hasBriefSection = briefCards.length > 0 || extraCards.length > 0 || status === 'error' || (status === 'loading' && !brief);

  // ── Your programs ────────────────────────────────────────────────────────────────────────────
  const teams = brief?.teams;
  const programLine = (key: AdminProgramKey): string => {
    switch (key) {
      case 'rep-teams': {
        const count = teams
          ? teams.groups > 1
            ? `${pluralize(teams.active, 'team')} in ${teams.groups} groups · `
            : `${pluralize(teams.active, 'team')} · `
          : '';
        return `${count}tryouts, rosters and coaches`;
      }
      // ⚖ Accounting is one page with tabs (Stage 3a, Ask 2): its line names the tabs, as drawn.
      case 'accounting': return accountingTabs(base, { runsRepTeams: hasModuleEntitlement(currentOrg, 'module_rep_teams') })
        .filter(t => t.id !== 'overview').map(t => t.label).join(' · ');
      case 'families': return 'Every household on your rosters: who owes, who is missing forms, who cannot be reached';
      case 'public-site': return `Your ${possessive(noun)} page: tagline, contact and links`;
      // ⚖ Ask 8 (Stage 13a, B1): leading before the club has a season, the card says so and who starts one (by name;
      // nothing while the names load).
      case 'house-league': {
        if (!leagueNotRunning) return 'Seasons, registrations, the draft, schedules and standings';
        const starter = canRunLeague ? 'start the first one here' : board ? seasonStarterShort(board) : null;
        return `No season yet${starter ? ` · ${starter}` : ''}`;
      }
      case 'tournaments': return 'Schedules, results, registrations and game day';
    }
  };

  // ── The capacity readout (v8: in the Organization line, beside the plan it counts) ─────────────
  const capacity = club && teams && currentOrg.teamLimit < 9999 ? `${teams.active} of ${currentOrg.teamLimit} teams` : null;

  return (
    <div className={`${ck.page} ${styles.hubPage}`} data-club-hub>
      {/* No paper heading (Admin header bar A3, owner 2026-11-07): the pinned bar names the club here, and its name is
          this page's <h1> (`AdminEventHeader`). The word "Overview" stays on the rail row that opens it. The first
          content starts the portal's masthead gap under the bar (`.hubPage`). */}
      {/* An ANNOUNCED release, one line, dismissible (owner 2026-11-07); nothing when none is unread. It sits
          directly under the title, which is now the bar (What's new plan, ruling 5). */}
      <WhatsNewNote />
      {showUpgradeSetup && <>
        <CoachCard className={billing.setupCard}>
          <h2 className={billing.sectionTitle}>{W.clubUpgrade.ready}</h2>
          <p className={billing.hint}>{W.clubUpgrade.readyBody(currentOrg.name)}</p>
          <ol className={billing.setupSteps} aria-label={W.clubUpgrade.setupLabel}>
            <li><span aria-hidden>✓</span><div><strong>{W.clubUpgrade.nameStep}</strong><small>{currentOrg.name}</small></div></li>
            {setupSteps.map((step, index) => <li key={step.title}>
              <span aria-hidden>{index + 2}</span><div><strong>{step.title}</strong><small>{step.help}</small></div>
              <Link className={`btn btn-outline ${billing.setupAction} ${billing.symbolAction}`} aria-label={step.action} href={step.href}><step.Icon size={16} aria-hidden className={billing.phoneIcon} /><span className={billing.desktopText}>{step.action}</span></Link>
            </li>)}
          </ol>
        </CoachCard>
        <CoachCard className={billing.setupCard}>
          <h2 className={billing.sectionTitle}>{W.clubUpgrade.repTeams}</h2>
          {teamRead === 'loading' && <LoadingState inline label={W.clubUpgrade.loadingTeam} />}
          {teamRead === 'error' && <>
            <PageNotice notice={{ tone: 'bad', text: W.clubUpgrade.teamReadFailed }} />
            <button className={`btn btn-outline ${billing.setupAction}`} type="button" onClick={() => { setTeamRead('loading'); setTeamReadRevision(n => n + 1); }}>{W.clubUpgrade.checkAgain}</button>
          </>}
          {teamRead === 'ready' && upgradeTeams.length === 0 && <>
            <p className={billing.hint}>{W.clubUpgrade.noTeam}</p>
            <Link href={`${base}/rep-teams`} className={`btn btn-outline ${billing.setupAction}`}>{W.clubUpgrade.repTeams}</Link>
          </>}
          {teamRead === 'ready' && upgradeTeams.map(team => <div key={team.teamId}>
            <strong>{team.teamName}</strong>
            <p className={billing.hint}>{W.clubUpgrade.teamHelp}</p>
            <Link className={`btn btn-lime ${billing.setupAction}`} href={`/${slug}/coaches/teams/${team.teamId}`}>{W.clubUpgrade.openTeam}</Link>
          </div>)}
        </CoachCard>
      </>}

      {/* Stage 13b, A1 (Ask 2): the club band sits ABOVE This morning, never instead of it. Owner and club admin on a Club
          plan; it asks only once the brief has answered (or failed), so This morning never waits on it. */}
      {club && (isOwner || isAdmin) && <ClubBand
        slug={slug} base={base} ready={status !== 'loading' || !!brief}
      />}

      {hasBriefSection && (
        <section className={ck.section} aria-labelledby="hub-brief">
          <div className={ck.sectionHead}>
            <span id="hub-brief" className={kit.eye}>This morning</span>
          </div>
          {status === 'error' && !brief ? (
            <div className={`${ck.notice} ${ck.noticeWarn}`} role="status">
              <RefreshCw size={15} aria-hidden />
              <div className={ck.noticeBody}>
                This morning’s brief didn’t load.{' '}
                <button type="button" className={ck.link} onClick={reload}>Try again</button>
              </div>
            </div>
          ) : !brief ? (
            <LoadingState inline label="Loading this morning’s brief…" />
          ) : !anythingWaits ? (
            <p className={styles.calm}>Nothing is waiting on you this morning.</p>
          ) : (
            <div className={styles.brief}>
              {briefCards.map(c => {
                const n = brief.counts[c.key] ?? 0;
                const href = c.href(base, brief, { repTeams: canOpenRepTeams, accounting: canOpen('module_accounting') });
                const body = (
                  <>
                    <CoachEyebrow arrow={!!href}>{c.label}</CoachEyebrow>
                    <CoachFigure tone={n === 0 ? 'muted' : undefined}>{n}</CoachFigure>
                    <p className={kit.sub}>{c.sub(n, brief)}</p>
                  </>
                );
                return href
                  ? <CoachDoorCard key={c.key} href={href} className={styles.briefCard}>{body}</CoachDoorCard>
                  : <CoachCard key={c.key} className={styles.briefCard}>{body}</CoachCard>;
              })}
              {extraCards.map(c => (
                <CoachDoorCard key={c.key} href={c.href} className={styles.briefCard}>
                  <CoachEyebrow arrow>{c.label}</CoachEyebrow>
                  <CoachFigure>{c.n}</CoachFigure>
                  <p className={kit.sub}>{c.sub}</p>
                </CoachDoorCard>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Stage 13b, A2 (Ask 11): the owner's open setup steps, READ-ONLY, on a club admin's Overview — gone when setup is done.
          A door only on a step whose page this admin can open. */}
      {isAdmin && club && checklist && (
        <ClubStillToDo
          checklist={checklist}
          ownerName={boardOwnerName(board)}
          canOpenStep={key => key === 'board' ? canSeeMembers
            : key === 'public' ? canOpen('module_public_site')
            : key === 'budget' ? canOpen('module_accounting')
            : canOpenRepTeams}
        />
      )}

      {programs.length > 0 && (
        <section className={ck.section} aria-labelledby="hub-programs">
          <div className={ck.sectionHead}>
            <span id="hub-programs" className={kit.eye}>Your programs</span>
          </div>
          <div className={styles.programs}>
            {programs.map(p => {
              const Icon = PROGRAM_ICON[p.key];
              const waiting = briefProgramCount(brief, p.key);
              // A waiting count is the rail's amber pill — the number, never words (owner ruling 2026-10-01).
              // A program with no waiting count answers 0 (`briefProgramCount`), so the count alone decides the pill.
              const chip = waiting > 0
                // The rail's pill, without the rail row's `margin-left: auto` — in the eyebrow's spread row it would
                // shove the count against the arrow, off where every other card's chip sits (/review 2026-10-01).
                ? <span className={frame.count} style={{ marginLeft: 0 }} aria-label={`${waiting} waiting`}>{kitCountText(waiting)}</span>
                : p.key === 'public-site'
                  ? <CoachChip tone={currentOrg.isPublic ? 'good' : 'warn'}>{currentOrg.isPublic ? 'Online' : 'Offline'}</CoachChip>
                  : undefined;
              return (
                <CoachDoorCard key={p.key} href={p.href} className={styles.programCard}>
                  <CoachEyebrow icon={<Icon size={14} aria-hidden />} chip={chip} arrow>{p.label}</CoachEyebrow>
                  <p className={styles.programLine}>{programLine(p.key)}</p>
                </CoachDoorCard>
              );
            })}
          </div>
        </section>
      )}

      {/* ── The quiet rows ─────────────────────────────────────────────────────────────────────── */}
      <div className={ck.quietRow}>
        {alsoOnPlan.map(p => {
          const Icon = PROGRAM_ICON[p.key];
          return p.key === 'house-league' ? (
            <span key={p.key} className={ck.quietItem}>
              {/* ⚖ A5 (Club Tier Stage 13a, F-R1-4): "Start a season" only to someone who can start one (the house-league gate's
                  runners); anyone else is told who does, by name. */}
              <Icon size={14} aria-hidden />House league: not running ·{' '}
              {canRunLeague ? <Link href={p.href} className={ck.link}>Start a season</Link> : board ? seasonStarterShort(board) : null}
            </span>
          ) : p.key === 'tournaments' ? (
            <span key={p.key} className={ck.quietItem}>
              {/* The same rule (A5): "Run a tournament" only to someone who may create one (`create_tournaments`). */}
              <Icon size={14} aria-hidden />Tournaments: none yet ·{' '}
              {canCreateTournaments ? <Link href={p.href} className={ck.link}>Run a tournament</Link> : NOT_YOURS_WORDS.tournamentStarterShort}
            </span>
          ) : null;
        })}
        {isOwner && (
          <span className={ck.quietItem}>
            <Building2 size={14} aria-hidden />
            {/* One inline run after the icon (Stage 13 fix-now 6, F-NAV-1): each piece as its own flex item took the row's
                gap, and read "Organization : members , plan & billing (8 of 15 teams) , settings". */}
            <span>
              <Link href={`${base}/org`} className={ck.link}>Organization</Link>:
              {' '}<Link href={`${base}/org/members`} className={ck.link}>members</Link>,
              {' '}<Link href={`${base}/org/billing`} className={ck.link}>plan &amp; billing</Link>
              {capacity && <> <span className={ck.muted}>({capacity})</span></>},
              {' '}<Link href={`${base}/org/settings`} className={ck.link}>settings</Link>
            </span>
          </span>
        )}
        {isOwner && checklist && !checklist.allDone && (
          <span className={ck.quietItem}>
            <ListChecks size={14} aria-hidden />
            Setup: {checklist.doneCount} of {checklist.totalSteps} steps done ·{' '}
            <Link href={`${base}/onboarding?plan=club`} className={ck.link}>Continue setup</Link>
          </span>
        )}
      </div>
      {coachedTeams.length > 0 && (
        <div className={ck.quietRow}>
          <span className={ck.quietItem}>
            <UserCheck size={14} aria-hidden />
            You also coach <span className={ck.strong}>{joinWithAnd(coachedTeams)}</span> ·{' '}
            <Link href={`/${slug}/coaches`} className={ck.link}>Open your Coaches Portal</Link>
          </span>
        </div>
      )}

      {/* ── Organization, for someone who is not the owner (specimen 2): the board they can open,
            and the owner's areas as LOCKED rows that say whose they are (J10-016) ───────────── */}
      {!isOwner && (canSeeMembers || showsLockedRows) && (
        <section className={`${ck.section} ${styles.orgSection}`} aria-labelledby="hub-org">
          <div className={ck.sectionHead}>
            <span id="hub-org" className={kit.eye}>Organization</span>
          </div>
          <div className={ck.list}>
            {canSeeMembers && (
              <Link href={`${base}/org/members`} className={ck.row}>
                <span className={ck.rowMain}>
                  <span className={ck.rowTitle}>Members</span>
                  <span className={ck.rowSub}>{canManageMembers ? 'Invite and manage the board' : 'View the board'}</span>
                </span>
              </Link>
            )}
            {canManageBilling && <Link href={`${base}/org/billing`} className={ck.row}>
              <span className={ck.rowMain}><span className={ck.rowTitle}>Plan &amp; billing</span></span>
            </Link>}
            {showsLockedRows && (canManageBilling ? ['Settings'] : ['Plan & billing', 'Settings']).map(label => (
              <div key={label} className={`${ck.row} ${ck.rowLocked}`} aria-label={NOT_YOURS_WORDS.lockedRowLabel(label)}>
                <span className={ck.rowMain}><span className={`${ck.rowTitle} ${ck.muted}`}>{label}</span></span>
                <span className={ck.rowEnd}><span className={ck.chip}><Lock size={11} aria-hidden /> {NOT_YOURS_WORDS.askChip(boardOwnerName(board))}</span></span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Today's "Coming soon" teaser, restyled: an owner on a plan without the club programs
            (League Plus, a League Starter). It never shows on a Club (specimen 1's note). ────── */}
      {isOwner && !club && !canOpen('module_accounting') && !canOpen('module_rep_teams') && (
        <section className={ck.section} aria-labelledby="hub-soon">
          <div className={ck.sectionHead}><span id="hub-soon" className={kit.eye}>In League Plus and Club</span></div>
          <p className={ck.lede}>
            {[
              !canOpen('module_public_site') && 'Public site',
              !canOpen('module_house_league') && 'House league',
              'Accounting',
              'Rep teams',
            ].filter(Boolean).join(' · ')}{' '}
            —{closedPlansLine && <> {closedPlansLine}</>}{' '}
            <Link href={`${base}/org/billing`} className={ck.link}>View billing and upgrade options</Link>
          </p>
        </section>
      )}
    </div>
  );
}
