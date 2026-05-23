import HelpPageLayout from '@/components/help/HelpPageLayout';
import platformAdminHelp from '@/lib/help-content/platform-admin';

export default function PlatformAdminOperationsHelpPage() {
  return <HelpPageLayout {...platformAdminHelp} />;
}
