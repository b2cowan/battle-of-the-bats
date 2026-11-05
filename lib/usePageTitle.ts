'use client';
import { useEffect } from 'react';
import { useOrg } from './org-context';

/** The browser tab's title. `null` sets nothing — a frame whose page names itself (the Families child page, Stage 14 S5)
 *  must not overwrite it: a parent's effect runs AFTER its child's. */
export function usePageTitle(pageName: string | null) {
  const { currentOrg } = useOrg();
  useEffect(() => {
    if (pageName === null) return;
    document.title = currentOrg?.name
      ? `${pageName} | ${currentOrg.name}`
      : pageName;
  }, [pageName, currentOrg?.name]);
}
