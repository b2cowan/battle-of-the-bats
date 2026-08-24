# PM Brief — PDF Export Quality

**Plan:** `PDF_EXPORT_QUALITY_PLAN.md` · **Status:** **PHASE 1 + PHASE 2 PASSES 1–3 OF 6 BUILT on dev 2026-08-23** (QA §79, §82, §84, §86)
— the shared plumbing: one title, the right name for the layer, real logos, true page counts,
per-report shape, the no-shred fit contract, the coaches "How your documents look" card, and the
three lying menu buttons removed. Phases 2–3 (group passes, rendered CI check) remain. Owner
planning session held 2026-08-21; every structural decision made against rendered evidence
**Evidence gallery:** https://claude.ai/code/artifact/834cdd89-8c24-416f-acd8-c1930ff76dd1
**Priority:** medium-high — these documents are seen by treasurers, boards and parents who are not
our customers, and two of them are shipping unreadable

## Where it has got to

**Phase 1** fixed the plumbing every document shares. **Phase 2 pass 1 — the Registers group** then
judged the documents a treasurer or registrar reconciles against, one at a time on rendered paper:
tournament results now fits with no fine print; the coach month view's PDF button produces the
whole-season statement a board actually reads, and says so before you pick it; a ten-category tryout
scorecard keeps every category; and House League registrations and rep tryout applicants print the
real registers their removed "coming soon" buttons had promised — neither carrying a date of birth
or a guardian contact, because a printed page gets forwarded and left on tables.

Two defects nobody was hunting for surfaced by looking at the paper: column headings were being
measured in the wrong typeface and then trimmed, so real reports printed broken words; and the
club's Budget vs. Actual spent a whole column repeating the heading directly above it. Both fixed,
and two documents outside the pass (the team roster and the practice sheet) needed a guard so the
heading fix did not cost them a column.

**Phase 2 pass 2 — Statements & handouts** built the document this whole group existed for: a
**dues statement a coach can hand one family**. Until now the only dues paper was the team sheet —
every family's balance on one page — so a coach chasing one household had nothing to send that
didn't disclose the neighbours'. The statement is one page per household (siblings share it):
what they were billed, what they've sent (thanked), credits earned from fundraising, what's left,
and what's next in plain sentences. Every money state has honest words — a paid-up family gets a
receipt, credit set aside is never claimed as "applied", money handed back has its own section.
Two ways to get one: from the player's own drawer (one family, one conversation) or a whole-team
print run — one file, every family on its own page, page numbers restarting per family so a page
handed out never says how many statements exist. Delivery is deliberately the coach's own hand:
email attachment stayed unbuilt, and the reminder emails' "contact your coach" ending now has a
real answer. The tryout board summary also gained the club's crest, and all three handouts had
their identity states confirmed on paper. This also makes true the marketing page's standing
promise — *"player dues statements formatted for parent distribution."*

**Phase 2 pass 3 — Rosters** answered a question the group had been carrying: *who is standing in
front of this paper?* A roster is the one thing this product prints that gets **pinned where
strangers walk past** — a dugout, a rink board, a check-in table — and the only roster we could
print carried every child's date of birth and every parent's email and phone. Worse, the switch
that controls guardian contacts lives in **club** admin settings, so a **standalone coach — the
exact customer the standalone Premium Coaches Portal is sold to — had no way anywhere in the product to turn it off.**

So the roster is now **two documents in one Export menu**, the safe one first. *Team roster* gives
numbers, names and positions: pin it anywhere. *Roster with contacts* adds dates of birth and
guardian details for a league or insurance submission, and appears **only** for a coach granted
family contacts — which also retires a defect where an assistant without that access printed four
empty columns across 40% of the page. The club's guardian-contacts switch keeps working on the
second sheet. The **rep program-year roster** now prints too — on the club's paper, grouped by each
player's standing with counts, at the same no-contacts floor the new registers took.

Two things rendering caught that nobody was hunting for. **Page 2 of any long report had no idea
whose it was** — no crest, no club or team name, on every document in the product that ever ran past
one page; Phase 1's identity promise had only ever been true of page 1. Fixed for everything, and
proved free by re-reading all 54 documents before and after to identical page counts. And a
guardian-contacts spreadsheet on the rep tryouts screen had **no plan check at all** while the
contact-free PDF above it was locked — now corrected.

**Three group passes remain** — working sheets, schedules, posters and brackets — each with its own
rendered sign-off, then the Phase 3 check that renders documents in CI so this class of rot cannot
return unseen.

## The problem, now with proof

The documents our customers print and hand to other people had never been looked at. In the planning
session every one of them was generated with the product's real code and looked at. The verdict: the
engine is capable — the schedule, dues sheet, dugout poster, batting card, tryout board summary and
bracket already look respectable or better — but five pieces of shared plumbing betray everything,
and the two widest reports come out genuinely unreadable.

## What a customer gets today

- **A brand-new org's every PDF prints its own title twice** and carries no club identity — while
  the settings screen claims blank fields "default to your org name."
- **No organization has ever had its logo on a PDF.** The "Use org logo" setting stores nothing;
  the alternative is marked coming soon; nothing connects the uploaded logo to any document.
- **The coach's month-view budget PDF is 7 pages of vertical confetti** — column headings and
  dollar amounts printed one character per line. The tournament Results report is 9 pages for 24
  games, with children's names shredded the same way and rows split mid-cell across page breaks.
- **The page counter lies:** a 9-page report's footers read "Page 1 of 1", "Page 2 of 2"…
- **Three export menus offer a PDF that doesn't exist** — clicking shows "coming soon", once as a
  green success message.

## What was decided (owner, 2026-08-21)

- **Six groups**, by what the paper is for: registers · statements & handouts · rosters · schedules
  · working sheets · posters/cards/brackets. Each has its own definition of good.
- **Every report declares its own shape** (landscape/portrait); the org-wide preference applies only
  where either fits. This is what the three hand-fixed screens already do — it becomes the rule.
- **The month grid stops pretending to be a PDF.** Its PDF button produces the one-page category
  statement a treasurer actually reads; the month-by-month detail stays in Excel (evidence: even
  landscape made the grid *worse* — 7 pages became 11).
- **The lying menu buttons come out now**; each missing PDF gets built properly in its group's pass.
- **Content fixes approved:** the Results handout drops its internal audit columns; dues gains a
  per-family statement (today's sheet shows every family's balance to whoever it's handed to); the
  tryout check-in sheet — the first paper a trying-out family ever sees — finally carries the club's
  name; the drawn documents get the logo once logos are real.
- **A standing rule for what deserves a PDF:** read, handed, or pinned → PDF; data someone works in
  → spreadsheet. The ~20 spreadsheet-only exports all pass today; nothing new is owed.
- **Branding becomes two layers, and every coach gets one** (follow-up decision, same day). Each
  team — standalone or club-owned — gets a "How your documents look" card in its own portal: team
  logo, colour, footer. Club settings stay for club paper and are the inherited default, so a team
  that sets nothing shows the club's look. Standalone coaches, who today can reach no design
  settings at all, get the full card — the standalone Team plan now includes customization (a
  packaging inclusion to be logged and reflected in the pricing facts when it ships). No club
  brand-lock in v1.
- **The practice sheet is held out of the restyle passes** (follow-up decision, same day). A
  practice plan is mostly sentences and point-form notes; the chart form flattens and disorients
  them. It gets its own structure deep-dive session — same method as this one: real rendered
  alternatives, owner picks. General fixes (single title, identity, page counts) still reach it;
  its form changes only through that session.

## The shape of the work

1. **Fix the shared plumbing once** — title/identity default, per-report shape, true page counts,
   a real logo pipeline, honest menus. Twelve documents improve in one pass.
2. **Walk the six groups, worst first** (registers first — both unreadable documents live there),
   applying the approved content calls.
3. **Add a check that renders the widest documents and fails when one stops fitting** — every defect
   here survived every existing gate and was caught only by looking at the paper.

## Success criteria

- An untouched org's first PDF carries the club's name once, its logo if one is uploaded, a true
  page count, and no shredded columns — with zero configuration.
- The widest report we ship is readable, and a coach can email any PDF to a treasurer without
  apologising.
- No export menu offers a format that doesn't download.
- A failing check, not an owner's eye, is what catches the next document that stops fitting.
