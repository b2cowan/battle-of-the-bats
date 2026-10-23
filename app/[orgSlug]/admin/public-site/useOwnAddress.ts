'use client';
/**
 * The club's own web address, loaded and kept fresh for the Public site page (Club Tier Stage 4e, Part 3). The page holds
 * it (not the row) because the page header, the preview and the closed row all say the address, and each must say the same
 * one. A waiting connection is read again every minute while the page is open, and again whenever the tab comes back, so an
 * owner who left "to look at it later" sees the result without pressing anything.
 */
import { useCallback, useEffect, useState } from 'react';
import type { DomainView } from '@/lib/club-domain-service';

export interface OwnAddressState {
  loaded: boolean;
  failed: boolean;
  connection: DomainView | null;
  /** True for the owner: the only person who connects, tries again or stops. */
  canEdit: boolean;
}

export function useOwnAddress(query: string) {
  const [state, setState] = useState<OwnAddressState>({ loaded: false, failed: false, connection: null, canEdit: false });

  const reload = useCallback(async () => {
    if (!query) return;
    try {
      const res = await fetch(`/api/admin/public-site/own-address${query}`);
      if (!res.ok) throw new Error('load');
      const data = (await res.json()) as { connection: DomainView | null; canEdit: boolean };
      setState({ loaded: true, failed: false, connection: data.connection, canEdit: data.canEdit });
    } catch {
      setState(s => ({ ...s, loaded: true, failed: true }));
    }
  }, [query]);

  useEffect(() => { void reload(); }, [reload]);

  // Back on the tab, read it again.
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') void reload(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [reload]);

  // Waiting: the status job moves it along on its own clock; look once a minute while the page is open.
  const waiting = state.connection?.status === 'waiting';
  useEffect(() => {
    if (!waiting) return;
    const t = window.setInterval(() => { if (document.visibilityState === 'visible') void reload(); }, 60_000);
    return () => window.clearInterval(t);
  }, [waiting, reload]);

  /** The routes answer with the new connection (or null after a stop): take it without another read. */
  const setConnection = useCallback((connection: DomainView | null) => {
    setState(s => ({ ...s, loaded: true, failed: false, connection }));
  }, []);

  return { ...state, reload, setConnection };
}
