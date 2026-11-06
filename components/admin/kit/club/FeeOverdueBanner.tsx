'use client';
/**
 * FeeOverdueBanner — Fee invoice alerts Part 4: once a FieldLogicHQ fee invoice is OVERDUE, every club admin page opens with one
 * red-edged line, the words and a Pay button. No dismiss, it scrolls away with the page, and it ends when the invoice is paid.
 *
 * ⚖ Rulings (drawings 2026-11-05, asks 5–6; Q1, Q4–Q6 ruled the same day): the owner alone (`billingLink != null` is the client's
 * owner test, as the pill's); beside the rail at the top of the content column; the figure rides the club brief (`feesOwed`, no
 * second fetch) with the one overdue invoice's number, total, day and https pay link when exactly one is overdue; a cancelled club
 * has no banner here (its only page, Plan & billing, draws the same line from its own read). Fee invoices never switch an account
 * off, so the words never say what waiting costs. The sentences are Part 3's own (`overdueBannerFor`), never typed here.
 *
 * `role="status"` on purpose: the banner is persistent and the same news is on Plan & billing, so it must not interrupt every
 * screen reader the moment the brief arrives (the failed-payment callout there is the `alert`).
 */
import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ExternalLink } from 'lucide-react';
import { overdueBannerFor } from '@/lib/fee-invoice-line';
import { seeFeeInvoices } from '@/components/billing/seeFeeInvoices';
import { useOrg } from '@/lib/org-context';
import { useIsSandbox } from '@/components/sandbox/SandboxProvider';
import { kitBillingLink } from '@/lib/admin-kit-nav';
import { useClubBrief } from './ClubBriefProvider';
import styles from './FeeOverdueBanner.module.css';

export default function FeeOverdueBanner() {
  // Not `useAdminKitNav`: that hook also fetches the coach's team access and builds every rail list, and this runs on every admin page.
  const { currentOrg, userRole, userCapabilities } = useOrg();
  const isSandbox = useIsSandbox();
  const billingLink = kitBillingLink({ orgSlug: currentOrg?.slug ?? '', planId: currentOrg?.planId, accountKind: currentOrg?.accountKind, role: userRole, capabilities: userCapabilities, isSandbox });
  const { brief, reload } = useClubBrief();
  const pathname = usePathname();
  const line = billingLink ? overdueBannerFor(brief?.feesOwed) : null;
  const onBilling = !!billingLink && pathname.startsWith(billingLink.href);

  // After paying in Stripe's tab the owner comes back to a page still wearing the banner: read the brief again when the tab returns
  // (the club brief's own refresh, not a poller). Plan & billing already does this through its fee read, so it is left alone there.
  const watching = !!line && !onBilling;
  useEffect(() => {
    if (!watching) return;
    const back = () => { if (document.visibilityState === 'visible') reload(); };
    document.addEventListener('visibilitychange', back);
    return () => document.removeEventListener('visibilitychange', back);
  }, [watching, reload]);

  if (!line || !billingLink) return null;
  const { action } = line;
  return (
    <div className={styles.banner} role="status">
      <p className={styles.text}><strong>{line.lead}</strong>{line.detail && <> {line.detail}</>}</p>
      {action.kind === 'pay'
        ? <a className={`btn btn-lime ${styles.button}`} href={action.href} target="_blank" rel="noopener noreferrer" aria-label={action.aria}>
            {action.label}<ExternalLink size={13} aria-hidden />
          </a>
        // On Plan & billing the list is right below, so the button scrolls to it; anywhere else it opens Plan & billing.
        : <Link className={`btn btn-outline ${styles.button}`} href={billingLink.href} aria-label={action.aria}
            onClick={e => { if (onBilling && seeFeeInvoices()) e.preventDefault(); }}>{action.label}</Link>}
    </div>
  );
}
