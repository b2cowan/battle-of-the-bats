import BankTab from '@/components/admin/kit/club/money/bank/BankTab';

/**
 * Accounting › BANK (Bank reconciliation R2c; B8: right after the Ledger). The layout has already decided, on the
 * server, that the reader may open Accounting (`canOpenModule`, as every tab) — the Ledger tab's gate, nothing added:
 * unlike Payouts the tab is there for every club, always (it is where a club starts), and B7 is the routes' — a reader
 * sees the same tab with its write controls absent. No Year pill: a statement may straddle a fiscal year (B3).
 */
export default async function AccountingBankTab({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  return <BankTab orgSlug={orgSlug} />;
}
