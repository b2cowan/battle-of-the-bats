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
            <li><strong>Invite field officials.</strong> Officials don't use the main admin area — they receive a direct scoring link. Add them via <strong>Members → Invite Member</strong> using the Official role.</li>
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
            <li><strong>Official</strong> — Submits scores for their assigned games only via the scorekeeper app. Does not access the admin panel at all.</li>
          </ul>
          <p>Owners can grant or revoke individual capabilities on any member via <strong>Members → Manage</strong>. This lets you fine-tune access without changing someone's base role.</p>
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
            <li>Restrict them to specific tournaments (useful for staff and officials at multi-event orgs)</li>
            <li>Grant or revoke individual capabilities beyond their role defaults</li>
            <li>Suspend or reinstate their access</li>
          </ul>
          <p>To resend an invitation to someone who hasn't accepted yet, click the mail icon on their row. Pending invites appear with a "Pending" status badge.</p>
          <p><strong>Seat limits:</strong> Your plan determines how many non-official seats you can have. Officials are free on most plans. If you're near your limit, a banner will appear on the Members page with an upgrade link.</p>
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
          <p>To upgrade, click <strong>Upgrade to [Plan Name]</strong> on the plan card that's right for your org. You'll be taken to secure Stripe Checkout to enter payment details. Your first payment is collected automatically after the trial: 14 days for Tournament Plus, 30 days for League, and 90 days for the Club early-adopter trial.</p>
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
          <p><strong>Branding</strong> — Upload a logo (JPG, PNG, or WebP, max 2 MB), choose a colour theme, and optionally set a hero banner for your public page (League and above). Changes apply to the public site immediately after saving.</p>
          <p><strong>Score finalization</strong> — When enabled, official score submissions are visible to the public but not marked final until an admin reviews them in the Results page. Useful if your org requires a second review before results are official.</p>
        </>
      ),
    },
  ],
};

export default orgHelp;
