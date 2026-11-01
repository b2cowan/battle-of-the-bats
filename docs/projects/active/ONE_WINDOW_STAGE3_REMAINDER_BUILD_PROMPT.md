# One Window · Stage 3 remainder — retire the last FeedbackModal (build prompt)

> **Written 2026-10-31. Paste this into a new chat on `dev`.** Other sessions share this working copy: stage **explicit paths
> only** (never `git add -A` / `.`), re-check `git rev-parse --abbrev-ref HEAD` before committing, and **commit only when the
> owner says** (ask before each commit). Plan of record: `docs/projects/active/ONE_WINDOW_PLAN.md` (Stage 3, "Remaining in
> Stage 3 (Wave 2 Step 4)", ~line 669). Rulings Q11 (one "are you sure" window) and Q13 (notices stop being windows) already
> decide every question below. **Do not reopen them.**

## What the owner sees afterwards

Five more screens stop showing the old grey "FeedbackModal" box and use the product's one question window or its quiet
notices. The old box is deleted from the product, so no screen can bring it back. Wording of every question stays exactly as
it reads today. No database change, no plan gating change, no new setting.

## The mounts (census run 2026-10-31 from the code; re-run `grep -rn FeedbackModal app components lib` first and trust the grep)

| # | File | What it shows today | Becomes (per Q11 / Q13) |
|---|---|---|---|
| 1 | `components/billing/PlanPanelDrawer.tsx` (~line 85) | An upgrade **outcome** (success or error) after the plan panel's Upgrade | Success/news → the page notice (`PageNotice`) or save pill (`NoticePill`) per Q13; **error stays until read** → `KitDialog kind="question"` with one answer (`Close`). Read how `roster/page.tsx` did the same in Step 1 and copy that pattern |
| 2 | `app/[orgSlug]/admin/rep-teams/rename-slugs/page.tsx` (~235) | `Done` / `Error` after a rename | Done → `NoticePill`; Error → question window (`Close`) |
| 3 | `app/[orgSlug]/admin/org/settings/pdf/page.tsx` (~419) | Spread `{...feedback}` box (saved / error) | Same split: saved → `NoticePill`; error → question window |
| 4 | `app/[orgSlug]/admin/house-league/seasons/[seasonId]/schedule/page.tsx` (~1642) | `feedback` state with title, message, type, `onConfirm`, `confirmText`, `cancelText` (confirms **and** refusals) | Confirm → question window with the **same** words and buttons (`.btn-danger` for danger tone, per `schedule/page.tsx` in tournament admin); refusals → question window with `Close`. The page already mounts a `NoticePill`, so reuse it for any bare "done" |
| 5 | `app/[orgSlug]/admin/org/billing/mock-portal/MockPortalClient.tsx` (~131, ~139) | `Changes applied` then return to the billing page; an error box | Dev-only mock page: `Changes applied` → `NoticePill` then the existing `handleReturn()`; error → question window. Check first whether this route still ships to customers (it must not). If it is dead or dev-only, say so and still remove the import |
| 6 | `components/shared/UnsavedChangesGuard.tsx` (~89) | The **"Unsaved changes — Leave without saving / Stay on this page"** question, on every guarded form, in **coaches, club admin and platform admin** | `KitDialog kind="question"`, same words, `Leave without saving` wearing the danger button |

After all six: **delete `components/FeedbackModal.tsx` and `components/FeedbackModal.module.css`**, and remove their names from
the allow-lists in `scripts/check-admin-type.mjs` (~lines 70–71) and `scripts/check-public-tokens.mjs` (~line 191). Those are
build gates, not shared automation, but **change only those two entries and say so in the commit message.** If either gate
still needs the file for another reason, stop and tell the owner.

## ⚠ The risky one: #6 UnsavedChangesGuard

It carries a hard-won rule recorded in its own comment and in the 2026-10-20 One Window review: **"Leave" must REPLAY the
coach's own link click**, never a bare `router.push`, or a window that closes on that click runs `history.back()` and cancels
the navigation (the coach answers Leave and stays). **Keep the whole `onConfirm` body byte-for-byte**; change only the element
that renders the question. Also:

- It is mounted from **platform admin** screens (`PersonRecord`, `LeadRecord`, `FeedbackRecord`, `ClubRecord`) as well as the
  coaches' panels and tournament admin. Confirm `KitDialog` renders correctly **outside** the coaches and club-admin
  providers (it reads `useOverlayOpenIfAvailable`, so it should, but prove it by reading it, then by looking at one
  platform-admin screen in the browser).
- `KitDialog` already registers the Back step through `useDialogFloor`; do **not** add a second `useBackStep` (Step 1 removed
  exactly that duplicate from `ConfirmProvider`).
- The guard's own tests and `tests/unit/one-window-stage3-guard.test.ts` encode the Leave-replays-click behaviour; run them.

## Collisions to avoid right now

- **Billing is being edited by another session.** `components/billing/BillingBody.tsx`, `PlanMoveDialog.tsx`,
  `Billing.module.css`, `lib/plan-move.ts`, `lib/workspace-upgrade*.ts` and `components/admin/kit/club/ClubHubKit.tsx` carry
  uncommitted Stage 4b work. `PlanPanelDrawer.tsx` is clean today, but run `git status --short -- components/billing` before
  you touch it. **Edit only `PlanPanelDrawer.tsx` there**, and if it has become dirty, stop and ask.
- `git status` shows ~100 other dirty paths from other sessions. Touch only the files above plus the guard test and the records.

## Order of work (the repo's workflow rules apply)

1. **Plan first:** give the owner the Implementation Plan and a **plain-language UX summary** (what changes on screen, per the
   table above, and any role differences) before any code. This is a blocking step.
2. Do mounts 1–5, then 6, then the deletion. Run `npm run lint:focused -- <files>` as you go.
3. **Guard test:** extend `tests/unit/one-window-stage3-guard.test.ts` so the whole product has **zero** imports of
   `FeedbackModal` (ruled guard, plan §5: "No import of `FeedbackModal`"), and `window.confirm(` has none either. The mock-portal
   test file, if any, must still pass.
4. Verify: `npm run verify:changed`; `npm run typecheck` (a shared component and a shared guard changed). If typecheck runs out of
   memory, say so and do not claim it passed. Do not restart the dev server for routine edits; you will delete two files, so
   restart once at hand-off per the restart rule, stopping the server **before** clearing `.next`.
5. **Walk:** append a short Part to `docs/projects/active/ONE_WINDOW_STAGE3_WALK.html` (checkable, paste-back format like the
   existing parts, one purpose per part): the house-league schedule confirm and refusal, the PDF settings save and error, the
   rename-slugs done and error, the plan panel's upgrade outcome, **Unsaved changes → Leave on a coaches screen AND a platform-admin
   screen**, and that a guarded form's Leave actually navigates. Publish it as a Claude Artifact. Warm and Dark, computer and phone
   for the question window; the notices need no theme pass.
6. `/simplify` then `/review` (this is a shared-component change), then offer `/docs`: the "Keep editing" / unsaved-changes help
   was held, and `lib/help-content/coaches.tsx` `faq-money-discard-prompt` may need a line. Do not run `/docs` unasked; offer it.
7. **Records, in the same unit of work:** `ONE_WINDOW_PLAN.md` gets a "Stage 3 — as built (Step 2)" entry and its status line is
   corrected; `memory/project_one_window.md` is stale at Stage 2d — update it (and `memory/MEMORY.md` if you write to the in-repo
   `memory/`); `TODO.md` gets one line; `OWNER_QA_LEDGER.md` gets the next unused § number (**never sort the §numbers**).

## Definition of done

- `grep -rn "FeedbackModal" app components lib` returns nothing; both files are deleted; the two script allow-lists no longer list them.
- Every question reads word for word as before; `Leave without saving` still leaves.
- No file outside the list above is in the commit (check `git show --stat HEAD`).
- Typecheck and `verify:changed` results are reported **truthfully**, including anything skipped or red for reasons outside this change.
- Stage 4 (the strays: 17 house-league windows and more) is **not** started here; it has no build prompt yet.
