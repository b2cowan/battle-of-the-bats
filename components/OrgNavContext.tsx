'use client';
import { createContext, useContext } from 'react';

interface OrgNavValue {
  logoUrl: string | null;
  orgName: string;
}

const OrgNavContext = createContext<OrgNavValue>({ logoUrl: null, orgName: '' });

export function OrgNavProvider({
  logoUrl,
  orgName,
  children,
}: OrgNavValue & { children: React.ReactNode }) {
  return (
    <OrgNavContext.Provider value={{ logoUrl, orgName }}>
      {children}
    </OrgNavContext.Provider>
  );
}

export function useOrgNav() {
  return useContext(OrgNavContext);
}
