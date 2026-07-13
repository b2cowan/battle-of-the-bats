'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { isCoachPortalShellPath } from '@/lib/coaches-portal-routes';
import { isConsumerShellPath } from '@/lib/consumer-routes';

// Static top-level routes that live outside the org-slug space and should show the footer.
// (Consumer-shell routes like /discover are handled earlier via isConsumerShellPath.)
const STATIC_ROOTS = new Set(['pricing', 'auth', 'coaches', 'blog', 'changelog']);

// Footer link columns. Each group renders as a labelled column; the link for the
// page you're currently on is filtered out, and a column with no remaining links
// hides its heading.
const FOOTER_GROUPS = [
  {
    heading: 'Product',
    links: [
      ['Discover', '/discover'],
      ['Pricing', '/pricing'],
      ['What’s New', '/changelog'],
    ],
  },
  {
    heading: 'Get started',
    links: [
      ['Start Free', '/auth/signup'],
      ['Coaches', '/coaches/start'],
      ['Sign In', '/auth/login'],
    ],
  },
] as const;

export default function Footer() {
  const pathname = usePathname();
  const firstSegment = pathname.split('/')[1] ?? '';

  // Always hide on admin shells, platform-admin, the /home context-switcher, the
  // authenticated coach-portal routes, and the consumer shell (which render their
  // own chrome — the consumer shell uses a bottom nav instead of the marketing footer).
  if (
    /^\/[^/]+\/admin(\/|$)/.test(pathname) ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/platform-admin') ||
    pathname.startsWith('/home') ||
    isCoachPortalShellPath(pathname) ||
    isConsumerShellPath(pathname)
  ) return null;

  // Hide on all org-slug pages (/{orgSlug}/...) — public tournament pages, coaches portal,
  // org home — while keeping the footer on known top-level marketing/auth routes.
  if (firstSegment && !STATIC_ROOTS.has(firstSegment)) return null;

  return (
    <footer className="border-t border-blueprint-blue/30 bg-pitch-black mt-24">
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid grid-cols-12 gap-8 mb-12">
          <div className="col-span-12 md:col-span-6">
            <div className="font-mono font-bold text-xl tracking-tighter mb-3">
              <span className="text-fl-text">FIELD</span>
              <span className="text-logic-lime">LOGIC</span>
              <span className="text-data-gray/50">HQ</span>
            </div>
            <p className="font-mono text-xs text-data-gray leading-relaxed max-w-sm">
              From first registration to final standings — built for the people running community sport.
            </p>
          </div>

          {FOOTER_GROUPS.map(group => {
            const links = group.links.filter(([, href]) => href !== pathname);
            if (links.length === 0) return null;
            return (
              <div key={group.heading} className="col-span-6 md:col-span-3">
                <div className="hud-label mb-4">{group.heading}</div>
                <ul className="space-y-2">
                  {links.map(([label, href]) => (
                    <li key={href}>
                      <Link href={href} className="font-mono text-xs text-data-gray hover:text-logic-lime transition-colors">
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <div className="border-t border-blueprint-blue/20 pt-6">
          <div className="font-mono text-xs text-data-gray/40">
            &copy; {new Date().getFullYear()} FieldLogicHQ. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  );
}
