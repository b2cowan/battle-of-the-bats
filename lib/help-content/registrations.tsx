import type { HelpPageContent } from './index';

const registrationsHelp: HelpPageContent = {
  title: 'Registrations',
  role: 'League registrar, League admin',
  intro: 'The Registrations page is the day-to-day hub for managing who gets into a house league season. This guide covers what each status means, how to work the review queue, and how to handle waitlists and outreach. (Tournament team registrations are managed separately under Tournaments.)',
  sections: [
    {
      id: 'statuses',
      group: 'How registrations work',
      heading: 'What each registration status means',
      summary: 'Pending review, Active, Waitlisted, Declined, and Withdrawn — what each one does.',
      keywords: ['status', 'pending review', 'active', 'waitlisted', 'declined', 'withdrawn'],
      searchText: 'registration status pending review active waitlisted declined withdrawn capacity queue position decline email approved',
      content: (
        <>
          <p>Every registration sits in one of five states:</p>
          <ul>
            <li><strong>Pending review</strong> — the family submitted the form but no one has acted on it yet. This is the default unless auto-approve is enabled.</li>
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
          <p>Use this routine when registrations are actively coming in. The page is a single table — actions sit right on each row, and the status tabs (Pending review, Active, Waitlist, Declined / withdrawn) plus the search box are how you move through it.</p>
          <ol>
            <li>Open <strong>Registrations</strong> and start on the <strong>Pending review</strong> tab.</li>
            <li>Use the <strong>search box</strong> (player name or parent email) to find a specific family or spot duplicates.</li>
            <li>Check each row&apos;s player, guardian contact, and division before acting.</li>
            <li>Click <strong>Approve</strong>, <strong>Waitlist</strong>, or <strong>Decline</strong> on the row.</li>
            <li>Use the <strong>Fee paid</strong> toggle to track payment separately from status. Approving never creates a fee line; ticking Fee paid writes it into the season&apos;s accounting book.</li>
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
      searchText: 'promote waitlisted player waitlist position queue capacity spot opens active registration auto promote manual promote notification email email families sent log notifications log',
      content: (
        <>
          <p>Promote from the waitlist when a division has room and you&apos;re ready to offer the spot.</p>
          <ol>
            <li>Open the <strong>Waitlist</strong> tab.</li>
            <li>Start with position #1 unless your organization has a documented exception.</li>
            <li>Click <strong>Promote</strong> on that player&apos;s row.</li>
            <li>Confirm the player moved to <strong>Active</strong> and that the queue positions compacted.</li>
            <li>If the family says they didn&apos;t get the promotion email, check the sent log on the season&apos;s <strong>Email families</strong> page.</li>
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
      keywords: ['manual registration', 'add registration', 'walk-in', 'carry-over player', 'registration night'],
      searchText: 'manual registration add registration by hand walk-in carry-over player public form offline division status active pending waitlisted guardian fee paid registration night in person table one laptop too many attempts league registrar can add finished season locked no add registration',
      content: (
        <>
          <p>Use manual registration for walk-ins, migrated records, late approvals, or players collected outside the public form. The owner, club admin, league admin and league registrar can all add one by hand, including after registration has closed.</p>
          <ol>
            <li>Click <strong>Add registration</strong>.</li>
            <li>Enter player and guardian details exactly as you want them in exports and communications.</li>
            <li>Select the correct season division.</li>
            <li>Choose the starting status — <strong>Active</strong>, <strong>Pending review</strong>, or <strong>Waitlisted</strong>.</li>
            <li>Mark the fee paid if payment has already been received.</li>
            <li>Save and confirm the player appears in the expected status tab.</li>
          </ol>
          <p>Manual entries should still follow your division capacity and waitlist policy. If the division is full, add the player as waitlisted unless your board has approved an exception. A manual entry creates no fee line on its own; marking its fee paid writes one income line into the season&apos;s accounting book. Add registration isn&apos;t offered once the season is finished; the season&apos;s registrations are locked then.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-waiver-recorded',
          question: 'Is the waiver a family accepts on the public form actually recorded?',
          answer: (
            <p>
              Yes — since August 2026. When a season has waiver text and a guardian ticks the box on
              the public form, the moment of acceptance and the exact wording they agreed to are both
              stored with the registration, and the acceptance appears as consent on the family&rsquo;s
              record. Registrations from before then, and manual registrations you type in yourself
              (where no guardian saw a waiver), show no acceptance — that means &ldquo;not
              recorded&rdquo;, not &ldquo;refused&rdquo;.
            </p>
          ),
          answerText:
            'Yes since August 2026. Public-form acceptance stores the time and the exact waiver wording, and shows as consent on the family record. Older rows and manual registrations show no acceptance, meaning not recorded rather than refused.',
          keywords: ['waiver', 'accepted', 'consent', 'recorded', 'proof', 'signed'],
        },
        {
          id: 'faq-registration-too-many-attempts',
          question: 'A family says the registration form told them “Too many attempts.” What happened?',
          answer: (
            <>
              <p>
                The public registration form and the registration status lookup limit how many times
                they can be used from one internet connection, and how many confirmation emails one
                address can receive, within an hour. It stops automated abuse, such as someone using
                the form to flood a stranger&rsquo;s inbox.
              </p>
              <p>
                A family normally meets it only when many registrations go in from the same
                connection in a short time (a registration table running everyone through one
                laptop, say) or the same email address is sent again and again. Ask them to wait a
                few minutes and try again.
              </p>
              <p>
                Taking registrations in person on one device? Enter them yourself with{' '}
                <strong>Add registration</strong>, which has no such limit. No guardian sees the
                waiver on a manual entry, so it shows no acceptance.
              </p>
            </>
          ),
          answerText:
            'The public registration form and the status lookup limit how many times they can be used from one internet connection, and how many confirmation emails one address can receive, within an hour, to stop automated abuse such as flooding a stranger\'s inbox. A family normally meets it only when many registrations go in from the same connection in a short time (a registration table running everyone through one laptop) or the same email is sent again and again. Ask them to wait a few minutes and try again. For in-person registration on one device, use Add registration, which has no such limit; a manual entry shows no waiver acceptance.',
          keywords: ['too many attempts', 'try again later', 'form limit', 'cannot register', 'form blocked', 'rate limit', 'registration night', 'status lookup'],
        },
      ],
    },
    {
      id: 'recipe-message-and-export-registrants',
      group: 'How-to recipes',
      heading: 'How to email or export a targeted registration group',
      summary: 'Reach the right families and download the right list without over-sending.',
      keywords: ['email families', 'message registrants', 'email', 'export registrations', 'target audience', 'download'],
      searchText: 'email families message registrants renamed email active waitlisted pending by division by team by status export registration list csv xlsx excel contact details download targeted audience league plus league registrar can email',
      links: [
        { label: 'Exports & downloads guide', href: '../help/exports' },
      ],
      content: (
        <>
          <p>Before sending email or exporting data, narrow to the group you actually need.</p>
          <ol>
            <li>Use the status tabs and the search box to confirm the target group.</li>
            <li>For email, click <strong>Email families</strong> and choose the audience: all active, by division, by team, or by status.</li>
            <li>Review the recipient count before sending. If it looks off, cancel and adjust the audience.</li>
            <li>For exports, use the <strong>Export</strong> action on the table. The standard Excel/CSV omits contact details for privacy; a separate &quot;with contact details&quot; option is there when you need them.</li>
          </ol>
          <p><strong>Email families is open to the owner, club admin, league admin and league registrar</strong>, and stays open on a finished season. <strong>Exports are part of League Plus</strong>; on the free League plan the export menu is replaced with an upgrade badge. Registration exports contain family contact information, so store them carefully.</p>
        </>
      ),
    },
    {
      id: 'pending-day-to-day',
      group: 'How registrations work',
      heading: 'Handling pending registrations day-to-day',
      summary: 'The page opens on Pending review; act on each row and track fees with the toggle.',
      keywords: ['pending', 'review', 'search', 'fee paid', 'add registration'],
      searchText: 'pending review default tab search box player name parent email fee paid toggle add registration walk-in row actions decline confirm finished season locked registrations locked fee paid stays open',
      content: (
        <>
          <p>The Registrations page opens on the <strong>Pending review</strong> tab. Work the list by approving, waitlisting, or declining each row — declining asks you to confirm first, and tells you whether auto-promote will fill the spot.</p>
          <p>The <strong>search box</strong> finds a player or parent email across all tabs when a family contacts you directly. If a family pays later, use the <strong>Fee paid</strong> toggle to track payment separately from status; ticking it records the fee in the season&apos;s accounting book, and unticking it (or declining the registration) voids that line. To add a player outside the public form, use <strong>Add registration</strong>.</p>
          <p>When the season is finished (completed or archived), its registrations are locked: the row actions and <strong>Add registration</strong> are gone, and a line at the top says so. The <strong>Fee paid</strong> toggle and <strong>Email families</strong> stay, because fees still arrive after the last game.</p>
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
      summary: 'Email a targeted audience, and review the sent-email history on the Email families page.',
      keywords: ['email families', 'message registrants', 'email', 'audience', 'notifications', 'sent email log'],
      searchText: 'email families message registrants renamed email all active by division by team by status recipient count send immediately notifications page renamed sent email history log league registrar can email owner club admin league admin finished season stays open',
      content: (
        <>
          <p>The owner, club admin, league admin and league registrar can use <strong>Email families</strong> on the Registrations page to email a targeted audience:</p>
          <ul>
            <li><strong>All active</strong> — everyone with an Active status.</li>
            <li><strong>By division</strong> — active registrants in one division.</li>
            <li><strong>By team</strong> — registrants assigned to a specific team (after teams are created).</li>
            <li><strong>By status</strong> — a specific status group, e.g. everyone Waitlisted.</li>
          </ul>
          <p>Emails send immediately to all matching guardian addresses — there&apos;s no undo, so check the recipient count first. The season&apos;s <strong>Email families</strong> page, in its menu beside Money, keeps a full sent-email history (approvals, waitlist notices, declines, and messages) you can reference.</p>
        </>
      ),
    },
  ],
};

export default registrationsHelp;
