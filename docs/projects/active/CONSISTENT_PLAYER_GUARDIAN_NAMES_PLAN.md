# Consistent First + Last Names for Players & Guardians (across the coach product)

**Status:** PLANNED — not built. Owner-decided 2026-06-24 during the Coach Experience walkthrough (Step 7). Spun out of the upgrade walk: the free portal stores a player/guardian as a single free-text name, Premium stores split first/last, so upgrading a free team has to *guess* the split and surface an "uncertain name" review item. Decision: **stop guessing — collect first + last at the source, everywhere.**

**PM brief:** [CONSISTENT_PLAYER_GUARDIAN_NAMES_PM_BRIEF.md](CONSISTENT_PLAYER_GUARDIAN_NAMES_PM_BRIEF.md) · **Related:** [COACH_PREMIUM_UPGRADE_FLOW_PLAN.md](COACH_PREMIUM_UPGRADE_FLOW_PLAN.md) (this simplifies its migration contract).

## Decision (locked)

Players **and** guardians use **two name fields — first name (required), last name (optional)** — consistently across the **free Basic Coaches Portal**, the **Premium Coaches Portal**, and **tournament registration rosters**. They then map **1:1** free→Premium, which:
- removes the lossy name-split on upgrade and the **"uncertain name" review flag** entirely, and
- gives clean, structured names everywhere downstream (sorting, lineups, exports).

Last name is **optional** so mononyms / single-name players (e.g. "Madonna", "Pelé") and unusual name shapes still work — first name required, last blank allowed.

## Current state (the mismatch we're fixing)

| Surface | Player name today | Guardian name today |
|---|---|---|
| **Free / Basic portal** (`basic_coach_team_players`) | single `name` (free text) | single `guardian_name` (nullable) + `contact_email`/`contact_phone` |
| **Premium portal** (`rep_roster_players`) | split `player_first_name` + `player_last_name` — **both required** today | split `guardian_first_name` + `guardian_last_name` (already optional since the guardian-nullable change) + email/phone |
| **Tournament registration roster** | _to confirm_ (first build step) — if player names are captured there, they're likely a single field | _to confirm_ |
| **Upgrade migration** | guesses the split (last token = surname); flags 1-token & 3+-token names as "uncertain" | best-effort split of the single guardian name |

## The change, surface by surface

1. **Premium portal — small relaxation.** Make player **last name optional** (it's required today, in both the add-player form and the underlying data) so a blank last name is valid. First name stays required. Guardian fields are already optional in the data; align the Premium add-player form to **allow a blank guardian** too (today the form requires guardian name + email even though migrated rows can have none) — so the manual-add experience matches the free side and the data model. *(Guardian-required relaxation is part of "consistent across the board" — flag for owner confirm.)*

2. **Free / Basic portal — the bulk of the work.** Replace the single player name with **first + last**, and the single guardian name with **guardian first + last**, in: the roster add/edit form, the data model, the API validation, and every place the single name is displayed. First required, last optional, for both player and guardian.

3. **Upgrade migration — gets simpler.** With both sides split, the copy becomes a straight **1:1** (first→first, last→last, guardian first/last→same). The name-guessing logic and the **"uncertain name" summary flag are deleted.** (The "missing guardian contact" flag stays — that's about *missing data*, not name shape.) This removes one of the "check these" items from the upgrade experience.

4. **Tournament registration rosters — confirm + align.** First build step: confirm whether/where tournament registration captures **player** names as a single field; if so, split them the same way for consistency. **Separate question for the owner:** the **registrant/coach name** (the person who registers a team) is not a player or guardian — decide whether it's in scope for the same treatment or left as-is.

5. **Downstream consumers — a checklist pass.** Update everywhere a person's name is shown, sorted, searched, exported, or emailed to read the two fields and handle a blank last name gracefully (display "First Last", or just "First" when last is empty; sort by last-then-first with blanks grouped). Covers roster exports (CSV/XLSX/PDF), lineup/attendance displays, and any dues/announcement references.

## Existing data (negligible — verified on dev)

A live audit found **~9 free-portal players total across all of dev** (mostly our own test records) and **3 Premium players**, and the coach product **isn't launched on production** — so there's essentially no real single-name data anywhere. The one-time conversion of existing single names into first/last is therefore **trivial**: split the handful that exist, retire the single-name columns, and skip any dual-read/legacy-fallback complexity. No backfill risk at any scale.

## Tradeoffs / decisions

- **Friction:** one extra field per player and per guardian on the free roster. Small, and structured names pay off everywhere downstream. (Owner accepted.)
- **Last optional** is essential — forcing a last name breaks mononyms and many real names. First required is enough.
- **Sequencing — do this BEFORE the coach product launches publicly.** Two reasons: (a) the upgrade then never produces the "uncertain name" flag, and (b) we never accumulate single-name data at scale that we'd have to convert later. It also tidies the just-built upgrade migration (one less guess, one less "check these" item). Low risk to fold in now while data is empty.
- **Guardian optionality** (item 1) is a related consistency call bundled here; confirm with owner.

## Out of scope (unless owner extends)

- The **registrant/coach name** on tournament team registration (a coach, not a player/guardian) — flagged for a separate decision.
- Renaming/normalizing existing *display* conventions beyond what the two-field model requires.

## Effort & shape

**Medium**, bounded. The **free portal is the bulk** (new fields + form + model + API + displays + a small data conversion); **Premium is a light relaxation** (last name + guardian optional); the **migration gets simpler** (delete the split + flag); **consumers are a checklist**. Touches shared/core modules (the data layer + shared types) and the roster forms — so build with the usual per-hunk staging care on the hot shared files. Adds one small dev migration (free-portal name columns + Premium last-name nullable) — dev first, prod before the coach launch.

## Success criteria

- A coach enters first + last (and guardian first + last) in **both** free and Premium; **last name optional** works (mononyms accepted).
- Upgrading a free team copies names **1:1** with **no "uncertain name" flag**.
- Names display, sort, export, and email correctly everywhere under the two-field model, **including blank last names** — no broken "First " strings or mis-sorts.
- The handful of existing single-name rosters are converted cleanly; no single-name data remains.

## Verification

- Build on dev; `npm run typecheck` (shared modules), focused lint, `check:dictionary`/`check:snapshots` (schema change), `/review` (touches the data layer + the money-adjacent upgrade migration).
- Owner browser-tests on dev: add a player with first+last and one with first-only (mononym) in both portals; upgrade a free team and confirm names land 1:1 with no name flag; check a roster export and a lineup render with a blank last name.
