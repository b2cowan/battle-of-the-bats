'use client';
import { usePathname } from 'next/navigation';
import { isCoachPortalShellPath } from '@/lib/coaches-portal-routes';
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
    isVolunteerShell ||
    isOrgCoachShell ||
    isCoachPortalShellPath(pathname)
  ) return null;
  return <Navbar />;
}
