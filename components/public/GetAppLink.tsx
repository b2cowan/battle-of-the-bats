'use client';
/**
 * components/public/GetAppLink.tsx
 * A subtle, mobile-only "Get the app" link shown under the tournament hero
 * sub-line ("Hosted by …"). Tapping it force-shows the existing InstallAppPrompt
 * (mounted in the tournament layout) via the shared `flhq:show-install` event —
 * the same manual trigger the admin "More → Download app" menu item uses.
 *
 * Because that trigger bypasses the 90-day-dismissed / follow-team suppression
 * gates, this is the always-available (re)install entry point for fans —
 * including anyone who uninstalled and wants the app back but whose auto-banner
 * is being suppressed. On Android it yields the one-tap Install prompt (when the
 * browser offers it); on iOS the Add-to-Home-Screen instructions; otherwise a
 * generic browser-menu fallback.
 *
 * Self-gates to a phone/tablet browser (coarse primary pointer or an iOS/Android
 * UA) and renders nothing on desktop or when already running as the installed
 * app — there's nothing to install there. A useSyncExternalStore client gate
 * keeps SSR output stable (null on the server + first hydration render, then it
 * resolves on the client) without a setState-in-effect.
 */
import { useSyncExternalStore } from 'react';
import { Download } from 'lucide-react';
import { isStandalonePWA } from '@/lib/device';

const noopSubscribe = () => () => {};

export default function GetAppLink({ className }: { className?: string }) {
  const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false);
  if (!isClient) return null;

  if (isStandalonePWA()) return null; // already inside the installed app
  const ua = navigator.userAgent;
  const isPhoneOrTablet =
    window.matchMedia?.('(pointer: coarse)')?.matches === true ||
    /Android|iPhone|iPad|iPod/i.test(ua);
  if (!isPhoneOrTablet) return null;

  return (
    <button
      type="button"
      className={className}
      onClick={() => window.dispatchEvent(new CustomEvent('flhq:show-install'))}
    >
      <Download size={14} aria-hidden />
      Get the app
    </button>
  );
}
