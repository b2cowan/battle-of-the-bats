'use client';
import { usePathname } from 'next/navigation';
import { isCoachPortalShellPath } from '@/lib/coaches-portal-routes';
import { isConsumerShellPath, isWarmJourneyPath, isOrgOperatorShellPath } from '@/lib/consumer-routes';
import Navbar from './Navbar';

export default function SiteChrome() {
  const pathname = usePathname();
  // Every org-scoped OPERATOR shell renders its own chrome, so the global Navbar must not double up
  // and overlap it: the volunteer day-of shells (`/{org}/scorekeeper`, `/{org}/check-in`), the
  // org-scoped Coaches Portal (`/{org}/coaches…` — isCoachPortalShellPath below only covers the
  // ORG-LESS `/coaches…` hub), the admin shell, and `/{org}/official`.
  //
  // This used to be two hand-written regexes here that covered only 2 of those 5 sections. That is
  // the same audience split lib/consumer-routes now states once, so ask it rather than keeping a
  // second, narrower copy — the missing sections were a latent double-render waiting for whichever
  // of them grew a real page first.
  const isOperatorShell = isOrgOperatorShellPath(pathname);
  if (
    pathname.startsWith('/platform-admin') ||
    pathname === '/dev' ||
    pathname.startsWith('/dev/') ||
    pathname.startsWith('/home') ||
    // Auth pages (/auth/login, signup, reset…) are focused, self-branded cards —
    // the marketing Navbar is a jarring context switch for fans/coaches arriving
    // mid-flow from app surfaces, and it pushes the form below the fold on phones.
    pathname.startsWith('/auth') ||
    // The warm sign-up journey (the /start family + /coaches/start + /coaches/claim + the
    // post-provision success screen) wears the consumer shell's own warm nav — the marketing
    // Navbar would double up (and previously fell into its empty org-home branch on /start,
    // hijacking taps to '/'). Single source of truth in lib/consumer-routes.
    isWarmJourneyPath(pathname) ||
    isOperatorShell ||
    isCoachPortalShellPath(pathname) ||
    // Consumer shell (/discover, /scores, /following, /account) renders its own
    // top bar + bottom nav — the marketing Navbar would double up.
    isConsumerShellPath(pathname)
  ) return null;
  return <Navbar />;
}
