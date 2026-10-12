'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useOrg } from '@/lib/org-context';
import { useTournament } from '@/lib/tournament-context';
import LoadingState from '@/components/shared/LoadingState';

export default function TournamentsRedirect() {
  const router = useRouter();
  const { currentOrg, loading } = useOrg();
  const { currentTournament } = useTournament();

  useEffect(() => {
    if (loading || !currentOrg) return;
    const slug = currentOrg.slug;
    if (currentTournament) {
      router.replace(`/${slug}/admin/tournaments/dashboard`);
    } else {
      router.replace(`/${slug}/admin/tournaments/manage`);
    }
  }, [loading, currentOrg, currentTournament, router]);

  return (
    <LoadingState label="Loading tournaments…" />
  );
}
