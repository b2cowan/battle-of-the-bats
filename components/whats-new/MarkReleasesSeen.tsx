'use client';
import { useEffect } from 'react';
import { markReleasesSeen } from './release-seen';

/**
 * Effect-only marker (renders nothing). Mounted on the full release-notes page
 * (/changelog) so that viewing the release notes — by any entry path — clears the
 * "new" dot on the Help nav for this device.
 */
export default function MarkReleasesSeen() {
  useEffect(() => {
    markReleasesSeen();
  }, []);
  return null;
}
