# Admin type sweep — Stage 3, the club admin (build prompt)

> Paste into a fresh session on `dev`. Written 2026-10-19 by the session that recorded the Stage 2 walk (✅ 22 of 22).
> **Read first, whole:** `ADMIN_TYPE_SWEEP_PLAN.md` §2 (the target), §4 (stages + Stage 1 and Stage 2 "as built" —
> their lessons apply here), §6 (A1–A14, all ruled as recommended 2026-10-19) and §7 "S3 — club admin" (45 items,
> 194 elements, each with `path:line`). Hub: https://claude.ai/artifact/QcQCe3yy4oqRUnUEf9uMCb.
> **Write to the owner as a product owner** (what a club admin sees), never in file names. Disagree out loud before
> the work, not in the summary after it.

## What Stage 3 is

The last old console lettering (typewriter font, ALL CAPITALS, wide spacing, extra-bold, Title Case words) leaves the
club admin: house league, rep teams, accounting (Ledger balance rows, Budget vs. Actual), plan & billing,
organization settings + PDF settings, the public-site editor, first-run setup, the notifications page, the help hub
and What's new, the overview checklist, venues, schedules, members and audit log. 107 of the 194 elements are Title
Case words. Target = plan §2: body face, sentence case, normal tracking, 650–700 for everything except eyebrows,
chips, readouts, codes and table headings; figures in the body face with `tabular-nums`.

## Already decided — do NOT re-ask (plan §6)

- **A7 Excel / CSV headings stay as they are** → C07, C08, C16, C18, C20, C37, C38 are **no change**.
- **A10 fact labels over a value stay eyebrows** → C04, C25: no visual change; mark the rule `type-ok: eyebrow`.
- **A4 band headings: the standard was written to what is built** → C03 is no change (confirm the standard row and
  RepKit agree; mark `type-ok`).
- **A3** a small label used as a card/section title → a sentence-case section title in the body face (C05, C11, C40, C50).
- **A1** figures → body face + aligned digits (C44 billing prices and counts, C60 notification time, C62 help counts).
- **A2** codes keep the typewriter face, no capitals (C41 — and use the product's data face, not a hand-set `monospace`).
- **A6** shared parts change everywhere at once — the notifications page and the help hub are the coaches portal's
  too (C56–C58, C61–C64). **A8** role names in help exactly as Members shows them; the rest of the card sentence case.
- **A11** help eyebrows = the standard eyebrow, titles = the window title's weight. Coordinate with Help system
  redesign v2 (P3/P4 open): change lettering only, not structure.
- **A13 house league is fixed NOW** (Club Tier Stage 9 is the last Club Tier stage; League-plan clubs use it today).

## ⚠ Two things the gate must put to the owner (found 2026-10-19 while writing this prompt)

1. **The public-site editor (C50, C51 — 8 elements) has changed hands since A13 was ruled.** A13's reason was that
   Club Tier Stage 4 was "to come". Stage 4 was **drawn 2026-10-19** (https://claude.ai/artifact/QhdgL1QnfRndu4ZAoTB67k,
   asks 1–13 open) and its ladder's **4c rebuilds the editor**. Fixing its card titles now is work the rebuild redoes
   and a collision risk if a 4c session starts. **Recommend: hand C50/C51 to Club Tier Stage 4 as part of its
   definition of done** (A13's own stated alternative) and add one line to the Stage 4 plan entry. Ask; do not decide.
   Before asking, open the Stage 4 drawings and confirm the editor is in them (`CLUB_TIER_PRODUCTION_READINESS_PLAN.md`,
   "Stage 4 — The club's public face", lists "the editor" among the drawn screens).
2. **"Pending Review" is a status name across the product, not a house-league word.** It appears ~56 times in 26
   files: tournament results, the schedule day list, the scorekeeper, event settings, house league registrations and
   notifications, rep-team tryouts, the public status lookup, coach status words, and 13 times in the tournament help
   articles. Changing it in house league alone (C15, C21) makes **two spellings of one word** — a product bug under the
   one-spelling rule. Draw the choice: **(a)** sentence case "Pending review" everywhere (a cross-product rename, help
   `keywords`/`searchText` included, and a check that no code matches on the display string), or **(b)** keep it as a
   capitalized status name everywhere and leave C15/C21's instances. Recommend (a) only if the census confirms it is
   display-only; otherwise (b). Do the same check for any other Title Case status word you find shared across
   modules ("Registration Open", "Pending", "Declined / Withdrawn").

## The gate — nothing builds until the owner rules on the drawings

**Item ONE: drawings, published as their OWN Artifact, before any code.** Source
`docs/projects/active/ADMIN_TYPE_SWEEP_STAGE3.html`, built under `.probe/ats3/` (the pattern of `.probe/ats2/`);
link it from the hub. Load `artifact-design` first. Draw the decisions, not every control:

1. **Whole screen, before and after — house league season home** (the most items in one place: A3 card titles,
   transition buttons, date labels, window titles), at 1440 **and** 390, Warm. Show the whole page, not a crop.
2. **Plan & billing (non-Club plan) — the price block**: price, next-season price, unit, "used / limit" count (A1),
   and the two whole sentences in the typewriter face (C43). Today / proposed.
3. **A3 section titles** — rep teams (Past seasons / Team history / Rename web addresses, C05) and PDF & export
   settings (C40). One pair each.
4. **Notifications page on a phone (390)** — Unread / All toggle, zone pills, Done, the time on an item (C56–C58, C60).
   Note which of these Stage 1 already changed (it did the drawer's Done and the day dividers — re-read before drawing).
5. **Help hub** — search-result group heads + result button (C61), a hub card with a role name (A8, C63), the count
   (C62), the What's new panel (C64).
6. **First-run setup** — the Automation block heading and the Review step's row labels (C52, C53).
7. **Accounting** — Ledger "Starting / Ending balance" rows (C28) and the Budget vs. Actual column heading (C34).
8. **The words table** — every Title Case string Stage 3 changes, one row each: screen · today → proposed ·
   shared elsewhere? (yes/no). Not drawn; a table the owner can scan. Flag any word that is a product or feature name
   (check `PLAN_PRICING_FACTS.md` for plan/product names, e.g. C47 "Premium") and any word a help article quotes.
9. **The two calls above** as asks with a recommendation each.

Captions carry NEW / RESTYLED / UNCHANGED. Today = a capture of the live dev screen; proposed = drawn from the kit's
real tokens. Run `/design` on the drawings **before** the hand-off and apply or decline each finding with a reason.
Owner rules → record in the plan (a "Stage 3 — drawn" section, as Stage 2) and the design log only if a new rule
results.

⚠ **Captures are read-only.** In Stage 2 the capture helper clicked into an autosaving field and saved a theme colour
on dev tournament `uat-phase2c-plus-championship-2026` (theme_primary `#1E3A8A`, theme_accent `#D9F99D`; both were
NULL). Never click into a field while capturing. That restore is still open — ask the owner whether to put both back
to NULL; do not do it unasked.

## Build (after the owner's rulings)

Suggested parts, each verified before the next; one owner stop at the end unless the owner asks for more:
- **3a House league** (C09–C21; the biggest — 9 files).
- **3b Rep teams, accounting, schedules, overview, venues** (C03–C08, C25, C27, C28, C34, C35).
- **3c Settings + PDF, plan & billing, first-run setup** (C40–C47, C52–C55, C12 LeagueCap upgrade).
- **3d Shared with the coaches portal** — notifications page, help hub, What's new (C56–C64). Check the coaches
  portal's copies render as intended.
- **C50/C51** only if the owner keeps them in Stage 3.

Rules learned in Stages 1–2 (plan §4):
- **Removing an uppercase transform publishes the string it hid.** Every caps fix reads the underlying text and sets it
  in sentence case in the same change.
- **A Title Case label can be a KEY.** Stage 2 found the bracket's automatic round names are strings the engine
  matches on (B6). Before changing any label, grep where the string is compared, stored or used as a lookup; change the
  display through a words layer, never a stored value. Status words especially.
- **`kx(legacy, kit)` MERGES** — a legacy half is not dead; only the props the kit half sets are replaced.
- **Prefer folding into the base rule** over adding another override layer.
- Mark every rule that keeps capitals or the data face for an allowed role with `type-ok: <role>`.
- One spelling everywhere: grep the other spelling before introducing a word; help `keywords` / `searchText` follow.

## Verify, records, walk, commit

- `npm run verify:changed` (includes `check:admin-type`, `check:old-look`, spelling). After the drops, lock them in:
  `check:admin-type --init` and `check:old-look --init`; record the new baseline counts in the plan.
- Lint the changed files; `npm run typecheck` (shared help/notification modules are touched).
- `npm test` — at Stage 2 it had two failures in other sessions' files (AdminKitFrame rail scrollbar; coaches
  `.occGroupPermit`). Re-check at the start so you know what was already red.
- `check:layout --changed` only if it stays on the club screens. The help and notification sheets are shared chrome,
  which widens the sweep to the whole product; that sweep runs on staging (owner 2026-10-13). Say which you ran.
- `/review` on Stage 3's files only (the working copy holds other sessions' edits).
- **Owner walk:** its own checkable Artifact (`ADMIN_TYPE_SWEEP_STAGE3_WALK.html`, like Stage 2's: Parts by area,
  checkboxes, a paste-back), one purpose (the lettering), Warm then a Dark spot-check. Link it from the hub.
- **Commit** only with the owner's OK, explicit pathspecs only, then `git show --stat HEAD`. ⚠ Files such as
  `lib/help-content/org.tsx` may hold another session's uncommitted edits — commit your hunks only (temp index, or
  HEAD + your exact edits).
- **Records:** the plan's "Stage 3 — as built" (departures, checks, known left), the TODO line, the hub (read the
  live copy every line first; `JSON.parse` both `application/json` blocks before publishing; same file path), the
  auto-memory `project_admin_type_sweep.md` and its `MEMORY.md` line.
- **Offer `/docs`**: help articles quote button wording ("click **Open Registration**"). **Offer `/demos`** once per
  release, not per commit: the house-league tour narration may quote a renamed button.

## Not this stage

S4 (new-look drift — run after S3 so each screen is touched once where possible), S5 (dead styling), the parked items
(plan §5: chat, the Send feedback window, the old message window), and Stage 2's open owner call (the bracket editor's
Field box vs the club's one Venue field).
