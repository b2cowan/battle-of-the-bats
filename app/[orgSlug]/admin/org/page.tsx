'use client';
import Link from 'next/link';
import { Users2, RefreshCw, MapPin, CreditCard, Settings } from 'lucide-react';
import { useOrg } from '@/lib/org-context';

export default function OrgAdminHub() {
  const { currentOrg, userRole, loading } = useOrg();
  const base = `/${currentOrg?.slug ?? ''}/admin/org`;

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
      label: 'Tournament Records',
      desc: 'Historical and archived tournament data',
      icon: RefreshCw,
      href: `${base}/tournaments`,
    },
    {
      label: 'Diamonds',
      desc: 'Manage field locations and diamond assignments',
      icon: MapPin,
      href: `${base}/diamonds`,
    },
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
        <h1 className="font-sans font-extrabold text-2xl uppercase tracking-tighter text-fl-text">
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
              <div className="font-sans font-bold text-fl-text text-base uppercase tracking-wide">{label}</div>
              <div className="text-data-gray text-sm mt-1">{desc}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
