# PM Brief — Protect Free Coaches When Removing an Org Admin

> **Created:** 2026-06-27
> **Plan:** FREE_COACH_REMOVAL_SAFEGUARD_PLAN.md
> **Priority:** High (active, irreversible data-loss footgun)

**What it does:** Stops the organization Members "Remove" action from silently deleting a person's entire free Coaches Portal (their teams, rosters, players, fees, history) when that person is also an admin in your organization. After this change, removing such a person takes away their access to *your* organization only — their account and coaching portal are preserved — and the removal screen clearly and accurately tells the admin what will and won't be affected.

**Why it matters:** Today there is a silent, one-click, irreversible data-loss trap. If someone helps run your tournament as an admin *and* separately coaches a team on the free portal, clicking Remove permanently destroys their whole coaching account with no warning. The confirmation only says "permanently delete their account" — it never mentions the coaching portal that gets destroyed alongside it, and the affected person receives no notification at all. This surfaced from a real support question.

**Who benefits:**
- **Org owners/admins** managing staff — they no longer risk wiping out a coach's unrelated data when cleaning up their member list.
- **Free coaches** who also help administer an org — their portal survives.
- No plan gating; this is a safety fix that applies on every tier.

**Expected impact:** Removing an admin who is also a free coach now behaves the same way as removing someone who belongs to multiple organizations: their access to this org is dropped, but their account stays alive. The removal confirmation dialog gains an honest summary so the admin sees the real consequence before committing. Removed people receive a courtesy email — the same way suspensions already notify them. Separately, when a FieldLogicHQ operator deliberately deletes a customer account from the internal admin tools, they now see a clear warning that the person runs a free coaching portal (and how many teams will be destroyed) before confirming — so an intentional deletion is never an uninformed one.

**Tradeoffs:** Genuine "junk" accounts (someone invited as admin who never did anything else) still hard-delete exactly as before, so the member list doesn't accumulate dead accounts. The only behavior that changes is for people who have a real presence beyond this one org.

**Success criteria:**
- Removing an org admin who is also a free coach preserves their account and coaching portal; only their org access is dropped.
- The removal confirmation accurately describes the outcome before the admin clicks.
- Admin-only accounts with no other presence still hard-delete.
- No database migration required.

**How to navigate/test:** Org admin → **Settings & Access → Members** → trash icon on a member → read the confirmation copy → Remove. Test the three cases: free-coach-also-admin (portal kept), admin-only junk account (deleted), and multi-org member (unchanged).
