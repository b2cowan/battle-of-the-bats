'use client';
import { usePathname } from 'next/navigation';
import Navbar from './Navbar';

export default function SiteChrome() {
  const pathname = usePathname();
  if (pathname.startsWith('/platform-admin')) return null;
  return <Navbar />;
}
