# Plan & billing · Stage 4b · Part 4: simplify, review, docs check (prompt for a fresh chat)

> **Written 2026-10-31** after Part 4 was committed. Paste into a new chat on `dev`. **Three chunks, one per session.** Each ends with a
> STOP: finish the chunk, report, ask the owner before any commit, then tell the owner in one line to `/clear` and paste the next chunk.
> Do not run two chunks in one session; the review needs a context that has not just read the simplify pass's reasoning.
>
> **Re-verify every lead before building on it.** Code moves, and a plan or an audit has been wrong in this repo before.
> **Other sessions share this working copy:** stage explicit paths only (never `git add -A`), `git show --stat HEAD` after every commit, commit
> only your own hunks, ask the owner before each commit (an earlier yes does not carry over), never push. Branch `dev`.
> `lib/console-money.ts` and `lib/console-money-stripe.ts` are another project's uncommitted work: do not touch or stage them.

## The diff under review (all chunks)

Two commits, found with `git log --oneline --grep "Stage 4b Part 4"`:

1. `1bfc4452b` **the proxy**: `proxy.ts` gains `'/:slug/coaches'` and `'/:slug/coaches/:path*'` in its matcher and a header-only early return
   (sets `x-pathname` / `x-request-id`, no session work) for a club's coaches page; a first segment in `RESERVED_ORG_SLUGS` skips it.
   Pinned in `tests/unit/plan-billing-coach-host.test.ts` ("the page the coaches layout trusts is the proxy's") by calling the real proxy.
2. **the proof and the banner fix**:
   - `tests/unit/workspace-flip-guard.test.ts`: the census now counts ANY read of `team_workspaces` (22 new readers, each classified).
   - `tests/unit/_club-upgrade-money.ts` (new) and `tests/unit/workspace-move-money.test.ts`: one `dueTodayOf` helper.
   - `tests/uat/scenarios/premium-to-club-path.spec.ts` (new): the whole-path UAT spec, written, never run.
   - The two upgrade-summary routes under `app/api/coaches/[orgSlug]/teams/[teamId]/upgrade-summary/`: `.neq('workspace_state', 'org_owned')`.
   - `docs/projects/active/PLAN_AND_BILLING_STAGE4B_PLAN.md` §10 (the build record: read it first in every chunk).

Read first, every chunk: `AGENTS.md`, `AGENCY_RULES.md`, `CLAUDE.md`, `docs/projects/active/PLAN_AND_BILLING_CODEX_RULES.md`, then plan §10.

---

## Chunk 1 · `/simplify`

Run `/simplify` on the files above (both commits). Quality only: reuse, duplication, altitude.

- Worth a look: the guard's `SPECIAL` table (22 new rows: is a grouped shape clearer without losing a reason per file?); whether the UAT
  spec's sign-in and session helpers duplicate `tests/uat/helpers/fixtures.ts` or `team-direct-checkout-smoke.spec.ts` closely enough to share;
  whether `_club-upgrade-money.ts` belongs beside the other `tests/unit/_*.ts` helpers as it is.
- **Do not** change behaviour, delete an assertion, merge the proxy branch into the sandbox one, or edit `tests/unit/_source-code.ts` (shared by
  many guards; see the `readCode` note in §10, it is reported, not owed here).
- Re-run what you touched (`node --import ./tests/ts-resolver.mjs --test <files>`), `npm run check:spelling`, focused ESLint.
- **STOP.** Report what you changed and what you skipped and why. Ask the owner to commit. Then say: *"Run `/clear`, then paste Chunk 2."*

---

## Chunk 2 · `/review`

Run `/review` (`.claude/commands/review.md`) on the two commits **plus** any Chunk 1 commit. Highest tier: `proxy.ts` is shared request
infrastructure and the rest is money-adjacent.

Questions the review must answer from the code, not from §10:

1. **The proxy branch.** Every request shape that now reaches it: an encoded or odd first segment, a demo sandbox org (its fast path sits
   above), a club's own host (returns at the top), a non-GET (the sandbox write block sits above), `/_next` or a static file (the matcher's
   `:slug` shape), `/api/coaches/…` (the API fast path sits above), a first segment that is reserved but missing from `RESERVED_ORG_SLUGS`.
   Does anything that used to get session refresh or a redirect lose it? Does any coaches page rely on a session cookie the proxy used to
   refresh? (It never ran there before, so it should not, but prove it.)
2. **The coaches layout** (`app/[orgSlug]/coaches/layout.tsx`, the two `x-pathname` reads near 144 and 256): with a trustworthy header, is
   the exact-billing exception still exact (a query string, a trailing slash, a case difference)?
3. **The banner filter.** `workspace_state` is NOT NULL (dictionary), so `.neq` drops nothing else. Is there any other way a club's team
   page reaches a portal-era `migration_summary`? Does the bridged case (a team moved into SOMEONE ELSE's club, also `org_owned`) behave?
4. **The census.** Spot-check at least five of the 22 verdicts against their code. A wrong `tombstone-aware` or `harmless-read` is the
   failure this guard exists to stop.
5. **The UAT spec.** Read it as its runner would: does any step depend on timing it does not wait for (the fake clock and the real
   `fetch`), leave data behind on failure, or write to a shared fixture? Group C must create and delete its own coach; A and B must only read.

Fix confirmed findings (say what each exposed first and ask if it touches product code outside this diff). Then `npm run typecheck`, the
billing families (`plan-billing-*`, `workspace-move-money`, `workspace-flip-guard`, `club-stage1-server-guard`, `org-billing-access-guard`,
`plan-move-dialog-guard`), every test that reads `proxy.ts` (`grep -rl "proxy.ts" tests/unit`), `npm run check:spelling`.
Known red before this work, report as unchanged: `plan-billing-usage.test.ts:112` (503), `support-console-stage3-guard.test.ts:564`, and the
three `public-tournament-stage6-walk.test.ts` failures (another session's walk page). **If you change `proxy.ts`, restart the dev server**
(stop it, delete `.next`, `npm run dev` with network access, wait for Ready, check `/platform-admin/login?next=%2Fplatform-admin` is 200).

**STOP.** Report findings fixed / rejected with the reason. Ask the owner to commit. Then say: *"Run `/clear`, then paste Chunk 3."*

---

## Chunk 3 · docs drift check (report only)

⚠ **This is not the help rewrite.** The billing help rewrite is **Plan & billing Stage 5**, and the owner's sequence
(`BILLING_TAX_PRICING_SEQUENCE_INDEX.html`) holds it until renewal and tax land. Do not start Stage 5, do not edit its prompt, do not write
new help articles for the Premium → Club path.

Run `/docs` (`.claude/commands/docs.md`) in **audit mode** over `lib/help-content/*.tsx` and the help hubs, asking one question: **does any
help text a customer can read today contradict what Stage 4b shipped?** For example: a Premium coach told they must contact us to become a
club, told their portal is separate from a club, told staff can reach billing, or a locked-portal owner told there is no way back to billing.

- A sentence that is now **false** may be corrected in place, minimally, with the owner's yes (one spelling, `check:spelling`).
- Everything else (missing coverage, a better explanation, new articles) goes into a **list for the Stage 5 prompt**, appended to plan §10
  as "Stage 5 inputs from the Part 4 docs check". Do not edit `PLAN_AND_BILLING_STAGE5_BUILD_PROMPT.md`.

**STOP.** Report the drift found, what (if anything) was corrected, and the Stage 5 list. Ask the owner to commit. Then: **4b is closed once
the owner has walked §433**, and the order moves to Plans & pricing Stage 0.
