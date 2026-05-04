'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Footer() {
  const pathname = usePathname();
  const isAdmin = /^\/[^/]+\/admin(\/|$)/.test(pathname) || pathname.startsWith('/admin');
  if (isAdmin) return null;

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
              {([['Discover', '/discover'], ['Pricing', '/#pricing'], ['Sign In', '/auth/login']] as const).map(([label, href]) => (
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
            &copy; {new Date().getFullYear()} FieldLogic. All rights reserved.
          </div>
          <div className="font-mono text-xs text-data-gray/40 tracking-widest">
            BUILD: STABLE · NODE: PRODUCTION
          </div>
        </div>
      </div>
    </footer>
  );
}
