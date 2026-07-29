# Sign-up Invite Guard — PM Brief

> **Status:** Planning · **Created:** 2026-07-06 · **Branch:** dev
> Companion plan: [SIGNUP_INVITE_GUARD_PLAN.md](SIGNUP_INVITE_GUARD_PLAN.md)
> Origin: `/helpdesk` ticket 2026-07-06 (bryan.doucette@live.com, Milton Softball Organization) → `/ux` flow → `/design` visual spec → this plan.

**What it does:** When someone who has already been invited to a tournament lands on the
"Create your organization" sign-up screen (instead of clicking the link in their invite email),
the screen recognizes their email and offers to send them straight to their invitation — instead
of walking them into starting their own organization. Behind the scenes, sign-up will also refuse
to spin up a throwaway org for an already-invited or already-registered email.

**Why it matters:** Invited staff/admins who take the "wrong door" get confused, end up stuck as
PENDING, and sometimes create a stray organization that then *blocks* them from accepting the real
invite (the single-org guard rejects the accept). This is a recurring support seam — a real
customer (an invited Milton Softball staffer) hit it. It also closes a quiet data-integrity hole:
today the owner-signup path has no "account already exists" check, so submitting it with an
already-invited email can overwrite that pending account's credentials **and** create a stray org
owned by that identity.

**Who benefits:** Anyone invited as staff / admin / scorekeeper (all plans); org owners (fewer
stuck members to chase); support (fewer tickets, no manual stray-org cleanup). No plan gating.

**Expected impact:** Invited users self-rescue — "You've been invited to {Org}" → one button →
their link → they land in the right place. Fewer stray orgs and stuck PENDING rows. Genuine new
organizers see no change.

**Priority:** High — recurring support seam **and** an auth/data-integrity hole. The fix itself is
small and low-risk: it reuses the already-shipped invite-reconciliation infrastructure (mig 128)
and needs **no migration**.

**Success criteria:**
1. An invited email on the sign-up screen is offered the accept path, not org creation.
2. Submitting sign-up with an invited or already-registered email never creates a stray org and
   never alters the invited account's credentials.
3. "Email me my invitation link" delivers a working link that lands the person in the tournament.
4. Genuine new-organization signup is unchanged (no regression to the happy path).
5. No new email-enumeration surface beyond what signup already discloses (account-exists).

**Verification:** Owner runs browser testing (per AGENCY_RULES). Touches auth + adds endpoints, so
a full `/review` high-risk pass is expected before commit.
