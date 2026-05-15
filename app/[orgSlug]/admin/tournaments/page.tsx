'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useOrg } from '@/lib/org-context';
import { useTournament } from '@/lib/tournament-context';

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
    <div className="flex items-center justify-center h-64">
      <span className="hud-label">Loading…</span>
    </div>
  );
}
