'use client';
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { CoachingAssignment } from './db';

interface CoachesContextType {
  assignments: CoachingAssignment[];
  loading: boolean;
  refresh: () => Promise<void>;
}

const CoachesContext = createContext<CoachesContextType>({
  assignments: [],
  loading: true,
  refresh: async () => {},
});

export function CoachesProvider({
  children,
  orgSlug,
}: {
  children: ReactNode;
  orgSlug: string;
}) {
  const [assignments, setAssignments] = useState<CoachingAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/coaches/${orgSlug}/assignments`);
      if (res.ok) {
        const data = await res.json();
        setAssignments(data.assignments ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [orgSlug]);

  useEffect(() => { load(); }, [load]);

  return (
    <CoachesContext.Provider value={{ assignments, loading, refresh: load }}>
      {children}
    </CoachesContext.Provider>
  );
}

export function useCoaches() {
  return useContext(CoachesContext);
}
