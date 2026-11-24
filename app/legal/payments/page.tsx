import LegalDocRoute from '@/components/legal/LegalDocRoute';
import { legalPageMetadata } from '@/lib/legal-page-data';

// The Payments Terms in force (published 2026-11-24): the newest version. An owner agrees to them in the Payouts card, never here.
export const dynamic = 'force-dynamic';
export const generateMetadata = () => legalPageMetadata('payments');

export default function Page() {
  return <LegalDocRoute doc="payments" />;
}
