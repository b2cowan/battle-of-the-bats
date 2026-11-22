import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import SecurityPage from '@/components/legal/SecurityPage';
import { resolveLegalLinks } from '@/lib/legal-links';
import { SECURITY_PATH } from '@/lib/legal-paths';
import { marketingMetadata } from '@/lib/marketing-metadata';
import { SECURITY_META_DESCRIPTION, SECURITY_META_TITLE } from '@/lib/security-page-words';

/**
 * /security — how FieldLogicHQ protects a club's information (Board Ready §0c, S3). No data reads. It goes live with the
 * legal pages and is gated on their switch: while `resolveLegalLinks()` is null it is "not found", so there is no "off" version of
 * the page, and nothing on it can say "our published policy" before there is one. In the sitemap, behind that same switch (owner 2026-11-22); the legal pages themselves are in none.
 */
// As the legal pages' own routes: read per request, so this page and the footer's link (resolved per request in the root layout)
// always answer the switch the same way, even if it is ever back on its preview env vars. No data is read.
export const dynamic = 'force-dynamic';

export function generateMetadata(): Metadata {
  // Off, the "not found" page keeps its own title: no share card announces a page that is not there.
  if (!resolveLegalLinks()) return {};
  return marketingMetadata({ title: SECURITY_META_TITLE, description: SECURITY_META_DESCRIPTION, path: SECURITY_PATH });
}

export default function Page() {
  const links = resolveLegalLinks();
  if (!links) notFound();
  return <SecurityPage links={links} />;
}
