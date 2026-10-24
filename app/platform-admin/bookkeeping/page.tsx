import { redirect } from 'next/navigation';
import { getPlatformAdminContext } from '@/lib/platform-auth';
import { canAccessBookkeeping } from '@/lib/bookkeeping-access';
import { currentExpenses, redactExpenseRevision } from '@/lib/bookkeeping-expenses';
import { listExpenseRevisions } from '@/lib/bookkeeping-store';
import BookkeepingClient from './BookkeepingClient';

export const metadata = { title: 'Bookkeeping — FieldLogicHQ' };

export default async function BookkeepingPage() {
  const auth = await getPlatformAdminContext();
  if (!auth || !canAccessBookkeeping(auth)) redirect('/platform-admin');
  const rows = await listExpenseRevisions();
  if (rows.length > 1000) throw new Error('Bookkeeping register requires pagination before more records can be shown');
  const revisions = rows.map(redactExpenseRevision);
  return <BookkeepingClient initialExpenses={currentExpenses(revisions)} initialRevisions={revisions} />;
}
