import { permanentRedirect } from 'next/navigation';
import { RETIRED_DEMO_LANDING } from '@/lib/sandbox-door';

/**
 * The tournament demo's confirm screen, RETIRED with the demo (owner ruling 2026-11-25). It offered a
 * signed-in visitor the swap into the demo account; there is no demo to swap into, so it renders
 * nothing and sends the visitor to `/pricing` as themselves. Phase 3 deletes it.
 */
export const dynamic = 'force-dynamic';

export default function SandboxSwitchPage() {
  permanentRedirect(RETIRED_DEMO_LANDING);
}
