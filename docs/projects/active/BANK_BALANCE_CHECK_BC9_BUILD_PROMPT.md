# Bank balance check BC9: the owner walk of both portals, and marketing truth (build prompt, two sessions)

> **BC9a done 2026-11-07:** both club findings fixed (owner: fix now; `PrintedPage` left where it is; two walk pages).
> Walks: club §481 https://claude.ai/artifact/UVU19kcW3KqE7fmXQiPHQb · coach §482 https://claude.ai/artifact/HZRso86YazZXeWLsjiKxPQ.
> Setup in place on dev: `node --env-file=.env.local .probe/bank-bc9/setup.mjs` (undo: `.probe/bank-bc9/teardown.mjs`).
> Next: the owner walks, then BC9b with the pasted summaries.

> **Written 2026-11-07**, after BC8 was committed (BC8a `adea5a625`, BC8b `0d0a96f42` + `edc1c5046`; plan §9 BC8). **Paste
> `execute @docs/projects/active/BANK_BALANCE_CHECK_BC9_BUILD_PROMPT.md` into a new chat on `dev`.** The first session
> builds **BC9a** (the walk page and what must be true before the owner walks); the **owner walks** between sessions and
> pastes the summary back; the second session is **BC9b** (the walk's findings, `/marketing` putting "bank
> reconciliation" back, `/demos`). Each session ends by writing one line at the top of this file. ⚠ **First check BC8 is
> committed** (`git log --oneline -4 -- components/coaches/bank` shows "BC8b"). If it isn't, stop and ask the owner.
>
> Other sessions share this working copy: stage explicit paths only, commit only your own hunks, and only when the owner
> says (the recipe is the auto-memory note `reference_partial_commit_shared_tree`; `.probe/bank-bc8/commit-b.sh` +
> `commit-b.cjs` is a working copy, incl. "HEAD + my exact edit" for `TODO.md`). ⚠ BC8b's lesson: when a script splices a
> block into HEAD's copy of a shared file, match WIDE context (8+ lines either side) and assert exactly one hit — a
> two-line match put the coach help section near the top of the file and needed a second commit. ⚠ This repo's shell
> drops backslashes in heredocs and a backtick inside a `node -e` string EXECUTES: write scripts with the Write tool,
> edit with the Edit tool. ⚠ New files mean a dev-server restart before the owner looks (AGENTS.md; other sessions use
> the same server, say so before restarting it).
>
> **What BC9 is (plan §9 BC9):** the owner walk of both portals at a desk and on a phone (a checkable page and a § in the
> Owner QA Ledger); `/marketing` puts "bank reconciliation" back in the Club copy once the walk passes (R-c,
> `BUSINESS_DECISIONS.md` 2026-11-04 "Marketing truth"); `/demos` decides on sandbox seeds. **Not in BC9:** the production
> promote. Migrations 447/449/450 reach prod with the bank code in ONE promote (`supabase/migrations/MANUAL_PROD_STEPS.json`),
> run by `/release` after BC9b; this prompt only hands it over. ⚖ QA is never a build dependency (owner 2026-08-05): the
> walk decides marketing truth, it does not gate commits.

## What is there (read the code, not this list, before acting on a claim)

- **Club** (BC1–BC5): Accounting → Bank: the starting statement, Check a statement with the joined band, Find (hints, Not
  in the bank yet, Still waiting?, Add the missing line, Waiting at the start), saved checks, the opened check (Delete,
  Check this statement again, "Print this check" on a desk), a second account (Name and books), the phone layout, the
  Overview's bank line per account with its amber chip, the fiscal-year close's bank row, the help article `bank-tab`.
- **Coach** (BC6–BC8): Money → Ledger → View: Bank (desk and phone; money read sees no form, no Find, no Delete), the
  Money Overview's "Bank: checked through {date} ›" line and chip, Start next season / Close the season's sentence (off =
  amber, matching = plain), the team's printed check, the help article `premium-money-bank`.
- **What the club does NOT see of a coach** (owner 2026-11-06, D1, §0 "Teams column"): no bank mark on the Teams tab.
  The walk confirms it is absent; it is not a defect.
- **Findings carried to BC9** (plan §9 BC8):
  1. **The club's chip door** (`components/admin/kit/club/money/bank/BankTab.tsx`, its `arrived` effect) opens the check
     and rewrites the address in ONE effect, the shape that reopened a check on Back in BC8a's coach walk. Re-walk Back
     after closing a check opened from the club Overview's chip.
  2. **The club's printed check with a long list:** its sheet's `break-inside: avoid` sits on the row holding the whole
     "Not in the bank yet" table, so a near-page list jumps whole to sheet two (fixed on the coach's sheet in BC8b). Print
     a check with ~25 items on BOTH portals.
  3. **Owner call, open:** `PrintedPage` serves four papers in two portals from `components/admin/tournament/`; a neutral
     home would delete `bank-coach-view-guard` §5's one exception but changes the club report's import (admin kit).
  Items 1 and 2 are admin-kit changes: the owner ruled at BC7a that no admin-kit component changes without his yes.
- **The superseded walk:** Owner QA Ledger §461 (R2, the tick-off) was STOPPED 2026-11-05. The new walk replaces it; mark
  §461 superseded in place (never renumber, never delete).
- **Sign-ins (dev):** club = the `uat-rep-club` treasurer; coach = the UAT head coach (`UAT_COACH_*`) on `uat-rep-club` /
  "UAT Test Team" (a club team: no season windows) and on `uat-standalone` / "UAT Standalone Team" (the season windows
  live only on a standalone team); money read = the `uat-rep-club` coach sign-in (`UAT_REP_CLUB_COACH_*`) added for the
  walk as an assistant with money read (BOTH a `rep_team_coaches` row AND an active `rep_team_staff_memberships` row, or
  the Money hub says "Forbidden"). Read the credentials fresh from `.env.local`; never restate a password in a doc.

## Read first

1. `BANK_RECONCILIATION_PLAN.md`: §0 (every ruling: the walk checks them), §5 (the settled words: the walk reads them),
   §6 (the drawings' notes), §9 BC1–BC8 (what each stage walked, and what it left).
2. The drawings: https://claude.ai/artifact/XdxsbzGpGwyDvWttJcjFeN (settled words in code win over the frames' drafts).
3. Memory: `feedback_qa_walkthroughs_as_checkable_artifacts` (the walk page's contract: checkboxes in `localStorage`, a
   progress count, pass / issue / needs-a-call per part, notes, a paste-back summary, a "Sign in as" card at the top),
   `project_owner_qa_ledger`, `feedback_deep_dive_is_walk_then_stages` (one purpose per walk), `reference_probe_signin_without_browser`,
   `decision_coach_books_stay_the_teams`, `reference_reread_prompt_before_publish`.
4. The walks already passed by probes (`.probe/bank-bc*/`): the owner walk is the OWNER's look, not a re-run of them.
   Name in the page what a probe already proved, so the owner spends his time on judgment, not arithmetic.

---

## BC9a — the walk page and what must be true first (session 1)

### Ask the owner first (one AskUserQuestion), only what the code and §0 leave open

1. **The two club findings before the walk:** fix them now (admin-kit changes with his yes, guarded, walked by a probe)
   so the walk sees the finished club side, or walk them as known issues. Recommend: fix both now (each is small, and a
   walk that steps on a known defect wastes his time).
2. **`PrintedPage`'s home:** move it now (four importers, one guard exception deleted) or leave it. Recommend: leave it;
   it is tidiness, not behaviour, and BC9 is a walk.
3. **One walk or two:** the club and the coach are different people with different sign-ins. Recommend TWO walk pages
   (one purpose per walk: "a club treasurer's month end" and "a coach's month end"), each with its own § in the ledger,
   and one shared closing part for the printed checks side by side. Verify against `feedback_deep_dive_is_walk_then_stages`
   before asking.

Record the answers in plan §0 as ruled (add nothing they did not rule).

### Before any code: the UX summary (blocking)

`AGENCY_RULES.md`: what the owner will do on each walk, in his words: which account, where, what he types, what he
should see, desk and phone, how long it takes, and what the probes already proved. Plus the two fixes if ruled in. Wait
for yes.

### The build

1. **The fixes, as ruled** (only if ruled in): the club chip door opens its check only after the address has dropped the
   key (BC8a's coach pattern: strip, then open once the search params no longer carry it); the club sheet's items row may
   break across sheets (the coach sheet's rule). Change the guards on purpose, with the ruling cited. A probe proves each
   (`.probe/bank-bc9/`): Back after the close stays closed; a ~25-item check prints on two sheets with the header repeated
   and no near-blank first sheet.
2. **The walk's data.** The owner does the checking himself (it is his judgment being tested), but some states need
   setup: a club account with a starting statement and some history; ~25 lines on one team ready to be marked Not in the
   bank yet; a carried-cash season on a team if "From the {season}" is to be seen (not walked yet anywhere: BC7b had no
   carried cash on the UAT team). Write a setup script `.probe/bank-bc9/setup.mjs` that makes ONLY what the walk can't
   make by hand, prints what it made, and a `teardown.mjs` that removes it all. Never touch a team that already has a bank
   account (someone else's checks: stop and ask, as the BC8 probes do).
3. **The walk pages** (Artifacts, per the memory contract; load the `artifact-design` skill first). Each part: what to
   do, what to see, a checkbox per step, the verdict, a notes box. Parts to cover (split across the pages as ruled):
   - **Club, desk:** start an account from a statement; check a matching statement; an off one, Find the gap, mark a
     cheque Not in the bank yet, Add the missing line; the next check's "Still waiting?"; Waiting at the start; a second
     account and moving a book; Books now say after editing a line; Delete; Check this statement again; the Overview's line
     and chip (and Back after closing the chip's check); the fiscal-year close's bank row (if a closable year exists on
     dev; else say so and point at the guard); Print this check (a matching one and an off one with ~25 items); the help
     article and a search for "reconciliation".
   - **Club, phone (390):** the same check and Find, 10 lines at a time, Save last; no print door.
   - **Coach, desk:** the Money Overview line before and after a check; the Bank view: check, Find, Not in the bank yet,
     Cash not deposited yet, Add the missing line (the Ledger's own form, prefilled), saved checks, Books now say, Delete,
     Print (with the team role on the paper); "From the {season}" if the setup made a carried season.
   - **Coach, money read:** the same view with no form, no Find, no Delete, and Print there.
   - **Coach, phone (390):** the view, Save last, Find's rows with the action under each, no print door.
   - **Coach, standalone team:** Start next season and Close the season with an off check (amber) and a matching one
     (plain); OPEN them, never confirm.
   - **What the club does not see:** the Teams tab has no bank mark for a team (owner's ruling: the coach's books stay
     the team's).
   Every page carries the "Sign in as" card, the URL, the org and team, and when to switch accounts. Pin identities
   (account names, team names), never as-of-today figures (a figure in a step is computed by the setup script and
   printed, or it isn't in the step).
4. **The ledger:** new §s in `OWNER_QA_LEDGER.md` (the next free numbers; never sort), each with its walk URL; §461 marked
   superseded by them, in place. Re-read this prompt file before publishing (another session may have edited it).
5. **Checks** for any code changed: the bank guards and tests, typecheck, focused lint, spelling, tokens, CSS purity,
   `check:layout -- --only=<the club bank ids>` if a club screen changed. Run setup once on dev, confirm the walk's
   states exist in a browser probe, then teardown and setup again so the owner starts clean.
6. **Then:** `/review` on any code changed, records (plan §9 BC9a, the "BC9a done" line here with the walk URLs and the
   setup command), commit on the owner's yes, and hand off in product-owner voice: the two links, which account, how long,
   "paste the summary back into a new chat with this prompt".

---

## BC9b — after the walk (session 2)

**Start here** once the owner has pasted the walk summaries. First check BC9a is committed.

1. **The walk's findings.** Sort each into: a defect (fix it, guarded, probe-proved); a call for the owner (ask in one
   AskUserQuestion, record in §0 as ruled); a words change (into step 2's pass). Re-walk only the parts a fix touched
   (a probe, plus a short re-check list for the owner if he wants one). If the walk did NOT pass, stop after the fixes:
   step 2 waits for a passed walk (R-c).
2. **`/marketing`, marketing truth (only after a passed walk).** The handoff in `BUSINESS_DECISIONS.md` (2026-11-04,
   "Marketing truth"): put "bank reconciliation" back in the Club copy (pricing section, Club plan article, homepage,
   in-app plan list, `PRICING_PAGE_COPY.md`), and the coach Premium list may name it; never on the Basic portal (no
   tease). Reconcile against `PLAN_PRICING_FACTS.md` first (drift goes to `/strategy`). Check the three overclaims the
   plan found (onboarding "track invoices", the marketing email default "team invoicing", the module catalog's
   "reconciliation workflows"): say whether each is still live, and route any that are to `/marketing` as their own item
   (they are not this project's, but they break the 2026-10-19 rule). Offer `/strategy` to log that the claim is now true.
3. **`/demos`.** Decide whether the sandboxes (`riverdale-minor-ball`, `riverdale-ridge`) show a bank check: a seeded
   club account with a start and a couple of checks, a coach team with one. A number in a demo sentence is computed from
   the seed or it isn't in the sentence (CLAUDE.md). If yes, it is a seed change for the next release cycle's `/demos`
   pass, not a hand re-seed.
4. **Help:** if the walk changed a flow or a word, `/docs` on both articles (`bank-tab`, `premium-money-bank`).
5. **Records:** plan §9 BC9 ticked (the walk §s and their verdicts, what was fixed, what marketing changed); plan §5's
   last open line (R-c) ticked; the TODO line as HEAD + your exact edit (BC9 done; next: the prod promote by `/release`);
   the PM brief; the auto-memory note `project_bank_reconciliation.md` and its MEMORY.md line. Mark this prompt done.
6. **Hand off** in product-owner voice: what changed, what the owner can now say in marketing, and the one thing left:
   **`/release`** carries migrations 447, 449 and 450 to production with the bank code in one promote (read
   `reference_prod_release_history` and `MANUAL_PROD_STEPS.json` first; the Overview, the Teams tab and Close year read
   the bank tables quietly, so the order inside the promote matters less than that they ship together). When the promote
   is done and the prod truth-up says so, the plan and PM brief move to `docs/projects/archive/`.

## Out of BC9

The production promote itself (`/release`); a second club account kind (gaming funds) beyond what BC1–BC5 built; a club
view of a coach's books (the owner's ruling stands); statement upload, a bank feed, sign-off, submit-to-club (B12);
hooks, checks or baselines; any admin-kit change the owner hasn't agreed to.
