const RESEND_API = 'https://api.resend.com/emails';
const FROM = process.env.RESEND_FROM ?? 'FieldLogicHQ <onboarding@resend.dev>';
const ADMIN_EMAIL = 'fieldlogichq@gmail.com';
const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi, '$2 ($1)')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

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
    body: JSON.stringify({ from: FROM, to, subject, html, text: htmlToText(html) }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error('[email] Resend error:', err);
  }
}

export { ADMIN_EMAIL, SITE_URL };

// ── Email templates ────────────────────────────────────────────────────────────

const wrap = (content: string, contactEmail = ADMIN_EMAIL) => `
<div style="font-family:Inter,sans-serif;background:#0D0B14;color:#fff;max-width:600px;margin:0 auto;padding:2rem;border-radius:12px;border:1px solid rgba(var(--primary-rgb),0.3);">
  <div style="margin-bottom:1.5rem;">
    <span style="font-size:1.75rem;font-weight:900;color:#A855F7;letter-spacing:0.04em;">FIELDLOGICHQ</span>
  </div>
  ${content}
  <hr style="border:none;border-top:1px solid rgba(255,255,255,0.08);margin:2rem 0;" />
  <p style="color:rgba(255,255,255,0.4);font-size:0.8rem;margin:0;">
    Questions? Reply to this email or contact
    <a href="mailto:${contactEmail}" style="color:#A855F7;">${contactEmail}</a>
  </p>
</div>`;

export function registrationConfirmationHtml(p: {
  teamName: string; coachName: string; ageGroupName: string; tournamentName: string;
  contactEmail?: string;
}) {
  return wrap(`
    <h2 style="color:#fff;font-size:1.4rem;margin:0 0 1rem;">Registration Received!</h2>
    <p>Hi <strong>${p.coachName}</strong>,</p>
    <p>We've received your registration for <strong>${p.teamName}</strong> in the <strong>${p.ageGroupName}</strong> division for <strong>${p.tournamentName}</strong>.</p>
    <div style="background:#1A1530;border:1px solid rgba(var(--primary-rgb),0.3);border-radius:8px;padding:1.25rem;margin:1.5rem 0;">
      <p style="margin:0 0 0.5rem;font-weight:700;color:#A855F7;">Registration Details</p>
      <p style="margin:0;line-height:1.8;">
        Team: <strong>${p.teamName}</strong><br>
        Coach: <strong>${p.coachName}</strong><br>
        Division: <strong>${p.ageGroupName}</strong><br>
        Tournament: <strong>${p.tournamentName}</strong>
      </p>
    </div>
    <p style="color:rgba(255,255,255,0.7);">Your registration is currently <strong style="color:#F59E0B;">pending review</strong>. If payment is required, the organizer will share payment instructions directly. FieldLogicHQ does not process online payments.</p>
  `, p.contactEmail);
}

export function adminNotificationHtml(p: {
  teamName: string; coachName: string; email: string; ageGroupName: string; tournamentName: string;
}) {
  const adminUrl = `${SITE_URL}/admin/registrations`;
  return wrap(`
    <h2 style="color:#fff;font-size:1.4rem;margin:0 0 1rem;">📋 New Team Registration</h2>
    <p>A new team has registered for <strong>${p.tournamentName}</strong>:</p>
    <div style="background:#1A1530;border:1px solid rgba(var(--primary-rgb),0.3);border-radius:8px;padding:1.25rem;margin:1rem 0;">
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
  contactEmail?: string;
}) {
  const profileUrl = `${SITE_URL}/teams/${p.teamId}`;
  const contact = p.contactEmail ?? ADMIN_EMAIL;
  return wrap(`
    <h2 style="color:#22C55E;font-size:1.4rem;margin:0 0 1rem;">🎉 Team Accepted!</h2>
    <p>Hi <strong>${p.coachName}</strong>,</p>
    <p>Great news! <strong>${p.teamName}</strong> has been accepted into the <strong>${p.ageGroupName}</strong> division for <strong>${p.tournamentName}</strong>.</p>
    <div style="background:#1A1530;border:2px solid rgba(34,197,94,0.4);border-radius:8px;padding:1.5rem;margin:1.5rem 0;">
      <p style="margin:0 0 0.75rem;color:#22C55E;font-weight:700;font-size:1.05rem;">Payment Instructions</p>
      <p style="margin:0 0 0.75rem;">If payment is required, the tournament organizer will follow up with instructions for paying outside FieldLogicHQ.</p>
      <p style="margin:1rem 0 0;color:rgba(255,255,255,0.5);font-size:0.85rem;">Questions? Contact <a href="mailto:${contact}" style="color:#A855F7;">${contact}</a>.</p>
    </div>
    <a href="${profileUrl}" style="display:inline-block;background:#8B2FC9;color:#fff;padding:0.75rem 1.75rem;border-radius:8px;text-decoration:none;font-weight:700;">View Team Profile →</a>
  `, p.contactEmail);
}

export function waitlistConfirmationHtml(p: {
  teamName: string; coachName: string; ageGroupName: string; tournamentName: string;
  contactEmail?: string;
}) {
  return wrap(`
    <h2 style="color:#F59E0B;font-size:1.4rem;margin:0 0 1rem;">You're on the Waitlist</h2>
    <p>Hi <strong>${p.coachName}</strong>,</p>
    <p>Thanks for registering <strong>${p.teamName}</strong> for the <strong>${p.ageGroupName}</strong> division of <strong>${p.tournamentName}</strong>.</p>
    <div style="background:#1A1530;border:1px solid rgba(245,158,11,0.3);border-radius:8px;padding:1.25rem;margin:1.5rem 0;">
      <p style="margin:0 0 0.5rem;font-weight:700;color:#F59E0B;">Waitlist Status</p>
      <p style="margin:0;line-height:1.8;">
        Team: <strong>${p.teamName}</strong><br>
        Coach: <strong>${p.coachName}</strong><br>
        Division: <strong>${p.ageGroupName}</strong><br>
        Tournament: <strong>${p.tournamentName}</strong>
      </p>
    </div>
    <p style="color:rgba(255,255,255,0.7);">The <strong>${p.ageGroupName}</strong> division is currently full. Your team has been added to the waitlist and you will be notified by email if a spot becomes available.</p>
  `, p.contactEmail);
}

export function rejectionHtml(p: {
  teamName: string; coachName: string; ageGroupName: string; tournamentName: string;
  contactEmail?: string;
}) {
  const contact = p.contactEmail ?? ADMIN_EMAIL;
  return wrap(`
    <h2 style="color:#EF4444;font-size:1.4rem;margin:0 0 1rem;">Registration Update</h2>
    <p>Hi <strong>${p.coachName}</strong>,</p>
    <p>Thank you for your interest in <strong>${p.tournamentName}</strong>. Unfortunately, we are unable to accommodate <strong>${p.teamName}</strong> in the <strong>${p.ageGroupName}</strong> division at this time.</p>
    <p style="color:rgba(255,255,255,0.7);">This may be due to division capacity or eligibility requirements. Please contact us if you have any questions.</p>
    <a href="mailto:${contact}" style="display:inline-block;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.4);color:#f87171;padding:0.75rem 1.75rem;border-radius:8px;text-decoration:none;font-weight:700;margin-top:0.5rem;">Contact Us</a>
  `, contact);
}

export function paymentConfirmationHtml(p: {
  teamName: string; coachName: string; ageGroupName: string; tournamentName: string;
  contactEmail?: string;
}) {
  return wrap(`
    <h2 style="color:#22C55E;font-size:1.4rem;margin:0 0 1rem;">Payment Recorded</h2>
    <p>Hi <strong>${p.coachName}</strong>,</p>
    <p>The tournament organizer has recorded payment for <strong>${p.teamName}</strong>. Your registration for the <strong>${p.ageGroupName}</strong> division of <strong>${p.tournamentName}</strong> is now marked <strong style="color:#22C55E;">paid</strong>.</p>
    <p style="color:rgba(255,255,255,0.7);">Stay tuned for schedule announcements. We look forward to seeing you on the diamond!</p>
  `, p.contactEmail);
}

// ── House League registration emails ──────────────────────────────────────────

export function leagueRegistrationApprovedHtml(p: {
  playerFirstName: string;
  playerLastName: string;
  guardianFirstName: string;
  seasonName: string;
  divisionName: string;
  registrationId: string;
  contactEmail?: string;
}) {
  const ref = p.registrationId.slice(0, 8).toUpperCase();
  return wrap(`
    <h2 style="color:#22C55E;font-size:1.4rem;margin:0 0 1rem;">✅ Registration Approved!</h2>
    <p>Hi <strong>${p.guardianFirstName}</strong>,</p>
    <p>Great news — <strong>${p.playerFirstName} ${p.playerLastName}</strong>'s registration for <strong>${p.seasonName}</strong> has been approved.</p>
    <div style="background:#1A1530;border:1px solid rgba(34,197,94,0.3);border-radius:8px;padding:1.25rem;margin:1.5rem 0;">
      <p style="margin:0 0 0.5rem;font-weight:700;color:#22C55E;">Registration Details</p>
      <p style="margin:0;line-height:1.8;">
        Player: <strong>${p.playerFirstName} ${p.playerLastName}</strong><br>
        Season: <strong>${p.seasonName}</strong><br>
        Division: <strong>${p.divisionName}</strong><br>
        Reference: <strong style="font-family:monospace;">#${ref}</strong>
      </p>
    </div>
    <p style="color:rgba(255,255,255,0.7);">We look forward to seeing ${p.playerFirstName} on the field! Watch for further updates from your league administrator.</p>
  `, p.contactEmail);
}

export function leagueRegistrationPendingHtml(p: {
  playerFirstName: string;
  playerLastName: string;
  guardianFirstName: string;
  seasonName: string;
  divisionName: string;
  registrationId: string;
  contactEmail?: string;
}) {
  const ref = p.registrationId.slice(0, 8).toUpperCase();
  return wrap(`
    <h2 style="color:#fff;font-size:1.4rem;margin:0 0 1rem;">Registration Received</h2>
    <p>Hi <strong>${p.guardianFirstName}</strong>,</p>
    <p>We've received the registration for <strong>${p.playerFirstName} ${p.playerLastName}</strong> in <strong>${p.seasonName}</strong>. A league administrator will review it shortly.</p>
    <div style="background:#1A1530;border:1px solid rgba(var(--primary-rgb),0.3);border-radius:8px;padding:1.25rem;margin:1.5rem 0;">
      <p style="margin:0 0 0.5rem;font-weight:700;color:#A855F7;">Registration Details</p>
      <p style="margin:0;line-height:1.8;">
        Player: <strong>${p.playerFirstName} ${p.playerLastName}</strong><br>
        Season: <strong>${p.seasonName}</strong><br>
        Division: <strong>${p.divisionName}</strong><br>
        Reference: <strong style="font-family:monospace;">#${ref}</strong>
      </p>
    </div>
    <p style="color:rgba(255,255,255,0.7);">Your registration status is currently <strong style="color:#F59E0B;">pending review</strong>. You will receive another email once a decision has been made. No payment is required until your registration is approved.</p>
  `, p.contactEmail);
}

export function leagueRegistrationWaitlistHtml(p: {
  playerFirstName: string;
  playerLastName: string;
  guardianFirstName: string;
  seasonName: string;
  divisionName: string;
  waitlistPosition: number;
  registrationId: string;
  contactEmail?: string;
}) {
  const ref = p.registrationId.slice(0, 8).toUpperCase();
  return wrap(`
    <h2 style="color:#F59E0B;font-size:1.4rem;margin:0 0 1rem;">You're on the Waitlist</h2>
    <p>Hi <strong>${p.guardianFirstName}</strong>,</p>
    <p>We've received the registration for <strong>${p.playerFirstName} ${p.playerLastName}</strong> for <strong>${p.seasonName}</strong>.</p>
    <div style="background:#1A1530;border:1px solid rgba(245,158,11,0.3);border-radius:8px;padding:1.25rem;margin:1.5rem 0;">
      <p style="margin:0 0 0.5rem;font-weight:700;color:#F59E0B;">Waitlist Status</p>
      <p style="margin:0;line-height:1.8;">
        Player: <strong>${p.playerFirstName} ${p.playerLastName}</strong><br>
        Season: <strong>${p.seasonName}</strong><br>
        Division: <strong>${p.divisionName}</strong><br>
        Waitlist Position: <strong>#${p.waitlistPosition}</strong><br>
        Reference: <strong style="font-family:monospace;">#${ref}</strong>
      </p>
    </div>
    <p style="color:rgba(255,255,255,0.7);"><strong>${p.divisionName}</strong> is currently full. ${p.playerFirstName} has been added to the waitlist at position <strong>#${p.waitlistPosition}</strong>. You will be contacted if a spot becomes available.</p>
  `, p.contactEmail);
}

// ── House League admin-triggered status-change emails ─────────────────────────

export function leagueAdminApprovedHtml(p: {
  playerFirstName: string;
  playerLastName: string;
  guardianFirstName: string;
  seasonName: string;
  divisionName: string;
  registrationId: string;
  contactEmail?: string;
}) {
  const ref = p.registrationId.slice(0, 8).toUpperCase();
  return wrap(`
    <h2 style="color:#22C55E;font-size:1.4rem;margin:0 0 1rem;">✅ Registration Approved!</h2>
    <p>Hi <strong>${p.guardianFirstName}</strong>,</p>
    <p>Great news! <strong>${p.playerFirstName} ${p.playerLastName}</strong>'s registration for <strong>${p.seasonName}</strong> — <strong>${p.divisionName}</strong> has been approved.</p>
    <div style="background:#1A1530;border:1px solid rgba(34,197,94,0.3);border-radius:8px;padding:1.25rem;margin:1.5rem 0;">
      <p style="margin:0 0 0.5rem;font-weight:700;color:#22C55E;">Registration Details</p>
      <p style="margin:0;line-height:1.8;">
        Player: <strong>${p.playerFirstName} ${p.playerLastName}</strong><br>
        Season: <strong>${p.seasonName}</strong><br>
        Division: <strong>${p.divisionName}</strong><br>
        Reference: <strong style="font-family:monospace;">#${ref}</strong>
      </p>
    </div>
    <p style="color:rgba(255,255,255,0.7);">We look forward to seeing ${p.playerFirstName} on the field! Watch for further updates from your league administrator.</p>
  `, p.contactEmail);
}

export function leagueAdminWaitlistedHtml(p: {
  playerFirstName: string;
  playerLastName: string;
  guardianFirstName: string;
  seasonName: string;
  divisionName: string;
  registrationId: string;
  waitlistPosition: number;
  contactEmail?: string;
}) {
  const ref = p.registrationId.slice(0, 8).toUpperCase();
  return wrap(`
    <h2 style="color:#F59E0B;font-size:1.4rem;margin:0 0 1rem;">Added to Waitlist</h2>
    <p>Hi <strong>${p.guardianFirstName}</strong>,</p>
    <p>Unfortunately <strong>${p.divisionName}</strong> is currently full. <strong>${p.playerFirstName} ${p.playerLastName}</strong> has been added to the waitlist at position <strong>#${p.waitlistPosition}</strong>.</p>
    <div style="background:#1A1530;border:1px solid rgba(245,158,11,0.3);border-radius:8px;padding:1.25rem;margin:1.5rem 0;">
      <p style="margin:0 0 0.5rem;font-weight:700;color:#F59E0B;">Waitlist Status</p>
      <p style="margin:0;line-height:1.8;">
        Player: <strong>${p.playerFirstName} ${p.playerLastName}</strong><br>
        Season: <strong>${p.seasonName}</strong><br>
        Division: <strong>${p.divisionName}</strong><br>
        Waitlist Position: <strong>#${p.waitlistPosition}</strong><br>
        Reference: <strong style="font-family:monospace;">#${ref}</strong>
      </p>
    </div>
    <p style="color:rgba(255,255,255,0.7);">You will be contacted if a spot becomes available. No payment is required until your registration is approved.</p>
  `, p.contactEmail);
}

export function leagueWaitlistPromotedHtml(p: {
  playerFirstName: string;
  playerLastName: string;
  guardianFirstName: string;
  seasonName: string;
  divisionName: string;
  registrationId: string;
  contactEmail?: string;
}) {
  const ref = p.registrationId.slice(0, 8).toUpperCase();
  return wrap(`
    <h2 style="color:#22C55E;font-size:1.4rem;margin:0 0 1rem;">🎉 You're Off the Waitlist!</h2>
    <p>Hi <strong>${p.guardianFirstName}</strong>,</p>
    <p><strong>${p.playerFirstName} ${p.playerLastName}</strong> has been moved off the waitlist and is now registered for <strong>${p.divisionName}</strong>. Welcome!</p>
    <div style="background:#1A1530;border:1px solid rgba(34,197,94,0.3);border-radius:8px;padding:1.25rem;margin:1.5rem 0;">
      <p style="margin:0 0 0.5rem;font-weight:700;color:#22C55E;">Registration Details</p>
      <p style="margin:0;line-height:1.8;">
        Player: <strong>${p.playerFirstName} ${p.playerLastName}</strong><br>
        Season: <strong>${p.seasonName}</strong><br>
        Division: <strong>${p.divisionName}</strong><br>
        Reference: <strong style="font-family:monospace;">#${ref}</strong>
      </p>
    </div>
    <p style="color:rgba(255,255,255,0.7);">We look forward to seeing ${p.playerFirstName} on the field! Watch for further updates from your league administrator.</p>
  `, p.contactEmail);
}

export function leagueRegistrationDeclinedHtml(p: {
  playerFirstName: string;
  playerLastName: string;
  guardianFirstName: string;
  seasonName: string;
  divisionName: string;
  registrationId: string;
  contactEmail?: string;
}) {
  const contact = p.contactEmail ?? ADMIN_EMAIL;
  return wrap(`
    <h2 style="color:#EF4444;font-size:1.4rem;margin:0 0 1rem;">Registration Update</h2>
    <p>Hi <strong>${p.guardianFirstName}</strong>,</p>
    <p>We're sorry — <strong>${p.playerFirstName} ${p.playerLastName}</strong>'s registration for <strong>${p.seasonName}</strong> — <strong>${p.divisionName}</strong> was not approved.</p>
    <p style="color:rgba(255,255,255,0.7);">Please contact <a href="mailto:${contact}" style="color:#A855F7;">${contact}</a> for more information.</p>
  `, contact);
}

export function leagueBroadcastHtml(p: {
  orgName: string;
  seasonName: string;
  subject: string;
  message: string;
  contactEmail?: string;
}) {
  const contact = p.contactEmail ?? ADMIN_EMAIL;
  const bodyLines = p.message
    .split('\n')
    .map(l => l.trim() ? `<p style="margin:0 0 0.75rem;line-height:1.6;">${l}</p>` : '<br>')
    .join('');
  return `
<div style="font-family:Inter,sans-serif;background:#0D0B14;color:#fff;max-width:600px;margin:0 auto;padding:2rem;border-radius:12px;border:1px solid rgba(255,255,255,0.1);">
  <div style="margin-bottom:1.5rem;">
    <span style="font-size:1.1rem;font-weight:800;color:#a3e635;letter-spacing:0.02em;">${p.orgName}</span>
    <span style="display:block;font-size:0.75rem;color:rgba(255,255,255,0.4);margin-top:0.15rem;">${p.seasonName}</span>
  </div>
  <h2 style="color:#f0f0f0;font-size:1.25rem;margin:0 0 1.25rem;font-weight:700;">${p.subject}</h2>
  <div style="color:rgba(255,255,255,0.8);">${bodyLines}</div>
  <hr style="border:none;border-top:1px solid rgba(255,255,255,0.08);margin:2rem 0;" />
  <p style="color:rgba(255,255,255,0.35);font-size:0.78rem;margin:0;">
    Questions? Contact <a href="mailto:${contact}" style="color:#a3e635;">${contact}</a>
  </p>
</div>`;
}

// ── Rep Teams tryout registration email ──────────────────────────────────────

export function tryoutRegistrationConfirmationHtml(p: {
  guardianFirstName: string;
  playerFirstName: string;
  playerLastName: string;
  teamName: string;
  yearName: string;
  registrationId: string;
  contactEmail?: string;
}) {
  const ref = p.registrationId.slice(0, 8).toUpperCase();
  return wrap(`
    <h2 style="color:#fff;font-size:1.4rem;margin:0 0 1rem;">Tryout Application Received</h2>
    <p>Hi <strong>${p.guardianFirstName}</strong>,</p>
    <p>We've received <strong>${p.playerFirstName} ${p.playerLastName}</strong>'s tryout application for the <strong>${p.teamName}</strong> <strong>${p.yearName}</strong> program.</p>
    <div style="background:#1A1530;border:1px solid rgba(var(--primary-rgb),0.3);border-radius:8px;padding:1.25rem;margin:1.5rem 0;">
      <p style="margin:0 0 0.5rem;font-weight:700;color:#A855F7;">Application Details</p>
      <p style="margin:0;line-height:1.8;">
        Player: <strong>${p.playerFirstName} ${p.playerLastName}</strong><br>
        Program: <strong>${p.teamName} — ${p.yearName}</strong><br>
        Reference: <strong style="font-family:monospace;">#${ref}</strong>
      </p>
    </div>
    <p style="color:rgba(255,255,255,0.7);">Our coaching staff will review all applications and be in touch. No further action is required at this time.</p>
  `, p.contactEmail);
}

// ── Rep Teams tryout status emails ───────────────────────────────────────────

export function tryoutOfferHtml(p: {
  guardianFirstName: string;
  playerFirstName: string;
  playerLastName: string;
  teamName: string;
  yearName: string;
  contactEmail?: string;
}) {
  const contact = p.contactEmail ?? ADMIN_EMAIL;
  return wrap(`
    <h2 style="color:#a3e635;font-size:1.4rem;margin:0 0 1rem;">Offer Extended</h2>
    <p>Hi <strong>${p.guardianFirstName}</strong>,</p>
    <p>We&apos;re pleased to let you know that <strong>${p.playerFirstName} ${p.playerLastName}</strong> has been extended an offer to join the <strong>${p.teamName}</strong> <strong>${p.yearName}</strong> program.</p>
    <div style="background:#1A1530;border:1px solid rgba(163,230,53,0.3);border-radius:8px;padding:1.25rem;margin:1.5rem 0;">
      <p style="margin:0 0 0.5rem;font-weight:700;color:#a3e635;">Next Steps</p>
      <p style="margin:0;line-height:1.8;color:rgba(255,255,255,0.75);">
        Please reply to this email to confirm whether <strong>${p.playerFirstName}</strong> will be accepting this offer.<br>
        Program: <strong>${p.teamName} — ${p.yearName}</strong>
      </p>
    </div>
    <p style="color:rgba(255,255,255,0.6);">Questions? Contact us at <a href="mailto:${contact}" style="color:#a3e635;">${contact}</a></p>
  `, p.contactEmail);
}

export function tryoutAcceptedHtml(p: {
  guardianFirstName: string;
  playerFirstName: string;
  playerLastName: string;
  teamName: string;
  yearName: string;
  contactEmail?: string;
}) {
  return wrap(`
    <h2 style="color:#4ade80;font-size:1.4rem;margin:0 0 1rem;">Welcome to the Team!</h2>
    <p>Hi <strong>${p.guardianFirstName}</strong>,</p>
    <p><strong>${p.playerFirstName} ${p.playerLastName}</strong> has been added to the <strong>${p.teamName}</strong> <strong>${p.yearName}</strong> roster. Welcome!</p>
    <div style="background:#1A1530;border:1px solid rgba(74,222,128,0.3);border-radius:8px;padding:1.25rem;margin:1.5rem 0;">
      <p style="margin:0;line-height:1.8;color:rgba(255,255,255,0.75);">
        Program: <strong>${p.teamName} — ${p.yearName}</strong><br>
        Player: <strong>${p.playerFirstName} ${p.playerLastName}</strong>
      </p>
    </div>
    <p style="color:rgba(255,255,255,0.6);">Your coaching staff will be in touch with more details. We look forward to a great season!</p>
  `, p.contactEmail);
}

export function tryoutDeclinedHtml(p: {
  guardianFirstName: string;
  playerFirstName: string;
  playerLastName: string;
  teamName: string;
  yearName: string;
  contactEmail?: string;
}) {
  const contact = p.contactEmail ?? ADMIN_EMAIL;
  return wrap(`
    <h2 style="color:#f0f0f0;font-size:1.4rem;margin:0 0 1rem;">Tryout Update</h2>
    <p>Hi <strong>${p.guardianFirstName}</strong>,</p>
    <p>Thank you for registering <strong>${p.playerFirstName} ${p.playerLastName}</strong> for the <strong>${p.teamName}</strong> <strong>${p.yearName}</strong> program. After reviewing all applications, we are unfortunately unable to extend an offer at this time.</p>
    <p style="color:rgba(255,255,255,0.6);">We appreciate <strong>${p.playerFirstName}</strong>&apos;s interest and encourage them to try again in the future. Please reach out to <a href="mailto:${contact}" style="color:#a3e635;">${contact}</a> if you have any questions.</p>
  `, p.contactEmail);
}

export function passwordResetHtml(resetLink: string) {
  return wrap(`
    <h2 style="color:#fff;font-size:1.4rem;margin:0 0 1rem;">Reset Your Password</h2>
    <p>We received a request to reset the password for your <strong>FieldLogicHQ</strong> account.</p>
    <p style="color:rgba(255,255,255,0.7);">Click the button below to set a new password. This link expires in 1 hour.</p>
    <a href="${resetLink}" style="display:inline-block;background:#8B2FC9;color:#fff;padding:0.75rem 1.75rem;border-radius:8px;text-decoration:none;font-weight:700;margin:1.5rem 0;">Reset Password &rarr;</a>
    <p style="color:rgba(255,255,255,0.4);font-size:0.82rem;">If you didn't request a password reset, you can safely ignore this email. Your password will not change.</p>
  `);
}

export function platformPasswordResetHtml(resetLink: string) {
  return `
<div style="font-family:monospace,sans-serif;background:#090d09;color:#e8efe8;max-width:480px;margin:0 auto;padding:2rem;border:1px solid rgba(163,230,53,0.2);">
  <div style="margin-bottom:1.5rem;padding-bottom:1rem;border-bottom:1px solid rgba(163,230,53,0.12);">
    <span style="font-size:0.65rem;font-weight:900;color:#a3e635;letter-spacing:0.18em;text-transform:uppercase;">FIELDLOGICHQ</span>
    <span style="display:block;font-size:0.6rem;color:rgba(255,255,255,0.35);letter-spacing:0.12em;text-transform:uppercase;margin-top:0.2rem;">Staff Access</span>
  </div>
  <h2 style="color:#e8efe8;font-size:1rem;font-weight:700;margin:0 0 1rem;letter-spacing:0.04em;text-transform:uppercase;">Reset Your Password</h2>
  <p style="color:rgba(255,255,255,0.6);font-size:0.85rem;line-height:1.65;margin:0 0 1.5rem;">We received a password reset request for your FieldLogicHQ staff account. Click below to set a new password. This link expires in 1 hour.</p>
  <a href="${resetLink}" style="display:inline-block;background:#a3e635;color:#090d09;padding:0.7rem 1.5rem;text-decoration:none;font-weight:800;font-size:0.72rem;letter-spacing:0.1em;text-transform:uppercase;">Reset Password &rarr;</a>
  <p style="color:rgba(255,255,255,0.22);font-size:0.75rem;margin:1.75rem 0 0;line-height:1.55;">If you didn't request this, you can safely ignore this email. Your password will not change.</p>
</div>`;
}

export function signupVerificationHtml(p: {
  orgName: string;
  verifyUrl: string;
}) {
  return wrap(`
    <h2 style="color:#fff;font-size:1.4rem;margin:0 0 1rem;">Verify Your Email</h2>
    <p>Welcome to <strong>FieldLogicHQ</strong>.</p>
    <p>Confirm your email address to continue setting up <strong>${p.orgName}</strong>.</p>
    <a href="${p.verifyUrl}" style="display:inline-block;background:#8B2FC9;color:#fff;padding:0.75rem 1.75rem;border-radius:8px;text-decoration:none;font-weight:700;margin:1.5rem 0;">Verify Email &rarr;</a>
    <p style="color:rgba(255,255,255,0.4);font-size:0.82rem;">If you did not create this account, you can safely ignore this email.</p>
  `);
}

export function billingRetentionWarningHtml(p: {
  orgName: string;
  records: { displayName: string; recordType: string; retentionUntil: string }[];
  retentionUrl: string;
  daysUntilExpiry: number;
  isPendingPurge?: boolean;
}) {
  const rows = p.records.map(r => `
    <li style="margin-bottom:0.5rem;">
      <strong>${r.displayName}</strong>
      <span style="color:rgba(255,255,255,0.45);">(${r.recordType}, retained until ${r.retentionUntil})</span>
    </li>
  `).join('');

  const title = p.isPendingPurge ? 'Retention window expired' : 'Retention window ending soon';
  const body = p.isPendingPurge
    ? `The retained data below has reached the end of its retention window and is now pending purge. Contact FieldLogicHQ support if you need more time or want to restore access.`
    : `The retained data below is scheduled to leave the restore window in about ${p.daysUntilExpiry} day${p.daysUntilExpiry === 1 ? '' : 's'}.`;

  return wrap(`
    <h2 style="color:#fff;font-size:1.4rem;margin:0 0 1rem;">${title}</h2>
    <p>Hi,</p>
    <p>${body}</p>
    <div style="background:#1A1530;border:1px solid rgba(245,158,11,0.35);border-radius:8px;padding:1.25rem;margin:1.5rem 0;">
      <p style="margin:0 0 0.75rem;font-weight:700;color:#F59E0B;">${p.orgName}</p>
      <ul style="margin:0;padding-left:1.25rem;color:rgba(255,255,255,0.72);">${rows}</ul>
    </div>
    <a href="${p.retentionUrl}" style="display:inline-block;background:#8B2FC9;color:#fff;padding:0.75rem 1.75rem;border-radius:8px;text-decoration:none;font-weight:700;">Review Subscription</a>
  `);
}
