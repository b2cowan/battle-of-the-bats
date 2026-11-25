import { redirect } from 'next/navigation';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import { getPlatformAdminContext } from '@/lib/platform-auth';
import { isPlatformOwner } from '@/lib/platform-owner';
import { readPreviewRecords } from '@/lib/prospect-clubs-server';
import { prospectRows } from '@/lib/prospect-clubs';
import kit from '../console.module.css';
import ProspectClubsScreen from './ProspectClubsScreen';

/**
 * Prospect clubs (Club Website Track P, Session P2; owner rulings T2–T6, 2026-11-25; drawing Tx3So1rUqL6shn7CzM93Zr, tab
 * 2). The owner's only, by the one owner allowlist (T2), never a role. The only place a preview shows in platform admin:
 * Clubs & portals leaves previews out (P1); a claimed one moves there and keeps one row here, so the owner can see how
 * many claim (T10). Find still finds a preview by name.
 */
export const metadata = { title: 'Prospect clubs — Support console' };
export const dynamic = 'force-dynamic';

export default async function ProspectClubsPage() {
  const auth = await getPlatformAdminContext();
  if (!auth || !isPlatformOwner(auth)) redirect('/platform-admin');

  let records;
  try {
    records = await readPreviewRecords();
  } catch {
    return (
      <div className={kit.page}>
        <AdminPageHeader title="Prospect clubs" />
        <div className={`${kit.notice} ${kit.noticeBad}`} role="alert">The prospect clubs could not be read just now. Reload to try again.</div>
      </div>
    );
  }
  return <ProspectClubsScreen rows={prospectRows(records, auth.user.id)} />;
}
