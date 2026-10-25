import { redirect } from 'next/navigation';

/** The season's Ledger is called Money now (Club Tier Stage 9a, Q18): an old link lands on it. */
export default async function LedgerMoved({ params }: { params: Promise<{ orgSlug: string; seasonId: string }> }) {
  const { orgSlug, seasonId } = await params;
  redirect(`/${orgSlug}/admin/house-league/seasons/${seasonId}/money`);
}
