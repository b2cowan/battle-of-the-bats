import { redirect } from 'next/navigation';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import { getPlatformAdminContext } from '@/lib/platform-auth';
import { isPlatformOwner } from '@/lib/platform-owner';
import { readPreviewRecords } from '@/lib/prospect-clubs-server';
import { readClaimedFacts } from '@/lib/preview-claim-server';
import { prospectRows } from '@/lib/prospect-clubs';
import { claimedPlanLine, maskClaimantEmail } from '@/lib/preview-claim';
import kit from '../console.module.css';
import ProspectClubsScreen, { type ClaimedFacts } from './ProspectClubsScreen';

/**
 * Prospect clubs (Club Website Track P, Session P2; owner rulings T2–T6, 2026-11-25; drawing Tx3So1rUqL6shn7CzM93Zr, tab
 * 2). The owner's only, by the one owner allowlist (T2), never a role. The only place a preview shows in platform admin:
 * Clubs & portals leaves previews out (P1); a claimed one moves there and keeps one row here, so the owner can see how
 * many claim (T10). Find still finds a preview by name.
 *
 * Session P3: an open row opens its room window; a claimed row carries its plan line and the claimant's masked email
 * (T15, "Came from a preview" is this row, never a figure in Business numbers, T10) and opens its claim window.
 */
export const metadata = { title: 'Prospect clubs — Support console' };
export const dynamic = 'force-dynamic';

export default async function ProspectClubsPage() {
  const auth = await getPlatformAdminContext();
  if (!auth || !isPlatformOwner(auth)) redirect('/platform-admin');

  let records;
  let claimed: Record<string, ClaimedFacts> = {};
  try {
    records = await readPreviewRecords();
    const facts = await readClaimedFacts(records.filter(r => r.claimedAt).map(r => r.orgId));
    claimed = Object.fromEntries([...facts].map(([id, f]) => [id, {
      plan: claimedPlanLine(f.planLabel, f.subscriptionStatus),
      claimant: maskClaimantEmail(f.claimantEmail),
      planStarted: f.planLabel !== null || f.reachedCheckout,
    }]));
  } catch {
    return (
      <div className={kit.page}>
        <AdminPageHeader title="Prospect clubs" />
        <div className={`${kit.notice} ${kit.noticeBad}`} role="alert">The prospect clubs could not be read just now. Reload to try again.</div>
      </div>
    );
  }
  return <ProspectClubsScreen rows={prospectRows(records, auth.user.id)} claimed={claimed} />;
}
