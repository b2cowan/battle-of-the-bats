# Club Tier · Stage 14, One player across seasons and teams: draw it (prompt)

> **Written 2026-11-04**, the day Signed-in family accounts Stage 3 was committed (`bacf24a9b`). Stage 14 is the prerequisite
> the parent app (Signed-in family accounts Stage 4) and "next season pre-filled" (Stage 5) are waiting on.
> **Paste `execute @docs/projects/active/CLUB_TIER_STAGE14_DRAWING_PROMPT.md` into a new chat on `dev`.** Other sessions share
> this working copy (billing, house league, public tournament pages): stage explicit paths only, commit only your own hunks, and
> only when the owner says.
>
> **This is a drawing session, not a build.** No product code, migration, seed, help article or demo change.
>
> **How to draw (owner ruling 2026-10-26, binding):** one published HTML-page Artifact with tabs and a written explanation beside
> every frame, published by `file_path` (source `docs/projects/active/CLUB_TIER_STAGE14_DRAWINGS.html`). **Never** the design
> canvas / the `design` quickstart / a Design artifact type, and never open an empty artifact "to fill later". Load
> `artifact-design` first. House layout (memory "Mockups → Claude Artifacts"): sticky tabs, minimal scroll, an Everything /
> Show-only-what-differs toggle, whole-screen before/after, frames at TRUE SIZE, a desk and a phone for each. Draw every control
> from its SHIPPED component, and every row list from the coach row-list recipe. Run `/design` on the drawings before handing
> them over.

## What Stage 14 is, and what is ruled

Plan of record: `CLUB_TIER_PRODUCTION_READINESS_PLAN.md`, **Stage 14** (~line 3109; 14a–14d, the open questions, the mockup list,
the build gates). Also read `SIGNED_IN_FAMILY_CENSUS.md` §4 ("What the Stage 14 child record would have to anchor"),
`SIGNED_IN_FAMILY_ACCOUNTS_PLAN.md` Stages 4 and 5, and `CLUB_FAMILIES_BOOK_PLAN.md` ~lines 445–457.

**Why it is being drawn now (owner 2026-11-04):** the signed-in family app needs a parent linked to a *child that outlives a
season*. Today there is no child record: a child is a per-season row (a house-league sign-up, a tryout sign-up, a rep roster
row), and the guardian link hangs on a rep roster row that the next season's roster replaces. Stage 14 is what the parent app
(Stage 4) and the pre-filled returning-family form (Stage 5) stand on. The privacy-law review is **parked by the owner until
after the project**; do not block on it, but anything that touches what a coach sees of another team's child, a medical note or a
consent is drawn as an **owner ruling with "counsel's read parked" written on it**, never as decided.

**Ruled, do not reopen** (record each as ruled and add nothing it did not rule):
- *Start next season* **asks what the team is doing**: (a) the same group moving up an age group, (b) a new group in the same age
  group; the roster is a carry choice on (a). (Owner 2026-10-22.) **Proposed, not ruled:** on (b) the roster carry defaults off;
  on (a) the age group moves up one and the birth years stay.
- The family library (the Families book) is the anchor; a child should be **one record every season points at**. (Owner direction
  2026-10-22.) The *shape* is not ruled.
- The Families book's rule: a household is **confirmed by a human, not inferred**, before money moves (`CLUB_FAMILIES_BOOK_PLAN.md`
  ~449). Stage 14 must say how a durable child key exists **without inferring one**. Rule that tension first (see the asks).
- A parent account is a **person, not an organization member** (10-29 P3, not yet ruled; raise it, do not assume it).
- No stopgap no-login family door (`project_end_state_signed_in_family_app`). A returning child is picked inside a signed-in
  screen, never through a sent link.

## Before drawing: verify against the code (delegate the reading; open the cited lines yourself before relying on them)

Send helpers out in parallel (CLAUDE.md "broad reading goes to a helper"), asking each for paths with line numbers and a verdict.
The plan's census is from 2026-10-22; it says to re-read the cited places when the stage opens.
- **Is 14a (the season window) already built?** Search for the "same group moving up / new group" choice in the *Start next
  season* window, both portals. If it is, say so and draw only 14b–14d; if not, 14a is the first frame.
- **Every place a child is a per-season row today**, by table: house-league sign-ups (name, date of birth, guardian email inline),
  tryout sign-ups, rep roster rows, call-ups, continuity/history links (same team only; the DB refuses cross-team). For each: the
  columns that identify the child, who writes them, and what points at them (dues, documents, notes, attendance, awards, stats).
- **Every door that adds a player**: the coach's single add, paste-a-list, the roll, the tryout promote, the club admin (who has
  no add-player door), and the house-league draft/placement. Which has a duplicate check, and on what.
- **Documents and waivers**: where they live, whether they hang on the roster row or the guardian, what the roll carries, and the
  consent row (`keyed to the guardian's email and one registration row`). Which are per-season by law or by the club's own rule.
- **The matcher and the Families book's duplicate-guardian logic** (high / possible tiers; the "returning-player check"): what it
  already proposes, what the human confirms, what a merge does to history links. This is the model for 14d.
- **The look-back layer**: `HISTORY_ENDPOINTS` in `tests/unit/coach-history-endpoint-guard.test.ts`. A picker over earlier seasons
  is a new look-back route; draw the answers to the **three questions** in CLAUDE.md (record or instrument? does the whole subtree
  carry the year? could the coach tell which season they are reading?).
- **Standalone coaches** (no club): do they have a family library at all? Read the code, not the plan.
- **Who is on the other end today**: what the guardian tier (`GUARDIAN_TIER_ENABLED`, off) links, so the drawn child record keeps
  that link alive across seasons instead of rebuilding it.
- **Help + demo exposure**: which help articles and demo tour stops describe the roll or the roster add (list them for the
  build's `/docs` and `/demos` steps; change nothing now). A number in a demo sentence is computed from the seed.

## Owner asks to frame (each with a recommendation and its reason; options lettered)

At minimum, check whether each is real once the code is read, and drop any the code settles:
1. **⚠ Rule first: how does a child get one key without inferring it?** Options: (A) the key is made when a person (the club
   admin, or the head coach for their own team) *confirms* "same child" — never automatic, so every match is a proposal; (B) a new
   child is created on first add and a "same kid?" nudge asks at every later add (name + birth date) before it creates another;
   (C) both. Recommend from the code and the Families-book rule.
2. **Shape: the plan's recommendation to test.** (i) the smallest, a "bring back a past player" picker over this team's earlier
   seasons (including players the roll skipped) plus the "same kid?" nudge, built on the shape that (ii) will grow into; or (ii) a
   club-level child record that every team's roster entry points at, which is what a cross-team picker needs. Recommend (i)
   first, hold the cross-team picker, and say what (i) must already contain so (ii) is growth, not rework.
3. **Privacy across teams (owner ruling, counsel's read parked):** what a coach on one team may see of a child from another team
   (medical notes, guardian contact, evaluations); whether a past-team coach's notes travel (the Notes feature keeps a coach's
   private note out of the family file). Recommend the narrowest default and what a club admin can widen.
4. **Who may link or merge:** the club admin only, or the head coach for their own team? Recommend and say what each sees.
5. **Documents and waivers (14c):** which carry (a medical note, an emergency contact, a photo consent) and which are re-signed
   every season. The win is **one record with a document history and a "needs re-signing this season" state**, not skipping the
   re-sign. Draw the state on the child's page.
6. **Existing data (14d):** a review-and-merge pass before any forced merge; a merge never deletes a season's entry and a
   roster's history links survive it. Does it run once, or as a standing queue like the duplicate-guardian one? Recommend.
7. **The birth-year check:** does picking a past player into a team flag a birth year outside the team's range? Recommend.
8. **Standalone coaches (14d):** the same record, or does 14b stay a club feature? Decide from what the code says they have.
9. **The parent link:** the guardian link points at the child record, not a season's row, so a connected parent is never
   disconnected by the next roster. Draw the one frame that shows this (a child with three seasons and one parent), as the
   hand-off to Signed-in family accounts Stage 4. **Do not draw the parent app itself.**
10. **Raise, do not decide:** the signed-in family accounts plan's 10-29 P3 (a parent account is a person, not a club member).
    Ask the owner to rule it, with a recommendation, since the child record's parent link depends on it.

## What to draw

Follow the plan's mockup list, on a desk and a phone, whole screens, TRUE SIZE, each with its explanation:
- the *Start next season* window both ways (14a, unless built), and what the confirmation says about the roster;
- the picker ("bring back a past player") at 390 and 1440, and what a returning child looks like once picked (history, documents,
  dues state), with **the season it reads from named on screen**;
- the "same kid?" nudge on every add door, including the paste-a-list one;
- a child's page across three seasons with its documents and the "needs re-signing this season" state;
- the merge pass (review queue, a proposed pair, what the human confirms, what survives);
- the one frame for the parent link (ask 9);
- the empty states, the refusal words, and the club admin's door (who has none today).

## Hand-off

1. Publish the drawings; run `/design` and apply its round; republish.
2. Update the plan's Stage 14 with a "Drawn 2026-11-xx" note (the page link, the source file, the asks as OPEN) and the TODO line
   in one clause. Record any census item the code contradicted as a correction in the plan, with the evidence. Write the PM brief
   update the plan rules require.
3. Update the Signed-in family accounts plan's Stage 4 "Blocked by" line (Stage 14 drawn, asks open) and the auto-memory notes
   `project_club_stage14_one_player.md` and `project_end_state_signed_in_family_app.md` plus their `MEMORY.md` lines.
4. Tell the owner in product-owner words: what each frame shows, the asks with recommendations, and anything the code
   contradicted in the plan. Do not commit unless asked.

After the owner rules the asks, the next session writes `CLUB_TIER_STAGE14_BUILD_PROMPT.md` (14a first if unbuilt, then 14b–14d in
one-session chunks). The Stage 14 walk is its own checkable page with a § in the Owner QA Ledger.
