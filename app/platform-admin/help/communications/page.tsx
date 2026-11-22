import HelpPageLayout from '@/components/help/HelpPageLayout';
import communicationsHelp from '@/lib/help-content/communications';

export default function PlatformAdminCommunicationsHelpPage() {
  return <HelpPageLayout {...communicationsHelp} />;
}
