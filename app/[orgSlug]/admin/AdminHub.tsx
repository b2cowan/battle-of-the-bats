'use client';
/**
 * The admin hub: the club's hub on the kit (`ClubHubKit`, Club Tier Stage 1).
 *
 * A tournament-only workspace has no club hub — `AdminHubClient` sends it to its tournaments (with its
 * setup fallback), and it also holds the moment before the organization has loaded. The switch-off branch
 * that also rendered it went with Admin Design Continuity Part B (area 2, 2026-09-29).
 */
import dynamic from 'next/dynamic';
import { useOrg } from '@/lib/org-context';
import { isTournamentOnlyWorkspace } from '@/lib/module-entitlements';
import AdminHubClient from './AdminHubClient';

// Its own chunk, as it always was: a static import would move its sheets in the bundle (Part B area 1's rule).
const ClubHubKit = dynamic(() => import('@/components/admin/kit/club/ClubHubKit'));

export default function AdminHub() {
  const { currentOrg } = useOrg();
  if (!currentOrg || isTournamentOnlyWorkspace(currentOrg)) return <AdminHubClient />;
  return <ClubHubKit />;
}
