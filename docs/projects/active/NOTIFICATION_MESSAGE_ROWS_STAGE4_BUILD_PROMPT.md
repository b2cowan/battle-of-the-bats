# Build prompt — Notifications that read at a glance, Stage 4 (the six few-facts coach and league notices)

Paste into a fresh session: **"Run the build prompt in docs/projects/active/NOTIFICATION_MESSAGE_ROWS_STAGE4_BUILD_PROMPT.md"**

---

## Your job

Build Stage 4 of `NOTIFICATION_MESSAGE_ROWS_PLAN.md`: the six remaining notices that string three or more separate facts
into one sentence. Each gets a one-line summary (what the list rows, push and email read) and opens as labelled rows, using
the shared pattern Stages 2 and 3 built. All nine drawing asks were ruled on 2026-11-14 and the plan's "Drawing rulings",
"Owner rulings", "Stage 3 rulings" are binding; do not re-open them. Drawing (grammar only, none of these six is drawn):
https://claude.ai/artifact/4oPRNGetZWQ2ei483Gs2i5 (v2; source `NOTIFICATION_MESSAGE_ROWS_MOCKUP.html` beside this file).

The six kinds (census group B, the ones no earlier stage took). **The census is a lead, not evidence: open the cited lines.**

| Kind | Who reads it | What the reader hunts for | Typed text? |
|---|---|---|---|
| `house_league_registration_new` (public sign-up path and admin-entered path) | members who can use house-league registration | who, which season, how it stands (approved / to review / waitlist) | no |
| `house_league_withdraw_request` | the house-league desk | who, which season, the family's reason | **yes: the family's note** |
| `family_game_update` (moved, cancelled, going ahead) | families who follow the team, and the team's coaches | what changed, the new day, time and place | no |
| `assistant_coach_approval_requested` (asked and "changed" variants) | club owners and admins | who invited whom, to which team, as what, what the role gets | no |
| `practice_plan_sent` | staff the sending coach chose | MY stations (a list that can be long), arrive-by, start | no |
| `club_season_changed` ("started" variant only) | the team's staff | what came along with the team (players, budget, fee plan, opening balance), tryouts state, the kept record | no |

**Not in this stage (do not touch):** `team_coach_game_changed` ("A game changed", ruling Q8: it keeps its sentence);
`club_season_changed` closed and reopened (one fact each, they stay as they are); the 42 one-fact kinds; the four typed-text
kinds; "Score submitted" and the six never-sent kinds (Stage 5).

## Where things stand (check before you start)

- Stages 2 and 3 are committed on `dev` (Stage 3 `8f5f2e491`, plus a hash-only follow-up). Run `git log -8` and `git status`
  first. If the owner's browser check of Stages 2 and 3 produced follow-up changes, build on those.
- **Use what exists; don't rebuild it:**
  - `lib/notification-facts.ts`: the stored shape (`metadata.facts`), `factRow`, `noticeFacts`, `capFactList`, `factLine`
    (a list line with a bold part), `readNoticeFacts` (all-or-nothing, never throws), and `FACT_LABELS`, the one
    vocabulary. A row that IS its list is written `factRow(label, null, { list })`. Add a label only when no existing word
    means the idea; at most 11 characters (a test holds it).
  - The message block already draws rows, lists, the fold at 6 ("Show N more …"), at most 30 stored, the settled line
    replacing the next step, and the phone sheet's pinned buttons. **No frame work is expected.** If a kind seems to need
    one, put it to the owner as a question.
  - The pattern: ONE words entry per kind that every sender calls, returning `{ title?, body, facts }`; a guard test that
    every sender passes facts (`tests/unit/notification-facts.test.ts`). Extend it to these six.
- **Stage 3's lesson (the review's one real finding):** the stored rows are read back all-or-nothing, so one blank or
  malformed part makes the notice lose ALL its rows and fall back to the bare line. For every input each entry can
  receive (an empty name, a missing season, a note left blank, no stations, zero players), check what is stored and that
  `readNoticeFacts` still reads it back. `factRow` leaves out a row with no value; `capFactList` drops blank lines.
- Keep the light-module boundary: anything the message block imports stays light (`lib/league-time-notice.ts` is the
  precedent). `notification-open-in-place-guard` is already failing for an unrelated chain; do not let a new break hide
  behind it.

## Read first (in this order)

1. `NOTIFICATION_MESSAGE_ROWS_PLAN.md`: rulings, "Stage 2/3 as built", "Stage 2/3 review", the owner questions still open.
2. The drawing, tabs 1 to 3 (the grammar), on Computer and Phone.
3. `NOTIFICATION_MESSAGE_ROWS_CENSUS.md`, group B rows for the six, and "Surprises".
4. Stage 3's code as the model for a list: `lib/family-availability-words.ts` (`coachBellWords`),
   `lib/club-hand-back-words.ts` (`bellAnswered`), `lib/champions.ts` (`championsNotice`). Stage 2's for plain rows:
   `lib/online-payment-words.ts`.

## Blocking gate, before any code

1. **`/legal` first (ruling Q7).** Find which of the six can email or push from the body and say what each will read after
   the change. **Two need particular care:** `family_game_update` goes to FAMILIES (a parent's email or push about a
   schedule change: CASL/privacy, and it must stay a plain service message with no promotion), and
   `house_league_withdraw_request` carries a family's typed words (privacy: a note can hold health or family details;
   never shorten or reword it, and do not copy it anywhere new). Stage 3's answer is the last section of
   `docs/agents/legal/CASL_LATE_BILL_EMAIL.md`. Apply what `/legal` finds, or record it as an owner question.
2. **Product-manager UX summary in the chat** (AGENCY_RULES): what a reader sees differently, per kind, per frame
   (computer reader, bell drawer, phone sheet), per role. `family_game_update` has a family reader as well as a coach
   reader; say which frame each sees.
3. **None of the six is drawn.** Follow the drawn grammar (label column, bold lead, quiet detail, list under a row, one
   next-step line). If a kind needs a row, a label or a fold the drawing and the rulings do not settle, put it to the owner
   as a question; do not decide it. Likely candidates: the labels for registration status counts, the "started" season's
   "Came with" list, and a station list's label.

## What to build

For each kind: store its facts, make the stored body the one-line summary, and give the kind ONE words entry that every
sender calls (ruling 5: one wording per kind across all its senders). A notice sent before this keeps its paragraph
(ruling 4); no back-fill. **Do not change what a notice says to the person it is for beyond restructuring it:** the title
stays, the link stays, the audience stays.

- **`house_league_registration_new`.** Two builds today (public sign-up: guardian · season · counts by outcome; admin-entered:
  just the season, the title carries the player). One words entry for both. Rows: Season, Guardian, Status counts (approved,
  to review, waitlist, only the ones that apply).
- **`house_league_withdraw_request`.** Rows for the family and the season; the family's note stays a quoted line under its
  own label, **never shortened or reworded in the rows** (the body's 120-character cut today is a decision to keep or
  raise as a question, not to change silently). "No note" when empty stays honest.
- **`family_game_update`.** Three builds (moved, cancelled, going ahead). The one line stays the sentence a parent
  reads; opened, Opponent, When, Where as rows. Check the family-facing frame (the family app) and the coach's twin (same
  words, Schedule link).
- **`assistant_coach_approval_requested`.** Asked and "changed" variants: one words entry. Rows: Invited by, Invitee, Team,
  Role, what the role gets. The invitee's email is an address typed by the inviter; keep it exact.
- **`practice_plan_sent`.** Personal per recipient. The stations are a LIST under a row (fold at 6); Arrive by and Starts
  are rows; a person with no stations gets no empty row. The push/email body stays one line.
- **`club_season_changed` (started only).** What came along is a list or rows (players, budget, fee plan, opening balance;
  only what actually carried over), then the tryouts state and the kept record as rows or the next step.

Words are draft copy: tag new labels, one lines and next steps `[marketing]` in the words files, and run
`npm run check:spelling` (clock = `formatTime`, one spelling per word, "installment" two Ls).

## Don't

- Don't touch Stage 5 work, the kinds listed as out of scope, or the drawing's frame: 5.5rem label column, labels at most 11
  characters, fold at 6, at most 30 stored, the settled line replacing the next step, phone buttons pinned only when the
  message outgrows the sheet.
- Don't change senders' needs-attention metadata keys or one-open-copy subject keys: resolvers read them.
- Don't touch hooks, settings or shared automation. **The tree is shared**: another session has many club-schedule, permit
  and schema-snapshot files dirty. Stage explicit pathspecs only, and for a shared file (`TODO.md`) stage only your own
  hunk (memory: "Partial commit out of shared files"). Commit on `dev` only when the owner says go; never `master`.

## Verify

- Unit tests: each kind's facts round-trip through JSON and `readNoticeFacts`; every blank-input case above still reads
  back; a notice without facts keeps its paragraph; every label is in the shared vocabulary and at most 11 characters;
  every sender of a kind produces the same words for the same facts; a list past 30 closes with "and N more …".
- One at a time: the new and touched tests (`node --import ./tests/ts-resolver.mjs --test <file>`),
  `npm run check:spelling`, `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit`, `npm run verify:changed`.
- **Already failing, not this work's, confirm each by name and report:** `notification-open-in-place-guard`,
  `online-payments-card-dispute-screens`, `support-console-stage4b-inforce-guard`, ESLint's missing `react-hooks` plugin, and
  about twenty more from other sessions' dirty files (possessive-guard on PlayerGuardiansCard, the coach schedule sheet /
  phone / series-date-groups / kit-dialog-floor guards, workspace-flip, org-billing-access, plan-billing-usage,
  plan-reader-door, billing-plus-tax-words, account-first-signup, club-accounting-teams, club-stage13a-doors,
  coach-practice-plans-phone, support-console-stage3, team-move-coverage, public-tournament-stage6-walk). A NEW failure in a
  file of this work is yours.
- Offer `/simplify` (before `/review`), then `/review`, per CLAUDE.md. Offer `/docs` if a help article quotes one of these
  notices' wording. The owner does the browser checks.

## Hand-off

- PM summary (product-owner voice): what each of the six looks like now, the email check per kind, `/legal`'s outcome.
- Any copy or ruling question for the owner, written into the plan's "Stage 4 owner questions", not decided.
- Update the plan's Status line, the TODO.md line (your hunk only) and the auto-memory note
  `project_notification_message_rows.md` with what was built and its commit (or "built, commit owed").
- **The dev server:** restart it before the owner's browser check (shared modules changed): stop it, `rm -rf .next`,
  `npm run dev` with network access, wait for Ready, check `http://localhost:3000/platform-admin/login?next=%2Fplatform-admin`
  returns 200. **First check no other session is mid-sweep** (several `next start` servers on other ports means one is);
  if one is, report it and ask rather than killing it.
- Next: the owner's browser check of Stage 4, then Stage 5 (the six never-sent kinds and "Score submitted"), then the one walk
  and `/docs`.
