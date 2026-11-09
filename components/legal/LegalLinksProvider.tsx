'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { LegalLinks } from '@/lib/legal-links';

/**
 * The legal-pages switch, delivered to client components (GST/HST Stage 6 step 6.2, Chunk 1h). The root layout resolves the
 * answer on the server (`resolveLegalLinks`) and mounts this once; a client component never reads env. `useLegalLinks()` returns
 * `null` when the pages are off, so every link that reads it renders nothing by itself.
 */
const LegalLinksContext = createContext<LegalLinks | null>(null);

export function LegalLinksProvider({ links, children }: { links: LegalLinks | null; children: ReactNode }) {
  return <LegalLinksContext.Provider value={links}>{children}</LegalLinksContext.Provider>;
}

export function useLegalLinks(): LegalLinks | null {
  return useContext(LegalLinksContext);
}
