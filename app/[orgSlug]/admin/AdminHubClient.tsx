'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { hasModuleEntitlement, isTournamentOnlyWorkspace } from '@/lib/module-entitlements';
import { hasCapability, type Capability } from '@/lib/roles';
import { isTournamentTier } from '@/lib/billing-urls';
import LoadingState from '@/components/shared/LoadingState';
import HelpCallout from '@/components/help/HelpCallout';
import s from '@/app/[orgSlug]/admin/admin-common.module.css';

interface StartupProgress {
  tasks: Record<'plan' | 'tournament' | 'divisions' | 'welcome' | 'venues' | 'contacts', 'pending' | 'complete' | 'skipped'>;
  totalCount: number;
  completeCount: number;
  allFinished: boolean;
  wizardAvailable: boolean;
  firstTournament: { id: string } | null;
}

/**
 * The admin home for a workspace with no club hub (`AdminHub` mounts this for a tournament-only plan).
 * There is no home page here: a member who can see tournaments goes to them (or to setup), and a member who
 * cannot goes to the first area they can open. Only someone who can open nothing sees a page — the
 * "Access restricted" card. ⚖ Owner 2026-10-20 (admin type sweep Stage 5, E1): this replaced the
 * pre-redesign tile page, the last screen still drawn in the old console lettering.
 */
export default function AdminHubClient() {
  const router = useRouter();
  const { currentOrg, userRole, userCapabilities, loading } = useOrg();
  const base = `/${currentOrg?.slug ?? ''}/admin`;

  const canUseModule = (capability: Capability) => !loading && currentOrg && userRole
    ? hasCapability(userRole, userCapabilities, capability) && hasModuleEntitlement(currentOrg, capability)
    : false;

  const canSeeTournaments = canUseModule('module_tournaments');
  // ⚠ A Tournament / Tournament Plus organization has NO /admin/org: its layout (and proxy.ts) send every page of
  // it to /admin/tournaments — the very area this member cannot see — so it is never a door here (the rail hides
  // it for the same reason, `useAdminKitNav`).
  const canSeeOrgAdmin = !loading && userRole && !isTournamentTier(currentOrg?.planId)
    ? (userRole === 'owner' || hasCapability(userRole, userCapabilities, 'module_members')) && canUseModule('module_members')
    : false;

  // The areas this member can open, in the order the old tiles listed them, each asking the same rule its
  // destination's own gate asks (`canOpenModule`), so a door never bounces back here. Families is not offered:
  // its gate also refuses a member limited to some teams, which this context cannot see, and a refused door
  // would loop through this page. On a tournament-only plan almost every member lands on the card below.
  const firstDoor = [
    canSeeOrgAdmin && `${base}/org`,
    canUseModule('module_public_site') && `${base}/public-site`,
    canUseModule('module_accounting') && `${base}/accounting`,
    canUseModule('module_house_league') && `${base}/house-league`,
    canUseModule('module_rep_teams') && `${base}/rep-teams`,
  ].find((href): href is string => typeof href === 'string') ?? null;

  const [startupProgress, setStartupProgress] = useState<StartupProgress | null>(null);
  const [startupErrorOrgSlug, setStartupErrorOrgSlug] = useState<string | null>(null);
  const [startupTimeoutOrgSlug, setStartupTimeoutOrgSlug] = useState<string | null>(null);

  // ⚖ D8: "tournament-only" is a fact about the PLAN, never about the signed-in person. It used to
  // be computed from this member's capabilities, which read a club's vice-president (no module
  // capabilities) as a tournament-only user and redirected them out of the club's hub (A01).
  const hasOnlyTournamentWorkspace = canSeeTournaments && !!currentOrg && isTournamentOnlyWorkspace(currentOrg);
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

    // Setup is the owner's page, and it sends everyone else straight back here — so a non-owner
    // routed into it looped /admin → onboarding → /admin forever (J10-014). They go to tournaments.
    if (startupProgress.tasks.tournament === 'skipped' || userRole !== 'owner') {
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

  // A member who cannot see tournaments goes to the first area they can open.
  useEffect(() => {
    if (loading || !userRole || !currentOrg || hasOnlyTournamentWorkspace || !firstDoor) return;
    router.replace(firstDoor);
  }, [loading, userRole, currentOrg, hasOnlyTournamentWorkspace, firstDoor, router]);

  useEffect(() => {
    if (!hasOnlyTournamentWorkspace || startupProgress || loading || !currentOrg) {
      return;
    }

    const orgSlug = currentOrg.slug;
    const timer = window.setTimeout(() => setStartupTimeoutOrgSlug(orgSlug), 5000);
    return () => window.clearTimeout(timer);
  }, [hasOnlyTournamentWorkspace, startupProgress, loading, currentOrg]);

  useEffect(() => {
    if (loading || !currentOrg || !hasOnlyTournamentWorkspace) return;
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
  }, [loading, currentOrg, hasOnlyTournamentWorkspace]);

  if (loading || !userRole || !currentOrg) {
    return (
      <LoadingState label="Loading the admin home…" />
    );
  }

  if (hasOnlyTournamentWorkspace && (startupError || startupTimedOut)) {
    return (
      <div className="p-6 max-w-xl">
        <div className="card p-6">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
            <AlertCircle size={18} style={{ color: 'var(--warning)', flexShrink: 0 }} />
            <h1 style={{ margin: 0, color: 'var(--white)', fontSize: '1rem', fontWeight: 700 }}>
              Tournament management is ready
            </h1>
          </div>
          <p style={{ margin: '0 0 1rem', color: 'var(--white-60)', fontSize: '0.88rem', lineHeight: 1.5 }}>
            We could not confirm your setup status, so choose where to continue.
          </p>
          <div style={{ display: 'grid', gap: '0.65rem' }}>
            <Link className="btn btn-lime" href={`${base}/tournaments/dashboard`}>
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
      <LoadingState label="Loading tournament management…" />
    );
  }

  if (firstDoor) {
    return (
      <LoadingState label="Loading the admin home…" />
    );
  }

  return (
    <div className={s.page}>
      <HelpCallout
        variant="warning"
        title="Access restricted"
        body="You don't have access to any area here yet. Ask your organization's owner for access."
      />
    </div>
  );
}
