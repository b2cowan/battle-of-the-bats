# Build prompt — On-sale pages, session S3b: the selling sections

> Paste everything below the line into a new chat (`/clear` first). Written 2026-11-20, after S3 committed `1f3bdb41b`
> (walk §550 owed; walks never gate). The plan's order (owner 2026-11-19): removal → team move + small items → S3 →
> **S3b** → S4. S3b does **not** hold the flip (owner 2026-11-17: marketing after the launch; Ask 30), so it can ship
> closed-safe before the flip or after it. Two sessions are likely: the picture choice, then the build.
> **Model: Opus** (selling pages, a picture comparison, legal-gated answers). Helpers read on Sonnet.

---

You are building **S3b of the on-sale pages** for FieldLogicHQ: the selling sections the audience review added to
`/for-clubs`, `/for-leagues` and the `/pricing` FAQ, plus the paths between audiences. S1 made the pages read the on-sale
switch, S2 built the doors, S3 built the pages' open state. **S3b opens with the owner's choice of pictures, and nothing
else is built until he has chosen.**

## Read first

1. `CLAUDE.md`, `AGENCY_RULES.md`, `AGENTS.md` (this is not the Next.js you know: read the guide in
   `node_modules/next/dist/docs/` before changing how a page renders or caches).
2. The plan of record, `docs/projects/active/CLUB_ON_SALE_PAGES_PLAN.md`: **S3b** in full, the **S3 record** ("Built
   2026-11-20") for what the pages now do in both states, "Owner asks" (all ruled; do not re-open one). The asks that are
   yours: 26 (the product's own screens, shot from a fictional club, not a demo), 28 (the Clubs page speaks to the whole
   board), 29 (Questions a board asks, with the United States storage answer; data terms published with the release),
   33 (the paths between audiences), and the 2026-11-19 picture ruling under S3b.
3. **What changed since the asks were ruled — these override the words and drawings where they differ:**
   - **The team limit counts the teams given a Premium Coaches Portal** (`BUSINESS_DECISIONS.md` 2026-11-19); house league
     teams are unlimited. S3's `/marketing` pass rewrote every bare team count on these pages to say so. W69's coaches card
     ("every team, included in your plan with no per-team fee") and W70's answer 6 ("for up to 15 teams") must follow.
   - **No coach marketing surface says "free"** (2026-11-19, "Coach a team" opens the paid Premium sign-up). W71's
     `/for-coaches` and `/demos` lines must follow.
   - **League Plus can change to no other plan** (no move row; `/legal` must-fix applied in S3, owner call C1 of walk §550
     open). No S3b answer may promise a League Plus move; W70 answer 4 ("cancel any time") is fine.
   - **League Plus's closed words are "Coming soon"** like Club (S3). **The status pill sits on the card's first line, on
     the right when the card has a small label on the left** (owner 2026-11-19): every card S3b adds follows it.
   - **The Founding Season is gone.** No Founding line survives on any page S3b touches.
4. The drawings, source `docs/projects/active/CLUB_ON_SALE_PAGES_DRAWINGS.html` (**version 4 in the repo**, corrected to
   S3's build; the published https://claude.ai/artifact/CJ39nz8YunjGxRViXtQ3K7 shows version 3 until the owner's call C5 of
   walk §550 — republishing needs a full read of the live page first). Tabs 4 (`/for-clubs`), 5 (`/for-leagues`), 2 (the
   `/pricing` FAQ in three groups), 10 (the other pages). Click every numbered note. Build to the drawings as amended above.
5. The words, `docs/projects/active/CLUB_ON_SALE_COPY.md` section M: **W65, W66, W67, W69, W70, W71** (each with its
   review notes), and the "In code (S3, built 2026-11-20)" paragraph for what is already built. Never type a price, a
   trial length or a tax word: `docs/agents/strategy/PLAN_PRICING_FACTS.md` through `lib/plan-config.ts` (import-free; the
   demo seed scripts load it with plain Node), `lib/plan-trial-line.ts` and the tax words.

**The plan's code citations are leads, not evidence.** S3 rewrote `/for-clubs`, `/for-leagues`, `/pricing` and home on
2026-11-20. A helper does the broad reading; you read the lines a decision turns on.

## Part 0 — the picture choice (the session stops here for the owner)

The owner's ruling (plan S3b, 2026-11-19): **before any picture is built, show him BOTH options side by side and he
chooses** — (A) real screenshots of the product, (B) drawn pictures of the same screens. His point is that the drawings
look better than our **screenshots** of the product, not better than the product; do not frame (B) as "nicer than the
product". The comparison must be fair to both:

- **The same eight screens, both options** (W67): `/for-leagues` 01 the registrations list · 02 the draft board · 03 the
  season schedule with standings · 04 the Email families window; `/for-clubs` 01 a public event page with live scores ·
  02 the registrations list · 03 a coach's roster · 04 Budget vs. Actual.
- **(A) is the product at its best:** a fixture club built for the purpose with invented names and realistic data (never
  the live demo clubs, never a production row; `/legal`: no birth date, medical field, real-looking email or phone, real
  logo or photo in a shot); tight crop on the part that sells, 2× pixels, no browser chrome, a phone shot where the screen
  reads better narrow. Shot by a capture script kept with the build, so `/demos` can re-shoot each release cycle.
- **(B) is drawn FROM the real screen:** same layout, same words, same controls; cleaner, never a feature the product lacks.
- **At true size on the page they will sit in**, as one Claude Artifact (HTML, never the canvas): each screen's A beside
  its B in the drawn page section, with the caption each would carry (W67's "These are the product's own screens, shown
  with a fictional house league." fits A; B needs its own wording and a `/legal` read). `/design` on the comparison before
  hand-off.
- **The refresh cadence** (quarterly or twice a year, either option) is the owner's call in the same Artifact.

Hand the owner the Artifact with three calls (A or B, the cadence, B's caption if B) and **stop**. Building the fixture and
the capture script for (A) is part of making the comparison fair; build them first, and say so.

## Part 1 — records and checks (each through its own agent, after the choice)

- **`/marketing`:** confirm W65, W66, W69, W70, W71 against the canon and the amendments above (team counts, no "free" on a
  coach surface, the picture caption chosen). Change nothing it does not change.
- **`/legal`:** W70 ships **only** if the Terms and Privacy Policy are live on production (answer 3 links to the Privacy
  Policy) **and** the data terms are published or the by-hand "full copy" procedure is confirmed (Ask 29). Check what
  production serves today (read-only: the published pages, the release-history record) — never assume. If either is
  missing, W70 is built and gated off and the missing step goes on the board as an owner step. Also: the (B) caption if
  chosen; "never shows a player's name… on a public page" re-checked against the product as it is now.
- **`/strategy`:** none expected; if a wording change touches a Decided entry, route it.

## Part 2 — the build (plan S3b)

Before any code: the **plain-language UX summary** `AGENCY_RULES.md` requires, and a task list.

1. **`/for-clubs` heading and sub-line** (W65, both states): "You run the club."; the club's books in the sub-line.
2. **`/for-clubs` "old way" cards** (W66, both states): the treasurer and registrar cards in, the tryouts card out. The
   cards come from `PLAN_ARTICLE_CONTENT.club` (shared with the in-product plan article): check every reader before
   changing it, or give the page its own list.
3. **The pictures** (W67, the option the owner chose) in `/for-leagues`' four steps and `/for-clubs`' four modules, with
   alt text naming the screen and no figure quoted in a caption. Under `/for-clubs` 03, the existing "See a coach's season"
   link while the demo doors are on. The capture script (A) or the drawn files (B) kept with the build; `/demos` joins them
   to its per-release-cycle pass (record the cadence the owner chose in `.claude/commands/demos.md`'s checklist only if he
   asks for that change — it is shared automation; otherwise record it in the plan and the demos plan).
4. **"What each person at your club gets"** (W69, both states) after the modules on `/for-clubs`: four cards (President,
   Treasurer, Registrar, Coaches) and the board-meeting line with "See every plan and price". Each card's claim is checked
   against the product (board roles, the board report export as PDF or Excel, registration, waitlist, Email families).
5. **"Questions a board asks"** (W70) on `/for-clubs` and `/for-leagues` before the bottom call to action, as the shipped
   accordion; answers 1–5 in both states, answer 6 (a year's cost) only while the plan is open. The first four also join
   the `/pricing` FAQ, which is grouped under three small headings (drawing tab 2). Gated per Part 1's `/legal` check.
6. **The paths between audiences** (W71): "Copy a link for your club" on `/for-coaches`' "Is your club considering Club?"
   card (copies the `/for-clubs` address and nothing else: no pre-filled email, nothing sent by us); one line under the
   coach demo on `/demos`. **The `/for-tournament-organizers` line ("Start League Plus or Club from Plan & billing") is
   true only once S4 ships** — build it gated off, or leave it to S4; do not ship it before S4.

**Not in S3b:** buying from inside the product and Plan & billing (S4); any plan turned on in production; the drawings'
republish (the owner's call C5 of walk §550, unless he says go).

## Tests and checks

- Every page S3b touches renders correctly in **both** states and in a partial flip: extend
  `tests/unit/public-plan-pages-both-states.test.ts` (it already renders home, `/pricing`, the four persona pages, open,
  closed and League-Plus-only). The S1 guard (`public-plan-availability-guard`) stays green: no page types "Express
  interest", "Coming soon", "Not open yet" or "Available now"; no retired framing; possessives through `possessive()`.
- `npm run verify:changed` — ⚠ it stops at the first failing step, and other sessions' work in the shared tree can fail
  `npm test`; when it does, run the later checks one by one (spelling, public tokens and type, CSS selectors and purity,
  contrast, `capture-marketing-shots --check`, `check-demos`) and say which failures are not yours.
- `npm run typecheck` with `NODE_OPTIONS=--max-old-space-size=8192` (the default heap runs out).
- Layout: `node scripts/check-layout-invariants.mjs --only=mkt-home,mkt-pricing,mkt-for-coaches,mkt-for-clubs,mkt-for-leagues,mkt-for-tournaments`
  (and the `/demos` screen id from `--list`) on the dev server. `--changed` widens to a whole-product sweep whenever any
  session has touched a shared stylesheet, and a whole-product sweep never runs on the dev server.
- Restart the dev server before handing off if you add files or change a shared module (stop it first; another session
  may be using it, so say so in the hand-back).

## Reviews before handing off

`/legal` on W70 and the picture caption as built (before hand-off, not offered after); `/design` on the pictures in place,
both states, desk and phone, and the pill rule on every new card; `/marketing` on the words as built; `/review` at the
standard tier. `/accounting` only if answer 6's year cost or a tax word changes. `/docs` is not needed (no product flow
changes). Offer `/simplify` if the two pages grow their own copies of the questions or the picture blocks.

## Rules

- Branch `dev` only. Explicit pathspecs. **No commit and no push without the owner's yes.** Re-check the branch before
  every commit; confirm with `git show --stat HEAD` that only your files landed.
- **Other sessions have uncommitted edits in files this session will touch** (on 2026-11-20 they included
  `app/for-coaches/page.tsx`, the QA ledger, the board and the legal index). Run `git diff` on a file before editing it,
  and stage only your hunks. **Not** with a `-U0` hunk filter and `git apply --cached --unidiff-zero`: in S3b Part 0 it
  placed the plan note 12 lines low, inside S4 (repaired in `196f16d43`). Build the file as HEAD plus your exact edits,
  `git hash-object -w` + `git update-index --cacheinfo`, and read the staged lines around every insertion
  (memory `reference_partial_commit_shared_tree`).
- Push back first if the code, the gate or the canon says the plan is wrong. A number on a page comes from the Facts doc.
- Production is read only as counts and schema (and its public pages), never a person's row.

## Hand back

1. What a visitor sees differently, in product-owner voice, and how to see both states on dev (Dev tools › Plan gates ›
   "Show as closed"; platform admin `uat-platform@fieldlogichq.ca` · `UATPassword2026!`).
2. A checkable walk (an Artifact, 20 to 50 boxes, one action per step, exact logins where any are needed) covering both
   states, entered in the Owner QA Ledger; owner calls never in the counter.
3. Records in the same pass: the plan's S3b stage (with its commit once the owner commits), the board line `club-tier`, the
   copy doc (which S3b words are now in code), the Claude memory file `project_club_on_sale_pages.md`.
4. The S4 prompt is written only after S3b commits. S4 opens with its own drawing round from today's Plan & billing
   captures (plan S4), and must not overlap a Plan & billing build session.
