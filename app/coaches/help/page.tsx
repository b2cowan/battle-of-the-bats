import HelpPageLayout from '@/components/help/HelpPageLayout';
import coachesHelp from '@/lib/help-content/coaches';

export default function CoachesStandaloneHelpPage() {
  return <HelpPageLayout {...coachesHelp} />;
}
