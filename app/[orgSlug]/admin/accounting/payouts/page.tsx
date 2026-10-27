import { notFound } from 'next/navigation';
import { getAuthContextWithRole } from '@/lib/api-auth';
import { isOrgBillingSuspended } from '@/lib/org-billing-access';
import { clubHasPayouts } from '@/lib/online-payouts';
import PayoutsList from '@/components/admin/kit/club/money/PayoutsList';

/**
 * Accounting › PAYOUTS (Club Tier Stage 12d-2 Part 2 — frame 3; ask 5, owner 2026-10-26: last in Accounting's row, for
 * everyone who reads Accounting). The layout has already decided the reader may open Accounting. A club that never
 * connected payouts has no tab (words §7 question 6), so its address is no page either — decided here, on the server,
 * before the list mounts. A cancelled club is refused here too (`notFound`), never served: its layout's module gate
 * redirects it out, but a page renders beside its layout, so it opts out of the billing rail's throw and answers itself.
 */
export default async function AccountingPayoutsTab({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const ctx = await getAuthContextWithRole({ orgSlug, allowSuspendedOrg: true });
  if (!ctx || isOrgBillingSuspended(ctx.org) || !(await clubHasPayouts(ctx.org.id))) notFound();
  return <PayoutsList orgSlug={ctx.org.slug} />;
}
