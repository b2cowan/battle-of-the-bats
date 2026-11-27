# Club Website Enhancements — Stage 3 drawing prompt (the photo shelf, then the site's face)

> Paste into a FRESH session: *"Read and follow docs/projects/active/CLUB_WEBSITE_STAGE3_DRAWING_PROMPT.md"*. Written
> 2026-11-27, after Stage 2 closed (commit `d09ef2362`). Plan: `CLUB_WEBSITE_ENHANCEMENTS_PLAN.md` (read §3, §4 F4 and
> F8, §5 ideas 7 and 11 with §5.1 in full, §6 Stage 3 and the "What idea 11 would do to this ladder" block under the
> ladder, §7's Stage 0 rulings and E9 with P1–P5, and §9's photo findings). Status lives on the board (project
> `club-website`). Where this prompt and the plan differ, the plan wins; where the plan and the CODE differ, the code
> wins — say so out loud before drawing on it.
>
> **Other sessions share this working copy and the dev branch.** Re-read the plan and the board line before writing
> them, and commit only your own lines (`reference_partial_commit_shared_tree.md` in auto-memory), never `git add -A`.

## What this session is for

A club's site today has no photo of a person anywhere. Stage 3 gives it a face without breaking a promise to families:
one place the club's pictures live (the shelf), a family's yes or no, a coach's ten-second send from a phone, the
club's pick, a way to take a photo down, and the first public places a picked photo shows. It comes before News
(Stage 4) so a news post is built with its photo from the start. It is the largest stage on the ladder, and **this
session decides whether it builds in one pass or two.**

**Stage 0 already drew the frame:** tab 11 of `CLUB_WEBSITE_STAGE0_DRAWINGS.html` (the club's feed) and the site-face
frames for idea 7. This session finishes them: true size, from the shipped components, every state. Do not redraw what
is ruled.

**Nothing is built here.** No code, no migration, no gate. The output is one published page and the owner's rulings.

## Already ruled — do not re-open (§7; the wording on the Stage 0 drawings' Asks tab is the current one)

- **C4 = A:** the ladder's order. Stage 3 = the shelf, the family's question, the coach's send, the club's pick.
- **C6 = A:** coaches and team staff send for their own team; the club picks; nothing is public until it does.
- **C7 = A:** one narrow "News and Photos" permission, drawn with the Team structure project.
- **C8 = A, softened 2026-11-24:** "the players in it are from this team; anyone else is in the background, not the
  subject". A recognizable child from another team as a subject does not show.
- **A8, A13, A14, A15, A16, C9 = A:** a player photo shows only while everyone in it has said yes (C8 widens this;
  read both); asked every season; a post is the unit, with no Photos page; no video stored; unused photos removed after
  12 months; the storage allowance and gate go to `/strategy`. A13 (where a rep family's answer comes from) and A16:
  take their wording from the Asks tab.
- **E9 and P1–P5 = A** (teams and camps ask one question): optional, two choices, neither picked, blank = No; one Yes
  names the club's website and its own social pages, never posters, share images, sponsor places or downloads; camp and
  team answers are separate; the answer stays changeable after the answers lock while Your sign-up works, the site
  hides the photo at once and the club takes down its own posts; fixed, versioned words.
- **A12 (the middle path):** an Instagram post shows as the club's own picture with a link. It is **Stage 4's** to draw,
  but its picture passes this stage's photo rule.
- **A9 is NOT final.** It reads "the banner stays computer-only", and the owner asked to see the banner on a phone both
  ways before confirming. Draw both.
- Parked, no stage: connecting an Instagram account, posting to Instagram, parents uploading from a public page,
  comments, likes, follows. The made-for-Instagram image is Stage 9's.

## Hear these before drawing

1. **`/legal` first.** Re-read `docs/agents/legal/MINORS_IMAGES_AND_CLUB_FEED.md`,
   `CLUB_WEBSITE_E9_PHOTO_QUESTION_REVIEW.md` and `CLUB_WEBSITE_STAGE0_RULINGS_REVIEW.md` against today's law (the first
   names its re-verify triggers) and against the policy versions published or approved now. The standing finding: **new
   Privacy Policy and Data Terms wording comes before any player photo is public.** Say which sentences, in which
   version, and whether the wording approved on 2026-11-27 changes anything.
2. **`/strategy`** on C9: the storage allowance per club and which plan the shelf belongs to, against
   `PLAN_PRICING_FACTS.md`.

## Read first (delegate the broad reading to helpers; open the lines a conclusion turns on yourself)

- The layout standard (`docs/agents/design/PUBLIC_PAGE_LAYOUT_STANDARD.md`), the club-site look rulings (in-repo
  `memory/design_decisions.md`) and the owner's UI conventions (auto-memory index) before drawing any control.
- The existing uploads: the club banner (`app/api/admin/org-hero-banner/route.ts`), the sponsor logo, which re-saves
  and drops location data (`lib/sponsor-logo-image.ts`), the club and tournament logos, the team crest.
- The site editor's look panel (`LookPanel.tsx`), the public club and team pages, the house league registration form,
  the rep sign-up and tryout forms, and the Coaches Portal's team home and game screens (where a send would start).
- Board Ready's camp sign-ups (its plan's Stage 7 and the E9 lines), which ask this stage's photo question.

## Part 1 — The walk and the census (answer from code, with file and line)

1. **Capture today at true size** (390 and 1280, DPR 1) on Kestrel Bay (dev): the club home with its banner on both
   widths, a rep team page, a house league season page, the site editor's look panel, the family's registration form,
   a coach's team home and a played game. Stage 0's captures may be reused where a screen has not changed; say which.
   A handful of screens, not a sweep (AGENTS.md for the dev server).
2. **Every picture upload today:** who may upload, where it is stored, whether it is re-saved or kept as sent, whether
   its address is public, and what removes it.
3. **Consent today:** every consent answer the product collects, where it is kept, whether a family can change or
   withdraw it, and the house league help text that suggests a required "photo release" document.
4. **The rep door:** is there anywhere a rep family can answer today? Check whether the guardian tier is switched on.
   With no door, no rep team photo ever shows, and rep teams are the ones with wins and trips.
5. **Who may change the site today**, what a coach or team staff can hand the club today, and where the Team structure
   project stands.
6. **Pictures in practice:** whether a phone's HEIC photo can be read where the product runs (local and production
   builds), the size limits, and what re-saving at web sizes needs.
7. **Where a photo could leak past the rule:** share images, link previews, calendar and email uses, downloads.
8. **What a build would need that does not exist** (the migration and storage list, for `/db`): the shelf record (who
   sent it, which team and event, whether it may show, where it shows), the answers and their versions, take-down.
9. **Check §9's four findings are still true** (no withdrawal, no take-down request, location data in the banner and
   logos, the help text). The location-data one is a small privacy fix that does not wait for this stage: if it is
   still true, say so and recommend building it first. It needs the owner's word.

Counts on dev; production as counts only, never rows. Put the findings in the plan's Progress block, then stop and
tell the owner what the walk found in a few plain lines before drawing. A `/clear` between Part 1 and Part 2 is fine.

## Three tensions to settle before drawing (say them out loud, recommend an answer, ask)

1. **What shows publicly in Stage 3?** A15 makes a post the unit, and posts are Stage 4. Name every public place a
   picked photo appears when this stage ships. If a coach can send and the club can pick but almost nothing shows until
   News, say so and re-cut the passes, or the stages' boundary.
2. **"Albums per event" (idea 7) against A15** (a post is the unit, no Photos page). Draw to the ruling and say what
   idea 7 loses.
3. **The "News and Photos" permission** is to be drawn with Team structure, which had not been drawn when this prompt
   was written. Recommend: draw it here to a shape Team structure can absorb, or wait for it. The board also records
   that this project finishes after Team structure.

## Part 2 — The drawing

Whole-screen before (the capture) beside after, true size, phone first, then the computer. Owed:
- **The family's question:** house league registration, the rep door (or what stands in for it), the camp form's
  version, changing the answer later, and what the family reads about where a photo can go.
- **The coach's send,** from a game, a tournament and the team home, with the tick in C8's words, and what the sender
  sees afterwards ("On the site" or "Not used").
- **The club's side:** "Photos to look at" grouped by team and event, each group saying whether it may be shown and why
  not, the pick and its one optional label from a short fixed list, and the club's own uploads.
- **The site's face:** the team photo on a team page, the banner on a phone both ways (A9), the look panel.
- **Take-down:** the public line for a parent who wants a photo down, how the club acts on it, and what a withdrawn
  answer hides at once.
- **States:** no photos; a missing answer; a No after a photo is up; a photo filed under no team; a sender who is not
  heard back; the 12-month clear-out; storage full; a file that cannot be read.

Hard limits: no AI-written words, and no photo or caption sent to an AI service (the Data Terms); no child named anywhere; no player photo in posters,
share images or previews; every picture re-saved without location data and no original kept beyond one large web size;
times only "8:00 a.m." through `formatTime()`; no motion; no follow, alert or share control in a browser; words go to
`/marketing` in ONE pass before hand-off.

## Part 3 — Reviews, then hand off

1. `/ux`, then `/design`, on the page before the owner sees it. `/db` reads the shelf's record, the storage rules and
   who can read a stored picture (a photo that may not show must not be reachable by its address). `/legal` reads the
   finished drawing.
2. **Publish ONE page** (a Claude Artifact, an HTML page, the house layout; never the canvas): the walk, the census,
   the drawings and the asks with a paste-back line. Every highlighted thing is clickable to its ask.
3. **The asks,** a recommendation on each, option A first. Expected at least: one build pass or two; the three tensions
   above; A9 confirmed; the rep door; who may take a photo down and how a parent asks; the storage allowance and gate
   (with `/strategy`'s answer); the policy wording (with `/legal`'s answer). Do not ask what to do first; recommend an
   order.
4. **The build's shape,** written for the build prompt: the privacy wording and the migration first (with
   `DATA_DICTIONARY.md` and `npm run refresh:snapshots` in the same unit), the passes, the guard tests (no photo
   reaches a public page without its rule), what the help articles gain (`/docs`), and what the demos will show.
5. Records: the plan's Progress block and §7 (the asks), §10 for the words, the PM brief if scope moved, the board line
   (phase and next). No commit without the owner's word.

Milton Bats' answers to the three website questions go in `CLUB_WEBSITE_STAGE0_PROMPT.md`'s feedback slot. Re-read it;
if they are in and bear on photos, test the drawing against them. If not, say so on the asks tab and draw anyway.

## Done means

One published page the owner can rule from; every picture upload and consent answer traced to its code; `/legal` and
`/strategy` heard; every public place a photo would show drawn at true size, phone and computer; the asks waiting;
nothing built.
