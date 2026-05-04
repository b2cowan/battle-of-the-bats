'use client';
import { createContext, useContext, useState, useCallback } from 'react';

interface OrgNavValue {
  logoUrl: string | null;
  orgName: string;
  setOrgNav: (logoUrl: string | null, orgName: string) => void;
}

const OrgNavContext = createContext<OrgNavValue>({
  logoUrl: null,
  orgName: '',
  setOrgNav: () => {},
});

export function OrgNavProvider({ children }: { children: React.ReactNode }) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [orgName, setOrgName] = useState('');

  const setOrgNav = useCallback((url: string | null, name: string) => {
    setLogoUrl(url);
    setOrgName(name);
  }, []);

  return (
    <OrgNavContext.Provider value={{ logoUrl, orgName, setOrgNav }}>
      {children}
    </OrgNavContext.Provider>
  );
}

export function useOrgNav() {
  return useContext(OrgNavContext);
}
