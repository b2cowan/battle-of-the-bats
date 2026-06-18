import type { HelpPageContent } from './index';

const registrationsHelp: HelpPageContent = {
  title: 'Registrations',
  role: 'League Registrar, League Admin',
  intro: 'The Registrations page is the day-to-day hub for managing who gets into a house league season. This guide covers what each status means, how to work the review queue, and how to handle waitlists and outreach. (Tournament team registrations are managed separately under Tournaments.)',
  sections: [
    {
      id: 'statuses',
      group: 'How registrations work',
      heading: 'What each registration status means',
      summary: 'Pending, Active, Waitlisted, Declined, and Withdrawn — what each one does.',
      keywords: ['status', 'pending review', 'active', 'waitlisted', 'declined', 'withdrawn'],
      searchText: 'registration status pending review active waitlisted declined withdrawn capacity queue position decline email approved',
      content: (
        <>
          <p>Every registration sits in one of five states:</p>
          <ul>
            <li><strong>Pending Review</strong> — the family submitted the form but no one has acted on it yet. This is the default unless auto-approve is enabled.</li>
            <li><strong>Active</strong> — approved. The player is eligible for team assignment and counts against the division capacity.</li>
            <li><strong>Waitlisted</strong> — the division is full or you placed the player on the waitlist manually. The player holds a numbered position. If auto-promote is on, the next waitlisted player advances to Active automatically when a spot opens.</li>
            <li><strong>Declined</strong> — you declined the registration; a decline email goes to the family. The player does not count against capacity.</li>
            <li><strong>Withdrawn</strong> — the registration was cancelled after approval. It&apos;s kept for your records but the player is no longer active.</li>
          </ul>
          <p>Setting a player to Active, Waitlisted, or Declined emails the family, so they always know where they stand.</p>
        </>
      ),
    },
    {
      id: 'recipe-daily-review-queue',
      group: 'How-to recipes',
      heading: 'How to work the daily registration review queue',
      summary: 'Review pending players, confirm details, and keep the queue from backing up.',
      keywords: ['daily review', 'pending registrations', 'approve', 'decline', 'fee paid', 'review queue'],
      searchText: 'daily review queue pending registrations approve waitlist decline fee paid payment search player name parent email status tabs duplicate confirm',
      content: (
        <>
          <p>Use this routine when registrations are actively coming in. The page is a single table — actions sit right on each row, and the status tabs (Pending / Active / Waitlist / Declined &amp; Withdrawn) plus the search box are how you move through it.</p>
          <ol>
            <li>Open <strong>Registrations</strong> and start on the <strong>Pending Review</strong> tab.</li>
            <li>Use the <strong>search box</strong> (player name or parent email) to find a specific family or spot duplicates.</li>
            <li>Check each row&apos;s player, guardian contact, and division before acting.</li>
            <li>Click <strong>Approve</strong>, <strong>Waitlist</strong>, or <strong>Decline</strong> on the row.</li>
            <li>Use the <strong>Fee Paid</strong> toggle to track payment separately from status.</li>
          </ol>
          <p>During peak registration, clear the pending list at least once a day so families know where they stand and the waitlist order stays clean.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-registration-review-best-practice',
          question: 'What should I check before approving a registration?',
          answerText: 'Confirm division, player details, guardian contact, payment status, and any duplicate submissions before approving. Approving emails the family automatically.',
          keywords: ['approve registration', 'review pending', 'duplicate'],
          popular: true,
          answer: (
            <p>Confirm the division, player details, guardian contact, payment status, and any duplicate submissions, then approve, waitlist, or decline. Each of those actions emails the family.</p>
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
      searchText: 'promote waitlisted player waitlist position queue capacity spot opens active registration auto promote manual promote notification email notifications log',
      content: (
        <>
          <p>Promote from the waitlist when a division has room and you&apos;re ready to offer the spot.</p>
          <ol>
            <li>Open the <strong>Waitlist</strong> tab.</li>
            <li>Start with position #1 unless your organization has a documented exception.</li>
            <li>Click <strong>Promote</strong> on that player&apos;s row.</li>
            <li>Confirm the player moved to <strong>Active</strong> and that the queue positions compacted.</li>
            <li>If the family says they didn&apos;t get the promotion email, check the season&apos;s <strong>Notifications</strong> log.</li>
          </ol>
          <p>If auto-promote is on for the season, this can happen automatically when a spot opens. Still review the queue after declines and withdrawals to make sure the outcome matches your policy.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-waitlist-promote-skips',
          question: 'Can I skip someone on the waitlist?',
          answerText: 'The product lets admins manage the queue, but organizations should follow their own waitlist policy. If you make an exception, record the reason in your internal notes.',
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
      searchText: 'manual registration add registration walk-in carry-over player public form offline division status active pending waitlisted guardian fee paid',
      content: (
        <>
          <p>Use manual registration for walk-ins, migrated records, late approvals, or players collected outside the public form.</p>
          <ol>
            <li>Click <strong>Add Registration</strong>.</li>
            <li>Enter player and guardian details exactly as you want them in exports and communications.</li>
            <li>Select the correct season division.</li>
            <li>Choose the starting status — <strong>Active</strong>, <strong>Pending Review</strong>, or <strong>Waitlisted</strong>.</li>
            <li>Mark the fee paid if payment has already been received.</li>
            <li>Save and confirm the player appears in the expected status tab.</li>
          </ol>
          <p>Manual entries should still follow your division capacity and waitlist policy. If the division is full, add the player as waitlisted unless your board has approved an exception. When the season auto-generates fees, setting a manual player Active also creates their pending fee entry.</p>
        </>
      ),
    },
    {
      id: 'recipe-message-and-export-registrants',
      group: 'How-to recipes',
      heading: 'How to message or export a targeted registration group',
      summary: 'Reach the right families and download the right list without over-sending.',
      keywords: ['message registrants', 'email', 'export registrations', 'target audience', 'download'],
      searchText: 'message registrants email active waitlisted pending by division by team by status export registration list csv xlsx excel contact details download targeted audience league plus',
      links: [
        { label: 'Exports & Downloads guide', href: '../help/exports' },
      ],
      content: (
        <>
          <p>Before sending email or exporting data, narrow to the group you actually need.</p>
          <ol>
            <li>Use the status tabs and the search box to confirm the target group.</li>
            <li>For email, click <strong>Message Registrants</strong> and choose the audience: all active, by division, by team, or by status.</li>
            <li>Review the recipient count before sending. If it looks off, cancel and adjust the audience.</li>
            <li>For exports, use the <strong>Export</strong> action on the table. The standard Excel/CSV omits contact details for privacy; a separate &quot;with contact details&quot; option is there when you need them.</li>
          </ol>
          <p><strong>Messaging is owner/admin-only</strong> — a league registrar won&apos;t see the Message Registrants button. <strong>Exports are part of League Plus</strong>; on the free League plan the export menu is replaced with an upgrade badge. Registration exports contain family contact information, so store them carefully.</p>
        </>
      ),
    },
    {
      id: 'pending-day-to-day',
      group: 'How registrations work',
      heading: 'Handling pending registrations day-to-day',
      summary: 'The page opens on Pending Review; act on each row and track fees with the toggle.',
      keywords: ['pending', 'review', 'search', 'fee paid', 'add registration'],
      searchText: 'pending review default tab search box player name parent email fee paid toggle add registration walk-in row actions decline confirm',
      content: (
        <>
          <p>The Registrations page opens on the <strong>Pending Review</strong> tab. Work the list by approving, waitlisting, or declining each row — declining asks you to confirm first, and tells you whether auto-promote will fill the spot.</p>
          <p>The <strong>search box</strong> finds a player or parent email across all tabs when a family contacts you directly. If a family pays later, use the <strong>Fee Paid</strong> toggle to track payment separately from status. To add a player outside the public form, use <strong>Add Registration</strong>.</p>
        </>
      ),
    },
    {
      id: 'waitlist-management',
      group: 'How registrations work',
      heading: 'Waitlist management',
      summary: 'The waitlist is ordered by queue position; promoting emails the family their move.',
      keywords: ['waitlist', 'queue position', 'auto-promote', 'promote'],
      searchText: 'waitlist tab queue position number auto promote from waitlist decline withdrawal manual promote notification email next in line',
      content: (
        <>
          <p>The <strong>Waitlist</strong> tab shows waitlisted players in queue order — position #1 is next in line, and each player&apos;s waitlist position is shown on their row.</p>
          <p>If <strong>Auto-promote from waitlist</strong> is on for the season, a spot that opens from a decline or withdrawal advances the next waitlisted player automatically — you&apos;ll see a notice in the confirmation message when it happens. If it&apos;s off, click <strong>Promote</strong> to move a player from Waitlisted to Active. Either way, the family is emailed.</p>
        </>
      ),
    },
    {
      id: 'reaching-registrants',
      group: 'How registrations work',
      heading: 'Reaching out to registrants',
      summary: 'Email a targeted audience, and review the sent-email history in the Notifications log.',
      keywords: ['message registrants', 'email', 'audience', 'notifications', 'sent email log'],
      searchText: 'message registrants email all active by division by team by status recipient count send immediately notifications page sent email history log owner admin only',
      content: (
        <>
          <p>Owners and admins can use <strong>Message Registrants</strong> to email a targeted audience:</p>
          <ul>
            <li><strong>All active</strong> — everyone with an Active status.</li>
            <li><strong>By division</strong> — active registrants in one division.</li>
            <li><strong>By team</strong> — registrants assigned to a specific team (after teams are created).</li>
            <li><strong>By status</strong> — a specific status group, e.g. everyone Waitlisted.</li>
          </ul>
          <p>Emails send immediately to all matching guardian addresses — there&apos;s no undo, so check the recipient count first. The season&apos;s <strong>Notifications</strong> page keeps a full sent-email history (approvals, waitlist notices, declines, and messages) you can reference.</p>
        </>
      ),
    },
  ],
};

export default registrationsHelp;
