'use client';
import { useTournament } from '@/lib/tournament-context';
import RulesAdmin from './RulesAdmin';
import { RefreshCw } from 'lucide-react';

export default function RulesAdminPage() {
  const { currentTournament, loading } = useTournament();

  if (loading) {
    return (
      <div className="flex-center" style={{ height: '80vh' }}>
        <RefreshCw className="spin" size={32} />
      </div>
    );
  }

  if (!currentTournament) {
    return (
      <div className="flex-center" style={{ height: '80vh' }}>
        <p className="text-muted">No tournament selected. Please select a tournament from the sidebar.</p>
      </div>
    );
  }

  return <RulesAdmin tournament={currentTournament} />;
}
