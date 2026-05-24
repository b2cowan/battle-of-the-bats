/**
 * /admin/tournaments/announcements — deprecated.
 * This page has been merged into the unified Communications hub.
 * Any direct link to this route will land here and be redirected immediately.
 */
'use client';
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export default function AnnouncementsRedirectPage() {
  const router   = useRouter();
  const pathname = usePathname(); // e.g. /milton-bats/admin/tournaments/announcements

  useEffect(() => {
    // Replace "announcements" segment with "communication"
    const next = pathname.replace(/\/announcements(\/.*)?$/, '/communication');
    router.replace(next);
  }, [pathname, router]);

  return null; // no flash — redirect happens immediately
}
