import type { Metadata } from 'next';
import Link from 'next/link';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import { requirePlatformAreaView } from '@/lib/platform-auth';
import { readOnlinePaymentsHealth, type HealthRow } from '@/lib/platform-online-payments';
import { PA_WORDS } from '@/lib/online-payment-words';
import { consoleDay } from '@/lib/console-dates';
import { formatStoredDate } from '@/lib/timezone';
import kit from '../console.module.css';

export const metadata: Metadata = { title: 'Online payments — Support console' };
export const dynamic = 'force-dynamic';

/**
 * HEALTH › ONLINE PAYMENTS, EVERY CLUB (Club Tier Stage 12d-2 Part 5 — words §6.2; ask 7: read only; owner ruling 3,
 * 2026-10-27: Super admin, Billing and Support). One list, "Needs a look", most urgent first (builder's call): open
 * disputes by answer-by, a club disconnected with a dispute open, an account Stripe closed, Stripe messages we couldn't
 * process, a Stripe fee that couldn't be billed, a club's own fee invoice unpaid, a club not on the current terms (once
 * counsel's version exists). A row leaves when it clears. Each opens the club's Online payments tab. Nothing here writes.
 */
const H = PA_WORDS.health;

function what(r: HealthRow): string {
  const due = r.due ? formatStoredDate(r.due, { withYear: false }) : null;
  switch (r.kind) {
    case 'dispute': return H.dispute(r.n, due);
    case 'disconnected': return H.disconnected(r.n);
    case 'closed': return H.closed;
    case 'messages': return H.messages(r.n);
    case 'terms': return H.terms;
    case 'invoice': return H.invoice;
    case 'fee_failed': return H.feeFailed;
  }
}

export default async function OnlinePaymentsHealthPage() {
  await requirePlatformAreaView('online_payments');
  // A list that cannot be read says so; it never reads as "nothing needs a look".
  const rows = await readOnlinePaymentsHealth().catch(() => null);
  return (
    <>
      <AdminPageHeader title={H.title} />
      <section className={kit.section}>
        <div className={kit.card}>
          <h2 className={kit.sectionTitle}>{H.needs}</h2>
          {!rows ? (
            <p className={kit.caption} role="alert">{H.readFailed}</p>
          ) : rows.length === 0 ? (
            <p className={kit.caption}>{H.empty}</p>
          ) : (
            <div className={kit.tableWrap}>
              <table className={kit.comfortable}>
                <thead><tr><th>{H.col.club}</th><th>{H.col.what}</th><th>{H.col.since}</th></tr></thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={`${r.orgId}:${r.kind}`}>
                      <td><Link href={`/platform-admin/orgs/${r.orgId}?tab=payments`}>{r.club || 'A club'}</Link></td>
                      <td>{what(r)}</td>
                      <td>{consoleDay(r.since)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
