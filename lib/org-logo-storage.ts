/**
 * The public storage bucket every org and tournament logo lives in — an uploaded logo, a
 * tournament's logo, and a stock pick made in the club's colour (lib/stock-logo-render.ts).
 */
import { supabaseAdmin } from './supabase-admin';

export const ORG_LOGO_BUCKET = 'org-logos';

export async function ensureOrgLogoBucket() {
  const { data: buckets } = await supabaseAdmin.storage.listBuckets();
  const existing = buckets?.find(b => b.name === ORG_LOGO_BUCKET);
  if (existing) {
    if (!existing.public) {
      await supabaseAdmin.storage.updateBucket(ORG_LOGO_BUCKET, { public: true });
    }
    return;
  }
  await supabaseAdmin.storage.createBucket(ORG_LOGO_BUCKET, { public: true });
}
