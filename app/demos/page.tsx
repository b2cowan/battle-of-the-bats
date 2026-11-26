import { permanentRedirect } from 'next/navigation';
import { RETIRED_DEMO_LANDING } from '@/lib/sandbox-door';

/**
 * `/demos` — the page that held both demo doors, RETIRED (owner ruling 2026-11-25, Ask 1 ruled A).
 * The address was handed to people in the industry (2026-08-11), so it lands on `/pricing` with a
 * permanent redirect rather than a 404. Dropped from the sitemap. Phase 3 deletes this file and moves
 * the redirect into `next.config`.
 */
export default function DemosPage() {
  permanentRedirect(RETIRED_DEMO_LANDING);
}
