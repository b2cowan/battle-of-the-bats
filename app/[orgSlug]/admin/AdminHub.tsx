'use client';
/**
 * The admin hub, behind the Admin Design Continuity switch (Club Tier Stage 1, screens session).
 * Off: today's hub (`AdminHubClient`), untouched. On: the club's hub on the kit (`ClubHubKit`).
 *
 * A tournament-only workspace has no club hub in either version — today's component sends it to its
 * tournaments (with its setup fallback), so it keeps doing that job with the switch on too.
 * ⚠ The release slice deletes this file's legacy branch and `AdminHubClient` with it.
 */
import dynamic from 'next/dynamic';
import { useOrg } from '@/lib/org-context';
import { isTournamentOnlyWorkspace } from '@/lib/module-entitlements';
import { useAdminKit } from '@/components/admin/AdminKitProvider';
import AdminHubClient from './AdminHubClient';

// Kit only — its source rides no switch-off page (the frame's own `/simplify` rule, slice 1).
const ClubHubKit = dynamic(() => import('@/components/admin/kit/club/ClubHubKit'));

export default function AdminHub() {
  const kit = useAdminKit();
  const { currentOrg } = useOrg();
  if (!kit || !currentOrg || isTournamentOnlyWorkspace(currentOrg)) return <AdminHubClient />;
  return <ClubHubKit />;
}
