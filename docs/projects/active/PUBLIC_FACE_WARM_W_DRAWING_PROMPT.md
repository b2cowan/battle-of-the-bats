# The public face, warm — W: the wordmark, the browser-tab mark and the home-screen icon (drawing session prompt)

> **Written 2026-10-23.** **Paste this into a new chat on `dev`.** **Model: Opus, effort high.** **A drawing session:
> nothing is built.** It runs in parallel with the signed-out build and S1, and touches no code. It must be **ruled before
> S4** (the marketing set). Plan: `PUBLIC_FACE_WARM_PLAN.md`. Walk page: https://claude.ai/artifact/M1ehQVxvLzMiTZfJDMtcft
> (the Identity tab shows today's wordmark and the ">" mark).

## The ruling that starts this (owner 2026-10-23; record nothing it did not say)

- **Ask 2 C:** the wordmark is **redrawn** as its own piece of work before S4.
- **Follow-up, the owner's "yes":** the redraw **includes the browser-tab mark** (today the lime ">", which also sits in the
  admin and coaches-portal top strips) **and the phone home-screen icon** (today a separate "FL / HQ" mark on a dark square).
  Drawn together, as one identity.
- The owner did not say what the new marks look like, whether the ">" survives, or whether lime stays. Those are this
  session's asks.

## Why (argue from this, not from taste)

- The bar for the whole project: a volunteer, coach or organizer feels on day one that this was made to run their league or
  team, **not a terminal**. The audience is mainly not technical.
- **Today the brand has three marks that don't match.** Verify each in the code before you state it:
  - the **wordmark**, typewriter capitals in five slightly different versions: the marketing bar, the consumer bar, the
    footer, the emails, and the unsubscribe page. The first look's three-ink version (FIELD ink · LOGIC olive · HQ grey) is
    in the consumer bar and the account emails;
  - the **">" mark**: `public/favicon.svg`, a lime chevron on a dark square, also in `components/shared/BrandLockup.tsx` on
    the admin and coach top strips;
  - the **home-screen icon**: `public/icons/pwa-192.png`, `pwa-512.png`, `pwa-512-maskable.png` ("FL" over a rule, "HQ", on
    dark with a navy corner), plus `badge-72.png` (the notification badge) and `favicon.ico`.
- **">" is a command-line prompt.** It is the most terminal symbol the brand owns, and it is in every browser tab.
- **A standing decision to weigh, not obey** (`memory/design_decisions.md` 2026-06-17): the logo is "the cross-shell
  continuity anchor", identical in every shell. Its reason (one symbol everywhere) can survive a new mark. Keep that job.

## Read first

- `docs/agents/brand/BRAND_STRATEGY.md`:
  - voice "Practical. Direct. Warm.";
  - positioning "community sport";
  - **never claim Canadian identity** (no maple leaf, no "Canadian" in an identity piece).
- The walk page's Rules tab (P1–P10), its Identity tab, and the ruled colour palette (paper `#F8F4ED`, ink `#241E15`, olive
  `#57651E`, lime `#D9F99D` as a fill only; E3).
- The auto-memory: `feedback_sport_neutral_no_debt` (no sport-specific symbol: the product serves many sports),
  `decision_self_hosted_fonts_no_go`, `feedback_mockups_as_claude_artifacts`, `feedback_always_run_design_on_mockups`,
  `feedback_clickable_design_annotations`, `feedback_deep_dive_is_walk_then_stages`, `feedback_push_back_by_default`.
- The name is spelled **FieldLogicHQ**. The wordmark's casing is a design choice. The name is not.

## Where the marks must work (draw every one; a mark that fails one of these fails)

- **The browser tab** at 16 and 32px, on light and dark browser chrome.
- **A phone home screen** at 192 and 512, including the **maskable** safe zone (Android crops to a circle or rounded square).
  Also the notification badge, a 72px single-colour silhouette.
- **The marketing bar and footer** (warm), **the consumer bar** (warm, and the portal's Dark for a signed-in Dark user),
  **the admin and coaches-portal top strips** (warm and Dark).
- **Email:** email cannot load web fonts. Today's wordmark falls back to Courier New, and images are blocked by default in
  some mail apps. Recommend text, an image with alt text, or both, and draw what each mail app shows.
- **The marketing share card** (1200 × 630).
- **Small and one-colour**, for a club's printed paper footer or a "Powered by FieldLogicHQ" line.
- **Fonts:** Google Fonts only. A self-hosted font is a standing no-go, and an outlined SVG wordmark needs no font at all,
  which may be the answer.

## What to produce

**One published Artifact**: its own page, never a Club hub. Source in `docs/projects/active/PUBLIC_FACE_WARM_W_DRAWINGS.html`.
Start with the Artifact tool's `quickstart` (intent `design`) and follow what it returns. Then:

1. **Today:** the three marks, captured where they appear, with what works and what reads as a terminal.
2. **Two or three directions.** Each one shows:
   - the wordmark, the mark and the home-screen icon together;
   - every place in the list above;
   - warm and Dark.
   - Directions differ in idea, not in tint.
   - One direction may keep a reworked chevron if it earns it. Say plainly what each keeps and drops from today.
3. **A recommendation**, argued from the bar and the rules. Disagree out loud if the question is wrong.
4. **What changes when it ships:** existing users' installed home-screen icon changes, browser and home-screen caches, the
   files and places each mark lives, and what S4 and S3a pick up. Draw no navigation; the bars' layout is ruled.
5. **Asks** with one checkbox per option, a recommendation on each, notes boxes and a paste-back block (the house format).
6. **Run `/design` on the page before the hand-off**, and `/marketing` on the name treatment and any tagline lockup. Apply
   their changes, republish, and report what changed.

## Do not

- Build, change an icon file, or edit a live page.
- Re-open what is ruled: always warm, P1–P10, one lime per view, the envelope design.
- Edit TODO.md if another session has uncommitted edits in it (say so instead).

## Records, same unit of work

- The plan's ladder row for W ("drawn <date>, asks open", plus the artifact link).
- The auto-memory `project_public_face_warm`.
- Record rulings as ruled, adding nothing the owner did not rule. The design log gets an entry only once the owner rules.
