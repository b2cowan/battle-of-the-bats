/* eslint-disable react/no-unescaped-entities */
import type { HelpPageContent } from './index';
import { HelpSteps, HelpNote, HelpDefs, HelpDef } from '@/components/help/HelpBlocks';

const platformAdminHelp: HelpPageContent = {
  title: 'Platform Admin Operations',
  role: 'Platform Admin',
  searchPlaceholder: 'Search platform admin SOPs',
  intro:
    'Employee-only workflows for supporting FieldLogicHQ customers. Use this guide when you need to find a club or person, read and change a record, reset access, explain customer-facing docs, apply temporary billing or module exceptions, investigate account history, or manage platform staff access.',
  sections: [
    {
      id: 'where-to-work',
      group: 'Orientation',
      heading: 'Where to work first',
      summary: 'Know the menu, Today and Find before you change an account.',
      keywords: ['overview', 'today', 'organizations', 'clubs & portals', 'customer users', 'people', 'plans pricing', 'plans & pricing', 'bulk operations', 'bulk changes', 'audit', 'audit log', 'support console', 'menu', 'menu by job', 'sidebar', 'collapse sidebar', 'account menu', 'sign out', 'appearance', 'warm', 'dark', 'help', 'private finance', 'business numbers', 'find', 'search', 'recent', 'slash', 'old names', 'renamed', 'observability', 'errors', 'early access', 'leads', 'email campaigns', 'campaigns', 'platform users', 'staff', 'reason', 'why', 'every change keeps its reason', 'waiting', 'amber count', 'view-only', 'eye'],
      searchText: 'where to work first support console menu by job groups customers health growth product records system private finance bookkeeping owner only today what is waiting on us amber count queue waiting since your last visit totals line business numbers subscription growth usage metric notes find box top strip press slash recent last five records opened cleared at sign-out all in clubs and portals all in people stripe numbers cus sub pi ch card digits are not searched every change keeps its reason why window one sentence confirm eye view-only for your role old names overview organizations customer users observability early access email campaigns bulk operations platform users command center billing & product support & diagnostics governance help at the foot of the menu opens in place collapse sidebar menu button top strip account menu appearance warm dark sign out staff access',
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
                <HelpDef term="Health"><strong>Errors</strong> and <strong>Feedback</strong>.</HelpDef>
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
              <p>Your role decides which queues you see. <em>Since your last visit</em> in the table&rsquo;s header marks what is new since you were last here. A line above the table counts errors in the last 24 hours for roles that can open Errors.</p>
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
              <p>Super admin, Billing and Support also get a <strong>Stripe</strong> group for a customer (<code>cus_</code>), subscription (<code>sub_</code>) or family payment (<code>pi_</code>, <code>ch_</code>) number; Enter opens the club&rsquo;s Money tab. Card digits are not searched &mdash; ask for the email on the receipt. Charges on a club&rsquo;s own subscription are kept in Stripe only, so search the customer number instead. Staff accounts are not customers and Find leaves them out. On a narrow screen the box is a magnifying glass in the strip; tap it and the strip turns into the box.</p>
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
      searchText: 'who can do what roles powers super admin support billing product growth read only permissions club name web name notes make owner release own web address person actions reset link confirm email sign out everywhere ban edit plan limits overrides cancel subscription sections delete club delete person bulk changes retention errors triage feedback triage catalog growth staff records opened find stripe numbers run jobs billing no longer has support club and person powers',
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
      keywords: ['club record', 'organization record', 'org detail', 'story', 'money tab', 'access tab', 'people & tournaments', 'pencil', 'edit club', 'check mark', 'confirm window', 'why', 'reason', 'put it back', 'undo', 'web name', 'rename club', 'change plan', 'tournament limit', 'team limit', 'sections', 'billing', 'entitlements', 'support tab', 'activity', 'band'],
      searchText: 'club record organization detail story money access people and tournaments tabs one pencil edits the whole record check mark opens confirm window states every change in one sentence asks why reason required kept put it back undo plan change limits section turned on off running override end early never anything that reached stripe or an inbox newest plan entry still in force trial writes a new entry marked put back editing nothing changes until you press the check mark changes held name web name plan tournament limit team limit sections in the plan show more search the story type staff changes billing notes emails people feedback not recorded teams brought in add a note email the owner make owner release this address add an override cancel the subscription delete the club old record billing entitlements support activity',
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
                <HelpDef term="Money">Plan, state, renewal date, and the Stripe customer and subscription with an <strong>Open in Stripe</strong> door each. Charges, refunds and invoices are not shown here yet.</HelpDef>
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
              <p>Not in the Story yet: Stripe&rsquo;s charges and refunds, purchases the customer makes in Stripe, and account emails such as password resets. The trail of records staff have opened is never shown on a customer&rsquo;s Story (see <em>How to investigate account changes</em>).</p>
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
                <HelpDef term="A plan or limit change">Only the newest plan entry that is still in force, and never when a Stripe subscription or a trial is involved. Super admin and Billing.</HelpDef>
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
      searchText: 'how do i give a club free time free through last free day a whole plan tournament plus club club association sections billing status reads active while unpaid grace period support window override billing requirements customer unsubscribed expired trial access tab free time block give free time change the end date end it now reason why put it back story free time list everyone founding season given by staff today free time ending 14 days super admin twelve months billing six months longer needs a super admin refused switched off on this server you are a member of the club coaches portal public demo club comp period no longer given paying through stripe already has free time',
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
          <HelpNote variant="info" title="When the door is a sentence instead of a button">Free time can&rsquo;t be given when it is switched off on this server, when you are a member of that club (another staff member can), when the club is a Coaches Portal, or when it is a public demo club. A plan can&rsquo;t be given while Stripe charges the club for a plan, when the club already has a plan given as free time (change its end date instead), or when it is already on the top plan; sections and billing status can still be given. A comp period is no longer given from the console: it never gave a club anything.</HelpNote>
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
      summary: 'Work the in-app feedback queue from New to Resolved, pivot to a related error, and flag items for product.',
      keywords: ['feedback', 'errors', 'triage', 'bug report', 'feature request', 'escalate', 'escalation', 'related issue', 'support queue'],
      searchText: 'how do i triage customer feedback bug reports feature requests move new triaged acknowledged resolved escalate to product view related issue error group flag for product',
      links: [
        { label: 'Feedback', href: '/platform-admin/feedback' },
        { label: 'Errors', href: '/platform-admin/observability' },
      ],
      content: (
        <>
          <p><strong>Feedback</strong> collects bug reports, feature requests, and general feedback submitted from inside the app — admin, coach, volunteer, and anonymous public users. Work it like a queue, oldest-actionable first.</p>
          <ol>
            <li>Open <strong>Feedback</strong>. It opens on the <strong>New</strong> status by default so you see what is unworked. Use the type, category, and status filters to narrow; choose <strong>All statuses</strong> to widen back out.</li>
            <li>Open a row&apos;s title to read the full body. For a bug, look for the <strong>View related issue →</strong> link — it jumps straight to the matching error group on Errors so you can confirm whether the error is already tracked.</li>
            <li>If a bug shows <em>&ldquo;No linked error event&rdquo;</em>, no captured error was correlated automatically. Correlate manually: note the org and the time, then search Errors by route and org slug around that timestamp.</li>
            <li>Move the item through its lifecycle with the status dropdown: <strong>New → Triaged → Acknowledged → Resolved</strong>. Triaged means you have read and categorised it; Acknowledged means the customer has had a response or the item is queued for work; Resolved means it is done or won&apos;t-do with a reason recorded elsewhere.</li>
            <li>When the product team needs to act on an item, click <strong>Escalate to product</strong>. This stamps an <strong>Escalated</strong> badge on the row and adds it to the <em>Escalated</em> filter so product can find the flagged queue. It does <strong>not</strong> send a notification or assign anyone — pair it with your normal product hand-off (standup, ticket, or channel). Click again to clear the flag.</li>
          </ol>
          <p>Every status change is audit-logged with your email and a timestamp. Feedback is retained indefinitely. Export the filtered view (XLSX/CSV) when you need to attach a queue snapshot to a report.</p>
          <p><strong>Permission boundary:</strong> super admin, product, support, and billing can change feedback status and escalate. The <strong>error group</strong> behind a bug is a separate surface — resolving the error group itself (on Errors) is product-only (see <em>How to use the Errors page and resolve error groups</em>).</p>
        </>
      ),
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
            <p>No <code>requestId</code> was captured for that submission, so it could not be auto-correlated. Open <strong>Errors</strong> and search by the bug&apos;s route and org slug around the time the feedback was submitted to find the matching error group manually.</p>
          ),
          answerText: 'No requestId was captured. Search Errors by route and org slug around the submission time to find the error group manually.',
          keywords: ['no linked error', 'correlate manually', 'request id'],
        },
      ],
    },
    {
      id: 'observability-triage',
      group: 'Support SOP',
      heading: 'How to use the Errors page and resolve error groups',
      summary: 'Read the Errors page (once called Observability), open an error group, and resolve, ignore, or snooze it.',
      keywords: ['errors', 'observability', 'error tracking', 'error group', 'issue', 'resolve', 'ignore', 'snooze', 'stack trace', 'error rate', 'time window', 'last 24h', 'last 7d', 'last 30d'],
      searchText: 'how do i use the errors page observability dashboard error tracking error groups issues resolve ignore snooze reopen stack trace error rate freshness affected orgs time window dropdown last 24h last 7d last 30d environment production dev',
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
        </ul>
            </>
          ),
        },
        {
          id: 'observability-issue',
          title: 'Open an issue',
          content: (
            <>
            <p>Open an issue to read its detail: route and HTTP method, occurrence count, affected orgs, first/last seen, a 14-day occurrence sparkline, scrubbed sample events (stack trace and request context, redacted), and any <strong>related feedback</strong> matched by request ID.</p>
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
      keywords: ['bulk changes', 'bulk operations', 'bulk', 'comp period', 'plan change', 'module addon', 'subscription status', 'select filtered', 'review bulk operation', 'confirm bulk operation'],
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
            <li>Choose the action &mdash; Subscription status override, Comp period grant, Plan change, or Module add-on &mdash; and set the target value. Comp periods require an expiration date. Module add-ons require enable or remove.</li>
            <li>Enter a clear reason. This reason appears in the batch record and audit log.</li>
            <li>Review the preview panel, click <strong>Review bulk operation</strong>, then click <strong>Confirm bulk operation</strong>.</li>
            <li>Review the result list and recent bulk operation table for failures or skipped accounts.</li>
          </ol>
          <p>Billing actions require billing access. Module add-on actions require product access. A super admin can perform both. On each club&rsquo;s Story a change from here reads <em>From Bulk changes</em>.</p>
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
      searchText: 'investigate account changes club record story when what happened who why search the story type dropdown audit log search org or email action from to dates old value new value export records opened trail of club and person records staff opened super admin only how found from find from a list or a link 90 days never on a customers story',
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
                <li>Open a row&apos;s <strong>Old value</strong> or <strong>New value</strong> to see the full JSON when you need before/after details for plan changes, module add-ons, catalog applications, or bulk changes.</li>
                <li>Export the result if you need to attach a concise account history to an internal ticket.</li>
              </HelpSteps>
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
            <li>Move it through the lifecycle: <strong>Draft → Needs review → Approved → Implemented</strong> (or <strong>Rejected / Canceled</strong>). The detail footer shows only the actions valid for the current status.</li>
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
      heading: 'How to manage the early-access lead pipeline',
      summary: 'Work early-access leads through the pipeline: status, notes, outreach templates, and conversion.',
      keywords: ['early access', 'leads', 'pipeline', 'outreach', 'convert', 'follow up', 'growth', 'lead status', 'export'],
      searchText: 'how do i manage early access lead pipeline status new qualified contacted pilot converted not a fit do not contact outreach templates mark converted follow up export copy emails follow-up due in view tiles',
      links: [
        { label: 'Leads', href: '/platform-admin/early-access' },
      ],
      content: (
        <>
          <p><strong>Leads</strong> (once called Early access) is the growth lead pipeline. The summary tiles show leads <strong>In view</strong>, <strong>New</strong>, <strong>Pilot</strong>, <strong>Converted</strong> (with rate), and <strong>Follow-up due</strong>. The conversion panels break down what is converting by plan interest and feature interest.</p>
          <ol>
            <li>Filter the list by search text, plan interest, feature interest, status, or consent. Click a lead to open the detail panel.</li>
            <li>Move the lead through its lifecycle with the status select: <strong>New → Qualified → Contacted → Pilot candidate → Waiting for launch → Converted</strong>, or close it as <strong>Not a fit</strong> / <strong>Do not contact</strong>. Any status can be set directly — there is no forced order.</li>
            <li>Record work in the detail panel: set a <strong>Follow-up due</strong> date, a <strong>Next action</strong>, and <strong>Internal notes</strong>, then <strong>Save</strong>. Use <strong>Mark contacted</strong> to stamp the last-contacted date.</li>
            <li>For outreach, use the built-in <strong>Templates</strong> (League Plus beta invite, Club roadmap update, Feedback call). Clicking one copies the subject and body with the lead&apos;s name and org filled in — paste into your email tool and personalise before sending. The <strong>Email</strong> button in the panel copies the lead&apos;s address; <strong>Copy emails</strong> grabs all consented addresses in the current view.</li>
            <li>To convert a lead, first pick the <strong>Converted organization</strong> in the panel, then click <strong>Mark converted</strong>. This links the lead to that org and records the conversion (a lead with no org selected cannot be marked converted).</li>
          </ol>
          <p><strong>Reporting:</strong> the list loads at most <strong>100 leads</strong> — when the true total exceeds that, narrow with filters or <strong>Export</strong> (XLSX/CSV) for the full pipeline. Respect consent: only consented leads are included in <em>Copy emails</em>.</p>
          <p><strong>Permission boundary:</strong> growth, product, and super admin can update leads. Billing and support do not see this surface. A view-only role can read a lead but cannot edit it.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-ea-mark-converted',
          question: 'I cannot mark a lead converted. What am I missing?',
          answer: (
            <p>You must select the <strong>Converted organization</strong> in the lead detail panel first. <strong>Mark converted</strong> links the lead to that org and records the conversion — without an org selected it cannot proceed.</p>
          ),
          answerText: 'Select the Converted organization in the detail panel first — Mark converted links the lead to that org and needs it set.',
          keywords: ['mark converted', 'convert lead', 'organization'],
          popular: true,
        },
        {
          id: 'faq-ea-100-cap',
          question: 'The list seems capped. How do I see all the leads?',
          answer: (
            <p>The list loads up to 100 leads at a time. The total count tile reflects the true number — when it exceeds 100, narrow the view with filters or use <strong>Export</strong> (XLSX/CSV) to pull the full pipeline.</p>
          ),
          answerText: 'The list caps at 100 loaded leads. Filter to narrow, or Export (XLSX/CSV) for the full pipeline.',
          keywords: ['100 cap', 'limit', 'export', 'all leads'],
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
              <li>On the <strong>Money</strong> tab, confirm the <strong>State</strong> is not already <em>Canceled</em>.</li>
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
            <p>It is at the very end of the <strong>Access</strong> tab and only Super admin and Billing see it. It is also absent when the club is already cancelled, or is on the free Tournament plan with no Stripe subscription on file. If the subscription was already canceled in Stripe but the FieldLogicHQ status was not updated, add a <strong>Subscription status</strong> override reading as Canceled, or change the base plan to the free Tournament tier with the pencil.</p>
          ),
          answerText: 'It is at the end of the Access tab and only Super admin and Billing see it. It is absent when the club is already cancelled or is on the free Tournament plan with no Stripe subscription. Use a subscription status override or a plan change if the subscription was already ended in Stripe.',
          keywords: ['cancel section missing', 'no stripe id', 'already canceled', 'door missing'],
        },
        {
          id: 'faq-cancel-vs-override',
          question: 'Should I cancel the subscription or just add a canceled status override?',
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
