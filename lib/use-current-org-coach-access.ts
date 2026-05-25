'use client';

import { useEffect, useState } from 'react';

export function useCurrentOrgCoachAccess(
  orgSlug: string | null | undefined,
  enabled: boolean,
) {
  const [result, setResult] = useState<{ orgSlug: string | null; hasCoachAccess: boolean }>({
    orgSlug: null,
    hasCoachAccess: false,
  });

  useEffect(() => {
    if (!enabled || !orgSlug) {
      return;
    }

    const controller = new AbortController();

    fetch(`/api/coaches/${orgSlug}/assignments`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (!controller.signal.aborted) {
          setResult({
            orgSlug,
            hasCoachAccess: Array.isArray(data?.assignments) && data.assignments.length > 0,
          });
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setResult({ orgSlug, hasCoachAccess: false });
        }
      });

    return () => controller.abort();
  }, [enabled, orgSlug]);

  if (!enabled || !orgSlug || result.orgSlug !== orgSlug) return false;
  return result.hasCoachAccess;
}
