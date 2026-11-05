Public tournament pages — Stage 8 Part 5: the data and the wording around it. Build on `dev`. The code work is small;
most of this part is four agents' passes (`/db`, `/docs`, `/strategy`, `/demos`), each run IN this session as a skill.
Then /review on the code and migration only, then show me the result and the exact file list and WAIT for my go before
committing.

READ FIRST: AGENTS.md, AGENCY_RULES.md, and docs/projects/active/PUBLIC_TOURNAMENT_STAGE8_PLAN.md — §4 (Part 5), §5, §6
(asks A–D), and the "Handed on" lists of §17 and §18 (Part 4a, 4b). Argue from the code, not from this prompt: re-open
every claim below before acting on it. Parts 1–4b are committed on `dev` (§18's title holds the last hash); nothing here
ships until Part 6, but dev must work at every commit.

Present the plain-language UX summary first (blocking), before any change. If the code says this prompt is wrong, say so
BEFORE doing the work and ask.

ALREADY RULED (do not re-ask): asks A–D (2026-11-03, logged in BUSINESS_DECISIONS.md "Tournament branding is a logo,
colours and type"); Part 4's split and its in-session rulings (§17, §18), including "branding done" counting a chosen
type look. Ask C stands: the dead columns are NOT dropped in this stage.

SPLIT RULE: if context gets deep after 5a+5b, stop there, commit what is done on my go, and write the rest as a Part 5
continuation prompt. One commit per agent pass is fine; never mix another session's hunks in (the tree is shared).

THE WORK (re-open each)
5a. The `theme_font` empty. Migration 426 already empties `tournaments.theme_font` (dev applied 2026-11-02; prod step in
    MANUAL_PROD_STEPS.json, "apply before the promote that ships Stage 1a Part 1"). ⚠ QUESTION TO ANSWER FIRST, from the
    code and the release-history record: is a SECOND data-only empty still needed? The case for it: production's old
    Branding page writes the retired font list into `theme_font` (e.g. 'barlow') until the flip ships, so any gap
    between 426 on prod and the promote refills it — and after the flip a filled value is read as a type look AND ticks
    "branding done". Dev may hold such values too (the switch-off page wrote them until Part 4b) — count them
    (`SELECT theme_font, count(*) FROM tournaments GROUP BY 1`). If a second empty is the right answer, write it as the
    next free migration number, data-only, re-runnable, ONLY non-type-look values (`theme_font NOT IN
    ('system','dm-serif','inter')`) unless the count proves a blanket empty is equivalent — never empty a deliberate
    Look-card pick. Add its MANUAL_PROD_STEPS entry (426 precedent: apply on prod immediately before the promote,
    verify query, rows expected). If it is NOT needed, say why and amend 426's prod note instead (it must be applied in
    the same window as the promote, not earlier). Data first: the migration applies BEFORE the code that depends on it
    (§5). Apply to DEV only; nothing against production.
5b. `/db` (run the skill): DATA_DICTIONARY.md — the tournament branding block (~812-821: `hero_banner_url`,
    `theme_card_style`, `color_mode`, `icon_bg_color`, `app_name`, `app_icon_scale` now read and written by nothing,
    kept per ask C; `theme_font` = the type look, mig 426's meaning), the `settings` key catalog (~809: `rulesLayout` /
    `resourcesLayout` RETIRED, no reader, not copied), and the ORGANIZATION branding block (~142-145) whose line "defaults
    that each tournament overrides per-event" is stale — check what still reads `organizations.theme_card_style` /
    `theme_font` / `hero_banner_url` before you write a word. Any new migration → `npm run refresh:snapshots`,
    `check:dictionary`. `lib/types.ts` and the `lib/db.ts` row mapper still carry the dead tournament fields: /db
    decides whether they go now (no reader — prove it) or with the later column drop; record the call. Record the
    later column drop as its own TODO/plan line (not this stage).
5c. `/docs` (run the skill): the in-app help is the single source. Known drift (re-grep, the list is not exhaustive):
    `lib/help-content/tournaments.tsx` — the Branding article (~442-453: keywords/searchText/body with "hero banner",
    "fonts"), the "Built with" FAQ (~516-521), the branded-icon FAQ (~566-570: "app icon", "branded icon" — the icon is
    always FieldLogicHQ's), the public-site-preview guide (~2426-2444: "six closed cards"; ~2512 home-screen line), the
    Rules & resources guide's Layout menus (~397, from §17); `lib/help-content/org.tsx` ~1219 ("each tournament picks
    its own [card style] on its Branding page" — false now). Describe the page as it is: the door, Pages, Look (colours,
    type, the band preview), Logo; the lock line's words. One spelling everywhere (`check:spelling`); help keywords and
    searchText updated with the body.
5d. `/strategy` (run the skill): the decision is ALREADY logged (BUSINESS_DECISIONS.md 2026-11-03). Its job here is the
    drift check that entry deferred: (b) `LOCK_WORDS.branding` is now deleted (Part 4b) — confirm and record; (d) the
    help drift — confirm 5c closed it; PLAN_PRICING_FACTS.md ~198 "Tournament branding reframe" line — its status words
    ("not yet built") vs what is now built on dev (status wording rule: record the positive fact with its anchor; deployment
    state lives in the release-history record). No price, plan, gate or feature key moves — if the check finds one, stop
    and ask.
5e. `/demos` (run the skill, checklist in .claude/commands/demos.md): re-curate the tournament demo's tour for the new
    look (the anchors survived — `demo-destinations-guard` — but the story's words may describe the old look; a number in
    a demo sentence is computed from the seed). `scripts/seed-theme-variants.mjs` (dev-test-org QA matrix) still writes
    `color_mode` / `theme_card_style`, which nothing reads now — retire it (delete, or reduce to what the Look card reads),
    after checking nothing runs it (package.json, other seeds, plans). The demos follow the product and never gate it.

TESTS — a migration gets its own guard (what it empties, what it never touches, re-runnable); help-content changes keep
the help tests green (and any guard pinning the old wording is rewritten, not deleted); if 5e deletes the variant seed,
a guard that it stays gone is optional.

VERIFY — touched + neighbouring unit tests; ESLint on changed files; check-spelling-consistency; check:dictionary;
check:migrations (if a migration); typecheck if lib/ changed (NODE_OPTIONS=--max-old-space-size=6144); full `npm test`
(name the failures and whose they are; §16–§18 list the foreign ones); `demo-destinations-guard`. No layout sweep needed
unless 5e touches a screen. Dev server: restart only if files were added/deleted (stop it BEFORE deleting `.next`).

SCOPE / COMMIT / AFTER — as 4a/4b (§17, §18): own files only; the tree is shared and other sessions stage their own
files, so commit from a private index; `TODO.md`, `lib/db.ts`, `lib/types.ts` and the snapshot files are shared —
commit only your hunks (pick hunks into the private index); explicit pathspecs; no push; never master; nothing against
production. Record as §19 of the plan (same shape as §18), update the header and the Stage 8 TODO line, then "Part 5
committed, next Part 6 (verify, walk, release)" and recommend /clear.

STILL OWED, NOT PART 5: Part 6 — /review on the whole Stage 8 diff, a layout sweep on staging or a local production
build (never the dev server), one owner walk with the switch gone, the release-history read, the promote, the
post-release truth-up, `check:demos:prod` next morning; plus the production port of the feed fix (§16), the service
worker CACHE_VERSION bump, mig 426 (+ any 5a migration) on prod in the promote window, and the items §16–§18 hand on.
