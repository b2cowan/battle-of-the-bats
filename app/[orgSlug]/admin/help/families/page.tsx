import HelpPageLayout from '@/components/help/HelpPageLayout';
import familiesHelp from '@/lib/help-content/families';

export default function FamiliesHelpPage() {
  return <HelpPageLayout {...familiesHelp} />;
}
