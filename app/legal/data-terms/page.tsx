import LegalDocRoute from '@/components/legal/LegalDocRoute';
import { legalPageMetadata } from '@/lib/legal-page-data';

// The Data Terms in force (Board Ready 0a-5): "not found" until the Terms version that carries them publishes their first text.
export const dynamic = 'force-dynamic';
export const generateMetadata = () => legalPageMetadata('data-terms');

export default function Page() {
  return <LegalDocRoute doc="data-terms" />;
}
