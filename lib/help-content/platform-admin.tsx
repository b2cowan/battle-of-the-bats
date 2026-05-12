import type { HelpPageContent } from './index';

const platformAdminHelp: HelpPageContent = {
  title: 'Platform Administration',
  role: 'Platform Admin',
  intro: 'This guide covers platform-level administration — managing organizations, monitoring activity, and handling common support requests.',
  sections: [
    {
      heading: 'Managing organizations — status, subscription overrides, and enabled add-ons',
      content: (
        <>
          <p>Every org has a <strong>subscription status</strong> (<code>active</code>, <code>past_due</code>, <code>canceled</code>, <code>trialing</code>). Status is normally set by the billing provider, but platform admins can apply an <strong>override</strong> from the org detail page to temporarily change it — for example, extending a grace period or comping access during an onboarding issue.</p>
          <p>Overrides have an optional expiry date and require a reason. They are logged in the audit trail automatically. An override does not change the underlying billing record — it only affects what the org can access on the platform until the override expires or is revoked.</p>
          <p><strong>Enabled add-ons</strong> are the modules active for this org beyond their base plan (House League, Rep Teams, Accounting, Public Site). Toggling an add-on takes effect immediately — no deploy or cache flush required. Only add modules the org has contracted for; enabling a module without billing authorization should be noted in the org's internal notes.</p>
        </>
      ),
    },
    {
      heading: 'Using the audit log — filtering, reading entries, and what gets logged',
      content: (
        <>
          <p>The audit log at <strong>Audit Log</strong> records all consequential admin actions across all orgs: subscription status changes, override creation and revocation, add-on toggles, and internal note edits. Logs are retained indefinitely.</p>
          <p>Each entry shows the <strong>actor</strong> (the platform admin who made the change), the <strong>org</strong> affected, the <strong>action type</strong>, and the before/after values for the changed field.</p>
          <p>Use the filters to narrow the log:</p>
          <ul>
            <li><strong>Search</strong> — matches on org name or actor email</li>
            <li><strong>From / To</strong> — date range filter on the entry timestamp</li>
            <li><strong>Action</strong> — filter to a specific action type (e.g. <code>subscription_override</code>)</li>
          </ul>
          <p>Filters combine — you can search by org name and action type simultaneously. Clear all filters to return to the full log.</p>
        </>
      ),
    },
    {
      heading: 'Managing platform users and access — inviting staff, deactivating accounts',
      content: (
        <>
          <p>Platform admin access is controlled at the Supabase auth level. To invite a new platform admin, create their account in Supabase Auth and add the appropriate role claim. There is no self-serve invite flow in the UI — this is intentional to limit blast radius if credentials are compromised.</p>
          <p>To deactivate a platform admin account, disable the user in Supabase Auth. This immediately revokes all active sessions. The user's past audit log entries are preserved for accountability.</p>
          <p>Org-level admins (owners, admins within a specific org) are managed separately through each org's member list — platform admins can view these from the org detail page but should not modify them without a support reason documented in internal notes.</p>
        </>
      ),
    },
    {
      heading: 'Common support workflows — password resets, grace period extensions, enabling add-ons for an org',
      content: (
        <>
          <p><strong>Password reset:</strong> Trigger a password reset email from Supabase Auth using the user's email address. The reset link expires after 24 hours. If the user does not receive the email, check that their address is confirmed in Supabase Auth.</p>
          <p><strong>Grace period extension:</strong> On the org detail page, create a new override with type <code>subscription_status</code>, value <code>active</code>, and an expiry date matching the extension window. Add a reason describing the support context. The override takes effect immediately.</p>
          <p><strong>Enabling an add-on:</strong> On the org detail page under <strong>Plan &amp; Entitlements</strong>, the enabled add-ons field shows the current state. Use the client-side controls (via the Override section or direct DB action as appropriate) to add the module key. Confirm with the org that the change is visible by having them refresh their admin shell. Log the reason in internal notes.</p>
        </>
      ),
    },
  ],
};

export default platformAdminHelp;
