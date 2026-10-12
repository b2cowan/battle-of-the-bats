'use client';
import { useTournament } from '@/lib/tournament-context';
import { useOrg } from '@/lib/org-context';
import { usePageTitle } from '@/lib/usePageTitle';
import RulesAdmin from './RulesAdmin';
import LoadingState from '@/components/shared/LoadingState';

export default function RulesAdminPage() {
  const { currentTournament, loading } = useTournament();
  const { currentOrg } = useOrg();
  usePageTitle('Rules & Resources');

  if (!currentTournament) {
    // The tournament itself still loading is a wait, not "no tournament" (the rules' own words).
    if (loading) return <LoadingState label="Loading the rules…" />;
    return (
      <div className="flex-center" style={{ height: '80vh' }}>
        <p className="text-muted">No tournament selected. Please select a tournament from the sidebar.</p>
      </div>
    );
  }

  return <RulesAdmin tournament={currentTournament} orgSlug={currentOrg?.slug} />;
}
