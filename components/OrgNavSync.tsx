'use client';
import { useLayoutEffect } from 'react';
import { useOrgNav } from './OrgNavContext';

export function OrgNavSync({ logoUrl, orgName }: { logoUrl: string | null; orgName: string }) {
  const { setOrgNav } = useOrgNav();

  useLayoutEffect(() => {
    setOrgNav(logoUrl, orgName);
    return () => setOrgNav(null, '');
  }, [logoUrl, orgName, setOrgNav]);

  return null;
}
