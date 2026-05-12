import HelpPageLayout from '@/components/help/HelpPageLayout';
import registrationsHelp from '@/lib/help-content/registrations';

export default function RegistrationsHelpPage() {
  return <HelpPageLayout {...registrationsHelp} />;
}
