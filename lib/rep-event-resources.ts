// Per-event resource links (Phase 4 V1) for the Premium coach schedule. A typed list stored in
// rep_team_events.resources (jsonb). V1 supports type:'link'; the shape leaves room for type:'file'
// later (V2, reusing Documents storage) without a migration. Validity + the per-event cap are
// enforced here (app-layer), not by DB constraints.
import type { RepEventResource } from '@/lib/types';

export const MAX_EVENT_RESOURCES = 10;
const MAX_LABEL_LEN = 120;
const MAX_URL_LEN = 2048;

/** A resource URL must be a real http(s) web link (no javascript:, data:, relative, etc.). */
export function isValidResourceUrl(url: string): boolean {
  try {
    const u = new URL(url.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Server-side cleanup: keep only well-formed link rows, trim/cap fields, and cap the list length.
 *  Silently drops empty/invalid rows (the client validates first, so this is a backstop). */
export function sanitizeResources(input: unknown): RepEventResource[] {
  if (!Array.isArray(input)) return [];
  const out: RepEventResource[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue;
    const label = typeof (raw as { label?: unknown }).label === 'string' ? (raw as { label: string }).label.trim() : '';
    const url = typeof (raw as { url?: unknown }).url === 'string' ? (raw as { url: string }).url.trim() : '';
    if (!label || !isValidResourceUrl(url)) continue;
    out.push({ type: 'link', label: label.slice(0, MAX_LABEL_LEN), url: url.slice(0, MAX_URL_LEN) });
    if (out.length >= MAX_EVENT_RESOURCES) break;
  }
  return out;
}
