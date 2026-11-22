# Prompt — Board Ready · the public Security page, Step 1: the words (`/marketing`)

> One session, pasted into a fresh chat on `dev` (`/clear` first). Written 2026-11-21. Run it on the session's main
> model: every sentence on this page is a claim about the product to a board, so this is judgment work, not
> copy-polish. It edits one text and republishes one private page. It changes no product code, publishes nothing
> publicly and promotes nothing. Plan of record: `BOARD_READY_PLAN.md` §0c, the "public Security page" item, steps S1–S5.

Run `/marketing` and do the pass below. Run `/legal` in the same session on every sentence whose meaning you change
(see "The lock").

## Why this matters (read first)
Every club board asks the same two questions: *does our data leak, and is it sold?* The owner ruled on 2026-11-21 that
the security brief written for the Milton Bats board becomes a public Security page on the marketing site, open to any
prospect. `/legal` checked the brief line by line against production that day. This step turns it into page copy in the
brand's voice **without changing what any line claims**. A line that says more than the product does is the most
expensive mistake available on this page. A board that asked about leaks will hold us to it.

## One text, two outlets
There is one text: `docs/agents/legal/drafts/SECURITY_BRIEF.md` (v0.2). Today it is published as a private page the owner
shares (https://claude.ai/artifact/2qBeedXuyYTRPs1MEo8TUR). Later it will be the public `/security` page (steps S2–S3). **Edit
that file in place to make it the page copy (v0.3).** Do not write a second "marketing version" beside it; two texts
drift. When S3 builds the page, the product's copy becomes the home and the draft is replaced by a pointer (the `/legal`
one-home rule).

## Where to start (re-read the lines you build on; do not trust this summary)
- `docs/agents/legal/drafts/SECURITY_BRIEF.md`: the text, its header, its **"Revise when"** and **"Never add"** lists.
- `docs/agents/legal/MILTON_PRESENTATION_SECURITY_BRIEF_REVIEW.md`: one row per claim (verdict, exact wording, what it rests
  on, its condition). Each sentence in the brief maps to a row there. §0 settles what is on production.
- `components/marketing/BoardQuestions.tsx`: the club and league pages' "Questions a board asks". Answers 3 and 4 say the
  same things in other words. The two surfaces must agree.
- `docs/agents/brand/BRAND_STRATEGY.md` (voice) and `docs/agents/brand/VISUAL_IDENTITY.md` (how it sounds; type is for S2).
- `BOARD_READY_PLAN.md` §0c (the Security page item and its PM brief) and §0d (the owner-continuity ruling).

## The lock: what you may and may not change
**May change:** headings, section order, sentence rhythm and length, the opening, joining or splitting sentences, cutting
repetition between sections, the page's own furniture (below).
**May not change without `/legal` in this session:** what any sentence claims: its subject, its scope ("each club and person
record", "player documents", "our database"), its tense, its number (7 days, 1 hour, AES-256), its supplier names, its
certification wording. If a rewrite moves a claim at all, run `/legal` on it and record the before/after in the brief's
change log with `/legal`'s verdict. When in doubt, keep the `/legal` wording; it is already plain.

## Rulings that bind this pass (cite the reason, do not reopen them)
- **Hosting is stated plainly as the United States (Ohio)**, suppliers named; never "Canadian" as a selling point
  (`BOARD_READY_PLAN.md` §0b, owner 2026-11-10).
- **The owner-continuity question is not on the page** in any form, including softened ("we're built to last") (§0d, owner
  2026-11-16).
- **No certification, audit or penetration test of our own.** The page states the checks we run ourselves (pen test ruled
  out of scope 2026-11-15). W6's second sentence ("These are their certifications, not ours.") goes wherever its first
  sentence goes.
- **"Every finding fixed" is never said; "every finding resolved" only after the access follow-ups are on production**
  (sweep call 22; roadmap §4 item 5). The current line stays.
- **"Restore rehearsed"**: allowed (rehearsal passed 2026-11-18), as "a restore from a backup". Never "full restore".
- **No prices, plan names or offers** (pitch ruling 2026-08-21). The page is about security, not selling a plan.
- **One spelling, everywhere a customer reads it** (`AGENCY_RULES.md`). Known drift to settle in this pass: the brief says
  **"date of birth"**, `BoardQuestions.tsx` answer 3 says **"birth date"**. Grep the product for both, pick the one the
  product already uses most, and use it on both surfaces. A change to `BoardQuestions.tsx` is product copy: record it as a
  task for S3, do not edit the component in this session.

## Known questions to settle in this pass
1. **The opening.** The brief opens "Boards ask us two plain questions…". A public page is read by presidents, treasurers
   and parents too. Keep a board framing or widen it. Recommend, with the line.
2. **The supplier table on a public page.** It names ImprovMX and Gmail for mail people send us. Keep it (`/legal`: an
   omission is the risky direction), and say how to keep it short.
3. **The page's own furniture**, each written now so S2 can draw it:
   - the page title and the search description;
   - the footer link label (beside the legal links);
   - a "Read more" block linking Privacy Policy and Terms, **and the Data Terms and the list of companies only once those
     pages publish** (write both versions: with and without them);
   - the "as of" line (today the brief's footer: "This brief describes how FieldLogicHQ works as of {date}") and who
     updates it (S5's release check);
   - how `BoardQuestions.tsx` points to the page (one link label), recorded for S3.
4. **The two Data Terms promises the page can't make yet** (72 hours; 30 days' notice of a new company; a full copy within
   30 days). Write the sentences now, marked as held until the Data Terms publish, so S3 can switch them on with the links.
   Use `/legal`'s W8/W9 wording.

## What to hand back
1. `docs/agents/legal/drafts/SECURITY_BRIEF.md` **v0.3**: the page copy, with its change log naming each sentence
   whose meaning moved and `/legal`'s verdict, the furniture from question 3, and the held sentences from question 4. Keep
   the "Revise when" and "Never add" lists, updated.
2. The private page republished from it at the **same URL** (https://claude.ai/artifact/2qBeedXuyYTRPs1MEo8TUR): read it
   first and build on the live version, since another session may have edited it. Keep the checked diagram unchanged, its
   labels included, unless `/legal` re-reads a changed label.
3. `BOARD_READY_PLAN.md` §0c: tick S1 with the date, and list the tasks it leaves for S3 (the spelling fix in
   `BoardQuestions.tsx`, its link to the page). The Board Ready line on the board changes in the same commit.
4. A short list for the owner: the opening (question 1), anything you recommend cutting, and any call that is only his.

## Not in this session
The page's layout and drawing (S2, `/design`). The build, the footer link, `BoardQuestions.tsx` (S3). The release check line
(S5). Publishing anything publicly. The sign-up data-flow diagram (a separate §0c item). Do not commit without the owner's
word; stage explicit paths only.
