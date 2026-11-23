import HelpPageLayout from '@/components/help/HelpPageLayout';
import orgHelp from '@/lib/help-content/org';
import { withoutHeldHelp } from '@/lib/help-content/held';

export default function PlatformAdminOrgHelpPage() {
  return <HelpPageLayout {...withoutHeldHelp(orgHelp)} />;
}
