'use client';
import { useEffect } from 'react';
import { useOrg } from './org-context';

export function usePageTitle(pageName: string) {
  const { currentOrg } = useOrg();
  useEffect(() => {
    document.title = currentOrg?.name
      ? `${pageName} | ${currentOrg.name}`
      : pageName;
  }, [pageName, currentOrg?.name]);
}
