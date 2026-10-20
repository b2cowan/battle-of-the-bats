import { notFound } from 'next/navigation';
import {
  registrationConfirmationHtml,
  waitlistConfirmationHtml,
  adminNotificationHtml,
  acceptanceHtml,
  rejectionHtml,
  paymentConfirmationHtml,
  schedulePublishedHtml,
  gameDayReminderHtml,
  tournamentResultsFinalizedHtml,
  paymentReminderHtml,
  coachAccessReminderHtml,
  manualTeamRegistrationHtml,
  teamInvitationHtml,
  announcementHtml,
  acceptanceFeeLine,
  teamWorkspaceWelcomeHtml,
  signupVerificationHtml,
  platformPasswordResetHtml,
} from '@/lib/email';
import { VERIFICATION_NEXT_STEP } from '@/lib/verification-next-step';
import { INVITATION_EMAIL_WORDS } from '@/lib/invite-only-words';

// Sample "amount due" line (deposit-first), as the acceptance email now shows (J5-063).
const SAMPLE_FEE_LINE = acceptanceFeeLine({
  feeMode: 'tournament',
  tournament: { depositAmount: 100, depositDueDate: '2026-06-19', totalFeeAmount: 500, totalFeeDueDate: '2026-07-10' },
  division: null,
});

export const metadata = { title: 'Coach Email Preview (dev)' };

/**
 * DEV-ONLY coach email gallery (Coach Experience Walkthrough — Step 5).
 *
 * Renders every coach-facing email template with realistic sample data so the team can review
 * copy, design, links, and consistency on localhost WITHOUT sending mail (the localhost RESEND
 * key is empty) or setting up an accept→pay→publish sequence per email. Blocked in production.
 *
 * This page only *reads* the pure HTML builders from lib/email.ts — it never sends anything.
 */

// Shared realistic sample data.
const S = {
  teamName: 'Toronto Blue Jays U13',
  coachName: 'Robert Cowan',
  divisionName: 'U13',
  tournamentName: 'Battle of the Bats 2026',
  teamId: '81b249be-dfb1-4460-9239-d7c6bd8aad57',
  contactEmail: 'organizer@dev-test-org.ca',
  coachEmail: 'coach@example.ca',
  paymentInstructions:
    'E-transfer to treasurer@club.ca with your team name in the memo.\nPassword: softball\nDeposit due by the date above; balance by July 10.',
};

const PORTAL = 'https://dev.fieldlogichq.ca/coaches/tournaments/' + S.teamId;
const PUBLIC = 'https://dev.fieldlogichq.ca/dev-test-org/battle-of-the-bats-2026';

type Preview = {
  id: string;
  label: string;
  subject: string;
  trigger: string;
  html: string;
};

// Coach-facing emails, grouped by how they fire.
const AUTOMATIC: Preview[] = [
  {
    id: 'registration',
    label: 'Registration received',
    subject: 'Registration Received - ' + S.teamName,
    trigger: 'Coach submits the public registration form.',
    html: registrationConfirmationHtml({
      teamName: S.teamName, coachName: S.coachName, registrantName: S.coachName, divisionName: S.divisionName,
      tournamentName: S.tournamentName, contactEmail: S.contactEmail, coachEmail: S.coachEmail,
      registrationId: S.teamId,
    }),
  },
  {
    // Register Your Existing Team, Stage 1b (C1): a team manager registered a Premium team. The email greets
    // them, and says the organizer's emails go to the head coach the portal named.
    id: 'registration-by-staff',
    label: 'Registration received — someone else is the head coach',
    subject: 'Registration Received - ' + S.teamName,
    trigger: 'A team manager registers a Premium team whose head coach is someone else.',
    html: registrationConfirmationHtml({
      teamName: S.teamName, coachName: S.coachName, registrantName: 'Alex Morgan', headCoachElsewhere: true,
      divisionName: S.divisionName, tournamentName: S.tournamentName, contactEmail: S.contactEmail,
      coachEmail: 'alex@example.ca', registrationId: S.teamId,
    }),
  },
  {
    id: 'waitlist',
    label: 'Waitlisted',
    subject: 'Waitlist Confirmation - ' + S.teamName,
    trigger: 'Coach registers into a full division (or organizer sets status to waitlist).',
    html: waitlistConfirmationHtml({
      teamName: S.teamName, coachName: S.coachName, registrantName: S.coachName, divisionName: S.divisionName,
      tournamentName: S.tournamentName, contactEmail: S.contactEmail, coachEmail: S.coachEmail,
      registrationId: S.teamId,
    }),
  },
  {
    id: 'accepted-with-instructions',
    label: 'Team accepted — with payment instructions',
    subject: 'Your Team Has Been Accepted — ' + S.tournamentName,
    trigger: 'Organizer accepts the team AND has payment instructions set.',
    html: acceptanceHtml({
      teamName: S.teamName, coachName: S.coachName, divisionName: S.divisionName,
      tournamentName: S.tournamentName, teamId: S.teamId, contactEmail: S.contactEmail,
      coachEmail: S.coachEmail, paymentInstructions: S.paymentInstructions, feeLine: SAMPLE_FEE_LINE,
    }),
  },
  {
    id: 'accepted-no-instructions',
    label: 'Team accepted — no instructions set (fallback)',
    subject: 'Your Team Has Been Accepted — ' + S.tournamentName,
    trigger: 'Organizer accepts the team but left payment instructions blank.',
    html: acceptanceHtml({
      teamName: S.teamName, coachName: S.coachName, divisionName: S.divisionName,
      tournamentName: S.tournamentName, teamId: S.teamId, contactEmail: S.contactEmail,
      coachEmail: S.coachEmail, feeLine: SAMPLE_FEE_LINE,
    }),
  },
  {
    id: 'payment-recorded',
    label: 'Payment recorded',
    subject: 'Payment Recorded — ' + S.tournamentName,
    trigger: 'Organizer marks the team paid.',
    html: paymentConfirmationHtml({
      teamName: S.teamName, coachName: S.coachName, divisionName: S.divisionName,
      tournamentName: S.tournamentName, contactEmail: S.contactEmail, teamId: S.teamId,
      coachEmail: S.coachEmail,
    }),
  },
  {
    id: 'schedule-published',
    label: 'Schedule published',
    subject: 'Schedule Published — ' + S.tournamentName,
    trigger: 'Organizer publishes the schedule (Tournament Plus feature).',
    html: schedulePublishedHtml({
      tournamentName: S.tournamentName, coachName: S.coachName, divisions: [S.divisionName, 'U15'],
      scheduleUrl: PUBLIC + '/schedule', contactEmail: S.contactEmail, registrationId: S.teamId,
      coachEmail: S.coachEmail,
    }),
  },
  {
    id: 'game-day',
    label: 'Game-day reminder',
    subject: S.teamName + ': your first game at ' + S.tournamentName,
    trigger: 'Auto-scheduled — the evening before the team’s first game.',
    html: gameDayReminderHtml({
      teamName: S.teamName, coachName: S.coachName, tournamentName: S.tournamentName,
      firstGameLabel: 'Saturday, July 14 · 9:00 a.m.', location: 'Diamond 3, Memorial Park',
      opponentName: 'Milton Mavericks', portalUrl: PORTAL, contactEmail: S.contactEmail,
    }),
  },
  {
    id: 'rejection',
    label: 'Rejection',
    subject: 'Registration Update — ' + S.tournamentName,
    trigger: 'Organizer rejects the team.',
    html: rejectionHtml({
      teamName: S.teamName, coachName: S.coachName, divisionName: S.divisionName,
      tournamentName: S.tournamentName, contactEmail: S.contactEmail,
    }),
  },
  {
    id: 'premium-welcome',
    label: 'Premium Coaches Portal welcome',
    subject: 'Welcome to your Premium Coaches Portal — ' + S.teamName,
    trigger: 'Fires once when a coach completes the Premium checkout (provisioning).',
    html: teamWorkspaceWelcomeHtml({
      teamName: S.teamName,
      portalUrl: 'https://dev.fieldlogichq.ca/toronto-blue-jays-u13/coaches',
    }),
  },
  {
    id: 'results',
    label: 'Final results posted',
    subject: 'Final Results Posted - ' + S.tournamentName,
    trigger: 'Organizer completes the tournament (if results notifications are on).',
    html: tournamentResultsFinalizedHtml({
      tournamentName: S.tournamentName, coachName: S.coachName,
      resultsUrl: PUBLIC + '/standings', scheduleUrl: PUBLIC + '/schedule', teamsUrl: PUBLIC + '/teams',
      fieldLogicUrl: 'https://dev.fieldlogichq.ca', teamUrl: 'https://dev.fieldlogichq.ca/coaches/start?source=post_event_results_email',
      contactEmail: S.contactEmail, registrationId: S.teamId, coachEmail: S.coachEmail,
    }),
  },
];

const ORGANIZER_INITIATED: Preview[] = [
  {
    id: 'payment-reminder',
    label: 'Payment reminder',
    subject: 'Payment Reminder — ' + S.tournamentName,
    trigger: 'Organizer sends a reminder to unpaid teams (Tournament Plus).',
    html: paymentReminderHtml({
      teamName: S.teamName, coachName: S.coachName, divisionName: S.divisionName,
      tournamentName: S.tournamentName, amountDue: '$100.00', dueDate: 'June 19, 2026',
      paymentInstructions: S.paymentInstructions, contactEmail: S.contactEmail,
      registrationId: S.teamId, coachEmail: S.coachEmail,
    }),
  },
  {
    id: 'access-reminder',
    label: 'Resend access link',
    subject: 'Your FieldLogicHQ registration dashboard — ' + S.teamName,
    trigger: 'Organizer clicks “Resend access link” for a registration.',
    html: coachAccessReminderHtml({
      teamName: S.teamName, coachName: S.coachName, tournamentName: S.tournamentName,
      joinUrl: 'https://dev.fieldlogichq.ca/coaches/join?registrationId=' + S.teamId,
      loginUrl: 'https://dev.fieldlogichq.ca/auth/login',
    }),
  },
  {
    id: 'manual-add',
    label: 'Team added by organizer (manual / import)',
    subject: 'Team Registered - ' + S.teamName,
    trigger: 'Organizer adds or imports the team directly.',
    html: manualTeamRegistrationHtml({
      teamName: S.teamName, coachName: S.coachName, divisionName: S.divisionName,
      tournamentName: S.tournamentName, paymentStatus: 'pending', contactEmail: S.contactEmail,
      registrationId: S.teamId, coachEmail: S.coachEmail,
    }),
  },
  {
    id: 'invitation',
    label: 'The invitation — team added on an invite-only event (free plan, a coach’s event)',
    subject: INVITATION_EMAIL_WORDS.subject(S.teamName, S.tournamentName),
    trigger: 'The host adds the team with its coach’s email, or presses Resend the invitation (the free tournament tier, B3).',
    html: teamInvitationHtml({
      teamName: S.teamName, coachName: S.coachName, divisionName: S.divisionName,
      tournamentName: S.tournamentName, registrationId: S.teamId, coachEmail: S.coachEmail,
    }),
  },
  {
    id: 'announcement',
    label: 'Announcement (email channel)',
    subject: 'Gate times & parking',
    trigger: 'Organizer posts an announcement with the email channel on.',
    html: announcementHtml({
      title: 'Gate times & parking',
      body: 'Hi coaches,\n\nGates open at 7:30 a.m. Saturday. Park in Lot C and check in at the scorer’s table before your first game.\n\nSee you there!',
      tournamentName: S.tournamentName, contactEmail: S.contactEmail, coachEmail: S.coachEmail,
    }),
  },
];

// The organizer's own alert — not a coach email, shown here because Stage 1b changed what it names.
const TO_THE_ORGANIZER: Preview[] = [
  {
    id: 'organizer-new-registration',
    label: 'New registration — to the organizer',
    subject: `New Registration: ${S.teamName} (${S.divisionName})`,
    trigger: 'Any public registration. "Registered by" appears only when someone other than the head coach registered.',
    html: adminNotificationHtml({
      teamName: S.teamName, coachName: S.coachName, contactEmail: S.coachEmail,
      registeredBy: { name: 'Alex Morgan', email: 'alex@example.ca' },
      divisionName: S.divisionName, tournamentName: S.tournamentName,
    }),
  },
];

// The two account emails, in the warm envelope (The first look, Stage 2a). The confirmation email's one changing line
// is its next step, so the trigger lists every door's.
const ACCOUNT: Preview[] = [
  {
    id: 'signup-verification',
    label: 'Confirm your email',
    subject: 'Confirm your FieldLogicHQ email',
    trigger: 'Any sign-up while email confirmation is on, and every "Send the link again". Shown for Start a team. '
      + 'The next step by door: ' + Object.values(VERIFICATION_NEXT_STEP).join(' · '),
    html: signupVerificationHtml({ verifyUrl: 'https://dev.fieldlogichq.ca/auth/signup-confirm?link=sample', firstName: 'Jordan', nextStep: 'team' }),
  },
  {
    id: 'password-reset',
    label: 'Reset your password',
    subject: 'Reset your FieldLogicHQ password',
    trigger: 'Forgot password, or support’s reset from the platform admin.',
    html: platformPasswordResetHtml('https://dev.fieldlogichq.ca/auth/reset-confirm?link=sample'),
  },
];

function EmailCard({ p }: { p: Preview }) {
  return (
    <section id={p.id} style={{ marginBottom: '2.5rem', scrollMarginTop: '1rem' }}>
      <div style={{ marginBottom: '0.5rem' }}>
        <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#D9F99D' }}>{p.label}</div>
        <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#f1f5f9', marginTop: '0.15rem' }}>Subject: {p.subject}</div>
        <div style={{ fontSize: '0.8rem', color: 'rgba(241,245,249,0.5)', marginTop: '0.15rem' }}>{p.trigger}</div>
      </div>
      <iframe
        srcDoc={p.html}
        title={p.label}
        style={{ width: '100%', height: '640px', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', background: '#fff' }}
      />
    </section>
  );
}

export default function CoachEmailPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();

  const groups: Array<{ title: string; note: string; items: Preview[] }> = [
    { title: 'Automatic — fired by organizer actions', note: 'These send on their own when the organizer acts (accept, mark paid, publish, complete).', items: AUTOMATIC },
    { title: 'Organizer-initiated', note: 'These only send when the organizer chooses to send them.', items: ORGANIZER_INITIATED },
    { title: 'To the organizer', note: 'Not a coach email: what the organizer receives about a registration.', items: TO_THE_ORGANIZER },
    { title: 'Account emails', note: 'Everyone’s: confirming a new account and resetting a password. They wear the warm envelope.', items: ACCOUNT },
  ];

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '2rem 1.25rem 4rem', color: '#f1f5f9', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 0.35rem' }}>Coach email preview</h1>
      <p style={{ color: 'rgba(241,245,249,0.6)', fontSize: '0.9rem', margin: '0 0 0.75rem', lineHeight: 1.55 }}>
        Every coach-facing email rendered with sample data — for review only (nothing is sent). Dev-only.
      </p>
      <nav style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem 0.75rem', fontSize: '0.82rem', marginBottom: '2rem' }}>
        {[...AUTOMATIC, ...ORGANIZER_INITIATED, ...TO_THE_ORGANIZER].map(p => (
          <a key={p.id} href={'#' + p.id} style={{ color: '#D9F99D', textDecoration: 'none' }}>{p.label}</a>
        ))}
      </nav>

      {groups.map(g => (
        <div key={g.title}>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '1.5rem 0 0.25rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1.25rem' }}>{g.title}</h2>
          <p style={{ color: 'rgba(241,245,249,0.45)', fontSize: '0.8rem', margin: '0 0 1.5rem' }}>{g.note}</p>
          {g.items.map(p => <EmailCard key={p.id} p={p} />)}
        </div>
      ))}
    </div>
  );
}
