# Tryout blurb preview — "How families see it" (Club Tier Stage 4c-2 follow-up)

Drawn and ruled 2026-10-22 (all five asks as recommended): `docs/projects/active/TRYOUT_BLURB_PREVIEW_MOCKUP.html`,
published as an Artifact. Brief: `TRYOUT_BLURB_PREVIEW_PM_BRIEF.md`.

## What it is
Beside the "From the club" box on a team's admin Tryouts page, a laptop-wide Sign-ups card draws the public tryout page
at a phone's width: title block, "From the club", the Sign up button. It is the real page (`TryoutLandingView`, a
`preview` form with no way back), inert, wearing the club's colours and chosen face, fed the words as typed and the state
the page really stands in (open · not open yet · closed; a finished tryout reads as closed).

## Rulings (the drawing's five asks)
1. Title block + From the club + Sign up button only (no tryout days, no contact line).
2. Right of the box, only when the row has room for the box and a 360 px preview (container query at 900 px on the
   row, not the window). Narrower and on a phone: not drawn, nothing moves.
3. Updates as the club types, before the autosave.
4. Follows the page's real state; when families would not see the words, one amber sentence says so.
5. Named "How families see it", with "Updates as you type" beside it. Nothing in it can be pressed.

## Design review changes (2026-10-22)
The box's own "when families read this" sentence steps aside where the preview already says it (open and closed; "not
open yet" keeps its sentence); the "tryout days sit above" note was dropped; one amber sentence in the closed state.

## Build notes
- `components/public/ClubFrame.module.css`: the club's tokens are now `.site, .tokens`; the page-frame-only declarations
  (position, flex, `min-height: 100dvh`) moved to `.site`. The preview wears `.tokens`, never `.site`, because
  `:has(.site)` paints the whole `<body>` and zeroes the phone bar.
- `lib/tryout-blurb-preview.ts` (pure: state + note), `components/admin/kit/club/TryoutBlurbPreview.{tsx,module.css}`,
  wired in `TryoutBlurb.tsx`; the page hands in team, season, born years and the club's face.
- Tests: `tests/unit/club-tryout-blurb-preview.test.ts`.

## Known simplifications
- A finished tryout previews as "isn't taking tryout sign-ups right now" (the words are hidden either way); the real page
  says "finished on …".
- A closed season has no Sign-ups card, so no preview.
- The status card's contact line is absent in the preview (the contact is the club's, not its words).

## Owed
Owner walk at a laptop width (and a phone, to confirm nothing changed); `/review`; `/docs` (org help article on the
tryout page mentions the blurb); commit.
