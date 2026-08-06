# PM brief — Platform-admin actions that don't do what they say

**Companion to:** `PLATFORM_ADMIN_ACTION_ENFORCEMENT_AUDIT_FINDINGS.md` (evidence for every claim here)
**Status:** ✅ **RULED AND BUILT 2026-08-06** — owner chose **hard-block immediately** plus all four
secondary fixes. On `dev`, uncommitted. Owner QA = ledger **§1.19**. No migration.
Implementation detail → `PLATFORM_ADMIN_ACTION_ENFORCEMENT_PLAN.md`.

⚠ **One thing still needs you, and it is a one-minute job:** check
`ENTITLEMENT_GRANTS_ENABLED` in the Amplify environment (see §4 below). If it is unset, every timed
override an operator has ever granted did nothing — and no code change here can tell you either way.

---

## What we went looking for

One question, asked of every state-changing action a platform admin can take:

> *This writes something. Who reads it as a gate?*

If the answer is "nobody," the action is **recorded** rather than **applied** — the button works, the
audit log fills in, the screen says success, and the customer's experience never changes. That's the
whole defect class, and it's invisible precisely because every surface reports success.

51 routes swept. Six findings. Two suspected problems refuted with evidence.

---

## What an admin believes vs. what actually happens

### 1. "I cancelled their subscription." *(critical)*

The confirm dialog shows a **"Will shut down:"** checklist. For a Club account it includes, word for
word, *"Rep Teams tryouts, rosters, **coach portal**, and player documents"* and *"Tournament setup,
scheduling, communications, and **score updates**."*

**What actually shuts down:** public tournament pages, registration links, the org's public site,
house league, accounting, and the admin dashboard. Tournaments get archived. That part is real.

**What doesn't:** the **Coaches Portal, in full, forever.** Every coach keeps rosters, attendance,
lineups, development plans, practice plans, team budgets, player documents, the Club Shared Book and
Game-Day Mode. Not one of the 150 coach endpoints asks whether the org still pays.

Alongside it, the **scorekeeper app keeps accepting scores.** It's an installed phone app that lives
outside the admin screens, so the redirect that bounces a cancelled admin to the billing page never
runs there. Volunteers keep entering scores — into pages the public can no longer see.

**Cost:** the single most expensive thing a Club pays for keeps working after the money stops. There
is no timer on this. It doesn't expire, and no nightly job cleans it up.

**Why nobody noticed:** cancellation *does* correctly shut down whole modules — accounting, house
league, public site. The safety check exists and works. It just isn't on the two paths that matter
most, because those two authorise on *who you are* rather than *what the org pays for*.

---

### 2. "I published the new plan feature matrix." *(high)*

A packaging change here goes through real governance: raise a change request, get it **approved by a
second person**, publish. The screen confirms *"Feature matrix published"* and redraws the grid with
the new values.

**Not one customer's access changes.** The published matrix is read by exactly one thing: the same
platform-admin screen that wrote it. It's a mirror reflecting itself. The live product reads a
separate, code-level list — so a genuine packaging change still needs a developer and a deploy.

The approval ceremony makes this worse, not better: the heavier the process, the more the result
reads as authoritative.

---

### 3. "I downgraded them to a smaller plan." *(medium)*

Modules shut off correctly. But an org moved from Club down to a one-tournament plan **keeps every
tournament it already had running** — the new cap only applies to the *next* one they create. The
route even counts the over-cap tournaments and writes the number into the audit log, then does
nothing with it.

When a *customer* downgrades themselves, the excess tournaments are archived properly. Only the
platform-admin path skips it. Bulk Operations has the same gap, across many orgs at once.

---

### 4. One-minute check that could invalidate a whole control *(needs you, not a build)*

Timed grants — *"Feature Access Trial"*, *"Subscription Status override"* — are enforced only when an
environment switch is turned on, and **that switch defaults to off.** It's on in development. I can't
read the production environment from here.

**If it's off in production, every override an operator has ever granted did nothing** — and the
screen said "saved" each time.

👉 **Check `ENTITLEMENT_GRANTS_ENABLED` in the Amplify environment.** If it's `true`, this closes.

---

### 5. Copy fix *(low)*

The single-org screen warns clearly that a Comp Period *grants no access* — it's a billing tag only.
The Bulk Operations screen, for the same action, just says *"Grant a comp period."* One screen works
hard to prevent a misunderstanding the other invites.

---

## Two things we suspected that turn out to be fine

**Banning a user does evict them.** The suspicion was that a banned user keeps working until their
token expires. They don't — every sign-in check revalidates against Supabase on each request, and a
banned account is rejected there. This is enforced by Supabase rather than by us, which is a
perfectly good place for it to live.

*One caveat worth writing down:* nothing in our own code reads banned state, so there's no backstop.
If a future performance change switches sign-in checks to reading the token locally instead of
asking Supabase, bans would silently stop working and no test would catch it.

**The billing-suspension timestamp only affecting checkout** is by design, and already documented.
Not a bug.

---

## ✅ Decided — and what it now does

**Ruling (2026-08-06): hard-block immediately.** Access stops the moment a subscription is
cancelled. Nothing is deleted; resubscribing restores everything intact.

Before building I checked the one thing that could have made this unsafe — whether a failed payment
could ever cancel an org automatically. **It can't.** A failed payment marks the account *past due*
and tells the customer; only Stripe giving up after its full retry window cancels. So the dunning
path already has a real grace period built into it, which is exactly what made the immediate
hard-block the right call rather than a risky one. Past-due accounts keep working, deliberately.

What changed, in customer terms:
- A cancelled club's coaches now see *"{Org}'s subscription has ended — nothing has been deleted"*
  instead of a working portal.
- The scorekeeper app says the same, instead of quietly accepting scores nobody could see.
- The billing page still works, deliberately and carefully — that is how they come back.
- A plan downgrade now archives the tournaments that no longer fit, as the customer's own downgrade
  always did.
- The feature matrix screen now says plainly that publishing records a decision but does not change
  customer access, and lists anything published-but-not-live.
- Bulk Operations carries the same honest comp-period warning the single-org screen always had.

There is also a **test that fails the build** if anyone adds a route that skips the billing check —
so this particular defect cannot come back quietly.

<details>
<summary>The options as they were presented (kept for the record)</summary>

## The decision I need from you

**How much should a customer lose when their subscription is cancelled, and when?**

This is pricing and packaging, not implementation — the options differ in what the customer loses,
how fast, and whether they can come back. I'm not making this call alone.

| | Option | What the customer experiences | Trade-off |
|---|---|---|---|
| **A** | **Hard-block on cancelled status at every gate** *(recommended)* | Access stops the moment you cancel. Their data is untouched and everything returns intact if they resubscribe. | Blunt — no soft landing. A billing hiccup misread as a cancellation locks a paying customer out. |
| **B** | Demote to the free plan immediately | They drop to free-tier limits and keep using what free allows. | We'd be silently *giving* a cancelled Club a free product, and it destroys the record of what they were paying for. |
| **C** | Grace period, then demote | A window (say 14 days) to change their mind before anything closes. | Kindest, most work, and it keeps paying for a cancelled account for two more weeks. |
| **D** | Read-only retention window | They can see the season out but change nothing, matching how cancelled tournaments already behave. | Most consistent with what we already do — but "read-only coaching" is a real product surface we'd have to design, not just a switch. |

**My recommendation: A**, with one qualifier.

It's the only option that makes the confirm dialog honest — the dialog already promises the coach
portal shuts down, so A is what the operator *already believes* they're buying. It's the smallest
change, it touches no pricing, and it needs no new UI. Data is retained either way, so resubscribing
restores everything.

The qualifier: **A is only safe if cancellation is genuinely deliberate.** It's an explicit,
reason-required platform-admin action today, so I believe it is — but if a failed payment could ever
flip an org to cancelled automatically, A would lock out paying customers on a card decline, and we
should do **C** instead. Worth a moment's thought before you rule.

**D is the interesting long game** and worth logging as a future direction even if you pick A now —
letting a cancelled club *read* its own history is a genuinely better goodbye than a locked door, and
it matches the archive behaviour that already exists elsewhere in the product.

Findings 2, 3 and 5 don't need a ruling — they're straightforward corrections once you've decided
on this one.

</details>

---

## What happens after you rule

1. I write the implementation plan + its own PM brief, and log the decision via `/strategy` (there's
   a binding Business Decisions Log).
2. Build. This is billing/auth code — high-risk tier — so `/review` runs on it, and `/docs` if any
   customer-facing wording changes.
3. QA ledger section. ⚠ **Entitlement changes are nearly impossible to QA by clicking** — a cancelled
   org that still works looks identical to a working one. The ledger has to tell you *how to see the
   difference*, or it's theatre. My plan: a scripted before/after against a throwaway dev org, plus
   an automated test that fails the build if a coach route is ever added without the billing gate —
   the same shape as the archive allow-list guard that already protects the coaches portal.

---

## Housekeeping

Nothing was committed. No source file was touched — this audit produced two documents and one TODO
line. The one failing typecheck on the branch is another session's, and was failing before I started.
