/**
 * A lead's work tools (Support console Stage 7 Parts 4 and 9): link a club, unlink it, "Not this club", add a note,
 * remove a note. Server only; every route that calls these has asked the growth power first (a note's removal, Super
 * admin). Each writes its audit entry with the lead id as Field and never a stranger's words; a lead is not yet a
 * customer, so none asks a reason (owner Q6; `tests/unit/platform-audit-reason-guard.test.ts`).
 *
 * ⚠ A link is made only by a person's press (owner Q2): an offered match is re-checked against `readOffers` at the
 * moment of the press, and a hand link passes the same exclusions as an offer (no demo club, no club a staff address
 * owns).
 */
import { supabaseAdmin } from './supabase-admin';
import { writePlatformAuditLog, writePlatformAuditLogStrict } from './platform-audit';
import { isDemoOrgId } from './demo-org-server';
import { getBootstrapAdminEmails } from './platform-auth';
import { readLeadBook, readOffers, type BookLead, type OfferedClub, type Read } from './lead-book';
import { normalAddress } from './lead-numbers';
import { leadsInList, type PipelineFilters } from './lead-views';
import { EARLY_ACCESS_STATUSES, isEarlyAccessStatus, type EarlyAccessStatus } from './early-access-admin';

export type WriteResult = { ok: true } | { ok: false; status: number; error: string };

const fail = (status: number, error: string): WriteResult => ({ ok: false, status, error });

type LeadNow = { id: string; email: string; internal_status: string; linked_at: string | null; converted_org_id: string | null; converted_at: string | null };

async function leadNow(leadId: string): Promise<LeadNow | null | 'error'> {
  const { data, error } = await supabaseAdmin.from('early_access_leads')
    .select('id, email, internal_status, linked_at, converted_org_id, converted_at').eq('id', leadId).maybeSingle();
  if (error) return 'error';
  return (data as LeadNow | null) ?? null;
}

/** A club a staff address owns, or a demo club: never linked, never offered. Throws when it cannot tell. */
async function refusedClub(orgId: string): Promise<boolean> {
  if (await isDemoOrgId(orgId)) return true;
  const { data: owners, error } = await supabaseAdmin.from('organization_members').select('user_id').eq('organization_id', orgId).eq('role', 'owner');
  if (error) throw error;
  const ids = ((owners ?? []) as { user_id: string }[]).map(o => o.user_id);
  if (ids.length === 0) return false;
  const { data: people, error: peopleError } = await supabaseAdmin.rpc('platform_people_by_ids', { p_ids: ids });
  if (peopleError) throw peopleError;
  const { data: staffRows, error: staffError } = await supabaseAdmin.from('platform_users').select('email');
  if (staffError) throw staffError;
  const staff = new Set([...getBootstrapAdminEmails(), ...((staffRows ?? []) as { email: string }[]).map(s => normalAddress(s.email))]);
  return ((people ?? []) as { email: string }[]).some(p => staff.has(normalAddress(p.email)));
}

/** Link a club or portal: an offered match a person confirms, or one picked by hand. Clears the follow-up and next action. */
export async function linkLead(actor: string, leadId: string, orgId: string, method: 'offered' | 'by_hand'): Promise<WriteResult> {
  const lead = await leadNow(leadId);
  if (lead === 'error') return fail(500, 'The lead could not be read. Nothing was linked.');
  if (!lead) return fail(404, 'Lead not found');
  if (lead.linked_at) return fail(409, 'This lead already has a club. Unlink it first.');

  const { data: org, error: orgError } = await supabaseAdmin.from('organizations').select('id, name, created_at').eq('id', orgId).maybeSingle();
  if (orgError) return fail(500, 'The club could not be read. Nothing was linked.');
  if (!org) return fail(404, 'Club not found');

  try {
    if (method === 'offered') {
      const offers = await readOffers([{ id: lead.id, email: lead.email, step: lead.internal_status as EarlyAccessStatus, linkedAt: null }]);
      if (offers.kind === 'not_read') return fail(503, 'The match could not be checked just now. Nothing was linked.');
      if (!(offers.value.get(lead.id) ?? []).some(c => c.orgId === orgId)) return fail(409, 'That club is no longer offered for this lead.');
    } else if (await refusedClub(orgId)) {
      return fail(400, 'A demo club or a staff test club cannot be linked to a lead.');
    }
  } catch {
    return fail(503, 'The club could not be checked just now. Nothing was linked.');
  }

  const now = new Date().toISOString();
  const { error } = await supabaseAdmin.from('early_access_leads').update({
    internal_status: 'converted',
    converted_org_id: orgId,
    converted_at: lead.converted_at ?? now,
    link_method: method,
    linked_by: normalAddress(actor),
    linked_at: now,
    signed_up_at: (org as { created_at: string }).created_at,
    lost_reason: null,
    step_changed_at: now,
    follow_up_due_at: null,
    next_action: null,
    updated_at: now,
  }).eq('id', leadId).is('linked_at', null);
  if (error) return fail(500, 'The link could not be saved.');

  await writePlatformAuditLog(actor, orgId, 'link_early_access_lead', leadId,
    { internal_status: lead.internal_status }, { internal_status: 'converted', method, orgId });
  return { ok: true };
}

/** Unlink: the step goes back to where it stood before the link (the timeline keeps both). */
export async function unlinkLead(actor: string, leadId: string): Promise<WriteResult> {
  const lead = await leadNow(leadId);
  if (lead === 'error') return fail(500, 'The lead could not be read.');
  if (!lead) return fail(404, 'Lead not found');
  if (!lead.linked_at) return fail(409, 'This lead has no club linked.');

  const { data: links } = await supabaseAdmin.from('platform_audit_log').select('old_value')
    .eq('action', 'link_early_access_lead').eq('field', leadId).order('created_at', { ascending: false }).limit(1);
  const before = ((links ?? [])[0] as { old_value: { internal_status?: string } | null } | undefined)?.old_value?.internal_status;
  const back = before && isEarlyAccessStatus(before) && before !== 'converted' && before !== 'lost' ? before : 'pilot_candidate';

  const now = new Date().toISOString();
  const { error } = await supabaseAdmin.from('early_access_leads').update({
    internal_status: back, converted_org_id: null, converted_at: null, link_method: null, linked_by: null, linked_at: null,
    signed_up_at: null, step_changed_at: now, updated_at: now,
  }).eq('id', leadId);
  if (error) return fail(500, 'The club could not be unlinked.');

  await writePlatformAuditLog(actor, lead.converted_org_id, 'unlink_early_access_lead', leadId,
    { internal_status: 'converted', orgId: lead.converted_org_id }, { internal_status: back });
  return { ok: true };
}

/** "Not this club": never offered for this lead again. */
export async function dismissOffer(actor: string, leadId: string, orgId: string): Promise<WriteResult> {
  const { error } = await supabaseAdmin.from('early_access_lead_dismissed_offers')
    .upsert({ lead_id: leadId, org_id: orgId, dismissed_by: normalAddress(actor) }, { onConflict: 'lead_id,org_id', ignoreDuplicates: true });
  if (error) return fail(500, 'That could not be saved.');
  await writePlatformAuditLog(actor, orgId, 'dismiss_early_access_offer', leadId, null, { orgId });
  return { ok: true };
}

// ── Copy emails and the export (Part 9; owner Q10, threats 2–3) ──────────────────────────────────────────────────

export type ListParams = { scope: 'needs' | 'all'; filters: PipelineFilters };

const token = (v: string | null, max = 40) => (v ?? '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, max);

/** The list a Copy emails or an export works on, from the address the screen sent (the screen's own filters). */
export function listFromParams(sp: URLSearchParams): ListParams {
  const step = sp.get('step') ?? '';
  return {
    scope: sp.get('scope') === 'all' || step ? 'all' : 'needs',
    filters: {
      q: (sp.get('q') ?? '').trim().slice(0, 80),
      step: (EARLY_ACCESS_STATUSES as readonly string[]).includes(step) ? step : '',
      plan: token(sp.get('plan')),
      source: token(sp.get('source')),
      tag: token(sp.get('tag'), 32),
    },
  };
}

/** "Needs you", or "Every lead · step Lost · source Search" — the audit entry's words for the list, never an address. */
export function listWords(l: ListParams): string {
  const parts = [l.scope === 'needs' ? 'Needs you' : 'Every lead'];
  for (const [k, v] of Object.entries(l.filters)) if (v) parts.push(k === 'q' ? 'a search' : `${k} ${v}`);
  return parts.join(' · ');
}

export async function readList(l: ListParams): Promise<Read<BookLead[]>> {
  const book = await readLeadBook();
  if (book.kind === 'not_read') return book;
  let offers = new Map<string, OfferedClub[]>();
  if (l.scope === 'needs') {
    const read = await readOffers(book.value);
    if (read.kind === 'not_read') return { kind: 'not_read' };
    offers = read.value;
  }
  return { kind: 'read', value: leadsInList(book.value, offers, l.scope, l.filters, new Date()) };
}

/** A lead who asked not to be contacted: never in Copy emails, and an empty email cell in an export. */
export function askedNotToBeContacted(l: Pick<BookLead, 'step' | 'lostReason'>): boolean {
  return l.step === 'lost' && l.lostReason === 'asked_not_to_contact';
}

/** Copy emails: the leads in the list who said yes to release emails, never one who asked not to be contacted. */
export async function copyEmails(actor: string, l: ListParams): Promise<{ ok: true; emails: string[] } | Extract<WriteResult, { ok: false }>> {
  const list = await readList(l);
  if (list.kind === 'not_read') return { ok: false, status: 503, error: 'The leads could not be read just now. Nothing was copied.' };
  const emails = [...new Set(list.value.filter(x => x.consent && !askedNotToBeContacted(x)).map(x => x.email))];
  // Who, when, how many and which list — never an address.
  await writePlatformAuditLog(actor, null, 'copy_early_access_emails', 'list', null, { count: emails.length, list: listWords(l) });
  return { ok: true, emails };
}

/**
 * The export's audit entry, written BEFORE the file is sent: if it cannot be written, nothing is sent (threat 2).
 * Returns false when the write failed.
 */
export async function recordExport(actor: string, l: ListParams, rows: number, format: string): Promise<boolean> {
  try {
    await writePlatformAuditLogStrict(actor, null, 'export_early_access_leads', 'list', null, { rows, format, list: listWords(l) }, {});
    return true;
  } catch {
    return false;
  }
}

export const NOTE_MAX = 4000;

/** A dated, signed note. It is never edited afterwards (the database refuses it). */
export async function addNote(actor: string, leadId: string, body: string): Promise<WriteResult> {
  const text = body.trim();
  if (!text) return fail(400, 'Write the note first.');
  if (text.length > NOTE_MAX) return fail(400, `A note holds up to ${NOTE_MAX.toLocaleString('en-CA')} characters.`);
  const { data, error } = await supabaseAdmin.from('early_access_lead_notes')
    .insert({ lead_id: leadId, body: text, author_email: normalAddress(actor) }).select('id').single();
  if (error) return fail(error.code === '23503' ? 404 : 500, error.code === '23503' ? 'Lead not found' : 'The note could not be saved.');
  await writePlatformAuditLog(actor, null, 'add_early_access_note', leadId, null, { noteId: (data as { id: string }).id });
  return { ok: true };
}

/** A Super admin's removal: who and when are kept, the text is gone ("A note was removed"). */
export async function removeNote(actor: string, leadId: string, noteId: string): Promise<WriteResult> {
  const { data, error } = await supabaseAdmin.from('early_access_lead_notes')
    .update({ body: null, removed_by: normalAddress(actor), removed_at: new Date().toISOString() })
    .eq('id', noteId).eq('lead_id', leadId).is('removed_at', null).select('id');
  if (error) return fail(500, 'The note could not be removed.');
  if (!data || data.length === 0) return fail(404, 'Note not found, or already removed.');
  await writePlatformAuditLog(actor, null, 'remove_early_access_note', leadId, null, { noteId });
  return { ok: true };
}
