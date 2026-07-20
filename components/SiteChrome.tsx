'use client';
import { usePathname } from 'next/navigation';
import { isCoachPortalShellPath } from '@/lib/coaches-portal-routes';
import { isConsumerShellPath } from '@/lib/consumer-routes';
import Navbar from './Navbar';

export default function SiteChrome() {
  const pathname = usePathname();
  // Volunteer day-of shells (/{orgSlug}/scorekeeper, /{orgSlug}/check-in) render
  // their own sticky FieldLogicHQ header; the global Navbar would double up and
  // overlap it. Suppress here, same as /home, the coach portal, and platform-admin.
  const isVolunteerShell = /^\/[^/]+\/(scorekeeper|check-in)(\/|$)/.test(pathname);
  // The org-scoped Coaches Portal (`/{orgSlug}/coaches…`) renders its own sidebar shell.
  // isCoachPortalShellPath only covers the org-less `/coaches…` hub, so without this the
  // global Navbar double-renders and overlaps the portal header.
  const isOrgCoachShell = /^\/[^/]+\/coaches(\/|$)/.test(pathname);
  if (
    pathname.startsWith('/platform-admin') ||
    pathname === '/dev' ||
    pathname.startsWith('/dev/') ||
    pathname.startsWith('/home') ||
    // Auth pages (/auth/login, signup, reset…) are focused, self-branded cards —
    // the marketing Navbar is a jarring context switch for fans/coaches arriving
    // mid-flow from app surfaces, and it pushes the form below the fold on phones.
    pathname.startsWith('/auth') ||
    // /start (the get-started chooser + its children) lives in the consumer shell
    // (dark-skinned tab bar). Without this, the global Navbar falls into its empty
    // org-home branch here — a fixed, invisible link over the page header that
    // hijacked taps to '/' (Founding Season coaches-free plan, P7/P12).
    pathname === '/start' || pathname.startsWith('/start/') ||
    isVolunteerShell ||
    isOrgCoachShell ||
    isCoachPortalShellPath(pathname) ||
    // Consumer shell (/discover, /scores, /following, /account) renders its own
    // top bar + bottom nav — the marketing Navbar would double up.
    isConsumerShellPath(pathname)
  ) return null;
  return <Navbar />;
}
