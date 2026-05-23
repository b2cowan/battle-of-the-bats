import HelpPageLayout from '@/components/help/HelpPageLayout';
import coachesHelp from '@/lib/help-content/coaches';

export default function PlatformAdminCoachesHelpPage() {
  return <HelpPageLayout {...coachesHelp} />;
}
