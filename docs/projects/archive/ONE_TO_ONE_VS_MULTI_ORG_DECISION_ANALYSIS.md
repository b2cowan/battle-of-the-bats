# Decision Analysis — One Account = One Org (1:1) vs. Multi-Org

**Status:** ✅ **DECISION LOCKED 2026-06-19** — see "Decision (locked)" below. Implementation tracked in `IDENTITY_MODEL_CLEANUP_PLAN.md`.
**Date:** 2026-06-19
**Decision owner:** Product owner (answered the 3 market questions — see below)
**Companion:** `ONE_TO_ONE_VS_MULTI_ORG_DECISION_PM_BRIEF.md`, `IDENTITY_MODEL_CLEANUP_PLAN.md`
**Supersedes the open question logged in:** `memory/decision_one_to_one_vs_multi_org.md`, `INVITE_RECONCILIATION_PLAN.md` ("Cross-org accept guard, UNDECIDED" — now RESOLVED, see below)

---

## Decision (locked 2026-06-19)

**The owner answered the three open questions:**
1. One person needing a real admin role in 2+ organizations is **rare**.
2. A connected coach/president network is **appealing** ("how much these coaches and org presidents talk to one another").
3. A standalone coach who also works inside a club should have **one login** for both.

**Resolved direction:** Adopt **"single-org by default, multi-membership by deliberate exception."** We do **NOT** apply an irreversible one-org database lock. Specifically:
- Everyone is single-org by default, with **one clear home organization**. The 98% never see a workspace picker or an "add a workspace" prompt.
- One account can still belong to more than one org, but **only by a deliberate act involving another party** (accepting an invite) **or a purchase** (buying a Coaches Portal) — never by idly spinning up an empty workspace. The self-serve "create another org" front door is removed.
- A person's **own Coaches Portal never counts against them** — this is what makes the owner's answer #3 (one login for a coach who also has a club role) work. A strict one-org lock would have forced that coach onto a second email, the opposite of the intent.
- We keep a **soft block on joining a second _real_ (non-portal) org** (the rare two-club-admin case → a second email is acceptable, per answer #1). This is a one-line knob we can relax later if the network vision wants it.
- The long-open **"cross-org accept guard"** question is resolved: enforce the one-real-org rule **consistently** at org-create, invite, _and_ accept (Coaches Portal exempt).
- The connected network (answer #2) is built on cross-org messaging between single-org identities — it does **not** require multi-org membership, so nothing here blocks it.

This banks the simplicity the owner wants (sound, uncomplicated foundation; no picker for the common user) while keeping the one flexibility their own answers require, and forecloses nothing. Confidence in this resolution: **high (~85%)** now that the prevalence unknown is settled toward "rare."

---

## TL;DR

**Recommendation: Do _not_ hard-enforce strict "one account = one organization" right now. Instead, make _single-org the default experience_, keep the multi-org capability intact but quiet, and fix the handful of inconsistencies that currently make our identity model neither cleanly one nor cleanly the other.**

**Confidence: ~70%.** The engineering-simplicity case for strict 1:1 is real and I take it seriously. But strict 1:1 is the one move in this decision that is genuinely hard to undo, it would tear out product surface we deliberately built and shipped two weeks ago, and the trigger that raised the question (cross-org coach chat) barely benefits from it. The "default to one, allow more by exception" posture banks almost all of 1:1's simplicity wins **reversibly**, while keeping every future door open. The remaining ~30% of doubt is genuinely a market-knowledge call only the owner can make.

**Why this is the cheap moment regardless of which way we go:** we have exactly one real customer today, in one org. So whatever we decide costs almost nothing to implement now. That argues for making a _deliberate_ decision now — it does **not** by itself argue for the most aggressive, least-reversible version of it.

---

## 1. What is actually true today (verified against live code, not memory)

I had a multi-agent investigation read the live database snapshots and the actual code paths — not the migration files, which have drifted before — and then had a second pass adversarially try to disprove each finding. The load-bearing facts below are confirmed.

**Our system today is a genuine hybrid — and inconsistent with itself:**

- **The database fully allows multi-org.** A person can be an active member of many organizations at once. Nothing in the database stops it. (One membership row per person _per org_; no limit on how many orgs.)
- **Multi-org is not an accident — it was built on purpose, recently.** The cross-workspace home screen (one card per workspace + a "Start something new" button), the "All Workspaces" links in both the admin sidebar and the coach portal (desktop and mobile), and the "add another workspace" flow were all shipped deliberately ~2026-06-09. A returning user can spin up a second organization without signing up again.
- **Account-deletion is already multi-org-safe.** When you remove someone from one org, if they belong to other orgs we only remove _this_ org's access and keep their account and their other memberships. The remove-member dialog even changes its wording to say "their account and access to their N other organizations are kept." This safety net exists _specifically_ because multi-org exists.
- **But enforcement is contradictory.** Inviting an _existing_ user who already belongs to another org is **blocked** ("This user already belongs to another organization"). Yet the "add a workspace" path lets an owner create unlimited additional orgs with **no** such check, and neither invite-acceptance path re-checks at accept time. So one door says "one org only," another door says "as many as you like," and they're both open. Our own plan file flags this gap as **explicitly undecided**.

**Both owner constraints already hold — and neither depends on multi-org:**

- **Multiple hats inside one org works today without multi-org.** A single person can be the org owner/admin, run tournaments, _and_ be a coach with a coach portal — all inside one organization, from a single membership. The "admin hat" and the "coach hat" live in two different places that are combined for display, so no second org is needed. **Enforcing 1:1 would not break this.** (Confirmed.)
- **One premium Coaches Portal per email is _conventional, not enforced_.** Email uniqueness gives us one account per email, but nothing stops one account from buying two Coaches Portals. It isn't exploitable today only because Coaches Portal checkout is switched off (see below). This gap is independent of the 1:1 decision and should be closed before launch either way.

**The standalone Coaches Portal isn't live yet:**

- The "Team" plan (Coaches Portal Premium) is gated as **early access**: the public sees an interest-capture form, the checkout endpoint refuses with a "not open yet" message, and the Stripe pricing isn't even configured. There are **no paying standalone coaches** today. (The "exactly one prod user" headcount comes from project memory, not a live database count — but the code makes a paid standalone coach essentially impossible through the normal flow, so the practical conclusion holds.)
- A standalone coach is represented as **their own lightweight organization**. A free/basic coach is _not_ — they live in a separate teams table with no org membership at all. This distinction matters for 1:1 (below).

---

## 2. The 11-dimension comparison

For each dimension: the case for each model, and an honest verdict. "Soft single-org" = my recommended posture (default to one, allow more by exception). Where it materially changes the picture I note it.

| # | Dimension | Case for strict 1:1 | Case for multi-org | Verdict |
|---|-----------|---------------------|--------------------|---------|
| 1 | **User management & support** | One person = one place. No "which of my accounts/orgs is this?" confusion; no risk of an admin accidentally nuking someone's other-org account. | One login, one password reset, one human per identity even across roles. Today's _inconsistency_ actually creates more support surface than a clean multi-org would. | **Lean 1:1**, but **soft single-org captures ~most of it** (the average user is single-org anyway). |
| 2 | **Signup & onboarding clarity** | Linear: sign up → one workspace → one home. No workspace picker to explain. | The picker and "add more later" promise are a natural growth story for operators who expand. | **Lean 1:1 / soft single-org.** |
| 3 | **Real multi-org personas** | They can "use a second email." | A contractor admin running two clubs, an operator running a club _and_ a separate league, or a premium coach who is also a club staffer genuinely needs two memberships; a second email fragments their identity (see §3). | **Multi-org.** |
| 4 | **Cross-org coach chat (the trigger)** | Removes one real but bounded headache: deciding which org a cross-org notification belongs to. Eliminates a correctness worry that would otherwise recur on every future notification feature. | The chat itself works fine with everyone single-org _or_ multi-org; the hard parts don't change. | **Lean 1:1, but marginal — not a reason to do it.** The trigger does **not** justify 1:1 (see §6). |
| 5 | **Standalone coach model fit** | A standalone coach who isn't tied to any club fits 1:1 cleanly (they own exactly one workspace). | A premium standalone coach who is _also_ a club member needs two orgs. Strict 1:1 must either forbid that (a real, desirable persona) or carve out an exception — which reintroduces multi-org for the very audience the owner cares about. (Free/basic club coaches sidestep this — they don't get an org membership at all.) | **Multi-org**, narrowly — strict 1:1 needs a carve-out exactly where it hurts. |
| 6 | **Billing & entitlements** | One identity → one plan → no chance of cross-org entitlement bleed. | One person can pay for several distinct things under one identity and one Stripe relationship (cleaner for them). | **Push.** |
| 7 | **Data integrity & security (incl. deletion safety)** | The multi-org deletion-safety branch becomes unnecessary; simpler = fewer places to get wrong. | The safety net is already built and works; removing complexity we've already paid for isn't a fresh win. The orphan-team cleanup gap (see §9) exists under either model. | **Lean 1:1 on simplicity; neutral on real risk.** |
| 8 | **Engineering complexity carried** | Permanently removes "which org is current?" ambiguity; every future identity/notification/billing feature can assume one org. A compounding simplification. | All of that complexity is already built and working; deleting it now is real work, not free. | **Push short-term; lean 1:1 long-term.** |
| 9 | **Migration & blast radius of acting now** | Doing 1:1 today touches zero customers. | Doing nothing (or soft single-org) also touches zero customers — and avoids the _irreversible_ step. | **Lean multi-org / soft** — the option that keeps the irreversible move on the shelf. |
| 10 | **Reversibility / optionality** | If we ever want multi-org back, it's "just add rows." | But multi-org is _already built_, so strict 1:1 means doing throwaway removal now and a rebuild + user re-education later if we're wrong. Soft single-org keeps **both** doors open and cheap. | **Multi-org / soft, decisively** (see §7). |
| 11 | **Product strategy (3–5 yr)** | Clean siloed tenants; add connective tissue deliberately later. | Sports is inherently multi-affiliation; a "connected coach network" is easier to grow from a model that already lets one person span contexts. | **Push, leaning multi-org** if the network vision is real. |

**Read of the table:** strict 1:1 wins the _operational simplicity_ dimensions (1, 2, 4, 7, 8-long-term); multi-org wins the _strategy, personas, and optionality_ dimensions (3, 5, 9, 10, 11). That split is the whole story: the right move is to **bank the simplicity wins in a reversible way** (default to single-org) rather than pay for them with the one irreversible action on the board.

---

## 3. The real multi-org personas and the true cost of "use a second email"

Strict 1:1's fallback for anyone who legitimately spans orgs is "use a different email." Here's who that hits and what it actually costs them. The distinction that matters: someone only needs **two memberships** if they hold a real _role_ in two orgs. A coach who is merely on a club's roster (free/basic) does **not** create a second membership, so they fit 1:1 fine. The genuine two-membership personas:

| Persona | Why they need 2 orgs | Does "second email" work? | True cost |
|---------|----------------------|---------------------------|-----------|
| **Contractor / shared administrator** (runs tournaments or admin for two independent clubs) | Full admin in both | Technically yes | Two logins with no switching; two separate notification inboxes (misses a Club A alert while in Club B); two billing relationships; double credential management. **High churn risk** for a time-poor volunteer. |
| **Operator who grows from tournament → league** (separate legal entities) | Owns two orgs | Technically yes | Two Stripe relationships for one person; can't cross-reference tournament and league data; breaks the "grow your account as you grow" story we currently advertise. |
| **Premium standalone coach who is also club staff** | Owns their portal + holds a club role | Technically yes | Their own coaching identity and their club identity never connect; two inboxes; the cross-org chat we want to enable would see them as two unrelated people. |
| **Coach for two clubs (both as real staff)** | Two club roles | Technically yes | Same fragmentation; in practice they'll pick one and let the other lapse. |
| **Parent who is also a coach** | _Not actually a multi-org case_ | n/a | Parents have no login today; the planned parent identity is deliberately separate from org membership. Listed only to rule it out. |

**The honest weighting:** "use a second email" is a real workaround, not a blocker — but in a market of time-poor volunteer administrators, identity fragmentation is a quiet churn vector, not a neutral inconvenience. The person who can't understand why their notifications are split will not file a ticket; they'll just drift away. How big this population is in _our_ specific market is the single biggest unknown, and only the owner can size it (Question 1).

---

## 4. What enforcing strict 1:1 now would require — and permanently foreclose

**Requires (all cheap today, because nobody is affected):**
- A hard rule limiting a person to one organization, plus making every entry path agree (the add-workspace path, both invite-accept paths, and the standalone-coach provisioner all currently disagree).
- Removing or hiding shipped product surface: the multi-workspace home, the "Start something new" / add-workspace flow, and the "All Workspaces" links in the admin and coach shells.
- Resolving the standalone-coach case: decide whether a premium coach may _also_ be a club member (and if yes, you've already reintroduced multi-org for them).

**Permanently forecloses (until a deliberate, currently-unplanned rebuild):**
- The "grow from tournament to league under one account" path.
- The premium standalone coach who is also a club affiliate.
- Any contractor / consultant / shared-admin model.
- A connected coach network built on people who naturally span contexts.

The stress-test's sharpest point: don't launder these foreclosures as an "engineering simplification." They are product-strategy decisions. If we go 1:1, the owner should sign off on each foreclosure on purpose — not inherit them as a side effect.

---

## 5. What keeping multi-org costs if we just leave it as-is

Leaving it untouched is **not** the recommendation — "as-is" is the inconsistent hybrid, which is the actual problem. Its real costs:
- **A live correctness gap:** the contradictory gates mean behavior is unpredictable (blocked one way, wide open another).
- **A compounding "which org?" tax:** every notification-style feature has to decide which of a person's orgs a message belongs to. Today that's a latent edge case (no multi-org users); it becomes a real per-feature cost as the codebase grows. This is the most legitimate long-run argument _for_ 1:1.
- **A bit more support surface** from the workspace switcher and "I can't find my other org" confusion.

The fix for the inconsistency is to **pick one policy and make all four paths agree** — which is required under _either_ model and is cheaper to do forward (toward a coherent default-single-org) than backward (a full reversal).

---

## 6. Cross-org coach chat: what 1:1 actually buys (re-derived independently)

The owner asked whether 1:1 makes cross-org chat cleaner. Re-deriving from the live code and the chat plan:

**What 1:1 genuinely simplifies (one thing):** _notification routing._ A cross-org message has to land in the right recipient's notification bell, and our bell is scoped to a specific org. Under multi-org, we must figure out which of a recipient's orgs to attach the alert to; under 1:1 there's exactly one, so the question vanishes. The stress-test is right that this is more than a one-off — it's a small correctness worry that would otherwise recur on every future notification feature.

**What stays exactly as hard either way (everything that's actually hard):**
- Letting a chat room exist that belongs to _two_ orgs instead of one (a schema change, needed regardless).
- Discovery — how coaches find each other (invite-by-link first, directory later).
- Consent and Canadian privacy/anti-spam law (CASL/PIPEDA) for messaging across organizations.
- Moderation — who owns and polices a cross-tenant room.
- The real-time + security-policy "silent failure" risk that the chat plan already flags as a blocking gate.

**Verdict:** 1:1 helps cross-org chat _a little_ and blocks _none_ of its hard parts. The trigger is **not** a reason to enforce 1:1. And the audience for cross-org chat is **zero today** (the standalone Coaches Portal isn't launched), so nothing here is time-pressured.

---

## 7. Reversibility — the heart of the matter

The tempting framing is: "1:1 → multi-org later is easy (just allow more rows); multi-org → 1:1 later is a painful migration. So pick 1:1." **That framing is incomplete, because multi-org is already built.**

Account for that, and the picture flips:

- **Pick strict 1:1 now:** you do _subtractive_ work now (remove shipped features, add an irreversible constraint). If you're wrong, you do the _additive_ rebuild later **and** re-educate a user base that learned the product as single-workspace. You may pay for the same capability twice and still take a perception hit.
- **Soft single-org now (recommended):** you do near-zero build work (the machinery exists), and you keep the multi-org _population_ near zero by simply not advertising it. That means:
  - You can still harden to strict 1:1 later — the migration stays cheap precisely because almost everyone is single-org by default.
  - You can also open up to full multi-org later — just surface the flows that already exist.
  - **Both doors stay open and cheap.**

The only thing soft single-org gives up versus hard-1:1-now is the "perfectly free" moment to apply the _irreversible_ constraint. But since the multi-org population stays tiny by design, that window stays _nearly_ free for a long time. We trade a sliver of future migration cost for keeping every option open. That's a good trade pre-launch, when uncertainty is highest.

**Cost of being wrong, each way:**
- Wrong about 1:1 (we enforce it, then need multi-org): rebuild + re-educate users + explain why early customers got a narrower product. Moderate-to-high, and it grows with customer count.
- Wrong about soft single-org (we keep it, then want strict 1:1): a small migration to collapse the few multi-org users + remove the switcher. Low, and we kept it low on purpose.

Soft single-org has the smaller regret in both directions.

---

## 8. Recommendation & confidence

**Recommendation:** Make **single-org the default, deliberate experience**; keep the multi-org capability intact but un-advertised; and **make the four entry paths consistent** so we are no longer half-one-thing-half-another. Do **not** apply an irreversible one-org database constraint now. Treat strict 1:1 as a _later, optional_ hardening we can choose once we have real customers and real market signal — not a pre-launch commitment.

**Confidence: ~70%** that this beats both "hard 1:1 now" and "embrace/advertise full multi-org now."

**This is independent of cross-org chat** (which doesn't need the decision either way) and **does not foreclose** strict 1:1 later.

Concretely, in plain terms, this means:
1. **Decide the model is "multi-org capable, single-org by default."** Lead every new user to one workspace; stop prominently inviting them to add more. (Banks most of 1:1's simplicity, reversibly.)
2. **Make the gates agree** so behavior is predictable (no more "blocked here, wide open there").
3. **Add a "one premium Coaches Portal per email" guard before that checkout is switched on** — needed under any model.
4. **Fix the notification routing when cross-org chat is built** — needed anyway.
5. **Revisit strict 1:1 deliberately** once there's customer/market evidence, treating it as an opt-in hardening.

### The 2–3 questions only the owner can answer

1. **How common, in your market, is one person needing a real administrative role in two or more separate organizations?** (Contractor admin across two clubs; operator running a club _and_ a separate league.) If that's a rare tail (<~5%), strict 1:1 becomes much more attractive. If it's common (volunteer overlap is the norm in Canadian club sport, easily 20–40%), strict 1:1 is a churn vector and soft single-org is clearly right.
2. **Do you want FieldLogicHQ to grow into a connected coach/operator network, or stay strictly siloed tenants?** A network vision argues for preserving multi-org optionality; a strict-silo vision tolerates 1:1.
3. **For a premium standalone coach who also works inside a club:** should one login carry both their own portal and a club role, or is "one login = one org/role" an acceptable simplification you'd actively enforce? Your answer decides whether strict 1:1 even holds for the audience the cross-org chat is meant to serve.

---

## 9. Adversarial check — the strongest case against this recommendation

I argued the opposite as hard as I could. The best pro-strict-1:1 case:

- **Pre-launch is the only truly free moment**, and the irreversible constraint only gets more expensive from here. Soft single-org "preserves optionality" but optionality has a carrying cost — every future notification/identity/billing feature pays the "which org?" tax forever, and "we'll harden later" is the kind of cleanup that never happens.
- **The connected-network vision does _not_ require multi-org _membership_.** Cross-org chat connects people by identity, and each person can be single-org; the network is built on _connections between_ single-org identities, not on one person spanning orgs. So 1:1 doesn't actually foreclose the network — that weakens my §4 foreclosure list.
- **The standalone-coach collision is narrower than it first looks:** free/basic club coaches don't create a second membership at all, so most "coach who also helps a club" cases already fit 1:1. The true collision is only the premium-coach-who-is-also-club-_staff_ — possibly a small population.
- **The multi-org features serve an audience of zero today**, so "tearing out shipped product" touches no one and the perception cost is hypothetical.

**Why the recommendation still stands:** every one of those points is valid, and together they're exactly why my confidence is 70% and not 90%. But they argue for _making the simplicity reversible_, not for paying the irreversible price now. The decisive asymmetry holds: soft single-org captures the bulk of the simplicity, keeps both doors open, and doesn't reverse working product — while the only unique prize 1:1 offers over soft single-org (permanent elimination of the "which org?" tax) can still be claimed later at low cost _because_ we kept the multi-org population near zero by default. The one thing that would flip me to recommending strict 1:1 now is a confident owner answer to Question 1 that multi-affiliation is genuinely rare in our market **and** to Question 2 that we don't want a connected network. Absent that signal, locking the most irreversible option pre-launch is the higher-regret move.

**Residual risk to accept, either way:**
- If we adopt soft single-org: the four inconsistent gates and the per-email Coaches-Portal guard **must** be fixed before onboarding real users — "default to single-org" is only coherent if the paths actually agree. This needs an owner-assigned engineering slot, not deferred cleanup.
- If we later choose strict 1:1: it only stays cheap if we genuinely keep multi-org un-advertised in the meantime. If multi-org quietly proliferates, the migration cost rises just as the "act now" argument warned.

---

## Appendix — Technical Evidence

All claims below were read from live code and the committed schema snapshots (`docs/agents/db/schema-snapshots/…-prod.json` / `…-dev.json`), **not** migration files, and then adversarially re-verified.

**Membership model / DB**
- `organization_members` UNIQUE is **composite** `(organization_id, user_id)` — `schema-dump-indexes-prod.json:750` (`CREATE UNIQUE INDEX organization_members_organization_id_user_id_key … (organization_id, user_id)`); constraints snapshot lists it as two rows under one constraint name (`schema-dump-constraints-prod.json:1243-1257`). **No** single-column unique on `user_id`. Independently confirmed.
- `organization_members.role` is a single text value (default `'admin'`), not an array — `schema-dump-columns-prod.json` (role column). Statuses: `active`, `invited`, `suspended`.
- `getActiveMembershipRows()` (`lib/user-contexts.ts:157-165`) selects all `status='active'` rows for a user with no limit; `getUserAccessContexts()` (`:466-505`) emits one context per membership. `getAuthContext()` (`lib/api-auth.ts:95-109`) fetches all non-suspended rows and `.find`s by `orgSlug`.

**Shipped multi-org surfaces (the reversal cost)**
- Home launchpad: `app/home/page.tsx:116-121` (one `ContextCard` per context + unconditional `StartNewCard`→`/start`); single-context users auto-redirect (`:95-97`); zero-context→`/start` (`:78-82`).
- "All Workspaces" links: `components/admin/AdminSidebar.tsx:604`; `components/coaches/CoachPortalShell.tsx:275-276` (desktop) and `:407-408` (mobile).
- Add-workspace: `app/start/tournament/AddOrgForm.tsx:39`→`POST /api/org/create`; route docstring (`app/api/org/create/route.ts:27-35`) describes the deliberate "add a workspace for an already-signed-in user" path; commit `5479605` "feat: account-first onboarding (/start picker + add-workspace)".
- Deletion safety (J4-036/J5-012): `app/api/admin/members/[memberId]/route.ts:128-158` (membership-only removal when other memberships exist; hard-delete only on sole membership); UI copy `app/[orgSlug]/admin/org/members/page.tsx:629-638`.

**Inconsistent one-org enforcement**
- Blocks existing-user invite into a 2nd org: `app/api/admin/members/invite/route.ts:111-127` (HTTP 409). Applies to all invitable roles; **no** `account_kind` carve-out (so it would block inviting a premium standalone coach into a club).
- **No** check on the owner self-provision path (`app/api/org/create/route.ts:36-107`).
- **No** check at accept time (`app/api/auth/accept-invite/route.ts:80-110`; `app/api/auth/invitations/[memberId]/route.ts:89-100`). `accept-invite` uses `.maybeSingle()` → **latent bug**: errors if a user holds 2 pending invites.
- Explicitly logged as undecided: `INVITE_RECONCILIATION_PLAN.md:94` ("Cross-org accept guard … UNDECIDED").

**Multiple hats in one org (constraint 1 — holds without multi-org)**
- Admin hat = `organization_members.role`; coach hat = `rep_team_coaches` (separate table, no FK to membership; unique on `(program_year_id, user_id)`). `getUserAccessContexts()` (`lib/user-contexts.ts:466-484`) stacks a coach context onto an `organization` context from the **same** membership row via `getCoachingAssignmentsForUser()` (`lib/db.ts:4225-4236`). Nuance: a member whose role is literally `coach` returns a `coaches_premium` context and is skipped by the stacking branch — a display-routing detail, not a multi-org dependency.

**Standalone coach representation (constraint 2 + collision)**
- Premium coach → real org with `account_kind='team_workspace'`, `plan_id='team'`, active owner membership (`lib/team-workspace-provisioning.ts:228-255`; `createOrganizationMember` defaults `status='active'`). Free/basic coach → `basic_coach_teams`/`basic_coach_team_users`, **no** org membership (`lib/basic-coach-teams.ts:363-451`).
- "One premium portal per email" is **not** enforced: no unique on `team_workspaces.primary_owner_user_id`; checkout (`app/api/billing/create-team-checkout/route.ts`) and provisioner have no per-owner pre-check (only a Stripe-subscription idempotency guard). Not exploitable today only because checkout is gated.

**Team plan launch status**
- `gatingStatus: 'early_access'` (`lib/plan-config.ts:44-55`); UI shows interest form (`app/coaches/start/page.tsx:18-29`); checkout returns 403 (`create-team-checkout/route.ts:40-46`); Stripe prices unconfigured (archived checklist all unchecked). Gating resolves DB-first (`lib/plan-gating-server.ts:29-50`) — a platform admin _could_ flip a `plan_gating` row to `live` without a deploy. "Zero paying standalone coaches" is high-confidence from the code gate; the "one prod user" headcount is from memory, not a live count.

**Cross-org chat / notifications**
- `notifications.org_id` is `NOT NULL` (`schema-dump-columns-dev.json:4260-4266`); bell filters by org (`app/api/notifications/route.ts:44-46`). Fan-out stamps the single caller-supplied `org_id` (`lib/notify.ts:200`) and does not resolve a per-recipient org — hence the routing problem 1:1 removes. `notification_preferences` is also `(user_id, org_id, event_type)` with `org_id NOT NULL`, so cross-org recipients silently fall through to defaults. Chat tables (`chat_rooms`, etc.) are planned, not built; cross-org room needs a nullable room org + new surface type regardless of identity model (`CROSS_ORG_COACH_MESSAGING_PLAN.md §5.1`).

**Incidental bugs surfaced (independent of this decision; fix regardless)**
- Org-admin member hard-delete (`app/api/admin/members/[memberId]/route.ts:160-175`) does **not** run the orphan-team cleanup that the platform-admin delete path does (`app/api/platform-admin/users/[id]/delete/route.ts:23`) — J5-012 is only half-applied; an org admin deleting a sole-membership user who owns a basic coach team can orphan that team.
- `accept-invite` multi-pending-invite `.maybeSingle()` error (above).
- Membership-only removal doesn't null out tournament/division contact references pointing at the removed member.
