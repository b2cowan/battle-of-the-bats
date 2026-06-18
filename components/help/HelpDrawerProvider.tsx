'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { HelpModuleKey } from '@/lib/help-content/registry';
import HelpDrawer from './HelpDrawer';

export interface HelpRequest {
  /** Which help content module to read from. */
  module: HelpModuleKey;
  /** Section anchor id(s) this page maps to, shown in order. */
  sectionIds: string[];
  /** Label shown in the drawer header (defaults to the work-page name). */
  label?: string;
  /** Optional href to the full guide section for the "Open full guide" footer link. */
  fullGuideHref?: string;
}

interface HelpDrawerContextValue {
  openHelp: (req: HelpRequest) => void;
  closeHelp: () => void;
}

// Safe no-op default so a HelpButton renders harmlessly even if it is somehow
// mounted outside a provider (it simply won't open anything).
const HelpDrawerContext = createContext<HelpDrawerContextValue>({
  openHelp: () => {},
  closeHelp: () => {},
});

export function useHelpDrawer() {
  return useContext(HelpDrawerContext);
}

/**
 * Mounts a SINGLE in-context help drawer for an admin/portal area. Work pages
 * don't render their own drawer — they call `openHelp({ module, sectionIds })`
 * (usually via the "?" HelpButton in the page header) and this one instance
 * renders the matching guide section(s) in a slide-over.
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
