# Navigation Model — Recommendation & Staged Plan

> **⚠ SUPERSEDED (2026-07-31):** this plan's stages were merged into
> **`NAV_UNIFICATION_PLAN.md`**, the single execution plan for all navigation work. Do not execute
> from this document; it remains as audit trail and evidence detail (esp. §Q5's testable assertions,
> referenced by the unified plan).

**Date:** 2026-07-31 · **Status:** SUPERSEDED by `NAV_UNIFICATION_PLAN.md`. No code written.
**Companions:** `NAVIGATION_MODEL_FINDINGS.md` (verified evidence) · `NAVIGATION_MODEL_PM_BRIEF.md`
(plain-language) · mockups artifact (linked in TODO.md).
**Method:** findings from a 19-agent code verification sweep, then a 27-agent design panel — five
independent models, each attacked by three adversarial judges (public-priority / phone / multi-hat),
six owner questions answered against the results, then synthesis.

> **The panel's most useful result: no proposed model survived.** Scores clustered 3.3–4.7 out of 10;
> every model was judged WEAK or FATAL on at least one lens, including the incumbent two-axis model
> (3.5). That is not a failure of the panel — it is the finding. **The evidence does not support
> building a unifying navigation model right now.** What it does support is stated below.

---

## 1. The recommendation in one paragraph

Navigation on this platform is not one question with two answers; it is **three different questions
that each already have a working mechanism, plus one broken promise.** *Which of my places?* is
answered completely and on every device by Home's workspace list — the problem is that two shells
have no door back to it. *Which sibling inside this place?* is answered by each shell's own switcher
— the problem is that five of them use five different mechanics, only one of which is bookmarkable.
*Which side am I looking at?* is answered by the Flip — which works, and needs two symmetry fixes,
not a redesign. The broken promise is that **a place you can no longer reach still looks reachable**
until you reload. So: **do not build a new switcher, a rail, or a badge. Fix the doors, make one
list the only list, and hold the expensive parts behind a single cheap measurement.** The governing
rule is *one canonical list, many doors, never a duplicate.*

---

## 2. The model

### The two-axis model is directionally right and structurally incomplete

**"Side" survives intact.** Operator-vs-public is a genuinely separate question, it already works,
and no persona test broke it. Keep it exactly as it is.

**"Place" is not one axis — it is two**, and conflating them is what makes the multi-hat case feel
unsolvable:

| | **ENTER** | **MOVE** |
|---|---|---|
| Question | *Which of my unrelated places?* | *Which sibling inside this place?* |
| Shape | Flat, cross-org, cross-hierarchy | Hierarchical, within one scope |
| Today | Home's workspace cards + the /coaches hub — **complete and correct on every device** | Five mechanics doing one job: admin tournament (client-state), house-league season (URL), rep-teams program-year (card grid), premium team (same-org select), free team (cross-org popover) |
| Defect | Two shells have no door to it | Inconsistent, mostly unbookmarkable |

This split is the single most load-bearing idea in the investigation, and it settles the multi-hat
argument. The premium team switcher being same-org-only is **not a bug** — it is a MOVE mechanism
correctly refusing to do an ENTER job. Forcing it to cross orgs would be solving the wrong axis with
the wrong tool. Equally, the free coach's cross-org team popover is structurally an ENTER mechanism
wearing MOVE's clothing, which is why any "one rule for all five switchers" proposal breaks on it.

### Why there is no single "place" control

The prior model put one context control at "top of the rail, top of the More sheet." **That slot does
not exist.** The consumer shell and the free coach portal have no More sheet at all — the free
portal's was deliberately retired. The two shells that do have one are height-capped and scrolling,
and the coach sheet has already shipped a real overflow bug caused by exactly this kind of
top-of-sheet growth. Meanwhile the codebase's own house rule, written into the free coach
switcher, already says where this belongs: *"All your workspaces live on Home."*

So the model does not add a control. It makes that sentence true everywhere.

### The three rules

1. **ENTER — one canonical list, many doors, never a duplicate.** Home's workspace list stays the
   only aggregator. Nothing new re-derives "which places do I hold." Every shell gets exactly one
   static, ungated door to it, labeled **"Home,"** sized to what that shell already has: a bottom tab
   where one exists (consumer, free coach — *already shipped*), a link in the existing footer/action
   cluster on desktop, and on phone a row **pinned outside the scrolling list**, never inside it.
2. **MOVE — the URL is the source of truth for any switchable rung.** Specified now, migrated on
   evidence. A tournament selection that lives only in client state is unbookmarkable, unshareable,
   and can silently disagree with the Accounting ledger's URL-scoped selection.
3. **SIDE — the Flip is symmetric, and decided by hats, never by shell.** Two fixes: the org-level
   flip gains its missing return leg, and the free coach flip gains the same multi-hat popover
   premium already has.

### The fourth question, named and explicitly not answered

*Is the place I'm looking at still real?* A revoked admin or removed coach keeps seeing the same
chrome until a hard reload; the first symptom is a generic "Failed to load." Getting ENTER, MOVE and
SIDE perfectly right does not touch this, because the URL still points somewhere real — just not
somewhere this account can reach. **This model does not fix it and must not be reported as
progress on it.** It does one preparatory thing: the shared resolver in Stage 0 answers with
per-request truth rather than a cached row, so a future fix has correct data underneath it.

### Naming (sport-neutral, reuse over invention)

- **"Home"** — every new door. Already the bottom-tab label for the same destination in two shells.
- **"Roles"** — the existing multi-hat popover name; extended to free coach, not duplicated.
- **"Public site"** — the existing org-level flip label; its return leg reads as the obvious mirror.
- **Rejected: "Ladder"** — "ladder" is the standings table in several football codes; the
  sport-neutral rule exists to prevent exactly this collision.
- **Rejected: "You Are" / "Hats" as UI copy** — "Roles" is already the shipped word. The product has
  already shipped one naming collision (footer "Coaches" → paid checkout vs. menu "Coach a team" →
  free signup, unreconciled); don't add a second.
- **Icon constraint for `/design`, not a preference:** the admin sidebar's "Back to Site" already
  uses a house glyph pointing at the *org's public page*. A new door to Home must not reuse it, or
  one glyph means two destinations depending on which shell you're standing in.

---

## 3. Per-shell specification

| # | Shell | Desktop | Phone |
|---|---|---|---|
| 1 | Marketing | No change — no signed-in place, no hierarchy, no side | No change |
| 2 | Consumer app | No change — this is the shape the others are being made to resemble | No change |
| 3 | Org public home + league/teams/archives | One static "Home" link into the consumer app (the one deliberate anonymous-facing addition); return Flip for signed-in operators **of that org**; sitemap entry. All three gated to orgs where the page actually renders | Same, no bottom bar, no hamburger |
| 4 | Public tournament pages | One plain link to the org's public home in the side rail — inside an existing layer, not a fourth one. **Conditional: only when org home is a real destination** (see Stage 2) | Same link as a trailing item under the event header, **not** a new tab. Same condition |
| 5 | Admin | Dead sidebar logo becomes a real link to Home (zero visual change); "All Workspaces" keeps its label, place and 2+ threshold — only its input is corrected | **Already shipped** — a "You" section with Home/Chat/Account exists. Verify, don't rebuild |
| 6 | Premium coach portal | First real exit: an unbranded text link "Home" in the existing action cluster. **Owner-gated** | Same link pinned outside the scrollable rows. Route through the existing unsaved-changes guard |
| 7 | Free coach portal | Flip gains the hat-count check premium already has. **`/design`-gated** | Same |
| 8 | Scorekeeper / check-in | No change — correctly solved for its job | No change |
| 9 | Platform admin | No change — zero bridge, deliberate | No change |

Token surfaces (tryout-score, tryout-response, unsubscribe): considered and deliberately excluded.

**Every new door points at Home — never at a second hub.** This is what prevents the drift the
findings already caught live once, where two mechanisms disagreed about the same scope.

---

## 4. Personas

**The four common cases.** Single-org admin: their dead sidebar logo starts working; nothing else
changes ("All Workspaces" correctly still doesn't render — they hold one place). Single-team premium
coach: gains a way out that isn't Sign out. Single-team free coach and signed-in fan: **no change at
all** — the free coach portal is the existence proof the rest is generalizing from. Anonymous
visitor: see §5.

**Admin at org A who coaches at org B.** Today: the pill always says "Admin Area" (org A), the coach
portal never appears in persistent chrome, and inside B's portal there is no admin door because
"Back to admin" is same-org-only. Worse, "All Workspaces" never fires for them, because its gate
counts org memberships only and they have one. After: the corrected gate fires and lists both; the
new coach exit gets them from B back to Home, where A is one card away. Two hops each way — an
improvement on *zero working in one direction*. **Still not fixed:** the pill itself.

**Two premium teams in two orgs, no admin role.** Today the in-shell switcher looks complete but is
silently same-org-only, and nothing in the shell links to the hub that does list both. After: the new
exit reaches Home without signing out. The switcher stays same-org — correctly.

**Scorekeeper on 2+ events.** No change. A flat day-list plus the 2+ chooser is already right. Worth
noting as precedent: when this product last needed "pick one of N," it used a full-page list, not a
sheet row.

**Platform admin.** No change, deliberately, in both directions.

**Role revoked mid-session.** Not fixed. Stale chrome persists until reload; removal still shows
nothing where suspension shows an explanation. Tracked as its own workstream.

---

## 5. The public line (what must never change)

**The rule:** an anonymous visitor's page must render, fetch and weigh the same after this work as
before it — zero new identity fetches, zero new DOM tied to session state, zero new bytes in the
anonymous bundle, and no change to the invariant that tournament HTML is service-worker-cached as
anonymous with identity resolved client-side after hydration.

**The acceptance bar is a diff, not an assertion:** capture an anonymous session's network requests,
rendered DOM and shipped JS on marketing, the consumer app, org home and a tournament page, before
and after. Every one must come back identical **except one new anchor tag** on qualifying org-home
pages.

**The one deliberate exception** is that anchor: a fan on an org's public home today has no door into
the consumer app at all. One unconditional static link — no fetch, no bottom bar, no hamburger, same
markup for every visitor — closes the sharpest gap the review found. Every rejected model that
touched an anonymous surface added more than this and was marked down for it. **Fuller consumer
chrome on org home is explicitly not proposed here**; that is a separate design decision this
document names rather than makes.

Two pre-existing paper-cuts (an ungated round-trip fired on Home for anonymous visitors; a
per-render auth check gating the tournament acquisition banner) are **not** part of this work. Clean
them up separately — precisely so they don't contaminate the before/after diff above.

---

## 6. Staged plan

**Stage 0 — one shared resolver, zero new UI. *This is the first step.***
Union of admin-org + premium-coach + free-coach + official contexts, precedence-sorted, answered with
per-request truth. Ship it by repointing two things that already exist — the operator pill's
precedence logic and the "All Workspaces" gate — and deleting their separate ad-hoc counts.
*Worth shipping alone:* it fixes a real bug — the gate counts org memberships only, so an
admin-at-A-who-coaches-at-B never crosses its own threshold today. *Why it makes everything cheaper:*
every later stage becomes a pure UI change against one proven contract instead of inventing its own
count. Three models converged on this independently. No design review, no owner gate.

**Stage 1 — activate the dead admin sidebar logo.** One `Link`, zero visual change. Independent of
everything.

**Stage 2 — the org-scope link in tournament chrome. CONDITIONAL — do not ship it unconditionally.**
Desktop rail first, then the mobile trailing link. Verified 2026-07-31: for an org **without** the
public-site module (Tournament $0 and Tournament Plus $39 — i.e. no org public presence), org home
has three states, and only one of them is a destination worth linking to:

| Org state | What `/{orgSlug}` actually renders | Link verdict |
|---|---|---|
| Has `module_public_site` (League / Club / Club·Assoc) | The real org home — hero, events, League Play / Tryouts / Archives. **Never redirects** | **Link always** |
| No module, **2+ active tournaments** | A genuine tournament selector: org name + logo, "Select a tournament below," a card per event | **Link** — this is a real destination |
| No module, **exactly 1 active tournament** | Redirects straight back into that tournament | **No link** — it is a loop |
| No module, **0 active tournaments** (reachable from a *completed* event's page, which stays live until sealed) | A FieldLogicHQ-branded placeholder reading **"This organization hasn't set up their public site yet"** | **No link** — we'd be sending a fan to a dead end we created |

**The rule: render the org link only when the org either owns the public-site module or has 2+ active
tournaments.** Otherwise omit it entirely. Both facts are already known where the link would render,
so this is a condition, not a new lookup. Shipping it unconditionally would put a link on a paid
customer's event page that either does nothing or lands a parent on a page announcing the org hasn't
set up a site — worse than the gap it closes.

**Branding finding (verified 2026-07-31, follow-up question) — it strengthens the rule.** There are
**two independent brand stores**: per-tournament branding (colour, font, card style, logo, banner,
light/dark), editable from tournament admin; and org-level branding (logo, theme, hero banner),
editable **only from Org Admin → Settings — the section Tournament and Tournament Plus are redirected
out of at three layers.** Nothing copies a tournament's branding up to the org, and org creation
seeds no theme. Consequences:

- A Tournament/Tournament-Plus org's page **always renders the platform preset — navy `#1E3A8A` with
  the FieldLogicHQ lime accent — with no org logo and no hero banner**, regardless of how its events
  are branded. It also carries a "FieldLogicHQ" badge above the org's own name.
- **A red event and a purple event never clash**, because neither is inherited. But the outcome is
  worse than a clash: the page tying a paying org's events together is the *least* theirs, and it's
  the page Stage 2 would point every event at. Sending a visitor from a fully-branded event to an
  unbranded platform-coloured page is a worse trip than no link.
- The event cards on that page are also **not tinted per event**, so two differently-branded events
  render as two identical navy cards.

**Theme (verified 2026-07-31, follow-up).** The user's Warm/Dark choice **deliberately does not apply
here** — it drives one attribute on `<html>`, and the warm skin is scoped to shells that opt in with
a marker element (consumer app, coach portal). Org and tournament pages never carry it, so warm can't
bleed in. That is the ratified precedence rule, stated in code: *"never the org/tournament
`data-color-mode` authority — org brand always wins on branded surfaces."* Correct as designed.

**But there is a gap underneath it:** the tournament layout sets a colour mode explicitly (the
tournament's own choice on paid tiers, forced dark on free); the **org layout sets none at all**, and
**org-level branding has no colour-mode setting** (org settings covers preset / primary / accent /
font / card style / logo / hero banner — no light-dark). So **every org page is permanently dark, on
every tier, including League and Club who can otherwise brand it.** A League/Club customer can ship a
*light* tournament page and then have the link up to their own org page hard-flip to dark. That is a second
brand break stacked on the colour one, and it is worth naming in the same `/design` + `/strategy`
conversation.

**Reachability (verified 2026-07-31, follow-up): the org page IS searchable today.** Home's search has
three result types — Tournaments, **Organizations**, Teams — and organization rows link straight to
`/{orgSlug}`. It is public: no sign-in required. Eligibility is one shared predicate (discoverable +
public + not a team-workspace shadow org + not the `team` plan + not canceled), deliberately identical
to the org-follow predicate so a searchable org and a followable org are the same set. Signed-in fans
who follow an org also get a card on Home linking there.

**This creates a dead end the Stage 2 rule does not cover.** Search returns eligible orgs *regardless
of how many active tournaments they have* — so a fan can search an organization by name and land on the
redirect (1 event), the selector (2+), **or the "hasn't set up their public site yet" placeholder
(0)**. The conditional link rule governs only the event→org link. **Search needs its own answer**, and
the cheapest honest one is to give the empty state something real to say rather than to hide the org
from search — an organization with no live events still has a name and past
results. Route with the placeholder copy to `/marketing`.

**DECIDED 2026-07-31 (owner; logged in `BUSINESS_DECISIONS.md`): org-level branding stays a
League/Club benefit — Tournament and Tournament Plus do not get it.** A tournament organization sells
events, and the event is the branded unit; an org-level identity is what a league or club buys,
because they have standing programs that persist between events. So the platform-coloured org page is
correct-by-design on these tiers, not a gap. **This makes the conditional link rule below more
important, not less** — if that page can never be theirs, there is even less reason to send a visitor
to it from a fully-branded event page.

**Vocabulary (binding):** there is **no "club" at the Tournament tiers.** A Tournament-Plus customer
is a **tournament organization** running more than one tournament. "Club" is a tier name; using it
generically for any paying org is wrong. Corrected throughout this doc. Two cheap fixes are safe either way, whenever that page is next
open: tint each event card with its own event colour, and add the "Home" link. The placeholder copy
("hasn't set up their public site yet", under a platform badge, on a paying customer's address) goes to
`/marketing` with it.

**Stage 3 — widen the "All Workspaces" gate** to the resolver's full union. A one-line condition
change, *because* Stage 0 already made the data correct. This is where Stage 0 pays for itself.

**Stage 4 — org home's three fixes:** the static consumer-app link, the return-leg Flip for signed-in
operators of that org, and the sitemap entry — all gated to orgs where the page actually renders.

**Stage 5 — premium coach exit. OWNER GATE FIRST.** The absence of a wordmark in that shell was a
deliberate ratified call. **Do not build until the owner confirms** that a plain-text, no-logo "Home"
link honours it. That is one yes/no, not a study. Then desktop, then mobile after a real-device
overflow check.

**Stage 6 — free coach Flip parity. `/design` GATE FIRST.** It introduces a multi-hat *operator*
concept into a shell ratified as consumer-family chrome. One sign-off, not a study.

### Explicitly do not do

- **Do not build a new aggregator, rail, badge, or place-switcher.** Every new surface queries the
  resolver; nothing maintains a second list.
- **Do not add anything list-shaped to either More sheet.** Both are capped; one already broke.
- **Do not rebuild admin's mobile Home row** — it already ships. Verify against current `dev` first;
  concurrent agents edit these files, and the panel already caught one proposal "fixing" it.
- **Do not migrate the admin tournament switcher off client-state in this pass** — real defect,
  separate project (see below).
- **Do not claim any of this fixes mid-session revocation.**
- **Do not use Stage 2 to claim the org-home fan gap is solved.**

---

## 7. Evidence gates

**Ship Stages 0–4 with no new measurement.** They are correctness bugs, dead code, or asymmetries in
components that already exist; traffic volume cannot make a bug not-a-bug. Stages 5 and 6 are gated
on *decisions* (one owner yes/no, one design sign-off), not on data.

**One cheap number decides everything expensive: the share of signed-in sessions that are actually
multi-hat.** It is a log line at an existing per-request call site that anonymous sessions never
reach — no new fetch, no anonymous exposure. Instrument it in the same release as Stage 0; let it run
2–4 weeks.
- **Below ~10%** → the two-door patch is the permanent answer. The rail, the badge, and any visible
  cross-hat control are **cancelled, not deferred.**
- **Above ~20–25%** → a visible control becomes justifiable, and only then.

**Second cheap measure:** click-through on org home's new consumer-app link, via a fire-and-forget
beacon on an anchor that renders identically for everyone. Sustained CTR under ~1–2% over four weeks
→ one link is the permanent answer; materially higher → escalate to a design pass. This is the one
place the "fans have no door" gap gets tested against behaviour instead of assumption.

**Offline audits (no telemetry):** org-count per admin and team-count per coach, to decide whether a
More sheet can take even a pinned row; and a staging benchmark of the union query, to decide whether
it may ever be fetched ambiently (recommendation: fetch on deliberate open only, and validate that
before committing).

**Gated on severity, not frequency:** the admin tournament switcher's client-state-only selection can
silently disagree with the Accounting ledger's URL-scoped selection. **One confirmed occurrence
affecting money funds that migration immediately**, ahead of any nav polish — it is a data-integrity
bug wearing a UX costume. Search observability and support logs for it now.

**Gated on ticket pattern:** unifying the three season mechanisms. Harm is confusion, not corruption;
absent a recurring ticket pattern, leave three working-but-uncoordinated mechanisms alone.

---

## 8. Rejected alternatives

| Model | Score | Strongest idea (kept) | Why it lost |
|---|---|---|---|
| **Home as the Switchboard** | 4.7 | Adopted as the base: one aggregator, cheap doors sized to existing chrome, enter-vs-leave as separate questions | Silent on the hierarchy mechanisms entirely; treated org home as simply out of scope rather than tier-conditional |
| **Repair List Over Rail** | 4.0 | "Any page nested under an org needs a visible link to that org"; flip symmetry decided by hat-count, never by shell | Its own generalizing rules didn't generalize (one quietly skips scorekeeper); priced the revocation fix like a link fix when it needs a client-side interceptor; missed the redirect collision on tournament→org-home |
| **Two-Axis, repaired** | 3.5 | The org-level flip needs a return leg | Builds the very switcher the evidence says not to build yet, and ships it into the one shell ratified as consumer-not-operator chrome without the design gate it admits is needed; claims zero change for single-place users while its own analysis shows the pill going from one click to two |
| **Scope Ladder** | 3.3 | **The ENTER/MOVE split** — the most load-bearing idea in this document — plus "URL is the source of truth for any switchable rung" | Its phone plan contradicts itself about which shells get the new strip; applies its unified contract to the one switcher it provably doesn't fit; permanently adds two inert crumbs to every single-org admin's sidebar to serve a switching minority |
| **You Are (identity-first)** | 3.3 | **The single unifying resolver** — this plan's foundation — and the liveness-flag principle | Its flagship revocation fix is self-defeating (the badge signalling staleness is fed by the same stale state); asserts an avatar anchor in a shell that is a deliberate avatar-less island; its headline fix never reaches a phone, because it hangs off a desktop-only pill |

---

## 9. What this does not solve

1. **Mid-session revocation / stale chrome** — real, platform-wide, unfixed; its own workstream.
2. **The org-home fan gap beyond one link** — named here, not answered; belongs to `/design`,
   informed by the click-through measure.
3. **The operator pill's own defects** — still global, still hardcodes a flat coach fallback, still
   always ranks Admin over Coach, still picks whichever org sorts first. The resolver fixes the data
   under the decision, not the decision.
4. **A "switch to any place from anywhere" control** — deliberately withheld behind the multi-hat
   number.
5. **Unifying the five MOVE mechanisms** — architecture specified, migration gated.
6. **The chat Rooms switcher** showing a different room than the URL — untouched.
7. **The "Coaches" vs "Coach a team" naming collision** — a copy/IA question for `/marketing`.
8. **Incidental defects in the files this touches** — a 404'ing house-league nav item, org home's
   wrong tryout CTA target, and **an unsanitized `next=` redirect on platform-admin login (security,
   fix independently and now)**. Good hygiene when those files are next open; not part of this
   argument.

---

# Appendix — the six questions, answered

> Full answers from the design panel, lightly edited. The plan above is the distillation; this is the working.

# Q1 Answer: Two-axis is directionally right but structurally incomplete — there is a real third axis, and "place" is not one thing

## The verdict

**"Side" (the Flip) survives clean.** Every proposal and every judge agrees on this: operator↔fan view of the same node is a genuinely separate, already-working, correctly-scoped question. Nothing in the five persona tests below breaks it. Keep it exactly as-is; the only real defect is two seams (org-home's one-way flip, free coach's single-target-only flip vs. premium's Roles popover) — not the axis itself.

**"Place" is not one axis — it's two, and the two-axis model's own container assumption (one control at "top of the rail / top of the More sheet") is what breaks, not the "which place" question itself.** The findings show the codebase already separates these two jobs and works better where it does:

- **ENTER** — flat, cross-hierarchy, cross-org: "which of my unrelated contexts do I want to be in" (admin@A vs coach@B vs official-somewhere). Home's Workspaces cards (P2) and the /coaches hub (P9) already do this correctly and completely — P2 is explicitly the only viewport-complete aggregator that exists.
- **MOVE** — hierarchical, within one context: "which sibling at this same rung" (which tournament in this org, which team-season, which program-year). This is P4/P5/P6/P7/P8 today — five incompatible mechanics (client-state select, router.push select, card grid, sidebar select, header popover) doing the same conceptual job five different ways.

The original two-axis proposal collapsed ENTER and MOVE into one "which place" control and assumed it has one physical home (rail-top / sheet-top) in every shell. Every judge that stress-tested this against real personas found the same failure: **that slot doesn't exist in 2 of 4 phone-relevant shells** (consumer, free coach have no More sheet), and in the 2 that do (admin, premium coach) it's height-capped and has already broken once from top-of-sheet growth. `home-as-hub`'s phone judge called this precisely: pinning a new switcher row at the top of an already-once-overflowed sheet "recreates the conditions of a bug that already shipped." So the axis's *question* is right; its *proposed container* is wrong, and needs to be Home (for ENTER) plus a URL-addressable crumb+switcher (for MOVE, per `scope-ladder`), not a single new widget repeated nine times.

## Is there a third axis? Yes — **identity/liveness** ("which hats do I hold, and is this one still true")

This is distinct from both "place" (where) and "side" (which view of where). It surfaces in three ways the two-axis model doesn't address at all:

1. **Multi-hat awareness itself.** P1's operator pill doesn't just fail to switch between places — it *hides the existence* of other hats by collapsing to one precedence winner ("Admin ALWAYS outranks Coaches," "coachHref hardcoded '/coaches'"). That's not a place-navigation defect, it's an identity-legibility defect: the user doesn't know they hold a second hat unless they already know to check Home. `identity-first`'s core insight — a hat *count* is a fact independent of where you're currently standing — names this correctly, even though its own execution (avatar badge, four anchor points) fails hard on phone.
2. **Liveness under revocation.** "Role revoked mid-session" is not a place problem or a side problem — chrome shows a place that is *no longer real*. No amount of getting "which place" or "which side" architecturally right fixes this, because enforcement is per-request and layouts don't re-run on soft nav. Every proposal that touches this (Rule E in `minimal-repair`, the `live:false` flag in `identity-first`) treats it as its own concern requiring its own mechanism (an interstitial, a resync-on-open), not a byproduct of fixing axis 1 or axis 2.
3. **Same-node-different-truth**, e.g. P4 (client-state tournament switcher) silently disagreeing with Accounting's URL-scoped ledger, or P13's chat Rooms switcher showing a different room than the URL says. This is a "the place you think you're in isn't what the URL/other-mechanism says" problem — again orthogonal to place-vs-side.

Call this third axis **"is this true right now"** — it cuts across both place and side, and none of the five proposals' judges scored above WEAK on it because none actually solves it; they only give the user a place to go check (You Are, a muted crumb, an interstitial). That's a legitimate scope boundary to draw, but it means the two-axis (or two-axis-plus-ENTER/MOVE-split) model answers "where can I go" and "what view am I in," not "is what I'm looking at still valid" — and the revoked-mid-session persona proves that gap is real and currently unowned by any proposal.

## The five personas, run against the corrected model (ENTER / MOVE / SIDE / LIVENESS)

**Admin@A + coach@B (different orgs).** Pure ENTER problem — two unrelated contexts, no hierarchy relationship. Home/P9 already solve it *if you know to go there*; the actual defect is P1's pill hiding the second hat (identity-legibility, axis 3) and no shell offering a door back out once you're in B's premium portal (an ENTER-door gap, not a MOVE or SIDE gap). `home-as-hub`'s fix (give premium coach a Home door) closes half of this; it does nothing for pill legibility. **Two axes fixes must combine: ENTER-door + identity-legibility.**

**Two teams, two orgs (premium coach).** Same shape as above but inside the *coach* family specifically — P7's team switcher is explicitly SAME-ORG ONLY, so it is structurally a MOVE mechanism (sibling within one org) being asked to do an ENTER job (cross-org) and failing. This is the clearest proof that "place" isn't one axis: P7 correctly handles MOVE within an org's premium teams and correctly *refuses* to handle ENTER across orgs — that's not a bug, it's a mechanism doing its actual job and the user needing a second, different mechanism (P9/Home) for the other job. Any model that tries to make P7 itself cross-org is solving the wrong axis with the wrong tool.

**Scorekeeper.** Findings and every judge agree: fine as-is. Zero lateral hats by design (0 events → org root, 1 → schedule, 2+ → chooser). This is a persona with no ENTER need beyond the chooser and no SIDE need beyond flipping to public first — it's the control case proving the axes aren't over-fit to hard cases. Any model that proposes universal rules "for every mechanism" (e.g. `defend-two-axis`'s Rule C claiming hat-count decides flip behavior "never by which shell") and then quietly exempts scorekeeper is contradicting its own stated universality — a real defect several judges caught.

**Platform admin.** Zero bridge either direction, deliberately. This persona is evidence that not every shell needs to sit on any axis — it's intentionally excluded from ENTER, MOVE, and SIDE alike. No proposal touches it and none should.

**Role revoked mid-session.** This is the proof case for axis 3. It is not a place-navigation failure (the URL/sidebar still "point" somewhere) and not a side failure (Flip is irrelevant) — it's that the place being pointed to is no longer real, and nothing re-checks that until a hard reload. `home-as-hub` and `minimal-repair` don't even claim to fix it. `identity-first`'s `live:false` resync-on-open is the only proposal that names a mechanism, and its own judges flagged the mechanism as internally contradictory (the badge signaling "you have something to check" is itself fed by the same stale layout-mount state it's trying to route around).

## Where the model is simply wrong about what exists (fact corrections, not judgment calls)

- The original two-axis proposal's phone plan ("top of the More sheet lists every place") is factually inapplicable to 2 of 4 phone shells — consumer and free coach have no More sheet at all. This isn't a design tradeoff, it's a premise that doesn't exist in the codebase.
- `defend-two-axis`'s claim that Rule C (hat-count decides flip behavior, "never shell-determined") is universal is contradicted by its own treatment of scorekeeper as an unstated exception.
- `identity-first`'s claim that premium coach has "an avatar anchor point next to the existing team switcher" is contradicted by the findings' own description of that shell as a deliberate wordmark-free island whose only exits are Help/Back-to-admin/Sign-out — no avatar affordance is documented there at all.
- Several proposals treat P8 (free coach's cross-org, org-less team switcher) as a MOVE-axis "sibling switcher" comparable to P7 — but P8 is explicitly cross-org by data model, which makes it structurally an ENTER mechanism wearing MOVE's clothing. Any "one rule for P4–P8" claim (`scope-ladder`'s "one crumb+switcher interaction contract... without touching any of their distinct audience/gating rules") is false for this specific mechanism, and its own multihat judge caught exactly this.

## Recommendation

Adopt a **three-axis model**: ENTER (flat, cross-context — owned by Home/P9, unchanged), MOVE (hierarchical, within-context — the scope-ladder's crumb+switcher, replacing P4–P7 but *not* P8), SIDE (the Flip, unchanged except the two named seam fixes). Treat liveness/revocation as an explicit fourth, separately-scoped workstream (an interstitial + resync pattern), not something either place-axis is expected to absorb as a side effect. Do not build a single "which place" widget; the evidence is unambiguous that no single container exists across all nine shells for it to live in.

---

# Q2 — Phone Reality, Per Persona: Does the More Sheet Hold It?

## Answer, up front

**No. Reject the More-sheet as the container for any new place-switcher.** Two of the four bottom-tab shells (consumer, free coach) have no More sheet to put anything "at the top of" — the proposal describes a slot that doesn't exist for half its target surfaces. The two that do have one (admin, premium coach) are already height-capped and scrolling, and the premium coach sheet has already shipped a real overflow regression from list growth. Layering a new switcher-shaped row into either one repeats that failure mode and sits it directly next to the same-shell switchers (P4, P7) findings already warn it would be confused with.

**Recommended phone answer:** Home's Workspaces cards (P2) stay the only aggregator — nothing new replaces it. Every shell gets exactly one **static, ungated "Home" link** (not a list, not a switcher, not gated on hat-count) wherever that shell already has a slot for it:
- Consumer + free coach: **already solved** — Home is the first bottom tab today. Zero work.
- Admin + premium coach: **one fixed link to /discover**, pinned outside the scrolling row set (or on an existing account/profile icon if one exists) — never inside the ~20-row/team-switcher list. One static destination can't grow, so it can't reproduce the overflow bug, and it can't be confused with P4/P7 if it's visually distinct ("Home" + house glyph, not another "switch" control).

Everything beyond that stays a full-page Home round-trip. That is a real, acknowledged cost for frequent multi-hat switchers — not a fix for them — but it's the only version that doesn't risk the sheet's known regression, doesn't create adjacency confusion, and doesn't tax the single-hat majority.

---

## Per-persona, per-shell phone walkthrough

| Persona | Shell(s) touched on phone | What actually happens |
|---|---|---|
| **A. Single-hat majority** (sole admin, or sole coach) | Admin (or Coach) shell only | Resolver drops them straight into their one shell, bypassing consumer chrome entirely. Bottom tabs + More sheet render with no switcher content — correctly, nothing to switch to. **No gap.** |
| **B. Anonymous fan** | Marketing / consumer / org-public-home / tournament | Zero identity chrome anywhere (baseline, must stay). On **org public home** specifically: no bottom bar, no hamburger, no consumer tabs at all — a dead end for further exploration, but this is a "no bar exists" problem, not a "sheet" problem; no More-sheet fix touches it. |
| **C. Admin@A + coach@B** (different orgs) | Admin-A shell, Coach-B shell | Lands in one (pill logic says Admin, but pill is desktop-only so moot on phone). Inside Admin-A's More sheet: **zero reference to Coach-B** — P3 "All Workspaces" is desktop-sidebar-footer only and its gate (org memberships) wouldn't even count a coach hat if it *were* on phone. Inside Coach-B: "Back to admin" (P11) is same-org-only, so it never renders for org A. **Net: no in-shell path either direction. Home is the only bridge, both ways, every time — full page load, not a sheet tap.** |
| **D. Two premium teams, two orgs** (no admin role) | Coach-Team1(Org A) shell | P7's team switcher renders as real More-sheet rows — but it's **same-org-only**, so Team2 (Org B) never appears. The switcher *looks* complete but is silently incomplete for exactly this persona. /coaches hub (P9) has the full list, but nothing in the coach shell's chrome links to it. **Home is the only real bridge**, and the in-shell switcher actively misleads by omission. |
| **E. Two-org admin** | Admin-A shell | This is literally the persona P3 was built for, and P3 explicitly does not exist in the mobile More sheet — only the desktop sidebar footer. Phone gets **nothing**; pill is moot (desktop-only). Only route: full nav to Home. |
| **F. Multi-team free coach, no admin role** (org-less, cross-org) | Free coach shell | The one bright spot: P8's header-name popover switches between this persona's own free teams **cross-org, in one tap, in-shell** — the mechanism genuinely works here, and its own footer copy correctly defers anything further ("all your workspaces live on Home"). **No gap for same-family switching.** |
| **G. Scorekeeper, 2+ events** | Scorekeeper shell | No sheet, no switcher — a flat day-list/chooser on the page itself, identical every viewport. Findings call this fine. Notably: when this product needed to solve "pick 1 of N," it solved it with a **full-page list**, not a sheet row — direct precedent for leaning on Home's cards rather than a sheet. |
| **H. Platform admin** | Platform-admin shell | Horizontally scrolling top strip; zero bridge to org shells, by design. Not in scope. |
| **I. Role revoked mid-session** | Whichever shell was open | No client polling; a stale row (in a sheet or a full list, doesn't matter which) keeps showing the revoked place until a hard reload, then it vanishes silently. **The sheet vs. no-sheet distinction is irrelevant here — this is a data-refetch problem, not a container problem**, and no More-sheet design fixes it. |

---

## Why the More-sheet proposal fails, specifically

1. **It describes a slot that doesn't exist in half its targets.** Consumer and free coach have no More sheet — "top of the sheet" has no referent there. The free-coach sheet was *retired on purpose*; reintroducing sheet-based switching there reverses a deliberate call.
2. **The two shells that do have a sheet are already at capacity.** Admin: ~20+ rows / 5 sections / capped at min(74vh,620px) with scroll. Premium coach: same cap, plus a **documented, shipped bug** where unbounded growth already pushed the existing team switcher off-screen. A new list-shaped addition lands on a component with a live failure history, not headroom.
3. **Adjacency confusion is the findings' own explicit warning, not a hypothetical** — a new switcher row sits next to P4's/P7's same-shell switchers "it would be confused with," and personas C/D/E show exactly why: two switcher-shaped rows in one capped sheet, one of which is silently incomplete (D) or entirely absent for the case it's needed most (C, E).
4. **It doesn't actually reach the personas who need it.** The pill is desktop-only; per the findings, Home's Workspaces cards are *already* "the ONLY route from consumer surfaces into an operator shell" on phone. A sheet row buried behind a "More" tap doesn't outperform a bottom tab that's zero taps away in the two shells that already have one.
5. **It taxes the wrong population.** Any ungated version of this row appears for the ratified common case (single-hat majority, persona A) with no payoff — violating "the rare case pays, not the common one." Any gated version only helps a minority of personas (C, D, E) who are already using — and will continue to need — the full Home round-trip regardless.

**Bottom line:** the sheet is not the answer for any of the traced personas. The fix that actually holds up against every row in the table above is: Home's Workspaces cards stay the single source of truth, and every shell's entry point to them is a single static, ungated link sized to whatever that shell already has — a bottom tab where one exists (consumer, free coach: already shipped), a pinned link outside the scrollable list where a sheet exists (admin, premium coach: not yet shipped). Nothing list-shaped goes into either sheet.

---

# Q3 Answer: Getting to an org's public face (not an event)

## The answer

**There is exactly one gap to close, and it is narrow: link OUT of the shells that currently have zero path there. Do not build new consumer chrome ON org home. And accept that for single-tournament orgs — the common case — org home is correctly not a distinct destination at all.**

Concretely, three link additions and zero new UI:

1. **Tournament chrome → org home.** One plain text link, added to `TournamentSideRail` (desktop) and as a trailing link under the event header in `TournamentTopTabs` (mobile). Not a new tab, not a new chrome layer — tournament pages already carry three simultaneous layers; this is the one link that's missing, not a fourth surface.
2. **Premium + free coach shells → org home.** A same treatment: an unbranded text link (not a wordmark — the no-wordmark ruling on premium coach stands untouched), landing at `/{orgSlug}`, gated to the coach's own org(s). This closes "premium/free coach have zero path" without reopening the two-family chrome ruling.
3. **Org home → back to admin.** The existing org-admin→public flip (`FlipPill` to "Public site") gets its return leg: a `FlipPill` on org home itself, visible only to signed-in operators of *that* org. This is the one genuinely new capability in the whole answer, and it's a five-minute reuse of an existing shared component, not a new one.

Org home itself gets exactly two changes, both fixes not features:
4. **Sitemap entry** — but only for orgs where org home is reachable at all (see below).
5. **One anonymous-safe link into the consumer app** (Discover) on the existing navbar — a single `<a>` tag, no bottom bar, no hamburger, no identity fetch. This is the fix for the sharper, unnamed gap: a fan on org home today has no door into the consumer app whatsoever.

Everything else stays as-is: no bottom bar, no hamburger, no consumer tabs on org home. Adding real chrome there fights the anonymous-priority constraint on the platform's thinnest, most deliberately minimal nav surface, for a page most single-tournament orgs will never actually show.

---

## What exists today, confirmed precisely

- **Admin org-level flip (works, one-way).** Org-admin, house-league, rep-teams, accounting, and public-site screens already flip to `/{orgSlug}` labeled "Public site." This refutes any general claim of "no path from admin." But org home has no `FlipPill` back — only the global, unscoped operator pill (P1), which doesn't target *this* org specifically.
- **Discover org search + Following·Organizations cards link there.** Confirmed working route in from the consumer app side.
- **Tournament pages: zero path.** Exhaustive grep — ZERO bare `/{orgSlug}` hrefs anywhere in tournament chrome, across all three simultaneous chrome layers. The only such link in the entire codebase is org-home's own self-link in its navbar.
- **Premium coach portal: zero path.** The shell is a deliberate island (Help/new-tab, same-org-only Back-to-admin, Sign-out). No link to the org's public face exists.
- **Free coach portal: zero path.** Same absence; complicated further by the org-less data model (a free-coach team isn't always resolvable to a single org context).
- **Org home has no consumer doors.** No Discover/Scores/Chat, no bottom bar, no hamburger — `consumer-routes.ts` deliberately excludes it. It is the thinnest nav surface in the product.
- **Not in the sitemap.** Only marketing + tournament URLs are emitted. Org home is invisible to search.
- **Single-tournament orgs never show it.** `/{orgSlug}` self-destructs: exactly one active tournament → automatic redirect into that tournament. Since single-tournament is the *common* case across the install base, org home as a distinct rendered page effectively doesn't exist for most orgs today.

---

## Is org home worth navigating TO, in its current state?

**No — and that's diagnostic, not a defect to patch with more chrome.** Its current state (thin navbar, no consumer doors, no sitemap presence) is *correct* for the org shape it was actually built for: a single-tournament org where the tournament itself is the org's real public face, and the redirect is the right behavior, not a bug. For that shape, "get to the org home" is a malformed question — there's no there there, by design.

**It becomes worth navigating to only for orgs with real standing content beyond one event** — multi-tournament orgs, and League/Club-tier orgs running house leagues, rep teams, multiple concurrent tournaments, archives. That's precisely the population where org home renders as its own page instead of redirecting, and precisely the tier where a fan or a linked-in operator has a real reason to land on a page that isn't a single event.

**Recommendation: treat "org home is a destination" as tier-conditional, not universal.**
- Tournament-tier orgs (single active tournament, the common case): keep the redirect. The org home's job for them is satisfied by the tournament page itself carrying the one missing link (#1 above) — which, for a single-tournament org, will usually just bounce the user right back to the tournament they came from. That's fine; it's not a failure state, it's confirmation there's nothing else to see. Don't sitemap these; don't build them a destination that doesn't exist.
- League/Club-tier orgs (multi-tournament, house league, rep teams, archives): org home is a real, standing page and should get the sitemap entry and the Discover link. This is also exactly the population that benefits most from the operator-side fixes (#2, #3) — multi-hat admins and coaches at a Club-tier org are the ones actually served by a working return leg.

## What org home must become, if it's kept as a destination for that population

Minimal, not a redesign:
- A working, sanctioned exit into the consumer app (one Discover link) — closes the fan dead-end without adding a bottom bar to the platform's thinnest surface.
- A sitemap entry, gated to orgs where the page doesn't just redirect away.
- The return-leg `FlipPill` for signed-in operators of that org.
- Incidental fix riding along: the legacy `/{orgSlug}/teams` hardcode in the "Tryouts Are Open" CTA, which is exactly the kind of dead link this same page shouldn't be shipping while it's being made a real destination.

**What it must NOT become:** a second aggregator, a bottom-bar shell, or a place that pretends to be equally relevant to every tier. Building full consumer chrome onto org home for the tournament-tier majority would add clutter to a page that redirects away before most visitors ever see it — cost with no payoff, against the anonymous-priority constraint, for zero behavioral gain.

---

# Q4 — Incrementality and the Smallest First Step

## THE ANSWER

**Almost everything here is incremental. Ship it in six stages, in this order. The first step is: build one unifying read resolver — `/api/me/hats` (unions admin-org + premium-coach + free-coach + official contexts, precedence-sorted, per-request `live` flag) — and ship it with *zero* new UI, by repointing two things that already exist (the operator pill's precedence logic, and P3's `hasMultipleWorkspaces` gate feeding AdminSidebar's "All Workspaces" footer link) at it, deleting their separate ad-hoc counts.**

This step is worth shipping alone (it fixes a real, named bug — P3's gate counts only org memberships, so an admin@A + coach@B user never crosses the 2+ threshold today even though they hold two real places) and it is the shared resolver every later stage consumes instead of re-deriving hat-counting logic. Two of the five judged models (identity-first, minimal-repair) converge on this exact move as the correct opening wedge; a third (home-as-hub) implicitly depends on the same "don't build a second aggregator" discipline. Treat that convergence as decisive.

---

## STAGED SEQUENCE

**Stage 0 — `/api/me/hats` resolver, no UI (THE FIRST STEP)**
- Verified defect: three independent computations of "how many places does this account hold" (pill precedence, P3's org-only count, P9's hub) that can and do disagree; P3's count specifically misses coach/official contexts.
- Ship: one endpoint, repoint pill + P3's gate at it, delete the old queries.
- Why it makes the rest cheaper: every later stage that needs "which places / how many" (mobile badge, gate-widening, revocation-aware rows, /coaches hub parity) becomes a pure UI change against one proven data contract — instead of each stage inventing its own count and risking the exact drift already documented once (Accounting vs. P4 disagreeing).
- Independently testable, no design review, no owner sign-off needed.

**Stage 1 — Activate the dead AdminSidebar logo (parallel to Stage 0, no dependency)**
- Verified defect: "Sidebar wordmark is a DEAD unlinked div."
- Fix: wrap it in `<Link href="/discover">`. Zero visual change, zero new component, zero gating logic.
- Ship regardless of anything else in this list.

**Stage 2 — One org-scope link in tournament chrome (no dependency on Stage 0)**
- Verified defect: exhaustive grep found **zero** bare `/{orgSlug}` hrefs anywhere in tournament chrome, despite three chrome layers and two wordmarks.
- Fix: one `<Link href={/${orgSlug}}>` in `TournamentSideRail` (desktop first).
- Caveat to state plainly, not paper over: for the common single-active-tournament org, org-home's self-destruct redirect bounces the user straight back into the same tournament page — so this link is a real escape hatch only for multi-tournament orgs. Ship it anyway; don't market it as solving the anonymous fan-door gap (it doesn't — see "Do Not" below).

**Stage 3 — Widen P3's gate from org-only to combined-hats (depends on Stage 0)**
- Verified defect: coach+admin persona (admin@A + coach@B) never sees any cross-place switcher because the gate only counts org memberships.
- Fix: swap the gate's input from the old org-count to Stage 0's resolver, threshold unchanged (2+). This is now a one-line condition change *because* the data is already correct — this is where Stage 0 pays for itself.

**Stage 4 — Admin mobile "Home"/All-Workspaces row: VERIFY BEFORE BUILDING**
- Do not build this from the findings doc alone. One adversarial pass grepped the live repo and found `AdminBottomNav.tsx` **already ships an ungated Home row** in a "You" section, citing an in-code comment referencing a prior fix for this exact gap. Re-read that file fresh before scoping any work.
- If anything remains, it's a *position* question (the row currently sits after Operations/Setup/Admin, not pinned first) or a distinct "All Workspaces" list-parity question — not new construction. Treat this stage as "confirm, then maybe reorder," not "add a row."

**Stage 5 — Premium coach portal exit: OWNER GATE, THEN BUILD**
- Verified defect: the premium coach shell is a true island — only exits are Help (new tab), same-org-only Back-to-admin, Sign out.
- This is the highest-value single fix in the whole list, but every model's cost analysis converges on the same blocker: the shell's total absence of a wordmark was a **deliberate, ratified owner call** ("operator HQ," de-branded). Do not build any visible exit control here until the owner explicitly confirms an unbranded text/glyph link ("Home"/"Switch," no logo) is an acceptable substitute for the original no-exit ruling — that confirmation is a real, separate step, not a formality to skip.
- Once approved: desktop sidebar footer first (next to Back-to-admin/Help/Sign-out), content sourced from Stage 0's resolver. Mobile follow-on only after a regression check — this shell's More sheet already broke once from unbounded growth.

---

## WHAT TO EXPLICITLY NOT DO

- **Do not build a new aggregator, rail, or place-switcher component.** Home's Workspaces cards (P2) and the `/coaches` hub (P9) are already the complete, viewport-complete lists. Every new UI surface in this sequence must *query Stage 0's resolver*, never maintain a second list — that's the exact drift risk (Accounting vs. P4) the findings already caught once, live, in production.
- **Do not add a row to the admin or premium-coach More sheet without a real-device overflow check first.** Both are already height-capped (`min(74vh,620px)`); the coach sheet has already shipped one unbounded-growth regression, documented in a code comment.
- **Do not use this sequence to solve the org-home anonymous fan-discovery gap.** It's real ("a fan has no door into the consumer app at all" on org home) but it's a chrome-vs-clutter decision on the platform's deliberately thinnest, sitemap-absent surface — it needs its own owner/design ruling under the anonymous-priority constraint, not an opportunistic fix riding on Stage 2's link.
- **Do not migrate P4 (admin tournament switcher) off client-state, or unify it with P5/P6, inside this sequence.** It's a genuine defect (unbookmarkable, can silently disagree with Accounting's URL-scoped ledger) but it's a routing migration across bracket/schedule/check-in/accounting screens — size it as its own project.
- **Do not touch the free coach shell's Flip (Roles-popover parity) or pill without a /design check.** It's ratified as consumer-family chrome; introducing multi-hat operator concepts there needs explicit sign-off, same class of gate as Stage 5.
- **Do not claim this sequence fixes mid-session role revocation.** Stale chrome on revocation is real and platform-wide but requires a client-side re-validation/interceptor pattern — a different, larger unit of work. Track it separately; don't let Stage 0's `live` flag get oversold as a fix for chrome that never re-renders on soft navigation.

## THE HONEST AMBIGUITY

Judge scores across all five models clustered in a narrow, unimpressive 3.3–4.7 band — no model was a clean win, and every model's phone-lens and multi-hat-lens verdicts surfaced real, unresolved objections. That means: don't treat any single model as "the plan." What *is* unambiguous, because it recurred as a surviving idea across every single verdict regardless of which model was under review, is the resolver-first sequencing above. Build on that consensus, not on any one model's full design.

---

# Q5 Answer: The Anonymous-Public Invariant

## The rule

**An anonymous visitor's page must render, fetch, and weigh exactly the same after any nav-model change as before it — zero new identity fetches, zero new DOM nodes tied to role/session state, zero new bytes of operator-chrome JS in the shipped bundle, on every one of the anonymous-facing surfaces.** Role machinery may not use an anonymous pageview as a probe point. The only two things allowed to change on these surfaces are (a) content that is itself public and static regardless of session, and (b) the two named paper-cuts below, deliberately, once.

This is not a style preference — it's the one constraint every judge across all five models independently converged on. Every model that touched org public home or tournament chrome scored WEAK or FATAL on the public lens specifically because it added *something* — a link, a badge, a query, a conditional render — to a surface anonymous users dominate. The pattern repeats five times in the verdicts above: "does it improve the anonymous experience anywhere? No." That's the accepted trade for the safe models (home-as-hub, minimal-repair's core) — safe means *inert* on these surfaces, not *helpful*. Any model that claims to help anonymous users while also adding chrome there should be treated as self-contradictory until proven otherwise.

## What anonymous visitors see today, per surface — and the line

**1. Marketing (`/`, `/for-*`, `/pricing`)** — top bar + 5-link mobile bottom bar, wordmark → `/`. No identity fetch of any kind. *Line:* stays 100% static-safe; no role-aware element may ever mount here, full stop — this is the platform's front door and carries zero exceptions.

**2. Consumer app (`/discover`, Scores, Chat, Account)** — anonymous state renders Home/Scores/Sign-In only (state-based nav, confirmed in `ConsumerNav.tsx`); role-summary/tournament-viewer/chat hooks are gated on a local signed-in check before any identity round-trip. *Line:* the anonymous variant of this nav must never gain a new tab, badge, or fetch just because an authenticated variant elsewhere gained one. Any new control (operator pill, YouAreControl, workspace switcher) must render **nothing** — not a hidden placeholder, not a zero — for this state.

**3. Org public home + league/teams/archives** — Navbar org-home branch: logo + Pricing + operator pill + Sign In/Account. No consumer tabs, no bottom bar, no hamburger. Deliberately the thinnest surface in the product; absent from the sitemap. *Line:* this is the highest-risk surface in the whole review — four of five models (home-as-hub excepted, and it explicitly declines) touched it and every judge flagged it. The rule here is stricter than "don't add clutter": **no rung/crumb/switcher control may be added to this page at all**, inert or not, until the separate, larger "fans have no consumer-app door" gap is deliberately scoped and designed by `/design` as its own project — not smuggled in as a side effect of an operator nav fix. An inert breadcrumb is still a new DOM node an anonymous fan pays render cost for; "inert" is not the same as "free."

**4. Public tournament pages** — THREE simultaneous chrome layers already (ConsumerNav strip + branded Navbar/event header + TournamentSideRail/TournamentTopTabs) + two wordmarks. This is the single highest-traffic anonymous surface in the platform and the findings note it's already over budget. *Line:* it may not acquire a fourth layer. Every model that proposed adding an org-home crumb here (scope-ladder, minimal-repair's Rule B) was correctly marked down for "adding a fourth [layer] without consolidating any of them." No net-new persistent element ships here without first removing an existing one — this surface is at capacity.

**5. Scorekeeper/check-in, platform admin, token surfaces (tryout-score, tryout-response, unsubscribe)** — chrome-less or minimal by deliberate design. *Line:* untouched, no exceptions. Not in scope for any nav-model change.

**6. Service-worker cache invariant (cuts across surfaces 3 & 4)** — SW caches tournament HTML as **anonymous-only**, with identity resolved client-side after hydration. *Line:* any new control's presence/absence must be resolved entirely client-side, post-hydration, off a local signed-in check — never baked into server-rendered HTML that the SW then caches as the anonymous variant. This is the single mechanical test that catches most violations: if a role-aware element's visibility is decided anywhere other than a client-side `if (signedIn)` gate, it's a defect regardless of how harmless it looks.

## Testable assertions (what a reviewer or Playwright check must assert)

For each of surfaces 1–4, in an incognito/anonymous session:

1. **Network parity**: capture the full request list before and after the nav change; the anonymous session's identity-related requests (`/api/me/*`, `/api/consumer/home`, any `/api/*/hats`, `/api/*/workspaces`) must be either absent or byte-identical in count to the pre-change baseline. Zero new identity round-trips.
2. **DOM parity**: snapshot the rendered DOM for an anonymous visit; assert no new elements exist that reference role, org-membership, hat-count, or workspace state (query for badge/pill/crumb/switcher selectors introduced by the change — they must return zero nodes).
3. **Bundle-weight delta**: compare shipped JS for the anonymous route before/after; any new shared component (WorkspaceSwitcher, YouAreControl, ladder crumb) referenced from a component anonymous users also load must be code-split so its chunk is not fetched on the anonymous path — assert via a coverage/network check that the new chunk's request count is 0 for an anonymous session.
4. **SW cache content check**: fetch the cached tournament HTML entry directly (bypass network) and assert it contains no server-resolved role branching — the cached payload must be identical for every role, with role UI appearing only after client hydration.
5. **Visual regression**: pixel-diff the org-home and tournament-page anonymous renders against the pre-change baseline; zero diff is the passing bar unless the change is an explicitly ratified content update.
6. **Marketing/consumer-anonymous route**: assert the rendered nav for a fresh session matches the documented state-based set (Home/Scores/Sign-In only) with no additional tab or badge, on both desktop width and phone width.

Any nav-model PR that can't produce green on all six checks, on all four surfaces, does not ship — independent of how good the operator-facing improvement is.

## The two paper-cuts

1. **`/api/consumer/home` fires ungated on Home for anonymous users** (server short-circuits, one wasted round trip).
2. **The tournament layout runs a server-side `getAuthContext` on every render** to gate the free-plan acquisition banner, even for anonymous visitors.

**Verdict: fix both, but as their own tiny, isolated cleanup commits — not bundled into whichever nav model gets picked.** Reasoning:
- Both are *already* violations of the rule above (paper-cut #1 breaks assertion 1, #2 is a "role check on every render" pattern that's exactly the shape the invariant forbids, even though it currently only feeds a banner rather than nav). They should be fixed regardless of which of the five models is chosen, because they're pre-existing debt, not something this review created.
- Fixing them **inside** a nav-model PR would contaminate the "zero new identity fetches" test above and make it impossible to tell whether a regression came from the new nav work or the paper-cut fix. Keep them separate so each change has a clean before/after.
- Low risk, low cost: #1 is a server-side short-circuit guard (skip the fetch if no session), #2 is moving the auth check behind the same local-signed-in gate every other role-aware hook already uses (role-summary, tournament-viewer, chat all do this correctly — `getAuthContext` on the tournament layout is the outlier, not the pattern). Neither requires new design, new copy, or owner sign-off — they're bringing two stragglers into line with a pattern the rest of the codebase already follows correctly.
- Sequence: fix both **before** starting any nav-model build, so the anonymous baseline the Playwright checks compare against is already clean — otherwise every future nav PR inherits two pre-existing false positives in its own regression suite.

---

# Q6 — What evidence justifies the expensive parts

## Answer, up front

**Ship the defect-justified fixes now, with zero new measurement.** They are correctness bugs or dead/asymmetric code in components that already exist — traffic volume cannot make them "not worth fixing." **Gate every new component (avatar badge, rail, scope-ladder caret, workspace-switcher popover) behind one cheap number: the share of signed-in sessions that are actually multi-hat.** That single measurement is the fork in the road for ~80% of the expensive proposals across all five models. Everything past that forks again on cost-to-build vs. severity-of-symptom, ranked below. **Before spending a single hour building any of it, re-run the grep/read that the findings sweep did** — one judge already caught a proposal (home-as-hub) diagnosing a gap in `AdminBottomNav.tsx` that turned out to already be fixed in code (an ungated Home row already exists, lines ~365–373). Stale findings are the cheapest possible false-positive to avoid, and this codebase has concurrent agents editing these exact files — verify against current `dev`, not the findings doc, immediately before implementation.

---

## Tier 0 — Proceed WITHOUT any evidence (defect, not traffic, justifies these)

These are broken or asymmetric today, in components that already exist. Frequency of use is irrelevant — a bug used once a month is still a bug, and every one of these is a small, reversible, single-component edit, not new architecture.

| Fix | Why it's evidence-exempt |
|---|---|
| `AdminSidebar` dead wordmark div → real `<Link href="/discover">` | Verified inert markup (no `<Link>` at all), not a design decision. Zero visual change. |
| Org-level admin screens' one-way flip → add return `FlipPill` on org home for signed-in operators of that org | Reuses the existing shared `FlipPill` component. The asymmetry (flip there, no flip back) is a bug in a mechanism that already works everywhere else. |
| Free coach's shell-header pill: single-target only → same Roles popover premium gets | Reuses the existing shared `FlipPill`/Roles component. This is a parity gap in code that already branches on hat-count for premium — the free branch was just never wired. |
| `hasMultipleWorkspaces`/P3 gate counting org memberships only, missing coach/official hats | An undercounting bug. A multi-team coach with zero admin roles is told, incorrectly, that they have nothing to switch between. Fix the union regardless of how many accounts hit it. |
| Role-removal produces a silent vanish + generic "Failed to load"; suspension already has an explanatory interstitial | Internal inconsistency between two states of the *same* mechanism. Reuse suspension's existing component for removal. No new architecture. |
| Broken links: Admin "Past Seasons" 404, org-home "Tryouts Are Open" hardcoded to the wrong legacy route, `/platform-admin/login?next=` open redirect | Verified broken/unsafe today. Fix on sight. |

**Not evidence-exempt, but not evidence-gated either — it's a decision, not a measurement:** giving the premium coach shell an exit link (to `/coaches` or to Home) requires **one conversation with the owner** re-confirming what the deliberate no-wordmark ruling actually forbade (the logo specifically, or all global chrome). That costs a Slack message, not an instrumentation pass. Get that answer before touching `CoachesSidebar`/`CoachesBottomNav`, but don't wait on usage data to ask it.

---

## Tier 1 — Cheapest real measurement (days, no new UI, respects the anonymous baseline)

**1. Multi-hat frequency, logged server-side off the existing per-request entitlement check.**
- **What it decides:** whether ANY new cross-shell control (avatar badge, popover, rail, scope-ladder caret) is worth building at all, versus letting Tier-0's two-door patch (Home + one exit per shell) stand indefinitely.
- **How, without touching the anonymous baseline:** this data only exists for signed-in sessions in the first place — a union of org/coach/official contexts is already computed per-request behind the same local signed-in gate every role-aware hook already uses (role-summary, flip-pill, tournament-viewer). Add one log line at that existing call site counting hat-cardinality. **Zero new fetches, zero new identity resolution, zero anonymous exposure** — anonymous sessions never reach this code path today and won't start now.
- **Threshold:** if fewer than ~10% of monthly signed-in accounts ever carry 2+ hats simultaneously, **stop** — no avatar badge, no popover, no rail, ever, for this population size. If it's north of ~20-25%, that's enough to justify building the shared `/api/me/hats`-style consolidation and a visible control on top of it.

**2. Click-through on the org-home → Discover link, once Tier-0-adjacent link exists.**
- **What it decides:** whether org public home — "the thinnest nav surface in the product," absent from the sitemap — deserves a *fuller* consumer-app door (bottom bar, tabs) or whether one link is enough forever.
- **How, anonymous-safe:** a fire-and-forget click beacon on an anchor tag that already exists on the page for everyone (no conditional render, no identity check, no new pageview-triggered fetch). This is strictly cheaper and safer than adding any server-side gating logic to a shell that's deliberately minimal for anonymous users.
- **Threshold:** sustained CTR under ~1-2% over a 4-week window → leave it as the single link, do not invest further. Meaningfully higher, or a support/complaint signal that fans bounce off org-home with no way into Scores/Chat → escalate to a dedicated design pass (this is the one place across all five models where the "sharper unnamed gap" — fans have zero consumer-app door — actually gets tested against real behavior instead of assumed).

---

## Tier 2 — Moderate cost: audits of data you already have, not new telemetry

**3. Distribution pull on real accounts: org-count per admin, team-count per coach.**
- **What it decides:** whether it's safe to add a row to the Admin or Premium-Coach More sheet at all, given both are height-capped (`min(74vh,620px)`) and the coach sheet already broke once from unbounded growth.
- **How:** a one-off query against existing production data — not instrumentation, not a new endpoint, no runtime cost, no anonymous exposure (this is an offline analysis, not a page feature).
- **Threshold:** if the p95 realistic account is already close to the cap with existing rows, **do not inline a new row into the scrolling list under any circumstances** — use a sticky, non-scrolling row outside the scroll area, or route the new affordance through a badge-on-the-trigger pattern instead. This is a hard gate, not a soft one — the coach sheet's prior incident is the proof this isn't hypothetical.

**4. Staging load test on a combined-hats union query.**
- **What it decides:** whether an "identity-first"-style design — fetch a unified hats list on every relevant page load — is affordable, or must be strictly on-demand (fetch only when a control is opened, never ambient/background).
- **How:** synthetic benchmark in staging, not production telemetry. Zero anonymous risk since it never runs against live anonymous traffic.
- **Threshold:** p95 added latency above ~50-100ms per load → reject any "fetch on every page" design outright; keep strictly to fetch-on-deliberate-open (the one rule several proposals already assumed but never validated — validate it before committing to the architecture).

---

## Tier 3 — Expensive: multi-week engineering, gate hardest, but gate on the RIGHT thing

**5. P4 (admin tournament switcher: client-state only, unbookmarkable, can silently disagree with Accounting's URL-scoped ledger) — this is NOT traffic-gated.** It's a correctness/data-integrity defect. The evidence that matters isn't usage volume, it's **incident count**: search observability/support logs for confirmed cases where the visible tournament context disagreed with the ledger scope a user was actually editing. **Threshold: a single confirmed occurrence of silent scope disagreement affecting money is enough to fund this migration now**, ahead of any nav-polish work — it's a data-integrity bug wearing a UX costume, and severity, not frequency, should drive it.

**6. P5/P6/season-mechanism unification (three uncoordinated mechanisms: URL-based, card-grid, dead `YearSelector`).** This one genuinely is frequency-gated, because the harm is user confusion, not data corruption. Measure via support-ticket tagging (season/registration confusion) before funding a multi-week migration. Threshold: a material, recurring ticket pattern (not a one-off) justifies it; absent that, leave it as three working-but-uncoordinated mechanisms.

**7. Any full desktop rail / scope-ladder crumbs / identity-first avatar-popover build.** Gated entirely on Tier 1's multi-hat frequency number — this is the single most expensive category across all five models (new component, new endpoint, nine-shell rollout, /design pass, mobile redesign) and the judges independently converged on the same verdict for all of it: don't build until that number exists. **If Tier 1 comes back low, this entire tier is cancelled, not deferred** — the two-door Tier-0 patch is the permanent answer for a low-multi-hat population.

---

## Sequencing

Ship Tier 0 this week — no measurement blocks it. Instrument Tier 1 in the same release (it's log lines and a click beacon, not a project). Let Tier 1 run 2-4 weeks. Do Tier 2's audits in parallel — they're offline and don't wait on live data. Only after Tier 1's number is in hand, decide whether Tier 3's component-building categories get funded at all; decide Tier 3's P4 migration on incident evidence *independently and immediately*, regardless of what Tier 1 says, because it's a correctness bug, not a UX preference.

---
