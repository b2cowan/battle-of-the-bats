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
            <li><strong>Check your modules.</strong> If your plan includes House League, Rep Teams, or Accounting, each appears automatically in the admin panel — there is no separate activation step. If you expect a module and don't see it, check your plan on <strong>Billing</strong>.</li>
            <li><strong>Invite scorekeepers.</strong> Scorekeepers don't use the main admin area. Add them via <strong>Members → Invite Member</strong> using the Scorekeeper role, then assign the tournaments they should score.</li>
          </ol>
        </>
      ),
    },
    {
      id: 'roles',
      heading: 'Roles explained — who can do what',
      summary: 'Owner, Admin, Staff, Treasurer, League Admin, League Registrar, Coach, and Scorekeeper — and what each can do.',
      keywords: ['roles', 'permissions', 'owner', 'admin', 'staff', 'treasurer', 'league admin', 'registrar', 'coach', 'scorekeeper'],
      searchText: 'roles permissions who can do what owner admin staff treasurer league admin league registrar coach scorekeeper capabilities grant revoke org settings billing owner only',
      content: (
        <>
          <p>Every member of your org is assigned one of these roles. Roles control what pages and actions they can access.</p>
          <ul>
            <li><strong>Owner</strong> — Full access. Owns the org, manages the subscription, and can do everything admins can. Assigned at org creation; ownership cannot be transferred through the admin panel.</li>
            <li><strong>Admin</strong> — Runs operations: tournaments, house league, rep teams, members, and branding. Cannot open org <strong>Settings</strong> or the <strong>Subscription</strong> — those are owner-only.</li>
            <li><strong>Staff</strong> — Day-of operator. Updates game times and venue assignments, submits scores, and posts announcements. Cannot create tournaments, manage registrations, or send communications.</li>
            <li><strong>Treasurer</strong> — Access to accounting and ledgers only. Cannot access tournament management or other admin areas.</li>
            <li><strong>League Admin</strong> — Manages house league seasons, registrations, teams, and schedules. Scoped to the House League module.</li>
            <li><strong>League Registrar</strong> — Reviews and processes house league registrations only. Cannot manage seasons or schedules.</li>
            <li><strong>Coach</strong> — Accesses the Coaches Portal for their assigned rep team. Cannot access the main admin panel.</li>
            <li><strong>Scorekeeper</strong> — Submits scores for assigned tournaments via Scorekeeper View at <code>/{'{orgSlug}'}/scorekeeper</code>. Does not access the admin panel at all.</li>
          </ul>
          <p>Owners can grant or revoke individual capabilities on any member via <strong>Members → Manage</strong>. This lets you fine-tune access without changing someone's base role.</p>
        </>
      ),
    },
    {
      id: 'recipe-review-team-link-request',
      group: 'How-to recipes',
      heading: 'How to invite or review Coaches Portal links',
      summary: 'Invite or approve Basic visibility links with coach-run teams, and start ownership transfer when both sides agree.',
      keywords: ['coaches portal links', 'coaches portal', 'invite coach portal', 'approve request', 'parent organization', 'basic visibility', 'ownership transfer'],
      searchText: 'invite review approve decline coaches portal link request parent organization club association basic visibility sharing ownership transfer roster documents accounting',
      links: [
        { label: 'Coaches Portal Links', href: '../org/coaches-portal-links' },
      ],
      content: (
        <>
          <p>Owners and admins can connect coach-run Coaches Portals to the organization from <strong>Org Admin &gt; Coaches Portal Links</strong>.</p>
          <ol>
            <li>Open <strong>Org Admin &gt; Coaches Portal Links</strong>.</li>
            <li>To invite a Coaches Portal, enter the portal URL slug or primary coach email, then click <strong>Send Invite</strong>.</li>
            <li>The coach reviews the invitation from their Coaches Portal and chooses <strong>Accept Invitation</strong> or <strong>Decline</strong>.</li>
            <li>For coach-requested links, review the portal name, team name, and requested sharing level.</li>
            <li>Click <strong>Approve Link</strong> if the team should be associated with your organization, or <strong>Decline</strong> if it is not.</li>
            <li>Use Link history later to confirm what was approved or declined.</li>
          </ol>
          <p>Approving a coach request or receiving a coach&apos;s acceptance creates a <strong>Basic visibility</strong> link only. It records the association — it does not give the organization access to the team&apos;s roster, documents, or accounting, or change who runs the team.</p>
          <p>Use <strong>Ownership transfer</strong> only when a coach-run team should become a normal org-owned rep team. Both the coach and the organization approve it, after which the team&apos;s roster, schedule, documents, and accounting move under the organization.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-basic-team-link-access',
          question: 'What can we see after approving a Basic visibility link?',
          answerText: 'You can see the approved association and a basic Coaches Portal summary. You do not receive the team’s roster, documents, accounting, or full rep-team admin access from this approval.',
          keywords: ['basic visibility', 'coaches portal link access', 'roster', 'documents'],
          popular: true,
          answer: (
            <p>You can see the approved association and a basic Coaches Portal summary. You do not receive the team&apos;s roster, documents, accounting, or full rep-team admin access from this approval.</p>
          ),
        },
        {
          id: 'faq-team-link-invite-access',
          question: 'Can we invite a Coaches Portal without taking over the team?',
          answerText: 'Yes. Sending a Basic visibility invitation only asks the coach to confirm the association — it does not change who runs the team or move any of its data.',
          keywords: ['invite coaches portal', 'basic visibility', 'ownership'],
          answer: (
            <p>Yes. Sending a Basic visibility invitation only asks the coach to confirm the association — it does not change who runs the team or move any of its data.</p>
          ),
        },
        {
          id: 'faq-team-link-ownership-transfer',
          question: 'When should we use ownership transfer?',
          answerText: 'Use ownership transfer only when a coach-run team should become a normal org-owned rep team. It is stronger than a Basic visibility link because it moves data ownership and access for roster, documents, schedule, and accounting records.',
          keywords: ['ownership transfer', 'org owned team', 'club transfer', 'roster access'],
          answer: (
            <p>Use ownership transfer only when a coach-run team should become a normal org-owned rep team. It is stronger than a Basic visibility link because it moves data ownership and access for roster, documents, schedule, and accounting records.</p>
          ),
        },
      ],
    },
    {
      id: 'recipe-invite-member',
      group: 'How-to recipes',
      heading: 'How to invite a member and choose the right role',
      summary: 'Add a new admin, staff member, treasurer, registrar, coach, or scorekeeper without over-granting access.',
      keywords: ['invite member', 'role', 'permissions', 'staff', 'admin', 'treasurer', 'registrar', 'coach', 'scorekeeper', 'accept invitation', 'email link'],
      searchText: 'invite member choose role permissions owner admin staff treasurer league admin league registrar coach scorekeeper resend pending invite seats invited person signed up created their own organization by mistake wrong organization sign-up recognizes email me my invitation link accept invitation setup link',
      links: [
        { label: 'Members', href: '../org/members' },
      ],
      content: (
        <>
          <p>Use this when someone needs access to help run the organization, a tournament, house league, rep teams, accounting, or score entry.</p>
          <ol>
            <li>Go to <strong>Org Admin &gt; Members</strong>.</li>
            <li>Click <strong>Invite Member</strong>.</li>
            <li>Enter the person's email address.</li>
            <li>Choose the lowest role that matches their job. Use <strong>Admin</strong> only for trusted co-organizers who need broad access.</li>
            <li>If the person only needs a narrow workflow, use a scoped role such as <strong>Treasurer</strong>, <strong>League Registrar</strong>, <strong>Coach</strong>, or <strong>Scorekeeper</strong>.</li>
            <li>For scorekeepers, assign the tournaments they should score so their Scorekeeper View stays focused on the right event.</li>
            <li>When inviting a scorekeeper or gate volunteer, pick what they're <strong>helping with</strong> (Scorekeeping or Gate / check-in) so their invite link opens straight to the right screen.</li>
            <li>Send the invite, then confirm the person appears as <strong>Pending</strong> until they accept.</li>
          </ol>
          <p><strong>Invited members don't get a password</strong> — the invite email contains a setup link they must click to finish creating their account. If they try to "log in" before clicking it, they'll see an incorrect-email-or-password error. If they didn't receive the email, ask them to check spam, then use the resend option on their pending invite row.</p>
          <p>If an invited person creates an account on their own instead of using the email link, the sign-up screen now recognizes their email and offers to <strong>email them their invitation link</strong> — so they end up in your organization instead of accidentally starting a new one. Tell them to click that button (or the link in the original email); they never need to "create an organization" to accept.</p>
          <p><strong>Access rule of thumb:</strong> owners manage billing and organization settings, admins run operations, staff handle day-of tasks, and scorekeepers use <code>/{'{orgSlug}'}/scorekeeper</code> rather than the main admin panel.</p>
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
      keywords: ['member cannot access', 'missing page', 'permission', 'suspended', 'pending invite', 'module access'],
      searchText: 'member cannot access missing page locked button permission role capability suspended pending invite resend module not enabled subscription seat limit',
      links: [
        { label: 'Members', href: '../org/members' },
        { label: 'Billing', href: '../org/billing' },
      ],
      content: (
        <>
          <p>When someone says they cannot see a page or action, check these items in order:</p>
          <ol>
            <li><strong>Confirm they accepted the invite.</strong> Pending members cannot use the admin panel yet. Resend the invite if needed.</li>
            <li><strong>Check whether their account is suspended.</strong> Suspended members stay listed but cannot access protected workflows.</li>
            <li><strong>Review their role.</strong> A registrar will not see accounting, a treasurer will not see tournament setup, and a scorekeeper normally will not see the admin panel.</li>
            <li><strong>For scorekeepers, review tournament assignment.</strong> If they cannot find games, confirm they are assigned to the tournament and that games exist for the selected date.</li>
            <li><strong>Review individual capabilities.</strong> Owners can grant or remove specific capabilities from a member's manage screen.</li>
            <li><strong>Check whether the module is enabled.</strong> A member cannot access House League, Rep Teams, Accounting, or public-site features if the org does not have that module active.</li>
            <li><strong>Check seat limits.</strong> If you are at the plan's seat limit, new non-official users may require an upgrade before they can be added.</li>
          </ol>
          <p>If all of those look correct and access is still wrong, capture the user's email, role, expected page, and exact error message before contacting support.</p>
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
            <p>They need both the right member access and the right organization module. Check their role/capabilities on <strong>Members</strong>, then confirm the module is enabled from billing or subscription settings.</p>
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
        { label: 'Billing', href: '../org/billing' },
      ],
      content: (
        <>
          <p>Modules appear in the admin navigation automatically once your plan includes them — there is no separate activation step.</p>
          <ol>
            <li>Go to <strong>Org Admin &gt; Billing</strong>.</li>
            <li>Review your current plan and its included modules.</li>
            <li>Look in the left navigation — included modules show up there for members with matching access.</li>
            <li>If a module is missing, it is not part of your current plan. Review upgrade options, or contact support if you believe it should already be included.</li>
          </ol>
          <p>Having a module gives the organization the feature. Members still need the correct role or capability before they can use it.</p>
        </>
      ),
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
          <p>To resend an invitation to someone who hasn't accepted yet, click the mail icon on their row. Pending invites appear with a "Pending" status badge.</p>
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
      keywords: ['notifications', 'notification settings', 'manage notifications', 'turn off notifications', 'email alerts', 'push', 'bell', 'needs attention', 'activity feed', 'unread', 'see all', 'bundled', 'chat tab', 'audit log', 'member history'],
      searchText: 'notifications notification preferences notification settings one page for everything you are part of card per organization team you coach manage notifications turn off notifications change how i am notified account notifications your devices in-app bell email push per event type needs attention activity feed grouped today yesterday earlier pinned unread all toggle inbox you empty see all full notifications page filter chips bundled repeated 6 new registrations one tap chat tab unread badge chat not in bell member audit log history who changed role owner only export members',
      content: (
        <>
          <p>Two record-keeping areas sit under Org Admin:</p>
          <ul>
            <li><strong>Notifications</strong> — your personal notification settings. The <strong>Notification settings</strong> link in the bell opens <strong>one page for everything you&rsquo;re part of</strong> — a card per organization (and any team you coach), each with switches for the <strong>bell</strong>, <strong>email</strong>, and <strong>push</strong> per kind of event, plus your phones in one place. Settings are per person, not org-wide.</li>
            <li><strong>Member audit log</strong> — an owner-only history of member changes (roles granted, suspensions, and similar), reachable from the Members area, so you can see who changed what and when.</li>
          </ul>
          <p>Inside the <strong>bell</strong> itself, anything that needs a decision from you — a failed payment, a team marked no-show, an assistant-coach approval to review — is pinned at the top under <strong>Needs attention</strong> and clears from there as you handle each one. Everything else sits below as an <strong>Activity</strong> feed, grouped by <strong>Today</strong>, <strong>Yesterday</strong>, and <strong>Earlier</strong>, with repeats <strong>bundled</strong> into one line (&ldquo;6 new registrations&rdquo;) you can open in a tap.</p>
          <p>The bell opens on <strong>Unread</strong>, so reading something clears it from view — an inbox you empty; flip to <strong>All</strong> to see everything with read items dimmed, and use the <strong>See all</strong> link at the bottom for the full, filterable history. Chat messages live on the <strong>Chat</strong> tab with its own unread badge, not in the bell.</p>
        </>
      ),
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
          <p>Modules appear automatically once your plan includes them — there is no separate activation step. If you expect a module and don't see it, confirm your plan on <strong>Billing</strong>, or contact support.</p>
        </>
      ),
    },
    {
      id: 'settings',
      heading: 'Settings and your org slug',
      summary: 'The owner-only Settings page: org name, URL slug, branding, hero banner, fonts, and account deletion.',
      keywords: ['settings', 'org slug', 'branding', 'logo', 'hero banner', 'font', 'card style', 'delete organization', 'stock logo'],
      searchText: 'org settings owner only name url slug change redirect branding logo stock logos hero banner theme font card style colour theme delete organization account deletion danger zone discover listed public directory',
      content: (
        <>
          <p>The <strong>Settings</strong> page is <strong>owner-only</strong>. It controls your org name, URL slug, and the look of your public pages.</p>
          <p><strong>URL slug</strong> — the identifier used in all your public URLs: <code>fieldlogichq.ca/your-slug/</code>. It appears in your registration forms, schedule pages, tournament links, and any URLs you've shared publicly or included in past emails.</p>
          <p>Changing your slug takes effect immediately. Every existing link will stop working — there is no redirect. Before saving a new slug:</p>
          <ul>
            <li>Update any links you've posted on social media or your website</li>
            <li>Note that registration form links sent to coaches in past emails will break</li>
            <li>Consider the timing — avoid changing mid-tournament</li>
          </ul>
          <p><strong>Branding and appearance</strong> — upload your own logo or pick one from the <strong>stock logo</strong> library, choose a colour theme, set a <strong>theme font</strong> and <strong>card style</strong>, and add a <strong>hero banner</strong> image for your public pages. Free Tournament orgs use FieldLogicHQ default styling; logos, colours, and the hero banner become available on Tournament Plus and higher. There is also a toggle to list your organization on the public <strong>/discover</strong> directory.</p>
          <p><strong>Danger zone</strong> — the bottom of Settings has a <strong>Request Account Deletion</strong> flow for closing the organization.</p>
          <p>Requiring an admin to review scores before results go public is a per-tournament setting in each event's settings, not an org-wide Settings option.</p>
        </>
      ),
    },
  ],
};

export default orgHelp;
