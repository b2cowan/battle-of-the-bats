'use client';

import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { HelpDrawerContext, type HelpRequest } from './help-drawer-context';
import HelpDrawer from './HelpDrawer';

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

  const value = useMemo(() => ({ openHelp, closeHelp }), [openHelp, closeHelp]);

  return (
    <HelpDrawerContext.Provider value={value}>
      {children}
      <HelpDrawer request={request} onClose={closeHelp} />
    </HelpDrawerContext.Provider>
  );
}
