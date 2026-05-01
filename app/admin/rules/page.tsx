'use client';
import { useTournament } from '@/lib/tournament-context';
import RulesAdmin from './RulesAdmin';

export default function RulesAdminPage() {
  const { currentTournament } = useTournament();

  if (!currentTournament) {
    return (
      <div className="flex-center" style={{ height: '80vh' }}>
        <p className="text-muted">No tournament selected. Please select a tournament from the sidebar.</p>
      </div>
    );
  }

  return <RulesAdmin tournament={currentTournament} />;
}
