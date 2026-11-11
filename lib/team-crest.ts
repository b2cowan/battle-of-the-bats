/**
 * lib/team-crest.ts — SERVER-ONLY. The team crest's stored facts (navigation Phase 4, C7, owner 2026-11-11).
 *
 * The crest is the picture a head coach sets in "How your documents look" (`rep_teams.pdf_settings.logoDataUrl`, a PNG of
 * 256 px or less after the save route's sharp pass). The sidebar's team tile shows it, so — as the club and event logos
 * did (migs 458 / 460) — its SHAPE is recorded when it is saved, and it is served at its OWN address keyed by a version
 * stamp (`app/api/coaches/[orgSlug]/teams/[teamId]/crest`), never inlined into the page: the team list every coach page
 * loads carries the two small facts, not the picture.
 *
 * The facts live beside the picture in the same jsonb (`logoAspect`, `logoVersion`), so "Use club look" ({}), a removed
 * crest and a replaced one clear or change them in the same write — they cannot drift from the picture they describe.
 * The one-time pass over crests saved before this (`scripts/backfill-team-crest-aspect.mjs`) repeats this arithmetic in
 * an .mjs that cannot import it.
 */
import { createHash } from 'node:crypto';
import { measureLogoAspect } from './org-logo-measure';

/** The picture's bytes out of its data URL (null when it is not one). */
export function crestBytes(dataUrl: string | null | undefined): Buffer | null {
  if (typeof dataUrl !== 'string') return null;
  const comma = dataUrl.indexOf(',');
  if (!dataUrl.startsWith('data:image/') || comma < 0) return null;
  const bytes = Buffer.from(dataUrl.slice(comma + 1), 'base64');
  return bytes.length ? bytes : null;
}

/** The version stamp: the first 12 hex of the picture's SHA-1 — a new picture is a new address, the same one is cached. */
export function crestVersion(bytes: Uint8Array): string {
  return createHash('sha1').update(bytes).digest('hex').slice(0, 12);
}

/** What the save route writes beside a crest: its width / height (left out when it cannot be read — the tile then falls
 *  to the team's colour) and its version. */
export async function crestFacts(dataUrl: string): Promise<{ logoAspect?: number; logoVersion?: string }> {
  const bytes = crestBytes(dataUrl);
  if (!bytes) return {};
  const aspect = await measureLogoAspect(bytes);
  return { ...(aspect ? { logoAspect: Math.round(aspect * 1000) / 1000 } : {}), logoVersion: crestVersion(bytes) };
}
