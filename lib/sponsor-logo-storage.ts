/**
 * lib/sponsor-logo-storage.ts — THE ONE STORAGE QUESTION A SPONSOR SAVE ASKS (Club Tier Stage 4d; server only).
 *
 * The editor saves the WHOLE sponsors list from the page it loaded, so a tab that went stale (another admin replaced a
 * logo and the old file was thrown away) could save a sponsor pointing at a file that is gone — a broken picture on the
 * club's public home. Before a sponsors save is stored, any logo whose file no longer exists is taken off its sponsor, so
 * what is stored is always true. A failed lookup keeps the logo (a storage hiccup must never cost a club its pictures).
 */
import { ORG_LOGO_BUCKET } from './org-image-limits';
import { parseSponsorLogoUrl, SPONSOR_LOGO_FOLDER } from './sponsor-logo';
import { supabaseAdmin } from './supabase-admin';
import type { SiteSponsor } from './types';

async function fileExists(orgId: string, objectPath: string): Promise<boolean> {
  const name = objectPath.slice(objectPath.lastIndexOf('/') + 1);
  const { data, error } = await supabaseAdmin.storage.from(ORG_LOGO_BUCKET).list(`${orgId}/${SPONSOR_LOGO_FOLDER}`, { limit: 5, search: name });
  if (error || !data) return true;
  return data.some(f => f.name === name);
}

/** `sponsors` with the logo taken off any sponsor whose file is gone. */
export async function withoutMissingLogos(orgId: string, sponsors: SiteSponsor[]): Promise<SiteSponsor[]> {
  if (!sponsors.some(s => s.logoUrl)) return sponsors;
  return Promise.all(sponsors.map(async s => {
    const parsed = s.logoUrl ? parseSponsorLogoUrl(s.logoUrl, orgId) : null;
    if (!s.logoUrl || !parsed || await fileExists(orgId, parsed.objectPath)) return s;
    const { logoUrl: _gone, ...rest } = s;
    return rest;
  }));
}
