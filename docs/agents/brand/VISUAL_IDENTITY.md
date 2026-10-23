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
| **IBM Plex Mono** | a plan chip and real data — nothing else (P1). The name is the Inter lockup (§4) | `--font-data` (`--font-mono`) |

Email cannot load our fonts. It uses Arial and Helvetica, the name line included (see §3).

### The public rules, P1–P10

Owner ruling 2026-10-23 (Ask 3 A), carried over as ruled.

| Rule | What it says |
|---|---|
| **P1 · The typewriter face is for a plan chip and real data** | Never a sentence, a label, a button, a heading, a navigation link or the name. (Scores and records on the sport pages are data, so R1-4 keeps them. That belongs to Q6's project.) *Q6 was ruled Ask 7 A: the tournament pages' type is its own project, §6.* *Rewritten when S4 shipped the lockup (2026-10-23); it used to allow the wordmark.* |
| **P2 · One heading face** | Barlow Condensed 700, sentence case. A page has one face for its headings. |
| **P3 · Sentence case wherever a person reads** | The only capitals are the eyebrow line (Inter 600 12, letter-spaced, olive: the first look's step line, coloured) and a plan chip. |
| **P4 · A button says what happens** | Inter 700, sentence case, 48px, lime fill with ink text, 10px corners, no arrow. One lime button per view. Secondary: white with an edge. A text link is olive. |
| **P5 · Paper by default, Dark by choice, no dark island** | The public face follows the visitor's Warm / Dark choice and is warm without one. Lime is a fill, never text on paper (E3). *Superseded in part by Ask 5 B and its follow-up, see §2.* |
| **P6 · Complete when it loads** | Nothing waits for a scroll to appear. A screenshot, a slow phone and a skimming reader see the whole page. |
| **P7 · Every page says what it is when shared** | A title, a description and a share card. |
| **P8 · No system words** | Say what happened and the way forward, in one sentence each. |
| **P9 · One name, the lockup** | The bare olive mark + "FieldLogic" in Inter 700 ink + "HQ" in Inter olive, drawn by ONE component (`components/shared/BrandLockup.tsx`) wherever a screen shows the name. On Dark the mark and the name take the text colour, HQ a little dimmer. In email: Arial text, no mark. See §4. *Rewritten when S4 shipped it (2026-10-23); it used to be FIELD · LOGIC · HQ in the typewriter face.* |
| **P10 · One email envelope** | The warm envelope the first look built. A family email adds the club's identity to it (Q5) and never replaces it. |

**Rulings that sit on top of the table** (all owner, 2026-10-23, in the plan's "Round 1 rulings"):

- **Scroll-reveal comes out (P6).** This is a rule here; removing it from the home page is S4's work.
- **The marketing headline is one named exception to the ladder** (Ask 3 A). See "The headline" below.
- **The wordmark is redrawn and RULED** (Ask 2 C; the refined Joined FL, 2026-10-23), and S4 Part B built it: P1 and P9
  above are the rules as shipped. See §4.

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
| `plan chip` | the face, capitals | P1 |
| `eyebrow` | capitals (never the face; the public eyebrow is Inter) | P3 |
| `data` | the face (a figure or code read as data) | P1 |

No role allows a heavy weight, and there is no `wordmark` role any more (retired in S4 Part B: the name is the Inter
lockup). Since S4 the check also counts the lettering a class name carries in a page's markup (`font-mono`,
`uppercase`, `font-black`, and the global classes that set the face). Scope and the full rules are in the script's header. Org-branded tournament and club
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
- **The name in email is text in Arial**: "FieldLogic" 700 ink, "HQ" 400 olive, no image and no mark, so every mail app
  shows the same thing with images on or off (§4). It is drawn by `emailNameLineHtml()` in `lib/brand-mark.ts` with the
  email palette's colours. (S3a kept the old Courier line; S4 Part B changed that one line, 2026-10-23.)

---

## 4. The wordmark and the marks

**Where it lives (S4 Part B, built 2026-10-23).** The geometry and the name's two parts are `lib/brand-mark.ts` (the
paths copied from the refinement page, never redrawn). Every screen draws the name with `components/shared/BrandLockup.tsx`
(tones: `warm` always paper, `follow` the account's Warm / Dark, `mono` the one-colour lockup in the surface's own ink).
The three places that cannot import it draw from the same file: the offline page (`lockupStaticHtml()`, pinned), the email
name line (`emailNameLineHtml()`) and the share card. Every icon file is drawn from it by
`scripts/generate-brand-icons.mjs` under `fl-*` names. `tests/unit/public-face-s4-identity.test.ts` holds all of it.
*Before S4:* FIELD · LOGIC · HQ in the typewriter face in five slightly different versions, a lime ">" chevron on a dark
square as the tab and strip mark, and a separate "FL / HQ" phone icon.

**RULED 2026-10-23 (owner, "go ahead with your proposal" on the refinement page
https://claude.ai/artifact/9xDNVQyR3wJRcf7hCgiDBr, taken as its seven asks as recommended): the refined Joined FL, olive
leading, lime kept for actions.** It ships in S4's release, all at once, with the warm marketing set (Part A). P1 and P9
above are already written as shipped. Drawing history: round 1 (`PUBLIC_FACE_WARM_W_DRAWINGS.html`, did not
sell it), Codex's second opinion (`PUBLIC_FACE_WARM_W_CODEX_OPINION.md`), the refinement (`PUBLIC_FACE_WARM_W_REFINEMENT.html`,
the source of record for the geometry).

**The mark.** An F whose middle arm turns down into an L: one filled shape, the name's two initials. Geometry on a 64 grid
(the paths in the refinement page's `P.rf` and `P.rf16` are canonical; copy them, never redraw):
- **Main cut** (32 px and up): Codex's edges, with the top-left shoulder a 12-unit curve (a little wider than the 10-unit
  stem, so the stroke stays even round it), outer corners 3, inner corners 2.
- **16 px cut**: on the 4-unit pixel grid, every stroke 3 px, the gap between F and L 2 px, shoulder 3 px, corners 1 px.
  The main cut at 16 px is mush; the separate cut is required.
- On a tile, square or maskable icon the glyph sits 1.5 units right of centre (its weight is on the left). Not in the lockup.

**Colours.** The app tile is olive `--home-olive` with the mark in paper `--home-paper`. Lime is **not** in the mark
anywhere; it stays the action colour (buttons). In Dark the mark and the name take the Dark text colour, HQ a little dimmer.
Olive on the Dark ground fails (about 3:1), so Dark never uses an olive mark.

**The lockup (P9).** The bare olive mark (no tile) + "FieldLogic" in Inter 700 ink + "HQ" in Inter olive, 600 below
18 px and 500 above. The mark is about 1.4 times the capitals' height, centred on them, with a gap of about 0.45 em. One
mark at every size. The tile appears only where the mark stands alone: the tab, the phone, the share card.

**Every place.**
- **Browser tab:** a rounded olive tile, the 16 px cut at 16, the main cut at 32. Ship under a new file name so caches refetch.
- **Phone:** the iPhone icon is a full square (iOS paints transparent corners black). The maskable icon puts the glyph at 84%
  inside the safe circle. The "any" and maskable icons are separate files. The launch screen and bar colour move off near-black.
- **Notification badge:** a white silhouette from the 16 px cut, crisp at 16, 32, 48 and 96. The large picture is the app tile
  unless an organizer sends its own logo.
- **Exports and print:** the one-colour lockup beside the existing "Generated by" words.
- **Email:** the name as text in Arial, "FieldLogic" 700 ink and "HQ" 400 olive. No image, no mark.
- **Share card:** the marketing card gets one (P7), with the tile as its one lime-free accent.
- **One colour:** the same path in black or white, holes real.

**The name and logo search: CLOSED by the owner 2026-10-23.** Canada only (owner). The Canadian trademarks database was searched for the word: "fieldlogic", "field logic", "fieldlogix", "field logix", "logic hq" and "fieldhq" each returned no results (database current to 2026-10-21). No logo (design-mark) search, no search outside Canada and no trademark agent's opinion were done; the owner closed the item there.
**Recommended, not a gate:** a few informal reactions (coaches, a parent or two) that ask "what letters do you see?" first.
The admin and coaches-portal top strips take the new lockup in place of the ">". People with the app installed get a
What's new line (an iPhone keeps the old icon until the app is added again). Every copy of the name becomes one shared
piece, so the redraw does not become an eleventh version.

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
