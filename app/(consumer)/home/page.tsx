import { permanentRedirect } from 'next/navigation';

/**
 * /home — retired by the Unified Home IA redesign (Phase 0).
 *
 * The workspace launchpad folded into Home (/discover): workspaces, pending invites,
 * and following now render there. This route stays alive FOREVER as a permanent (308)
 * alias so already-sent emails / push deep links / installed-PWA links to /home never
 * 404. The single-context "fast-path" that used to live here moved into
 * getAuthDestination() (solo-workspace users still land straight in their workspace at
 * sign-in); the ?pick=1 / forcePicker launchpad is gone.
 */
export default function HomeRedirect() {
  permanentRedirect('/discover');
}
