import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import { COACHES_NOTIFICATIONS_PATH } from '@/lib/coaches-portal-routes';
import CoachNotificationsPage from '@/components/coaches/CoachNotificationsPage';

export const metadata = { title: 'Notifications - Coaches Portal' };

/**
 * The free Coaches Portal's Notifications (Free coach header parity, the phone step, owner 2026-10-15): the
 * PAID portal's page — the same component in its free mode, never a copy — reading the free coach's bell
 * (their own notices from every host club). On a phone it is the first row of the team bar's More, which is
 * lit here; on a computer the bell is the strip's drawer, and this page is where an old link or a help
 * article lands. No team header above it: the list covers every team the coach has (RDC1).
 */
export default async function FreeCoachNotificationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) redirect(`/auth/login?next=${COACHES_NOTIFICATIONS_PATH}`);
  return <CoachNotificationsPage free />;
}
