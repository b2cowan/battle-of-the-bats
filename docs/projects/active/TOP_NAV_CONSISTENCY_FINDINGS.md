# Top Nav Consistency Audit — Findings (2026-08-01)

> Investigation only — no product code was changed. Method: 8-agent code audit across all four
> surfaces, 34 Playwright measurement cases (3 viewports × anonymous/owner/coach against the live
> dev server), then a 12-agent adversarial verification pass (refute-first) of every candidate
> finding against both the code and the binding rulings. Both standing guards
> (`anonymous-public-invariant`, `org-return-flip-smoke`) ran green — 33/33 — on the current tree.

## The verdict, plainly

**The app's core reads as one product now.** A person crossing consumer app → tournament page →
admin → coaches portal sees the same 48px platform frame, the same doors in the same corners, and
each place's own skin — the Stage A–G work landed, and the measurements prove it (every strip is
exactly 48px, the branded rows exactly 72px, the door order on every strip matches the ratified
grammar, the phone breakpoint is 900px everywhere in the app).

**What frays is the edges** — the three places a real person *enters or falls out of* that core:

1. **Marketing never joined the system.** Its bar is a third height (64px) nobody chose, it uses
   the only 768px breakpoint in the product (so 768–900px viewports — an iPad portrait — show the
   same five links twice while the wordmark collides with the first link), its content column is
   24px off its own pages, and it is auth-blind: a signed-in operator who taps Pricing from their
   own app strip lands on a page telling them to "Sign In".
2. **Doors that can land on a 404.** The event chrome's "up to the org" link and the coaches
   no-assignment wall's only exit both point at the org's public home without checking the one flag
   that page requires — an org with "public page" toggled off serves a 404 behind a
   normal-looking navigation link. Live-reproduced end to end.
3. **The newest paid surface aligns to nothing.** The League/Club section tab row was purpose-built
   to share the identity row's content column — but the League pages it serves centre their own ad
   hoc columns, measured 244–304px off that edge at desktop widths.

Three things most worth fixing, ranked: **(1) the 404 doors, (2) the marketing seam, (3) the
League-page column.** Details, evidence and ownership below.

---

## 1 · The map — what each surface's top bar actually is (measured)

All values measured live at 1440×900 / 820×1180 / 390×844 unless noted. "container" = the shared
1200px `.container` column.

| Surface | Top chrome (desktop) | H | Width | Phone (≤900) |
|---|---|---|---|---|
| **Marketing** `/`, `/pricing`, `/for-*` | Own Tailwind bar: wordmark→`/` · 5 links · Sign In · Get Started | **64** | 1152px col (`max-w-6xl`) | 64px bar (wordmark+CTAs) + **own 46px bottom link bar** |
| **Consumer app** `/discover` etc. | `ConsumerNav` strip: wordmark→/discover · Home/Scores(/Chat/Account) · Pricing · Run-a-tournament · Sign-in / Workspaces | **48** ✓ | full-bleed ✓ | wordmark-only 48px bar + 72px bottom tab bar |
| **Org public** `/{org}` | Branded identity row: org name · Discover · Pricing · [flip/Workspaces] · Account/Sign-In | **72** ✓ | container ✓ | 72px row (name only — sheds header links) + app bottom bar (D1 ✓) |
| — League/Club only | + section tab row (Home/League/…; crumb retires when a tab is current ✓) | **44** | container ✓ | same row, scrollable |
| **Public tournament** | 48px platform strip + 72px branded event header (inset beside rail) + 248px side rail | **48+72** ✓ | strip full-bleed; header/rail event-branded ✓ | 134px event header (89 identity + 45 tabs) + app bottom bar |
| **Admin** `/{org}/admin` | `AdminTopStrip`: wordmark→/discover · bell · account · Workspaces (no chat ✓) + sidebar + sticky event header | **48** ✓ | full-bleed ✓ | no strip; 96px sticky header + 70px bottom nav + More sheet |
| **Coaches (premium)** | `CoachTopStrip`: wordmark→/discover · account · Workspaces (no chat ✓, no bell ✓) + sidebar | **48** ✓ (code-verified*) | full-bleed ✓ | no strip; bottom nav |
| **Scorekeeper / Check-in** | Twin volunteer headers: inert wordmark · context · Sign out (+ flip pill on scorekeeper only) | **52** (both) | full-bleed | same |
| **Platform-admin** | No top bar — 220px sidebar only, no door back to the app | — | — | collapsible |

\* The premium coach strip could not be measured live this pass: the UAT coach fixture currently
holds **zero workspaces** (empty role summary), so the portal walls it out — flag to `/uat`
(coach smoke suites are likely red right now). The strip's geometry chain and door set were
verified in code, and the shell's 48px unification was measured at the Stage G gate.

**✓ = matches a binding ruling.** The 900px breakpoint is uniform across the entire app surface —
marketing's 768px is the only exception, and it is finding D3.

---

## 2 · Defects (same job, different treatment, no reason) — ranked by who hits them

### D1 — Two navigation doors lead to a 404 org home · HIGH · CONFIRMED (live end-to-end)
An org whose **"public page" toggle is off** still gets, on every one of its event pages, the
desktop rail crumb and phone eyebrow linking to `/{orgSlug}` — which 404s.
- The link gates on `isOrgHomeRealDestination` (public-site module OR 2+ active events) —
  [layout.tsx:204](app/[orgSlug]/[tournamentSlug]/layout.tsx#L204), [module-entitlements.ts:46-48](lib/module-entitlements.ts#L46) —
  but the org home page additionally requires `org.isPublic` ([page.tsx:42](app/[orgSlug]/page.tsx#L42)).
- The **other two consumers of the same predicate both add the isPublic check** (sitemap +
  directory, [directory.ts:382-390,481-489](lib/directory.ts#L382)) — the event chrome is the one
  inconsistent caller, violating the predicate's own "ONE statement of this rule" doc comment.
- The toggle is a plain, ungated admin-settings checkbox ([settings page:532](app/[orgSlug]/admin/org/settings/page.tsx#L532));
  DB default is `true`; dev-seeded orgs hardcode it `false` (seed route), which is why
  `dev-test-org` reproduces it. A League/Club org can equally toggle it off — the module branch
  dead-ends identically.
- **Same family:** the coaches **no-assignment wall's only door** is a hardcoded `/{orgSlug}` link
  ([coaches/layout.tsx:110](app/[orgSlug]/coaches/layout.tsx#L110)) with the same missing check.
- **Fix shape (not written):** put `isPublic` inside the shared predicate (or its one drifted call
  site) so link-renderers and the page agree again. **Owner: `/plan` → code-fix.**

### D2 — The coaches "not assigned" wall is a chrome-less dead end · HIGH · CONFIRMED
The wall ([coaches/layout.tsx:91-116](app/[orgSlug]/coaches/layout.tsx#L91)) returns **before any
chrome mounts**: no wordmark, no account door, no sign-out, no bottom nav — a black screen with one
link (the possibly-404 one from D1) and a mailto. Who hits it: a coach whose assignment was
hard-revoked, anyone following a wrong-org link, an org admin who isn't a coach, a team-workspace
owner whose entitlement lapsed. Screenshot-verified. This is the named-but-unsolved *"is this place
still real?"* question rendered at its worst. **Owner: `/plan` (small build: wall keeps the
strip, or at minimum safe doors).**

### D3 — Marketing shows both navs at 768–900px, with collisions · HIGH · CONFIRMED (measured 820px)
The desktop link cluster shows at ≥768px (Tailwind default `md:`, [Navbar.tsx:139](components/Navbar.tsx#L139));
the mobile bottom link bar shows at ≤900px ([Navbar.module.css:426-428](components/Navbar.module.css#L426)).
In the 768–900 band — **iPad portrait is exactly 768** — the same five links render twice, the
wordmark collides with "TOURNAMENTS", and "SIGN IN" wraps to two lines. 900 is the platform
breakpoint everywhere else; 768 exists nowhere else in nav. **Owner: code-fix (align to 900).**

### D4 — Marketing is auth-blind · HIGH · CONFIRMED
The marketing branch never checks sign-in state ([Navbar.tsx:120-195](components/Navbar.tsx#L120));
the org branch of the same file does. The app strip itself links to `/pricing` on every consumer
surface — so **a signed-in owner tapping Pricing from their own app chrome lands on a bar offering
"Sign In" and "Get Started"**, reading as being signed out. Highest-traffic seam-crossing in the
product with no continuity. **Owner: code-fix (auth-aware right cluster), `/design` for what the
signed-in marketing bar should offer.**

### D5 — League public pages don't share the column their own tab row aligns to · HIGH · CONFIRMED (measured)
The Stage F tab row wears `.container` *specifically* to match the identity row's column
([OrgSectionTabs.module.css:40-44](components/public/OrgSectionTabs.module.css#L40)). The League
index + five season sub-pages centre ad hoc 560–800px columns on the raw viewport instead —
**measured 244–304px of left-edge stagger** between the nav column and page content at 1440px, on
the paying tier the row exists for. **Owner: code-fix (adopt `.container` as the outer column);
`/design` only if a nested reading-column is intended (then it should be centred *inside* the container).**

### D6 — Pricing is unreachable from org public pages on phones · MEDIUM · CONFIRMED (live, anon + signed-in)
The D1-ruling shed hides Discover/Pricing/Account/Sign-In from the phone org header on the grounds
the bottom bar "says the same things twice" ([Navbar.module.css:439-446](components/Navbar.module.css#L439)) —
true for Discover (Home tab), Account and Sign-In, **false for Pricing**, which the bar has never
carried and no footer backstops. A parent on a club page deciding to run their own event — the
acquisition case Pricing serves — has no path to it at phone widths. The recorded ruling text
repeats the overstatement. **Owner: `/strategy` (is Pricing wanted on a customer's public page at
all? — that's packaging), then docs-only to true up the ruling wording either way.**

### D7 — The org identity row's door order breaks the grammar — and the written rules conflict · MEDIUM · CONFIRMED
Org row renders `… · [operator door] · Account` — Account outermost
([Navbar.tsx:254-267](components/Navbar.tsx#L254)). Both written formulations put the
role/Workspaces door outermost: plan §3 Zone 3 ("Chat · Account · role pill … everywhere",
binding) and the Stage G ratified strip order. But Stage G's ratification says "across strips",
§3 says "everywhere" — **the two rules' scopes were never reconciled, and the branded row fell
between them.** Sub-finding: that scope conflict is itself a gap. **Owner: `/design` (one ruling:
does Zone-3 order bind branded identity rows? then a one-line swap if yes).**

### D8 — Admin phone shows two differently-destined "Chat" doors at once · MEDIUM · NARROWED
The More sheet's "You → Chat" (`/chat`, consumer app) renders even while tournament Chat is a
primary tab ([AdminBottomNav.tsx:365-374](components/admin/AdminBottomNav.tsx#L365)). The
mobile-shell exemption from the strip rebuild **is** explicitly grandfathered in the plan, so this
is not silent drift — but the desktop no-chat-door ruling's rationale (a section of the work is not
an exit; the door ejects into consumer chrome) applies verbatim and was never adjudicated for the
sheet. **Owner: `/design` (generalize the ruling or write the grandfather down).**

### D9 — Scorekeeper/check-in twins have visible seams · MEDIUM cluster · CONFIRMED (live)
The twin volunteer shells cross-link each other, and a dual-role volunteer sees the whole screen
change colour crossing between them: scorekeeper hardcodes `#0A0A0A` where check-in uses
`var(--hud-surface)` (#111827) — visibly different blacks — plus a border-opacity drift (0.5 vs 0.4,
one a literal). Both hardcode a duplicated 52px header height (consistent today; no shared
constant). Check-in also lacks the flip door scorekeeper has (never considered, not ruled), and both
wordmarks are inert text — as is platform-admin's — so a volunteer's only exit is Sign Out.
**Owner: code-fix (tokens/constant); `/design` for the check-in flip door + whether day-of
wordmarks stay deliberately inert.**

### D10 — Suspended-account page: copy says "sign out is all you can do", chrome offers the full app · MEDIUM · CONFIRMED
`/auth/suspended` mounts the full signed-in 4-tab nav; Chat and Account remain live (not a dead
end — a copy-vs-chrome contradiction keyed on raw auth state). **Owner: code-fix or copy fix.**

### D11 — Marketing geometry never joined the system · MEDIUM cluster · CONFIRMED (measured)
64px `h-16` bar (matches neither ruled height); inner column 1152px vs the 1200px `.container` its
own pages use (**measured 24px stagger** at ≥1200px widths); page top-clearances hand-rolled two
different ways (home reads the unrelated 72px branded token → ~72px of air; every sibling hardcodes
6rem → ~32px). Plus dead code: the "Portal/Upgrade" CTA branch and two `isMarketingPath` disjuncts
are unreachable (SiteChrome suppresses those paths before the bar ever mounts — verified single
mount site). **Owner: `/design` (is marketing 64px a chosen fourth height or does it join a ruled
one?) + code-fix for column/clearance/dead code.**

### D12 — Small confirmed nits · LOW
- **"Sign In" (phone tab) vs "Sign in" (desktop CTA)** in the same component; org+marketing bars
  use "Sign In" — pick one casing. (code-fix)
- **z-index**: notification panel and What's-New both z=1100 (tie = insertion-order luck), and the
  live-events toast (z=9999) covers an open notification panel during game days. Latent-but-real
  pair; the rest of the ad hoc scale has no reachable collision. (code-fix, low)
- **Rail vs phone crumb asymmetry**: when the org home isn't a real destination the desktop rail
  drops the org *name* entirely while the phone header keeps it as inert text — same signal, two
  renderings, no written principle. (`/design`, micro-ruling)

---

## 3 · Differences that are CORRECT — and the principle that protects each

Verified deliberate; do **not** "fix" these into consistency:

| Difference | Principle (where written) |
|---|---|
| 48px platform chrome vs 72px branded identity row | Two heights, both chosen — a customer's logo+name needs the room (design log 2026-08-01; `globals.css` token block) |
| Strips full-bleed; branded/public nav in the 1200px container | Each nav aligns to *its own page's* content — tools are full-bleed, branded pages are centred documents (design log 2026-08-01) |
| Chat icon on the consumer strip, absent from both operator strips | Chat is a destination for a fan, a section of the work for an operator (binding ruling 2026-07-31) |
| Bell on the admin strip, not the coach strip | Coach sidebar keeps the bell; mockup = spec (Stage H.1) |
| Org public pages: app frame is phone-only, no desktop strip | D1 owner ruling 2026-08-01 — re-opens, never extends |
| Section tab row only on League/Club; crumb elsewhere; "Teams" a crumb but not a tab | Stage F gate + BUSINESS_DECISIONS 2026-08-01 (no rep-teams index exists yet) |
| **Pricing + "Run a tournament" shown to signed-in users on app strips** | **Ratified** WI-1/WI-2, Desktop Public UX Phase 1 (2026-07-30) — the verification pass confirmed this is decided, not drift. Revisit only via `/strategy` |
| Return-⇄-flip beats the Workspaces pill on org pages | Stage E ruling (mirrors the tournament-strip rule) |
| Scorekeeper / check-in / platform-admin / preview outside the grammar | Ruled exceptions — but **nothing in those files says so**; a one-line comment each would prevent an eager "unification" (docs-only) |
| Two chrome-growth mechanisms (org tab row grows `--nav-height`; tournament strip composes `--chrome-top-h`) | **Refuted as competing** — one fallback chain, kept disjoint by the D1 route split. Worth one paragraph in the plan so the next reader doesn't re-derive it (docs-only) |

**Unwritten-but-defensible (each needs one recorded sentence, not code):** the consumer variant
keeps its wordmark-only phone top bar while tournament/coach variants hide theirs (each has a local
reason; no unifying principle); marketing's own phone bottom link bar vs the app's tab bar.

## 4 · Consistent but WRONG (the tax nobody pays yet)

The **geometry-token fallback layer still describes the old world**: both operator strips carry a
stale 44px fallback (dead by construction — verified unreachable at every mount), the notifications
panel's mobile block hand-copies 48px literals (currently orphaned CSS — no phone path opens it),
nine org sub-pages carry a dead-but-wrong 64px fallback, and the consumer top bar's height is a
hand-kept `3rem` that only *coincidentally* equals `--chrome-bar-h`. None of it breaks today;
all of it detonates on the day someone edits the token expecting the platform to follow. One
hygiene sweep (point every fallback at the token) retires the whole class. **Owner: code-fix.**

**Stale comments that contradict binding rulings** (each an identified re-add vector): the coach
layout's strip comment still lists the removed chat door; AdminChrome's strip comment likewise;
ConsumerNav's warm-gate comment cites the superseded "auth stays dark" rule; the nav plan's early
Stage-C text still says 44px. The correct text exists 3–20 lines away in every case. **Owner:
docs-only, cheap, do soon.**

## 5 · Does it read as one product? (the crossings, walked)

- **Fan → club page → tournament → app:** holds. The club owns its top, the platform owns the
  phone bottom bar, the tournament adds the strip, heights and doors stay put. The one stumble is
  D1: tap the club's name from an event of a non-public org → 404.
- **Multi-hat operator (fan → their club → admin → coaches):** holds well — this is where the
  program's work shows. Same strip anatomy, same corners, Workspaces pill everywhere, flip where a
  place has two faces. Stumbles: the org row's door order (D7) is the one corner that reads
  differently, and on a phone the admin More sheet's second Chat door (D8).
- **Anyone → marketing and back:** does *not* hold. Different height, different breakpoint,
  different column, and it forgets who you are (D3/D4/D11). Marketing is the fourth room that
  still reads as a different building.
- **Falling out (revoked coach, suspended account, private org):** the failure states are the
  least-designed chrome in the product (D1/D2/D10).

## 6 · Follow-up routing

| Owner | Items |
|---|---|
| `/plan` (build) | D1 predicate unification · D2 wall chrome/doors · D5 League column adoption |
| code-fix (small, no gate) | D3 breakpoint · D4 auth-aware bar · D9 tokens · D10 · D12 casing/z-index · §4 hygiene sweep + comment sweep |
| `/design` (rulings) | D7 door order on branded rows (+ resolve §3-vs-Stage-G scope) · D8 More-sheet chat door · D11 marketing height/column joining the grammar · check-in flip door · day-of inert wordmarks · consumer phone-topbar principle · rail-vs-phone org-name rule |
| `/strategy` (packaging) | D6 Pricing on customers' public phones · (only if owner wants) revisiting ratified operator acquisition chrome |
| `/uat` | Coach fixture holds zero workspaces — coach smoke suites likely red; reseed |
| docs-only | Ruling-text truing (D6 wording) · exception comments · geometry-mechanisms note · nav-plan 44px lines |

## 6b · Addendum (2026-08-01, owner question): typography & control metrics, measured

Measured live at 1440px across marketing `/`, consumer `/discover` (anon + owner), club row
`/dev-club-org`, tournament strip `/dev-test-org/live-demo`, admin strip `/uat-test-org/admin`:

- **Consistent (with reasons):** IBM Plex Mono nav labels over an Inter base on every surface,
  marketing included; pill radius fully-round everywhere; icon doors one size/two radii (ruled);
  wordmark implementations per the rulings (shared lockup admin+coach; consumer text variant;
  club row carries the customer's name — the point of the surface).
- **Inconsistent, no written reason (→ repair plan T1):** nav-label spec is 11.52px/600 (club row)
  vs 12px/400 (marketing) vs 12.48px/600 (consumer/tournament) with three letter-spacings;
  Sign-in pill 32px (marketing, club) vs 34px (consumer/tournament); the shared Workspaces pill
  renders 26px/10.9px in admin vs 30px/12px in consumer because each host sizes it. This is the
  "nav type scale + pill silhouette" third of Stage G — scoped, never built.

## 7 · Verification state & environment notes

- Standing guards green pre- and post-audit (nothing was changed): anonymous-public-invariant
  21/21 + auth setup, org-return-flip-smoke 7/7 — 33/33 total.
- Measurement artifacts were throwaway scripts in the session scratchpad (deleted after this doc);
  screenshots/JSON not committed.
- Dev-environment noise, not findings: a concurrent session's practice-plan editor carries a live
  parse error (500s only its own route); dev-seeded orgs are `is_public=false` by seed-route
  design, which is what made D1 reproducible locally.
