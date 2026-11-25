/* eslint-disable react/no-unescaped-entities */
import type { HelpPageContent } from './index';
import { HelpDefs, HelpDef, HelpSteps, HelpNote } from '@/components/help/HelpBlocks';
import { BILLING_TAX_WORDS } from '@/lib/billing-tax';

const orgHelp: HelpPageContent = {
  title: 'Org admin & setup',
  role: 'Owner, Admin',
  intro: 'This guide covers your organization\'s setup — who can do what, how to invite members, and how to manage your org settings.',
  sections: [
    {
      heading: 'Your first 30 days',
      content: (
        <>
          <p>Getting FieldLogicHQ running for your org is a quick process. Running a Club? A checklist opens when you first sign in; see <a href="#recipe-set-up-your-club">How to set up your club</a>. Otherwise, work through these steps in order:</p>
          <ol>
            <li><strong>Invite your co-organizers.</strong> Go to <strong>Members</strong> and send invites to anyone who will help manage tournaments or run the league. Assign the Admin role for full co-organizer access.</li>
            <li><strong>Create your first tournament.</strong> Head to <strong>Tournaments</strong>, click <strong>New Tournament</strong>, and fill in the name, year, and URL slug.</li>
            <li><strong>Set up your org branding.</strong> In <strong>Public site &rsaquo; Look</strong>, upload your logo and pick your colours. Then confirm your web address in <strong>Settings</strong> before you share any links publicly.</li>
            <li><strong>Check your modules.</strong> If your plan includes House league, Rep teams, or Accounting, each appears automatically in the admin panel — there is no separate activation step. If you expect a module and don't see it, check your plan on <strong>Plan &amp; billing</strong>.</li>
            <li><strong>Invite your volunteers</strong> (Tournament Plus and above). Volunteers don&rsquo;t use the main admin area. In <strong>Members → Invite</strong>, choose the Volunteer role and what they&rsquo;re <strong>helping with</strong> (Scoring, The gate, or Both); their phone opens straight to that job.</li>
          </ol>
        </>
      ),
    },
    {
      id: 'recipe-set-up-your-club',
      group: 'How-to recipes',
      heading: 'How to set up your club',
      summary: 'The five-step checklist a new club owner lands on, and what to set up around it: settings, venues and permits, schedules, the books, families, email and the public site.',
      keywords: ['set up club', 'club setup', 'setup checklist', 'get ready for the season', 'staff your board', 'add your teams', 'head coach', 'public site', 'budget', 'families', 'club checklist', 'new club', 'club onboarding', 'start a club', 'setting up your club', 'back out of checkout', 'invite a coach', 'first run', 'first sign in', 'get started', 'what to set up first', 'venue library', 'permits', 'settings', 'payouts', 'communications', 'email families', 'meet your families', 'open families', 'set up a season', 'run one'],
      searchText: 'set up your club setup checklist get club ready for the season five steps staff your board invite admin treasurer add your teams season head coach every team invite a coach first team without one coaches page premium coaches portal put your club online tagline contact email public page both saved still needed contact email still needed tagline step not done plan the club budget what the season costs come back from overview go to overview checklist every sign in lands on checklist skip the checklist families not a step household appears automatically house league tournaments one line shortcuts get club ready for the season plan step choose club billing address agree to the terms start a club page started the club yourself club or club association side by side how many teams starts a trial no second trial before checkout billing address step of its own payment stripe page back out of stripe return to the plan step nothing charged sign in later same step setting up your club still setting up your club dont start another payment check again plan and billing after the checklist what to set up next organization settings web address when birthdays count from venue library venues facilities permits schedules calendar accounting ledger bank payouts families communications email families public site meet your families open families go to overview continue setup n of m teams without a head coach',
      content: (
        <p>A new Club owner lands on a five-step checklist, <strong>Set up your club</strong>, instead of the admin panel. The first answer walks the five steps; the second is what a club sets up around them, in the order most presidents do it.</p>
      ),
      subtopics: [
        {
          id: 'recipe-set-up-your-club-t-steps',
          title: 'The five checklist steps',
          content: (
            <>
              <p>When you sign in as a Club owner for the first time, you land on a five-step checklist, <strong>Set up your club</strong>, headed <strong>Get [your club] ready for the season</strong>. Each step opens the screen that does the job, and a step is marked done only once it genuinely is. The checklist keeps greeting you at sign-in until you press <strong>Go to Overview</strong> or finish every step; after that you sign in straight to the Overview.</p>
              <ol>
                <li><strong>Staff your board.</strong> Invite an admin and a treasurer so the work isn&rsquo;t all yours. Its <strong>Members</strong> button opens the Members page, where &ldquo;What each role can open&rdquo; shows what each role can do; read it, then press <strong>Invite</strong> and choose each person&rsquo;s role (see <a href="#recipe-invite-member">How to invite a member</a>). It is done once one other admin or treasurer has joined.</li>
                <li><strong>Add your teams.</strong> Each team, and the season it&rsquo;s playing. Its <strong>Rep teams</strong> button opens the team list (see <a href="../help/rep-teams#recipe-create-team-program-year">How to add a team and start its first season</a>).</li>
                <li><strong>Name a head coach for every team.</strong> Each coach gets the Premium Coaches Portal, included in your plan. <strong>Invite a coach</strong> opens the first team still without one &mdash; its Coaches page, where you enter their email (see <a href="../help/rep-teams#recipe-assign-coach-access">How to invite a coach</a>). The step reads &ldquo;n of m&rdquo;, and names the teams still without a head coach when three or fewer are left.</li>
                <li><strong>Put your club online.</strong> Its <strong>Public site</strong> button opens the Public site editor, where you add a tagline (<strong>About us</strong>) and a contact email (<strong>Families&rsquo; questions go to</strong>). The step is done once both are saved; when only one is missing, it says which (see <a href="#public-site-editor">Running your public site</a>).</li>
                <li><strong>Plan the club&rsquo;s budget.</strong> What the season costs, and what each team contributes. Its <strong>Budget</strong> button opens Accounting &rsaquo; Budget; the step is done once the club&rsquo;s budget for the current fiscal year has at least one line (see <a href="../help/accounting#budget">Budget</a>).</li>
              </ol>
              <p><strong>Meet your families</strong> is shown too, with an <strong>Open Families</strong> button, but it isn&rsquo;t a step you complete &mdash; as rosters fill, every household appears there on its own. If your club also runs a house league or hosts a tournament, those are one-line shortcuts at the foot of the checklist (<strong>Set up a season</strong>, <strong>Run one</strong>) rather than steps, since not every club runs either.</p>
              <p>You can leave and come back &mdash; <strong>Overview</strong> keeps a link back to this checklist (<strong>Continue setup</strong>) until every step is done, even after you have pressed <strong>Go to Overview</strong>.</p>
            </>
          ),
        },
        {
          id: 'recipe-set-up-your-club-t-next',
          title: 'Before the checklist, and what to set up around it',
          content: (
            <>
              <p>Before the checklist comes the plan: Club or Club · Association, the club&rsquo;s billing address, and the Terms. If you started the club yourself from the <strong>Start a club</strong> page, those came as steps after your account and the club&rsquo;s name:</p>
              <ol>
                <li><strong>The plan.</strong> Club and Club · Association side by side, by how many teams will have a Premium Coaches Portal (house league teams are unlimited). Each says whether this purchase starts a trial; if the club has had a subscription before, it says there&rsquo;s no second trial before you reach checkout.</li>
                <li><strong>The billing address</strong>, on a step of its own.</li>
                <li><strong>Payment</strong>, on Stripe&rsquo;s page. Back out of it and you return to the plan step, with nothing charged; sign in later and the club opens on that same step.</li>
                <li><strong>Setting up your club</strong> waits a few seconds while the payment is confirmed, then this checklist opens. If it takes longer it says <strong>Still setting up your club</strong>: don&rsquo;t start another payment, check again in a minute.</li>
              </ol>
              <p><strong>Plan &amp; billing</strong> (owner only) keeps all of that afterward (see <a href="#club-plan-and-billing">Plan &amp; billing</a>). The checklist covers the five things every rep club needs first; these are the rest, in the order most presidents reach them:</p>
              <ol>
                <li><strong>Settings.</strong> In <strong>Organization &rsaquo; Settings</strong>, check the club&rsquo;s name and web address before you share any link, and set <strong>When birthdays count from</strong> before you enter birth years on teams. The same page holds the two-step sign-in requirement (see <a href="#settings">Settings and your web address</a>).</li>
                <li><strong>Venues and permits.</strong> In <strong>Organization &rsaquo; Venue library</strong>, add the club&rsquo;s venues and their facilities; coaches, house league and tournaments pick from that list (see <a href="#venue-library">The Venue library</a>). Then add the town permits and dome contracts the club holds under <strong>Permits</strong>, directly under Calendar (see <a href="#permits">Permits</a>).</li>
                <li><strong>Hand out the time.</strong> Once teams and permits exist, <strong>Schedules</strong> shares the club&rsquo;s time among its teams and bills them for it (see <a href="#club-schedules">Schedules</a>). <strong>Calendar</strong> then shows every team&rsquo;s week and marks clashes (see <a href="#club-calendar">The club calendar</a>).</li>
                <li><strong>The books.</strong> After the budget, <strong>Accounting</strong> holds the ledger, the bank check, allocations to teams and the teams&rsquo; payment requests (see the <a href="../help/accounting">Accounting guide</a>). To let families and teams pay by card, the owner connects <strong>Payouts</strong> on <strong>Settings</strong> (see <a href="#settings-t-payouts">Payouts: let teams pay online</a>).</li>
                <li><strong>Families.</strong> As rosters fill, each household appears in <strong>Families</strong>, with who owes and who is missing forms (see the <a href="../help/families">Families guide</a>).</li>
                <li><strong>Email and your public site.</strong> The owner and admins write to families, coaches and the board from <strong>Communications</strong>, in the Club group of the sidebar, which also keeps the list of what went out (see the <a href="../help/communications">Communications guide</a>). Past the tagline and contact email, <strong>Public site</strong> holds your look, home page, contacts, documents and sponsors, and the switch that puts the site online (see <a href="#public-site-editor">Running your public site</a>).</li>
              </ol>
              <p>Day to day, the <a href="#club-overview">Overview</a> is where the club starts.</p>
            </>
          ),
        },
      ],
    },
    {
      id: 'roles',
      heading: 'Roles explained — who can do what',
      summary: 'What each role can open, at a glance, then Owner, Admin, Treasurer, Staff, League admin, League registrar, Coach, and Volunteer one by one.',
      keywords: ['roles', 'permissions', 'owner', 'admin', 'staff', 'treasurer', 'league admin', 'registrar', 'team manager', 'coach', 'volunteer', 'scorekeeper', 'gate', 'helping with', 'what each role can open', 'role guide', 'plan & billing', 'billing', 'audit log', 'families', 'who can finalize scores', 'change a final score', 'communications', 'email coaches', 'email the board', 'sponsorships', 'who can open sponsorships'],
      searchText: 'roles permissions who can do what sponsorships access on by default for owner admins treasurer manage member sponsorships row communications email coaches email the board group email switch owner admin staff treasurer league admin league registrar rep club no registrar team manager forms documents coach scorekeeper capabilities grant revoke org settings plan and billing subscription owner controls what each role can open role guide table rep teams accounting public site house league tournaments families members audit log locked owner only rows volunteer helping with scoring the gate both field scores check-in settings two-step sign-in card admin reads it only the owner changes this',
      content: (
        <p>Every member of your organization holds one of these roles, and the role decides what they can open. Owners can grant or remove individual programs for any member from <strong>Members → Manage</strong>.</p>
      ),
      subtopics: [
        {
          id: 'roles-t-table',
          title: 'What each role can open',
          content: (
            <>
              <table>
                <thead>
                  <tr>
                    <th scope="col">Program</th>
                    <th scope="col">Owner</th>
                    <th scope="col">Admin</th>
                    <th scope="col">Treasurer</th>
                    <th scope="col">Staff</th>
                    <th scope="col">League admin</th>
                    <th scope="col">League registrar</th>
                    <th scope="col">Volunteer</th>
                    <th scope="col">Coach</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><th scope="row">Rep teams</th><td>✓</td><td>✓</td><td>team names only</td><td>—</td><td>—</td><td>—</td><td>—</td><td>their team, in the portal</td></tr>
                  <tr><th scope="row">Accounting</th><td>✓</td><td>✓</td><td>✓</td><td>—</td><td>—</td><td>—</td><td>—</td><td>their team&rsquo;s money</td></tr>
                  <tr><th scope="row">Sponsorships</th><td>✓</td><td>✓</td><td>✓</td><td>if you turn it on</td><td>if you turn it on</td><td>if you turn it on</td><td>if you turn it on</td><td>—</td></tr>
                  <tr><th scope="row">Public site</th><td>✓</td><td>✓</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td></tr>
                  <tr><th scope="row">House league · Tournaments</th><td>✓</td><td>✓</td><td>—</td><td>game day</td><td>the house league</td><td>registrations, fees &amp; Email families</td><td>scores &amp; gate</td><td>—</td></tr>
                  <tr><th scope="row">Communications</th><td>✓</td><td>✓</td><td>the board</td><td>—</td><td>house-league coaches &amp; the board</td><td>house-league coaches &amp; the board</td><td>—</td><td>—</td></tr>
                  <tr><th scope="row">Families</th><td>✓</td><td>if you turn it on</td><td>if you turn it on</td><td>—</td><td>if you turn it on</td><td>if you turn it on</td><td>—</td><td>—</td></tr>
                  <tr><th scope="row">Members</th><td>✓</td><td>✓</td><td>view</td><td>—</td><td>view</td><td>—</td><td>—</td><td>—</td></tr>
                  <tr><th scope="row">Plan &amp; billing (default access) · Audit log</th><td>✓</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td></tr>
                  <tr><th scope="row">Settings</th><td>✓</td><td>Your privacy policy; the Two-step sign-in card, to read</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td></tr>
                </tbody>
              </table>
              <p><strong>✓</strong> is full access; a shorter answer is the exact slice that role gets — &ldquo;view&rdquo; opens a program read-only, and &ldquo;if you turn it on&rdquo; means the owner has to grant it by hand (Sponsorships is on by default for the owner, admins and the treasurer, and a club can turn it on for anyone else, a registrar for example; Families is never on by default for anyone but the owner, and it can&rsquo;t be given to a member limited to some Rep teams groups: a family&rsquo;s record spans every team its children play on). A row only appears on your own organization once your plan includes that program. <strong>Communications</strong> is on for every seat that has something to write to, unless the owner turns it off for a member (see the <a href="../help/communications">Communications guide</a>); it doesn&rsquo;t need Families access.</p>
              <p><strong>Admin</strong> opens every program the plan carries — the moment it&rsquo;s included, with no separate setup step. It opens <strong>Families</strong> only when the owner grants that access; emailing families from <strong>Communications</strong> doesn&rsquo;t need it. <strong>Plan &amp; billing</strong> and the audit log stay with the owner and can&rsquo;t be handed out. An admin opens <strong>Settings</strong> to set <strong>Your privacy policy</strong> and to read the <strong>Two-step sign-in</strong> card, and nothing else there: every other Settings card is the owner&rsquo;s. The menu lists only what you can open. An admin can still change the club&rsquo;s logo, colours, type and banner in <strong>Public site</strong>; only the owner turns the site on or off.</p>
            </>
          ),
        },
        {
          id: 'roles-t-roles',
          title: 'The roles, one by one',
          content: (
            <>
              <ul>
                <li><strong>Owner</strong> — Full access. Only the owner can open Plan &amp; billing, change Settings, or cancel or reduce the plan. Assigned at org creation; ownership can&rsquo;t be transferred through the admin panel.</li>
                <li><strong>Admin</strong> — Runs operations: every program the plan carries, members, and the public site&rsquo;s look (logo, colours, type and banner, in <strong>Public site</strong>). Cannot turn the public site on or off, or open the audit log. Opens Settings only to set <strong>Your privacy policy</strong> and to read the <strong>Two-step sign-in</strong> card; every other Settings card is the owner&rsquo;s, and so is changing the two-step one. Sees each member&rsquo;s two-step sign-in on Members and can reset it (see <a href="#two-step-sign-in">Two-step sign-in</a>). Families needs the owner&rsquo;s explicit grant (emailing families from Communications doesn&rsquo;t); Plan &amp; billing stays with the owner.</li>
                <li><strong>Treasurer</strong> — Runs the books: ledgers, the budget, what the club bills its teams, and the teams’ payment requests. Can see the team names money is allocated to, without a Rep teams door of their own.</li>
                <li><strong>Staff</strong> — Day-of operator. Updates game times and venue assignments, submits scores, and posts announcements. Cannot finalize scores or change a result that&rsquo;s already final, create tournaments, manage registrations, or email the club&rsquo;s families, coaches or board.</li>
                <li><strong>League admin</strong> — Runs the house league: seasons, registrations, fees, teams, schedules, and Email families. In <strong>Communications</strong>, emails house-league coaches and the board and reads the emails that reached house-league people. Can view the member list.</li>
                <li><strong>League registrar</strong> — Works house league registrations (approve, decline, withdraw, add by hand), marks fees received, and uses Email families. In <strong>Communications</strong>, emails house-league coaches and the board and reads the emails that reached house-league people. Reads the rest of a season but cannot change seasons, teams or schedules, or see the member list.</li>
                <li><strong>Coach</strong> — Accesses the Coaches Portal for their assigned rep team. Cannot access the main admin panel.</li>
                <li><strong>Volunteer</strong> — Enters scores, checks teams in at the gate, or both, from their phone: whatever they&rsquo;re <strong>helping with</strong>, chosen when you invite them. Scoring opens <strong>Field scores</strong>, the gate opens <strong>Check-in</strong>. Doesn&rsquo;t access the admin panel at all.</li>
              </ul>
              <p><strong>A rep club has no registrar role.</strong> The registration-type work on a rep team — forms, documents, keeping the roster tidy — belongs to that team&rsquo;s <strong>team manager</strong>: a staff member the head coach adds on the team&rsquo;s <strong>Staff</strong> page in the Coaches Portal. League registrar is for house league only.</p>
              <p>Owners can grant or revoke individual programs on any member from <strong>Members → Manage</strong> — a chip on their row marks anything different from their role&rsquo;s defaults. A volunteer&rsquo;s Manage shows <strong>Helping with</strong> instead, which anyone who can invite members can change.</p>
            </>
          ),
        },
      ],
      faqs: [
        {
          id: 'faq-switch-admin-coach-view',
          question: 'I run the tournament and also coach a team — how do I move between admin and my coach view?',
          answerText: 'If you are an owner or admin who also coaches, the admin area shows a Coaches Portal door (in the foot of the desktop sidebar and, on mobile, under More → You) that opens your coach view. From inside your coaches portal, a Club door returns you to the admin area, at your own starting page: the Overview for an owner or admin, Accounting for a treasurer, House league for a league admin or registrar. A treasurer, league admin or registrar who also coaches gets that link too. On mobile, the admin More menu also has a You section with Account, What’s new, Home, the other portals (Club, Tournaments, Coaches Portal) and Plan & billing, so you can reach your own account without leaving admin. On a computer, Help, Sign out and Send feedback are in the account menu (the person icon, top right), not the sidebar; Help sits right under What’s new. On a phone they are at the foot of More, with Help. A member with only the Coach role still cannot open the admin panel.',
          keywords: ['coaches portal door', 'admin link', 'back to admin', 'treasurer who coaches', 'league admin who coaches', 'registrar who coaches', 'coach view', 'switch admin coach', 'both admin and coach', 'run tournament and coach', 'account from admin', 'sign out', 'where is sign out', 'log out', 'send feedback', 'help on phone', 'account menu', 'admin sidebar foot', 'help in account menu', 'where is help', 'club door', 'events'],
          answer: (
            <>
              <p>If you&rsquo;re an <strong>owner</strong> or <strong>admin</strong> who also coaches, the admin area shows a <strong>Coaches Portal</strong> door (in the foot of the desktop sidebar, and on mobile under <strong>More → You</strong>) that opens your coach view. From inside your coaches portal, a <strong>Club</strong> door brings you back, at your own starting page: the <strong>Overview</strong> for an owner or admin, <strong>Accounting</strong> for a treasurer, <strong>House league</strong> for a league admin or registrar. A treasurer, league admin or registrar who also coaches gets that door too, on a computer and on a phone (under <strong>More → You</strong>).</p>
              <p>On mobile, that same admin <strong>More</strong> menu has a <strong>You</strong> section with <strong>Account</strong>, <strong>What&rsquo;s new</strong>, <strong>Home</strong>, the other portals you hold (<strong>Club</strong>, <strong>Tournaments</strong>, <strong>Coaches Portal</strong>) and <strong>Plan &amp; billing</strong>, so you can reach your own account without leaving admin. On a computer, <strong>Help</strong>, <strong>Sign out</strong> and <strong>Send feedback</strong> are in your <strong>account menu</strong> (the person icon, top right), not the sidebar; <strong>Help</strong> sits right under <strong>What&rsquo;s new</strong> and opens the help for the section you are in, in a new tab. On a phone they sit at the foot of <strong>More</strong>, with <strong>Help</strong>. A member with <em>only</em> the Coach role still can&rsquo;t open the admin panel — these doors appear only when the same account holds both.</p>
            </>
          ),
        },
      ],
    },
    {
      id: 'the-board',
      group: 'How-to recipes',
      heading: 'The board — who runs the club',
      summary: 'Organization › The board lists who runs the club, by name and role, for a member who doesn’t hold Members.',
      keywords: ['the board', 'board', 'who runs the club', 'club executive', 'who is the owner', 'who are the admins', 'names and roles'],
      searchText: 'the board organization tab who runs the club names and roles only no email no phone read only owner admins invite people change roles members not yours registrar treasurer league admin club executive only organization tab for a registrar',
      content: (
        <>
          <p><strong>The board</strong> is the Organization tab for a member who doesn&rsquo;t hold Members: a treasurer, a registrar, a league admin. For a registrar it is the only Organization tab. It lists who runs the club, each person&rsquo;s name and role and nothing else &mdash; never an email or a phone number.</p>
          <p>It is read-only. The owner and the club&rsquo;s admins invite people and change their roles, on <strong>Members</strong>. What each role opens is in <a href="#roles">Roles explained</a>.</p>
        </>
      ),
    },
    {
      id: 'recipe-invite-member',
      group: 'How-to recipes',
      heading: 'How to invite a member and choose the right role',
      summary: 'Add a new admin, treasurer, staff member, registrar, or volunteer without over-granting access.',
      keywords: ['invite member', 'role', 'permissions', 'staff', 'admin', 'treasurer', 'registrar', 'coach', 'volunteer', 'scorekeeper', 'helping with', 'change a volunteer’s job', 'accept invitation', 'email link', 'runs the club', 'house league group', 'volunteers group', 'another organization', 'coach staff page', 'choose a role', 'no default role', 'invitation email', 'you’ve been added', 'added email', 'what is fieldlogichq', 'already has an account', 'invited not yet joined', 'cancel invitation', 'resend invite', 'sign in to accept', 'accept on home page', 'invite a coach to the board', 'coach already in the club', 'coaches here', 'decline invitation', 'invitation ran out', 'invitation expired', 'invite expired', 'resend expired invite', '30 days', 'which club are you joining', 'invited by two clubs', 'invited by more than one club', 'more than one invitation'],
      searchText: 'which club are you joining invited by more than one club two invitations choose a club password is kept the other invitation stays on home no default role choose a role send invite stays off until a role is chosen what the invitation email says what the role opens what fieldlogichq is already has an account sign in to accept accept or decline on their home page invitations card invited not yet joined shows as invited until they accept sees nothing of the club until they accept cancel invitation keep it resend invite invitation was cancelled setup link expires in 24 hours you have been added email board role on the spot lands on their own home accounting house league invite member choose role permissions owner admin staff treasurer league admin league registrar coach scorekeeper resend pending invite seats invited person signed up created their own organization by mistake wrong organization sign-up recognizes email me my invitation link accept invitation setup link grouped role list runs the club house league volunteers sentence under the field already a member at another club verified network one home organization coaches added on the team staff page invite a coach already in the club to a board role coaches here note invited keeps coaching either way accept or decline club is told cancel sends no email to offer a different role cancel and invite again invitation ran out run out expired expire lapsed 30 days last sent resend to send it again no longer holds a seat seat count drops invitation has run out ask the club to send it again their invitation has run out resend it from their row run out invitation does not stop starting own club or league board role offer runs out coaching untouched invitation names who sent it lands where role starts volunteer helping with scoring the gate both change it any time in members manage at least one job lands on field scores or check-in one home organization',
      links: [
        { label: 'Members', href: '../org/members' },
      ],
      content: (
        <>
          <p>Use this when someone needs to help run the club or organization, a tournament, house league, rep teams, accounting, or score entry. The answers below cover sending the invite, what the email says, what happens when an invitation runs out, who can be invited here, and where each person lands.</p>
        </>
      ),
      subtopics: [
        {
          id: 'recipe-invite-member-send',
          title: 'Send the invite',
          content: (
            <>
                <ol>
                  <li>Go to <strong>Members</strong>.</li>
                  <li>Click <strong>Invite</strong>.</li>
                  <li>Enter the person&rsquo;s email address.</li>
                  <li>Choose their role from the one dropdown, grouped as <strong>Runs the club</strong> (or organization), <strong>House league</strong> (shown once your club runs one), and <strong>Volunteers</strong>. No role is chosen for you: the field starts on <strong>Choose a role</strong> and <strong>Send invite</strong> stays off until you pick one. A sentence under the field then says exactly what that role opens.</li>
                  <li>For a volunteer (Tournament Plus and above; the free Tournament plan has no volunteer role), choose what they&rsquo;re <strong>Helping with</strong>: <strong>Scoring</strong>, <strong>The gate</strong>, or <strong>Both</strong>. The line under it says what they&rsquo;ll be able to do, and they&rsquo;ll land straight on that job. You can change it later in <strong>Manage</strong>.</li>
                  <li>Send the invite, then confirm the person appears as <strong>Invited</strong> until they accept. A new person gets a setup link that expires in 24 hours. Someone who already has a FieldLogicHQ account isn&rsquo;t added on the spot: the confirmation reads <em>They already have an account, so they&rsquo;ll accept it on their Home page when they sign in. They show as invited until then.</em></li>
                  <li>Inviting someone who already coaches in your club works the same way. Nothing changes on the spot: they get <strong>Sign in to accept</strong> and an invitation card on their Home page, and show on Members as <strong>Invited</strong> with a <strong>Coaches here</strong> note. They keep coaching either way. <strong>Manage</strong> shows only the role you offered, so to offer a different one, choose <strong>Cancel invitation&hellip;</strong> and invite again. Cancelling sends no email and leaves their coaching as it was.</li>
                </ol>
            </>
          ),
        },
        {
          id: 'recipe-invite-member-email',
          title: 'What the invitation email says',
          content: (
            <>
                <p>The invitation names your club, who sent it, the role, what that role opens (the same sentence they&rsquo;ll see when they accept), and one line on what FieldLogicHQ is, so a new treasurer knows it&rsquo;s the club&rsquo;s own system and not a payment request. Someone who already has a FieldLogicHQ account gets the same email with a <strong>Sign in to accept</strong> button instead of a setup link. They accept or decline on their <strong>Home</strong> page when they sign in, in the invitations card, and see nothing of your club until they accept. They show as invited on <strong>Members</strong> until then, and any two-step days start when they accept. Declining leaves things exactly as they were, and the club is told. Nobody is added to a club without accepting, and there is no separate &ldquo;you&rsquo;ve been added&rdquo; email.</p>
                <p><strong>Invited members don&rsquo;t get a password</strong> — the email has a setup link they must click to finish creating their account; clicking &ldquo;log in&rdquo; first shows an incorrect-email-or-password error, so ask them to check spam and use <strong>Resend invite</strong> in <strong>Manage</strong> on their row if it&rsquo;s missing. If they sign up on their own instead, FieldLogicHQ recognizes their email and offers to email them the invitation link, so they land in your organization rather than starting a new one.</p>
            </>
          ),
        },
        {
          id: 'recipe-invite-member-ran-out',
          title: 'When an invitation runs out',
          content: (
            <>
                <p>An invitation stays open for 30 days from the last time it was sent. After that it has run out. Resending opens it for another 30 days.</p>
                <ul>
                  <li><strong>On Members</strong> the row reads <strong>Invitation ran out</strong> in amber (on a phone, <em>[role] &middot; invitation ran out</em>). <strong>Manage</strong> says <em>invitation ran out, Resend to send it again</em>.</li>
                  <li><strong>It holds no seat.</strong> The staff seat count drops while it is run out. Resending a run-out invitation needs a free seat, so at the plan&rsquo;s limit you are asked to free a seat or upgrade first.</li>
                  <li><strong>The person</strong> no longer sees it on Home and can&rsquo;t accept it. The link says <em>This invitation has run out. Ask [club] to send it again.</em></li>
                  <li><strong>Inviting the same email again</strong> says <em>Their invitation has run out. Resend it from their row on Members.</em></li>
                  <li><strong>It doesn&rsquo;t block them elsewhere.</strong> A run-out invitation doesn&rsquo;t stop that person from starting their own club or league. A coach who was offered a board role keeps coaching either way.</li>
                  <li><strong>After another 30 days it is removed.</strong> Sixty days after the last send, a run-out invitation leaves Members on its own, and the member log notes <em>Invitation removed after it ran out</em>. To ask them again after that, send a new invitation.</li>
                </ul>
            </>
          ),
        },
        {
          id: 'recipe-invite-member-who',
          title: 'Who can be invited here',
          content: (
            <>
                <p><strong>Coaches aren&rsquo;t invited from here.</strong> A team&rsquo;s head coach adds and removes their own coaching staff on that team&rsquo;s own staff page — coaching rows never appear in this dropdown.</p>
                <p><strong>Someone already active at another club or organization can accept your invite too</strong> — the same person can hold roles at more than one, and accepting yours doesn&rsquo;t remove them from anywhere else. The one exception is a volunteer, who keeps a single home organization.</p>
                <p><strong>Invited by more than one club?</strong> If the link in an email names no club and you have invitations waiting from several, the page asks <em>Which club are you joining?</em> and you choose one. If it asks after you have set your password, the password is kept and only the joining waits for your answer. The other invitations stay open on your Home page to accept or decline there, until they run out (30 days from the last send).</p>
            </>
          ),
        },
        {
          id: 'recipe-invite-member-lands',
          title: 'Where each role lands',
          content: (
            <>
                <p>Owners hold Settings and Plan &amp; billing, admins run every program the plan carries, staff and volunteers handle day-of work, and each accepted invite names who sent it and opens straight to where that role&rsquo;s work starts — a treasurer in Accounting, a league role in the house league, a volunteer on their job (Field scores or Check-in), everyone else at the admin overview. Someone who already has an account accepts on their Home page and then opens to the same place, and so does every later sign-in.</p>
            </>
          ),
        },
      ],
      faqs: [
        {
          id: 'faq-best-role-for-helper',
          question: 'What role should I give a new volunteer?',
          answerText: 'Choose the narrowest role that lets them do their job. Use Volunteer for scoring games or checking teams in at the gate (choose which under Helping with), Staff for wider day-of operations, Treasurer for accounting, League registrar for registration review, and Coach for team portal access.',
          keywords: ['role', 'volunteer', 'permissions', 'least access', 'scorekeeper', 'gate', 'helping with'],
          popular: true,
          answer: (
            <p>Choose the narrowest role that lets them do their job. Use <strong>Volunteer</strong> for scoring games or checking teams in at the gate (choose which under <strong>Helping with</strong>), <strong>Staff</strong> for wider day-of tournament help, <strong>Treasurer</strong> for accounting, <strong>League registrar</strong> for registration review, and <strong>Coach</strong> for coach portal access.</p>
          ),
        },
        {
          id: 'faq-scorekeeper-member-access',
          question: 'What access does a volunteer get?',
          answerText: 'Volunteers are Tournament Plus and above; the free Tournament plan has no volunteers. A volunteer gets one or both of two phone screens, by what they are helping with: Field scores for scoring, Check-in for the gate. On Field scores they can enter scores and correct one that is still Pending review, but they cannot change a result that is already final. They do not get the main admin panel.',
          keywords: ['volunteer', 'scorekeeper', 'official', 'gate', 'volunteer access', 'scorekeeper access', 'field scores', 'check-in', 'change a final score', 'what they can open'],
          answer: (
            <>
              <p>Volunteers are part of <strong>Tournament Plus</strong> and above; the free Tournament plan has no volunteers. A volunteer gets one or both of two phone screens, by what they&rsquo;re <strong>helping with</strong>: <strong>Field scores</strong> for scoring, <strong>Check-in</strong> for the gate. Members&rsquo; &ldquo;What they can open&rdquo; reads <strong>Scores</strong>, <strong>The gate</strong>, or <strong>Scores and the gate</strong>.</p>
              <p>On Field scores they can enter scores and correct one that&rsquo;s still <strong>Pending review</strong>, but they can&rsquo;t change a result that&rsquo;s already final. They don&rsquo;t get registrations, settings, billing, exports, communications, or the main admin panel.</p>
            </>
          ),
        },
      ],
    },
    {
      id: 'recipe-fix-member-access',
      group: 'How-to recipes',
      heading: 'How to fix member access problems',
      summary: 'Troubleshoot missing pages, locked buttons, pending invites, suspended users, and module access.',
      keywords: ['member cannot access', 'missing page', 'permission', 'suspended', 'pending invite', 'module access', 'what they can open', 'chip', 'role default', 'turn on', 'turn off', 'one save', 'coach staff page', 'volunteer no access', 'volunteer cannot score', 'helping with', 'lost phone', 'code screen', 'two-step'],
      searchText: 'member lost phone stuck at the code screen two-step reset cannot access missing page locked button permission role capability suspended pending invite resend invitation ran out expired module not enabled plan and billing subscription seat limit what they can open chip role default turn on turn off consequence sentence one save emailed what changed suspend confirm remove confirm coaching staff staff page',
      links: [
        { label: 'Members', href: '../org/members' },
        { label: 'Plan & billing', href: '../org/billing' },
      ],
      content: (
        <>
          <p>When someone says they can&rsquo;t see a page or action, start with the Members list itself:</p>
          <ol>
            <li><strong>Read &ldquo;What they can open&rdquo; on their row first.</strong> It&rsquo;s computed from their role plus any per-program change, with a chip for anything different from their role&rsquo;s default (for example &ldquo;+ Families&rdquo; or &ldquo;– Accounting&rdquo;) — the answer is usually right there.</li>
            <li><strong>Confirm they accepted the invite.</strong> Invited members can&rsquo;t use the admin panel until they accept, and someone who already had an account accepts on their Home page. Resend from inside <strong>Manage</strong>, or choose <strong>Cancel invitation&hellip;</strong> there to withdraw it. A row reading <strong>Invitation ran out</strong> was sent more than 30 days ago and can&rsquo;t be accepted: <strong>Resend invite</strong> opens it for another 30 days.</li>
            <li><strong>Check whether they&rsquo;re suspended.</strong> A suspended row stays listed but can&rsquo;t sign in until you reinstate them. <strong>Suspend</strong> asks you to confirm first; <strong>Reinstate</strong> takes effect straight away.</li>
            <li><strong>Open Manage and look at &ldquo;What [name] can open.&rdquo;</strong> Each program starts the way the role has it, and you set it <strong>On</strong> or <strong>Off</strong> for this person. A row set differently from the role says <strong>Changed for</strong> them under its name, and a sentence appears under it the moment your change would open or close it for them. For a volunteer, Manage shows <strong>Helping with</strong> instead: a volunteer who meets &ldquo;No access&rdquo; on Field scores or Check-in doesn&rsquo;t hold that job yet.</li>
            <li><strong>Check the plan carries the module at all.</strong> A member can&rsquo;t open Rep teams, Accounting, Public site, or House league if the plan doesn&rsquo;t include it — see <strong>Plan &amp; billing</strong>.</li>
            <li><strong>Check seat limits.</strong> At the plan&rsquo;s seat limit, a new admin or staff member may need an upgrade before they can be added, and so may resending a run-out invitation; volunteers and coaching staff never count toward it.</li>
          </ol>
          <p><strong>Coaching staff aren&rsquo;t managed here.</strong> A team&rsquo;s head coach adds and removes their own coaching staff on that team&rsquo;s own staff page, never in Members — if the problem is a coach&rsquo;s access to their team, that&rsquo;s where to look.</p>
          <p>Manage saves every change — role, title, name and program access — in <strong>one Save</strong>, and emails the person what changed the moment their role or an override actually moves something they can open.</p>
          <p>If all of that looks correct and access is still wrong, capture the person&rsquo;s email, role, expected page, and exact error message before contacting support.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-member-missing-module',
          question: 'Why can a member not see House league, Rep teams, or Accounting?',
          answerText: 'The member needs both a role/capability that allows the workflow and an enabled module on the organization plan.',
          keywords: ['missing module', 'module access', 'house league', 'rep teams', 'accounting'],
          popular: true,
          answer: (
            <p>They need both the right member access and the right organization module. Check their row&rsquo;s &ldquo;What they can open&rdquo; on <strong>Members</strong>, then confirm the module is included on <strong>Plan &amp; billing</strong>.</p>
          ),
        },
        {
          id: 'faq-member-removal-account',
          question: 'What happens to someone’s sign-in when I remove them from the club?',
          answerText: 'Removing a member takes them out of your club. Their account is kept, so they can still sign in, when they belong to another organization, have a free Coaches Portal team, or are a connected parent in any club. Otherwise the account is permanently deleted and they need a new invitation to come back. The removal window says which applies before you confirm. A pending invitation is cancelled instead, in Manage: the person can no longer join with it and is not emailed, and their own account is not affected.',
          keywords: ['remove member', 'removing a member', 'delete account', 'account kept', 'sign in', 'parent', 'family connection', 'new invitation', 'another organization'],
          answer: (
            <>
              <p>Pressing <strong>Remove</strong> on a member opens a window that says what happens to their account before you confirm.</p>
              <ul>
                <li><strong>The account is kept</strong> when the person belongs to another organization, has a free Coaches Portal team, or is a connected parent (a family connection to a child&rsquo;s team, in any club). They lose access to your club only, and a connected parent can still sign in to see their family.</li>
                <li><strong>The account is deleted</strong> when it has no other use. They would need a new invitation to come back.</li>
              </ul>
              <p>If the window can&rsquo;t check, it says so and removes nothing; close it and try again.</p>
              <p>Someone who hasn&rsquo;t accepted yet is cancelled, not removed. <strong>Cancel invitation&hellip;</strong> in <strong>Manage</strong> asks <em>Cancel [name]&rsquo;s invitation?</em>: they won&rsquo;t be able to join with it and won&rsquo;t be emailed. Their own FieldLogicHQ account isn&rsquo;t affected; only an account the invitation itself set up for a brand-new person is deleted with it.</p>
            </>
          ),
        },
      ],
    },
    {
      id: 'recipe-enable-modules',
      group: 'How-to recipes',
      heading: 'How to find the modules included in your plan',
      summary: 'Modules appear automatically when your plan includes them — here is where to confirm what you have.',
      keywords: ['module', 'house league', 'rep teams', 'accounting', 'public organization page', 'included in plan'],
      searchText: 'module included in plan house league rep teams accounting public organization page subscription billing upgrade module missing automatic no activation',
      links: [
        { label: 'Plan & billing', href: '../org/billing' },
      ],
      content: (
        <>
          <p>Modules appear in the admin navigation automatically once your plan includes them — there is no separate activation step.</p>
          <ol>
            <li>Open <strong>Plan &amp; billing</strong> at the foot of the sidebar, or in <strong>More &gt; You</strong> on a phone. Only the owner sees it.</li>
            <li>Review your current plan and its included modules.</li>
            <li>Look in the left navigation — included modules show up there for members with matching access.</li>
            <li>If a module is missing, it is not part of your current plan. Review upgrade options, or contact support if you believe it should already be included.</li>
          </ol>
          <p>Having a module gives the organization the feature. Members still need the correct role or capability before they can use it.</p>
        </>
      ),
    },
    {
      id: 'collapse-sidebar',
      group: 'How-to recipes',
      heading: 'How to collapse the sidebar',
      summary: 'Fold the sidebar to a narrow strip of icons so the page beside it gets more room, and open it again.',
      keywords: ['sidebar', 'collapse sidebar', 'collapse', 'expand sidebar', 'expand', 'icons', 'icon strip', 'strip', 'more room', 'more space', 'hide the sidebar', 'smaller sidebar', 'narrow sidebar', 'laptop', 'wider page', 'tabs under the title', 'phone tabs', 'phone bar', 'bottom bar', 'calendar on phone', 'shortcut tiles', 'tiles in more', 'where is house league on my phone', 'where is families on my phone', 'where is schedules on my phone'],
      searchText: 'collapse the sidebar fold the sidebar shrink the sidebar hide the sidebar make the sidebar smaller narrow strip of icons icon strip more room more space for the page laptop small screen schedules grid wider expand sidebar open the sidebar again get the sidebar back last row of the sidebar point at an icon to see its name tab to an icon name count on the corner of the icon waiting count every icon goes straight to its place no menus pages are tabs under the title rep teams team season accounting families organization remembered on this computer this browser every portal coaches portal tournaments never collapses by itself phone tablet bottom bar unchanged more menu on a phone programs club overview help on phone sidebar foot phone tabs phone bar overview calendar rep teams accounting more shortcut tiles schedules house league families tiles at the top of more calendar on phone where is house league on my phone where is families on my phone where is schedules on my phone no tiles',
      content: (
        <>
          <p>On a computer you can fold the sidebar down to a narrow strip of icons. The page beside it gets the room, which helps on a laptop and on wide screens like <strong>Schedules</strong>.</p>
          <HelpSteps>
            <li>Click <strong>Collapse sidebar</strong>, the last row of the sidebar.</li>
            <li>To open it again, click the icon at the bottom of the strip, <strong>Expand sidebar</strong>.</li>
          </HelpSteps>
          <HelpDefs>
            <HelpDef term="Names">Point at an icon, or tab to it, to see its name.</HelpDef>
            <HelpDef term="Counts">A waiting count sits on the corner of its icon.</HelpDef>
            <HelpDef term="Places">In the club admin every icon goes straight to its place. A place with several pages (Rep teams, a team, a season, Accounting, Families, Organization) shows them as tabs under its title, so the strip has no menus.</HelpDef>
          </HelpDefs>
          <HelpNote variant="info" title="Remembered on this computer">Your choice is kept in this browser for every part of FieldLogicHQ you use there: the club admin, your tournaments and the Coaches Portal. Nothing collapses by itself. Phones and tablets held upright don&rsquo;t change; they use the bar at the bottom.</HelpNote>
          <HelpNote variant="info" title="On a phone">The bar at the bottom reads <strong>Overview</strong>, <strong>Calendar</strong>, <strong>Rep teams</strong>, <strong>Accounting</strong> and <strong>More</strong>. A page you or your plan can&rsquo;t open is replaced by the next program your club runs. <strong>More</strong> opens with <strong>Notifications</strong>, then three shortcut tiles: <strong>Schedules</strong>, <strong>House league</strong> and <strong>Families</strong>. House league is a tile once your club runs a season; until then it&rsquo;s a quiet row under <strong>Also on your plan</strong>. With fewer than three to show there are no tiles, and those pages stay rows in More. Below the tiles, More lists the rest of your places under the sidebar&rsquo;s own headings, each once.</HelpNote>
        </>
      ),
    },
    {
      id: 'places-and-tabs',
      group: 'How-to recipes',
      heading: 'Finding your way: places in the sidebar, pages as tabs',
      summary: 'The club sidebar lists places and stays the same on every screen; each place shows its pages as tabs under its title.',
      keywords: ['sidebar', 'navigation', 'menu', 'tabs', 'tab row', 'where is', 'where did it go', 'places', 'programs', 'club', 'also on your plan', 'team pages', 'season pages', 'roster', 'switch season', 'organization tabs', 'back', 'bookmark', 'lit row', 'help in account menu', 'where is help', 'club door', 'tournaments door', 'sidebar foot', 'events', 'question mark', 'where is the help icon', 'help for this page'],
      searchText: 'finding your way around the sidebar lists places only overview calendar permits schedules programs rep teams house league tournaments also on your plan club accounting families public site organization nothing opens under a row no arrows the same rows on every screen communications emails to families one lit row the place you are in tab row under the title pages are tabs team page roster schedule tryouts coaches back to teams season overview registrations teams and draft schedule standings money email families back to seasons season name chevron switch season members the board audit log settings venue library pdf settings plan and billing stays at the foot of the sidebar tournaments door club door coaches portal door in the foot where is help help in the account menu under what’s new the question mark in the top strip between the bell and the account button opens the help for this page on a phone the last thing in the bar after the globe where is the help icon where did tournaments go where did club overview go phone tab row scrolls sideways back button bookmark lands on the same tab view site live site public site button top right globe on a phone back arrow in the header child page past season no tabs page that isn’t yours not one of your pages who opens it back to your home where did the team menu go where did the season menu go where is the organization page',
      content: (
        <>
          <p>The club sidebar lists <strong>places</strong>, and it has the same rows on every screen. One row is lit: the place you are in, however deep you go. A place&rsquo;s pages are the tabs under its title.</p>
          <HelpDefs>
            <HelpDef term="The sidebar">Overview, Calendar, Permits and Schedules, then <strong>Programs</strong> (Rep teams, House league) and <strong>Club</strong> (Accounting, Families, Communications, Public site, Organization). Communications shows while group email is on for your club, for the owner and admins, for a league admin or registrar who runs the club&rsquo;s house league, and for a treasurer, whose place holds the board emails they sent or received (not for anyone limited to some team groups). A program your club hasn&rsquo;t started sits under <strong>Also on your plan</strong>. Once your club has a tournament, <strong>Tournaments</strong> is a door in the foot of the sidebar instead (see below); until then it waits under <strong>Also on your plan</strong>, and if tournaments are your only program it stays a row under Programs. You see only the places you can open. On a phone, <strong>Permits</strong> is a row in the <strong>More</strong> sheet.</HelpDef>
            <HelpDef term="A team">Open it from <strong>Rep teams &rsaquo; Teams</strong>. Its tabs are Team page, Roster, Schedule, Tryouts and Coaches. <strong>&larr; Teams</strong> takes you back.</HelpDef>
            <HelpDef term="A season">Open it from <strong>House league</strong>. Its tabs run from Overview to Email families. Click the arrow beside the season&rsquo;s name to switch seasons; you stay on the same tab. <strong>&larr; Seasons</strong> takes you back.</HelpDef>
            <HelpDef term="Organization">Members (or <strong>The board</strong>, if Members isn&rsquo;t yours), Audit log, Settings, Venue library and PDF settings: the tabs you hold. The Venue library is a tab only for the people who schedule, run tournaments or handle the money, so a registrar&rsquo;s Organization holds <strong>The board</strong> alone. The club&rsquo;s permits are not here: they have their own place, <strong>Permits</strong>, in the sidebar.</HelpDef>
            <HelpDef term="The foot">The bottom of the sidebar reads, in one order: <strong>Plan &amp; billing</strong> (owner only), a thin line, then a door to each other portal you hold &mdash; <strong>Tournaments</strong> (once your club has a tournament), <strong>Coaches Portal</strong> &mdash; then <strong>Collapse sidebar</strong>. <strong>Help</strong> is not in the sidebar on a computer: it is in your <strong>account menu</strong> (the person icon, top right), right under <strong>What&rsquo;s new</strong>, and opens the help for the section you are in, in a new tab. On a phone, Help stays at the bottom of <strong>More</strong>.</HelpDef>
            <HelpDef term="The page&rsquo;s ?">On a page that has help of its own, the <strong>?</strong> in the top strip &mdash; between the bell and your account button &mdash; opens the help for that page, beside it. On a phone it is the last thing in the bar at the top, after the globe. A page with no help of its own shows no <strong>?</strong>.</HelpDef>
          </HelpDefs>
          <p>A page for one record, such as a child&rsquo;s page or a team&rsquo;s past season, has no tabs; its back arrow (&larr; Families, &larr; Team) sits at the left of the top strip, or in the bar on a phone. Every tab has its own address, so Back and a bookmark return to the same tab.</p>
          <p><strong>View site</strong>, at the top right (a globe on a phone), opens your club&rsquo;s live site. If you follow a link to a page that isn&rsquo;t yours, the page says so, names who opens it, and offers a button back to your own home.</p>
          <HelpNote variant="info" title="On a phone">The tabs scroll sideways, with the one you&rsquo;re on in view. The bar at the bottom doesn&rsquo;t change.</HelpNote>
        </>
      ),
    },
    {
      id: 'club-overview',
      group: 'How-to recipes',
      heading: 'The club’s Overview — the first page each day',
      summary: 'Overview opens with the club today, then the counts you can act on, then your programs. You see only what is yours to open.',
      keywords: ['overview', 'club overview', 'home', 'first page', 'the club today', 'this morning', 'your programs', 'continue setup', 'you also coach', 'dashboard', 'house league asks for time', 'ask for time', 'asked for time', 'installments due', 'overdue installments'],
      searchText: 'installments due 7 overdue 5 more in the next 14 days overdue first in red the overdue are part of the count coming due allocations house league asks for time this morning card asked by its league admin asked 9 days ago add a permit to give time clears by itself no dismiss overview the club’s overview home page first page dashboard the club today cash on hand what is owed this week who is needed owner admin this morning counts to act on registrations to review nothing waiting one line your programs rep teams house league tournaments accounting families quiet rows also on your plan not started organization members plan and billing team capacity settings continue setup setup checklist still to do view the board you also coach a team coaches portal',
      content: (
        <>
          <p><strong>Overview</strong> is the first row of the sidebar and the page you land on. It reads top to bottom:</p>
          <ul>
            <li><strong>The club today</strong> (the owner and the club&rsquo;s admins): one band with the club&rsquo;s cash, what is owed to it, this week, and who is needed.</li>
            <li><strong>This morning</strong>: counts of what you can act on now, such as registrations waiting for review. A count opens its list when that list is yours to open. With nothing waiting, it is one quiet line. When a house league season is asking for time, the owner and admins also see <strong>House league asks for time</strong> (see below).</li>
            <li><strong>Installments due</strong>: the teams&rsquo; installments that are overdue or due in the next 14 days, in one count. Beside a count of 12, the line says the overdue ones first, in red, and the rest after them: <em>7 overdue &middot; 5 more in the next 14 days</em>. The 7 are part of the 12. With none overdue it reads <em>in the next 14 days</em>; with nothing coming, only the overdue count. For someone with Accounting it opens Allocations on <strong>Coming due</strong>, the same 14 days.</li>
            <li><strong>Your programs</strong>: the programs the club runs, in the sidebar&rsquo;s order. Each opens its place.</li>
            <li><strong>The rows under them</strong>: what your plan carries that the club hasn&rsquo;t started; for the owner, <strong>Organization</strong> (members, plan &amp; billing with how many teams your plan holds, settings) and <strong>Continue setup</strong> while the setup checklist is unfinished; for an admin, <strong>Still to do</strong>; for anyone else, an Organization list of what is theirs to open; and <strong>You also coach…</strong> when you coach a team here.</li>
          </ul>
          {/* spelling-ok: a season's own name in the example */}
          <p><strong>House league asks for time.</strong> When a league admin presses <strong>Ask for time</strong> on a house league season the club hasn&rsquo;t given any time, the owner and admins (with or without Accounting) see this card under <em>This morning</em>. It counts the seasons asking, and each line reads like <em>2026 Fall House League &middot; asked Nov 13 by its league admin</em>; after a week it reads <em>asked 9 days ago</em>. Its door opens Schedules, or <strong>New schedule</strong> on the club&rsquo;s one permit when there is no schedule yet, or <strong>Permits</strong> (&ldquo;add a permit to give time&rdquo;) when the club has no permit. There is no Dismiss: the card goes by itself once the season has time or finishes. The owner also gets one bell, <strong>House league asks for time</strong>, when the ask is made.</p>
        </>
      ),
    },
    {
      id: 'club-plan-and-billing',
      heading: 'Plan & billing',
      summary: 'Your plan, what’s in use, your billing address, starting a paid plan, moving between plans, free trials and the emails about your plan, what’s included, and reducing or cancelling your subscription.',
      keywords: ['club plan', 'club billing', 'terms of service', 'privacy policy', 'accept terms', 'plan and billing', 'teams on your plan', 'club association', 'move to club association', 'team cap', 'team limit', 'how many teams', 'house league unlimited', 'archived teams', 'add team at the cap', 'cancel club', 'reactivate club', 'capacity', 'free time', 'free through', 'free time ended', 'billing address', 'change billing address', 'club address', 'billed to', 'sales tax', 'tax', 'GST', 'HST', 'PO Box', 'United States', 'US club', 'taxes', BILLING_TAX_WORDS.plusTax, 'why am I charged tax', 'tax on my invoice', 'GST/HST number', 'business number', 'credit note', 'charge changed', 'refund', 'no refund', 'keep plan', 'undo cancel', 'when does my plan end', 'free trial', 'trial', 'no trial', 'details of your purchase', 'purchase email', 'receipt', 'yearly reminder', 'renewal reminder', 'payment failed', 'plan ends on', 'ending', 'what goes offline', 'stays open until', 'keep any time', 'suspended then', 'data is kept until', 'cancel on', 'reactivate', 'plan ends on email', 'ending reminder', 'will renew', 'renew as', 'keep first then change it', 'moves to tournament', 'change which tournament you keep', 'Québec', 'Quebec', 'upgrade', 'upgrade to league plus', 'start league plus', 'start club', 'start a paid plan', 'move to league plus', 'tournament plus to league plus', 'move up', 'credit for unused time', 'monthly or yearly', 'no second trial', 'setting up', 'coming soon', 'payment failed move', 'update your payment method first', 'cannot move up', 'goes back to free', 'free time falls back', 'back on free tournament plus', 'free time and a paid plan', 'starting a plan doesn’t end your free time', 'already has as free time', 'cancel is the one door'],
      searchText: 'starting a paid plan upgrade to tournament plus league plus club club association free tournament organization how would you like to pay monthly yearly continue to checkout trial no second trial setting up dont start another payment you were starting pick up where you left off coming soon contact us moving between paid plans move to league plus tournament plus moves to league plus same subscription credit for unused time rest of this period due today trial keeps its end date league plus moves to no other plan your last payment didnt go through update your payment method first then move payment method and invoices billing address where the club is billed asked once before the first paid checkout billed to remembered sales tax work out the tax prints on your invoices next charge taxed for the new address taxes what youre charged and why plus tax gst hst rate named hst 13% due today total tax line charge changed nothing was charged press again renewal price before tax gst/hst number business number on stripe payment page tax still applies refund credit note tax given back couldnt work out the tax check the address club address start your club club billing address filled in from the coach home address po box street address change it billing address button plan card stripe billing page payment method no longer changes the address united states not selling in the united states yet gst hst free through free time from fieldlogichq a plan given for a while goes back automatically free time ended last 14 days amber contact us to keep the plan nothing is charged free time ending email reminder 14 days 3 days before every owner emailed sections billing status no end date club plan and billing rail foot beside help more you owner only your plan whats in use change plan at a glance what each plan gives for clubs with up to 15 teams 16 to 30 teams whats included reduce or cancel capacity readout club two sizes club association move up prorated today move down at renewal no credit keep current band add team at the cap archive a team contact us custom plan what club includes families rep teams accounting public site house league tournaments unlimited board and staff cancel any time plan runs to the end of the period you paid for keep button undo cancel nothing more is charged goes offline on the end date no refund or credit for the unused part cancel and suspend free time plan ends at once free trial first paid plan only no second trial trial email first payment date start a club start a league season plan step says whether this purchase starts a trial full charge due at checkout billing address step of its own details of your purchase email every owner summary not a receipt invoice billing page renewal sends no email yearly renewal reminder 30 to 37 days before payment failed notice straight away québec quebec not selling in québec yet plan already there keeps renewing move up charged now plus tax ninety days retention reactivate within retention plan limits retained remainder public site online coach portals reopen archived tournaments return starting a plan doesnt end your free time paid plan ends while free time runs goes back to free tournament plus through the last free day stays open nothing suspended nothing archived tools that come only with the plan turn off cancel is the one door while free time covers the renewal what stops on already has as free time choose a plan above it',
      links: [
        { label: 'Plan & billing', href: '../org/billing' },
      ],
      content: (
        <p>Every plan uses the same Plan &amp; billing page: Your plan, What&rsquo;s in use, any free-time band, Change plan, What&rsquo;s included, and Reduce or cancel. A Premium Coaches Portal says its one tournament slot as a line on the plan card instead of a What&rsquo;s in use column. On a Premium Coaches Portal and the Tournament plans the last section is <strong>Delete [name]</strong>: <strong>Request deletion&hellip;</strong> asks us to delete it, we reply within 30 days, and nothing is deleted until you confirm by email. A club asks from its Settings page instead. While a cancel is waiting, an amber <strong>Ending</strong> chip, &ldquo;Ends on [date]&rdquo; and a <strong>Keep</strong> button that names your plan replace Reduce or cancel and the change buttons. While a move to the free plan is waiting, the card says &ldquo;Moves to [plan] on [date]&rdquo; with the same Keep button, and the change buttons are gone. Open it at the foot of the sidebar, or in More &gt; You on a phone. Only the owner can use it; every other member sees a locked card.</p>
      ),
      subtopics: [
        {
          id: 'club-plan-and-billing-t-free-time',
          title: 'Free time from FieldLogicHQ',
          content: (
            <>
              <p>Sometimes FieldLogicHQ gives an organization a plan for a while. Plan &amp; billing then shows a band reading <strong>Free through</strong> the last free day, and the plan card says the same instead of a price. Until that day your organization has that plan, with everything that comes with it.</p>
              <p>On the next day it goes back to your own plan automatically. Nothing is charged for the free time, nothing you made is deleted, and there is nothing to do. In the last 14 days the band turns amber and says how many days are left; if the plan is open for sign-up, use Contact us to ask to keep it.</p>
              <p>Every owner of your organization is also emailed 14 days and 3 days before the last free day. The same two emails come when FieldLogicHQ gives you sections or a billing status for a while, which have no band. Free time given with <strong>no end date</strong> shows the plan with no date, sends no reminder, and stays until FieldLogicHQ ends it.</p>
              <p>For 30 days after it ends, the band says <strong>Free time ended</strong>. Everything you made is kept, but tools that come only with the plan you were given stay closed until you choose it. While a Club plan is free, the page does not show Payment method, Move or Cancel, because there is nothing to pay.</p>
              <p>Free time does not stop you buying a plan. <strong>Change plan</strong> offers the plans above the one you were given (see <strong>Starting a paid plan</strong>), and starting one does not end your free time. If that paid plan later ends while your free time is still running, your organization goes back to the free plan it was given, through its last free day. It stays open, and nothing is suspended or archived. A paid plan that outlasts the free time closes as any ended plan does (see <strong>Cancelling, and reactivating</strong>).</p>
            </>
          ),
        },
        {
          id: 'club-plan-and-billing-t-teams',
          title: 'What’s in use',
          content: (
            <p>The plan card shows how many teams you&rsquo;ve given a Premium Coaches Portal (every team set up under Rep teams, whatever you call it) against your size&rsquo;s limit. House league teams are unlimited, and archived teams and teams entered in your tournaments don&rsquo;t count. The bar turns amber as you approach the limit, and once you&rsquo;re at it, the card names the size to move to.</p>
          ),
        },
        {
          id: 'club-plan-and-billing-t-address',
          title: 'Your billing address',
          content: (
            <>
              <p>Before your organization&rsquo;s first paid checkout, a <strong>Billing address</strong> window asks where it is billed (on the <strong>Start a club</strong> page it is a step of its own, after the plan). You answer once: later purchases go straight through and say <strong>Billed to</strong> the address on file.</p>
              <ul>
                <li>We use it to work out the GST or HST on what we bill you, and it prints on your invoices. Change it and your next charge is taxed for the new address.</li>
                <li>Give the organization&rsquo;s own address. When a coach turns a Coaches Portal into a club with <strong>Start your club</strong>, the <strong>Club billing address</strong> is filled in from the coach&rsquo;s home address &mdash; change it if the club has its own.</li>
                <li>A PO Box on its own can&rsquo;t be a billing address. Enter a street address.</li>
                <li>A free or comped plan isn&rsquo;t asked until someone presses a button that pays.</li>
                <li>Choosing United States says &ldquo;We&rsquo;re not selling in the United States yet.&rdquo;</li>
                <li>A Québec address can be saved, but a new plan or a move up is refused: &ldquo;We&rsquo;re not selling in Québec yet.&rdquo; A plan you already have keeps renewing, and can move down or be cancelled as usual.</li>
              </ul>
              <HelpNote variant="info" title="Changing it">Open Plan &amp; billing and choose <strong>Billing address</strong> on the plan card, which shows the address on file. Stripe&rsquo;s billing page (Payment method &amp; invoices) updates your card and invoices, but no longer changes the address.</HelpNote>
            </>
          ),
        },
        {
          id: 'club-plan-and-billing-t-taxes',
          title: 'Taxes: what you’re charged and why',
          content: (
            <>
              <p>Our prices are {BILLING_TAX_WORDS.plusTax}. The tax is worked out from your organization&rsquo;s billing address: GST, or HST in the provinces that charge it, named with its rate on every quote and invoice, for example <strong>HST 13%</strong>.</p>
              <ul>
                <li>Before you pay, the window shows the plan&rsquo;s price, the tax on its own line, and <strong>Due today</strong>, which is the total you&rsquo;re charged.</li>
                <li>If the charge has changed by the time you press the button, nothing is charged. The window shows the new figure and asks you to check it and press again.</li>
                <li>A renewal shows the price before tax, with <strong>{BILLING_TAX_WORDS.plusTax}</strong> under it.</li>
                <li>You can type your organization&rsquo;s GST/HST number on Stripe&rsquo;s payment page. It prints on your invoices; the tax still applies.</li>
                <li>If a charge is ever refunded, Stripe emails a credit note that shows the tax given back.</li>
              </ul>
              <HelpNote variant="info" title="If the tax can’t be worked out">The window says &ldquo;We couldn&rsquo;t work out the tax for this billing address. Check the address and try again.&rdquo; Open <strong>Billing address</strong> on the plan card and check the street, city, province and postal code.</HelpNote>
            </>
          ),
        },
        {
          id: 'club-plan-and-billing-t-start',
          title: 'Starting a paid plan',
          content: (
            <>
              <p>Under <strong>Change plan</strong>, a free Tournament organization can start Tournament Plus, League Plus, Club or Club · Association. Each row says what the plan gives under <strong>At a glance</strong> (the two Club rows also say how many teams they are for), then lists the monthly and yearly price, and its button reads <strong>Upgrade to [plan]</strong>. With free time from FieldLogicHQ, the plan you were given is your row, marked &ldquo;Free through [date]&rdquo;, and only the plans above it can be started.</p>
              <ol>
                <li>Press <strong>Upgrade to [plan]</strong>, here or in the panel that <strong>See what [plan] includes</strong> opens.</li>
                <li>Choose <strong>Monthly</strong> or <strong>Yearly</strong>. The window says how long your free trial is, or that you&rsquo;ve had a subscription before, so there&rsquo;s no second trial.</li>
                <li>Press <strong>Continue to checkout</strong> and pay on Stripe&rsquo;s page.</li>
                <li>Back on Plan &amp; billing, &ldquo;Setting up [plan]&rdquo; shows while the payment is confirmed. Don&rsquo;t start another payment; League Plus and Club open as soon as it lands.</li>
              </ol>              <p>Your events, teams and staff stay where they are. Pressing another Upgrade while a payment is still being set up shows the same wait instead of a second payment page. If you left Stripe&rsquo;s page before paying, a line above the table says which plan you were starting. The plan window on a tournament organization&rsquo;s setup checklist also says what League Plus adds (house league seasons) and what Club adds (rep teams and the club&rsquo;s books), naming only the plans that are open for sign-up.</p>
              <p>With free time from FieldLogicHQ, a line under the table reads &ldquo;Starting a plan doesn&rsquo;t end your free time. If the plan ends while your free time runs, [organization] goes back to free [plan] through [date].&rdquo; A plan at or below the one you were given can&rsquo;t be started: &ldquo;[Organization] already has [plan] as free time. Choose a plan above it, or contact us.&rdquo;</p>
              <HelpNote variant="info" title="Coming soon">A plan that isn&rsquo;t open yet wears a <strong>Coming soon</strong> tag, and its button reads <strong>Contact us</strong>.</HelpNote>
            </>
          ),
        },
        {
          id: 'club-plan-and-billing-t-sizes',
          title: 'Moving between paid plans',
          content: (
            <>
              <p>A paid plan moves on the subscription it already has, never a second one. Tournament Plus can move up to League Plus, Club or Club · Association, and Club to Club · Association. League Plus moves to no other plan yet. Club and Club · Association differ only in how many teams with a Premium Coaches Portal they hold and what they cost — every feature is identical between them.</p>
              <p><strong>Moving up</strong> happens straight away. Press <strong>Move to [plan]</strong>, and before you confirm the window shows Stripe&rsquo;s figures: the new plan for the rest of this period, a credit for the unused time on your current plan, the tax, what&rsquo;s due today, and the price from your next renewal. Your billing stays monthly or yearly as it is, and a move never starts a second trial; during a trial nothing is charged today and the trial keeps its end date. If there is no live paid subscription to change, the window offers checkout instead.</p>
              <p><strong>Moving down</strong> to Club takes effect at your next renewal, with no credit for the current period, and is refused while you&rsquo;re running more teams than Club holds — archive a team first, or stay where you are. A move waiting for renewal can be undone with &ldquo;Keep&rdquo; your current size, any time before then.</p>
              <p>While a cancel or a move to the free plan is waiting, every change button is gone, and a change is refused with &ldquo;Your plan ends on [date]. Keep [plan] first, then change it.&rdquo; (over a waiting move: &ldquo;Your plan moves to [plan] on [date]. Keep [plan] first, then change it.&rdquo;) Press <strong>Keep</strong> on the plan card first, then make the change. Moving down to the free plan is covered in <strong>If your subscription ends</strong>.</p>
              <p>More teams than the larger size holds? Contact us for a custom plan.</p>
              <p>If FieldLogicHQ has also given you free time on a plan, and that free time would still be running on your renewal date, a move to that plan, or to any plan below it (the free plan included), isn&rsquo;t offered. <strong>Cancel</strong> is the one door then, and it takes you back to the free plan (see <strong>Cancelling, and reactivating</strong>).</p>
              <HelpNote variant="warning" title="If your last payment failed">A move up is refused until it&rsquo;s fixed: &ldquo;Your last payment didn&rsquo;t go through. Update your payment method first, then move.&rdquo; Press <strong>Payment method &amp; invoices</strong>, update your payment method, then move. A move down is not affected.</HelpNote>
            </>
          ),
        },
        {
          id: 'club-plan-and-billing-t-cap',
          title: 'Adding a team at the cap',
          content: (
            <p>Adding a team once you&rsquo;re at your size&rsquo;s limit offers two ways out, in place, without losing what you typed: move up a size (the same window as the plan page, with Stripe&rsquo;s prorated figure), or archive a team you no longer run. Only the owner can make the move; anyone else is told to ask them. Above the largest size, the way out is to contact us.</p>
          ),
        },
        {
          id: 'club-plan-and-billing-t-emails',
          title: 'Free trials, and the emails about your plan',
          content: (
            <>
              <p>A paid plan with a free trial gives it only on your organization&rsquo;s <strong>first</strong> paid plan. If the organization has had a paid plan before, on any plan, checkout starts with no trial. The trial&rsquo;s length and the date of the first payment are shown at checkout and in the email that confirms it. On the plan step of the <strong>Start a club</strong> or <strong>Start a league season</strong> page, each plan already says whether this purchase starts a trial, or that there&rsquo;s no second trial and the full charge is due at checkout.</p>
              <p>Every owner of the organization is told about its plan:</p>
              <ul>
                <li><strong>The details of your purchase</strong> is emailed after you start a plan or a trial, come back to a plan, or move up (during a trial too): what was bought, by whom, the price, each tax, the total, the renewal date and how to cancel. It is a summary, not a receipt: your invoice is the document to keep, and it&rsquo;s always on your billing page. A renewal sends no such email.</li>
                <li><strong>Before a yearly plan renews</strong>, an email about a month ahead (30 to 37 days) gives the date, the amount and its tax. To stop it, cancel before that date. When a yearly plan&rsquo;s first payment is less than 38 days away, the trial email is that notice.</li>
                <li><strong>If a payment fails</strong>, a notice saying so arrives straight away, by email too unless an owner has turned that off. The plan keeps working while the payment is tried again; update your payment method from your billing page. If it still can&rsquo;t be collected, the plan can end sooner than its date, on the day the payment provider stops trying.</li>
                <li><strong>When your plan is set to end</strong>, every owner is emailed the moment you cancel: &ldquo;Your plan ends on [date]&rdquo; with a <strong>Keep</strong> button, then a reminder seven days before the date (when there are that many days left). Press Keep and &ldquo;[Plan] will renew on [date]&rdquo; confirms it. If the last payment failed and is still due, the subject says &ldquo;ends by [date]&rdquo; and the email says the plan can end sooner. A move to the free plan sends &ldquo;Your move to [plan] is scheduled for [date]&rdquo; and its own seven-day reminder. When free time will still be running on the day a cancel ends the plan, the ends-on email and its reminder say &ldquo;[Organization] goes back to free [plan] through [date].&rdquo; in place of the suspension, and add &ldquo;Tools that come only with [plan] turn off.&rdquo; if the paid plan carried tools the free one does not.</li>
                <li><strong>When the plan has ended</strong>, &ldquo;[Plan] for [your club] has ended&rdquo; says the club is suspended, names the day your data is kept until, and has a <strong>Reactivate</strong> button that names your plan. If free time was still running, the email instead says the club goes back to free [plan] through its last free day; it has no data date and no button, because the club stays open.</li>
              </ul>
            </>
          ),
        },
        {
          id: 'club-plan-and-billing-t-cancel',
          title: 'Cancelling, and reactivating',
          content: (
            <>
              <p>You can cancel at any time under <strong>Reduce or cancel</strong>. The button names your plan (<strong>Cancel</strong> and the plan&rsquo;s name), and the window names the day your plan ends, what goes offline then, and how long your records are kept after that. A reason is optional.</p>
              <ul>
                <li><strong>Cancelling ends your plan on the renewal date</strong>, the end of the period you&rsquo;ve paid for (or the day your trial ends). The club stays open until then. Nothing is switched off before that day, and no more plan payments are taken.</li>
                <li>Until that day, Plan &amp; billing shows an <strong>Ending</strong> chip, &ldquo;Ends on [date]&rdquo;, and a <strong>Keep</strong> button that names your plan. Press it, confirm in the window, and the plan carries on and renews as before. Reduce or cancel and the change buttons are gone while a cancel waits.</li>
                <li>On that day the club is suspended: Rep teams and every team&rsquo;s coach portal, Accounting, Families, the public site, house league and tournaments go offline. Your records are kept for 90 days after that.</li>
                <li>If your last payment didn&rsquo;t go through and is still due, the window says so. If it&rsquo;s collected, the club stays open until the date. If it can&rsquo;t be, the plan ends sooner, on the day the payment provider stops trying, so the window can&rsquo;t promise a kept-until date ahead of time. The email that the plan has ended gives it.</li>
                <li>A cancel replaces a waiting move to the free plan. If you then keep your plan, you stay on it.</li>
                <li>We don&rsquo;t refund or credit the unused part of a period, whether you cancel, move down or stop using FieldLogicHQ.</li>
                <li>A plan with nothing to pay, such as a plan on free time, has no paid period to wait for, so it ends when you confirm and the button reads <strong>Cancel and suspend</strong>.</li>
                <li>If FieldLogicHQ has also given you free time that would still be running on the day your plan ends, nothing is suspended. The button reads <strong>Cancel [plan]&hellip;</strong>, the window lists only what the paid plan alone carried under <strong>What stops on [date]</strong>, and says &ldquo;[Organization] goes back to free [plan] through [date].&rdquo; The club stays open, nothing is archived beyond the free plan&rsquo;s limit, and there is no 90-day clock. If the paid plan outlasts the free time, it closes as above. A Premium Coaches Portal never falls back.</li>
              </ul>
              <p>Once the plan has ended, press <strong>Reactivate</strong> (it names your plan) on Plan &amp; billing within the retention window to restore the public site, coach portals and retained tournaments within your plan&rsquo;s limits. Records beyond those limits remain in retention until their deadline. Data past that deadline may no longer be available. If Club isn&rsquo;t yet open for self-serve purchase, the reactivate button reads &ldquo;Contact us to reactivate&rdquo; instead.</p>
            </>
          ),
        },
        {
          id: 'club-plan-and-billing-t-terms',
          title: 'Our Terms of Service and Privacy Policy',
          content: (
            <>
              <p>Both are linked at the foot of every page, under <strong>Sign out</strong> in the account menu (<strong>Terms</strong> &middot; <strong>Privacy</strong>), on your account page, and on the sign-in and sign-up cards. Each version stays at its own address.</p>
              <ul>
                <li><strong>When you agree:</strong> you tick one box when you create your account. If you had an account before the Terms were published, a one-time screen asks you on your next sign-in. If we make a change that reduces your rights or raises what you pay, we email the owners 30 days ahead and the screen asks again; an owner of a paid plan can cancel from it instead.</li>
                <li><strong>Before a plan starts or changes</strong>, a &ldquo;Before you continue&rdquo; window appears if you haven&rsquo;t agreed to the current version, then carries on where you left off. The line beside a plan&rsquo;s button reminds you the plan renews until you cancel.</li>
                <li><strong>What we keep:</strong> which version you agreed to, the words you ticked, your email address, when and where &mdash; no internet (IP) address &mdash; for at least six years after your account closes. Your purchase email links the version for that purchase.</li>
              </ul>
            </>
          ),
        },
      ],
    },
    {
      id: 'subscription-ends',
      heading: 'If your subscription ends',
      summary: 'What stops, what is kept, and how to get everything back.',
      keywords: [
        'cancel', 'cancelled', 'canceled', 'cancel subscription', 'cancelled subscription',
        'subscription ended', 'subscription has ended', 'end subscription', 'stop paying',
        'lost access', 'no access', 'locked out', 'cannot log in', "can't log in",
        'nothing works', 'everything stopped', 'portal stopped working',
        'did we lose our data', 'is our data deleted', 'data deleted', 'lose everything',
        'get our data back', 'restore access', 'reactivate',
        'renew', 'renew subscription', 'start paying again',
        'past due', 'payment failed', 'payment method declined', 'payment method expired', 'failed payment',
        '90 days', 'retention', 'coaches portal not working', 'scorekeeper stopped',
        'keep plan', 'undo cancel', 'when does access stop', 'end of the period',
        'plan ends on', 'ends on', 'ending', 'ending soon', 'ends sooner', 'keep', 'plan ends on email', 'ending reminder', 'will renew', 'renew as',
        'cancelled but everything still works', 'still works after cancelling', 'first then change it', 'change refused', 'move to the free plan',
        'move to tournament', 'change which tournament you keep', 'reactivate plan', 'update payment method', 'free time catches an ending', 'goes back to free', 'not suspended',
      ],
      searchText: 'if your subscription ends cancel cancelled canceled subscription ended stop paying lost access locked out cannot log in nothing works did we lose our data is our data deleted nothing is deleted data kept 90 days retention reactivate renew restore access plan and billing billing page past due payment failed payment method declined payment method expired failed payment keeps working grace retry plan ends on the renewal date nothing is switched off early ending chip ends on keep plan undoes a cancel keep first then change it moves to tournament on the renewal date change which tournament you keep archived on the date plan ends sooner the day the payment provider stops trying ended email data is kept until ending reminder will renew email coaches portal stops scorekeeper stops check-in stops family portal stops public tournament pages go offline tryout registration closes dues reminder emails stop free coaches portal unaffected personal teams basic coach keeps their own work retained records restored within plan limits beyond limits kept until deadline owner only locked card rail foot more you club plan and billing free time catches an ending goes back to free tournament plus stays open not suspended',
      links: [
        { label: 'Plan & billing', href: '../org/billing' },
      ],
      content: (
        <>
          <p><strong>A cancelled plan ends on the renewal date, the end of the period you paid for.</strong> Until that day everything keeps working, nothing is switched off early, no more plan payments are taken, and the owner can press <strong>Keep</strong> (it names your plan) on Plan &amp; billing to carry on. <strong>When the plan ends, a retention window starts.</strong> Plan &amp; billing names how long your records are kept. Reactivate within that window to restore the tools and retained records your plan allows. Records beyond its limits stay in retention until their deadline; data past that deadline may no longer be available.</p>
          <p><strong>What stops.</strong> On the day the plan ends, access ends across everything: the Coaches Portal, tournament setup, scheduling and score entry, the scorekeeper and check-in apps, your public tournament pages, and the family-facing team pages and calendar feeds. Coaches and volunteers see a short note saying the subscription has ended and that nothing has been deleted — not an error, and not a page that half works.</p>
          <p>Two related things stop as well, so nobody is left wondering: <strong>tryout registration closes</strong> (a form that is no longer being watched should not keep collecting families&rsquo; details), and <strong>automated dues reminder emails stop going out</strong>.</p>
          <p><strong>Your Plan &amp; billing page keeps working.</strong> An admin who opens the admin area lands there. Only the owner can reactivate; everyone else sees the locked card. It remains reachable at the foot of the sidebar and in More &gt; You on a phone for the owner.</p>
          <p><strong>A missed payment is not the same as cancelling, but it can end the plan.</strong> If a payment fails, your account is marked past due and <em>everything keeps working</em> while the payment is retried and you are told about it. Update your payment method from Plan &amp; billing to clear it. If the payment still can&rsquo;t be collected, the plan ends sooner than any date you were shown, on the day the payment provider stops trying, and you&rsquo;re emailed that it has ended.</p>
          <p><strong>A free Coaches Portal is not affected.</strong> Teams a coach set up on their own free portal belong to that person rather than to your organization, so there is no subscription involved and their own work stays exactly as it was.</p>
          <p><strong>Free time can catch an ending.</strong> If FieldLogicHQ gave you free time on a plan and it is still running on the day your paid plan ends, the club isn&rsquo;t suspended: it goes back to the free plan it was given, stays open, and nothing is archived beyond that plan&rsquo;s limit. A paid plan that ends after the free time does ends as described above. A Premium Coaches Portal doesn&rsquo;t fall back.</p>
          <p>Running a Club? <strong>Plan &amp; billing</strong> covers your two sizes, moving between them, and exactly what reactivating restores.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-subscription-ended-data',
          question: 'We cancelled — did we lose our data?',
          answerText: 'No records are deleted when you cancel or when the plan ends. They are kept during the retention window shown on Plan & billing. Your account records are retained for 90 days after the plan ends. Reactivate within that window to restore retained records within your plan limits — there is nothing to re-enter and nothing to import.',
          keywords: ['did we lose our data', 'data deleted', 'is our data gone', 'lose everything', 'get data back', '90 days', 'retention', 'restore', 'cancelled data'],
          popular: true,
          answer: (
            <>
              <p><strong>No.</strong> Nothing is deleted when a subscription ends. Your seasons, rosters, schedules, records and history are all kept for the retention window below.</p>
              <p>Your account records are retained for <strong>90 days</strong> after the plan ends. Reactivate within that window to restore retained records within your plan limits — there is nothing to re-enter and nothing to import.</p>
            </>
          ),
        },
        {
          id: 'faq-subscription-ended-access',
          question: 'Our coaches say the portal stopped working — why?',
          answerText: 'If your organization\'s plan has ended, access stops for everyone: the Coaches Portal, tournament tools, the scorekeeper and check-in apps, the family team pages, and your public tournament pages. Coaches and volunteers see a short note saying the subscription has ended and that nothing has been deleted. Check your Plan & billing page — an admin who opens the admin area is taken straight there, but only the owner can reactivate; other admins see a locked card. The owner can reactivate within retention, subject to the plan limits. If instead a payment simply failed, the account is marked past due and everything keeps working while the payment is retried, so a portal that has genuinely stopped means the plan has ended, not a declined payment method. A cancelled plan keeps working until the end of the period paid for, so it stops only on that day. A plan with a payment that could not be collected can end sooner, on the day the payment provider stops trying.',
          keywords: ['portal stopped working', 'coaches locked out', 'coaches cannot log in', 'scorekeeper stopped', 'check-in stopped', 'no access', 'nothing works', 'subscription has ended message', 'why did access stop'],
          popular: true,
          answer: (
            <>
              <p>If your organization&apos;s plan has ended, <strong>access stops for everyone</strong> — the Coaches Portal, tournament tools, the scorekeeper and check-in apps, the family team pages, and your public tournament pages. They see a short note saying the subscription has ended and that nothing has been deleted.</p>
              <p>Open <strong>Plan &amp; billing</strong> — an admin who opens the admin area is taken straight there, but only the owner can reactivate; other admins see a locked card. The owner can reactivate within retention, subject to the plan limits.</p>
              <p>If a payment simply <em>failed</em>, that is different: the account is marked past due and everything keeps working while the payment is retried. So a portal that has genuinely stopped means the plan has ended, not a declined payment method. A cancelled plan keeps working until the end of the period paid for, so it stops only on that day. A plan whose payment can&rsquo;t be collected can end sooner, on the day the payment provider stops trying.</p>
            </>
          ),
        },
        {
          id: 'faq-subscription-restore',
          question: 'How do we get everything back?',
          answerText: 'If you cancelled and the plan has not ended yet, press Keep on Plan & billing (the button names your plan), confirm, and it carries on as before. Once it has ended, press Reactivate on Plan & billing. That page keeps working even while access is stopped, precisely so you can come back. Reactivate within the retention window to restore the tools and records your plan allows. Records beyond its limits stay in retention until their deadline. Your records are kept for 90 days after the plan ends.',
          keywords: ['get everything back', 'restore access', 'reactivate', 'reactivate plan', 'keep plan', 'renew', 'start again', 'come back'],
          answer: (
            <>
              <p>If you cancelled and the plan hasn&rsquo;t ended yet, press <strong>Keep</strong> (the button names your plan) on <strong>Plan &amp; billing</strong>, confirm, and it carries on as before.</p>
              <p>Once it has ended, press <strong>Reactivate</strong> on <strong>Plan &amp; billing</strong>. That page keeps working even while access is stopped, precisely so you can come back. Reactivate within the retention window to restore the tools and records your plan allows. Records beyond its limits stay in retention until their deadline. Your records are kept for <strong>90 days</strong> after the plan ends.</p>
            </>
          ),
        },
        {
          id: 'faq-plan-change-tournaments',
          question: 'We moved to a smaller plan — where did our tournaments go?',
          answerText: 'A move to the free plan takes effect on the renewal date, not when you choose it, and until then you keep every tool. If the new plan includes fewer tournament slots than you have draft and active tournaments, you choose which to keep when you set the move, and the ones you did not choose are archived on that date rather than deleted. If you choose none, the newest is kept. A completed tournament holds no slot, so a move never archives it. Archived tournaments are retained for 90 days and come back when you move up to a plan with room for them again. Change which tournament you keep changes the choice any time before the date.',
          keywords: ['tournaments disappeared', 'tournaments missing', 'tournament archived', 'downgrade', 'smaller plan', 'fewer tournaments', 'plan change tournaments', 'where did my tournament go', 'moves to tournament', 'change which tournament you keep', 'which tournament stays active'],
          answer: (
            <>
              <p>A move to the free plan takes effect <strong>on the renewal date</strong>, not when you choose it. Until then you keep every tool you have now.</p>
              <p>If the new plan includes fewer tournament slots than you have draft and active tournaments, the ones you didn&rsquo;t choose to keep are <strong>archived on that date rather than deleted</strong>, a running event included, so choose carefully. If you choose none, the newest is kept. A completed tournament holds no slot, so a move never archives it.</p>
              <p>Archived tournaments are retained for 90 days and come back when you move up to a plan with room for them again. <strong>Change which tournament you keep</strong> on the plan card changes your choice any time before the date.</p>
            </>
          ),
        },
        {
          id: 'faq-cancelled-still-works',
          question: 'We cancelled, but everything still works — is that right?',
          answerText: 'Yes. Cancelling ends the plan on the renewal date, the end of the period you paid for, or the day your trial ends. Nothing is switched off before then, and no more plan payments are taken. Plan & billing shows an Ending chip and Ends on the date, and a Keep button that names your plan undoes it. You are emailed Your plan ends on the date when you cancel, and a reminder seven days before (when there are that many days left). If your last payment failed and is still due, the plan can end sooner, on the day the payment provider stops trying.',
          keywords: ['cancelled but still works', 'still have access after cancelling', 'when does my plan end', 'ends on', 'ending', 'keep plan', 'undo cancel', 'plan ends on email', 'ending reminder', 'ends sooner'],
          answer: (
            <>
              <p><strong>Yes.</strong> Cancelling ends the plan <strong>on the renewal date</strong>, the end of the period you paid for (or the day your trial ends). Nothing is switched off before then, and no more plan payments are taken.</p>
              <ul>
                <li>Plan &amp; billing shows an <strong>Ending</strong> chip and &ldquo;Ends on [date]&rdquo;. A <strong>Keep</strong> button that names your plan undoes the cancel.</li>
                <li>Every owner is emailed &ldquo;Your plan ends on [date]&rdquo; when you cancel, and a reminder seven days before (when there are that many days left).</li>
                <li>If your last payment failed and is still due, the plan can end sooner, on the day the payment provider stops trying.</li>
              </ul>
            </>
          ),
        },
        {
          id: 'faq-change-after-cancel',
          question: 'Why does it say “Keep [plan] first, then change it”?',
          answerText: 'While a cancel or a move to the free plan is waiting for the renewal date, a plan change is refused, so a move up never charges you for a plan that is about to end. The message reads Your plan ends on the date, Keep and the plan name first, then change it (over a waiting move: Your plan moves to the plan on the date, Keep the plan first, then change it). Press the Keep button that names your plan on Plan & billing, confirm, then make the change. A cancel still replaces a waiting move to the free plan.',
          keywords: ['keep first then change it', 'cannot change plan', 'change plan refused', 'move up refused', 'plan ends on', 'keep plan'],
          answer: (
            <>
              <p>While a cancel or a move to the free plan is waiting for the renewal date, a plan change is refused, so a move up never charges you for a plan that is about to end.</p>
              <ol>
                <li>Press the <strong>Keep</strong> button that names your plan on <strong>Plan &amp; billing</strong>.</li>
                <li>Confirm in the window.</li>
                <li>Make the change you wanted.</li>
              </ol>
              <p>A cancel still replaces a waiting move to the free plan.</p>
            </>
          ),
        },
        {
          id: 'faq-move-to-free-plan',
          question: 'How do we move down to the free plan?',
          answerText: 'Choose the free plan under Change plan. The window asks which tournament to keep active, lists the tools that turn off, and its button reads Downgrade on the date. Nothing is credited, and you keep every tool until the renewal date. On that date the plan moves, and the tournaments you did not choose are archived for 90 days. Plan & billing shows Moves to a named plan on the date and a Keep button until then.',
          keywords: ['downgrade to free', 'move to the free plan', 'free plan', 'downgrade on', 'choose a tournament to keep', 'keep active', 'tools turn off', 'archive retention', 'moves to tournament'],
          answer: (
            <>
              <ol>
                <li>Choose the free plan under <strong>Change plan</strong>.</li>
                <li>Pick the tournament to keep active. The window lists the tools that turn off and what is archived.</li>
                <li>Press <strong>Downgrade on [date]</strong>.</li>
              </ol>
              <p>The move takes effect on the renewal date, and nothing is credited. Until then you keep every tool, and Plan &amp; billing shows <strong>Moves to [plan] on [date]</strong> with a <strong>Keep</strong> button. On that date the tournaments you didn&rsquo;t choose are archived for 90 days.</p>
            </>
          ),
        },
      ],
    },
    {
      // The id it had always been given from its heading and place, written down (navigation Phase 6b): Members' "?" opens
      // here, and an id that moved whenever a section was added above it would leave that "?" opening nothing.
      id: 'inviting-and-managing-members-11',
      heading: 'Inviting and managing members',
      keywords: ['invitation ran out', 'invitation expired', '30 days', 'two-step column', 'reset two-step', 'not set up', 'seat limit', 'staff seats', 'volunteers free', 'scorekeepers free', 'free plan no volunteers', 'officials free', 'do volunteers count', 'do scorekeepers count', 'invite member', 'manage member', 'resend invite', 'cancel invitation', 'invited not yet joined', 'helping with', 'staff kit'],
      searchText: 'two-step column on off not set up amber reset two-step sign-in lost phone owners and admins only export two-step column seat limit staff seats how many seats do volunteers scorekeepers count toward limit officials free seats free tournament 3 seats upgrade invite member manage role restrict tournaments helping with change a volunteer job resend pending invite invitation ran out expired 30 days last sent run-out invitation holds no seat cancel invitation already has an account accepts on home page sign in to accept holds a seat export member list staff kit volunteer links qr codes',
      content: (
        <>
          <p>Go to <strong>Members</strong> and click <strong>Invite</strong>. Enter the person's email and choose their role (none is chosen for you). They'll receive an invitation email that says what the role opens. A new person gets a link to accept and set up their account (it expires in 24 hours). Someone who already has an account gets <strong>Sign in to accept</strong> and accepts on their Home page; they aren&rsquo;t added until they do. That includes a coach already in your club: they keep coaching either way, and get the board role only when they accept.</p>
          <p>Once a member has accepted, click <strong>Manage</strong> on their row to:</p>
          <ul>
            <li>Change their role</li>
            <li>Restrict them to specific tournaments (useful for staff at multi-event orgs)</li>
            <li>Grant or revoke individual capabilities beyond their role defaults</li>
            <li>For a volunteer, change what they&rsquo;re <strong>Helping with</strong> (Scoring, The gate, or Both), which takes the place of the list of programs</li>
            <li>Suspend or reinstate their access</li>
            <li>Reset their two-step sign-in, when they&rsquo;ve lost their phone and their backup codes (owners and admins; see <a href="#two-step-sign-in">Two-step sign-in</a>)</li>
          </ul>
          <p>Owners and admins also see a <strong>Two-step</strong> column on Members: <strong>On</strong>, <strong>Off</strong>, or an amber <strong>Not set up</strong> for a person whose role the club requires it for and who hasn&rsquo;t yet. Treasurers and registrars don&rsquo;t see it. <strong>Export</strong> adds a <strong>Two-Step</strong> column to match.</p>
          <p>To resend an invitation to someone who hasn't accepted yet, open <strong>Manage</strong> on their row and choose <strong>Resend invite</strong>. Someone who hasn&rsquo;t accepted yet shows as <strong>Invited</strong> on their row, and holds a seat until they accept, decline, the invitation runs out, or you choose <strong>Cancel invitation&hellip;</strong> in <strong>Manage</strong> (<em>Keep it</em> or <em>Cancel invitation</em> in the window that asks).</p>
          <p>An invitation stays open for 30 days from when it was last sent. After that the row reads <strong>Invitation ran out</strong>, it holds no seat, and the person can&rsquo;t accept it. <strong>Resend invite</strong> opens it for another 30 days, and at the seat limit you free a seat or upgrade first. See <em>When an invitation runs out</em> under <em>How to invite a member and choose the right role</em>.</p>
          <p><strong>Volunteer links</strong> (Tournament Plus and above; the free Tournament plan has no Staff kit): each tournament&rsquo;s <strong>Staff kit</strong> holds a QR code and a link for each job, Scorekeeper and Gate, and prints them on one page for the volunteer table. To try the volunteers&rsquo; screens yourself, use <strong>Scorekeeper</strong> on Results &amp; scoring or <strong>Gate view</strong> on Check-in.</p>
          <p><strong>Seat limits:</strong> Your plan's seat limit counts admins and staff only — <strong>volunteers (Tournament Plus and above) never count toward it</strong>, so bring as many as your event needs. The free Tournament plan includes three seats (you and up to two staff) and has no volunteers: you and your staff enter the scores. If you're near the limit, a banner appears on the Members page with an upgrade link. Paid plans have unlimited staff seats.</p>
          <p>You can <strong>export</strong> your member list (Excel or CSV) from the Members page for your own records.</p>
        </>
      ),
    },
    {
      id: 'two-step-sign-in',
      heading: 'Two-step sign-in',
      summary: 'A 6-digit code from an authenticator app after your password: turning it on, backup codes, a lost phone, the emails you get, and how a club owner requires it, tracks it and resets it.',
      keywords: ['two-step', 'two-step sign-in', '2FA', 'two-factor', 'two factor authentication', 'MFA', 'multi-factor', 'authenticator', 'authenticator app', 'Google Authenticator', 'Microsoft Authenticator', 'backup codes', 'backup code', 'lost phone', 'new phone', 'replaced my phone', 'code', 'type your code again', 'locked out', 'cant sign in', 'reset two-step', 'reset someones two-step', 'require two-step', 'require it for the board', 'also require it for coaches', '14 days', 'set it up now', 'remind me next time', 'who still needs to set up', 'not set up', 'two-step column', 'change password', 'sign out everywhere', 'sign out everywhere else', 'sign-in and security', 'security', 'turn off two-step', 'password changed email', 'stolen password'],
      searchText: 'two-step sign-in two step 2fa two-factor two factor authentication mfa multi-factor authenticator app google authenticator microsoft authenticator 1password passwords app iphone scan qr code type the key open in authenticator app 6-digit code codes change every 30 seconds enter your code use a backup code ten backup codes shown once copy download keep somewhere other than your phone i have saved my backup codes new backup codes the codes you saved stop working codes left account menu account sign-in and security turn on two-step sign-in turn off two-step sign-in cannot turn off required for your role no text messages no emailed codes your other devices were signed out sign out everywhere else change password save password type your code to continue type your code to keep going fresh code 15 minutes payout or bank details adding an owner or admin resetting someones two-step turning your own off getting new backup codes setting up a new phone every 30 days on this device lost your phone use a backup code set up my new phone i still have my phone continue no codes ask your club owner or an admin can reset only fieldlogichq support can reset support resets it after a confirmation email wait 24 hours sign in with a real code cancels it other owners admins and treasurer are told locked out cannot sign in the emails you get now requires two-step sign-in 3 days left to set up two-step sign-in two-step sign-in is now on moved to a new phone two-step sign-in is now off your fieldlogichq password was changed your two-step sign-in was reset no longer requires two-step sign-in no link in the email forgot your password write to support from the address you sign in with organization settings two-step sign-in require it for the board owner admins treasurers registrars league admins also require it for coaches owner must have it on first on since everyone already in these roles has until anyone new gets 14 days your club now requires two-step sign-in set it up now remind me next time days left set up two-step sign-in to continue go to my other teams instead other teams and places stay open only that clubs pages wait stop requiring it people who have it keep it admin reads the card only the owner changes this members two-step column on off not set up days left amber invitation dash phone line coaching staff row export two-step column only owners and admins see it never treasurers or registrars never the board tab overview card your club can require two-step sign-in for the board open settings close people still need to set up two-step sign-in open members earliest deadline reset two-step sign-in manage window never for yourself never the owner only when it is on only when the account is used only for this club turn on your own first audit log records every change and every reset',
      content: (
        <p>Two-step sign-in asks for a 6-digit code from an authenticator app on your phone after your password, so a stolen password isn&rsquo;t enough to sign in as you. Anyone can turn it on for their own account, and a club can require it for its board and its coaches. The first four answers are for everyone; the last three are for a club&rsquo;s owner and admins.</p>
      ),
      subtopics: [
        {
          id: 'two-step-sign-in-t-turn-on',
          title: 'Turning it on, and saving your backup codes',
          content: (
            <>
              <p>It&rsquo;s off until you turn it on. It uses an authenticator app only: no text messages, no emailed codes.</p>
              <HelpSteps>
                <li>Open your account menu, choose <strong>Account</strong>, then <strong>Sign-in &amp; security</strong>.</li>
                <li>Under <strong>Two-step sign-in</strong>, press <strong>Turn on two-step sign-in</strong>.</li>
                <li>On a computer, open an authenticator app on your phone (Google Authenticator, Microsoft Authenticator, 1Password, or the Passwords app on an iPhone) and scan the QR code. On a phone, press <strong>Open in authenticator app</strong>; if no app opens, copy the key into it.</li>
                <li>Type the 6 digits the app shows and press <strong>Turn on two-step sign-in</strong>.</li>
                <li>Save your ten backup codes with <strong>Copy</strong> or <strong>Download</strong>, somewhere other than your phone. They&rsquo;re shown once.</li>
                <li>Tick the box and press <strong>Done</strong>. Your other devices are signed out, so sign in on them again with a code.</li>
              </HelpSteps>
              <p>Each backup code works once. The card on <strong>Sign-in &amp; security</strong> counts how many are left, and <strong>New backup codes</strong> gives you ten more and stops the old ones working. <strong>Turn off</strong> is on the same card, and it isn&rsquo;t there while a club requires two-step sign-in for a role you hold.</p>
            </>
          ),
        },
        {
          id: 'two-step-sign-in-t-sign-in',
          title: 'Signing in, and when it asks for your code again',
          content: (
            <>
              <p>After your password, <strong>Enter your code</strong> asks for the 6-digit code from your authenticator app. The codes change every 30 seconds, so type the one showing now, then press <strong>Sign in</strong>. Too many wrong tries and it asks you to wait a few minutes.</p>
              <p>Two things ask for a code again:</p>
              <ul>
                <li><strong>Every 30 days, if a club requires it</strong> for a role you hold. The window reads <em>Type your code to keep going</em>.</li>
                <li><strong>Five actions, if you last typed a code more than 15 minutes ago</strong>: changing payout or bank details, adding an owner or an admin, resetting someone&rsquo;s two-step sign-in, turning your own off, and getting new backup codes or setting up a new phone. The window reads <em>Type your code to continue</em>. Press <strong>Continue</strong> and the action carries on.</li>
              </ul>
              <HelpNote variant="info" title="Changing your password">On <strong>Sign-in &amp; security</strong>, <strong>Change password</strong> signs your other devices out. Sign in on them again with the new password and a code.</HelpNote>
            </>
          ),
        },
        {
          id: 'two-step-sign-in-t-lost-phone',
          title: 'Lost or replaced your phone',
          content: (
            <>
              <p><strong>If you saved your backup codes:</strong></p>
              <HelpSteps>
                <li>On the code screen, press <strong>Use a backup code</strong>, type one, and press <strong>Sign in</strong>.</li>
                <li>The next screen says how many codes are left. Press <strong>Set up my new phone</strong> and follow the set-up from the first answer above.</li>
              </HelpSteps>
              <p>Replacing a phone you still have works the same way from <strong>Sign-in &amp; security</strong>: press <strong>Set up a new phone</strong>. It asks for a code first.</p>
              <p><strong>If you have no codes</strong>, press <strong>Lost your phone?</strong> on the code screen. It tells you who can reset it:</p>
              <ul>
                <li><strong>Your club&rsquo;s owner or an admin</strong>, when your account is used only for that club. They reset it, and you sign in with your password and set it up on the new phone.</li>
                <li><strong>FieldLogicHQ support</strong>, when your account is used in more than one place or you own the club. Email the support address on the screen, from the address you sign in with. We confirm by email and reset it 24 hours later. Signing in with a real code or a backup code during that time cancels the reset. For a club owner, we also tell the club&rsquo;s other owners, admins and treasurer.</li>
              </ul>
              <p>After a reset, your next sign-in sends you to set it up again if a club requires it for your role. Otherwise it&rsquo;s simply off.</p>
            </>
          ),
        },
        {
          id: 'two-step-sign-in-t-emails',
          title: 'The emails you get',
          content: (
            <>
              <ul>
                <li><strong>&ldquo;&hellip; now requires two-step sign-in&rdquo;</strong> when your 14 days start, and a reminder, <strong>&ldquo;3 days left to set up two-step sign-in&hellip;&rdquo;</strong>, 3 days before they end.</li>
                <li><strong>&ldquo;Two-step sign-in is now on&rdquo;</strong> (or <strong>&ldquo;moved to a new phone&rdquo;</strong>) and <strong>&ldquo;Two-step sign-in is now off&rdquo;</strong>, to you, whenever either happens.</li>
                <li><strong>&ldquo;Your FieldLogicHQ password was changed&rdquo;</strong>, after <strong>Change password</strong> or a password saved after a backup code.</li>
                <li><strong>&ldquo;Your two-step sign-in was reset&rdquo;</strong>, when a club&rsquo;s owner or admin resets it.</li>
                <li><strong>&ldquo;&hellip; no longer requires two-step sign-in&rdquo;</strong>, to the club&rsquo;s other owners, admins and treasurer, when the owner turns a requirement off.</li>
              </ul>
              <HelpNote variant="warning" title="An email you didn’t expect">None of these emails has a link, on purpose. If one surprises you, go to the sign-in page, press <strong>Forgot your password?</strong> and choose a new password. Then write to support from the address you sign in with.</HelpNote>
            </>
          ),
        },
        {
          id: 'two-step-sign-in-t-require',
          title: 'Requiring it for your club (owner)',
          content: (
            <>
              <p>Open <strong>Organization &rsaquo; Settings</strong> and find the <strong>Two-step sign-in</strong> card. It has two switches, both off:</p>
              <HelpDefs>
                <HelpDef term="Require it for the board">Your owner, admins, treasurers, registrars and league admins.</HelpDef>
                <HelpDef term="Also require it for coaches">Every coach on your club&rsquo;s teams.</HelpDef>
              </HelpDefs>
              <p>Only the owner changes them, and only once the owner has two-step sign-in on: the card says <em>Turn on two-step sign-in for your own account first</em> and links to <strong>Sign-in &amp; security</strong>. An admin sees the same card to read, with <em>Only the owner changes this.</em> Every other Settings card stays the owner&rsquo;s, except <strong>Your privacy policy</strong>, which an admin can set.</p>
              <p><strong>Everyone gets 14 days.</strong> They&rsquo;re counted from the day you turn the requirement on, or from the day someone accepts a role in a club that already requires it. The card shows <em>On since&hellip;</em> and when the first 14 days end. Signing in during them shows <em>Your club now requires two-step sign-in</em> with <strong>Set it up now</strong> and <strong>Remind me next time</strong>. After them, <em>Set up two-step sign-in to continue</em> comes first, and only your club&rsquo;s pages wait. The person&rsquo;s other teams and places stay open, with <strong>Go to my other teams instead</strong>. People in a role you require type a code again every 30 days, and can&rsquo;t turn two-step sign-in off while it&rsquo;s required.</p>
              <p><strong>Turning a switch off</strong> asks <em>Stop requiring two-step sign-in&hellip;?</em> first, then asks for your code if you last typed one more than 15 minutes ago. People who have it keep it. We email your club&rsquo;s other owners, admins and treasurer. Every change is a line in the audit log.</p>
            </>
          ),
        },
        {
          id: 'two-step-sign-in-t-who-still',
          title: 'Who still needs to set it up (owner and admins)',
          content: (
            <>
              <p>Only your club&rsquo;s owner and admins see any of this. Treasurers and registrars don&rsquo;t, and the board list under <strong>The board</strong> doesn&rsquo;t show it either.</p>
              <HelpDefs>
                <HelpDef term="Members">A <strong>Two-step</strong> column reads <strong>On</strong>, <strong>Off</strong>, <strong>Not set up &middot; 9 days left</strong> (amber, while the person&rsquo;s days run), <strong>Not set up</strong> (amber, once they&rsquo;ve passed) or a dash for an invitation. On a phone it&rsquo;s a line on each row. Coaching staff rows carry the same words, such as <em>Two-step off</em>. <strong>Export</strong> adds a <strong>Two-Step</strong> column.</HelpDef>
                <HelpDef term="Overview, for the owner">Once, a card reads <em>Your club can require two-step sign-in for the board</em>, with <strong>Open Settings</strong> and a &times;. It closes for good when you press either, or turn a requirement on.</HelpDef>
                <HelpDef term="Overview, while a requirement is on">Owners and admins see <em>N people still need to set up two-step sign-in</em>, naming up to three people and the earliest deadline, with <strong>Open Members</strong>. It has no &times; and leaves when the last person sets it up.</HelpDef>
              </HelpDefs>
            </>
          ),
        },
        {
          id: 'two-step-sign-in-t-reset',
          title: 'Resetting someone’s two-step sign-in (owner and admins)',
          content: (
            <>
              <p>When a member has lost their phone and their backup codes, reset it for them.</p>
              <HelpSteps>
                <li>Go to <strong>Members</strong> and press <strong>Manage</strong> on their row. For a coach, open the team&rsquo;s <strong>Coaches</strong> page under <strong>Rep teams</strong> and open the person.</li>
                <li>Under <strong>Two-step sign-in</strong>, which reads <em>On since&hellip;</em>, press <strong>Reset two-step sign-in&hellip;</strong>.</li>
                <li>Read the question and press <strong>Reset two-step</strong>. If you last typed a code more than 15 minutes ago, the window asks for yours first.</li>
              </HelpSteps>
              <p>Their authenticator app and backup codes stop working and they&rsquo;re signed out everywhere. We email them, and it&rsquo;s a line in the audit log. Next time they sign in with their password, they set it up again if their role requires it. Otherwise it&rsquo;s simply off.</p>
              <HelpNote variant="info" title="When the button isn’t there">There&rsquo;s no reset for yourself or for the club&rsquo;s owner, or when it&rsquo;s off. If the person&rsquo;s account is used anywhere besides your club, the window says <em>Only FieldLogicHQ support can reset this one</em>, and they write to support from the address they sign in with. And you need your own two-step sign-in on first: the window links to <strong>Sign-in &amp; security</strong>.</HelpNote>
            </>
          ),
        },
      ],
      faqs: [
        {
          id: 'faq-two-step-lost-phone',
          question: 'I lost my phone — how do I sign in?',
          answerText: 'Use a backup code. On the code screen press Use a backup code, type one of the ten you saved, and press Sign in. Then press Set up my new phone. No backup codes? Press Lost your phone? on the code screen. If your account is used only for one club, that club\'s owner or an admin can reset your two-step sign-in. If you own the club, or your account is used in more than one place, write to FieldLogicHQ support from the address you sign in with. We confirm by email and reset it 24 hours later. Signing in with a real code or a backup code during that time cancels the reset.',
          keywords: ['lost phone', 'new phone', 'broke my phone', 'lost my authenticator', 'no backup codes', 'locked out', 'cant sign in', 'two-step'],
          popular: true,
          answer: (
            <>
              <p><strong>Use a backup code.</strong> On the code screen press <strong>Use a backup code</strong>, type one of the ten you saved, and press <strong>Sign in</strong>. Then press <strong>Set up my new phone</strong>.</p>
              <p>No backup codes? Press <strong>Lost your phone?</strong> on the code screen. If your account is used only for one club, that club&rsquo;s owner or an admin can reset your two-step sign-in. If you own the club, or your account is used in more than one place, write to FieldLogicHQ support from the address you sign in with. We confirm by email and reset it 24 hours later; signing in with a real code or a backup code during that time cancels the reset.</p>
            </>
          ),
        },
        {
          id: 'faq-two-step-turn-off',
          question: 'Can I turn two-step sign-in off?',
          answerText: 'Yes, unless a club requires it for a role you hold. Open your account menu, choose Account, then Sign-in & security, and press Turn off. It asks for a code first, and we email you to say it is off. If a club requires it, the card says Required for your role, so it can not be turned off. The owner can stop requiring it in Organization, Settings.',
          keywords: ['turn off two-step', 'disable two-step', 'remove two-step', 'cant turn off', 'required for your role', 'stop requiring'],
          answer: (
            <p>Yes, unless a club requires it for a role you hold. Open your account menu, choose <strong>Account</strong>, then <strong>Sign-in &amp; security</strong>, and press <strong>Turn off</strong>. It asks for a code first, and we email you to say it&rsquo;s off. If a club requires it, the card says <em>Required for your role</em> and there is no <strong>Turn off</strong>. The club&rsquo;s owner can stop requiring it in <strong>Organization &rsaquo; Settings</strong>.</p>
          ),
        },
        {
          id: 'faq-two-step-cant-reset',
          question: 'Why can’t I reset someone’s two-step sign-in?',
          answerText: 'Only a club\'s owner or an admin can, and only when two-step sign-in is on for that person. There is no reset for yourself or for the club\'s owner. If the person\'s account is used anywhere besides your club, the window says Only FieldLogicHQ support can reset this one, because the authenticator is theirs, not the club\'s. You also need your own two-step sign-in turned on first.',
          keywords: ['cant reset two-step', 'no reset button', 'reset two-step missing', 'only fieldlogichq support can reset this one', 'turn on your own first', 'reset coach two-step'],
          answer: (
            <p>Only a club&rsquo;s owner or an admin can, and only when two-step sign-in is on for that person. There&rsquo;s no reset for yourself or for the club&rsquo;s owner. If the person&rsquo;s account is used anywhere besides your club, the window says <em>Only FieldLogicHQ support can reset this one</em>, because the authenticator is theirs, not the club&rsquo;s. You also need your own two-step sign-in on first.</p>
          ),
        },
      ],
    },
    {
      id: 'notifications-audit',
      heading: 'Notifications and the member audit log',
      summary: 'Set your own notification preferences, and (as owner) review the history of member changes, pay-link actions, family files opened and health-answer exports.',
      keywords: ['notifications', 'notification settings', 'manage notifications', 'turn off notifications', 'email alerts', 'push', 'bell', 'notification drawer', 'open a notification', 'read the whole message', 'message cut off', 'where does it go', 'open the request', 'open the bill', 'notifications on my phone', 'where are my notifications', 'no bell on my phone', 'needs attention', 'clears when it’s handled', 'why did it disappear', 'who gets notified', 'activity feed', 'earlier this week', 'done', 'mark done', 'clear a notification', 'still showing after i read it', 'mark all read', 'delete a notification', 'trash', 'undo', 'unread', 'load more', 'where did see all go', 'see all', 'bundled', 'audit log', 'member history', 'when who what to whom', 'time zone', 'export audit log', 'rep teams group change', 'volunteer job change', 'helping with', 'two-step sign-in', 'what the audit log records', 'not in the audit log', 'pay link in the audit log', 'who emailed the pay link', 'who stopped the pay link', 'house league withdrawal request', 'ask to withdraw', 'family file opened', 'health answers exported', 'who opened a family file', 'who exported health answers', 'who changed the privacy policy link'],
      searchText: 'house league asks for time the club gave house league time the club took back house league time open house league’s time ask for time bell only house league withdrawal request ask to withdraw a child family asks to withdraw turn on notifications turn on alerts get alerts on this device phone alerts push notifications will not turn on couldn’t turn on notifications in this window allow prompt notifications are blocked address bar in the app reinstall the app install app home screen iphone ipad signed out couldn’t save this device notifications notification preferences notification settings one page for everything you are part ofcard per organization team you coach manage notifications turn off notifications change how i am notified account notifications your devices in-app bell email push per event type on a computer the bell opens a drawer down the right side whole list load more no see all link where did see all go settings gear in the drawer header on a phone no bell more notifications page more account notification settings click a notification to open it where you are opens beside the list sheet above the bottom bar small window whole message day and time marked read nothing loads until you choose button names the page open the request open the bill open teams open the team second click needs attention activity feed grouped today yesterday earlier this week earlier pinned until it’s handled leaves by itself clears when it’s handled handled by someone else why did it disappear from needs attention what happened who did it when settled accepted declined withdrawn closed paid done button takes it off sooner opening it is not dealing with it still in needs attention after i read it who gets notified failed payment goes to the owners assistant coach approval rep teams no-show check-in read seen done dealt with delete gone from your list mark all read marks everything read delete a notification trash undo a few seconds your own list only everyone else copy request or payment untouched no are you sure unread all toggle inbox you empty filter chips on the page bundled repeated 6 new registrations opens as its list member audit log history who changed role owner only export members when who what happened to whom columns house time zone role changes program access turned on turned off invitations sent resent suspensions reinstatements removals rep teams group change two-step sign-in required turned on turned off reset what the audit log records what it does not list schedules scores money family records sign-ins not in the audit log missing from the audit log audit log button on members tournament plan nothing listed yet did not load try again export excel csv pay link emailed the pay link sent a new pay link stopped the pay link who sent the pay link who stopped it team and tournament payments and refunds family file opened health answers exported house league sign-up answers child and season never a file name or an answer privacy policy link added changed removed never the address',
      content: (
        <p>Two kinds of record: your own notification preferences, and, for the owner, the club or organization&rsquo;s audit log of member changes, pay-link actions, family files opened, health-answer exports and the privacy policy link (Organization → Audit log on a club plan, the Audit log button on Members on a tournament plan).</p>
      ),
      subtopics: [
        {
          id: 'notifications-audit-t-notifications',
          title: 'Notifications',
          content: (
            <>
              <p>Your notifications are yours alone, and where you read them depends on the screen you&rsquo;re on.</p>
              <HelpDefs>
                <HelpDef term="On a computer">The <strong>bell</strong> in the top-right corner opens a drawer down the right side holding your whole list: <strong>Unread&nbsp;|&nbsp;All</strong>, <strong>Mark all read</strong>, the list by day, and <strong>Load more</strong> at the end. It opens on <strong>Unread</strong>, an inbox you empty.</HelpDef>
                <HelpDef term="On a phone">There&rsquo;s no bell. Tap <strong>More</strong>, then <strong>Notifications</strong>, for the same list on a page.</HelpDef>
              </HelpDefs>
              <p><strong>Click a notification to open it</strong> where you are. You see what kind it is, the day and time it arrived, and the whole message, and it&rsquo;s marked read. Nothing loads until you choose: the lime button names the page it opens, in that page&rsquo;s own words (<strong>Open the request</strong>, <strong>Open the bill</strong>, <strong>Open Teams</strong>, <strong>Open the team</strong>). In the drawer it opens beside the list; on a phone, above the bottom bar.</p>
              <p>Anything that needs a decision from you — a request holding up a team&rsquo;s payout, a failed payment, a team marked no-show — is pinned at the top under <strong>Needs attention</strong>. Everything else sits below by <strong>Today</strong>, <strong>Yesterday</strong>, <strong>Earlier this week</strong> and <strong>Earlier</strong>, with repeats <strong>bundled</strong> into one line (&ldquo;6 new registrations&rdquo;) that opens as its list.</p>
              <HelpDefs>
                <HelpDef term="Read">You&rsquo;ve seen it. Opening a notification does this, and so does <strong>Mark all read</strong>, which marks everything read.</HelpDef>
                <HelpDef term="Done">You&rsquo;ve dealt with it. Only on <strong>Needs attention</strong>, whose rows also <strong>leave by themselves once they’re handled</strong>, by you or anyone else.</HelpDef>
                <HelpDef term="Delete">The <strong>trash</strong>, in an opened notification (and, in the drawer, on the row you point at). It takes the notification off <em>your</em> list only: everyone else&rsquo;s copy, and the request or payment it was about, stay as they are. There&rsquo;s no &ldquo;are you sure?&rdquo; — <strong>Undo</strong> brings it back for a few seconds.</HelpDef>
              </HelpDefs>
              <p>Two house league notices ride on the club&rsquo;s time. The owner gets <strong>House league asks for time</strong> when a league admin presses <strong>Ask for time</strong> on a season with none (its button opens the Overview&rsquo;s card). Everyone who runs house league, except the person who sent, gets <strong>The club gave house league time</strong> or <strong>The club took back house league time</strong> when a schedule goes out, with the button <strong>Open House league&rsquo;s time</strong>. Both are a bell only; email copies stay off unless you turn them on in your notification settings.</p>
              <p><strong>Notification settings</strong> are per person, not org-wide: a card per organization (and any team you coach) with <strong>bell</strong>, <strong>email</strong> and <strong>push</strong> switches, and your phones. Open them from the <strong>gear</strong> in the drawer, or on a phone from <strong>More</strong> › <strong>Account</strong> › <strong>Notification settings</strong>.</p>
            </>
          ),
        },
        {
          id: 'notifications-audit-t-needs-attention',
          title: 'When something leaves Needs attention',
          content: (
            <>
              <p>A notification under <strong>Needs attention</strong> asks you to do something, and it <strong>leaves by itself once it&rsquo;s handled</strong>, by you or anyone else: answered, approved, declined, withdrawn, closed or paid. It stays under <strong>All</strong>, marked read. <strong>Done</strong> takes one off sooner.</p>
              <p>Open one that&rsquo;s been handled and a line under the message says what happened, who did it and when. Its button goes where that request lives now, and there&rsquo;s none when it&rsquo;s gone. A link to it from elsewhere, such as a schedule&rsquo;s or Payment requests&rsquo;, says the same in the page&rsquo;s note.</p>
              <p>Each one goes to the people who can act on it:</p>
              <HelpDefs>
                <HelpDef term="A failed payment">The owners. Billing is theirs.</HelpDef>
                <HelpDef term="An assistant coach waiting for approval">Whoever holds <strong>Rep teams</strong> for that team&rsquo;s group.</HelpDef>
                <HelpDef term="A team marked no-show">Whoever runs check-in for that tournament. It leaves once the team checks in, the no-show is undone, or the tournament ends.</HelpDef>
                <HelpDef term="A house league withdrawal request">The owner, club admins, league admins and league registrars, when a family uses <strong>Ask to withdraw a child</strong> on their sign-up page. It opens the season&rsquo;s Registrations list. It leaves once the registration ends, whoever ends it, and the child keeps their place until then.</HelpDef>
              </HelpDefs>
            </>
          ),
        },
        {
          id: 'notifications-audit-t-phone-alerts',
          title: 'Turning on alerts on your phone',
          content: (
            <>
              <p>Phone alerts reach you even when FieldLogicHQ is closed. When a phone doesn&rsquo;t have them yet, the admin offers <strong>Get alerts on this device</strong>: tap <strong>Turn on</strong>, then choose <strong>Allow</strong> when your phone asks. <strong>Notification settings</strong> has the same button, <strong>Turn on notifications on this device</strong>, above your list of phones, where each can send a test.</p>
              <p>If alerts can&rsquo;t be turned on, the message says why and what to do next:</p>
              <HelpDefs>
                <HelpDef term="Notifications are blocked">Allow notifications for this site in your phone or browser settings, then try again.</HelpDef>
                <HelpDef term="The Allow prompt closed">Try again and choose <strong>Allow</strong>. If no prompt appears, open www.fieldlogichq.ca in your browser and turn alerts on there.</HelpDef>
                <HelpDef term="Couldn’t turn on notifications in this window">Open www.fieldlogichq.ca in your browser and try there. If the FieldLogicHQ app on your home screen opens pages with an address bar at the top, it was installed from our old address: remove it, then install it again from www.fieldlogichq.ca (in Chrome, <strong>⋮</strong> › <strong>Install app</strong>).</HelpDef>
                <HelpDef term="On iPhone or iPad">Add FieldLogicHQ to your home screen first (iOS 16.4 or later), open it from there, then turn alerts on.</HelpDef>
                <HelpDef term="You’re signed out">Sign in again, then turn alerts on.</HelpDef>
                <HelpDef term="Couldn’t save this device">Try again in a minute.</HelpDef>
              </HelpDefs>
            </>
          ),
        },
        {
          id: 'notifications-audit-t-audit-log',
          title: 'The member audit log',
          content: (
            <>
              <p>Owner-only. On a club plan it is the <strong>Audit log</strong> tab under <strong>Organization</strong>; on a tournament plan it is the <strong>Audit log</strong> button on <strong>Members</strong>. Four columns read as a sentence: <strong>when</strong>, <strong>who</strong>, <strong>what happened</strong>, and <strong>to whom</strong> — for example, &ldquo;Today, 9:14 a.m. · Sam Lee · Role changed: Staff → Admin · Priya Shah.&rdquo; Times show in your organization&rsquo;s own time zone, not the reader&rsquo;s.</p>
              <p>It records every kind of member change: role changes, program access turned on or off, a volunteer&rsquo;s job (&ldquo;Helping with: Both → The gate&rdquo;), invitations sent, suspensions and reinstatements, removals, a change to a Rep teams group&rsquo;s scope, and the two-step sign-in settings (turned on or off, or a member&rsquo;s reset).</p>
              <p>It also lists each time someone emails a team&rsquo;s pay link, sends a new one, or stops it: <strong>Emailed the pay link</strong>, <strong>Sent a new pay link (the old one stopped)</strong> or <strong>Stopped the pay link</strong>, with the team and its tournament under <strong>to whom</strong>, never an email address. A link that was stopped while its email went says so, and a new link that couldn&rsquo;t go out reads <strong>Stopped the pay link (the new one didn&rsquo;t go out)</strong>.</p>
              <p>It also lists two things done with a house-league sign-up&rsquo;s answers: <strong>Family file opened</strong> each time someone opens a file a family attached, and <strong>Health answers exported</strong> each time someone uses <em>Excel with contact details and health answers</em> on Registrations. Under <strong>to whom</strong> is the child and the season (the season alone for the export), never a file&rsquo;s name or an answer.</p>
              <p>It also lists each change to the club&rsquo;s privacy policy link on Settings: <strong>Privacy policy link added</strong>, <strong>changed</strong> or <strong>removed</strong>, never the address itself.</p>
              <p>Other activity (schedule and score edits, payments and refunds, family records, sign-ins) isn&rsquo;t listed here, so not seeing it doesn&rsquo;t mean it didn&rsquo;t happen. &ldquo;Nothing listed yet&rdquo; appears only once the log has actually loaded and found nothing — a failed load says so instead, with a way to try again.</p>
              <p>Export the same history as Excel or CSV from the <strong>Export</strong> button at the top of the page.</p>
            </>
          ),
        },
      ],
    },
    {
      id: 'modules',
      heading: 'Modules — what each one does',
      summary: 'What House league, Rep teams, Accounting, and the public org page add, and which plan includes each.',
      keywords: ['modules', 'house league', 'rep teams', 'accounting', 'families', 'public organization page', 'plan'],
      searchText: 'modules house league rep teams accounting families households public organization page league plus club included plan navigation automatic',
      content: (
        <>
          <p>Modules extend FieldLogicHQ beyond the core tournament tools. Each module adds a new section to your admin panel, shown in the left navigation once it is included in your plan.</p>
          <ul>
            <li><strong>Public Organization Page</strong> — A branded public landing page listing your tournaments, results, and registration links. Included on League Plus and above.</li>
            <li><strong>House league</strong> — Registration, divisions, seasons, game scheduling, standings, and league communications. Included on League Plus and above.</li>
            <li><strong>Accounting</strong> — The club’s ledger, budgets and budget vs. actual, costs shared across teams, and coaches’ payment requests. Included on Club.</li>
            <li><strong>Rep teams</strong> — Tryouts, rosters, player documents, and the Coaches Portal. Included on Club.</li>
            <li><strong>Families</strong> — Every household in the club, who owes and who is missing forms. Included on League Plus and Club.</li>
          </ul>
          <p>Modules appear automatically once your plan includes them — there is no separate activation step. If you expect a module and don't see it, confirm your plan on <strong>Plan &amp; billing</strong>, or contact support.</p>
        </>
      ),
    },
    {
      id: 'club-calendar',
      heading: 'The club calendar — every program’s week on one page',
      summary: 'Calendar, under Overview: every team’s games and practices, house league and your tournaments in one read-only week, with clashes marked.',
      keywords: [
        'calendar', 'club calendar', 'whole club', 'week', 'month', 'list', 'who is on the diamond', 'clash', 'clashes',
        'calendar on phone', 'calendar on my phone', 'phone tabs', 'where is the calendar on my phone', 'double booked', 'busy then', 'eastern time', 'time zone', 'export calendar', 'ics', 'read only', 'filter by venue',
        // One calendar (Club Tier 6c, 2026-10-10).
        'cancelled booking', 'cancelled game', 'postponed game', 'postponed', 'called off', 'status column', 'rows by day', 'today',
        // Permits (Club Tier 10a, 2026-10-11).
        'permit', 'outside the permit', 'not inside the club’s permit',
        // The club's schedules (Club Tier 11a, 2026-10-11).
        'club schedule', 'dome', 'shared slot', 'from the schedule', 'practice schedule',
        // Telling people away from the permit (Club Tier 13c Session B, 2026-11-08).
        'date off', 'dates off', 'see the permit', 'permit took the day', 'empty week', 'nothing is booked this week', 'next booking', 'go to that week', 'nothing in the next six weeks',
      ],
      searchText: 'calendar view button first button on a phone switch view calendar on phone calendar on my phone where is the calendar on my phone calendar tab phone tabs bottom bar club schedule practices from a schedule dome sunday slots a slot two teams share one booking naming both from row open the schedule calendar club calendar whole club schedule every team one page week view list view month view who is on lions park diamond 2 on tuesday clash clashes only amber pill double booked booked by busy then dashed may clash facility not set read window both sides head coach open the team schedule open in the coaches portal house league season schedule tournament day game count venue program team filter places the club doesn’t own export excel csv calendar ics what the page shows times in eastern time time zone sunday night game week read only cannot edit coaches keep their schedule list rows by day time range who what where today cancelled booking struck through postponed house league game still shown never a clash not counted status column scheduled cancelled postponed calendar file marks cancelled leaves postponed out one row of controls dates on their own row on a tablet not inside the club’s permit outside the permit permit the club holds rental booking contract said once in the window not a clash date off dates off outside the permit chip on the day see the permit warning beside each booking still standing postponed game not marked month marks the day empty week nothing is booked this week next go to that week next matching booking with filters on nothing in the next six weeks',
      content: (
        <p><strong>Calendar</strong>, directly under <strong>Overview</strong> in the menu (on a phone, a tab on the bar at the bottom), puts the whole club&rsquo;s week on one page and marks where two bookings want the same diamond at once. It is read-only: the coaches and the league keep their own schedules.</p>
      ),
      subtopics: [
        {
          id: 'club-calendar-t-whats-on-it',
          title: 'What the calendar shows',
          content: (
            <>
              <p>Every booking of the programs you can open, in <strong>List</strong>, <strong>Week</strong> or <strong>Month</strong>. It opens on this week. <strong>List</strong> reads as rows by day (today&rsquo;s headed <em>Today</em>): each booking&rsquo;s time, who and what, where, and any clash under it. <strong>Week</strong> shows each booking&rsquo;s full time, start to end.</p>
              <ul>
                <li><strong>Rep teams:</strong> each team&rsquo;s games, practices, team events and tryout days, as the coaches entered them. A booking&rsquo;s left edge is its team&rsquo;s colour.</li>
                <li><strong>House league:</strong> games and practices, marked <em>House league</em>.</li>
                <li><strong>Tournaments:</strong> one booking per tournament day, with its game count. A club team&rsquo;s own games in that tournament sit inside it rather than being listed again.</li>
                <li><strong>The club&rsquo;s schedules:</strong> once a schedule is final, its practices show on each team, named for the schedule. A slot two teams share is one booking naming both. Its window has a <strong>From</strong> row that opens the schedule, for the owner and admins (see <a href="#club-schedules">Schedules</a>).</li>
              </ul>
              <p>A <strong>cancelled</strong> booking, and a <strong>postponed</strong> house-league game, stay on the calendar, struck through and marked <strong>Cancelled</strong> or <strong>Postponed</strong>, so a called-off game never looks like an empty evening. Neither counts as a clash.</p>
              <p>A week with nothing in it says so and names what comes next: <em>Nothing is booked this week. Next: Mon, Nov 16 &middot; Harbourtown Invitational</em>, with <strong>Go to that week</strong> (on a phone, one row under the empty days). With filters on, it names the next booking that matches them. When nothing is booked in the next six weeks, it says <em>Nothing in the next six weeks</em>.</p>
              <p>A place the club doesn&rsquo;t own (an away park, a school field) shows exactly as the coach typed it. Every time is in your club&rsquo;s own time zone (<strong>Eastern time</strong>), whatever device reads it. A Sunday game at 9:30 p.m. stays in its own week, on any device.</p>
            </>
          ),
        },
        {
          id: 'club-calendar-t-clashes',
          title: 'Reading a clash',
          content: (
            <>
              <HelpDefs>
                <HelpDef term="Amber mark">Two bookings hold the same diamond at once, for example 13U AAA and 14U AA on Lions Park Diamond 2 on Tuesday. Both sides carry the mark.</HelpDef>
                <HelpDef term="Dashed edge">The booking <em>may</em> clash: it shares the venue at that time, but one side didn&rsquo;t pick a diamond, so it can&rsquo;t be sure.</HelpDef>
                <HelpDef term="The amber count">With the filters, the week&rsquo;s number of clashes. Click it to show only the clashes; click again to show everything.</HelpDef>
              </HelpDefs>
              <p>Open a booking to read both sides together: when, where (with the address), the team and its head coach, then <strong>Clashes with</strong> &mdash; the other booking, its diamond and its head coach. The link at the bottom opens that team&rsquo;s schedule (or <strong>Open in the Coaches Portal</strong>, if you coach the team), a house-league season&rsquo;s schedule, or the tournament. Nobody is notified about a clash; the club settles it.</p>
              <p>When the club holds a permit at the venue that day and the booking falls outside it, the window says so once, in a quiet grey line: <em>Outside the club&rsquo;s permit for Diamond 2</em> (or <em>Outside the club&rsquo;s permit at Lions Park</em> when no diamond is set). It never counts as a clash. When every permit the club held at that venue ended before the booking&rsquo;s day, the line says so instead: <em>Outside the club&rsquo;s permit for Diamond 1: the permit ended Sep 30, 2026.</em> Permits have their own place, <a href="#permits">Permits</a>, in the menu.</p>
              <p>When a permit&rsquo;s <strong>date off</strong> took bookings, the Calendar marks the day. Its heading carries an <strong>Outside the permit</strong> chip; for whoever can open Permits, the chip itself opens the permit with its notice. Each booking still standing that day carries the amber warning, and its window says why: <em>Outside the club&rsquo;s permit for Diamond A: Sat, Dec 5 is a date off.</em> Only the bookings the permit&rsquo;s own hours would have held are marked, never everything at the park. A postponed game holds no time, so it isn&rsquo;t marked, and neither is a booking that has already ended. In <strong>Month</strong>, the day carries the amber mark too (with the words <em>Outside the permit</em> on a computer). With filters on, a day is marked only while one of its marked bookings shows.</p>
            </>
          ),
        },
        {
          id: 'club-calendar-t-filters-export',
          title: 'Filters and Export',
          content: (
            <>
              <p>The controls are one row: the view, the dates, <strong>Venue</strong>, <strong>Program</strong>, <strong>Team</strong>, the clash count and <strong>Export</strong> (on a tablet the dates take their own row). <strong>Venue</strong>, <strong>Program</strong> and <strong>Team</strong> narrow the page; each choice shows its count. <strong>Places the club doesn&rsquo;t own</strong> collects the bookings that aren&rsquo;t on one of your venues. Filters start fresh each time you open the page. On a phone they sit behind <strong>Filter</strong>, and the view switch is the <strong>View</strong> button, the first button in that row.</p>
              <p><strong>Export</strong> saves what the page shows (the week or month on screen, as filtered) as <strong>Excel</strong>, <strong>CSV</strong> or a <strong>Calendar</strong> (.ics) file. The line at the top of its menu says what the file holds. Excel and CSV carry a <strong>Status</strong> column (Scheduled, Cancelled or Postponed); the Calendar file marks a cancelled booking cancelled and leaves a postponed game out.</p>
            </>
          ),
        },
        {
          id: 'club-calendar-t-who',
          title: 'Who sees what',
          content: (
            <p>Calendar shows to anyone who can open at least one program: the owner and admins see everything; a league admin or registrar sees house league; staff see the tournaments they work. Each person sees only the programs they can open. A clash with a program you can&rsquo;t open still shows, naming the other team, what it is and when, but not its people.</p>
          ),
        },
      ],
      faqs: [
        {
          id: 'faq-club-calendar-edit',
          question: 'Can I move or change a booking from the calendar?',
          answer: (
            <p>No. The calendar only reads. A team&rsquo;s coaches keep its schedule in their Coaches Portal, and house league and tournaments keep theirs. Open the booking and use its link to go to the schedule that owns it.</p>
          ),
          answerText: 'No. The club calendar is read-only. A team’s coaches keep its schedule in their Coaches Portal, and house league and tournaments keep theirs; open the booking and use its link to the schedule that owns it.',
          keywords: ['edit booking', 'move booking', 'change practice', 'read only', 'calendar'],
        },
        {
          id: 'faq-club-calendar-no-clash',
          question: 'Two teams were at the same park and the calendar shows no clash. Why?',
          answer: (
            <p>The calendar compares only bookings on one of the club&rsquo;s venues from the <strong>Venue library</strong>. A park typed by hand, or a coach&rsquo;s own place, is shown as written and never compared. Two different diamonds at one venue aren&rsquo;t a clash either. Ask the coaches to pick the club&rsquo;s venue and its diamond.</p>
          ),
          answerText: 'Only bookings on one of the club’s venues from the Venue library are compared. A typed park or a coach’s own place is shown as written and never compared, and two different diamonds at one venue are not a clash. Ask the coaches to pick the club’s venue and its diamond.',
          keywords: ['no clash', 'clash missing', 'typed location', 'not compared', 'calendar'],
        },
      ],
    },
    {
      id: 'permits',
      heading: 'Permits — the time the club holds at its venues',
      summary: 'Permits, under Calendar: the town permits and dome contracts the club holds, what each costs and how much of it is used, the flag on a permit whose dates off took bookings, adding, renewing and deleting.',
      keywords: [
        'permits', 'permit', 'permits place', 'where did permits go', 'permits moved', 'venue library permits', 'rental', 'contract', 'dome', 'town permit', 'field permit',
        'add permit', 'renew permit', 'delete permit', 'permit use', 'unused hours', 'a week', 'used', 'in use now', 'starts later', 'ended',
        'field price', 'half field', 'full field', 'budget line', 'pays for', 'payee', 'issuer', 'permit document', 'limited to some team groups', 'team groups', 'cannot change permit', 'file attached', 'cannot open permit file', 'pdf jpg png', 'word file', 'upload refused',
        'date off', 'dates off', 'holiday', 'city event', 'bookings outside this permit', 'outside this permit', 'still booked', 'stay booked', 'booked that day',
        'fix the practices', 'fiscal year', 'closed fiscal year', 'outside the permit', 'hand out this time', 'schedule from a permit',
        'date off one park', 'date off applies to', 'date off names a park', 'date off at one venue', 'all venues', 'park closed',
        // Telling people away from the permit (Club Tier 13c Session B, 2026-11-08).
        'this morning', 'overview card', 'count on permits', 'permits count', 'schedule health', 'counted once',
      ],
      searchText: 'a permit’s date off covers its own parks when it is copied into a schedule that uses more than one park and closes only those parks applies to all venues permits permit place sidebar under calendar above schedules phone more sheet first row where did permits go venue library permits switch moved old link lands here rental booking contract town field permit diamond permit dome winter contract fiscal year pill in use now starts later ended a week used hours held booked unused cost an hour held full field half field share a percent of a full field price an hour what each field costs budget line pays for issuer manage payees add a payee reference document upload renew for next year delete permit dates off date off why optional a city event closed fiscal year locked export the permit export the use excel for the town 2 dates off 8 bookings on them bookings are outside this permit now they stay booked until someone moves them doors fix the practices in the schedule open the schedule see the day on the calendar only what this permit’s own dates off took the list goes when nothing is left on those days booked that day practices and house-league games nothing booked that day warns never blocks hands this time out so the permit stays who sees permits owner admin league admin run tournaments accounting treasurer never staff scorekeeper registrar coach team groups limited to some team groups a team outside your groups held for the whole club rep program league read-only file attached open the file replace the file upload a pdf jpg or png word file refused file type isn’t held for a team in your team groups ask your club’s owner or an admin to change it one team',
      content: (
        <p><strong>Permits</strong> is the club&rsquo;s own list of the time it holds at its venues: a town&rsquo;s field permit, a dome&rsquo;s winter contract. It sits in the menu directly under <strong>Calendar</strong> (on a phone, it is a row in the <strong>More</strong> sheet) and comes with League Plus and Club. It used to be a switch at the top of the Venue library; an old link to that switch lands here.</p>
      ),
      subtopics: [
        {
          id: 'permits-t-who',
          title: 'Who sees it and who can change it',
          content: (
            <>
              <p>Permits are for the people who schedule, run tournaments or handle the money: the owner, admins, league admins, anyone given <strong>Run tournaments</strong>, and anyone who holds the club&rsquo;s Accounting (a treasurer). They see Permits and read every permit&rsquo;s time, use and file. Staff, scorekeepers, registrars and coaches don&rsquo;t: Permits isn&rsquo;t in their menu.</p>
              <p>Saving (<strong>Add permit</strong>, the pencil) is for the owner, admins, league admins and anyone given Run tournaments; someone who only holds Accounting reads, with no button and no pencil. A member limited to some team groups adds, edits, renews or deletes a permit, or replaces its file, only when the permit is held for a team in their groups; the form offers them <strong>One team</strong> only. A permit held for the whole club, the rep program or the league is outside their groups, so it is read-only for them: the window says <em>That permit isn&rsquo;t held for a team in your team groups. Ask your club&rsquo;s owner or an admin to change it.</em> The owner, admins and treasurers are never limited this way. A permit&rsquo;s cost, its price an hour and its budget line show only to people who hold the club&rsquo;s Accounting. If a save is refused, the window says why.</p>
            </>
          ),
        },
        {
          id: 'permits-t-list',
          title: 'The list: what each permit holds and uses',
          content: (
            <>
              <p>The pill beside <strong>Export</strong> picks the <strong>fiscal year</strong>; a permit is filed under the year it starts in.</p>
              <ul>
                <li>The table is grouped <strong>In use now</strong>, <strong>Starts later</strong> and <strong>Ended</strong>.</li>
                <li>Each row shows the permit, where it holds time, its dates, the hours it holds <strong>a week</strong>, and how much is <strong>Used</strong> (&ldquo;64%, 51.5 of 80 h&rdquo;, from every program&rsquo;s bookings).</li>
                <li><strong>Cost</strong> shows to people who hold the club&rsquo;s Accounting.</li>
                <li><strong>Export</strong> saves the list as an Excel file.</li>
                <li>A permit whose dates off took bookings carries a flag on its row, such as <em>2 dates off &middot; 8 bookings on them</em>. See <a href="#permits-t-dates-off">When a date off has bookings on it</a>.</li>
              </ul>
            </>
          ),
        },
        {
          id: 'permits-t-add-permit',
          title: 'Adding a permit',
          content: (
            <>
              <ol>
                <li>Click <strong>Add permit</strong>.</li>
                <li>Enter its name, who issued it, the reference, who it&rsquo;s for, and its first and last day. The issuer is one of the club&rsquo;s payees, the same list the Ledger uses: type a new name to save it as a payee, or choose <strong>Manage payees&hellip;</strong> at the foot of the list to add, rename or merge them without leaving the permit.</li>
                <li>Add its time as blocks: a venue, its facilities (none ticked means every facility there), the days, and from and until. <strong>Add a block</strong> for another night or another park; <strong>Add a date off</strong> for a holiday.</li>
                <li>If you hold the club&rsquo;s Accounting, add the cost, the budget line that pays for it, and what each field costs.</li>
                <li>Upload the issuer&rsquo;s copy (PDF, JPG, PNG or Word, up to 10 MB) and press <strong>Add permit</strong>.</li>
              </ol>
              <p>The file must really be a PDF, JPG, PNG or Word file: FieldLogicHQ checks the file itself, not just its name, and refuses anything else with <em>Upload a PDF, JPG, PNG or Word file.</em> A PDF or a picture opens in a new tab; a Word file downloads. The file&rsquo;s name shows without any folder part.</p>
              <p>A line under the blocks counts what you&rsquo;ve entered: &ldquo;2 blocks &middot; 8 weeks &middot; 80 h held&rdquo;. Under each date off, a line says what is booked that day; see <a href="#permits-t-dates-off">When a date off has bookings on it</a>.</p>
            </>
          ),
        },
        {
          id: 'permits-t-field-prices',
          title: 'What each field costs',
          content: (
            <>
              <p>A dome or park often prices its fields differently. Give each field in the permit <strong>Full cost</strong>, <strong>Half cost</strong> or <strong>A percent</strong> of a full field&rsquo;s price, and the permit works out an hour of each. The form shows each field&rsquo;s price an hour as you type, once the permit has its cost and its time.</p>
              <p>For example: $27,000.00 for four full fields and two half fields, Sundays 8:00&ndash;11:00 a.m., 25 Sundays, comes to <strong>$72.00 a full field</strong> and <strong>$36.00 a half</strong> an hour. The prices belong to the permit, not the venue, so next year&rsquo;s contract can price the same fields differently.</p>
            </>
          ),
        },
        {
          id: 'permits-t-dates-off',
          title: 'When a date off has bookings on it',
          content: (
            <>
              <p>A date off is a day the permit doesn&rsquo;t hold, such as a holiday or a city event. A booking that was already on that day stays where it is. FieldLogicHQ tells you about it; it never moves it and never stops you saving the date off. A permit&rsquo;s date off covers every park the permit holds time at. When it is copied into a schedule that uses more than one park, it closes only that permit&rsquo;s own parks there (see <a href="#club-schedules-t-time">New schedule: the time</a>).</p>
              <HelpDefs>
                <HelpDef term="In the form">Under each date off, a line says <em>Booked that day: 3 practices and 2 house-league games. They stay booked until moved.</em> or <em>Nothing booked that day.</em> The date off saves either way. <strong>Why (optional)</strong> takes a few words, such as <em>a city event</em>.</HelpDef>
                <HelpDef term="On the list">A permit whose dates off, from today on, took bookings carries a flag on its row: <em>2 dates off &middot; 8 bookings on them</em>.</HelpDef>
                <HelpDef term="In the permit&rsquo;s window">Open the permit and a notice heads the window: <em>8 bookings are outside this permit now: Dec 5 and Dec 12 are dates off. They stay booked until someone moves them.</em> It lists the bookings by day, each with its time, name, program and a <strong>Game</strong> or <strong>Practice</strong> chip.</HelpDef>
              </HelpDefs>
              <p>Under the list are doors, shown only where you can go. <strong>Fix the 6 practices in</strong> a schedule is for the owner and admins; <strong>Open</strong> a house-league season&rsquo;s schedule is for whoever opens house league; <strong>See</strong> a day <strong>on the Calendar</strong> is for anyone who sees the Calendar.</p>
              <p>The list holds only the bookings this permit&rsquo;s own hours would have held that day. It is never everything at the park, and it leaves out a booking another permit still covers. A booking that has already ended drops off the same day. The list goes when nothing is left on those days, or when the days have passed.</p>
              <HelpDefs>
                <HelpDef term="On the Overview">The owner and admins see a card under <em>This morning</em>: <strong>Outside the permit</strong>, the count, and <em>bookings on Sat, Dec 5 and Sat, Dec 12 &middot; Kinsmen Park</em>. It opens the permit (or <strong>Permits</strong>, when more than one permit has bookings on its dates off), and it shows only while something is outside a permit.</HelpDef>
                <HelpDef term="In the menu">The same count sits on <strong>Permits</strong> in the menu (on a phone, its row in <strong>More</strong>), for the owner and admins. A booking two permits both took counts once.</HelpDef>
                <HelpDef term="On the Calendar">The day is marked <strong>Outside the permit</strong>, with each booking on it (see <a href="#club-calendar">the club calendar</a>).</HelpDef>
                <HelpDef term="In house league">A season&rsquo;s <strong>Schedule health</strong> names each of its games on the day, with <strong>Give it a new date</strong>.</HelpDef>
              </HelpDefs>
            </>
          ),
        },
        {
          id: 'permits-t-permit-window',
          title: 'Reading a permit: its time, cost and use',
          content: (
            <>
              <p>Open a permit to read it: the issuer, reference and dates (its document opens from its name; for a member limited to some team groups, only on a permit held for one of their teams or for the whole club, and on a permit held for a team outside their groups the window says only <em>File attached</em>), its time (&ldquo;80 h held&rdquo;, and its dates off), its cost, and how much of it the club uses. The pencil edits the whole permit, and every change saves as you go.</p>
              <HelpDefs>
                <HelpDef term="An hour held">The cost divided by the hours held. When the fields are priced differently, the band shows a full field&rsquo;s hour, and a row for each price below it gives the fields at that price and their hour (&ldquo;Fields 1&ndash;4 &middot; Full field &middot; $72.00 an hour&rdquo;).</HelpDef>
                <HelpDef term="On the budget">The line under the cost: the budget line that pays for it. <strong>Open the line</strong> shows the line; &times; comes back.</HelpDef>
                <HelpDef term="Held / Booked / Unused">The hours it holds, the hours any program booked inside them (each hour counted once), and what&rsquo;s left. A row per block names who booked it.</HelpDef>
              </HelpDefs>
              <p><strong>Export</strong>, at the top beside The permit, saves an Excel workbook for the town or the dome: the permit&rsquo;s place, days, hours and dates, its cost, and its use by field and by date. Someone without the club&rsquo;s Accounting gets the same file without the cost.</p>
              <p><strong>Hand out this time in a schedule</strong>, at the end of the permit&rsquo;s window, opens New schedule started from the permit (for the owner and admins, where the plan has Schedules; see <a href="#club-schedules">Schedules</a>). While a schedule hands the permit&rsquo;s time out, a line names it, as a link to that schedule for people who build schedules, and <strong>Delete this permit</strong> isn&rsquo;t offered.</p>
              <p>A permit doesn&rsquo;t list the bookings that fall outside the club&rsquo;s permits in general. Each one says so itself, on its booking form and in the club calendar. The one exception is a booking on this permit&rsquo;s own dates off, above.</p>
            </>
          ),
        },
        {
          id: 'permits-t-renew',
          title: 'Renew, Delete and a closed year',
          content: (
            <HelpDefs>
              <HelpDef term="Renew for next year">At the end of a permit&rsquo;s window. It copies the permit a year on: the same blocks, fields, prices and issuer, with no reference, document, cost, budget line or dates off (a holiday moves). The copy opens for you to check.</HelpDef>
              <HelpDef term="Delete this permit">Red, and it asks first. Its blocks, prices, dates off and document go with it; the bookings it held stay where they are.</HelpDef>
              <HelpDef term="A closed fiscal year">A permit that starts in a closed fiscal year keeps its cost and budget line as they were. Its time can still change.</HelpDef>
            </HelpDefs>
          ),
        },
      ],
      faqs: [
        {
          id: 'faq-permits-cost',
          question: 'Why can’t I see a permit’s cost?',
          answer: (
            <p>A permit&rsquo;s cost, its price an hour and its budget line show only to people who hold the club&rsquo;s Accounting: the owner, the treasurer, and an admin with Accounting. Everyone else who opens Permits reads its time and its use.</p>
          ),
          answerText: 'A permit’s cost, its price an hour and its budget line show only to people who hold the club’s Accounting: the owner, the treasurer, and an admin with Accounting. Everyone else reads the permit’s time and use.',
          keywords: ['permit cost', 'cannot see cost', 'accounting', 'permit', 'rental', 'contract'],
        },
        {
          id: 'faq-permits-team-groups',
          question: 'I’m limited to some team groups. Why can’t I change this permit or open its file?',
          answer: (
            <p>You can add, edit, renew or delete a permit, or replace its file, only when it is held for a team in your team groups. A permit held for the whole club, the rep program or the league is outside your groups, so it is read-only for you: ask the club&rsquo;s owner or an admin to change it. You still see every permit in the list. You can open the file of a permit held for one of your teams or for the whole club; on a permit held for a team outside your groups the window says only <em>File attached</em>, and the file doesn&rsquo;t open.</p>
          ),
          answerText: 'You can add, edit, renew or delete a permit, or replace its file, only when it is held for a team in your team groups. A permit held for the whole club, the rep program or the league is outside your groups, so it is read-only for you: ask the club’s owner or an admin to change it. You still see every permit in the list. You can open the file of a permit held for one of your teams or for the whole club; on a permit held for a team outside your groups the window says only File attached, and the file does not open.',
          keywords: ['limited to some team groups', 'team groups', 'cannot change permit', 'cannot open permit file', 'file attached', 'permit', 'read-only', 'ask an admin'],
        },
        {
          id: 'faq-permits-file-type',
          question: 'Why was my permit file refused?',
          answer: (
            <p>A permit&rsquo;s file must really be a PDF, JPG, PNG or Word (.docx) file, up to 10 MB. FieldLogicHQ checks the file itself, not just its name, so anything else (an older .doc, a spreadsheet, a file renamed to look like a PDF) is refused with <em>Upload a PDF, JPG, PNG or Word file.</em> Save or export the issuer&rsquo;s copy as one of those and upload it again.</p>
          ),
          answerText: 'A permit’s file must really be a PDF, JPG, PNG or Word (.docx) file, up to 10 MB. FieldLogicHQ checks the file itself, not just its name, so anything else (an older .doc, a spreadsheet, a file renamed to look like a PDF) is refused with Upload a PDF, JPG, PNG or Word file. Save or export the issuer’s copy as one of those and upload it again.',
          keywords: ['permit file', 'upload refused', 'pdf jpg png', 'word file', 'docx', 'file type', 'permit document', 'upload a pdf jpg png or word file'],
        },
        {
          id: 'faq-permits-blocks',
          question: 'Does a permit stop anyone booking outside it?',
          answer: (
            <p>No. A booking at a venue where the club holds a permit, outside the permit&rsquo;s time, gets one quiet grey line under Venue (&ldquo;Outside the club&rsquo;s permit for Diamond 2&rdquo;) and still saves. The club calendar says it once more, in that booking&rsquo;s window. After the club&rsquo;s last permit at the venue has ended, the line reads &ldquo;&hellip;: the permit ended Sep 30, 2026&rdquo;. Nothing appears at a venue the club holds no permit at.</p>
          ),
          answerText: 'No. A booking outside the club’s permit gets one quiet grey line under Venue — “Outside the club’s permit for Diamond 2” — and still saves. The club calendar says it once more, in that booking’s window. After the club’s last permit at the venue has ended, the line reads “…: the permit ended Sep 30, 2026”. Nothing appears at a venue the club holds no permit at.',
          keywords: ['permit', 'outside the permit', 'permit ended', 'the permit ended', 'not inside the club’s permit', 'blocked', 'booking', 'rental'],
        },
        {
          id: 'faq-permits-date-off-bookings',
          question: 'I added a date off. Why are bookings still on that day?',
          answer: (
            <p>A date off tells FieldLogicHQ the permit doesn&rsquo;t hold that day; it doesn&rsquo;t move anything. The bookings stay until someone moves them, and the permit&rsquo;s window lists them with a door to each schedule or to the Calendar. Nothing is blocked and nobody is notified. Copied into a schedule that uses more than one park, the date off closes only that permit&rsquo;s own parks, so another town&rsquo;s park keeps its practices.</p>
          ),
          answerText: 'A date off tells FieldLogicHQ the permit doesn’t hold that day; it doesn’t move anything. The bookings stay until someone moves them, and the permit’s window lists them with a door to each schedule or to the Calendar. Nothing is blocked and nobody is notified. Copied into a schedule that uses more than one park, the date off closes only that permit’s own parks, so another town’s park keeps its practices.',
          keywords: ['date off', 'dates off', 'still booked', 'bookings on a date off', 'not moved', 'warns', 'permit', 'date off one park', 'applies to', 'all venues'],
        },
        {
          id: 'faq-permits-where-did-they-go',
          question: 'Where did Permits go in the Venue library?',
          answer: (
            <p>Permits is its own place now, in the menu under <strong>Calendar</strong> (on a phone, a row in the <strong>More</strong> sheet). The Venue library holds venues only. An old link to the library&rsquo;s Permits view lands on Permits.</p>
          ),
          answerText: 'Permits is its own place now, in the menu under Calendar (on a phone, a row in the More sheet). The Venue library holds venues only. An old link to the library’s Permits view lands on Permits.',
          keywords: ['where did permits go', 'permits switch', 'venue library', 'moved', 'permits'],
        },
      ],
    },
    {
      id: 'club-schedules',
      heading: 'Schedules — handing the club’s time out to its teams',
      summary: 'Schedules, under Calendar: hand the time the club holds (a dome’s winter Sundays, a town’s field permit) out to its rep teams and house league fairly, bill the teams for it, and send it.',
      keywords: [
        'schedules', 'club schedule', 'practice schedule', 'time slots', 'slots', 'dome', 'permit', 'hand out the time', 'share the time',
        'new schedule', 'no permit', 'link a permit', 'copy a schedule', 'start blank', 'start from the permit', 'several permits', 'more than one permit', 'two permits', 'applies to', 'all venues', 'date off one park', 'take a date off one park', 'from the permit', 'last year’s schedule', 'drafts', 'generate drafts', 'three more drafts', 'evenly',
        'by percentage', 'a set number a week', 'prime time', 'rules', 'facilities by group', 'teams’ days off', 'game day',
        'fair shares', 'grid', 'by team', 'by group', 'drag', 'move a slot', 'which weeks', 'undo', 'lock', 'swap', 'clear',
        'regenerate', 'bill the teams', 'allocation', 'by the time each team got', 'send for review', 'final now', 'finalize and send',
        'reply by', 'looks good', 'ask for a change', 'changed since sent', 'send the changes', 'bill the corrections', 'send log',
        'handed back', 'export schedule',
        // 2026-11-14: every schedule wears its state (Draft, In review, Final), and a final one with no bill reads Not billed on the Bill tile.
        'schedule status', 'status', 'state', 'pill', 'final', 'is it final', 'draft', 'in review', 'was it sent', 'do coaches know', 'not billed', 'no bill',
        // Club Tier Stage 11c (2026-10-13): sharing a facility, each team's time, rules as sentences. The old words stay
        // searchable ("teams at once", "rotate") so a club that knew them still lands here.
        'sharing a facility', 'share a facility', 'share a field', 'teams at once', 'two teams one field', 'half a facility', 'shared slot',
        'each team’s time', 'the same each week', 'moved around', 'rotate', 'spread out', 'early and late', 'add a rule', 'always', 'hours',
        // Club Tier Stage 11d (2026-10-13): a hand-back that asks for money back; a loss at Send the changes is credited.
        'money back', 'refund', 'credit', 'hand-back asked', 'ask for money back', 'time lost',
        // Club Tier Stage 11d part C (2026-10-16): a coach can take a hand-back back.
        'take it back', 'taken back',
        // Club Tier Stage 11d part B + Fair shares B (2026-10-16): the ask on the schedule's page; Fair shares above and below.
        'answer', 'answer an ask', 'ask on the schedule', 'late ask', 'money only', 'fair shares by team', 'what each team pays',
        'bill stays', 'nothing to send', 'ringed',
        // Money terms go only to people who can open Money (2026-11-13): who is emailed the bill, "gets it without the bill".
        'who gets the bill', 'bill email', 'money access', 'can open money', 'gets it without the bill', 'bill not emailed', 'nobody to send to',
        // Club Tier Stage 11b (2026-10-27): house league holds the club's time; the club takes it back; Send the changes tells its teams.
        'house league', 'house league’s time', 'give it to house league', 'give it to', 'programs', 'league admin', 'league admins divide',
        'take time back', 'takes time back', 'give a slot back', 'clear a slot', 'practices cancelled', 'house league never billed',
        'league plus no rep teams', 'house-league teams told', 'families emailed', 'practices changed',
        // Club Tier Stage 13d Session A (2026-11-13): house league asks for time; the bell when the club gives or takes it; the send window's house league line.
        'ask for time', 'house league asks for time', 'the club gave house league time', 'the club took back house league time', 'open house league’s time', 'who is told house league', 'house league a notification', 'owners and admins by notification', 'hours a week to divide',
        // Club Tier Stage 13d Session B (2026-11-13): the Bill window names Accounting's allocations and a line it can't offer.
        'accounting already bills this line', 'see the line', 'the line has left', 'bill it off-plan', 'no budget line', 'off-plan', 'charged twice', 'permit’s line can’t be billed',
        // Add time as its own part (2026-11-17): a part of a sent schedule, its own bill, sent in one go with the schedule.
        // Pick the fields (2026-11-25): a schedule on some of a permit's fields; each card's own Add hours; a permit's time stops at its dates.
        'pick the fields', 'some of the fields', 'some of a permit’s fields', 'part of a permit', 'fewer fields', 'two fields', 'untick a field', 'every facility on this permit', 'not on this schedule', 'not on this added time', 'fields left off', 'what is left for another schedule', 'add hours with no permit', 'second row on a permit', 'different fields at different hours', 'its time stops there', 'permit ends', 'past the permit’s last day', 'its time starts there',
        'add time', 'add time…', 'more time', 'extra time', 'extra evening', 'new permit', 'permit added later', 'time added', 'part', 'parts', 'a part of the schedule', 'part filter', 'every part', 'which part', 'regenerate which part', 'settings for which part', 'a bill of its own', 'separate bill', 'second bill', 'second charge', 'bill it', 'bill set', 'sent without a bill', 'it’s free', 'it\'s free', 'its free', 'sent free', 'tools bill', 'bill a part later', 'accounting sends this one', 'only time on the schedule', 'can\'t be taken off', 'take a part off', 'take it off', 'part taken off', 'sent part', 'part-way', 'only part of it went out',
      ],
      searchText: 'a schedule on two of a dome\'s six fields tick only the fields this schedule uses every facility on this permit fields 3–6 are not on this schedule fields left off free for another schedule the card\'s own add hours another row on that permit priced by it fields 1 and 2 all morning fields 3–6 for the last slot add hours with no permit a permit\'s time stops at its own dates its time stops there its time starts there a field its permit doesn\'t hold it\'s free its free marked free no undo tools bill the part later someone with the club\'s accounting sends this one accounting sends this one take it off the only time on the schedule can\'t be taken off add other time first the credit comes off the latest payment first played practices stay add time to a sent schedule a fourth month on a new permit an extra evening time added as its own part the part filter every part regenerate which part settings for which part bill it change bill set not billed a bill of its own a separate bill a second charge on money club sent without a bill take a part off only part of it went out the rest waits send the changes sends the schedule and its parts in one send accounting already bills this line see the line this bill is more than the line has left pick another line or bill it off-plan no budget line off-plan no line’s budget is used the permit’s line nothing left closed year another year charges those teams twice bill from planned and left house league asks for time ask for time ask again the club gave house league time the club took back house league time open house league’s time house league 2 hours a week to divide jules moreau league admin house league owners and admins by a bell a bell only no email unless turned on in notification settings who is told house league line schedules club schedule practice schedule time slots slots dome winter sundays town field permit hand out the time share the time fairly rep teams new schedule permit no permit link a permit copy a schedule start blank start from the permit last year’s schedule a year on venue facilities all none dates days hours add hours slot length changeover teams at once dates off 25 sundays 6 fields 12 slots a sunday 300 slots who and how much split the time evenly by percentage a set number a week group figure 60 40 slots column closing row left open held by a tryout day practices per team per day 1 a day one practice a day can use of the slots left open at 1 practice a day nothing left open raise the setting over 100% prime time shared the same way shared evenly by team no season running rules earliest and latest start start after finish by teams’ days off at most a day at most a week keep each team’s nights rotate it weekly facilities by group only for never on a team’s game day away games never over a booking already on the books no back-to-back days generate drafts three drafts ranked three more drafts by team by day export a draft excel pdf save as a draft nothing reaches a team schedule’s page grid a week monday first one weekday dates across seven at a time facility filter team filter clashes amber pill by team by group a week slots hours prime time days drag a chip which weeks this week only this & later weeks every week undo a moved slot locks itself give it to change team house league lock this slot unlock swap with clear this slot tools settings regenerate the unlocked slots lock this week unlock this week clear this week send log delete this draft phone reads day by day one day at a time next day choose a day computer changes fair shares handed out open short clashes the bill bill the teams finalized without a bill send the bill review the bill bill from budget line the permit’s cost a part of it split by the time each team got full field half field an hour payments one payment monthly every two months dates i choose nothing is billed until you finalize money club tab send for review first final now books and bills reply by who is told head coach and staff see the email in review replied looks good asked for a change finalize and send changed since sent send the changes only those teams told bill the corrections owed back send log handed back open handed back by notification schedules section families are not emailed sharing a facility share a field two teams one facility at once paired whenever a partner is free plays alone half a facility a third a quarter shared slot shared each team’s time the same each week moved around spread out rotate early and late taken in turn facilities taken in turn keeps its days add a rule start and finish times a team’s day off facilities for a group at most a day or a week always remove this rule not in use finish this rule or remove it a third mix hours early fields 50 shared 37.5 hours full-field hours time on the clock clock hours whole schedule half-field slots shared slots open slots share with take off add slot holds 2 teams at once a coach asks for money back ask on the schedule callout above the grid answer accept decline asked by the sundays stay the team’s until you answer ringed hand back arrow hand-back asked which team asked late ask money only their time is already open your answer moves only the money someone who holds the club’s accounting answers the bell opens the schedule with answer open nothing to send a hand-back never changed since sent fair shares by team band above the toolbar fair shares and the bill the bill tile open tile window the bill as finalize made it from the permit top line permit door outside the permit dates off on the permit needs attention take dec 5 and dec 12 off regenerate the schedule’s own dates off see them league admins to move different on a date slots 25 of 65 175 of 450 practices per team per day teams short change the rules what each team pays after credits and money given back same as money club its bill stays without asking for money house league holder house league’s share of the time all of it goes to house league no drafts its league admins divide it among divisions and teams programs group give it to house league one row never billed no bill no allocation no credit league plus club with no rep teams a house league season running nothing to hand time to a slot is held by rep teams or by house league never both held by take time back give a slot back clear this slot the question practices still to come house league uses this time nothing changes until you send the changes practices cancelled when you send moved the same week past practices stay send the changes with house league in it a row for each house-league team coaches and families who is told people unticking a team its practices still move bell league admins owners admins changed house league’s practices families get one email a household practices changed now was no link even a family that unsubscribed game changes are not in this window',
      content: (
        <p><strong>Schedules</strong>, directly under <strong>Calendar</strong> in the menu, is where the club hands out the time it holds (a dome&rsquo;s winter Sundays, a town&rsquo;s field permit) to its rep teams and to house league: by the shares and rules you set, with each rep team&rsquo;s share of the cost. The owner and admins see it on League Plus and Club, once the club has rep teams or a house league season running.</p>
      ),
      subtopics: [
        {
          id: 'club-schedules-t-list',
          title: 'The Schedules list',
          content: (
            <>
              <p>Every schedule the club has made, grouped <strong>In use now</strong>, <strong>Coming up</strong> and <strong>Ended</strong>, with its dates, its teams, how many slots it has handed out (and how many are open), and when it was last sent. Its chip says where it stands: <strong>Draft</strong> (nothing has reached a team), <strong>In review</strong> (sent for the coaches to reply), or <strong>Final</strong> (on the teams&rsquo; schedules). Each schedule is kept, to change it or to start next year&rsquo;s from it.</p>
              <p><strong>New schedule</strong> is on a computer. On a phone the list and every schedule read; changes wait for a computer.</p>
            </>
          ),
        },
        {
          id: 'club-schedules-t-time',
          title: 'New schedule: the time',
          content: (
            <>
              <ol>
                <li>Click <strong>New schedule</strong>. Once the club has a schedule, the window opens on the club&rsquo;s schedules, newest first: click one to copy it (its time, teams, shares and rules, a year on), or click <strong>Start blank</strong>. To change your mind, click <strong>Cancel</strong> and open New schedule again; nothing is saved until you generate drafts.</li>
                <li>Give it a <strong>Name</strong> and tick its <strong>Permits</strong> (one, or every permit the schedule hands out): each permit fills in its venue, facilities, dates, hours and dates off, and the schedule stays linked to it: its prices follow the permit, but a date off the permit takes later doesn&rsquo;t reach the schedule by itself (its page says so, in <a href="#club-schedules-t-page">Needs attention</a>). Untick a permit and its rows and dates off come off with it; a day another ticked permit still has stays. Leave <strong>No permit</strong> to enter the time yourself. Copy last year&rsquo;s schedule, then pick this year&rsquo;s permit, to put last year&rsquo;s teams, shares and rules on this year&rsquo;s time. Started from a permit&rsquo;s page, the permit is already picked: a copy keeps its time, or click <strong>Start from the permit</strong>.</li>
                <li>With a permit, its time sits in a card of its own, each row with a <strong>Facilities</strong> list: tick only the fields this schedule uses (see <a href="#club-schedules-t-fields">A schedule on some of a permit&rsquo;s fields</a>). With <strong>No permit</strong>, pick the <strong>Venue</strong> and its <strong>Facilities</strong> (<strong>All</strong> · <strong>None</strong>) and the rows of <strong>Days</strong> and hours (<strong>Add hours</strong> for another night).</li>
                <li>Check the first and last day. A permit&rsquo;s time stops at its own dates, and the line under <strong>To</strong> says so when you type past them.</li>
                <li>Set the <strong>Slot length</strong> (each team&rsquo;s time on a facility) and the <strong>Changeover</strong> between slots. Add any <strong>Dates off</strong>.</li>
              </ol>
              <p>Once the time uses more than one park, each date off has <strong>Applies to</strong>, with <strong>All venues</strong> first: leave it, or tick the venues the day closes (a town&rsquo;s parks, say), so a town&rsquo;s long weekend can leave another town&rsquo;s park alone. A date off that came from a permit says <em>From</em> and the permit&rsquo;s name under it, and covers that permit&rsquo;s own parks. Two permits&rsquo; rows for one day are saved as one date off. <strong>All venues</strong> wins over a list; otherwise the parks are added together. The printed schedule names the parks (&ldquo;Dates off: Sat, Mar 27 (Easter weekend, at Kinsmen Park)&rdquo;).</p>
              <p>A line under the time counts it as you go: &ldquo;25 Sundays &middot; 6 fields &middot; 12 slots a Sunday &middot; 300 slots&rdquo;. Which teams share a facility is a rule, not part of the time (see <a href="#club-schedules-t-sharing">Sharing a facility</a>). A permit&rsquo;s window also has <strong>Hand out this time in a schedule</strong>, which opens New schedule with that permit picked.</p>
            </>
          ),
        },
        {
          id: 'club-schedules-t-fields',
          title: 'A schedule on some of a permit’s fields',
          content: (
            <>
              <p>A schedule can use some of a permit&rsquo;s fields and leave the rest for another schedule: a dome&rsquo;s Fields 1 and 2 for January, say. In <strong>New schedule</strong>, each permit you tick brings a card with its rows of time.</p>
              <ol>
                <li>On a row, open <strong>Facilities</strong>. It lists the fields that permit holds, with the venue&rsquo;s name at the end of the label.</li>
                <li>Tick the fields this schedule uses. <strong>Every facility on this permit</strong> puts them all back. The card then names what is left off: &ldquo;Fields 3&ndash;6 are not on this schedule.&rdquo;</li>
                <li>For different fields at different hours, click the card&rsquo;s own <strong>Add hours</strong>. It adds another row on that permit, priced by it, starting with the fields the other rows don&rsquo;t use (Fields 1 and 2 all morning, Fields 3&ndash;6 for the last slot).</li>
              </ol>
              <ul>
                <li><strong>Add hours with no permit</strong>, under the cards, adds time no permit covers.</li>
                <li>The bill counts only the field-hours teams hold, at the permit&rsquo;s price.</li>
                <li>A permit&rsquo;s time stops at its own dates: type a <strong>To</strong> past its last day and the line under it says &ldquo;Dome, winter 2027 ends Sun, Mar 7. Its time stops there.&rdquo; A <strong>From</strong> before its first day says the same at the start.</li>
                <li>A row can only name fields its permit holds; a field it doesn&rsquo;t hold is refused when you save.</li>
              </ul>
              <HelpNote variant="info" title="Two schedules on one permit">A second schedule isn&rsquo;t told that the first one already uses Fields 1 and 2. Tick the fields the card said were left off.</HelpNote>
            </>
          ),
        },
        {
          id: 'club-schedules-t-who',
          title: 'Who gets how much',
          content: (
            <>
              <p>Under <strong>Who, and how much</strong>, tick the teams that get time. Only a team with its season running can be given time; a line names any that aren&rsquo;t. Two choices sit side by side:</p>
              <HelpDefs>
                <HelpDef term="Split the time"><strong>Evenly</strong> (every ticked team the same), <strong>By percentage</strong> (each team&rsquo;s share, or a figure on a group&rsquo;s row shared among its teams: 60 on Senior, 40 on Junior; over 100% holds <strong>Generate drafts</strong>), or <strong>A set number a week</strong> (each team&rsquo;s slots a week).</HelpDef>
                <HelpDef term="Each team’s time"><strong>The same each week</strong>: each team keeps its facility and start time week to week, so families can plan around it. <strong>Moved around</strong>: early and late starts and the facilities are taken in turn, so no team always has the first slot. Either way, each team keeps its days.</HelpDef>
              </HelpDefs>
              <p>The <strong>Slots</strong> column is what the time gives each team, worked out as you type. When <strong>Practices per team, per day</strong> is what leaves slots open, each team reads what it can get at that setting, of its share (&ldquo;25 of 65&rdquo;), and the total agrees with the hint beside the setting (&ldquo;175 of 450&rdquo;); with no daily limit it reads the share alone. If a draft then comes up short for that reason, the drafts say why, with <strong>Change the rules</strong> to go back to the setting. The closing row says what is left open, and why: &ldquo;64 slots left open. 2 more are held by 13U AAA&rsquo;s tryout day.&rdquo; or &ldquo;50 slots left open: 9U AA and 11U AA share a facility.&rdquo;</p>
              <p><strong>Practices per team, per day</strong> starts at 1, which keeps a team from back-to-back sessions. On a permit with one day a week, that setting is often what leaves time open, and the hint beside it says how much: &ldquo;At 1 a day, 7 teams can use 175 of the 450 slots.&rdquo; The closing row says the same (&ldquo;275 slots left open at 1 practice a day.&rdquo;) rather than &ldquo;Nothing left open.&rdquo; Raise the setting to let each team hold more of the time. <strong>Evenly</strong> shares the practices out one at a time to whichever team is furthest behind, so a slot a team can&rsquo;t use goes to a team that can.</p>
              <p><strong>Prime time</strong>, at the end of the card, sets the hours every team wants (Weeknights, Weekends or Every day, from and until). By percentage, <strong>How it&rsquo;s shared</strong> beside it is <strong>Shared the same way</strong> as the time or <strong>Shared evenly by team</strong>. Whether a team keeps its prime-time slot or takes it in turn is Each team&rsquo;s time.</p>
            </>
          ),
        },
        {
          id: 'club-schedules-t-house-league',
          title: 'Giving time to house league',
          content: (
            <>
              <p>House league holds the club&rsquo;s time the way a rep team does, and its league admins divide it among its divisions and teams (see <a href="../help/house-league#house-league-time">House league&rsquo;s time</a>). Give it a whole schedule, a share of one, or a slot at a time.</p>
              <HelpDefs>
                <HelpDef term="A whole schedule">In <strong>New schedule</strong>, under <strong>Who, and how much</strong>, tick only <strong>House league</strong>. Its row reads <em>Its league admins divide it among divisions and teams.</em> There are no drafts to choose from, and the split, each team&rsquo;s time, prime time and rules are not shown. The foot says what it gets (&ldquo;House league gets 30 hours a week across 2 facilities, Jun 1 &ndash; Aug 31&rdquo;), and <strong>Give it to house league</strong> makes the schedule final at once. Nobody is emailed, because there is no team to tell.</HelpDef>
                <HelpDef term="A share">Tick <strong>House league</strong> beside rep teams. It sits under <strong>Programs</strong> in the list, and the drafts place its slots like a team&rsquo;s. Its league admins divide them after you send.</HelpDef>
                <HelpDef term="One slot">Click the slot and choose <strong>Give it to</strong> &rsaquo; <strong>House league</strong> (under <strong>Programs</strong>). The slot then reads <strong>Held by</strong> House league. A slot is held by rep teams or by house league, never both, and a rule can&rsquo;t name house league.</HelpDef>
              </HelpDefs>
              <ul>
                <li>House league is never billed. Its time has no bill, no allocation and no credit, and Fair shares counts rep teams only.</li>
                <li>A League Plus club with no rep teams can use Schedules to give house league its time, as long as a house league season is running. With neither a rep team season nor a house league season to give time to, the club is told <em>There are no rep teams or house-league seasons running to hand time to yet.</em></li>
                <li>Time you take back from house league later waits for <strong>Send the changes</strong> (see <a href="#club-schedules-t-take-back">Taking time back from house league</a>).</li>
                <li><strong>A league admin can ask.</strong> When a house league season has no time, its league admin sees <strong>Ask for time</strong> (it can be asked again after 7 days). You see <strong>House league asks for time</strong> under <em>This morning</em> on the Overview (see <a href="#club-overview">The club&rsquo;s Overview</a>), and the owner gets a bell. The ask clears when you give that season time. Only an owner or an admin gives it; the button only asks.</li>
                {/* spelling-ok: a season's own name in the example */}
                <li><strong>A bell when you give it.</strong> When you send a schedule that gives house league time, or Send the changes adds or takes back some, everyone who runs house league (owners, admins and league admins, never you) gets a bell: <strong>The club gave house league time</strong> or <strong>The club took back house league time</strong>, once for each season the time falls in, with its button <strong>Open House league&rsquo;s time</strong>. It reads like <em>&ldquo;Saturdays at Kinsmen, December 2026&rdquo; gives 2026 Fall House League 2 hours a week: Sat &middot; 9:00&ndash;11:00 a.m. &middot; Kinsmen Park, Dec 5 &ndash; Dec 19. Divide it into games and practices.</em> It is a bell only; email copies stay off unless a person turns them on in notification settings.</li>
              </ul>
            </>
          ),
        },
        {
          id: 'club-schedules-t-rules',
          title: 'The rules the drafts keep',
          content: (
            <>
              <p><strong>Rules</strong> lists only the rules you added, each as its sentence (&ldquo;Field 5 and Field 6 only for Junior&rdquo;, &ldquo;13U AAA off Sun, Dec 20&rdquo;). The pencil opens a rule where it is; &#10003; closes it, and <strong>Remove this rule</strong> at its end takes it out. Nothing is saved until you generate the drafts. <strong>Add a rule</strong> offers each kind:</p>
              <HelpDefs>
                <HelpDef term="Start and finish times">Teams that start after, or finish by, a time (the youngest done by 8:00 p.m.).</HelpDef>
                <HelpDef term="A team’s day off">A team off on a date, or on a day every week, with why.</HelpDef>
                <HelpDef term="Facilities for a group">Facilities kept for a group or a team (&ldquo;Field 5 and Field 6 only for Junior&rdquo;).</HelpDef>
                <HelpDef term="Sharing a facility">Teams that share a facility, 2 to 4 at once (see <a href="#club-schedules-t-sharing">Sharing a facility</a>).</HelpDef>
                <HelpDef term="At most, a day or a week">A cap on any one team&rsquo;s slots.</HelpDef>
              </HelpDefs>
              <p>Under <strong>Always</strong> are three ticks: never on a team&rsquo;s game day (away games included), never over a booking already on the books, and no back-to-back days for a team. <strong>Rules &middot; 5 on</strong> counts each rule and each tick that is on. A rule left half-filled holds <strong>Generate drafts</strong> until you finish or remove it; a rule naming only teams you haven&rsquo;t ticked reads <strong>not in use</strong>.</p>
            </>
          ),
        },
        {
          id: 'club-schedules-t-sharing',
          title: 'Sharing a facility',
          content: (
            <>
              <p>Some teams fit two to a facility, often the youngest. <strong>Sharing a facility</strong>, under <strong>Add a rule</strong>, names them: pick teams or a group, and how many <strong>At once</strong> (2, 3 or 4). A group&rsquo;s rule follows the group, so a team added to Junior shares too.</p>
              <ul>
                <li>Those teams are paired whenever a partner is free. Every other team keeps a facility to itself, and a half facility is never shared.</li>
                <li>When a team&rsquo;s partner can&rsquo;t play that day (a day off, a game), the team plays alone.</li>
                <li>A shared slot is half a facility (a third for three, a quarter for four): half the hours toward a team&rsquo;s share, and half the cost on the bill.</li>
              </ul>
              <p>With <strong>A set number a week</strong>, a shared slot still counts as a practice, so sharing frees time: 9U AA and 11U AA at 2 a week take 2 slots a Sunday between them, and the foot counts what Generate hands out (&ldquo;250 slots for 8 teams.&rdquo;). With <strong>Evenly</strong> or <strong>By percentage</strong>, a share is time, so a team that shares gets twice the practices, each on half a facility.</p>
              <p>On the grid, a shared slot shows both names stacked, its edge in each team&rsquo;s colour. It moves from its window, not by dragging: <strong>Give it to</strong> names both teams (<strong>Take 9U AA off</strong>, <strong>Add 11U AA</strong>), and a lone sharing team&rsquo;s list has <strong>Share with</strong>. A slot that is full for its rule says so: &ldquo;A slot holds 2 teams at once.&rdquo;</p>
            </>
          ),
        },
        {
          id: 'club-schedules-t-drafts',
          title: 'The drafts, and saving one',
          content: (
            <>
              <p><strong>Generate drafts</strong> makes three, ranked. With teams kept <strong>The same each week</strong> they are <strong>Best overall</strong>, <strong>Another mix</strong> and <strong>Youngest earliest</strong>; <strong>Moved around</strong> gives <strong>Best overall</strong>, <strong>Another mix</strong> and <strong>A third mix</strong>, all three moving teams. Each card says how it measures up: every team its slots, each on the same nights, how evenly early and late fell (&ldquo;12 or 13 early starts each&rdquo;), a shared facility (&ldquo;half a facility each&rdquo;) and any slots left open. <strong>Three more drafts</strong> makes three different ones. Read the chosen one <strong>By team</strong> or <strong>By day</strong> (every date&rsquo;s slots), and <strong>Export</strong> it as Excel or PDF before you keep it.</p>
              <p><strong>Save as a draft</strong> keeps it. Nothing reaches a team until you send it; on its page you can read every week, export it, change the settings and adjust it by hand.</p>
            </>
          ),
        },
        {
          id: 'club-schedules-t-page',
          title: 'A schedule’s page',
          content: (
            <>
              <p>The page opens on the <strong>Grid</strong>: a row per facility and a column per day, Monday first, across the page&rsquo;s whole width. The line under the name starts with the permit the schedule came from: <strong>From the permit Saturday diamonds, December 2026 &rsaquo;</strong> opens that permit (<strong>From the permits</strong>, each one a link, when there are several). <strong>Fair shares</strong>&rsquo; figures sit in a band above the grid, and <strong>The bill</strong> in it opens <strong>Fair shares and the bill</strong> (see <a href="#club-schedules-t-fair">Fair shares</a>). A schedule on one weekday shows its dates across instead, seven at a time (Oct 4 &ndash; Nov 15). The arrows step through the weeks or the dates.</p>
              <ul>
                <li>The pill after the schedule&rsquo;s name, here and on every row of the Schedules list, says where it stands: <strong>Draft</strong> (not sent, so no coach knows about it), <strong>In review</strong> (sent, waiting on the teams&rsquo; replies) or <strong>Final</strong> (sent and booked). A final schedule you have changed since it was sent also wears the amber <strong>Changed since sent</strong>, beside Final. On a phone the pill sits on the line under the name.</li>
                <li><strong>View</strong> picks <strong>Overview</strong> (a sent schedule on one weekday), <strong>Grid</strong>, <strong>By team</strong> or <strong>By group</strong>.</li>
                <li><strong>Facility</strong> and <strong>Team</strong> narrow the grid; the amber <strong>Clashes</strong> count shows only the slots a booking already holds.</li>
                <li><strong>By team</strong> lists each team&rsquo;s slots a week, its slots and hours in all, its prime time and its days, every figure across the whole schedule, whichever dates the grid shows. <strong>Hours</strong> are time on the clock; where a shared slot or a half field counts half, the full-field hours sit under them (&ldquo;9 h&rdquo; over &ldquo;7.5 full-field hours&rdquo;). A row opens that team&rsquo;s slots. <strong>By group</strong> adds them up by group.</li>
                <li><strong>Export</strong> saves the schedule as Excel or PDF, and as a Calendar file once it&rsquo;s final.</li>
              </ul>
              <p>When a permit takes a date off after the schedule was made, the schedule doesn&rsquo;t change by itself, and <strong>Needs attention</strong> says so first, with one <strong>Outside the permit</strong> row for each permit that has one: &ldquo;Sat, Dec 5 and Sat, Dec 12 are dates off on the permit&rdquo;, the practices still on those days and the teams that have them, and any house-league games there, which are for the league admins to move (<strong>See them</strong>). <strong>Take Dec 5 and Dec 12 off</strong> opens <strong>Regenerate the unlocked slots</strong> with those days added to this schedule&rsquo;s own dates off. On a schedule that uses more than one park the button names the park (<strong>Take Dec 5 off Kinsmen Park</strong>), and only that permit&rsquo;s parks close. Nothing changes until you keep a draft, and the teams keep their practices until you send the changes. The warnings above the grid start with the same days, and the Overview&rsquo;s <strong>Different on a date</strong> lists each of them. The row goes once nothing of the schedule is left on those days, or the days have passed.</p>
              <p>On a phone the page reads by <strong>Day</strong> or <strong>By team</strong>. Day shows one day&rsquo;s slots; its arrows step only through the days the schedule has slots on (a Sundays-only schedule goes Sunday to Sunday), and tapping the date lists them all to jump to one. Moves, Tools&rsquo; changes, Finalize, <strong>Take &hellip; off</strong> and Fair shares are on a computer.</p>
            </>
          ),
        },
        {
          id: 'club-schedules-t-moves',
          title: 'Moving slots by hand',
          content: (
            <>
              <ol>
                <li>Drag a team&rsquo;s slot to another. While you drag, the slot under it says what happens: green is open or a swap, amber is a slot a booking holds or a rule the drafts keep, red means the team would be in two slots at once, and the slot springs back.</li>
                <li>Pick the weeks: <strong>This week only</strong>, <strong>This &amp; later weeks</strong> or <strong>Every week</strong>.</li>
                <li>The notice at the foot says what moved, with <strong>Undo</strong>.</li>
              </ol>
              <p>A slot moved by hand locks itself, so a regenerate never moves it back. A shared slot moves from its window, not by dragging. Click a slot to give it to a team or house league (<strong>Give it to</strong>), <strong>Lock</strong> or <strong>Unlock</strong> it, <strong>Swap with&hellip;</strong> another, or <strong>Clear this slot</strong>. <strong>Tools</strong> holds <strong>Settings&hellip;</strong>, <strong>Regenerate the unlocked slots&hellip;</strong>, <strong>Lock this week</strong> (which reads <strong>Unlock this week</strong> once every slot that week is locked), <strong>Clear this week&hellip;</strong>, the <strong>Send log</strong> and <strong>Delete this draft&hellip;</strong>.</p>
            </>
          ),
        },
        {
          id: 'club-schedules-t-take-back',
          title: 'Taking time back from house league',
          content: (
            <>
              <p>Give a slot house league holds to a team, or clear it, and the slot&rsquo;s window asks first, but only when house-league practices still to come sit on it. A slot with no practices on it changes with no question.</p>
              <ol>
                <li>Choose the team in <strong>Give it to</strong>, or click <strong>Clear this slot</strong>. The question names the date (&ldquo;Give Thu, Jun 3 at 6:00 p.m. to Reds?&rdquo; or &ldquo;Clear Thu, Jun 3 at 6:00 p.m.?&rdquo;) and the practices: <em>House league uses this time: the Reds&rsquo; and Blues&rsquo; practices. Their coaches and families are told when you send the changes.</em></li>
                <li>Confirm with <strong>Give it to</strong> the team, or <strong>Clear this slot</strong>. The note says <em>Nothing changes until you send the changes</em>, and that the division&rsquo;s league admins are told then.</li>
                <li>Press <strong>Send the changes</strong> on the schedule&rsquo;s page. Until then house league keeps the time and its practices.</li>
              </ol>
              <p>When you send, the practices still to come on that time are cancelled, and past practices stay. If house league was given other time the same week, its practices move there instead, at the same length; one that doesn&rsquo;t fit the new slot is cancelled. The coaches and families of those teams are emailed only if you leave the team ticked in <a href="#club-schedules-t-send-league">Send the changes</a>.</p>
            </>
          ),
        },
        {
          id: 'club-schedules-t-fair',
          title: 'Fair shares',
          content: (
            <>
              <p>Above the toolbar, one band reads <strong>Handed out</strong> (&ldquo;250 of 300&rdquo;: a shared slot counts once), <strong>Open</strong>, <strong>Short</strong> and <strong>Clashes</strong> for the whole schedule. Its second figure opens <strong>Fair shares and the bill</strong>: <strong>The bill &rarr;</strong> for someone who holds the club&rsquo;s Accounting, <strong>Open &rarr;</strong> for anyone else, who reads the same table without the bill. While any team is short of its share or any slot is open, one amber line just above the grid says so for the whole season (&ldquo;8 teams are 1 slot short of their share, and 8 slots are open, all on Sun, Mar 7&rdquo;). <strong>See why</strong>, or the <strong>Short</strong> figure, opens <strong>Open slots and short teams</strong>: why each open slot is open (one practice a week holds a group back, a field kept for one group, or nobody is owed it), what each short team has of its share, and a door to the setting that would change it. Where a team that is short, free then and allowed there can take an open slot, <strong>Give it to</strong> hands it over in one step. The shares are the limit: the schedule never gives a team more than its share to fill open time. A slot a booking holds also reads in amber on the week&rsquo;s lines. When more than three slots on screen clash, they read as one line per kind of booking (&ldquo;70 slots clash with practices already booked for 11U AA, 12U AA and 6 more&rdquo;), and the grid marks each one.</p>
              <p>In that window, <strong>Fair shares by team</strong> gives each team its slots a week and in all, across the whole schedule, and its prime time, or, with no prime time, its <strong>Hours</strong>: time on the clock, with the full-field hours the bill counts under them where a shared slot or a half field counts half (&ldquo;every team has 37.5 full-field hours&rdquo;). A team that shares reads &ldquo;50 shared&rdquo;; a team short of its share is amber.</p>
              <ul>
                <li>When the schedule moves teams around, the table reads <strong>All</strong>, <strong>Early</strong> (each team&rsquo;s early starts) and <strong>Fields</strong> (the facilities it used; the schedule&rsquo;s own word, so <strong>Lanes</strong> at the lanes).</li>
                <li>With a permit priced behind the schedule, someone who holds the club&rsquo;s Accounting reads <strong>The bill</strong> instead of Open, and each team&rsquo;s <strong>Bill</strong>. On a final schedule that was never billed, the figure reads <strong>Not billed</strong>, not the permit&rsquo;s price; once it is billed, it shows the bill&rsquo;s total.</li>
                <li>Once the schedule is final and billed, a team&rsquo;s Bill is what it pays for its time: its bill less any credit and any money the club gave back, the same figure as its <strong>Money &rsaquo; Club</strong> tab. A team that handed time back without asking for money still pays its bill, and a line beside the table says so: &ldquo;15U AA handed back 4 Sundays without asking for money: its bill stays $2,700.00.&rdquo;</li>
              </ul>
            </>
          ),
        },
        {
          id: 'club-schedules-t-bill',
          title: 'Bill the teams',
          content: (
            <>
              <p><strong>Bill the teams</strong>, at the right of <strong>Fair shares by team</strong> in <strong>Fair shares and the bill</strong> (the band&rsquo;s second figure opens it), is for someone who holds the club&rsquo;s Accounting. It fills itself in from the schedule and its permit:</p>
              <ol>
                <li><strong>Bill from</strong>: the budget line that pays for the time, the permit&rsquo;s own line to start with. Each choice shows the line&rsquo;s name with what it has planned and left beneath; <strong>No budget line</strong> bills the teams off-plan, so no line&rsquo;s budget is used.</li>
                <li><strong>Bill the teams for</strong>: <strong>the time at the permit&rsquo;s price</strong> (the permit&rsquo;s whole cost once every slot is handed out), or <strong>A part of it</strong> when the club covers some. The line under the table compares the bill with the permit&rsquo;s cost.</li>
                <li><strong>Split</strong>: <strong>By the time each team got</strong>, each field at the permit&rsquo;s price (a full field $72.00 an hour, a half field $36.00).</li>
                <li><strong>Payments</strong>: <strong>One payment</strong>, <strong>Monthly</strong>, <strong>Every two months</strong> or <strong>Dates I choose</strong>, from a first date. Each payment is the time that team gets in that period.</li>
              </ol>
              <p>Under <strong>Bill from</strong>, the window warns, and never stops you, when Accounting may already bill the same time. It names the allocations already on the line (<em>Accounting already bills this line.</em>, each with its teams and amount, and <strong>See the line</strong>). It says when the bill is more than the line has left (<em>This bill is $3,200.00; the line has $450.00 left.</em>). And it says when the permit&rsquo;s line can&rsquo;t be billed: it has nothing left, its year is closed, or it is in another year. In that case it starts on <strong>No budget line</strong> and tells you so. Pick another line, or bill it off-plan.</p>
              <p>The table reads every team&rsquo;s share and payments as you go: 15U AA&rsquo;s $2,700.00 is $972.00, $864.00 and $864.00. Each team&rsquo;s line says what its time was (&ldquo;25 full-field slots &middot; 37.5 full-field hours&rdquo;, &ldquo;50 half-field slots &middot; 37.5 full-field hours&rdquo;, &ldquo;50 shared slots &middot; 37.5 full-field hours&rdquo;), and the line under the table names any open time: &ldquo;$5,400.00 less than the permit&rsquo;s $27,000.00: the 50 open slots.&rdquo; Nothing is billed until you finalize. Then each team&rsquo;s share arrives on its <strong>Money &rsaquo; Club</strong> tab with its payments, as an allocation, and the link reads <strong>The bill &middot; 3 payments</strong>: the bill as it was made, which never changes. A hand-back or a credit comes off what a team pays (Fair shares&rsquo; Bill), never off the bill. House league is never billed: its time has no bill, no allocation and no credit.</p>
              <p><strong>Finalized without a bill?</strong> You can still bill it. The schedule&rsquo;s page reads <strong>Not billed</strong> where the bill would be, and Fair shares and the bill says so (&ldquo;This schedule was finalized without a bill&rdquo;): its figures are the time at the permit&rsquo;s price, not a bill. Whether a schedule has been billed is not part of its pill; a final schedule wears Final either way. Press <strong>Bill the teams</strong>, fill it in the same way, then <strong>Review the bill</strong> and <strong>Send the bill</strong>. The schedule stays final and nothing on a team&rsquo;s schedule changes: each team&rsquo;s share arrives on its <strong>Money &rsaquo; Club</strong> tab and the coaches who can open Money get one email with their bill. A coach who can&rsquo;t open Money isn&rsquo;t emailed. A team with nobody to email (nobody with Money access but you, or a head coach with no email address on file) is listed as <strong>Nobody to send to</strong>, and its bill still lands on its tab. Time a team has already handed back isn&rsquo;t billed. It waits while changes are waiting to be sent, or while a team&rsquo;s ask to hand time back is unanswered: send the changes, or answer the ask, first. Once a bill is made its terms never change.</p>
            </>
          ),
        },
        {
          id: 'club-schedules-t-send',
          title: 'Send for review, and Finalize',
          content: (
            <>
              <p><strong>Send</strong> on a draft asks how: <strong>For review first</strong>, where each team&rsquo;s coaches see their slots, the ones who can open Money see the bill too, and the head coach replies <strong>Looks good</strong> or <strong>Ask for a change</strong> by the <strong>Reply by</strong> date (the email to anyone else on the team has no reply line), and nothing is booked or billed yet; or <strong>Final now</strong>, which books and bills at once.</p>
              <ul>
                <li><strong>Who is told</strong> lists each team&rsquo;s head coach and staff with schedule access; untick a team and its coaches aren&rsquo;t emailed (its practices and bill still land at Finalize). Only the club&rsquo;s coaches are told: the venue isn&rsquo;t emailed, so if it asks for the schedule, send it the <strong>Export</strong>. The link under the list shows a coach&rsquo;s email exactly as it goes.</li>
                <li>A coach who can&rsquo;t open Money (an assistant or a helper, say) gets the same email without the bill or any money line. A second link under the list opens that email. If nobody on a team can open Money, Finalize and Send the changes list the team under <strong>Bill not emailed</strong>: it still gets its slots, and its bill lands on its <strong>Money &rsaquo; Club</strong> tab.</li>
                <li>When the send gives house league time, <strong>Who is told</strong> also carries a house league line: <em>House league &middot; Jules Moreau, league admin: 2 hours a week to divide</em>, with <em>Told by notification, not email</em> under it. With no league admin it reads <em>House league: owners and admins, by notification, not email</em>. It is absent when the send gives house league nothing.</li>
                <li>While it&rsquo;s in review, the page lists the replies (&ldquo;In review &middot; 5 of 8 teams replied&rdquo;), each ask in the coach&rsquo;s words. <strong>Finalize and send</strong> books it.</li>
              </ul>
              <p>Final puts each team&rsquo;s practices on its schedule, the club calendar and the clash check, and the schedule&rsquo;s pill reads <strong>Final</strong>. Families see the practices on the team&rsquo;s schedule; no family is emailed.</p>
            </>
          ),
        },
        {
          id: 'club-schedules-t-changes',
          title: 'Changes after it’s sent',
          content: (
            <>
              <p>A change to a final schedule waits on its page: <strong>Changed since sent</strong> lists each one, and the teams keep what you sent until you press <strong>Send the changes</strong>. Until then the schedule wears <strong>Final</strong> and the amber <strong>Changed since sent</strong> together: the teams hold a settled schedule, with work left to send. Only the teams with changes are told: a rep team&rsquo;s coaches, and for house league a team&rsquo;s coaches and families (see <a href="#club-schedules-t-send-league">Send the changes, with house league in it</a>). <strong>Bill the corrections</strong> gives a team that gained time a small bill from the same line, and takes the time a team lost off what it still owes; what that team had already paid, the club owes it, waiting in Payment requests. The credit comes off the team&rsquo;s latest unpaid payment first, and reaches an earlier payment only when the latest isn&rsquo;t enough. Crediting a team is money, so someone without the club&rsquo;s Accounting can&rsquo;t send changes that take time from a team: ask someone who holds it, or switch the setting off. Switch it off and the emails and notices leave out the correction and the credit too. A coach who can&rsquo;t open Money gets the changes without either.</p>
              <p>A coach can hand a practice back from the team&rsquo;s schedule. Its slot reads <strong>Open &middot; handed back by</strong> the team, and you get a notice. Until you give that time to another team, the coach can take it back: the slot is the team&rsquo;s again, and you get a notice. Neither marks the schedule Changed since sent, with money or without: the team already has the change, so there is nothing to send. Coaches&rsquo; replies and hand-backs ring your bell; choose how in your notification settings, under <strong>Schedules</strong>. The <strong>Send log</strong>, under Tools, lists every send: when, by whom, and to which teams.</p>
              <p>A coach can also ask for the money back: see <a href="#club-schedules-t-asks">A coach asks for money back</a>.</p>
            </>
          ),
        },
        {
          id: 'club-schedules-t-add-time',
          title: 'Adding time to a sent schedule',
          content: (
            <>
              <p>When the club gets more time after a schedule is final (a fourth month on a new permit, an extra evening), <strong>Tools &rsaquo; Add time&hellip;</strong> adds it as a <strong>part</strong> of the schedule: its own permits, dates, dates off, teams and bill. Nothing already on the schedule moves. On a draft or a schedule in review, change the time in <strong>Settings&hellip;</strong> instead.</p>
              <ol>
                <li>On the final schedule, open <strong>Tools</strong> and choose <strong>Add time&hellip;</strong>.</li>
                <li>Tick the <strong>Permits</strong> (any permit the club holds, or use <strong>Find the time</strong>). A permit already on the schedule brings only the time the schedule doesn&rsquo;t use, and says how much it uses. Untick any fields on its rows the new time doesn&rsquo;t need; the card says which are left off (&ldquo;Fields 5&ndash;6 are not on this added time.&rdquo;).</li>
                <li>Set <strong>From</strong> and <strong>To</strong>. It can&rsquo;t start before today, and on a permit already on the schedule it starts the day after the schedule&rsquo;s time on that permit ends. Add any <strong>Dates off</strong>; they are this time&rsquo;s only.</li>
                <li>Tick the teams. The list starts with nobody ticked, and the teams you tick share only this time. Press <strong>Generate drafts for the new time</strong>.</li>
                <li>Step 2 shows what each team gets and says the other practices stay exactly where they were sent. Pick a draft and press <strong>Keep this draft</strong>.</li>
              </ol>
              <p>The part is named <strong>Time added</strong> and the day you made it (<em>Time added Nov 16</em>). The line under the schedule&rsquo;s name shows it, and the <strong>Part</strong> filter picks <strong>Every part</strong> or just one. A part&rsquo;s practices stay on its own time and teams, even when you regenerate. The coaches aren&rsquo;t told until you send the changes.</p>
              <HelpNote variant="info" title="Regenerate and Settings&hellip; ask which part">With more than one part, <strong>Regenerate</strong> and <strong>Settings&hellip;</strong> first ask <strong>Regenerate which part?</strong> or <strong>Settings for which part?</strong>. Choosing one changes only that part; the others stay exactly as they are.</HelpNote>
            </>
          ),
        },
        {
          id: 'club-schedules-t-parts-send',
          title: 'Sending a part, and its bill',
          content: (
            <>
              <p>A part is sent with the schedule, in one <strong>Send the changes</strong>. Each team gets one email listing everything that changed for it, the schedule&rsquo;s changes and each part&rsquo;s, and one bell for each bill.</p>
              <ul>
                <li><strong>A part&rsquo;s bill is its own.</strong> Under <strong>Who is told</strong>, each part not yet sent has a line, <em>Time added Nov 16 &middot; its bill</em>. <strong>Not billed</strong> or the bill&rsquo;s figure sits beside <strong>Bill it&hellip;</strong> (or <strong>Change&hellip;</strong>), which opens <strong>Bill the teams</strong> for that part alone. Saving, or <strong>Cancel</strong>, brings you back to Send the changes, with the teams you unticked and the <strong>Bill the corrections</strong> setting as you left them. People without the club&rsquo;s Accounting see <strong>Bill set</strong> or <strong>Not billed</strong>, with no figure and no button. For them, a part whose bill is set reads <em>Someone with the club&rsquo;s Accounting sends this one.</em> under it, and Send waits for that person.</li>
                <li><strong>The coach sees a second charge.</strong> It is named for the schedule and the part (<em>Fall practices &middot; Time added Nov 16</em>) on <strong>Money &rsaquo; Club</strong>, and the email says it is a separate bill. The schedule&rsquo;s own bill and its payments stay as they are.</li>
                <li><strong>Bill the corrections</strong> appears when a change touches the schedule&rsquo;s own time, or when a change holds the send for someone without Accounting. A credit for time taken off a sent part is made whenever it applies.</li>
                <li><strong>Sent without a bill.</strong> A part you send unbilled gets a row in <strong>Needs attention</strong> (<em>Time added Nov 16 was sent without a bill</em>) with <strong>Bill it&hellip;</strong>. Its practices stay as they are. If you sent it free on purpose, press <strong>It&rsquo;s free</strong> and the row goes for good; the mark can&rsquo;t be undone. If that changes, <strong>Tools &rsaquo; Bill Time added Nov 16&hellip;</strong> opens <strong>Bill the teams</strong> for that part. Only people who hold the club&rsquo;s Accounting see this row and that Tools item.</li>
              </ul>
              <p>The send runs the schedule first, then each part, one step at a time. If one is refused after another has gone, the notice says <em>Only part of it went out</em>, and only the teams of what went out are told. The rest waits, and pressing Send the changes again sends it.</p>
            </>
          ),
        },
        {
          id: 'club-schedules-t-take-part-off',
          title: 'Taking a part off',
          content: (
            <>
              <p>Open <strong>Settings&hellip;</strong> (choose the part if asked) and, on the part&rsquo;s permit card, press <strong>Take it off&hellip;</strong>. A part&rsquo;s only permit takes the whole part with it. The schedule&rsquo;s own permits come off the same way. A permit that is the schedule&rsquo;s only time has no <strong>Take it off&hellip;</strong> (add other time first), unless practices on it were already played.</p>
              <ul>
                <li><strong>Not sent yet:</strong> the part&rsquo;s practices are deleted and <em>Time added Nov 16 is off the schedule.</em> Nobody was told, and nothing else moves.</li>
                <li><strong>Already sent:</strong> its practices come off and wait in <strong>Changed since sent</strong>. At <strong>Send the changes</strong> the coaches are told, and if the part was billed and <strong>Bill the corrections</strong> is on, each team is credited on the part&rsquo;s own bill. With nothing played, the part then leaves the page and the Part filter, and what was sent and billed stays on record. If some practices were played, the part stays with just those.</li>
                <li><strong>Practices already played</strong> stay on the schedule, with what the teams were billed for them.</li>
              </ul>
            </>
          ),
        },
        {
          id: 'club-schedules-t-send-league',
          title: 'Send the changes, with house league in it',
          content: (
            <>
              <p>When your changes move or cancel house league&rsquo;s practices, <strong>Send the changes</strong> lists each house-league team beside the rep teams.</p>
              <ul>
                <li><strong>A row for each team</strong>, with its lines (&ldquo;Reds &middot; Sundays from Nov 8: Field 1 &rarr; Field 3, 11:00 a.m. &rarr; 12:30 p.m.&rdquo;) and who it reaches: <em>House league &middot; U9 Rookie &middot; 2 coaches and 11 families</em>. A cancelled practice reads &ldquo;&hellip;: cancelled&rdquo;.</li>
                <li><strong>Who is told &middot; N people</strong> counts rep coaches, house-league coaches and each family household once, however many of its children are on ticked teams. The button reads <strong>Send to N people</strong>.</li>
                <li><strong>House league&rsquo;s time.</strong> When the changes add or take back house league time, <strong>Who is told</strong> adds a house league line (<em>House league &middot; Jules Moreau, league admin: 2 hours a week to divide</em>, with <em>Told by notification, not email</em> under it; with no league admin, <em>House league: owners and admins, by notification, not email</em>). It is a notification (the bell in the top bar), never an email, and it is absent when the changes give house league nothing.</li>
                <li><strong>Untick a team</strong> and its coaches and families aren&rsquo;t emailed. Its practices still move or cancel.</li>
                <li><strong>The emails.</strong> A coach gets &ldquo;Reds&rsquo; practices changed&rdquo; with the lines and a link to the team&rsquo;s page. Each household gets one email for all its children, with <em>Now</em> and <em>Was</em> for what changed, no link, and <em>Questions? Ask the Reds&rsquo; coach.</em> It reaches a family that unsubscribed from club news too, because it is about their child.</li>
                <li><strong>The bell.</strong> Everyone who runs house league, owners and admins as well as league admins, is told when you send, except you: the bell reads the schedule&rsquo;s name and <em>changed house league&rsquo;s practices</em>, with the count by division (&ldquo;U12: 2 practices moved, 1 practice cancelled.&rdquo;). The registrar is not told.</li>
              </ul>
              <p>This window carries house league&rsquo;s practices only. It doesn&rsquo;t send game changes, and a rep team&rsquo;s families are never emailed from here.</p>
            </>
          ),
        },
        {
          id: 'club-schedules-t-asks',
          title: 'A coach asks for money back',
          content: (
            <>
              <p>A coach who hands practices back can ask for the money back too. Until the club answers, the practices stay the team&rsquo;s, and the ask waits on the schedule&rsquo;s page, above the grid: &ldquo;15U AA asks to hand back 4 Sundays, with $432.00 back&rdquo;, the Sundays, and who asked and when. More than one ask waiting reads one each, oldest first.</p>
              <ul>
                <li><strong>Answer</strong> opens the same window as in <a href="../help/accounting#payment-requests">Payment requests</a>: the Sundays, the figure and how it was worked out, the team&rsquo;s bill, and what Accept does. Accept opens the Sundays and settles the money; Decline keeps them the team&rsquo;s.</li>
                <li>On the grid each Sunday in the ask keeps the team&rsquo;s slot, ringed, with Hand back&rsquo;s arrow in its corner. Click it: <strong>Hand-back asked</strong> says which team asked (on a shared slot, one of its two), with Answer. On a phone, Day marks the row <strong>Hand-back asked</strong>.</li>
                <li>An ask made after a plain hand-back is for the money only: &ldquo;15U AA asks for $432.00 back for 4 Sundays it handed back&rdquo;. Their time is already open, so nothing on the grid is ringed, and your answer moves only the money.</li>
                <li>The ask&rsquo;s notice opens the schedule with Answer already open. An admin without the club&rsquo;s Accounting sees the ask without its figure and without Answer: someone who holds the club&rsquo;s Accounting answers it. The treasurer, who has no Schedules, answers from Payment requests.</li>
              </ul>
            </>
          ),
        },
        {
          id: 'club-schedules-t-who-sees',
          title: 'Who sees what',
          content: (
            <p>The owner and admins build and send schedules. The bill, the permit&rsquo;s prices and every team&rsquo;s share show only to someone who holds the club&rsquo;s Accounting, and only they answer a coach&rsquo;s ask for money back; everyone else reads the time, and an ask without its figure. A coach sees only their own team&rsquo;s slots, and only the head coach answers a review. A league admin has no Schedules row: they divide house league&rsquo;s time in <a href="../help/house-league#house-league-time">House league&rsquo;s time</a> and read the club&rsquo;s schedule from there, and never change a rep team&rsquo;s or an open slot. On a plan without Schedules, or when the owner or admin can open neither Rep teams nor House league, there is no Schedules row.</p>
          ),
        },
      ],
      faqs: [
        {
          id: 'faq-club-schedules-springs-back',
          question: 'I dragged a slot and it sprang back. Why?',
          answer: (
            <p>The team would have been in two slots at once, the one thing a schedule refuses. The slot said so in red while you dragged, and the page says it again. Move the team&rsquo;s other slot first, or pick a slot at another time.</p>
          ),
          answerText: 'The team would have been in two slots at once, the one thing a schedule refuses. The slot said so in red while you dragged. Move the team’s other slot first, or pick a slot at another time.',
          keywords: ['drag', 'springs back', 'refused', 'two slots at once', 'move a slot'],
        },
        {
          id: 'faq-club-schedules-families',
          question: 'Do families get an email when I send a schedule?',
          answer: (
            <p>Not when you first send it. Only the rep teams&rsquo; coaches are emailed, one email each listing their team&rsquo;s slots, and families see their team&rsquo;s practices on the team&rsquo;s schedule once it&rsquo;s final, where they already look. Giving time to house league emails nobody. A later <strong>Send the changes</strong> that moves or cancels a house-league team&rsquo;s practices does email that team&rsquo;s families, once per household; a rep team&rsquo;s families are never emailed from here.</p>
          ),
          answerText: 'Not when you first send it. Only the rep teams’ coaches are emailed, one email each listing their team’s slots, and families see the practices on the team’s schedule once it’s final. Giving time to house league emails nobody. A later Send the changes that moves or cancels a house-league team’s practices does email that team’s families, once per household; a rep team’s families are never emailed from here.',
          keywords: ['families', 'email', 'parents', 'send schedule', 'notify', 'house league', 'practices changed', 'household'],
        },
        {
          id: 'faq-club-schedules-who-gets-bill',
          question: 'Who is emailed the bill?',
          answer: (
            <p>Only the coaches who can open Money. When you send a schedule for review, finalize it or send the changes, every coach with schedule access is still emailed their team&rsquo;s slots, but a coach who can&rsquo;t open Money (an assistant or a helper, say) gets that email without the bill, the correction or the credit, and no notice about them. <strong>Send the bill</strong> goes to the coaches who can open Money alone. The Send window shows it when you finalize or send the changes: <strong>Bill not emailed</strong> for a team where nobody can open Money. That team&rsquo;s bill still lands on its <strong>Money &rsaquo; Club</strong> tab.</p>
          ),
          answerText: 'Only the coaches who can open Money. When you send a schedule for review, finalize it or send the changes, every coach with schedule access is still emailed their team’s slots, but a coach who can’t open Money (an assistant or a helper, say) gets that email without the bill, the correction or the credit, and no notice about them. Send the bill goes to the coaches who can open Money alone. The Send window shows it when you finalize or send the changes: Bill not emailed for a team where nobody can open Money. That team’s bill still lands on its Money › Club tab.',
          keywords: ['who gets the bill', 'bill email', 'assistant', 'helper', 'money access', 'can open money', 'gets it without the bill', 'bill not emailed', 'nobody to send to', 'not emailed', 'treasurer'],
        },
        {
          id: 'faq-club-schedules-change-sent',
          question: 'Can I still change a schedule after I’ve sent it?',
          answer: (
            <p>Yes. Move, swap or clear slots as before: the page lists them under <strong>Changed since sent</strong>, and nothing reaches a team until you press <strong>Send the changes</strong>. Only the teams the changes touch are told: a rep team&rsquo;s coaches, and a house-league team&rsquo;s coaches and families.</p>
          ),
          answerText: 'Yes. Changes after it is sent wait under Changed since sent, and nothing reaches a team until you press Send the changes. Only the teams the changes touch are told: a rep team’s coaches, and a house-league team’s coaches and families.',
          keywords: ['change after sending', 'changed since sent', 'send the changes', 'edit final schedule', 'house league', 'families told'],
        },
        {
          id: 'faq-club-schedules-house-league-billed',
          question: 'Is house league billed for the time it holds?',
          answer: (
            <p>No. House league&rsquo;s time has no bill, no allocation and no credit, and <strong>Fair shares</strong> counts rep teams only.</p>
          ),
          answerText: 'No. House league’s time has no bill, no allocation and no credit, and Fair shares counts rep teams only.',
          keywords: ['house league', 'billed', 'bill', 'cost', 'allocation', 'free', 'fair shares'],
        },
        {
          id: 'faq-club-schedules-hand-back-send',
          question: 'A coach handed practices back. Do I need to send anything?',
          answer: (
            <p>No. A hand-back, with money or without, is already on the team&rsquo;s schedule and on yours, so the schedule stays Final and nothing waits for <strong>Send the changes</strong>. If the coach asked for money back, the ask waits above the grid for <strong>Answer</strong>.</p>
          ),
          answerText: 'No. A hand-back, with money or without, is already on the team’s schedule and on yours, so the schedule stays Final and nothing waits for Send the changes. If the coach asked for money back, the ask waits above the grid for Answer.',
          keywords: ['hand back', 'handed back', 'send the changes', 'changed since sent', 'nothing to send', 'answer', 'money back'],
        },
        {
          id: 'faq-club-schedules-sharing-practices',
          question: 'Why does a team that shares a facility get more practices?',
          answer: (
            <p>Under <strong>Evenly</strong> or <strong>By percentage</strong>, a team&rsquo;s share is time, and a shared slot is half a facility. So a team that shares gets twice the practices for the same share, each on half a facility, and pays the same. To keep every team at the same number of practices and free the time sharing saves, split by <strong>A set number a week</strong>.</p>
          ),
          answerText: 'Under Evenly or By percentage a share is time, and a shared slot is half a facility, so a team that shares gets twice the practices for the same share and pays the same. To keep practices the same and free the time sharing saves, split by A set number a week.',
          keywords: ['sharing', 'share a facility', 'more practices', 'twice', 'half a facility', 'evenly', 'set number a week', 'teams at once'],
        },
      ],
    },
    {
      id: 'venue-library',
      heading: 'The Venue library — your club’s venues',
      summary: 'Organization › Venue library: the club’s venues and their facilities, who books each this season, renaming a facility, and Archive or Delete. The permits the club holds at them are under Permits.',
      keywords: [
        'venue library', 'venues', 'facilities', 'diamond', 'field', 'court', 'rink', 'add venue', 'rename facility', 'facility kind', 'kind of facility',
        'archive venue', 'delete venue', 'a date off names it', 'cannot delete a venue', 'bring back', 'booked by', 'archived venues', 'who can edit venues', 'who sees the venue library',
        // Permits moved to their own place (Club Tier 13c, 2026-11-08): the word still lands a searcher here, then points on.
        'permit', 'permits', 'where did permits go', 'bookings contact',
      ],
      searchText: 'venue library venues facilities fields diamonds courts rinks gym facility kind what the kind does label on booking forms add venue name address notes open in maps booked by this season teams house league tournament who books it rename a facility rename a diamond upcoming bookings keep the old name past games families calendar no notice archive a venue bring back archived venues out of every picker delete venue nothing books it cannot delete in use a date off on a schedule names the venue archived not deleted applies to who reads the venue library owner admin league admin run tournaments can save treasurer accounting read only staff scorekeeper registrar coach no venue library tab venue picker still lists venues refused save says why could not load try again tournament import from library organization venue library tab permits moved out of the venue library to their own place in the sidebar where did permits go bookings contact booking office email',
      content: (
        <p><strong>Organization › Venue library</strong> is the club&rsquo;s one list of venues and their facilities. Coaches, house league and tournaments pick from it, and two bookings on the same facility at the same time are flagged. It comes with League Plus and Club. The time the club holds at its venues (a town&rsquo;s field permit, a dome&rsquo;s winter contract) is under <a href="#permits">Permits</a>, its own place in the sidebar.</p>
      ),
      subtopics: [
        {
          id: 'venue-library-t-who',
          title: 'Who reads it and who can change it',
          content: (
            <>
              <p>The Venue library is for the people who schedule, run tournaments or handle the money: the owner, admins, league admins, anyone given <strong>Run tournaments</strong>, and anyone who holds the club&rsquo;s Accounting. Staff, scorekeepers, registrars and coaches don&rsquo;t have the Venue library tab. When they book a place, the venue picker still lists the club&rsquo;s venues by name and address.</p>
              <p>The owner, admins, league admins and anyone given Run tournaments can add and change venues. Someone who only holds Accounting reads the library, with no <strong>Add venue</strong> and no pencil. If a save is refused, the window says why.</p>
            </>
          ),
        },
        {
          id: 'venue-library-t-add-edit',
          title: 'Adding and changing a venue',
          content: (
            <>
              <ol>
                <li>Click <strong>Add venue</strong> and enter its name, its address (it powers the map link on every schedule), its facilities with their kind, and any notes. The kind is the word every booking form uses for them: a dome of fields reads <strong>Field</strong> to a baseball team, never <strong>Diamond</strong>.</li>
                <li>Press <strong>Add venue</strong>. Nothing saves until you do.</li>
              </ol>
              <p>The table shows each venue&rsquo;s facilities and who books it this season. Click a venue to read it: its address, its <strong>Bookings contact</strong> (the venue&rsquo;s booking office, an email), each facility&rsquo;s upcoming bookings, the permits that hold time there (a row opens the permit; &times; comes back), and the teams, house-league season and tournaments that book it. The pencil turns the whole venue into its form, and every change saves as you go; the check mark turns it back.</p>
            </>
          ),
        },
        {
          id: 'venue-library-t-rename',
          title: 'Renaming a venue or a facility',
          content: (
            <>
              <p>Rename &ldquo;Diamond 2&rdquo; to &ldquo;Diamond 2 (big)&rdquo; and every <strong>upcoming</strong> team and house-league booking on it shows the new name, including on families&rsquo; calendars at their next refresh. Past bookings keep the name they were played under. Nobody is notified: the place didn&rsquo;t move.</p>
              <p>A tournament keeps its own copy of the venues it imported, so a rename doesn&rsquo;t reach it. A facility with bookings can be renamed but not removed; one that nothing books has its ✕.</p>
            </>
          ),
        },
        {
          id: 'venue-library-t-archive',
          title: 'Archive or Delete',
          content: (
            <HelpDefs>
              <HelpDef term="Archive">At the end of a venue&rsquo;s window, <strong>Archive this venue</strong> is offered when anything books it, past seasons included. It leaves every picker (coaches, house league, a tournament&rsquo;s Import from Library), and every booking keeps it. Archived venues are listed under the table; open one and choose <strong>Bring back this venue</strong>.</HelpDef>
              <HelpDef term="Delete">Offered in the same place, only when nothing books the venue. It asks first, and the venue leaves the library for good.</HelpDef>
              <HelpDef term="Held by a permit">A venue a permit holds time at can be archived but not deleted, and a facility a permit names can be renamed but not removed. The permit is under <a href="#permits">Permits</a>.</HelpDef>
              <HelpDef term="Named by a date off">A venue a schedule&rsquo;s date off names (<em>Applies to</em> one venue) can be archived but not deleted: deleting it would quietly make that day close every park. Take the park off the date off first, or archive the venue.</HelpDef>
            </HelpDefs>
          ),
        },
      ],
      faqs: [
        {
          id: 'faq-venue-library-cant-delete',
          question: 'Why can’t I delete a venue?',
          answer: (
            <p>Something books it, even if only in a past season. Deleting it would take it off those games and practices, so the library offers <strong>Archive</strong> instead: it leaves every picker and every booking keeps it. Delete appears once nothing books the venue.</p>
          ),
          answerText: 'Something books it, even in a past season, so the Venue library offers Archive instead of Delete: the venue leaves every picker and every booking keeps it. Delete appears once nothing books the venue.',
          keywords: ['delete venue', 'cannot delete', 'archive', 'in use', 'venue library'],
        },
        {
          id: 'faq-venue-library-league-admin',
          question: 'I’m the league admin. Can I add our diamonds?',
          answer: (
            <p>Yes. League admins can add and change venues in the Venue library, the list house league&rsquo;s <strong>Set up your diamonds once</strong> link opens.</p>
          ),
          answerText: 'Yes. League admins can add and change venues in the Venue library, the list house league’s “Set up your diamonds once” link opens.',
          keywords: ['league admin', 'add diamonds', 'refused', 'venue library'],
        },
      ],
    },
    {
      id: 'settings',
      heading: 'Settings and your web address',
      summary: 'The owner-only Settings page: your organization’s name, web address, your privacy policy link (an admin can set it too), Payouts for online payments, and account deletion. Your public site’s logo, colours, type and switch are in Public site.',
      keywords: ['settings', 'two-step sign-in', 'require two-step', 'admin settings', 'payouts', 'online payments', 'families pay by card', 'house league pay by card', 'families and teams pay it', 'stripe', 'processing fee', 'processing fee on sponsorships', 'processing fee on registrations', 'the sponsor pays it', 'bank debit', 'bank debit rate', 'card rate', 'returned bank debit', 'card dispute fee', 'foreign card', 'stripe balance', 'receive less', 'web address', 'org slug', 'url slug', 'organization details', 'delete organization', 'open public site', 'public site switch', 'listed in the directory', 'online offline', 'public site editor', 'turn off public site', 'take site offline', 'site isn’t available', 'team pages offline', 'tryouts offline', 'tournament pages stay up', 'logo', 'colours', 'branding', 'where did branding go', 'birthdays count from', 'birthday cut-off', 'cut-off date', 'birth year', 'born', 'age', 'age group', 'january 1', 'september 1', 'payments terms', 'new payments terms', 'read and agree', 'payouts tab', 'bank statement', 'leaving online payments', 'privacy policy', 'your privacy policy', 'privacy policy link', 'privacy notice', 'link our privacy policy'],
      searchText: 'your privacy policy link to your privacy policy the web address of your club’s own privacy policy families see a link to it on your sign-up forms and when they accept an invitation how your club uses their information stores it outside canada mainly in the united states leave it empty for no link enter a web address that starts with https:// or http:// that web address is too long owner or admin sets it privacy notice link audit log refund policy required write the refund policy cant be left blank online payments paused quebec québec payouts refused two-step sign-in card require it for the board also require it for coaches admin opens settings to read the two-step card only the owner changes this payments terms agreed by read the terms new payments terms to agree to read and agree payouts tab match a payout to the bank statement reconcile payouts to your bank leaving online payments disconnect downgrade cancel delete payouts card settings payouts let teams pay online families pay by card house league registration fees families and teams pay it the club pays it stripe connect processing fee who pays it refund policy payouts go to receipts say rows edit pencil check mark disconnect payouts bank debit both rates per card payment per bank debit bank debits still clearing returned bank debit fee card dispute fee card issued outside your country card from another country foreign card extra fee comes out of your stripe balance you may receive less on those payments owner only org settings owner only organization details name web address url slug org slug change redirect save button delete organization account deletion danger zone your public site door card open public site its logo colours type and whether it is online are set in public site branding logo stock logo colours hero banner banner photo font type moved to public site look visibility card style tournament branding page public site switch online offline listed in the directory discover directory take the club offline what goes offline every club page home teams team pages tryouts tryout sign up league archives team calendars subscribed calendars go empty tournament pages stay up this club’s site isn’t available site isnt available coaches sharing note when birthdays count from per sport month day dropdown default january 1 count softball birthdays from keep january 1 change every team and house-league division shows its birth years re-read one birth year show none until you set it again born sep 1 2013 aug 31 2015 age cut-off birth years owner only',
      content: (
        <p>The <strong>Settings</strong> page is <strong>owner-only</strong>, with two exceptions for an admin: they set <strong>Your privacy policy</strong>, and they read the <strong>Two-step sign-in</strong> card. It holds <strong>Organization details</strong> (your organization&rsquo;s name and web address), <strong>Your privacy policy</strong> (the web address of your club&rsquo;s own privacy policy: while it&rsquo;s set, families see a link to it on your house-league sign-up form, on your tryout sign-up and when they accept an invitation; empty it and press <strong>Save</strong> for no link; it must start with https:// or http://, and each change is a line in the audit log; your policy is where you tell families how your club uses their information, and that FieldLogicHQ stores it outside Canada, mainly in the United States), <strong>When birthdays count from</strong>, a card that points to <strong>Public site</strong>, <strong>Payouts</strong> (letting teams pay online by card), <strong>Two-step sign-in</strong> (making it required; see <a href="#two-step-sign-in">Two-step sign-in</a>), and <strong>Delete organization</strong>. Your public site&rsquo;s logo, colours, type, banner and on/off switch are set in <strong>Public site</strong>, not here.</p>
      ),
      subtopics: [
        {
          id: 'settings-t-payouts',
          title: 'Payouts: let teams pay online',
          content: (
            <>
              <p>On the League and Club plans, <strong>Payouts</strong> is a card on Settings, after <strong>Your public site</strong> and before <strong>Delete organization</strong>. The owner connects the organization&rsquo;s own Stripe account there, chooses who pays the processing fee (<strong>Families and teams pay it</strong> or <strong>The club pays it</strong>; on Tournament Plus the first reads <strong>Teams pay it</strong>), writes the organization&rsquo;s <strong>Refund policy</strong> (one or two sentences, required: families and teams can read it beside the pay button before they pay, and no pay page opens without one; it can be changed but not left blank), and can <strong>Disconnect payouts</strong>. Payouts can&rsquo;t be set up with a Québec billing address: online payments aren&rsquo;t offered in Québec yet. Once payments are on, the card reads as a short list of rows: <strong>Payouts go to</strong>, <strong>Receipts say</strong>, <strong>Processing fee</strong> (on a club with Sponsorships, <strong>Processing fee on registrations</strong>, with <strong>Processing fee on sponsorships</strong> below it), <strong>Refund policy</strong> and <strong>Payments terms</strong>. The card prints both rates, <em>&hellip; per card payment &middot; &hellip; per bank debit</em>, under the <strong>Processing fee</strong> row (before you connect, as <em>Processing fee: &hellip; per card payment, &hellip; per bank debit</em>), from the current rates; an account that doesn&rsquo;t take bank debit shows the card rate alone. The processing fee covers Stripe&rsquo;s charge and FieldLogicHQ&rsquo;s. <strong>Before you set up payouts</strong> says the same under <em>What it costs</em>, with a worked line for an example fee by card and by bank debit.</p>
              <p>The choice is one setting for the whole organization. It covers teams paying tournament entry fees and families paying house-league registration fees by card, and house-league families see <strong>Pay now</strong> only once payouts are set up. Only the owner connects; a treasurer sees the state as a line on the Accounting Overview and on a season&rsquo;s Money page. Bank debit is offered to families and teams only once Stripe has approved your account for it.</p>
              <p>A club with <strong>Sponsorships</strong> has a second row, <strong>Processing fee on sponsorships</strong>, and the first is named <strong>Processing fee on registrations</strong>. The sponsorship row has its own choice, <strong>The sponsor pays it</strong> or <strong>The club pays it</strong>, and the club pays it unless you change it. It applies once sponsors can pay by card; a cheque or an e-transfer never carries a fee. The choice only counts before an invoice exists: on an invoice already issued the club pays the fee, and an invoice never gains a fee line afterwards. A refund to a sponsor&rsquo;s card never includes the processing fee the business paid (see <a href="#club-sponsorships-t-refund">Refunding a card payment</a>). Both rows carry a note that card networks limit what a business or organization may add to a card payment (2.4% in Canada, and none in Qu&eacute;bec), that the fee can be more than that, and that choosing to pass it on is your decision and your responsibility.</p>
            </>
          ),
        },
        {
          id: 'settings-t-payouts-related',
          title: 'Payouts: terms, the payouts list and Stripe’s extra fees',
          content: (
            <>
              <p><strong>Disconnect payouts?</strong> counts what is still outstanding before you confirm; see <a href="#leaving-online-payments">Leaving online payments</a>. The card&rsquo;s record also shows <strong>Payments terms</strong>: who agreed, when and to which version, and it asks you to agree again if FieldLogicHQ&rsquo;s terms change (see <a href="../help/tournaments#online-payments-terms">The payments terms</a>). To match a payout to a line on the bank statement, use the <strong>Payouts</strong> tab in Accounting (see <a href="../help/accounting#payouts-tab">Matching a payout to your bank statement</a>); a club without Accounting finds the same list on this card under <strong>Payouts to your bank</strong>. Stripe takes more on some payments: a card issued outside your country, a currency conversion, a dispute, or a bank debit that comes back. The card says so in a note under its rows: <em>The processing fee covers Stripe&rsquo;s charge and FieldLogicHQ&rsquo;s. Stripe takes more for a card issued outside your country, a currency conversion, a dispute or a returned bank debit. That comes out of your Stripe balance, so you may receive less on those payments.</em> FieldLogicHQ doesn&rsquo;t bill you for them and sends no invoice for them; the family or team pays the ordinary price. It needs a plan that includes online payments, and the card isn&rsquo;t shown where they&rsquo;re not offered. The full guide, including what teams see and how refunds work, is <a href="../help/tournaments#online-payments">Let teams pay online by card</a> in the Tournaments guide.</p>
            </>
          ),
        },
        {
          id: 'settings-t-public-site',
          title: 'Your public site',
          content: (
            <>
              <p>Settings has one card for it: <strong>Your public site</strong> says <em>Its logo, colours, type, and whether it is online are set in Public site</em>, with an <strong>Open Public site</strong> button. Nothing about the site is changed in Settings itself.</p>
              <p>In <strong>Public site</strong>, the <strong>Visibility</strong> row holds the two switches. Only the owner can change them, and each saves the moment you set it:</p>
              <ul>
                <li><strong>Public site</strong> — takes all of your club&rsquo;s pages online or offline: home, teams, tryouts and their sign-up, league, archives and team calendars. Your <strong>tournament pages stay up</strong> either way. Turning it off asks first. While it&rsquo;s off, families who open any of those pages see one page — <em>This club&rsquo;s site isn&rsquo;t available</em> — tryout sign-ups stop, and families&rsquo; subscribed team calendars go empty. Your coaches see a note in their team&rsquo;s <strong>Sharing</strong> settings that their team&rsquo;s public page isn&rsquo;t open.</li>
                <li><strong>Listed in the club directory</strong> — controls whether families searching FieldLogicHQ&rsquo;s public directory can find you. Your site stays online either way; this switch is off, and greyed out, whenever the public site itself is off.</li>
              </ul>
              <p>See <strong>Running your public site</strong> for the rest of the page.</p>
            </>
          ),
        },
        {
          id: 'settings-t-slug',
          title: 'Your web address',
          content: (
            <>
              <p>Your <strong>web address</strong> is the start of all your public links: <code>fieldlogichq.ca/your-address/</code>. It appears in your registration forms, schedule pages, tournament links, and any URLs you&rsquo;ve shared publicly or included in past emails.</p>
              <p>Changing your web address takes effect immediately. Every existing link will stop working — there is no redirect. Before saving a new address:</p>
              <ul>
                <li>Update any links you&rsquo;ve posted on social media or your website</li>
                <li>Note that registration form links sent to coaches in past emails will break</li>
                <li>Consider the timing — avoid changing mid-tournament</li>
              </ul>
            </>
          ),
        },
        {
          id: 'settings-t-birthdays',
          title: 'When birthdays count from',
          content: (
            <>
              <p>Teams and house-league divisions show who can play by birth year, counted from one date. <strong>When birthdays count from</strong> sets that date for each sport your club runs, as a month and a day. It starts at <strong>January 1</strong>, which is what most leagues use. Only the owner sees this card.</p>
              <p>Each row names the sport and says how many rep teams and house-league seasons use it, with a line families would read (for example <em>Born 2012&ndash;2013</em>) or <em>No birth years entered yet</em>. Pick a month and a day; the change saves by itself and shows <strong>Saved</strong>.</p>
              <ul>
                <li><strong>Moving off January 1 asks once.</strong> The window shows how one of your teams will read &mdash; for example <em>Born Sep 1, 2013 &ndash; Aug 31, 2015</em> &mdash; and says every team and division of that sport re-reads from the new date, on your site. Nothing is sent to families. <strong>Keep</strong> leaves the date as it was; <strong>Change</strong> saves it.</li>
                <li><strong>A team with one birth year shows none after the move.</strong> A single year can&rsquo;t be read from another date. The window counts these teams; they keep their old years, show no born line, and stay in every <em>Born in</em> list until you set their years again in Team details.</li>
              </ul>
              <p>Until a sport has a rep team or a house-league season, its row isn&rsquo;t there.</p>
            </>
          ),
        },
        {
          id: 'settings-t-branding',
          title: 'Branding and appearance',
          content: (
            <>
              <p><strong>Branding</strong> is no longer in Settings. Your logo, colours, type and banner photo are in <strong>Public site &rsaquo; Look</strong>, and the owner <em>or</em> an admin can change them (see <strong>Running your public site</strong>). This is <strong>organization-level</strong> branding and it comes with <strong>League and Club</strong> plans. Tournament and Tournament Plus brand each <strong>event</strong> individually instead — its logo, colours and type, from that tournament&rsquo;s <strong>Public site</strong> page — and their organization&rsquo;s home page keeps FieldLogicHQ&rsquo;s default styling.</p>
              <p><strong>Card style</strong> is no longer a setting anywhere: the club&rsquo;s look is its logo, colours and type, and tournament pages draw their cards one way.</p>
            </>
          ),
        },
        {
          id: 'settings-t-delete',
          title: 'Deleting your organization',
          content: (
            <>
              <p><strong>Delete organization</strong> — the bottom of Settings has a <strong>Request account deletion…</strong> button for closing the organization.</p>
              <p>Requiring an admin to review scores before results go public is a per-tournament setting in each event&rsquo;s settings, not an org-wide Settings option.</p>
            </>
          ),
        },
      ],
    },
    {
      id: 'leaving-online-payments',
      heading: 'Leaving online payments: disconnect, a plan move, cancel and delete',
      summary: 'What happens to Pay now, pay pages, bank debits, refunds and disputes when online payments stop, and why none of it disconnects your Stripe account.',
      keywords: ['leaving online payments', 'disconnect payouts', 'disconnect', 'online payments stop', 'online payments stop on', 'online payments stop now', 'online payments off', 'downgrade', 'move to a plan without online payments', 'cancel', 'cancel and suspend', 'suspended', 'until then pay online', 'keep plan nothing stops', 'reactivate online payments', 'delete', 'ask us to delete', 'your online payments', 'pay now stops', 'pay pages close', 'how to pay', 'bank debits clearing', 'open card disputes', 'stripe account stays yours', 'payouts stay connected', 'free time ending', 'subscription payment failed', 'needs attention', 'payouts card'],
      searchText: 'leaving online payments the one rule no ending disconnects your stripe account pay now stops pay pages open close bank debits already clearing finish refunds and disputes of payments already made keep working payouts stay connected disconnect payouts window counts families who still owe a house league fee teams who still owe a tournament fee pay pages open right now bank debits clearing open card disputes answer in stripe by the due date write it now how to pay text empty moving to a plan without online payments online payments stop on date pay now becomes how to pay open pay pages close wind down online payments off open stripe the record the payouts list disconnect moving back up turns online payments on again cancel and suspend online payments stop now stripe account stays yours keeps paying out refunds handled in stripe while suspended ask us to delete request account deletion your online payments we wait for open card disputes and clearing debits we disconnect your payouts before deleting export records from accounting first an ending you did not choose free time running out warned 7 days ahead a subscription payment that failed warned the day it fails notice on the payouts card needs attention item one email downgrade plan billing owner only',
      links: [
        { label: 'Plan & billing', href: '../org/billing' },
        { label: 'Settings', href: '../org/settings' },
      ],
      content: (
        <p>Online payments stop in four ways: the owner disconnects payouts, the club moves to a plan without them, the subscription is cancelled, or the club asks to be deleted. Every one of them tells the owner what is still outstanding first, and every one follows the same rule.</p>
      ),
      subtopics: [
        {
          id: 'leaving-online-payments-rule',
          title: 'The one rule: your Stripe account stays yours',
          content: (
            <>
              <p>No ending disconnects the club&rsquo;s Stripe account. When online payments stop:</p>
              <HelpDefs>
                <HelpDef term="Stops">Pay now is no longer offered. Families and teams see your <strong>How to pay</strong> text instead, and every pay page that is open closes.</HelpDef>
                <HelpDef term="Finishes">Bank debits already clearing finish, and their money still reaches you.</HelpDef>
                <HelpDef term="Keeps working">Refunds, and disputes, of payments already made.</HelpDef>
                <HelpDef term="Stays connected">Your payouts. Moving back up to a plan with online payments turns them on again.</HelpDef>
              </HelpDefs>
              <p>Only the owner disconnects, moves plans or cancels.</p>
            </>
          ),
        },
        {
          id: 'leaving-online-payments-disconnect',
          title: 'Disconnect payouts?',
          content: (
            <>
              <p>The window <strong>Disconnect payouts?</strong> opens from <strong>Disconnect payouts</strong> at the end of the Payouts card. Before you confirm, it tells you:</p>
              <ul>
                <li>how many families still owe a house-league fee and how many teams still owe a tournament fee (they can pay you another way);</li>
                <li>how many pay pages are open right now, and that they close when you disconnect;</li>
                <li>how many bank debits are still clearing, which finish and still reach you;</li>
                <li>how many card disputes are open, which you answer in Stripe by their due dates, while Stripe holds their money until the banks decide;</li>
                <li>that payments already made stay in your books, and that refunds of them are made in Stripe.</li>
              </ul>
              <p><strong>Set up payouts again</strong> turns online payments back on.</p>
            </>
          ),
        },
        {
          id: 'leaving-online-payments-move',
          title: 'Moving to a plan without online payments',
          content: (
            <>
              <p>When the club has payouts connected and moves to a plan that doesn&rsquo;t include online payments, the move window on <strong>Plan &amp; billing</strong> adds a section, <strong>Online payments stop on</strong> the move date. It says families and teams see your How to pay text instead of Pay now, that open pay pages close then, how many families and teams still owe today, that bank debits clearing finish, that refunds and disputes keep working, and that your payouts stay connected.</p>
              <p>On the move date, <strong>Pay now</strong> becomes <strong>How to pay</strong> and open pay pages close. The Payouts card reads <strong>Online payments off</strong>, and keeps <strong>Open Stripe</strong>, the record, the payouts list and <strong>Disconnect payouts</strong>. <strong>Open Stripe</strong> opens your Stripe dashboard in a new tab, so your page here stays as you left it.</p>
              <HelpNote variant="info" title="An ending you didn&rsquo;t choose">When free time from FieldLogicHQ is running out, or a subscription payment fails, you click nothing, so you are told instead: a notice on the Payouts card, a Needs attention item and one email, <em>Online payments stop on</em> the date. Free time warns you 7 days ahead; a failed subscription payment warns you the day it fails.</HelpNote>
            </>
          ),
        },
        {
          id: 'leaving-online-payments-cancel',
          title: 'Cancelling your plan',
          content: (
            <>
              <p>Open the cancel window from <strong>Reduce or cancel</strong> on Plan &amp; billing. When payouts are connected, it adds <strong>Online payments stop on [date]</strong>, the day the plan ends. Until then families and teams pay you online as now. Keep your plan before then and nothing stops; reactivate later and online payments come back. From the date, nobody can pay you online and open pay pages close. The window counts the families and teams who still owe, the pay pages open right now, and the bank debits still clearing, which finish and reach your bank.</p>
              <p>A plan with no paid period to wait for, such as a plan on free time, says <strong>Online payments stop now</strong> instead. If free time will catch the ending and the free plan takes online payments, the window has no such section, because nothing stops.</p>
              <p>Your Stripe account stays yours, and money in it keeps paying out to your bank. While you are suspended, refunds and any open disputes are handled in Stripe.</p>
            </>
          ),
        },
        {
          id: 'leaving-online-payments-delete',
          title: 'Ask us to delete',
          content: (
            <>
              <p>When payouts are or were connected, <strong>Request account deletion</strong> in Settings adds <strong>Your online payments</strong>. We wait for open card disputes and bank debits still clearing to finish before deleting. We close the pay pages and disconnect your payouts first, and your Stripe account stays yours, with any money in it.</p>
              <HelpNote variant="warning" title="Export your records first">Your payment records here are deleted with everything else. Export them first from Accounting.</HelpNote>
            </>
          ),
        },
      ],
    },
    {
      id: 'public-site-editor',
      heading: 'Running your public site — the Public site editor',
      summary: 'Set your club’s logo, colours and type, choose your home page’s sections and their order, write your words and contacts, list your documents and sponsors, post a notice, and watch it all in a live preview.',
      keywords: [
        'preview', 'live preview', 'go live', 'set up your site', 'visibility', 'logo', 'upload a logo', 'stock logos', 'colours',
        'from your logo', 'your own colours', 'main colour', 'accent colour', 'type', 'classic serif clean', 'banner photo',
        'computer phone preview', 'offline preview', 'site builder',
        'sponsors', 'sponsor', 'sponsor logo', 'thank you', 'sponsor strip', 'last day', 'ended sponsor', 'contacts documents and sponsors',
        'public site editor', 'public site', 'site editor', 'own address', 'own domain', 'custom domain', 'web address row', 'home page sections', 'reorder sections', 'hide a section',
        'tournaments tab', 'past tournaments', 'hide tournaments', 'hide past tournaments', 'archive',
        'show a section', 'section order', 'tagline', 'about us', 'families questions go to', 'contact email',
        'social links', 'instagram', 'facebook', 'website link', 'saved as', 'that isn’t a web address', 'look', 'colours',
        'who to contact', 'contacts', 'role address', 'registrar', 'documents and policies', 'code of conduct', 'policies',
        'questions families ask', 'faq', 'about page', 'contacts and documents', 'club notice', 'field closure',
        'fields closed', 'rain out', 'post notice', 'end now', 'mentions 2025', 'still true', 'past year',
        'coaches on team pages', 'who is listed as a coach', 'coach names', 'list coaches on team pages', 'coaches choose', 'head coaches always', 'head and assistant coaches always', 'no coach names', 'listed', 'not listed', 'list them',
        'game day', 'games today', 'today', 'live now', 'later today', 'latest results', 'not being played today', 'scores on the home page', 'rep team games', 'rep teams show their games', 'why isn’t my rep team on the home page',
      ],
      searchText: 'public site editor admin public site seven rows web address row open in place one at a time look home page about the club contacts documents and sponsors contacts and documents coaches on team pages who is listed as a coach coaches choose head coaches always head and assistant coaches always no coach names listed not listed list them not now visibility preview computer phone change in look point at a part outlines click to change links in the preview don’t go anywhere only you and your admins can see this your site is offline preview button eye set up your site n of 4 ready go live the owner puts it online nothing is required to go live ready tick dashed ring logo upload a logo replace logo browse stock logos remove colours from your logo nine presets your own colours main colour accent colour darkened readable type classic serif clean banner photo computer only phones leave it out visibility public site switch take offline listed in the club directory web address change it in settings owner or admin can change the look only the owner turns the site on and off card style tournament branding page cards save themselves saved pill no save button online offline chip families see it at your address copy link open home page sections open now always first teams house league tournaments about the club switch hide show hold and drag the number reorder order shows once you publish a season shows once you host a tournament shows once you add a team plan does not carry tab row follows home page and in your site’s tabs tournaments switch home section tab and page tournaments tab tournaments page hide tournaments past tournaments sub-option under tournaments only while tournaments is on keeps its setting at the bottom of your tournaments page shows once a tournament finishes no current tournament your tab shows your past ones archive tagline about families questions go to footer team and tryout pages mentions a past year still true hint founding year since social links instagram facebook x website https saved as refused that isn’t a web address paste the link who to contact up to twelve role address registrar@ personal address gmail nudge documents and policies up to thirty heading title link opens in a new tab codes of conduct safety the club never says compliant questions families ask up to ten about page contacts and documents footer link look logo colours font readable darkened club notice showing now edit post a notice field closure fields closed tonight rain more detail ends tonight tomorrow night date and time post notice update notice end now posted by the club ends by itself one at a time every public page every team page sponsors sponsor up to twenty add a sponsor thank you strip at the foot of the home page sponsors section on the about page name logo upload a logo replace logo remove logo link opens in a new tab last day through that day leaves by itself ended mark renew pick a later day jpg png webp 2 mb scaled to fit never cropped no tiers only sponsors game day what your home page shows on a game day today live now later today latest results not being played today score after the game no score yet four games then more later today more live now more results show fewer tournament row its counts today and the two days before postponed cancelled moved practices never show house league published division rep team public schedule visibility away games every 30 seconds rep teams show their games on your site each team’s coach chooses this',
      content: (
        <>
          <p><strong>Public site</strong> in the admin is where you build your club&rsquo;s pages. It is seven rows that open in place, one at a time, each with a one-line summary while it is closed: <strong>Look</strong>, <strong>Home page</strong>, <strong>About us</strong>, <strong>Contacts, documents and sponsors</strong>, <strong>Coaches on team pages</strong>, <strong>Web address</strong> and <strong>Visibility</strong>. (<strong>Coaches on team pages</strong> is there only for a club with Rep teams.) On a computer, a live preview of your home page stands beside them. It&rsquo;s for the owner and admins. Every change saves itself (a <strong>Saved</strong> pill appears and fades), except a notice, which waits for <strong>Post notice</strong>.</p>
          <p>The owner or an admin can change everything except <strong>Visibility</strong> and <strong>Coaches on team pages</strong>, which are the owner&rsquo;s. Only the owner turns the site on and off, changes the directory listing, or changes the club&rsquo;s name and web address.</p>
        </>
      ),
      subtopics: [
        {
          id: 'public-site-editor-header',
          title: 'Your address, and whether the site is on',
          content: (
            <>
              <p>An <strong>Online</strong> or <strong>Offline</strong> chip sits beside <strong>Public site</strong> in the header. The first line of the page is <strong>Families see it at</strong> with your address, <strong>Copy link</strong> and <strong>Open</strong>. While the site is off, Open isn&rsquo;t there; Copy link still is. On a narrow window, an eye <strong>Preview</strong> button sits beside Copy link while the site is off and opens the preview in a window.</p>
              <p>The site is switched on and off in the <strong>Visibility</strong> row, by the owner only.</p>
            </>
          ),
        },
        {
          id: 'public-site-editor-preview',
          title: 'The live preview',
          content: (
            <>
              <p>On a computer or any wide window, a <strong>Preview</strong> of your home page stands beside the rows, with a <strong>Computer</strong> / <strong>Phone</strong> switch. It redraws after every change.</p>
              <ul>
                <li>Point at a part of the preview and it is outlined, with the row that changes it named, such as <strong>Change in Look</strong>. Click it to open that row. Clicking the notice opens the notice window.</li>
                <li>Links in the preview don&rsquo;t go anywhere.</li>
                <li>While your site is offline, the preview still shows it to you and your admins, with the line <strong>Only you and your admins can see this. Your site is offline.</strong></li>
              </ul>
              <p>In a narrower window there is no side preview. While the site is offline, <strong>Preview</strong> (the eye) opens it in a window. While it is online, <strong>Open</strong> opens the real site.</p>
            </>
          ),
        },
        {
          id: 'public-site-editor-setup',
          title: 'Set up your site, and going live',
          content: (
            <>
              <p>A <strong>Set up your site</strong> card with a bar says <strong>N of 4 ready</strong>. It shows while any of four parts isn&rsquo;t ready, or while the site is offline. The rows then carry a tick (ready) or a dashed ring (not set up yet).</p>
              <ul>
                <li><strong>Look</strong> is ready with a logo or any colour but the default.</li>
                <li><strong>Home page</strong> is always ready.</li>
                <li><strong>About us</strong> is ready with a tagline and the address families&rsquo; questions go to.</li>
                <li><strong>Contacts, documents and sponsors</strong> is ready with any contact, document or question. Sponsors are a thank-you, so they never count toward ready.</li>
              </ul>
              <p>While the site is offline, the owner has a <strong>Go live</strong> button on the card. An admin reads <em>When it&rsquo;s ready, the owner puts it online.</em> Nothing is required to go live, and you can go live at any time.</p>
            </>
          ),
        },
        {
          id: 'public-site-editor-visibility',
          title: 'Visibility: the site switch and the directory',
          content: (
            <>
              <p>The owner sees the <strong>Public site</strong> switch and <strong>Listed in the club directory</strong>. Taking the site offline asks first (<em>Take your club&rsquo;s public site offline?</em>, with your club&rsquo;s name) and says what families will see. Your tournament pages stay up either way.</p>
              <p>An admin sees the switch and the listing as text, with <em>The owner turns the site on and off and changes its address.</em></p>
              <p>The <strong>Web address</strong> row above Visibility shows your <code>fieldlogichq.ca</code> address and lets the owner connect the club&rsquo;s own address, like <code>www.yourclub.ca</code>: you add two records where you bought it, and the row shows when it is live. An admin can see every state and press <strong>Check now</strong>. The steps, for you or whoever looks after your address, are in <a href="/help/own-address" target="_blank" rel="noopener noreferrer">Use your club&rsquo;s own address</a>.</p>
            </>
          ),
        },
        {
          id: 'public-site-editor-coaches',
          title: 'Coaches on team pages: who is listed',
          content: (
            <>
              <p><strong>Coaches on team pages</strong> decides who is listed under <strong>Coaches</strong> on each team&rsquo;s public page, once for every team. A listing shows a name and a role, never an email address, a phone number or a player. The row is there only for a club with Rep teams.</p>
              <HelpDefs>
                <HelpDef term="Coaches choose">Each coach decides whether their own name shows. Everyone starts not listed.</HelpDef>
                <HelpDef term="Head coaches always">Every head coach is listed. Assistant coaches and other staff choose for themselves.</HelpDef>
                <HelpDef term="Head and assistant coaches always">Every head coach and assistant coach is listed. Team managers, treasurers and helpers choose for themselves.</HelpDef>
                <HelpDef term="No coach names">Nobody is listed, whatever a coach has chosen. Their choices are kept and apply again if you change this.</HelpDef>
              </HelpDefs>
              <p>Only the owner changes it, and each pick saves itself. The two &ldquo;always&rdquo; choices ask first, because they put people&rsquo;s names on public pages: the window says how many coaches on how many teams will be listed, and nothing changes until you choose <strong>List them</strong>. <strong>Not now</strong> leaves the choice where it was. Each coach a choice newly lists gets one notice, and their Team settings says <strong>Listed by your club</strong> in place of their own switch. An admin reads the choice as plain text, with <em>The owner chooses who is listed.</em></p>
              <HelpNote variant="info" title="What stays true">A coach&rsquo;s own <strong>Show my name</strong> switch is never changed by your choice, so going back to <strong>Coaches choose</strong> puts everyone where they were. A coach with no name on file is left out, names show only while the team has a live season, and the same choice decides whether a team&rsquo;s tryout page names its head coach.</HelpNote>
            </>
          ),
        },
        {
          id: 'public-site-editor-sections',
          title: 'Choose your home page’s sections and their order',
          content: (
            <>
              <p>The <strong>Home page</strong> row lists what families see on your home page and in your site&rsquo;s tabs, in order. Each row says what it shows today, such as &ldquo;Your 8 teams in your groups, each with its tryout state&rdquo;.</p>
              <ul>
                <li><strong>Open now</strong> always comes first, and only shows while something is open (a tryout, a house-league sign-up). It has no switch.</li>
                <li><strong>Hide or show</strong> any other section with its switch. A hidden section leaves your home page and its tab.</li>
                <li><strong>Reorder</strong> by holding the number at the start of a row and dragging it. Tapping the number offers <strong>Move up</strong> and <strong>Move down</strong> instead. Your tabs follow the same order.</li>
                <li>A section you don&rsquo;t run yet keeps its switch and says when it shows, such as <strong>Shows once you publish a season</strong>, so you can decide ahead of time.</li>
                <li><strong>Tournaments</strong> covers your home page&rsquo;s Tournaments section, the <strong>Tournaments</strong> tab and the Tournaments page. Under it, <strong>Past tournaments</strong> shows or hides the list at the bottom of that page. It has no number and doesn&rsquo;t move on its own; it travels with Tournaments. While Tournaments is off, Past tournaments isn&rsquo;t shown, and it comes back with the setting it had.</li>
              </ul>
              <p>A section your plan doesn&rsquo;t include isn&rsquo;t listed.</p>
            </>
          ),
        },
        {
          id: 'public-site-editor-game-day',
          title: 'What your home page shows on a game day',
          content: (
            <>
              <p>On a day your club has games, your home page shows them right after <strong>Open now</strong>, under <strong>Today</strong>. It has no switch and no place in the order: it shows when there are games and leaves when there are none.</p>
              <HelpDefs>
                <HelpDef term="Live now">Games being played right now. A house league game reads <em>Score after the game</em>; a rep game shows the coach&rsquo;s score as it is kept. A tournament you&rsquo;re running is one row with its counts, and opens the tournament.</HelpDef>
                <HelpDef term="Later today">Games still to start today, with their time and place.</HelpDef>
                <HelpDef term="Latest results">Scores from today and the two days before. A house league game with no score entered yet reads <em>No score yet</em> on its day.</HelpDef>
                <HelpDef term="Not being played today">Postponed, cancelled and moved games.</HelpDef>
              </HelpDefs>
              <ul>
                <li>Each part shows four games, then a row such as <strong>3 more later today</strong> that opens the rest in place.</li>
                <li>On a day with no games but results from the two days before, the part is titled <strong>Latest results</strong> instead. With neither, it isn&rsquo;t there.</li>
                <li>House league games show once their division&rsquo;s schedule is published. A rep team&rsquo;s games, home and away, show only when its coach has set the team&rsquo;s schedule to <strong>Public</strong>. Practices never show.</li>
                <li>Scores and the <strong>Live now</strong> part check for changes every 30 seconds while games are on.</li>
              </ul>
              <p>Under the <strong>Home page</strong> row, a line says how many rep teams show their games, such as <em>3 of 20 rep teams show their games on your site.</em> Each team&rsquo;s coach chooses this in <strong>Schedule visibility</strong>; it isn&rsquo;t changed from here.</p>
            </>
          ),
        },
        {
          id: 'public-site-editor-words',
          title: 'Your tagline, about text, contact and social links',
          content: (
            <>
              <p>The <strong>About us</strong> row holds your <strong>Tagline</strong> (one line under your name, up to 100 characters), your <strong>About</strong> text, <strong>Families&rsquo; questions go to</strong> — the address shown in your footer and on every team and tryout page — and your <strong>Social links</strong>.</p>
              <p>If your tagline or about text mentions a past year, a quiet hint asks <strong>Mentions 2025 — still true?</strong> It never stops a save, and a founding year (&ldquo;since 1979&rdquo;) isn&rsquo;t flagged.</p>
              <p>In <strong>Social links</strong>, a link typed without <code>https://</code> is completed for you, and the field says <strong>Saved as https://…</strong>. Something that isn&rsquo;t a web address is refused with the reason beside the field, and isn&rsquo;t saved until you fix it.</p>
            </>
          ),
        },
        {
          id: 'public-site-editor-about-page',
          title: 'Contacts, documents and questions for your About page',
          content: (
            <>
              <p>The <strong>Contacts, documents and sponsors</strong> row holds four lists. Three of them fill your club&rsquo;s <strong>About</strong> page, and the fourth, sponsors, is a door to <strong>Sponsorships</strong> (see the topic below). The row opens to four folded lines. Each says what is inside, with a count on the right. Tap a line to open its list, and tapping another closes the first. Each entry opens a small window; <strong>Add</strong> sits at the foot of each list.</p>
              <ul>
                <li><strong>Who to contact</strong> (up to twelve): a role, such as Registration, and its email address. When an address looks personal, the window suggests a role address like registrar@, which keeps working when a volunteer changes. It never refuses yours.</li>
                <li><strong>Documents and policies</strong> (up to thirty): a heading, a title and a link to a document you already publish. Families see them under your headings, such as Codes of conduct or Safety, and each opens in a new tab. Your site shows your documents; it never says your club is compliant.</li>
                <li><strong>Questions families ask</strong> (up to ten): short answers to what you get asked every season.</li>
              </ul>
              <p>Families reach the About page from the <strong>About us</strong> card on your home page and the <strong>Contacts and documents</strong> link in your footer. Both appear once you have added a contact, a document or a question.</p>
            </>
          ),
        },
        {
          id: 'public-site-editor-sponsors',
          title: 'Sponsors on your home page and About page',
          content: (
            <>
              <p>The <strong>Sponsors</strong> line in the <strong>Contacts, documents and sponsors</strong> row is a door to <strong>Sponsorships</strong>, where your club&rsquo;s sponsors are kept. Families still see them as a thank-you strip at the foot of your home page and in the sponsors on your About page, but you now choose where each one shows, and the last day for each place, in <strong>Sponsorships</strong> &rarr; <strong>Sponsors</strong>.</p>
              <p>The sponsors you already had moved over untouched, and they keep showing as they were. See <a href="#club-sponsorships">Sponsorships</a> for the whole place: packages, sponsors and where each one shows, and the invoice details and form.</p>
            </>
          ),
        },
        {
          id: 'public-site-editor-notice',
          title: 'Post a notice, such as a field closure',
          content: (
            <>
              <p>A club notice puts one line at the top of every public page and every team page, until it ends. A strip at the top of Public site shows it while the site is online. With none showing, it offers <strong>Post a notice</strong>; with one showing, it says <strong>Showing now</strong> with the line, when it ends, <strong>Edit</strong> and <strong>End now</strong>.</p>
              <ol>
                <li>Press <strong>Post a notice</strong>. A window opens.</li>
                <li>Write the <strong>Notice</strong>, such as &ldquo;All fields are closed tonight&rdquo; (up to 80 characters).</li>
                <li>Add <strong>More detail</strong> if you like.</li>
                <li>Choose when it <strong>Ends</strong>: <strong>Tonight</strong>, <strong>Tomorrow night</strong>, or a date and time.</li>
                <li>Press <strong>Post notice</strong>.</li>
              </ol>
              <p>Families see your words and a line like &ldquo;Posted 2:40 p.m. by the club &middot; ends tonight&rdquo;. One notice shows at a time: <strong>Edit</strong> opens the same window, <strong>Update notice</strong> replaces it, and <strong>End now</strong> takes it down. It also ends by itself at the time you chose. A notice never saves itself; it waits for <strong>Post notice</strong> or <strong>Update notice</strong>.</p>
            </>
          ),
        },
        {
          id: 'public-site-editor-look',
          title: 'Your look',
          content: (
            <>
              <p>The <strong>Look</strong> row is where the owner or an admin sets how your site looks. It moved here from Settings. Every change saves itself; there is no Save button.</p>
              <ul>
                <li><strong>Logo</strong> — <strong>Upload a logo</strong> (or <strong>Replace logo</strong>), <strong>Browse stock logos</strong>, or <strong>Remove</strong>.</li>
                <li><strong>Colours</strong> — <strong>From your logo</strong> comes first whenever you have uploaded a logo (a stock logo doesn&rsquo;t count): its two strongest colours. Then nine presets, then <strong>Your own colours</strong> (<strong>Main colour</strong> and <strong>Accent colour</strong>). Under them, a line tells you what colour your text and links will be, and says when we made a colour darker so families can read it.</li>
                <li><strong>Type</strong> — three looks, <strong>Classic</strong>, <strong>Serif</strong> and <strong>Clean</strong>, each shown with your club&rsquo;s own name. A club that had picked an older font choice reads as Classic.</li>
                <li><strong>Banner photo</strong> — shows across the top of your home page on a computer. Phones leave it out.</li>
              </ul>
              <p>A stock logo is drawn on a circle in your main colour, and is remade if you change the colour; a logo you uploaded is never changed.</p>
            </>
          ),
        },
      ],
      faqs: [
        {
          id: 'faq-public-site-field-closure',
          question: 'How do I tell families the fields are closed tonight?',
          popular: true,
          answerText: 'In Public site, press Post a notice at the top. Write the notice, add more detail if you like, choose when it ends (tonight, tomorrow night, or a date and time) and press Post notice. It shows at the top of every public page and every team page until it ends, or until you press End now.',
          keywords: ['field closure', 'fields closed', 'rain out', 'cancelled tonight', 'club notice', 'post notice', 'announcement'],
          answer: (
            <>
              <p>In <strong>Public site</strong>, press <strong>Post a notice</strong> at the top. Write the notice, add more detail if you like, choose when it <strong>Ends</strong> (tonight, tomorrow night, or a date and time) and press <strong>Post notice</strong>.</p>
              <p>It shows at the top of every public page and every team page until it ends, or until you press <strong>End now</strong>.</p>
            </>
          ),
        },
      ],
    },
    {
      id: 'club-sponsorships',
      heading: 'Sponsorships — packages and the businesses that back your club',
      summary: 'The Sponsorships place keeps your packages, your sponsors and where each one shows on your public site, and the invoice details and form you will sell with. It also covers how a business pays, by card or by cheque, and how to refund a card payment. Four tabs: Deals, Packages, Sponsors and Setup.',
      keywords: [
        'sponsorships', 'sponsorship', 'sponsor', 'sponsors', 'deals', 'packages', 'package', 'setup', 'get ready to sell sponsorships',
        'your invoice details', 'invoice details', 'make your first package', 'your sponsorship form', 'sponsorship form',
        'shows on', 'showing', 'not showing', 'sponsored by', 'sponsor strip', 'home page strip', 'last day', 'how many', 'taken', 'full',
        'shows until', 'what’s included', 'your logo on our website', 'sponsorship document', 'archive a package', 'price before gst/hst',
        'registered for gst/hst', 'gst/hst number', 'by e-transfer to', 'cheques payable to', 'payment due', 'contact for sponsors',
        'mailing address', 'show it somewhere else too', 'who can open sponsorships', 'manage member sponsorships',
        'offer a deal', 'offering a deal', 'make the link only', 'send the offer', 'email the offer', 'why you can email them', 'when', 'the reason',
        'do not offer again', 'unsubscribe', 'unsubscribed', 'send the link again', 'make a new link', 'the old link stops working',
        'give them the link in person', 'link only', 'not emailed', 'casl', 'sponsorship email', 'sponsor’s page', 'the business’s page', 'invoice emailed', 'invoice pdf',
        'record a payment', 'part payment', 'void a payment', 'void payment', 'revised invoice', 'paid in full', 'receipt', 'gst/hst collected', 'gst/hst remitted', 'payments', 'still owing', 'general ledger',
        'card', 'pay by card', 'credit card', 'sponsor pays by card', 'processing fee', 'processing fee on sponsorships', 'the sponsor pays it', 'the club pays it',
        'refund', 'refund a sponsor', 'part refund', 'partial refund', 'refund part of a payment', 'refunded', 'credit note', 'credit memo', 'withdrawn',
        'send the invoice', 'form received', 'payment window', 'open a payment', 'void', 'dispute', 'chargeback', 'dashboard refund', 'refund made in stripe',
        'needs attention', 'card payment not on its deal', 'refund on its way', 'refund reason', 'all of it', 'part of it',
        'offer again', 'next year', 'renew', 'renewal', 'renew sponsors', 'last year’s sponsors', 'new fiscal year', 'ready', 'waiting', 'can’t be emailed', 'paid us on', 'package is full',
      ],
      searchText: 'sponsorships place club group sidebar after communications before public site more sheet phone four tabs deals packages sponsors setup get ready to sell sponsorships three steps your invoice details make your first package your sponsorship form package name price before gst/hst for the club a house league division a house league team a tournament how many empty means no limit shows until what’s included your logo on our website switch other items sponsorship document pdf up to 8 mb taken counts open offers so nothing is promised twice full when every place is taken archived never deleted bring it back sponsors one list every business showing not showing shows on home page strip at most 20 a division sponsored by line on that division’s schedule and standings a team shown on the about page only a tournament last day inclusive leaves by itself list holds 100 sponsors show it somewhere else too remove sponsor logo deleted existing sponsors moved over untouched site editor sponsors line door invoice details mailing address registered for gst/hst and number by e-transfer to cheques payable to payment due contact for sponsors owner admins treasurer change read by others the form business details first then your own questions and documents who can open sponsorships manage member access on by default owner admins treasurer off for others registrar league plus club plan offer a deal offering a deal business package shows on amount shows until charge hst gst tax switch make the link only send the offer new business a name and an email they fill in the rest the business’s page its own link no account needed about your business your logo how you’ll pay send and pay by cheque or e-transfer your invoice comes by email with how to pay download the invoice pdf states offered form received invoiced paid delivered withdrawn copy the link email the offer send the link again make a new link the old link stops working withdraw this deal give a reason why you can email them paid us in the last two years asked us about sponsoring in the last six months gave us this address publish this address for business when the day they paid the day they asked kept with the offer ran out give them the link in person mailing address contact email in setup first the email names why they got it the club’s address and an unsubscribe link a note from you do not offer again unsubscribe page stop sponsorship offers invoices and receipts still come family opted out of club email casl consent getting paid record a payment amount received date received how it was paid cheque e-transfer cash card other reference note record payment part payment leaves the rest owing paid when nothing is left owing payments card void payment reason struck through owing again closed fiscal year revised invoice change this deal same number revised date emailed again paid in full receipt the paid invoice is the receipt link no attachment pdf download mailing address contact for sponsors nothing is sent general ledger sponsorship club sponsorship income gst/hst collected each payment carries its share budget vs. actual months the club’s other books and gst/hst gst/hst remitted remittance send the tax to the government cash on hand accountant files the return reportable from the invoice date pay by card credit card card payment two buttons send and pay by card send and pay by cheque or e-transfer processing fee on sponsorships payouts card the sponsor pays it the club pays it before an invoice exists pay by card on an invoice already issued never gains a fee line a card payment issues the invoice paid at once payment window open a payment amount how it was paid who recorded it and when stripe reference card reference the gst/hst share refund void refund a card payment all of it part of it a reason is required what is left to refund never includes the processing fee refund on its way booked when the card company confirms refund of everything ends the deal as withdrawn logo comes down refunded fourth figure the business is emailed credit note credit memo 2027-014-c1 pdf anyone who can open sponsorships can refund card payments are never voided only offered while card payments are on dispute chargeback the card’s bank is disputing answer the dispute in stripe first dashboard refund a refund made in your own stripe dashboard is not booked needs attention record it in the ledger send the invoice form received confirm window the invoice is issued now emailed with how to pay by cheque or e-transfer card page still open try again in a few minutes withdrawing a deal closes an open card page a payment the deal can’t take refund it to the card in stripe offer again renew last year’s sponsors two divisions could not confirm email offer has ended earlier year link next year new fiscal year sponsored you offer them this year’s packages ready waiting can’t be emailed ticked paid us on pick a team pick a division pick a tournament shows until the package’s last day has passed full package frees up when the new year starts never paid more than two years ago archived unsubscribed no email on file disputed or being refunded send offers sent of offers keep this page open offer again on one old deal',
      content: (
        <p><strong>Sponsorships</strong> is the place for the businesses that back your club. It keeps your <strong>packages</strong> (what a business gets, what it costs and how many you have), every <strong>sponsor</strong> and where each one shows on your public site, and the invoice details and form you sell with. It sits in the Club group of the sidebar, after <strong>Communications</strong> and before <strong>Public site</strong>, and on a phone it is a row in the <strong>More</strong> sheet. It has four tabs: <strong>Deals</strong>, <strong>Packages</strong>, <strong>Sponsors</strong> and <strong>Setup</strong>.</p>
      ),
      subtopics: [
        {
          id: 'club-sponsorships-t-start',
          title: 'Getting ready to sell sponsorships',
          content: (
            <>
              <p>Until you have a package, <strong>Deals</strong> shows <strong>Get ready to sell sponsorships</strong>, three steps with a count of how many are done:</p>
              <ol>
                <li><strong>Your invoice details</strong>: your club&rsquo;s mailing address, how businesses pay you, and whether you charge GST/HST. It opens <strong>Setup</strong>.</li>
                <li><strong>Make your first package</strong>: what a business gets, what it costs and how many you have. It opens <strong>Packages</strong>.</li>
                <li><strong>Your sponsorship form</strong>: it already asks for the business&rsquo;s details and logo. Add your own questions.</li>
              </ol>
              <p>Once you have a package, <strong>Deals</strong> lists your deals, and says there are none yet until you offer one. If your club already had sponsors on its website, a line on the checklist says how many, and they keep showing as they are; they are on the <strong>Sponsors</strong> tab.</p>
              <HelpNote variant="info" title="Who can open Sponsorships">The owner, admins and the treasurer, by default. Anyone else gets it from <strong>Members &rarr; Manage</strong>, on the <strong>Sponsorships</strong> row (see <a href="#roles">Roles explained</a>). A member limited to some rep teams groups doesn&rsquo;t get it, because it holds every sponsor&rsquo;s contact details.</HelpNote>
            </>
          ),
        },
        {
          id: 'club-sponsorships-t-packages',
          title: 'Packages: what a business gets and what it costs',
          content: (
            <>
              <p>A package is a standing offer. <strong>Packages</strong> lists each one with its <strong>For</strong>, its <strong>Price</strong> and how many are <strong>Taken</strong>. Press <strong>Add a package</strong> and fill in:</p>
              <ul>
                <li><strong>Name</strong> and <strong>Price</strong>. The price is before GST/HST.</li>
                <li><strong>For</strong>: the whole club, a house-league division, a house-league team or a tournament. A division, team or tournament package picks which one on each deal.</li>
                <li><strong>How many</strong>: how many businesses can hold it. Leave it empty for no limit.</li>
                <li><strong>Shows until</strong>: the last day each deal starts with.</li>
                <li><strong>What&rsquo;s included</strong>: the <strong>Your logo on our website</strong> switch, which puts the business on your public site, and any other items you add, such as a field banner. They are listed on the offer, the invoice and the delivery checklist.</li>
                <li><strong>Sponsorship document</strong>: an optional PDF up to 8 MB that the business can open from its link.</li>
              </ul>
              <p><strong>Taken</strong> counts open offers as well as paid deals, so nothing is promised twice. A package reads <strong>Full</strong> when every place is taken; raise <strong>How many</strong> to offer more. A package frees up when the new fiscal year starts, unless last year&rsquo;s deal is still showing: a deal keeps its place after its own year only until its <strong>Shows until</strong> day has passed, and one with no last day gives its place back when the year turns. A package is never deleted: <strong>Archive this package</strong> takes it off the list, deals already made with it keep it as it was, and <strong>Show archived</strong> lets you <strong>Bring this package back</strong>.</p>
            </>
          ),
        },
        {
          id: 'club-sponsorships-t-sponsors',
          title: 'Sponsors: where each business shows',
          content: (
            <>
              <p><strong>Sponsors</strong> is one list of every business, each marked <strong>Showing</strong> or <strong>Not showing</strong>. You can search it, and the list holds 100 sponsors. Press <strong>Add a sponsor</strong> for a name (the only thing required; a sponsor with no logo shows as its name), a logo, a link and where it shows.</p>
              <p>Each sponsor has one or more <strong>Shows on</strong> places, and a <strong>Last day</strong> for each:</p>
              <ul>
                <li><strong>The club</strong>: a strip at the foot of your home page, at most 20 businesses on the home page.</li>
                <li><strong>A division</strong>: a <strong>Sponsored by</strong> line on that division&rsquo;s public schedule and standings.</li>
                <li><strong>A team</strong>: your About page only.</li>
                <li><strong>A tournament</strong>: that tournament&rsquo;s pages.</li>
              </ul>
              <p>Press <strong>Show it somewhere else too</strong> to add another place. Families see the sponsor through its last day, which counts, and then it leaves that place by itself and the row reads <strong>Ended</strong>. Leave the day empty for no last day. Your About page lists every sponsor that is showing anywhere. <strong>Remove sponsor</strong> takes a business off every page and deletes its logo.</p>
            </>
          ),
        },
        {
          id: 'club-sponsorships-t-setup',
          title: 'Setup: invoice details and the sponsorship form',
          content: (
            <>
              <p><strong>Setup</strong> has two rows, <strong>Invoice details</strong> and <strong>Sponsorship form</strong>.</p>
              <p><strong>Invoice details</strong> are what every sponsorship invoice and offer email carries:</p>
              <ul>
                <li><strong>Mailing address</strong>. Use an address the club is happy to publish; a PO box works.</li>
                <li><strong>Registered for GST/HST</strong>, and the number, which is checked for its form.</li>
                <li><strong>By e-transfer to</strong> and <strong>Cheques payable to</strong>: how a business pays you.</li>
                <li><strong>Payment due</strong>: days after the invoice, where 0 means on receipt.</li>
                <li><strong>Contact for sponsors</strong>: a name and an email.</li>
              </ul>
              <p>Only the owner, admins and the treasurer change them. Anyone else who opens Sponsorships can read them. Whether GST/HST applies to a sponsorship depends on what the business gets and on your club, so ask your accountant.</p>
              <p>The <strong>Sponsorship form</strong> is what a business answers. Every business is first asked for the business details (name, contact name, email, business address, phone, website and a logo), and you can&rsquo;t remove those. After them come your own questions and documents.</p>
            </>
          ),
        },
        {
          id: 'club-sponsorships-t-offer',
          title: 'Offering a deal to a business',
          content: (
            <>
              <p>On <strong>Deals</strong>, press <strong>Offer a deal</strong>. A deal is one package offered to one business, with its own link.</p>
              <ol>
                <li>Pick the <strong>Business</strong> from your sponsors, or type a new name. A new business also needs an email; the business fills in the rest.</li>
                <li>Pick the <strong>Package</strong>, and for a division, team or tournament package, where it <strong>Shows on</strong>. A place that already has a sponsor warns you but never stops you.</li>
                <li>Check the <strong>Amount</strong> (it starts at the package price, and you can change it for this business) and <strong>Shows until</strong>.</li>
                <li>Turn on <strong>Charge GST</strong> or <strong>HST</strong> only if your accountant says this deal is taxable. The rate follows the province of the business&rsquo;s address, so the form asks for that address only on a deal that charges tax; on any other deal it&rsquo;s optional and only prints on the invoice.</li>
                <li>Press <strong>Send the offer</strong> to email it (see <a href="#club-sponsorships-t-email">Emailing the offer</a>), or <strong>Make the link only</strong> to make the link without sending anything.</li>
              </ol>
              <p><strong>Make the link only</strong> is for a business you have spoken to. Nothing is emailed; the deal reads <strong>Link made, not emailed</strong> and you copy the link and give it to them yourself. A link you hand over in person is not an email, so FieldLogicHQ asks for no reason and no mailing address. If you paste it into your own email or text message, that message is yours to justify: send it only to a business you have a reason to email.</p>
              <p>The link opens the business&rsquo;s own page on your club&rsquo;s site, with no account. What the business sees there, and how it pays, is in <a href="#club-sponsorships-t-business-page">What the business sees: paying by card or by cheque</a>.</p>
              <p>A deal moves through <strong>Offered</strong>, <strong>Form received</strong>, <strong>Invoiced</strong>, <strong>Paid</strong> and <strong>Delivered</strong>, or ends <strong>Withdrawn</strong>. Open a deal for its history and the business&rsquo;s answers. <strong>Copy the link</strong> is there too, and <strong>Withdraw this deal</strong> takes the offer down with a reason that is kept. Withdrawing also closes any card page the business has open. A paid deal can&rsquo;t be withdrawn; refund a card payment, or void a cheque or e-transfer payment, first.</p>
              <p>An offer from an earlier fiscal year that nobody answered stops holding its place once its <strong>Shows until</strong> day has passed (or the year turns, when it has none). Its link then tells the business the offer has ended. Withdraw it and offer a new deal.</p>
              <HelpNote variant="info" title="A new link replaces the old one">On a deal that is still open, <strong>Send the link again</strong> emails a new link and <strong>Make a new link</strong> makes one without emailing. Either way the old link stops working and shows the business that it has been replaced.</HelpNote>
            </>
          ),
        },
        {
          id: 'club-sponsorships-t-email',
          title: 'Emailing the offer: why you can email them',
          content: (
            <>
              <p>Send the offer only to a business you have a reason to email. <strong>Send the offer</strong> asks <strong>Why you can email them</strong>, and the reason is kept with the offer, with today&rsquo;s date:</p>
              <HelpDefs>
                <HelpDef term="They paid us in the last 2 years">Asks <strong>When?</strong>: the day they last paid. For a business with payments recorded here, a later day than the latest one is refused, and the reason isn&rsquo;t accepted when none of its payments still counts (refunded or disputed).</HelpDef>
                <HelpDef term="They asked us about sponsoring (in the last 6 months)">Asks <strong>When?</strong>: the day they asked.</HelpDef>
                <HelpDef term="They gave us this address">No day needed.</HelpDef>
                <HelpDef term="They publish this address for business">Only when a sponsorship is relevant to what they do.</HelpDef>
              </HelpDefs>
              <p>If the day is more than two years (or six months) ago, <strong>When?</strong> turns red and says the reason no longer applies. Give that business the link in person instead. A day that hasn&rsquo;t come yet is refused too.</p>
              <p>Sending also waits for two things in <strong>Setup</strong>: your <strong>Mailing address</strong> and a <strong>Contact for sponsors</strong> email. The foot of the window says which one is missing, and <strong>Make the link only</strong> still works meanwhile.</p>
              <p>The email opens with your optional <strong>note</strong>, then the package, its price and a <strong>See the package</strong> button. It tells the business why it got the email, names the club and its mailing address, and ends with an <strong>Unsubscribe</strong> link. You can&rsquo;t remove any of that.</p>
              <p>If you made the link only and later want to email it, open the deal and press <strong>Email the offer</strong>; it asks the same reason. An offer is emailed once. After that, use <strong>Send the link again</strong>.</p>
              <p>If FieldLogicHQ can&rsquo;t confirm an email went, it says so and keeps the deal and its link. If the business didn&rsquo;t get it, use <strong>Send the link again</strong>.</p>
            </>
          ),
        },
        {
          id: 'club-sponsorships-t-offer-again',
          title: 'Offer again: renewing last year’s sponsors',
          content: (
            <>
              <p>In a new fiscal year, <strong>Deals</strong> shows how many businesses sponsored you last year. <strong>Offer again&hellip;</strong> lists last year&rsquo;s deals so you can send this year&rsquo;s packages in one go. The card leaves when none of them is left to offer.</p>
              <HelpDefs>
                <HelpDef term="Ready">It can go. It is ticked unless it still needs a pick, or its package has fewer places left than rows. <strong>Paid us on</strong> is the payment its email rests on; you don&rsquo;t type it.</HelpDef>
                <HelpDef term="Waiting">Something has to exist first: this year&rsquo;s tournament, the new teams or division, or a free place on a full package.</HelpDef>
                <HelpDef term="Can&rsquo;t be emailed">The package is archived, there is no email on file, the business unsubscribed or is marked <strong>Do not offer again</strong>, its family opted out of club email, it has never paid you, its last payment is more than two years old, or the payment is disputed or being refunded.</HelpDef>
              </HelpDefs>
              <ol>
                <li>Where a row asks, pick in place: this year&rsquo;s tournament, a team, or which division. If the package&rsquo;s last day has passed, check <strong>Shows until</strong>.</li>
                <li>Tick the rows to send. Each goes at this year&rsquo;s price (last year&rsquo;s is shown when it differs), and charges tax if last year&rsquo;s deal did and your club is still registered.</li>
                <li>Press <strong>Send</strong>. Each business gets its own email and its own new deal. A long list takes a while, so keep the page open until it finishes.</li>
              </ol>
              <p>A business that had two deals last year, such as two divisions, has two rows, and you can offer both. <strong>Deals</strong> then says how many offers were sent. A row that wasn&rsquo;t offered is named, and nothing is made for it. One whose email couldn&rsquo;t be confirmed keeps its deal, so open it and send the link again. For a note, a different amount or a link without an email, use <a href="#club-sponsorships-t-offer">Offer a deal</a> instead.</p>
              <p>To renew just one, open a paid deal from an earlier year and press <strong>Offer again&hellip;</strong>. The <strong>Offer a deal</strong> window opens filled in. The button isn&rsquo;t there when that deal has already been renewed this year or the business can&rsquo;t be emailed.</p>
              <HelpNote variant="info" title="Refunded in Stripe itself?">A refund made in your own Stripe dashboard isn&rsquo;t recorded on the deal, so that business still reads as paid here. Untick it, and don&rsquo;t use <strong>Offer again&hellip;</strong> on that deal.</HelpNote>
            </>
          ),
        },
        {
          id: 'club-sponsorships-t-stop',
          title: 'A business that asks you to stop: Unsubscribe and Do not offer again',
          content: (
            <>
              <p>Every offer email ends with an <strong>Unsubscribe</strong> link. It opens a page that says it stops sponsorship offers from your club to that address; the business presses one button, and your club then treats every address it has on record for that business as stopped. <strong>Invoices and receipts for a sponsorship it has already agreed to still come.</strong> This stops sponsorship offers only, not the club&rsquo;s other emails.</p>
              <p>When a business has unsubscribed, the <strong>Offer a deal</strong> window says so with the date, and <strong>Send the offer</strong> is gone. You can still <strong>Make the link only</strong> and give it to them if they ask you about sponsoring again. An address a family has asked the club not to email works the same way.</p>
              <p>If a business tells you by reply or by phone to stop, open its deal and press <strong>Do not offer again</strong>. Nobody at the club can undo it. It covers the business, not just one address: every email address your club has on record for it is stopped, including the one you offered to and the one it typed on its form.</p>
            </>
          ),
        },
        {
          id: 'club-sponsorships-t-business-page',
          title: 'What the business sees: paying by card or by cheque',
          content: (
            <>
              <p>The business&rsquo;s link opens its own page on your club&rsquo;s site, with no account: the package, your form (its business details and logo, then your questions) and <strong>How you&rsquo;ll pay</strong>. What it can press depends on whether your club has card payments on. The owner turns online payments on under <strong>Payouts</strong> in <strong>Organization &rsaquo; Settings</strong>, and card payment isn&rsquo;t offered until they are.</p>
              <HelpDefs>
                <HelpDef term="Card payments are off">The page has one <strong>Send</strong> button. Pressing it moves the deal to <strong>Invoiced</strong>, and the page shows the invoice number, the amount, the due date and how to pay by cheque or e-transfer.</HelpDef>
                <HelpDef term="Card payments are on">The page has two buttons: <strong>Send and pay $X by card</strong>, or <strong>Send and get my invoice</strong>. The invoice button works as above, and the business pays by cheque or e-transfer. The card button opens a secure card page. When the card payment goes through, the invoice is issued at once, already marked paid, and the page shows the receipt.</HelpDef>
                <HelpDef term="An invoice already issued">The business&rsquo;s link also shows <strong>Pay $X by card</strong>, with the cheque and e-transfer details still below it. The club pays the fee on that payment, and an invoice already issued never gains a fee line.</HelpDef>
              </HelpDefs>
              <p>The invoice is emailed to the business with a link back to its page, where it downloads as a PDF (no attachment: an attachment can get the email filtered).</p>
              <p>Who pays the card&rsquo;s processing fee, before any invoice exists, is your choice on the <strong>Processing fee on sponsorships</strong> row of the <strong>Payouts</strong> card: <strong>The sponsor pays it</strong> or <strong>The club pays it</strong>. The club pays it unless you change it. When the sponsor pays it, the page says the total <strong>includes a card processing fee</strong>, with the GST/HST on it when the deal charges tax. A cheque or e-transfer never carries a fee.</p>
            </>
          ),
        },
        {
          id: 'club-sponsorships-t-send-invoice',
          title: 'Form received: Send the invoice',
          content: (
            <>
              <p>A deal sits at <strong>Form received</strong> when the business sent its details and started to pay by card but didn&rsquo;t finish. If it would rather pay by cheque or e-transfer, you can issue its invoice yourself.</p>
              <ol>
                <li>Open the deal that reads <strong>Form received</strong>.</li>
                <li>Press <strong>Send the invoice</strong>.</li>
                <li>Confirm in the window. The invoice is issued now, with its number, and emailed with how to pay by cheque or e-transfer.</li>
              </ol>
              <p>The business&rsquo;s link still lets it pay by card. A card page that is still open is closed first.</p>
              <HelpNote variant="info" title="If the business is on the card page right now">The window asks you to try again in a few minutes, and nothing is sent.</HelpNote>
            </>
          ),
        },
        {
          id: 'club-sponsorships-t-paid',
          title: 'Getting paid: record a payment, void it, and a revised invoice',
          content: (
            <>
              <p>When a business pays by cheque or e-transfer, record it on its deal. An <strong>Invoiced</strong> deal has <strong>Record a payment</strong> in the box at the top.</p>
              <ol>
                <li>Press <strong>Record a payment</strong>.</li>
                <li>Check <strong>Amount received</strong>. It starts at what is still owing; type less for a part payment.</li>
                <li>Pick <strong>Date received</strong> (today or earlier) and <strong>How it was paid</strong>. <strong>Cheque</strong> and <strong>E-transfer</strong> are how a business pays you here; <strong>Cash</strong>, <strong>Card</strong> and <strong>Other</strong> are there for money that reached you another way. A card payment the business makes on its own page records itself; you don&rsquo;t record it.</li>
                <li>Add a <strong>Reference</strong> (the cheque or e-transfer number) and a <strong>Note</strong> if you like, then press <strong>Record payment</strong>.</li>
              </ol>
              <p>A part payment leaves the rest owing and the deal stays <strong>Invoiced</strong>. When nothing is left owing, the deal is <strong>Paid</strong>.</p>
              <p>The <strong>Payments</strong> card lists each payment, and each one opens its own window (see <a href="#club-sponsorships-t-payment-window">A payment&rsquo;s own window</a>). To correct a wrong cheque or e-transfer payment, open it, press <strong>Void</strong>, give a <strong>Reason</strong> and press <strong>Void payment</strong>. The line stays, struck through with the reason, and a paid deal is owing again. A payment in a closed fiscal year can&rsquo;t be voided here. A card payment is never voided; it is refunded (see <a href="#club-sponsorships-t-refund">Refunding a card payment</a>).</p>
              <HelpDefs>
                <HelpDef term="A revised invoice">While no payment stands on an invoiced deal, <strong>Change this deal</strong> can change the amount or the tax. The invoice keeps its number, shows a <strong>revised</strong> date, and is emailed to the business again. Once a payment is recorded the amount and tax can&rsquo;t change; to change them after a cheque or e-transfer payment, void that payment first.</HelpDef>
                <HelpDef term="The emails">The invoice, a revised invoice and the <strong>Paid in full</strong> receipt each go to the business as an email with a link to its page. Nothing is attached. The paid invoice is the receipt, and the PDF downloads from the business&rsquo;s page and from the invoice number on the deal.</HelpDef>
                <HelpDef term="If they don’t go">They need your <strong>Mailing address</strong> and a <strong>Contact for sponsors</strong> email under <strong>Invoice details</strong>. Without them nothing is sent, and the link still shows the invoice or receipt.</HelpDef>
              </HelpDefs>
            </>
          ),
        },
        {
          id: 'club-sponsorships-t-payment-window',
          title: 'A payment’s own window',
          content: (
            <>
              <p>On a deal, the <strong>Payments</strong> card lists each recorded payment as a row. Press a row to open that payment&rsquo;s own window.</p>
              <HelpDefs>
                <HelpDef term="Amount">What was paid, and the GST/HST share of it when the invoice carried tax.</HelpDef>
                <HelpDef term="How it was paid">Cheque, e-transfer, card or another way.</HelpDef>
                <HelpDef term="Recorded">Who recorded it and when. A card payment reads <strong>By itself when the card payment landed</strong>.</HelpDef>
                <HelpDef term="Stripe reference">The card reference, for a card payment, to find it in your Stripe dashboard.</HelpDef>
              </HelpDefs>
              <p>The foot of the window has the one thing you can do with that payment: <strong>Refund</strong> for a card payment, or <strong>Void</strong> for a cheque or e-transfer payment. A card payment is never voided, it is refunded. When a refund has a credit note, the window links to it.</p>
            </>
          ),
        },
        {
          id: 'club-sponsorships-t-refund',
          title: 'Refunding a card payment',
          content: (
            <>
              <p>When your club has card payments on, you can send a sponsor&rsquo;s card payment back to its card. Anyone who can open Sponsorships can do it, the same people who record and void payments. <strong>Refund</strong> is only offered while card payments are on for the club.</p>
              <ol>
                <li>Open the deal, press the card payment, and press <strong>Refund</strong>.</li>
                <li>Choose <strong>All of it</strong> or <strong>Part of it</strong>. For part of it, type the amount. The window says what is left to refund.</li>
                <li>Write a <strong>Reason</strong>. It is required either way, and the business reads it in the refund email.</li>
                <li>Press the button at the foot, such as <strong>Refund $X and email</strong>.</li>
              </ol>
              <HelpDefs>
                <HelpDef term="The processing fee">A refund never includes the processing fee the business paid, nor the tax on that fee.</HelpDef>
                <HelpDef term="Where it goes">Back to the business&rsquo;s card. It is booked when the card company confirms it; until then it reads <strong>on its way</strong>.</HelpDef>
                <HelpDef term="Refunding all of it">Refunding everything that was paid ends the deal as <strong>Withdrawn</strong>, and the business&rsquo;s logo comes down and its place is free for another sponsor.</HelpDef>
                <HelpDef term="On the deal screen">The money band gets a fourth figure, <strong>Refunded</strong>.</HelpDef>
                <HelpDef term="The business">It is emailed, and its page and the invoice list the refund.</HelpDef>
                <HelpDef term="Credit note">When the invoice carries GST/HST, each refund also gets a credit note: its own PDF, numbered like <em>2027-014-C1</em>. The business downloads it from its page, and you download it from the payment&rsquo;s window.</HelpDef>
              </HelpDefs>
            </>
          ),
        },
        {
          id: 'club-sponsorships-t-refund-trouble',
          title: 'When a refund can’t go ahead, or money isn’t on its deal',
          content: (
            <>
              <p>Three cases come back to you in Stripe, and the last two also put a <strong>Needs attention</strong> item on Sponsorships.</p>
              <HelpDefs>
                <HelpDef term="The card’s bank is disputing the charge">A refund isn&rsquo;t possible while a charge is in dispute (a chargeback). The window says so. Answer the dispute in Stripe first.</HelpDef>
                <HelpDef term="You refunded in your own Stripe dashboard">That refund is not booked in FieldLogicHQ. Sponsorships shows <strong>A refund made in Stripe isn&rsquo;t in your books</strong>; record it in the Ledger, and refund from the deal&rsquo;s payment next time.</HelpDef>
                <HelpDef term="A payment the deal can’t take">If a payment arrives after the deal was withdrawn, or invoiced another way, the money is not recorded. Sponsorships shows <strong>A sponsor&rsquo;s card payment isn&rsquo;t on its deal</strong>; refund it to the card in Stripe.</HelpDef>
              </HelpDefs>
            </>
          ),
        },
        {
          id: 'club-sponsorships-t-books',
          title: 'Where a payment lands in your books',
          content: (
            <>
              <p>Each payment writes two lines on the <strong>General ledger</strong>: the sponsorship under <strong>Sponsorship</strong> &rsaquo; <strong>Club sponsorship</strong> (income), and, when the invoice carried tax, <strong>GST/HST collected</strong>, each payment carrying its share. <strong>GST/HST collected</strong> is not in <strong>Budget vs. Actual</strong>, because it is the club&rsquo;s to pass on. It is cash, so it shows in <strong>Months</strong> on <strong>The club&rsquo;s other books and GST/HST</strong> and Cash still closes on Cash on hand. The tax is counted when the money arrives, and your accountant files the return; GST/HST can be reportable from the invoice date. A card payment&rsquo;s processing fee also goes in the <strong>General ledger</strong>, as <strong>Payment processing</strong>.</p>
              <p>When the club sends the tax on to the government, press <strong>Add entry</strong> on the <strong>General ledger</strong>, choose money out and file it under <strong>Admin</strong> &rsaquo; <strong>GST/HST remitted</strong>. It lowers Cash on hand, but it is not spending: it stays out of <strong>Budget vs. Actual</strong> (and never shows as <strong>Off-plan</strong>) and sits on the same <strong>Months</strong> row as the tax collected. It can&rsquo;t go on the budget plan, for the same reason.</p>
            </>
          ),
        },
        {
          id: 'club-sponsorships-t-site',
          title: 'The Sponsors line in Public site',
          content: (
            <p>The <strong>Sponsors</strong> line in <strong>Public site</strong>, under <strong>Contacts, documents and sponsors</strong>, is now a door to <strong>Sponsorships</strong>. The sponsor list moved there, with where each one shows, and the sponsors you already had moved over untouched.</p>
          ),
        },
      ],
      faqs: [
        {
          id: 'faq-sponsorship-refund-card',
          question: 'How do I refund a sponsor who paid by card?',
          answerText: 'Open the deal, press the card payment, and press Refund. Choose All of it or Part of it, write a reason (required either way) and press the button. A refund never includes the processing fee the business paid. It goes back to the business’s card and is booked when the card company confirms it; until then it shows on its way. Refunding everything ends the deal as Withdrawn. The business is emailed, and when the invoice carries GST/HST the refund gets a credit note PDF. A card payment is never voided, it is refunded. Refund is only offered while card payments are on for the club. Part refund, partial refund, credit memo, chargeback, dispute.',
          keywords: ['refund a sponsor', 'refund card payment', 'part refund', 'partial refund', 'credit note', 'credit memo', 'void a card payment', 'refunded', 'withdrawn', 'payment window'],
          answer: (
            <p>Open the deal, press the card payment and press <strong>Refund</strong>. Choose <strong>All of it</strong> or <strong>Part of it</strong>, write a reason and press the button. It goes back to the business&rsquo;s card and never includes the processing fee the business paid. A card payment is never voided; it is refunded. See <a href="#club-sponsorships-t-refund">Refunding a card payment</a>.</p>
          ),
        },
        {
          id: 'faq-sponsorship-refund-blocked',
          question: 'Why can’t I refund a sponsor’s card payment, or why isn’t my Stripe refund in the books?',
          answerText: 'A refund is not possible while the card’s bank is disputing the charge (a dispute or chargeback): answer the dispute in Stripe first. A refund made directly in your own Stripe dashboard is not booked in FieldLogicHQ: Sponsorships shows a Needs attention item asking you to record it in the Ledger. Refund from the deal’s payment next time. Dashboard refund.',
          keywords: ['dispute', 'chargeback', 'dashboard refund', 'refund made in stripe', 'needs attention', 'record it in the ledger', 'refund not allowed'],
          answer: (
            <p>A refund can&rsquo;t go ahead while the card&rsquo;s bank is disputing the charge; answer the dispute in Stripe first. A refund made in your own Stripe dashboard isn&rsquo;t booked here, so Sponsorships shows a <strong>Needs attention</strong> item asking you to record it in the Ledger. See <a href="#club-sponsorships-t-refund-trouble">When a refund can&rsquo;t go ahead</a>.</p>
          ),
        },
        {
          id: 'faq-sponsorship-card-not-on-deal',
          question: 'A sponsor paid by card but the payment isn’t on its deal. What now?',
          answerText: 'If a card payment arrives that the deal can’t take, for example the deal was withdrawn or invoiced another way in the meantime, the money is not recorded and Sponsorships shows a Needs attention item: A sponsor’s card payment isn’t on its deal. Refund it to the card in Stripe.',
          keywords: ['card payment not on deal', 'payment not recorded', 'needs attention', 'refund in stripe', 'withdrawn deal paid'],
          answer: (
            <p>If a payment arrives that the deal can&rsquo;t take, because it was withdrawn or invoiced another way in the meantime, the money isn&rsquo;t recorded. Sponsorships shows a <strong>Needs attention</strong> item; refund it to the card in Stripe.</p>
          ),
        },
        {
          id: 'faq-sponsorship-form-received',
          question: 'A deal says Form received. How do I send the invoice?',
          answerText: 'A deal sits at Form received when the business sent its details and started to pay by card but did not finish. Press Send the invoice on the deal and confirm: the invoice is issued now with its number and emailed with how to pay by cheque or e-transfer, and their link still lets them pay by card. If the business is on the card page right now, try again in a few minutes. Withdrawing a deal also closes any open card page.',
          keywords: ['form received', 'send the invoice', 'started to pay by card', 'try again in a few minutes', 'card page open'],
          answer: (
            <p>Press <strong>Send the invoice</strong> on the deal and confirm. The invoice is issued now and emailed, and the business can still pay by card from its link. See <a href="#club-sponsorships-t-send-invoice">Form received: Send the invoice</a>.</p>
          ),
        },
        {
          id: 'faq-sponsorship-card-fee',
          question: 'Who pays the card processing fee on a sponsorship?',
          answerText: 'Before an invoice exists, it follows your choice on the Processing fee on sponsorships row of the Payouts card in Organization Settings: The sponsor pays it, or The club pays it. The club pays it unless you change it. On an invoice already issued, the club pays the fee and the invoice never gains a fee line. A cheque or e-transfer never carries a fee. Card, credit card, pay by card.',
          keywords: ['processing fee', 'processing fee on sponsorships', 'the sponsor pays it', 'the club pays it', 'pay by card', 'credit card', 'card fee'],
          answer: (
            <p>Before an invoice exists, it follows your choice on the <strong>Processing fee on sponsorships</strong> row of the <strong>Payouts</strong> card: <strong>The sponsor pays it</strong> or <strong>The club pays it</strong>, and the club pays it unless you change it. On an invoice already issued the club pays it, and the invoice never gains a fee line.</p>
          ),
        },
      ],
    },
    {
      id: 'public-org-page',
      heading: 'Your public organization page — what visitors see',
      summary: 'Your pages are your club’s own site: your bar with your name and tabs, your colours, one footer with your contact, and a shortcut back to admin for your own staff.',
      keywords: [
        'public organization page', 'public page', 'org page', 'club site', 'what visitors see', 'section tabs',
        'tabs', 'navigation', 'home house league tournaments', 'sections', 'club bar', 'header',
        'tournaments tab', 'tournaments page', 'past tournaments', 'current and upcoming', 'archive', 'archived tournament', 'hide tournaments',
        'sign in', 'account', 'phone navigation', 'mobile navigation', 'bottom bar', 'discover', 'pricing',
        'footer', 'contact email', 'copy email', 'social links', 'built on fieldlogichq', 'colours', 'colors',
        'light colour', 'readable', 'event card colour', 'event card color',
        'return to admin from public page', 'admin shortcut', 'coaches portal shortcut', 'flip', 'account menu', 'go to', 'account sheet', 'person icon on a phone', 'sign out', 'my team', 'my teams', 'house league coach',
        'page not found', 'couldn’t find that page', 'broken link', 'old link', 'qr code', 'short address', 'site isn’t available',
        'home page', 'open now', 'teams tab', 'teams page', 'team page', 'about us', 'follow', 'tournament status',
        'live now', 'this weekend', 'finished', 'see all teams', 'team schedule', 'earlier this season', 'banner photo',
        'tryouts page', 'tryouts tab', 'tryout days', 'not open yet', 'tryouts open', 'link preview', 'share card', 'shared link', 'google', 'search engines',
        'about page', 'contacts and documents', 'club notice', 'section order', 'hide a section',
        'born', 'born in', 'birth year', 'birth years', 'age', 'age group', 'birthday', 'cut-off', 'what year was my child born',
        'coaches on the team page', 'coach names public', 'questions about these tryouts', 'email the head coach', 'tryout questions address',
      ],
      searchText: 'public organization page club site what families see visitors see fans see your own site your bar logo initials club name tagline sign in account section tabs tab row home teams house league tournaments only the sections you have tournaments tab tournaments page current and upcoming past tournaments finished tournament not archived opens its own site archived tournament archive page old past tournaments address forwards teams tab teams page every team not archived club groups other teams tryouts open chip home page order open now registration open tryouts teams grid house league tournaments about the club follow button registration open this weekend live now finished banner strip computer only team page back to teams division season dot tryout details and sign-up isn’t taking tryout sign-ups right now schedule public link earlier this season up next directions cancelled show the rest of the season about the team see all teams no tab row with only a home page tabs in the bar on a computer white row under the bar on a phone club name links back to the front page no discover no pricing no breadcrumb no fieldlogichq bottom bar on a phone tournament pages keep the bottom bar light page your colours readable automatically light colour dark text yellow gold sky darker links footer questions email the club copy the address copied social links instagram facebook x website built on fieldlogichq credit paid plans event cards club colours tournament cards account menu sign out stays on your page return to admin from my public page shortcut back admin coaches portal flip door go to block account sheet person icon on a phone only your own staff staff of another club family never sees it remembers the screen i left page not found we couldn’t find that page couldnt find mistyped team old link broken link short address teams schedule standings results register news rules forwards to the running tournament printed link qr code no tournament running this club’s site isn’t available site switched off tryouts page tryouts tab third tab 2027 tryouts rep and select teams for the season banded by your groups date range tryout days public tryout days families can see tryout days dates venue field directions sign up for tryouts not open yet finished tryouts closed the club’s last tryouts finished no tryouts are posted right now link preview share card shared link card in your colours logo initials never a player text message social media search engines google find your teams page about page contacts and documents footer link club notice top of every page section order you choose hidden section no tab born 2012–2013 born in any year pick a year narrows the list places for a player born in birth years age group which team can my child play for cut-off sep 1 born before born on or after born 2012 or later born 2008 or earlier house league division born from the club note on the tryout page coaches section on the team page name and role only coach switched their name on questions about the team email the club at questions about these tryouts email the head coach head coach address copy footer keeps the club’s address',
      content: (
        <>
          <p>Your organization&rsquo;s public address — <code>fieldlogichq.ca/your-slug/</code> — is where families land from a search, a shared link, or your own website. Every club page there (your home, a team, a tryout and its sign-up, your house league, your tournaments) is your club&rsquo;s own site: your bar at the top, your colours on a light page, and one footer at the bottom.</p>
        </>
      ),
      subtopics: [
        {
          id: 'public-org-page-sections',
          title: 'Your bar and your tabs',
          content: (
            <>
              <p>The bar at the top of every club page carries your logo (or your initials, if you haven&rsquo;t added one), your club&rsquo;s name and your one-line tagline. Your name links back to your home page from anywhere on your site.</p>
              <p>Your tabs sit beside your name on a computer and in a white row under the bar on a phone. A visitor sees only the sections you have:</p>
              <ul>
                <li><strong>Home</strong></li>
                <li><strong>Teams</strong>, when your plan includes rep teams and you have a team that isn&rsquo;t archived</li>
                <li><strong>Tryouts</strong>, while any team has tryouts open, not open yet, or finished in the last four weeks. It leaves by itself after that; the address keeps working all year.</li>
                <li><strong>House league</strong>, once a season is published</li>
                <li><strong>Tournaments</strong>, while you have a tournament running or coming, or a past one to list, and you haven&rsquo;t hidden it</li>
              </ul>
              <p>The tabs follow the order you choose for your home page&rsquo;s sections in <strong>Public site</strong>, and a section you hide there has no tab. With only a home page, there is no tab row. Your pages advertise nothing of ours: no Discover, no Pricing.</p>
            </>
          ),
        },
        {
          id: 'public-org-page-app-access',
          title: 'Signing in from your pages',
          content: (
            <>
              <p><strong>Sign in</strong> sits at the right of your bar on every club page, on a phone and on a computer. Once a visitor is signed in it reads <strong>Account</strong>, and opens their account menu right where they are: notification settings, feedback, account settings and <strong>Sign out</strong>. Signing out leaves them on your page.</p>
              <p>Your club pages don&rsquo;t carry the FieldLogicHQ bar at the bottom of a phone: the screen is yours. Your tournament pages keep it, as before.</p>
            </>
          ),
        },
        {
          id: 'public-org-page-footer',
          title: 'Your footer and your colours',
          content: (
            <>
              <p>The same footer closes every club page: your club&rsquo;s name, <strong>Questions? Email the club</strong> with your contact address and a <strong>Copy</strong> button (an email link does nothing on some phones), your social links, a <strong>Contacts and documents</strong> link to your About page once you have added a contact, a document or a question, and on a paid plan a quiet <strong>Built on FieldLogicHQ</strong>. A part you haven&rsquo;t filled in is left out. You set them all in <strong>Public site</strong>.</p>
              <p>Your bar, footer and buttons wear your main colour, and the page keeps it readable for you. A light colour, like a yellow, gets dark text, and your links and outlines are darkened just enough to read on the light page.</p>
            </>
          ),
        },
        {
          id: 'public-org-page-home',
          title: 'Your home page',
          content: (
            <>
              <p>Your home page shows only what your club has, in the order you choose in <strong>Public site</strong> (this is the order it starts in). <strong>Open now</strong> is always first.</p>
              <ol>
                <li><strong>Open now</strong>: every house-league season taking registrations and the tryouts. With one team open or not open yet for tryouts, that team has its own row, with its days (&ldquo;Three days from Sun, Nov 2 &middot; Lakeshore Dome&rdquo;). With two or more, they share one row, <strong>2027 tryouts</strong> (&ldquo;7 teams &middot; Rep Sep 7&ndash;9 &middot; Select Sep 11&ndash;13&rdquo;), that opens your Tryouts page. When nothing is open, the section isn&rsquo;t there.</li>
                <li><strong>Teams</strong>: your teams, under the groups you give them in <strong>Rep teams</strong>. A team taking tryout sign-ups shows <strong>Tryouts open</strong>.</li>
                <li><strong>House league</strong>, when you run one.</li>
                <li><strong>Tournaments</strong>, when you host one (see below).</li>
                <li><strong>About us</strong>: the about text you write in Public site, a link to your About page once it has contacts, documents or questions, and a <strong>Follow</strong> button when your club is listed in Discover. On a computer it sits beside the other sections.</li>
              </ol>
              <p>Any section but Open now can be hidden in Public site. A club notice, when you post one, sits at the top of every page. Your contact address and social links are in the footer. On a computer, your banner photo shows as a strip under your bar; a phone leaves it out.</p>
            </>
          ),
        },
        {
          id: 'public-org-page-teams',
          title: 'Your Teams page and each team’s page',
          content: (
            <>
              <p>The <strong>Teams</strong> tab lists every team that isn&rsquo;t archived, under your groups (teams you haven&rsquo;t put in a group come last, under <strong>Other teams</strong>), and says which ones are taking tryout sign-ups. An archived team isn&rsquo;t listed, but its page still opens for old links.</p>
              <p>A team&rsquo;s page shows, from the top:</p>
              <ul>
                <li><strong>&larr; Teams</strong>, then the team&rsquo;s name with its colour as a dot, and its division and season.</li>
                <li>Its tryouts, in a quiet block with the same days line your home page shows: <strong>Tryout details and sign-up</strong> while sign-ups are open, otherwise a sentence for where the tryout stands (see <strong>Your Tryouts page</strong>), with your contact address.</li>
                <li>Its games and tournaments, only when the coach has set the schedule to <strong>Public</strong>. Practices and team events never show here. Games already played fold into <strong>Earlier this season</strong>, the next event is marked <strong>Up next</strong> with a <strong>Directions</strong> button, a cancelled event stays crossed out, and <strong>Show the rest of the season</strong> opens the rest.</li>
                <li><strong>About the team</strong>, the description you write on the team.</li>
                <li><strong>Coaches</strong>, only when a coach has switched their own name on in their Team settings: each name over their role, such as <em>Head coach</em>, and nothing else, never an email, a phone or a player. It shows only while the team has a live season, and with it, <em>Questions about the team? Email the club at</em> your contact address, if you have one.</li>
              </ul>
            </>
          ),
        },
        {
          id: 'public-org-page-tryouts',
          title: 'Your Tryouts page, and the days families see',
          content: (
            <>
              <p>Your Tryouts page, at <code>fieldlogichq.ca/your-slug/tryouts</code>, lists every team with a tryout. It is titled <strong>2027 tryouts</strong> (the year, when every listed team recruits for the same season; otherwise just <strong>Tryouts</strong>), with a line like &ldquo;Rep and Select teams for the 2027 season&rdquo;. Teams sit under your own team groups, each with its date range (&ldquo;Rep &middot; Sep 7&ndash;9&rdquo;). Each row gives the team, its first remaining day and venue, and a state chip.</p>
              <p>The chip comes from one rule:</p>
              <ul>
                <li><strong>Tryouts open</strong>: the coach&rsquo;s sign-up switch is on. It wins even after every day has passed, until the coach turns it off.</li>
                <li><strong>Not open yet</strong>: sign-ups are off and a tryout day is still ahead.</li>
                <li><strong>Finished</strong>: sign-ups are off and every day has passed (from the next day).</li>
                <li><strong>Tryouts closed</strong>: sign-ups are off and the team has no days, or every day is cancelled.</li>
              </ul>
              <p>A <strong>Tryouts</strong> tab sits third (Home &middot; Teams &middot; Tryouts &middot; House league &middot; Tournaments) while any team is open, not open yet, or finished in the last four weeks, and leaves by itself after that. The address keeps working all year. Out of season it says &ldquo;The club&rsquo;s last tryouts finished on Sun, Sep 13, 2026.&rdquo; or &ldquo;No tryouts are posted right now.&rdquo;, with your contact address.</p>
              <p>Each team&rsquo;s tryout page lists <strong>Tryout days</strong>: every remaining day the coach entered in the tryout setup, with its date, its time (&ldquo;9:00&ndash;11:00 a.m.&rdquo;), the venue and field (&ldquo;Lakeshore Dome &middot; Diamond 2&rdquo;), and a <strong>Directions</strong> button (just the arrow on a phone). A cancelled day is left out. The button reads <strong>Sign up for tryouts</strong>. A team that isn&rsquo;t open shows its sentence instead (&ldquo;Sign-ups for 15U AA tryouts aren&rsquo;t open yet.&rdquo;, &ldquo;Tryouts for the 2027 season finished on Mon, Sep 7.&rdquo;, &ldquo;13U AAA isn&rsquo;t taking tryout sign-ups right now.&rdquo;), and your contact address with <strong>Copy</strong>. The team&rsquo;s name at the top of the page goes back to the team.</p>
              <p>Under the button, an open or not-yet-open tryout reads <strong>Questions about these tryouts? Email the head coach</strong> (with the coach&rsquo;s name in place of &ldquo;the head coach&rdquo; when they have switched their name on), with the address and <strong>Copy</strong>, when the team&rsquo;s head coach has set their own address for families&rsquo; questions. Otherwise, and once a tryout is finished or closed, it is <strong>Questions? Email the club</strong> with your address. Your footer and your Tryouts page always keep the club&rsquo;s address. You can put the club&rsquo;s back from the team&rsquo;s admin Tryouts page (see <strong>How to open tryouts and review applicants</strong>).</p>
              <p>Tryout days your coaches enter in a team&rsquo;s tryout setup are public on your site, shown as <strong>Not open yet</strong> before sign-ups open. A team&rsquo;s tryout page also shows its birth years (<em>For the 2027 season &middot; Born 2012&ndash;2013</em>) and the note you write under <strong>From the club</strong> on the team&rsquo;s admin Tryouts page, above <strong>Sign up for tryouts</strong>, before and while sign-ups are open.</p>
            </>
          ),
        },
        {
          id: 'public-org-page-born',
          title: 'Birth years, and the Born in picker',
          content: (
            <>
              <p>Where you have entered birth years, families read them as a line such as <strong>Born 2012&ndash;2013</strong> on your Teams page, your Tryouts page, a team&rsquo;s tryout page and your house-league divisions. You enter them in <strong>Team details</strong> and in <strong>Add division</strong> and <strong>Edit division</strong>.</p>
              <ul>
                <li><strong>Other shapes</strong> &mdash; <em>Born 2012 or later</em> and <em>Born 2008 or earlier</em> when one box is empty. A team with neither box filled shows no line.</li>
                <li><strong>A cut-off other than January 1</strong> &mdash; the line carries dates instead, such as <em>Born Sep 1, 2013 &ndash; Aug 31, 2015</em>. The owner sets the date per sport in <strong>Settings &rsaquo; When birthdays count from</strong>.</li>
                <li><strong>Born in</strong> &mdash; on your Teams page and your Tryouts page a pill reads <em>Born in: any year</em>. Pick a year and the list narrows to the teams and divisions that fit a player born then, with a line such as <em>2 places for a player born in 2015</em>. A team with no birth years always stays in the list. The pick is in the page address, so a family can share the filtered list. The pill is only there when at least one listed team or division has birth years.</li>
              </ul>
            </>
          ),
        },
        {
          id: 'public-org-page-share',
          title: 'When your link is shared: the preview card',
          content: (
            <>
              <p>A link to your club, one of your teams, or a tryout shows a generated card wherever it is pasted (a text message, an email, social media). The card is in your club&rsquo;s colours with your logo, or your initials if you haven&rsquo;t added one. It never shows a player. A tryout&rsquo;s card carries its state, such as <strong>Tryouts open</strong>.</p>
              <p>A club whose public site is switched off shows a plain FieldLogicHQ card instead. Search engines find your Teams page, your teams and any open tryouts.</p>
            </>
          ),
        },
        {
          id: 'public-org-page-event-colours',
          title: 'Your tournaments: the home page and the Tournaments tab',
          content: (
            <>
              <p>Each tournament on your home page says where it stands: <strong>Registration open</strong>, <strong>This weekend</strong>, <strong>Live now</strong> (only while its dates include today) or <strong>Finished</strong>. A finished tournament stays on your home page for 30 days.</p>
              <p>The <strong>Tournaments</strong> tab opens a page with every tournament you host:</p>
              <ul>
                <li><strong>Current and upcoming</strong>: what is running and what is coming, soonest first, with the same status as your home page.</li>
                <li><strong>Past tournaments</strong>: finished tournaments first, each opening its own site; then tournaments you have sealed, each opening its permanent record. A tournament you archive without sealing takes its site offline and leaves the list.</li>
              </ul>
              <p><strong>Tournaments</strong> in <strong>Public site &rsaquo; Home page</strong> hides the home section, the tab and the page together; <strong>Past tournaments</strong> under it hides just the past list. The old Past tournaments address forwards to the page. On Tournament and Tournament Plus, which have no tabs, the page is at your address followed by <code>/tournaments</code>, and a sealed record links back to it.</p>
              <p>A tournament opens its own pages, which keep the tournament&rsquo;s branding.</p>
            </>
          ),
        },
        {
          id: 'public-org-page-not-found',
          title: 'When a family opens a page that isn’t there',
          content: (
            <>
              <p>A family who opens an address your organization doesn&rsquo;t have — a mistyped team name, an old link, a league page when you run no house league — sees <strong>We couldn&rsquo;t find that page</strong> inside your site, with your bar and footer and a button back to your home page. An old team address also offers <strong>See all teams</strong> when you have a Teams page.</p>
              <p>The short addresses <code>/schedule</code>, <code>/standings</code>, <code>/results</code>, <code>/register</code>, <code>/news</code> and <code>/rules</code> open the same page of your running tournament, so printed links and QR codes keep working. With no tournament running, they show <em>We couldn&rsquo;t find that page</em> too. <code>/teams</code> is your Teams page when you have one; otherwise it works like the others.</p>
              <p>While your public site is switched off in <strong>Public site &rsaquo; Visibility</strong>, every club page shows <strong>This club&rsquo;s site isn&rsquo;t available</strong> instead, without your bar or colours, and a shared link shows a plain FieldLogicHQ card. Your tournament pages stay up.</p>
            </>
          ),
        },
        {
          id: 'public-org-page-admin-shortcut',
          title: 'Your shortcut back to admin',
          content: (
            <>
              <p>If you help run this club and you are signed in, an icon sits at the far right of your bar, after the person icon. Point at it to see where it goes. It takes you back to your admin area or Coaches Portal in the same tab, to the exact screen you came from. If you hold more than one role here, it opens a short list so you can pick. Families, signed-out visitors and staff of other clubs never see it.</p>
              <p>On a phone in a browser that icon is not in the bar. Tap the person icon instead: the sheet that opens starts with a <strong>Go to</strong> block that names the same places, and the same exact-screen return applies.</p>
              <p>A house league coach gets <strong>My team</strong> at the top right instead, which opens their team page. On a phone it is a row in the person icon&rsquo;s sheet. A coach who also runs the club gets both.</p>
            </>
          ),
        },
      ],
      faqs: [
        {
          id: 'faq-public-page-no-teams-tab',
          question: 'Why is there no Teams tab on my public page?',
          answerText: 'The Teams tab shows when your plan includes rep teams and you have at least one team that is not archived. It opens your Teams page, which lists every team that is not archived under your groups and says which are taking tryout sign-ups. If every team is archived, there is no list to show, so there is no tab; the archived teams\' pages still open for old links. Your home page lists your teams too, and an open tryout appears under Open now.',
          keywords: ['teams tab', 'no teams tab', 'rep teams missing', 'teams section', 'teams page', 'tryouts link', 'tryouts open', 'team page link', 'archived teams', 'tryouts tab', 'tryouts page'],
          answer: (
            <>
              <p>The <strong>Teams</strong> tab shows when your plan includes rep teams and you have at least one team that isn&rsquo;t archived. It opens your Teams page, which lists every team that isn&rsquo;t archived under your groups and says which are taking tryout sign-ups.</p>
              <p>If every team is archived, there is no list to show, so there is no tab. The archived teams&rsquo; pages still open for old links.</p>
              <p>Your home page lists your teams too, and an open tryout appears under <strong>Open now</strong>.</p>
            </>
          ),
        },
        {
          id: 'faq-public-page-tryouts-tab',
          question: 'Why is there no Tryouts tab on my public page, and can families still find tryouts?',
          answerText: 'The Tryouts tab shows only while a team has tryouts open, not open yet, or finished in the last four weeks, and leaves by itself after that. The tryouts page at your club address followed by /tryouts keeps working all year: out of season it says when the club’s last tryouts finished, or that no tryouts are posted right now, with your contact. The tryout days a coach enters are public on your site.',
          keywords: ['tryouts tab', 'no tryouts tab', 'tryouts page', 'tryout days', 'tryouts not showing', 'not open yet', 'tryouts missing'],
          answer: (
            <>
              <p>The <strong>Tryouts</strong> tab shows only while a team has tryouts open, not open yet, or finished in the last four weeks, and leaves by itself after that.</p>
              <p>The Tryouts page at your club address followed by <code>/tryouts</code> keeps working all year. Out of season it says when the club&rsquo;s last tryouts finished, or that no tryouts are posted right now, with your contact address.</p>
              <p>The tryout days a coach enters are public on your site.</p>
            </>
          ),
        },
        {
          id: 'faq-public-page-tabs-missing',
          question: 'I have a house league and tournaments but I don&rsquo;t see the tabs — why?',
          answerText: 'The tabs come with League and Club plans. On Tournament and Tournament Plus your bar carries your name, which links back to your home page, and no tabs. The row also needs at least two sections to show at all: if your home page is the only public section you have, there is nowhere to go and the row stays hidden.',
          keywords: ['tabs missing', 'no section tabs', 'tab row not showing', 'league club only', 'why no tabs'],
          answer: (
            <>
              <p>Two reasons, and one of them may be your plan. The tabs come with <strong>League and Club</strong>; on Tournament and Tournament Plus your bar carries your name, which links back to your home page, and no tabs.</p>
              <p>The row also needs <strong>at least two sections</strong> to appear at all. If your home page is the only public section you have, there is nowhere to go, so the row stays hidden rather than showing a single tab.</p>
            </>
          ),
        },
      ],
    },
  ],
};

export default orgHelp;
