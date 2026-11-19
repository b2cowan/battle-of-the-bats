import { redirectToLegalDoc } from '@/components/legal/LegalDocRoute';

// A short address to the current page (Board Ready 0a-5); "not found" until the page has a published text.
export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };

export default function Page() {
  redirectToLegalDoc('data-terms');
}
