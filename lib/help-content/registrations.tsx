import type { HelpPageContent } from './index';

const registrationsHelp: HelpPageContent = {
  title: 'Registrations',
  role: 'League Registrar, League Admin',
  intro: 'The Registrations page is the day-to-day hub for managing who gets into a season. This guide covers what each status means, how to work through the review queue, and how to handle edge cases like waitlist management and outreach.',
  sections: [
    {
      heading: 'What each registration status means',
      content: (
        <>
          <p>Every registration sits in one of five states:</p>
          <ul>
            <li><strong>Pending Review</strong> — the parent submitted the form but an admin has not yet acted on it. This is the default for most seasons unless auto-approve is enabled.</li>
            <li><strong>Active</strong> — the registration is approved. The player is eligible for team assignment and counts against the division capacity.</li>
            <li><strong>Waitlisted</strong> — the division is full or the admin placed the player on the waitlist manually. The player holds a numbered position in the queue. If auto-promote is enabled, the next waitlisted player advances to Active automatically when a spot opens.</li>
            <li><strong>Declined</strong> — the admin declined the registration. A decline email is sent to the parent&apos;s email address. The player does not count against capacity.</li>
            <li><strong>Withdrawn</strong> — the registration was cancelled after it was approved. Withdrawals are recorded for your records but the player is no longer active.</li>
          </ul>
        </>
      ),
    },
    {
      heading: 'Handling pending registrations day-to-day',
      content: (
        <>
          <p>When you open the Registrations page, it defaults to the <strong>Pending Review</strong> tab. Work through this list by approving, waitlisting, or declining each submission.</p>
          <p>Use the <strong>search box</strong> to find a specific player or guardian email when a parent contacts you directly. The search works across all tabs.</p>
          <p>If a parent registers but pays later, use the <strong>Fee Paid</strong> checkbox on their row to track payment separately from their status.</p>
          <p>To add a player outside the public form (e.g., a walk-in or a manually entered entry), use <strong>Add Registration</strong> in the top right. You can set the status directly when adding manually.</p>
        </>
      ),
    },
    {
      heading: 'Waitlist management',
      content: (
        <>
          <p>The <strong>Waitlist</strong> tab shows all waitlisted players in order by their queue position. Position #1 is next in line.</p>
          <p>If <strong>Auto-promote from waitlist</strong> is on for this season, a spot that opens due to a decline or withdrawal automatically advances the next waitlisted player — you will see a notice in the feedback message when this happens.</p>
          <p>If auto-promote is off, you manage the waitlist manually. Click <strong>Promote</strong> on a player&apos;s row to move them from Waitlisted to Active. Promotions send a notification email to the parent.</p>
          <p>There is no penalty for leaving players on the waitlist — they are notified only when you take action.</p>
        </>
      ),
    },
    {
      heading: 'Reaching out to registrants',
      content: (
        <>
          <p>Use the <strong>Message Registrants</strong> button (top right) to send an email to a targeted audience:</p>
          <ul>
            <li><strong>All Active Registrants</strong> — everyone with an Active status, across all divisions.</li>
            <li><strong>By Division</strong> — all active registrants in one specific division.</li>
            <li><strong>By Team</strong> — all registrants assigned to a specific team (loads after teams are created).</li>
            <li><strong>By Status</strong> — target a specific status group, e.g., everyone Pending Review or everyone Waitlisted.</li>
          </ul>
          <p>Emails are sent immediately to all matching guardian addresses. There is no undo — use the recipient count indicator to confirm the audience before sending.</p>
          <p>The <strong>Notifications</strong> page (accessible from the season sub-navigation) has a full sent-email history log you can reference.</p>
        </>
      ),
    },
  ],
};

export default registrationsHelp;
