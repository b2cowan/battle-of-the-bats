**Written 2026-11-09. S2 built 2026-11-09, uncommitted (own hunks only; the club one-line Overview work of another session sits in the same files); walk Owner QA Ledger §503 owed; record in the plan §4; next S3.**

# Bank check through a volunteer's eyes — S2 (the door) — build prompt, one session

> **Paste `execute @docs/projects/active/BANK_CHECK_NOVICE_UX_S2_BUILD_PROMPT.md` into a new chat on `dev`.**
> Plan of record: `BANK_CHECK_NOVICE_UX_PLAN.md` (§0 rulings, §2 S2, §4 record). S1 and S1b are committed
> (`bdb56dd2f`, `4b9e9a655`); the owner passed the S1b walk §497 (24/24) on 2026-11-09 and said the S1 words are good,
> so S1 gets no walk of its own.
>
> Other sessions share this working copy: stage explicit paths only, commit only your own hunks, and only when the owner
> says (auto-memory `reference_partial_commit_shared_tree`). This repo's shell drops backslashes in heredocs and a backtick
> inside `node -e` EXECUTES: write edit scripts with the Write tool, or use Edit. New files or shared-module changes mean a
> dev-server restart before the owner looks (AGENTS.md; say so first, other sessions use the same server).

## ⚠ Read this before touching a bank file: another session's club work is in the tree, uncommitted

On 2026-11-09 the owner ruled **"the club's Overview bank line is ONE line, whatever the number of accounts"**
(drawings `BANK_OVERVIEW_LINE_DRAWINGS.html`, option A). It is built and sits uncommitted in: `BankOverviewLine.tsx`,
`lib/bank-club-rules.ts` (a pure `bankOverviewLine`), `lib/bank-tab-words.ts`, `lib/bank-screen.ts`, `BankTab.tsx`,
`Bank.module.css`, `tests/unit/bank-club-routes.test.ts`, `tests/unit/bank-r2c-screens-guard.test.ts` (plus the Account
pill's two-line option: `SingleSelectDropdown.tsx`, `SublinedChoice.tsx`, `FilterPill.module.css`).

1. Run `git status --short -- lib/bank-tab-words.ts lib/bank-screen.ts lib/bank-club-rules.ts components/admin/kit/club/money/bank components/coaches/bank tests/unit/bank-*`. If those hunks are **still uncommitted, build on them** (the one-line shape is the club base; never revert it, never rebuild the old one-line-per-account stack) and leave them out of your commit. If they are committed by then, read the commit.
2. **The club wording needs one owner call, and it is yours to surface in the UX summary (step 1), not to decide.** A3 says the line reads "Check your bank balance ›" until the first check. The one-line ruling already says, for the club: "Bank: {account} · not checked yet ›" (one account), "Bank: 1 of 3 not checked yet ›" (several, some never checked), "Bank: not checked yet ›" (no account, a writer sees it). Recommend: the invitation replaces **only the not-checked states** ("Check your bank balance ›" + its quiet second line), and the checked states keep the one-line wording unchanged; with several accounts and some never checked, keep "1 of 3 not checked yet" (it names a count an invitation would hide). Show the owner the three club states side by side and let him rule.
3. The drawings page still carries unresolved options (B, D "silent unless needed"). If the owner picked D, "in every stage" below is moot for the club; ask in step 1.

## Read first
1. The plan, §0 (A3, A16), §2 S2.
2. Evaluation page source `.probe/bank-ux-eval/claude/artifact.src.html`: **Words rows 2 and 20**, **drawing D3** (search `D3 coach overview`), asks A3 and A16 (search `data-ask="A3"`).
3. The code (survey 2026-11-09; **re-verify the line numbers, they drift**):
   - Coach line: `components/coaches/bank/CoachBankOverviewLine.tsx`; rendered only by `app/[orgSlug]/coaches/teams/[teamId]/accounting/OverviewDashboard.tsx` (inside the Cash on hand card, above the foot), which the hub `page.tsx` mounts **only when `summary.stage === 'operate'`**. Plan and Collect stages render `SetupOverview.tsx`, which has no Cash card and no bank line. That is the whole of A3 on the coach side.
   - Club line: `components/admin/kit/club/money/bank/BankOverviewLine.tsx` in the Accounting page's heading row. **Not stage-gated** (club needs no stage change; its change is the words only).
   - Coach View pill: `.../accounting/expenses/panel.tsx` (`LedgerView`, `LEDGER_VIEW_LABEL`, the `viewPill`); the choice is kept in this browser (localStorage `flhq-coach-ledger-view:{teamId}`); the address `?view=` is **read** but never **written**. The hub lists `view` in `ONE_SHOT_KEYS` (so other tabs' links drop it).
   - Club Bank tab: `BankTab.tsx`; `accountId` is plain state; `?account=` / `?check=` are read once from the Overview door and **then stripped** from the address by an effect.
   - Help: club article `bank-tab` (`lib/help-content/accounting.tsx`), coach article `premium-money-bank` (`lib/help-content/coaches.tsx`). A screen links to a coach help article with a plain `Link` to `/${orgSlug}/coaches/help#<article-id>` (e.g. `CoachStaffPanel.tsx`); confirm the club's help URL shape from `useAdminKitNav.ts` (`.../help/accounting#bank-tab`). Neither bank article is linked from any screen today.

## Scope (plan §2 S2: asks A3 and A16, words rows 2 and 20)

**(a) The Overview line in every season stage, as an invitation until the first check (A3, row 2, D3).**
- Coach: the line also renders in **Plan and Collect** (today only Operate). It is the same small quiet line; before any check it reads "Check your bank balance ›" with the quiet second line "Type what the bank shows to see if you're in step."; after a check it keeps today's words ("Bank: checked through {date} ›" + the amber Off by chip). Where it sits in the setup Overview is **undrawn** (that Overview has no Cash card) — see step 1.
- Club: the invitation wording per the owner call above; same words in both portals' not-checked state (BC8b: one spelling for one state).
- Quiet failure stays: a read that fails draws nothing, and a reader at a club with no account still sees nothing. A closed season has no live Overview at all (one page rule): do not touch the closed-season page.

**(b) A "How the bank check works" link on the Bank view's head line, both portals (row 20).** Beside "Team bank account · not checked yet" (coach) and the club equivalent, a quiet link at the line's end; it opens the bank help article (today the page's "?" opens the Ledger topic). Phone: it wraps onto the line's second row, as drawn.

**(c) The coach's View pill writes the chosen view into the address.** Choose "Balance check" (or any view), reload or share the link: you land on it. Use an established writer (`useRoomAddress` hook or the dues panel's `setUrlParam('duesView')`); both use `router.replace` with `scroll:false` and keep sibling params. ⚠ Traps from the survey: the panel stays mounted when hidden, so write **only while the Ledger tab is active**; the filter / scheduled effects set the view to 'timeline' themselves, so a naive write there loops; `room-address-keys-guard` requires any key a room writes to be in the hub's `ONE_SHOT_KEYS` (`view` already is); and `view` is already read by the panel, so do not add a second reader. The URL outranks the remembered choice (already true).

**(d) The club's Bank tab keeps the chosen Account across a reload (A16).** The Account pill writes the chosen account into the address; arriving with an account in the address picks it. This **removes the "strip `account`" half of the door effect** (keep `check` one-shot: a check is opened once, not remembered) and changes the bank-r2c screens guard that pins the strip (it needs rewriting to what is now true, not deleting). An id that isn't one of this club's accounts falls to the first account, as today; make the address say what is shown (replace it with the real account) rather than leave a stale id. A reload also keeps the working draft visible, because the draft is keyed to the account.

**Not in S2:** S3's fee door and quiet list; S4's printed method line; S7's save-for-later; the Year pill (not in the address today; not a bank matter); A10's age-of-last-check (Not yet) and A14 (Not yet).

## Steps
1. **UX summary to the owner first** (AGENCY_RULES, blocking; product-owner voice): what a coach in Plan/Collect sees now that they did not; what a treasurer sees in the three not-checked states; the help link; what a reload / shared link now does. **Surface the open calls:** the club wording call above (recommended: invitation replaces the not-checked states only), and **where the line sits in the coach's setup Overview** (recommend: directly under the "Season check" card's last row, same quiet grey line, same height as Operate's; draw it).
2. **One small drawing, as a Claude Artifact at true size (desk 1440 + phone 390), NEW / RESTYLED / UNCHANGED tagged**: the coach's Plan-stage Overview with the line, the Collect-stage one if it differs, and the club's three not-checked states. Draw it FROM the shipped components. **`/design` on it before hand-off; owner yes before building.** D3 already covers the Operate stage and need not be redrawn.
3. `/marketing` on the invitation and its quiet line (the plan's Words tab has the strings; this is the final read, including the help articles' `keywords` / `searchText`). One spelling everywhere (`npm run check:spelling`).
4. Build (a) to (d). Update the tests that pin the old shapes: `bank-coach-view-guard` (the exact JSX regexes around the line, the hub's `bank={{…}}`), `bank-r2c-screens-guard` §12 (the address strip), and add pins for each new behaviour: the line renders in every stage; the link's destination exists (a help-anchor guard if one exists for other links); the View pill writes the address only while the Ledger is active; the Account pill writes and reads `account`.
5. Walk on dev, desk + phone, **both portals**, with a probe that asserts it is on its own team / account before every write: Plan, Collect and Operate Overview lines (never checked, then checked, then off); the help link opens the right article; pick "Balance check", reload, share the link; with two accounts pick the second, reload, press Back / Forward; a bad `?account=`. `check:layout --changed` on the few screens touched (skip and say so if other sessions' shared-chrome edits widen it to the whole product).
6. `/simplify` only if a new shared helper appears; **`/review` (standard)** — it reads the address and gates a line, so it earns it; `/docs` for the help (the new link, plus the club article's door sentence if it names the line). **No `/accounting` or `/legal` pass: nothing here changes money, taxes, emails or what is collected.**
7. Record: plan §4 line + this file's top line; TODO line (S2 built / committed, walk owed); offer the commit (own hunks only) and write the owner's walk (one purpose, checkable Artifact, a § in the Owner QA Ledger; fixture torn down after). Update the auto-memory file `project_bank_check_novice_ux_evaluation.md`.

**Risk: low-to-medium.** The words and the link are small; (c) and (d) change what the address does, which other doors (the Overview's per-account door, the close rows, the bell) already use — test each one still lands.
