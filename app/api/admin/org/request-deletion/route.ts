import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';

let _resend: import('resend').Resend | null = null;
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

export async function POST(req: Request) {
  const ctx = await getAuthContextWithRole();
  if (!ctx) return unauthorized();
  if (ctx.role !== 'owner') return forbidden();

  const body = await req.json().catch(() => ({}));
  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 1000) : '';

  const ownerEmail = ctx.user.email ?? '(unknown)';
  const fromAddress = process.env.RESEND_FROM ?? 'noreply@fieldlogichq.ca';
  const supportEmail = 'fieldlogichq@gmail.com';

  await getResend().emails.send({
    from: fromAddress,
    to: supportEmail,
    subject: `[FieldLogicHQ] Org deletion request — ${ctx.org.name}`,
    html: `
<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 2rem; color: #1a1a2e;">
  <h2 style="margin-top: 0;">Organization Deletion Request</h2>
  <table style="border-collapse: collapse; width: 100%; font-size: 0.9rem;">
    <tr><td style="padding: 0.4rem 0; color: #666; white-space: nowrap; padding-right: 1rem;">Organization</td><td style="padding: 0.4rem 0;"><strong>${ctx.org.name}</strong></td></tr>
    <tr><td style="padding: 0.4rem 0; color: #666; padding-right: 1rem;">Slug</td><td style="padding: 0.4rem 0;">${ctx.org.slug}</td></tr>
    <tr><td style="padding: 0.4rem 0; color: #666; padding-right: 1rem;">Org ID</td><td style="padding: 0.4rem 0; font-family: monospace; font-size: 0.8rem;">${ctx.org.id}</td></tr>
    <tr><td style="padding: 0.4rem 0; color: #666; padding-right: 1rem;">Owner</td><td style="padding: 0.4rem 0;">${ownerEmail}</td></tr>
    <tr><td style="padding: 0.4rem 0; color: #666; padding-right: 1rem;">Plan</td><td style="padding: 0.4rem 0;">${ctx.org.planId}</td></tr>
    <tr><td style="padding: 0.4rem 0; color: #666; padding-right: 1rem;">Reason</td><td style="padding: 0.4rem 0;">${reason || '<em>No reason provided</em>'}</td></tr>
    <tr><td style="padding: 0.4rem 0; color: #666; padding-right: 1rem;">Requested at</td><td style="padding: 0.4rem 0;">${new Date().toISOString()}</td></tr>
  </table>
</body>
</html>`,
    text: `Organization Deletion Request

Organization: ${ctx.org.name}
Slug: ${ctx.org.slug}
Org ID: ${ctx.org.id}
Owner: ${ownerEmail}
Plan: ${ctx.org.planId}
Reason: ${reason || '(no reason provided)'}
Requested at: ${new Date().toISOString()}`,
  });

  return NextResponse.json({ ok: true });
}
