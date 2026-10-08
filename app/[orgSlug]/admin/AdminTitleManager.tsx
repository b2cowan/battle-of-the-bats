'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useOrg } from '@/lib/org-context';
import { useTournament } from '@/lib/tournament-context';

const ROUTE_LABELS: Array<[RegExp, string]> = [
  [/\/admin\/onboarding$/, 'Onboarding'],
  [/\/admin\/dashboard$/, 'Admin Dashboard'],
  [/\/admin\/help(?:\/.*)?$/, 'Help'],
  // One name per page (Tournament admin redesign Stage 4): the tab says what the title says.
  [/\/admin\/org\/tournaments(?:\/.*)?$/, 'Tournaments'],
  [/\/admin\/org\/members(?:\/.*)?$/, 'Members'],
  [/\/admin\/org\/billing(?:\/.*)?$/, 'Billing'],
  [/\/admin\/org\/venues(?:\/.*)?$/, 'Venues'],
  [/\/admin\/org\/settings(?:\/.*)?$/, 'Organization Settings'],
  [/\/admin\/org(?:\/)?$/, 'Organization'],
  [/\/admin\/tournaments\/preview\/[^/]+(?:\/.*)?$/, 'Preview Site'],
  [/\/admin\/tournaments\/dashboard$/, 'Tournament Dashboard'],
  [/\/admin\/tournaments\/manage(?:\/.*)?$/, 'Tournaments'],
  [/\/admin\/tournaments\/venues(?:\/.*)?$/, 'Venues'],
  [/\/admin\/tournaments\/divisions(?:\/.*)?$/, 'Divisions'],
  [/\/admin\/tournaments\/registrations(?:\/.*)?$/, 'Registrations'],
  [/\/admin\/tournaments\/schedule(?:\/.*)?$/, 'Schedule'],
  [/\/admin\/tournaments\/results(?:\/.*)?$/, 'Results'],
  [/\/admin\/tournaments\/rules(?:\/.*)?$/, 'Rules & Resources'],
  [/\/admin\/tournaments\/communication(?:\/.*)?$/, 'Communication'],
  [/\/admin\/tournaments\/branding(?:\/.*)?$/, 'Tournament Branding'],
  [/\/admin\/tournaments\/summary(?:\/.*)?$/, 'Summary'],
  // Stage 6 (2026-10-07): the tab said "Admin" — and "Staff Kit" before that; one spelling, the title's.
  [/\/admin\/tournaments\/staff-kit(?:\/.*)?$/, 'Staff kit'],
  [/\/admin\/tournaments\/settings\/event(?:\/.*)?$/, 'Event Settings'],
  [/\/admin\/tournaments\/settings(?:\/.*)?$/, 'Tournament Settings'],
  [/\/admin\/tournaments(?:\/)?$/, 'Tournaments'],
  [/\/admin\/house-league(?:\/.*)?$/, 'House League'],
  [/\/admin\/rep-teams(?:\/.*)?$/, 'Rep Teams'],
  [/\/admin\/accounting(?:\/.*)?$/, 'Accounting'],
  [/\/admin\/public-site(?:\/.*)?$/, 'Public Site'],
  [/\/admin\/org\/notifications(?:\/.*)?$/, 'Org Notifications'],
  [/\/admin(?:\/)?$/, 'Admin'],
];

function routeLabel(pathname: string) {
  return ROUTE_LABELS.find(([pattern]) => pattern.test(pathname))?.[1] ?? 'Admin';
}

function previewLabel(pathname: string, tournamentStatus?: string) {
  if (!pathname.includes('/admin/tournaments/preview/')) return null;
  return 'Preview Site';
}

export default function AdminTitleManager() {
  const pathname = usePathname();
  const { currentOrg } = useOrg();
  const { currentTournament } = useTournament();

  useEffect(() => {
    const label = previewLabel(pathname, currentTournament?.status) ?? routeLabel(pathname);
    const parts = [
      label,
      currentTournament?.name,
      currentOrg?.name,
      'FieldLogicHQ',
    ].filter(Boolean);

    document.title = parts.join(' - ');
  }, [pathname, currentOrg?.name, currentTournament?.name, currentTournament?.status]);

  return null;
}
