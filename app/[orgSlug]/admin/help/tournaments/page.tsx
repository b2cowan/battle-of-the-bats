import HelpPageLayout from '@/components/help/HelpPageLayout';
import tournamentsHelp from '@/lib/help-content/tournaments';

export default function TournamentsHelpPage() {
  return <HelpPageLayout {...tournamentsHelp} />;
}
