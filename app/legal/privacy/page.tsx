import LegalDocRoute from '@/components/legal/LegalDocRoute';
import { legalPageMetadata } from '@/lib/legal-page-data';

// The current version of the document (GST/HST Stage 6 step 6.2): "not found" while the legal pages are off.
export const dynamic = 'force-dynamic';
export const generateMetadata = () => legalPageMetadata('privacy');

export default function Page() {
  return <LegalDocRoute doc="privacy" />;
}
