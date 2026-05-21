'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function PlatformVisitRecorder() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || pathname === '/platform-admin/login') return;

    void fetch('/api/platform-admin/visits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: pathname }),
    }).catch(() => {
      // Visit tracking should never interrupt platform-admin work.
    });
  }, [pathname]);

  return null;
}
