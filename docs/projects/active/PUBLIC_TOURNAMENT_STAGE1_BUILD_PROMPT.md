# Public tournament pages — Stage 1, the frame + the readable baseline (build prompt, four sessions)

> Written 2026-10-27. Stage 1 of `PUBLIC_TOURNAMENT_SITE_REVIEW_PLAN.md` (§9). **Ruled: Asks 1, 2, 8, 16, 17, all as
> recommended** (§10), and the app-bar direction accepted 2026-10-27 (§10a). Stage 0 is built (D1–D4, D7).
> **Everything here is built behind the preview switch**: with it off, customers and the public demo see today's pages,
> unchanged. Stage 8 turns it on for everyone, once.

## What Stage 1 is (one paragraph, so every part shares it)

Every public tournament page gets the club site's daylight frame. **The organizer's colour band** replaces the event
header. It has the club bar's shape: 72px on a phone, logo 44px or initials, the name in the title face over at most
2 lines, one line of dates and the state chip, plus Share and, in a browser, Sign in. Under it sit a **white tab row**,
44px with a 3px accent rule, which pins while the band scrolls away; the **club's type**; the **club's colour roles**;
**one set of state words**; and **an organizer-colour footer** with a host line. On a desk, the side rail turns white
and runs the full height, and "Hosted by …" sits on the band's right. **The app bar follows where the page is opened**:
none in a phone browser, the bar inside the installed app. And **every page's current content is made readable on the
light ground with no layout change**; the layouts are Stages 2–7. The ticker is restyled here, after the owner rules
on options this stage draws (his Ask 17 note).

## How this runs: four sessions, a `/clear` between them

| Part | Covers | Ends with |
|---|---|---|
| **1** | The switch; the light token block; colour roles for all four kinds of organizer; type; the band; the pinned tab row; state words; the operator door in the band; the app bar by where opened; fixtures | Committed; a short owner check of the band at 360/390 on the fixtures (not the stage walk) |
| **2** | The desk (band with "Hosted by", the white full-height rail); the footer; the organizer's admin preview shows the frame when the switch is on; **ticker options drawn for the owner** | Committed; **the ticker options Artifact published and the owner's ruling recorded** (Part 4 builds the ruled one) |
| **3** | Readable baseline A: Overview, Schedule, a game's page, the live and My Team surfaces (cards, dock, rail card), Register, the pay page as it sits today | Committed |
| **4** | Readable baseline B: Standings, Playoffs, Teams, a team's page, News, Rules, Champions; **the ruled ticker**; `/review` of all of Stage 1; the QA walk | Committed, reviewed, walk §(next free) written and published |

At the end of each part, tell the owner in one line that it is a good place to `/clear`, and where the next part
starts ("Part N" heading below).

**Token discipline (owner, 2026-10-27).** Nearly all of a session's cost is re-reading its own history, so:
- **Read this prompt, plan §4 (the look, ~2 KB) and §10a (the app bar)**, nothing else of the plan unless a step names it.
- **The drawings are the spec, and the hub is 185 KB: never read it whole.** Pull one section's text or markup with a
  short node script, slicing between its `<h2>` headings in `PUBLIC_TOURNAMENT_SITE_REVIEW_HUB.html`. Sizes: "Stage 1 ·
  The frame" 7 KB (Part 1 reads it); "The end state" 18 KB (Part 2 reads its desk frame and the inside-the-app frame);
  "Every page" 52 KB (Parts 3–4 read only the `<h3>` for the page being made readable, to see what "readable" means
  there, and **build no layout from it**: layouts are Stages 2–7). The drawings are HTML and CSS, so the colours,
  sizes and words are readable in the markup.
- Send censuses ("every place the public pages hard-code a dark-ground colour") to a helper and ask for path:line plus
  a verdict, not file dumps. A helper's claim is a lead: open the cited lines before you rely on them.
- Prefer `npm run verify:changed`; run `npm run typecheck` once per part (the frame touches the shared layout).
  `check:layout --changed` only on the screens a part touched, and **with the switch on**. Leave the dev server
  running unless a restart rule applies (AGENTS.md). Part 1 adds files and changes the layout, so restart before handing
  the owner a check.

**Every part:** work on `dev`, stage explicit paths only; other sessions share this working copy (AGENCY_RULES). Commit
only after the owner says yes. ⚠ For a partial commit out of a file another session has also edited, build the blob from
HEAD plus your own lines, give the staging copy a name that cannot collide with a repo file (Windows paths ignore case),
and diff each blob against HEAD before committing. Present the product-owner summary before writing code
(AGENCY_RULES). **Commit this prompt file with Part 1's first commit**, together with the two lines written
alongside it on 2026-10-27: the Stage 1 row of plan §9 ("Build prompt written") and the public-tournament TODO line.
The TODO file also holds another session's uncommitted line (support console S4b), so take only yours.

### Rulings this stage stands on (do not re-open them; cite them)
- **Ask 1, the ground:** light for every tournament, with the organizer's colour as the band. **The organizer's
  Dark/Light switch goes**, but its removal from the Branding page is Stage 8's or 1a's work. In Stage 1 the switch on
  means light, whatever the organizer saved. This reverses Nav Unification's "do not warm-theme tournament pages" and
  Stage 4 Ask 1's venue carve-out. The band keeps their reason.
- **Ask 2, the type:** Barlow Condensed 700 for titles, Inter for everything else, sentence case, 12px minimum, tabular
  figures for scores and times. **No typewriter face anywhere on these pages** (this reverses G4 here).
- **Ask 8, state words:** Live now · This weekend · Registration open · Finished (`TOURNAMENT_STATUS_WORD` in
  `lib/club-site-home.ts`, the rule in `tournamentHomeStatus`). "Game day", "In progress" and "Tournament Day" do not
  appear behind the switch.
- **Ask 16:** the web app opened in a phone browser gets nothing extra; the browser's back is the way home.
- **Ask 17 note:** propose better versions of the ticker, visually or functionally ("maybe like a soft flashing
  scoreboard"), before building it. **Which pages carry the ticker is Stage 2 and Stage 3**, not this stage. Stage 1 only
  restyles it.
- **App bar direction (accepted 2026-10-27; its sub-points are unruled):** the bar follows where the page is opened.
  Sub-points stay as they are today: **don't move the install prompt or change its words**; if a step needs that, ask.
- **Contrast floor:** 4.5:1 for text and 3:1 for edges. `check:contrast` and `check:text-contrast` run in
  `verify:changed`.
- **The Flip amendment holds:** the operator door stays, in the band, on neutral tokens.

---

## Part 1 · The switch and the frame on a phone

1. **The preview switch, decided on the server before the first paint** (no flicker, no client toggle):
   - **On** in development by default, so the owner sees it on dev with no step. **On** on any deployment for a
     browser that opened the preview link: a small route that sets a first-party cookie and redirects to the page, and
     its "turn off" twin. **Off** for everyone else, which includes the public demo unless that visitor used the link.
   - **One helper** answers "is the new frame on for this request?" for the tournament layout, the admin preview and the
     share image. **One marker** on the tournament layout's outer element, e.g. `data-public-frame="light"`. The
     precedent is the coaches portal's warm release: a marker on the shell, styles keyed to it, then a single public
     release (`lib/coach-warm-preview.ts`'s header tells that story). **Do not put this in `proxy.ts`** unless you can
     show the route cannot do it; a proxy change has a wider blast radius and a restart rule.
   - **With the switch off, nothing a customer sees changes.** A guard test (`tests/unit/*-guard.test.ts` style, reading
     code with comments stripped via `tests/unit/_source-code.ts`) holds that the new band, footer and token block render
     only under the marker or helper.
2. **The light token block, in one place.** Read how today's Light mode works first: `lib/public-tournament-theme.ts`
   injects a variable block into `:root` when `colorMode === 'light'`, re-pointing the dark-ground tokens (`--white`,
   `--white-NN`, `--primary-light`, the lime) for the live layout and the admin preview. **Stage 1's readable baseline
   is mostly that lever pointed at the club frame's tokens**: ground `#F6F5F2`, white cards with a 1px hairline, ink
   `#1F1B16`, no shadows, no tints (plan §4). Write one block keyed to the marker. Leave the organizer's saved Light mode
   alone (it is today's switch-off behaviour). Then census, with a helper, what the block cannot reach: hard-coded hex,
   `rgba(255,255,255,…)`, the lime, `text-shadow` glows. That list is Parts 3–4's worklist; write it into this prompt's
   Part 3 heading as a short checklist. `check:public-tokens` already polices hard-coded colour on public pages.
3. **Colour roles, for four kinds of organizer.** The band colour runs through `clubColourRoles`
   (`lib/club-colour-roles.ts`): fill, text on fill (white or near-black, darkened until 4.5:1), ink for links and the
   selected tab (darkened until it reads on the ground), edge 3:1, accent as decoration only.
   - **Which colour:** in Stage 1, today's read rule decides (`resolvePublicTournamentTheme`: the tournament's own, else
     the club's). The club's rule for its tournaments is Stage 1a. Don't build it here.
   - **No tournament branding on the plan** (below Tournament Plus; check `advanced_tournament_branding` in
     `lib/plan-features.ts` against `docs/agents/strategy/PLAN_PRICING_FACTS.md`): **a neutral near-black band
     (`#1F1B16`, white text), no logo and no initials**, and the free plan's FieldLogicHQ badge stays as it is today. If
     the Facts doc and the code disagree about which plans brand, stop and flag it; don't pick.
   - A pale colour must still pass: its fill stays, and its text and ink darken. The hub's "Four organizers, one frame"
     drawing shows Riverdale (dark), a pale club colour, a paid standalone with its own colour and logo, and a free event.
4. **Type.** The club frame's faces and sizes exactly. Check how the club pages load Barlow Condensed and Inter and
   reuse that load; don't add a font request. There are no self-hosted fonts: a Google Fonts build failure is re-run,
   never "fixed".
5. **The band + the pinned tab row**, built from the club bar's parts (`ClubBar`, `OrgSectionTabs`, the `ClubFrame*`
   styles): the 72px band scrolls away, and the 44px white tab row with the 3px accent rule pins. Long name: two lines,
   then an ellipsis; the full name stays the page's heading for screen readers and in the page title. The dates and the
   state chip keep one line. Share sits in the band. **Sign in** is the club bar's plain word at the band's right end,
   in a browser only. **Keep the demo tour's anchors** (`data-tour` or whatever the tour uses) on the new band and tabs:
   the build fails if a tour destination stops existing, and Stage 8 will switch the demo on. Chrome budget at rest on
   a 667px phone: 120px in a browser, 48px pinned; inside the app add the 64px bar (hub "Stage 1 · The frame").
6. **The app bar by where the page is opened.** Recognize the installed web app while the page first draws, with no
   flicker. The `display-mode: standalone` test already exists: `lib/device.ts` (~:36) and the install prompts
   (`components/InstallAppPrompt.tsx`, `LegacyInstallBanner.tsx`). Reuse it. A CSS `@media (display-mode: standalone)`
   rule can show or hide the bar and the band's Sign in at first paint with no script, which is the likely answer. In a browser: no bar, and Sign in in the band. Inside the app: today's Home · Scores · Sign in/Account bar,
   on light, and the band drops its Sign in. Only on tournament pages and only behind the switch; club pages are not
   this stage. If recognition can't happen before first paint without a server hint, say so and propose one; don't ship
   a bar that appears and vanishes.
7. **The operator door** (Flip) moves into the band, on neutral tokens.
8. **Fixtures, dev only, re-runnable**, as a script under `scripts/` (later stages' walks reuse it), and print what it
   made. Riverdale exists already. Add a club tournament with a **pale** colour; a **paid standalone** (Tournament Plus)
   with its own colour and a logo; a **free** standalone event; a **long name** ("Greater Hamilton-Wentworth …", the
   hub's 360px drawing). Never re-seed production. A fixture whose password reset would sign people out must not reset
   passwords.
9. **Done when (Part 1):** on dev, at 360 and 390, the four organizers' bands match the hub's "Four organizers" drawing;
   the tab row pins; the state chip uses the four words; Sign in is in the band in a browser; the switch's off-link
   restores today's page exactly. Guard test, `verify:changed` and typecheck pass. Commit. Give the owner a short
   check: links to the four fixtures with the switch on, and one with it off. It's an owner check, not a QA walk.

---

## Part 2 · The desk, the footer, the admin preview, and the ticker options

> **Built 2026-10-28** (commit in plan §9's Stage 1 row). Calls made and told to the owner, who said commit: the platform's
> desk strip goes in a browser too (with it Discover and "Run a tournament"; inside the installed app it stays); a free
> event's footer carries no credit line (its badge is the credit); the rail stays 248 px (the drawing's 232 is the
> platform's one rail width minus 16); the footer lists every visible page; "Hosted by" in the band from 1,024 px only;
> **901–1,023 px keeps the phone's white tab row under the band** (inside it the tabs were squeezed to a scrap); the free
> plan's banner gets room under the footer; the Overview's desk hero retires (the name appears once). Not render-checked
> by Claude: the admin preview (the probe sign-in was refused even with the switch off) and the installed app on a desk
> (display-mode cannot be emulated) — both go to Part 4's walk.

Read the hub's "The end state", desk frame only (`Desktop, game day · 1280px`), plus the inside-the-app frame.
1. **Desk band:** the same band at desk width, with **"Hosted by &lt;club&gt; ›"** on its right side. Show it only when
   the org's home is a real destination: the existing rule `isOrgHomeRealDestination` and its async companion in
   `lib/module-entitlements.ts`, which the tournament layout already asks. Reuse it; don't write a second host test.
   Sign in sits to its right. The 48px centred hero goes, so the name appears once.
2. **The side rail** (Nav Unification holds): white on the light ground, running the full height. It is the
   tournament's own desk navigation and stays.
3. **The footer:** organizer colour, with the event name, contact and its copy control, the page list, the host line
   (same rule as above) and the credit. **The credit rules don't change** (free badge, paid credit). Shape: `ClubFooter`.
   The tab row and the footer's page list replace today's bottom "Explore" buttons, but only behind the switch.
4. **The admin preview** (`lib/tournament-preview.ts`, the organizer's preview of the public pages) shows the new frame
   when the helper says on, and today's otherwise. The share image (`opengraph-image`) is untouched: link previews are a
   later stage (Ask 12).
5. **Ticker options for the owner (his Ask 17 note), drawn before the ticker is built.** Make an HTML page with tabs
   (one option per tab, plus a "today" tab), true size at 390 and 1280, on the new frame. Each option gets one line on
   what it does better for a family on game day. Include at least a calm restyle of today's marquee, a "soft
   scoreboard" (the owner's words: fixed tiles, a gentle change when a score moves, no endless scroll), and one
   functional variant (e.g. only the followed team's game plus live count; tap to open). Respect reduced motion, and
   use no flashing that fails the three-flashes rule. Run `/design` on it before the hand-off, then publish it as a
   Claude Artifact. Record the owner's ruling in this prompt under Part 4, step 2. **Don't build the ticker in Part 2.**
6. **Done when (Part 2):** desk at 1280 and 1440 matches the drawing on the fixtures; the footer shows on every
   tournament page behind the switch; the admin preview follows the switch; verify and typecheck pass; committed; the
   ticker options are published and the owner's ruling is recorded.

---

## Part 3 · The readable baseline, A

> **Built 2026-10-28** (commit in plan §9's Stage 1 row). **The one lever the census missed:** the page shell inside the
> frame also carries today's Light-mode marker, and `globals.css` re-declares light primary, the status and label
> strengths, the inset ground and the card highlight ON that element, so they beat the club's token block and handed a
> pale organizer's raw colour back to text (yellow headings, links, chips on cream). The frame re-points those names on
> the shell, one step more specific; today's other Light-mode fixes still apply. Same for the shared outline button,
> primary badge, `.text-primary` and section eyebrow (raw colour as text → the organizer's ink). Calls made: sentence
> case and even-width figures are one frame rule (words written in capitals or Title Case in the source stay as
> written — "What To Check Now" is Stage 2's to reword); titles take the title face's own weight (700; today's 800–950
> smeared on light); the live leader reads by ink and weight (700 vs 600), and the Live chip loses its halo, not its
> blinking dot; the demo's own dock (typewriter face, dark) is left for Stage 8, which switches the demo on; the free
> plan's dark growth banner and "Powered by" stay as today (Part 1's ruling), including its overlap of "Run your own
> tournament". Three new measured screens (`pubt-game-pale`, `pubt-register-open`, `pubt-overview-after`): no contrast
> finding left on any `pubt-*` screen measured; tap floors and the game page's star spill (its deliberate −12 px tap box)
> are layout, left for their stages. **Not render-checked by Claude**, so Part 4's walk carries them: the pay page (no
> payment-link fixture), the live broadcast card (no fixture game is live), the follow picker and alerts panel opened,
> the desk's My Team rail card, and the admin preview.

**Rule for Parts 3–4: no layout change.** Same parts, same order, same controls; only colour, ground, type, borders and
icon tints change so that everything reads on light. When a page looks wrong on light because of its layout (a card
inside a card, say), leave it. That is its stage's job, and fixing it here is rework later. **Worklist:** Part 1's
census, pasted below this line once Part 1 has run.

<!-- Part 1 pastes the census here: path:line · what · fix -->
**Census (Part 1, 2026-10-27; a helper's read, open each line before relying on it).** The frame wears the club site's
token block (`ClubFrame.module.css` `.tokens`), which **already reaches** every `var(--…)`: the typewriter face
(`--font-data`/`--font-mono` → the text face, ~170 uses), `--glow`/`--glow-sm`/`--shadow` (→ none), lime as text
(`--logic-lime`/`--lime-strong` → the organizer's ink), and the `--white-NN` scale. What it cannot reach:
- [x] `app/[orgSlug]/Home.module.css` :246 `.heroBadge` `rgba(0,0,0,.45)` fill (phone) → ground/card token · :663 `.myTeamGame` `rgba(0,0,0,.16)` → `--bg-inset` · :1263, :1296, :1302 `rgba(255,255,255,…)` in the old light overrides → `--surface` · :1298 a literal shadow → drop · :205 `.heroTitle` glow (light override :1281, check under the frame)
- [x] `app/[orgSlug]/schedule/schedule.module.css` :606, :1629 the leading score's text-shadow glow → drop; the "leading team lit" needs a light answer (weight, not glow) · :1481 `livePulseGlow` `rgba(danger,.45)` → drop or tone · :1104, :1731, :2083 segmented-control shadows → drop (no shadows) · :30–32 `highlightFlash` ring (its glow is gone via the token; check the ring) · :562, :1603 avatar text-shadow → keep (white glyph on a team colour)
- [x] `app/[orgSlug]/register/register.module.css` :72, :256, :394, :581, :681 `rgba(255,255,255,.02–.03)` fills → `--white-03`/`--white-5` · :554 the lime tint → check
- [x] `components/public/ScheduleContent.tsx` :1478–1497 an inline-styled block (`--highlight-top`, `--font-data`) → move to CSS
- [x] Overlays (Part 3, they show on every page): `AlertsNudge.module.css`:21, `FollowDeepLinkPrompt.module.css`:21, `FollowTeamPicker.module.css`:55, `PreviewExitPill.module.css`:19, `TeamSubscribeButton.module.css`:89, :113, `components/shared/FlipPill.module.css`:185 — dark popover shadows `rgba(0,0,0,.35–.6)` → hairline, no shadow. A popover **portalled to `<body>`** sits outside the frame's element and reads the old light block on `:root`: check each one renders on the club's tokens
- [x] Lime as a FILL (the follow pills and stars: `TeamFollowStar`, `FollowTeamPicker`) becomes the organizer's ink under the token block → check the text on it
- [ ] Part 4: `standings.module.css` :49, :1087 section shadows, :733 the sticky column's shadow (→ hairline), :967 view toggle shadow, :1181 the champion icon's glow · `teams.module.css` :410 `.followBtnActive` `#fff` mix (light override :413) · `PublicTournamentState.module.css` :38 icon glow
- ⚠ `check:tokens` deliberately skips `rgba(255,255,255,…)` and `rgba(0,0,0,…)`, so grep for those by hand.
- **The rendered measure (Part 1 added it):** five public tournament screens in `scripts/layout-screens.mjs` (`pubt-*`,
  the fixtures of `scripts/seed-public-frame-fixtures.mjs`; `ready` waits for the band, so they measure the frame).
  Part 1 left them **unbaselined on purpose**: 50 findings at 390 on 2026-10-27, all page content (contrast on tints,
  tap floors), the demo's dock, and the free plan's banner as today. They are this worklist, not accepted debt. Run
  `node scripts/check-layout-invariants.mjs --only=pubt-overview,pubt-schedule-pale,pubt-standings-own,pubt-teams-free,pubt-overview-long`
  and drive it down; add a screen for each page Parts 3–4 make readable.

Pages: the **Overview** (all three moments: before, game day, after; the layout is Stage 2's), **Schedule** (list,
calendar, the live broadcast card) and **a game's page**; the live and My Team surfaces (`MyTournamentCard`,
`MyTeamCard`, `MyTeamDock` and its pill, `DesktopMyTeamRailCard`); **Register** (the form is unchanged); **the pay
page** as it renders today inside the tournament layout (its focused page is Stage 7; just make it readable).
- Scores and times in tabular figures; big scores in the title face (Ask 2).
- **Live red, the "No score yet" words (Stage 0), Final, and the winner's emphasis** must each still read as their
  meaning on light. Check the "leading team lit" treatment: today it is a glow.
- Done when: each page at 390 and 1280 with the switch on reads at the contrast floor (`check:layout --changed` with
  the switch on, plus the contrast gates); with the switch off, unchanged; verify and typecheck pass; committed.

---

## Part 4 · The readable baseline, B; the ticker; review and walk

> **Steps 1–2 built 2026-10-28, owner check and commit owed** (then steps 3–5). The ticker is a new line under the frame
> (today's strip is untouched with the switch off; both read today's games through one shared hook). Readable baseline
> B: frame-keyed rules on Standings (and its bracket summary), Playoffs, Teams, a team's page, News, Rules and Champions —
> washes of the organizer's colour → white or inset cards with hairlines, the followed/qualified marks in the edge
> colour, no shadows or glows (incl. the large shadow the token block does not reach: team hero, share menu), nothing
> under 12 px. The bracket's card edge, halo and date strip and the champion banner's trophy and label moved out of
> inline styles unchanged so the frame can reach them; the Teams monogram takes `teamInk` under the frame only. Five new
> measured screens (`pubt-playoffs-pale`, `pubt-team-own`, `pubt-news-pale`, `pubt-rules-pale`,
> `pubt-champions-after`): no contrast finding on any of the seven at 390 or 1280; what remains is tap floors (layout,
> their stages) and the free plan's banner (Part 1's ruling). Left as written, per Part 3's call: words the source
> writes in capitals (the team page's name, RECORD, NEXT GAME); the team page's team-colour hero tint (its identity,
> Stage 5's). Not render-checked by Claude: the line's "New" arrival (needs a score entered while open) and a game
> moving from its time to Live — both go to the walk. **Committed `e01043e2c` 2026-10-28** after the owner's check.

### Kick-off for steps 3–6 (a fresh chat; the owner pastes: "execute PUBLIC_TOURNAMENT_STAGE1_BUILD_PROMPT.md — Part 4, steps 3–6")

Read this prompt's top section, the Part 2–4 "Built" notes above and this block; nothing else of the plan unless a step
names it. Everything is committed, so the working tree holds none of it: **the diff under review is the four build
commits, `21dac8e87` (Part 1), `b7639fe83` (Part 2), `d2b80b61a` (Part 3), `e01043e2c` (Part 4)**. Other sessions
committed between them, so never review a range: list the files with `git show --stat` on each of the four and review
those commits' changes (`git show <hash> -- <path>`). Hand broad reading to a helper (CLAUDE.md).

1. **`/simplify` first** (built-in skill; point it at those four commits' code, not the working tree). The new shared
   pieces worth its look: the preview helper and its route (`lib/public-frame.ts`, `app/api/public-frame/`), the band
   (`TournamentBand`), the footer, the frame stylesheet's token re-pointing, the shared today's-games hook
   (`lib/hooks/useTodaysTournamentGames.ts`) and `TodaysResultsLine`. Its question: duplication with the club site's
   bar/footer/token block that should be one thing, and frame-keyed rules that repeat across page stylesheets. **Hold
   the line on "no layout change" and "switch off = today's pages exactly"**: a simplification that changes either is a
   finding to report, not to apply. Apply the rest; run the guard test, `verify:changed` (⚠ on 2026-10-28 two failures
   in it were other sessions' work: the Keep Premium audit-reason test and the demo check's missing module — re-check,
   don't assume) and `typecheck`.
   > **Done 2026-10-28, committed `03edd08d0`** (owner yes). Applied: the preview link's `to` goes through
   > `lib/safe-redirect.ts` (a tab-smuggled `/<TAB>//evil` passed the hand-rolled check: an open redirect, now in the
   > guard test); the footer's contact is looked up once a request (`publicTournamentContactEmail`, React `cache`);
   > `publicFrameRoleCss` for both layouts; `--shadow-lg` zeroed with the frame's names (three per-page rules gone);
   > the today's-games hook's one feed state; the line's clock is a real `now` and stops while put away; a dead bracket
   > selector. Guard 38/38, typecheck, tokens and contrast pass; `verify:changed`'s other failures were other sessions'
   > (the Keep Premium audit test, admin type, schema parity, index coverage, org-slug callers, demos, CSS selectors,
   > export catalog, root files). **Reported, not applied** (each moves frame-on pixels or the club site): the shell's
   > old Light marker under the frame (gate globals' light rules with `:where(:not([data-public-frame] *))` instead of
   > ~22 re-points — needs a render sweep; the admin preview hard-codes it too); a wash token for the ~90
   > organizer-colour tints (owner call on which stay coloured); a `--popover-shadow` token; a 12 px floor mechanism
   > (140 selector lines); the club role-var and footer-contact copies shared with the club site; a shared poller for
   > the schedule payload; the root nav still SSR-renders hidden under the frame.
2. **`/review`** (`.claude/commands/review.md`) on the same four commits plus `/simplify`'s, **`03edd08d0`** — five
   commits; list each with `git show --stat`, never a range. Kick-off for a fresh chat: the owner pastes *"execute
   PUBLIC_TOURNAMENT_STAGE1_BUILD_PROMPT.md — Part 4, the /review (kick-off step 2)"*; read the top section, this block
   and the Built notes, then run `/review` on those five commits. Press `03edd08d0`'s redirect and cached contact
   too. Points to press:
   the switch is decided on the server before first paint and nothing new renders without it; the redirect route
   cannot be pointed off-site; the ticker's timers (fade, hold, minute clock) clear on unmount and never stack when the
   live feed refreshes; the × key is per tournament per day; reduced motion never starts the reel; the moved bracket
   styles render identically with the switch off (admin bracket builder and preview too); the Teams monogram ink is
   frame-only. Fix what it confirms; report what it only suspects.
3. **Commit** each step's changes only after the owner says yes (explicit pathspecs; other sessions share the tree).
4. **The walk** (step 4 below): one purpose — *"with the preview on, every tournament page wears the new frame and
   reads on light; with it off, nothing changed"*. A checkable Artifact in §406's build, next free § in
   `OWNER_QA_LEDGER.md` (grep first). Fixtures: `node scripts/seed-public-frame-fixtures.mjs` (dev only; it prints the
   on/off links) plus Riverdale. Parts: (a) the four organizers' bands on a phone (pale, own colour + logo, free, long
   name); (b) every page readable, phone then desk — Overview (before/game day/after), Schedule, a game, Standings,
   Playoffs, Teams, a team, News, Rules, Champions, Register; (c) **the ticker**: fades through once then rests; "Live"
   / "Final" / a time; the × hides it and it stays hidden after a reload, and is back the next day (the walk can say
   how to clear it: a private window); **a score entered while the page is open arrives marked New** (read-back: which
   game, what it showed); a game moving from its time to Live; (d) the app bar in a phone browser and **inside the
   installed app** (phone and desk — display mode cannot be emulated, so the owner's devices are the only check);
   (e) what Claude could not render: the admin preview, the pay page (needs a payment link), the live broadcast card,
   the follow picker and alerts panel opened, the desk My Team rail card; (f) switch off is today's site (the old
   scrolling strip included); (g) the demo with the switch off. Stop check as §406/§407 had. ⚠ §407's lesson: ask for a
   read-back on every step that writes, and compare the server log with what the owner ticked before recording a pass.
5. Records and the tell: steps 5–6 below.

1. Same rule, for **Standings** (keep the table; **pinning Team and PTS is Stage 4**, so don't do it here),
   **Playoffs** (the bracket stays where it is today; its move is Stage 4), **Teams**, **a team's page**, **News**,
   **Rules** and **Champions**.
2. **The ticker, as the owner ruled in Part 2:** *options drawn 2026-10-28 (`PUBLIC_TOURNAMENT_TICKER_OPTIONS.html`,
   Artifact https://claude.ai/artifact/8rt2PdvZEV617tdrDDG35H; /design review done, its fixes applied): Today, A calm
   marquee, B soft scoreboard, C my team line; a second opinion (Codex) added D quiet score line and E no strip + a
   Schedule-tab count, reviewed by Claude on the page (D repeats the My Team dock). The owner then proposed **F, today's
   results fading in one at a time** (scores are mostly entered after games, so a live-score animation rarely fires):
   one pass on opening, a new result shown marked New, otherwise resting on the newest; pause control; reduced motion
   = no reel; the dock keeps the followed team. **F is the recommendation.***
   **RULED 2026-10-28 (owner): F's behaviour in D's look.** Games fade in and out one at a time (F: 5 s hold, 0.4 s
   fade, one pass on opening, then rest on the newest; a new result fades in and rests). The look is D's: one still
   44 px white line, a state word then the two teams and the score. **The state word is one of three: Live, Final, or
   the start time** for a game later today. **No "View scores" link and no pause button: an × only, so a family can
   remove the ticker from their view.** Calls made in the build and told to the owner: the × removes the line for the
   rest of that day on that device (it is back the next game day; no restore bar, whose height is what the × gives
   back); the line still opens the game shown and still pauses under a finger, pointer or keyboard focus; reduced
   motion shows the newest result, still; "newest" is the latest start among finished games (the public pages do not
   carry when a score was typed); the reel holds the latest 8 results, every game on now and the next 3 to start; the
   two names share the line evenly so the score never cuts; a new result keeps F's small "New" mark. Restyle or rebuild it in the
   shared chrome, behind the switch. Leave which pages carry it alone; that is Stages 2–3.
3. **`/review` on all of Stage 1's diff** (offer it per CLAUDE.md; it is substantive and touches the shared layout), and
   `/simplify` first if the diff added a new shared abstraction (the helper, the band component).
4. **The QA walk**: one purpose, *"with the preview on, every tournament page wears the new frame and reads on light;
   with it off, nothing changed"*. Make it a checkable Artifact in §406's build, with the next free § in
   `OWNER_QA_LEDGER.md` (grep it first; other sessions add §s). Parts: the four organizers' bands (phone); every page
   readable (phone, then desk); the app bar in a phone browser and inside the installed app (the owner needs both); the
   switch off is today's site; the demo with the switch off. Give it fixtures and a stop check, as §406 and §407 did.
   ⚠ §407's lesson: the walk is the only rendered check, so **ask for a read-back on the steps that write**, and
   compare the server log with the steps the owner ticked before recording a pass.
5. Records: plan §9's Stage 1 row (commit hashes, walk §), the TODO line, and the ledger entry. `/docs` and `/demos`
   wait for Stage 8 (no customer sees this before then).
6. **Then tell the owner Stage 1 is done and that it is a good place to `/clear`.** Next is Stage 2's build prompt (the
   Overview), or Stage 1a's (who owns the look), which can start now because its preview uses the new band. Name both
   and let him choose.

## Not in Stage 1 (say so if a step drifts toward one)
The Overview's new order, the host card, and the ticker leaving the Overview (Stage 2). Schedule controls and day chips
(Stage 3). Standings pinning (D5) and the bracket move (Stage 4). Tabs following what there is (Stage 6). The focused
pay page (Stage 7). The club's rule for its tournaments, "The club's colours" on the Theme card, and the removal of the
Dark/Light option from the Branding page (Stage 1a). Sponsors. Emails and link previews. The app bar on club pages
(§10a: not this project).
