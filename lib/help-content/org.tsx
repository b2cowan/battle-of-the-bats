/* eslint-disable react/no-unescaped-entities */
import type { HelpPageContent } from './index';

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
            <li><strong>Invite scorekeepers.</strong> Scorekeepers don't use the main admin area. Add them via <strong>Members → Invite Member</strong> using the Scorekeeper role, then assign the tournaments they should score.</li>
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
      summary: 'What each role can open, at a glance, then Owner, Admin, Treasurer, Staff, League Admin, League Registrar, Coach, and Scorekeeper one by one.',
      keywords: ['roles', 'permissions', 'owner', 'admin', 'staff', 'treasurer', 'league admin', 'registrar', 'team manager', 'coach', 'scorekeeper', 'what each role can open', 'role guide', 'plan & billing', 'billing', 'audit log', 'families'],
      searchText: 'roles permissions who can do what owner admin staff treasurer league admin league registrar rep club no registrar team manager forms documents coach scorekeeper capabilities grant revoke org settings plan and billing subscription owner only what each role can open role guide table rep teams accounting public site house league tournaments families members audit log locked owner only rows',
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
                    <th scope="col">Scorekeeper</th>
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
              <p><strong>Admin</strong> opens every program the plan carries — the moment it&rsquo;s included, with no separate setup step. It never opens <strong>Families</strong> on its own, and <strong>Plan &amp; billing</strong>, <strong>Settings</strong> and the <strong>audit log</strong> stay owner-only; an admin sees those as locked rows rather than a surprise &ldquo;access denied.&rdquo;</p>
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
                <li><strong>Treasurer</strong> — Runs the books: ledgers, the budget, and allocations to teams. Can see the team names money is allocated to, without a Rep Teams door of their own.</li>
                <li><strong>Staff</strong> — Day-of operator. Updates game times and venue assignments, submits scores, and posts announcements. Cannot create tournaments, manage registrations, or send communications.</li>
                <li><strong>League Admin</strong> — Runs the house league: seasons, registrations, teams, and schedules. Can view the member list.</li>
                <li><strong>League Registrar</strong> — Reviews and processes house league registrations only. Cannot manage seasons, schedules, or the member list.</li>
                <li><strong>Coach</strong> — Accesses the Coaches Portal for their assigned rep team. Cannot access the main admin panel.</li>
                <li><strong>Scorekeeper</strong> — Submits scores for assigned tournaments via Scorekeeper View at <code>/{'{orgSlug}'}/scorekeeper</code>. Doesn&rsquo;t access the admin panel at all.</li>
              </ul>
              <p><strong>A rep club has no registrar role.</strong> The registration-type work on a rep team — forms, documents, keeping the roster tidy — belongs to that team&rsquo;s <strong>team manager</strong>: a staff member the head coach adds on the team&rsquo;s <strong>Staff</strong> page in the Coaches Portal. League Registrar is for house league only.</p>
              <p>Owners can grant or revoke individual programs on any member from <strong>Members → Manage</strong> — a chip on their row marks anything different from their role&rsquo;s defaults.</p>
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
      summary: 'Add a new admin, treasurer, staff member, registrar, or scorekeeper without over-granting access.',
      keywords: ['invite member', 'role', 'permissions', 'staff', 'admin', 'treasurer', 'registrar', 'coach', 'scorekeeper', 'accept invitation', 'email link', 'runs the club', 'house league group', 'volunteers group', 'another organization', 'coach staff page'],
      searchText: 'invite member choose role permissions owner admin staff treasurer league admin league registrar coach scorekeeper resend pending invite seats invited person signed up created their own organization by mistake wrong organization sign-up recognizes email me my invitation link accept invitation setup link grouped role list runs the club house league volunteers sentence under the field already a member at another club verified network one home organization coaches added on the team staff page invitation names who sent it lands where role starts',
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
            <li>For a scorekeeper, pick what they&rsquo;re <strong>helping with</strong> (Scorekeeping or Gate / check-in) so their invite link opens straight to the right screen.</li>
            <li>Send the invite, then confirm the person appears as <strong>Invited</strong> until they accept.</li>
          </ol>
          <p><strong>Coaches aren&rsquo;t invited from here.</strong> A team&rsquo;s head coach adds and removes their own coaching staff on that team&rsquo;s own staff page — coaching rows never appear in this dropdown.</p>
          <p><strong>Someone already active at another club or organization can accept your invite too</strong> — the same person can hold roles at more than one, and accepting yours doesn&rsquo;t remove them from anywhere else. The one exception is a scorekeeper, who keeps a single home organization.</p>
          <p><strong>Invited members don&rsquo;t get a password</strong> — the email has a setup link they must click to finish creating their account; clicking &ldquo;log in&rdquo; first shows an incorrect-email-or-password error, so ask them to check spam and use the resend option on their pending row if it&rsquo;s missing. If they sign up on their own instead, FieldLogicHQ recognizes their email and offers to email them the invitation link, so they land in your organization rather than starting a new one.</p>
          <p><strong>Access rule of thumb:</strong> owners hold Plan &amp; billing and Settings, admins run every program the plan carries, staff and scorekeepers handle day-of work, and each accepted invite names who sent it and opens straight to where that role&rsquo;s work starts — a treasurer in Accounting, a league role in the house league, everyone else at the admin overview.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-best-role-for-helper',
          question: 'What role should I give a new volunteer?',
          answerText: 'Choose the narrowest role that lets them do their job. Use Staff for day-of operations, Treasurer for accounting, League Registrar for registration review, Coach for team portal access, and Scorekeeper for score entry.',
          keywords: ['role', 'volunteer', 'permissions', 'least access'],
          popular: true,
          answer: (
            <p>Choose the narrowest role that lets them do their job. Use <strong>Staff</strong> for day-of tournament help, <strong>Treasurer</strong> for accounting, <strong>League Registrar</strong> for registration review, <strong>Coach</strong> for coach portal access, and <strong>Scorekeeper</strong> for field score entry.</p>
          ),
        },
        {
          id: 'faq-scorekeeper-member-access',
          question: 'What access does a scorekeeper get?',
          answerText: 'Scorekeepers get the lightweight Scorekeeper View for assigned tournaments and do not get the main admin panel.',
          keywords: ['scorekeeper', 'official', 'scorekeeper access', 'assigned tournaments'],
          answer: (
            <p>Scorekeepers get the lightweight <strong>Scorekeeper View</strong> for assigned tournaments. They can enter scores and see scoring states, but they do not get registrations, settings, billing, exports, communications, or the main admin panel.</p>
          ),
        },
      ],
    },
    {
      id: 'recipe-fix-member-access',
      group: 'How-to recipes',
      heading: 'How to fix member access problems',
      summary: 'Troubleshoot missing pages, locked buttons, pending invites, suspended users, and module access.',
      keywords: ['member cannot access', 'missing page', 'permission', 'suspended', 'pending invite', 'module access', 'what they can open', 'chip', 'role default', 'turn on', 'turn off', 'one save', 'coach staff page'],
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
            <li><strong>Open Manage and look at &ldquo;What [name] can open.&rdquo;</strong> Each program shows the role&rsquo;s default, and you can set <strong>Role default</strong>, <strong>Turn on</strong>, or <strong>Turn off</strong> per row — a sentence appears under a row the moment your change would open or close it for them.</li>
            <li><strong>Check the plan carries the module at all.</strong> A member can&rsquo;t open Rep Teams, Accounting, Public site, or House league if the plan doesn&rsquo;t include it — see <strong>Plan &amp; billing</strong>.</li>
            <li><strong>Check seat limits.</strong> At the plan&rsquo;s seat limit, a new admin or staff member may need an upgrade before they can be added; scorekeepers and coaching staff never count toward it.</li>
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
      keywords: ['seat limit', 'staff seats', 'scorekeepers free', 'officials free', 'do scorekeepers count', 'invite member', 'manage member', 'resend invite'],
      searchText: 'seat limit staff seats how many seats do scorekeepers count toward limit officials free seats free tournament 3 seats upgrade invite member manage role restrict tournaments resend pending invite export member list',
      content: (
        <>
          <p>Go to <strong>Members</strong> and click <strong>Invite Member</strong>. Enter the person's email and pick their role. They'll receive an invitation email with a link to accept and set up their account.</p>
          <p>Once a member has accepted, click <strong>Manage</strong> on their row to:</p>
          <ul>
            <li>Change their role</li>
            <li>Restrict them to specific tournaments (useful for staff and scorekeepers at multi-event orgs)</li>
            <li>Grant or revoke individual capabilities beyond their role defaults</li>
            <li>Suspend or reinstate their access</li>
          </ul>
          <p>To resend an invitation to someone who hasn't accepted yet, open <strong>Manage</strong> on their row and choose <strong>Resend invite</strong>. Someone who hasn&rsquo;t accepted yet shows as <strong>Invited</strong> on their row.</p>
          <p><strong>Scorekeeper links:</strong> Scorekeepers use <code>/{'{orgSlug}'}/scorekeeper</code>. Admins can also open Scorekeeper View from Results &amp; Scoring when they need to test the field workflow.</p>
          <p><strong>Seat limits:</strong> Your plan's seat limit counts admins and staff only — <strong>scorekeepers and officials are free on every plan and never count toward it</strong>, so bring as many day-of volunteers as your event needs. The free Tournament plan includes 3 staff seats; if you're near the limit, a banner appears on the Members page with an upgrade link. Paid plans have unlimited staff seats.</p>
          <p>You can <strong>export</strong> your member list (Excel or CSV) from the Members page for your own records.</p>
        </>
      ),
    },
    {
      id: 'notifications-audit',
      heading: 'Notifications and the member audit log',
      summary: 'Set your own notification preferences, and (as owner) review the history of member changes.',
      keywords: ['notifications', 'notification settings', 'manage notifications', 'turn off notifications', 'email alerts', 'push', 'bell', 'needs attention', 'activity feed', 'earlier this week', 'clear', 'clear a notification', 'still showing after i read it', 'unread', 'see all', 'bundled', 'chat tab', 'audit log', 'member history', 'when who what to whom', 'time zone', 'export audit log', 'rep teams group change'],
      searchText: 'notifications notification preferences notification settings one page for everything you are part of card per organization team you coach manage notifications turn off notifications change how i am notified account notifications your devices in-app bell email push per event type needs attention activity feed grouped today yesterday earlier this week earlier pinned stays until you clear it clear button opening it is not dealing with it still in needs attention after i read it mark all read leaves it alone unread all toggle inbox you empty see all full notifications page filter chips bundled repeated 6 new registrations one tap chat tab unread badge chat not in bell member audit log history who changed role owner only export members when who what happened to whom columns house time zone role changes program access turned on turned off invitations sent resent suspensions reinstatements removals rep teams group change no member changes yet did not load try again export excel csv',
      content: (
        <p>Two record-keeping areas sit under Org Admin: your own notification preferences, and — for the owner — the club or organization&rsquo;s audit log of member changes.</p>
      ),
      subtopics: [
        {
          id: 'notifications-audit-t-notifications',
          title: 'Notifications',
          content: (
            <>
              <p><strong>Notifications</strong> are your own personal settings. The <strong>Notification settings</strong> link in the bell opens <strong>one page for everything you&rsquo;re part of</strong> — a card per organization (and any team you coach), each with switches for the <strong>bell</strong>, <strong>email</strong>, and <strong>push</strong> per kind of event, plus your phones in one place. Settings are per person, not org-wide.</p>
              <p>Inside the <strong>bell</strong> itself, anything that needs a decision from you — a failed payment, a team marked no-show, an assistant-coach approval to review — is pinned at the top under <strong>Needs attention</strong>. Those rows <strong>stay until you tap Clear</strong> on them: opening one isn&apos;t the same as dealing with it, so the count keeps telling you what&apos;s genuinely outstanding. (<strong>Mark all read</strong> leaves them alone for the same reason.) Everything else sits below as an <strong>Activity</strong> feed, grouped by <strong>Today</strong>, <strong>Yesterday</strong>, <strong>Earlier this week</strong>, and <strong>Earlier</strong>, with repeats <strong>bundled</strong> into one line (&ldquo;6 new registrations&rdquo;) you can open in a tap.</p>
              <p>The bell opens on <strong>Unread</strong>, so reading something clears it from view — an inbox you empty; flip to <strong>All</strong> to see everything with read items dimmed, and use the <strong>See all</strong> link at the bottom for the full, filterable history. Chat messages live on the <strong>Chat</strong> tab with its own unread badge, not in the bell.</p>
            </>
          ),
        },
        {
          id: 'notifications-audit-t-audit-log',
          title: 'The member audit log',
          content: (
            <>
              <p>Owner-only, and reachable from <strong>Members → Audit log</strong>. Four columns read as a sentence: <strong>when</strong>, <strong>who</strong>, <strong>what happened</strong>, and <strong>to whom</strong> — for example, &ldquo;Today, 9:14 a.m. · Sam Lee · changed the role to Treasurer · Priya Shah.&rdquo; Times show in your organization&rsquo;s own time zone, not the reader&rsquo;s.</p>
              <p>It records every kind of member change: role changes, program access turned on or off, invitations sent, suspensions and reinstatements, removals, and a change to a Rep Teams group&rsquo;s scope. &ldquo;No member changes yet&rdquo; appears only once the log has actually loaded and found nothing — a failed load says so instead, with a way to try again.</p>
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
      id: 'settings',
      heading: 'Settings and your org slug',
      summary: 'The owner-only Settings page: your public site switches, URL slug, branding, hero banner, fonts, venue library, and account deletion.',
      keywords: ['settings', 'org slug', 'branding', 'logo', 'hero banner', 'font', 'card style', 'delete organization', 'stock logo', 'public site switch', 'listed in the directory', 'online offline', 'venue library', 'public site editor'],
      searchText: 'org settings owner only name url slug change redirect branding logo stock logos hero banner theme font card style colour theme delete organization account deletion danger zone your public site public site switch online offline listed in the directory discover directory public site editor online offline chip venue library fields diamonds rinks refused save says why',
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
              <p>If your plan includes a <strong>venue library</strong>, its own page lets you define your fields, diamonds and rinks once and reuse them — house league schedules use them, and tournaments import them. A save that&rsquo;s refused now says why (for example, the plan doesn&rsquo;t include it, or you don&rsquo;t hold the permission).</p>
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
