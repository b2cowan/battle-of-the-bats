import 'server-only';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type { DomainRow, DomainStore, NewDomainRow } from '@/lib/club-domain-service';

/** The `org_custom_domains` table (mig 355) through the service client. Server-only; the routes enforce who may read or write. */
async function one(q: PromiseLike<{ data: unknown; error: unknown }>): Promise<DomainRow | null> {
  const { data, error } = await q;
  if (error) throw error;
  return (data as DomainRow | null) ?? null;
}

export const clubDomainStore: DomainStore = {
  getByOrg: (orgId) => one(supabaseAdmin.from('org_custom_domains').select('*').eq('org_id', orgId).maybeSingle()),
  getByFullName: (fullName) => one(supabaseAdmin.from('org_custom_domains').select('*').eq('full_name', fullName).maybeSingle()),
  getByDomain: (domain) => one(supabaseAdmin.from('org_custom_domains').select('*').eq('domain', domain).maybeSingle()),

  async insert(row: NewDomainRow) {
    const created = await one(supabaseAdmin.from('org_custom_domains').insert(row).select('*').single());
    return created as DomainRow;
  },

  async update(orgId, patch) {
    const updated = await one(
      supabaseAdmin
        .from('org_custom_domains')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('org_id', orgId)
        .select('*')
        .single(),
    );
    return updated as DomainRow;
  },

  async remove(orgId) {
    const { error } = await supabaseAdmin.from('org_custom_domains').delete().eq('org_id', orgId);
    if (error) throw error;
  },
};
