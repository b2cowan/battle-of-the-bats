/* eslint-disable react/no-unescaped-entities */
import type { HelpPageContent } from './index';

const orgHelp: HelpPageContent = {
  title: 'Org Admin & Setup',
  role: 'Owner, Admin',
  intro: 'This guide covers your organization\'s setup — who can do what, how to invite members, and how to manage your plan and settings.',
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
            <li><strong>Enable your first module.</strong> If your plan includes House League, Rep Teams, or other modules, go to <strong>Subscription</strong> and request activation. Each module unlocks a new section in the admin panel.</li>
            <li><strong>Invite scorekeepers.</strong> Scorekeepers don't use the main admin area. Add them via <strong>Members → Invite Member</strong> using the Scorekeeper role, then assign the tournaments they should score.</li>
          </ol>
        </>
      ),
    },
    {
      heading: 'Roles explained — who can do what',
      content: (
        <>
          <p>Every member of your org is assigned one of these roles. Roles control what pages and actions they can access.</p>
          <ul>
            <li><strong>Owner</strong> — Full access. Owns the org, manages the subscription, and can do everything admins can. Assigned at org creation; ownership cannot be transferred through the admin panel.</li>
            <li><strong>Admin</strong> — Manages tournaments, house league, rep teams, and org settings. Cannot manage the subscription.</li>
            <li><strong>Staff</strong> — Day-of operator. Updates game times and diamond assignments, submits scores, and posts announcements. Cannot create tournaments, manage registrations, or send communications.</li>
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
      summary: 'Invite a paid Coaches Portal, approve Basic visibility requests, take over billing, and start ownership transfer approval when both sides agree.',
      keywords: ['coaches portal links', 'coaches portal', 'invite coach portal', 'approve request', 'parent organization', 'basic visibility', 'org billing', 'coach portal billing', 'ownership transfer'],
      searchText: 'invite review approve decline coaches portal link request parent organization club association basic visibility sharing billing transfer org billing ownership roster documents accounting',
      links: [
        { label: 'Coaches Portal Links', href: '../org/team-links' },
      ],
      content: (
        <>
          <p>Owners and admins can manage Basic visibility links with paid Coaches Portals from <strong>Org Admin &gt; Coaches Portal Links</strong>.</p>
          <ol>
            <li>Open <strong>Org Admin &gt; Coaches Portal Links</strong>.</li>
            <li>To invite a paid Coaches Portal, enter the portal URL slug or primary coach email, then click <strong>Send Invite</strong>.</li>
            <li>The coach reviews the invitation from their Coaches Portal and chooses <strong>Accept Invitation</strong> or <strong>Decline</strong>.</li>
            <li>For coach-requested links, review the portal name, team name, requested sharing level, and current billing mode.</li>
            <li>Click <strong>Approve Link</strong> if the team should be associated with your organization.</li>
            <li>Click <strong>Decline</strong> if the team is not part of your organization.</li>
            <li>Use Link history later to confirm what was approved or declined.</li>
          </ol>
          <p>Approving a coach request or receiving a coach&apos;s acceptance creates a <strong>Basic visibility</strong> link only. It does not transfer billing, ownership, player roster access, documents, accounting data, or org-wide rep-team admin access.</p>
          <p>After the Basic link is active, use the <strong>Org billing</strong> section to invite the coach to move billing, or approve a coach&apos;s billing request. Choose annual or monthly checkout when both sides have approved. The portal becomes org-billed Coaches Portal Premium, but Basic sharing stays in place and the coach keeps operational ownership.</p>
          <p>Use org-billed Coaches Portal when your organization wants to pay for one or two coach-operated teams without taking over roster, document, accounting, or rep-team administration. Use Club when the organization needs the full multi-team operating layer: rep-team administration, accounting oversight, house league, public site, staff access, and lower extra-team pricing.</p>
          <p>If your organization is paying for three or more linked Premium portals, Coaches Portal Links and Billing may show a Club value nudge. This is guidance only: org-billed portals can stay active, and Club or ownership transfer still requires the normal approval path.</p>
          <p>Use <strong>Ownership transfer</strong> only when the team should become org-owned. Phase 5A records mutual approval from the coach and organization; final roster, schedule, document, budget, and accounting reassignment is platform-assisted.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-basic-team-link-access',
          question: 'What can we see after approving a Basic visibility link?',
          answerText: 'You can see the approved association and basic Coaches Portal summary. You do not receive roster, documents, accounting, billing, or full rep-team admin access from this approval.',
          keywords: ['basic visibility', 'coaches portal link access', 'roster', 'documents', 'billing'],
          popular: true,
          answer: (
            <p>You can see the approved association and basic Coaches Portal summary. You do not receive roster, documents, accounting, billing, or full rep-team admin access from this approval.</p>
          ),
        },
        {
          id: 'faq-team-link-invite-access',
          question: 'Can we invite a Coaches Portal without taking over the team?',
          answerText: 'Yes. Sending a Basic visibility invitation only asks the coach to confirm the association. Billing takeover is a separate action after the Basic link is active.',
          keywords: ['invite coaches portal', 'basic visibility', 'ownership', 'billing'],
          answer: (
            <p>Yes. Sending a Basic visibility invitation only asks the coach to confirm the association. Billing takeover is a separate action after the Basic link is active.</p>
          ),
        },
        {
          id: 'faq-team-link-ownership-transfer',
          question: 'When should we use ownership transfer?',
          answerText: 'Use ownership transfer only when the Team should become a normal org-owned rep team. It is separate from Basic visibility and org billing because it changes data ownership and access for roster, documents, schedule, budget, and accounting records.',
          keywords: ['ownership transfer', 'org owned team', 'club transfer', 'roster access'],
          answer: (
            <p>Use ownership transfer only when the Team should become a normal org-owned rep team. It is separate from Basic visibility and org billing because it changes data ownership and access for roster, documents, schedule, budget, and accounting records.</p>
          ),
        },
        {
          id: 'faq-team-link-org-billing',
          question: 'What happens when we take over billing for a linked Coaches Portal?',
          answerText: 'Your organization becomes the payer for that Premium portal. The portal remains coach-operated, and this does not unlock roster, documents, accounting, ownership, or org-wide rep-team admin access.',
          keywords: ['org billing', 'coaches portal billing', 'billing transfer', 'organization pays'],
          answer: (
            <p>Your organization becomes the payer for that Premium portal. The portal remains coach-operated, and this does not unlock roster, documents, accounting, ownership, or org-wide rep-team admin access.</p>
          ),
        },
        {
          id: 'faq-team-addon-vs-club',
          question: 'When should we use org-billed Coaches Portal instead of Club?',
          answerText: 'Use org-billed Coaches Portal for a small number of coach-operated linked teams. Club is the better fit when the organization needs multi-team oversight, full rep-team administration, accounting, staff access, public site, house league, or lower extra-team pricing.',
          keywords: ['coaches portal billing', 'club', 'multi-team', 'pricing', 'rep teams'],
          popular: true,
          answer: (
            <p>Use org-billed Coaches Portal for a small number of coach-operated linked teams. Club is the better fit when the organization needs multi-team oversight, full rep-team administration, accounting, staff access, public site, house league, or lower extra-team pricing.</p>
          ),
        },
        {
          id: 'faq-team-tournament-plus',
          question: 'Do linked Coaches Portals include Tournament Plus features?',
          answerText: 'No. Coaches Portal Premium includes one free-tier local tournament slot for simple events. Tournament Plus features such as unlimited tournament slots, advanced registration controls, enhanced branding, cloning, and post-event reporting require Tournament Plus or a higher organization plan.',
          keywords: ['Coaches Portal tournaments', 'Tournament Plus', 'free tournament slot', 'upgrade'],
          answer: (
            <p>No. Coaches Portal Premium includes one free-tier local tournament slot for simple events. Tournament Plus features such as unlimited tournament slots, advanced registration controls, enhanced branding, cloning, and post-event reporting require Tournament Plus or a higher organization plan.</p>
          ),
        },
        {
          id: 'faq-team-link-club-nudge',
          question: 'Why do we see a Club value nudge?',
          answerText: 'The nudge appears when the organization is paying for three or more linked Premium portals. Club is usually the better multi-team operating layer, but the prompt does not change billing, sharing, ownership, or access by itself.',
          keywords: ['club nudge', 'multi-team', 'coaches portal billing', 'club value'],
          answer: (
            <p>The nudge appears when the organization is paying for three or more linked Premium portals. Club is usually the better multi-team operating layer, but the prompt does not change billing, sharing, ownership, or access by itself.</p>
          ),
        },
      ],
    },
    {
      id: 'recipe-invite-member',
      group: 'How-to recipes',
      heading: 'How to invite a member and choose the right role',
      summary: 'Add a new admin, staff member, treasurer, registrar, coach, or scorekeeper without over-granting access.',
      keywords: ['invite member', 'role', 'permissions', 'staff', 'admin', 'treasurer', 'registrar', 'coach', 'scorekeeper'],
      searchText: 'invite member choose role permissions owner admin staff treasurer league admin league registrar coach scorekeeper resend pending invite seats',
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
            <li>Send the invite, then confirm the person appears as <strong>Pending</strong> until they accept.</li>
          </ol>
          <p>If they do not receive the email, ask them to check spam first. Then use the resend option from their pending invite row.</p>
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
      heading: 'How to turn on modules included in your plan',
      summary: 'Enable House League, Rep Teams, Accounting, or public organization pages when your plan includes them.',
      keywords: ['enable module', 'activate module', 'house league', 'rep teams', 'accounting', 'public organization page'],
      searchText: 'enable module activate module included in plan house league rep teams accounting public organization page subscription billing upgrade module missing',
      links: [
        { label: 'Billing', href: '../org/billing' },
      ],
      content: (
        <>
          <p>Modules appear in the admin navigation only after they are active for your organization.</p>
          <ol>
            <li>Go to <strong>Org Admin &gt; Billing</strong>.</li>
            <li>Review your current plan and included modules.</li>
            <li>Open the module area and activate any included module you want to use.</li>
            <li>Refresh the admin panel. The new module should appear in the navigation for members with matching access.</li>
            <li>If the module is locked, review upgrade options or contact support if you believe it should already be included.</li>
          </ol>
          <p>Activating a module gives the organization the feature. Members still need the correct role or capability before they can use it.</p>
        </>
      ),
    },
    {
      id: 'recipe-handle-subscription-issue',
      group: 'How-to recipes',
      heading: 'How to handle billing, past-due, or upgrade issues',
      summary: 'Know what owners should check before contacting support about subscription access.',
      keywords: ['billing', 'subscription', 'past due', 'upgrade', 'payment method', 'plan limit', 'stripe'],
      searchText: 'billing subscription past due payment failed update payment method manage subscription stripe checkout upgrade plan limit seat limit tournament slot module locked',
      links: [
        { label: 'Billing', href: '../org/billing' },
      ],
      content: (
        <>
          <p>Only owners can manage billing. If an admin sees a locked module or plan limit, ask an owner to review the subscription.</p>
          <ol>
            <li>Go to <strong>Org Admin &gt; Billing</strong>.</li>
            <li>Check the current plan, active modules, tournament slot usage, and seat usage.</li>
            <li>If payment is past due, open <strong>Manage Subscription</strong> and update the payment method in Stripe.</li>
            <li>If a workflow is locked by plan, choose the appropriate upgrade or contact support for help choosing a plan.</li>
            <li>If the plan looks correct but access is still locked, note the organization name, expected feature, and screenshot of the billing page before contacting support.</li>
          </ol>
          <p>During active events, do not wait until the day of play to resolve billing blockers. Check access during setup so support has time to help.</p>
        </>
      ),
    },
    {
      heading: 'Inviting and managing members',
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
          <p><strong>Seat limits:</strong> Your plan determines how many non-scorekeeper seats you can have. Scorekeepers are free on most plans. If you're near your limit, a banner will appear on the Members page with an upgrade link.</p>
        </>
      ),
    },
    {
      heading: 'Modules — what each one does and how to enable',
      content: (
        <>
          <p>Modules extend FieldLogicHQ beyond the core tournament tools. Each module unlocks a new section in your admin panel and appears in the left navigation once enabled.</p>
          <ul>
            <li><strong>Public Organization Page</strong> — A branded public landing page listing your tournaments, results, and registration links. Included on League and above.</li>
            <li><strong>House League</strong> — Registration, divisions, seasons, game scheduling, standings, and league communications. Included on League and above.</li>
            <li><strong>Accounting</strong> — Org ledger, team invoicing, payment reconciliation, and expense tracking. Included on Club.</li>
            <li><strong>Rep Teams</strong> — Tryouts, rosters, player documents, and the Coaches Portal. Included on Club.</li>
          </ul>
          <p>To enable a module your plan includes, go to <strong>Subscription → Modules</strong> and use the activation option there. Modules are enabled per-org — contact support if you expect a module to be available but don't see the activation option.</p>
        </>
      ),
    },
    {
      heading: 'Subscription and plan management',
      content: (
        <>
          <p>The <strong>Subscription</strong> page (visible to Owners only) shows your current plan, tournament slot usage, seat usage, and available upgrades.</p>
          <p>The free Tournament plan is meant for one starter event with standard registration, basic selected-row registration updates, waitlist collection, and FieldLogicHQ default public styling. Tournament Plus is the serious tournament operations plan: unlimited tournament slots, 10 staff seats, custom registration questions, Excel and PDF exports for registrations, schedules, and results — useful for check-in sheets, insurance submissions, and post-event board reports — payment reminders, waitlist promotion, full branding, automation, cloning, and post-event reporting.</p>
          <p>Org-billed Coaches Portal is separate from Club extra teams. It pays for a coach-operated Premium portal. Club included or extra teams are org-owned rep teams under Club. Club includes the first three active rep teams, then uses the lower Club extra-team rate for additional active teams.</p>
          <p>To upgrade to Tournament Plus, click <strong>Upgrade to Tournament Plus</strong>. You'll be taken to secure Stripe Checkout to enter payment details. Your first payment is collected automatically after the 14-day trial. League and Club are shown as coming soon until those tiers open for self-serve checkout.</p>
          <p>If you're on a paid plan, use <strong>Manage Subscription</strong> to update your payment method, view past invoices, or cancel. This opens the Stripe customer portal.</p>
          <p><strong>Past-due payments:</strong> If a payment fails, your access stays active during a grace period. Update your payment method via <strong>Manage Subscription</strong> before the grace period ends to avoid service interruption.</p>
        </>
      ),
    },
    {
      heading: 'Settings and your org slug',
      content: (
        <>
          <p>The <strong>Settings</strong> page (Owner only) controls your org name, URL slug, branding, and scoring preferences.</p>
          <p><strong>URL slug</strong> — This is the identifier used in all your public URLs: <code>fieldlogichq.ca/your-slug/</code>. It appears in your registration forms, schedule pages, tournament links, and any URLs you've shared publicly or included in past emails.</p>
          <p>Changing your slug takes effect immediately. Every existing link will stop working — there is no redirect. Before saving a new slug:</p>
          <ul>
            <li>Update any links you've posted on social media or your website</li>
            <li>Note that registration form links sent to coaches in past emails will break</li>
            <li>Consider the timing — avoid changing mid-tournament</li>
          </ul>
          <p><strong>Branding</strong> — Free Tournament orgs use FieldLogicHQ default public styling. Tournament Plus and higher can upload logos, choose tournament colours, and control more of the public tournament appearance. Public organization page branding is part of the broader public-site tiers.</p>
          <p><strong>Score finalization</strong> — When enabled, scorekeeper submissions are visible to the public but not marked final until an admin reviews them in the Results page. Individual tournaments can inherit this organization setting or override it in Event Settings. Useful if your org requires a second review before results are final.</p>
        </>
      ),
    },
  ],
};

export default orgHelp;
