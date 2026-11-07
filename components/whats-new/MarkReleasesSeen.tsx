'use client';
import { useEffect } from 'react';
import { markReleasesSeen } from './release-seen';

/**
 * Effect-only marker (renders nothing). Mounted on the full release-notes page
 * (/changelog) so that viewing the release notes — by any entry path — clears the
 * "New" tag and the Overview note for this device.
 */
export default function MarkReleasesSeen() {
  useEffect(() => {
    markReleasesSeen();
  }, []);
  return null;
}
