import type { Metadata } from 'next';
import { requirePlatformAreaView } from '@/lib/platform-auth';
import { canViewPlatformArea } from '@/lib/platform-areas';
import { consoleSiteName, peekStatus } from '@/lib/platform-status';
import StatusClient from './StatusClient';

export const metadata: Metadata = { title: 'Status — Support console' };
export const dynamic = 'force-dynamic';

/**
 * STATUS — is the platform healthy right now? (Support console Stage 5, owner Q1/Q2/Q3/G3 2026-10-26; drawings
 * BQmiMi3jXGKBwXQHr8UugB, A and G). First under Health; every staff role reads it.
 *
 * The truth is shown when the screen opens (R7): our own records and our database are read here, at once; the outside
 * providers (Amplify, the staging site, Supabase) come from the shared reading when it is under 30 seconds old, else the
 * page draws them as "Reading…" and asks the route, which reads them for everyone.
 *
 * Not judged here, and the foot says so: week-over-week trends, database advisors and agent tooling, which stay in the
 * owner's morning check (Q2 = B; nothing here reads it or touches it).
 */
export default async function StatusPage() {
  const auth = await requirePlatformAreaView('status');
  const initial = await peekStatus();
  return <StatusClient initial={initial} site={consoleSiteName()} canOpenErrors={canViewPlatformArea(auth.role, 'observability')} />;
}
