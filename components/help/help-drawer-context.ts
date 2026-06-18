'use client';

import { createContext, useContext } from 'react';
import type { HelpModuleKey } from '@/lib/help-content/registry';

/**
 * Lightweight context for the in-context help drawer.
 *
 * Kept in its own module — separate from HelpDrawerProvider — so that the "?"
 * HelpButton (rendered in every work-page header) can import the hook + types
 * WITHOUT pulling the drawer, the content registry, and all guide content into
 * the bundle of every page that shows a header. Only the provider (mounted once)
 * imports the drawer and therefore the content. The `HelpModuleKey` import below
 * is type-only and erased at compile time, so it adds no runtime weight here.
 */
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

export interface HelpDrawerContextValue {
  openHelp: (req: HelpRequest) => void;
  closeHelp: () => void;
}

// Safe no-op default so a HelpButton renders harmlessly even if it is somehow
// mounted outside a provider (it simply won't open anything).
export const HelpDrawerContext = createContext<HelpDrawerContextValue>({
  openHelp: () => {},
  closeHelp: () => {},
});

export function useHelpDrawer() {
  return useContext(HelpDrawerContext);
}
