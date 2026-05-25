/* eslint-disable react/no-unescaped-entities */
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
      id: 'recipe-daily-review-queue',
      group: 'How-to recipes',
      heading: 'How to work the daily registration review queue',
      summary: 'Review pending players, confirm payment, and keep the queue from backing up during busy registration periods.',
      keywords: ['daily review', 'pending registrations', 'approve', 'decline', 'fee paid', 'review queue'],
      searchText: 'daily review queue pending registrations approve waitlist decline fee paid payment search filter guardian email division status',
      content: (
        <>
          <p>Use this routine when registrations are actively coming in.</p>
          <ol>
            <li>Open <strong>Registrations</strong> and start on the <strong>Pending Review</strong> tab.</li>
            <li>Filter by division if one division has a deadline or capacity concern.</li>
            <li>Open each registration and confirm the player, guardian contact, division, and payment information.</li>
            <li>Choose <strong>Approve</strong>, <strong>Waitlist</strong>, or <strong>Decline</strong>.</li>
            <li>Use the <strong>Fee Paid</strong> checkbox when payment tracking is separate from approval.</li>
            <li>Search for duplicate player names or guardian emails before approving unusual submissions.</li>
          </ol>
          <p>During peak registration, review pending entries at least once per day so families know where they stand and waitlist order stays clean.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-registration-review-best-practice',
          question: 'What should I check before approving a registration?',
          answerText: 'Confirm division, player details, guardian contact, payment status, and any duplicate submissions before approving.',
          keywords: ['approve registration', 'review pending', 'duplicate'],
          popular: true,
          answer: (
            <p>Confirm the division, player details, guardian contact, payment status, and any duplicate submissions. Then approve, waitlist, or decline the registration.</p>
          ),
        },
      ],
    },
    {
      id: 'recipe-promote-waitlisted-player',
      group: 'How-to recipes',
      heading: 'How to promote a waitlisted player',
      summary: 'Move the next player from the waitlist to active when a spot opens.',
      keywords: ['promote waitlist', 'waitlisted player', 'capacity', 'active registration'],
      searchText: 'promote waitlisted player waitlist position queue capacity spot opens active registration auto promote manual promote notification email',
      content: (
        <>
          <p>Promote from the waitlist when a division has room and you are ready to offer the spot.</p>
          <ol>
            <li>Open the <strong>Waitlist</strong> tab.</li>
            <li>Filter to the division where the spot opened.</li>
            <li>Start with position #1 unless your organization has a documented exception.</li>
            <li>Click <strong>Promote</strong> on that player's row.</li>
            <li>Confirm the player moved to <strong>Active</strong> and that the queue positions compacted.</li>
            <li>Check the notification history if the family says they did not receive the promotion email.</li>
          </ol>
          <p>If auto-promote is enabled for the season, this may happen automatically when a spot opens. Still review the queue after withdrawals to make sure the outcome matches your policy.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-waitlist-promote-skips',
          question: 'Can I skip someone on the waitlist?',
          answerText: 'The product lets admins manage the queue, but organizations should follow their own waitlist policy and record any exception outside the queue if needed.',
          keywords: ['skip waitlist', 'waitlist exception', 'queue'],
          answer: (
            <p>The product lets admins manage the queue, but your organization should follow its published waitlist policy. If you make an exception, record the reason in your internal notes.</p>
          ),
        },
      ],
    },
    {
      id: 'recipe-add-manual-registration',
      group: 'How-to recipes',
      heading: 'How to add a manual registration',
      summary: 'Enter a player who registered outside the public form.',
      keywords: ['manual registration', 'add registration', 'walk-in', 'carry-over player'],
      searchText: 'manual registration add registration walk-in carry-over player public form offline division status guardian fee paid',
      content: (
        <>
          <p>Use manual registration for walk-ins, migrated records, late approvals, or players collected outside the public form.</p>
          <ol>
            <li>Click <strong>Add Registration</strong>.</li>
            <li>Enter player and guardian details exactly as you want them to appear in exports and communications.</li>
            <li>Select the correct season division.</li>
            <li>Choose the starting status: usually <strong>Active</strong> for approved exceptions or <strong>Pending Review</strong> if details still need confirmation.</li>
            <li>Mark fee status if payment has already been received.</li>
            <li>Save and confirm the player appears in the expected status tab.</li>
          </ol>
          <p>Manual entries should still follow your division capacity and waitlist policy. If the division is full, add the player as waitlisted unless your board has approved an exception.</p>
        </>
      ),
    },
    {
      id: 'recipe-message-and-export-registrants',
      group: 'How-to recipes',
      heading: 'How to message or export a targeted registration group',
      summary: 'Reach the right families and download the right list without over-sending.',
      keywords: ['message registrants', 'email', 'export registrations', 'target audience', 'download'],
      searchText: 'message registrants email active waitlisted pending by division by team by status export registration list csv xlsx download targeted audience',
      links: [
        { label: 'Exports & Downloads guide', href: '../help/exports' },
      ],
      content: (
        <>
          <p>Before sending email or exporting data, narrow the audience to the group you actually need.</p>
          <ol>
            <li>Use search, status tabs, and division filters to confirm the target group.</li>
            <li>For email, click <strong>Message Registrants</strong> and choose the audience: active registrants, division, team, or status.</li>
            <li>Review the recipient count before sending. If the count is surprising, cancel and adjust the audience.</li>
            <li>For exports, use the export action on the registration table after applying the filters you want.</li>
            <li>Use CSV or Excel for spreadsheet work, and PDF when you need a printable check-in or board packet format.</li>
          </ol>
          <p>Registration exports contain family contact information. Store them carefully and avoid sharing them with people who do not need the data.</p>
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
