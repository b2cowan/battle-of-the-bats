# Design session prompt — Practice plans on a phone · Stage 4 · The head of the page

*Paste into a new Claude Code session on the `dev` branch. Written 2026-09-25, after stage 3b closed.*

---

You are starting the **DESIGN phase** of **stage 4, "The head of the page"**, the last stage of the project
"Practice plans on a phone". Your job is to **measure, draw and ask**. Build nothing: no product code
changes until I rule on what you draw.

## The question

On a phone, the plan page puts a stack of things above the first block: the "sent to" line and **Send
again**, the when-block (the practice's date, time and place), the **goal**, **About**, and the toolbar
row (Run practice first). On 23 September that stack was about **500px** of an 844px screen before the plan
began. Stage 1 left it untouched on purpose, so stage 1's own gain would show on its own. Stage 4 decides
what a coach should see there on a phone, and in what order, so the plan starts on the first screen.

⚠ **The 500px figure is stale.** It was measured before stage 1b made the plan open to READ (with Edit
on purpose), before the record face, and before stages 2–3b. **Re-measure first.** If the head has
already shrunk, or the real problem is somewhere else, say so and re-frame the question with me before
drawing anything. Stage 3's asks were re-framed that way once measured, and it was the right call.

## Read first

- `docs/projects/active/COACH_PRACTICE_PLANS_PHONE_PLAN.md`: §0–§5 (what this is, the method, the
  findings, the standing rulings in §4, the ladder in §5), §6.5 (stage 1 as built: the head drawn
  unchanged), **§6b (stage 1b: read first, edit on purpose; this changed the head)**, and §6f–§6g for
  the method this project uses (measure → re-frame → draw → rule → build).
- `docs/projects/active/COACH_PRACTICE_PLANS_PHONE_PM_BRIEF.md`.
- The hub, **one artifact for the project's life**: https://claude.ai/artifact/73DbeziBqDjMr4QEhRWTvp
  (source `docs/projects/active/COACH_PRACTICE_PLANS_PHONE_HUB.html`). Read it with the Artifact tool
  before changing it. Add a tab **"4 · The head of the page"** and republish to the **same URL**. Never
  make a second artifact.
- `docs/projects/archive/COACH_MOBILE_EXPERIENCE_PLAN.md`, for the phone programme's toolbar ruling (E1)
  and the shell idioms. Its stage 4 stopped at "the practice plan's sheet itself"; this is that sheet's head.

## Measure

- Sign in with Playwright as the UAT head coach (`tests/uat/.auth/coach.json`). If a probe hits
  "Unauthorized" mid-run, the session is stale: re-run
  `npx playwright test --config playwright.config.ts --project=auth-setup -g "coach"`.
- Viewports: **390×844 and 360×780**, touch, device scale 2. Also look at 768 and 1440 once, to confirm
  a computer is out of scope. Probes live in `.probe/` (the scratchpad cannot resolve `node_modules`).
  Hide `nextjs-portal` in every probe.
- **Every face the head has, not just one:**
  - an upcoming plan, reading and editing
  - a plan not yet sent and one already sent
  - a **past practice** (the record face: "How it went" first)
  - a **template** (no when-block)
  - a coach **without write access** (the read face only)
  - the empty plan
  The UAT probe practice is `773afff0-5777-447f-87bd-7686ec4bc6b1` on the UAT Test Team. The layout
  sweep's fixture context also resolves a past practice (`recordPracticeEventId`). Ask the sweep's own
  resolver rather than guessing ids.
- For **long content** (a paragraph of goal, a long About, a long "sent to" list), intercept the plan's GET
  and serve a lengthened copy to the screen alone.
- Read the browser's own geometry: each piece's height, where the first block starts at scroll 0, what
  a tap on each control hits. Never judge from a screenshot alone.

## ⚠ The fixture is my LIVE QA walk

A plan save replaces the whole plan, and the last writer wins. **Intercept every write your probe
could trigger (PUT, PATCH or POST on the practice's routes) and answer it locally. Never write to it.**
- The plan **autosaves after a pause**, so a probe that types can write without pressing anything.
- Intercept `http://localhost:3000/**` only. A blanket `**/*` interception breaks the sign-in token
  refresh, and the probe then fails with Unauthorized.
- The probe practice currently has a fourth block ("Block 4") from my last walk. Leave it.

## Draw

- On the hub tab: **whole screens at true size, today beside each option**, at 390 and 360, with the
  rest of the page shown under the fold. Every annotation dot opens its note on a tap; hover titles are
  not enough.
- Decision cards with **a recommendation**, and a **paste-back** block I can copy into the chat to rule.
- Add a §6i section to the plan (measured before, the view, the decisions, build notes for after the
  ruling), set the stage 4 row in §5, and add a stage 4 paragraph to the PM brief.
- **A number in a sentence is measured, not guessed.** Say where it came from.

## Rulings to work inside (do not reopen)

The plan's §4 is the canonical list. The ones this stage will brush against:
- **The plan opens to READ; Edit is on purpose** (stage 1b).
- **Edit autosaves; create asks.**
- **Run practice is first in the toolbar row** (E1).
- **A past practice shows its record face**, with "How it went" first.
- **A form covers the nav; a menu sits on top of it.**
- **Controls you can't use are absent, not greyed.**
- **Mark what's required, not what's optional.**
- **Form selects are dropdowns.**
- **Sport-neutral words.**
- **Nothing on a phone may be narrower than the tap floor.**

## Out of scope — each has its own decision already

- **A block added by mistake going when left empty.** Ruled yes on 2026-09-25 (plan §6h). It is a
  separate small build; do not touch the add-block path.
- **← + Done on the other sheets** (Places, the budget item manager, the past-season import, the tag
  manager). Closed on 2026-09-25 and left as they are.
- **The run screen (stages 3 and 3b)**, closed and walked (ledger §240). Its logged follow-ups (a Tab trap
  on the full screen; the help panel and the back gesture) are not this stage.
- **A computer and the 641–768 band.**
- **The library pages** (drills, circuits, templates lists).

## Guardrails

- **Change no product code** during design.
- This working copy is shared with other sessions: other files are modified or untracked that are not
  yours. Don't touch, stage or commit them.
- **Commit only your own docs, with explicit pathspecs, after I agree.** Use a private index; the ledger,
  TODO and the shared stylesheet carry other sessions' edits.
- **Disagree out loud before the work** if the measure says I'm asking the wrong question.

## House rules for anything a coach reads

- The clock is **"8:00 a.m."** (lowercase, with periods), everywhere.
- **One spelling** for every word, across every surface.
- **Sport-neutral** words.
- Write to me in **product-owner voice**: what a coach sees and does differently, why it matters, what it
  costs. Keep file names and code out of the message.

When the drawing is ready, give me the hub link, your recommendation in a few lines, and the
paste-back. Then wait for my ruling.
