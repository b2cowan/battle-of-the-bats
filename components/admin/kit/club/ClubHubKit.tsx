'use client';
/**
 * THE CLUB HUB on the kit — "Overview" (Club Tier Stage 1, screens session; ratified specimens 1–2,
 * built to club hub v8). Renders only with the Admin Design Continuity switch on (`AdminHub`).
 *
 *   This morning   — the president's brief: COUNTS the person can act on, never money (C04). A card
 *                    is a door only where its page opens for this person; the treasurer's two are
 *                    plain counts until Stage 3a gives them their screens (owner, 2026-09-26). When
 *                    every count is zero the strip is one line.
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
import {
  Users, DollarSign, Contact, Globe, CalendarDays, Trophy, Building2, UserCheck, Lock, ListChecks,
  RefreshCw, type LucideIcon,
} from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { hasCapability } from '@/lib/roles';
import { isClubPlan } from '@/lib/module-entitlements';
import { usePageTitle } from '@/lib/usePageTitle';
import { joinWithAnd, pluralize } from '@/lib/utils';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import { CoachCard, CoachDoorCard, CoachEyebrow, CoachFigure, CoachChip, kit } from '@/components/coaches/kit';
import { useAdminKitNav } from '../useAdminKitNav';
import { useClubBrief, briefProgramCount, type BriefKey, type ClubBrief } from './ClubBriefProvider';
import type { AdminProgramKey } from '@/lib/admin-kit-nav';
import ck from './ClubKit.module.css';
import styles from './ClubHub.module.css';

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
  href: (base: string, brief: ClubBrief, canOpenRepTeams: boolean) => string | null;
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
    href: (base, b, canOpenRepTeams) => {
      if (!canOpenRepTeams) return null;
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
      if (days == null) return 'from coaches';
      return `from coaches · oldest ${days === 0 ? 'today' : pluralize(days, 'day')}`;
    },
    href: (base, _b, canOpenRepTeams) => (canOpenRepTeams ? `${base}/rep-teams/payment-requests` : null),
  },
  {
    key: 'installmentsDue',
    label: 'Installments due',
    sub: n => (n === 0 ? 'none in the next 14 days' : 'in the next 14 days'),
    // Read from the Upcoming Payables list the Rep Teams page shows (specimen 1's note).
    href: (base, _b, canOpenRepTeams) => (canOpenRepTeams ? `${base}/rep-teams` : null),
  },
  {
    key: 'assistantCoaches',
    label: 'Assistant coaches',
    sub: n => (n === 0 ? 'nothing waiting' : 'awaiting your approval'),
    href: (base, _b, canOpenRepTeams) => (canOpenRepTeams ? `${base}/rep-teams/assistant-coaches` : null),
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
type Checklist = { doneCount: number; totalSteps: number; allDone: boolean };

export default function ClubHubKit() {
  const { currentOrg, userRole, userCapabilities, canOpen, loading } = useOrg();
  usePageTitle('Overview');
  const { base, programs, alsoOnPlan } = useAdminKitNav();
  const { status, brief, reload } = useClubBrief();
  const slug = currentOrg?.slug ?? '';
  const isOwner = userRole === 'owner';
  const club = isClubPlan(currentOrg?.planId);
  const noun = orgNoun(currentOrg?.planId);

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

  // The owner's setup progress, while it is unfinished (a Club's checklist — A11).
  const [checklist, setChecklist] = useState<Checklist | null>(null);
  useEffect(() => {
    if (!slug || !isOwner || !club) return;
    let stale = false;
    fetch(`/api/admin/org/club-checklist?orgSlug=${encodeURIComponent(slug)}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (!stale && d) setChecklist(d as Checklist); })
      .catch(() => {});
    return () => { stale = true; };
  }, [slug, isOwner, club]);

  // "You also coach 13U AA" — only for someone who really coaches a team HERE (the sidebar door's
  // own check, J4-047): an owner who coaches nothing sees no line and no dead end.
  const [coachedTeams, setCoachedTeams] = useState<string[]>([]);
  useEffect(() => {
    if (!slug) return;
    const controller = new AbortController();
    fetch(`/api/coaches/${slug}/assignments`, { cache: 'no-store', signal: controller.signal })
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (controller.signal.aborted || !d) return;
        const rows = [...(Array.isArray(d.assignments) ? d.assignments : []), ...(Array.isArray(d.closedAssignments) ? d.closedAssignments : [])] as { teamName?: string }[];
        setCoachedTeams([...new Set(rows.map(r => r.teamName).filter((n): n is string => !!n))]);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [slug]);

  if (loading || !userRole || !currentOrg) {
    return <div className={ck.loading}>Loading…</div>;
  }

  const canOpenRepTeams = canOpen('module_rep_teams');
  const canSeeMembers = (isOwner || hasCapability(userRole, userCapabilities, 'module_members')) && canOpen('module_members');
  const canManageMembers = hasCapability(userRole, userCapabilities, 'manage_members');

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
        return `${count}tryouts, rosters, coaches and allocations`;
      }
      case 'accounting': return `The ${noun}’s ledgers, its budget and Budget vs. Actual`;
      case 'families': return 'Every household on your rosters: who owes, who is missing forms, who cannot be reached';
      case 'public-site': return `Your ${noun}’s page: tagline, contact and links`;
      case 'house-league': return 'Seasons, registrations, the draft, schedules and standings';
      case 'tournaments': return 'Schedules, results, registrations and game day';
    }
  };

  // ── The capacity readout (v8: in the Organization line, beside the plan it counts) ─────────────
  const capacity = club && teams && currentOrg.teamLimit < 9999 ? `${teams.active} of ${currentOrg.teamLimit} teams` : null;

  return (
    <div className={ck.page}>
      <AdminPageHeader legacy={null} eyebrow={club ? 'Club' : noun === 'league' ? 'League' : 'Organization'} title={currentOrg.name} />

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
            <div className={ck.loading}>Loading…</div>
          ) : !anythingWaits ? (
            <p className={styles.calm}>Nothing is waiting on you this morning.</p>
          ) : (
            <div className={styles.brief}>
              {briefCards.map(c => {
                const n = brief.counts[c.key] ?? 0;
                const href = c.href(base, brief, canOpenRepTeams);
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

      {programs.length > 0 && (
        <section className={ck.section} aria-labelledby="hub-programs">
          <div className={ck.sectionHead}>
            <span id="hub-programs" className={kit.eye}>Your programs</span>
          </div>
          <div className={styles.programs}>
            {programs.map(p => {
              const Icon = PROGRAM_ICON[p.key];
              const waiting = briefProgramCount(brief, p.key);
              const chip = p.key === 'rep-teams' && waiting > 0
                ? <CoachChip tone="warn">{waiting} waiting</CoachChip>
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
              <Icon size={14} aria-hidden />House league: not running · <Link href={p.href} className={ck.link}>Start a season</Link>
            </span>
          ) : p.key === 'tournaments' ? (
            <span key={p.key} className={ck.quietItem}>
              <Icon size={14} aria-hidden />Tournaments: none yet · <Link href={p.href} className={ck.link}>Run a tournament</Link>
            </span>
          ) : null;
        })}
        {isOwner && (
          <span className={ck.quietItem}>
            <Building2 size={14} aria-hidden />
            <Link href={`${base}/org`} className={ck.link}>Organization</Link>:
            {' '}<Link href={`${base}/org/members`} className={ck.link}>members</Link>,
            {' '}<Link href={`${base}/org/billing`} className={ck.link}>plan &amp; billing</Link>
            {capacity && <span className={ck.muted}>({capacity})</span>},
            {' '}<Link href={`${base}/org/settings`} className={ck.link}>settings</Link>
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
      {!isOwner && (canSeeMembers || currentOrg.planId !== 'tournament') && (
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
            {['Plan & billing', 'Settings'].map(label => (
              <div key={label} className={`${ck.row} ${ck.rowLocked}`} aria-label={`${label}, owner only`}>
                <span className={ck.rowMain}><span className={`${ck.rowTitle} ${ck.muted}`}>{label}</span></span>
                <span className={ck.rowEnd}><span className={ck.chip}><Lock size={11} aria-hidden /> Owner only</span></span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Today's "Coming soon" teaser, restyled: an owner on a plan without the club programs
            (League Plus, a League Starter). It never shows on a Club (specimen 1's note). ────── */}
      {isOwner && !club && !canOpen('module_accounting') && !canOpen('module_rep_teams') && (
        <section className={ck.section} aria-labelledby="hub-soon">
          <div className={ck.sectionHead}><span id="hub-soon" className={kit.eye}>Coming soon — League Plus &amp; Club</span></div>
          <p className={ck.lede}>
            {[
              !canOpen('module_public_site') && 'Public site',
              !canOpen('module_house_league') && 'House league',
              'Accounting',
              'Rep Teams',
            ].filter(Boolean).join(' · ')}{' '}
            — League Plus and Club plans are in early access.{' '}
            <Link href={`${base}/org/billing`} className={ck.link}>View billing and upgrade options</Link>
          </p>
        </section>
      )}
    </div>
  );
}
