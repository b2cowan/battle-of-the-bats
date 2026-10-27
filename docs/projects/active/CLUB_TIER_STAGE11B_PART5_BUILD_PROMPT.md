# Club Tier Stage 11b · Part 5: Send the changes and the emails (build prompt)

> **Written 2026-10-27** at the end of the session that built Part 4 (commits `6b61e109b`..`fb86d7c96` + the /review fixes; see
> `HOUSE_LEAGUE_STAGE9_PLAN.md` §9). **Paste this into a new chat on `dev`.** It continues `CLUB_TIER_STAGE11B_BUILD_PROMPT.md`
> (Part 5's paragraph, arguments 7 and 8, the definition of done, the walk) and `CLUB_TIER_STAGE11B_PART4_BUILD_PROMPT.md`. This
> file wins where they differ. Re-verify every lead before building on it: other sessions share this working copy (Stage 12, the
> support console, bookkeeping, the families' email work). Stage explicit paths only, commit only your own hunks, build a staged
> blob by hand when a file carries another session's edits, and check `git diff --cached --name-only` before every commit (a
> foreign staged file rides a plain commit; `git commit -- <paths>` takes the WORKING-TREE copy).
>
> **Recommended model: Opus 5.5.** A write that moves and cancels practices across two programs, emails to two audiences
> (one a family service notice), a migration, and screens another session is editing. Helpers stay on Sonnet for reading.

## ⚠ First: the club's Send the changes is broken for house league today (dev), and Part 5 is the fix

Found 2026-10-27 while writing this prompt, confirmed in code. The SQL step `club_schedule_apply_changes` (mig 393, ~line 72)
already carries house-league practices — it takes a `p_league` argument (uses to carry, practices to cancel, practices to move;
shape documented in mig 392 ~426–434) and **refuses** a send that would leave a house-league practice still to come on time
house league no longer has (mig 393 ~241–246: `changed: a house-league practice is still on time house league no longer has`).
**TypeScript never passes `p_league`** (`lib/club-schedule-send.ts` ~605–614), and the send maps any `changed:` to "read it
again" (~618). Until Part 4 no handed-out practice existed, so nothing reached it. **Now an owner who moves, clears or takes
back house-league time with practices on it and presses Send the changes gets a stale refusal on every try.** Dev only (11b is
not promoted). The k5 question already promises "Their coaches and families are told when you send the changes"
(`club-schedule-words.ts` ~734) — false until this part lands. Build the plan and the send (steps 1–3) before the emails.

## The drawings and the rulings (do not reopen)

- **Drawings:** https://claude.ai/artifact/TdXm5jmTEJ9qPvR3T5H9qU, tab "11b · club time", frame **h4** (Send the changes with
  house league in it; the house-league coach's email) and **k5** (the club takes time back). Source
  `docs/projects/active/HOUSE_LEAGUE_STAGE9D2_DRAWINGS.html` ~1548 (h4). Read the frames whole. **The words in the drawing are
  provisional; the copy file's are settled** (below).
- **Rulings** (`HOUSE_LEAGUE_STAGE9_PLAN.md` §0h): **9d2·2** (a practice CHANGE emails that team's families as well as its
  coaches; one email per household per send, one part per child) · **9d2·16** (the club takes back time: practices on it go,
  their coaches and families hear in Send the changes; unused time goes with no question) · **9d2·13** (the owner moving a
  division's GAME time: games wait in the division's Changes to send, families hear once from the league admin, and the club's
  Send the changes tells the league admins) · **deferred to 9d-3** (whether families hear when a team is FIRST given practice
  time — nothing in Part 5 emails on a hand-out).
- **Games are not Part 5's.** No house-league game sits on club time yet (9d-2a builds Generate games and the game slot link;
  9d-2b builds Changes to send). Build the practice rows; leave the drawn "U9 Rookie games" row and the "Game changes don't go
  from here" hint's game half for 9d-2a/b, and say so in the plan. Do not add a game slot link here.

## The words (settled — `HOUSE_LEAGUE_STAGE9D2_11B_COPY.md`)

- **"Send the changes, with house league in it (h4)"**: the shipped title, `whoChanges`, `sendToPeople`, `changeTeamLine` kept;
  a house-league team's row is the shipped row shape ("Reds · Sundays from Nov 8: Field 1 → Field 3, 11:00 a.m. → 12:30 p.m.");
  the group line **"House league · U9 Rookie · 2 coaches and 11 families"**; `changesHint` gains **"A house-league team's
  families get one email too. House league's game changes go out from the season."**
- **"The house-league coach's email (h4)"**: the rep coach's `changesEmail` shape, its subject, opening, lines, link ("Open
  {team}'s team page →"), outro and foot as settled.
- **"The families' practice-change email (new; 9d2·2)"**: subject, opening, **Now / Was** (Now first in full, Was only what
  changed), close ("Questions? Ask {team}'s coach." — no link), foot (9d-1's season sentence + "Times in Eastern time.").
- **"The club takes time back (k5)"**: the Part 1–2 build changed k5's foot to **"Nothing changes until you send the changes."**
  because league admins weren't told yet — **restore "U12's league admins are told then." only if step 4 below tells them.**
- Not settled, so it goes to `/marketing` (one pass, before the walk): `changesStatement` (~50, "Only those teams' coaches are
  told" is now untrue), a cancelled practice in both emails, the league admins' notice (step 4), the Automatic row's tag and
  words in the season's email history, any refusal. House rules: "8:00 a.m.", `possessive()`, `pluralize()`, sport-neutral,
  "league admin", never a promised notice that doesn't go.

## What is already built (re-read it)

- **The send:** `app/api/admin/schedules/[scheduleId]/send/route.ts` (GET preview, POST send) → `lib/club-schedule-send.ts`:
  `planChanges` (~275; runs `diffAgainstSent` with `teamsOnly(ids)` ~282 — house league deliberately left out; rows for rep
  practices only), `previewSend` (~387; who is told ~474, rows ~486–503, `recipientCount` ~513), `sendSchedule` (~533; the
  changes branch ~589–625, the one RPC ~605–614, the step's returned `league` counts ignored), `changesSummary` (~756, rep only;
  the "Changed since sent" callout). `diffAgainstSent` (`lib/club-schedule-engine.ts` ~1392) is pure.
- **The window:** `components/admin/kit/club/schedules/SendWindow.tsx` (preview types ~40–58, head ~133, `teamLine` ~139, hint
  ~231) on `components/admin/kit/club/SendParts.tsx`. **⚠ Another session has uncommitted edits to `SendWindow.tsx`,
  `SendParts.tsx` and `SendParts.module.css`** (SendSample → `useSendLevel`/`MailView`/`SendDoor`) — `git status` first; build
  on what is there, commit only your hunks.
- **The rep coach's email:** `changesEmail` (`club-schedule-words.ts` ~327), sent raw as kind `club_schedule_coach` (~631),
  recipients from `schedulePeople` (~123; never the sender); the bell `tellTeams` (~677).
- **House-league coaches:** `league_team_coaches` rows (name, email, user_id once accepted, removed_at). No change-email path
  today; `leagueCoachesToCopy` (`lib/families-email-coaches.ts` ~46) reads them and is reusable. The team page is
  `coachTeamPath` (`lib/house-league-coach-invites.ts`).
- **The family service notice (9d-1, argument 7):** `sendFamilyServiceBatch` (`lib/family-email.ts` ~271: batched, no
  suppression check — a service notice, never marketing). Its one caller is `lib/house-league-placement-mail.ts` (~68; counts
  refresh ~92) — copy that pattern. The Automatic row is `league_season_notices`; **mig 385 ~151–157 allows only
  `'teams_published'` and says "9d-2's schedule notices add their kinds here" — a new kind needs a migration** (400 or the next
  free; 399 is another session's, uncommitted). History read `lib/families-emails-log.ts` ~196; tag and words
  `lib/families-words.ts` ~618 (**modified by another session**). Footer `accountNoticeFootnoteHtml` via `familyNotice`
  (`lib/email.ts` ~850); the season sentence `seasonEmailReason` (`families-words.ts` ~485).
- **Households:** SQL groups active registrations with a team by `lower(btrim(guardian_email))` (mig 385 ~226–234). The TS
  audience `familyAudience` (`lib/families-audience.ts`) DROPS suppressed addresses — the wrong filter for a service notice;
  follow the placement mail instead.
- **k5:** `ScheduleWindows.tsx` ~118–154 asks, then `club_schedule_edit_slots` removes the program row now and marks the
  schedule changed since sent; practices and uses wait for Send the changes (correct — this part makes them move).
- **SQL checks:** `scripts/club-stage11b-check.sql` T7 (move: refused, then carried), T8 (take back: refused, then cancelled),
  T10 (a held practice never blocks). Run: `node scripts/db-query.mjs --dev -f scripts/club-stage11b-check.sql`.
- **A rolled-back dev fixture** for practice time exists: `.probe/11b4/e2e.ts` (the drawing's numbers; generates SQL for the
  runner). Dev holds no real house-league time.

## Build, in this order, each committed after its checks

**1 · The house-league plan (pure, tested first).** Beside `planChanges`, the house-league half: from the schedule as sent and
as it is now, each house-league slot that moved, was cleared, was taken back (program row gone) or was removed — and the
practices still to come on it — becomes the `p_league` the step expects: a use carried to its new slot, a practice moved
(new instants inside the new slot, place from the slot), or cancelled. Reuse `diffAgainstSent` (say how; it is one-sided by
team today). The step refuses a move onto a slot that isn't that division's practice time — the plan must never ask for one
(cancel instead, or carry the use first; argue which). Tests: a practice moved with its slot (Field 1 → Field 3, 11:00 → 12:30,
the h4 row); time taken back (k5) cancels; a slot cleared cancels; a practice already held is untouched; nothing house-league
in the send → `p_league` empty and the rep send unchanged.

**2 · The preview.** House-league rows in Send the changes (h4): one group per division, "House league · {division} · N coaches
and M families", each team's row in the shipped shape; the recipient count and "Who is told" include the house-league coaches
and households (households, never children); `changesHint`'s new sentence; `changesStatement` corrected (words to marketing).
The rep rows must not move: every existing scheduler test stays green; `club-scheduler-guard`'s `teamsOnly(ids)` assertion
(~95) changes with the reason in the commit.

**3 · The send.** Pass `p_league` from the plan the preview showed (never a fresh plan the owner didn't see — the stale check is
the same as the rep side's). Read the step's returned `league` counts. A refusal still reads as "read it again", but only for a
real race. **Until the send, the house-league schedule keeps the old time** — true today; keep it true.

**4 · Who hears, after the commit (never inside the transaction).**
- **The house-league coach's email** (settled words): one per coach per team, the team's rows, the link to the team page.
  Recipients: `league_team_coaches` not removed, with an email; never the sender. A new raw email kind beside
  `club_schedule_coach` (add it to the email-kind lists and the guard manifest).
- **The families' practice-change email** (argument 7): through `sendFamilyServiceBatch` as an automatic notice — one per
  household per send, one part per child (a family with two children on two changed teams gets one email), Now / Was, the
  season sentence. **One Automatic row per season touched** in `league_season_notices` with a new kind (the migration:
  `DATA_DICTIONARY.md` in the same unit, `npm run refresh:snapshots`, `MANUAL_PROD_STEPS.json`, the history's tag and words).
  Argue argument 7's alternative (one row per send) in the commit if you take it.
- **The league admins** (h4 counts them; 9d2·13 says the send tells them): find the product's in-app notice path for admin
  members (the bell) before deciding; recommended a bell notice to the season's league admins, not an email. If there is no
  fitting path, do not build one — ask the owner and keep k5's foot as it is. If you do tell them, restore k5's half-sentence.
- **Dev sends no email.** Verify through the send record and the logs (which rows were written, which addresses would have been
  mailed), and say so in the walk.

**5 · Check, don't build:** a practice moved by the send reads its new time on the Practices view ("From {schedule}") and on the
coach's team page; a cancelled one reads Cancelled on both; House league's time no longer shows time the club took back; the
club's slot window no longer lists the practice teams of a slot it cleared.

## Checks and done

- Unit tests for the plan (step 1) and the email builders (subject, Now / Was, one per household, two children, a cancel);
  `scripts/club-stage11b-check.sql` still passes — **add a case** that feeds the step a `p_league` in the exact shape the
  TypeScript plan produces (carry, move, cancel in one send); a dev end-to-end on the `.probe/11b4` pattern: hand out practices,
  move a slot and take one back in the club's schedule, send, read the practices and the notice rows, roll back.
- `npm test` on `club-schedule-send`, `club-scheduler-guard`, `club-scheduler-screens-guard`, `league-practice-time`,
  `league-time`, `family-email-guard`, `kit-dialog-foot-text-guard`, `house-league-gate-guard`; `npm run verify:changed` (a
  failure in a file 11b doesn't touch is another session's — confirm before blaming yourself); `npm run typecheck`;
  `npm run lint:focused -- <files>`; `npm run check:migrations`.
- `/review` on Part 5 (high-risk: a write across two programs, family email, a migration) — fix or record findings.
- Records: `HOUSE_LEAGUE_STAGE9_PLAN.md` §9, the scheduler plan's 11b block, memory `project_club_stage9_house_league.md`.
- New files → the dev server needs a restart before the owner tests; ask first.
- **Ask the owner at hand-off:** the Part 4 asks still open (a "Practices a week" choice; walking Parts 3 + 4), and whether the
  11b walk (end of 11b, after Part 6's help) should now be written — it is the next § in `OWNER_QA_LEDGER.md` (check the last
  number) and its contents are in `CLUB_TIER_STAGE11B_BUILD_PROMPT.md`'s definition of done.

## Do not

- Email anyone on a hand-out or a first practice (9d-3). Send a game change from here (9d-2b). Put practices on any public or
  family page — the families' email has no link by ruling.
- Pass `p_league` from a plan the owner didn't see; let a house-league email go inside the step's transaction.
- Use the family audience that drops suppressed addresses for a service notice — or, the other way, send a service notice
  that is really an announcement.
- Rebuild the Send window or its parts (another session's), or the house-league Schedule toolbar (9d-2a).
- Push or promote.

## Git

`dev` only. Explicit pathspecs; `git diff --cached --name-only` before and `git show --stat HEAD` after every commit; a staged
blob built by hand when a file carries another session's hunks (and commit from the index, not `-- <paths>`). No push and no
promote without the owner's word.
