'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Trophy, Building2, Globe, DollarSign, CalendarDays, Users, UserCheck, AlertCircle } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { hasCapability } from '@/lib/roles';

interface AttentionSummary {
  pendingTournamentCount: number;
  pendingLeagueCount: number;
  openLeagueSeasonId: string | null;
  pendingTryoutCount: number;
}

export default function AdminHub() {
  const router = useRouter();
  const { currentOrg, userRole, userCapabilities, loading } = useOrg();
  const base = `/${currentOrg?.slug ?? ''}/admin`;

  const canSeeTournaments = !loading && userRole
    ? hasCapability(userRole, userCapabilities, 'module_tournaments')
    : false;

  const canSeeOrgAdmin = !loading && userRole
    ? userRole === 'owner' || hasCapability(userRole, userCapabilities, 'module_members')
    : false;

  const canSeePublicSite = !loading && userRole
    ? hasCapability(userRole, userCapabilities, 'module_public_site')
    : false;

  const canSeeAccounting = !loading && userRole
    ? hasCapability(userRole, userCapabilities, 'module_accounting')
    : false;

  const canSeeHouseLeague = !loading && userRole
    ? hasCapability(userRole, userCapabilities, 'module_house_league')
    : false;

  const canSeeRepTeams = !loading && userRole
    ? hasCapability(userRole, userCapabilities, 'module_rep_teams')
    : false;

  const [attention, setAttention] = useState<AttentionSummary | null>(null);

  // Auto-forward single-module users who only have tournament access
  useEffect(() => {
    if (loading || !userRole || !currentOrg) return;
    if (canSeeTournaments && !canSeeOrgAdmin) {
      router.replace(`${base}/tournaments/dashboard`);
    }
  }, [loading, userRole, currentOrg, canSeeTournaments, canSeeOrgAdmin, base, router]);

  useEffect(() => {
    if (loading || !currentOrg) return;
    fetch('/api/admin/attention-summary')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setAttention(data); })
      .catch(() => {});
  }, [loading, currentOrg]);

  if (loading || !userRole) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="hud-label">Loading…</span>
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
      desc: 'Members, billing, settings, diamonds, and tournament records',
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
      desc: 'Manage competitive team programs — tryouts, rosters, player documents, schedules, and team finances',
      icon: Users,
      href: `${base}/rep-teams`,
    },
    canSeeRepTeams && {
      label: 'Coaches Portal',
      desc: 'Switch to the coach-facing view — schedules, rosters, and player documents for assigned teams',
      icon: UserCheck,
      href: `/${currentOrg?.slug ?? ''}/coaches`,
    },
  ].filter(Boolean) as { label: string; desc: string; icon: React.ElementType; href: string }[];

  // Build the attention items — only include non-zero counts
  const attentionItems: { label: string; href: string }[] = [];
  if (attention) {
    if (attention.pendingTournamentCount > 0) {
      attentionItems.push({
        label: `${attention.pendingTournamentCount} pending tournament registration${attention.pendingTournamentCount === 1 ? '' : 's'}`,
        href:  `${base}/tournaments/teams`,
      });
    }
    if (attention.pendingLeagueCount > 0) {
      attentionItems.push({
        label: `${attention.pendingLeagueCount} pending league registration${attention.pendingLeagueCount === 1 ? '' : 's'}`,
        href:  attention.openLeagueSeasonId
          ? `${base}/house-league/seasons/${attention.openLeagueSeasonId}/registrations`
          : `${base}/house-league`,
      });
    }
    if (attention.pendingTryoutCount > 0) {
      attentionItems.push({
        label: `${attention.pendingTryoutCount} open tryout application${attention.pendingTryoutCount === 1 ? '' : 's'}`,
        href:  `${base}/rep-teams`,
      });
    }
  }

  return (
    <div className="p-8 max-w-4xl">
      <header className="border-b border-blueprint-blue/60 pb-4 mb-8">
        <div className="hud-label mb-1">Admin</div>
        <h1 className="font-sans font-extrabold text-2xl uppercase tracking-tighter text-fl-text">
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
              <div className="font-sans font-bold text-fl-text text-base uppercase tracking-wide">{label}</div>
              <div className="text-data-gray text-sm mt-1">{desc}</div>
            </div>
          </Link>
        ))}
      </div>

      {attentionItems.length > 0 && (
        <div style={{
          marginTop: '2rem',
          padding: '1rem 1.25rem',
          background: 'rgba(245,158,11,0.07)',
          border: '1px solid rgba(245,158,11,0.25)',
          borderRadius: '0.5rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
            <AlertCircle size={15} style={{ color: 'rgba(245,158,11,0.8)', flexShrink: 0 }} />
            <span style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(245,158,11,0.8)' }}>
              Needs attention
            </span>
          </div>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {attentionItems.map(item => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  style={{ fontSize: '0.88rem', color: 'rgba(255,255,255,0.75)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                >
                  {item.label} →
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
