'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePublicPathname } from '@/lib/use-public-pathname';
import { screenPassesThrough } from '@/lib/legal-acceptance-rules';

/**
 * THE LET-THROUGH WATCH (GST/HST Stage 6 step 6.3, Chunk B). Mounted ONLY when the server knows this person still needs to agree
 * to the Terms and let a page through anyway — a shell's own account door (the sign-in area, the family join page) or a paid
 * owner's billing page (the cancel door). That page renders inside the whole shell, nav and all, and Next 16 does not re-run a
 * layout on in-app navigation: without this, one tap from a let-through page would walk into the portal past the screen.
 *
 * So when the address leaves the let-through set, it asks the server again (`router.refresh()` re-renders the layouts, and the
 * gate then shows the screen). Nothing for anyone else — it is never mounted for a person who has agreed, staff, the demo
 * accounts, or while the pages are off. Not a poll: it acts only on a navigation.
 */
export default function TermsGateWatch({ doors, billingHrefs }: { doors: readonly string[]; billingHrefs: readonly string[] }) {
  const pathname = usePublicPathname(); // the platform address, as the proxy's x-pathname names it
  const router = useRouter();
  // Keyed by content, not identity: the props arrive as new arrays on every server render, and a refresh must not re-arm itself.
  const doorsKey = doors.join('|');
  const billingKey = billingHrefs.join('|');
  useEffect(() => {
    const split = (key: string) => (key ? key.split('|') : []);
    if (!screenPassesThrough(pathname, { doors: split(doorsKey), billingHrefs: split(billingKey) })) router.refresh();
  }, [pathname, doorsKey, billingKey, router]);
  return null;
}
