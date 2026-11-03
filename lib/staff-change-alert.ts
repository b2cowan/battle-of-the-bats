import { ADMIN_EMAIL, sendEmail } from './email';
import { writePlatformAuditLog } from './platform-audit';
import { SIGN_IN_AGAIN_AUDIT } from './sign-in-again';
import { STAFF_CHANGE_AUDIT_ACTION, staffChangeAlertEmail, type StaffChangeAlert } from './staff-change-alert-email';

/**
 * Sends THE OWNER'S EMAIL after a change that asked for the password again (Stage 0, Part 10, tab 5; the words are in
 * `lib/staff-change-alert-email.ts`). One email per run, sent AFTER it finishes; the caller sends none when nothing
 * changed. Returns whether it went. When it did not, the change stands and the audit log gets "Owner email: not sent"
 * beside it, with what the mail service answered (Ask 9); the finish notice says so. No retry later: a late alarm is
 * worse than an honest "not sent". Never throws: the change it reports has already happened.
 */
export async function alertOwnerOfStaffChange(alert: StaffChangeAlert): Promise<boolean> {
  let answer: string;
  try {
    const { subject, html } = staffChangeAlertEmail(alert);
    const sent = await sendEmail(ADMIN_EMAIL, subject, html, { kind: 'staff_change_alert', timeoutMs: 10_000 });
    if (sent.status === 'sent') return true;
    answer = sent.status;
  } catch (err) {
    answer = err instanceof Error ? err.message.slice(0, 300) : 'error';
  }
  await writePlatformAuditLog(alert.actor, null, SIGN_IN_AGAIN_AUDIT.ownerEmailNotSent, alert.kind, null, {
    change: STAFF_CHANGE_AUDIT_ACTION[alert.kind],
    ...(alert.kind === 'bulk' ? { bulk_operation_id: alert.bulkOperationId } : { change_request_id: alert.changeRequestId }),
    mail_service: answer,
  });
  return false;
}
