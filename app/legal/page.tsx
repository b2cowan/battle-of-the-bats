import { redirectToLegalDoc } from '@/components/legal/LegalDocRoute';

// A short address to the current page (GST/HST Stage 6 step 6.2); "not found" while the legal pages are off.
export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };

export default function Page() {
  redirectToLegalDoc('terms');
}
