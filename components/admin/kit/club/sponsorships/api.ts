'use client';
/**
 * SPONSORSHIPS' READ AND WRITES (Board Ready Stage 6, Part 1). One read for the place (`useSponsorships`), and every press
 * through `send`, so a refusal is always the server's sentence and a failure to reach it is the one "That didn't go
 * through" line.
 */
import { useCallback, useEffect, useState } from 'react';
import { useOrg } from '@/lib/org-context';
import { jsonInit, moneyFetch, refusalText } from '@/lib/money-fetch';
import { SPONSORSHIPS_WORDS as W } from '@/lib/club-sponsorships-words';
import type { ClubSponsor, PackageTaken, PlaceTargets, SponsorshipPackage, SponsorshipSettings } from '@/lib/club-sponsorships';

export type { PlaceTargets } from '@/lib/club-sponsorships';

export type PlacePackage = SponsorshipPackage & { taken: PackageTaken; takenBy: { id: string; name: string; caption: string }[] };

/** A sponsor's deals, for its window's "From the deal" line and Deal door (Part 2). A withdrawn one shows nowhere. */
export type SponsorDeal = { id: string; packageName: string; invoice: string | null; withdrawn: boolean };

export interface SponsorshipsRead {
  packages: PlacePackage[];
  sponsors: ClubSponsor[];
  sponsorDeals: Record<string, SponsorDeal[]>;
  settings: SponsorshipSettings;
  targets: PlaceTargets;
  formQuestions: number;
  changesInvoice: boolean;
  today: string;
}

export const sponsorshipsApi = (slug: string, path = '') => `/api/admin/sponsorships${path}?orgSlug=${encodeURIComponent(slug)}`;

export function useSponsorships() {
  const { currentOrg } = useOrg();
  const slug = currentOrg?.slug ?? '';
  const [data, setData] = useState<SponsorshipsRead | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    if (!slug) return;
    const r = await moneyFetch<SponsorshipsRead>(sponsorshipsApi(slug));
    if (!r.ok) { setError(refusalText(r.data, W.say.failed)); return; }
    setError(null);
    setData(r.data);
  }, [slug]);
  useEffect(() => { void reload(); }, [reload]);
  return { slug, data, error, reload };
}

export type Sent<T = Record<string, unknown>> = { ok: true; data: T } | { ok: false; status: number; error: string; code: string | null };

export async function send<T = Record<string, unknown>>(url: string, method: 'POST' | 'PATCH' | 'DELETE', body?: unknown): Promise<Sent<T>> {
  try {
    const init = body instanceof FormData ? { method, body } : body === undefined ? { method } : jsonInit(method, body);
    const r = await moneyFetch<T>(url, init);
    if (r.ok) return { ok: true, data: r.data };
    const code = (r.data as { code?: unknown })?.code;
    return { ok: false, status: r.status, error: refusalText(r.data, W.say.failed), code: typeof code === 'string' ? code : null };
  } catch {
    return { ok: false, status: 0, error: W.say.failed, code: null };
  }
}
