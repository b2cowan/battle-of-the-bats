import 'server-only';
/**
 * THE DELETION REQUEST RECORD (mig 514, ruling A10; /legal ORG_DELETION_REQUEST_WINDOW.md findings 6, 8, 9; Settings in both
 * workspaces Session 1, owner "as recommended" 2026-11-20).
 *
 * An owner's "Ask us to delete {name}" is recorded, emailed to privacy@ (no longer the Gmail address), and acknowledged to
 * EVERY active owner (L-B). One open request per organization. Staff close it on the organization's platform-admin page
 * (answered / withdrawn); the platform-admin deletion marks it deleted. The row outlives the organization (§9's "record
 * that the deletion happened").
 */
import { supabaseAdmin } from './supabase-admin';
import { sendEmail, orgDeletionRequestHtml, orgDeletionReceivedHtml } from './email';
import { orgOwnerEmails, orgOwnerUserIds } from './notify-recipients';
import { PLAN_CONFIG } from './plan-config';
import { ownPlanOf } from './entitlement-grants';
import { hasModuleEntitlement } from './module-entitlements';
import { teamWorkspaceDisplayName } from './coaches-portal-routes';
import { ORG_DELETION_WORDS as W, PRIVACY_EMAIL, type DeletionExportFrom, type OpenDeletionRequest } from './org-deletion-words';
import type { Organization, OrgPlan } from './types';

export type DeletionRequestStatus = 'sent' | 'answered' | 'withdrawn' | 'deleted';
/** What staff read on the organization's page. */
export type StaffDeletionRequest = OpenDeletionRequest & { reason: string | null };

const OPEN_COLUMNS = 'id, created_at, requester_email, reason';
type OpenRow = { id: string; created_at: string; requester_email: string; reason: string | null };
const toOpen = (row: OpenRow): StaffDeletionRequest => ({ id: row.id, sentAt: row.created_at, requesterEmail: row.requester_email, reason: row.reason });

/** The organization's open request, or null. Throws on a failed read (the page then says it couldn't check, never "none"). */
export async function readOpenDeletionRequest(orgId: string): Promise<StaffDeletionRequest | null> {
  const { data, error } = await supabaseAdmin.from('org_deletion_requests').select(OPEN_COLUMNS)
    .eq('org_id', orgId).eq('status', 'sent').maybeSingle();
  if (error) throw error;
  return data ? toOpen(data as OpenRow) : null;
}

/** The owner's view drops the reason: the page shows only the sent line. */
export function ownerView(request: StaffDeletionRequest | null): OpenDeletionRequest | null {
  return request ? { id: request.id, sentAt: request.sentAt, requesterEmail: request.requesterEmail } : null;
}

/** How many active owners the reply goes to ("{name}'s owners" when more than one). */
export async function deletionOwnerCount(orgId: string): Promise<number> {
  return (await orgOwnerUserIds(orgId)).length;
}

/** The payments part's export line names a page the organization has (the build check on "from Accounting"). */
export function deletionExportFrom(org: Organization): DeletionExportFrom {
  if (hasModuleEntitlement(org, 'module_accounting')) return 'accounting';
  const plan = ownPlanOf(org);
  return plan === 'tournament' || plan === 'tournament_plus' ? 'tournament_payouts' : 'settings_payouts';
}

export type SendDeletionResult =
  | { status: 'sent'; request: StaffDeletionRequest }
  | { status: 'already_open'; request: StaffDeletionRequest };

/**
 * Record the request, email privacy@, then acknowledge it to every active owner. A second request while one is open
 * returns the open one (the partial unique index settles a race; the winner's row is never removed, so the re-read finds it).
 *
 * ⚠ THE RECORD IS THE TRUTH, the email is a copy (review 2026-11-20). The row is never removed once written: it shows on the
 * organization's platform-admin page whatever happened to the mail. A privacy@ send that is refused, unconfirmed or
 * skipped (no mail key) OPENS AN ISSUE in the platform feed instead of rolling the record back — a rollback could leave a
 * recorded request nobody was told about, tell a second owner "sent" for a row about to vanish, or send privacy@ twice.
 */
export async function sendDeletionRequest(input: {
  org: Organization; userId: string; email: string; reason: string;
}): Promise<SendDeletionResult> {
  const { org } = input;
  const existing = await readOpenDeletionRequest(org.id);
  if (existing) return { status: 'already_open', request: existing };

  const { data, error } = await supabaseAdmin.from('org_deletion_requests').insert({
    org_id: org.id, org_name: org.name, org_slug: org.slug,
    requested_by: input.userId, requester_email: input.email, reason: input.reason || null,
  }).select(OPEN_COLUMNS).single();
  if (error) {
    if (error.code === '23505') {
      const open = await readOpenDeletionRequest(org.id);
      if (open) return { status: 'already_open', request: open };
    }
    throw error;
  }
  const request = toOpen(data as OpenRow);

  const plan = ownPlanOf(org) as OrgPlan;
  let delivered: string;
  try {
    const sent = await sendEmail(
      PRIVACY_EMAIL,
      `[FieldLogicHQ] Org deletion request — ${org.name}`,
      orgDeletionRequestHtml({
        orgName: org.name, orgSlug: org.slug, orgId: org.id, ownerEmail: input.email,
        planLabel: PLAN_CONFIG[plan]?.label ?? plan, reason: input.reason, requestedAt: request.sentAt,
      }),
      { kind: 'org_deletion_request', idempotencyKey: `org-deletion-request:${request.id}` },
    );
    delivered = sent.status;
  } catch {
    delivered = 'thrown';
  }
  if (delivered !== 'sent') await reportUnsent(org, request.id, delivered);

  await acknowledge(org, plan, request).catch(e =>
    console.error('[org-deletion] acknowledgement failed:', e instanceof Error ? e.message : String(e)));
  return { status: 'sent', request };
}

/** A recorded request whose privacy@ copy may not have arrived: an issue staff will see (never the reason or an email). */
async function reportUnsent(org: Organization, requestId: string, outcome: string): Promise<void> {
  console.error(`[org-deletion] privacy@ copy not confirmed (${outcome}) for request ${requestId}`);
  const { captureError } = await import('./observability/capture');
  await captureError(new Error(`A deletion request was recorded but its privacy@ email was not confirmed (${outcome})`), {
    severity: 'error', org: { id: org.id, slug: org.slug }, marksRequestCaptured: false,
    requestContext: { deletionRequestId: requestId, outcome },
  });
}

/** L-B: every active owner, and the requester even when the owner list can't name them. */
async function acknowledge(org: Organization, plan: OrgPlan, request: StaffDeletionRequest): Promise<void> {
  // A Premium workspace is "{team} Coaches Portal" underneath; the owner knows it by the team's name (as the window says it).
  const name = plan === 'team' ? teamWorkspaceDisplayName(org.name) : org.name;
  const owners = await orgOwnerEmails(org.id).catch(() => []);
  const to = owners.map(o => o.email);
  if (!to.some(e => e.toLowerCase() === request.requesterEmail.toLowerCase())) to.push(request.requesterEmail);
  const html = orgDeletionReceivedHtml({
    asked: W.email.asked(request.requesterEmail, request.sentAt, name, org.slug),
    reply: W.email.reply,
    object: W.email.object(name),
    signature: W.email.signature,
  });
  for (const email of to) {
    await sendEmail(email, W.email.subject(name), html, {
      kind: 'org_deletion_request_received', orgId: org.id, replyTo: PRIVACY_EMAIL,
      idempotencyKey: `org-deletion-ack:${request.id}:${email.toLowerCase()}`,
    }).catch(e => console.error('[org-deletion] acknowledgement to an owner failed:', e instanceof Error ? e.message : String(e)));
  }
}

/** Staff close an open request (platform admin). Returns false when it was no longer open. */
export async function closeDeletionRequest(id: string, status: 'answered' | 'withdrawn', staffEmail: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin.from('org_deletion_requests')
    .update({ status, closed_at: new Date().toISOString(), closed_by: staffEmail })
    .eq('id', id).eq('status', 'sent').select('id');
  if (error) throw error;
  return (data ?? []).length > 0;
}

/** The platform-admin deletion, step 1 (before the organization goes): its LATEST request, when that is open or answered —
 *  never an older one behind a newer withdrawn request. Null when there is none. */
export async function findDeletionRequestToMark(orgId: string): Promise<{ id: string; status: 'sent' | 'answered' } | null> {
  const { data, error } = await supabaseAdmin.from('org_deletion_requests').select('id, status')
    .eq('org_id', orgId).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  const row = data as { id: string; status: DeletionRequestStatus } | null;
  return row && (row.status === 'sent' || row.status === 'answered') ? { id: row.id, status: row.status } : null;
}

/** Step 2, only AFTER the organization row is gone (a delete that fails part-way leaves the request as it was). An answered
 *  request keeps when and by whom it was answered; an open one is closed now, by the staff who deleted. Guarded on the
 *  status it was found in, so a close in between is never overwritten. */
export async function markDeletionRequestDeleted(target: { id: string; status: 'sent' | 'answered' }, staffEmail: string): Promise<void> {
  const { error } = await supabaseAdmin.from('org_deletion_requests')
    .update(target.status === 'sent' ? { status: 'deleted', closed_at: new Date().toISOString(), closed_by: staffEmail } : { status: 'deleted' })
    .eq('id', target.id).eq('status', target.status);
  if (error) throw error;
}
