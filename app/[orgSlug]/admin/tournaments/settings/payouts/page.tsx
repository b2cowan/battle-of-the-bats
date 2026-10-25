'use client';
/**
 * PAYOUTS on a Tournament plan (Club Tier Stage 12a, A8) — the Payouts card on its own page, reached from the Payouts tile
 * at the end of Settings & access. Tournament and Tournament Plus can't reach the organization's Settings
 * (`admin/org/layout.tsx` sends them away), so this is their one home for it. League and Club keep it in Settings.
 */
import { useEffect, useState } from 'react';
import { useOrg } from '@/lib/org-context';
import { usePageTitle } from '@/lib/usePageTitle';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import PayoutsCard, { loadPayouts, type PayoutsView } from '@/components/admin/kit/club/PayoutsCard';
import LoadingState from '@/components/shared/LoadingState';
import { PAYOUTS_WORDS as W } from '@/lib/online-payment-words';

export default function TournamentPayoutsPage() {
  const { currentOrg } = useOrg();
  usePageTitle(W.tile.title);
  const [view, setView] = useState<PayoutsView | null | undefined>(undefined);
  const slug = currentOrg?.slug ?? '';

  useEffect(() => {
    if (!slug) return;
    let stale = false;
    void loadPayouts(slug).then(v => { if (!stale) setView(v); });
    return () => { stale = true; };
  }, [slug]);

  return (
    <>
      <AdminPageHeader inlineActions title={W.tile.title} />
      {view === undefined ? (
        <LoadingState label="Loading payouts…" />
      ) : view === null ? null : (
        <PayoutsCard orgSlug={slug} clubName={currentOrg?.name ?? ''} home="tournament" initial={view} />
      )}
    </>
  );
}
