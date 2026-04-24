const RESEND_API = 'https://api.resend.com/emails';
const FROM = process.env.RESEND_FROM ?? 'Battle of the Bats <onboarding@resend.dev>';
const ADMIN_EMAIL = 'b2cowan@gmail.com';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn('[email] RESEND_API_KEY not set — skipping send');
    console.log(`[email] TO: ${to} | SUBJECT: ${subject}`);
    return;
  }
  const res = await fetch(RESEND_API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error('[email] Resend error:', err);
  }
}

export { ADMIN_EMAIL, SITE_URL };

// ── Email templates ────────────────────────────────────────────────────────────

const wrap = (content: string) => `
<div style="font-family:Inter,sans-serif;background:#0D0B14;color:#fff;max-width:600px;margin:0 auto;padding:2rem;border-radius:12px;border:1px solid rgba(139,47,201,0.3);">
  <div style="margin-bottom:1.5rem;">
    <span style="font-size:1.75rem;font-weight:900;color:#A855F7;letter-spacing:0.04em;">⚾ BATTLE OF THE BATS</span>
  </div>
  ${content}
  <hr style="border:none;border-top:1px solid rgba(255,255,255,0.08);margin:2rem 0;" />
  <p style="color:rgba(255,255,255,0.4);font-size:0.8rem;margin:0;">
    Questions? Reply to this email or contact
    <a href="mailto:b2cowan@gmail.com" style="color:#A855F7;">b2cowan@gmail.com</a>
  </p>
</div>`;

export function registrationConfirmationHtml(p: {
  teamName: string; coachName: string; ageGroupName: string; tournamentName: string;
}) {
  return wrap(`
    <h2 style="color:#fff;font-size:1.4rem;margin:0 0 1rem;">Registration Received!</h2>
    <p>Hi <strong>${p.coachName}</strong>,</p>
    <p>We've received your registration for <strong>${p.teamName}</strong> in the <strong>${p.ageGroupName}</strong> division for <strong>${p.tournamentName}</strong>.</p>
    <div style="background:#1A1530;border:1px solid rgba(139,47,201,0.3);border-radius:8px;padding:1.25rem;margin:1.5rem 0;">
      <p style="margin:0 0 0.5rem;font-weight:700;color:#A855F7;">Registration Details</p>
      <p style="margin:0;line-height:1.8;">
        Team: <strong>${p.teamName}</strong><br>
        Coach: <strong>${p.coachName}</strong><br>
        Division: <strong>${p.ageGroupName}</strong><br>
        Tournament: <strong>${p.tournamentName}</strong>
      </p>
    </div>
    <p style="color:rgba(255,255,255,0.7);">Your registration is currently <strong style="color:#F59E0B;">pending review</strong>. You'll receive another email once your team has been accepted, including payment instructions to secure your spot.</p>
  `);
}

export function adminNotificationHtml(p: {
  teamName: string; coachName: string; email: string; ageGroupName: string; tournamentName: string;
}) {
  const adminUrl = `${SITE_URL}/admin/registrations`;
  return wrap(`
    <h2 style="color:#fff;font-size:1.4rem;margin:0 0 1rem;">📋 New Team Registration</h2>
    <p>A new team has registered for <strong>${p.tournamentName}</strong>:</p>
    <div style="background:#1A1530;border:1px solid rgba(139,47,201,0.3);border-radius:8px;padding:1.25rem;margin:1rem 0;">
      <p style="margin:0;line-height:1.8;">
        Team: <strong>${p.teamName}</strong><br>
        Coach: <strong>${p.coachName}</strong><br>
        Division: <strong>${p.ageGroupName}</strong><br>
        Contact: <a href="mailto:${p.email}" style="color:#A855F7;">${p.email}</a>
      </p>
    </div>
    <a href="${adminUrl}" style="display:inline-block;background:#8B2FC9;color:#fff;padding:0.75rem 1.75rem;border-radius:8px;text-decoration:none;font-weight:700;margin-top:0.5rem;">Review in Admin Panel →</a>
  `);
}

export function acceptanceHtml(p: {
  teamName: string; coachName: string; ageGroupName: string; tournamentName: string; teamId: string;
}) {
  const profileUrl = `${SITE_URL}/teams/${p.teamId}`;
  return wrap(`
    <h2 style="color:#22C55E;font-size:1.4rem;margin:0 0 1rem;">🎉 Team Accepted!</h2>
    <p>Hi <strong>${p.coachName}</strong>,</p>
    <p>Great news! <strong>${p.teamName}</strong> has been accepted into the <strong>${p.ageGroupName}</strong> division for <strong>${p.tournamentName}</strong>.</p>
    <div style="background:#1A1530;border:2px solid rgba(34,197,94,0.4);border-radius:8px;padding:1.5rem;margin:1.5rem 0;">
      <p style="margin:0 0 0.75rem;color:#22C55E;font-weight:700;font-size:1.05rem;">💳 Payment Required</p>
      <p style="margin:0 0 0.75rem;">To secure your spot, please submit your registration fee via <strong>Interac E-Transfer</strong>:</p>
      <table style="border-collapse:collapse;width:100%;">
        <tr><td style="padding:0.3rem 0;color:rgba(255,255,255,0.6);width:120px;">Send to:</td>
            <td><strong><a href="mailto:b2cowan@gmail.com" style="color:#A855F7;">b2cowan@gmail.com</a></strong></td></tr>
        <tr><td style="padding:0.3rem 0;color:rgba(255,255,255,0.6);">Message:</td>
            <td><strong>${p.teamName} — ${p.ageGroupName} — ${p.tournamentName}</strong></td></tr>
      </table>
      <p style="margin:1rem 0 0;color:rgba(255,255,255,0.5);font-size:0.85rem;">Your registration will be fully confirmed once payment is received.</p>
    </div>
    <a href="${profileUrl}" style="display:inline-block;background:#8B2FC9;color:#fff;padding:0.75rem 1.75rem;border-radius:8px;text-decoration:none;font-weight:700;">View Team Profile →</a>
  `);
}

export function rejectionHtml(p: {
  teamName: string; coachName: string; ageGroupName: string; tournamentName: string;
}) {
  return wrap(`
    <h2 style="color:#EF4444;font-size:1.4rem;margin:0 0 1rem;">Registration Update</h2>
    <p>Hi <strong>${p.coachName}</strong>,</p>
    <p>Thank you for your interest in <strong>${p.tournamentName}</strong>. Unfortunately, we are unable to accommodate <strong>${p.teamName}</strong> in the <strong>${p.ageGroupName}</strong> division at this time.</p>
    <p style="color:rgba(255,255,255,0.7);">This may be due to division capacity or eligibility requirements. Please contact us if you have any questions.</p>
    <a href="mailto:b2cowan@gmail.com" style="display:inline-block;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.4);color:#f87171;padding:0.75rem 1.75rem;border-radius:8px;text-decoration:none;font-weight:700;margin-top:0.5rem;">Contact Us</a>
  `);
}

export function paymentConfirmationHtml(p: {
  teamName: string; coachName: string; ageGroupName: string; tournamentName: string;
}) {
  return wrap(`
    <h2 style="color:#22C55E;font-size:1.4rem;margin:0 0 1rem;">✅ Payment Confirmed!</h2>
    <p>Hi <strong>${p.coachName}</strong>,</p>
    <p>Your payment for <strong>${p.teamName}</strong> has been received and confirmed. Your registration for the <strong>${p.ageGroupName}</strong> division of <strong>${p.tournamentName}</strong> is now <strong style="color:#22C55E;">complete</strong>!</p>
    <p style="color:rgba(255,255,255,0.7);">Stay tuned for schedule announcements. We look forward to seeing you on the diamond!</p>
  `);
}
