'use client';
import { useTournament } from '@/lib/tournament-context';
import { useOrg } from '@/lib/org-context';
import { usePageTitle } from '@/lib/usePageTitle';
import RulesAdmin from './RulesAdmin';

export default function RulesAdminPage() {
  const { currentTournament } = useTournament();
  const { currentOrg } = useOrg();
  usePageTitle('Rules & Resources');

  if (!currentTournament) {
    return (
      <div className="flex-center" style={{ height: '80vh' }}>
        <p className="text-muted">No tournament selected. Please select a tournament from the sidebar.</p>
      </div>
    );
  }

  return <RulesAdmin tournament={currentTournament} orgSlug={currentOrg?.slug} />;
}
