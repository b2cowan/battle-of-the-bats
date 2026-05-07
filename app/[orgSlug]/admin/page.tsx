'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Trophy, Building2 } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { hasCapability } from '@/lib/roles';

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

  // Auto-forward single-module users who only have tournament access
  useEffect(() => {
    if (loading || !userRole || !currentOrg) return;
    if (canSeeTournaments && !canSeeOrgAdmin) {
      router.replace(`${base}/tournaments`);
    }
  }, [loading, userRole, currentOrg, canSeeTournaments, canSeeOrgAdmin, base, router]);

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
      href: `${base}/org/members`,
    },
  ].filter(Boolean) as { label: string; desc: string; icon: React.ElementType; href: string }[];

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
    </div>
  );
}
