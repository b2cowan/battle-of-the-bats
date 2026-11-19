# Prompt — Selling the release: a holistic marketing review by audience

> Paste everything below the line into a new chat. Written 2026-11-18 from the on-sale pages session.

---

You are reviewing FieldLogicHQ's **whole public marketing surface** for the release that puts **League Plus, Club and
Club · Association on sale** beside the plans already sold (Tournament free, Tournament Plus, Premium Coaches Portal).
A planning session has already drawn what each page says once those plans open. Those drawings mostly **switch the
words over**: "Express interest" becomes "Start your trial", and the tax and trial sentences are added. They do not ask
whether the pages **sell**. Your job is to ask that, audience by audience, and add the features, sections and ideas
that would make this release land, **on top of** the existing drawings, not instead of them.

The owner's words: *"evaluate all of this holistically given our target audiences and what we can do to improve our
marketing to them … add some more features and ideas to the existing mockup to make our release really sell."*

## ⚠ This is NOT a new project: it folds into the on-sale pages plan (owner, 2026-11-18)

The owner does not want two projects with the same overlap. Everything this review produces **merges into the one
existing plan of record**, `CLUB_ON_SALE_PAGES_PLAN.md`. That plan is itself one piece of the Club tier readiness line
on the board ("the on-sale pages build"). So:

- **No new plan file, no new PM brief, no new board line, no new TODO line, no separate drawings artifact, no separate
  findings document.** This prompt file is the only extra file, and it is a prompt, not a plan.
- **Findings and accepted ideas become stages of that plan.** Words and new sections on existing pages go **into S3
  (the pages' open state)**, extending its screen list, or into a clearly named sub-stage beside it (for example
  "S3b — the audience grouping and new sections") if S3 would grow too large for one build session. Order them by
  dependency and rework risk, as the plan's other stages are.
- **Where something you propose replaces part of the existing proposal** (a W-number, a drawn section, an owner ask),
  **replace it in place**. Mark it as superseded with the reason, and don't leave two live versions side by side. An
  owner ask that has already been ruled is the exception: raise a re-frame instead of overwriting it.
- **Your evaluation lives in the plan** (a new section, e.g. "Audience review, 2026-11-xx") **and in the drawings** (a
  tab or the "Start here" tab), not in a standalone report.
- **"Needs product work" ideas are the only thing that leaves the plan.** They go to `docs/projects/IDEAS_BACKLOG.md`
  (or to `/plan` if the owner wants one now), each with a line in the on-sale plan's "Found outside this build" section
  pointing at where it went.
- If the review changes what remains for the release, update the **existing** Club tier readiness board line's
  "remains"/"next" wording in `docs/agents/strategy/OWNER_BRIEF_PROJECTS.json`. Don't add a project.

## Read first (in this order)

1. `CLAUDE.md`, `AGENCY_RULES.md`. Especially: **disagree out loud**, **widen the question when the evidence is
   wider**, the **one-spelling** rule, the routing to `/marketing`, `/strategy`, `/legal` and `/accounting`, and
   **broad reading goes to a helper agent** (this review reads ~15 pages; delegate the censuses and read the lines
   your recommendations turn on yourself).
2. The on-sale plan and its brief: `docs/projects/active/CLUB_ON_SALE_PAGES_PLAN.md` (its **"Already ruled"** section
   and its **"Owner asks"** list) and `CLUB_ON_SALE_PAGES_PM_BRIEF.md`.
3. The words: `docs/projects/active/CLUB_ON_SALE_COPY.md` (W1–W57, a `/marketing` draft, not ruled).
4. The drawings: artifact https://claude.ai/artifact/CJ39nz8YunjGxRViXtQ3K7, source
   `docs/projects/active/CLUB_ON_SALE_PAGES_DRAWINGS.html`, page captures in `docs/projects/active/club-on-sale/`.
   Tabs: 1 Start here · 2 /pricing · 3 Plan cards · 4 /for-clubs · 5 /for-leagues & home · 6 Club start ·
   7 League Plus start · 8 In the product · 9 Interest form · 10 Your calls.
5. The facts you may not contradict: `docs/agents/strategy/PLAN_PRICING_FACTS.md` (**the only source for a price,
   name, band or gate. Never type a new number.**), `docs/agents/strategy/BUSINESS_DECISIONS.md`,
   `docs/agents/brand/BRAND_FOUNDATIONS.md`, `BRAND_STRATEGY.md`, `PRICING_PAGE_COPY.md`, `VISUAL_IDENTITY.md`.
6. The pages themselves (read the code; the captures show today's dev and prod rendering): the home page
   (`app/page.tsx`), `/pricing`, `/for-tournament-organizers`, `/for-coaches`, `/for-leagues`, `/for-clubs`,
   `/see-it-live`, `/demos` (the two no-login demo sandboxes), `/pitch`, `/changelog`, the start chooser and its four
   doors (`app/(consumer)/start/` — tournament, team, league, club; plus `app/coaches/start/`), the interest form, and
   the shared public nav and footer.

## What the owner already raised in the planning session (proposed, NOT ruled)

**1. The plan grid is grouped by price ladder, not by buyer.** Today's drawing shows two rows: "Tournaments and
leagues" (Tournament, Tournament Plus, League Plus) and "Clubs and coaches" (Club, Club · Association, Premium Coaches
Portal). The owner sees **three audiences**, and the planning session agreed and proposed:

- **Running a tournament:** Tournament · Tournament Plus.
- **Running a league or club:** League Plus · Club · Club · Association. Same buyer (a volunteer board running an
  organization), and it gives a clean three-step ladder: house league only → add rep teams and accounting → bigger
  organization.
- **Coaching one team:** Premium Coaches Portal, drawn as a **full-width band, not a lone card**, carrying the free
  Coaches Portal every tournament gives a coach and "If your club is on Club, every coach is already included."
- League Plus leaves Tournament Plus's side, so it leads with "Running a tournament too? It's in your plan."
- The "What does your role look like?" picker at the top of /pricing has **four** doors today (tournaments, coach,
  house league, club). It should have the **same three** as the bands, each jumping to its band. Today's order was
  "live products lead, coming-soon ones follow". That reason expires at this release. Its coach door still says
  "Express interest in the Coaches Portal" although Premium has been on sale since July.
- Proposed order: tournaments → leagues and clubs → coaches.
- Widened: the **home page** shares the six-card grid with /pricing. Proposed instead: three audience doors ("I run
  tournaments, free to start" / "I run a league or club, from $X" / "I coach a team, $X"), each linking to its
  /pricing band and its own page. The full grid lives only on /pricing. (Take the figures from the Facts doc.)

Test these. Agree, refine or argue. Two questions in particular: **is three the right number of audiences?** (A house
league board and a club executive with rep teams may need different first sentences even inside one band.) And
**should the public nav's separate "Leagues" and "Clubs" entries follow the same grouping?**

**2. The drawings are not drawn where they claim to propose.** On /pricing, /for-clubs, /for-leagues and the home page,
the "Open · proposed" state is **today's screenshot with a note pinned beside it**. Only the plan cards and the two
start pages are redrawn. So the proposed /for-leagues still shows "Express interest in League Plus" in its hero. The
owner caught it. **Every proposed section you keep or add must be drawn with its real words**, not annotated over a
capture.

## What to evaluate: for each audience, then across all of them

Walk the surface **as each buyer**, from the first page they would land on to the moment they start a trial or sign up:

- **The first ten seconds.** Does the page they land on say, in their own words, "this is for you"? Can a coach, a
  tournament organizer and a club treasurer each find their plan without reading the other two?
- **The job and the pain.** What is each buyer doing today (spreadsheets, group chats, three apps, a treasurer's
  shoebox, volunteer turnover every year)? Does the page name that pain and show the product removing it?
- **Proof.** We have no customers yet. **Never invent a testimonial, logo, quote or statistic.** What honest proof do we
  have? The live demos (`riverdale-minor-ball`, `riverdale-ridge`), real live tournaments, screenshots, Canadian
  specifics (CAD, taxes handled), the board pack. Is it used at the moment of doubt, or buried?
- **Objections.** Switching mid-season, moving our data in, volunteers who aren't technical, the board approving the
  spend, what happens when the treasurer changes, privacy of children's information, the price against a free
  spreadsheet, being locked in. Which ones does the surface answer, where, and which does it leave open?
- **The trial.** Club 90 days, League Plus 30 (check the Facts doc). A payment method is taken at checkout. Is that
  framed as confidence or as a hurdle? What would make a board say yes to starting one?
- **The path between audiences.** The tournament organizer who also runs the house league, the coach whose club could
  buy Club, the League Plus board that adds rep teams. The upgrade bridges, cross-sells and "Everything in…" lines:
  do they move people up, or just list features?
- **Calls to action.** One primary action per page and per band? Any dead end, duplicate, or leftover "Express
  interest" / "Coming soon" / "in development" once the plans open?
- **Across the surface.** The home page, the nav, the footer, the FAQ, the demos and `/pitch`: do they tell one story?
  What does a buyer who is comparing us with another product need that no page gives them?

Then **add**: new sections, features or ideas for the pages that would make the release sell. Examples of the kind of
idea wanted (judge them, don't adopt them by default): a "which plan am I?" chooser, a side-by-side comparison
table, a "what your board gets" section, a season-in-a-picture strip, a switching guide, a demo deep-link per
audience, a coach-to-club referral line, page titles and descriptions that each audience would search. **Keep each
addition buildable from what the product actually does today.** Before promising a feature on a page, find it in the
code. A promise the product can't keep is a defect, not marketing.

## Rules for the work

- **Push back.** If the owner's three-audience framing, the planning session's proposal, or an existing drawing is
  wrong, say so before building on it, and argue from what the code and the facts say.
- **Ruled things stay ruled** unless you have a reason on the merits. In that case raise it as an explicit re-frame for
  the owner; never quietly redraw over it. The plan's "Already ruled" section lists them.
- **Words:** run `/marketing` for every customer-facing sentence you add or change. Record the result in
  `CLUB_ON_SALE_COPY.md` as new W-numbers after the last one, with Today / Open / Closed-also-changes like the rest.
- **Positioning, packaging, grouping, what each plan is "for":** these are business decisions. Route them through
  `/strategy` as **Proposed** (logged only when the owner accepts).
- **A claim about privacy, children's information, emails, consent, terms or "your data is yours":** run `/legal`.
  **Tax or trial-charge wording:** run `/accounting`.
- **Numbers on a page come from the Facts doc. Numbers about a demo come from its seed.** Anything else is not in the
  sentence.
- **Spelling and clock:** one spelling everywhere, "installment", "8:00 a.m.". Run `npm run check:spelling` on any
  copy you write into the repo.
- **No release timing.** Sequence by dependency and rework risk, never "when".
- **No code changes and no commits.** This is a review and a drawing session. The owner commits on his own word.
- **The drawings:** extend the **same artifact** (read the live version first; another session may have edited it).
  Draw every proposed section with real words, at true size, desk and phone, in the house layout the existing tabs use
  (sticky tabs, state / device / size / view switches, "Everything / Show only what differs"). Mark each new piece
  with the existing tags (New / Changed words / Unchanged). Run `/design` on the drawings **before** handing them to
  the owner.

## What to hand back

Everything below lands inside the existing on-sale project (see "This is NOT a new project" above).

1. **The evaluation**, in product-owner voice, written as a section of `CLUB_ON_SALE_PAGES_PLAN.md`, summarised in
   the PM brief and on the drawings' "Start here" tab. Per audience: what works, what's missing, what would most improve the
   chance of a sign-up. Ranked by impact on the release, not by page order. Lead with the three to five changes that
   matter most.
2. **The ideas list.** Each idea gets: the audience it serves, the page, what the visitor sees, why it sells, the
   product feature it relies on (found in the code), and its size: **words only** · **a new section on an existing
   page** · **needs product work**. Keep "needs product work" ideas separate. They go to `docs/projects/IDEAS_BACKLOG.md`
   or `/plan`, not into this release by default.
3. **The extended drawings** at the same artifact link: new and redrawn sections, every "screenshot with a note"
   replaced by a drawn section, and the three-audience grouping drawn (or your counter-proposal drawn beside it).
4. **New owner asks** on the "Your calls" tab and in the plan's "Owner asks", numbered after the existing ones, each
   with a recommendation. Include the two from the planning session (the grouping and the home page doors) unless the
   owner has ruled them by the time you start (check the plan's owner asks section first).
5. **The build stages:** S3 extended (or an S3b beside it) so the next build prompt from this plan carries the
   additions. Anything you replaced is marked superseded in place.
6. **Records:** update the plan, the PM brief and the copy doc in the same pass. Add a line to the Claude memory file
   `project_club_on_sale_pages.md` naming what you added and what is open. Nothing committed.
