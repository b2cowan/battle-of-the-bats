import HelpPageLayout from '@/components/help/HelpPageLayout';
import orgHelp from '@/lib/help-content/org';

export default function OrgHelpPage() {
  return <HelpPageLayout {...orgHelp} />;
}
