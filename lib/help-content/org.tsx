/* eslint-disable react/no-unescaped-entities */
import type { HelpPageContent } from './index';
import { HelpDefs, HelpDef, HelpSteps, HelpNote } from '@/components/help/HelpBlocks';

const orgHelp: HelpPageContent = {
  title: 'Org admin & setup',
  role: 'Owner, Admin',
  intro: 'This guide covers your organization\'s setup — who can do what, how to invite members, and how to manage your org settings.',
  sections: [
    {
      heading: 'Your first 30 days',
      content: (
        <>
          <p>Getting FieldLogicHQ running for your org is a quick process. Work through these steps in order:</p>
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
      summary: 'Five steps to get a new club ready for its first season, tracked on one checklist.',
      keywords: ['set up club', 'club setup', 'setup checklist', 'get ready for the season', 'staff your board', 'add your teams', 'head coach', 'public site', 'budget', 'families', 'club checklist', 'new club', 'club onboarding', 'invite a coach'],
      searchText: 'set up your club setup checklist get club ready for the season five steps staff your board invite admin treasurer add your teams season head coach every team invite a coach first team without one coaches page premium coaches portal put your club online tagline contact email public page plan the club budget what the season costs come back from overview families not a step household appears automatically house league tournaments one line shortcuts no founding season offer club already includes',
      content: (
        <>
          <p>When you sign in as a Club owner for the first time, you land on a five-step checklist instead of the admin panel — <strong>Set up your club</strong>. Each step opens the screen that does the job, and a step is marked done only once it genuinely is.</p>
          <ol>
            <li><strong>Staff your board.</strong> Invite an admin and a treasurer so the work isn&rsquo;t all yours.</li>
            <li><strong>Add your teams.</strong> Each team, and the season it&rsquo;s playing.</li>
            <li><strong>Name a head coach for every team.</strong> Each coach gets the Premium Coaches Portal, included in your plan. <strong>Invite a coach</strong> opens the first team still without one — its Coaches page, where you enter their email.</li>
            <li><strong>Put your club online.</strong> Add a tagline and a contact email to your public page.</li>
            <li><strong>Plan the club&rsquo;s budget.</strong> What the season costs, and what each team contributes.</li>
          </ol>
          <p><strong>Families</strong> is shown too, but it isn&rsquo;t a step you complete — as rosters fill, every household appears there on its own. If your club also runs a house league or hosts a tournament, those are one-line shortcuts on the checklist rather than steps, since not every club runs either.</p>
          <p>You can leave and come back — <strong>Overview</strong> keeps a link back to this checklist until every step is done. There&rsquo;s no Founding Season offer here: that offer is for standalone teams and Tournament Plus organizers, and Club already includes everything a rep team needs.</p>
        </>
      ),
    },
    {
      id: 'roles',
      heading: 'Roles explained — who can do what',
      summary: 'What each role can open, at a glance, then Owner, Admin, Treasurer, Staff, League admin, League registrar, Coach, and Volunteer one by one.',
      keywords: ['roles', 'permissions', 'owner', 'admin', 'staff', 'treasurer', 'league admin', 'registrar', 'team manager', 'coach', 'volunteer', 'scorekeeper', 'gate', 'helping with', 'what each role can open', 'role guide', 'plan & billing', 'billing', 'audit log', 'families', 'who can finalize scores', 'change a final score'],
      searchText: 'roles permissions who can do what owner admin staff treasurer league admin league registrar rep club no registrar team manager forms documents coach scorekeeper capabilities grant revoke org settings plan and billing subscription owner only what each role can open role guide table rep teams accounting public site house league tournaments families members audit log locked owner only rows volunteer helping with scoring the gate both field scores check-in',
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
                  <tr><th scope="row">Public site</th><td>✓</td><td>✓</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td></tr>
                  <tr><th scope="row">House league · Tournaments</th><td>✓</td><td>✓</td><td>—</td><td>game day</td><td>the house league</td><td>registrations, fees &amp; Email families</td><td>scores &amp; gate</td><td>—</td></tr>
                  <tr><th scope="row">Families</th><td>✓</td><td>if you turn it on</td><td>if you turn it on</td><td>—</td><td>if you turn it on</td><td>if you turn it on</td><td>—</td><td>—</td></tr>
                  <tr><th scope="row">Members</th><td>✓</td><td>✓</td><td>view</td><td>—</td><td>view</td><td>—</td><td>—</td><td>—</td></tr>
                  <tr><th scope="row">Plan &amp; billing · Settings · Audit log</th><td>✓</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td></tr>
                </tbody>
              </table>
              <p><strong>✓</strong> is full access; a shorter answer is the exact slice that role gets — &ldquo;view&rdquo; opens a program read-only, and &ldquo;if you turn it on&rdquo; means the owner has to grant it by hand (Families is never on by default for anyone but the owner, and it can&rsquo;t be given to a member limited to some Rep teams groups: a family&rsquo;s record spans every team its children play on). A row only appears on your own organization once your plan includes that program.</p>
              <p><strong>Admin</strong> opens every program the plan carries — the moment it&rsquo;s included, with no separate setup step. It never opens <strong>Families</strong> on its own, and <strong>Plan &amp; billing</strong>, <strong>Settings</strong> and the <strong>audit log</strong> stay owner-only. The menu lists only what you can open, so an admin won&rsquo;t find them there; the club&rsquo;s home page shows <strong>Plan &amp; billing</strong> and <strong>Settings</strong> under <strong>Organization</strong> marked <strong>Owner only</strong>, so it&rsquo;s clear they exist and whose they are. An admin can still change the club&rsquo;s logo, colours, type and banner in <strong>Public site</strong>; only the owner turns the site on or off.</p>
            </>
          ),
        },
        {
          id: 'roles-t-roles',
          title: 'The roles, one by one',
          content: (
            <>
              <ul>
                <li><strong>Owner</strong> — Full access, plus the two things nobody else can hold: <strong>Plan &amp; billing</strong> and <strong>Settings</strong>. Assigned at org creation; ownership can&rsquo;t be transferred through the admin panel.</li>
                <li><strong>Admin</strong> — Runs operations: every program the plan carries, members, and the public site&rsquo;s look (logo, colours, type and banner, in <strong>Public site</strong>). Cannot turn the public site on or off, and cannot open <strong>Settings</strong>, <strong>Plan &amp; billing</strong>, or the <strong>audit log</strong> — those stay owner-only — and doesn&rsquo;t see <strong>Families</strong> unless the owner turns it on for them.</li>
                <li><strong>Treasurer</strong> — Runs the books: ledgers, the budget, what the club bills its teams, and the teams’ payment requests. Can see the team names money is allocated to, without a Rep teams door of their own.</li>
                <li><strong>Staff</strong> — Day-of operator. Updates game times and venue assignments, submits scores, and posts announcements. Cannot finalize scores or change a result that&rsquo;s already final, create tournaments, manage registrations, or send communications.</li>
                <li><strong>League admin</strong> — Runs the house league: seasons, registrations, fees, teams, schedules, and Email families. Can view the member list.</li>
                <li><strong>League registrar</strong> — Works house league registrations (approve, decline, withdraw, add by hand), marks fees received, and uses Email families. Reads the rest of a season but cannot change seasons, teams or schedules, or see the member list.</li>
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
          answerText: 'If you are an owner or admin who also coaches, the admin area shows a Coaches Portal door (in the desktop sidebar and, on mobile, under More → You) that opens your coach view. From inside your coaches portal, an Admin link returns you to the admin area. On mobile, the admin More menu also has a You section with Account, Home, and the Coaches Portal, so you can reach your own account without leaving admin. On a computer, Sign out and Send feedback are in the account menu (the person icon, top right), not the sidebar; on a phone they are at the foot of More, below Help. A member with only the Coach role still cannot open the admin panel.',
          keywords: ['coaches portal door', 'admin link', 'back to admin', 'coach view', 'switch admin coach', 'both admin and coach', 'run tournament and coach', 'account from admin', 'sign out', 'where is sign out', 'log out', 'send feedback', 'help on phone', 'account menu', 'admin sidebar foot'],
          answer: (
            <>
              <p>If you&rsquo;re an <strong>owner</strong> or <strong>admin</strong> who also coaches, the admin area shows a <strong>Coaches Portal</strong> door (in the desktop sidebar footer, and on mobile under <strong>More → You</strong>) that opens your coach view. From inside your coaches portal, an <strong>Admin</strong> link brings you back.</p>
              <p>On mobile, that same admin <strong>More</strong> menu has a <strong>You</strong> section with <strong>Account</strong>, <strong>Home</strong>, and the <strong>Coaches Portal</strong>, so you can reach your own account without leaving admin. On a computer, <strong>Sign out</strong> and <strong>Send feedback</strong> are in your <strong>account menu</strong> (the person icon, top right), not the sidebar; on a phone they sit at the foot of <strong>More</strong>, below <strong>Help</strong>. A member with <em>only</em> the Coach role still can&rsquo;t open the admin panel — these doors appear only when the same account holds both.</p>
            </>
          ),
        },
      ],
    },
    {
      id: 'recipe-invite-member',
      group: 'How-to recipes',
      heading: 'How to invite a member and choose the right role',
      summary: 'Add a new admin, treasurer, staff member, registrar, or volunteer without over-granting access.',
      keywords: ['invite member', 'role', 'permissions', 'staff', 'admin', 'treasurer', 'registrar', 'coach', 'volunteer', 'scorekeeper', 'helping with', 'change a volunteer’s job', 'accept invitation', 'email link', 'runs the club', 'house league group', 'volunteers group', 'another organization', 'coach staff page'],
      searchText: 'invite member choose role permissions owner admin staff treasurer league admin league registrar coach scorekeeper resend pending invite seats invited person signed up created their own organization by mistake wrong organization sign-up recognizes email me my invitation link accept invitation setup link grouped role list runs the club house league volunteers sentence under the field already a member at another club verified network one home organization coaches added on the team staff page invitation names who sent it lands where role starts volunteer helping with scoring the gate both change it any time in members manage at least one job lands on field scores or check-in one home organization',
      links: [
        { label: 'Members', href: '../org/members' },
      ],
      content: (
        <>
          <p>Use this when someone needs to help run the club or organization, a tournament, house league, rep teams, accounting, or score entry.</p>
          <ol>
            <li>Go to <strong>Members</strong>.</li>
            <li>Click <strong>Invite</strong>.</li>
            <li>Enter the person&rsquo;s email address.</li>
            <li>Choose their role from the one dropdown, grouped as <strong>Runs the club</strong> (or organization), <strong>House league</strong> (shown once your club runs one), and <strong>Volunteers</strong>. A sentence under the field says exactly what that role opens before you send the invite.</li>
            <li>For a volunteer (Tournament Plus and above; the free Tournament plan has no volunteer role), choose what they&rsquo;re <strong>Helping with</strong>: <strong>Scoring</strong>, <strong>The gate</strong>, or <strong>Both</strong>. The line under it says what they&rsquo;ll be able to do, and they&rsquo;ll land straight on that job. You can change it later in <strong>Manage</strong>.</li>
            <li>Send the invite, then confirm the person appears as <strong>Invited</strong> until they accept.</li>
          </ol>
          <p><strong>Coaches aren&rsquo;t invited from here.</strong> A team&rsquo;s head coach adds and removes their own coaching staff on that team&rsquo;s own staff page — coaching rows never appear in this dropdown.</p>
          <p><strong>Someone already active at another club or organization can accept your invite too</strong> — the same person can hold roles at more than one, and accepting yours doesn&rsquo;t remove them from anywhere else. The one exception is a volunteer, who keeps a single home organization.</p>
          <p><strong>Invited members don&rsquo;t get a password</strong> — the email has a setup link they must click to finish creating their account; clicking &ldquo;log in&rdquo; first shows an incorrect-email-or-password error, so ask them to check spam and use the resend option on their pending row if it&rsquo;s missing. If they sign up on their own instead, FieldLogicHQ recognizes their email and offers to email them the invitation link, so they land in your organization rather than starting a new one.</p>
          <p><strong>Access rule of thumb:</strong> owners hold Plan &amp; billing and Settings, admins run every program the plan carries, staff and volunteers handle day-of work, and each accepted invite names who sent it and opens straight to where that role&rsquo;s work starts — a treasurer in Accounting, a league role in the house league, a volunteer on their job (Field scores or Check-in), everyone else at the admin overview.</p>
        </>
      ),
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
      keywords: ['member cannot access', 'missing page', 'permission', 'suspended', 'pending invite', 'module access', 'what they can open', 'chip', 'role default', 'turn on', 'turn off', 'one save', 'coach staff page', 'volunteer no access', 'volunteer cannot score', 'helping with'],
      searchText: 'member cannot access missing page locked button permission role capability suspended pending invite resend module not enabled plan and billing subscription seat limit what they can open chip role default turn on turn off consequence sentence one save emailed what changed suspend confirm remove confirm coaching staff staff page',
      links: [
        { label: 'Members', href: '../org/members' },
        { label: 'Plan & billing', href: '../org/billing' },
      ],
      content: (
        <>
          <p>When someone says they can&rsquo;t see a page or action, start with the Members list itself:</p>
          <ol>
            <li><strong>Read &ldquo;What they can open&rdquo; on their row first.</strong> It&rsquo;s computed from their role plus any per-program change, with a chip for anything different from their role&rsquo;s default (for example &ldquo;+ Families&rdquo; or &ldquo;– Accounting&rdquo;) — the answer is usually right there.</li>
            <li><strong>Confirm they accepted the invite.</strong> Invited members can&rsquo;t use the admin panel until they accept. Resend from inside <strong>Manage</strong>.</li>
            <li><strong>Check whether they&rsquo;re suspended.</strong> A suspended row stays listed but can&rsquo;t sign in until you reinstate them. <strong>Suspend</strong> asks you to confirm first; <strong>Reinstate</strong> takes effect straight away.</li>
            <li><strong>Open Manage and look at &ldquo;What [name] can open.&rdquo;</strong> Each program starts the way the role has it, and you set it <strong>On</strong> or <strong>Off</strong> for this person. A row set differently from the role says <strong>Changed for</strong> them under its name, and a sentence appears under it the moment your change would open or close it for them. For a volunteer, Manage shows <strong>Helping with</strong> instead: a volunteer who meets &ldquo;No access&rdquo; on Field scores or Check-in doesn&rsquo;t hold that job yet.</li>
            <li><strong>Check the plan carries the module at all.</strong> A member can&rsquo;t open Rep teams, Accounting, Public site, or House league if the plan doesn&rsquo;t include it — see <strong>Plan &amp; billing</strong>.</li>
            <li><strong>Check seat limits.</strong> At the plan&rsquo;s seat limit, a new admin or staff member may need an upgrade before they can be added; volunteers and coaching staff never count toward it.</li>
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
            <li>Go to <strong>Organization &gt; Plan &amp; billing</strong> (the owner&rsquo;s page).</li>
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
      keywords: ['sidebar', 'collapse sidebar', 'collapse', 'expand sidebar', 'expand', 'icons', 'icon strip', 'strip', 'more room', 'more space', 'hide the sidebar', 'smaller sidebar', 'narrow sidebar', 'laptop', 'wider page', 'program menu', 'phone tabs', 'phone bar', 'bottom bar', 'calendar on phone', 'shortcut tiles', 'tiles in more', 'where is house league on my phone', 'where is families on my phone', 'where is schedules on my phone'],
      searchText: 'collapse the sidebar fold the sidebar shrink the sidebar hide the sidebar make the sidebar smaller narrow strip of icons icon strip more room more space for the page laptop small screen schedules grid wider expand sidebar open the sidebar again get the sidebar back last row of the sidebar point at an icon to see its name tab to an icon name count on the corner of the icon waiting count help dot new release program menu rep teams families organization house league season pages one page program goes straight there remembered on this computer this browser every portal coaches portal tournaments never collapses by itself phone tablet bottom bar unchanged more menu on a phone programs club overview help on phone sidebar foot phone tabs phone bar overview calendar rep teams accounting more shortcut tiles schedules house league families tiles at the top of more calendar on phone where is house league on my phone where is families on my phone where is schedules on my phone no tiles',
      content: (
        <>
          <p>On a computer you can fold the sidebar down to a narrow strip of icons. The page beside it gets the room, which helps on a laptop and on wide screens like <strong>Schedules</strong>.</p>
          <HelpSteps>
            <li>Click <strong>Collapse sidebar</strong>, the last row of the sidebar.</li>
            <li>To open it again, click the icon at the bottom of the strip, <strong>Expand sidebar</strong>.</li>
          </HelpSteps>
          <HelpDefs>
            <HelpDef term="Names">Point at an icon, or tab to it, to see its name.</HelpDef>
            <HelpDef term="Counts">A waiting count sits on the corner of its icon, and <strong>Help</strong> keeps its new-release dot.</HelpDef>
            <HelpDef term="Programs">A program with several pages (Rep teams, Families, Organization, and House league while you&rsquo;re inside a season) opens a small menu of its pages. A program with one page goes straight to it.</HelpDef>
          </HelpDefs>
          <HelpNote variant="info" title="Remembered on this computer">Your choice is kept in this browser for every part of FieldLogicHQ you use there: the club admin, your tournaments and the Coaches Portal. Nothing collapses by itself. Phones and tablets held upright don&rsquo;t change; they use the bar at the bottom.</HelpNote>
          <HelpNote variant="info" title="On a phone">The bar at the bottom reads <strong>Overview</strong>, <strong>Calendar</strong>, <strong>Rep teams</strong>, <strong>Accounting</strong> and <strong>More</strong>. A page you or your plan can&rsquo;t open is replaced by the next program your club runs. <strong>More</strong> opens with <strong>Notifications</strong>, then three shortcut tiles: <strong>Schedules</strong>, <strong>House league</strong> and <strong>Families</strong>. House league is a tile once your club runs a season; until then it&rsquo;s a quiet row under Programs. With fewer than three to show there are no tiles, and those pages stay rows in More.</HelpNote>
        </>
      ),
    },
    {
      id: 'club-plan-and-billing',
      heading: 'Club plan & billing',
      summary: 'Teams on your plan, Club’s two sizes, moving between them, adding a team at the cap, and what cancelling takes offline.',
      keywords: ['club plan', 'club billing', 'plan and billing', 'teams on your plan', 'club association', 'move to club association', 'team cap', 'add team at the cap', 'cancel club', 'reactivate club', 'capacity', 'free time', 'free through', 'free time ended'],
      searchText: 'free through free time from fieldlogichq a plan given for a while goes back automatically free time ended last 14 days amber nothing is charged club plan and billing teams on your plan capacity readout club two sizes club association move up prorated today move down at renewal no credit keep current band add team at the cap archive a team contact us custom plan what club includes families rep teams accounting public site house league tournaments unlimited board and staff cancel and suspend goes offline ninety days retention reactivate everything comes back public site online coach portals reopen archived tournaments return',
      links: [
        { label: 'Plan & billing', href: '../org/billing' },
      ],
      content: (
        <p>Plan &amp; billing for a Club shows how many teams you&rsquo;re using, both Club sizes with their prices, and what happens if you move up, move down, or cancel. If FieldLogicHQ has given your organization free time, it shows that too.</p>
      ),
      subtopics: [
        {
          id: 'club-plan-and-billing-t-free-time',
          title: 'Free time from FieldLogicHQ',
          content: (
            <>
              <p>Sometimes FieldLogicHQ gives an organization a plan for a while. Plan &amp; billing then shows a band reading <strong>Free through</strong> the last free day, and the plan card says the same instead of a price. Until that day your organization has that plan, with everything that comes with it.</p>
              <p>On the next day it goes back to your own plan automatically. Nothing is charged for the free time, nothing you made is deleted, and there is nothing to do. In the last 14 days the band turns amber and says how many days are left; if the plan is open for sign-up, you can choose it there to keep it.</p>
              <p>For 30 days after it ends, the band says <strong>Free time ended</strong>. Everything you made is kept, but tools that come only with the plan you were given stay closed until you choose it. While a Club plan is free, the page does not show Payment method, Move or Cancel, because there is nothing to pay.</p>
            </>
          ),
        },
        {
          id: 'club-plan-and-billing-t-teams',
          title: 'Teams on your plan',
          content: (
            <p>The plan card shows how many active teams you&rsquo;re using against your size&rsquo;s limit — archived teams don&rsquo;t count. The bar turns amber as you approach the limit, and once you&rsquo;re at it, the card names the size to move to.</p>
          ),
        },
        {
          id: 'club-plan-and-billing-t-sizes',
          title: 'Club’s two sizes, and moving between them',
          content: (
            <>
              <p>Club and Club · Association differ only in how many teams they hold and what they cost — every feature is identical between them. Each size lists both a monthly and a yearly price, and the size you&rsquo;re on is marked &ldquo;Your plan.&rdquo;</p>
              <p><strong>Moving up</strong> to Club · Association happens today, on your existing subscription — never a second checkout. Before you confirm, Stripe shows the exact amount due for the rest of this billing period and what you&rsquo;ll pay from your next renewal.</p>
              <p><strong>Moving down</strong> to Club takes effect at your next renewal, with no credit for the current period, and is refused while you&rsquo;re running more teams than Club holds — archive a team first, or stay where you are. A move waiting for renewal can be undone with &ldquo;Keep&rdquo; your current size, any time before then.</p>
              <p>More teams than the larger size holds? Contact us for a custom plan.</p>
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
          id: 'club-plan-and-billing-t-cancel',
          title: 'Cancelling, and reactivating',
          content: (
            <>
              <p>Cancelling suspends the club: Rep teams and every team&rsquo;s coach portal, Accounting, Families, the public site, house league and tournaments all go offline at once, and families who open your pages see that they aren&rsquo;t available. Everything is kept for <strong>90 days</strong>, and cancelling always asks you to confirm — and say why — before it happens.</p>
              <p>Reactivating brings everything back on day one: the public site goes back online, every team&rsquo;s coach portal reopens, archived tournaments return, and the retention reminders stop. If Club isn&rsquo;t yet open for self-serve purchase, the reactivate button reads &ldquo;Contact us to reactivate&rdquo; instead.</p>
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
        'get our data back', 'restore access', 'resubscribe', 're-subscribe', 'reactivate',
        'renew', 'renew subscription', 'start paying again',
        'past due', 'payment failed', 'card declined', 'card expired', 'failed payment',
        '90 days', 'retention', 'coaches portal not working', 'scorekeeper stopped',
      ],
      searchText: 'if your subscription ends cancel cancelled canceled subscription ended stop paying lost access locked out cannot log in nothing works did we lose our data is our data deleted nothing is deleted data kept 90 days retention resubscribe reactivate renew restore access plan and billing billing page past due payment failed card declined card expired failed payment keeps working grace retry coaches portal stops scorekeeper stops check-in stops family portal stops public tournament pages go offline tryout registration closes dues reminder emails stop free coaches portal unaffected personal teams basic coach keeps their own work everything comes back intact club plan and billing',
      links: [
        { label: 'Plan & billing', href: '../org/billing' },
      ],
      content: (
        <>
          <p><strong>Nothing is deleted.</strong> That is the part worth knowing first. If your subscription ends, your seasons, rosters, schedules, records and history are all kept, and they come back exactly as you left them when you subscribe again.</p>
          <p><strong>What stops.</strong> Access ends straight away, across everything: the Coaches Portal, tournament setup, scheduling and score entry, the scorekeeper and check-in apps, your public tournament pages, and the family-facing team pages and calendar feeds. Coaches and volunteers see a short note saying the subscription has ended and that nothing has been deleted — not an error, and not a page that half works.</p>
          <p>Two related things stop as well, so nobody is left wondering: <strong>tryout registration closes</strong> (a form that is no longer being watched should not keep collecting families&rsquo; details), and <strong>automated dues reminder emails stop going out</strong>.</p>
          <p><strong>Your Plan &amp; billing page keeps working — on purpose.</strong> It is the one place that stays open, because that is how you come back. An admin who opens the admin area lands there.</p>
          <p><strong>A missed payment is not the same as cancelling.</strong> If a card fails, your account is marked past due and <em>everything keeps working</em> while the payment is retried and you are told about it. Access only stops if the subscription is actually cancelled at the end of that.</p>
          <p><strong>A free Coaches Portal is not affected.</strong> Teams a coach set up on their own free portal belong to that person rather than to your organization, so there is no subscription involved and their own work stays exactly as it was.</p>
          <p>Running a Club? <strong>Club plan &amp; billing</strong> covers your two sizes, moving between them, and exactly what reactivating restores.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-subscription-ended-data',
          question: 'We cancelled — did we lose our data?',
          answerText: 'No. Nothing is deleted when a subscription ends. Your seasons, rosters, schedules, records and history are all kept, and they come back exactly as you left them when you subscribe again. Your account records are retained for 90 days after cancellation. Subscribe again within that window and everything is restored intact — there is nothing to re-enter and nothing to import.',
          keywords: ['did we lose our data', 'data deleted', 'is our data gone', 'lose everything', 'get data back', '90 days', 'retention', 'restore', 'cancelled data'],
          popular: true,
          answer: (
            <>
              <p><strong>No.</strong> Nothing is deleted when a subscription ends. Your seasons, rosters, schedules, records and history are all kept.</p>
              <p>Your account records are retained for <strong>90 days</strong> after cancellation. Subscribe again within that window and everything is restored exactly as you left it — there is nothing to re-enter and nothing to import.</p>
            </>
          ),
        },
        {
          id: 'faq-subscription-ended-access',
          question: 'Our coaches say the portal stopped working — why?',
          answerText: 'If your organization\'s subscription was cancelled, access stops immediately for everyone: the Coaches Portal, tournament tools, the scorekeeper and check-in apps, the family team pages, and your public tournament pages. Coaches and volunteers see a short note saying the subscription has ended and that nothing has been deleted. Check your Plan & billing page — an admin who opens the admin area is taken straight there. Subscribing again restores access for everyone at once. If instead a payment simply failed, the account is marked past due and everything keeps working while the payment is retried, so a portal that has genuinely stopped means a cancellation, not a declined card.',
          keywords: ['portal stopped working', 'coaches locked out', 'coaches cannot log in', 'scorekeeper stopped', 'check-in stopped', 'no access', 'nothing works', 'subscription has ended message', 'why did access stop'],
          popular: true,
          answer: (
            <>
              <p>If your organization&apos;s subscription was cancelled, <strong>access stops immediately for everyone</strong> — the Coaches Portal, tournament tools, the scorekeeper and check-in apps, the family team pages, and your public tournament pages. They see a short note saying the subscription has ended and that nothing has been deleted.</p>
              <p>Open <strong>Plan &amp; billing</strong> — an admin who opens the admin area is taken straight there. Subscribing again restores access for everyone at once.</p>
              <p>If a payment simply <em>failed</em>, that is different: the account is marked past due and everything keeps working while the payment is retried. So a portal that has genuinely stopped means a cancellation, not a declined card.</p>
            </>
          ),
        },
        {
          id: 'faq-subscription-restore',
          question: 'How do we get everything back?',
          answerText: 'Subscribe again from Plan & billing. That page keeps working even while access is stopped, precisely so you can come back. Everything is restored as you left it, and access returns for every coach, volunteer and family at once. Your records are kept for 90 days after cancellation.',
          keywords: ['get everything back', 'restore access', 'resubscribe', 're-subscribe', 'reactivate', 'renew', 'start again', 'come back', 'subscribe again'],
          answer: (
            <>
              <p>Subscribe again from <strong>Plan &amp; billing</strong>. That page keeps working even while access is stopped, precisely so you can come back.</p>
              <p>Everything is restored as you left it, and access returns for every coach, volunteer and family at once. Your records are kept for <strong>90 days</strong> after cancellation.</p>
            </>
          ),
        },
        {
          id: 'faq-plan-change-tournaments',
          question: 'We moved to a smaller plan — where did our tournaments go?',
          answerText: 'If your new plan includes fewer tournament slots than you have draft and active tournaments, the extra ones are archived rather than deleted. A tournament that is currently running is never the one archived — live events are kept — and a completed tournament holds no slot, so a plan change never archives it. Archived tournaments are retained and come back when you move up to a plan with room for them again.',
          keywords: ['tournaments disappeared', 'tournaments missing', 'tournament archived', 'downgrade', 'smaller plan', 'fewer tournaments', 'plan change tournaments', 'where did my tournament go'],
          answer: (
            <>
              <p>If your new plan includes fewer tournament slots than you have draft and active tournaments, the extra ones are <strong>archived rather than deleted</strong>, and a tournament that is <strong>currently running is never the one archived</strong> — live events are kept. A completed tournament holds no slot, so a plan change never archives it.</p>
              <p>Archived tournaments are retained and come back when you move up to a plan with room for them again.</p>
            </>
          ),
        },
      ],
    },
    {
      heading: 'Inviting and managing members',
      keywords: ['seat limit', 'staff seats', 'volunteers free', 'scorekeepers free', 'free plan no volunteers', 'officials free', 'do volunteers count', 'do scorekeepers count', 'invite member', 'manage member', 'resend invite', 'helping with', 'staff kit'],
      searchText: 'seat limit staff seats how many seats do volunteers scorekeepers count toward limit officials free seats free tournament 3 seats upgrade invite member manage role restrict tournaments helping with change a volunteer job resend pending invite export member list staff kit volunteer links qr codes',
      content: (
        <>
          <p>Go to <strong>Members</strong> and click <strong>Invite</strong>. Enter the person's email and pick their role. They'll receive an invitation email with a link to accept and set up their account.</p>
          <p>Once a member has accepted, click <strong>Manage</strong> on their row to:</p>
          <ul>
            <li>Change their role</li>
            <li>Restrict them to specific tournaments (useful for staff at multi-event orgs)</li>
            <li>Grant or revoke individual capabilities beyond their role defaults</li>
            <li>For a volunteer, change what they&rsquo;re <strong>Helping with</strong> (Scoring, The gate, or Both), which takes the place of the list of programs</li>
            <li>Suspend or reinstate their access</li>
          </ul>
          <p>To resend an invitation to someone who hasn't accepted yet, open <strong>Manage</strong> on their row and choose <strong>Resend invite</strong>. Someone who hasn&rsquo;t accepted yet shows as <strong>Invited</strong> on their row.</p>
          <p><strong>Volunteer links</strong> (Tournament Plus and above; the free Tournament plan has no Staff kit): each tournament&rsquo;s <strong>Staff kit</strong> holds a QR code and a link for each job, Scorekeeper and Gate, and prints them on one page for the volunteer table. To try the volunteers&rsquo; screens yourself, use <strong>Scorekeeper</strong> on Results &amp; scoring or <strong>Gate view</strong> on Check-in.</p>
          <p><strong>Seat limits:</strong> Your plan's seat limit counts admins and staff only — <strong>volunteers (Tournament Plus and above) never count toward it</strong>, so bring as many as your event needs. The free Tournament plan includes three seats (you and up to two staff) and has no volunteers: you and your staff enter the scores. If you're near the limit, a banner appears on the Members page with an upgrade link. Paid plans have unlimited staff seats.</p>
          <p>You can <strong>export</strong> your member list (Excel or CSV) from the Members page for your own records.</p>
        </>
      ),
    },
    {
      id: 'notifications-audit',
      heading: 'Notifications and the member audit log',
      summary: 'Set your own notification preferences, and (as owner) review the history of member changes.',
      keywords: ['notifications', 'notification settings', 'manage notifications', 'turn off notifications', 'email alerts', 'push', 'bell', 'notification drawer', 'open a notification', 'read the whole message', 'message cut off', 'where does it go', 'open the request', 'open the bill', 'notifications on my phone', 'where are my notifications', 'no bell on my phone', 'needs attention', 'clears when it’s handled', 'why did it disappear', 'who gets notified', 'activity feed', 'earlier this week', 'done', 'mark done', 'clear a notification', 'still showing after i read it', 'mark all read', 'delete a notification', 'trash', 'undo', 'unread', 'load more', 'where did see all go', 'see all', 'bundled', 'audit log', 'member history', 'when who what to whom', 'time zone', 'export audit log', 'rep teams group change', 'volunteer job change', 'helping with', 'house league withdrawal request', 'ask to withdraw'],
      searchText: 'house league withdrawal request ask to withdraw a child family asks to withdraw turn on notifications turn on alerts get alerts on this device phone alerts push notifications will not turn on couldn’t turn on notifications in this window allow prompt notifications are blocked address bar in the app reinstall the app install app home screen iphone ipad signed out couldn’t save this device notifications notification preferences notification settings one page for everything you are part ofcard per organization team you coach manage notifications turn off notifications change how i am notified account notifications your devices in-app bell email push per event type on a computer the bell opens a drawer down the right side whole list load more no see all link where did see all go settings gear in the drawer header on a phone no bell more notifications page more account notification settings click a notification to open it where you are opens beside the list sheet above the bottom bar small window whole message day and time marked read nothing loads until you choose button names the page open the request open the bill open teams open the team second click needs attention activity feed grouped today yesterday earlier this week earlier pinned until it’s handled leaves by itself clears when it’s handled handled by someone else why did it disappear from needs attention what happened who did it when settled accepted declined withdrawn closed paid done button takes it off sooner opening it is not dealing with it still in needs attention after i read it who gets notified failed payment goes to the owners assistant coach approval rep teams no-show check-in read seen done dealt with delete gone from your list mark all read marks everything read delete a notification trash undo a few seconds your own list only everyone else copy request or payment untouched no are you sure unread all toggle inbox you empty filter chips on the page bundled repeated 6 new registrations opens as its list member audit log history who changed role owner only export members when who what happened to whom columns house time zone role changes program access turned on turned off invitations sent resent suspensions reinstatements removals rep teams group change no member changes yet did not load try again export excel csv',
      content: (
        <p>Two kinds of record: your own notification preferences, and, for the owner, the club or organization&rsquo;s audit log of member changes (Organization → Audit log).</p>
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
                <HelpDef term="A house league withdrawal request">The owner, club admins, league admins and league registrars, when a family uses <strong>Ask to withdraw a child</strong> on their status page. It opens Registrations on that child. It leaves once the registration ends, whoever ends it, and the child keeps their place until then.</HelpDef>
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
              <p>Owner-only, and reachable from <strong>Members → Audit log</strong>. Four columns read as a sentence: <strong>when</strong>, <strong>who</strong>, <strong>what happened</strong>, and <strong>to whom</strong> — for example, &ldquo;Today, 9:14 a.m. · Sam Lee · changed the role to Treasurer · Priya Shah.&rdquo; Times show in your organization&rsquo;s own time zone, not the reader&rsquo;s.</p>
              <p>It records every kind of member change: role changes, program access turned on or off, a volunteer&rsquo;s job (&ldquo;Helping with: Both → The gate&rdquo;), invitations sent, suspensions and reinstatements, removals, and a change to a Rep teams group&rsquo;s scope. &ldquo;No member changes yet&rdquo; appears only once the log has actually loaded and found nothing — a failed load says so instead, with a way to try again.</p>
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
      keywords: ['modules', 'house league', 'rep teams', 'accounting', 'public organization page', 'plan'],
      searchText: 'modules house league rep teams accounting public organization page league plus club included plan navigation automatic',
      content: (
        <>
          <p>Modules extend FieldLogicHQ beyond the core tournament tools. Each module adds a new section to your admin panel, shown in the left navigation once it is included in your plan.</p>
          <ul>
            <li><strong>Public Organization Page</strong> — A branded public landing page listing your tournaments, results, and registration links. Included on League Plus and above.</li>
            <li><strong>House league</strong> — Registration, divisions, seasons, game scheduling, standings, and league communications. Included on League Plus and above.</li>
            <li><strong>Accounting</strong> — The club’s ledger, budgets and budget vs. actual, costs shared across teams, and coaches’ payment requests. Included on Club.</li>
            <li><strong>Rep teams</strong> — Tryouts, rosters, player documents, and the Coaches Portal. Included on Club.</li>
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
      ],
      searchText: 'calendar on phone calendar on my phone where is the calendar on my phone calendar tab phone tabs bottom bar club schedule practices from a schedule dome sunday slots a slot two teams share one booking naming both from row open the schedule calendar club calendar whole club schedule every team one page week view list view month view who is on lions park diamond 2 on tuesday clash clashes only amber pill double booked booked by busy then dashed may clash facility not set read window both sides head coach open the team schedule open in the coaches portal house league season schedule tournament day game count venue program team filter places the club doesn’t own export excel csv calendar ics what the page shows times in eastern time time zone sunday night game week read only cannot edit coaches keep their schedule list rows by day time range who what where today cancelled booking struck through postponed house league game still shown never a clash not counted status column scheduled cancelled postponed calendar file marks cancelled leaves postponed out one row of controls dates on their own row on a tablet not inside the club’s permit outside the permit permit the club holds rental booking contract said once in the window never on the rows not a clash',
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
              <p>When the club holds a permit at the venue that day and the booking falls outside it, the window says so once, in a quiet grey line: <em>Outside the club&rsquo;s permit for Diamond 2</em> (or <em>Outside the club&rsquo;s permit at Lions Park</em> when no diamond is set). It never shows on the rows and never counts as a clash. Permits live in the <a href="#venue-library-t-permits">Venue library</a>.</p>
            </>
          ),
        },
        {
          id: 'club-calendar-t-filters-export',
          title: 'Filters and Export',
          content: (
            <>
              <p>The controls are one row: the view, the dates, <strong>Venue</strong>, <strong>Program</strong>, <strong>Team</strong>, the clash count and <strong>Export</strong> (on a tablet the dates take their own row). <strong>Venue</strong>, <strong>Program</strong> and <strong>Team</strong> narrow the page; each choice shows its count. <strong>Places the club doesn&rsquo;t own</strong> collects the bookings that aren&rsquo;t on one of your venues. Filters start fresh each time you open the page. On a phone they sit behind <strong>Filter</strong>, and the view switch is the icon beside the title.</p>
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
      id: 'club-schedules',
      heading: 'Schedules — handing the club’s time out to its teams',
      summary: 'Schedules, under Calendar: hand the time the club holds (a dome’s winter Sundays, a town’s field permit) out to its rep teams fairly, bill them for it, and send it.',
      keywords: [
        'schedules', 'club schedule', 'practice schedule', 'time slots', 'slots', 'dome', 'permit', 'hand out the time', 'share the time',
        'new schedule', 'no permit', 'link a permit', 'copy a schedule', 'start blank', 'start from the permit', 'last year’s schedule', 'drafts', 'generate drafts', 'three more drafts', 'evenly',
        'by percentage', 'a set number a week', 'prime time', 'rules', 'facilities by group', 'teams’ days off', 'game day',
        'fair shares', 'grid', 'by team', 'by group', 'drag', 'move a slot', 'which weeks', 'undo', 'lock', 'swap', 'clear',
        'regenerate', 'bill the teams', 'allocation', 'by the time each team got', 'send for review', 'final now', 'finalize and send',
        'reply by', 'looks good', 'ask for a change', 'changed since sent', 'send the changes', 'bill the corrections', 'send log',
        'handed back', 'export schedule',
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
      ],
      searchText: 'schedules club schedule practice schedule time slots slots dome winter sundays town field permit hand out the time share the time fairly rep teams new schedule permit no permit link a permit copy a schedule start blank start from the permit last year’s schedule a year on venue facilities all none dates days hours add hours slot length changeover teams at once dates off 25 sundays 6 fields 12 slots a sunday 300 slots who and how much split the time evenly by percentage a set number a week group figure 60 40 slots column closing row left open held by a tryout day over 100% prime time shared the same way shared evenly by team no season running rules earliest and latest start start after finish by teams’ days off at most a day at most a week keep each team’s nights rotate it weekly facilities by group only for never on a team’s game day away games never over a booking already on the books no back-to-back days generate drafts three drafts ranked three more drafts by team by day export a draft excel pdf save as a draft nothing reaches a team schedule’s page grid a week monday first one weekday dates across seven at a time facility filter team filter clashes amber pill by team by group a week slots hours prime time days drag a chip which weeks this week only this & later weeks every week undo a moved slot locks itself give it to change team house league lock this slot unlock swap with clear this slot tools settings regenerate the unlocked slots lock this week clear this week send log delete this draft phone reads day by day one day at a time next day choose a day computer changes fair shares handed out open short clashes the bill bill the teams bill from budget line the permit’s cost a part of it split by the time each team got full field half field an hour payments one payment monthly every two months dates i choose nothing is billed until you finalize money club tab send for review first final now books and bills reply by who is told head coach and staff see the email in review replied looks good asked for a change finalize and send changed since sent send the changes only those teams told bill the corrections owed back send log handed back open handed back by notification schedules section families are not emailed sharing a facility share a field two teams one facility at once paired whenever a partner is free plays alone half a facility a third a quarter shared slot shared each team’s time the same each week moved around spread out rotate early and late taken in turn facilities taken in turn keeps its days add a rule start and finish times a team’s day off facilities for a group at most a day or a week always remove this rule not in use finish this rule or remove it a third mix hours early fields 50 shared 37.5 hours half-field slots shared slots open slots share with take off add slot holds 2 teams at once a coach asks for money back ask on the schedule callout above the grid answer accept decline asked by the sundays stay the team’s until you answer ringed hand back arrow hand-back asked which team asked late ask money only their time is already open your answer moves only the money someone who holds the club’s accounting answers the bell opens the schedule with answer open nothing to send a hand-back never changed since sent fair shares by team band above the toolbar card under the grid the bill as finalize made it what each team pays after credits and money given back same as money club its bill stays without asking for money',
      content: (
        <p><strong>Schedules</strong>, directly under <strong>Calendar</strong> in the menu, is where the club hands out the time it holds (a dome&rsquo;s winter Sundays, a town&rsquo;s field permit) to its rep teams: by the shares and rules you set, with each team&rsquo;s share of the cost. The owner and admins see it on League Plus and Club, once the club runs rep teams.</p>
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
                <li>Give it a <strong>Name</strong> and pick its <strong>Permit</strong>: the permit fills in the venue, facilities, dates, hours and dates off in one pick, and the schedule stays linked to it. Leave <strong>No permit</strong> to enter the time yourself. Copy last year&rsquo;s schedule, then pick this year&rsquo;s permit, to put last year&rsquo;s teams, shares and rules on this year&rsquo;s time. Started from a permit&rsquo;s page, the permit is already picked: a copy keeps its time, or click <strong>Start from the permit</strong>.</li>
                <li>Check the <strong>Venue</strong> and its <strong>Facilities</strong> (<strong>All</strong> · <strong>None</strong>), the first and last day, and the rows of <strong>Days</strong> and hours (<strong>Add hours</strong> for another night).</li>
                <li>Set the <strong>Slot length</strong> (each team&rsquo;s time on a facility) and the <strong>Changeover</strong> between slots. Add any <strong>Dates off</strong>.</li>
              </ol>
              <p>A line under the time counts it as you go: &ldquo;25 Sundays &middot; 6 fields &middot; 12 slots a Sunday &middot; 300 slots&rdquo;. Which teams share a facility is a rule, not part of the time (see <a href="#club-schedules-t-sharing">Sharing a facility</a>). A permit&rsquo;s window also has <strong>Hand out this time in a schedule</strong>, which opens New schedule with that permit picked.</p>
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
              <p>The <strong>Slots</strong> column is what the time gives each team, worked out as you type. The closing row says what is left open, and why: &ldquo;64 slots left open. 2 more are held by 13U AAA&rsquo;s tryout day.&rdquo; or &ldquo;50 slots left open: 9U AA and 11U AA share a facility.&rdquo;</p>
              <p><strong>Prime time</strong>, at the end of the card, sets the hours every team wants (Weeknights, Weekends or Every day, from and until). By percentage, <strong>How it&rsquo;s shared</strong> beside it is <strong>Shared the same way</strong> as the time or <strong>Shared evenly by team</strong>. Whether a team keeps its prime-time slot or takes it in turn is Each team&rsquo;s time.</p>
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
              <p>The page opens on the <strong>Grid</strong>: a row per facility and a column per day, Monday first, across the page&rsquo;s whole width. <strong>Fair shares</strong>&rsquo; figures sit in a band above it, and its teams in a card under it (see <a href="#club-schedules-t-fair">Fair shares</a>). A schedule on one weekday shows its dates across instead, seven at a time (Oct 4 &ndash; Nov 15). The arrows step through the weeks or the dates.</p>
              <ul>
                <li><strong>Facility</strong> and <strong>Team</strong> narrow the grid; the amber <strong>Clashes</strong> count shows only the slots a booking already holds.</li>
                <li><strong>By team</strong> lists each team&rsquo;s slots a week, its slots and hours in all (a shared slot and a half field each count half), its prime time and its days; a row opens that team&rsquo;s slots. <strong>By group</strong> adds them up by group.</li>
                <li><strong>Export</strong> saves the schedule as Excel or PDF, and as a Calendar file once it&rsquo;s final.</li>
              </ul>
              <p>On a phone the page reads by <strong>Day</strong> or <strong>By team</strong>. Day shows one day&rsquo;s slots; its arrows step only through the days the schedule has slots on (a Sundays-only schedule goes Sunday to Sunday), and tapping the date lists them all to jump to one. Moves, Tools&rsquo; changes and Finalize are on a computer.</p>
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
              <p>A slot moved by hand locks itself, so a regenerate never moves it back. A shared slot moves from its window, not by dragging. Click a slot to give it to a team or house league (<strong>Give it to</strong>), <strong>Lock</strong> or <strong>Unlock</strong> it, <strong>Swap with&hellip;</strong> another, or <strong>Clear this slot</strong>. <strong>Tools</strong> holds <strong>Settings&hellip;</strong>, <strong>Regenerate the unlocked slots&hellip;</strong>, <strong>Lock this week</strong>, <strong>Clear this week&hellip;</strong>, the <strong>Send log</strong> and <strong>Delete this draft&hellip;</strong>.</p>
            </>
          ),
        },
        {
          id: 'club-schedules-t-fair',
          title: 'Fair shares',
          content: (
            <>
              <p>Above the toolbar, one band reads <strong>Handed out</strong> (&ldquo;250 of 300&rdquo;: a shared slot counts once), <strong>Open</strong>, <strong>Short</strong> and <strong>Clashes</strong> for the whole schedule; <strong>Fair shares by team</strong> at its end takes you to the table. The week&rsquo;s lines sit just above the grid: a team short of its share this week, and a slot a booking holds, each in amber. When more than three slots on screen clash, they read as one line per kind of booking (&ldquo;70 slots clash with practices already booked for 11U AA, 12U AA and 6 more&rdquo;), and the grid marks each one.</p>
              <p>Under the grid, <strong>Fair shares by team</strong> gives each team its slots a week, in all, and its prime time, or, with no prime time, its <strong>Hours</strong>: a shared slot and a half field each count half a facility, as on the bill (&ldquo;every team has 37.5 hours&rdquo;). A team that shares reads &ldquo;50 shared&rdquo;; a team short of its share is amber.</p>
              <ul>
                <li>When the schedule moves teams around, the table reads <strong>All</strong>, <strong>Early</strong> (each team&rsquo;s early starts) and <strong>Fields</strong> (the facilities it used; the schedule&rsquo;s own word, so <strong>Lanes</strong> at the lanes).</li>
                <li>With a permit priced behind the schedule, someone who holds the club&rsquo;s Accounting reads <strong>The bill</strong> instead of Open, and each team&rsquo;s <strong>Bill</strong>.</li>
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
              <p><strong>Bill the teams</strong>, at the right of <strong>Fair shares by team</strong> under the grid, is for someone who holds the club&rsquo;s Accounting. It fills itself in from the schedule and its permit:</p>
              <ol>
                <li><strong>Bill from</strong>: the budget line that pays for the time.</li>
                <li><strong>Bill the teams for</strong>: <strong>the time at the permit&rsquo;s price</strong> (the permit&rsquo;s whole cost once every slot is handed out), or <strong>A part of it</strong> when the club covers some. The line under the table compares the bill with the permit&rsquo;s cost.</li>
                <li><strong>Split</strong>: <strong>By the time each team got</strong>, each field at the permit&rsquo;s price (a full field $72.00 an hour, a half field $36.00).</li>
                <li><strong>Payments</strong>: <strong>One payment</strong>, <strong>Monthly</strong>, <strong>Every two months</strong> or <strong>Dates I choose</strong>, from a first date. Each payment is the time that team gets in that period.</li>
              </ol>
              <p>The table reads every team&rsquo;s share and payments as you go: 15U AA&rsquo;s $2,700.00 is $972.00, $864.00 and $864.00. Each team&rsquo;s line says what its time was (&ldquo;25 full-field slots &middot; 37.5 h&rdquo;, &ldquo;50 half-field slots &middot; 37.5 h&rdquo;, &ldquo;50 shared slots &middot; 37.5 h&rdquo;), and the line under the table names any open time: &ldquo;$5,400.00 less than the permit&rsquo;s $27,000.00: the 50 open slots. The club covers the rest.&rdquo; Nothing is billed until you finalize. Then each team&rsquo;s share arrives on its <strong>Money &rsaquo; Club</strong> tab with its payments, as an allocation, and the link reads <strong>The bill &middot; 3 payments</strong>: the bill as it was made, which never changes. A hand-back or a credit comes off what a team pays (Fair shares&rsquo; Bill), never off the bill.</p>
            </>
          ),
        },
        {
          id: 'club-schedules-t-send',
          title: 'Send for review, and Finalize',
          content: (
            <>
              <p><strong>Send</strong> on a draft asks how: <strong>For review first</strong>, where the coaches see their slots and their bill and reply <strong>Looks good</strong> or <strong>Ask for a change</strong> by the <strong>Reply by</strong> date, and nothing is booked or billed yet; or <strong>Final now</strong>, which books and bills at once.</p>
              <ul>
                <li><strong>Who is told</strong> lists each team&rsquo;s head coach and staff with schedule access; untick a team and its coaches aren&rsquo;t emailed (its practices and bill still land at Finalize). Only the club&rsquo;s coaches are told: the venue isn&rsquo;t emailed, so if it asks for the schedule, send it the <strong>Export</strong>. The link under the list shows one coach&rsquo;s email exactly as it goes.</li>
                <li>While it&rsquo;s in review, the page lists the replies (&ldquo;In review &middot; 5 of 8 teams replied&rdquo;), each ask in the coach&rsquo;s words. <strong>Finalize and send</strong> books it.</li>
              </ul>
              <p>Final puts each team&rsquo;s practices on its schedule, the club calendar and the clash check. Families see them on the team&rsquo;s schedule; no family is emailed.</p>
            </>
          ),
        },
        {
          id: 'club-schedules-t-changes',
          title: 'Changes after it’s sent',
          content: (
            <>
              <p>A change to a final schedule waits on its page: <strong>Changed since sent</strong> lists each one, and the teams keep what you sent until you press <strong>Send the changes</strong>. Only the teams with changes are told. <strong>Bill the corrections</strong> gives a team that gained time a small bill from the same line, and takes the time a team lost off what it still owes; what that team had already paid, the club owes it, waiting in Payment requests.</p>
              <p>A coach can hand a practice back from the team&rsquo;s schedule. Its slot reads <strong>Open &middot; handed back by</strong> the team, and you get a notice. Until you give that time to another team, the coach can take it back: the slot is the team&rsquo;s again, and you get a notice. Neither marks the schedule Changed since sent, with money or without: the team already has the change, so there is nothing to send. Coaches&rsquo; replies and hand-backs ring your bell; choose how in your notification settings, under <strong>Schedules</strong>. The <strong>Send log</strong>, under Tools, lists every send: when, by whom, and to which teams.</p>
              <p>A coach can also ask for the money back: see <a href="#club-schedules-t-asks">A coach asks for money back</a>.</p>
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
            <p>The owner and admins build and send schedules. The bill, the permit&rsquo;s prices and every team&rsquo;s share show only to someone who holds the club&rsquo;s Accounting, and only they answer a coach&rsquo;s ask for money back; everyone else reads the time, and an ask without its figure. A coach sees only their own team&rsquo;s slots, and only the head coach answers a review. On a plan without Schedules, or a club with no rep teams, there is no Schedules row.</p>
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
            <p>No. Only the coaches are emailed, one email each listing their team&rsquo;s slots. Families see their team&rsquo;s practices on the team&rsquo;s schedule once it&rsquo;s final, where they already look.</p>
          ),
          answerText: 'No. Only the coaches are emailed, one email each listing their team’s slots. Families see the practices on the team’s schedule once it’s final.',
          keywords: ['families', 'email', 'parents', 'send schedule', 'notify'],
        },
        {
          id: 'faq-club-schedules-change-sent',
          question: 'Can I still change a schedule after I’ve sent it?',
          answer: (
            <p>Yes. Move, swap or clear slots as before: the page lists them under <strong>Changed since sent</strong>, and nothing reaches a team until you press <strong>Send the changes</strong>. Only the teams the changes touch are told.</p>
          ),
          answerText: 'Yes. Changes after it is sent wait under Changed since sent, and nothing reaches a team until you press Send the changes. Only the teams the changes touch are told.',
          keywords: ['change after sending', 'changed since sent', 'send the changes', 'edit final schedule'],
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
      heading: 'The Venue library — your club’s venues and the time it holds',
      summary: 'Organization › Venue library: the club’s venues and their facilities, who books each this season, the permits the club holds there, renaming a facility, and Archive or Delete.',
      keywords: [
        'venue library', 'venues', 'facilities', 'diamond', 'field', 'court', 'rink', 'add venue', 'rename facility', 'facility kind', 'kind of facility',
        'archive venue', 'delete venue', 'bring back', 'booked by', 'archived venues', 'who can edit venues',
        // Permits (Club Tier 10a, 2026-10-11).
        'permit', 'permits', 'rental', 'booking', 'contract', 'dome', 'town permit', 'field permit', 'add permit', 'renew permit',
        'permit use', 'unused hours', 'outside the permit', 'field price', 'half field', 'bookings contact',
        // The club's schedules (Club Tier 11a, 2026-10-11).
        'hand out this time', 'schedule from a permit', 'practice schedule', 'time slots',
      ],
      searchText: 'venue library venues facilities fields diamonds courts rinks gym facility kind what the kind does label on booking forms add venue name address notes open in maps booked by this season teams house league tournament who books it rename a facility rename a diamond upcoming bookings keep the old name past games families calendar no notice archive a venue bring back archived venues out of every picker delete venue nothing books it cannot delete in use league admin can save treasurer read only refused save says why could not load try again tournament import from library organization tile permits permit rental booking contract town field permit diamond permit dome winter contract the time the club holds venues permits switch fiscal year in use now starts later ended a week used hours held booked unused cost an hour held full field half field share a percent of a full field price an hour what each field costs budget line pays for issuer manage payees add a payee reference document upload renew for next year delete permit dates off closed fiscal year locked bookings contact booking office email export the permit export the use excel for the town',
      content: (
        <p><strong>Organization › Venue library</strong> is the club&rsquo;s one list of venues and their facilities, and of the time the club holds at them. Coaches, house league and tournaments pick from it, and two bookings on the same facility at the same time are flagged. The switch at the top reads <strong>Venues</strong> or <strong>Permits</strong>. It comes with League Plus and Club.</p>
      ),
      subtopics: [
        {
          id: 'venue-library-t-who',
          title: 'Who can change it',
          content: (
            <p>The owner, admins, league admins and anyone given the tournament permission can add and change venues and permits. Everyone else who can open Organization reads the library, with no <strong>Add venue</strong>, no <strong>Add permit</strong> and no pencil. A permit&rsquo;s cost, its price an hour and its budget line show only to people who hold the club&rsquo;s Accounting. Coaches never see permits. If a save is refused, the window says why.</p>
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
              <HelpDef term="Held by a permit">A venue a permit holds time at can be archived but not deleted, and a facility a permit names can be renamed but not removed.</HelpDef>
            </HelpDefs>
          ),
        },
        {
          id: 'venue-library-t-permits',
          title: 'Permits: the time the club holds',
          content: (
            <>
              <p>A permit is the time the club holds at its venues: a town&rsquo;s field permit, a dome&rsquo;s winter contract. Choose <strong>Permits</strong> at the top of the Venue library to list them. The pill beside it picks the <strong>fiscal year</strong>; a permit is filed under the year it starts in.</p>
              <ul>
                <li>The table is grouped <strong>In use now</strong>, <strong>Starts later</strong> and <strong>Ended</strong>.</li>
                <li>Each row shows where the permit holds time, its dates, the hours it holds <strong>a week</strong>, and how much is <strong>Used</strong> (&ldquo;64%, 51.5 of 80 h&rdquo;, from every program&rsquo;s bookings).</li>
                <li><strong>Cost</strong> shows to people who hold the club&rsquo;s Accounting.</li>
                <li><strong>Export</strong> saves the list as an Excel file.</li>
              </ul>
            </>
          ),
        },
        {
          id: 'venue-library-t-add-permit',
          title: 'Adding a permit',
          content: (
            <>
              <ol>
                <li>Choose <strong>Permits</strong>, then <strong>Add permit</strong>.</li>
                <li>Enter its name, who issued it, the reference, who it&rsquo;s for, and its first and last day. The issuer is one of the club&rsquo;s payees, the same list the Ledger uses: type a new name to save it as a payee, or choose <strong>Manage payees&hellip;</strong> at the foot of the list to add, rename or merge them without leaving the permit.</li>
                <li>Add its time as blocks: a venue, its facilities (none ticked means every facility there), the days, and from and until. <strong>Add a block</strong> for another night or another park; <strong>Add a date off</strong> for a holiday.</li>
                <li>If you hold the club&rsquo;s Accounting, add the cost, the budget line that pays for it, and what each field costs.</li>
                <li>Upload the issuer&rsquo;s copy (PDF, JPG or PNG, up to 10 MB) and press <strong>Add permit</strong>.</li>
              </ol>
              <p>A line under the blocks counts what you&rsquo;ve entered: &ldquo;2 blocks · 8 weeks · 80 h held&rdquo;.</p>
            </>
          ),
        },
        {
          id: 'venue-library-t-field-prices',
          title: 'What each field costs',
          content: (
            <>
              <p>A dome or park often prices its fields differently. Give each field in the permit <strong>Full cost</strong>, <strong>Half cost</strong> or <strong>A percent</strong> of a full field&rsquo;s price, and the permit works out an hour of each. The form shows each field&rsquo;s price an hour as you type, once the permit has its cost and its time.</p>
              <p>For example: $27,000.00 for four full fields and two half fields, Sundays 8:00&ndash;11:00 a.m., 25 Sundays, comes to <strong>$72.00 a full field</strong> and <strong>$36.00 a half</strong> an hour. The prices belong to the permit, not the venue, so next year&rsquo;s contract can price the same fields differently.</p>
            </>
          ),
        },
        {
          id: 'venue-library-t-permit-window',
          title: 'Reading a permit: its time, cost and use',
          content: (
            <>
              <p>Open a permit to read it: the issuer, reference and dates (its document opens from its name), its time (&ldquo;80 h held&rdquo;, and its dates off), its cost, and how much of it the club uses. The pencil edits the whole permit, and every change saves as you go.</p>
              <HelpDefs>
                <HelpDef term="An hour held">The cost divided by the hours held. When the fields are priced differently, the band shows a full field&rsquo;s hour, and a row for each price below it gives the fields at that price and their hour (&ldquo;Fields 1&ndash;4 &middot; Full field &middot; $72.00 an hour&rdquo;).</HelpDef>
                <HelpDef term="On the budget">The line under the cost: the budget line that pays for it. <strong>Open the line</strong> shows the line; &times; comes back.</HelpDef>
                <HelpDef term="Held / Booked / Unused">The hours it holds, the hours any program booked inside them (each hour counted once), and what&rsquo;s left. A row per block names who booked it.</HelpDef>
              </HelpDefs>
              <p><strong>Export</strong>, at the top beside The permit, saves an Excel workbook for the town or the dome: the permit&rsquo;s place, days, hours and dates, its cost, and its use by field and by date. Someone without the club&rsquo;s Accounting gets the same file without the cost.</p>
              <p><strong>Hand out this time in a schedule</strong>, at the end of the permit&rsquo;s window, opens New schedule started from the permit (for the owner and admins, where the plan has Schedules; see <a href="#club-schedules">Schedules</a>). While a schedule hands the permit&rsquo;s time out, a line names it and <strong>Delete this permit</strong> isn&rsquo;t offered.</p>
              <p>A permit doesn&rsquo;t list bookings that fall outside the club&rsquo;s permits. Each one says so itself, on its booking form and in the club calendar.</p>
            </>
          ),
        },
        {
          id: 'venue-library-t-renew',
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
        {
          id: 'faq-venue-library-permit-cost',
          question: 'Why can’t I see a permit’s cost?',
          answer: (
            <p>A permit&rsquo;s cost, its price an hour and its budget line show only to people who hold the club&rsquo;s Accounting: the owner, the treasurer, and an admin with Accounting. Everyone else who opens the Venue library reads its time and its use.</p>
          ),
          answerText: 'A permit’s cost, its price an hour and its budget line show only to people who hold the club’s Accounting: the owner, the treasurer, and an admin with Accounting. Everyone else reads the permit’s time and use.',
          keywords: ['permit cost', 'cannot see cost', 'accounting', 'permit', 'rental', 'contract'],
        },
        {
          id: 'faq-venue-library-permit-blocks',
          question: 'Does a permit stop anyone booking outside it?',
          answer: (
            <p>No. A booking at a venue where the club holds a permit, outside the permit&rsquo;s time, gets one quiet grey line under Venue (&ldquo;Outside the club&rsquo;s permit for Diamond 2&rdquo;) and still saves. The club calendar says it once more, in that booking&rsquo;s window. Nothing appears at a venue the club holds no permit at.</p>
          ),
          answerText: 'No. A booking outside the club’s permit gets one quiet grey line under Venue — “Outside the club’s permit for Diamond 2” — and still saves. The club calendar says it once more, in that booking’s window. Nothing appears at a venue the club holds no permit at.',
          keywords: ['permit', 'outside the permit', 'not inside the club’s permit', 'blocked', 'booking', 'rental'],
        },
      ],
    },
    {
      id: 'settings',
      heading: 'Settings and your web address',
      summary: 'The owner-only Settings page: your organization’s name, web address, Payouts for online payments, and account deletion. Your public site’s logo, colours, type and switch are in Public site.',
      keywords: ['settings', 'payouts', 'online payments', 'families pay by card', 'house league pay by card', 'families and teams pay it', 'stripe', 'processing fee', 'bank debit', 'bank debit rate', 'card rate', 'returned bank debit', 'returned bank debit fee', 'web address', 'org slug', 'url slug', 'organization details', 'delete organization', 'open public site', 'public site switch', 'listed in the directory', 'online offline', 'public site editor', 'turn off public site', 'take site offline', 'site isn’t available', 'team pages offline', 'tryouts offline', 'tournament pages stay up', 'logo', 'colours', 'branding', 'where did branding go', 'birthdays count from', 'birthday cut-off', 'cut-off date', 'birth year', 'born', 'age', 'age group', 'january 1', 'september 1'],
      searchText: 'payouts card settings payouts let teams pay online families pay by card house league registration fees families and teams pay it the club pays it stripe connect processing fee who pays it refund policy disconnect payouts bank debit both rates per card payment per bank debit bank debits still clearing returned bank debit line next fieldlogichq invoice card dispute fee card issued outside your country card from another country foreign card extra fee invoice of its own stripe fees passed on every club owner only org settings owner only organization details name web address url slug org slug change redirect save button delete organization account deletion danger zone your public site door card open public site its logo colours type and whether it is online are set in public site branding logo stock logo colours hero banner banner photo font type moved to public site look visibility card style tournament branding page public site switch online offline listed in the directory discover directory take the club offline what goes offline every club page home teams team pages tryouts tryout sign up league archives team calendars subscribed calendars go empty tournament pages stay up this club’s site isn’t available site isnt available coaches sharing note when birthdays count from per sport month day dropdown default january 1 count softball birthdays from keep january 1 change every team and house-league division shows its birth years re-read one birth year show none until you set it again born sep 1 2013 aug 31 2015 age cut-off birth years owner only',
      content: (
        <p>The <strong>Settings</strong> page is <strong>owner-only</strong>. It holds <strong>Organization details</strong> (your organization&rsquo;s name and web address), <strong>When birthdays count from</strong>, a card that points to <strong>Public site</strong>, <strong>Payouts</strong> (letting teams pay online by card), and <strong>Delete organization</strong>. Your public site&rsquo;s logo, colours, type, banner and on/off switch are set in <strong>Public site</strong>, not here.</p>
      ),
      subtopics: [
        {
          id: 'settings-t-payouts',
          title: 'Payouts: let teams pay online',
          content: (
            <>
              <p>On the League and Club plans, <strong>Payouts</strong> is a card on Settings, after <strong>Your public site</strong> and before <strong>Delete organization</strong>. The owner connects the organization&rsquo;s own Stripe account there, chooses who pays the processing fee (<strong>Families and teams pay it</strong> or <strong>The club pays it</strong>; on Tournament Plus the first reads <strong>Teams pay it</strong>), can write a one- or two-sentence <strong>Refund policy</strong> that teams see beside the pay button, and can <strong>Disconnect payouts</strong>. The card prints both rates, <em>Processing fee: &hellip; per card payment, &hellip; per bank debit</em>, from FieldLogicHQ&rsquo;s current rates; an account that doesn&rsquo;t take bank debit shows the card rate alone. <strong>Before you set up payouts</strong> says the same under <em>What it costs</em>, with a worked line for an example fee by card and by bank debit.</p>
              <p>The choice is one setting for the whole organization. It covers teams paying tournament entry fees and families paying house-league registration fees by card, and house-league families see <strong>Pay now</strong> only once payouts are set up. Only the owner connects; a treasurer sees the state as a line on the Accounting Overview and on a season&rsquo;s Money page. Bank debit is offered to families and teams only once Stripe has approved your account for it. <strong>Disconnect payouts?</strong> says how many bank debits are still clearing; they finish, and their money still reaches you. Stripe can charge other fees on your payments: when a bank debit comes back, when a card payment is disputed, and when a card issued outside your country is used. The card says so under the rates: <em>Other Stripe fees, such as for disputes, returned bank debits and cards issued outside your country, are billed to the club.</em> FieldLogicHQ passes them on to every club on every plan, and the family or team pays the ordinary price; see <a href="../help/org#stripe-fees">Stripe fees on your online payments</a>. It needs a plan that includes online payments, and the card isn&rsquo;t shown where they&rsquo;re not offered. The full guide, including what teams see and how refunds work, is <a href="../help/tournaments#online-payments">Let teams pay online by card</a> in the Tournaments guide.</p>
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
              <p><strong>Branding</strong> is no longer in Settings. Your logo, colours, type and banner photo are in <strong>Public site &rsaquo; Look</strong>, and the owner <em>or</em> an admin can change them (see <strong>Running your public site</strong>). This is <strong>organization-level</strong> branding and it comes with <strong>League and Club</strong> plans. Tournament and Tournament Plus brand each <strong>event</strong> individually instead — from that tournament&rsquo;s own settings, with full control per event — and their organization&rsquo;s home page keeps FieldLogicHQ&rsquo;s default styling.</p>
              <p><strong>Card style</strong> is no longer a club setting. It only ever changed tournament pages, so each tournament picks its own on its <strong>Branding</strong> page.</p>
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
      id: 'stripe-fees',
      heading: 'Stripe fees on your online payments',
      summary: 'The Stripe fees your online payments can cause, how FieldLogicHQ passes them on to every club on every plan, and the Stripe fees list on Plan & billing.',
      keywords: ['stripe fees', 'stripe fee', 'dispute fee', 'card dispute fee', 'answering fee', 'returned bank debit fee', 'returned bank debit', 'card issued outside your country', 'foreign card', 'extra fee', 'fee invoice', 'invoice of its own', 'pay the invoice', 'complimentary plan', 'free plan', 'plan and billing', 'credited to your account', 'returned', 'answering fee returned', 'refunded to your card', 'cancelled club', 'other stripe fees'],
      searchText: 'stripe fees on your online payments other stripe fees billed to the club passed on to every club on every plan your plan doesnt change complimentary free plan comped not exempt returned bank debit fee card dispute fee answering fee comes back if you win credited to your account taken from the clubs stripe balance extra fee for a card issued outside your country card from another country foreign card international card family never charged more refunded payment fee stays next fieldlogichq invoice invoice of its own sent on the 1st due in 30 days email from fieldlogichq pay the invoice stripes secure page reminder plan and billing stripe fees list on your next invoice on your dec 1 invoice invoice due paid couldnt be billed yet not billed test mode owner only returned taken off the invoice that charged it refunded to the card that paid it no email from stripe nothing billed when stripe charged nothing cancelled club still billed still sees the list',
      links: [
        { label: 'Plan & billing', href: '../org/billing' },
      ],
      content: (
        <p>When your organization takes payments online, Stripe charges some fees that those payments cause. FieldLogicHQ passes them on to every club on every plan, a complimentary or free plan included. Your plan doesn&rsquo;t change, and the family or team never pays more.</p>
      ),
      subtopics: [
        {
          id: 'stripe-fees-which',
          title: 'Which Stripe fees are passed on',
          content: (
            <HelpDefs>
              <HelpDef term="A returned bank debit">Stripe&rsquo;s fee when a bank debit comes back or is reversed, at Stripe&rsquo;s own figure. When Stripe charges nothing for it, nothing is billed.</HelpDef>
              <HelpDef term="A card dispute">A fee for the dispute, and a second one if you answer it. If you win, Stripe gives the answering fee back, and FieldLogicHQ returns it to you. Stripe often takes these from the club&rsquo;s own Stripe balance, and then nothing is billed. Only a fee Stripe charged FieldLogicHQ is passed on, at Stripe&rsquo;s figure, so a fee is never charged twice. The payment&rsquo;s record tells the owner which it was.</HelpDef>
              <HelpDef term="A card issued outside your country">Stripe charges more for it. The extra is billed to the club at FieldLogicHQ&rsquo;s published rate on what the card was charged, and it stays billed if the payment is later refunded. The family or team pays the ordinary price and is never told.</HelpDef>
            </HelpDefs>
          ),
        },
        {
          id: 'stripe-fees-where',
          title: 'Where they’re billed',
          content: (
            <p>A club with a paid subscription gets each fee as a line on its next FieldLogicHQ invoice. Otherwise, for example on a complimentary or free plan, the club gets an invoice of its own on the 1st of the month for the month before. It comes in an email from FieldLogicHQ to the owner, is due in 30 days, and <strong>Pay the invoice</strong> opens Stripe&rsquo;s secure page. One reminder follows if it is still unpaid after the due date.</p>
          ),
        },
        {
          id: 'stripe-fees-list',
          title: 'The Stripe fees list on Plan & billing',
          content: (
            <>
              <p>Once your organization has a Stripe fee, the owner&rsquo;s <strong>Plan &amp; billing</strong> page shows <strong>Stripe fees</strong>: each fee, its amount, and where it stands. It stays there after the subscription is cancelled, since a cancelled club is still billed its Stripe fees and still gets the invoice by email.</p>
              <HelpDefs>
                <HelpDef term="On your next FieldLogicHQ invoice">It rides on your subscription&rsquo;s next invoice.</HelpDef>
                <HelpDef term="On your Dec 1 invoice">It waits for the next invoice of its own.</HelpDef>
                <HelpDef term="Invoice N &middot; due, or paid">It is on an invoice of its own. While that invoice is open, <strong>Pay the invoice</strong> is beside it.</HelpDef>
                <HelpDef term="Credited to your account">An answering fee Stripe gave back after you won a dispute, taken off the same invoice as the fee it returns.</HelpDef>
                <HelpDef term="Returned Nov 3">An answering fee Stripe gave back after you won, when the invoice that charged it had already gone out. It is taken off what you owe on that invoice while it is unpaid, or refunded to the card that paid it. Stripe sends no email about it; this line is the notice.</HelpDef>
                <HelpDef term="Couldn&rsquo;t be billed yet">FieldLogicHQ sees it and bills it again. There is nothing for you to do.</HelpDef>
                <HelpDef term="Not billed: test mode">Nothing moves while payouts are in test mode.</HelpDef>
              </HelpDefs>
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
        'show a section', 'section order', 'tagline', 'about the club', 'families questions go to', 'contact email',
        'social links', 'instagram', 'facebook', 'website link', 'saved as', 'that isn’t a web address', 'look', 'colours',
        'who to contact', 'contacts', 'role address', 'registrar', 'documents and policies', 'code of conduct', 'policies',
        'questions families ask', 'faq', 'about page', 'contacts and documents', 'club notice', 'field closure',
        'fields closed', 'rain out', 'post notice', 'end now', 'mentions 2025', 'still true', 'past year',
        'coaches on team pages', 'who is listed as a coach', 'coach names', 'list coaches on team pages', 'coaches choose', 'head coaches always', 'head and assistant coaches always', 'no coach names', 'listed', 'not listed', 'list them',
      ],
      searchText: 'public site editor admin public site six rows open in place one at a time look home page about the club contacts documents and sponsors contacts and documents coaches on team pages who is listed as a coach coaches choose head coaches always head and assistant coaches always no coach names listed not listed list them not now visibility preview computer phone change in look point at a part outlines click to change links in the preview don’t go anywhere only you and your admins can see this your site is offline preview button eye set up your site n of 4 ready go live the owner puts it online nothing is required to go live ready tick dashed ring logo upload a logo replace logo browse stock logos remove colours from your logo nine presets your own colours main colour accent colour darkened readable type classic serif clean banner photo computer only phones leave it out visibility public site switch take offline listed in the club directory web address change it in settings owner or admin can change the look only the owner turns the site on and off card style tournament branding page cards save themselves saved pill no save button online offline chip families see it at your address copy link open home page sections open now always first teams house league tournaments about the club switch hide show hold and drag the number reorder order shows once you publish a season shows once you host a tournament shows once you add a team plan does not carry tab row follows home page and in your site’s tabs tournaments switch home section tab and page tournaments tab tournaments page hide tournaments past tournaments sub-option under tournaments only while tournaments is on keeps its setting at the bottom of your tournaments page shows once a tournament finishes no current tournament your tab shows your past ones archive tagline about families questions go to footer team and tryout pages mentions a past year still true hint founding year since social links instagram facebook x website https saved as refused that isn’t a web address paste the link who to contact up to twelve role address registrar@ personal address gmail nudge documents and policies up to thirty heading title link opens in a new tab codes of conduct safety the club never says compliant questions families ask up to ten about page contacts and documents footer link look logo colours font readable darkened club notice showing now edit post a notice field closure fields closed tonight rain more detail ends tonight tomorrow night date and time post notice update notice end now posted by the club ends by itself one at a time every public page every team page sponsors sponsor up to twenty add a sponsor thank you strip at the foot of the home page sponsors section on the about page name logo upload a logo replace logo remove logo link opens in a new tab last day through that day leaves by itself ended mark renew pick a later day jpg png webp 2 mb scaled to fit never cropped no tiers only sponsors',
      content: (
        <>
          <p><strong>Public site</strong> in the admin is where you build your club&rsquo;s pages. It is six rows that open in place, one at a time, each with a one-line summary while it is closed: <strong>Look</strong>, <strong>Home page</strong>, <strong>About the club</strong>, <strong>Contacts, documents and sponsors</strong>, <strong>Coaches on team pages</strong> and <strong>Visibility</strong>. (<strong>Coaches on team pages</strong> is there only for a club with Rep teams.) On a computer, a live preview of your home page stands beside them. It&rsquo;s for the owner and admins. Every change saves itself (a <strong>Saved</strong> pill appears and fades), except a notice, which waits for <strong>Post notice</strong>.</p>
          <p>The owner or an admin can change everything except <strong>Visibility</strong> and <strong>Coaches on team pages</strong>, which are the owner&rsquo;s. Only the owner turns the site on and off, changes the directory listing, or changes the club&rsquo;s name and web address.</p>
        </>
      ),
      subtopics: [
        {
          id: 'public-site-editor-header',
          title: 'Your address, and whether the site is on',
          content: (
            <>
              <p>The top of the page shows an <strong>Online</strong> or <strong>Offline</strong> chip and <strong>Families see it at</strong> with your address, <strong>Copy link</strong> and <strong>Open</strong>. While the site is off, Open isn&rsquo;t there; Copy link still is. On a narrow window, an eye <strong>Preview</strong> button sits beside Copy link while the site is off and opens the preview in a window.</p>
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
                <li><strong>About the club</strong> is ready with a tagline and the address families&rsquo; questions go to.</li>
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
          id: 'public-site-editor-words',
          title: 'Your tagline, about text, contact and social links',
          content: (
            <>
              <p>The <strong>About the club</strong> row holds your <strong>Tagline</strong> (one line under your name, up to 100 characters), your <strong>About</strong> text, <strong>Families&rsquo; questions go to</strong> — the address shown in your footer and on every team and tryout page — and your <strong>Social links</strong>.</p>
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
              <p>The <strong>Contacts, documents and sponsors</strong> row holds four lists. Three of them fill your club&rsquo;s <strong>About</strong> page, and the fourth, sponsors, has its own topic below. The row opens to four folded lines. Each says what is inside, with a count on the right. Tap a line to open its list, and tapping another closes the first. Each entry opens a small window; <strong>Add</strong> sits at the foot of each list.</p>
              <ul>
                <li><strong>Who to contact</strong> (up to twelve): a role, such as Registration, and its email address. When an address looks personal, the window suggests a role address like registrar@, which keeps working when a volunteer changes. It never refuses yours.</li>
                <li><strong>Documents and policies</strong> (up to thirty): a heading, a title and a link to a document you already publish. Families see them under your headings, such as Codes of conduct or Safety, and each opens in a new tab. Your site shows your documents; it never says your club is compliant.</li>
                <li><strong>Questions families ask</strong> (up to ten): short answers to what you get asked every season.</li>
              </ul>
              <p>Families reach the About page from the <strong>About the club</strong> card on your home page and the <strong>Contacts and documents</strong> link in your footer. Both appear once you have added a contact, a document or a question.</p>
            </>
          ),
        },
        {
          id: 'public-site-editor-sponsors',
          title: 'Sponsors on your home page and About page',
          content: (
            <>
              <p>The <strong>Sponsors</strong> list, in the <strong>Contacts, documents and sponsors</strong> row, is your club&rsquo;s thank-you to the businesses and people who back it. Families see them in a strip at the foot of your home page, and in a <strong>Sponsors</strong> section at the foot of your About page. Add up to twenty. Each one opens a small window.</p>
              <ul>
                <li><strong>Name</strong> is the only thing required. A sponsor with no logo shows as its name.</li>
                <li><strong>Logo</strong> is a JPG, PNG or WebP up to 2 MB. We open it and save a small copy, so a file that isn&rsquo;t really a picture is refused. It shows scaled to fit and never cropped, so every sponsor gets the same space.</li>
                <li><strong>Link</strong> is where a family goes when they tap the sponsor. It opens in a new tab.</li>
                <li><strong>Last day</strong>: families see the sponsor through that day, then it leaves both places by itself. Leave it empty to keep it up.</li>
              </ul>
              <p>A sponsor past its last day stays in your list with an <strong>Ended</strong> mark, so renewing is one edit: open it and pick a later day. Sponsors alone don&rsquo;t open your About page, so a club with only sponsors shows them on its home page.</p>
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
        'return to admin from public page', 'admin shortcut', 'coaches portal shortcut', 'flip', 'account menu', 'sign out', 'my team', 'my teams', 'house league coach',
        'page not found', 'couldn’t find that page', 'broken link', 'old link', 'qr code', 'short address', 'site isn’t available',
        'home page', 'open now', 'teams tab', 'teams page', 'team page', 'about the club', 'follow', 'tournament status',
        'live now', 'this weekend', 'finished', 'see all teams', 'team schedule', 'earlier this season', 'banner photo',
        'tryouts page', 'tryouts tab', 'tryout days', 'not open yet', 'tryouts open', 'link preview', 'share card', 'shared link', 'google', 'search engines',
        'about page', 'contacts and documents', 'club notice', 'section order', 'hide a section',
        'born', 'born in', 'birth year', 'birth years', 'age', 'age group', 'birthday', 'cut-off', 'what year was my child born',
        'coaches on the team page', 'coach names public', 'questions about these tryouts', 'email the head coach', 'tryout questions address',
      ],
      searchText: 'public organization page club site what families see visitors see fans see your own site your bar logo initials club name tagline sign in account section tabs tab row home teams house league tournaments only the sections you have tournaments tab tournaments page current and upcoming past tournaments finished tournament not archived opens its own site archived tournament archive page old past tournaments address forwards teams tab teams page every team not archived club groups other teams tryouts open chip home page order open now registration open tryouts teams grid house league tournaments about the club follow button registration open this weekend live now finished banner strip computer only team page back to teams division season dot tryout details and sign-up isn’t taking tryout sign-ups right now schedule public link earlier this season up next directions cancelled show the rest of the season about the team see all teams no tab row with only a home page tabs in the bar on a computer white row under the bar on a phone club name links back to the front page no discover no pricing no breadcrumb no fieldlogichq bottom bar on a phone tournament pages keep the bottom bar light page your colours readable automatically light colour dark text yellow gold sky darker links footer questions email the club copy the address copied social links instagram facebook x website built on fieldlogichq credit paid plans event cards club colours tournament cards account menu sign out stays on your page return to admin from my public page shortcut back admin coaches portal flip door only your own staff staff of another club family never sees it remembers the screen i left page not found we couldn’t find that page couldnt find mistyped team old link broken link short address teams schedule standings results register news rules forwards to the running tournament printed link qr code no tournament running this club’s site isn’t available site switched off tryouts page tryouts tab third tab 2027 tryouts rep and select teams for the season banded by your groups date range tryout days public tryout days families can see tryout days dates venue field directions sign up for tryouts not open yet finished tryouts closed the club’s last tryouts finished no tryouts are posted right now link preview share card shared link card in your colours logo initials never a player text message social media search engines google find your teams page about page contacts and documents footer link club notice top of every page section order you choose hidden section no tab born 2012–2013 born in any year pick a year narrows the list places for a player born in birth years age group which team can my child play for cut-off sep 1 born before born on or after born 2012 or later born 2008 or earlier house league division born from the club note on the tryout page coaches section on the team page name and role only coach switched their name on questions about the team email the club at questions about these tryouts email the head coach head coach address copy footer keeps the club’s address',
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
                <li><strong>About the club</strong>: the about text you write in Public site, a link to your About page once it has contacts, documents or questions, and a <strong>Follow</strong> button when your club is listed in Discover. On a computer it sits beside the other sections.</li>
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
              <p>A house league coach gets <strong>My team</strong> at the top right instead, which opens their team page. On a phone it is the first row of the person icon&rsquo;s menu. A coach who also runs the club gets both.</p>
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
