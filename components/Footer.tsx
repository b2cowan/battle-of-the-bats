'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { isCoachPortalShellPath } from '@/lib/coaches-portal-routes';

// Static top-level routes that live outside the org-slug space and should show the footer.
const STATIC_ROOTS = new Set(['discover', 'pricing', 'auth', 'coaches', 'status', 'docs', 'contact', 'blog']);

export default function Footer() {
  const pathname = usePathname();
  const firstSegment = pathname.split('/')[1] ?? '';

  // Always hide on admin shells, platform-admin, the /home context-switcher, and the
  // authenticated coach-portal routes (which render their own shell chrome).
  if (
    /^\/[^/]+\/admin(\/|$)/.test(pathname) ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/platform-admin') ||
    pathname.startsWith('/home') ||
    isCoachPortalShellPath(pathname)
  ) return null;

  // Hide on all org-slug pages (/{orgSlug}/...) — public tournament pages, coaches portal,
  // org home — while keeping the footer on known top-level marketing/auth routes.
  if (firstSegment && !STATIC_ROOTS.has(firstSegment)) return null;

  return (
    <footer className="border-t border-blueprint-blue/30 bg-pitch-black mt-24">
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid grid-cols-12 gap-8 mb-12">
          <div className="col-span-12 md:col-span-4">
            <div className="font-mono font-bold text-xl tracking-tighter mb-3">
              <span className="text-fl-text">FIELD</span>
              <span className="text-logic-lime">LOGIC</span>
            </div>
            <p className="font-mono text-xs text-data-gray leading-relaxed max-w-xs">
              High-precision tournament infrastructure for organizations that compete seriously.
            </p>
          </div>

          <div className="col-span-6 md:col-span-2">
            <div className="hud-label mb-4">Platform</div>
            <ul className="space-y-2">
              {([['Discover', '/discover'], ['Coaches', '/coaches/start'], ['Pricing', '/pricing'], ['Sign In', '/auth/login']] as const).map(([label, href]) => (
                <li key={href}>
                  <Link href={href} className="font-mono text-xs text-data-gray hover:text-logic-lime transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="col-span-6 md:col-span-2">
            <div className="hud-label mb-4">System</div>
            <ul className="space-y-2">
              {([['Status', '/status'], ['Docs', '/docs'], ['Contact', '/contact']] as const).map(([label, href]) => (
                <li key={href}>
                  <Link href={href} className="font-mono text-xs text-data-gray hover:text-logic-lime transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-blueprint-blue/20 pt-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
          <div className="font-mono text-xs text-data-gray/40">
            &copy; {new Date().getFullYear()} FieldLogicHQ. All rights reserved.
          </div>
          <div className="font-mono text-xs text-data-gray/40 tracking-widest">
            BUILD: STABLE · NODE: PRODUCTION
          </div>
        </div>
      </div>
    </footer>
  );
}
