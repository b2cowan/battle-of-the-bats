# Account Model Freedom — Decision-Grade Analysis

**Commissioned:** 2026-07-23 (owner) · **Prepared:** 2026-07-24
**Status:** Analysis only — nothing here is Decided. Directions are **Proposed** and await owner ratification option-by-option.
**Scope:** What one person can **own, join, coach, and pay for** on FieldLogicHQ — the balance between product simplicity and user freedom.

> Method: a 186-agent evidence sweep (one investigator per persona/subsystem), an adversarial-verify pass on every load-bearing claim (60 of 147 claims were corrected or refuted under refutation — the corrected versions are what appear below), three independent option-package drafts, a 3-judge panel, and a completeness critic. Every capability statement is cited to `file:line` or the live schema snapshot. Pricing reconciled against `docs/agents/strategy/PLAN_PRICING_FACTS.md`.

---

## 1. Executive summary

**The headline for a product owner:** the freedom question has a much smaller surface than it looks, because the codebase already draws a clean line that maps exactly onto cost.

- **Joining and coaching across many organizations is already open, cheap, and mostly working.** A coach can help teams in two clubs, a parent can follow kids in two associations, an admin can also coach elsewhere — none of this bills anything, none of it collides with the "one home org" rule, and the app already handles it (the "My Teams" switcher, the Flip's Roles popover, cross-org following). This is the **freedom the owner is worried about restricting — and there's no reason to restrict it.** It's the network the platform grows on.

- **Owning a second paid thing (a second org subscription, a second Premium Coaches Portal) is the expensive axis** — each one is its own Stripe customer, its own billing-isolation surface, and its own line item in the manual January-2027 conversion. This is where the real "more subscriptions = more money" upside lives, but also where cannibalization and support cost concentrate. Today it is *mostly* blocked, *inconsistently*, with a few real bugs.

- **Right now, during Founding Season, freedom is revenue-neutral.** Both Tournament Plus and the Premium Coaches Portal are $0-comped through 2027-01-01, and there is roughly **one real production org**. Every freedom decision below costs nothing in 2026. The only live costs of permissiveness today are (a) support/ops complexity and (b) inflating the manual January conversion queue. The money is a 2027 question; the guardrail bugs are a today question.

**Recommendation — Package C, "Verified Network" (phased):** Keep the 95%+ single-everything experience exactly as it is (they never see any multi-anything UI). **Fully open the cheap axis** — codify that joining/coaching across orgs is unlimited and free, since it already is. **Gate the expensive axis** (owning a 2nd real org or 2nd Premium Portal) behind a lightweight "tell us you run more than one organization" step. During the promo that step is just a form (pure lead-gen, nothing blocked); it only becomes a real approval + billing gate at the January cutover. This captures the one genuinely additive, non-cannibalizing revenue persona (an operator running two separate associations), structurally blocks the tier-arbitrage that erodes Club sales, and directly satisfies the owner's "troubleshoot one org without touching another" requirement because the multi-org cohort stays small and known.

**Runner-up — Package D, "Metered Freedom":** pick this instead if the owner weighs *maximizing subscription count and minimizing process* above cannibalization control — it leaves everything open and simply bills each extra org/portal as its own subscription in January, paired with a Club-bridge upsell nudge. It earns more per willing buyer but accepts tier-arbitrage risk and a heavier per-person January workload.

**Independent of which package is chosen, six code-truth items should be fixed now** (Section 9) — they are current bugs and inconsistencies, not policy choices, and several are overdue.

---

## 2. The organizing insight: two axes, not one

Every question the owner asked resolves onto one of two axes with very different economics.

| | **Membership axis (CHEAP)** | **Ownership axis (EXPENSIVE)** |
|---|---|---|
| What it is | Joining an org; being a coach/assistant/staff/official; following teams | Owning a real-org subscription; owning a Premium Coaches Portal |
| Billing footprint | **Zero** — a role never carries a subscription | **One Stripe customer each** — real money, real receipts, real refunds |
| Support footprint | Trivial — visible in the existing per-user console | Each is a separate billing-isolation surface + a January conversion line item |
| State today | **Largely open already** (some by deliberate design, some by unclosed gap) | **Mostly blocked**, inconsistently, with real bugs |
| Cannibalization risk | None | Real (2 cheap tiers instead of 1 Club; 2 standalone portals instead of Club) |

The whole decision is really: **how open should each axis be, and when.** The membership axis wants to be open (it's free and it's the growth loop). The ownership axis is where the owner's "more subscriptions = more money" instinct is right *and* where the caution about complexity and cannibalization is right — so it wants a deliberate, phased gate, not a blanket yes or no.

---

## 3. Section A — Current-state capability matrix

Legend for **Code status**: **✅ allowed & works** · **⚠️ allowed but buggy/leaky** · **🔒 blocked by code** (server refuses) · **📋 blocked by policy only** (a soft product rule / copy, no hard backstop). Every row is adversarially verified; where the finder's original tag was wrong, the corrected tag is shown.

### 3.1 Per-persona: can this person hold two of something?

| Persona | Two org memberships? | Own two orgs? | Own two org subscriptions? | Coach in two orgs? | Own two Premium portals? | Coach two teams in one org? |
|---|---|---|---|---|---|---|
| **Org owner** | 📋 blocked at invite/accept (soft) | 🔒 blocked self-serve (tournament path); ⚠️ **ungated** on league path | same as "own two orgs" (subs are per-org) | ✅ via guest-coach invite | 🔒 blocked (app guard) | ✅ |
| **Org admin/staff** | 📋 blocked (soft) | 🔒 / ⚠️ as above | as above | ✅ owner-of-A + coach-of-B works today | 🔒 | ✅ |
| **Rep coach** | 📋 blocked as *member*; ✅ as guest coach | — | — | ✅ (assistant-guest path bypasses the one-org rule by design) | 🔒 as owner | ✅ (My Teams switcher) |
| **Free basic coach** | ✅ (org-less, no collision) | — | — | ✅ unlimited, no cap | 🔒 as owner | ✅ unlimited basic teams |
| **Standalone Premium coach** | ✅ portal + club coexist by design | 🔒 self-serve | 🔒 | ✅ as added coach elsewhere | ⚠️ blocked at front door, **TOCTOU race + reactivation gap** | ✅ |
| **Tournament coach (email-keyed)** | ✅ no org scoping at all | — | — | ✅ registers/coaches across unlimited orgs | — | ✅ |
| **Scorekeeper / official** | 🔒 **no cross-org exemption** (blocked like admin) | — | — | 🔒 cannot be official in 2 orgs at once | — | ✅ multi-tournament in one org is first-class |
| **Fan / parent** | ✅ follows across unlimited orgs, zero friction | — | — | — | — | — |

### 3.2 Load-bearing facts behind the matrix (all verified)

**Schema ground truth**
- `organization_members` has only a composite `UNIQUE(organization_id, user_id)` — **nothing in the database limits orgs-per-user.** "Single-org by default" is entirely application-code policy, enforced at three chokepoints, with a fourth path (assistant-coach accept) that deliberately skips it. *(schema-snapshot; `lib/org-membership-policy.ts`; `lib/assistant-invites.ts:198`)*
- `team_workspaces.primary_owner_user_id` is nullable with **no unique index of any kind** — the parked "one Premium portal per owner" DB safeguard (incumbent decision #2) is genuinely absent. *(schema-snapshot: `team_workspaces`)*
- `rep_team_coaches` is unique only on `(program_year_id, user_id)` with a bare unguarded insert — one person can be a coach on unlimited teams across unlimited orgs. **This is the real mechanism behind "can a coach coach two Premium teams": yes — as an *added* coach, never as the second team's paying owner.** *(schema-snapshot; `lib/db.ts:4249`)*
- Org subscriptions live per-org (`organizations.stripe_customer_id` etc.). So "own two org subscriptions" is the *same question* as "own two orgs." *(schema-snapshot: `organizations`)*
- `fan_follows` has no `org_id` — a signed-in account follows teams/tournaments/orgs anywhere with no org scoping. *(schema-snapshot: `fan_follows`; `lib/follow.ts:96`)*
- `notifications.org_id` is NOT NULL — every notification belongs to exactly one org; there is no cross-org unified feed. *(schema-snapshot: `notifications`)*

**Ownership axis — what actually blocks a second Premium portal**
- A second live Premium portal **is refused by application code** on both the paid and the $0-comp checkout paths: a pre-checkout 409, plus a re-check inside both provisioning functions. Comp portals correctly count as "live." So **no, a coach cannot self-serve a second free comp portal today.** *(`app/api/billing/create-team-checkout/route.ts:104-117`; `lib/team-checkout.ts:589,830`)*
- **But the guard is app-code only, with three real gaps:** (1) a **TOCTOU race** — two near-simultaneous comp checkouts (two tabs/devices) both pass the read-then-write check and both provision, because there is no DB uniqueness and no lock; the comp path's own code comment names this race but only handles the sequential case; (2) the **reactivation branch** returns before the guard runs, so a coach sitting on 2+ previously-canceled workspaces can start two reactivation checkouts and end with two live portals; (3) a coach can trivially open a second portal **under a second email** — the 409 message literally says "use a different email to start another." *(`lib/team-checkout.ts:545-556,825-833`; `app/api/billing/create-team-checkout/route.ts:112`)*

**Membership axis — what's already open**
- **Owner-of-A can be coach-of-B today.** The assistant-coach email invite deliberately skips the one-org guard ("an assistant is a team guest, cross-club OK"). It only ever creates an *assistant* row — but an org admin can then promote that existing cross-org guest to *head coach*, because the head-coach add only checks for an active membership row (which the guest path created). So cross-org head coaching is reachable without ever hitting the one-org guard. *(`lib/assistant-invites.ts:279`; `app/api/admin/rep-teams/.../coaches/route.ts:95-106`)*
- **Multi-hat within one org works cleanly.** Coach access rides a separate `rep_team_coaches` row, never `organization_members.role`, so an admin who is also a coach stacks both hats on one membership. *(`lib/roles.ts:64`; `lib/db.ts:4587`)*
- **Tournament coaching has zero org scoping.** The unified `/coaches/tournaments` list shows every registration the account owns across all orgs; the one-org rule never touches tournament coaching. A single login can register and coach teams across unlimited orgs' tournaments. *(`app/coaches/tournaments/page.tsx:65`)*
- **Free basic-coach teams are uncapped** — a user can create unlimited org-less teams; ownership is a many-to-many join with no per-user ceiling. *(`app/api/coaches/teams/route.ts:42`; `lib/basic-coach-teams.ts:305`)*

**Where the incumbent policy leaks (real gaps, not hypotheticals)**
- **Self-serve org-create wrongly blocks a coach who owns a Premium Portal.** `/api/org/create` counts *all* active memberships with no team-workspace exemption — unlike the invite/accept path, which correctly exempts the portal. So a coach with a (now-$0) portal is 403'd trying to create their first real Tournament org, **directly contradicting the incumbent decision's own stated exemption.** *(`app/api/org/create/route.ts:54-68` vs `lib/org-membership-policy.ts:27-31`)*
- **`/api/league/create` has no one-org guard at all** — it's blocked only by the `LEAGUE_STARTER_BETA` flag being off in production (it is *on* in dev). When League Starter launches, this is an open second-org door. *(`app/api/league/create/route.ts:96-133`)*
- **Reinstate-after-suspend loophole:** flipping a suspended member back to active never calls the one-org guard, so suspend-in-A → join-B → reinstate-in-A produces two simultaneously-active real memberships with no check. *(`app/api/admin/members/[memberId]/route.ts:298-303`)*
- **The one-org gate fails open** on a transient DB error (documented as a "soft gate, not a security boundary") — a rare double-membership can slip through silently with no support signal. *(`lib/org-membership-policy.ts:48-55`)*
- **Officials/scorekeepers get *no* cross-org exemption** — the one-org block applies to them identically to admins. A scorekeeper cannot work two orgs at once. This is deliberate, and there may be a good reason to keep it (officiating conflict-of-interest), but it's an asymmetry worth an explicit ruling. *(`app/api/admin/members/invite/route.ts:112-121`)*

**Grandfathered multi-org is safe to read/navigate.** Where 2+ real memberships already exist (however created), the app resolves one deterministic home org, builds one context per membership, and lists them on the Home chooser — multi-org is a genuinely supported state, not an edge case that breaks. *(`lib/api-auth.ts:85`; `lib/user-contexts.ts:552`; `lib/auth-destination.ts:73`)*

---

## 4. Section B — The freedom questions: who wants this, how common, what revenue

All commonality figures are **reasoned estimates** — there is no usage data yet (pre-revenue, ~1 prod org, target 50 by year-end). Size these for 2027+ scale, not today's n≈1.

| Freedom | Real personas | Commonality (est.) | Revenue reality |
|---|---|---|---|
| **Own 2+ org subscriptions** | Tournament director serving two separate associations; small-town volunteer running the baseball tournament *and* on the hockey board | **Low (<5%)** of org admins — the owner's own 2026-06-19 prior called two-org admins "rare" | **$0 today** (comped). Post-Jan: a genuine 2-association operator is the **cleanest additive revenue** — full price, distinct budgets, high referral value. But same-club-splitting-into-2-cheap-tiers is **revenue-negative** vs one Club. |
| **Member of 2+ orgs** (non-owner) | Coach with a kid on two teams; parent in league A who coaches in league B; the "does-everything" volunteer | **High (15-30%)** of engaged coaches/volunteers — the single most common multi-affiliation shape | **$0 direct** — membership is a role, never a subscription. This is the **default case to design *for*, not restrict.** |
| **Coach 2+ Premium teams, same org** | Coaches both the U12 and U14 rep team at one club | Common within clubs | **Already solved at $0 marginal** — Club includes the whole staff's portals. Not an open pricing question. |
| **Coach 2+ Premium teams, different orgs / standalone** | Coach running two independent travel teams | **~5-10%** of Premium-adopting coaches | **$0 today** (comp, uncapped). Post-Jan: 2×$29 is real money **but is exactly the case the Club-bridge is meant to convert into a $219 Club sale** — letting it persist leaves the bigger sale on the table. |
| **Combos** (owner-A + coach-B; parent + coach; TD serving two associations) | Admin who volunteer-coaches elsewhere; the small-town super-volunteer | **3-8%** hold an external coaching role; the super-volunteer is rarest but **highest referral leverage** | Mostly $0 direct; outsized word-of-mouth value (the whole 50→500 growth model runs on these people). |

**The two cannibalization cases to keep in view:**
1. One legal club splitting into League Plus ($89) + Tournament Plus ($39) = $128/mo instead of one Club ($219, covers both arms) — **revenue-negative** if it's the same entity. The product has **no signal today to tell "two separate associations" from "one club arbitraging tiers."**
2. A coach running 2-3 standalone $29 portals instead of nudging the club to Club — **revenue-suboptimal** vs the bigger sale the platform's own 2026-06-22 decision designed standalone Premium to bridge toward.

**The Founding-Season lens (critical):** every freedom above is $0 today. The only live cost of permissiveness is that each extra comped org/portal becomes a **separate hand-conversion in January**, against the owner's stated ~50-account manual capacity. More permissiveness now = a longer January queue and a muddier read on real willingness-to-pay.

---

## 5. Section C — Billing manageability (per option)

Stripe customers are **per-org-row and per-workspace-row, never per-human** — one person owning two things gets two independent Stripe customers with no dedup. That makes isolation (portal, delinquency, refund-scoping) a **free side effect** of the 1-customer-per-org design, but also means a two-subscription owner enters card details twice and gets visually indistinguishable receipts. *(`lib/billing-setup.ts:10-44`)*

**Per-option × the seven billing sub-surfaces** (trivial / manageable / expensive):

| Sub-surface | 1 org + 1 portal (League owner who coaches) | 2 real org subs | 2 Premium portal subs |
|---|---|---|---|
| **Checkout** | trivial org-first; **buggy portal-first** (org-create 403 bug) | trivial (2 independent checkouts) | trivial mechanically, but front door blocks it (by design) |
| **Billing portal** | trivial — each org's page opens its own portal, correctly org-scoped | trivial — one call per org, no cross-contamination | n/a (blocked) |
| **Receipts / invoices** | manageable — 2 customers, but distinguishable (different plans) | **manageable→annoying** — two *same-tier* orgs produce **indistinguishable receipts** (no org name on invoice) | n/a |
| **Refunds** | **expensive everywhere** — **no Stripe refund code path exists at all**; refunds are Dashboard-only with **zero in-app audit trail** (no `charge.refunded` webhook) | same | same |
| **Comps** | trivial — comp workspace ($0, null subscription) coexists cleanly with a paid org sub | trivial | n/a |
| **Delinquency** | trivial — payment fail on one never touches the other (side effect of 1-customer-per-org) | trivial | n/a |
| **January manual conversion** | **2 hand-touches** for one human (no per-person batching) | **N hand-touches** — scales linearly with orgs owned | would be **M hand-touches** |

**Overall billing-cost rating per freedom option:** 1 org + 1 portal = **manageable** (works today org-first; one bug to fix). 2 org subs = **manageable** (mechanically trivial; receipts + January workload are the friction). 2 portal subs = **currently blocked** by design.

**Cross-cutting billing gaps that scale with *any* multiplicity:** no refund code path / audit trail; indistinguishable same-tier receipts; no unified "all your subscriptions" view anywhere in the consumer Account tab (each subscription is managed only at its own org's billing page); the January runbook batches nothing per human.

---

## 6. Section D — Support isolation (per option)

**The good news:** a genuine **per-human cross-org console already exists** (`Customer Users`) — one row per person with every org membership, role, plan, status. Coaches Portal ownership shows up in it too (a portal is an org with an owner membership row, labeled "Coaches Portal"). Org-scoped tools (plan, overrides, cancel-subscription, notes, per-org suspend/remove) are cleanly filtered by org — **a support agent working Org A cannot reach into Org B's data through them.** Invited-user-can't-login self-heals across all orgs at once (one successful login reconciles every pending invite). *(`app/platform-admin/customer-users/page.tsx`; `lib/invite-reconciliation.ts:72`)*

**The four sub-surfaces, and where isolation actually breaks:**

| Sub-surface | State | Blast radius |
|---|---|---|
| **Platform-admin scope** | Org tools org-scoped ✅ — **but** four account-level primitives (ban, reset-password, revoke-sessions, delete-user) act on the **shared auth identity**, so an action taken to fix Org A **logs-out/bans/deletes the person everywhere** (their other org, their portal, a club's staff access). Gated at the *support/billing* role tier, not super-admin — a lower bar than the blast radius warrants. | **Cross-org** for the four primitives |
| **Audit** | Org actions are logged on that org's audit tab ✅. **Every account-wide action is logged with `org_id = null`** — so an org's own audit tab will *never* show that its user was banned/reset/deleted, even when that org's ticket prompted it. | **Blind spot** per-org |
| **Notification fan-out** | The account-wide **pause** switch silences *every* org and hat at once; the Coach Insights digest **doubles** per portal (no cross-team bundling); registration emails can send up to 3 un-deduplicated copies to one person wearing two hats. | Worsens with each added context |
| **Email-keyed edges** | Email change orphans discovery of not-yet-linked tournament registrations under the old address (manual admin backfill to recover). | Isolated but manual |

**Two isolation findings that contradict a "support can't cross orgs" assumption** (both surfaced under adversarial verification and should be on the decision list):
- **A support/billing-tier operator can effectively log in as any customer today** via the "Reset Password" action — it returns the raw recovery link to the operator's own browser; opening it establishes a full authenticated session as that customer *before* any password change. There is no dedicated "impersonate" button, but the vector is real and reachable at the support tier, with no audit of the operator having used it. *(`app/api/platform-admin/users/[id]/reset/route.ts:22`; `app/(consumer)/auth/reset-password/page.tsx:43`)*
- **A "Complete Transfer" action on Org A's detail page has cross-org write blast radius** — completing a team-ownership transfer cancels the counterpart org's subscription, wipes its Stripe IDs, suspends all its members, and reassigns its data. So "working Org A never writes into Org B" is **not** categorically true. *(`app/platform-admin/orgs/[id]/OrgDetailClient.tsx:389`; `supabase/migrations/067...:267-279`)*

**Support-runbook cost per freedom option:** 2 real orgs per user = **trivial** (existing per-user view + per-org tools; only the 4 account primitives are collateral). 2 Premium portals = **manageable but under-tooled** (visible, but nothing *counts/flags* one owner holding two). Coach in 2 orgs = **trivial** (same primitive as multi-membership). One caveat that scales with any growth: the `Customer Users` and `Orgs` list views silently cap at 1000 users / 3000 membership rows with no truncation indicator.

---

## 7. Section E — UX complexity: the hard rule check

**Hard rule: a single-everything user must never see multi-anything UI.** Verified against the shipped surfaces:

- **The "All Workspaces" switcher is count-gated** and 0-safe — a genuine single-org, non-coach user never sees it. ✅ *(`lib/use-has-multiple-workspaces.ts`)*
- **The Flip's "Roles" popover renders nothing for a pure fan** and only shows non-fan hats, scoped to the current org's tournament page — a plain parent never sees a role affordance. ✅ *(`lib/use-public-flip.ts:55`)*
- **One account-wide theme preference**, one seeded "my team" pin **per tournament** (not one global), the Account tab carries **no** workspace list at all (it was deliberately moved to Home) — none of these expose multi-anything to a single-context user. ✅
- **Honest nuance:** a person who owns **1 real org + their own Premium Portal** — a combination *every* recommended package permits — **does** correctly see the "All Workspaces" switcher, because the switcher counts navigable workspaces (which includes the portal) while the one-org *policy* exempts the portal. This is **intended, working chrome, not a hard-rule violation** — that person genuinely has two places to go. It's worth stating plainly so it isn't mistaken for a leak.

**What each freedom option would force as NEW chrome (only ever shown when count>1):**
- **2 real orgs:** the existing switcher already covers navigation. There is **no in-context org-switcher** inside the admin shell (only an "exit to Home" link) — a 2-org admin round-trips through Home to switch. Net-new to make it smooth: an in-shell org switcher (optional polish, not required).
- **2 Premium portals:** the Premium coach shell has **zero cross-workspace navigation today** — a coach with two portals has literally no in-app way to move between them. This is **genuinely net-new UI** (a switcher + a thin cross-portal query), the one real build item any "open portals" package requires. The reusable pattern already exists in the free/basic coach shell.
- **Coach in 2 orgs / multi-membership:** already handled — the My Teams switcher and Home chooser cover it. No net-new chrome.

**Fan/parent impact (applies under every package):** opening ownership freedom changes **nothing** for fans. Cross-org following is already frictionless and account-scoped. The one genuine multi-context fan surprise exists *today, independent of any package*: the **notification-pause master switch is account-wide** — a parent with kids in two orgs who pauses for a vacation silences *both*, with no per-org granularity. Worth an explicit owner ruling (Section 10), but it is not created by any freedom option.

---

## 8. Section F — Marketing & packaging

- **Naming canon is binding** on any new copy: "Premium/Basic Coaches Portal," "League Plus," "Club · Association," full plan names, never "Pro/Starter/Enterprise." *(marketing_brand_voice; BRAND_STRATEGY §5)*
- **The anti-nickel-and-diming posture is canon.** The 2026-06-22 Club Repackaging *retired* the per-team meter specifically to kill that feel ("every team counts the same, no per-team fees"). **Any new per-org/per-workspace unit fee cuts against a ratified decision** and needs explicit sign-off.
- **Two bundle stories already exist and are reusable:** Club includes the whole staff's portals; annual = ~2 months free. **No "second org" or "second portal" bundle construct exists** — inventing one is net-new copy, and the pricing page (4 cards, 1 table, 1 FAQ) is structurally single-org-shaped. A formal multi-thing SKU would be a **new section**, and prominence risks confusing the 95% single-org visitor.
- **The live pricing FAQ already normalizes multi-org** — *"If you run multiple associations, each one is managed as its own organization"* (verified live at `app/pricing/page.tsx:146`) — **but is silent that each is a separate bill.** This is the one existing thread to build multi-org copy from, and it under-discloses cost today.
- **Communication-cost asymmetry:** a locked posture needs **zero** new copy (it's the silent default). An open posture is communicable with **one FAQ sentence** + the existing "Express interest" pattern — cheap. A formal bundle/discount is materially more expensive to communicate cleanly.

**Marketing-cost rating per option:** Locked = **trivial** (no copy). Verified Network = **low** (one FAQ line + a short "run more than one org?" prompt). Metered Freedom = **medium** (must disclose separate billing + fold in the Club-bridge nudge). A per-unit bundle SKU = **high** and fights the anti-metering canon.

---

## 9. Fix regardless of package — the code-truth list

These are **bugs and inconsistencies, not policy choices.** All three option drafts and all three judges converged on them. They should be fixed independent of the freedom decision; several are overdue.

1. **`/api/org/create` missing Coaches-Portal exemption** — wrongly 403s a portal-owning coach creating their first real org. Contradicts the platform's own stated policy. *(High)*
2. **Billing cancel/downgrade routes default to the caller's home org** instead of the org whose billing page invoked them — a multi-org owner clicking Cancel on Org B's page can cancel Org A. Live financial-harm risk the moment anyone owns 2+ orgs. *(High)*
3. **The parked one-portal-per-owner safeguard has real reachable gaps** — the TOCTOU comp race and the reactivation-branch bypass. Even under a "keep it capped" decision, the guard needs a DB-level backstop or an atomic lock. *(High — this is decision #1 below)*
4. **`/api/league/create` has no one-org guard** — close it before `LEAGUE_STARTER_BETA` is ever flipped on in production. *(High)*
5. **Reinstate-after-suspend loophole** — the reinstate path skips the one-org guard. *(Medium)*
6. **Cross-org head-coach promotion** — an admin can promote an existing cross-org guest assistant to head coach, bypassing the one-org guard. Close it unless the chosen package explicitly sanctions cross-org head coaching. *(Medium)*

**Security/support items that should also be ruled on now** (Section 10 decisions 6-8): the impersonation-via-reset-link vector, the "Complete Transfer" cross-org write blast radius, and the `org_id = null` audit blind spot.

---

## 10. The option packages

Four coherent packages along the freedom spectrum, plus one honesty option. Each states an explicit rule for every dimension and is scored on eight axes (the seven the spec requires plus **marketing communication cost**). The Club-bridge upsell nudge (trigger the existing Club sell at the moment a second-portal or second-org attempt is made) is an **orthogonal layer that can bolt onto A, B, or C** — it is not a separate package.

### Package A — Locked Single Home *(simplicity floor)*
**One-liner:** Cap ownership at exactly 1 real org + 1 Premium Portal for life; keep the already-shipped guest-coach cross-club freedom; finally make the portal cap real with the DB safeguard.

- **Real-org ownership:** 1, self-serve. A genuine 2nd org is platform-admin exception only.
- **Org membership (non-owner):** 1 home org + unlimited unpaid guest/assistant coaching elsewhere (keep today's shipped bypass).
- **Premium portals:** exactly 1, DB-enforced (safeguard built; TOCTOU + reactivation gaps closed).
- **Coach multi-team same org:** unlimited (unchanged).
- **Coach multi-team cross-org:** guest/assistant only, never head coach, never a 2nd owned portal.
- **Billing:** ≤2 Stripe customers per person, ever.
- **Support:** trivial — every human is at most 1 org + 1 portal.
- **UX chrome:** near-zero; switcher effectively only appears for the org+portal case.

| freedom | revenue | UX (single) | billing | support | build | migration | marketing |
|---|---|---|---|---|---|---|---|
| low | low | trivial | low | low | low-med | medium | trivial |

**Tradeoffs:** cleanest possible support/billing story; forecloses the one clean additive revenue persona; doesn't use the "more subscriptions" lever at all. **Promo→Jan:** ship the safeguard log-only during the promo, hard-enforce at January; a coach on 2+ comp portals gets a one-time "pick one" conversation.

### Package B — Open Membership + Locked Ownership *(codify the cheap axis)*
**One-liner:** Package A's ownership caps, but *explicitly* open all non-owner membership/coaching across unlimited orgs — turning today's accidental/deliberate bypasses into one clean, intentional rule.

- **Ownership:** identical to A (1 org, 1 portal, DB-enforced).
- **Membership:** **unlimited** — coach, staff, and (decision permitting) official roles across unlimited real orgs, one rule instead of a carve-out.
- **Cross-org coaching:** sanctioned for assistant *and* head coach as an explicit rule (removes the "loophole" framing).
- Everything else as A.

| freedom | revenue | UX (single) | billing | support | build | migration | marketing |
|---|---|---|---|---|---|---|---|
| medium | low | trivial | low | low | low | low | trivial |

**Tradeoffs:** strengthens the highest-leverage referral persona (the multi-org volunteer) at near-zero cost; no cannibalization (membership never bills); doesn't itself earn new subscription revenue. **Promo→Jan:** membership never bills, so it adds nothing to the January queue.

### Package C — Verified Network *(RECOMMENDED)*
**One-liner:** Everyone lives Package B day-to-day (open membership, capped ownership). A person who genuinely runs more than one organization can unlock owning 2+ orgs / 2+ portals through a lightweight "tell us about it" step — a form during the promo, a real approval + billing gate at January.

- **Real-org ownership:** default 1 (org-create bug fixed). A **"Verified Multi-Org" flag** — set after a light check that the 2nd org is a genuinely separate entity, not a cheaper-tier split of the same club — lifts the cap for that user only. Everyone else hitting a 2nd-org attempt sees a "request verification" prompt, not a dead 403.
- **Org membership:** unlimited (Package B).
- **Premium portals:** default 1, DB-enforced; verified users may hold N, each separately billed once January conversion begins. Same verification gate reused for a 2nd owned portal and cross-org head/paid coaching — **one review process, not two.**
- **Coach multi-team same org:** unlimited.
- **Billing:** per-org/per-portal Stripe (unchanged) + a "My Subscriptions" rollup, scoped to the small verified cohort.
- **Support:** one bounded manual check per verification request (at current scale, the owner reading an email) instead of monitoring an open population for arbitrage.
- **UX chrome:** identical to A/B for the 95%+; verified users get the switcher/rollup only after an explicit step.

| freedom | revenue | UX (single) | billing | support | build | migration | marketing |
|---|---|---|---|---|---|---|---|
| medium | medium-high | trivial | manageable | manageable | low now / med later | low | low |

**Tradeoffs:** best fit for the owner's "troubleshoot one org without touching another" *and* real revenue capture; the manual gate suppresses tier-arbitrage that Metered Freedom accepts. The verification workflow is genuinely new process — but at current scale it's a form and a boolean, with heavier tooling deferred until volume justifies it (same posture as the January runbook). **Promo→Jan:** during the promo the verification step is a pure lead-gen form (nothing blocked); the flag becomes load-bearing at January, when verified users are billed per subscription and everyone else falls back to the single-owner cap.

### Package D — Metered Freedom *(RUNNER-UP)*
**One-liner:** Leave freedom fully open; convert every 2nd org and 2nd portal into a separately-priced subscription at January instead of clamping it shut. Every extra thing becomes revenue, not a bug.

- **Real-org ownership:** unmetered (org-create bug fixed). Each additional org is its own full-price subscription; the live FAQ line is updated to disclose separate billing.
- **Org membership:** unlimited (Package B).
- **Premium portals:** unmetered during the promo (today's accepted, logged comp risk); at January the DB safeguard blocks only *free/comp* duplication while a 2nd+ portal stays purchasable via an explicit "Add another Coaches Portal" flow.
- **Cross-org coaching:** fully open, both roles.
- **Billing:** per-org/per-portal Stripe + a "My Subscriptions" rollup (required, not optional).
- **Support:** existing per-human view + pagination fix + owned-count column.
- **UX chrome:** switcher + rollup, count-gated; the Premium cross-portal switcher becomes required.

| freedom | revenue | UX (single) | billing | support | build | migration | marketing |
|---|---|---|---|---|---|---|---|
| high | high | trivial | manageable | manageable | medium | low | medium |

**Tradeoffs:** most direct match to "more subscriptions = more money" and the least disruptive January migration (nothing is clawed back — it just starts billing). **Accepts tier-arbitrage cannibalization** (a club splitting into two cheap tiers) and a heavier per-person January workload; **conflicts with the ratified 2026-06-22 anti-cannibalization decision** on standalone Premium unless that decision is reopened. Pair mandatory with the Club-bridge upsell layer. **Promo→Jan:** unchanged behavior during the promo; at January every 2nd+ org/portal converts from comp to its own billed line.

### Package E — Open Multi-Everywhere *(honesty option — not recommended)*
Unlimited orgs, unlimited portals, unlimited cross-org roles, DB safeguard abandoned. **Cheapest to build (mostly "stop enforcing") — but it is close to what the unclosed gaps already allow by accident**, it undermines the Club-bridge strategy outright, and its costs (unbounded receipts, an unbounded January queue, no anomaly detection) never shrink. Included for completeness; choosing it is a decision to stop calling today's gaps bugs.

---

## 11. Recommendation

**Recommended: Package C — Verified Network.**

It is the honest resolution of the owner's four-way ask (freedom, simplicity, revenue, support isolation):
- **Freedom** where it's free and valuable: the cheap membership/coaching axis is fully open (Package B baseline), preserving the connected-coach network the owner already called appealing.
- **Simplicity** for the 95%+: single-everything users see exactly today's experience; the verification step never surfaces to them.
- **Revenue** without cannibalization: it captures the one clean additive persona (a genuine two-association operator) and the willing multi-portal coach, while the light gate structurally deflects the tier-arbitrage that erodes Club sales.
- **Support isolation** by design: the multi-org cohort stays small and known, so "troubleshoot Org A without touching Org B" holds in practice, not just in theory.
- **Phasing** that fits the calendar: during the $0 promo it costs nothing and gathers real "who actually runs two orgs" signal; the gate only bites at January, exactly when money starts and the manual-conversion queue needs to stay bounded.

**Runner-up: Package D — Metered Freedom.** Choose D over C if the owner decides that **maximizing subscription count and minimizing process** outweighs cannibalization control — i.e. "bill everything, let the Club-bridge nudge do the funneling, don't stand up an approval step." D earns more per willing buyer and is simpler operationally *if* the owner is comfortable accepting tier-arbitrage risk, reopening the 2026-06-22 anti-cannibalization decision, and a per-person January workload that scales with how many things each user accumulates.

Both C and D require the same Section 9 fixes and the same phased safeguard rollout; C adds a verification gate, D adds mandatory Club-bridge messaging and separate-billing disclosure. The decision between them is a **strategy call about cannibalization tolerance**, not a build-difficulty call.

---

## 12. Numbered owner decision list

Each phrased as a yes/no or pick-one. Nothing is logged as Decided until ratified.

1. **[Parked safeguard — blocking a migration today]** Build the one-Premium-portal-per-owner DB safeguard now (a partial unique index on the portal owner, plus close the TOCTOU comp-race and reactivation-branch gaps), on a **log-only-during-promo → enforce-at-January** timeline? *Every package except E assumes yes.* Pick the enforcement semantics with your package: hard cap (A/B/C) vs block-comp-duplication-only (D).
2. **Pick the package:** A (Locked) / B (Open Membership) / **C (Verified Network — recommended)** / D (Metered Freedom — runner-up) / E (Open Everywhere — not recommended).
3. **Real-org ownership cap:** keep at 1 self-serve (A/B/C-default) or open to unlimited (D)? Determines whether the org-create fix preserves or removes the ceiling.
4. **Cross-org non-owner roles (staff/coach):** ratify opening these to unlimited orgs (codifying what's already shipped) — yes/no? *(B/C/D assume yes.)*
5. **Officials/scorekeepers:** should they get the same cross-org freedom as coaches, or stay excluded (officiating conflict-of-interest)? Recommend **stay excluded** for now — near-zero demand, real integrity concern.
6. **Fix now, independent of package** (Section 9): approve fixing the org-create exemption bug, the cancel/downgrade org-scoping bug, the `/api/league/create` gap, the reinstate-after-suspend loophole, and (unless D) the cross-org head-coach promotion — yes/no?
7. **Impersonation vector:** close the reset-link-as-login vector (email the link to the customer instead of showing it to the operator, and/or add audit logging + forced re-auth) — yes/no? Recommend **yes** before any package expands support's cross-org workload.
8. **"Complete Transfer" blast radius:** add an explicit confirmation naming the counterpart org before this action cancels its subscription and suspends its members — yes/no? Recommend **yes**.
9. **Audit blind spot:** should account-wide support actions (ban/reset/delete) also be logged against every org the person belongs to, so per-org audit tabs aren't blind — yes/no?
10. **Club anti-cannibalization decision (2026-06-22):** does opening unlimited standalone portals (D or E) require reopening/amending that ratified decision? If choosing D, this must be resolved via `/strategy`.
11. **Notification-pause scope:** keep the account-wide pause as accepted v1, or commission per-org granularity (a real surprise for multi-org parents/coaches under any package)? Recommend **keep as-is for now**, revisit if multi-org prevalence grows.
12. **Prerequisites before opening portal multiplicity** (D, or C-for-verified-users): fix the Coach Insights digest to bundle across a coach's teams, and add distinguishable Stripe receipts + a minimal refund audit trail — approve as prerequisites, yes/no?
13. **January conversion mechanism** for promo-era accounts holding 2+ orgs/portals: manual owner-run "pick one / convert each," or invest now in semi-automated bulk conversion? Recommend **manual** at current scale, automate only if the cohort outgrows ~50.
14. **Pricing-copy disclosure:** update the live FAQ ("each association is its own organization") to also state each is billed separately — required before D or a heavily-marketed C; recommend the wording go through `/marketing`.

**After ratification:** offer `/strategy` to log the accepted items (Proposed → Decided) and update `memory/decision_one_to_one_vs_multi_org`; route copy to `/marketing`, gates to `/billing`, and the bug-fix bundle to `/plan`. **Nothing is logged as Decided before ratification.**

---

## Appendix — evidence provenance

- **147 capability claims** gathered across 13 evidence lanes (schema, org-owner, org-staff, rep-coach, basic-coach, premium-coach, tournament-coach, scorekeeper, fan, billing, support, ux-surfaces, notifications) + 2 analysis lanes (market/revenue, marketing/packaging).
- **Adversarial verify:** every medium/high claim refuted by ≥1 independent skeptic; billing, support, and the premium-portal question double-verified. **67 CONFIRMED, 53 ADJUSTED (finder wording/tag corrected), 4 DISPUTED, 3 REFUTED, 20 low-importance re-verified in a follow-up pass.** The ADJUSTED/REFUTED corrections are folded into the matrix above — notably: the org-ownership-transfer feature *is* built and shipped (mig 067, prod, UAT'd) — so the "Club includes the staff's portals" bridge exists as a **manual platform-admin transfer**, just not as an automatic self-serve flip; the support "Complete Transfer" and reset-link findings emerged from refutation.
- Full structured artifacts (matrix, corrections, drafts, judge reports, critic) retained in the workflow transcript for `/strategy` reference.
