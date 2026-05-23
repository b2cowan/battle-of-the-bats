import HelpPageLayout from '@/components/help/HelpPageLayout';
import repTeamsHelp from '@/lib/help-content/rep-teams';

export default function PlatformAdminRepTeamsHelpPage() {
  return <HelpPageLayout {...repTeamsHelp} />;
}
