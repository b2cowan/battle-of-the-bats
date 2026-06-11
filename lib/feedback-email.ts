/**
 * Feedback email templates (Phase 3). Reuse the shared branded `wrap()` shell + `escapeHtml()` from
 * lib/email.ts so the admin notify + submitter confirmation match every other transactional email.
 * All interpolated user text is escaped — the body is attacker-controlled.
 */
import { wrap, escapeHtml, SITE_URL } from './email';

export function feedbackAdminNotifyHtml(p: {
  type: string;
  category: string;
  title: string | null;
  body: string;
  orgSlug: string | null;
  userEmail: string | null;
}): string {
  const triageUrl = `${SITE_URL}/platform-admin/feedback`;
  return wrap(`
    <h2 style="color:#fff;font-size:1.3rem;margin:0 0 1rem;">New ${escapeHtml(p.type)} feedback</h2>
    <div style="background:#0F172A;border:1px solid rgba(30,58,138,0.25);border-left:3px solid rgba(30,58,138,0.5);padding:1.25rem;margin:1rem 0;">
      <p style="margin:0;line-height:1.8;color:rgba(241,245,249,0.85);">
        Type: <strong>${escapeHtml(p.type)}</strong><br>
        Category: <strong>${escapeHtml(p.category)}</strong><br>
        ${p.title ? `Title: <strong>${escapeHtml(p.title)}</strong><br>` : ''}
        Org: <strong>${escapeHtml(p.orgSlug ?? 'Platform / anonymous')}</strong><br>
        From: <strong>${escapeHtml(p.userEmail ?? 'anonymous')}</strong>
      </p>
    </div>
    <div style="background:#0b0f14;border:1px solid rgba(255,255,255,0.08);padding:1rem;margin:1rem 0;color:rgba(241,245,249,0.82);line-height:1.6;">${escapeHtml(p.body)}</div>
    <a href="${triageUrl}" style="display:inline-block;background:#1E3A8A;color:#fff;padding:0.7rem 1.5rem;border-radius:2px;text-decoration:none;font-weight:700;font-size:0.8rem;letter-spacing:0.06em;margin-top:0.5rem;">Open Feedback Queue &rarr;</a>
  `);
}

export function feedbackConfirmationHtml(p: { type: string; submitterName: string | null }): string {
  const greeting = p.submitterName ? `Hi ${escapeHtml(p.submitterName)},` : 'Hi,';
  const noun = p.type === 'bug' ? 'bug report' : p.type === 'feature' ? 'feature request' : 'feedback';
  return wrap(`
    <h2 style="color:#fff;font-size:1.3rem;margin:0 0 1rem;">Thanks for your ${noun}</h2>
    <p>${greeting}</p>
    <p style="color:rgba(241,245,249,0.78);line-height:1.6;">We've received your ${noun}, and our team reviews every submission. If we need more detail we'll reach out to this email address.</p>
    <p style="color:rgba(241,245,249,0.45);font-size:0.85rem;">You don't need to do anything else — thanks for helping us improve FieldLogicHQ.</p>
  `);
}
