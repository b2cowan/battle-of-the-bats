/* eslint-disable react/no-unescaped-entities */
import type { HelpPageContent } from './index';

const platformAdminHelp: HelpPageContent = {
  title: 'Platform Admin Operations',
  role: 'Platform Admin',
  searchPlaceholder: 'Search platform admin SOPs...',
  intro:
    'Employee-only workflows for supporting FieldLogicHQ customers. Use this guide when you need to reset access, explain customer-facing docs, apply temporary billing or module exceptions, investigate account history, or manage platform staff access.',
  sections: [
    {
      id: 'where-to-work',
      group: 'Orientation',
      heading: 'Where to work first',
      summary: 'Use the right platform-admin area for the request before changing account state.',
      keywords: ['overview', 'organizations', 'customer users', 'plans pricing', 'bulk operations', 'audit'],
      links: [
        { label: 'Organizations', href: '/platform-admin/orgs' },
        { label: 'Customer Users', href: '/platform-admin/customer-users' },
        { label: 'Audit Log', href: '/platform-admin/audit' },
      ],
      content: (
        <>
          <p>Start from the smallest surface that answers the support question.</p>
          <ul>
            <li><strong>Customer Users</strong> is best when the request is about a person: password reset, login status, last sign-in, or which organizations they belong to.</li>
            <li><strong>Organizations</strong> is best when the request is about an account: plan, status, modules, members, tournaments, notes, and account-specific audit history.</li>
            <li><strong>Bulk Operations</strong> is only for intentional multi-account changes. Every run needs a reason and writes batch plus per-org audit entries.</li>
            <li><strong>Plans &amp; Pricing</strong> is for product packaging, feature matrix, live plan configuration, Stripe price IDs, and approved catalog changes.</li>
            <li><strong>Audit Log</strong> is the source of truth for who changed what and when.</li>
          </ul>
          <p>If a customer is asking how to use the app, open the customer-facing guide from the Help Center first. Platform employees see those same guide articles from `/platform-admin/help` without needing to enter a customer org.</p>
        </>
      ),
    },
    {
      id: 'reset-password',
      group: 'Support SOP',
      heading: 'How to reset a customer password',
      summary: 'Generate a password reset link from Customer Users and share it securely.',
      keywords: ['password', 'reset', 'login', 'customer users', 'recovery link', 'forgot password'],
      searchText: 'how do i reset a password customer cannot login generate recovery link customer users copy reset link',
      links: [
        { label: 'Customer Users', href: '/platform-admin/customer-users' },
        { label: 'Customer login help', href: '/platform-admin/help/org' },
      ],
      content: (
        <>
          <ol>
            <li>Go to <strong>Customer Users</strong>.</li>
            <li>Search at least two characters from the user's email, name, user ID, organization, or org slug.</li>
            <li>Confirm you have the right person by checking their email and organization memberships.</li>
            <li>Click <strong>Reset</strong> on the user's row.</li>
            <li>Copy the generated reset link and send it through the support channel already being used with the customer.</li>
            <li>Ask the customer to open the link and set a new password. Do not set or ask for the customer's password.</li>
          </ol>
          <p>The reset action is audit-logged as <code>generate_reset_link</code>. If the generated link fails, have the customer use the normal <strong>Forgot password</strong> flow from the login page, then verify their email address and auth status in Customer Users.</p>
          <p>If the customer belongs to multiple organizations, resetting the password affects the same login across all of their FieldLogicHQ memberships.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-reset-link-expiry',
          question: 'How long does a generated reset link last?',
          answer: (
            <p>Supabase controls the recovery-link lifetime for the project. Treat every generated link as short-lived and ask the customer to use it right away. Generate a new link if they report that it expired.</p>
          ),
          answerText: 'Supabase controls the recovery-link lifetime. Ask the customer to use it right away and generate a new link if it expires.',
          keywords: ['expire', 'expiry', 'reset link'],
          popular: true,
        },
        {
          id: 'faq-reset-unknown-email',
          question: 'What if the user row has no usable email?',
          answer: (
            <p>Do not generate a link. Search by organization first, verify the member record from the org detail People tab, then confirm the correct email with the customer before taking action.</p>
          ),
          answerText: 'Search by organization first, verify the member record, and confirm the correct email before taking action.',
          keywords: ['unknown email', 'missing email'],
        },
      ],
    },
    {
      id: 'manage-customer-user-access',
      group: 'Support SOP',
      heading: 'How to manage a customer user\'s access and details',
      summary: 'Ban, unban, sign out, confirm email, edit details, or add support notes for a single user from Customer Users.',
      keywords: ['ban user', 'unban', 'revoke sessions', 'sign out', 'confirm email', 'verify email', 'edit user', 'change email', 'display name', 'user notes', 'lock account', 'suspend'],
      searchText: 'ban a user unban suspend lock account revoke sessions sign out all devices force logout confirm verify email change a user email display name edit user info user support notes customer users actions menu',
      links: [
        { label: 'Customer Users', href: '/platform-admin/customer-users' },
      ],
      content: (
        <>
          <p>These actions all live behind the <strong>Actions</strong> menu on a user&apos;s row in <strong>Customer Users</strong>. Confirm you have the right person — check the email and organization memberships — before using them. Each action affects the user&apos;s single FieldLogicHQ login across all of their org memberships.</p>
          <ul>
            <li><strong>Ban User</strong> immediately blocks sign-in. Use it for abuse, fraud, or a security hold. The user keeps their data but cannot log in. Choose <strong>Unban User</strong> to restore access.</li>
            <li><strong>Revoke Sessions</strong> signs the user out of all devices and invalidates active sessions without banning them. Use it after a suspected account compromise or when the user asks to be logged out everywhere.</li>
            <li><strong>Confirm Email</strong> force-confirms an unconfirmed email so the user can proceed without the verification message. It only appears when the user&apos;s auth status is <code>unconfirmed</code>. Verify you are talking to the real account holder first.</li>
            <li><strong>Edit Info</strong> corrects a user&apos;s email address or display name. Changing the email changes the address they sign in with — confirm the new address with the customer first.</li>
            <li><strong>Notes</strong> opens <strong>Support Notes</strong> for that user, for person-level context. These are separate from an organization&apos;s internal notes: use org notes for account history and user notes for person-specific history.</li>
          </ul>
          <p>For password recovery use <strong>Reset Password</strong> (see <em>How to reset a customer password</em>). For permanent removal use <strong>Delete User</strong> (see <em>How to delete a user</em>). Ban, unban, and revoke-sessions each ask for confirmation, and all of these actions are audit-logged.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-ban-vs-revoke',
          question: 'Should I ban the user or just revoke their sessions?',
          answer: (
            <p>Revoke sessions when you only need to sign them out everywhere — for example a lost device — because they can sign back in afterward. Ban when they should not be able to sign in at all until you lift it. Neither action deletes any data.</p>
          ),
          answerText: 'Revoke sessions signs them out but they can sign back in. Ban blocks sign-in entirely until lifted. Neither deletes data.',
          keywords: ['ban vs revoke', 'sign out', 'block login'],
          popular: true,
        },
        {
          id: 'faq-confirm-email-safe',
          question: 'Is it safe to use Confirm Email for a customer who never received the verification email?',
          answer: (
            <p>Yes, once you have verified you are speaking with the real account holder. Confirm Email marks the address as verified so they can continue. If you cannot verify their identity, have them use the normal resend/verification flow instead.</p>
          ),
          answerText: 'Yes, after verifying you are speaking with the real account holder. Otherwise use the normal resend/verification flow.',
          keywords: ['confirm email', 'verification', 'unconfirmed'],
        },
      ],
    },
    {
      id: 'billing-overrides',
      group: 'Billing SOP',
      heading: 'How to temporarily override billing access',
      summary: 'Use org overrides for support windows, grace periods, trial exceptions, and comp periods.',
      keywords: ['billing', 'override', 'subscription status', 'comp period', 'grace period', 'past due', 'active'],
      searchText: 'how do i override billing requirements subscription status active comp period grace period customer unsubscribed expired trial',
      links: [
        { label: 'Organizations', href: '/platform-admin/orgs' },
        { label: 'Bulk Operations', href: '/platform-admin/bulk-operations' },
      ],
      content: (
        <>
          <p>Use an override when the customer should keep access for a defined support reason without rewriting their base billing record. Overrides are different from plan changes: they sit on top of billing state, can expire, and can be revoked.</p>
          <ol>
            <li>Go to <strong>Organizations</strong>, open the customer account, then open <strong>Billing &amp; Access</strong>.</li>
            <li>Under <strong>Active Overrides</strong>, click <strong>Add Override</strong>.</li>
            <li>Choose <strong>Subscription Status</strong> when the account should behave as <code>active</code>, <code>trialing</code>, <code>past_due</code>, or <code>canceled</code> for a temporary period.</li>
            <li>Choose <strong>Comp Period</strong> when the business decision is a no-charge access window with a clear end date.</li>
            <li>Set an expiry whenever the exception is temporary. Use the shortest reasonable period.</li>
            <li>Enter a reason that would make sense to another employee reading the audit trail later.</li>
            <li>Apply the override, then add or update the internal support note with the customer-facing context and follow-up date.</li>
          </ol>
          <p>Expired active overrides appear as platform-admin alerts. Revoke them when the support window is done, or create a new override with a fresh reason if the extension is approved.</p>
          <p>Changing the base plan or tournament limit is a separate guarded flow in the same <strong>Billing &amp; Access</strong> tab. Use it only when the customer's actual package should change.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-override-vs-plan-change',
          question: 'Should I use an override or change the base plan?',
          answer: (
            <p>Use an override for temporary access exceptions. Change the base plan only when the customer's contracted package is actually changing. Base plan changes affect limits and may normalize billing fields, especially when moving to the free Tournament plan.</p>
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
      summary: 'Grant an org-specific module override without changing the plan feature matrix.',
      keywords: ['module', 'addon', 'add-on', 'entitlement', 'unsubscribed', 'house league', 'rep teams', 'accounting', 'public site'],
      searchText: 'how do i provide access to modules for unsubscribed override billing requirements enable addon module access house league rep teams accounting public site',
      links: [
        { label: 'Organizations', href: '/platform-admin/orgs' },
        { label: 'Plans & Pricing', href: '/platform-admin/plans-pricing' },
        { label: 'Bulk Operations', href: '/platform-admin/bulk-operations' },
      ],
      content: (
        <>
          <p>Module overrides are for account-specific exceptions: pilots, implementation support, make-good access, or a sales-approved temporary enablement. They do not change the global plan feature matrix.</p>
          <ol>
            <li>Confirm who approved the exception and how long it should last. Module overrides do not currently carry their own expiry, so the follow-up note matters.</li>
            <li>Open <strong>Organizations</strong>, then open the customer account.</li>
            <li>Open the <strong>Entitlements</strong> tab.</li>
            <li>Under <strong>Module Overrides</strong>, turn on the module the plan does not normally include: Public Site, House League, Accounting, or Rep Teams.</li>
            <li>Click <strong>Save Overrides</strong>.</li>
            <li>Add an internal support note with the module, approval source, expected end date, and customer-facing reason.</li>
            <li>Ask the customer to refresh their admin shell. The module should appear in their navigation if their role also has the relevant capability.</li>
          </ol>
          <p>If the customer needs the account to remain usable while unpaid or past due, pair the module override with the right billing override from <strong>Billing &amp; Access</strong>. Module access and billing status are separate controls.</p>
          <p>To remove the exception, return to <strong>Entitlements</strong>, turn the module off, save, and leave a note. For many organizations, use <strong>Bulk Operations</strong> with <strong>Module Add-On Enablement</strong>.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-module-not-visible',
          question: 'The module is enabled but the customer still cannot see it. What should I check?',
          answer: (
            <p>Check both access layers: the org must have the module through plan entitlement or module override, and the signed-in member must have a role or capability that allows that module. Ask the customer to refresh after changes.</p>
          ),
          answerText: 'Check the org entitlement and the member role/capability. The customer should refresh after changes.',
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
      keywords: ['feedback', 'triage', 'bug report', 'feature request', 'escalate', 'escalation', 'related issue', 'support queue'],
      searchText: 'how do i triage customer feedback bug reports feature requests move new triaged acknowledged resolved escalate to product view related issue error group flag for product',
      links: [
        { label: 'Feedback', href: '/platform-admin/feedback' },
        { label: 'Observability', href: '/platform-admin/observability' },
      ],
      content: (
        <>
          <p><strong>Feedback</strong> collects bug reports, feature requests, and general feedback submitted from inside the app — admin, coach, scorekeeper, and anonymous public users. Work it like a queue, oldest-actionable first.</p>
          <ol>
            <li>Open <strong>Feedback</strong>. It opens on the <strong>New</strong> status by default so you see what is unworked. Use the type, category, and status filters to narrow; choose <strong>All statuses</strong> to widen back out.</li>
            <li>Open a row&apos;s title to read the full body. For a bug, look for the <strong>View related issue →</strong> link — it jumps straight to the matching error group in Observability so you can confirm whether the error is already tracked.</li>
            <li>If a bug shows <em>&ldquo;No linked error event&rdquo;</em>, no captured error was correlated automatically. Correlate manually: note the org and the time, then search Observability by route and org slug around that timestamp.</li>
            <li>Move the item through its lifecycle with the status dropdown: <strong>New → Triaged → Acknowledged → Resolved</strong>. Triaged means you have read and categorised it; Acknowledged means the customer has had a response or the item is queued for work; Resolved means it is done or won&apos;t-do with a reason recorded elsewhere.</li>
            <li>When the product team needs to act on an item, click <strong>Escalate to product</strong>. This stamps an <strong>Escalated</strong> badge on the row and adds it to the <em>Escalated</em> filter so product can find the flagged queue. It does <strong>not</strong> send a notification or assign anyone — pair it with your normal product hand-off (standup, ticket, or channel). Click again to clear the flag.</li>
          </ol>
          <p>Every status change is audit-logged with your email and a timestamp. Feedback is retained indefinitely. Export the filtered view (XLSX/CSV) when you need to attach a queue snapshot to a report.</p>
          <p><strong>Permission boundary:</strong> super admin, product, support, and billing can change feedback status and escalate. The <strong>error group</strong> behind a bug is a separate surface — resolving the error group itself (in Observability) is product-only (see <em>How to use the observability dashboard</em>).</p>
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
            <p>No <code>requestId</code> was captured for that submission, so it could not be auto-correlated. Open <strong>Observability</strong> and search by the bug&apos;s route and org slug around the time the feedback was submitted to find the matching error group manually.</p>
          ),
          answerText: 'No requestId was captured. Search Observability by route and org slug around the submission time to find the error group manually.',
          keywords: ['no linked error', 'correlate manually', 'request id'],
        },
      ],
    },
    {
      id: 'observability-triage',
      group: 'Support SOP',
      heading: 'How to use the observability dashboard and resolve error groups',
      summary: 'Read the error dashboard, open an error group, and resolve, ignore, or snooze it.',
      keywords: ['observability', 'error tracking', 'error group', 'issue', 'resolve', 'ignore', 'snooze', 'stack trace', 'error rate'],
      searchText: 'how do i use observability dashboard error tracking error groups issues resolve ignore snooze reopen stack trace error rate freshness affected orgs',
      links: [
        { label: 'Observability', href: '/platform-admin/observability' },
        { label: 'Feedback', href: '/platform-admin/feedback' },
      ],
      content: (
        <>
          <p><strong>Observability</strong> is the in-house error console. Each row is one distinct error fingerprint — a flood of identical failures collapses into a single triable <em>issue</em>, so the list stays workable.</p>
          <ul>
            <li>The top metric cards show errors in the selected window, error rate (from instrumented routes only), open issues, and affected orgs. Switch the environment (Production / Dev) and time window with the toggles.</li>
            <li>The <strong>freshness chip</strong> reports when the rollup job last ran. A green chip is healthy; an amber chip (&ldquo;job error&rdquo; / &ldquo;sweep stale&rdquo;) or &ldquo;Rollup has not run yet&rdquo; means the data is stale and the cron job needs attention — flag it to engineering rather than trusting the counts.</li>
            <li>The issue list opens on <strong>Open</strong> by default. Filter by severity, status, environment, route, or org slug. Export (XLSX/CSV) carries the active filters.</li>
          </ul>
          <p>Open an issue to read its detail: route and HTTP method, occurrence count, affected orgs, first/last seen, a 14-day occurrence sparkline, scrubbed sample events (stack trace and request context, redacted), and any <strong>related feedback</strong> matched by request ID.</p>
          <p>Triage an open issue with the status controls:</p>
          <ul>
            <li><strong>Resolve</strong> — the error is fixed or understood and closed. Records who resolved it and when.</li>
            <li><strong>Ignore</strong> — known noise you do not intend to fix (third-party, expected client error). It drops out of the open queue.</li>
            <li><strong>Snooze</strong> — temporarily hide a known issue for 24 hours, 3 days, or 7 days; it returns to the open queue when the snooze expires.</li>
            <li><strong>Reopen</strong> — bring a resolved/ignored/snoozed issue back to open if it recurs.</li>
          </ul>
          <p>Every transition is audit-logged. There is no confirmation modal — changes apply immediately, but every status is reversible.</p>
          <p><strong>Permission boundary:</strong> error-group triage (Resolve / Ignore / Snooze / Reopen) is <strong>product and super admin only</strong> — this is engineering signal. Support can <em>view</em> the dashboard and issues but the controls are disabled with a <em>&ldquo;View-only for your role&rdquo;</em> note. To get a bug actioned, triage it from <strong>Feedback</strong> and escalate to product (see <em>How to triage customer feedback</em>).</p>
        </>
      ),
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
      keywords: ['transfer ownership', 'make owner', 'owner left', 'reassign owner', 'change owner', 'new owner', 'demote owner'],
      searchText: 'owner left the company transfer organization ownership reassign make owner change account owner demote current owner promote member to owner',
      links: [
        { label: 'Organizations', href: '/platform-admin/orgs' },
        { label: 'Audit Log', href: '/platform-admin/audit' },
      ],
      content: (
        <>
          <p>Use this when an account needs a different owner — most often when the current owner has left the company and another existing member should take over. The new owner must already be an <strong>active member</strong> of the organization.</p>
          <ol>
            <li>Open <strong>Organizations</strong> and open the customer account.</li>
            <li>Open the <strong>People &amp; Tournaments</strong> tab and review the <strong>Members</strong> table.</li>
            <li>Find the member who should become the owner. If they are not listed, have them invited into the org and accept first — they must be an active member before you can transfer ownership.</li>
            <li>Click <strong>Make Owner</strong> on that member&apos;s row.</li>
            <li>Enter a reason and click <strong>Confirm Transfer</strong>.</li>
            <li>Add an internal note on the <strong>Support</strong> tab recording who requested the change and why.</li>
          </ol>
          <p>The selected member becomes the owner and <strong>all previous owners are demoted to admin</strong>. The change is audit-logged and cannot be reversed from this screen — to undo it, run another transfer. This is different from <em>Coaches Portal Ownership Transfers</em> on the same Support tab, which moves a Premium Coaches Portal team into an organization (see <em>How to complete Coaches Portal ownership transfer</em>).</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-org-transfer-no-member',
          question: 'The intended new owner is not a member of the org yet. What do I do?',
          answer: (
            <p>Make Owner only lists existing active members. The new owner must first be invited to the organization and accept, or otherwise be added as an active member, before you can transfer ownership to them. Do not delete the departing owner until a new owner is in place.</p>
          ),
          answerText: 'Make Owner only lists existing active members. Invite or add the new owner first, then transfer. Do not delete the old owner until a new owner exists.',
          keywords: ['not a member', 'no member', 'invite owner'],
          popular: true,
        },
      ],
    },
    {
      id: 'team-ownership-transfer',
      group: 'Support SOP',
      heading: 'How to complete Coaches Portal ownership transfer',
      summary: 'Finish a mutually approved Premium Coaches Portal transfer from the organization detail support workflow.',
      keywords: ['coaches portal ownership transfer', 'premium portal', 'org owned team', 'rep teams', 'platform assisted transfer'],
      searchText: 'complete coaches portal premium ownership transfer platform assisted org owned rep team roster documents accounting ledger',
      links: [
        { label: 'Organizations', href: '/platform-admin/orgs' },
        { label: 'Audit Log', href: '/platform-admin/audit' },
      ],
      content: (
        <>
          <p>Use this only after the coach and organization have both approved ownership transfer from Coaches Portal Links. Basic visibility links do not require this step.</p>
          <ol>
            <li>Open the target organization from <strong>Organizations</strong>.</li>
            <li>Confirm the account has Club or Rep Teams module access.</li>
            <li>Open <strong>Support</strong> and review <strong>Coaches Portal Ownership Transfers</strong>.</li>
            <li>Confirm the team name, portal slug, current billing mode, and customer request.</li>
            <li>Enter a reason, then click <strong>Complete Transfer</strong>.</li>
            <li>Review the audit log and, if Stripe cancellation reports a warning, finish the cancellation manually in Stripe.</li>
          </ol>
          <p>The transfer moves team-scoped rep-team records and the team ledger under the organization, creates coach membership access in the parent org, retires active Premium entitlements, marks the link org-owned, and suspends the retired portal memberships.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-team-transfer-retry',
          question: 'What if the transfer fails?',
          answer: (
            <p>The database move runs as one transaction. If it fails, no partial data reassignment should remain. Read the error, resolve conflicts such as duplicate team slugs, and retry from the same organization detail page.</p>
          ),
          answerText: 'The database move is transactional. Resolve conflicts such as duplicate team slugs and retry.',
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
        { label: 'Dev Tools', href: '/platform-admin/dev-tools' },
        { label: 'Stripe Prices', href: '/platform-admin/stripe-prices' },
        { label: 'Plans & Pricing', href: '/platform-admin/plans-pricing' },
      ],
      content: (
        <>
          <p>Use this before opening Premium Coaches Portal self-serve checkout or supporting the first external Premium customers.</p>
          <ol>
            <li>Confirm Stripe has sandbox and live recurring prices for direct Premium Coaches Portal at <strong>$29 CAD monthly</strong> and <strong>$290 CAD annual/seasonal</strong>.</li>
            <li>Confirm Stripe has sandbox and live recurring prices for the two <strong>Club capacity bands</strong> — Club and Club&nbsp;·&nbsp;Association — each monthly and annual (Club Repackaging, 2026-06-22).</li>
            <li><strong>Retired:</strong> the org-billed &quot;$19/team&quot; Coaches Portal takeover and the &quot;Club extra rep team&quot; ($19/$190) add-on are gone — do not create or reuse those price IDs. A Club subscription includes the whole coaching staff up to its band cap, with no per-team fee.</li>
            <li>Paste each <code>price_...</code> ID into the matching sandbox or live row in <strong>Stripe Prices</strong> or <strong>Plans &amp; Pricing</strong>.</li>
            <li>Run <strong>Dev Tools &gt; Coaches Portal checkout readiness</strong> and resolve any missing app URL, webhook secret, Premium gate, or price-row failures.</li>
            <li>Complete manual sandbox smokes for direct Coaches Portal checkout, tournament-claim checkout, cancellation or past-due simulation, and Club / Club&nbsp;·&nbsp;Association band checkout.</li>
            <li>Ask the product owner to visually check the public pricing page, Coaches Portal signup page, and mobile Coaches Portal flows.</li>
          </ol>
          <p>Customer-facing help should explain Premium Coaches Portal, season rollover, the one free-tier local tournament slot, Basic org linking, billing transfer, ownership transfer, and the difference between direct Premium, org-billed Premium, Club included teams, and Club extra teams.</p>
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
      heading: 'How to run guarded bulk operations',
      summary: 'Apply billing or product exceptions to multiple accounts with preview, reason, confirmation, and audit logging.',
      keywords: ['bulk operations', 'bulk', 'comp period', 'plan change', 'module addon', 'subscription status'],
      links: [
        { label: 'Bulk Operations', href: '/platform-admin/bulk-operations' },
        { label: 'Audit Log', href: '/platform-admin/audit' },
      ],
      content: (
        <>
          <p>Bulk operations are intentionally guarded. Use them only when the same approved action should apply to multiple accounts.</p>
          <ol>
            <li>Go to <strong>Bulk Operations</strong>.</li>
            <li>Filter by account name, slug, plan, or subscription status.</li>
            <li>Select individual accounts or use <strong>Select Filtered</strong> after reviewing the filtered list.</li>
            <li>Choose the action: Subscription Status Override, Comp Period Grant, Plan Change, or Module Add-On Enablement.</li>
            <li>Set the target value. Comp periods require an expiration date. Module add-ons require enable or remove.</li>
            <li>Enter a clear reason. This reason appears in the batch record and audit log.</li>
            <li>Review the preview panel, click <strong>Review Bulk Operation</strong>, then click <strong>Confirm Bulk Operation</strong>.</li>
            <li>Review the result list and recent bulk operation table for failures or skipped accounts.</li>
          </ol>
          <p>Billing actions require billing access. Module add-on actions require product access. A super admin can perform both.</p>
        </>
      ),
    },
    {
      id: 'support-notes',
      group: 'Support SOP',
      heading: 'How to document account support work',
      summary: 'Use structured internal notes so the next employee understands the account history.',
      keywords: ['notes', 'internal notes', 'support', 'identity', 'slug', 'org name'],
      links: [
        { label: 'Organizations', href: '/platform-admin/orgs' },
      ],
      content: (
        <>
          <p>Every meaningful exception should have a note. Audit logs show what changed; notes explain why the change happened and what the customer was told.</p>
          <ul>
            <li>Use <strong>Support</strong> on the org detail page for customer context, follow-up dates, implementation notes, and risk flags.</li>
            <li>Edit notes when you are correcting or clarifying the same support event.</li>
            <li>Delete only when the note is wrong or should not have been stored. Deletes are audit-logged.</li>
            <li>Use <strong>Organization Identity</strong> only for support-approved name or slug corrections. Changing a slug updates URLs immediately and can break links the customer already shared.</li>
          </ul>
        </>
      ),
    },
    {
      id: 'audit-investigation',
      group: 'Investigation SOP',
      heading: 'How to investigate account changes',
      summary: 'Use org activity and the global audit log to answer who changed what and when.',
      keywords: ['audit', 'audit log', 'investigate', 'actor', 'before after', 'json', 'filter'],
      links: [
        { label: 'Audit Log', href: '/platform-admin/audit' },
      ],
      content: (
        <>
          <ol>
            <li>Open the customer's org detail page and check <strong>Activity</strong> for recent account-specific entries.</li>
            <li>For a wider search, open <strong>Audit Log</strong>.</li>
            <li>Filter by organization, actor email, action, and date range.</li>
            <li>Open full JSON values when you need before/after details for plan changes, module add-ons, catalog applications, or bulk operations.</li>
            <li>Export the audit result if you need to attach a concise account history to an internal ticket.</li>
          </ol>
          <p>The audit log records platform-admin actions such as reset link generation, overrides, plan and limit changes, module add-on updates, internal note edits, platform user changes, pricing/config changes, and bulk operation runs.</p>
        </>
      ),
    },
    {
      id: 'retention',
      group: 'Billing SOP',
      heading: 'How to handle retained or at-risk accounts',
      summary: 'Use the retention queue for accounts approaching retention deadlines after downgrade or cancellation.',
      keywords: ['retention', 'cancel', 'cancellation', 'downgrade', 'archive', 'purge', 'deadline'],
      links: [
        { label: 'Retention', href: '/platform-admin/retention' },
      ],
      content: (
        <>
          <p>The retention queue helps platform staff review accounts with retained data after cancellation or downgrade. Use it to see upcoming deadlines and extend a retention date when the business has approved more time.</p>
          <ol>
            <li>Open <strong>Retention</strong>.</li>
            <li>Review accounts due soon, including the retention deadline and reason.</li>
            <li>If approved, extend the deadline using the available action and enter the reason.</li>
            <li>Document any customer communication in the org's internal notes.</li>
          </ol>
          <p>Do not promise permanent retention unless product and billing policy explicitly allow it.</p>
        </>
      ),
    },
    {
      id: 'change-requests',
      group: 'Product SOP',
      heading: 'How to review and action the Approval Queue',
      summary: 'Work the catalog approval queue: submit, approve, and apply pricing, gating, and config changes.',
      keywords: ['approval queue', 'change requests', 'approval', 'pricing change', 'stripe price', 'plan gating', 'plan config', 'needs review', 'apply', 'implemented'],
      searchText: 'how do i review action the approval queue change requests approve apply pricing gating config draft needs review approved implemented stripe price update auto apply',
      links: [
        { label: 'Approval Queue', href: '/platform-admin/change-requests' },
        { label: 'Plans & Pricing', href: '/platform-admin/plans-pricing' },
        { label: 'Audit Log', href: '/platform-admin/audit' },
      ],
      content: (
        <>
          <p>The <strong>Approval Queue</strong> is the single review queue for product, pricing, entitlement, campaign, and approval changes. Requests are <strong>created from the Plans &amp; Pricing catalog flow</strong> (and billing-initiated catalog actions), not from this page — here you review and move them forward. The queue opens on <strong>Action Needed</strong> (items in needs review or approved).</p>
          <ol>
            <li>Open a request to read its summary, the human-readable proposal, the raw proposal payload, and the stage history (created / submitted / reviewed / applied).</li>
            <li>Move it through the lifecycle: <strong>Draft → Needs Review → Approved → Implemented</strong> (or <strong>Rejected / Canceled</strong>). The detail footer shows only the actions valid for the current status.</li>
            <li>For a <strong>generated</strong> proposal (a Stripe price change, plan availability/gating change, or plan config/limit change), approval <strong>auto-applies</strong>: the button reads <strong>Approve &amp; Apply</strong> and on click the change is written and the request jumps straight to <strong>Implemented</strong>. There is no separate manual step.</li>
            <li>For a <strong>manual</strong> request (e.g. a feature-matrix publish), approval sets it to <strong>Approved</strong> and leaves a separate <strong>Mark Implemented</strong> step for the implementer to take after doing the manual work.</li>
          </ol>
          <p><strong>Safe-harbour for price changes:</strong> a generated change captures the slot&apos;s current value when the request was created. If the slot changed since then, applying it is blocked with a 409 that names the current vs. expected value — create a fresh request from the current row rather than forcing it. Stripe price IDs must start with <code>price_</code>, and when the environment matches the change is live-validated against Stripe (an inactive price is rejected). Always confirm the price ID is from the correct Stripe environment (sandbox vs. live) before approving.</p>
          <p>Every transition and every auto-apply is audit-logged. The Approval Queue also surfaces as a queue you reach from Plans &amp; Pricing.</p>
          <p><strong>Permission boundary:</strong> super admin and product can submit, approve, and apply. Billing can <em>view</em> the queue (actions show <em>Read only</em>). Support and growth do not see this surface.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-cr-auto-apply',
          question: 'Does approving a change request apply it, or is there a separate step?',
          answer: (
            <p>It depends on the request. A generated price, gating, or config change <strong>auto-applies on approval</strong> and goes straight to Implemented. A manual request (like a feature-matrix publish) only becomes Approved on approval and needs a separate <strong>Mark Implemented</strong> step after you do the manual work.</p>
          ),
          answerText: 'Generated price/gating/config changes auto-apply on approval and become Implemented. Manual requests need a separate Mark Implemented step.',
          keywords: ['auto apply', 'approve', 'implemented', 'manual'],
          popular: true,
        },
        {
          id: 'faq-cr-stale-price',
          question: 'Applying a price change was blocked saying the slot changed. What do I do?',
          answer: (
            <p>The Stripe price slot was modified after this request was created, so applying it would overwrite a newer value. Cancel the stale request if the current value is already correct, or create a fresh request from the current Plans &amp; Pricing row and approve that one.</p>
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
      summary: 'Customise transactional email copy without breaking variable tokens; test before saving.',
      keywords: ['email templates', 'transactional email', 'variable token', 'test send', 'reset to default', 'subject', 'heading', 'cta'],
      searchText: 'how do i edit email templates safely customise transactional email copy variable tokens curly braces test send reset to default subject heading body cta',
      links: [
        { label: 'Email Templates', href: '/platform-admin/email-templates' },
      ],
      content: (
        <>
          <p><strong>Email Templates</strong> lets you override the copy of platform transactional emails. Editing a template replaces the built-in default; the FieldLogicHQ brand envelope (header, footer) is always applied automatically. Templates are grouped by category: <strong>Authentication</strong>, <strong>Billing</strong>, <strong>Tournament</strong>, <strong>Rep Teams</strong>, <strong>House League</strong>, and <strong>System</strong>. Most of these fire automatically on a customer action, so copy mistakes reach real customers.</p>
          <ol>
            <li>Open the template from the list (the status column shows <strong>Customised</strong> or <strong>Default</strong>).</li>
            <li>Edit the <strong>Subject line</strong>, <strong>Heading</strong>, <strong>Body</strong>, and optional <strong>CTA button label</strong>. The live preview on the right shows the branded result as you type.</li>
            <li>Insert variables with the <strong>token chips</strong> below the body — they use <code>{'{{variableName}}'}</code> syntax. <strong>Do not hand-type or alter a token.</strong> A broken token (typo, missing brace) renders the literal <code>{'{{variableName}}'}</code> in the email instead of the real value.</li>
            <li>Before saving, click <strong>Send test</strong>. A preview of your <em>unsaved</em> draft is emailed to your platform-admin address, with a TEST EMAIL badge and tokens shown as <code>[placeholders]</code>. Open it in an inbox and confirm it reads correctly.</li>
            <li>Click <strong>Save</strong> to publish. The template is marked Customised and records you as the last editor.</li>
            <li>To revert, click <strong>Reset to default</strong> and confirm — your customised copy is discarded and the built-in default is restored.</li>
          </ol>
          <p><strong>Approval expectation:</strong> copy changes to transactional templates that go directly to customers (auth, billing, tournament, rep-teams, house-league categories) should be reviewed with the product owner before saving. System templates are internal.</p>
          <p><strong>Permission boundary:</strong> Email Templates is super admin and product only — it is not visible to support, billing, or growth.</p>
        </>
      ),
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
      ],
    },
    {
      id: 'plans-pricing',
      group: 'Product SOP',
      heading: 'How to work with plans, pricing, and feature matrix changes',
      summary: 'Live product packaging changes require the approved catalog workflow — sequenced by customer impact.',
      keywords: ['plans pricing', 'product catalog', 'feature matrix', 'stripe price', 'approval', 'campaign', 'risk ladder', 'plan config', 'gating'],
      links: [
        { label: 'Plans & Pricing', href: '/platform-admin/plans-pricing' },
        { label: 'Approval Queue', href: '/platform-admin/change-requests' },
        { label: 'Bulk Operations', href: '/platform-admin/bulk-operations' },
      ],
      content: (
        <>
          <p><strong>Plans &amp; Pricing</strong> is for global product configuration — it changes the product for <em>every</em> customer, which is different from a one-customer override. Treat the controls as a <strong>risk ladder</strong>, from lowest to highest customer impact:</p>
          <ol>
            <li><strong>Gating status</strong> (live / early access) — controls whether a plan is offered. Reversible.</li>
            <li><strong>Config limits</strong> (tournament caps, seat caps, trial days) — affects what customers on the plan can do.</li>
            <li><strong>Stripe price IDs</strong> — affects real billing; a wrong ID can break checkout or charge the wrong amount.</li>
            <li><strong>Feature matrix</strong> — the public plan comparison; highest blast radius and least immediately reversible.</li>
          </ol>
          <p><strong>Recommended sequence for any change:</strong> verify subscriber impact (use the impact summaries) → create a change request → get it approved → apply. Generated price, gating, and config changes auto-apply on approval through the <strong>Approval Queue</strong> (see <em>How to review and action the Approval Queue</em>).</p>
          <p><strong>Stripe price change checklist:</strong></p>
          <ul>
            <li>Confirm the <code>price_...</code> ID is from the correct Stripe environment — sandbox vs. live.</li>
            <li>Confirm no org is on a Stripe-managed subscription that swapping the price would break.</li>
            <li>Let the change-request flow validate the ID against Stripe before it applies; do not force a blocked (stale) apply.</li>
          </ul>
          <p><strong>When to use which tool:</strong></p>
          <ul>
            <li><strong>Plans &amp; Pricing</strong> — global changes that should affect every customer.</li>
            <li><strong>Bulk Operations</strong> — the same exception applied to a chosen set of orgs.</li>
            <li><strong>Org-level Entitlements / billing override</strong> — a single-customer exception (see <em>How to provide module access</em> and <em>How to temporarily override billing access</em>).</li>
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
      keywords: ['email', 'batch send', 'marketing email', 'founding season', 'recipients', 'send history', 'opt out', 'resend'],
      searchText: 'how do i send a batch marketing email founding season recipients preview confirm send irreversible cannot be undone send history opted out resubscribe',
      links: [
        { label: 'Email', href: '/platform-admin/email' },
      ],
      content: (
        <>
          <p>The <strong>Email</strong> dashboard triggers the founding-season marketing emails. Sends go to <strong>real customers</strong> and <strong>cannot be recalled</strong>, so the review step matters.</p>
          <ol>
            <li>Check the audience stats at the top: <strong>Founding Season Orgs</strong>, <strong>Active Recipients</strong> (founding orgs minus opt-outs), and <strong>Opted Out</strong>. The per-email <strong>Recipients</strong> column is the count that will actually receive that email — read that number, not the total org count.</li>
            <li>Click the <strong>Preview</strong> (eye) icon to read the exact email before sending. A row whose template is not built shows <em>not built</em> and cannot be sent.</li>
            <li>Click <strong>Send</strong>. The <strong>Confirm Send</strong> modal restates the email key, the recipient count, and the subject, with the warning <em>&ldquo;This will send real emails… This action cannot be undone.&rdquo;</em> Read all three before confirming.</li>
            <li>Confirm with <strong>Send to N recipients</strong>. Do not close the window while it says <em>&ldquo;Sending in progress.&rdquo;</em> When it finishes you get a result line: <em>Sent / Suppressed / Failed / Batch</em>.</li>
            <li>If a send partially fails, open <strong>Sent History</strong> and expand the batch row for per-recipient delivery status (sent / suppressed / failed) before deciding whether to re-send to anyone.</li>
          </ol>
          <p>Use the <strong>Opt-Outs</strong> table only to re-subscribe an org that has <em>explicitly</em> asked to be re-added. Opt-outs are excluded from Active Recipients automatically.</p>
          <p><strong>Permission boundary:</strong> growth, product, and super admin can trigger a send. Billing and support cannot — the Email surface is not visible to them.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-email-batch-recall',
          question: 'Can I recall a marketing email after sending it?',
          answer: (
            <p>No. Once you confirm the send, the emails go out and cannot be undone or recalled. Preview the email and verify the recipient count in the Confirm Send modal before clicking send.</p>
          ),
          answerText: 'No — a sent batch cannot be recalled. Preview and verify the recipient count in the confirm modal before sending.',
          keywords: ['recall', 'undo', 'cannot be undone', 'irreversible'],
          popular: true,
        },
        {
          id: 'faq-email-batch-recipient-count',
          question: 'Which number is the real recipient count?',
          answer: (
            <p>The per-email <strong>Recipients</strong> column (and the count restated in the Confirm Send modal). That is Active Recipients — founding orgs minus opt-outs — not the total org count. Always confirm that number before sending.</p>
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
      searchText: 'how do i manage early access lead pipeline status new qualified contacted pilot converted not a fit do not contact outreach templates mark converted follow up export copy emails',
      links: [
        { label: 'Early Access', href: '/platform-admin/early-access' },
      ],
      content: (
        <>
          <p><strong>Early Access</strong> is the growth lead pipeline. The summary tiles show leads loaded, New, Pilot, Converted (with rate), and Follow-up Due. The conversion panels break down what is converting by plan interest and feature interest.</p>
          <ol>
            <li>Filter the list by search text, plan interest, feature interest, status, or consent. Click a lead to open the detail panel.</li>
            <li>Move the lead through its lifecycle with the status select: <strong>New → Qualified → Contacted → Pilot candidate → Waiting for launch → Converted</strong>, or close it as <strong>Not a fit</strong> / <strong>Do not contact</strong>. Any status can be set directly — there is no forced order.</li>
            <li>Record work in the detail panel: set a <strong>Follow-up due</strong> date, a <strong>Next action</strong>, and <strong>Internal notes</strong>, then <strong>Save</strong>. Use <strong>Mark contacted</strong> to stamp the last-contacted date.</li>
            <li>For outreach, use the built-in <strong>Templates</strong> (League Plus beta invite, Club roadmap update, Feedback call). Clicking one copies the subject and body with the lead&apos;s name and org filled in — paste into your email tool and personalise before sending. <strong>Copy email</strong> grabs the lead&apos;s address; <strong>Copy emails</strong> grabs all consented addresses in the current view.</li>
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
      summary: 'Cancel a Stripe subscription on behalf of a customer from the org detail billing tab.',
      keywords: ['cancel subscription', 'unsubscribe', 'stripe cancel', 'billing cancel', 'terminate account', 'end subscription'],
      searchText: 'how do i cancel a subscription for a customer unsubscribe stripe billing terminate account end subscription on behalf',
      links: [
        { label: 'Organizations', href: '/platform-admin/orgs' },
        { label: 'Retention', href: '/platform-admin/retention' },
        { label: 'Audit Log', href: '/platform-admin/audit' },
      ],
      content: (
        <>
          <p>Use this when a customer has explicitly asked to cancel and either cannot complete the self-serve flow or has contacted support directly. Confirm the request with the account owner before taking action.</p>
          <ol>
            <li>Go to <strong>Organizations</strong> and open the customer account.</li>
            <li>Confirm the subscription status in Account Context is not already <code>canceled</code>.</li>
            <li>Open <strong>Billing &amp; Access</strong>.</li>
            <li>Scroll to <strong>Cancel Subscription</strong> at the bottom of the tab. This section only appears when a Stripe subscription ID is on file and the account is not already canceled.</li>
            <li>Click <strong>Cancel Subscription…</strong>.</li>
            <li>Review the preflight: modules shutting down and the number of tournaments that will be archived.</li>
            <li>Enter a reason that explains why the cancellation is being initiated by platform staff rather than the customer. This appears in the audit log.</li>
            <li>Check <strong>Send cancellation confirmation email to org owner</strong> if the customer expects a confirmation email.</li>
            <li>Click <strong>Confirm Cancel Subscription</strong>.</li>
            <li>Add an internal note on the <strong>Support</strong> tab with the customer-facing context: what was discussed, who approved, and any retention or resubscription commitments.</li>
          </ol>
          <p>After cancellation the account moves to <code>canceled</code> status, the public site is unpublished, all non-archived tournaments are archived, and data is retained for 90 days. The Stripe subscription is canceled immediately. If Stripe cancellation fails but the in-app state succeeded, you will see a warning — complete the Stripe cancellation manually from the <strong>Open Stripe</strong> link on the org detail page.</p>
          <p>Check the <strong>Retention</strong> queue after cancellation and extend the deadline if the customer has negotiated additional time.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-cancel-stripe-fails',
          question: 'The cancellation succeeded in FieldLogicHQ but shows a Stripe warning. What do I do?',
          answer: (
            <p>The account is already canceled in FieldLogicHQ. Open Stripe from the <strong>Open Stripe</strong> link on the org detail page, find the subscription, and cancel it manually. Document the manual action in the org&apos;s internal notes.</p>
          ),
          answerText: 'The account is already canceled in FieldLogicHQ. Open Stripe from the org detail page and cancel the subscription manually. Document in internal notes.',
          keywords: ['stripe warning', 'stripe fails', 'manual stripe'],
          popular: true,
        },
        {
          id: 'faq-cancel-no-stripe-id',
          question: 'The Cancel Subscription section is not showing. Why?',
          answer: (
            <p>The section only appears when the org has a Stripe subscription ID on file and the account is not already canceled. If the subscription was already canceled in Stripe but the FieldLogicHQ status was not updated, use a <strong>Subscription Status Override</strong> in the Active Overrides section to set it to canceled, or change the base plan to the free Tournament tier.</p>
          ),
          answerText: 'The section only appears when a Stripe subscription ID is on file and status is not canceled. Use a billing override or plan change if the section is missing.',
          keywords: ['cancel section missing', 'no stripe id', 'already canceled'],
        },
        {
          id: 'faq-cancel-vs-override',
          question: 'Should I cancel the subscription or just add a canceled status override?',
          answer: (
            <p>If the customer wants their billing to stop and the account permanently closed, use <strong>Cancel Subscription</strong>. This cancels the Stripe subscription so no further charges occur. A status override only changes the display state in FieldLogicHQ and does not stop Stripe from billing.</p>
          ),
          answerText: 'Cancel Subscription stops Stripe billing. A status override only changes FieldLogicHQ display — it does not stop Stripe charges.',
          keywords: ['cancel vs override', 'status override', 'stop billing'],
          popular: true,
        },
      ],
    },
    {
      id: 'delete-user',
      group: 'Support SOP',
      heading: 'How to delete a user',
      summary: 'Permanently remove a user account from FieldLogicHQ, including their auth record.',
      keywords: ['delete user', 'remove user', 'gdpr', 'data deletion', 'user removal', 'account delete'],
      searchText: 'how do i delete a user remove user account permanently gdpr data deletion right to erasure customer users',
      links: [
        { label: 'Customer Users', href: '/platform-admin/customer-users' },
        { label: 'Organizations', href: '/platform-admin/orgs' },
      ],
      content: (
        <>
          <p>User deletion is permanent. The Supabase auth record is removed and the user can no longer sign in. Organization data and tournaments the user created are <strong>not</strong> automatically deleted — only their personal auth record and associated user metadata are removed.</p>
          <p><strong>Before deleting a user, check their organization memberships.</strong></p>
          <ol>
            <li>Go to <strong>Customer Users</strong> and search for the user.</li>
            <li>Review the <strong>Organizations</strong> column on the user's row to see which orgs they belong to and their role in each.</li>
            <li>If the user is the <strong>sole owner</strong> of one or more organizations, handle those orgs first:
              <ul>
                <li>If the org should be kept: transfer ownership to another active member first (see <strong>How to transfer organization ownership</strong>). Do not delete the user until another owner exists.</li>
                <li>If the org should be closed: cancel the subscription if active (see <strong>How to cancel a customer subscription</strong>), then delete the org (see <strong>How to delete an organization</strong>) before deleting the user.</li>
              </ul>
            </li>
            <li>Once org ownership is resolved, return to <strong>Customer Users</strong> and click <strong>Delete</strong> on the user&apos;s row.</li>
            <li>Type the user&apos;s email to confirm and click <strong>Delete</strong>.</li>
            <li>Write an entry in the platform audit log by adding an internal note to any affected organizations explaining the deletion and its reason.</li>
          </ol>
          <p>The delete action is audit-logged as <code>delete_user</code>. If the deletion was requested for GDPR or data erasure reasons, document the request source and date in the internal notes of each affected organization before deleting the user.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-delete-user-org-data',
          question: 'Does deleting a user also delete their organization or tournament data?',
          answer: (
            <p>No. Deleting the user removes their Supabase auth record and login. Organization memberships, tournaments, and org-level data persist until the organization itself is deleted. Review each org the user owned before proceeding.</p>
          ),
          answerText: 'No — deleting a user only removes their auth record and login. Org memberships and tournament data persist until the org is deleted.',
          keywords: ['org data', 'tournament data', 'org deleted', 'what gets deleted'],
          popular: true,
        },
        {
          id: 'faq-delete-user-sole-owner',
          question: 'What happens if I delete the only owner of an organization?',
          answer: (
            <p>The organization record persists but becomes ownerless. No customer will be able to access the admin or billing without a new owner being assigned manually in the database. Resolve org ownership before deleting the user.</p>
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
      keywords: ['delete organization', 'delete org', 'remove organization', 'gdpr', 'data deletion', 'hard delete', 'purge org'],
      searchText: 'how do i delete an organization permanently remove org data gdpr data erasure hard delete purge account',
      links: [
        { label: 'Organizations', href: '/platform-admin/orgs' },
        { label: 'Retention', href: '/platform-admin/retention' },
        { label: 'Audit Log', href: '/platform-admin/audit' },
      ],
      content: (
        <>
          <p>Organization deletion is irreversible. All org data is permanently removed: tournaments, registrations, members, accounting records, notes, and audit history. This action requires super admin access (both billing and support permissions).</p>
          <p><strong>Before deleting an organization, complete these steps in order:</strong></p>
          <ol>
            <li><strong>Confirm the request.</strong> Get written confirmation from the account owner or a documented internal approval. For GDPR erasure requests, note the request date and source in internal notes before proceeding.</li>
            <li><strong>Cancel the subscription.</strong> If the org has an active Stripe subscription, cancel it first using the <strong>Cancel Subscription</strong> action in <strong>Billing &amp; Access</strong>. This stops billing and creates a retention record. See <em>How to cancel a customer subscription</em>.</li>
            <li><strong>Check retention records.</strong> If data is currently in the <strong>Retention</strong> queue for this org, review whether it should be purged immediately or allowed to expire normally.</li>
            <li><strong>Delete the organization.</strong> Open the org in <strong>Organizations</strong>, go to the <strong>Support</strong> tab, scroll to <strong>Delete Organization</strong>, and follow the confirmation steps. You will be required to type the org slug and enter a mandatory reason.</li>
            <li><strong>Delete user accounts if required.</strong> If the deletion is part of a data erasure request and the users have no other organizations, delete their user accounts from <strong>Customer Users</strong> after the org is removed.</li>
          </ol>
          <p>Organization deletion is a super admin action. If you do not see the <strong>Delete Organization</strong> section on the Support tab, your platform role does not have super admin access — escalate to a super admin to complete the deletion.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-delete-org-stripe',
          question: 'Do I need to cancel Stripe separately before deleting the org?',
          answer: (
            <p>Yes. The org deletion process does not automatically cancel Stripe subscriptions. Cancel the subscription from <strong>Billing &amp; Access</strong> first so billing stops before the org record is removed.</p>
          ),
          answerText: 'Yes. Cancel the Stripe subscription from Billing & Access before deleting the org — the deletion does not stop Stripe billing automatically.',
          keywords: ['stripe', 'cancel before delete', 'billing'],
          popular: true,
        },
        {
          id: 'faq-delete-org-retention',
          question: 'Does org deletion immediately erase data or is it retained for 90 days?',
          answer: (
            <p>Canceling a subscription creates a 90-day retention window before data is purged. Hard-deleting the org bypasses retention and removes data immediately. Use the retention queue for standard cancellations, and hard deletion only for GDPR or explicitly approved data erasure requests.</p>
          ),
          answerText: 'Cancellation creates a 90-day retention window. Hard deletion bypasses retention and removes data immediately — use it only for GDPR or approved erasure requests.',
          keywords: ['retention', '90 days', 'immediate deletion', 'gdpr'],
          popular: true,
        },
      ],
    },
    {
      id: 'platform-users',
      group: 'System SOP',
      heading: 'How to manage platform employee access',
      summary: 'Invite, activate, deactivate, remove, and role-scope platform users.',
      keywords: ['platform users', 'employee access', 'invite', 'deactivate', 'role', 'super admin', 'support', 'billing', 'product'],
      links: [
        { label: 'Platform Users', href: '/platform-admin/users' },
      ],
      content: (
        <>
          <p>Only users with platform-user management permission can change employee access.</p>
          <ol>
            <li>Go to <strong>Platform Users</strong>.</li>
            <li>Click <strong>Add User</strong>, enter name, email, and role, then create the account.</li>
            <li>Copy the password setup link and send it through an approved internal channel.</li>
            <li>Use the role dropdown to adjust access later. Use the smallest role that fits the job.</li>
            <li>Deactivate for temporary removal. Remove only when the person should lose platform-admin access entirely.</li>
          </ol>
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
        <p>Yes. The platform Help Center links to the same customer guide content under platform-admin routes, plus the protected employee-only Platform Admin Operations guide.</p>
      ),
      answerText: 'Yes. Platform admins can see customer guide content plus the protected employee-only operations guide.',
      keywords: ['customer docs', 'platform docs', 'help center'],
      popular: true,
    },
    {
      id: 'faq-unsubscribed-module-temporary',
      question: 'What is the safest way to give an unsubscribed customer temporary module access?',
      answer: (
        <p>Use an org-specific module override in Entitlements, add an internal note with approval and review date, and pair it with a billing override only if billing status would otherwise block account access.</p>
      ),
      answerText: 'Use an org-specific module override, document approval and review date, and pair it with a billing override only if billing status blocks access.',
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
