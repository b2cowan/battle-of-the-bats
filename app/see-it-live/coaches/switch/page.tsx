import { permanentRedirect } from 'next/navigation';
import { RETIRED_DEMO_LANDING } from '@/lib/sandbox-door';

/**
 * The coach demo's confirm screen, RETIRED with the demo (owner ruling 2026-11-25). The twin of
 * `/see-it-live/switch`; read that file's note.
 */
export const dynamic = 'force-dynamic';

export default function CoachSandboxSwitchPage() {
  permanentRedirect(RETIRED_DEMO_LANDING);
}
