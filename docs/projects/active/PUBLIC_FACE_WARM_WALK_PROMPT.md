# The public face, warm: kickoff, the measured walk and the end state drawn

> **Written 2026-10-22** in a `/tasks` session, on the owner's "go for it". **Paste this into a new chat on `dev`.** This is a
> **walk-and-drawing session: nothing is built.** It ends with one published page (the walk, the ladder and the end state
> drawn), its asks put to the owner, and the records saying "walked and drawn, asks open". The plan is
> `PUBLIC_FACE_WARM_PLAN.md`; its PM brief is `PUBLIC_FACE_WARM_PM_BRIEF.md`.

## The owner's ruling that starts this now (2026-10-22)

The plan said this project starts after Club Tier. **The owner has ruled it runs beside Club Tier**, ahead of Platform admin. That
answers the plan's Q8 and "to confirm at kickoff". Record it as ruled, adding nothing the owner did not say. Only the order moved:
the plan's other rulings and shape questions Q1–Q7 are still open and still recommendations.

**What can run beside Club Tier, and what cannot** (the owner was told this; hold the ladder to it):
- The walk, the drawing and the **marketing-page** builds do not touch club screens. They can run any time.
- **The email stage (S3) waits for, or is coordinated with, the Club stages that add or change emails** (Stage 12's payment
  emails, any Stage 9 house-league email). Say in the ladder which Club stages that means, from the plan, not from memory.
- **The marketing top bar and menus are a shared frame.** Club Stage 13 reviews navigation across the three portals and has not been
  drawn. Mark any bar or menu change in this project as "coordinate with Stage 13", and do not draw a second answer for a crossing
  Stage 13 owns.
- **Pricing and `/for-clubs` copy** says only what ships (the 2026-10-19 truth rule in `BUSINESS_DECISIONS.md`). Club is not on sale.
  Any copy change there goes through `/marketing`, and any price or plan name is checked against `PLAN_PRICING_FACTS.md`.

## What this session makes true

A walk through the public face **in the order a newcomer meets it**, a stage ladder, and the **end state drawn** so the owner can see
what you propose on every surface, not words about it. The owner reads it against the product and rules; the next stage is drawn only
after the one before is ruled.

**The bar** (the owner's words, 2026-10-19): a volunteer, coach or organizer feels on day one that this was made to run their league
or team and **not a terminal**. The audience is mainly not technical.

## Read first

- `PUBLIC_FACE_WARM_PLAN.md` in full: the ask, the census, findings 1–6, shape questions Q1–Q8, the coordination list and the
  provisional ladder S1–S6. Its census is from 2026-10-19. **The first look has shipped since** (sign-in, the Continue page, the
  forgot/reset screens, the two account emails and the consumer bar are rebuilt, on production 2026-10-20). **Re-verify every
  census row against the code before the walk says "as built"**, and move what is now warm out of the walk's problem list.
- `PUBLIC_FACE_WARM_PM_BRIEF.md`; the archived `docs/projects/archive/FIRST_LOOK_SIGNUP_PLAN.md` (what it built, and the public type
  rules it wrote that S1 starts from); `docs/agents/brand/` (voice: "Practical. Direct. Warm."; positioning "community sport").
- The portal's written type and colour rules **before drawing**: the `--type-*` ladder and rule F2/E3 in `app/globals.css`,
  `docs/agents/design/NAV_STANDARD.md`, the coach kit's CSS. The Premium Coaches Portal is the formatting benchmark.
  Auto-memory `design_principles.md` and `design_system.md` are obsolete.
- Auto-memory (outside the repo): `feedback_deep_dive_is_walk_then_stages` (**the pattern this session follows**: measured walk,
  standing back, ladder, end state drawn, never an intermediate state that looks like today), `feedback_project_hub_single_artifact`,
  `feedback_mockups_as_claude_artifacts`, `feedback_always_run_design_on_mockups` (run `/design` **before** the hand-off),
  `feedback_clickable_design_annotations`, `feedback_build_to_approved_mockups`, `feedback_portal_is_the_formatting_benchmark`,
  `reference_on_the_kit_is_not_current_look` (the terminal feel is type and words, not colour), `feedback_holistic_reeval_over_item_fixes`,
  `feedback_push_back_by_default`, `project_public_face_warm`.
- `AGENTS.md`, `AGENCY_RULES.md`, `CLAUDE.md`. **CLAUDE.md's rule binds you: broad reading goes to a helper agent** (the email
  builders and the marketing stylesheets are exactly that), and a helper's summary is a lead, not evidence. Open the cited lines
  before a station or a claim to the owner rests on them.

## What to produce

1. **One published Artifact** (its own page, not a Club hub; source in `docs/projects/active/`, e.g. `PUBLIC_FACE_WARM_WALK.html`;
   load `artifact-design` first). It holds, in this order:
   - **The measured walk.** Stations in the order a newcomer meets them: marketing home → pricing → a `/for-*` page → the sign-up
     door → the verify email (rendered in light and dark mail clients) → the Continue page → sign in → the welcome and invite emails
     → forgot password and its email → a family email → the 404 and offline screens. Add stations the census shows the walk
     missed: the walkthroughs, `/demos`, the changelog, link previews. Each station: **as built** (a capture plus measured numbers:
     which face, which case, which words), **my read** (what works, what gets in the way, what you'd change, as clickable finding
     flags) and its **shape question** with a recommendation, "what rides on it" and a notes box.
   - **Standing back:** the public type rules that cut across every station.
   - **The stage ladder:** a table of stage · covers · asks · state · **waits for** (the Club stages and Stage 13 from the
     coordination notes above).
   - **The end state drawn** at true size, a phone and a desktop for each page, one proposal screen per surface, each changed part
     tagged **NEW / RESTYLED / UNCHANGED** and with the **stage that delivers it**. Never today's look; never one stage drawn alone.
   - **Asks:** numbered, a recommendation on each, one checkbox per option, and a paste-back summary at the end. Carry Q1–Q7 from
     the plan, minus any the walk shows are already settled by what the first look shipped.
2. **Capture from staging or production, not the dev server.** The marketing pages are public. The Club Part B build is using the
   local dev server, and a cold sweep is the heaviest thing the repo asks of it. Capture signed-out pages with probes in `.probe/`
   against the staging or production address. Render emails by calling the builders and writing the HTML to `.probe/`; **send
   nothing**. Do not run a whole-product layout sweep.
3. **The identity (finding 5).** The brand has no written visual identity. Draw the proposal for S1 (type, case, colour, the
   wordmark, the voice) as part of the end state, with `/marketing` and `/design`. Q2's recommendation (keep the mono uppercase
   lockup and the ">" mark; soften everything around them) is the starting point to argue with.
4. **Words:** provisional copy in the frames, marked provisional. Final words go through `/marketing` after the owner rules, before
   any code. House rules: sentence case for buttons, "8:00 a.m.", `npm run check:spelling`.
5. **Run `/design` on the whole page before the hand-off**, apply its fixes, republish, and report what it changed. Run `/ux` on the
   one flow where order matters: sign-up through the first email to the first screen inside.
6. **Records, same unit of work:**
   - `PUBLIC_FACE_WARM_PLAN.md`: the ruling that it runs beside Club Tier, status "walked and drawn, asks open", the artifact link,
     and the ladder as drawn.
   - `TODO.md`: update the existing "The public face, warm" line (one line, linking the plan).
   - `PUBLIC_FACE_WARM_PM_BRIEF.md`: plain language, what a volunteer, a coach and a parent see differently.
   - The auto-memory file `project_public_face_warm` and its index line: the artifact link and "runs beside Club Tier".
   - Record rulings **as ruled**, adding nothing the owner did not rule.

## Push back (the owner asked for disagreement, out loud, before the work)

Say these on the page, not in a summary afterwards. Argue from what the code does.

1. **Finding 1 may be too narrow.** If the terminal feel is type and words, check whether the *first look's* screens (which already
   dropped the typewriter capitals) still read as a terminal anywhere. If they do, say so; if they don't, say that the same
   treatment is the fix for the marketing set and don't invent a larger redesign.
2. **Q1 is a reversal.** The 2026-07-23 design decision says marketing stays dark by design. State what that ruling protected
   (the marketing set moving as one) and show the end state keeps it.
3. **Q6 may belong to another project.** The ~30 public sport pages under an org's own brand overlap Tinted Panel Retirement's
   "second wave". Say whether the type change is a stage here or its own project, and what each choice costs.
4. **The email stage waits on Club.** If you think it should not wait, say which Club stage you believe it cannot collide with and why.

## Do not

- Build, migrate, seed, send an email or restyle a live page. This session draws.
- Publish to, or edit, any Club Tier hub. This project has its own page.
- Edit files another chat has modified and not committed (the working tree is shared; the Club Part B build is mid-flight). Stage
  explicit paths only, and ask before committing.
- Reopen what is ruled: the sign-up and sign-in screens and the two account emails (The first look, closed), the org-colour rule on
  public org pages (R1-2, M2) for colours, the "never claim Canadian identity" brand rule, and the pricing truth rule.
- Draw a navigation answer for a crossing between portals. That is Stage 13.
- Write the privacy policy or terms page. It is not a look question. Record it for `/strategy` as its own item (finding 6) and move on.

## Definition of done

The page is published and linked from the plan; `/design` and `/ux` have run and their changes are reported; every census row is
re-verified or marked unverified; each station has a shape question beside the drawing that answers it; the ladder names what each
stage waits for; the identity is drawn; the records say "walked and drawn, asks open"; and a build prompt for the first stage can be
written from the owner's answers without re-deciding anything.
