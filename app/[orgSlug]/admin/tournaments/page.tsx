'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useOrg } from '@/lib/org-context';
import { useTournament } from '@/lib/tournament-context';
import LoadingState from '@/components/shared/LoadingState';

export default function TournamentsRedirect() {
  const router = useRouter();
  const { currentOrg, loading } = useOrg();
  const { currentTournament, loading: eventsLoading } = useTournament();

  useEffect(() => {
    // Wait for the event list too: the foot's Tournaments door lands here from a club page, where the list may still be
    // reading, and an empty answer would send a club that has events to the list instead of an event's Dashboard.
    if (loading || eventsLoading || !currentOrg) return;
    const slug = currentOrg.slug;
    if (currentTournament) {
      router.replace(`/${slug}/admin/tournaments/dashboard`);
    } else {
      router.replace(`/${slug}/admin/tournaments/manage`);
    }
  }, [loading, eventsLoading, currentOrg, currentTournament, router]);

  return (
    <LoadingState label="Loading tournaments…" />
  );
}
