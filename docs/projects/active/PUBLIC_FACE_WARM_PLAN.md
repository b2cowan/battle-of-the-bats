# The public face, warm — marketing, sign-in and emails — plan

**Status:** QUEUED 2026-10-19 (owner). Not started, nothing drawn.
**Starts:** owner, 2026-10-19: *"after the club tier readiness or platform admin projects finish"*. **To confirm at
kickoff:** whether it runs after Club Tier and ahead of (or beside) Platform admin, or after both. **Recommended: right
after Club Tier, ahead of Platform admin.** Platform admin's own brief puts internal tooling behind "the projects
customers will see" (`PLATFORM_ADMIN_SUPPORT_CONSOLE_PM_BRIEF.md`). This project is the first thing every new customer
sees, so the same reason puts it first.
**PM brief:** `PUBLIC_FACE_WARM_PM_BRIEF.md`.

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
- **Q8 — Order.** See **Starts** above.

## Coordination (in flight on 2026-10-19; re-check at kickoff)

- **Account-first sign-up, Parts 2–3** (`ACCOUNT_FIRST_SIGNUP_PLAN.md`) will rebuild the sign-up door, `/start`, the
  resend link and `/coaches/start` **before** this project starts.
  - *Their side:* build on today's shared styles and invent no third look.
  - *This project's side:* restyle what they leave.
  - *Do not* restyle their screens mid-build.
- **Verify every sign-up** owns the verify email template and kept its dark layout on purpose. Its walk is merged into
  §336.
- **Feedback window** ask A1 (public pages wear the coach window on the Warm / Dark setting) is with the owner.
- **Club Tier Stage 4 / Stage 8** touches `/for-clubs` copy and runs a marketing drift check. This project starts
  after it.
- **Demos.** Marketing pages are tour destinations, and the build fails if a tour anchor disappears. Keep anchors, or
  move them in the same change. The `/demos` cycle after the release curates the story.
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
   - **S2 — Sign-in and sign-up.**
     - Covers: `/auth/*`, the check-your-inbox block, `/coaches/join`, checkout-complete and the consumer bar.
     - Timing: after Account-first lands.
   - **S3 — Emails.** One warm envelope and one palette, with every builder and copy folded in. Covers the family email
     (Q5), the words pass and a test across Gmail, Apple Mail and Outlook in light and dark.
   - **S4 — The marketing site, as one set.** The marketing bar, the footer, home, pricing, the four `/for-*` pages,
     the walkthroughs, `/demos` and the changelog.
   - **S5 — System screens and link previews.** 404, crash, global-error, offline, unsubscribe and the OG images.
   - **S6 (if Q6 rules it in) — The public sport pages' type.**
2. Each stage is drawn, ruled, built and walked by the owner.
3. **A build guard proposed at kickoff (owner's call):** a public page that sets a heading in the mono face fails the
   build, the same way the spelling and time gates work.

## Success looks like

- A non-technical volunteer moves from the marketing home to their first screen inside and never meets a typewriter
  heading, a system word or a dark island.
- Every email we send wears one warm envelope. A family email is recognisably from the family's club.
- The visual identity is written down once, and `/marketing` and `/design` both point at it.
- The owner has walked every stage.
