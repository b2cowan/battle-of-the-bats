import { notFound, redirect } from 'next/navigation';
import { legalPagePath } from '@/lib/legal-links';
import { legalPagesOn } from '@/lib/legal-pages-switch';

// A short address to the current page (GST/HST Stage 6 step 6.2). A PAGE-level redirect, not a next.config one: a config redirect is
// unconditional and would announce the pages while they are dark. Off, this is "not found".
export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };

export default function Page() {
  if (!legalPagesOn()) notFound();
  redirect(legalPagePath('terms'));
}
