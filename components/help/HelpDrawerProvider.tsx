'use client';

import { useCallback, useMemo, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { HelpDrawerContext, type HelpRequest } from './help-drawer-context';

// Load the drawer (and, through it, the content registry + all guide content)
// only when help is first opened. The provider is mounted on every admin page,
// so eager-importing would put all guide content in every page's bundle; this
// defers that weight to the moment a user actually clicks "?".
const HelpDrawer = dynamic(() => import('./HelpDrawer'), { ssr: false });

/**
 * Mounts a SINGLE in-context help drawer for an admin/portal area. Work pages
 * don't render their own drawer — they call `openHelp({ module, sectionIds })`
 * (usually via the "?" HelpButton in the page header) and this one instance
 * renders the matching guide section(s) in a slide-over.
 *
 * This is the ONLY module that imports the drawer (and therefore the content
 * registry), so the per-page HelpButton stays light — see help-drawer-context.
 */
export default function HelpDrawerProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<HelpRequest | null>(null);

  const openHelp = useCallback((req: HelpRequest) => setRequest(req), []);
  const closeHelp = useCallback(() => setRequest(null), []);

  // Close on navigation: the drawer describes the page it was opened FROM, so it
  // must not linger over the next page. (Lingering also let the portal'd drawer
  // sit over the full-guide route rendering the same section — duplicate DOM ids
  // for every section/sub-topic/FAQ anchor the two trees share.) Render-time
  // reset (the React "derive from props" pattern), not an effect — same-render
  // state adjustment, no cascading effect pass. Pathname only on purpose: query
  // changes (e.g. the Money hub's ?section= tab switches) keep the drawer up.
  const pathname = usePathname();
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setRequest(null);
  }

  const value = useMemo(() => ({ openHelp, closeHelp }), [openHelp, closeHelp]);

  return (
    <HelpDrawerContext.Provider value={value}>
      {children}
      {/* Only mounted once help is opened, so the drawer chunk loads on demand. */}
      {request && <HelpDrawer request={request} onClose={closeHelp} />}
    </HelpDrawerContext.Provider>
  );
}
