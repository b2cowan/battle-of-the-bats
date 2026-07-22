'use client';
import Link from 'next/link';
import { Users2, RefreshCw, MapPin, CreditCard, Settings, FileText, Link2, UserCheck } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { useCurrentOrgCoachAccess } from '@/lib/use-current-org-coach-access';

export default function OrgAdminHub() {
  const { currentOrg, userRole, loading } = useOrg();
  const base = `/${currentOrg?.slug ?? ''}/admin/org`;
  const adminBase = `/${currentOrg?.slug ?? ''}/admin`;
  // Rep-only here: the "My Coaches Portal" tile opens the paid team workspace assigned to the
  // admin in THIS org, so it gates on rep access (not the free-coach signal the shell doors use).
  const coachAccess = useCurrentOrgCoachAccess(
    currentOrg?.slug,
    Boolean(userRole === 'owner' || userRole === 'admin'),
  );

  if (loading || !userRole) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="hud-label">Loading…</span>
      </div>
    );
  }

  const tiles = [
    {
      label: 'Members',
      desc: 'Manage org members, roles, and invitations',
      icon: Users2,
      href: `${base}/members`,
    },
    {
      label: 'Manage Tournaments',
      desc: 'Create tournaments and change Draft, Live, Completed, or Archived state',
      icon: RefreshCw,
      href: `${adminBase}/tournaments/manage`,
    },
    {
      label: 'Venues',
      desc: 'Manage venue locations and field assignments',
      icon: MapPin,
      href: `${base}/venues`,
    },
    ...(userRole === 'owner' || userRole === 'admin' ? [
      {
        label: 'PDF Settings',
        desc: 'Configure header, logo, footer, and branding for all PDF exports',
        icon: FileText,
        href: `${base}/settings/pdf`,
      },
      {
        label: 'Coaches Portal Links',
        desc: 'Invite paid Coaches Portals, review link requests, and see portal-link history',
        icon: Link2,
        href: `${base}/coaches-portal-links`,
      },
      ...(coachAccess.hasRepAccess ? [{
        label: 'My Coaches Portal',
        desc: 'Open the team workspace assigned to you in this organization',
        icon: UserCheck,
        href: `/${currentOrg?.slug ?? ''}/coaches`,
      }] : []),
    ] : []),
    ...(userRole === 'owner' ? [
      {
        label: 'Subscription',
        desc: 'Manage your plan, subscription, and payment method',
        icon: CreditCard,
        href: `${base}/billing`,
      },
      {
        label: 'Settings',
        desc: 'Organization name, slug, contact email, and logo',
        icon: Settings,
        href: `${base}/settings`,
      },
    ] : []),
  ];

  return (
    <div className="p-8 max-w-4xl">
      <header className="border-b border-blueprint-blue/60 pb-4 mb-8">
        <div className="hud-label mb-1">Organization</div>
        <h1 className="font-extrabold text-2xl uppercase tracking-tighter">
          {currentOrg?.name ?? 'Organization Admin'}
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
    </div>
  );
}
