import type { Metadata } from 'next';
import { requirePlatformAreaView } from '@/lib/platform-auth';
import { SENT_LOG_PAGE, listSentLogRows } from '@/lib/sent-log-people';
import SentEmailsClient from './SentEmailsClient';

export const metadata: Metadata = { title: 'Sent emails — Support console' };
export const dynamic = 'force-dynamic';

/**
 * SENT EMAILS: every account email we sent and what happened to it (Support console Stage 5, owner Q3/Q6 2026-10-26;
 * drawing E3, E4). Under Health. Super admin, Support and Billing read it (the `sent_log` power, which the `sent_emails`
 * area carries); the roles that may not never see the entry or the page.
 *
 * The newest emails render here on the server (browsing is not a search and is not counted). A search is a POST with the
 * whole address in its body (A3) and is counted against the staff member's daily limit by the route. `?email={id}` opens
 * one email's window straight away: it is how Find's "Sent emails" group arrives, by the email's id and never by its
 * address (the address is search words, and words never ride in a web address).
 */
export default async function SentEmailsPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const auth = await requirePlatformAreaView('sent_emails');
  const { email } = await searchParams;
  // A list that cannot be read says so; it never reads as "nothing has been recorded".
  const first = await listSentLogRows(auth.role, {}).catch(() => null);
  const openEmailId = typeof email === 'string' && /^[0-9a-f-]{36}$/i.test(email) ? email : null;
  return <SentEmailsClient initialRows={first?.rows ?? []} initialTotal={first?.total ?? 0} initialFailed={!first} pageSize={SENT_LOG_PAGE} openEmailId={openEmailId} />;
}
