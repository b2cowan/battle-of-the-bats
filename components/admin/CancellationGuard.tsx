'use client';
/**
 * CancellationGuard — client-side redirect for cancelled accounts.
 *
 * Server-side redirects inside the admin layout conflict with the login page's
 * router.push() + router.refresh() pattern: the refresh re-fetches the original
 * push URL, which triggers the server redirect again, creating an infinite loop.
 *
 * Moving the redirect to the client (via usePathname) breaks the cycle: the guard
 * fires once on mount, sees cancelled + not-billing, and calls router.replace().
 * No server round-trip, no loop.
 */
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useOrg } from '@/lib/org-context';

export function CancellationGuard() {
  const { currentOrg } = useOrg();
  const pathname = usePathname();
  const router = useRouter();

  const isCanceled = currentOrg?.subscriptionStatus === 'canceled';
  const orgSlug = currentOrg?.slug;
  const billingPath = orgSlug ? `/${orgSlug}/admin/org/billing` : null;

  useEffect(() => {
    if (!isCanceled || !billingPath) return;
    if (!pathname.startsWith(billingPath)) {
      router.replace(billingPath);
    }
  }, [isCanceled, pathname, billingPath, router]);

  return null;
}
