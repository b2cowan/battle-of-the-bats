# Build prompt — Admin header, Phase 4: words, help, demos, verify

> Written 2026-11-09, after walk §499 passed (28/28; F1 and F2 kept as built). Plan of record:
> `docs/projects/active/ADMIN_HEADER_BAR_PLAN.md` ("Phase 4"). One session, pasted into a fresh chat (`/clear` first).
> Phase 4 builds NO new screen. It makes the words, help, demos and checks match what Phases 1–3 shipped, then closes the
> project with one final owner walk. If the sweep finds a gap that needs a visible change, STOP and say so (see "Gate").

---

Admin header: the bar names where you are — **Phase 4, words, help, demos, verify.** Closing phase. Product code is
touched only where a sweep finds a line that is now wrong.

## Read first, in this order

1. `docs/projects/active/ADMIN_HEADER_BAR_PLAN.md`: **Phase 4's checklist**; the as-built notes for Phases 1, 2A, 2B, 2D
   and 3 (what each shipped, the lessons); Phase 3's `/review` "RECORDED, NOT CHANGED" list (a)–(g); "After this project"
   (NOT this session: the navigation evaluation and the org-logo ask); the Architectural Decisions.
2. `docs/agents/design/` and `memory/design_decisions.md` (2026-11-07 top entry) for the rulings the words must match.
3. The Owner QA Ledger sections §486, §492, §495, §499 (what the owner walked and passed). Do not re-walk what passed.

Broad reading and censuses go to a helper agent (CLAUDE.md). A helper's claim is a lead, not evidence: open the cited lines.

## What this session does

1. **Help sweep (`/docs`).** Find every help article that describes the header, the Overview heading, the old
   two-title look, "scroll back up to the tabs", a tab row that moves, a club name above a title, "View site", or where a
   record page's back link lives. Fix the sentence AND its `keywords` / `searchText` (`lib/help-content/*.tsx`, indexed by
   the hub arrays in the `help/page.tsx` shells). Phase 3 already updated the Calendar View button and the Public site chip
   sentences; do not redo them, verify them. Skip what is still true.
2. **Demos.** `npm run check:demos` must pass (a tour anchor on a removed paper heading fails the build; move the anchor).
   Do not add "re-read" notes to demo files and do not re-seed prod: the demos follow the product (CLAUDE.md). If a tour
   sentence now describes the header wrongly, fix the sentence from the seed or the screen, never a typed number.
3. **Words.** `npm run check:spelling` (one spelling everywhere; the clock is "8:00 a.m.", built with `formatTime`).
   Grep the header's own strings (placeholders, back-link words, chips, "Admin", "Admin Area", "Read-only archive") for
   variants before touching any.
4. **Close the recorded Lows.** Read Phase 3's list (a)–(g). For each: leave it recorded, fix it if it is a one-line
   honest fix, or route it to the owner. In particular (g): `MembersKit` no longer opens the invite window from
   `?invite=open` and the setup checklist's copy changed (another session's change). Confirm nothing still links with
   `?invite=open` and expects the window. Do NOT change shared automation, hooks or database checks.
5. **Verify.** `npm run verify:changed`; `npm run typecheck` (shared module + shell; if it OOMs,
   `NODE_OPTIONS=--max-old-space-size=8192`); `npm run check:layout --changed` on the touched screens only, dev server,
   1440 and 390. The whole-product layout sweep is a release step on staging (`/release` §1d-5), NOT on the dev server.
6. **Final design pass.** `/design` on the bar across every screen type against the approved drawings (ROWS v4,
   DESKTOP_STRIP B v2, PHASE3 round 5): one list of any screen that drifted. Then `/review` on any code this phase changed.
7. **The closing owner walk**, as a checkable Artifact (QA ledger: the next § in line, never re-sort the numbers;
   ONE purpose: the bar on every screen type, end to end). Desktop first, then a phone pass. It re-proves only a short
   sample per place type (Overview, a tab place, a team, Accounting, Families, a record page, a tournament, a
   tournament-only org, a refused screen, a cancelled account), not the 87 steps already passed. Publish it, then tick
   Phase 4's boxes in the plan, update the TODO.md line and the project memory with the positive fact.
8. **Do not commit without asking me.** On my yes, the commit takes only this session's files, built in a private index on
   the current HEAD.

## Gate

No new screen and no new design is expected, so no drawing round. But if the sweep shows a screen that cannot honestly be
fixed with a sentence (it needs a visible change), stop and present a short product-manager UX summary for my ruling
before building. The plain-language UX summary is still required before any code change.

## Gotchas

- **Coaches portal untouched** (scoped to this project). Its help articles are not rewritten in this phase; if one is wrong
  because of the SHARED strip/bar, record it for the navigation evaluation.
- **Shared working tree:** other sessions have uncommitted hunks (`TODO.md`, the ledger, several club kits, `org.tsx`).
  Read the live file; change only your hunks; stage explicit pathspecs; never `git add -A`.
- **`.tsx` can be CRLF in the tree**: a Node edit script must normalize `\r\n`; regex-bearing edits go through Edit.
- **Dev server:** only `npm run dev`; stop it before deleting `.next` on Windows; do not launch a sweep against a server
  used for something else; UAT saved sessions expire (`npx playwright test --project=auth-setup --grep "authenticate: (coach|org-owner)$"`).
- **Layout baseline keys on visible text**: a reworded heading re-keys old findings as NEW. Compare before calling a
  finding new.
- **Type check** (`scripts/check-admin-type.mjs`): do not raise the baseline or edit the script.

## Done when

- No help article, keyword or demo sentence describes the retired header; `check:spelling`, `check:demos`,
  `verify:changed`, `typecheck` and the changed-screen layout check pass.
- Phase 3's recorded Lows are each closed, left recorded with a reason, or sent to me as a question.
- `/design` (and `/review`, if code changed) findings are applied or recorded.
- The closing walk is published; the plan, TODO line and memory say so. The navigation evaluation and org-logo ask stay
  queued, not started.
