import HelpPageLayout from '@/components/help/HelpPageLayout';
import accountingHelp from '@/lib/help-content/accounting';

export default function AccountingHelpPage() {
  return <HelpPageLayout {...accountingHelp} />;
}
