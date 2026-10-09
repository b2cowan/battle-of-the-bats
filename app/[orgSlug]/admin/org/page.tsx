'use client';
import Link from 'next/link';
import { Users2, RefreshCw, MapPin, CreditCard, Settings, FileText, UserCheck } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { useCurrentOrgCoachAccess } from '@/lib/use-current-org-coach-access';
import { hasOrgVenueLibrary } from '@/lib/plan-features';
import AdminPageHeader from '@/components/admin/AdminPageHeader';

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
      label: 'Tournaments',
      desc: 'Every tournament in one list: start one, reuse a setup, or change its status',
      icon: RefreshCw,
      href: `${adminBase}/tournaments/manage`,
    },
    // ⚖ ONE NAME, AND THE PLAN'S GATE (Club Tier Stage 6b, S6-11): the rail, the page and this tile all say "Venue
    // library", and the tile shows only on a plan that carries it — a League-or-lower club no longer gets a door to a
    // page that says it isn't on the plan. Copy for /marketing.
    ...(hasOrgVenueLibrary(currentOrg?.planId) ? [{
      label: 'Venue library',
      desc: 'The club’s venues and their facilities, booked by every program',
      icon: MapPin,
      href: `${base}/venues`,
    }] : []),
    ...(userRole === 'owner' || userRole === 'admin' ? [
      {
        label: 'PDF Settings',
        desc: 'Configure header, logo, footer, and branding for all PDF exports',
        icon: FileText,
        href: `${base}/settings/pdf`,
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
    // The portal's reading column (960px), centred, like every club page (owner 2026-10-07; see ClubKit.module.css).
    <div className="p-8 max-w-[960px] mx-auto">
      <AdminPageHeader
        eyebrow="Organization"
        title={currentOrg?.name ?? 'Organization Admin'}
      />

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
              <div className="font-bold text-fl-text text-base">{label}</div>
              <div className="text-data-gray text-sm mt-1">{desc}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
