import HelpPageLayout from '@/components/help/HelpPageLayout';
import familiesHelp from '@/lib/help-content/families';

export default function PlatformAdminFamiliesHelpPage() {
  return <HelpPageLayout {...familiesHelp} />;
}
