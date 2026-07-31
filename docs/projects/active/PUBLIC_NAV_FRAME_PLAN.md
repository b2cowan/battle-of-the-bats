# Public Navigation Frame — org sites ⇄ event sites ⇄ the app

**Date:** 2026-07-31 · **Status:** PROPOSED — one owner decision open (connectivity vs parity). No code written.
**Mockups:** https://claude.ai/code/artifact/4f6dffa2-426f-4e42-b153-03d342f2c151
**Companions:** `NAVIGATION_MODEL_{FINDINGS,PLAN,PM_BRIEF}.md`
**Method:** 17-agent panel — 4 competing public-side frames, each judged on the anonymous lens, the
house-league-family-on-a-phone lens, and the brand/tier lens. Scores: extend-frame 5.0, minimal-seam
5.0, follow-spine 4.5, org-as-place 4.3 — **every option scored WEAK on the brand lens**, which is the
finding that shaped the recommendation.

> **The core defect (verified 2026-07-31):** the app frame (platform strip on desktop, the
> Home/Scores/Chat/Account bar on phone) mounts on `/{orgSlug}/{tournamentSlug}/**` **only**. It is
> explicitly excluded from the org home, `/league/**`, `/teams/**` and `/archives`. House league and
> rep teams are **League ($89) and Club** features — so the highest-paying tiers’ families lose the app
> the moment they leave Home, while free-tier tournament families keep it the whole way.
> **The navigation quality is inverted against the price ladder.**

> **Second, quieter defect:** an org’s pages don’t read as one place. Home, League, Teams and Archives
> are islands with no shared section nav — unlike a tournament, whose sections are obvious. Trying to
> fix both defects with one piece of chrome (cloning the app frame onto org pages) is the most
> expensive option and the one that loses on brand. Two problems, two different-sized fixes.

---
# The Recommended Public Navigation Frame: One Place, One Way Back

## 1. What is actually wrong

The platform has a tier-inverted dead end. A tournament fan — available to every org, including the free tier — keeps a persistent way back to Home, Scores, Chat, and Account on every screen, from search all the way to the schedule. A house-league fan (League Plus) or a rep-team fan (Club) — the exact features the two *highest*-paying tiers exist to sell — loses that the instant they leave the org's home page, and doesn't get it back short of the phone's physical Back gesture. The customers paying the most get the worst version of the product. That inversion is real, holds up against every angle it was tested from, and is the thing a product owner should recognize immediately: the nicer the plan, the worse its fans' experience gets.

That's not the only thing making this hard to picture, though. A second, quieter problem is tangled into the first: an org's own pages don't feel like *one place*. Home, League, Teams, and Archives each render as an island with its own local sub-nav — there's no sense, the way a tournament's Overview/Schedule/Standings/Teams/Rules tabs give a fan for *one event*, that these are sections of one thing. Every option that tried to fix "the fan is stranded" by cloning the tournament page's full app frame onto every org page was trying to solve both problems with one piece of chrome — and that's exactly the version that costs the most: it doubles header bars and wraps two platform-owned bars around the org's *own* branding, on the pages the org pays to look like itself. The two problems need two different-sized fixes, not one big one. That's what wasn't feeling right.

## 2. The recommended frame

Four small, mostly-reused elements. No new bottom bar, no new drawer, no cloned app frame.

- **The breadcrumb** — the org's own thin bar always shows the org name, self-linking to `/{orgSlug}`. One level inside a season, a team, or an event, a chevron and that child's name append in the *same* row: `OrgName › SeasonName`. At the root it's just the org name, exactly as today.
- **The section strip** — the same responsive pair tournament pages already have (a left rail ≥1024px, a scrolling tab row ≤900px), mounted on org pages too. Its contents change with depth, not with page type: at the org root it lists whatever top-level sections that org actually has (Home / League / Teams / Archives); one level in, it swaps to *that* level's own sections. One slot, one active depth — never two lists stacked.
- **The Discover link** — one quiet, plain-text link, the same visual weight as the existing "Pricing" link beside it, added once to the org's action row. Label: "Discover." Destination: `/discover`. Not a logo, not a wordmark, not first-in-row — grouped with the other plain utility link, not with the identity/sign-in cluster.
- **Icon cleanup** — the tournament section strip's "Overview" item stops using the house-shaped icon the app's own Home tab uses; it gets its own glyph. Label stays "Overview" — it was already correct.

**App screens (Home / Scores / Chat / Account):** unchanged. This is the reference the rest of the frame is calibrated against.

**Org home (`/{orgSlug}`):** Desktop — today's bar (logo+name, Pricing, operator pill, Account/Sign-in) unchanged in position, gains the Discover link right after Pricing. Directly below it, the section strip appears *only if* the org has more than one section — a single-event org still auto-redirects straight into that event, exactly as today, and never sees a strip. Phone — same logo bar, scrolling tabs below it if there's more than one section, no bottom bar.

**League pages (`/{orgSlug}/league/**`):** the same bar's logo block becomes `OrgName › SeasonName` once inside a season; the strip swaps to that season's own tabs — Schedule / Standings / Register / Status, which already exist as pages today, just not as a shared tab row. One tap on the org name returns to the root and the root's own section set.

**Team pages (`/{orgSlug}/teams/**`):** identical pattern — `OrgName › TeamName`, strip shows that team's own sections (profile, tryouts). The team's existing follow star is untouched.

**Archives (`/{orgSlug}/archives`):** reached as one item in the org-root strip; breadcrumb reads `OrgName › Archives`.

**Tournament pages (`/{orgSlug}/{tournamentSlug}/**`):** the platform strip (desktop) and bottom bar (phone) are **untouched** — Home/Scores/Chat/Account persist exactly as they do today. The only change is that the org's name becomes real and tappable on both breakpoints: desktop gets a small `OrgName ›` before the event name in the same header row; the phone header's org-name eyebrow — present today but inert text — becomes a real link to `/{orgSlug}` (keeping the existing rule that a single-name org doesn't show its own name twice). The desktop rail's separate "go to event home" logo-link is retired now that the breadcrumb covers that job — a net removal, not an addition.

One property worth drawing out because it makes this smaller than it looks: org home, league, teams, and archives already render through the *same* one navbar component today. The breadcrumb and the Discover link are each a single change to that one component — they reach all four surfaces at once, not four separate builds.

## 3. What an anonymous visitor experiences, precisely

No new identity or role fetch anywhere. The breadcrumb's org/season/team name and the section strip's contents are built from data already resolved server-side for that page (the same tier/module flags org home already uses to decide which hero cards to show); the Discover link is a static href, exactly as cheap as the "Pricing" link sitting next to it. None of this touches the client-side, cookie-first identity checks that gate the tournament page's platform strip and bottom bar — that machinery isn't being extended, so it isn't gaining new cost either. Tournament HTML stays anonymous and cacheable exactly as today.

What an anonymous visitor does *not* get on org/league/team pages, stated plainly: a persistent bottom bar. What they get instead is a page that visibly has sections (the strip), a one-tap way up to the org root from any depth (the breadcrumb), and one quiet, always-there link back into the app (Discover). That is the honest ceiling of this frame — a real improvement over today's dead end, not parity with the tournament fan's always-on chrome.

## 4. The two journeys, on a phone

**Tournament fan.** Before: Home tab → search → tournament card → event page (header, scrolling tabs, bottom bar) → schedule. Bottom bar persists the whole way; the org's name is nowhere visible or tappable. After: identical, except the org-name eyebrow above the event title is now a live link, and the Overview tab no longer wears a second house icon next to the bottom bar's real Home tab. Tapping the org name now goes somewhere — an org running three events this month becomes browsable without walking back through global search.

**House-league fan.** Before: Home tab → search "Cedarvale Minor Hockey" → org home (one thin bar, no sections, no way back) → tap League → season page (same thin bar) → schedule/standings. No persistent chrome anywhere in this chain; no sense that League, Teams, and Archives are siblings of what's on screen; nothing back to Scores/Chat/Account except the phone's physical Back gesture. After: Home tab → search → org home, now showing a scrolling tab row (Home / League / Teams / Archives) and a Discover link in the header → tap League (same page shell, tab row swaps) → season, header now reads `Cedarvale Minor Hockey › U12 Winter League` → schedule/standings. The fan can now feel like they're inside one browsable place, can always tap back up to the org root without Back-button archaeology, and always has one link back to the app in the header. What does **not** change: there is still no bottom bar under any of this. That gap narrows to one link; it does not close to parity.

## 5. Brand posture

Two things are already decided here, not open for debate: a loud, wordmark-plus-CTA footer on org and tournament pages was explicitly ruled out on 2026-07-30 as contradicting the ratified "paid presence must be subtle" constraint — this recommendation doesn't reopen that, it builds entirely inside it. And the calibrated, text-only "Built on FieldLogicHQ" credit line for paid tiers already exists and already renders on org home and tournament pages today; it simply hasn't been extended to league, team, and archive pages yet. That's a rollout gap, not a new design decision — closing it (same gate, same component, three more pages) belongs in this frame.

The Discover link is deliberately *not* a second brand mark. The org's action row already mixes org identity with one platform-owned utility link today — "Pricing" sits there now, and nobody reads that as FieldLogicHQ muscling in. Adding one more plain-text item at the same weight is a much smaller ask than an icon-plus-wordmark chip, and it doesn't force the org's own name to truncate on a narrow phone the way a wider, more assertive element would.

The section strip inherits whichever branding rule the event header already lives by: org-branded where the tier allows it (League Plus, Club), FieldLogicHQ-navy fallback where it doesn't (Tournament, Tournament Plus). Same rule, more places — not a new negotiation. Being commercially honest about the residual cost: a Tournament Plus org that grows past one event will see a navy, unbrandable strip on its own org root, because it has no branding for the strip to inherit. That's real, it's narrow, and it's the accepted trade — not something to discover later from a complaint.

Net effect: League Plus and Club — the tiers that actually brand their pages — pick up slightly more platform-adjacent chrome than they have today (the strip, the extended credit line), but both are already-calibrated-minimal elements, not a new bar competing with their identity. Unbranded tiers pick up more visible structural chrome in absolute terms, but they have nothing of their own for it to visually compete with.

## 6. Rejected options, and what survives from each

**Cloning the full app frame onto every org page** is rejected as the core mechanism: it doubles header bars specifically on the tiers that pay to brand their pages, and even its own smallest first step never reaches the league/team pages that are the actual problem. What survives: the discipline of reusing the exact client-side, cookie-first identity path rather than inventing a second one — this frame follows that same discipline everywhere, just without duplicating the bar itself.

**A single link-level patch (an org-name breadcrumb plus a platform "door" chip)** is rejected as a complete answer: on its own it only converts a total dead end into a one-tap, icon-only, crowded detour, and its wordmark-and-icon chip is a second brand mark competing with the org's own name in the exact row that identity lives in, forcing truncation on narrow phones. What survives, de-fanged: a link back to the app does belong in that row — just as a plain-text item at Pricing's weight, not a chip — plus the org-to-tournament breadcrumb link and the Overview icon cleanup, both adopted directly.

**A cross-entity "Following" drawer** is rejected as the primary mechanism: it imports an operator-style bottom sheet onto consumer-facing pages, which breaks the two-chrome-family rule, and it would surface a fan's *other* follows — potentially a rival club's name — inside one specific paying org's own header, a real commercial exposure the option's own review flagged and never resolved. What survives: reordering a fan's follows above search on Home (zero brand risk, doesn't touch org pages at all), and visually harmonizing the three existing follow stars (org, team, tournament) into one recognizable gesture, without adding a new place to see them all.

**The depth-aware breadcrumb-and-rail mechanism** is the option this frame draws the most from — the section strip and breadcrumb above are it, verified directly against the live rail and tab components. What's rejected from it specifically is its own choice to leave "how does a fan get back to the app" fully unanswered by design. This frame closes that with the Discover link and the credit-line rollout instead of leaving it open.

## 7. Staged build

**Ship first, smallest possible:** the tournament page's org-name link (phone: make the existing eyebrow text a real link; desktop: add the small breadcrumb segment; keep the existing rule that suppresses it when the org and event share a name) plus the Overview icon swap plus retiring the desktop rail's redundant home link. Zero new components, zero new pages touched — this is a same-file edit to surfaces that already exist.

**Next:** extend the already-built, already-approved credit line's existing gate to league, team, and archive pages. No new design, no new decision — just three more call sites.

**Then:** add the Discover link to the org navbar's action row. Because org home, league, team, and archive pages already share that one component, this single change reaches all four surfaces at once. Ship it and watch it in the browser before building anything else — this is the one genuinely new interaction pattern in the set, small as it is.

**Gate this one:** the section strip is real, net-new engineering — there is no shared rail or tab infrastructure on league or team pages today, unlike the tournament side. Pilot it on the org root only, and prioritize Club (rep teams, archives) over League Plus's season-level depth, since League Plus is currently paused with no relaunch scheduled — its half of this frame is worth designing now but shouldn't be the thing that's rushed.

**Leave alone:** the platform strip and bottom bar stay exactly where they are — tournament pages only. No cross-entity follow drawer. No wordmark-or-icon chip on the org navbar. No `--bottom-nav-height` audit on registration or tryout pages, because none of this adds a bottom bar for them to make room for.

## 8. What this does not fix

It does not give a house-league or rep-team fan the tournament fan's persistent, zero-tap Home/Scores/Chat/Account bar. The gap narrows from "total dead end, Back-button only" to "one quiet link, a breadcrumb, and a coherent set of sections" — real, but not parity. If the actual requirement turns out to be full parity rather than connectivity, that's a bigger, deliberate call — breaking the two-chrome-family rule on purpose — and belongs in front of design and strategy as a named tradeoff, not folded into this build quietly.

It does not fix that League Plus itself is paused; the league half of this frame will be built and ready with no live customer exercising it until that changes. It does not resolve the narrow case of an unbranded, multi-event org getting a navy section strip it can't reskin — a small, known, accepted cost. And it does not repurpose the credit line into a utility "back to Home" button — it stays a credit, on purpose; the Discover link is the separate, deliberate answer to that need.
