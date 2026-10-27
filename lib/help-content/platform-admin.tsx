/* eslint-disable react/no-unescaped-entities */
import type { HelpPageContent } from './index';
import { HelpSteps, HelpNote, HelpDefs, HelpDef } from '@/components/help/HelpBlocks';

const platformAdminHelp: HelpPageContent = {
  title: 'Platform Admin Operations',
  role: 'Platform Admin',
  searchPlaceholder: 'Search platform admin SOPs',
  intro:
    'Employee-only workflows for supporting FieldLogicHQ customers. Use this guide when you need to find a club or person, read and change a record, reset access, check whether an email arrived, read platform status, answer feedback, explain customer-facing docs, apply temporary billing or module exceptions, investigate account history, or manage platform staff access.',
  sections: [
    {
      id: 'where-to-work',
      group: 'Orientation',
      heading: 'Where to work first',
      summary: 'Know the menu, Today and Find before you change an account.',
      keywords: ['overview', 'today', 'organizations', 'clubs & portals', 'customer users', 'people', 'plans pricing', 'plans & pricing', 'bulk operations', 'bulk changes', 'audit', 'audit log', 'support console', 'menu', 'menu by job', 'sidebar', 'collapse sidebar', 'account menu', 'sign out', 'appearance', 'warm', 'dark', 'help', 'private finance', 'business numbers', 'find', 'search', 'recent', 'slash', 'old names', 'renamed', 'observability', 'errors', 'status', 'sent emails', 'early access', 'leads', 'email campaigns', 'campaigns', 'platform users', 'staff', 'reason', 'why', 'every change keeps its reason', 'waiting', 'amber count', 'view-only', 'eye'],
      searchText: 'where to work first support console menu by job groups customers health growth product records system private finance bookkeeping owner only today what is waiting on us amber count queue waiting since your last visit totals line business numbers subscription growth usage metric notes find box top strip press slash recent last five records opened cleared at sign-out all in clubs and portals all in people stripe numbers cus sub pi ch py in_ invoice number printed invoice number charge number payment number enter opens the money tab on that charge nothing matches test-mode number card digits are not searched every change keeps its reason why window one sentence confirm eye view-only for your role old names overview organizations customer users observability status sent emails early access email campaigns bulk operations platform users command center billing & product support & diagnostics governance help at the foot of the menu opens in place collapse sidebar menu button top strip account menu appearance warm dark sign out staff access',
      links: [
        { label: 'Today', href: '/platform-admin' },
        { label: 'Clubs & portals', href: '/platform-admin/orgs' },
        { label: 'People', href: '/platform-admin/customer-users' },
        { label: 'Audit log', href: '/platform-admin/audit' },
      ],
      content: (
        <p>Start from the smallest surface that answers the support question: press <strong>/</strong> to find a club or a person, check <strong>Today</strong> for what is waiting, and open the record before you change anything. If a customer is asking how to use the app, open the customer-facing guide from <strong>Help</strong> first &mdash; platform employees read the same articles there without entering a customer org.</p>
      ),
      subtopics: [
        {
          id: 'where-to-work-menu',
          title: 'The menu, by job',
          content: (
            <>
              <p>The menu groups every page by the job it does. Your role decides which entries appear, and a group with none of your pages is left out.</p>
              <HelpDefs>
                <HelpDef term="Today">What is waiting on us. It sits alone at the top.</HelpDef>
                <HelpDef term="Customers"><strong>Clubs &amp; portals</strong>, <strong>People</strong>, <strong>Founding season</strong> (accounts on a free season) and <strong>Retention</strong>.</HelpDef>
                <HelpDef term="Health"><strong>Status</strong> (is the platform healthy right now), <strong>Errors</strong>, <strong>Feedback</strong> and <strong>Sent emails</strong> (Super admin, Support and Billing only).</HelpDef>
                <HelpDef term="Growth"><strong>Leads</strong>, <strong>Campaigns</strong> and <strong>Pitch decks</strong>.</HelpDef>
                <HelpDef term="Product"><strong>Plans &amp; pricing</strong>, <strong>Approval queue</strong>, <strong>Bulk changes</strong>, <strong>Email templates</strong> and <strong>Export registry</strong> (every way data leaves the product, read-only).</HelpDef>
                <HelpDef term="Records"><strong>Staff</strong> and the <strong>Audit log</strong>.</HelpDef>
                <HelpDef term="System"><strong>Dev tools</strong>, only where it is turned on.</HelpDef>
                <HelpDef term="Private finance"><strong>Bookkeeping</strong>, last, and only for the owner.</HelpDef>
              </HelpDefs>
              <p>An amber count beside an entry is how many items wait there, and a folded group shows the total of its rows. An eye beside an entry (<em>&ldquo;View-only for your role&rdquo;</em>) means you can open the page but cannot change anything on it. Click a group heading to fold or open it; the group you are on stays open.</p>
              <p>Looking for an old name? <strong>Overview</strong> is now Today, <strong>Organizations</strong> is Clubs &amp; portals, <strong>Customer users</strong> is People, <strong>Observability</strong> is Errors, <strong>Early access</strong> is Leads, <strong>Email campaigns</strong> is Campaigns, <strong>Bulk operations</strong> is Bulk changes and <strong>Platform users</strong> is Staff.</p>
            </>
          ),
        },
        {
          id: 'where-to-work-today',
          title: 'Today and Business numbers',
          content: (
            <>
              <p><strong>Today</strong> is the first page after sign-in: one table of what is waiting on us, grouped like the menu. Each row is a queue, why its items wait, and how many are waiting as an amber count. A row opens the list that clears it; a queue with nothing waiting folds into a quiet <em>Clear: &hellip;</em> line.</p>
              <ul>
                <li><strong>Customers:</strong> owner inactive (30 days), retention, missing owner, past due, trials ending and free time ending (both within 14 days).</li>
                <li><strong>Health:</strong> new errors and new feedback.</li>
                <li><strong>Growth:</strong> campaigns past due, campaigns due soon and new leads.</li>
                <li><strong>Product:</strong> the approval queue.</li>
              </ul>
              <p>Your role decides which queues you see. <em>Since your last visit</em> in the table&rsquo;s header marks what is new since you were last here. A health line above the table gives the worst verdict among the Status checks read from our own records and database (<em>Status: all fine.</em>, or how many to act on or look at) and a <strong>Status &rsaquo;</strong> door to the full page (see <em>How to read Status</em>).</p>
              <p>Under the table, a totals line gives clubs and portals, people, tournaments, teams and about how much a month at list price. Its last door opens <strong>Business numbers</strong> (it is not in the menu): tabs for <strong>Subscription</strong> (plan mix, status by plan, billing events), <strong>Growth</strong>, <strong>Usage</strong> and <strong>Metric notes</strong>.</p>
            </>
          ),
        },
        {
          id: 'where-to-work-find',
          title: 'Find: one box for any club or person',
          content: (
            <>
              <HelpSteps>
                <li>Press <strong>/</strong> from anywhere (unless you are typing in a field), or click the box in the middle of the top strip.</li>
                <li>With the box empty it shows <strong>Recent</strong>: the last five club or person records opened in this browser. Recent is kept in the browser only and is cleared when you sign out.</li>
                <li>Type two characters or more: an email, part of a name, a club&rsquo;s name, web name or owner&rsquo;s email. Results come in groups, up to eight each: <strong>Clubs</strong>, and <strong>People</strong> with each person&rsquo;s clubs beneath.</li>
                <li>Use the arrow keys to move, <strong>Enter</strong> to open, <strong>Esc</strong> to close.</li>
                <li>When a group has more than it shows, its last row (<strong>All N in Clubs &amp; portals</strong> or <strong>All N in People</strong>) opens that list with your words already in its search box. The words are handed over inside the tab and never put in the address.</li>
              </HelpSteps>
              <p>Super admin, Billing and Support also get a <strong>Stripe</strong> group for a customer (<code>cus_</code>), subscription (<code>sub_</code>) or family payment (<code>pi_</code>, <code>ch_</code>) number. It also takes a whole Stripe charge or payment number (<code>ch_</code>, <code>py_</code>, <code>pi_</code>), an invoice number (<code>in_</code>) and an invoice&rsquo;s printed number (like A1B2C3D4-0007). The result reads <em>Stripe charge ch_&hellip; &middot; $X &middot; date &middot; plan</em> or <em>Stripe invoice &hellip;</em>, and Enter opens the club&rsquo;s Money tab on that charge. <em>Nothing matches</em> also covers a number that is neither a family payment nor one of our clubs&rsquo; (a test-mode number is never found on the live site, or the reverse). Card digits are not searched &mdash; ask for the email on the receipt. Staff accounts are not customers and Find leaves them out. On a narrow screen the box is a magnifying glass in the strip; tap it and the strip turns into the box.</p>
            </>
          ),
        },
        {
          id: 'where-to-work-strip',
          title: 'The top strip, Help and the menu controls',
          content: (
            <>
              <p>The top strip carries the FieldLogicHQ name, <strong>Support console</strong>, Find, and the account menu: <strong>Appearance</strong> (Warm or Dark) and <strong>Sign out</strong>. Sign out lives only there. The console is warm by default and follows the Appearance setting you choose; the sign-in page (<strong>Staff access</strong>) is always warm.</p>
              <p><strong>Help</strong>, at the foot of the menu, opens inside the console, not in a new window. <strong>Collapse sidebar</strong>, the last row, folds the menu to a strip of icons. On a narrow screen the menu opens from the menu button in the top strip.</p>
            </>
          ),
        },
        {
          id: 'where-to-work-reasons',
          title: 'Every change keeps its reason',
          content: (
            <>
              <p>Every change to a club or a person opens one window. It says the change in one sentence, asks <strong>Why</strong> (required, up to 1,000 characters), and has one main button. The button is red when the change cannot be taken back from the screen &mdash; cancelling a subscription, releasing a web address, banning, deleting. A window that reaches an inbox says so in its sentence.</p>
              <p>The reason is kept with the change and shows in the Why column of the club&rsquo;s or person&rsquo;s Story; an older change that never kept one reads <em>Not recorded</em>. A note is its own reason, so a note window does not ask. A role without the power for an action sees no button for it &mdash; absent, never greyed out.</p>
            </>
          ),
        },
      ],
    },
    {
      id: 'who-can-do-what',
      group: 'Orientation',
      heading: 'Who can do what in the console',
      summary: 'Which role holds which power, so you know who to hand a request to.',
      keywords: ['roles', 'permissions', 'powers', 'super admin', 'support', 'billing', 'product', 'growth', 'read only', 'who can', 'view-only', 'eye', 'escalate', 'hand off'],
      searchText: 'who can do what roles powers super admin support billing product growth read only permissions club name web name notes make owner release own web address person actions reset link confirm email sign out everywhere ban edit plan limits overrides cancel subscription sections delete club delete person bulk changes retention errors triage feedback triage catalog growth staff records opened find stripe numbers run jobs billing no longer has support club and person powers status sent emails sent log reply by email reply to feedback who can reply',
      links: [
        { label: 'Staff', href: '/platform-admin/users' },
      ],
      content: (
        <>
          <p>What a role may do is written once, by power, and every page and every action checks it. Every role can open Today, Clubs &amp; portals, People and the Audit log and use Find. A role without a power sees no button for it.</p>
          <HelpDefs>
            <HelpDef term="A club's name, web name, notes, owner and own web address">Super admin and Support.</HelpDef>
            <HelpDef term="Act on a person (reset link, confirm email, sign out everywhere, ban, change email or name, notes)">Super admin and Support. Billing no longer holds this or the club power above.</HelpDef>
            <HelpDef term="A club's plan, limits, overrides, and cancelling its subscription">Super admin and Billing.</HelpDef>
            <HelpDef term="A club's sections (the add-on modules)">Super admin and Product.</HelpDef>
            <HelpDef term="Delete a club or a person">Super admin only.</HelpDef>
            <HelpDef term="Email the owner (opens your own mail)">Super admin, Support and Billing.</HelpDef>
            <HelpDef term="Bulk changes">Plan and status: Super admin and Billing. Sections: Super admin and Product.</HelpDef>
            <HelpDef term="Retention (extend, process)">Super admin and Billing.</HelpDef>
            <HelpDef term="Errors (resolve, ignore, snooze)">Super admin and Product.</HelpDef>
            <HelpDef term="Feedback (triage, escalate)">Super admin, Support, Billing and Product.</HelpDef>
            <HelpDef term="Reply to feedback by email">Super admin and Support. Billing and Product see no Reply button.</HelpDef>
            <HelpDef term="Status">Every role reads it.</HelpDef>
            <HelpDef term="Sent emails (the page, a person&rsquo;s Emails tab, Find&rsquo;s Sent emails group)">Super admin, Support and Billing. Product, Growth and Read only see none of it. Emails to a staff account show to Super admin only.</HelpDef>
            <HelpDef term="Plans &amp; pricing, Approval queue, Email templates (every write)">Super admin and Product. Billing can read Plans &amp; pricing and the Approval queue.</HelpDef>
            <HelpDef term="Leads, Campaigns, Pitch decks (every write)">Super admin, Product and Growth.</HelpDef>
            <HelpDef term="Staff and roles, and Records opened in the Audit log">Super admin only.</HelpDef>
            <HelpDef term="Find&rsquo;s Stripe numbers">Super admin, Billing and Support.</HelpDef>
          </HelpDefs>
        </>
      ),
    },
    {
      id: 'club-record',
      group: 'Support SOP',
      heading: 'How to read and change a club\'s record',
      summary: 'The four tabs of a club\'s record, the one pencil, the confirm window, and Put it back.',
      keywords: ['club record', 'organization record', 'org detail', 'story', 'money tab', 'access tab', 'people & tournaments', 'pencil', 'edit club', 'check mark', 'confirm window', 'why', 'reason', 'put it back', 'undo', 'web name', 'rename club', 'change plan', 'tournament limit', 'team limit', 'sections', 'billing', 'entitlements', 'support tab', 'activity', 'band', 'pays through stripe', 'plan changes in stripe', 'first purchase', 'made outside the console'],
      searchText: 'club pays through stripe so its plan changes there stripe still bills subscription not cancelled in stripe plan field replaced by one line bought a plan charged refunds in the story made outside the console club record organization detail story money access people and tournaments tabs one pencil edits the whole record check mark opens confirm window states every change in one sentence asks why reason required kept put it back undo plan change limits section turned on off running override end early never anything that reached stripe or an inbox newest plan entry still in force trial writes a new entry marked put back editing nothing changes until you press the check mark changes held name web name plan tournament limit team limit sections in the plan show more search the story type staff changes billing notes emails people feedback not recorded teams brought in add a note email the owner make owner release this address add an override cancel the subscription delete the club old record billing entitlements support activity',
      links: [
        { label: 'Clubs & portals', href: '/platform-admin/orgs' },
        { label: 'Audit log', href: '/platform-admin/audit' },
      ],
      content: (
        <p>A club&rsquo;s record reads first and edits whole: open it to read, press the pencil to change anything, and confirm once with a reason. Every change lands on the record&rsquo;s <strong>Story</strong>, and many can be put back from there.</p>
      ),
      subtopics: [
        {
          id: 'club-record-tabs',
          title: 'Open a record and read its tabs',
          content: (
            <>
              <p>Open a club from <strong>Find</strong>, from the <strong>Clubs &amp; portals</strong> list (search name, web name or web address, filter by plan or status, click a row), or from a queue on Today. Under the club&rsquo;s name a band shows <strong>Members</strong>, then <strong>Teams</strong> (Club plans) or <strong>Tournaments</strong>, the <strong>Free time</strong> running now, and when it <strong>Renews</strong> (or when its trial ends, or when it ended).</p>
              <HelpDefs>
                <HelpDef term="Story">Everything that happened to the club, newest first.</HelpDef>
                <HelpDef term="Money">Our record beside Stripe&rsquo;s live reading, the charges, and refunds for Billing and Super admin (see <em>How to read a club&rsquo;s Money tab and refund a charge</em>).</HelpDef>
                <HelpDef term="Access">Plan and limits, sections, free time and the club&rsquo;s own web address. <strong>Cancel the subscription</strong> and <strong>Delete the club</strong> end the tab.</HelpDef>
                <HelpDef term="People &amp; tournaments">Members (each opens that person&rsquo;s record), tournaments that are not archived, and <strong>Teams brought in</strong> when there are any.</HelpDef>
              </HelpDefs>
              <p>A link written for the old record still lands on the right tab: Billing opens Money; Entitlements and Support open Access; Activity opens Story.</p>
            </>
          ),
        },
        {
          id: 'club-record-story',
          title: 'Read the Story',
          content: (
            <>
              <p>The Story is one table with <strong>When</strong>, <strong>What happened</strong>, <strong>Who</strong> and <strong>Why</strong>. It joins staff changes, billing, notes, emails, people and feedback. Search its words, or narrow with the type dropdown: <strong>All types</strong>, <strong>Staff changes</strong>, <strong>Billing</strong>, <strong>Notes</strong>, <strong>Emails</strong>, <strong>People</strong>, <strong>Feedback</strong>. It opens on the newest 50 entries and <strong>Show more</strong> adds 50 each time.</p>
              <p>Billing entries also show first purchases (<em>Bought</em> a plan, with <em>Charged</em> the amount), Stripe&rsquo;s charges (<em>Charged</em> the amount for a plan and period, from Stripe, or <em>an invoice made in Stripe</em>, from Stripe&rsquo;s dashboard), refunds made in the console (who, why, <em>To the card it came from</em> and that the plan did not change) and refunds made in Stripe&rsquo;s dashboard (<em>Made outside the console</em>). Missed and recovered payments carry their detail. None of these has a Put it back. Money entries are shown to Super admin, Billing and Support only; if Stripe cannot be read, a line says so and our own entries, console refunds included, still show.</p>
              <p>Not in the Story yet: account emails such as password resets. The trail of records staff have opened is never shown on a customer&rsquo;s Story (see <em>How to investigate account changes</em>).</p>
            </>
          ),
        },
        {
          id: 'club-record-edit',
          title: 'Change a record with the one pencil',
          content: (
            <>
              <HelpSteps>
                <li>Click the pencil at the head of the record. The page reads <em>Editing. Nothing changes until you press the check mark and confirm.</em> The tabs step aside.</li>
                <li>Change the fields your role may change: <strong>Name</strong> and <strong>Web name</strong> (Support), <strong>Plan</strong>, <strong>Tournament limit</strong> and, on the two Club plans, <strong>Team limit</strong> (Billing), and <strong>Sections</strong> (Product). Anything you may not change reads as plain text.</li>
                <li>Press the check mark. With nothing changed it leaves without saving.</li>
                <li>The confirm window states every change in one sentence, ends with <em>The owner is not emailed</em>, and its foot says how many Story entries it writes and whether each can be put back.</li>
                <li>Type the reason in <strong>Why</strong>.</li>
                <li>Click <strong>Save changes</strong>.</li>
              </HelpSteps>
              <p>A club that Stripe still bills (a subscription not cancelled in Stripe, whatever its billing status) shows one line in place of the <strong>Plan</strong> and <strong>Tournament limit</strong> fields: <em>This club pays through Stripe, so its plan changes there. The owner moves plan on their Plan &amp; billing page, or cancel the subscription first. Changing it here would leave Stripe charging the old price.</em> A custom team limit still saves. If our record says live but Stripe has already ended the subscription (a missed update), the console asks Stripe and lets the change through.</p>
              <HelpNote variant="warning" title="A web name change moves the club's addresses">
                A link the customer already shared can stop working. Name and web name changes have no Put it back; change them back with another edit.
              </HelpNote>
            </>
          ),
        },
        {
          id: 'club-record-put-back',
          title: 'Put it back, and its limits',
          content: (
            <>
              <p><strong>Put it back</strong> sits at the right end of a Story entry and undoes it by writing a new entry (marked <em>Put back</em>) with its own reason; the original entry then reads <em>Put back at</em> the time. It is offered only where it puts the club back exactly:</p>
              <HelpDefs>
                <HelpDef term="A plan or limit change">Only the newest plan entry that is still in force, and never when a Stripe subscription or a trial is involved (it refuses with the same sentence as the pencil). Super admin and Billing.</HelpDef>
                <HelpDef term="A section turned on or off">Only the newest entry for that section, while the club is still as that entry left it. Super admin and Product.</HelpDef>
                <HelpDef term="Free time given or changed">Reads <strong>Put it back</strong> and ends the free time now (or restores the earlier last day, after a change of end date). Super admin and Billing.</HelpDef>
              </HelpDefs>
              <p>Nothing that reached Stripe or an inbox is ever put back &mdash; a cancelled subscription, an email, a released web address, a new owner. Where it cannot apply the button is absent, not greyed out.</p>
            </>
          ),
        },
        {
          id: 'club-record-doors',
          title: 'Where the other actions live',
          content: (
            <HelpDefs>
              <HelpDef term="Add a note, Email the owner">The head of the record. A note is staff-only and shows on the Story; Email the owner opens your own mail.</HelpDef>
              <HelpDef term="Make owner">The Members table on <strong>People &amp; tournaments</strong> (see <em>How to transfer organization ownership</em>).</HelpDef>
              <HelpDef term="Give free time">The Free time block of <strong>Access</strong> (see <em>How to temporarily override billing access</em>).</HelpDef>
              <HelpDef term="Release this address">The Own web address block of <strong>Access</strong>. It frees the name for anyone and cannot be put back.</HelpDef>
              <HelpDef term="Cancel the subscription, Delete the club">The end of <strong>Access</strong> (see <em>How to cancel a customer subscription</em> and <em>How to delete an organization</em>).</HelpDef>
            </HelpDefs>
          ),
        },
      ],
    },
    {
      id: 'club-money',
      group: 'Support SOP',
      heading: 'How to read a club\'s Money tab and refund a charge',
      summary: 'What Stripe says next to our record, how to tell a double charge from a look-alike, and how to refund a charge.',
      keywords: ['money tab', 'stripe', 'charge', 'charges', 'refund', 'refund a charge', 'charged twice', 'double charge', 'duplicate charge', 'duplicate', 'differs', 'stripe and our record', 'read again', 'open in stripe', 'next charge', 'paid last 12 months', 'show older charges', 'card on file', 'receipt', 'test mode', 'cannot refund', 'refused', 'no answer from stripe', 'disputed', 'two subscriptions', 'invoice', 'plan move', 'retry', 'coaches portal', 'billing status', 'cancelled', 'trial'],
      searchText: 'money tab read from stripe live when the tab opens nothing is kept super admin billing support see stripe product growth read only see our record only plan billing status renewal date stripe and our record agree charged twice two paid charges cover the same month minutes apart two live subscriptions cancel it in stripe then refund its charges here open it in stripe disagree on things read again read from stripe at paid last 12 months refunded next charge stripe preview the subscription our record stripe plan billing status renews trial ends ended free through founding season stripe subscription stripe customer email card on file not kept here visa ending 4242 differs clears at stripe next update tell the product team charges table when what it paid for card stripe says amount show older charges families payments club own money own stripe account never shown or refunded here charged twice the same month as the first of the two not a duplicate plan move part month then the renewal stripe tried again after the failure and it paid not the subscription one-off invoice made in stripe dashboard a charge made in stripe not by an invoice a coaches portal this club pays for bills on the clubs own stripe customer second live subscription patterns come from stripe invoices and periods never from amounts and times alone never paid us by card stripe could not be read another club shares this stripe customer test mode chip test payment no money moves refund this charge only super admin and billing support hands the charge on with its number charge window amount paid for card stripe says refunded so far stripe charge all of it all that is left part of it still refundable why required 500 characters never a card number this cannot be undone plan does not change subscription keeps running next charge is still card shows it in 5 to 10 business days stripe emails a receipt customer email no email no receipt is sent red refund button goes to stripe at once you belong to this club member pending invite coach on one of its teams owner or billing owner of a coaches portal the club pays for your email is the owners or the stripe customers email another billing or super admin can public demo club disputed not paid fully refunded older than 6 months a super admin can refund it sixth refund in 24 hours someone else refunding this charge right now stripe refuses already refunded more than is left no money moved the attempt is in the audit log it changed since you opened it only can still be refunded no answer from stripe may or may not have gone through opening the charge checks with stripe never offers a second refund until it knows our record could not be written not sent to stripe money only goes back to the card it came from credits and other refunds stay in stripe dashboard customers get stripes own receipt email we send none',
      links: [
        { label: 'Clubs & portals', href: '/platform-admin/orgs' },
        { label: 'Audit log', href: '/platform-admin/audit' },
      ],
      content: (
        <p>The <strong>Money</strong> tab of a club&rsquo;s record reads Stripe live, sets it beside our record, and, for Billing and Super admin, lets you refund a charge. Nothing it reads from Stripe is kept.</p>
      ),
      subtopics: [
        {
          id: 'club-money-reads',
          title: 'What the Money tab shows',
          content: (
            <>
              <p>The tab reads Stripe each time it opens and says <em>Read from Stripe at</em> the time. <strong>Super admin</strong>, <strong>Billing</strong> and <strong>Support</strong> see Stripe&rsquo;s side. <strong>Product</strong>, <strong>Growth</strong> and <strong>Read only</strong> see our record only (plan, billing status and renewal date) and one line saying so.</p>
              <HelpDefs>
                <HelpDef term="The first line">One sentence about the whole picture: <em>Stripe and our record agree</em>; <em>Charged twice for</em> a month; <em>Stripe has two live subscriptions for this club</em> (with <strong>Open it in Stripe</strong>); or <em>Stripe and our record disagree on N things</em>, naming them. <strong>Read again</strong> reads Stripe once more.</HelpDef>
                <HelpDef term="The band"><strong>Paid, last 12 months</strong>, <strong>Refunded</strong> and <strong>Next charge</strong> (Stripe&rsquo;s own preview of it).</HelpDef>
                <HelpDef term="The subscription">Two columns, <strong>Our record</strong> and <strong>Stripe</strong>: Plan, Billing status, Renews (or Trial ends, or Ended), <strong>Free through</strong> (ours only, while free time or a Founding Season runs), Stripe subscription, Stripe customer with the email and <strong>Open in Stripe</strong>, and Card on file (<em>Not kept here</em> on our side).</HelpDef>
                <HelpDef term="Charges">When, What it paid for, Card, Stripe says, Amount, and a <strong>&rsaquo;</strong> that opens the charge. <strong>Show older charges</strong> reads the 12 months before. A line under the table says families&rsquo; payments are the club&rsquo;s own money on its own Stripe account and are never shown or refunded here.</HelpDef>
              </HelpDefs>
            </>
          ),
        },
        {
          id: 'club-money-differs',
          title: 'When Stripe and our record differ',
          content: (
            <>
              <p>A row where the two columns disagree is marked <strong>Differs</strong>. Click it for what it means: nothing here changes our record, and it usually clears at Stripe&rsquo;s next update. If it is still there the next day, tell the product team.</p>
              <HelpDefs>
                <HelpDef term="Never paid by card">The tab says <em>This club has never paid us by card</em> and shows our record only.</HelpDef>
                <HelpDef term="Stripe could not be read">Our record shows, with one line saying so and <strong>Read again</strong>.</HelpDef>
                <HelpDef term="Another club shares the Stripe customer">Nothing is shown and nothing can be refunded. Tell the product team.</HelpDef>
                <HelpDef term="Test mode">On a development or staging server a <strong>Test mode</strong> chip says <em>Test payment: no money moves</em>.</HelpDef>
              </HelpDefs>
            </>
          ),
        },
        {
          id: 'club-money-patterns',
          title: 'Charged twice? The five patterns',
          content: (
            <>
              <p>Two charges close together are not always a double charge. The tab names what it finds under each charge, working from Stripe&rsquo;s invoices and billing periods, never from amounts and times alone.</p>
              <HelpDefs>
                <HelpDef term="Charged twice">Two paid charges cover the same month. The later one reads <em>Charged twice: the same month as the</em> earlier charge, with <strong>Refund the later one</strong> for Billing and Super admin; the earlier reads <em>The first of the two</em>.</HelpDef>
                <HelpDef term="A plan move">Reads <em>Not a duplicate: a plan move&rsquo;s part month, then the</em> renewal.</HelpDef>
                <HelpDef term="A retry that paid">Reads <em>Not a duplicate: Stripe tried again after the</em> failure <em>and it paid</em>.</HelpDef>
                <HelpDef term="Not the subscription&rsquo;s">Reads <em>a one-off invoice made in Stripe&rsquo;s dashboard</em> or <em>a charge made in Stripe, not by an invoice</em>.</HelpDef>
                <HelpDef term="A Coaches Portal the club pays for">Reads <em>Not a duplicate: a Coaches Portal this club pays for</em>. Such a portal bills on the club&rsquo;s own Stripe customer.</HelpDef>
              </HelpDefs>
              <HelpNote variant="warning" title="Two live subscriptions">
                A charge from a second live subscription is named too. Cancel the extra subscription in Stripe first (the first line has the door), then refund its charges here.
              </HelpNote>
            </>
          ),
        },
        {
          id: 'club-money-refund',
          title: 'Refunding a charge',
          content: (
            <>
              <HelpSteps>
                <li>Click the charge&rsquo;s row. The charge window reads first: Amount, Paid for, Card, Stripe says, <strong>Refunded so far</strong> (who and when), and the Stripe charge with <strong>Open in Stripe</strong>.</li>
                <li>Click <strong>Refund this charge</strong>. Only Super admin and Billing see it. Support sees <em>Refunds are made by Billing or a Super admin. Hand this charge on with its number.</em></li>
                <li>Choose <strong>All of it</strong> (or <strong>All that is left</strong>), or <strong>Part of it</strong> and type the amount; the window says how much is still refundable.</li>
                <li>Type <strong>Why</strong>. It is required, up to 500 characters, and must never hold a card number; the server refuses one.</li>
                <li>Read the sentence: the amount, the card it goes to (such as <em>the Visa ending 4242</em>), <em>This cannot be undone</em>, that the plan does not change and the subscription keeps running, that the next charge is still on its date, that the card usually shows it in 5 to 10 business days, and that Stripe emails a receipt to the customer (or has no email, so none is sent).</li>
                <li>Click the red <strong>Refund</strong> button. It goes to Stripe at once.</li>
              </HelpSteps>
              <p>Money only goes back to the card it came from. Credits and other refunds stay in Stripe&rsquo;s dashboard. The customer gets Stripe&rsquo;s own receipt email; we send none. The refund lands on the club&rsquo;s Story and in the Audit log.</p>
            </>
          ),
        },
        {
          id: 'club-money-refused',
          title: 'When a refund can\'t be made',
          content: (
            <>
              <p>Before you click, the button is absent and one line says why:</p>
              <HelpDefs>
                <HelpDef term="Your own club"><em>You belong to this club, so you cannot refund its charges. Another Billing or Super admin can.</em> Belonging is wide: a member, a pending invite, a coach on one of its teams, an owner or billing owner of a Coaches Portal the club pays for, or your email is the owner&rsquo;s or the Stripe customer&rsquo;s email.</HelpDef>
                <HelpDef term="The charge itself">A public demo club; a disputed charge; a charge that is not paid; a charge already fully refunded.</HelpDef>
                <HelpDef term="Billing only">A charge older than 6 months (<em>A Super admin can refund it</em>), or a sixth refund by you in 24 hours.</HelpDef>
                <HelpDef term="Someone else is refunding">The line names who and when. Wait, then open the charge again.</HelpDef>
              </HelpDefs>
              <p>After the click, the window tells you what happened:</p>
              <HelpDefs>
                <HelpDef term="Stripe refuses">Already refunded, disputed, or more than is left. It reads <em>No money moved</em>, and the attempt is in the Audit log.</HelpDef>
                <HelpDef term="The amount changed">It reads <em>Only $X can still be refunded: it changed since you opened it</em>. Read the charge again.</HelpDef>
                <HelpDef term="No answer from Stripe"><em>The refund may or may not have gone through.</em> Opening the charge checks with Stripe, and it never offers a second refund until it knows.</HelpDef>
                <HelpDef term="Our record could not be written"><em>Not sent to Stripe. No money moved.</em> Try again.</HelpDef>
              </HelpDefs>
            </>
          ),
        },
      ],
      faqs: [
        {
          id: 'faq-charged-twice',
          question: 'A customer says they were charged twice. What do I do?',
          answer: (
            <p>Open the club&rsquo;s <strong>Money</strong> tab and read the first line and the note under each charge. If it says <em>Charged twice</em>, Billing or a Super admin can use <strong>Refund the later one</strong>; Support hands the charge number on. If the notes say <em>Not a duplicate</em> (a plan move, a retry that paid, a one-off invoice or a Coaches Portal), explain which and do not refund.</p>
          ),
          answerText: 'Open the club Money tab and read the first line and the note under each charge. If it says Charged twice, Billing or a Super admin can use Refund the later one; Support hands the charge number on. If the notes say Not a duplicate (a plan move, a retry that paid, a one-off invoice or a Coaches Portal), explain which and do not refund.',
          keywords: ['double charge', 'duplicate', 'charged twice', 'refund the later one'],
          popular: true,
        },
        {
          id: 'faq-cannot-refund',
          question: 'Why can\'t I refund this charge?',
          answer: (
            <p>The button is absent and a line says why: the role (Support cannot refund), your own club (you belong to it in any way), a demo club, a disputed, unpaid or fully refunded charge, a charge older than 6 months (Billing; a Super admin can), your sixth refund in 24 hours (Billing), or someone else refunding it right now. See <em>When a refund can&rsquo;t be made</em>.</p>
          ),
          answerText: 'The button is absent and a line says why: the role (Support cannot refund), your own club (you belong to it in any way), a demo club, a disputed, unpaid or fully refunded charge, a charge older than 6 months (Billing; a Super admin can), your sixth refund in 24 hours (Billing), or someone else refunding it right now.',
          keywords: ['refund button missing', 'cannot refund', 'refused', 'you belong to this club'],
        },
        {
          id: 'faq-refund-no-answer',
          question: 'The refund window said Stripe did not answer. Did the money move?',
          answer: (
            <p>It may or may not have. Do not try again from memory: open the charge. That checks with Stripe, and the console never offers a second refund until it knows. The check is kept in the Audit log as <em>Refund checked with Stripe</em>.</p>
          ),
          answerText: 'It may or may not have. Do not try again from memory: open the charge. That checks with Stripe, and the console never offers a second refund until it knows. The check is kept in the Audit log as Refund checked with Stripe.',
          keywords: ['no answer from stripe', 'refund may or may not have gone through', 'timeout'],
        },
      ],
    },
    {
      id: 'reset-password',
      group: 'Support SOP',
      heading: 'How to reset a customer password',
      summary: 'Send a password reset link to the customer from their person record.',
      keywords: ['password', 'reset', 'login', 'people', 'customer users', 'reset email', 'recovery link', 'forgot password', 'send a reset link', 'person record'],
      searchText: 'how do i reset a password customer cannot login send a reset link to customer people person record reset email sent recovery link forgot password why required cannot be taken back the link works once',
      links: [
        { label: 'People', href: '/platform-admin/customer-users' },
        { label: 'Customer login help', href: '/platform-admin/help/org' },
      ],
      content: (
        <>
          <HelpSteps>
            <li>Press <strong>/</strong> and find the person by email or name, or go to <strong>People</strong> and search there.</li>
            <li>Open their record and confirm you have the right person: the <strong>Clubs</strong> tab shows which clubs they belong to, and the band shows when they last signed in.</li>
            <li>Click <strong>Send a reset link</strong> at the head of the record.</li>
            <li>The window says the link goes to that email and cannot be taken back. Type the reason in <strong>Why</strong> and click <strong>Send the link</strong>.</li>
            <li>You will see <strong>&ldquo;A reset link went to&hellip;&rdquo;</strong>. No link is shown to you, and there is nothing to copy or forward.</li>
            <li>Tell the customer to check their inbox and open the email to set a new password. Do not set or ask for the customer&apos;s password.</li>
          </HelpSteps>
          <p>The link works once. If the customer doesn&apos;t receive it, check the email on the record (the pencil corrects a wrong address) and/or have them press <strong>Forgot your password?</strong> on the sign-in page, which sends the same kind of link (<strong>Send me a reset link</strong>, then the email&rsquo;s <strong>Reset my password</strong>, then <strong>Save password</strong>). The action is audit-logged with your reason. Super admin and Support see the button.</p>
          <p>If the customer belongs to multiple clubs, resetting the password affects the same login across all of their FieldLogicHQ memberships.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-reset-link-expiry',
          question: 'How long does the emailed reset link last?',
          answer: (
            <p>One hour, and the reset email says so. An expired or already-used link opens the forgot-password page with an amber notice (&ldquo;That link has expired or was already used. Request a new one below.&rdquo;), where the customer can ask for a new one themselves; or send a new reset from the person record.</p>
          ),
          answerText: 'One hour, and the reset email says so. An expired or already-used link opens the forgot-password page with a notice that it expired or was already used, where the customer can request a new one; or send a new reset from the person record.',
          keywords: ['expire', 'expiry', 'reset link', 'reset email', '1 hour', 'one hour', 'already used', 'request a new one'],
          popular: true,
        },
        {
          id: 'faq-reset-unknown-email',
          question: 'What if the email on the account is wrong or missing?',
          answer: (
            <p>The reset link goes to the email on the record, so correct it first. Click the pencil on the person record, fix the email, press the check mark and confirm with a reason; the new address is marked confirmed, nobody is emailed, and they sign in with it from then on. Confirm the right address with the customer before sending the reset link.</p>
          ),
          answerText: 'The reset link goes to the email on the record, so correct it first with the pencil on the person record, press the check mark, and confirm with a reason. The new address is marked confirmed and nobody is emailed. Confirm the right address with the customer, then send the reset link.',
          keywords: ['unknown email', 'missing email', 'wrong email', 'change email'],
        },
      ],
    },
    {
      id: 'manage-customer-user-access',
      group: 'Support SOP',
      heading: 'How to manage a customer user\'s access and details',
      summary: 'Find a person in People, read their record, and ban, unban, sign out, confirm email, edit details, or add a note.',
      keywords: ['people', 'customer users', 'person record', 'ban user', 'unban', 'lift the ban', 'revoke sessions', 'sign out everywhere', 'sign out', 'confirm email', 'verify email', 'edit user', 'change email', 'display name', 'user notes', 'add a note', 'lock account', 'suspend', 'unconfirmed', 'paging', 'search people', 'actions menu'],
      searchText: 'people list searched and paged on the server no 1,000 cap search email name or club two characters filter everyone active unconfirmed banned page prev next export person record story clubs account tabs band clubs last signed in account created send a reset link add a note pencil edit name email check mark confirm the email sign out everywhere ban this person lift the ban delete this person each asks why reason staff accounts left out customer users actions menu moved to the person record live portals',
      links: [
        { label: 'People', href: '/platform-admin/customer-users' },
      ],
      content: (
        <p><strong>People</strong> lists every customer account; a person&rsquo;s actions live on their own record, not in a menu on the list. Confirm you have the right person before acting &mdash; each action affects the user&apos;s single FieldLogicHQ login across all of their club memberships.</p>
      ),
      subtopics: [
        {
          id: 'manage-user-list',
          title: 'Find someone in People',
          content: (
            <>
              <p>People is searched and paged on the server, so there is no 1,000-account cap. Type two characters or more in <strong>Search email, name or club</strong>; the list updates a beat after you stop typing, and one character is not a search yet. The dropdown beside it filters sign-in: <strong>Everyone</strong>, <strong>Active</strong>, <strong>Unconfirmed</strong> (to find every account that never confirmed its email) or <strong>Banned</strong>. Fifty people show at a time; <strong>Prev</strong> and <strong>Next</strong> move between pages. <strong>Export</strong> saves the rows on the page.</p>
              <p>Each row shows the person, their sign-in state, when they last signed in, and their clubs with role and plan; a <strong>&#9888; N live portals</strong> chip marks an account that owns more than one live Premium Coaches Portal. Click a row to open the person&rsquo;s record. Staff accounts are left out of this list &mdash; they are on <strong>Staff</strong>.</p>
            </>
          ),
        },
        {
          id: 'manage-user-record',
          title: 'Read a person\'s record',
          content: (
            <>
              <p>The record is titled with the person&rsquo;s email and a chip: <strong>Email confirmed</strong>, <strong>Email not confirmed</strong> or <strong>Banned</strong>. A band shows how many <strong>Clubs</strong> they belong to, when they <strong>Last signed in</strong> (only the last sign-in is kept) and when the <strong>Account created</strong>.</p>
              <HelpDefs>
                <HelpDef term="Story">What has happened to the account, newest first, with the same Who and Why columns as a club&rsquo;s.</HelpDef>
                <HelpDef term="Clubs">Each club with the person&rsquo;s role, its status and its plan; the name opens the club&rsquo;s record.</HelpDef>
                <HelpDef term="Account">Email, name, how they sign in, whether the email is confirmed (with <strong>Confirm the email</strong> beside <em>Not yet</em>), and at the end the rare doors.</HelpDef>
              </HelpDefs>
            </>
          ),
        },
        {
          id: 'manage-user-actions',
          title: 'What you can do on a person\'s record',
          content: (
            <>
              <HelpDefs>
                <HelpDef term="Send a reset link">At the head of the record (see <em>How to reset a customer password</em>).</HelpDef>
                <HelpDef term="Add a note">At the head of the record. Staff see it on the Story; the person never does. Use it for person-specific history; a club&rsquo;s own notes stay on the club.</HelpDef>
                <HelpDef term="Pencil (name and email)">Change the name or email, press the check mark, and confirm with a reason. A new email is marked confirmed and they sign in with it from then on; the old one stops working. Nobody is emailed. Confirm the new address with the customer first.</HelpDef>
                <HelpDef term="Confirm the email">On the Account tab, only while the email is not confirmed. It confirms the address as if they had clicked the link in their welcome email, so verify you are speaking with the real account holder first.</HelpDef>
                <HelpDef term="Sign out everywhere">Signs them out on every device without banning them; they sign in again next time. Use it after a suspected compromise.</HelpDef>
                <HelpDef term="Ban this person / Lift the ban">Blocks sign-in until lifted. Their clubs and data stay as they are. Use it for abuse, fraud or a security hold.</HelpDef>
                <HelpDef term="Delete this person">Permanent; see <em>How to delete a user</em>.</HelpDef>
              </HelpDefs>
              <p>Each action opens a window that asks <strong>Why</strong> and is audit-logged. Super admin and Support see these controls; delete is Super admin only.</p>
            </>
          ),
        },
      ],
      faqs: [
        {
          id: 'faq-ban-vs-revoke',
          question: 'Should I ban the user or just sign them out everywhere?',
          answer: (
            <p>Sign them out everywhere when you only need to end their sessions &mdash; for example a lost device &mdash; because they can sign back in afterward. Ban when they should not be able to sign in at all until you lift it. Neither action deletes any data.</p>
          ),
          answerText: 'Sign out everywhere ends their sessions but they can sign back in. Ban blocks sign-in entirely until lifted. Neither deletes data.',
          keywords: ['ban vs revoke', 'sign out', 'sign out everywhere', 'revoke sessions', 'block login'],
          popular: true,
        },
        {
          id: 'faq-confirm-email-safe',
          question: 'Is it safe to use Confirm the email for a customer who never received the confirmation email?',
          answer: (
            <p>Yes, once you have verified you are speaking with the real account holder. Confirming marks the address as confirmed so they can continue. If you cannot verify their identity, have them get a fresh link themselves: <strong>Send the link again</strong> is on the screen they saw after signing up, and under the amber &ldquo;Confirm your email first&rdquo; notice sign-in shows them. A link older than an hour opens sign-in with an expired-link notice and <strong>Email me a new link</strong>. Either way, an account that came to start a team, a league or an organization finds it waiting on its Home, under <strong>Workspaces</strong> and marked <strong>Not named yet</strong> (a Coach Premium setup is marked <strong>Setup not finished</strong>), until it does.</p>
          ),
          answerText: 'Yes, after verifying you are speaking with the real account holder: use Confirm the email on the Account tab of the person record. Otherwise have them press Send the link again, on the screen they saw after signing up or under the Confirm your email first notice on sign-in. A link older than an hour opens sign-in with an expired-link notice and Email me a new link. Either way, an account that came to start a team, a league or an organization finds it waiting on its Home, under Workspaces and marked Not named yet (a Coach Premium setup is marked Setup not finished), until it does.',
          keywords: ['confirm email', 'confirm the email', 'verification', 'unconfirmed', 'send the link again', 'sign in resend', 'confirm your email first', 'email me a new link', 'expired link', 'not named yet', 'finish creating your team', 'setup not finished', 'run a tournament', 'create account', 'create team'],
        },
      ],
    },
    {
      id: 'billing-overrides',
      group: 'Billing SOP',
      heading: 'How to temporarily override billing access',
      summary: 'Give a club free time: a whole plan, sections or a billing status, free through a last day you choose.',
      keywords: ['free time', 'give free time', 'free through', 'change the end date', 'end it now', 'billing', 'override', 'subscription status', 'grace period', 'past due', 'active', 'access tab', 'comped', 'trial exception', 'money', 'end early', 'put it back', 'free time ending'],
      searchText: 'how do i give a club free time free through last free day a whole plan tournament plus club club association sections billing status reads active while unpaid grace period support window override billing requirements customer unsubscribed expired trial access tab free time block give free time change the end date end it now reason why put it back story free time list everyone founding season given by staff today free time ending 14 days super admin twelve months billing six months longer needs a super admin refused switched off on this server you belong to the club coaches portal public demo club comp period no longer given paying through stripe already has free time',
      links: [
        { label: 'Clubs & portals', href: '/platform-admin/orgs' },
        { label: 'Bulk changes', href: '/platform-admin/bulk-operations' },
      ],
      content: (
        <>
          <p>Free time lets the customer keep access, or use more of the product, for a defined support reason without rewriting their base billing record. The club is treated as being on what you give until the <strong>last free day</strong>, then goes back to its own plan by itself. Nothing is charged, nothing is deleted, and the owner is not emailed. Giving, changing and ending free time is a Super admin and Billing action.</p>
          <HelpSteps>
            <li>Open the club (press <strong>/</strong> and find it), then open the <strong>Access</strong> tab.</li>
            <li>In the <strong>Free time</strong> block, click <strong>Give free time</strong>.</li>
            <li>Choose <strong>What</strong> to give (below), then its plan or sections.</li>
            <li>Pick <strong>Free through</strong>, the last free day. It ends at the end of that day, Eastern time. Use the shortest reasonable period.</li>
            <li>Type a <strong>Why</strong> that would make sense to another employee reading the Story later.</li>
            <li>Read the sentence above the buttons, then click <strong>Give free time</strong>. It shows on the Story, and a note there is the place for the customer-facing context and follow-up date.</li>
          </HelpSteps>
          <HelpDefs>
            <HelpDef term="A whole plan">Tournament Plus, Club or Club &middot; Association. Every part of the product treats the club as on that plan, and its Plan &amp; billing page says &ldquo;Free through&rdquo; the last day. It must be above the club&rsquo;s own plan.</HelpDef>
            <HelpDef term="Sections">One or more sections the club&rsquo;s plan does not include. Only sections the plan does not already include are offered.</HelpDef>
            <HelpDef term="Billing status">The club reads as active while unpaid, to keep it open. ⚠ <strong>This genuinely changes what the customer can reach</strong> &mdash; it is not a display flag.</HelpDef>
          </HelpDefs>
          <HelpDefs>
            <HelpDef term="How long you can give">A Super admin can give up to 12 months from today; Billing up to 6. The calendar greys out later days, and longer needs a Super admin.</HelpDef>
            <HelpDef term="Change the end date">On a running row of the Free time block. Pick a new last free day. If someone else changed it while your window was open, you are told who and to what, and nothing is changed.</HelpDef>
            <HelpDef term="End it now">On the same row. The club goes back to its own plan at once, with a reason. Put it back on the Story opens the same window.</HelpDef>
          </HelpDefs>
          <p>Ended free time stays in the Story, not on the Access tab. Free time that is about to run out appears on Today under <strong>Free time ending</strong> (the last 14 days, counted by club), and <strong>Free time</strong> in the menu lists every club with free time running in three views: <strong>Everyone</strong>, <strong>Founding Season</strong> and <strong>Given by staff</strong>. The list only reads; changes are made on the club&rsquo;s record.</p>
          <HelpNote variant="info" title="When the door is a sentence instead of a button">Free time can&rsquo;t be given when it is switched off on this server, when you belong to that club in any way (a member, an invite, a team coach, a Coaches Portal it pays for, or your email is its owner&rsquo;s or Stripe customer&rsquo;s; another staff member can), when the club is a Coaches Portal, or when it is a public demo club. A plan can&rsquo;t be given while Stripe charges the club for a plan, when the club already has a plan given as free time (change its end date instead), or when it is already on the top plan; sections and billing status can still be given. A comp period is no longer given from the console: it never gave a club anything.</HelpNote>
          <p>Changing the base plan or tournament limit is a separate flow: the pencil on the record, confirmed with a reason (see <em>How to read and change a club&rsquo;s record</em>). Use it only when the customer&apos;s actual package should change.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-override-vs-plan-change',
          question: 'Should I use an override or change the base plan?',
          answer: (
            <p>Use an override for temporary access exceptions. Change the base plan only when the customer&apos;s contracted package is actually changing. Base plan changes affect limits and may normalize billing fields, especially when moving to the free Tournament plan.</p>
          ),
          answerText: 'Use overrides for temporary access exceptions. Change the base plan only when the contracted package is changing.',
          keywords: ['plan change', 'base plan', 'subscription'],
          popular: true,
        },
      ],
    },
    {
      id: 'module-access',
      group: 'Product SOP',
      heading: 'How to provide module access for an unsubscribed account',
      summary: 'Turn a section on for one club without changing the plan feature matrix.',
      keywords: ['module', 'addon', 'add-on', 'entitlement', 'section', 'sections', 'unsubscribed', 'house league', 'rep teams', 'accounting', 'public site', 'access tab', 'pencil'],
      searchText: 'how do i provide access to modules for unsubscribed override billing requirements enable addon module access house league rep teams accounting public site sections in the plan pencil check mark confirm save changes feature access timed override access tab put it back super admin product',
      links: [
        { label: 'Clubs & portals', href: '/platform-admin/orgs' },
        { label: 'Plans & pricing', href: '/platform-admin/plans-pricing' },
        { label: 'Bulk changes', href: '/platform-admin/bulk-operations' },
      ],
      content: (
        <>
          <p>Section changes are for account-specific exceptions: pilots, implementation support, make-good access, or a sales-approved temporary enablement. They do not change the global plan feature matrix. Turning a section on or off is a Super admin and Product action.</p>
          <HelpSteps>
            <li>Confirm who approved the exception and how long it should last. A section turned on with the pencil has no end date of its own, so the follow-up note matters.</li>
            <li>Open the club and click the pencil at the head of the record.</li>
            <li>Under <strong>Sections</strong>, tick the section the plan does not normally include: House league, Rep teams, Accounting or Public site. A section the plan already includes reads <em>in the plan</em>.</li>
            <li>Press the check mark, type the reason in <strong>Why</strong>, and click <strong>Save changes</strong>.</li>
            <li>Add a note with the module, approval source, expected end date, and customer-facing reason.</li>
            <li>Ask the customer to refresh their admin shell. The module should appear in their navigation if their role also has the relevant capability.</li>
          </HelpSteps>
          <p>For a section with an end date, use an override of kind <strong>Feature access (timed)</strong> on the Access tab instead. If the customer needs the account to remain usable while unpaid or past due, pair the section with the right status override. Section access and billing status are separate controls.</p>
          <p>To remove the exception, use the pencil to untick the section, or press <strong>Put it back</strong> on its Story entry. For many clubs, use <strong>Bulk changes</strong> with <strong>Module add-on</strong>.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-module-not-visible',
          question: 'The module is enabled but the customer still cannot see it. What should I check?',
          answer: (
            <p>Check both access layers: the club must have the section through its plan or a section change, and the signed-in member must have a role or capability that allows that module. Ask the customer to refresh after changes.</p>
          ),
          answerText: 'Check the club section access and the member role/capability. The customer should refresh after changes.',
          keywords: ['not visible', 'capability', 'role', 'refresh'],
          popular: true,
        },
      ],
    },
    {
      id: 'feedback-triage',
      group: 'Support SOP',
      heading: 'How to triage customer feedback',
      summary: 'Work the in-app feedback queue, triage an item on its own page, reply to the customer by email, and flag items for product.',
      keywords: ['feedback', 'errors', 'triage', 'bug report', 'feature request', 'escalate', 'escalation', 'related issue', 'support queue', 'reply', 'reply by email', 'answer a customer', 'feedback record', 'conversation', 'severity', 'state', 'acknowledged', 'replied', 'no reply button', 'not confirmed'],
      searchText: 'how do i triage customer feedback bug reports feature requests move new triaged acknowledged resolved escalate to product view related issue error group flag for product feedback record page open a row pencil check mark triage card state severity escalated triaged by the conversation the issue it hit reply by email reply button from fieldlogichq support replies reach the admin inbox signed with first name plain text their message quoted cannot be taken back moves to acknowledged send reply try again not confirmed someone replied while you were writing send mine too too long to retry thirty replies a day no reply button anonymous deleted account address changed unconfirmed locked older than 90 days replied column',
      links: [
        { label: 'Feedback', href: '/platform-admin/feedback' },
        { label: 'Errors', href: '/platform-admin/observability' },
      ],
      content: (
        <p><strong>Feedback</strong> collects bug reports, feature requests, and general feedback submitted from inside the app &mdash; admin, coach, volunteer, and anonymous public users. Work it like a queue, oldest-actionable first: open an item, triage it, and answer the customer from the same page.</p>
      ),
      subtopics: [
        {
          id: 'feedback-triage-queue',
          title: 'Work the queue',
          content: (
            <>
              <HelpSteps>
                <li>Open <strong>Feedback</strong>. It opens on the <strong>New</strong> state so you see what is unworked. Use the <strong>Type</strong>, <strong>Category</strong> and <strong>Status</strong> filters to narrow; choose <strong>All statuses</strong> to widen back out, or <strong>Escalated</strong> to see what is flagged for product.</li>
                <li>The list reads <strong>Date</strong>, <strong>Type</strong>, <strong>Category</strong>, <strong>Org</strong>, <strong>From</strong>, <strong>Title</strong>, <strong>Status</strong> and <strong>Replied</strong> (when a reply last went out, if one did). Click any row to open that item&rsquo;s own page.</li>
                <li>On the page, read <strong>The conversation</strong>: the customer&rsquo;s words, then any replies sent from here. For a bug, the card <strong>The issue it hit</strong> has an <strong>Open the issue &rsaquo;</strong> door to the matching error group on Errors.</li>
                <li>If a bug has no such card, no captured error was matched automatically. Note the club and the time, then search Errors by route and club around that moment.</li>
              </HelpSteps>
              <p>Times on both pages are in the console&rsquo;s own clock, for example <em>9:15 a.m.</em> Export the filtered list (XLSX or CSV) when you need a snapshot for a report.</p>
            </>
          ),
        },
        {
          id: 'feedback-triage-record',
          title: 'Triage one item',
          content: (
            <>
              <p>The <strong>Triage</strong> card on the item&rsquo;s page shows its <strong>State</strong>, <strong>Severity</strong>, <strong>Escalated</strong> and <strong>Triaged by</strong>. Roles that may triage see a pencil in the page header; the page reads first and edits only when you ask.</p>
              <HelpSteps>
                <li>Click the pencil. State, Severity and Escalated become fields, and nothing changes until you confirm.</li>
                <li>Set the <strong>State</strong>: <strong>New &rarr; Triaged &rarr; Acknowledged &rarr; Resolved</strong>. Triaged means you have read and sorted it; Acknowledged means the customer has had a response or the item is queued for work; Resolved means it is done or won&rsquo;t-do.</li>
                <li>Set the <strong>Severity</strong> (Critical, Error, Warning or Info) if it helps. A severity, once set, cannot be cleared.</li>
                <li>Choose <strong>Yes, to the product team</strong> under <strong>Escalated</strong> when product needs to act, or <strong>No</strong> to clear the flag.</li>
                <li>Click the check mark. A window states the change in one sentence and ends <em>Nobody is emailed</em>; press <strong>Save changes</strong>. The &times; beside the check mark drops your edits instead.</li>
              </HelpSteps>
              <HelpNote variant="info" title="Escalating tells nobody">
                <p>Escalated only stamps a badge on the item and adds it to the <em>Escalated</em> filter. It sends no notification and assigns no one, so pair it with your normal product hand-off.</p>
              </HelpNote>
              <p>Every change is kept in the audit log with your email and the time. The error group behind a bug is a separate surface: resolving it on Errors is Super admin and Product only (see <em>How to use the Errors page and resolve error groups</em>).</p>
            </>
          ),
        },
        {
          id: 'feedback-reply',
          title: 'Reply to the customer by email',
          content: (
            <>
              <p>Super admin and Support see a <strong>Reply</strong> button in the header of an item&rsquo;s page when the customer can be reached. Billing and Product have no Reply button at all.</p>
              <HelpSteps>
                <li>Click <strong>Reply</strong>. The window is titled with the customer&rsquo;s name and says <em>This sends an email to &hellip; It cannot be taken back.</em> You never type an address &mdash; the page uses the address on the account behind the feedback.</li>
                <li>Check the three lines under the sentence: <strong>From</strong> (FieldLogicHQ support), <strong>Replies go to</strong> (the admin inbox) and <strong>Subject</strong> (<em>Re:</em> and the item&rsquo;s title).</li>
                <li>Write your <strong>Message</strong>, up to 4,000 characters. It goes as plain text, signed with your first name and FieldLogicHQ support, with the customer&rsquo;s own message quoted below yours.</li>
                <li>Click <strong>Send reply</strong>. It sends at once. When the item was New or Triaged, the sentence also says it moves to Acknowledged, and it does; an item already Acknowledged or Resolved keeps its state.</li>
              </HelpSteps>
              <p>The reply then appears in <strong>The conversation</strong> with a word for what happened to it (<em>Sent</em>, <em>Delivered</em>, <em>Bounced</em> and so on; see <em>How to check whether an email reached someone</em>). You may send up to 30 replies in 24 hours.</p>
              <HelpNote variant="warning" title="The customer&rsquo;s answer does not come back here">
                <p>A customer who answers your email reaches the admin inbox, not the console. Read it there; the conversation on the page shows only what you sent.</p>
              </HelpNote>
            </>
          ),
        },
        {
          id: 'feedback-reply-trouble',
          title: 'When Reply is missing or does not go through',
          content: (
            <>
              <p>Where a role may reply but this item cannot be answered, one line of words stands in the Reply button&rsquo;s place instead of a greyed-out one.</p>
              <HelpDefs>
                <HelpDef term="Sent without signing in">There is no address to reply to. Triage it as usual.</HelpDef>
                <HelpDef term="The account no longer exists, is locked, or its address is not confirmed">No address to reply to. Answer from the admin inbox if it still matters.</HelpDef>
                <HelpDef term="Their address changed after they wrote">Check who they are, then answer from the admin inbox.</HelpDef>
                <HelpDef term="Older than 90 days">Too old to reply from here. Answer from the admin inbox if it still matters.</HelpDef>
              </HelpDefs>
              <p>Once the window is open, it can stop in a few ways. Each says what to do:</p>
              <HelpDefs>
                <HelpDef term="The mail service did not take it">Nothing was sent. Your message is kept; press <strong>Try again</strong> in a minute.</HelpDef>
                <HelpDef term="We did not hear back from the mail service">The window turns amber and says <em>It will not send twice.</em> Trying again within a day is safe: it sends the same words and the mail service sends them at most once. The reply shows as <em>Not confirmed</em> in the conversation until the mail service reports.</HelpDef>
                <HelpDef term="Too long to retry safely">More than a day has passed. Check the conversation, then send a new reply.</HelpDef>
                <HelpDef term="Someone replied while you were writing">The window shows their reply. <strong>Cancel</strong> returns to your words, kept, so you can read and adjust; <strong>Send mine too</strong> sends yours as a new reply.</HelpDef>
                <HelpDef term="You have sent 30 replies in the last 24 hours">The most one person may send. Answer from the admin inbox.</HelpDef>
              </HelpDefs>
            </>
          ),
        },
      ],
      faqs: [
        {
          id: 'faq-feedback-escalate-notify',
          question: 'Does escalating a feedback item notify the product team?',
          answer: (
            <p>No. Escalate only sets an <strong>Escalated</strong> badge and adds the item to the <em>Escalated</em> filter so product can find it. There is no email, alert, or assignment. Always pair an escalation with your normal product hand-off.</p>
          ),
          answerText: 'No. Escalate only sets a badge and adds the item to the Escalated filter — no notification or assignment. Pair it with your normal product hand-off.',
          keywords: ['escalate notify', 'escalation alert', 'flag for product'],
          popular: true,
        },
        {
          id: 'faq-feedback-no-linked-error',
          question: 'A bug report has no linked error. How do I find the error?',
          answer: (
            <p>No <code>requestId</code> was captured for that submission, so it could not be auto-correlated and the item shows no <strong>The issue it hit</strong> card. Open <strong>Errors</strong> and search by the bug&apos;s route and org slug around the time the feedback was submitted to find the matching error group manually.</p>
          ),
          answerText: 'No requestId was captured, so there is no The issue it hit card. Search Errors by route and org slug around the submission time to find the error group manually.',
          keywords: ['no linked error', 'correlate manually', 'request id'],
        },
        {
          id: 'faq-feedback-no-reply-button',
          question: 'There is no Reply button on a feedback item. Why?',
          answer: (
            <p>Either your role has no Reply (only Super admin and Support do), or this item cannot be answered from here: it was sent without signing in, the account is gone, locked or unconfirmed, the address changed, or it is older than 90 days. In the second case a line under the title says which, and the answer goes from the admin inbox instead.</p>
          ),
          answerText: 'Only Super admin and Support can reply. An item cannot be answered from here if it was sent without signing in, the account is deleted, locked or unconfirmed, the address changed, or it is over 90 days old. A line under the title says which; answer from the admin inbox instead.',
          keywords: ['no reply button', 'cannot reply', 'reply missing', 'anonymous feedback', 'old feedback'],
          popular: true,
        },
        {
          id: 'faq-feedback-reply-twice',
          question: 'Did my reply send twice, or not at all?',
          answer: (
            <p>It does not send twice. If the window said <em>We did not hear back from the mail service</em>, press <strong>Try again</strong>: the same words go under the same number, and the mail service sends them at most once. Within a day that is safe. After a day the window says <em>Too long to retry safely</em>, so read the conversation and send a new reply if it never arrived.</p>
          ),
          answerText: 'A reply never sends twice. If you did not hear back from the mail service, press Try again within a day: the same words go under the same number and send at most once. After a day, read the conversation and send a new reply if it never arrived.',
          keywords: ['reply sent twice', 'not confirmed', 'try again', 'duplicate reply', 'retry'],
        },
      ],
    },
    {
      id: 'observability-triage',
      group: 'Support SOP',
      heading: 'How to use the Errors page and resolve error groups',
      summary: 'Read the Errors page (once called Observability), open an error group, and resolve, ignore, or snooze it.',
      keywords: ['errors', 'observability', 'error tracking', 'error group', 'issue', 'who an error hit', 'a staff account', 'nobody signed in', 'samples', 'resolve', 'ignore', 'snooze', 'stack trace', 'error rate', 'time window', 'last 24h', 'last 7d', 'last 30d'],
      searchText: 'how do i use the errors page observability dashboard error tracking error groups issues resolve ignore snooze reopen stack trace error rate freshness affected orgs time window dropdown last 24h last 7d last 30d environment production dev samples table who club source status code who an error hit a staff account only super admin nobody signed in no longer has an account could not read this account error rate counts api calls only',
      links: [
        { label: 'Errors', href: '/platform-admin/observability' },
        { label: 'Feedback', href: '/platform-admin/feedback' },
      ],
      content: (
        <p><strong>Errors</strong> (once called Observability) is the in-house error console. Each row is one distinct error fingerprint — a flood of identical failures collapses into a single triable <em>issue</em>, so the list stays workable.</p>
      ),
      subtopics: [
        {
          id: 'observability-read',
          title: 'Read the dashboard',
          content: (
            <>
        <p>The Errors page opens on a row of metric cards above the issue list, and shows only the environment you are on.</p>
        <ul>
          <li>The top metric cards show errors in the selected window, error rate (from instrumented routes only), open issues, and affected orgs. Pick the time window (<strong>Last 24h</strong>, <strong>Last 7d</strong>, or <strong>Last 30d</strong>) from the dropdown in the page header. The dashboard shows the errors of the environment you are on (production on the live site, dev on the dev site); there is no environment switch.</li>
          <li>The <strong>freshness chip</strong> reports when the rollup job last ran. A green chip is healthy; an amber chip (&ldquo;job error&rdquo; / &ldquo;sweep stale&rdquo;) or &ldquo;Rollup has not run yet&rdquo; means the data is stale and the cron job needs attention — flag it to engineering rather than trusting the counts.</li>
          <li>The issue list opens on <strong>Open</strong> by default. Search by title, error, or route, and filter by severity, status, route, or org slug. Export (XLSX/CSV) carries the active filters.</li>
          <li>A line under the cards says the error rate counts API calls only. Errors on pages and in browsers appear in the captured errors but have no call count to divide by, so they are not in the rate.</li>
        </ul>
            </>
          ),
        },
        {
          id: 'observability-issue',
          title: 'Open an issue',
          content: (
            <>
            <p>Open an issue to read its detail: route and HTTP method, occurrence count, affected orgs, first/last seen, a 14-day occurrence sparkline, scrubbed sample events (stack trace and request context, redacted), and any <strong>related feedback</strong> matched by request ID. The samples are a table of <strong>When</strong>, <strong>Who</strong>, <strong>Club</strong>, <strong>Source</strong> and the status code; click a row for its window.</p>
            </>
          ),
        },
        {
          id: 'observability-who-hit',
          title: 'Who an error hit',
          content: (
            <>
              <p>The <strong>Who</strong> and <strong>Club</strong> columns tell you which customer to look at. Who reads one of six ways:</p>
              <HelpDefs>
                <HelpDef term="A name">A customer account. The name links to their person record when your role opens People; under it are their address and role.</HelpDef>
                <HelpDef term="A staff account">The error hit a staff member. Only Super admin sees the name and opens the record; other roles see these words and no link.</HelpDef>
                <HelpDef term="No longer has an account">The account was deleted. The address stored with the error is shown as plain text.</HelpDef>
                <HelpDef term="An address only">Only an address was kept. It is plain text, with no link.</HelpDef>
                <HelpDef term="Nobody signed in">A public page, or a browser error before sign-in.</HelpDef>
                <HelpDef term="Could not read this account">The sign-in records could not be read just now. Open the issue again in a minute.</HelpDef>
              </HelpDefs>
              <p>The <strong>Club</strong> column names the club, linked to its record, or reads <em>None</em>. Times on Errors are in the console clock, for example <em>9:15 a.m.</em></p>
            </>
          ),
        },
        {
          id: 'observability-status',
          title: 'Resolve, ignore, snooze or reopen',
          content: (
            <>
            <p>Triage an open issue with the status controls:</p>
            <ul>
              <li><strong>Resolve</strong> — the error is fixed or understood and closed. Records who resolved it and when.</li>
              <li><strong>Ignore</strong> — known noise you do not intend to fix (third-party, expected client error). It drops out of the open queue.</li>
              <li><strong>Snooze</strong> — temporarily hide a known issue for 24 hours, 3 days, or 7 days; it returns to the open queue when the snooze expires.</li>
              <li><strong>Reopen</strong> — bring a resolved/ignored/snoozed issue back to open if it recurs.</li>
            </ul>
            <p>Every transition is audit-logged. There is no confirmation modal — changes apply immediately, but every status is reversible.</p>
            </>
          ),
        },
        {
          id: 'observability-who',
          title: 'Who can triage',
          content: (
            <>
            <p><strong>Permission boundary:</strong> error-group triage (Resolve / Ignore / Snooze / Reopen) is <strong>product and super admin only</strong> — this is engineering signal. Support can <em>view</em> the dashboard and issues but the controls are disabled with a <em>&ldquo;View-only for your role&rdquo;</em> note. To get a bug actioned, triage it from <strong>Feedback</strong> and escalate to product (see <em>How to triage customer feedback</em>).</p>
            </>
          ),
        },
      ],
      faqs: [
        {
          id: 'faq-obs-resolve-vs-snooze',
          question: 'Should I resolve, ignore, or snooze an issue?',
          answer: (
            <p><strong>Resolve</strong> when the error is fixed or closed for good. <strong>Ignore</strong> for known noise you will never fix. <strong>Snooze</strong> for a known issue you want out of the queue temporarily — it comes back when the snooze expires. Any status can be reopened.</p>
          ),
          answerText: 'Resolve = fixed/closed. Ignore = permanent known noise. Snooze = temporary hide that returns to the queue on expiry. Any status can be reopened.',
          keywords: ['resolve', 'ignore', 'snooze', 'difference'],
          popular: true,
        },
        {
          id: 'faq-obs-readonly',
          question: 'The Resolve/Ignore/Snooze buttons are disabled. Why?',
          answer: (
            <p>Error-group triage is product and super admin only. Your role can view the dashboard but not change error-group status — the controls show <em>&ldquo;View-only for your role.&rdquo;</em> Triage the underlying bug from Feedback and escalate it to product instead.</p>
          ),
          answerText: 'Error-group triage is product/super admin only. View-only roles see disabled controls — triage the bug from Feedback and escalate to product.',
          keywords: ['disabled', 'view only', 'read only', 'permission'],
        },
      ],
    },
    {
      id: 'status-page',
      group: 'Support SOP',
      heading: 'How to read Status',
      summary: 'Is the platform healthy right now: the thirteen checks, their four verdicts, and what to do about each.',
      keywords: ['status', 'health', 'platform health', 'is the site up', 'verdict', 'fine', 'look at it', 'act now', 'not checked', 'read again', 'read at', 'build failed', 'production build', 'staging build', 'staging site', 'database', 'connections', 'scheduled jobs', 'gateway errors', 'traffic', 'error rate', 'amplify', 'supabase', 'no key', 'health line'],
      searchText: 'how do i read status is the platform healthy right now health status page every role thirteen checks three bands the sites the app the database verdicts fine look at it act now not checked reading read at read again refresh symbol on a phone shared reading thirty seconds amber read minutes ago what it says what to do read from production build failed staging build staging site slow errors higher than usual error rate traffic counts up to date database answers connections scheduled jobs database services gateway errors staging database this site has no key for amplify supabase refused our key did not answer within 5 seconds tell the owner tell the developer not judged week over week trends database advisors agent tooling owner morning check today health line status all fine',
      links: [
        { label: 'Status', href: '/platform-admin/status' },
        { label: 'Errors', href: '/platform-admin/observability' },
      ],
      content: (
        <p><strong>Status</strong> answers one question &mdash; is the platform healthy right now &mdash; in one table. It is the first page under <strong>Health</strong>, and every role can read it. It is a reading, not a record: it shows what is true as the page opens, and it never changes anything.</p>
      ),
      subtopics: [
        {
          id: 'status-page-read',
          title: 'Read the page',
          content: (
            <>
              <HelpSteps>
                <li>Open <strong>Health &rsaquo; Status</strong>. A chip beside the title names the site you are on (Production or Staging).</li>
                <li>Read the line at the top first. It is either <em>All fine.</em> or a count (<em>1 to act on now, 2 to look at</em>), with one sentence on the worst problem and a door to it (<strong>Errors &rsaquo;</strong> or <strong>Open the issue &rsaquo;</strong>).</li>
                <li>Below it, the table reads <strong>Check</strong>, <strong>Verdict</strong>, <strong>What it says</strong>, <strong>What to do</strong> and <strong>Read from</strong>, in three bands: <strong>The sites</strong> (production build, staging build, staging site), <strong>The app</strong> (errors, error rate, traffic, counts up to date) and <strong>The database</strong> (database answers, connections, scheduled jobs, database services, gateway errors, staging database). A Fine check leaves <em>What to do</em> blank.</li>
                <li>The header says <strong>Read at 8:14 a.m.</strong> Press <strong>Read again</strong> for a fresh reading; on a phone that button is the refresh symbol. The time turns amber and reads <em>Read N minutes ago</em> once the page has been open more than ten minutes.</li>
              </HelpSteps>
              <p>On a phone each check is a card with its verdict, its sentence and what to do; the <em>Read from</em> column is left off. The foot of the page says what is not judged here: week-over-week trends, database advisors and agent tooling stay in the owner&rsquo;s morning check, so an all-fine Status is not the whole story of the stack.</p>
            </>
          ),
        },
        {
          id: 'status-page-verdicts',
          title: 'The four verdicts',
          content: (
            <>
              <HelpDefs>
                <HelpDef term="Fine">Nothing to do.</HelpDef>
                <HelpDef term="Look at it">Worth a look soon. The sentence says what was found and the next column says what to do (for example, open Errors, or tell the developer).</HelpDef>
                <HelpDef term="Act now">Something customers can feel. A failed production build is one; a failed staging build is only Look at it.</HelpDef>
                <HelpDef term="Not checked">The reading could not be taken. It is never shown as Fine, and the top line counts it (<em>2 not checked</em>) in amber.</HelpDef>
              </HelpDefs>
              <p>Counts on the app side are judged against a usual hour or a usual day, so a quiet site is not flagged for being small, and a busy one is not flagged for being busy. Staging problems never rise above Look at it.</p>
            </>
          ),
        },
        {
          id: 'status-page-unchecked',
          title: 'When a check says Not checked',
          content: (
            <>
              <p>The sentence says why, and it never repeats the provider&rsquo;s own words.</p>
              <HelpDefs>
                <HelpDef term="This site has no key for Amplify (or Supabase)">The console has not been given the key for that provider yet, so that line cannot be read. It is an owner step: tell the owner, and the line stays Not checked until it is done.</HelpDef>
                <HelpDef term="Amplify (or Supabase) refused our key or token">The key may have expired or been removed. Tell the owner it needs replacing.</HelpDef>
                <HelpDef term="Did not answer within 5 seconds">Press Read again in a minute.</HelpDef>
              </HelpDefs>
              <HelpNote variant="info" title="Read again may show the same reading">
                <p>Our own records and the database are read every time. The outside providers (Amplify, the staging site, Supabase) are read once for all staff at most every 30 seconds, so a second press inside that time shows the same reading.</p>
              </HelpNote>
            </>
          ),
        },
        {
          id: 'status-page-today',
          title: 'Status on Today',
          content: (
            <>
              <p>The health line above the table on <strong>Today</strong> shows the worst verdict among the checks read from our own records and database, with a <strong>Status &rsaquo;</strong> door. It says <em>Builds and database services are read when Status opens</em>, because those are not part of the line: an all-fine line on Today does not mean the builds passed. Open Status for the whole reading.</p>
            </>
          ),
        },
      ],
      faqs: [
        {
          id: 'faq-status-not-checked',
          question: 'A Status line says "This site has no key". Is something broken?',
          answer: (
            <p>No. That line has not been given its provider key on this site yet, so it reads <strong>Not checked</strong> rather than guessing. Tell the owner; every other check still works.</p>
          ),
          answerText: 'No. The line has not been given its provider key on this site yet, so it reads Not checked rather than guessing. Tell the owner; every other check still works.',
          keywords: ['no key', 'not checked', 'amplify key', 'supabase token'],
          popular: true,
        },
        {
          id: 'faq-status-all-fine',
          question: 'Status says all fine. Can I tell a customer everything is working?',
          answer: (
            <p>It means every check Status makes passed. It does not judge week-over-week trends, database advisors or agent tooling, which stay in the owner&rsquo;s morning check, and it cannot see one customer&rsquo;s own problem. If the customer has a specific failure, look at Errors for their club.</p>
          ),
          answerText: 'It means every check Status makes passed. It does not judge trends, database advisors or agent tooling, and it cannot see one customer problem. Look at Errors for their club.',
          keywords: ['all fine', 'everything working', 'not judged'],
        },
      ],
    },
    {
      id: 'sent-emails',
      group: 'Support SOP',
      heading: 'How to check whether an email reached someone',
      summary: 'Find an account email we sent, see what happened to it, and know what to tell the customer.',
      keywords: ['sent emails', 'email log', 'email did not arrive', 'never got the email', 'reset email', 'confirmation email', 'invite', 'bounced', 'delivered', 'delayed', 'marked as spam', 'not sent', 'failed', 'not confirmed', 'emails tab', 'mail service', 'spam folder', 'no account'],
      searchText: 'how do i check whether an email reached someone sent emails health sent emails page a persons emails tab finds sent emails group customer says they never got the reset link confirmation link sign in link invitation reply to their feedback registration email what happened sent delivered delayed bounced marked as spam not sent failed not confirmed the mail service number what to do the email itself is not kept search by whole email address filter by what happened last 90 days 200 searches a day recording started nothing before family emails are in the clubs families emails staff accounts super admin only address does not exist mailbox full refused by server suppressed',
      links: [
        { label: 'Sent emails', href: '/platform-admin/sent-emails' },
        { label: 'People', href: '/platform-admin/customer-users' },
      ],
      content: (
        <p>When a customer says an email never came, the <strong>sent-email log</strong> shows whether we sent it and what the mail service says happened to it. Super admin, Support and Billing can read it; for every other role the entry, the tab and the Find group are absent.</p>
      ),
      subtopics: [
        {
          id: 'sent-emails-where',
          title: 'Where to look',
          content: (
            <>
              <HelpDefs>
                <HelpDef term="A person's Emails tab">Open the person (Find or <strong>People</strong>) and click <strong>Emails</strong>. Newest first, with the count on the tab. A person with nothing recorded reads <em>No emails recorded for this person.</em></HelpDef>
                <HelpDef term="Health › Sent emails">Every recorded email, newest first. Search by a <strong>whole</strong> email address (half an address waits and does not search), filter by <strong>what happened</strong>, and page through with Prev and Next. The chip reads <em>Last 90 days</em>.</HelpDef>
                <HelpDef term="Find">Paste a whole address that no account owns and Find adds a <strong>Sent emails</strong> group; its row opens that email&rsquo;s window. An address that has an account is found as a person instead.</HelpDef>
                <HelpDef term="The person's Story">Sign-up and sign-in links, password reset and email confirmation links, team sign-in links, invitations and replies to their feedback also appear as rows in the Story.</HelpDef>
              </HelpDefs>
              <p>Browsing the page is free. Each search by address counts against a limit of 200 a day per person; at the limit the page says so, and it resets within 24 hours.</p>
            </>
          ),
        },
        {
          id: 'sent-emails-window',
          title: 'Open one email',
          content: (
            <>
              <p>Click a row to open its window. It shows <strong>To</strong> (with <em>no account</em> where nobody owns the address), <strong>Club</strong>, <strong>Asked for by</strong> (when a person set the email going), <strong>Email</strong> (what kind it was), and <strong>Mail service number</strong> (the number to quote if the mail service itself has to be asked).</p>
              <p>Under <strong>What happened</strong> is a timeline in time order. A bounce, a spam report or a refusal also puts a red line at the top saying what happened, and a <strong>What to do</strong> line says the next step. The foot reads <em>The email itself is not kept</em>: you see that it went and what became of it, never its words.</p>
            </>
          ),
        },
        {
          id: 'sent-emails-words',
          title: 'What the words mean',
          content: (
            <>
              <HelpDefs>
                <HelpDef term="Sent">Handed to the mail service. No word back yet; usually within a minute.</HelpDef>
                <HelpDef term="Delivered">Their mail server accepted it. It may be in spam. We do not know if it was opened.</HelpDef>
                <HelpDef term="Delayed">Their mail server is slow to accept it. The mail service keeps trying.</HelpDef>
                <HelpDef term="Bounced">Refused for good: the address does not exist, or will not take mail. The red line says which (address does not exist, mailbox full, mail server refused it).</HelpDef>
                <HelpDef term="Marked as spam">The person reported it as spam. The mail service stops sending to them.</HelpDef>
                <HelpDef term="Not sent">Not sent at all: this address bounced or reported spam before.</HelpDef>
                <HelpDef term="Failed">The mail service could not send it. Send it again from where it was first sent; if it fails again, tell the developer.</HelpDef>
                <HelpDef term="Not confirmed">We did not hear back when we sent it. The mail service&rsquo;s own word will settle it, usually within the hour.</HelpDef>
              </HelpDefs>
            </>
          ),
        },
        {
          id: 'sent-emails-limits',
          title: 'What is and is not in the log',
          content: (
            <>
              <ul>
                <li>Only account and tournament-registration emails are recorded: sign-up and sign-in links, resets, confirmations, invitations, access and billing notices, the feedback receipt and replies, and registration emails.</li>
                <li>Emails a club sends to its families are not here; they are in that club&rsquo;s own <strong>Families &rsaquo; Emails</strong>.</li>
                <li>Recording started at its release. An email sent before then cannot be checked, and a search that finds nothing says so: <em>Nothing was sent to this address in the last 90 days.</em> Check the spelling with the customer first.</li>
                <li>Emails are kept 90 days.</li>
                <li>Emails to a staff account show to Super admin only.</li>
              </ul>
            </>
          ),
        },
      ],
      faqs: [
        {
          id: 'faq-sent-delivered-not-found',
          question: 'The log says Delivered but the customer cannot find the email. What now?',
          answer: (
            <p>Delivered means their mail server accepted it, not that it reached the inbox or was opened. Ask them to check spam, junk and promotions folders, and to search for <strong>FieldLogicHQ</strong>. If it is not there, send a fresh reset or invitation from the record and watch the new row.</p>
          ),
          answerText: 'Delivered means their mail server accepted it, not that it reached the inbox or was opened. Ask them to check spam, junk and promotions folders. If it is not there, send a fresh reset or invitation and watch the new row.',
          keywords: ['delivered but not received', 'check spam', 'cannot find email', 'junk folder'],
          popular: true,
        },
        {
          id: 'faq-sent-no-emails-tab',
          question: 'There is no Emails tab or Sent emails entry for me. Why?',
          answer: (
            <p>The sent-email log is for Super admin, Support and Billing. Product, Growth and Read only roles see no entry, no tab and no Find group &mdash; absent, not greyed out. Ask a colleague with access to look, or ask a Super admin about your role.</p>
          ),
          answerText: 'The sent-email log is for Super admin, Support and Billing. Other roles see no entry, tab or Find group. Ask a colleague with access.',
          keywords: ['no emails tab', 'no sent emails', 'missing', 'permission'],
        },
      ],
    },
    {
      id: 'org-ownership-transfer',
      group: 'Support SOP',
      heading: 'How to transfer organization ownership',
      summary: 'Reassign an organization to a new owner — for example when the current owner has left the company.',
      keywords: ['transfer ownership', 'make owner', 'owner left', 'reassign owner', 'change owner', 'new owner', 'demote owner', 'people & tournaments', 'members'],
      searchText: 'owner left the company transfer organization ownership reassign make owner change account owner demote current owner promote member to owner people and tournaments members table why required',
      links: [
        { label: 'Clubs & portals', href: '/platform-admin/orgs' },
        { label: 'Audit log', href: '/platform-admin/audit' },
      ],
      content: (
        <>
          <p>Use this when an account needs a different owner — most often when the current owner has left the company and another existing member should take over. The new owner must already be an <strong>active member</strong> of the organization. Making an owner is a Super admin and Support action.</p>
          <HelpSteps>
            <li>Open the club and open the <strong>People &amp; tournaments</strong> tab. The <strong>Members</strong> table lists everyone.</li>
            <li>Find the member who should become the owner. If they are not listed, have them invited into the org and accept first — <strong>Make owner</strong> appears only on active members who are not already owners.</li>
            <li>Click <strong>Make owner</strong> on that member&apos;s row.</li>
            <li>The window says the person becomes the owner and every current owner becomes an admin. Type the reason in <strong>Why</strong>.</li>
            <li>Click <strong>Make owner</strong>. The change shows on the club&rsquo;s Story as <em>Owner changed</em>.</li>
            <li>Add a note on the record recording who requested the change and why.</li>
          </HelpSteps>
          <p>The change cannot be put back from the Story &mdash; to undo it, make the previous owner the owner again. This is different from <em>Teams brought in</em> on the same tab, the record of coaches&apos; own teams moved into a club (see <em>Teams brought into a club</em>).</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-org-transfer-no-member',
          question: 'The intended new owner is not a member of the org yet. What do I do?',
          answer: (
            <p>Make owner only appears for existing active members. The new owner must first be invited to the organization and accept, or otherwise be added as an active member, before you can transfer ownership to them. Do not delete the departing owner until a new owner is in place.</p>
          ),
          answerText: 'Make owner only appears for existing active members. Invite or add the new owner first, then transfer. Do not delete the old owner until a new owner exists.',
          keywords: ['not a member', 'no member', 'invite owner'],
          popular: true,
        },
      ],
    },
    {
      id: 'team-ownership-transfer',
      group: 'Support SOP',
      heading: 'Teams brought into a club (no operator step)',
      summary: 'A coach’s own team moves into a club when the second side says yes. Support keeps a read-only record, and one thing can need your hand: a Stripe cancel that failed.',
      keywords: ['coaches portal ownership transfer', 'team brought in', 'bring in a coach team', 'join a club', 'org owned team', 'rep teams', 'stripe cancel failed'],
      searchText: 'team brought into a club coaches portal ownership transfer no operator step second yes moves the team read only record people and tournaments tab teams brought in stripe cancellation failed cancel by hand errors page error dashboard org owned rep team',
      links: [
        { label: 'Clubs & portals', href: '/platform-admin/orgs' },
        { label: 'Audit log', href: '/platform-admin/audit' },
      ],
      content: (
        <>
          <p>Since Club Tier Stage 2 (2026-09-29) a coach&apos;s own team moves into a club on its own: the club asks and the coach approves, or the other way round, and the second yes moves the whole team, its staff included. There is no <strong>Complete Transfer</strong> button any more.</p>
          <ol>
            <li>Open the club from <strong>Clubs &amp; portals</strong> and open <strong>People &amp; tournaments</strong>. <strong>Teams brought in</strong> lists each request with where it stands: waiting on the coach, waiting on the club, or moved.</li>
            <li>After a move the coach&apos;s own subscription is cancelled automatically. If Stripe refused, the Errors page shows <em>Team moved into a club, but the coach&apos;s own subscription was not cancelled</em>, naming the subscription — cancel it by hand in Stripe, immediately, the way the move would have.</li>
            <li>The club&apos;s and the coach&apos;s audit logs both carry <code>team_moved_into_club</code>, with what moved.</li>
          </ol>
        </>
      ),
      faqs: [
        {
          id: 'faq-team-transfer-retry',
          question: 'What if a move fails?',
          answer: (
            <p>The move runs as one database transaction: if it fails, both organizations stay exactly as they were and the person approving sees why (the club is at its team limit, the coach&apos;s own tournament is still open). A taken team address is not a failure — the team takes the next free one, ending in -2.</p>
          ),
          answerText: 'The move is one transaction: a failure leaves both organizations as they were, and the approver sees why. A taken team address takes the next free one.',
          keywords: ['retry', 'failed transfer', 'duplicate slug'],
        },
      ],
    },
    {
      id: 'team-launch-readiness',
      group: 'Launch SOP',
      heading: 'How to verify Premium Coaches Portal launch readiness',
      summary: 'Confirm Stripe prices, readiness checks, manual smokes, and customer-facing help before Premium launch.',
      keywords: ['coaches portal premium launch', 'stripe prices', 'readiness', 'coach checkout', 'club capacity bands', 'club association band'],
      searchText: 'coaches portal premium launch readiness Stripe price IDs sandbox live direct checkout Club capacity bands Club Association band retired org billed extra team per-team add-on cancellation past due mobile coach portal help documentation',
      links: [
        { label: 'Dev tools', href: '/platform-admin/dev-tools' },
        { label: 'Plans & pricing', href: '/platform-admin/plans-pricing' },
      ],
      content: (
        <>
          <p>Use this before opening Premium Coaches Portal self-serve checkout or supporting the first external Premium customers.</p>
          <ol>
            <li>Confirm Stripe has sandbox and live recurring prices for direct Premium Coaches Portal at <strong>$29 CAD monthly</strong> and <strong>$290 CAD annual/seasonal</strong>.</li>
            <li>Confirm Stripe has sandbox and live recurring prices for the two <strong>Club capacity bands</strong> — Club and Club&nbsp;·&nbsp;Association — each monthly and annual (Club Repackaging, 2026-06-22).</li>
            <li><strong>Retired:</strong> the org-billed &quot;$19/team&quot; Coaches Portal takeover and the &quot;Club extra rep team&quot; ($19/$190) add-on are gone — do not create or reuse those price IDs. A Club subscription includes the whole coaching staff up to its band cap, with no per-team fee.</li>
            <li>Paste each <code>price_...</code> ID into the matching Test (sandbox) or Production (live) row in <strong>Plans &amp; pricing</strong>; the <strong>Stripe mode</strong> dropdown switches between the two.</li>
            <li>Run <strong>Dev tools &gt; Coaches Portal Checkout Readiness</strong> and resolve any missing app URL, webhook secret, Premium gate, or price-row failures.</li>
            <li>Complete manual sandbox smokes for direct Coaches Portal checkout, tournament-claim checkout, cancellation or past-due simulation, and Club / Club&nbsp;·&nbsp;Association band checkout.</li>
            <li>Ask the product owner to visually check the public pricing page, Coaches Portal signup page, and mobile Coaches Portal flows.</li>
          </ol>
          <p>Customer-facing help should explain Premium Coaches Portal, season rollover, the one free-tier local tournament slot, bringing a coach’s own team into a club, and the difference between direct Premium and Club included teams.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-team-launch-missing-price',
          question: 'What if a Coaches Portal checkout readiness row reports a missing price?',
          answer: (
            <p>Create or confirm the Stripe price in the correct Stripe environment, paste the new <code>price_...</code> ID into the matching FieldLogicHQ price row, then rerun the readiness check before testing checkout.</p>
          ),
          answerText: 'Create or confirm the Stripe price, paste the price ID into the matching price row, and rerun readiness before testing checkout.',
          keywords: ['missing price', 'readiness', 'Stripe price'],
          popular: true,
        },
      ],
    },
    {
      id: 'bulk-operations',
      group: 'Billing & Product SOP',
      heading: 'How to run guarded bulk changes',
      summary: 'Apply billing or product exceptions to multiple accounts with preview, reason, confirmation, and audit logging.',
      keywords: ['bulk changes', 'bulk operations', 'bulk', 'comp period', 'plan change', 'module addon', 'subscription status', 'select filtered', 'review bulk operation', 'confirm bulk operation', 'billing status override', 'free through', 'skipped', 'succeeded', 'failed', 'you belong to this club', 'pays through stripe'],
      searchText: 'guarded bulk changes billing status override free through last day billing up to 6 months super admin 12 months skipped you belong to this club succeeded failed skipped results plan change skips a club stripe still bills this club pays through stripe so its plan changes there',
      links: [
        { label: 'Bulk changes', href: '/platform-admin/bulk-operations' },
        { label: 'Audit log', href: '/platform-admin/audit' },
      ],
      content: (
        <>
          <p><strong>Bulk changes</strong> are intentionally guarded. Use them only when the same approved action should apply to multiple accounts.</p>
          <ol>
            <li>Go to <strong>Bulk changes</strong> and filter by account name, slug, plan, or subscription status.</li>
            <li>Select individual accounts or use <strong>Select filtered</strong> after reviewing the filtered list.</li>
            <li>Choose the action &mdash; Billing status override, Comp period grant, Plan change, or Module add-on &mdash; and set the target value. A billing status override needs <strong>Free through</strong>, the last day (Billing up to 6 months, Super admin up to 12). Comp periods require an expiration date. Module add-ons require enable or remove.</li>
            <li>Enter a clear reason. This reason appears in the batch record and audit log.</li>
            <li>Review the preview panel, click <strong>Review bulk operation</strong>, then click <strong>Confirm bulk operation</strong>.</li>
            <li>Review the result list and recent bulk operation table for failures or skipped accounts.</li>
          </ol>
          <p>Billing actions require billing access. Module add-on actions require product access. A super admin can perform both. On each club&rsquo;s Story a change from here reads <em>From Bulk changes</em>.</p>
          <p>The result list shows each club as succeeded, failed or skipped. A club you belong to is skipped (<em>Skipped: you belong to this club&hellip;</em>). A plan change skips a club that Stripe still bills, with the same sentence the pencil shows: <em>This club pays through Stripe, so its plan changes there.</em></p>
        </>
      ),
    },
    {
      id: 'support-notes',
      group: 'Support SOP',
      heading: 'How to document account support work',
      summary: 'Use structured notes so the next employee understands the account history.',
      keywords: ['notes', 'internal notes', 'add a note', 'story', 'support', 'identity', 'slug', 'web name', 'org name', 'club name'],
      searchText: 'document account support work add a note head of the record staff see it on the story the club never does a note is its own why web name rename club name identity pencil check mark confirm',
      links: [
        { label: 'Clubs & portals', href: '/platform-admin/orgs' },
      ],
      content: (
        <>
          <p>Every meaningful exception should have a note. The Story shows what changed and why; notes explain what the customer was told and what happens next.</p>
          <ul>
            <li>Click <strong>Add a note</strong> at the head of a club&rsquo;s or a person&rsquo;s record for customer context, follow-up dates, implementation notes and risk flags. Staff see it on the Story; the club or person never does. A note is its own reason, so the window does not ask <strong>Why</strong>.</li>
            <li>Name and web name corrections are made with the pencil on the club record and confirmed with a reason. Changing a web name changes the club&rsquo;s addresses immediately and can break links the customer already shared.</li>
            <li>Adding a note is a Super admin and Support action. The record screen has no control to edit or delete a note once it is added, so write each note as you would want to read it.</li>
          </ul>
        </>
      ),
    },
    {
      id: 'audit-investigation',
      group: 'Investigation SOP',
      heading: 'How to investigate account changes',
      summary: 'Use a record\'s Story and the global audit log to answer who changed what and when.',
      keywords: ['audit', 'audit log', 'investigate', 'actor', 'before after', 'json', 'filter', 'story', 'records opened', 'who opened', 'trail'],
      searchText: 'investigate account changes club record story when what happened who why search the story type dropdown audit log search org or email action from to dates old value new value export adds reason table timestamp superuser org action reason entry window field not recorded refunded a charge refund refused by stripe refund no answer from stripe refund checked with stripe shown to super admin billing and support lead details are shown to the roles that work leads early access lead edit field names and the step records opened trail of club and person records staff opened super admin only how found from find from a list or a link 90 days never on a customers story',
      links: [
        { label: 'Audit log', href: '/platform-admin/audit' },
      ],
      content: (
        <p>Start with the record&rsquo;s own <strong>Story</strong>, then widen to the global <strong>Audit log</strong>. A third trail, <strong>Records opened</strong>, answers who looked at a customer.</p>
      ),
      subtopics: [
        {
          id: 'audit-investigation-story',
          title: 'One account: its Story',
          content: (
            <HelpSteps>
              <li>Open the club or person (press <strong>/</strong> and find it). The <strong>Story</strong> tab is the first one.</li>
              <li>Search the words you remember, or pick a type: <strong>Staff changes</strong>, <strong>Billing</strong>, <strong>Notes</strong>, <strong>Emails</strong>, <strong>People</strong> or <strong>Feedback</strong>.</li>
              <li>Read <strong>Who</strong> and <strong>Why</strong> for each entry. A change from before reasons were kept reads <em>Not recorded</em>.</li>
            </HelpSteps>
          ),
        },
        {
          id: 'audit-investigation-log',
          title: 'Everything: the Audit log',
          content: (
            <>
              <HelpSteps>
                <li>Open <strong>Audit log</strong>.</li>
                <li>Search by organization name or actor email, then filter by <strong>Action</strong> and the <strong>From</strong> and <strong>To</strong> dates. A club&rsquo;s <strong>Filter</strong> link on a row narrows the log to that club.</li>
                <li>The table reads <strong>Timestamp</strong>, <strong>Superuser</strong>, <strong>Org</strong>, <strong>Action</strong>, <strong>Reason</strong> and a <strong>&rsaquo;</strong>. Open a row to see its entry window, which holds the <strong>Field</strong>, <strong>Old value</strong> and <strong>New value</strong> (the full JSON when you need before/after details for plan changes, module add-ons, catalog applications, or bulk changes) and the Reason.</li>
                <li>Export the result if you need to attach a concise account history to an internal ticket. The export keeps every column and adds Reason.</li>
              </HelpSteps>
              <p>A staff change made without a reason reads <em>Not recorded</em>; the product&rsquo;s own jobs and work tools (notes, decks, triage) show &ldquo;-&rdquo;. Refund entries (<em>Refunded a charge</em>, <em>Refund refused by Stripe</em>, <em>Refund: no answer from Stripe</em>, <em>Refund checked with Stripe</em>) show their reason only to Super admin, Billing and Support; other roles see <em>Shown to Super admin, Billing and Support</em>. A lead edit records which fields changed and the step, never the lead&rsquo;s words; its details are shown only to Super admin, Product and Growth, and other roles see <em>Lead details are shown to the roles that work leads.</em></p>
              <p>The log records platform-admin actions such as password reset emails, overrides, plan and limit changes, section changes, notes, staff changes, pricing and config changes, and bulk change runs.</p>
            </>
          ),
        },
        {
          id: 'audit-investigation-opened',
          title: 'Who looked: Records opened',
          content: (
            <>
              <p>Every time staff open a club or person record, one row is kept: who, when, which record, and whether Find opened it (<em>From Find</em>) or a list or link did (<em>From a list or a link</em>). The words typed into Find are never kept. Rows are kept for 90 days, and they never appear on a customer&rsquo;s Story.</p>
              <p>Only a <strong>Super admin</strong> sees it: choose <strong>Records opened</strong> in the <strong>Action</strong> dropdown of the Audit log, and use <strong>&lsaquo; All changes</strong> to come back. A record that has been deleted since reads <em>Deleted since</em>.</p>
            </>
          ),
        },
      ],
    },
    {
      id: 'retention',
      group: 'Billing SOP',
      heading: 'How to handle retained or at-risk accounts',
      summary: 'Use the retention queue for accounts approaching retention deadlines after downgrade or cancellation.',
      keywords: ['retention', 'cancel', 'cancellation', 'downgrade', 'archive', 'purge', 'deadline', 'coaches portal retention', '365 days', 'one year', 'retention reminder', 'warning email', 'process retention'],
      searchText: 'retention window length how long is data kept 90 days organization 365 days one year coaches portal cancelled coaches portal reminder warning email 14 days 30 days before deadline process expiry button run the sweep manually pending purge extend retention plus 30 days',
      links: [
        { label: 'Retention', href: '/platform-admin/retention' },
      ],
      content: (
        <>
          <p>The retention queue helps platform staff review accounts with retained data after cancellation or downgrade. Use it to see upcoming deadlines and extend a retention date when the business has approved more time.</p>
          <ul>
            <li><strong>A club or other organization</strong> is kept for 90 days. The owner is warned 14 days before the deadline.</li>
            <li><strong>A standalone Coaches Portal</strong> is kept for 365 days, whichever way it ended: the coach cancelled, you cancelled, or Stripe ended it after failed payments. The owner is warned 30 days before the deadline.</li>
          </ul>
          <ol>
            <li>Open <strong>Retention</strong>.</li>
            <li>Select <strong>Process expiry</strong>. This sends the warning emails that are due and marks expired records as pending purge.</li>
            <li>Review accounts due soon, including the retention deadline and reason.</li>
            <li>If approved, click <strong>+30 days</strong> on the account&apos;s row, enter the reason, and save. Each extension adds 30 days.</li>
            <li>Add a note on the club's record for any customer communication.</li>
          </ol>
          <HelpNote variant="warning" title="Nothing runs this on a schedule">Warning emails go out only when someone selects Process expiry. Run it at least weekly, or a customer can miss the reminder they were promised.</HelpNote>
          <p>Do not promise permanent retention unless product and billing policy explicitly allow it.</p>
        </>
      ),
    },
    {
      id: 'change-requests',
      group: 'Product SOP',
      heading: 'How to review and action the approval queue',
      summary: 'Work the catalog approval queue: submit, approve, and apply pricing, gating, and config changes.',
      keywords: ['approval queue', 'change requests', 'approval', 'pricing change', 'stripe price', 'plan gating', 'plan config', 'needs review', 'apply', 'implemented'],
      searchText: 'how do i review action the approval queue change requests approve apply pricing gating config draft needs review approved implemented stripe price update auto apply',
      links: [
        { label: 'Approval queue', href: '/platform-admin/change-requests' },
        { label: 'Plans & pricing', href: '/platform-admin/plans-pricing' },
        { label: 'Audit log', href: '/platform-admin/audit' },
      ],
      content: (
        <>
          <p>The <strong>Approval queue</strong> is the single review queue for product, pricing, entitlement, campaign, and approval changes. Requests are <strong>created from the Plans &amp; pricing catalog flow</strong> (and billing-initiated catalog actions), not from this page — here you review and move them forward. The queue opens on <strong>Action needed</strong> (items in needs review or approved).</p>
          <ol>
            <li>Open a request to read its summary, the human-readable proposal, the raw proposal payload, and the stage history (created / submitted / reviewed / applied).</li>
            <li>Move it through the lifecycle: <strong>Draft → Needs review → Approved → Implemented</strong> (or <strong>Rejected / Cancelled</strong>). The detail footer shows only the actions valid for the current status.</li>
            <li>For a <strong>generated</strong> proposal (a Stripe price change, plan availability/gating change, or plan config/limit change), approval <strong>auto-applies</strong>: the button reads <strong>Approve &amp; apply</strong> and on click the change is written and the request jumps straight to <strong>Implemented</strong>. There is no separate manual step.</li>
            <li>For a <strong>manual</strong> request (e.g. a feature-matrix publish), approval sets it to <strong>Approved</strong> and leaves a separate <strong>Mark implemented</strong> step for the implementer to take after doing the manual work.</li>
          </ol>
          <p><strong>Safe-harbour for price changes:</strong> a generated change captures the slot&apos;s current value when the request was created. If the slot changed since then, applying it is blocked with a 409 that names the current vs. expected value — create a fresh request from the current row rather than forcing it. Stripe price IDs must start with <code>price_</code>, and when the environment matches the change is live-validated against Stripe (an inactive price is rejected). Always confirm the price ID is from the correct Stripe environment (sandbox vs. live) before approving.</p>
          <p>Every transition and every auto-apply is audit-logged. The approval queue also surfaces as a queue you reach from Plans &amp; pricing.</p>
          <p><strong>Permission boundary:</strong> super admin and product can submit, approve, and apply. Billing can <em>view</em> the queue (actions show <em>Read only</em>). Support and growth do not see this surface.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-cr-auto-apply',
          question: 'Does approving a change request apply it, or is there a separate step?',
          answer: (
            <p>It depends on the request. A generated price, gating, or config change <strong>auto-applies on approval</strong> and goes straight to Implemented. A manual request (like a feature-matrix publish) only becomes Approved on approval and needs a separate <strong>Mark implemented</strong> step after you do the manual work.</p>
          ),
          answerText: 'Generated price/gating/config changes auto-apply on approval and become Implemented. Manual requests need a separate Mark implemented step.',
          keywords: ['auto apply', 'approve', 'implemented', 'manual'],
          popular: true,
        },
        {
          id: 'faq-cr-stale-price',
          question: 'Applying a price change was blocked saying the slot changed. What do I do?',
          answer: (
            <p>The Stripe price slot was modified after this request was created, so applying it would overwrite a newer value. Cancel the stale request if the current value is already correct, or create a fresh request from the current Plans &amp; pricing row and approve that one.</p>
          ),
          answerText: 'The slot changed after the request was created. Cancel the stale request if the value is already correct, or create a fresh request from the current row.',
          keywords: ['stale', 'slot changed', '409', 'price change blocked'],
        },
      ],
    },
    {
      id: 'email-templates',
      group: 'Product SOP',
      heading: 'How to edit email templates safely',
      summary: 'Edit transactional and marketing email copy without breaking variable tokens; test before saving.',
      keywords: ['email templates', 'transactional email', 'marketing campaign', 'founding season', 'retired campaign', 'variable token', 'test send', 'reset to default', 'subject', 'heading', 'cta'],
      searchText: 'how do i edit email templates safely customise transactional email copy marketing campaigns founding season retired campaign cannot send test refused variable tokens curly braces test send reset to default subject heading body cta which category',
      links: [
        { label: 'Email templates', href: '/platform-admin/email-templates' },
      ],
      content: (
        <p><strong>Email templates</strong> lets you override the copy of platform emails. Editing a template replaces the built-in default; the FieldLogicHQ brand envelope (header, footer) is always applied automatically.</p>
      ),
      subtopics: [
        {
          id: 'email-templates-two-kinds',
          title: 'Two kinds of email share one list',
          content: (
            <>
              <p>Every platform email is in this editor, but they do not behave the same way, and the difference decides how careful you have to be.</p>
              <ul>
                <li><strong>Transactional</strong> — <strong>Authentication</strong>, <strong>Billing</strong>, <strong>Tournament</strong>, <strong>Rep teams</strong>, <strong>House league</strong> and <strong>System</strong>. These fire automatically on a customer action, so a copy mistake reaches real customers with no further step from you.</li>
                <li><strong>Marketing / Campaign</strong> — the Founding season campaigns, and the largest group in the list. Nothing here sends by itself: you send each one by hand from <strong>Campaigns</strong>, which is where the audience and the planned date live. This editor owns only the words.</li>
              </ul>
            </>
          ),
        },
        {
          id: 'email-templates-editing',
          title: 'Editing a template',
          content: (
            <>
              <HelpSteps>
                <li>Open the template from the list (the status column shows <strong>Customised</strong> or <strong>Default</strong>).</li>
                <li>Edit the <strong>Subject line</strong>, <strong>Heading</strong>, <strong>Body</strong>, and optional <strong>CTA button label</strong>. The live preview on the right shows the branded result as you type.</li>
                <li>Insert variables with the <strong>token chips</strong> below the body — they use <code>{'{{variableName}}'}</code> syntax. <strong>Do not hand-type or alter a token.</strong> A broken token (typo, missing brace) renders the literal <code>{'{{variableName}}'}</code> in the email instead of the real value.</li>
                <li>Before saving, click <strong>Send test</strong>. A preview of your <em>unsaved</em> draft is emailed to your platform-admin address, with a TEST EMAIL badge and tokens shown as <code>[placeholders]</code>. Open it in an inbox and confirm it reads correctly.</li>
                <li>Click <strong>Save</strong> to publish. The template is marked Customised and records you as the last editor.</li>
                <li>To revert, click <strong>Reset to default</strong> and confirm — your customised copy is discarded and the built-in default is restored.</li>
              </HelpSteps>
              <HelpNote variant="warning" title="A token is the one thing not to type by hand">
                Use the chips. A token you typed yourself looks right in the editor and renders as raw <code>{'{{variableName}}'}</code> in a real customer&rsquo;s inbox.
              </HelpNote>
            </>
          ),
        },
        {
          id: 'email-templates-retired',
          title: 'A retired campaign is here to be read, not sent',
          content: (
            <>
              <p>A marketing campaign for a product we no longer sell is <strong>retired</strong>. It keeps its row and its copy so it can be revived, but it is gone from Campaigns, and <strong>Send test</strong> refuses it — as do preview and any attempt to send. The description at the top of the template says when it was retired and why.</p>
              <p>Editing one is safe and changes nothing a customer can receive. Reviving it starts in the product rather than here, and includes rewriting the copy for the current calendar: a retired campaign&rsquo;s words are deliberately left exactly as they were on the day it was retired, so they will describe an offer that has moved on.</p>
            </>
          ),
        },
        {
          id: 'email-templates-who',
          title: 'Who may edit, and what needs a second pair of eyes',
          content: (
            <>
              <p>Email templates is <strong>super admin and product only</strong> — it is not visible to support, billing, or growth.</p>
              <p><strong>Review with the product owner before saving</strong> any transactional template that goes straight to a customer: the auth, billing, tournament, rep-teams and house-league categories. Those send themselves, so there is no second chance to catch a mistake. System templates are internal, and marketing campaigns get their review when you send them from Campaigns.</p>
            </>
          ),
        },
      ],
      faqs: [
        {
          id: 'faq-email-template-broken-token',
          question: 'What happens if I break a variable token?',
          answer: (
            <p>The email renders the literal text — e.g. <code>{'{{firstName}}'}</code> — instead of the real value, so the customer sees raw template code. Always insert tokens with the chips and run a <strong>Send test</strong> to confirm the values fill in before saving.</p>
          ),
          answerText: 'The email shows the literal {{token}} text instead of the value. Use the token chips and run a test send before saving.',
          keywords: ['broken token', 'variable', 'curly braces', 'literal'],
          popular: true,
        },
        {
          id: 'faq-email-template-retired-campaign',
          question: 'Why is Send test refused on this campaign?',
          answer: (
            <p>Because it is <strong>retired</strong> — a marketing campaign for a product we no longer sell. Its copy is kept here so the campaign can be revived, but it cannot be sent, previewed or test-sent, and it does not appear on Campaigns. The template&rsquo;s description says when it was retired and why. Reviving one starts in the product, not here.</p>
          ),
          answerText: 'Because the campaign is retired — kept for a product we no longer sell. Retired campaigns cannot be sent, previewed or test-sent and are absent from Campaigns, but their copy stays so they can be revived. The description says when and why it was retired.',
          keywords: ['send test refused', 'retired', 'cannot send', 'campaign missing', 'not on the dashboard'],
        },
      ],
    },
    {
      id: 'plans-pricing',
      group: 'Product SOP',
      heading: 'How to work with plans, pricing, and feature matrix changes',
      summary: 'Live product packaging changes require the approved catalog workflow — sequenced by customer impact.',
      keywords: ['plans pricing', 'plans & pricing', 'product catalog', 'feature matrix', 'stripe price', 'approval', 'campaign', 'risk ladder', 'plan config', 'gating', 'stripe mode', 'production', 'test', 'change note', 'catalog records', 'planning'],
      searchText: 'how do i work with plans pricing feature matrix changes stripe mode production test dropdown product catalog workspace planning feature matrix catalog records change note optional stripe price id',
      links: [
        { label: 'Plans & pricing', href: '/platform-admin/plans-pricing' },
        { label: 'Approval queue', href: '/platform-admin/change-requests' },
        { label: 'Bulk changes', href: '/platform-admin/bulk-operations' },
      ],
      content: (
        <>
          <p><strong>Plans &amp; pricing</strong> is for global product configuration — it changes the product for <em>every</em> customer, which is different from a one-customer override. Treat the controls as a <strong>risk ladder</strong>, from lowest to highest customer impact:</p>
          <ol>
            <li><strong>Gating status</strong> (live / early access) — controls whether a plan is offered. Reversible.</li>
            <li><strong>Config limits</strong> (tournament caps, seat caps, trial days) — affects what customers on the plan can do.</li>
            <li><strong>Stripe price IDs</strong> — affects real billing; a wrong ID can break checkout or charge the wrong amount.</li>
            <li><strong>Feature matrix</strong> — which modules each plan actually includes; highest blast radius and least immediately reversible, because it changes what existing customers can <em>do</em>, not just what a plan is advertised as.</li>
          </ol>
          <p><strong>Recommended sequence for any change:</strong> verify subscriber impact (use the impact summaries) → create a change request → get it approved → apply. Generated price, gating, and config changes auto-apply on approval through the <strong>Approval queue</strong> (see <em>How to review and action the approval queue</em>).</p>
          <p><strong>Stripe price change checklist:</strong></p>
          <ul>
            <li>Confirm the <code>price_...</code> ID is from the correct Stripe environment — sandbox vs. live. <strong>Stripe mode</strong> is a dropdown (<strong>Production</strong> or <strong>Test</strong>) that switches every price table on the screen, so check it before you edit.</li>
            <li>The <strong>Change note</strong> on a price edit is optional, but say why the ID is changing for the next person reading the request.</li>
            <li>Confirm no org is on a Stripe-managed subscription that swapping the price would break.</li>
            <li>Let the change-request flow validate the ID against Stripe before it applies; do not force a blocked (stale) apply.</li>
          </ul>
          <p>The page has two tabs, <strong>Plans</strong> and <strong>Product catalog</strong>. On <strong>Product catalog</strong>, the workspace dropdown switches between <strong>Planning</strong>, <strong>Feature matrix</strong>, and <strong>Catalog records</strong>.</p>
          <p><strong>When to use which tool:</strong></p>
          <ul>
            <li><strong>Plans &amp; pricing</strong> — global changes that should affect every customer.</li>
            <li><strong>Bulk changes</strong> — the same exception applied to a chosen set of orgs.</li>
            <li><strong>A club&rsquo;s Access tab and pencil</strong> — a single-customer exception (see <em>How to provide module access</em> and <em>How to temporarily override billing access</em>).</li>
          </ul>
          <p>Live feature matrix publishing must come from an approved Feature Matrix request.</p>
        </>
      ),
    },
    {
      id: 'email-batch-send',
      group: 'Growth SOP',
      heading: 'How to send a batch marketing email',
      summary: 'Trigger a founding-season marketing send safely, with a pre-send review and the confirm modal.',
      keywords: ['email', 'campaigns', 'email campaigns', 'email dashboard', 'batch send', 'marketing email', 'founding season', 'recipients', 'send history', 'sent history', 'confirm send', 'opt out', 'resend'],
      searchText: 'how do i send a batch marketing email founding season recipients preview confirm send irreversible cannot be undone send history opted out resubscribe',
      links: [
        { label: 'Campaigns', href: '/platform-admin/email' },
      ],
      content: (
        <>
          <p><strong>Campaigns</strong> triggers the founding-season marketing emails. Sends go to <strong>real customers</strong> and <strong>cannot be recalled</strong>, so the review step matters.</p>
          <ol>
            <li>Check the audience stats at the top: <strong>Founding season orgs</strong>, <strong>Active recipients</strong> (founding orgs minus opt-outs), and <strong>Opted out</strong>. <strong>The per-email <em>Recipients</em> column is the only count that tells you who will actually receive that email</strong> — always read that one. It can legitimately be lower than the headline figure: the stats at the top count every account holding a free season, while these campaigns are written for organizations and are sent only to them.</li>
            <li>Click the <strong>Preview</strong> (eye) icon to read the exact email before sending — the preview is rendered by the same code as the send, so what you read is what goes out. The board lists only campaigns that can actually be sent; a retired campaign (one whose product we no longer sell) leaves the board entirely rather than sitting there waiting to be clicked.</li>
            <li>Click the <strong>Send now</strong> (paper-plane) icon on the email&apos;s row. The <strong>Confirm send</strong> modal restates the email key, the recipient count, and the subject, with the warning <em>&ldquo;This will send real emails… This action cannot be undone.&rdquo;</em> Read all three before confirming.</li>
            <li>Confirm with <strong>Send to N recipients</strong>. Do not close the window while it says <em>&ldquo;Sending in progress.&rdquo;</em> When it finishes you get a result line: <em>Sent / Suppressed / Failed / Batch</em>.</li>
            <li>If a send partially fails, open <strong>Sent history</strong> and expand the batch row for per-recipient delivery status (sent / suppressed / failed) before deciding whether to re-send to anyone.</li>
          </ol>
          <p>Use the <strong>Opt-outs</strong> table only to re-subscribe an org that has <em>explicitly</em> asked to be re-added. Opt-outs are excluded from Active Recipients automatically.</p>
          <p><strong>Permission boundary:</strong> growth, product, and super admin can trigger a send. Billing and support cannot — the Email surface is not visible to them.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-email-batch-recall',
          question: 'Can I recall a marketing email after sending it?',
          answer: (
            <p>No. Once you confirm the send, the emails go out and cannot be undone or recalled. Preview the email and verify the recipient count in the Confirm send modal before clicking send.</p>
          ),
          answerText: 'No — a sent batch cannot be recalled. Preview and verify the recipient count in the confirm modal before sending.',
          keywords: ['recall', 'undo', 'cannot be undone', 'irreversible'],
          popular: true,
        },
        {
          id: 'faq-email-batch-recipient-count',
          question: 'Which number is the real recipient count?',
          answer: (
            <p>The per-email <strong>Recipients</strong> column (and the count restated in the Confirm send modal). That is Active recipients — founding orgs minus opt-outs — not the total org count. Always confirm that number before sending.</p>
          ),
          answerText: 'The per-email Recipients column / the count in the confirm modal — Active Recipients, not total orgs.',
          keywords: ['recipient count', 'how many', 'active recipients'],
        },
      ],
    },
    {
      id: 'early-access-pipeline',
      group: 'Growth SOP',
      heading: 'How to work the leads pipeline',
      summary: 'Leads: the seven steps, Needs you, a lead\u2019s own page, the offered sign-up match, and the Numbers view.',
      keywords: ['leads', 'pipeline', 'needs you', 'signed up', 'lost', 'stuck', 'source', 'note', 'link a club', 'numbers', 'pay now', 'copy emails', 'export', 'early access'],
      searchText: 'how do i work the leads pipeline steps new contacted qualified pilot waiting for launch signed up lost why it was lost not a fit chose another tool price not this season no reply after three tries asked not to be contacted needs you stuck 30 days follow-up due sign-up to confirm offered match link the club not this club link one by hand unlink source not set referral from a club a tournament on fieldlogichq search social media an event or conference a pitch deck other add a note remove a note timeline email templates mark contacted numbers leads arrived pay now time to sign up new accounts by page by plan by source month by month copy emails export early access',
      links: [
        { label: 'Leads', href: '/platform-admin/early-access' },
        { label: 'Numbers', href: '/platform-admin/early-access?view=numbers' },
      ],
      content: (
        <>
          <p><strong>Leads</strong> (once called Early access) is where every early-access form and every coach&rsquo;s &ldquo;tell me more&rdquo; lands. It has two views: <strong>Pipeline</strong>, the list, and <strong>Numbers</strong>, what has converted. Super admin, Product and Growth work leads; other roles see three counts on Business numbers and nothing else.</p>
          <ol>
            <li><strong>The steps.</strong> A lead moves through seven steps in the order the work happens: <strong>New → Contacted → Qualified → Pilot → Waiting for launch → Signed up</strong>, or <strong>Lost</strong>. The band at the top counts every lead in each step; press a step to list it.</li>
            <li><strong>Needs you</strong> is the list the screen opens on: a new lead nobody has answered, a follow-up that has come due, a lead <strong>stuck</strong> for 30 days with no step change, note or follow-up (Waiting for launch is never stuck), and a sign-up to confirm. The menu&rsquo;s Leads count is this list. Pick <strong>Every lead</strong> for the rest.</li>
            <li><strong>A lead&rsquo;s page</strong> reads first. Press the pencil to edit its step, source and source detail, next action and follow-up all at once; the check mark saves at once, and the &#10005; puts everything back. <strong>Lost</strong> needs a reason (Not a fit, Chose another tool, Price, Not this season, No reply after three tries, Asked not to be contacted); the check mark refuses until one is picked.</li>
            <li><strong>Signed up</strong> is never picked from the list: it comes from linking a club or Coaches Portal. When a club signs up with a lead&rsquo;s email, the page offers it: <strong>Link the club</strong> or <strong>Not this club</strong> (never offered again). Nothing links by itself. To link a club whose address differs, press the pencil, then <strong>Link one by hand</strong>; demo clubs and staff test clubs are never offered. Unlinking puts the step back.</li>
            <li><strong>Add a note</strong> opens a window. A note is dated and signed with your name and cannot be edited; a Super admin can remove one, which leaves &ldquo;A note was removed&rdquo; and no words. The <strong>timeline</strong> shows every step move, source, link, note and form, newest first.</li>
            <li><strong>Email</strong> followed by the lead&rsquo;s first name holds the three outreach templates (League Plus early access, Club roadmap update, Feedback call), which copy with the lead&rsquo;s name filled in, and <strong>Mark contacted</strong>, which stamps today and moves a New lead to Contacted.</li>
          </ol>
          <p><strong>Numbers</strong> is read live when it opens, over every lead: <strong>Leads arrived</strong> (their first form in the period), <strong>Signed up</strong> (linked to a club or portal by a person), <strong>Pay now</strong> (their own plan is not Tournament, billing is active and a real subscription stands behind it; a trial, free time and a Founding Season comp are not paying), <strong>Time to sign up</strong> (to the day the club or portal was created, not the day it was linked) and <strong>New accounts</strong>. A figure that could not be read says <strong>Not read</strong>, never 0.</p>
          <p><strong>Tools:</strong> <em>Copy emails</em> copies the addresses of the leads in the list on screen who said yes to release emails, never one who asked not to be contacted. <em>Export</em> takes every lead in the list, Excel first or CSV; a lead who asked not to be contacted has an empty email cell. Both are recorded in the audit log (who, when, how many), never with an address.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-ea-mark-converted',
          question: 'How do I mark a lead Signed up?',
          answer: (
            <p>Link its club. If the page offers a club that signed up with the lead&rsquo;s email, press <strong>Link the club</strong>. Otherwise press the pencil and <strong>Link one by hand</strong>, and search for the club or portal by name.</p>
          ),
          answerText: 'Link its club: Link the club on an offered match, or the pencil then Link one by hand.',
          keywords: ['signed up', 'link a club', 'convert lead', 'organization'],
          popular: true,
        },
        {
          id: 'faq-ea-not-offered',
          question: 'A club signed up but the lead page does not offer it. Why?',
          answer: (
            <p>The page offers a club only when an owner or admin who has joined it signs in with the lead&rsquo;s address, and confirmed that address themselves from our email. An address staff confirmed in the console, a demo club, a staff test club and a club you marked <strong>Not this club</strong> are never offered. Link it by hand if it is the lead&rsquo;s.</p>
          ),
          answerText: 'Only an owner or admin who joined and confirmed the lead\u2019s address themselves is offered; link any other club by hand.',
          keywords: ['offered match', 'sign-up to confirm', 'not offered'],
        },
      ],
    },
    {
      id: 'cancel-subscription',
      group: 'Billing SOP',
      heading: 'How to cancel a customer subscription',
      summary: 'Cancel a Stripe subscription on behalf of a customer from the end of the club record\'s Access tab.',
      keywords: ['cancel subscription', 'unsubscribe', 'stripe cancel', 'billing cancel', 'terminate account', 'end subscription', 'customer locked out', 'coaches locked out', 'customer lost access', 'portal stopped working', 'scorekeeper stopped', 'did the customer lose data', 'reinstate', 'restore access', 'unblock customer', 'access tab', 'open in stripe'],
      searchText: 'how do i cancel a subscription for a customer unsubscribe stripe billing terminate account end subscription on behalf access tab end of the tab cancel the subscription what stops tournaments archived kept for days email the owner that it is cancelled cannot be put back reaches stripe never offered as put it back super admin billing what happens after cancellation access stops immediately coaches portal closes scorekeeper check-in family pages public tournament site tryout registration closes dues reminder emails stop nothing is deleted data retained 90 days resubscribe restores everything customer locked out lost access portal stopped working billing page keeps working free personal coaches portal unaffected reinstate unblock restore access active override stripe did not stop the subscription cancelled here stripe needs it cancelled by hand money tab open in stripe',
      links: [
        { label: 'Clubs & portals', href: '/platform-admin/orgs' },
        { label: 'Retention', href: '/platform-admin/retention' },
        { label: 'Audit log', href: '/platform-admin/audit' },
      ],
      content: (
        <>
          <p>Use this when a customer has explicitly asked to cancel and either cannot complete the self-serve flow or has contacted support directly. Confirm the request with the account owner before taking action. Cancelling is a Super admin and Billing action.</p>
        </>
      ),
      subtopics: [
        {
          id: 'cancel-subscription-find',
          title: 'Get to the Cancel the subscription door',
          content: (
            <HelpSteps>
              <li>Open the customer&rsquo;s club (press <strong>/</strong> and find it).</li>
              <li>On the <strong>Money</strong> tab, confirm the <strong>Billing status</strong> is not already <em>Cancelled</em>.</li>
              <li>Open the <strong>Access</strong> tab and scroll to the end. <strong>Cancel the subscription</strong> is a red door there. It is absent when the club is already cancelled, or is on the free Tournament plan with no Stripe subscription.</li>
              <li>Click <strong>Cancel the subscription</strong>.</li>
            </HelpSteps>
          ),
        },
        {
          id: 'cancel-subscription-confirm',
          title: 'Confirm it, and record what happened',
          content: (
            <>
              <HelpSteps>
                <li>Read the window: it says Stripe stops charging the club, that <strong>this cannot be put back</strong> (the owner would have to buy again), and how many tournaments are archived and for how many days they are kept. <strong>What stops</strong> lists the modules shutting down.</li>
                <li>Type why the cancellation is being started by platform staff rather than the customer in <strong>Why</strong>. It shows on the club&rsquo;s Story.</li>
                <li>Tick <strong>Email the owner that it is cancelled</strong> if the customer expects a confirmation email. It reaches an inbox and cannot be taken back.</li>
                <li>Click <strong>Cancel the subscription</strong>.</li>
                <li>Add a note with the customer-facing context: what was discussed, who approved, and any retention or resubscription commitments.</li>
              </HelpSteps>
              <p>Check the <strong>Retention</strong> queue after cancellation and extend the deadline if the customer has negotiated additional time.</p>
            </>
          ),
        },
        {
          id: 'cancel-subscription-result',
          title: 'What the cancellation does to the account',
          content: (
            <>
              <p>After cancellation the account moves to <code>canceled</code> status, the public site is unpublished, all non-archived tournaments are archived, and data is retained for 90 days. The Stripe subscription is canceled immediately.</p>
              <p>A standalone Coaches Portal is kept for 365 days instead. If you tick <strong>Email the owner that it is cancelled</strong>, the coach gets the Coaches Portal cancellation email: it gives the date the team is kept until, and its Resubscribe link brings back the same team rather than starting a new portal.</p>
              <HelpNote variant="warning" title="If Stripe fails but the in-app state succeeded">You will see <em>Cancelled here. Stripe needs it cancelled by hand</em> &mdash; complete the cancellation in Stripe from the <strong>Open in Stripe</strong> door on the <strong>Money</strong> tab. The Story also records <em>Stripe did not stop the subscription</em>.</HelpNote>
            </>
          ),
        },
        {
          id: 'cancel-subscription-access',
          title: 'Access stops immediately — expect calls',
          content: (
            <>
              <p><strong>Access stops immediately and completely</strong> (owner ruling 2026-08-06). The Coaches Portal, tournament setup, scheduling and score entry, the scorekeeper and check-in apps, the family team pages and calendar feeds, and the public tournament site all close the moment you confirm. Coaches and volunteers see a plain &ldquo;subscription has ended — nothing has been deleted&rdquo; notice. Tryout registration closes and automated dues-reminder emails stop. <strong>Nothing is deleted</strong>, and resubscribing restores everything intact — that is the reassurance to lead with on a support call.</p>
              <p>Two things deliberately keep working: the customer&rsquo;s own <strong>Billing page</strong> (that is how they come back — an admin who opens the admin area is redirected there), and any coach&rsquo;s <strong>free personal Coaches Portal</strong>, which is user-owned and has no subscription to cancel.</p>
            </>
          ),
        },
      ],
      faqs: [
        {
          id: 'faq-cancel-stripe-fails',
          question: 'The cancellation succeeded in FieldLogicHQ but shows a Stripe warning. What do I do?',
          answer: (
            <p>The account is already cancelled in FieldLogicHQ. Open Stripe from the <strong>Open in Stripe</strong> door on the club&rsquo;s <strong>Money</strong> tab, find the subscription, and cancel it manually. Document the manual action in a note on the record.</p>
          ),
          answerText: 'The account is already cancelled in FieldLogicHQ. Open Stripe from the Open in Stripe door on the Money tab and cancel the subscription manually. Document in a note on the record.',
          keywords: ['stripe warning', 'stripe fails', 'manual stripe', 'cancelled here'],
          popular: true,
        },
        {
          id: 'faq-cancel-no-stripe-id',
          question: 'The Cancel the subscription door is not showing. Why?',
          answer: (
            <p>It is at the very end of the <strong>Access</strong> tab and only Super admin and Billing see it. It is also absent when the club is already cancelled, or is on the free Tournament plan with no Stripe subscription on file. If the subscription was already cancelled in Stripe but the FieldLogicHQ status was not updated, add a <strong>Billing status</strong> override reading as Cancelled. The pencil will not change the plan of a club whose subscription still reads as live: Stripe would put it back.</p>
          ),
          answerText: 'It is at the end of the Access tab and only Super admin and Billing see it. It is absent when the club is already cancelled or is on the free Tournament plan with no Stripe subscription. Use a subscription status override or a plan change if the subscription was already ended in Stripe.',
          keywords: ['cancel section missing', 'no stripe id', 'already canceled', 'door missing'],
        },
        {
          id: 'faq-cancel-vs-override',
          question: 'Should I cancel the subscription or just add a cancelled billing status override?',
          answer: (
            <>
              <p>If the customer wants their billing to stop and the account closed, use <strong>Cancel the subscription</strong>. That cancels the Stripe subscription so no further charges occur. A status override does <strong>not</strong> stop Stripe from billing.</p>
              <p><strong>⚠ A status override is not cosmetic.</strong> Since 2026-08-06 the access rail reads the effective subscription status, so setting an override to <code>canceled</code> <strong>genuinely shuts the customer out of the whole product</strong> while Stripe keeps charging them — the worst combination available. Never use it as a &ldquo;just for display&rdquo; flag.</p>
              <p>The reverse is the useful case: an <code>active</code> override <strong>reinstates</strong> an account without touching Stripe, which is the intended way to unblock a customer who was cut off in error. <em>Operational caveat:</em> timed overrides only take effect when entitlement grants are enabled in the environment — if an override reports success but nothing changes for the customer, check that first before assuming the rail is broken.</p>
            </>
          ),
          answerText: 'Use Cancel the subscription if the customer wants billing to stop — a status override does not stop Stripe charges. WARNING: a status override is not cosmetic. Since 2026-08-06 the access rail reads the effective subscription status, so an override set to canceled genuinely shuts the customer out of the entire product while Stripe keeps charging them. Never use it as a display-only flag. The reverse is the useful case: an active override reinstates an account without touching Stripe, and is the intended way to unblock a customer cut off in error. Timed overrides only apply when entitlement grants are enabled in the environment — if an override reports success but nothing changes for the customer, check that before assuming the rail is broken.',
          keywords: ['cancel vs override', 'status override', 'stop billing', 'override locks out customer', 'override not cosmetic', 'reinstate', 'unblock customer', 'restore access', 'override did nothing', 'entitlement grants'],
          popular: true,
        },
      ],
    },
    {
      id: 'delete-user',
      group: 'Support SOP',
      heading: 'How to delete a user',
      summary: 'Permanently remove a user account from FieldLogicHQ, including their auth record.',
      keywords: ['delete user', 'delete this person', 'remove user', 'gdpr', 'data deletion', 'user removal', 'account delete', 'person record', 'type their email'],
      searchText: 'how do i delete a user delete this person remove user account permanently gdpr data deletion right to erasure people person record account tab end of the tab type their email to confirm why required free coaching teams they run alone are deleted too super admin only cannot be taken back',
      links: [
        { label: 'People', href: '/platform-admin/customer-users' },
        { label: 'Clubs & portals', href: '/platform-admin/orgs' },
      ],
      content: (
        <>
          <p>User deletion is permanent and is a <strong>Super admin</strong> action. The Supabase auth record is removed and the user can no longer sign in. The person&rsquo;s clubs and tournaments are <strong>not</strong> deleted with them &mdash; but a free coaching team they run alone is, with every player and record.</p>
          <p><strong>Before deleting a user, check their club memberships.</strong></p>
          <HelpSteps>
            <li>Press <strong>/</strong> and find the person, or search <strong>People</strong>, and open their record.</li>
            <li>Open the <strong>Clubs</strong> tab to see which clubs they belong to and their role in each. If they are the <strong>sole owner</strong> of a club, handle it first: to keep the club, make another active member the owner (see <em>How to transfer organization ownership</em>); to close it, cancel its subscription and then delete the club (see <em>How to cancel a customer subscription</em> and <em>How to delete an organization</em>).</li>
            <li>Add a note to each affected club saying why the person is being deleted. For a GDPR or erasure request, include the request date and source.</li>
            <li>Back on the person&rsquo;s record, open the <strong>Account</strong> tab and click <strong>Delete this person</strong> at the end.</li>
            <li>The window shows how many free coaching teams they run alone, and says it cannot be taken back. Type their email to confirm and type the reason in <strong>Why</strong>.</li>
            <li>Click <strong>Delete this person</strong>. You return to People.</li>
          </HelpSteps>
          <p>The deletion is audit-logged with your reason. If you do not see <strong>Delete this person</strong>, your role is not Super admin &mdash; hand the request to one.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-delete-user-org-data',
          question: 'Does deleting a user also delete their organization or tournament data?',
          answer: (
            <p>No. Deleting the user removes their Supabase auth record and login. Club memberships, tournaments, and club-level data persist until the club itself is deleted. The one exception is a free coaching team they run alone, which is deleted too, and the window tells you how many. Review each club the user owned before proceeding.</p>
          ),
          answerText: 'No — deleting a user only removes their auth record and login. Club memberships and tournament data persist until the club is deleted. The exception is a free coaching team they run alone, which is deleted too; the window says how many.',
          keywords: ['org data', 'tournament data', 'org deleted', 'what gets deleted', 'free coaching team'],
          popular: true,
        },
        {
          id: 'faq-delete-user-sole-owner',
          question: 'What happens if I delete the only owner of an organization?',
          answer: (
            <p>The organization record persists but becomes ownerless. No customer will be able to access the admin or billing without a new owner being assigned manually in the database. Resolve club ownership before deleting the user.</p>
          ),
          answerText: 'The org persists but becomes ownerless. Resolve ownership before deleting the sole owner.',
          keywords: ['sole owner', 'ownerless org', 'no owner'],
          popular: true,
        },
      ],
    },
    {
      id: 'delete-organization',
      group: 'Support SOP',
      heading: 'How to delete an organization',
      summary: 'Permanently remove an organization and all its data from FieldLogicHQ.',
      keywords: ['delete organization', 'delete org', 'delete the club', 'remove organization', 'gdpr', 'data deletion', 'hard delete', 'purge org', 'access tab', 'danger zone'],
      searchText: 'how do i delete an organization permanently remove org data gdpr data erasure hard delete purge account delete the club end of the access tab type the web name to confirm why required email the owner that the account is closed also delete the stripe customer only when the customer asked to be forgotten cancel the subscription first still has a running subscription super admin only invoice history stays in stripe',
      links: [
        { label: 'Clubs & portals', href: '/platform-admin/orgs' },
        { label: 'Retention', href: '/platform-admin/retention' },
        { label: 'Audit log', href: '/platform-admin/audit' },
      ],
      content: (
        <>
          <p>Organization deletion is irreversible. All org data is permanently removed: tournaments, registrations, members, accounting records, notes, and audit history. Invoice history stays in Stripe. This action is <strong>Super admin only</strong>.</p>
          <p><strong>Before deleting an organization, complete these steps in order:</strong></p>
          <HelpSteps>
            <li><strong>Confirm the request.</strong> Get written confirmation from the account owner or a documented internal approval. For GDPR erasure requests, add a note with the request date and source before proceeding.</li>
            <li><strong>Cancel the subscription.</strong> If the club has a running subscription, cancel it first with <strong>Cancel the subscription</strong> at the end of the <strong>Access</strong> tab. The delete window refuses while a subscription is running. See <em>How to cancel a customer subscription</em>.</li>
            <li><strong>Check retention records.</strong> If data is currently in the <strong>Retention</strong> queue for this club, review whether it should be purged immediately or allowed to expire normally.</li>
            <li><strong>Delete the club.</strong> Open the <strong>Access</strong> tab, scroll to the end, and click <strong>Delete the club</strong>. The window counts the members and tournaments that go with it. Type the club&rsquo;s web name to confirm and type the reason in <strong>Why</strong>. Tick <strong>Email the owner that the account is closed</strong> only if the owner should be told, and <strong>Also delete the Stripe customer</strong> only when the customer asked to be forgotten.</li>
            <li><strong>Delete user accounts if required.</strong> If the deletion is part of a data erasure request and the people have no other clubs, delete their accounts from their person records after the club is removed.</li>
          </HelpSteps>
          <p>If you do not see <strong>Delete the club</strong> at the end of the Access tab, your role is not Super admin &mdash; hand the deletion to one.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-delete-org-stripe',
          question: 'Do I need to cancel Stripe separately before deleting the org?',
          answer: (
            <p>Yes. The delete window refuses while the club still has a running subscription, and deleting does not cancel Stripe billing for you. Cancel the subscription from the end of the <strong>Access</strong> tab first so billing stops before the club record is removed.</p>
          ),
          answerText: 'Yes. Cancel the subscription from the end of the Access tab before deleting the club — the delete window refuses while a subscription is running, and deleting does not stop Stripe billing.',
          keywords: ['stripe', 'cancel before delete', 'billing'],
          popular: true,
        },
        {
          id: 'faq-delete-org-retention',
          question: 'Does org deletion immediately erase data or is it retained for 90 days?',
          answer: (
            <p>Canceling a subscription creates a retention window: 90 days for an organization, 365 days for a standalone Coaches Portal. When the window ends, the account is marked pending purge in the retention queue. Nothing is deleted automatically. Hard-deleting the org bypasses retention and removes data immediately. Use the retention queue for standard cancellations, and hard deletion only for GDPR or explicitly approved data erasure requests.</p>
          ),
          answerText: 'Cancellation creates a retention window: 90 days for an organization, 365 days for a standalone Coaches Portal. When it ends the account is marked pending purge; nothing is deleted automatically. Hard deletion bypasses retention and removes data immediately — use it only for GDPR or approved erasure requests.',
          keywords: ['retention', '90 days', '365 days', 'coaches portal retention', 'pending purge', 'immediate deletion', 'gdpr'],
          popular: true,
        },
      ],
    },
    {
      id: 'platform-users',
      group: 'System SOP',
      heading: 'How to manage platform employee access',
      summary: 'Add, activate, deactivate, remove, and role-scope staff.',
      keywords: ['platform users', 'staff', 'employee access', 'invite', 'add user', 'deactivate', 'role', 'super admin', 'support', 'billing', 'product', 'growth', 'read only'],
      searchText: 'staff page records menu group add user add company user display name email role create password setup link copy no email is sent deactivate activate remove platform user roles super admin support billing product growth read only bootstrap admins',
      links: [
        { label: 'Staff', href: '/platform-admin/users' },
      ],
      content: (
        <>
          <p>Only a Super admin can change employee access. <strong>Staff</strong> (under <strong>Records</strong>) lists everyone with access to this console; customers are on People.</p>
          <HelpSteps>
            <li>Go to <strong>Staff</strong>.</li>
            <li>Click <strong>Add user</strong>, enter name, email, and role, then click <strong>Create</strong>.</li>
            <li>Copy the one-time password setup link shown below the form and send it through an approved internal channel. No email is sent for you.</li>
            <li>Use the role dropdown to adjust access later. Use the smallest role that fits the job (see <em>Who can do what in the console</em>).</li>
            <li>Choose <strong>Deactivate</strong> for temporary removal. Choose <strong>Remove</strong> only when the person should lose platform-admin access entirely.</li>
          </HelpSteps>
          <p>Bootstrap admins from <code>PLATFORM_ADMIN_EMAILS</code> cannot be removed from the UI. Keep that environment list small.</p>
        </>
      ),
    },
  ],
  faqs: [
    {
      id: 'faq-customer-vs-platform-docs',
      question: 'Can platform admins see the same help docs customers see?',
      answer: (
        <p>Yes. <strong>Help</strong>, at the foot of the console menu, links to the same customer guide content under platform-admin routes, plus the protected employee-only Platform Admin Operations guide.</p>
      ),
      answerText: 'Yes. Platform admins can see customer guide content plus the protected employee-only operations guide.',
      keywords: ['customer docs', 'platform docs', 'help center'],
      popular: true,
    },
    {
      id: 'faq-unsubscribed-module-temporary',
      question: 'What is the safest way to give an unsubscribed customer temporary module access?',
      answer: (
        <p>Turn the section on for that club with the pencil on its record (or add a timed Feature access override on its Access tab), add a note with approval and review date, and pair it with a status override only if billing status would otherwise block account access.</p>
      ),
      answerText: 'Turn the section on for that club with the pencil, or add a timed Feature access override on its Access tab, document approval and review date, and pair it with a status override only if billing status blocks access.',
      keywords: ['unsubscribed', 'module access', 'temporary', 'override'],
      popular: true,
    },
    {
      id: 'faq-who-can-run-bulk',
      question: 'Who can run bulk billing or module operations?',
      answer: (
        <p>Bulk billing actions require billing access. Bulk module add-on actions require product access. Super admins can run both. Read-only users can review information but cannot apply changes.</p>
      ),
      answerText: 'Billing access is required for bulk billing actions. Product access is required for bulk module add-on actions. Super admins can run both.',
      keywords: ['bulk', 'permission', 'billing', 'product'],
    },
  ],
};

export default platformAdminHelp;
