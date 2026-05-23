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
      id: 'team-ownership-transfer',
      group: 'Support SOP',
      heading: 'How to complete Team ownership transfer',
      summary: 'Finish a mutually approved standalone Team transfer from the organization detail support workflow.',
      keywords: ['team ownership transfer', 'standalone team', 'org owned team', 'rep teams', 'platform assisted transfer'],
      searchText: 'complete standalone team ownership transfer platform assisted org owned rep team roster documents accounting ledger',
      links: [
        { label: 'Organizations', href: '/platform-admin/orgs' },
        { label: 'Audit Log', href: '/platform-admin/audit' },
      ],
      content: (
        <>
          <p>Use this only after the Team coach and organization have both approved ownership transfer from Team Links. Basic visibility and org billing do not require this step.</p>
          <ol>
            <li>Open the target organization from <strong>Organizations</strong>.</li>
            <li>Confirm the account has Club or Rep Teams module access.</li>
            <li>Open <strong>Support</strong> and review <strong>Team Ownership Transfers</strong>.</li>
            <li>Confirm the Team name, workspace slug, current billing mode, and customer request.</li>
            <li>Enter a reason, then click <strong>Complete Transfer</strong>.</li>
            <li>Review the audit log and, if Stripe cancellation reports a warning, finish the cancellation manually in Stripe.</li>
          </ol>
          <p>The transfer moves team-scoped rep-team records and the team ledger under the organization, creates coach membership access in the parent org, retires active Team entitlements, marks the link org-owned, and suspends the retired workspace-org memberships.</p>
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
      id: 'plans-pricing',
      group: 'Product SOP',
      heading: 'How to work with plans, pricing, and feature matrix changes',
      summary: 'Live product packaging changes require the approved catalog workflow.',
      keywords: ['plans pricing', 'product catalog', 'feature matrix', 'stripe price', 'approval', 'campaign'],
      links: [
        { label: 'Plans & Pricing', href: '/platform-admin/plans-pricing' },
      ],
      content: (
        <>
          <p><strong>Plans &amp; Pricing</strong> is for global product configuration. This is different from one customer override.</p>
          <ul>
            <li>Use subscriber impact summaries before changing availability, limits, trials, or Stripe price IDs.</li>
            <li>Use Product Catalog planning records for proposed package, entitlement, add-on, or campaign changes.</li>
            <li>Live feature matrix publishing must come from an approved Feature Matrix request.</li>
            <li>Use org-level module overrides when only one customer needs temporary access.</li>
          </ul>
        </>
      ),
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
