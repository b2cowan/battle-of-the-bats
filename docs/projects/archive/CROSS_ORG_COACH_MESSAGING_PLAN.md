# Cross-Org Coach Messaging — Implementation Plan

**Status:** PLANNED (not started). Extension of the Coach Chat Platform; deferred behind the core chat engine and the Coaches Portal launch.
**Origin:** Owner request (2026-06-19) — let a coach in one org message a coach in another org (e.g., a Club coach messaging a standalone coach to arrange a scrimmage). Scoped via a multi-agent investigation + adversarial fact-check the same day (all 6 load-bearing claims verified against live code).
**Program umbrella:** `docs/projects/active/COACH_CHAT_PLATFORM_PLAN.md` (shared engine spec + program map). This is **Project 3** of the Coach Chat program; it reuses the shared engine built in **Project 1 (Tournament Chat — `TOURNAMENT_CHAT_PLAN.md`)** and is a fourth surface on that engine, not a separate build.
**PM brief:** `docs/projects/active/CROSS_ORG_COACH_MESSAGING_PM_BRIEF.md`
**Related open decision:** the strict "1 user = 1 org" question is being analyzed separately — see `docs/projects/active/ONE_TO_ONE_VS_MULTI_ORG_ANALYSIS_PROMPT.md`. **This plan does NOT depend on that decision** (see §2).

---

## 1. The core finding

Cross-org coach messaging splits into three layers with very different costs:

1. **Transport (the chat engine)** — already designed in the parent plan, fully reusable. The planned message-access rule is membership-based (you can read a room only if you're an active member), which is **already org-agnostic** — a room whose two members belong to different orgs passes the rule with no change.
2. **Structural fixes** — a small set of targeted changes so a room can belong to *no single org* and so the in-app notification bell lights up for a recipient in a *different* org. Medium complexity, required by any approach.
3. **Discovery + consent + anti-abuse** — how one coach *finds* another, opt-in consent, blocking/reporting, anti-spam. This is the real bulk of net-new product work and carries a **CASL/PIPEDA legal review**. It is deferred to a later phase.

## 2. Does the "1 user = 1 org" decision gate this?

**No.** A cross-org chat room spans two orgs *by definition*; that is a room-design problem, not a user-identity problem. Strict 1:1 would tidy up *which org a person is*, but it would not remove the need for the room/notification fixes, the discovery surface, or the legal review. This plan is therefore safe to pursue under **either** identity model, and the recommended approach explicitly **does not require** the 1:1 migration. (The 1:1 question is worth deciding on its own merits — separate analysis.)

## 3. Locked product decisions (owner)

1. **Free coaches are excluded from cross-org coach messaging.** A free coach's only chat access is the **tournament chat hosted by a tournament admin** (Surface A of the parent plan). Cross-org coach-to-coach messaging requires a **paid coaching entitlement on both sides** (the paid Coaches Portal "Team" plan, or a Premium coach seat in a League/Club). This removes the awkward free-receives-from-paid asymmetry and simplifies gating.
2. **The coach directory is opt-in.** Coaches do not appear as discoverable to other orgs unless they explicitly opt in. (The directory itself is V2 — deferred; see §6.)
3. **V1 discovery is invite-by-link, no directory** (see Approach, below) — sidesteps cross-tenant PII exposure and the legal review for the first release.

## 4. Recommended approach

**Leave the multi-org model intact; build cross-org rooms on the existing engine; ship invite-by-link first; defer the directory.**

- **Room model:** allow a chat room to belong to no single org (a new "direct message" room type). Two coaches from different orgs each become active members; the existing membership-based access rule already admits them.
- **Discovery V1 (invite-by-link):** a coach generates a single-use, expiring link from their portal and shares it out-of-band (the way they already trade contact info). The recipient clicks, logs in if needed, and a private cross-org thread opens. No searchable directory, no cross-tenant personal data indexed → **no directory legal review needed for V1**.
- **Discovery V2 (opt-in directory, deferred):** once real standalone coaches exist, add an opt-in directory (name + org + sport/age group, no contact details exposed) with connection-request → accept → room, plus block/report/rate-limit. Gated behind a CASL/PIPEDA legal review.

This was chosen over (a) directory-first (too much net-new work and legal exposure before there's an audience) and (b) 1:1-migration-first (a costly reversal of shipped work that doesn't actually solve the cross-org room problem).

## 5. The three structural fixes (required before any cross-org thread works)

1. **Room ownership** — let a direct-message room exist without a single owning org, and add the "direct message" room type to the allowed set. (Both must change together; one without the other fails at the database layer.)
2. **Notification routing** — today an in-app bell notification is stamped with the *sender's* org and the recipient's bell only shows notifications stamped with the recipient's *own* org, so a cross-org bell alert would be invisible. Stamp each recipient's notification with **their own** org at fan-out time. (Web push already works cross-org with no change — only the bell is affected; without this fix testing would show the confusing state of "push arrives but the bell never increments.")
3. **Plan gating** — the paid Coaches Portal "Team" plan currently shares the same internal rank as the *free* tournament plan, so a naive rank-based gate would leak this feature to free users. A gating check that recognizes the paid coaches-portal account type (not rank alone) is required.

## 6. Phasing & LOE

One experienced engineer familiar with the repo; ranges include the standard migration overhead (~1–1.5 days each) and the `/review` gate per phase.

| Phase | Scope | LOE / dependency |
|---|---|---|
| **0 — Precondition: launch the Coaches Portal** | Turn on self-serve checkout for the standalone "Team" plan + finish the Stripe launch checklist. Cross-org coach messaging has **no real audience** until standalone coaches can sign up and pay. | Owner-owned (Stripe config + smoke test); external dependency |
| **Prereq — Projects 1 & 2** | The shared chat engine (built in **Project 1, Tournament Chat**) and in-org coach chat (**Project 2**). Cross-org is an extension of this engine, not a parallel build. | per those projects (~3–4 wk + ~2–3 wk) |
| **1 — Cross-org transport fixes** | The three structural fixes in §5. | ~1–1.5 weeks |
| **2 — Cross-org DM: invite-by-link (V1)** | Link generation in the coach portal (single-use + expiring, rate-limited), accept/join flow, an inbox entry, reuse of the shared chat panel; either party can leave/block; initiator moderates. No directory. | ~1.5–2 weeks |
| **3 — Opt-in directory + connection requests (V2, deferred)** | Opt-in directory, connection request → accept → room, block/report/rate-limit. **Blocked by a CASL/PIPEDA legal review.** Defer until real standalone coaches exist and V1 proves demand. | ~4–6 weeks + external legal review |

**Net for messaging itself** (on top of the core engine): ~2.5–3.5 weeks for V1; the directory is a separate, later release.

## 7. Gating model

- **Both participants** in a cross-org coach thread must hold a **paid coaching entitlement** (paid Coaches Portal / Premium coach). Free/Basic coaches cannot initiate or receive cross-org messages — their chat is limited to the admin-hosted tournament chat.
- Gating must key off the **paid coaches-portal account type**, not internal plan rank (see §5.3), to avoid a free-tier leak.

## 8. Risks

1. **No audience yet** — the standalone Coaches Portal is still in early access (no self-serve checkout, no paying standalone coaches in production). Building messaging before Phase 0 means building for a segment that doesn't exist. Phase 0 is a hard dependency.
2. **Notification half-delivery in testing** — without the bell-routing fix (§5.2), cross-org messages deliver web push but never increment the bell, which reads as "broken." Do §5.2 before any cross-org UI testing.
3. **Plan-gate leak** — relying on plan rank alone exposes the feature to free tournament orgs (§5.3).
4. **Realtime + access-rule silent no-op** — the parent plan's top risk: if the message-access rule is wrong at subscribe time, clients silently receive nothing. Validate with a live subscription before building UI (parent-plan gate).
5. **Cross-tenant data exposure** — production grants broad default read access; any future directory table must be access-controlled from the first line of code. (V1 avoids this entirely by not building a directory.)
6. **CASL/PIPEDA** — stranger-to-stranger contact across orgs is a harder anti-spam/consent case than one-directional admin messaging. Directory (V2) needs legal sign-off; invite-by-link V1 does not (the coach opts in by generating the link).

## 9. Open decisions (remaining)

1. **Which paid entitlements qualify** on each side — paid Coaches Portal only, or also Premium coaches in League/Club, and does a Tournament Plus admin acting as a coach qualify? (Both sides paid is locked; the exact set of qualifying paid products is open.)
2. **Room persistence** — do cross-org threads live forever, or auto-archive after inactivity?
3. **Directory fields (V2)** — name only, name + org, or name + org + sport/age group. Each added field widens consent/PII scope.
4. **Block/report depth (V2)** — simple mutual-leave/block vs. a reportable-to-platform-admin flow.

## 10. Dependencies

- Coaches Portal commercial launch (Phase 0).
- Shared chat engine + in-org coach chat (Projects 1 & 2).
- The three structural fixes (§5) before any cross-org thread.
- CASL/PIPEDA legal review — **V2 (the directory) only**; V1 (invite-by-link) does not require it.
