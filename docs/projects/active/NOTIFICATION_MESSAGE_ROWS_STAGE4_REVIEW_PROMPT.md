# Review prompt — Notifications that read at a glance, Stage 4: simplify, review, docs, commit

Paste into a fresh session: **"Run the prompt in docs/projects/active/NOTIFICATION_MESSAGE_ROWS_STAGE4_REVIEW_PROMPT.md"**

---

## Your job

Stage 4 of `NOTIFICATION_MESSAGE_ROWS_PLAN.md` is BUILT (2026-11-15) and uncommitted. Run, in this order:
**`/simplify` → `/review` → `/docs` → commit on `dev`.** The owner has said go for the commit (2026-11-15) once the
review is clean; that go covers this one commit of Stage 4's files, nothing else. Never `master`.

Read first: the plan's "Stage 4 as built", "Stage 4 rulings" (Q1–Q8, all as recommended; binding, do not re-open) and
"Stage 4 owner questions" (the questions as asked); the `/legal` section "Reviewed 2026-11-15 — Stage 4 proposal" in
`docs/agents/legal/CASL_LATE_BILL_EMAIL.md`. Stage 3's "Stage 3 review" section is the model for how the record reads.

## The files of this work (and only these)

Wholly this work's:
- `lib/notification-facts.ts` (eleven labels)
- `lib/league-signup.ts` (`signupNotice`, one entry for both registration senders)
- `lib/house-league-money-words.ts` (`ASK_WORDS.notice`, the withdrawal request)
- `lib/coach-capabilities.ts` (`staffApprovalNotice`)
- `lib/assistant-invites.ts`
- `lib/practice-plan-send.ts` (`practicePlanSentMessage`)
- `lib/club-season-notice.ts`, `lib/club-season-notify.ts`
- `app/api/league/[orgSlug]/[seasonSlug]/register/route.ts`
- `app/api/admin/house-league/seasons/[seasonId]/registrations/route.ts`
- `app/api/league/[orgSlug]/[seasonSlug]/withdraw-request/route.ts`
- `app/api/coaches/[orgSlug]/teams/[teamId]/events/[eventId]/practice-plan/send/route.ts`
- `app/api/admin/rep-teams/teams/[teamId]/program-years/route.ts`
- `app/api/coaches/[orgSlug]/teams/[teamId]/club-arrival/route.ts`
- `tests/unit/notification-facts.test.ts`, `tests/unit/club-stage2-server-guard.test.ts`, `tests/unit/club-stage2-screens-guard.test.ts`
- `docs/projects/active/NOTIFICATION_MESSAGE_ROWS_PLAN.md`, this prompt, and `NOTIFICATION_MESSAGE_ROWS_STAGE4_BUILD_PROMPT.md`
- `docs/agents/legal/CASL_LATE_BILL_EMAIL.md`, `docs/agents/legal/LEGAL_INDEX.md`, `docs/agents/legal/drafts/PRIVACY_POLICY.md` (one row, §6 push service)

Shared: **`TODO.md`** carries another session's new line (Release process hardening). Commit ONLY the Notifications line's
hunk (memory: "Partial commit out of shared files": a temporary index, or `git add -p` equivalent without an interactive
flag). `git diff` every file above before staging; if one carries a hunk that is not Stage 4's, leave that hunk out.

## 1. `/simplify` (before `/review`)

Scope: the files above. Things worth a hard look, with what was decided and why (keep a decision unless the code says
otherwise):
- `staffApprovalNotice` lives in `lib/coach-capabilities.ts` beside `STAFF_KIND_COPY`, because `lib/assistant-invites.ts`
  loads the server client and the test must import the words. Is that the right home?
- `clubSeasonNotice` and `clubSeasonStartedCard` now share `startedFacts`. Check nothing is written twice.
- `signupNotice` takes a `via` of `'signup' | 'entered'`. It is NOT `'admin'`: the house-league gate guard reads a quoted
  role word as a role.
- The practice plan's "three named, the rest counted" sits beside `joinNames`, which the coach-chosen email still uses
  for every station.
- Keep: every `[marketing]` tag, every needs-attention and one-open-copy metadata key (`registrationId`, `seasonId`,
  `inviteId`, `teamId`, `eventId`, `audience`, `sentBy`, `action`), the light-module boundary (`notification-facts.ts`
  imports nothing).

## 2. `/review`

Run the repo's `/review` funnel on these files. Points to hold or break:
- **The read is all-or-nothing** (Stage 3's real finding). For every input each entry can get, a blank part must never
  void the rows: a blank guardian, a declined or withdrawn registration status, a note that is only spaces, an unknown
  inviter, no stations, a blank station label, a first season with nothing carried, a roll with zero players.
- **The registration audience (Q2):** both senders go to `houseLeagueDeskUserIds` only; the hand-entered one leaves out the
  person who typed it; an empty desk sends nothing (an empty `userIds` must never reach `notify()`, which reads it as every
  member). The hand-entered path is fire-and-forget and must not fail the registration.
- **The withdrawal note (Q4):** never in the body (the push and the email print the body); quoted exactly in the Note row.
- **Q8:** the first season passes `programYear.tryoutOpen`; the roll path leaves it out (the roll always closes tryouts);
  the Overview card reads the season's live state. Check `programYear.tryoutOpen` exists on both reads.
- **Q1:** `lib/family-notify.ts` untouched; the family email byte-identical.
- Closed and reopened season notices: unchanged, no rows.

Apply what `/review` finds. A finding that is an owner call goes in the plan's Stage 4 owner questions, not decided.

## 3. `/docs`

No help article quotes wording that this stage made untrue. Two existing mismatches for `/docs` to fix (plan, "For `/docs`"):
- The withdrawal help (`lib/help-content/house-league.tsx` ~1325, `lib/help-content/org.tsx` ~788 and the search text
  ~749) says the notice "opens Registrations on that child"; its link opens the season's Registrations list. Fix the words
  to what the product does (do NOT change the link: that is product work, and a question for the owner if it matters).
- `lib/help-content/registrations.tsx` ~35 search text: "one needs attention notice per sign-up" — the kind is a "know"
  notice, and it now reaches the house-league desk.
Also check the coaches' practice-plan help (`lib/help-content/coaches.tsx` ~4407, ~4618, ~4624) still reads true (it
quotes a two-station line, which is unchanged).

## 4. Verify, one at a time

`node --import ./tests/ts-resolver.mjs --test <file>` for each test file above plus `house-league-gate-guard`,
`league-signup`, `practice-plan-send`, `house-league-signup-guard`, `league-signup-link`, `needs-attention-clears-itself`;
then `npm run check:spelling`; `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit`; `npm run verify:changed`.
Already failing and NOT this work (confirm each by name): `notification-open-in-place-guard` (the coach-stylesheet chain),
the possessive guard, workspace-flip, coach-practice-plans-phone, the coach schedule sheet guards, billing-plus-tax-words,
the dispute screens, and the non-test gates (admin old look, admin type, schema parity, index coverage, org-slug callers,
CSS selectors, export catalog, root files `.probe-edit.cjs`/`debug.log`); `tsc` errors only in the untracked
`tests/unit/layout-run-journal.test.ts`. A new failure in a file of this work is yours.

## 5. Commit

- `git rev-parse --abbrev-ref HEAD` is `dev` (switch if not). Stage explicit pathspecs only; `TODO.md` by its one hunk.
- Message, roughly: "Notifications read at a glance, Stage 4: five few-facts notices open as rows (new registration to the
  house-league desk only, a withdrawal's note out of the line, assistant approval, practice plan, season started with its
  real tryouts state); the moved family game keeps its sentence" + the attribution line.
- `git show --stat HEAD`: only these files. If a foreign file slipped in: `git reset --soft HEAD~1`, unstage it, re-commit.
- Then a hash-only follow-up commit: the plan's Status line and "Stage 4 as built", the TODO line ("committed `<hash>`
  2026-11-15"), and the `/legal` section's "commit owed". Update the auto-memory note
  `project_notification_message_rows.md` and its MEMORY.md line with the hash.

## Hand-off

- Product-owner summary: what `/simplify`, `/review` and `/docs` changed, the commit hashes, anything for the owner.
- Still owed to `/legal` (record it, do not do it here): the privacy draft's retention finding 11 should name the
  withdrawal note now kept in full on the stored notice.
- **The dev server:** restart it before the owner's browser check (shared modules changed). First check no other session
  is mid-sweep (several `next start` servers on ports 3046+ or a `.layout-check-head.mjs` process means one is); if one is,
  report it and ask rather than killing it. Otherwise: stop it, `rm -rf .next`, `npm run dev` with network access, wait for
  Ready, check `http://localhost:3000/platform-admin/login?next=%2Fplatform-admin` returns 200.
- Next: the owner's browser check of Stages 2–4, then Stage 5 (the six never-sent kinds and "Score submitted").
