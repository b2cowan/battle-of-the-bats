# The public face, warm — marketing, sign-in and emails — plan

**Status:** WALKED AND DRAWN 2026-10-22 · **ROUND 1 RULED 2026-10-23** (see the rulings below). **Project index** (stages, model per stage, dated log; db-backed, update by data writes): https://claude.ai/artifact/D5ZENgbwc8EjPQFn5MS8uu (source `PUBLIC_FACE_WARM_INDEX.html`). The walk, the ladder, the identity and the end state are one page:
https://claude.ai/artifact/M1ehQVxvLzMiTZfJDMtcft (source `PUBLIC_FACE_WARM_WALK.html`, built from `.probe/pfw/src/` by
`.probe/pfw/build-walk.mjs`). Fourteen asks; nothing is built. `/design` (D1–D13) and `/ux` (U1–U8) ran before the hand-off; their drawn changes are on the page's Checks tab (Ask 12), and the two calls they raised are Asks 13 (where the sign-up wordmark leads) and 14 (one lime per marketing view). **Scope trimmed 2026-10-19:** S2 (sign-in and sign-up)
and the two account emails moved to The first look (`FIRST_LOOK_SIGNUP_PLAN.md`, its Ask 1).
**Order — RULED 2026-10-22 (owner):** it runs **beside Club Tier**, ahead of Platform admin. This answers Q8. Only the
order moved; Q1–Q7 stay recommendations, put to the owner as the walk page's asks.
**PM brief:** `PUBLIC_FACE_WARM_PM_BRIEF.md`.
**Carried in from The first look at its close (2026-10-21; its plan is archived, `docs/projects/archive/FIRST_LOOK_SIGNUP_PLAN.md`):**
the screen-reader pass on the shared account form (`components/auth/AccountForm`), owed since that project's Stage 1.
The first look built the sign-up and sign-in screens and the two account emails this plan handed it; the marketing pages,
the other emails and the system screens stay here.

## The owner's ask (2026-10-19)

*"looks like our public emails and some sign up forms are in our old font/styles. I think we need a project to address
these and also include our public marketing pages. I want the project to do a deep analysis of all of these pages and
given our updates to the portal pages, how can we make the public pages feel more like our new warmer look and feel.
understand that our audience are mainly volunteers or coaches or organizers, likely not very technical people, we want
the app to feel like it is made to run these sports leagues/teams and not a terminal that can look overwhelming for
some people. we want to make users feel comfortable from day 1 and that includes the marketing pages look and feel."*

The owner showed two examples:
- **The "Verify your FieldLogicHQ email" email.** It has a near-black ground, a lime letter-spaced "FIELDLOGICHQ" and
  a lime "Verify Email →" button.
- **The verify-email page.** It has the cream ground but keeps the typewriter font in capitals: "VERIFY EMAIL",
  "FIELDLOGICHQ - ACCOUNT SECURITY", a full-width lime "CONTINUE".

**The bar.** A volunteer, coach or organizer feels on day one that this was made to run their league or team. It must
not look like a terminal. That applies from the first marketing page, through sign-up and the first email, to the
first screen inside.

## What exists (census 2026-10-19, two read-only helpers, key lines re-checked; re-verify at kickoff)

Only two kinds of public place already wear the warm type: the consumer tabs (Home, Scores, Chat, Account) and the
in-app sign-up journey (`/start`, `/coaches/start`).

| Group | Size | Look today | Notes |
|---|---|---|---|
| Marketing site | ~12 routes: `/`, `/pricing`, the four `/for-*` pages, both walkthroughs, `/changelog`, `/demos`, `/see-it-live/switch`, `/pitch/[slug]` | **OLD**: dark ground, mono uppercase | Each page has its own `page.module.css` (29–35 mono uses each). The marketing bar is `components/Navbar.tsx` (mono links). `Footer.tsx` has a marketing skin and a warm skin. The home hero is Barlow 900 with mono eyebrows. |
| Sign-in and account (`/auth/*`) | ~15 routes: login, signup, signup-confirm, forgot/reset, reset-confirm, both invite accepts, suspended, select-org | **RECOLOURED**: warm colours, still mono caps | The warm remap is in `auth.module.css` (~388–400). `.title`, `.sub`, `.submitBtn` and `.form-label` are all mono uppercase (`auth.module.css:45–60`, 71–76, 141–148). The check-your-inbox block (`VerifyEmailSent.module.css`) has three skins. |
| Consumer bar (HOME · SCORES · PRICING · RUN A TOURNAMENT) | 1 component | **RECOLOURED** | `ConsumerNav.tsx` + `ConsumerShell.module.css` (`.topLink` is mono uppercase). |
| Sign-up journey | `/start/*`, `/coaches/start`, the claim link, welcome | **WARM** (consumer skin, not the kit) | Titles are Inter 800 in sentence case, not the portal's Barlow title. Mono only on the kicker. |
| Dark outliers | `/coaches/join`, `/coaches/checkout/complete` | **OLD** | The join page uses `auth.module.css` without the warm wrapper. Checkout-complete uses inline rgba-white + lime. |
| Emails | ~60 templates, no React Email | **OLD** | One envelope, `wrap()` in `lib/email.ts:91`, serves ~44 of 45 builders, the editable platform templates and ~11 marketing campaigns. Separate copies: `lib/notify.ts`, `lib/basic-coach-announcements.ts`, `lib/family-email.ts`. Password reset is fully monospace on `#090d09` (`lib/email.ts:941`). The dues reminder has no ground. The one warm email is the practice plan (`lib/practice-plan-email.ts`). |
| System screens | 404, crash, offline, unsubscribe-confirmed, global-error | 404 and crash RECOLOURED; the rest OLD | The 404 still reads "[DIAGNOSTIC]: ROUTE_NOT_FOUND" (`app/not-found.tsx:18`). |
| Link previews (OG images) | 3 tournament-page images | OLD | Dark `#0A0A12` with an org-colour gradient. There is no image for the marketing site. |
| Public sport pages | ~30 routes under `/[org]` and `/[org]/[t]` | OLD, wearing the org's brand | Mono-heavy (the schedule has 38 uses), no warm tokens. The org's colour and font preset sit over a dark ground. Their light mode is a cool `#F5F7FC`. **A standing rule keeps their colours the org's** (see Q6). |

**What "warm" means today: the portal is the benchmark, so its written rules come first.**
- Body text is Inter.
- Page titles are Barlow Condensed 700 in mixed case.
- Buttons are Inter, sentence case, weight 650.
- Mono only on eyebrows, chips, scores and readouts (rule F2 in `globals.css`).
- The palette is paper `#F8F4ED`, ink `#241E15`, olive `#57651E`.
- Lime never renders as text on paper; it darkens to olive (E3).

## Findings already in hand (each becomes a station or a shape question in the walk)

1. **The terminal feel comes from type and words, not from colour.** The sign-in pages already have warm colours (the
   July recolour), and the owner still read them as a terminal. The causes:
   - the typewriter face set in capitals and letter-spaced;
   - system words like "ACCOUNT SECURITY", "[DIAGNOSTIC]: ROUTE_NOT_FOUND" and "Staff Access".

   Another recolour pass would not fix it (see `reference_on_the_kit_is_not_current_look`). The words are in scope,
   with `/marketing`.
2. **Every customer who forgets a password gets a staff email.** It says "Staff Access" and "your FieldLogicHQ staff
   account", in the most terminal layout we send. The customer forgot-password route and the platform-admin reset
   share one builder (`app/api/auth/forgot-password/route.ts:52`), unless an operator has customised the
   `password_reset` template. **The wording was wrong whatever the look**, so it was fixed on its own: committed
   `eb3f02a3` 2026-10-19 (owner asked). The words now match the template's default and the "Staff Access" line is
   gone. The look stays for this project's email stage.
3. **Family emails come from the club, but they look like us.** They use a dark ground with a blue team-name kicker,
   and the club appears only in the footer: no club logo, no club colour. Every club now has a logo made in its own
   colour (`5ed798fd`), so the material exists. This is a widening of the ask (see Q5).
4. **The email envelope is almost one place.** About 44 builders and the marketing campaigns go through `wrap()`, so
   most of the inbox changes in one edit. The separate copies have to be folded in first. Email cannot read CSS
   variables, so it needs one TypeScript palette. That overlaps the open Codebase Cleanup "Tier 4" residual in
   `TODO.md` (a palette for email/PDF that CSS variables can never reach): fold it in, don't build it twice.
5. **The brand has no written visual identity.**
   - What `BRAND_STRATEGY.md` covers: positioning ("community sport"), voice ("Practical. Direct. Warm.") and
     audience ("not tech buyers").
   - What it never covers: type, colour or the wordmark.
   - What exists only in practice: the wordmark in `components/shared/BrandLockup.tsx` (mono uppercase) and the ">"
     mark (the "cross-shell continuity anchor", `memory/design_decisions.md`). Lime appears as the marketing accent.

   This project should write the visual identity down, with `/marketing` and `/design`, before it restyles anything.
6. **No privacy policy or terms page exists, and nothing links to one.** This is not a look question. It is a trust
   and compliance question for a product that takes sign-ups and family data. It goes to `/strategy` as its own item
   and is recorded here only so the walk doesn't step over it.

## Round 1 rulings (owner, 2026-10-23, the walk page's paste-back)

| Ask | Ruled |
|---|---|
| 1 (Q1) | **A** — supersede "marketing stays dark" (2026-07-23); the whole marketing set moves in one release. |
| 2 (Q2) | **C** — **redraw the wordmark**, as its own piece of work before S4. **Follow-up 2026-10-23 (owner, "yes"): the redraw includes the browser-tab mark (the lime ">", also on the admin and coaches-portal top strips) and the phone home-screen icon (today a separate "FL / HQ" mark on a dark square, `public/icons/pwa-*.png`).** |
| 3 | **A** — the public type rules P1–P10 as drawn, with one named exception: a marketing page's headline, one per page, Barlow 700, 64px desktop / 40px phone. Scroll-reveal comes out (P6). |
| 4 (Q3) | **A** — a `/marketing` voice pass in every stage, before its code. |
| 5 (Q4) | **B** — the marketing pages are **always warm**, whatever the setting. |
| 6 (Q5) | **A** — family emails wear the club's identity on the warm envelope. |
| 7 (Q6) | **A** — the public tournament pages' type is its own project, joined with Tinted Panel Retirement D4. |
| 8 (Q7) | **A** — one warm share card for the marketing site, plus a title and description on every marketing page (S4). |
| 9 | **A** — split: S3a before Club Stages 9 and 12 begin; S3b with 7c's follow-up. |
| 10 | **A** — a build guard on P1 as written. |
| 11 | **A** — S1 → S3a → S4 → S5 → S3b. |
| 12 | **A** — the design and flow checks' drawn changes, all accepted. |
| 13 | **A** — on the sign-up steps, signed out, the wordmark leads to the marketing home page. |
| 14 | **A** — the page's own lime wins: the bar's Get started is white on a page with its own lime; Pricing's one lime is on Tournament Plus. |
| Follow-up to Ask 5 (owner, 2026-10-23) | **Signed out = warm, on every signed-out page.** Signing out resets that browser to warm; a person who chose Dark gets it back when they sign in (it is saved to their account). Owner: *"people who like dark themes don't need it every second of every day and surely understand signed out means they don't get to view their theme choices."* Why: a signed-out visitor has no Warm / Dark control, and signing out left the Dark choice in the browser, so on a shared device the next person's first impression (sign-in, sign-up, Home, Scores) was dark. Not affected: the public tournament pages, whose light or dark is the organizer's per-tournament choice. **Mechanism, owner at build 2026-10-23 ("keep the saved dark on the device but make sure it doesn't impact the signed out pages"):** sign-out clears NOTHING; the device keeps its saved Dark and a browser with no session cookie simply isn't shown it (the pre-paint script, the offline page and a root auth watcher for a session that ends mid-page). This replaced the first reading ("clear the browser's value at sign-out"), which would have lost Dark in the coaches portal, admin and volunteer shells, since only the consumer shell restores it from the account. Built 2026-10-23, committed `176f45ce1`; **walk ✅ PASSED 2026-10-23 (owner, 16 of 17: A–E all pass, F's tournament-page check passed, its "Skipped" twin unused; ledger §364).** **Signed-out surfaces that stay dark after this project (owner, 2026-10-23):** the public tournament pages (organizer's choice, dark by default), the tryout scorer (dark by design) and the platform-admin sign-in, which is left to the platform-admin project. Marketing goes warm in S4; 404, crash, global-error, offline and unsubscribe in S5. |

**W ruled (owner, 2026-10-23): "ok let's forget it, I want to go ahead with your proposal"**, said of the refinement page (https://claude.ai/artifact/9xDNVQyR3wJRcf7hCgiDBr) after declining a drawing of the F and L disconnected. Taken as its seven asks as recommended (the owner may correct any one): **1 A** the refined Joined FL (rounded shoulder, even corners, the 16 px cut evened); **2 A** corners as drawn; **3 A** olive leads (olive tile, paper mark), lime only on actions; **4 A** a few informal reactions ("what letters do you see?" first), not a gate; **5 A** the carried-forward list kept whole (email as Arial text, no lime in the page mark, one release with S4, the strips take the lockup, a What's new line, P1/P9 move at S4, a name and logo search before print); **6 A** the bare mark beside the name, the tile only alone; **7 A** one mark at every size. Round 1's pennant, tag and clipboard did not sell it (owner); Codex's second opinion picked Joined FL. Spec: `docs/agents/brand/VISUAL_IDENTITY.md` §4.

**Open from these rulings (to settle when each is drawn or built, not ruled here):** the signed-out reset ships **on its own, ahead of S1** (owner, 2026-10-23: "agreed"; build prompt `PUBLIC_FACE_WARM_SIGNED_OUT_BUILD_PROMPT.md`); Ask 2 C needs its own drawing session before S4 (the wordmark, the browser-tab mark and the home-screen icon, drawn together). Ask 5 B drops the "Home in Dark" frame and U6's "browser-bar
colour follows the setting" becomes a fixed warm colour on the marketing pages.

## Shape questions to put to the owner in the walk (recommendations, not rulings)

- **Q1 — The ruling this replaces.** `memory/design_decisions.md` 2026-07-23 says "Marketing pages … stay dark by
  design".
  - *Its reasons:* dark was the platform default when it was written, and the marketing pages move as one set
    (S1-2, 2026-07-20).
  - *Today:* warm became the default on 2026-07-22.
  - *Recommended:* supersede it, and keep its second reason by moving the **whole marketing set together**, never one
    page at a time.
- **Q2 — The wordmark.**
  - *Options:* keep the mono uppercase "FIELDLOGICHQ" lockup and the ">" mark as the logo, or redraw it.
  - *Recommended:* keep both. They are the recognition anchor, and R1-4 kept them. Soften everything around them.
    Lime stays as the accent: ink-on-lime buttons, never lime text on paper.
- **Q3 — Words.** A voice pass on every public screen and email: no system words, and buttons that say what happens
  next. `/marketing` owns it.
- **Q4 — Warm / Dark on public pages.**
  - *Options:* always warm, like the sign-up journey, or follow the setting, like sign-in.
  - *Default either way:* a signed-out visitor has no setting, so they get warm.
  - *Recommended:* follow the setting, so someone who chose Dark is not flashed by a bright marketing page after
    signing out.
- **Q5 — Family emails.**
  - *Options:* our warm look, or the club's identity (logo + colour) on a plain warm base with FieldLogicHQ in the
    footer.
  - *Recommended:* the club's identity. The standing rule that an org's brand wins on org-branded pages (TH-1/M2)
    already points that way, and a parent should recognise their club.
- **Q6 — Public tournament and club pages (~30, mostly read by families).**
  - *The standing rule:* R1-2 and M2 keep their colours the org's: "walking into the venue".
  - *Recommended:* leave the colours alone and walk the **type** anyway. A schedule in a typewriter face in capitals is
    the same problem in the org's colours.
  - *To decide:* whether the type change is a stage here or its own project. It overlaps Tinted Panel Retirement D4's
    "second wave" (`TODO.md`).
- **Q7 — Link previews.** A marketing-site share image, and the tournament previews in the same voice.
- **Q8 — Order. RULED 2026-10-22 (owner):** beside Club Tier, ahead of Platform admin.

## Coordination (in flight on 2026-10-19; re-check at kickoff)

- **Account-first sign-up** is closed and archived (2026-10-19, `docs/projects/archive/ACCOUNT_FIRST_SIGNUP_PLAN.md`).
  Its sign-up screens' look and shape continue in **The first look** (`FIRST_LOOK_SIGNUP_PLAN.md`), which now owns
  this project's S2 (see the ladder below). Its public type rules feed S1 here.
- **Verify every sign-up** owns the verify email template and kept its dark layout on purpose. Its walk is merged into
  §336.
- **Feedback window** ask A1 (public pages wear the coach window on the Warm / Dark setting) is with the owner.
- **Club Tier Stage 4 / Stage 8** touches `/for-clubs` copy and runs a marketing drift check. Since the 2026-10-22
  ruling this project runs beside it: S4 changes the look and keeps today's words; Stage 8 changes "Coming soon" when
  Club goes on sale, as a separate copy change.
- **Demos.** ~~Marketing pages are tour destinations~~ — **corrected 2026-10-22:** no marketing page is a tour
  destination. The guard (`tests/unit/demo-destinations-guard.test.ts`) checks product screens and the `/see-it-live`
  door only, so restyling the marketing set cannot break a tour. The layout sweep's public list
  (`scripts/layout-screens.mjs`) covers the marketing set. The `/demos` cycle after the release curates the story.
- **Stage 13 (Club Tier, navigation across the three portals)** covers the operator navs only (its inventory: sidebar,
  phone bar, More sheet, top strip). The public bars' lettering is this project's (P1 below). Only the **crossing** — a
  signed-in visitor's "Open app" door from the marketing bar into a portal — is "coordinate with Stage 13".
- **Club stages that add or change emails (verified 2026-10-22 against `CLUB_TIER_PRODUCTION_READINESS_PLAN.md`):**
  Stage 9 (house league: seven league templates, the injection fix, "communications silently email nobody"), Stage 12
  (12a's receipt "in the club's name"), 7c's open follow-up (the house-league season email onto the batched sender).
  None has started except 7c. Recommendation (Ask 9): S3a before Stages 9 and 12 start; S3b with 7c's follow-up.
- **Help.** The help articles quote sign-in screen wording. Run `/docs` on each stage that changes it.
- **Spelling and time gates** (`check:spelling`) apply to every word and time this project writes.
- **The top-bar pills (handed over by the Admin type sweep, owner P1 2026-10-19).** The Workspaces pill and the
  public-site / flip pill moved to the body face, sentence case, on the admin and coaches-portal bars only. Where the
  same pills render on the PUBLIC bars (the marketing `Navbar`, the public tournament pages' flip pill, the consumer
  bar `ConsumerNav`) they still wear the nav-label lettering (`--nav-label-*`, data face, caps), as do those bars' own
  links. This project moves that whole idiom on the public bars at once, pills included, so the two bars agree again.
  Owner's design log entry 2026-10-19 ("THE BRACKET EDITOR'S CARD IS A REAL FORM…", P1).

## Proposed shape (the deep-dive method: walk, then stages)

0. **Session 1 (one hub artifact):**
   - **The measured walk.** Stations in the order a newcomer meets them: marketing home → pricing → a `/for-*` page →
     the sign-up door → the verify email (in a real inbox, light and dark mail apps) → the verify page → sign in →
     welcome and invite emails → forgot password → a family email → the 404 and offline screens. Each station shows
     *as built*, *my read* and its shape question.
   - **Standing back:** the public type rules that cut across every station.
   - **The stage ladder.**
   - **The end state drawn** at true size, tagged by stage: one proposal per surface, never today's look (feedback
     memory `feedback_deep_dive_is_walk_then_stages`).
1. **Provisional ladder (the walk decides it):**
   - **S1 — The written identity and public type rules.** `/design` + `/marketing`: type, case, colour, the wordmark,
     the voice. Small, and it lands with the drawing.
   - **S2 — Sign-in and sign-up. → MOVED to The first look (owner, 2026-10-19, its Ask 1).** `/auth/*`, the
     check-your-inbox block, `/coaches/join`, checkout complete and the consumer bar are reviewed there as one journey
     (`FIRST_LOOK_SIGNUP_PLAN.md`, hub https://claude.ai/artifact/AdLSGDCii8xExFuVdZxvsx), together with the
     verification and password-reset emails. The first look also writes the public type rules this project's S1 starts
     from, and rules that the consumer bar and phone tabs go to sentence case (its Ask 13).
   - **S3 — Emails.** One palette, with every builder and copy folded in. Covers the family email (Q5), the words pass
     and a test across Gmail, Apple Mail and Outlook in light and dark. **The warm envelope itself is built once by The
     first look** (its Stage 2, for the two account emails); S3 moves the other builders onto it rather than designing a
     second one.
   - **S4 — The marketing site, as one set.** The marketing bar, the footer, home, pricing, the four `/for-*` pages,
     the walkthroughs, `/demos` and the changelog.
   - **S5 — System screens and link previews.** 404, crash, global-error, offline, unsubscribe and the OG images.
   - **S6 (if Q6 rules it in) — The public sport pages' type.**
2. Each stage is drawn, ruled, built and walked by the owner.

### The build order and the recommended model per session (2026-10-23)

| # | Session | Model · effort | Why |
|---|---|---|---|
| 0 | Signed out = warm (build; prompt `PUBLIC_FACE_WARM_SIGNED_OUT_BUILD_PROMPT.md`) — **DONE: committed `176f45ce1`, walked ✅ 2026-10-23** | Sonnet · high | small and fully specified, but it touches the pre-paint script and every sign-out path |
| S1 | The identity written + the public type rules + the build check (build) | Sonnet · high | the doc is transcription of ruled rules; the check needs care to avoid false alarms |
| W | The wordmark, the browser-tab mark and the home-screen icon (drawing session, with `/marketing` + `/design`) | Opus · high | design judgment; the owner rules on the drawings |
| S3a | One email envelope for every email (build) | Sonnet · high | broad but mechanical (~50 builders onto one envelope); mail-client quirks |
| S4 | The marketing set as one (build), with the new identity everywhere | Sonnet · high | large restyle to approved drawings; W ruled 2026-10-23, its identity package rides this release (ladder row) |
| S5 | System screens + carry-ins (build) | Sonnet · medium | small screens, drawn and worded |
| S3b | Family emails in the club's name (build) | Sonnet · high | per-club colour contrast and logos in email; coordinated with Club 7c. **BUILT and committed `4c5607f62` 2026-10-23; walk §370 https://claude.ai/artifact/RmRhobxq1Cue6zbd5sU3fr ✅ PASSED 2026-10-23, 21/28 (skips: one in A, one in D, five optional in F); Club 7c's one-email-per-child follow-up not landed, untouched.** |
| — | Tournament pages' type (its own project: walk + drawing first) | Opus · high | a new walk and drawing for families' pages |

Writing each stage's build prompt: Opus · medium. Each build ends with `/review` (which tiers its own models) and a checkable walk.

### The ladder as drawn (2026-10-22; order RULED 2026-10-23, Ask 11: S1 → S3a → S4 → S5 → S3b; the wordmark redraw, Ask 2 C, before S4)

| Stage | Covers | Waits for |
|---|---|---|
| **S1** Identity + public type rules (P1–P10 on the walk page) + the build guard (Ask 10) | the written identity in `docs/agents/brand/`, pointed at by `/marketing` and `/design` | nothing. **Built, commit `7bba2136d` 2026-10-23** (`VISUAL_IDENTITY.md`; `npm run check:public-type`, whose `--report` is the to-do list for S3a, S4 and S5) |
| **S2** Sign-in and sign-up | closed: The first look, on production 2026-10-20, archived 2026-10-21 | — |
| **S3a** One envelope for every email | `wrap()` (~44 builders + campaigns) and the five copies (`notify.ts`, `basic-coach-announcements.ts`, `family-email.ts`, `dues-reminder-email.ts`, `practice-plan-email.ts`) onto `lib/email-envelope-warm.ts`; one email palette (Codebase Cleanup Tier 4's email half). **Keeps today's wordmark line** (W ruled: the new name line is Arial text, and S4 changes that one line, so nobody sees two identities) | nothing; ahead of Club Stages 9 + 12. **Build prompt written 2026-10-23: `PUBLIC_FACE_WARM_S3A_BUILD_PROMPT.md`**. **Built, commit `26f5bdb0c` 2026-10-23** (walk §365: https://claude.ai/artifact/ACp5eK1KrLf1eoFnYWYREw; copy pass `PUBLIC_FACE_WARM_S3A_EMAIL_COPY.md`) |
| **S3b** Family emails in the club's name (Q5) | announcement, dues reminder, club schedule mails, basic coach announcement | Club 7c follow-up; feeds Stage 12's receipt; the contact-email TODO item. **RULED 2026-10-23: all nine asks as recommended (owner). Words: `PUBLIC_FACE_WARM_S3B_COPY.md` (ruled by `/marketing`; two lines To confirm). Build prompt written 2026-10-23: `PUBLIC_FACE_WARM_S3B_BUILD_PROMPT.md` (Sonnet high). Order: Club 7c's one-email-per-child follow-up is its own small stage BEFORE S3b (Ask 8 A); its prompt is not written yet.** **Drawn 2026-10-23 (the asks below were ruled the same day):** https://claude.ai/artifact/Q77tjshN7iDMf4hGMM9HS5 (source `PUBLIC_FACE_WARM_S3B_DRAWINGS.html`). Every family email (14: five on the shared sender, the dues reminder, the tryout receipt, seven registration mails) today and proposed: a club-coloured band with the club's name in text, a logo-or-initials tile and an accent rule, FieldLogicHQ as a quiet line at the foot, one reply line. Census corrections found: the dues sweep reads the club through the digest-teams read (name and short address only); `Organization.contactEmail` is always empty (the club's contact is the public site's); the "does not process online payments" line is in a coach-facing tournament email, not a family one; only 2 of 14 family emails set a Reply-To. `/design` and `/marketing` applied before the hand-off (phone band was inset by a padding rule; the club name repeated three times; the foot was four equal blocks; words: "Sent through FieldLogicHQ, the software {club} uses.", "Replies to this email won't reach anyone…"). Asks: 1 sender name "{Club} via FieldLogicHQ", 2 band with logo on a white tile (PNG/JPEG only), 3 which emails wear it, 4 where a reply goes, 5 registration mails name the club, 6 dark mode, 7 free-tier and "View" email stay, 8 7c's one-email-per-child as its own stage first, 9 sentence-case headlines and no arrow. Real-client check (Gmail, Apple Mail, Outlook, light and dark) is owed on the build's walk. |
| **W** The wordmark, the browser-tab mark, the home-screen icon (Ask 2 C) | **RULED 2026-10-23: the refined Joined FL, olive leads (see "W ruled" under Round 1 rulings; spec in `VISUAL_IDENTITY.md` §4). Ships with S4.** Refinement drawn 2026-10-23: https://claude.ai/artifact/9xDNVQyR3wJRcf7hCgiDBr (`PUBLIC_FACE_WARM_W_REFINEMENT.html`): Codex's Joined FL (second opinion, `PUBLIC_FACE_WARM_W_CODEX_OPINION.md`; olive leads, lime for actions) beside a refined version (rounded shoulder, even corners, 16 px cut evened); `/design` applied; the owner leans to Joined FL, not yet ruled. **Round 1 drawn 2026-10-23, did not sell it (owner):** https://claude.ai/artifact/8uYWkfYNjdTz6bUjq8Agtv (source `PUBLIC_FACE_WARM_W_DRAWINGS.html`). Three directions (A the tag, B the pennant, C the clipboard), each in nine places; recommends B; nine asks; `/design` (D1–D14) and `/marketing` (M1–M10) applied before the hand-off (the pennant redrawn after it read as a golf flag; the chat's flag-shaped Report icon is Ask 9; a name/logo search is owed before commit). Census found four marks, not three (the ">" is also the notification badge), the "FL" icon also on push pictures and every export, and ~10 copies of the name. Routed: the club site installs with our icon, not the club's (Club Tier, public site builder) | the owner's ruling; must be ruled before S4 |
| **S4** The marketing set as one | bar, footer, Founding strip, 13 routes, share card + titles/descriptions, the tournament strip + flip pill lettering, scroll-reveal out, the `/start` chooser leftovers (moved from S5 by `/ux` U2), the phone browser-bar colour following the setting (U6). **Plus the ruled identity (W, 2026-10-23), shipped in this same release, everywhere at once** (spec: `docs/agents/brand/VISUAL_IDENTITY.md` §4; geometry from `PUBLIC_FACE_WARM_W_REFINEMENT.html`): (1) the artwork, made first and swapped in only at release: tab icon (16 px cut + main cut, NEW file name so caches refetch, plus the `.ico`), iPhone full-square icon, Android "any" + maskable (separate files), the push badge (from the 16 px cut) and the push large-icon default, the export mark (`lib/export/brand-mark.ts`); (2) the manifest and root head: launch/background and theme colours off near-black; (3) ONE shared wordmark component replacing the ~10 copies (marketing bar, consumer bar + tournament strip, footer, `BrandLockup` in the admin and coach strips, the volunteer check-in and scorekeeper shells, platform-admin sign-in if in scope, `public/offline.html`, the unsubscribe page, the old email header copies); (4) the email name line (Arial text, no image; S3a leaves today's line); (5) the marketing share card with the tile; (6) P1 and P9 in `VISUAL_IDENTITY.md` rewritten, the `wordmark` role in `check:public-type` retired, and the first-look email test that pins Courier updated; (7) a What's new line about the new home-screen icon. | `/marketing`'s words (**written 2026-10-23: `PUBLIC_FACE_WARM_S4_COPY.md`**); **build prompt written 2026-10-23: `PUBLIC_FACE_WARM_S4_BUILD_PROMPT.md` (two parts, one release)**; "Open app" crossing → Stage 13; **the name/logo search: CLOSED by the owner 2026-10-23** (Canada only (owner). The Canadian trademarks database was searched for the word: "fieldlogic", "field logic", "fieldlogix", "field logix", "logic hq" and "fieldhq" each returned no results (database current to 2026-10-21). No logo (design-mark) search, no search outside Canada and no trademark agent's opinion were done; the owner closed the item there.) · **BUILT 2026-10-23: Part A committed `a2d8726c`, Part B committed `a9f154e8`** (owner rulings at build: the four `/platform/*` pages retired; the 14-row label list approved; the platform-admin sign-in takes the lockup). Walks: A https://claude.ai/artifact/YJTw1dC4Ny11xTjg2zdQH8 (ledger §367), B https://claude.ai/artifact/5TyMKPtZADGy6zu11tyhYe (§368). **Owed:** both walks; the What's new line to `/release` at promote (drafted: "FieldLogicHQ has a new look and a new mark. If you added the app to your iPhone home screen, remove it and add it again to see the new icon."); the whole-product layout sweep on staging (the shared stylesheet changed). Never promote A without B. |
| **S5** System screens + carry-ins | 404, crash, global-error, offline, unsubscribed, suspended, the neutral share-card fallback, the install banner off the sign-up steps (U7), the AccountForm screen-reader pass | nothing. **Drawn 2026-10-23, RULED the same day: every one of 11 asks as recommended and all 9 `/design` drawing changes** (drawings https://claude.ai/artifact/Jshmg1RJSYXn5VzJM9yiGj, source `PUBLIC_FACE_WARM_S5_DRAWINGS.html`; words `PUBLIC_FACE_WARM_S5_COPY.md`, ruled by `/marketing`; build prompt `PUBLIC_FACE_WARM_S5_BUILD_PROMPT.md`, Sonnet medium). Rulings: the 404 button goes to Home for everyone; a tile on all six; the root crash is paper for everyone; "Go to Home" beside "Try again"; both crash screens switch to `retry()`; the offline words say only what is true; one unsubscribe sentence true for all three opt-out kinds; the "not affected" note comes off until confirmed; the suspended page has no lime button; the neutral card is name + tile. Findings: F1 `reset()` does not re-fetch, F2 offline promises untrue, F3/F4 unsubscribe one message for three cases and our failure reads as a bad link, F5 suspended reaches only people with no active workspace (own plan, not S5), F6 neutral card is a hand-set dark name, F7 unsubscribe is a Dark island. **Built 2026-10-23** from `PUBLIC_FACE_WARM_S5_BUILD_PROMPT.md` (Sonnet), COMMITTED `2e205823d` 2026-10-23 (not pushed); one shared screen component for the 404, page crash, unsubscribe and paused page; the root crash and offline page are separate copies by necessity; service worker cache v12; one shared font loader for both share cards; the two carry-ins done. Walk §369 owed: https://claude.ai/artifact/ADXYmisRhMF8NGciFR4iFe. |
| **S6** Public sport pages' type | recommended as its own project with Tinted Panel Retirement D4 (Ask 7) | S4 |

**Census re-verified 2026-10-22** (helpers + key lines opened; walk page, station by station). Changes since 10-19:
`/auth/*` WARM except `suspended` (the last reader of `auth.module.css`); `/coaches/join` and checkout-complete WARM (no
longer outliers); the consumer bar's links WARM, its tournament `.topbarStrip` + the flip pill still caps; the `/start`
chooser keeps four mono leftovers; emails: 2 warm, ~44 on `wrap()`, 5 own copies (the practice plan is its own copy,
not the warm envelope); link previews: 6 images now (3 club cards added 2026-10-21), still none for marketing; the home
page hides four sections until scrolled (`AnimateIn`, home only). Unchanged: the marketing set (13 routes) and the
system screens.

**Routed, not built here (2026-10-22):** to `/marketing` — the home description's "Canadian sports organizations"
(brand rule) and `PRICING_PAGE_COPY.md:477`; the doubled Pricing title; the house-league card's "automated game
notifications" line against Stage 9's defect list; the registration email's "FieldLogicHQ does not process online
payments" before Stage 12; the Premium welcome's "Everything from your free portal carries over" (`lib/email.ts:638`, most new
Premium coaches never had one); the "FieldLogicHQ · Canada" sign-off (`lib/email.ts:1405`, `lib/email-sender.ts:58`: brand
rule, and a thin CASL mailing address); whether a free team gets a welcome email (+ `/strategy`); two copy tweaks for the
first look's check-your-email and Continue screens (`/ux` U5). To `/strategy` — finding 6 (no privacy or terms page). To `/design` — the first look's
fainter-than-3:1 field edges (every Warm field), which is product-wide.
3. **A build guard proposed at kickoff (owner's call):** a public page that sets a heading in the mono face fails the
   build, the same way the spelling and time gates work.

## Success looks like

- A non-technical volunteer moves from the marketing home to their first screen inside and never meets a typewriter
  heading, a system word or a dark island.
- Every email we send wears one warm envelope. A family email is recognisably from the family's club.
- The visual identity is written down once, and `/marketing` and `/design` both point at it.
- The owner has walked every stage.
