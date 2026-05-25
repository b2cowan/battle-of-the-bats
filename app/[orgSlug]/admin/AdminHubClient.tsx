'use client';
import { useEffect, useState, type ElementType } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Trophy, Building2, Globe, DollarSign, CalendarDays, Users, UserCheck, AlertCircle, Rocket, Lock } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { hasCapability, type Capability } from '@/lib/roles';

interface AttentionSummary {
  pendingTournamentCount: number;
  pendingLeagueCount: number;
  openLeagueSeasonId: string | null;
  pendingTryoutCount: number;
}

interface StartupProgress {
  tasks: Record<'plan' | 'tournament' | 'divisions' | 'welcome' | 'venues' | 'contacts', 'pending' | 'complete' | 'skipped'>;
  totalCount: number;
  completeCount: number;
  allFinished: boolean;
  wizardAvailable: boolean;
  firstTournament: { id: string } | null;
}

export default function AdminHubClient() {
  const router = useRouter();
  const { currentOrg, userRole, userCapabilities, loading } = useOrg();
  const base = `/${currentOrg?.slug ?? ''}/admin`;

  const canUseModule = (capability: Capability) => !loading && currentOrg && userRole
    ? hasCapability(userRole, userCapabilities, capability) && hasModuleEntitlement(currentOrg, capability)
    : false;

  const canSeeTournaments = !loading && userRole
    ? canUseModule('module_tournaments')
    : false;

  const canSeeOrgAdmin = !loading && userRole
    ? (userRole === 'owner' || hasCapability(userRole, userCapabilities, 'module_members')) && canUseModule('module_members')
    : false;

  const canSeePublicSite = !loading && userRole
    ? canUseModule('module_public_site')
    : false;

  const canSeeAccounting = !loading && userRole
    ? canUseModule('module_accounting')
    : false;

  const canSeeHouseLeague = !loading && userRole
    ? canUseModule('module_house_league')
    : false;

  const canSeeRepTeams = !loading && userRole
    ? canUseModule('module_rep_teams')
    : false;

  const [attention, setAttention] = useState<AttentionSummary | null>(null);
  const [startupProgress, setStartupProgress] = useState<StartupProgress | null>(null);
  const [startupErrorOrgSlug, setStartupErrorOrgSlug] = useState<string | null>(null);
  const [startupTimeoutOrgSlug, setStartupTimeoutOrgSlug] = useState<string | null>(null);

  const hasOnlyTournamentWorkspace = canSeeTournaments && !canSeePublicSite && !canSeeAccounting && !canSeeHouseLeague && !canSeeRepTeams;
  const startupError = currentOrg ? startupErrorOrgSlug === currentOrg.slug : false;
  const startupTimedOut = currentOrg ? startupTimeoutOrgSlug === currentOrg.slug && !startupProgress : false;

  // Tournament-only workspaces should never show the org hub. Wait for startup
  // progress so we can distinguish "resume setup" from "owner skipped setup."
  useEffect(() => {
    if (loading || !userRole || !currentOrg) return;
    if (!hasOnlyTournamentWorkspace) return;
    if (!startupProgress) return;

    if (startupProgress.firstTournament) {
      router.replace(`${base}/tournaments/dashboard`);
      return;
    }

    if (startupProgress.tasks.tournament === 'skipped') {
      router.replace(`${base}/tournaments`);
      return;
    }

    // Returning user: onboarding was previously completed but all tournaments
    // were archived. Go to tournament management, not the first-run wizard.
    if (currentOrg.onboardingCompletedAt) {
      router.replace(`${base}/tournaments`);
      return;
    }

    router.replace(`${base}/onboarding?continueSetup=1`);
  }, [loading, userRole, currentOrg, hasOnlyTournamentWorkspace, startupProgress, base, router]);

  useEffect(() => {
    if (!hasOnlyTournamentWorkspace || startupProgress || loading || !currentOrg) {
      return;
    }

    const orgSlug = currentOrg.slug;
    const timer = window.setTimeout(() => setStartupTimeoutOrgSlug(orgSlug), 5000);
    return () => window.clearTimeout(timer);
  }, [hasOnlyTournamentWorkspace, startupProgress, loading, currentOrg]);

  useEffect(() => {
    if (loading || !currentOrg) return;
    fetch('/api/admin/attention-summary')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setAttention(data); })
      .catch(() => {});

    const orgSlug = currentOrg.slug;
    fetch(`/api/admin/org/startup-tasks?orgSlug=${encodeURIComponent(orgSlug)}`)
      .then(r => {
        if (!r.ok) throw new Error('Startup tasks unavailable');
        return r.json();
      })
      .then(data => {
        setStartupProgress(data);
        setStartupErrorOrgSlug(current => current === orgSlug ? null : current);
        setStartupTimeoutOrgSlug(current => current === orgSlug ? null : current);
      })
      .catch(() => setStartupErrorOrgSlug(orgSlug));
  }, [loading, currentOrg]);

  if (loading || !userRole) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="hud-label">Loading...</span>
      </div>
    );
  }

  if (hasOnlyTournamentWorkspace && (startupError || startupTimedOut)) {
    return (
      <div className="p-6 max-w-xl">
        <div className="card p-6">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
            <AlertCircle size={18} style={{ color: 'var(--warning)', flexShrink: 0 }} />
            <h1 style={{ margin: 0, color: 'var(--white)', fontSize: '1rem', fontWeight: 900 }}>
              Tournament management is ready
            </h1>
          </div>
          <p style={{ margin: '0 0 1rem', color: 'var(--white-60)', fontSize: '0.88rem', lineHeight: 1.5 }}>
            We could not confirm your setup status, so choose where to continue.
          </p>
          <div style={{ display: 'grid', gap: '0.65rem' }}>
            <Link className="btn btn-primary" href={`${base}/tournaments/dashboard`}>
              Open tournament dashboard
            </Link>
            <Link className="btn btn-ghost" href={`${base}/tournaments`}>
              Manage tournaments
            </Link>
            <Link className="btn btn-ghost" href={`${base}/onboarding?continueSetup=1`}>
              Resume setup
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (hasOnlyTournamentWorkspace) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="hud-label">Opening tournament management...</span>
      </div>
    );
  }

  const tiles = [
    canSeeTournaments && {
      label: 'Tournament Management',
      desc: 'Schedule, results, registrations, and day-to-day tournament operations',
      icon: Trophy,
      href: `${base}/tournaments`,
    },
    canSeeOrgAdmin && {
      label: 'Organization Admin',
      desc: 'Members, subscription, settings, venues, and tournament records',
      icon: Building2,
      href: `${base}/org`,
    },
    canSeePublicSite && {
      label: 'Public Site',
      desc: 'Edit your org-branded public page: tagline, description, and social links',
      icon: Globe,
      href: `${base}/public-site`,
    },
    canSeeAccounting && {
      label: 'Accounting',
      desc: 'Track income, expenses, and financial activity across the org and each tournament',
      icon: DollarSign,
      href: `${base}/accounting`,
    },
    canSeeHouseLeague && {
      label: 'House League',
      desc: 'Manage recreational seasons, player registrations, team placement, scheduling, and standings',
      icon: CalendarDays,
      href: `${base}/house-league`,
    },
    canSeeRepTeams && {
      label: 'Rep Teams',
      desc: 'Manage competitive team programs - tryouts, rosters, player documents, schedules, and team finances',
      icon: Users,
      href: `${base}/rep-teams`,
    },
    canSeeRepTeams && {
      label: 'Coaches Portal',
      desc: 'Switch to the coach-facing view - schedules, rosters, and player documents for assigned teams',
      icon: UserCheck,
      href: `/${currentOrg?.slug ?? ''}/coaches`,
    },
  ].filter(Boolean) as { label: string; desc: string; icon: ElementType; href: string }[];

  const attentionItems: { label: string; href: string }[] = [];
  if (attention) {
    if (attention.pendingTournamentCount > 0) {
      attentionItems.push({
        label: `${attention.pendingTournamentCount} pending tournament registration${attention.pendingTournamentCount === 1 ? '' : 's'}`,
        href: `${base}/tournaments/registrations`,
      });
    }
    if (canSeeHouseLeague && attention.pendingLeagueCount > 0) {
      attentionItems.push({
        label: `${attention.pendingLeagueCount} pending league registration${attention.pendingLeagueCount === 1 ? '' : 's'}`,
        href: attention.openLeagueSeasonId
          ? `${base}/house-league/seasons/${attention.openLeagueSeasonId}/registrations`
          : `${base}/house-league`,
      });
    }
    if (canSeeRepTeams && attention.pendingTryoutCount > 0) {
      attentionItems.push({
        label: `${attention.pendingTryoutCount} open tryout application${attention.pendingTryoutCount === 1 ? '' : 's'}`,
        href: `${base}/rep-teams`,
      });
    }
  }

  return (
    <div className="p-8 max-w-4xl">
      <header className="border-b border-blueprint-blue/60 pb-4 mb-8">
        <div className="hud-label mb-1">Admin</div>
        <h1 className="font-mono font-bold text-2xl uppercase tracking-tight" style={{ color: 'var(--logic-lime)' }}>
          {currentOrg?.name ?? 'Admin'}
        </h1>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {tiles.map(({ label, desc, icon: Icon, href }) => (
          <Link
            key={label}
            href={href}
            className="card p-6 flex gap-4 items-start hover:border-blueprint-blue transition-colors"
          >
            <div className="text-blueprint-blue mt-0.5">
              <Icon size={28} />
            </div>
            <div>
              <div className="font-bold text-fl-text text-base uppercase tracking-wide">{label}</div>
              <div className="text-data-gray text-sm mt-1">{desc}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* F3 — Soft upsell: show teaser tiles for modules not on the current plan */}
      {!loading && userRole === 'owner' && currentOrg && !canSeeAccounting && !canSeeRepTeams && (
        <div style={{ marginTop: '2rem' }}>
          <div style={{
            fontSize: '0.72rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--white-30)',
            marginBottom: '0.75rem',
          }}>
            Coming soon — League &amp; Club plans
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {([
              { label: 'Public Site', desc: 'Branded org page with registration and news — League plan', icon: Globe, plan: 'league' },
              { label: 'House League', desc: 'Recreational seasons, registrations, scheduling, and standings — League plan', icon: CalendarDays, plan: 'league' },
              { label: 'Accounting', desc: 'Income, expenses, and financial activity across the org and tournaments — Club plan', icon: DollarSign, plan: 'club' },
              { label: 'Rep Teams', desc: 'Competitive team programs, tryouts, rosters, player documents, and team finances — Club plan', icon: Users, plan: 'club' },
            ] as const).map(({ label, desc }) => (
              <Link
                key={label}
                href={`${base}/org/billing`}
                className="card p-6 flex gap-4 items-start"
                style={{ opacity: 0.45, cursor: 'default', pointerEvents: 'none' }}
                tabIndex={-1}
                aria-hidden="true"
              >
                <div style={{ color: 'var(--white-30)', marginTop: '0.125rem', flexShrink: 0 }}>
                  <Lock size={20} />
                </div>
                <div>
                  <div className="font-bold text-fl-text text-base uppercase tracking-wide">{label}</div>
                  <div className="text-data-gray text-sm mt-1">{desc}</div>
                </div>
              </Link>
            ))}
          </div>
          <p style={{ marginTop: '0.85rem', fontSize: '0.8rem', color: 'var(--white-30)' }}>
            League and Club plans are in early access.{' '}
            <Link href={`${base}/org/billing`} style={{ color: 'var(--white-50)', textDecoration: 'underline' }}>
              View billing and upgrade options →
            </Link>
          </p>
        </div>
      )}

      {startupProgress && startupProgress.wizardAvailable && !startupProgress.allFinished && (
        <Link
          href={`${base}/onboarding?continueSetup=1`}
          style={{
            marginTop: '2rem',
            padding: '1rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.85rem',
            background: 'rgba(var(--blueprint-blue-rgb),0.08)',
            border: '1px solid rgba(var(--blueprint-blue-rgb),0.28)',
            borderRadius: '2px',
            color: 'var(--white-80)',
            textDecoration: 'none',
          }}
        >
          <Rocket size={18} style={{ color: 'var(--logic-lime)', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: '0.92rem' }}>
              First tournament setup available
            </div>
            <div style={{ color: 'var(--white-50)', fontSize: '0.82rem', marginTop: '0.15rem' }}>
              Start the guided setup wizard and save everything at the final review.
            </div>
          </div>
          <span style={{ color: 'var(--logic-lime)', fontSize: '0.82rem', fontWeight: 800 }}>Start setup -&gt;</span>
        </Link>
      )}

      {attentionItems.length > 0 && (
        <div style={{
          marginTop: '2rem',
          padding: '1rem 1.25rem',
          background: 'rgba(var(--warning-rgb),0.07)',
          border: '1px solid rgba(var(--warning-rgb),0.25)',
          borderRadius: '2px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
            <AlertCircle size={15} style={{ color: 'rgba(var(--warning-rgb),0.8)', flexShrink: 0 }} />
            <span style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(var(--warning-rgb),0.8)' }}>
              Needs attention
            </span>
          </div>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {attentionItems.map(item => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  style={{ fontSize: '0.88rem', color: 'var(--white-80)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                >
                  {item.label} -&gt;
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
