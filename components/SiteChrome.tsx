'use client';
import { usePathname } from 'next/navigation';
import { isCoachPortalShellPath } from '@/lib/coaches-portal-routes';
import Navbar from './Navbar';

export default function SiteChrome() {
  const pathname = usePathname();
  if (
    pathname.startsWith('/platform-admin') ||
    pathname === '/dev' ||
    pathname.startsWith('/dev/') ||
    pathname.startsWith('/home') ||
    isCoachPortalShellPath(pathname)
  ) return null;
  return <Navbar />;
}
