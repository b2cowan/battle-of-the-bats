/* eslint-disable react/no-unescaped-entities */
import type { HelpPageContent } from './index';
import { HelpDefs, HelpDef } from '@/components/help/HelpBlocks';

const orgHelp: HelpPageContent = {
  title: 'Org Admin & Setup',
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
            <li><strong>Set up your org branding.</strong> In <strong>Settings</strong>, upload your logo, pick a colour theme, and confirm your URL slug before you share any links publicly.</li>
            <li><strong>Check your modules.</strong> If your plan includes House League, Rep Teams, or Accounting, each appears automatically in the admin panel — there is no separate activation step. If you expect a module and don't see it, check your plan on <strong>Plan &amp; billing</strong>.</li>
            <li><strong>Invite your volunteers.</strong> Volunteers don&rsquo;t use the main admin area. In <strong>Members → Invite</strong>, choose the Volunteer role and what they&rsquo;re <strong>helping with</strong> (Scoring, The gate, or Both); their phone opens straight to that job.</li>
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
      summary: 'What each role can open, at a glance, then Owner, Admin, Treasurer, Staff, League Admin, League Registrar, Coach, and Volunteer one by one.',
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
                  <tr><th scope="row">Rep Teams</th><td>✓</td><td>✓</td><td>team names only</td><td>—</td><td>—</td><td>—</td><td>—</td><td>their team, in the portal</td></tr>
                  <tr><th scope="row">Accounting</th><td>✓</td><td>✓</td><td>✓</td><td>—</td><td>—</td><td>—</td><td>—</td><td>their team&rsquo;s money</td></tr>
                  <tr><th scope="row">Public site</th><td>✓</td><td>✓</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td></tr>
                  <tr><th scope="row">House league · Tournaments</th><td>✓</td><td>✓</td><td>—</td><td>game day</td><td>the house league</td><td>registrations</td><td>scores &amp; gate</td><td>—</td></tr>
                  <tr><th scope="row">Families</th><td>✓</td><td>if you turn it on</td><td>if you turn it on</td><td>—</td><td>if you turn it on</td><td>if you turn it on</td><td>—</td><td>—</td></tr>
                  <tr><th scope="row">Members</th><td>✓</td><td>✓</td><td>view</td><td>—</td><td>view</td><td>—</td><td>—</td><td>—</td></tr>
                  <tr><th scope="row">Plan &amp; billing · Settings · Audit log</th><td>✓</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td></tr>
                </tbody>
              </table>
              <p><strong>✓</strong> is full access; a shorter answer is the exact slice that role gets — &ldquo;view&rdquo; opens a program read-only, and &ldquo;if you turn it on&rdquo; means the owner has to grant it by hand (Families is never on by default for anyone but the owner). A row only appears on your own organization once your plan includes that program.</p>
              <p><strong>Admin</strong> opens every program the plan carries — the moment it&rsquo;s included, with no separate setup step. It never opens <strong>Families</strong> on its own, and <strong>Plan &amp; billing</strong>, <strong>Settings</strong> and the <strong>audit log</strong> stay owner-only. The menu lists only what you can open, so an admin won&rsquo;t find them there; the club&rsquo;s home page shows <strong>Plan &amp; billing</strong> and <strong>Settings</strong> under <strong>Organization</strong> marked <strong>Owner only</strong>, so it&rsquo;s clear they exist and whose they are.</p>
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
                <li><strong>Admin</strong> — Runs operations: every program the plan carries, members, and branding. Cannot open <strong>Settings</strong>, <strong>Plan &amp; billing</strong>, or the <strong>audit log</strong> — those stay owner-only — and doesn&rsquo;t see <strong>Families</strong> unless the owner turns it on for them.</li>
                <li><strong>Treasurer</strong> — Runs the books: ledgers, the budget, what the club bills its teams, and the teams’ payment requests. Can see the team names money is allocated to, without a Rep Teams door of their own.</li>
                <li><strong>Staff</strong> — Day-of operator. Updates game times and venue assignments, submits scores, and posts announcements. Cannot finalize scores or change a result that&rsquo;s already final, create tournaments, manage registrations, or send communications.</li>
                <li><strong>League Admin</strong> — Runs the house league: seasons, registrations, teams, and schedules. Can view the member list.</li>
                <li><strong>League Registrar</strong> — Reviews and processes house league registrations only. Cannot manage seasons, schedules, or the member list.</li>
                <li><strong>Coach</strong> — Accesses the Coaches Portal for their assigned rep team. Cannot access the main admin panel.</li>
                <li><strong>Volunteer</strong> — Enters scores, checks teams in at the gate, or both, from their phone: whatever they&rsquo;re <strong>helping with</strong>, chosen when you invite them. Scoring opens <strong>Field scores</strong>, the gate opens <strong>Check-in</strong>. Doesn&rsquo;t access the admin panel at all.</li>
              </ul>
              <p><strong>A rep club has no registrar role.</strong> The registration-type work on a rep team — forms, documents, keeping the roster tidy — belongs to that team&rsquo;s <strong>team manager</strong>: a staff member the head coach adds on the team&rsquo;s <strong>Staff</strong> page in the Coaches Portal. League Registrar is for house league only.</p>
              <p>Owners can grant or revoke individual programs on any member from <strong>Members → Manage</strong> — a chip on their row marks anything different from their role&rsquo;s defaults. A volunteer&rsquo;s Manage shows <strong>Helping with</strong> instead, which anyone who can invite members can change.</p>
            </>
          ),
        },
      ],
      faqs: [
        {
          id: 'faq-switch-admin-coach-view',
          question: 'I run the tournament and also coach a team — how do I move between admin and my coach view?',
          answerText: 'If you are an owner or admin who also coaches, the admin area shows a Coaches Portal door (in the desktop sidebar and, on mobile, under More → You) that opens your coach view. From inside your coaches portal, an Admin link returns you to the admin area. On mobile, the admin More menu also has a You section with Home, Chat, and Account so you can reach your own inbox and account without leaving admin. A member with only the Coach role still cannot open the admin panel.',
          keywords: ['coaches portal door', 'admin link', 'back to admin', 'coach view', 'switch admin coach', 'both admin and coach', 'run tournament and coach', 'reach chat from admin', 'account from admin'],
          answer: (
            <>
              <p>If you&rsquo;re an <strong>owner</strong> or <strong>admin</strong> who also coaches, the admin area shows a <strong>Coaches Portal</strong> door (in the desktop sidebar footer, and on mobile under <strong>More → You</strong>) that opens your coach view. From inside your coaches portal, an <strong>Admin</strong> link brings you back.</p>
              <p>On mobile, that same admin <strong>More</strong> menu has a <strong>You</strong> section with <strong>Home</strong>, <strong>Chat</strong>, and <strong>Account</strong>, so you can reach your own inbox and account without leaving admin. A member with <em>only</em> the Coach role still can&rsquo;t open the admin panel — these doors appear only when the same account holds both.</p>
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
            <li>For a volunteer, choose what they&rsquo;re <strong>Helping with</strong>: <strong>Scoring</strong>, <strong>The gate</strong>, or <strong>Both</strong>. The line under it says what they&rsquo;ll be able to do, and they&rsquo;ll land straight on that job. You can change it later in <strong>Manage</strong>.</li>
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
          answerText: 'Choose the narrowest role that lets them do their job. Use Volunteer for scoring games or checking teams in at the gate (choose which under Helping with), Staff for wider day-of operations, Treasurer for accounting, League Registrar for registration review, and Coach for team portal access.',
          keywords: ['role', 'volunteer', 'permissions', 'least access', 'scorekeeper', 'gate', 'helping with'],
          popular: true,
          answer: (
            <p>Choose the narrowest role that lets them do their job. Use <strong>Volunteer</strong> for scoring games or checking teams in at the gate (choose which under <strong>Helping with</strong>), <strong>Staff</strong> for wider day-of tournament help, <strong>Treasurer</strong> for accounting, <strong>League Registrar</strong> for registration review, and <strong>Coach</strong> for coach portal access.</p>
          ),
        },
        {
          id: 'faq-scorekeeper-member-access',
          question: 'What access does a volunteer get?',
          answerText: 'A volunteer gets one or both of two phone screens, by what they are helping with: Field scores for scoring, Check-in for the gate. On Field scores they can enter scores and correct one that is still Pending Review, but they cannot change a result that is already final. They do not get the main admin panel.',
          keywords: ['volunteer', 'scorekeeper', 'official', 'gate', 'volunteer access', 'scorekeeper access', 'field scores', 'check-in', 'change a final score', 'what they can open'],
          answer: (
            <>
              <p>A volunteer gets one or both of two phone screens, by what they&rsquo;re <strong>helping with</strong>: <strong>Field scores</strong> for scoring, <strong>Check-in</strong> for the gate. Members&rsquo; &ldquo;What they can open&rdquo; reads <strong>Scores</strong>, <strong>The gate</strong>, or <strong>Scores and the gate</strong>.</p>
              <p>On Field scores they can enter scores and correct one that&rsquo;s still <strong>Pending Review</strong>, but they can&rsquo;t change a result that&rsquo;s already final. They don&rsquo;t get registrations, settings, billing, exports, communications, or the main admin panel.</p>
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
            <li><strong>Open Manage and look at &ldquo;What [name] can open.&rdquo;</strong> Each program shows the role&rsquo;s default, and you can set <strong>Role default</strong>, <strong>Turn on</strong>, or <strong>Turn off</strong> per row — a sentence appears under a row the moment your change would open or close it for them. For a volunteer, Manage shows <strong>Helping with</strong> instead: a volunteer who meets &ldquo;No access&rdquo; on Field scores or Check-in doesn&rsquo;t hold that job yet.</li>
            <li><strong>Check the plan carries the module at all.</strong> A member can&rsquo;t open Rep Teams, Accounting, Public site, or House league if the plan doesn&rsquo;t include it — see <strong>Plan &amp; billing</strong>.</li>
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
          question: 'Why can a member not see House League, Rep Teams, or Accounting?',
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
      id: 'club-plan-and-billing',
      heading: 'Club plan & billing',
      summary: 'Teams on your plan, Club’s two sizes, moving between them, adding a team at the cap, and what cancelling takes offline.',
      keywords: ['club plan', 'club billing', 'plan and billing', 'teams on your plan', 'club association', 'move to club association', 'team cap', 'add team at the cap', 'cancel club', 'reactivate club', 'capacity'],
      searchText: 'club plan and billing teams on your plan capacity readout club two sizes club association move up prorated today move down at renewal no credit keep current band add team at the cap archive a team contact us custom plan what club includes families rep teams accounting public site house league tournaments unlimited board and staff cancel and suspend goes offline ninety days retention reactivate everything comes back public site online coach portals reopen archived tournaments return',
      links: [
        { label: 'Plan & billing', href: '../org/billing' },
      ],
      content: (
        <p>Plan &amp; billing for a Club shows how many teams you&rsquo;re using, both Club sizes with their prices, and what happens if you move up, move down, or cancel.</p>
      ),
      subtopics: [
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
              <p>Cancelling suspends the club: Rep Teams and every team&rsquo;s coach portal, Accounting, Families, the public site, house league and tournaments all go offline at once, and families who open your pages see that they aren&rsquo;t available. Everything is kept for <strong>90 days</strong>, and cancelling always asks you to confirm — and say why — before it happens.</p>
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
          answerText: 'If your new plan includes fewer tournament slots than you were using, the extra tournaments are archived rather than deleted. A tournament that is currently running is never the one archived — live events are kept. Archived tournaments are retained and come back when you move up to a plan with room for them again.',
          keywords: ['tournaments disappeared', 'tournaments missing', 'tournament archived', 'downgrade', 'smaller plan', 'fewer tournaments', 'plan change tournaments', 'where did my tournament go'],
          answer: (
            <>
              <p>If your new plan includes fewer tournament slots than you were using, the extra tournaments are <strong>archived rather than deleted</strong>, and a tournament that is <strong>currently running is never the one archived</strong> — live events are kept.</p>
              <p>Archived tournaments are retained and come back when you move up to a plan with room for them again.</p>
            </>
          ),
        },
      ],
    },
    {
      heading: 'Inviting and managing members',
      keywords: ['seat limit', 'staff seats', 'volunteers free', 'scorekeepers free', 'officials free', 'do volunteers count', 'do scorekeepers count', 'invite member', 'manage member', 'resend invite', 'helping with', 'staff kit'],
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
          <p><strong>Volunteer links:</strong> each tournament&rsquo;s <strong>Staff kit</strong> holds a QR code and a link for each job, Scorekeeper and Gate, and prints them on one page for the volunteer table. To try the volunteers&rsquo; screens yourself, use <strong>Scorekeeper</strong> on Results &amp; Scoring or <strong>Gate view</strong> on Check-in.</p>
          <p><strong>Seat limits:</strong> Your plan's seat limit counts admins and staff only — <strong>volunteers are free on every plan and never count toward it</strong>, so bring as many as your event needs. The free Tournament plan includes 3 staff seats; if you're near the limit, a banner appears on the Members page with an upgrade link. Paid plans have unlimited staff seats.</p>
          <p>You can <strong>export</strong> your member list (Excel or CSV) from the Members page for your own records.</p>
        </>
      ),
    },
    {
      id: 'notifications-audit',
      heading: 'Notifications and the member audit log',
      summary: 'Set your own notification preferences, and (as owner) review the history of member changes.',
      keywords: ['notifications', 'notification settings', 'manage notifications', 'turn off notifications', 'email alerts', 'push', 'bell', 'notification drawer', 'open a notification', 'read the whole message', 'message cut off', 'where does it go', 'open the request', 'open the bill', 'notifications on my phone', 'where are my notifications', 'no bell on my phone', 'needs attention', 'activity feed', 'earlier this week', 'done', 'mark done', 'clear a notification', 'still showing after i read it', 'mark all read', 'delete a notification', 'trash', 'undo', 'unread', 'load more', 'where did see all go', 'see all', 'bundled', 'chat tab', 'audit log', 'member history', 'when who what to whom', 'time zone', 'export audit log', 'rep teams group change', 'volunteer job change', 'helping with'],
      searchText: 'notifications notification preferences notification settings one page for everything you are part of card per organization team you coach manage notifications turn off notifications change how i am notified account notifications your devices in-app bell email push per event type on a computer the bell opens a drawer down the right side whole list load more no see all link where did see all go settings gear in the drawer header on a phone no bell more notifications page more account notification settings click a notification to open it where you are opens beside the list sheet above the bottom bar small window whole message day and time marked read nothing loads until you choose button names the page open the request open the bill open teams open the team second click needs attention activity feed grouped today yesterday earlier this week earlier pinned stays until you mark it done done button opening it is not dealing with it still in needs attention after i read it read seen done dealt with delete gone from your list mark all read marks everything read delete a notification trash undo a few seconds your own list only everyone else copy request or payment untouched no are you sure unread all toggle inbox you empty filter chips on the page bundled repeated 6 new registrations opens as its list chat tab unread badge chat not in bell member audit log history who changed role owner only export members when who what happened to whom columns house time zone role changes program access turned on turned off invitations sent resent suspensions reinstatements removals rep teams group change no member changes yet did not load try again export excel csv',
      content: (
        <p>Two record-keeping areas sit under Org Admin: your own notification preferences, and — for the owner — the club or organization&rsquo;s audit log of member changes.</p>
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
                <HelpDef term="Done">You&rsquo;ve dealt with it. Only on <strong>Needs attention</strong>, and the only thing that moves one out: those rows <strong>stay until you mark them Done</strong>, read or not.</HelpDef>
                <HelpDef term="Delete">The <strong>trash</strong>, in an opened notification (and, in the drawer, on the row you point at). It takes the notification off <em>your</em> list only: everyone else&rsquo;s copy, and the request or payment it was about, stay as they are. There&rsquo;s no &ldquo;are you sure?&rdquo; — <strong>Undo</strong> brings it back for a few seconds.</HelpDef>
              </HelpDefs>
              <p><strong>Notification settings</strong> are per person, not org-wide: a card per organization (and any team you coach) with <strong>bell</strong>, <strong>email</strong> and <strong>push</strong> switches, and your phones. Open them from the <strong>gear</strong> in the drawer, or on a phone from <strong>More</strong> › <strong>Account</strong> › <strong>Notification settings</strong>. Chat lives on the <strong>Chat</strong> tab, not here.</p>
            </>
          ),
        },
        {
          id: 'notifications-audit-t-audit-log',
          title: 'The member audit log',
          content: (
            <>
              <p>Owner-only, and reachable from <strong>Members → Audit log</strong>. Four columns read as a sentence: <strong>when</strong>, <strong>who</strong>, <strong>what happened</strong>, and <strong>to whom</strong> — for example, &ldquo;Today, 9:14 a.m. · Sam Lee · changed the role to Treasurer · Priya Shah.&rdquo; Times show in your organization&rsquo;s own time zone, not the reader&rsquo;s.</p>
              <p>It records every kind of member change: role changes, program access turned on or off, a volunteer&rsquo;s job (&ldquo;Helping with: Both → The gate&rdquo;), invitations sent, suspensions and reinstatements, removals, and a change to a Rep Teams group&rsquo;s scope. &ldquo;No member changes yet&rdquo; appears only once the log has actually loaded and found nothing — a failed load says so instead, with a way to try again.</p>
              <p>Export the same history as Excel or CSV from the <strong>Export</strong> button at the top of the page.</p>
            </>
          ),
        },
      ],
    },
    {
      id: 'modules',
      heading: 'Modules — what each one does',
      summary: 'What House League, Rep Teams, Accounting, and the public org page add, and which plan includes each.',
      keywords: ['modules', 'house league', 'rep teams', 'accounting', 'public organization page', 'plan'],
      searchText: 'modules house league rep teams accounting public organization page league plus club included plan navigation automatic',
      content: (
        <>
          <p>Modules extend FieldLogicHQ beyond the core tournament tools. Each module adds a new section to your admin panel, shown in the left navigation once it is included in your plan.</p>
          <ul>
            <li><strong>Public Organization Page</strong> — A branded public landing page listing your tournaments, results, and registration links. Included on League Plus and above.</li>
            <li><strong>House League</strong> — Registration, divisions, seasons, game scheduling, standings, and league communications. Included on League Plus and above.</li>
            <li><strong>Accounting</strong> — Org ledger, team invoicing, payment reconciliation, and expense tracking. Included on Club.</li>
            <li><strong>Rep Teams</strong> — Tryouts, rosters, player documents, and the Coaches Portal. Included on Club.</li>
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
        'double booked', 'busy then', 'eastern time', 'time zone', 'export calendar', 'ics', 'read only', 'filter by venue',
      ],
      searchText: 'calendar club calendar whole club schedule every team one page week view list view month view who is on lions park diamond 2 on tuesday clash clashes only amber pill double booked booked by busy then dashed may clash facility not set read window both sides head coach open the team schedule open in the coaches portal house league season schedule tournament day game count venue program team filter places the club doesn’t own export excel csv calendar ics what the page shows times in eastern time time zone sunday night game week read only cannot edit coaches keep their schedule',
      content: (
        <p><strong>Calendar</strong>, directly under <strong>Overview</strong> in the menu (the first row of <strong>More</strong> on a phone), puts the whole club&rsquo;s week on one page and marks where two bookings want the same diamond at once. It is read-only: the coaches and the league keep their own schedules.</p>
      ),
      subtopics: [
        {
          id: 'club-calendar-t-whats-on-it',
          title: 'What the calendar shows',
          content: (
            <>
              <p>Every booking of the programs you can open, in <strong>List</strong>, <strong>Week</strong> or <strong>Month</strong>. It opens on this week.</p>
              <ul>
                <li><strong>Rep teams:</strong> each team&rsquo;s games, practices, team events and tryout days, as the coaches entered them. A booking&rsquo;s left edge is its team&rsquo;s colour.</li>
                <li><strong>House league:</strong> games and practices, marked <em>House league</em>.</li>
                <li><strong>Tournaments:</strong> one booking per tournament day, with its game count. A club team&rsquo;s own games in that tournament sit inside it rather than being listed again.</li>
              </ul>
              <p>A place the club doesn&rsquo;t own (an away park, a school field) shows exactly as the coach typed it. Every time is in <strong>Eastern time</strong>, and the page says so once. A Sunday game at 9:30 p.m. stays in its own week, on any device.</p>
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
                <HelpDef term="The amber count">Beside &ldquo;Times in Eastern time.&rdquo;, the week&rsquo;s number of clashes. Click it to show only the clashes; click again to show everything.</HelpDef>
              </HelpDefs>
              <p>Open a booking to read both sides together: when, where (with the address), the team and its head coach, then <strong>Clashes with</strong> &mdash; the other booking, its diamond and its head coach. The link at the bottom opens that team&rsquo;s schedule (or <strong>Open in the Coaches Portal</strong>, if you coach the team), a house-league season&rsquo;s schedule, or the tournament. Nobody is notified about a clash; the club settles it.</p>
            </>
          ),
        },
        {
          id: 'club-calendar-t-filters-export',
          title: 'Filters and Export',
          content: (
            <>
              <p><strong>Venue</strong>, <strong>Program</strong> and <strong>Team</strong> narrow the page; each choice shows its count. <strong>Places the club doesn&rsquo;t own</strong> collects the bookings that aren&rsquo;t on one of your venues. Filters start fresh each time you open the page. On a phone they sit behind <strong>Filter</strong>, and the view switch is the icon beside the title.</p>
              <p><strong>Export</strong> saves what the page shows (the week or month on screen, as filtered) as <strong>Excel</strong>, <strong>CSV</strong> or a <strong>Calendar</strong> (.ics) file. The line at the top of its menu says what the file holds.</p>
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
      id: 'venue-library',
      heading: 'The Venue library — your club’s venues and who books them',
      summary: 'Organization › Venue library: the club’s venues and their facilities, who books each this season, renaming a facility, and Archive or Delete.',
      keywords: [
        'venue library', 'venues', 'facilities', 'diamond', 'field', 'court', 'rink', 'add venue', 'rename facility',
        'archive venue', 'delete venue', 'bring back', 'booked by', 'archived venues', 'who can edit venues',
      ],
      searchText: 'venue library venues facilities fields diamonds courts rinks gym add venue name address notes open in maps booked by this season teams house league tournament who books it rename a facility rename a diamond upcoming bookings keep the old name past games families calendar no notice archive a venue bring back archived venues out of every picker delete venue nothing books it cannot delete in use league admin can save treasurer read only refused save says why could not load try again tournament import from library organization tile',
      content: (
        <p><strong>Organization › Venue library</strong> is the club&rsquo;s one list of venues and their facilities. Coaches, house league and tournaments pick from it, and two bookings on the same facility at the same time are flagged. It comes with League Plus and Club.</p>
      ),
      subtopics: [
        {
          id: 'venue-library-t-who',
          title: 'Who can change it',
          content: (
            <p>The owner, admins, league admins and anyone given the tournament permission can add and change venues. Everyone else who can open Organization reads the library, with no <strong>Add venue</strong> and no pencil. If a save is refused, the window says why.</p>
          ),
        },
        {
          id: 'venue-library-t-add-edit',
          title: 'Adding and changing a venue',
          content: (
            <>
              <ol>
                <li>Click <strong>Add venue</strong> and enter its name, its address (it powers the map link on every schedule), its facilities with their kind, and any notes.</li>
                <li>Press <strong>Add venue</strong>. Nothing saves until you do.</li>
              </ol>
              <p>The table shows each venue&rsquo;s facilities and who books it this season. Click a venue to read it: its address, notes, each facility&rsquo;s upcoming bookings, and the teams, house-league season and tournaments that book it. The pencil turns the whole venue into its form, and every change saves as you go; the check mark turns it back.</p>
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
      heading: 'Settings and your org slug',
      summary: 'The owner-only Settings page: your public site switches, URL slug, branding, hero banner, fonts, and account deletion.',
      keywords: ['settings', 'org slug', 'branding', 'logo', 'hero banner', 'font', 'card style', 'delete organization', 'stock logo', 'public site switch', 'listed in the directory', 'online offline', 'public site editor'],
      searchText: 'org settings owner only name url slug change redirect branding logo stock logos hero banner theme font card style colour theme delete organization account deletion danger zone your public site public site switch online offline listed in the directory discover directory public site editor online offline chip refused save says why',
      content: (
        <p>The <strong>Settings</strong> page is <strong>owner-only</strong>. It controls your organization&rsquo;s name, URL slug, whether your public site is switched on, and the look of your public pages.</p>
      ),
      subtopics: [
        {
          id: 'settings-t-public-site',
          title: 'Your public site',
          content: (
            <>
              <p><strong>Your public site</strong> is two separate switches, and each saves the moment you set it — there&rsquo;s nothing to save separately below.</p>
              <ul>
                <li><strong>Public site</strong> — takes your whole home page and league pages online or offline. Turning it off asks first, and names exactly what goes offline today: the home page and the league pages (team pages and tryout forms aren&rsquo;t affected yet). Turned off, families who open your pages see that they aren&rsquo;t available.</li>
                <li><strong>Listed in the directory</strong> — controls whether families searching FieldLogicHQ&rsquo;s public directory can find you. Your site stays online either way; this switch is off, and greyed out, whenever the public site itself is off.</li>
              </ul>
              <p>The <strong>Public Site</strong> editor is where you fill in that home page&rsquo;s content — a tagline, sections and more. It shows an <strong>Online</strong>/<strong>Offline</strong> chip reading the switch above; the switch itself is only ever set here, in Settings.</p>
            </>
          ),
        },
        {
          id: 'settings-t-slug',
          title: 'Your URL slug',
          content: (
            <>
              <p><strong>URL slug</strong> — the identifier used in all your public URLs: <code>fieldlogichq.ca/your-slug/</code>. It appears in your registration forms, schedule pages, tournament links, and any URLs you&rsquo;ve shared publicly or included in past emails.</p>
              <p>Changing your slug takes effect immediately. Every existing link will stop working — there is no redirect. Before saving a new slug:</p>
              <ul>
                <li>Update any links you&rsquo;ve posted on social media or your website</li>
                <li>Note that registration form links sent to coaches in past emails will break</li>
                <li>Consider the timing — avoid changing mid-tournament</li>
              </ul>
            </>
          ),
        },
        {
          id: 'settings-t-branding',
          title: 'Branding and appearance',
          content: (
            <>
              <p><strong>Branding and appearance</strong> — upload your own logo or pick one from the <strong>stock logo</strong> library, choose a colour theme, set a <strong>theme font</strong> and <strong>card style</strong>, and add a <strong>hero banner</strong> image across the top of your organization&rsquo;s home page. This is <strong>organization-level</strong> branding and it comes with <strong>League and Club</strong> plans. Tournament and Tournament Plus brand each <strong>event</strong> individually instead — from that tournament&rsquo;s own settings, with full control per event — and their organization address keeps FieldLogicHQ&rsquo;s default styling.</p>
            </>
          ),
        },
        {
          id: 'settings-t-delete',
          title: 'Deleting your organization',
          content: (
            <>
              <p><strong>Danger zone</strong> — the bottom of Settings has a <strong>Request Account Deletion</strong> flow for closing the organization.</p>
              <p>Requiring an admin to review scores before results go public is a per-tournament setting in each event&rsquo;s settings, not an org-wide Settings option.</p>
            </>
          ),
        },
      ],
    },
    {
      id: 'public-org-page',
      heading: 'Your public organization page — what visitors see',
      summary: 'How families move around your public pages: section tabs, the trail back up, the way into the app, and the shortcut back to admin for your own staff.',
      keywords: [
        'public organization page', 'public page', 'org page', 'what visitors see', 'section tabs',
        'tabs', 'navigation', 'breadcrumb', 'trail', 'home league archives', 'sections',
        'discover link', 'back to the app', 'bottom bar', 'phone navigation', 'mobile navigation',
        'event card colour', 'event card color', 'tinted cards', 'return to admin from public page',
        'admin shortcut', 'coaches portal shortcut', 'flip', 'public site',
      ],
      searchText: 'public organization page what families see visitors see fans see section tabs tab row home league archives navigation between sections breadcrumb trail org name links back to the front page discover link way back into the app scores chat account bottom bar on a phone mobile bottom navigation app bar desktop unchanged event cards wear their own event colour tinted per event branding red event purple event return to admin from my public page shortcut back admin coaches portal flip pill remembers the screen i left league club only tournament plus breadcrumb instead teams tab missing rep teams',
      content: (
        <>
          <p>Your organization&rsquo;s public address — <code>fieldlogichq.ca/your-slug/</code> — is where families land from a search, a shared link, or your own website. This is what they can do once they are there.</p>
        </>
      ),
      subtopics: [
        {
          id: 'public-org-page-sections',
          title: 'Moving between your sections',
          content: (
            <p>On <strong>League and Club</strong> plans, a row of tabs sits under your organization&rsquo;s name — <strong>Home</strong>, <strong>League</strong>, <strong>Archives</strong> — so a visitor can move straight between them instead of reversing back to your front page each time. The row appears only when you actually have more than one section to offer. On <strong>Tournament</strong> and <strong>Tournament Plus</strong>, you get a simpler trail instead: your organization&rsquo;s name followed by the section, like <em>Cedarvale Ravens &rsaquo; Archives</em>, with the name itself linking back to your front page.</p>
          ),
        },
        {
          id: 'public-org-page-app-access',
          title: 'How visitors get into the app from your pages',
          content: (
            <>
              <p><strong>On a phone, families keep the app.</strong> On phone-sized screens your public pages carry the FieldLogicHQ bottom bar — <strong>Home</strong>, <strong>Scores</strong>, <strong>Chat</strong> and <strong>Account</strong> (a signed-out visitor sees Home, Scores and Sign In). Before this, a family who reached your league or archive pages on a phone had no route back into the app except the browser&rsquo;s Back button.</p>
              <p>Your own header sheds its utility links on phones so your organization&rsquo;s name gets the whole row to itself: Discover, Account and Sign In move to that bottom bar, and <strong>our Pricing link is dropped altogether</strong> — your pages are yours, and we don&rsquo;t advertise on them. <strong>Desktop is deliberately unchanged</strong>: no FieldLogicHQ bar sits above your name there.</p>
              <p><strong>The way into the app on desktop</strong> is a single quiet <strong>Discover</strong> link in your page header, next to Pricing. It opens the public directory of tournaments, teams and organizations.</p>
            </>
          ),
        },
        {
          id: 'public-org-page-event-colours',
          title: 'Your events keep their own colours',
          content: (
            <p>When your front page lists several tournaments, each card wears <em>that event&rsquo;s</em> branding rather than one shared colour — so a red event and a purple event look like themselves, and each card looks like the page it opens.</p>
          ),
        },
        {
          id: 'public-org-page-admin-shortcut',
          title: 'Your shortcut back to admin',
          content: (
            <p>If you help run this organization and you are signed in, a <strong>&#8646;</strong> pill appears in the corner of your own public pages and takes you back to your admin area or Coaches Portal in the same tab. It remembers the exact screen you came from, so a quick look at the public site and back is two taps. Families and signed-out visitors never see it. If you hold more than one role here, the pill opens a short list so you can pick.</p>
          ),
        },
      ],
      faqs: [
        {
          id: 'faq-public-page-no-teams-tab',
          question: 'Why is there no Teams tab on my public page?',
          answerText: 'Rep teams do not have a public index page yet, so there is nowhere for a Teams tab to lead. Individual team pages exist, each with a link back to your front page, but your front page does not list them. The exception is tryouts: while a team\'s tryout registration is open, your front page shows a Tryouts Are Open card that takes families straight to that tryout\'s page, which links to the team\'s own page. The tab appears once the index page ships. The row deliberately leaves it out rather than offering a tab that would bounce the visitor somewhere unexpected.',
          keywords: ['teams tab', 'no teams tab', 'rep teams missing', 'teams section', 'tryouts link', 'tryouts are open', 'team page link'],
          answer: (
            <>
              <p>Rep teams don&rsquo;t have a public <em>index</em> page yet — there is no single page listing them — so there is nowhere for a Teams tab to lead. Individual team pages do exist, each with a link back to your front page, but your front page doesn&rsquo;t list them.</p>
              <p>The exception is tryouts: while a team&rsquo;s tryout registration is open, your front page shows a <strong>Tryouts Are Open</strong> card that takes families straight to that tryout&rsquo;s page, which links on to the team&rsquo;s own page.</p>
              <p>The tab appears as soon as that index page ships. Until then the row deliberately leaves it out rather than offering a tab that would bounce the visitor somewhere unexpected.</p>
            </>
          ),
        },
        {
          id: 'faq-public-page-tabs-missing',
          question: 'I have League and Archives but I don&rsquo;t see the section tabs — why?',
          answerText: 'The tab row comes with League and Club plans. On Tournament and Tournament Plus you get the simpler breadcrumb trail instead - your organization name followed by the section, with the name linking back to your front page. The row also needs at least two sections to show at all: if your front page is the only public section you have, there is nowhere to navigate to and the row stays hidden.',
          keywords: ['tabs missing', 'no section tabs', 'tab row not showing', 'league club only', 'why no tabs'],
          answer: (
            <>
              <p>Two reasons, and one of them may be your plan. The tab row comes with <strong>League and Club</strong>; on Tournament and Tournament Plus you get the breadcrumb trail instead.</p>
              <p>The row also needs <strong>at least two sections</strong> to appear at all. If your front page is the only public section you have, there is nowhere to navigate to, so the row stays hidden rather than showing a single tab.</p>
            </>
          ),
        },
      ],
    },
  ],
};

export default orgHelp;
