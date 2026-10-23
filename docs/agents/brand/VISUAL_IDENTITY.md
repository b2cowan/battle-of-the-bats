# FieldLogicHQ Visual Identity — the public face

**Written 2026-10-23** (The public face, warm: S1). This is the one place the public look is written down: type,
colour, email, the wordmark, and how it sounds. `/marketing` and `/design` both point here.

**How to use it.** This document holds the *rules* and the *names of things*. It holds almost no values. Every value
has one home (named beside it), and a value restated here would drift from that home, which is how the brand docs
came to cover positioning, voice and audience and never type, colour or the wordmark. When a value and this document
disagree, the home wins and this document is the one that is wrong: fix it.

- **Voice, positioning, audience:** `BRAND_STRATEGY.md` (this folder). This document does not repeat it.
- **Where the rules came from:** the first look's written type rules (`docs/projects/archive/FIRST_LOOK_SIGNUP_PLAN.md`,
  rules 1–8), extended from the sign-up screens to the marketing site, the emails and the system screens. The walk, the
  drawings and the rulings (Asks 1–14) are in `docs/projects/active/PUBLIC_FACE_WARM_PLAN.md`; the drawn specimens are on
  the walk page (https://claude.ai/artifact/M1ehQVxvLzMiTZfJDMtcft, "The identity" and "End state drawn" tabs).
- **What holds the rules in code:** `npm run check:public-type` (rule P1, below). Its report is the list of what is left
  to restyle.

---

## 1. Type

### The faces

| Face | Job | Variable |
|---|---|---|
| **Barlow Condensed**, 700, sentence case | every heading (P2) | `--font-display` |
| **Inter** | every sentence, label, button, link and eyebrow | `--font-sans` |
| **IBM Plex Mono** | the wordmark, a plan chip, and real data — nothing else (P1) | `--font-data` (`--font-mono`) |

Email cannot load our fonts. It uses Arial and Helvetica, and Courier New for the wordmark (see §3).

### The public rules, P1–P10

Owner ruling 2026-10-23 (Ask 3 A), carried over as ruled.

| Rule | What it says |
|---|---|
| **P1 · The typewriter face is for the wordmark, a plan chip and real data** | Never a sentence, a label, a button, a heading or a navigation link. (Scores and records on the sport pages are data, so R1-4 keeps them. That belongs to Q6's project.) *Q6 was ruled Ask 7 A: the tournament pages' type is its own project, §6.* |
| **P2 · One heading face** | Barlow Condensed 700, sentence case. A page has one face for its headings. |
| **P3 · Sentence case wherever a person reads** | The only capitals are the eyebrow line (Inter 600 12, letter-spaced, olive: the first look's step line, coloured) and a plan chip. |
| **P4 · A button says what happens** | Inter 700, sentence case, 48px, lime fill with ink text, 10px corners, no arrow. One lime button per view. Secondary: white with an edge. A text link is olive. |
| **P5 · Paper by default, Dark by choice, no dark island** | The public face follows the visitor's Warm / Dark choice and is warm without one. Lime is a fill, never text on paper (E3). *Superseded in part by Ask 5 B and its follow-up, see §2.* |
| **P6 · Complete when it loads** | Nothing waits for a scroll to appear. A screenshot, a slow phone and a skimming reader see the whole page. |
| **P7 · Every page says what it is when shared** | A title, a description and a share card. |
| **P8 · No system words** | Say what happened and the way forward, in one sentence each. |
| **P9 · One wordmark** | FIELD ink · LOGIC olive · HQ dim, IBM Plex Mono 700 (Courier New in email, which cannot load our fonts). On dark: FIELD white · LOGIC lime · HQ dim. |
| **P10 · One email envelope** | The warm envelope the first look built. A family email adds the club's identity to it (Q5) and never replaces it. |

**Rulings that sit on top of the table** (all owner, 2026-10-23, in the plan's "Round 1 rulings"):

- **Scroll-reveal comes out (P6).** This is a rule here; removing it from the home page is S4's work.
- **The marketing headline is one named exception to the ladder** (Ask 3 A). See "The headline" below.
- **The wordmark is being redrawn** (Ask 2 C). P9 describes today's. See §4.

### The headline: one named exception

A marketing page's headline is **one per page**, Barlow Condensed 700, sentence case, at a desktop size and a smaller
phone size. It is larger than any step of the type ladder, so it is a *named exception* to it, the way the first look's
first-run page heading is (its Ask 12). **It mints no ninth ladder token.** Its two sizes are written once, in the
ladder's comment in `app/globals.css` (the second named exception), and S4 gives them one shared rule. Nothing else on a
marketing page borrows them.

### The ladder, by name

The sizes are the portal's own: `--type-display`, `--type-figure`, `--type-title`, `--type-heading`, `--type-body`,
`--type-support`, `--type-label`, `--type-token`, all defined, with their reasons, at the top of `app/globals.css`. The
steps are named for the job each does, never for a size, so **do not copy a pixel value out of the stylesheet into a
page, an email or this document: name the step.** The drawn specimens set a section heading on the display step and a
card title on the title step; everything smaller takes the step whose job it is (`globals.css` says what each is for).

### How P1 is held

`npm run check:public-type` (`scripts/check-public-type.mjs`) counts three things on the public surfaces: the typewriter
face, forced capitals and 800/900 weights. It works as a ratchet: a surface not yet restyled keeps today's count and can
only go down, and a file with no baseline holds none. An allowed place says which role it is, with a `type-ok: <role>`
comment on the line or the one above:

| Role | May carry | From |
|---|---|---|
| `wordmark` | the face, capitals | P9 |
| `plan chip` | the face, capitals | P1 |
| `eyebrow` | capitals (never the face; the public eyebrow is Inter) | P3 |
| `data` | the face (a figure or code read as data) | P1 |

No role allows a heavy weight. Scope and the full rules are in the script's header. Org-branded tournament and club
pages, the admin and the coaches portal are not on its list (§6).

---

## 2. Colour

The public face is **paper by default**. Its colours are the portal's warm tokens, the `--home-*` family, defined in
the warm blocks of `app/globals.css` (the coaches portal's copy; it holds every token below, the lime pair included)
and, for the consumer shell, `components/consumer/warmTheme.module.css`. Use the token, never the hex.

| Token | What it is for |
|---|---|
| `--home-paper` | the page ground |
| `--home-card` | a card or panel lifted off the paper |
| `--home-ink`, `--home-ink-soft` | text: the main ink, and running text |
| `--home-dim` | fine print and meta text; the quietest ink that still passes contrast |
| `--home-line`, `--home-line-strong` | hairlines and edges |
| `--home-fill` | the ground of a chip or a quiet control |
| `--home-olive` (and `-soft`) | links, accents, the middle of the wordmark |
| `--home-lime`, `--home-lime-ink` | a button's fill, and the ink that sits on it |
| `--home-live` | something happening now |
| `--home-shadow` | a card's lift |

**E3 — lime is a fill, never text on paper.** Raw lime on a pale ground cannot be read, so as text it becomes olive.
Lime appears as a button fill with ink text, as a chip ground, and on Dark as the wordmark's middle. (The rule's origin
is the E3 comment on the warm block in `app/globals.css`.)

**Warm and Dark on the public face** (owner rulings 2026-10-23, Ask 5 B and its follow-up; they supersede the second
sentence of P5):

- **The marketing pages are always warm.** There is **no Dark version of the marketing pages**, whatever the visitor's
  setting, and no "Home in Dark" frame.
- **Every signed-out page is warm.** A signed-out visitor has no Warm / Dark control, so signing out resets that
  browser to warm, and a person who chose Dark gets it back when they sign in (the choice is saved to their account).
  The public tournament pages are the exception: their light or dark is the organizer's per-tournament choice.
- **Signed in**, the person's own Warm / Dark choice applies, as it does in the portals.

Org-branded pages wear the org's colours, not these (§6).

---

## 3. Email

Email cannot read CSS variables, cannot load our fonts and cannot know Warm or Dark, so its values live in one place:
**`WARM_EMAIL` in `lib/email-envelope-warm.ts`** (colours and the font stack), with the envelope's pieces (`WARM_EMAIL_STYLE`,
the heading, paragraph, button and document builders) beside it. **Do not copy a hex out of that file into a builder:**
import the constant. The email palette is the email half of Codebase Cleanup's open "Tier 4" (a palette CSS variables can
never reach), so it is built once, there.

- **One envelope (P10).** The verification and password-reset emails wear the warm envelope today. Every other email is
  on the old dark card, or on one of five separate copies of it, until S3a moves them across. S3a moves them onto
  the envelope; it does not design a second one.
- **Family emails wear the club's identity on the warm envelope** (owner, Ask 6 A, 2026-10-23). A parent should
  recognize their club: its logo and colour join the warm envelope, FieldLogicHQ stays in the footer, and the envelope is
  never replaced. S3b builds it, with the club-contrast and logo-in-email questions that come with it.
- **The wordmark in email is Courier New, three inks** (P9), because email cannot load Plex Mono.

---

## 4. The wordmark and the marks

**Current state (shown for reference; it is being redrawn).** The wordmark is FIELD · LOGIC · HQ in the typewriter face
in three inks (P9). Today it exists in five slightly different versions: the marketing bar's, the consumer bar's
(the three-ink one the first look shipped), the footer's, the emails' on the old card (lime capitals, spaced), and the
unsubscribe page's (spaced). The lime ">" chevron on a dark square is the browser-tab mark and the admin and coaches-portal top
strips' mark, and the phone home-screen icon is a separate "FL / HQ" mark on a dark square (`public/icons/pwa-*.png`).
The shared lockup component is `components/shared/BrandLockup.tsx`.

**The wordmark is being redrawn** (owner, Ask 2 C, 2026-10-23), **together with the browser-tab mark and the phone
home-screen icon** (owner follow-up, "yes"), as their own piece of work before S4. The drawing session is
`docs/projects/active/PUBLIC_FACE_WARM_W_DRAWING_PROMPT.md`. **This document does not settle the wordmark.** P9's
description is today's, and it will be replaced by whatever that session rules. Until then, build against P9 and do not
invent a sixth version.

On the sign-up steps, signed out, the wordmark leads to the marketing home page (Ask 13).

---

## 5. Voice

The voice is `BRAND_STRATEGY.md`'s: **Practical. Direct. Warm.** Like the most organized person on the volunteer board.
For the public face the working rule (P8) is: write from the volunteer's side of the screen, name what happens next,
and use no system words (no "[DIAGNOSTIC]", no "Root Node", no "Staff Access" shown to a customer).

These pairs from the walk show the rule. They are **examples of the rule, not approved copy**: every changed line is a
draft until `/marketing` settles it, in each stage, before its code (Ask 4).

| Today | Draft |
|---|---|
| [DIAGNOSTIC]: ROUTE_NOT_FOUND | We can't find that page |
| Requested resource is outside the current system scope. | The link may be old, or the address may have a typo. |
| RETURN TO ROOT NODE | Go to the home page |
| [SYSTEM]: INTERNAL_FAULT · Retry Request | Something went wrong on our side · Try again |
| START FREE — NO CREDIT CARD REQUIRED | Start free (with "No credit card required" under it) |
| Accept invite → | Accept invite |

A button says what happens (P4). Copy says only what ships (the 2026-10-19 truth rule).

---

## 6. What this document does not cover

- **Org-branded pages.** The public tournament pages and the club's public site wear the organization's own colours
  (R1-2, TH-1, M2: walking into the venue). Their **type** is its own project, joined with Tinted Panel Retirement's second
  wave (owner, Ask 7 A); scores and records keep the typewriter face there under R1-4. The family email's club identity is
  the one place the club's brand reaches the warm envelope (§3).
- **The admin and the coaches portal.** They have their own rules: `scripts/check-admin-type.mjs` and the kit.
- **Positioning, pricing and plan names.** `BRAND_STRATEGY.md`, and `PLAN_PRICING_FACTS.md` for anything about a plan's
  name or price. Never restate a price here.
- **Share-card images and the OG renderers.** S5 owns them (Ask 8 A).
