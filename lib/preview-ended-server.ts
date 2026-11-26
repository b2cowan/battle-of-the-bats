import 'server-only';
import { cache } from 'react';
import { supabaseAdmin } from './supabase-admin';
import { previewDayLabel, endedPageShows, type EndedPreview } from './preview-ended';

/**
 * The ended page's one read (Track P Session P4, T12): the newest REMOVED, never-claimed preview record for this address,
 * while its removal is under 90 days old. Called only once the address has no club at all — a live club (a claimed
 * preview, or a real club that later took the name) always wins, because the caller asks the club first.
 *
 * Cached per request (/review 2026-11-26): the layout and its metadata both ask, on every unknown address.
 * Returns null for "not found" — and also when the record cannot be read: a failed read must fall to the ordinary
 * not-found page, never to an error page on an address that may simply be a typo.
 */
export const readEndedPreview = cache(async (slug: string): Promise<EndedPreview | null> => {
  const now = new Date();
  const key = slug.trim().toLowerCase();
  if (!key) return null;
  const { data, error } = await supabaseAdmin
    .from('organization_previews')
    .select('org_name, removed_at')
    .eq('org_slug', key)
    .is('claimed_at', null)
    .not('removed_at', 'is', null)
    .order('removed_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const r = data as { org_name: string; removed_at: string };
  if (!endedPageShows(r.removed_at, now)) return null;
  // A club that holds the address now (a newer preview, a claimed one, a real club) always wins: never "ended" over it.
  const { data: live, error: liveError } = await supabaseAdmin.from('organizations').select('id').eq('slug', key).limit(1).maybeSingle();
  if (liveError || live) return null;
  return { name: r.org_name, removedOn: previewDayLabel(r.removed_at) };
});
