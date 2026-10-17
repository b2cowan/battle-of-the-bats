/**
 * A ROW A WRITE NAMES IS THIS ORGANIZATION'S (security fix, 2026-10-16; the team-update sweep's smaller findings).
 *
 * Three writes stored an id from the request without checking whose row it named — each a pointer into another
 * organization, not a read or an overwrite of its data:
 *  - a division's contact member (`divisions.contact_member_id`), where the tournament's default contact was already
 *    checked (app/api/admin/tournaments/route.ts);
 *  - a club ledger's tournament (`accounting_ledgers.entity_id` for `entity_type = 'tournament'`);
 *  - a ledger entry's payee (`accounting_entries.payee_id`) — which also let one organization pin another's payee so
 *    that payee's merge or delete was refused as "named elsewhere".
 * One read each. Server-only (the service-role client).
 */
import { supabaseAdmin } from './supabase-admin';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The sentences a refused write carries. */
export const ORG_REFERENCE_REFUSALS = {
  member: 'Contact member not found in this organization.',
  tournament: 'That tournament isn’t this organization’s.',
  payee: 'That payee isn’t this organization’s.',
} as const;

async function ownedBy(table: 'organization_members' | 'tournaments' | 'org_payees', orgColumn: 'organization_id' | 'org_id', id: unknown, orgId: string): Promise<boolean> {
  if (typeof id !== 'string' || !UUID_RE.test(id)) return false;
  const { data, error } = await supabaseAdmin.from(table).select('id').eq('id', id).eq(orgColumn, orgId).maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

/** Is `memberId` a member row of this organization? */
export const memberInOrg = (orgId: string, memberId: unknown) => ownedBy('organization_members', 'organization_id', memberId, orgId);

/** Is `tournamentId` one of this organization's tournaments? */
export const tournamentInOrg = (orgId: string, tournamentId: unknown) => ownedBy('tournaments', 'org_id', tournamentId, orgId);

/** Is `payeeId` one of this organization's payees? */
export const payeeInOrg = (orgId: string, payeeId: unknown) => ownedBy('org_payees', 'org_id', payeeId, orgId);
