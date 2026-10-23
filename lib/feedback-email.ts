/**
 * Feedback email templates (Phase 3). Reuse the shared branded `wrap()` shell + `escapeHtml()` from
 * lib/email.ts so the admin notify + submitter confirmation match every other transactional email.
 * All interpolated user text is escaped — the body is attacker-controlled.
 */
import { wrap, escapeHtml, SITE_URL } from './email';
import { WARM_EMAIL, warmEmailButton, warmPanelStyle } from './email-envelope-warm';

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
    <h2 style="color:${WARM_EMAIL.ink};font-size:1.3rem;margin:0 0 1rem;">New ${escapeHtml(p.type)} feedback</h2>
    <div style="${warmPanelStyle('secondary', { margin: '1rem 0' })}">
      <p style="margin:0;line-height:1.8;color:${WARM_EMAIL.ink};">
        Type: <strong>${escapeHtml(p.type)}</strong><br>
        Category: <strong>${escapeHtml(p.category)}</strong><br>
        ${p.title ? `Title: <strong>${escapeHtml(p.title)}</strong><br>` : ''}
        Org: <strong>${escapeHtml(p.orgSlug ?? 'Platform / anonymous')}</strong><br>
        From: <strong>${escapeHtml(p.userEmail ?? 'anonymous')}</strong>
      </p>
    </div>
    <div style="background:${WARM_EMAIL.ground};border:1px solid ${WARM_EMAIL.cardEdge};padding:1rem;margin:1rem 0;color:${WARM_EMAIL.ink};line-height:1.6;">${escapeHtml(p.body)}</div>
    ${warmEmailButton('Open Feedback Queue', triageUrl)}
  `);
}

export function feedbackConfirmationHtml(p: { type: string; submitterName: string | null }): string {
  const greeting = p.submitterName ? `Hi ${escapeHtml(p.submitterName)},` : 'Hi,';
  const noun = p.type === 'bug' ? 'bug report' : p.type === 'feature' ? 'feature request' : 'feedback';
  return wrap(`
    <h2 style="color:${WARM_EMAIL.ink};font-size:1.3rem;margin:0 0 1rem;">Thanks for your ${noun}</h2>
    <p>${greeting}</p>
    <p style="color:${WARM_EMAIL.ink};line-height:1.6;">We've received your ${noun}, and our team reviews every submission. If we need more detail we'll reach out to this email address.</p>
    <p style="color:${WARM_EMAIL.secondary};font-size:0.85rem;">You don't need to do anything else — thanks for helping us improve FieldLogicHQ.</p>
  `);
}
