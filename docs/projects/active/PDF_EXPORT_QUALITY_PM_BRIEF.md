# PM Brief — PDF Export Quality

**Plan:** `PDF_EXPORT_QUALITY_PLAN.md` · **Status:** **PHASE 1 BUILT on dev 2026-08-23** (QA §79)
— the shared plumbing: one title, the right name for the layer, real logos, true page counts,
per-report shape, the no-shred fit contract, the coaches "How your documents look" card, and the
three lying menu buttons removed. Phases 2–3 (group passes, rendered CI check) remain. Owner
planning session held 2026-08-21; every structural decision made against rendered evidence
**Evidence gallery:** https://claude.ai/code/artifact/834cdd89-8c24-416f-acd8-c1930ff76dd1
**Priority:** medium-high — these documents are seen by treasurers, boards and parents who are not
our customers, and two of them are shipping unreadable

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
