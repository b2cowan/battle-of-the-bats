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

const wrap = (content: string) => `
<div style="font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif;background:#111827;color:#F1F5F9;max-width:600px;margin:0 auto;padding:2.5rem 2rem;border:1px solid rgba(30,58,138,0.25);">
  <div style="margin-bottom:1.75rem;padding-bottom:1.25rem;border-bottom:1px solid rgba(30,58,138,0.2);">
    <span style="font-size:0.75rem;font-weight:900;color:#D9F99D;letter-spacing:0.16em;text-transform:uppercase;">FIELDLOGICHQ</span>
  </div>
  ${content}
</div>`;

export function registrationConfirmationHtml(p: {
  teamName: string; coachName: string; divisionName: string; tournamentName: string;
  contactEmail?: string;
  coachEmail?: string;
}) {
  const joinUrl = p.coachEmail
    ? `${SITE_URL}/coaches/join?email=${encodeURIComponent(p.coachEmail)}&next=${encodeURIComponent('/coaches/tournaments')}&registered=1`
    : `${SITE_URL}/coaches/join`;
  return wrap(`
    <h2 style="color:#fff;font-size:1.4rem;margin:0 0 1rem;">Registration Received!</h2>
    <p>Hi <strong>${p.coachName}</strong>,</p>
    <p>We've received your registration for <strong>${p.teamName}</strong> in the <strong>${p.divisionName}</strong> division for <strong>${p.tournamentName}</strong>.</p>
    <div style="background:#0F172A;border:1px solid rgba(30,58,138,0.25);border-left:3px solid rgba(30,58,138,0.5);padding:1.25rem;margin:1.5rem 0;">
      <p style="margin:0 0 0.5rem;font-weight:700;font-size:0.72rem;letter-spacing:0.08em;text-transform:uppercase;color:#D9F99D;">Registration Details</p>
      <p style="margin:0;line-height:1.8;color:rgba(241,245,249,0.85);">
        Team: <strong>${p.teamName}</strong><br>
        Coach: <strong>${p.coachName}</strong><br>
        Division: <strong>${p.divisionName}</strong><br>
        Tournament: <strong>${p.tournamentName}</strong>
      </p>
    </div>
    <p style="color:rgba(241,245,249,0.7);">Your registration is currently <strong style="color:#F59E0B;">pending review</strong>. If payment is required, the organizer will share payment instructions directly. FieldLogicHQ does not process online payments.</p>
    <div style="background:#0F172A;border:1px solid rgba(217,249,157,0.3);border-left:3px solid rgba(217,249,157,0.5);padding:1.25rem;margin:1.5rem 0;">
      <p style="margin:0 0 0.5rem;font-weight:700;font-size:0.72rem;letter-spacing:0.08em;text-transform:uppercase;color:#D9F99D;">Track your registration</p>
      <p style="margin:0 0 1rem;color:rgba(241,245,249,0.72);line-height:1.6;">Create a free FieldLogicHQ account to track your registration status, see your game schedule once it's published, and receive announcements from the organizer.</p>
      <a href="${joinUrl}" style="display:inline-block;background:#D9F99D;color:#0b0f14;text-decoration:none;font-weight:800;padding:0.75rem 1rem;border-radius:2px;font-size:0.82rem;letter-spacing:0.06em;">Create Account &amp; Track Registration →</a>
    </div>
  `);
}

export function manualTeamRegistrationHtml(p: {
  teamName: string; coachName: string; divisionName: string; tournamentName: string;
  paymentStatus: 'pending' | 'paid';
  contactEmail?: string;
}) {
  const paymentLine = p.paymentStatus === 'paid'
    ? 'The organizer has marked your tournament fee as paid.'
    : 'If payment is required, the organizer will follow up with payment instructions.';
  return wrap(`
    <h2 style="color:#fff;font-size:1.4rem;margin:0 0 1rem;">Team Registered</h2>
    <p>Hi <strong>${p.coachName || 'Coach'}</strong>,</p>
    <p><strong>${p.teamName}</strong> has been registered in the <strong>${p.divisionName}</strong> division for <strong>${p.tournamentName}</strong>.</p>
    <div style="background:#0F172A;border:1px solid rgba(30,58,138,0.25);border-left:3px solid rgba(30,58,138,0.5);padding:1.25rem;margin:1.5rem 0;">
      <p style="margin:0 0 0.5rem;font-weight:700;font-size:0.72rem;letter-spacing:0.08em;text-transform:uppercase;color:#D9F99D;">Registration Details</p>
      <p style="margin:0;line-height:1.8;color:rgba(241,245,249,0.85);">
        Team: <strong>${p.teamName}</strong><br>
        Coach: <strong>${p.coachName || 'Not provided'}</strong><br>
        Division: <strong>${p.divisionName}</strong><br>
        Tournament: <strong>${p.tournamentName}</strong>
      </p>
    </div>
    <p style="color:rgba(255,255,255,0.7);">${paymentLine}</p>
  `);
}

export function adminNotificationHtml(p: {
  teamName: string; coachName: string; email: string; divisionName: string; tournamentName: string;
}) {
  const adminUrl = `${SITE_URL}/admin/registrations`;
  return wrap(`
    <h2 style="color:#fff;font-size:1.4rem;margin:0 0 1rem;">📋 New Team Registration</h2>
    <p>A new team has registered for <strong>${p.tournamentName}</strong>:</p>
    <div style="background:#0F172A;border:1px solid rgba(30,58,138,0.25);border-left:3px solid rgba(30,58,138,0.5);padding:1.25rem;margin:1rem 0;">
      <p style="margin:0;line-height:1.8;color:rgba(241,245,249,0.85);">
        Team: <strong>${p.teamName}</strong><br>
        Coach: <strong>${p.coachName}</strong><br>
        Division: <strong>${p.divisionName}</strong><br>
        Contact: <a href="mailto:${p.email}" style="color:#D9F99D;">${p.email}</a>
      </p>
    </div>
    <a href="${adminUrl}" style="display:inline-block;background:#1E3A8A;color:#fff;padding:0.75rem 1.75rem;border-radius:2px;text-decoration:none;font-weight:700;font-size:0.82rem;letter-spacing:0.06em;margin-top:0.5rem;">Review in Admin Panel →</a>
  `);
}

export function acceptanceHtml(p: {
  teamName: string; coachName: string; divisionName: string; tournamentName: string; teamId: string;
  contactEmail?: string;
  dashboardUrl?: string;
}) {
  const dashboardUrl = p.dashboardUrl ?? `${SITE_URL}/coaches/tournaments`;
  const contact = p.contactEmail ?? ADMIN_EMAIL;
  return wrap(`
    <h2 style="color:#22C55E;font-size:1.4rem;margin:0 0 1rem;">🎉 Team Accepted!</h2>
    <p>Hi <strong>${p.coachName}</strong>,</p>
    <p>Great news! <strong>${p.teamName}</strong> has been accepted into the <strong>${p.divisionName}</strong> division for <strong>${p.tournamentName}</strong>.</p>
    <div style="background:#0F172A;border:1px solid rgba(34,197,94,0.35);border-left:3px solid rgba(34,197,94,0.6);padding:1.5rem;margin:1.5rem 0;">
      <p style="margin:0 0 0.75rem;font-weight:700;font-size:0.72rem;letter-spacing:0.08em;text-transform:uppercase;color:#22C55E;">Payment Instructions</p>
      <p style="margin:0 0 0.75rem;color:rgba(241,245,249,0.8);">If payment is required, the tournament organizer will follow up with instructions for paying outside FieldLogicHQ.</p>
      <p style="margin:1rem 0 0;color:rgba(241,245,249,0.45);font-size:0.85rem;">Questions? Contact <a href="mailto:${contact}" style="color:#D9F99D;">${contact}</a>.</p>
    </div>
    <a href="${dashboardUrl}" style="display:inline-block;background:#1E3A8A;color:#fff;padding:0.75rem 1.75rem;border-radius:2px;text-decoration:none;font-weight:700;font-size:0.82rem;letter-spacing:0.06em;">View Your Registration Dashboard →</a>
  `);
}

export function waitlistConfirmationHtml(p: {
  teamName: string; coachName: string; divisionName: string; tournamentName: string;
  contactEmail?: string;
}) {
  return wrap(`
    <h2 style="color:#F59E0B;font-size:1.4rem;margin:0 0 1rem;">You're on the Waitlist</h2>
    <p>Hi <strong>${p.coachName}</strong>,</p>
    <p>Thanks for registering <strong>${p.teamName}</strong> for the <strong>${p.divisionName}</strong> division of <strong>${p.tournamentName}</strong>.</p>
    <div style="background:#0F172A;border:1px solid rgba(245,158,11,0.3);border-left:3px solid rgba(245,158,11,0.5);padding:1.25rem;margin:1.5rem 0;">
      <p style="margin:0 0 0.5rem;font-weight:700;font-size:0.72rem;letter-spacing:0.08em;text-transform:uppercase;color:#F59E0B;">Waitlist Status</p>
      <p style="margin:0;line-height:1.8;color:rgba(241,245,249,0.85);">
        Team: <strong>${p.teamName}</strong><br>
        Coach: <strong>${p.coachName}</strong><br>
        Division: <strong>${p.divisionName}</strong><br>
        Tournament: <strong>${p.tournamentName}</strong>
      </p>
    </div>
    <p style="color:rgba(241,245,249,0.7);">The <strong>${p.divisionName}</strong> division is currently full. Your team has been added to the waitlist and you will be notified by email if a spot becomes available.</p>
  `);
}

export function rejectionHtml(p: {
  teamName: string; coachName: string; divisionName: string; tournamentName: string;
  contactEmail?: string;
}) {
  const contact = p.contactEmail ?? ADMIN_EMAIL;
  return wrap(`
    <h2 style="color:#EF4444;font-size:1.4rem;margin:0 0 1rem;">Registration Update</h2>
    <p>Hi <strong>${p.coachName}</strong>,</p>
    <p>Thank you for your interest in <strong>${p.tournamentName}</strong>. Unfortunately, we are unable to accommodate <strong>${p.teamName}</strong> in the <strong>${p.divisionName}</strong> division at this time.</p>
    <p style="color:rgba(241,245,249,0.7);">This may be due to division capacity or eligibility requirements. Please contact us if you have any questions.</p>
    <a href="mailto:${contact}" style="display:inline-block;background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.35);color:#f87171;padding:0.75rem 1.75rem;border-radius:2px;text-decoration:none;font-weight:700;font-size:0.82rem;letter-spacing:0.06em;margin-top:0.5rem;">Contact Us</a>
  `);
}

export function paymentConfirmationHtml(p: {
  teamName: string; coachName: string; divisionName: string; tournamentName: string;
  contactEmail?: string;
}) {
  return wrap(`
    <h2 style="color:#22C55E;font-size:1.4rem;margin:0 0 1rem;">Payment Recorded</h2>
    <p>Hi <strong>${p.coachName}</strong>,</p>
    <p>The tournament organizer has recorded payment for <strong>${p.teamName}</strong>. Your registration for the <strong>${p.divisionName}</strong> division of <strong>${p.tournamentName}</strong> is now marked <strong style="color:#22C55E;">paid</strong>.</p>
    <p style="color:rgba(255,255,255,0.7);">Stay tuned for schedule announcements. We look forward to seeing you on the diamond!</p>
  `);
}

function escapeEmailHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function paymentReminderHtml(p: {
  teamName: string;
  coachName: string;
  divisionName: string;
  tournamentName: string;
  amountDue: string;
  dueDate?: string | null;
  paymentInstructions: string;
  contactEmail?: string;
}) {
  const instructions = escapeEmailHtml(p.paymentInstructions)
    .split('\n')
    .map(line => line.trim() ? `<p style="margin:0 0 0.75rem;line-height:1.6;">${line}</p>` : '<br>')
    .join('');

  return wrap(`
    <h2 style="color:#fff;font-size:1.4rem;margin:0 0 1rem;">Tournament Payment Reminder</h2>
    <p>Hi <strong>${escapeEmailHtml(p.coachName)}</strong>,</p>
    <p>This is a friendly reminder that payment is still outstanding for <strong>${escapeEmailHtml(p.teamName)}</strong> in the <strong>${escapeEmailHtml(p.divisionName)}</strong> division of <strong>${escapeEmailHtml(p.tournamentName)}</strong>.</p>
    <div style="background:#0F172A;border:1px solid rgba(245,158,11,0.35);border-left:3px solid rgba(245,158,11,0.5);padding:1.25rem;margin:1.5rem 0;">
      <p style="margin:0 0 0.5rem;font-weight:700;font-size:0.72rem;letter-spacing:0.08em;text-transform:uppercase;color:#F59E0B;">Payment Details</p>
      <p style="margin:0;line-height:1.8;color:rgba(241,245,249,0.85);">
        Amount due: <strong>${escapeEmailHtml(p.amountDue)}</strong><br>
        ${p.dueDate ? `Due date: <strong>${escapeEmailHtml(p.dueDate)}</strong><br>` : ''}
        Team: <strong>${escapeEmailHtml(p.teamName)}</strong><br>
        Division: <strong>${escapeEmailHtml(p.divisionName)}</strong>
      </p>
    </div>
    <div style="color:rgba(241,245,249,0.75);">${instructions}</div>
    <p style="color:rgba(241,245,249,0.45);font-size:0.86rem;">FieldLogicHQ records payment status for the organizer but does not process tournament payments online.</p>
  `);
}

export function coachAccessReminderHtml(p: {
  teamName: string;
  coachName: string;
  tournamentName: string;
  joinUrl: string;
  loginUrl: string;
}) {
  const coachName = p.coachName.trim() ? p.coachName : 'Coach';
  return wrap(`
    <h2 style="color:#fff;font-size:1.4rem;margin:0 0 1rem;">Your Registration Dashboard</h2>
    <p>Hi <strong>${escapeEmailHtml(coachName)}</strong>,</p>
    <p>Here's your access link for <strong>${escapeEmailHtml(p.teamName)}</strong> in <strong>${escapeEmailHtml(p.tournamentName)}</strong>. Your dashboard shows your registration status, game schedule, and any announcements from the organizer.</p>
    <a href="${escapeEmailHtml(p.joinUrl)}" style="display:inline-block;background:#D9F99D;color:#0b0f14;text-decoration:none;font-weight:800;padding:0.75rem 1rem;border-radius:2px;font-size:0.82rem;letter-spacing:0.06em;margin:1rem 0;">Create Account &amp; View Dashboard →</a>
    <p style="color:rgba(241,245,249,0.55);font-size:0.85rem;">Already have an account? <a href="${escapeEmailHtml(p.loginUrl)}" style="color:#D9F99D;">Sign in instead →</a></p>
    <p style="color:rgba(241,245,249,0.4);font-size:0.82rem;">If you did not register for this tournament, you can ignore this email.</p>
  `);
}

export function tournamentResultsFinalizedHtml(p: {
  tournamentName: string;
  coachName: string;
  resultsUrl: string;
  scheduleUrl: string;
  teamsUrl: string;
  fieldLogicUrl: string;
  teamUrl?: string;
  contactEmail?: string;
}) {
  return wrap(`
    <h2 style="color:#fff;font-size:1.4rem;margin:0 0 1rem;">Final Results Are Posted</h2>
    <p>Hi <strong>${escapeEmailHtml(p.coachName)}</strong>,</p>
    <p>The organizer has finalized results for <strong>${escapeEmailHtml(p.tournamentName)}</strong>. You can review standings, scores, and team information from the public tournament site.</p>
    <div style="background:#0F172A;border:1px solid rgba(30,58,138,0.25);border-left:3px solid rgba(30,58,138,0.5);padding:1.25rem;margin:1.5rem 0;">
      <p style="margin:0 0 0.75rem;font-weight:700;font-size:0.72rem;letter-spacing:0.08em;text-transform:uppercase;color:#D9F99D;">Tournament Links</p>
      <p style="margin:0;line-height:1.9;">
        <a href="${escapeEmailHtml(p.resultsUrl)}" style="color:#D9F99D;">View standings and results</a><br>
        <a href="${escapeEmailHtml(p.scheduleUrl)}" style="color:#D9F99D;">View schedule</a><br>
        <a href="${escapeEmailHtml(p.teamsUrl)}" style="color:#D9F99D;">View teams</a>
      </p>
    </div>
    <p style="color:rgba(241,245,249,0.65);font-size:0.88rem;">Thanks for being part of the tournament.</p>
    ${p.teamUrl ? `
      <div style="background:#0F172A;border:1px solid rgba(217,249,157,0.3);border-left:3px solid rgba(217,249,157,0.5);padding:1.25rem;margin:1.5rem 0;">
        <p style="margin:0 0 0.5rem;font-weight:700;font-size:0.72rem;letter-spacing:0.08em;text-transform:uppercase;color:#D9F99D;">Keep this team going</p>
        <p style="margin:0 0 1rem;color:rgba(241,245,249,0.72);line-height:1.6;">Upgrade your Coaches Portal for roster, schedule, dues, documents, attendance, and lineups.</p>
        <a href="${escapeEmailHtml(p.teamUrl)}" style="display:inline-block;background:#D9F99D;color:#0b0f14;text-decoration:none;font-weight:800;padding:0.75rem 1rem;border-radius:2px;font-size:0.82rem;letter-spacing:0.06em;">Explore Coaches Portal</a>
      </div>
    ` : ''}
    <p style="color:rgba(241,245,249,0.4);font-size:0.82rem;line-height:1.55;margin-top:1.5rem;">
      Running your own tournament? <a href="${escapeEmailHtml(p.fieldLogicUrl)}" style="color:#D9F99D;">See how FieldLogicHQ helps organizers manage registration, schedules, results, and post-event reporting.</a>
    </p>
  `);
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
    <div style="background:#0F172A;border:1px solid rgba(34,197,94,0.3);border-left:3px solid rgba(34,197,94,0.5);padding:1.25rem;margin:1.5rem 0;">
      <p style="margin:0 0 0.5rem;font-weight:700;font-size:0.72rem;letter-spacing:0.08em;text-transform:uppercase;color:#22C55E;">Registration Details</p>
      <p style="margin:0;line-height:1.8;color:rgba(241,245,249,0.85);">
        Player: <strong>${p.playerFirstName} ${p.playerLastName}</strong><br>
        Season: <strong>${p.seasonName}</strong><br>
        Division: <strong>${p.divisionName}</strong><br>
        Reference: <strong style="font-family:monospace;">#${ref}</strong>
      </p>
    </div>
    <p style="color:rgba(241,245,249,0.7);">We look forward to seeing ${p.playerFirstName} on the field! Watch for further updates from your league administrator.</p>
  `);
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
    <div style="background:#0F172A;border:1px solid rgba(30,58,138,0.25);border-left:3px solid rgba(30,58,138,0.5);padding:1.25rem;margin:1.5rem 0;">
      <p style="margin:0 0 0.5rem;font-weight:700;font-size:0.72rem;letter-spacing:0.08em;text-transform:uppercase;color:#D9F99D;">Registration Details</p>
      <p style="margin:0;line-height:1.8;color:rgba(241,245,249,0.85);">
        Player: <strong>${p.playerFirstName} ${p.playerLastName}</strong><br>
        Season: <strong>${p.seasonName}</strong><br>
        Division: <strong>${p.divisionName}</strong><br>
        Reference: <strong style="font-family:monospace;">#${ref}</strong>
      </p>
    </div>
    <p style="color:rgba(241,245,249,0.7);">Your registration status is currently <strong style="color:#F59E0B;">pending review</strong>. You will receive another email once a decision has been made. No payment is required until your registration is approved.</p>
  `);
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
    <div style="background:#0F172A;border:1px solid rgba(245,158,11,0.3);border-left:3px solid rgba(245,158,11,0.5);padding:1.25rem;margin:1.5rem 0;">
      <p style="margin:0 0 0.5rem;font-weight:700;font-size:0.72rem;letter-spacing:0.08em;text-transform:uppercase;color:#F59E0B;">Waitlist Status</p>
      <p style="margin:0;line-height:1.8;color:rgba(241,245,249,0.85);">
        Player: <strong>${p.playerFirstName} ${p.playerLastName}</strong><br>
        Season: <strong>${p.seasonName}</strong><br>
        Division: <strong>${p.divisionName}</strong><br>
        Waitlist Position: <strong>#${p.waitlistPosition}</strong><br>
        Reference: <strong style="font-family:monospace;">#${ref}</strong>
      </p>
    </div>
    <p style="color:rgba(241,245,249,0.7);"><strong>${p.divisionName}</strong> is currently full. ${p.playerFirstName} has been added to the waitlist at position <strong>#${p.waitlistPosition}</strong>. You will be contacted if a spot becomes available.</p>
  `);
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
    <div style="background:#0F172A;border:1px solid rgba(34,197,94,0.3);border-left:3px solid rgba(34,197,94,0.5);padding:1.25rem;margin:1.5rem 0;">
      <p style="margin:0 0 0.5rem;font-weight:700;font-size:0.72rem;letter-spacing:0.08em;text-transform:uppercase;color:#22C55E;">Registration Details</p>
      <p style="margin:0;line-height:1.8;color:rgba(241,245,249,0.85);">
        Player: <strong>${p.playerFirstName} ${p.playerLastName}</strong><br>
        Season: <strong>${p.seasonName}</strong><br>
        Division: <strong>${p.divisionName}</strong><br>
        Reference: <strong style="font-family:monospace;">#${ref}</strong>
      </p>
    </div>
    <p style="color:rgba(241,245,249,0.7);">We look forward to seeing ${p.playerFirstName} on the field! Watch for further updates from your league administrator.</p>
  `);
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
    <div style="background:#0F172A;border:1px solid rgba(245,158,11,0.3);border-left:3px solid rgba(245,158,11,0.5);padding:1.25rem;margin:1.5rem 0;">
      <p style="margin:0 0 0.5rem;font-weight:700;font-size:0.72rem;letter-spacing:0.08em;text-transform:uppercase;color:#F59E0B;">Waitlist Status</p>
      <p style="margin:0;line-height:1.8;color:rgba(241,245,249,0.85);">
        Player: <strong>${p.playerFirstName} ${p.playerLastName}</strong><br>
        Season: <strong>${p.seasonName}</strong><br>
        Division: <strong>${p.divisionName}</strong><br>
        Waitlist Position: <strong>#${p.waitlistPosition}</strong><br>
        Reference: <strong style="font-family:monospace;">#${ref}</strong>
      </p>
    </div>
    <p style="color:rgba(241,245,249,0.7);">You will be contacted if a spot becomes available. No payment is required until your registration is approved.</p>
  `);
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
    <div style="background:#0F172A;border:1px solid rgba(34,197,94,0.3);border-left:3px solid rgba(34,197,94,0.5);padding:1.25rem;margin:1.5rem 0;">
      <p style="margin:0 0 0.5rem;font-weight:700;font-size:0.72rem;letter-spacing:0.08em;text-transform:uppercase;color:#22C55E;">Registration Details</p>
      <p style="margin:0;line-height:1.8;color:rgba(241,245,249,0.85);">
        Player: <strong>${p.playerFirstName} ${p.playerLastName}</strong><br>
        Season: <strong>${p.seasonName}</strong><br>
        Division: <strong>${p.divisionName}</strong><br>
        Reference: <strong style="font-family:monospace;">#${ref}</strong>
      </p>
    </div>
    <p style="color:rgba(241,245,249,0.7);">We look forward to seeing ${p.playerFirstName} on the field! Watch for further updates from your league administrator.</p>
  `);
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
    <p style="color:rgba(241,245,249,0.7);">Please contact <a href="mailto:${contact}" style="color:#D9F99D;">${contact}</a> for more information.</p>
  `);
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
<div style="font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif;background:#111827;color:#F1F5F9;max-width:600px;margin:0 auto;padding:2.5rem 2rem;border:1px solid rgba(30,58,138,0.25);">
  <div style="margin-bottom:1.75rem;padding-bottom:1.25rem;border-bottom:1px solid rgba(30,58,138,0.2);">
    <span style="font-size:0.85rem;font-weight:800;color:#D9F99D;letter-spacing:0.04em;">${p.orgName}</span>
    <span style="display:block;font-size:0.7rem;color:rgba(241,245,249,0.4);margin-top:0.2rem;letter-spacing:0.04em;">${p.seasonName}</span>
  </div>
  <h2 style="color:#F1F5F9;font-size:1.15rem;margin:0 0 1.25rem;font-weight:700;">${p.subject}</h2>
  <div style="color:rgba(241,245,249,0.8);">${bodyLines}</div>
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
    <div style="background:#0F172A;border:1px solid rgba(30,58,138,0.25);border-left:3px solid rgba(30,58,138,0.5);padding:1.25rem;margin:1.5rem 0;">
      <p style="margin:0 0 0.5rem;font-weight:700;font-size:0.72rem;letter-spacing:0.08em;text-transform:uppercase;color:#D9F99D;">Application Details</p>
      <p style="margin:0;line-height:1.8;color:rgba(241,245,249,0.85);">
        Player: <strong>${p.playerFirstName} ${p.playerLastName}</strong><br>
        Program: <strong>${p.teamName} — ${p.yearName}</strong><br>
        Reference: <strong style="font-family:monospace;">#${ref}</strong>
      </p>
    </div>
    <p style="color:rgba(241,245,249,0.7);">Our coaching staff will review all applications and be in touch. No further action is required at this time.</p>
  `);
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
    <h2 style="color:#D9F99D;font-size:1.4rem;margin:0 0 1rem;">Offer Extended</h2>
    <p>Hi <strong>${p.guardianFirstName}</strong>,</p>
    <p>We&apos;re pleased to let you know that <strong>${p.playerFirstName} ${p.playerLastName}</strong> has been extended an offer to join the <strong>${p.teamName}</strong> <strong>${p.yearName}</strong> program.</p>
    <div style="background:#0F172A;border:1px solid rgba(217,249,157,0.3);border-left:3px solid rgba(217,249,157,0.5);padding:1.25rem;margin:1.5rem 0;">
      <p style="margin:0 0 0.5rem;font-weight:700;font-size:0.72rem;letter-spacing:0.08em;text-transform:uppercase;color:#D9F99D;">Next Steps</p>
      <p style="margin:0;line-height:1.8;color:rgba(241,245,249,0.75);">
        Please contact the coaching staff to confirm whether <strong>${p.playerFirstName}</strong> will be accepting this offer.<br>
        Program: <strong>${p.teamName} — ${p.yearName}</strong>
      </p>
    </div>
  `);
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
    <div style="background:#0F172A;border:1px solid rgba(74,222,128,0.3);border-left:3px solid rgba(74,222,128,0.5);padding:1.25rem;margin:1.5rem 0;">
      <p style="margin:0;line-height:1.8;color:rgba(241,245,249,0.85);">
        Program: <strong>${p.teamName} — ${p.yearName}</strong><br>
        Player: <strong>${p.playerFirstName} ${p.playerLastName}</strong>
      </p>
    </div>
    <p style="color:rgba(241,245,249,0.6);">Your coaching staff will be in touch with more details. We look forward to a great season!</p>
  `);
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
    <p style="color:rgba(241,245,249,0.6);">We appreciate <strong>${p.playerFirstName}</strong>&apos;s interest and encourage them to try again in the future. Please reach out to <a href="mailto:${contact}" style="color:#D9F99D;">${contact}</a> if you have any questions.</p>
  `);
}

export function passwordResetHtml(resetLink: string) {
  return wrap(`
    <h2 style="color:#fff;font-size:1.4rem;margin:0 0 1rem;">Reset Your Password</h2>
    <p>We received a request to reset the password for your <strong>FieldLogicHQ</strong> account.</p>
    <p style="color:rgba(241,245,249,0.7);">Click the button below to set a new password. This link expires in 1 hour.</p>
    <a href="${resetLink}" style="display:inline-block;background:#D9F99D;color:#0b0f14;padding:0.75rem 1.75rem;border-radius:2px;text-decoration:none;font-weight:800;font-size:0.82rem;letter-spacing:0.06em;margin:1.5rem 0;">Reset Password &rarr;</a>
    <p style="color:rgba(241,245,249,0.35);font-size:0.82rem;">If you didn't request a password reset, you can safely ignore this email. Your password will not change.</p>
  `);
}

export function platformPasswordResetHtml(resetLink: string) {
  return `
<div style="font-family:monospace,sans-serif;background:#090d09;color:#e8efe8;max-width:480px;margin:0 auto;padding:2rem;border:1px solid rgba(163,230,53,0.2);">
  <div style="margin-bottom:1.5rem;padding-bottom:1rem;border-bottom:1px solid rgba(163,230,53,0.12);">
    <span style="font-size:0.65rem;font-weight:900;color:#D9F99D;letter-spacing:0.18em;text-transform:uppercase;">FIELDLOGICHQ</span>
    <span style="display:block;font-size:0.6rem;color:rgba(255,255,255,0.35);letter-spacing:0.12em;text-transform:uppercase;margin-top:0.2rem;">Staff Access</span>
  </div>
  <h2 style="color:#F1F5F9;font-size:1rem;font-weight:700;margin:0 0 1rem;letter-spacing:0.04em;text-transform:uppercase;">Reset Your Password</h2>
  <p style="color:rgba(241,245,249,0.6);font-size:0.85rem;line-height:1.65;margin:0 0 1.5rem;">We received a password reset request for your FieldLogicHQ staff account. Click below to set a new password. This link expires in 1 hour.</p>
  <a href="${resetLink}" style="display:inline-block;background:#D9F99D;color:#090d09;padding:0.7rem 1.5rem;text-decoration:none;font-weight:800;font-size:0.72rem;letter-spacing:0.1em;text-transform:uppercase;">Reset Password &rarr;</a>
  <p style="color:rgba(241,245,249,0.22);font-size:0.75rem;margin:1.75rem 0 0;line-height:1.55;">If you didn't request this, you can safely ignore this email. Your password will not change.</p>
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
    <a href="${p.verifyUrl}" style="display:inline-block;background:#D9F99D;color:#0b0f14;padding:0.75rem 1.75rem;border-radius:2px;text-decoration:none;font-weight:800;font-size:0.82rem;letter-spacing:0.06em;margin:1.5rem 0;">Verify Email &rarr;</a>
    <p style="color:rgba(241,245,249,0.35);font-size:0.82rem;">If you did not create this account, you can safely ignore this email.</p>
  `);
}

export function schedulePublishedHtml(p: {
  tournamentName: string;
  coachName: string;
  divisions: string[];
  showTeamNames: boolean;
  scheduleUrl: string;
  contactEmail?: string;
}) {
  const divisionList = p.divisions.map(d => `<li style="margin-bottom:0.25rem;">${d}</li>`).join('');
  const nameNote = p.showTeamNames
    ? 'Your team name appears on the public schedule.'
    : 'Team names are displayed as placeholders until registration closes. Your team name will appear once the organizer finalizes the roster.';
  return wrap(`
    <h2 style="color:#fff;font-size:1.4rem;margin:0 0 1rem;">Your Schedule is Live!</h2>
    <p>Hi <strong>${p.coachName}</strong>,</p>
    <p>The schedule for <strong>${p.tournamentName}</strong> has been published. You can now view game times, dates, and locations on the public tournament page.</p>
    <div style="background:#0F172A;border:1px solid rgba(30,58,138,0.25);border-left:3px solid rgba(30,58,138,0.5);padding:1.25rem;margin:1.5rem 0;">
      <p style="margin:0 0 0.5rem;font-weight:700;font-size:0.72rem;letter-spacing:0.08em;text-transform:uppercase;color:#D9F99D;">Published Divisions</p>
      <ul style="margin:0;padding-left:1.25rem;line-height:1.8;color:rgba(241,245,249,0.8);">${divisionList}</ul>
    </div>
    <p style="color:rgba(241,245,249,0.65);font-size:0.88rem;">${nameNote}</p>
    <a href="${p.scheduleUrl}" style="display:inline-block;background:#D9F99D;color:#0b0f14;padding:0.75rem 1.75rem;border-radius:2px;text-decoration:none;font-weight:800;font-size:0.82rem;letter-spacing:0.06em;margin-top:0.5rem;">View Schedule &rarr;</a>
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
    <div style="background:#0F172A;border:1px solid rgba(245,158,11,0.35);border-left:3px solid rgba(245,158,11,0.5);padding:1.25rem;margin:1.5rem 0;">
      <p style="margin:0 0 0.75rem;font-weight:700;font-size:0.72rem;letter-spacing:0.08em;text-transform:uppercase;color:#F59E0B;">${p.orgName}</p>
      <ul style="margin:0;padding-left:1.25rem;color:rgba(241,245,249,0.72);">${rows}</ul>
    </div>
    <a href="${p.retentionUrl}" style="display:inline-block;background:#1E3A8A;color:#fff;padding:0.75rem 1.75rem;border-radius:2px;text-decoration:none;font-weight:700;font-size:0.82rem;letter-spacing:0.06em;">Review Subscription</a>
  `);
}

export function trialEndingHtml(p: {
  orgName: string;
  planLabel: string;
  trialEndDate: string;
  billingUrl: string;
}) {
  return wrap(`
    <h2 style="color:#F1F5F9;font-size:1.3rem;font-weight:700;margin:0 0 1rem;">Your trial ends soon</h2>
    <p style="margin:0 0 1rem;">Your FieldLogicHQ <strong>${p.planLabel}</strong> trial for <strong>${p.orgName}</strong> ends on <strong>${p.trialEndDate}</strong>.</p>
    <div style="background:#0F172A;border:1px solid rgba(30,58,138,0.25);border-left:3px solid rgba(30,58,138,0.5);padding:1.25rem;margin:1.5rem 0;">
      <p style="margin:0 0 0.5rem;font-weight:700;font-size:0.72rem;letter-spacing:0.08em;text-transform:uppercase;color:#D9F99D;">What happens next</p>
      <p style="margin:0;line-height:1.75;color:rgba(241,245,249,0.8);">
        Your payment method on file will be charged automatically when the trial expires.<br>
        No action is needed if you'd like to continue.
      </p>
    </div>
    <p style="color:rgba(241,245,249,0.7);margin:0 0 1.5rem;">To update your payment method or review your plan before the trial ends, visit your billing settings.</p>
    <a href="${p.billingUrl}" style="display:inline-block;background:#D9F99D;color:#0b0f14;padding:0.75rem 1.75rem;border-radius:2px;text-decoration:none;font-weight:800;font-size:0.82rem;letter-spacing:0.06em;">Manage Billing &rarr;</a>
  `);
}

export function planDowngradedHtml(p: {
  orgName: string;
  fromPlanLabel: string;
  toPlanLabel: string;
  retainedTournaments: number;
  retentionUntil?: string;
  billingUrl: string;
}) {
  const retainedNote = p.retainedTournaments > 0 && p.retentionUntil
    ? `<p style="margin:0;line-height:1.75;color:rgba(241,245,249,0.8);">${p.retainedTournaments} tournament${p.retainedTournaments === 1 ? '' : 's'} that exceed the ${p.toPlanLabel} limit have been archived and retained until <strong>${p.retentionUntil}</strong>. They will be restored if you upgrade again before that date.</p>`
    : `<p style="margin:0;line-height:1.75;color:rgba(241,245,249,0.8);">Your account is active on the ${p.toPlanLabel} plan.</p>`;

  return wrap(`
    <h2 style="color:#F1F5F9;font-size:1.3rem;font-weight:700;margin:0 0 1rem;">Plan updated</h2>
    <p style="margin:0 0 1rem;">Your <strong>${p.orgName}</strong> subscription has been changed from <strong>${p.fromPlanLabel}</strong> to <strong>${p.toPlanLabel}</strong>.</p>
    <div style="background:#0F172A;border:1px solid rgba(30,58,138,0.25);border-left:3px solid rgba(30,58,138,0.5);padding:1.25rem;margin:1.5rem 0;">
      <p style="margin:0 0 0.5rem;font-weight:700;font-size:0.72rem;letter-spacing:0.08em;text-transform:uppercase;color:#D9F99D;">What changed</p>
      ${retainedNote}
    </div>
    <a href="${p.billingUrl}" style="display:inline-block;background:#1E3A8A;color:#fff;padding:0.75rem 1.75rem;border-radius:2px;text-decoration:none;font-weight:700;font-size:0.82rem;letter-spacing:0.06em;">Manage Billing &rarr;</a>
  `);
}

export function teamWorkspaceCancelledHtml(p: {
  workspaceName: string;
  resubscribeUrl: string;
}) {
  return wrap(`
    <h2 style="color:#F1F5F9;font-size:1.3rem;font-weight:700;margin:0 0 1rem;">Coaches Portal cancelled</h2>
    <p style="margin:0 0 1rem;">Your <strong>${p.workspaceName}</strong> Coaches Portal subscription has been cancelled. Premium tools are now inactive.</p>
    <div style="background:#0F172A;border:1px solid rgba(245,158,11,0.3);border-left:3px solid rgba(245,158,11,0.5);padding:1.25rem;margin:1.5rem 0;">
      <p style="margin:0 0 0.5rem;font-weight:700;font-size:0.72rem;letter-spacing:0.08em;text-transform:uppercase;color:#F59E0B;">Your data</p>
      <p style="margin:0;line-height:1.75;color:rgba(241,245,249,0.8);">Your premium team data is archived for the restore window and can be restored by resubscribing. Basic tournament records remain available in Coaches Portal.</p>
    </div>
    <a href="${p.resubscribeUrl}" style="display:inline-block;background:#1E3A8A;color:#fff;padding:0.75rem 1.75rem;border-radius:2px;text-decoration:none;font-weight:700;font-size:0.82rem;letter-spacing:0.06em;">Resubscribe</a>
  `);
}

export function welcomeBackHtml(p: {
  orgName: string;
  planLabel: string;
  restoredTournaments: number;
  dashboardUrl: string;
}) {
  const restoredNote = p.restoredTournaments > 0
    ? `<p style="margin:0;line-height:1.75;color:rgba(241,245,249,0.8);">We've restored <strong>${p.restoredTournaments} tournament${p.restoredTournaments === 1 ? '' : 's'}</strong> to your account — everything is exactly as you left it.</p>`
    : `<p style="margin:0;line-height:1.75;color:rgba(241,245,249,0.8);">Your account is active and ready to go.</p>`;

  return wrap(`
    <h2 style="color:#D9F99D;font-size:1.3rem;font-weight:700;margin:0 0 1rem;">Welcome back!</h2>
    <p style="margin:0 0 1rem;">Your <strong>${p.planLabel}</strong> subscription for <strong>${p.orgName}</strong> is active again.</p>
    <div style="background:#0F172A;border:1px solid rgba(34,197,94,0.3);border-left:3px solid rgba(34,197,94,0.5);padding:1.25rem;margin:1.5rem 0;">
      <p style="margin:0 0 0.5rem;font-weight:700;font-size:0.72rem;letter-spacing:0.08em;text-transform:uppercase;color:#22C55E;">Your account</p>
      ${restoredNote}
    </div>
    <a href="${p.dashboardUrl}" style="display:inline-block;background:#D9F99D;color:#0b0f14;padding:0.75rem 1.75rem;border-radius:2px;text-decoration:none;font-weight:800;font-size:0.82rem;letter-spacing:0.06em;">Go to Dashboard &rarr;</a>
  `);
}

// ── Founding Season email templates ──────────────────────────────────────────

/**
 * founding_welcome — Email 1 of the Founding Season sequence.
 *
 * Fires at signup (transactional — bypasses opt-out check).
 * Subject: "Your founding season starts now — Tournament Plus is free through Dec 31"
 *
 * Note: The unsubscribe footer is injected by email-sender.ts for all marketing
 * emails. For this transactional welcome it is NOT injected (skipOptOutCheck=true),
 * but a courtesy unsubscribe block is included inline via the footerHtml param
 * so recipients still have a clear opt-out path.
 */
export function foundingWelcomeHtml(p: {
  orgName: string;
  firstName?: string;
  setupUrl: string;
  unsubscribeUrl?: string;
}) {
  const greeting = p.firstName ? `Hi ${p.firstName},` : 'Hi there,';
  const unsubscribeBlock = p.unsubscribeUrl
    ? `<div style="margin-top:2rem;padding-top:1.25rem;border-top:1px solid rgba(217,249,157,0.1);">
        <p style="margin:0;color:rgba(241,245,249,0.3);font-size:0.72rem;line-height:1.55;">
          You're receiving this because you signed up for FieldLogicHQ.&nbsp;
          <a href="${p.unsubscribeUrl}" style="color:rgba(217,249,157,0.5);text-decoration:underline;">Unsubscribe</a>
          &nbsp;·&nbsp; FieldLogicHQ · Canada
        </p>
      </div>`
    : '';

  return wrap(`
    <h2 style="color:#D9F99D;font-size:1.35rem;font-weight:800;margin:0 0 1.25rem;letter-spacing:-0.01em;">
      Your founding season starts now.
    </h2>
    <p style="margin:0 0 1rem;">${greeting}</p>
    <p style="margin:0 0 1.25rem;line-height:1.7;">
      You're in. <strong>${p.orgName}</strong> is set up on FieldLogicHQ and running
      <strong>Tournament Plus free through December 31, 2026</strong> as a founding organization.
    </p>

    <div style="background:#0F172A;border:1px solid rgba(217,249,157,0.2);border-left:3px solid rgba(217,249,157,0.5);padding:1.25rem;margin:1.5rem 0;">
      <p style="margin:0 0 0.75rem;font-weight:700;font-size:0.72rem;letter-spacing:0.08em;text-transform:uppercase;color:#D9F99D;">Tournament Plus ($39/month) gives you</p>
      <ul style="margin:0;padding-left:1.25rem;line-height:1.9;color:rgba(241,245,249,0.8);">
        <li>Auto-scheduling across any number of fields and time slots</li>
        <li>Single and double-elimination brackets</li>
        <li>Team communications and announcements</li>
        <li>Tournament archives — every past event preserved</li>
        <li>Up to 3 active tournaments at once</li>
      </ul>
    </div>

    <p style="margin:0 0 1.5rem;line-height:1.7;color:rgba(241,245,249,0.8);">
      All of it, <strong>free until January 1, 2027</strong>. No credit card required.
    </p>

    <a href="${p.setupUrl}" style="display:inline-block;background:#D9F99D;color:#0b0f14;text-decoration:none;font-weight:800;padding:0.8rem 1.5rem;font-size:0.82rem;letter-spacing:0.06em;">Set up your first tournament →</a>

    <p style="margin:1.75rem 0 0;line-height:1.7;color:rgba(241,245,249,0.65);">
      If anything doesn't work the way you'd expect, reply to this email.
      We read everything.
    </p>
    <p style="margin:0.75rem 0 0;color:rgba(241,245,249,0.65);">— The FieldLogicHQ team</p>

    ${unsubscribeBlock}
  `);
}

export function cancellationConfirmationHtml(p: {
  orgName: string;
  planLabel: string;
  retentionUntil: string;
  retainedTournaments: number;
  resubscribeUrl: string;
}) {
  const retainedNote = p.retainedTournaments > 0
    ? `Your ${p.retainedTournaments} tournament${p.retainedTournaments === 1 ? '' : 's'} have been archived and your data is retained until <strong>${p.retentionUntil}</strong>. If you resubscribe before that date, everything will be restored.`
    : `Your account data is retained until <strong>${p.retentionUntil}</strong>. If you resubscribe before that date, everything will be restored.`;

  return wrap(`
    <h2 style="color:#F1F5F9;font-size:1.3rem;font-weight:700;margin:0 0 1rem;">Subscription cancelled</h2>
    <p style="margin:0 0 1rem;">Your <strong>${p.planLabel}</strong> subscription for <strong>${p.orgName}</strong> has been cancelled. Your organization is now inactive.</p>
    <div style="background:#0F172A;border:1px solid rgba(245,158,11,0.3);border-left:3px solid rgba(245,158,11,0.5);padding:1.25rem;margin:1.5rem 0;">
      <p style="margin:0 0 0.5rem;font-weight:700;font-size:0.72rem;letter-spacing:0.08em;text-transform:uppercase;color:#F59E0B;">Your data</p>
      <p style="margin:0;line-height:1.75;color:rgba(241,245,249,0.8);">${retainedNote}</p>
    </div>
    <a href="${p.resubscribeUrl}" style="display:inline-block;background:#1E3A8A;color:#fff;padding:0.75rem 1.75rem;border-radius:2px;text-decoration:none;font-weight:700;font-size:0.82rem;letter-spacing:0.06em;">Resubscribe</a>
  `);
}
