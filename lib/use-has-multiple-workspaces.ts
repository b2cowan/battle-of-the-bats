'use client';

import { useEffect, useState } from 'react';

/**
 * True only once we've confirmed the session user has 2+ org workspaces. Defaults to `false`
 * (hide the "All Workspaces" switcher) so single-workspace users never see a control whose only
 * purpose is switching between workspaces they don't have ("single-org by default", 2026-06-19).
 */
export function useHasMultipleWorkspaces(): boolean {
  const [hasMultiple, setHasMultiple] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    fetch('/api/me/workspaces', { cache: 'no-store', signal: controller.signal })
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (!controller.signal.aborted) setHasMultiple(Boolean(data?.hasMultiple));
      })
      .catch(() => {
        if (!controller.signal.aborted) setHasMultiple(false);
      });

    return () => controller.abort();
  }, []);

  return hasMultiple;
}
