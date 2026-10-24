# The public face, warm — S1: the identity written down, the public type rules, and the build check (build prompt)

> **Written 2026-10-23.** **Paste this into a new chat on `dev`.** **Model: Sonnet, effort high.** It runs **in parallel**
> with two other chats: the signed-out build (`PUBLIC_FACE_WARM_SIGNED_OUT_BUILD_PROMPT.md`) and the wordmark-and-icons
> drawing session (`PUBLIC_FACE_WARM_W_DRAWING_PROMPT.md`). None of them touches your files, but the working tree is shared
> (and Club Tier has a build in flight). Stage explicit paths only, check you are on `dev` before committing, and ask
> before committing. Plan: `PUBLIC_FACE_WARM_PLAN.md` ("Round 1 rulings", "The build order and the recommended model").
> Walk page: https://claude.ai/artifact/M1ehQVxvLzMiTZfJDMtcft (the **Rules and ladder** tab holds P1–P10 verbatim; the
> **Identity** tab holds the drawn specimens).

## What this stage makes true (nothing a customer sees changes)

1. **The visual identity is written down once**, and `/marketing` and `/design` both point at it (finding 5: the brand docs
   cover positioning, voice and audience, never type, colour or the wordmark).
2. **The public type rules P1–P10 are written** where every later stage reads them, with **one named exception added to the
   type ladder** (Ask 3 A).
3. **A build check holds P1** (Ask 10 A): a public screen or email may not set a sentence, a label, a button, a heading or a
   navigation link in the typewriter face. It works as a **ratchet**, so the surfaces S3a, S4 and S5 have not restyled yet
   keep today's counts and can only go down. Each later stage locks in its own drop.

## Rulings to build exactly (owner 2026-10-23; record nothing they did not say)

- P1–P10 as drawn (walk page, Rules tab). Carry them over **verbatim**, with their "where today breaks it" column left out.
- **The named exception (Ask 3 A):** a marketing page's headline, **one per page**, Barlow Condensed 700, **64px desktop /
  40px phone**. Write it into the type ladder's comment in `app/globals.css` (~lines 680–723), beside the first look's
  first-run-heading exception (its Ask 12), in the same style.
  - It names a job; it does not mint a ninth token unless the comment's own rules require one. Say which you chose and why.
  - No other ladder change.
- **Scroll-reveal comes out (P6)** is a rule here; the code change is S4's.
- **The wordmark is being redrawn (Ask 2 C), with the browser-tab mark and the home-screen icon.** The identity doc's
  wordmark section says so, shows today's wordmark as current and points at the W session. **Do not settle the wordmark.**
- **Marketing pages are always warm (Ask 5 B), and every signed-out page is warm** (the follow-up ruling). The colour section
  says so: there is no Dark version of the marketing pages.
- **Family emails wear the club's identity on the warm envelope (Ask 6 A).** The email section says so (S3b builds it).

## 1. The identity doc

- New file: `docs/agents/brand/VISUAL_IDENTITY.md`. It sits beside `BRAND_STRATEGY.md`, which you read first, and links to it
  for voice.
- **Sections:**
  - **Type:** the faces, the public rules P1–P10, the headline exception, and the ladder by name. Point at `--type-*`; never
    restate the pixel values as a second source.
  - **Colour:** the warm tokens by name (`--home-*` in `globals.css`), what each is for, and E3 (lime is a fill, never text
    on paper).
  - **Email:** email cannot read CSS variables, so its values live in `WARM_EMAIL` (`lib/email-envelope-warm.ts`).
  - **The wordmark and the marks:** current state, plus the redraw pointer.
  - **Voice:** link to the strategy doc, plus the walk page's before/after pairs as examples of "no system words".
  - **What this doc does not cover:** org-branded pages (M2), the tournament pages' type (its own project).
- **Every value is a pointer to its one home** (`globals.css`, the envelope file, the plan). Restating numbers is how docs
  drift; the 2026-10-19 Facts-doc rule is the model.
- **Pointers in:**
  - one line in `.claude/commands/marketing.md`;
  - one line in `.claude/commands/design.md`, or in its shared guidance `memory/agents/design-review-agent.md` if that is
    where its sources are listed;
  - one line in `BRAND_STRATEGY.md`.
  - Read each file first and put the line where its other sources are listed.
  - These are agent instruction files, not hooks or settings. If you find one sits on the watched list in
    `scripts/check-agent-automation.mjs`, stop and ask.

## 2. The build check

- **Model it on `scripts/check-admin-type.mjs`.** It is the Admin type sweep's ratchet for the same problem on the admin side.
  Read its whole header first and reuse its shape:
  - signals counted per file in code only, comments blanked;
  - a `type-ok: <role>` marker on the line or the one above;
  - a per-file baseline that may only go down;
  - `--init` that can only lower it;
  - a file not in the baseline holds none.
  - Share helpers with it rather than copying them, if that is clean.
- **Name:** `check:public-type` (script `scripts/check-public-type.mjs`, baseline `scripts/.public-type-baseline.json`), wired
  into `verify:changed` next to `check-admin-type.mjs`.
- **Signals:**
  - **face:** the typewriter face (`--font-data`, `--font-mono`, `monospace`, `Courier` in CSS, inline styles and email
    template strings);
  - **caps:** forced capitals;
  - **heavy:** 800 or 900 weights.
  - **Not counted:** the tracking signal, or say why you counted it.
- **Allowed roles for the public side:**
  - `wordmark` (face, caps);
  - `plan chip` (face, caps);
  - `eyebrow` (caps only; the public eyebrow is Inter, P3);
  - `data` (face; a figure or code a person reads as data, e.g. a price code).
  - Write the list in the header with the P-rule each role comes from.
- **Scope = the public surfaces this project owns.** Find each in the code:
  - the marketing routes (`/`, `/pricing`, the four `/for-*`, both walkthroughs, `/changelog`, `/demos`,
    `/see-it-live/*/switch`, `/pitch/[slug]`) and their shared components (`components/Navbar.tsx` marketing parts,
    `components/Footer.tsx`, `components/marketing/*`, `PricingSection`, `FoundingSeasonPanel`);
  - the signed-out shell and sign-up journey (the consumer bar, `/start`, `/auth/*`, `components/auth/*`);
  - the system screens (`app/not-found.tsx`, `app/error.tsx`, `app/global-error.tsx`, `public/offline.html`,
    `app/unsubscribe/*`, the paused screen);
  - every email builder (`lib/email.ts`, `lib/email-envelope-warm.ts`, `lib/notify.ts`, `lib/family-email.ts`,
    `lib/dues-reminder-email.ts`, `lib/practice-plan-email.ts`, `lib/basic-coach-announcements.ts`,
    `lib/club-schedule-send.ts`, `lib/feedback-email.ts`, `lib/platform-email-templates.ts`).
  - **Out of scope:** the org-branded tournament and club pages (their type is a separate project; scores and records keep
    the typewriter face under R1-4), the admin (`check-admin-type.mjs` owns it), and the coaches portal.
- **The baseline today:**
  - Record every count as it stands, so the check passes on the current tree.
  - Then mark the places that already hold an allowed role (the three-ink wordmark, plan chips) with `type-ok:` so they
    leave the count.
  - The first look's screens should come out at or near zero. Report any surprise rather than fixing it.
  - ⚠ `scripts/check-public-tokens.mjs` has another session's uncommitted edits. Do not touch it.
- **Tests:** a unit test beside the admin check's (if it has one), covering a marked line, an unmarked one, an email template
  string, and the ratchet refusing a raise.

## Before code (AGENCY_RULES)

Give the owner the plain-language summary first: what this stage does (nothing a customer sees; the rules written down; a
check that stops the old typewriter look creeping back), then build.

## After the build

- `npm run verify:changed` passes, and `npm run typecheck` if you touched shared modules.
- `/review`, then commit after the owner says yes, in its own commit.
- Records:
  - the plan's ladder row for S1 ("built, commit `<hash>` <date>");
  - the auto-memory `project_public_face_warm`;
  - the TODO public-face line, only if TODO.md has no other session's uncommitted edits (otherwise say so).
- No QA walk is needed: nothing visible changed. Show the owner the identity doc's link and the check's first report (counts
  per surface), which is the to-do list for S3a, S4 and S5.
