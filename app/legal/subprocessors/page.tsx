import LegalDocRoute from '@/components/legal/LegalDocRoute';
import { legalPageMetadata } from '@/lib/legal-page-data';

// The list of the companies that handle your information, newest copy (Board Ready 0a-5): "not found" until its first copy
// publishes. A living page: its earlier copies are the record, not pages, so there is no `[version]` route.
export const dynamic = 'force-dynamic';
export const generateMetadata = () => legalPageMetadata('subprocessors');

export default function Page() {
  return <LegalDocRoute doc="subprocessors" />;
}
