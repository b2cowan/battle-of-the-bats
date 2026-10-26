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
      summary: 'To review, Active, Waitlisted, Declined, and Withdrawn — what each one does, and where it shows.',
      keywords: ['status', 'to review', 'pending review', 'active', 'waitlisted', 'declined', 'withdrawn', 'released', 'spot released', 'ended', 'accepted', 'received', 'what families see'],
      searchText: 'accepted received holds a spot family word registration status to review pending review active waitlisted declined withdrawn ended tab release the spot spot released reads withdrawn capacity queue position decline email approved',
      content: (
        <>
          <p>Every registration sits in one of five states:</p>
          <ul>
            <li><strong>To review</strong> — the family submitted the form but no one has acted on it yet. This is the default unless the season approves new registrations while a division has room. A child under To review holds a spot, and families read this state as <strong>Received</strong>.</li>
            <li><strong>Active</strong> — approved; families read it as <strong>Accepted</strong>. The player is eligible for team assignment and counts against the division capacity.</li>
            <li><strong>Waitlisted</strong> — the division is full or you placed the player on the waitlist manually. The player holds a numbered position, and a new sign-up never jumps it: while a division has a waitlist, a new child joins the queue even if a spot looks free. If the season moves the waitlist up on its own, the next waitlisted player advances to Active automatically when a spot opens.</li>
            <li><strong>Declined</strong> — you declined the registration; a decline email goes to the family. The player does not count against capacity.</li>
            <li><strong>Withdrawn</strong> — the registration ended after approval, or you released the spot of an accepted family that hadn&apos;t paid (the family reads <strong>Withdrawn</strong> for both). It&apos;s kept for your records but the player is no longer active.</li>
          </ul>
          <p>Declined, withdrawn and released registrations show together on the <strong>Ended</strong> tab, with what happened to any money. Setting a player to Active, Waitlisted, or Declined emails the family, so they always know where they stand. A withdrawal emails them only when money was refunded or kept, and a released spot always does.</p>
        </>
      ),
    },
    {
      id: 'recipe-daily-review-queue',
      group: 'How-to recipes',
      heading: 'How to work the daily registration review queue',
      summary: 'Review pending players, confirm details, and keep the queue from backing up.',
      keywords: ['daily review', 'to review', 'pending registrations', 'approve', 'decline', 'mark received', 'pay by card', 'pay link', 'fee', 'review queue', 'division full', 'add to the waitlist instead', 'select several', 'bulk approve'],
      searchText: 'division is full add to the waitlist instead one needs attention notice per sign-up several children one reference daily review queue to review pending registrations approve waitlist decline mark received fee owing payment search player name parent email status tabs duplicate confirm tick several rows approve promote waitlist mark received move division email one at a time decline withdraw',
      content: (
        <>
          <p>Use this routine when registrations are actively coming in. The page is a single table — actions sit right on each row, and the tabs (To review, Active, Waitlist, Ended) plus the search box are how you move through it. Tick several rows and a bar offers Approve, Promote, Waitlist, Mark received, Move division and Email for all of them at once.</p>
          <ol>
            <li>Open <strong>Registrations</strong> and start on the <strong>To review</strong> tab.</li>
            <li>Use the <strong>search box</strong> (player name or parent email) to find a specific family or spot duplicates.</li>
            <li>Check each row&apos;s player, guardian contact, and division before acting.</li>
            <li>Click <strong>Approve</strong>, <strong>Waitlist</strong>, or <strong>Decline</strong> on the row. If the division is full, Approve is refused with <em>Add to the waitlist instead</em>.</li>
            <li>When a family pays by hand, click <strong>Mark received</strong> on their Active row. A card payment records itself; <strong>Email the pay link</strong> in the row menu (or the bar, for several) sends owing families their link. Approving never creates a fee line; marking a fee received writes it into the season&apos;s book, and the Fee column shows what is owing and for how many days.</li>
          </ol>
          <p>During peak registration, clear the pending list at least once a day so families know where they stand and the waitlist order stays clean.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-registration-review-best-practice',
          question: 'What should I check before approving a registration?',
          answerText: 'Confirm division, player details, guardian contact, the fee, and any duplicate submissions before approving. Approving emails the family automatically.',
          keywords: ['approve registration', 'review pending', 'duplicate'],
          popular: true,
          answer: (
            <p>Confirm the division, player details, guardian contact, the fee, and any duplicate submissions, then approve, waitlist, or decline. Each of those actions emails the family.</p>
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
          <p>Promote from the waitlist when a division has room and you&apos;re ready to offer the spot. Promotion happens only when a spot frees, and a new sign-up never jumps the queue.</p>
          <ol>
            <li>Open the <strong>Waitlist</strong> tab.</li>
            <li>Start with position #1 unless your organization has a documented exception.</li>
            <li>Click <strong>Promote</strong> on that player&apos;s row.</li>
            <li>Confirm the player moved to <strong>Active</strong> and that the queue positions compacted.</li>
            <li>If the family says they didn&apos;t get the promotion email, check the address on the registration. An email to one family about their child goes when the registration changes; the season&apos;s <strong>Email families</strong> page lists emails sent to many families, not these.</li>
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
      keywords: ['manual registration', 'add registration', 'walk-in', 'carry-over player', 'registration night', 'division full', 'add to the waitlist instead', 'mark received'],
      searchText: 'manual registration add registration by hand walk-in carry-over player public form offline division status active to review pending waitlisted guardian fee mark received registration night in person table one laptop too many attempts league registrar can add finished season locked no add registration',
      content: (
        <>
          <p>Use manual registration for walk-ins, migrated records, late approvals, or players collected outside the public form. The owner, club admin, league admin and league registrar can all add one by hand, including after registration has closed.</p>
          <ol>
            <li>Click <strong>Add registration</strong>.</li>
            <li>Enter player and guardian details exactly as you want them in exports and communications.</li>
            <li>Select the correct season division.</li>
            <li>Choose the starting status — <strong>Active</strong>, <strong>To review</strong>, or <strong>Waitlisted</strong>.</li>
            <li>Save and confirm the player appears in the expected tab.</li>
            <li>If payment has already been received, click <strong>Mark received</strong> on their row.</li>
          </ol>
          <p>A full division refuses a hand-added registration with <em>Add to the waitlist instead</em>, and moving a child into a full division is refused too, so a manual entry can&apos;t take a spot that isn&apos;t there. Add the player as waitlisted, or free a spot first. A manual entry creates no fee line on its own; marking its fee received writes one income line into the season&apos;s book. Add registration isn&apos;t offered once the season is finished; the season&apos;s registrations are locked then.</p>
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
      keywords: ['email families', 'message registrants', 'email', 'export registrations', 'target audience', 'download', 'email ticked families', 'email this family'],
      searchText: 'email families message registrants renamed email everyone in the season by division by team by status to review waitlist ended tick rows bulk bar email one family email this family families counted siblings one email three emails in any 24 hours export registration list csv xlsx excel contact details download targeted audience league plus league registrar can email',
      links: [
        { label: 'Exports & downloads guide', href: '../help/exports' },
      ],
      content: (
        <>
          <p>Before sending email or exporting data, narrow to the group you actually need.</p>
          <ol>
            <li>Use the status tabs and the search box to confirm the target group.</li>
            <li>For email, click <strong>Tools &rsaquo; Email families</strong> and choose who: everyone in the season, one or more divisions or teams, or one or more statuses. To write to particular families, tick their rows and click <strong>Email</strong>.</li>
            <li>Check the count of families in the window&apos;s foot before sending. If it looks off, change Who.</li>
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
      summary: 'The page opens on To review; act on each row and take fees with Mark received.',
      keywords: ['pending', 'to review', 'review', 'search', 'mark received', 'fee', 'add registration', 'pay by card', 'pay link', 'email the pay link', 'online, card', 'refund to the card'],
      searchText: 'pay by card card payment records itself email the pay link refund to the card to review pending review default tab search box player name parent email mark received fee owing days amber add registration walk-in row actions decline withdraw release the spot refunded kept by the club confirm finished season locked registrations locked mark received undo correct the price stay open',
      content: (
        <>
          <p>The Registrations page opens on the <strong>To review</strong> tab. Work the list by approving, waitlisting, or declining each row — declining opens a window that asks what happened to any money, and tells you whether the waitlist will move up on its own to fill the spot.</p>
          <p>The <strong>search box</strong> finds a player or parent email across all tabs when a family contacts you directly. When a family pays by hand, click <strong>Mark received</strong> on their row: it records the whole amount still owing, with the date and how. A family who pays by card from their status page needs nothing from you (the Fee cell reads <em>Online, card</em> with a receipt number), and <strong>Email the pay link</strong> in the row&rsquo;s menu sends a family who owes their link. If you marked one by mistake, <strong>Undo: marked received by mistake</strong> takes it back; if the money is going back to the family, decline or withdraw the registration and choose <strong>Refunded</strong>. To add a player outside the public form, use <strong>Add registration</strong>.</p>
          <p>When the season is finished (completed or archived), its registrations are locked: the row actions and <strong>Add registration</strong> are gone, and a line at the top says so. <strong>Mark received</strong>, <strong>Undo</strong>, <strong>Correct the price</strong> and <strong>Email families</strong> stay, because fees still arrive after the last game.</p>
          <p>The full day-to-day workflow, including the Fee column, ending a registration, correcting a price and moving a child to another division, is in <em>Managing registrations day to day</em> in the House league guide.</p>
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
          <p>If <strong>Auto-promote from waitlist</strong> is on for the season, a spot that opens from a decline or withdrawal advances the next waitlisted player automatically — you&apos;ll see a notice in the confirmation message when it happens. If it&apos;s off, the spot stays open and you click <strong>Promote</strong> to move a player from Waitlisted to Active. Either way, the family is emailed. A division that is still full leaves the child on the waitlist.</p>
        </>
      ),
    },
    {
      id: 'reaching-registrants',
      group: 'How registrations work',
      heading: 'Reaching out to registrants',
      summary: 'Email the season, a part of it, the families you ticked or one family, and see what was sent on the season’s Email families page.',
      keywords: ['email families', 'message registrants', 'email', 'audience', 'notifications', 'sent email log', 'email this family', 'three emails', 'in any 24 hours'],
      searchText: 'email families message registrants renamed email everyone in the season families with an active child by division by team published by status active to review waitlist ended ticked families bulk bar one family email this family never counts each season three emails in any 24 hours automatic emails publish teams never count families counted siblings one email sent history notifications page renamed league registrar can email owner club admin league admin no families access finished season stays open',
      content: (
        <>
          <p>The owner, club admin, league admin and league registrar can email a season&apos;s families from Registrations, three ways:</p>
          <ul>
            <li><strong>Tools &rsaquo; Email families</strong> — everyone in the season (families with an active child), one or more divisions, teams in a published division, or statuses.</li>
            <li><strong>Tick rows, then Email</strong> — just the families you ticked.</li>
            <li><strong>A row&apos;s &#8943; &rsaquo; Email this family</strong> — one family.</li>
          </ul>
          <p>The window counts families, so siblings get one email. Each season can send <strong>3 emails in any 24 hours</strong>; a message to one family, and the automatic emails Publish teams sends, never count. An email goes as soon as you press Send, so check the count first. The season&apos;s <strong>Email families</strong> page, in its menu beside Money, lists what was sent. More in <em>Money and Email families</em> in the House league guide.</p>
        </>
      ),
    },
  ],
};

export default registrationsHelp;
