# Agency Rules — full reference text

Moved here from `AGENCY_RULES.md` on 2026-10-27 to cut the tokens every session loads on every turn
(the rulings are unchanged — this is the verbatim full text). `AGENCY_RULES.md` keeps the short
binding rule for each and points here. Read the matching section when you are about to touch that
area: a hook/permission/database check, or any customer-visible wording, spelling or clock label.

## Shared agent automation and the database checks

- **Shared agent automation and the database checks change only when the owner asked for that
  change (owner rulings 2026-09-26, binding).** From 06-01 to 09-25 an agent-added hook refreshed
  the schema snapshots up to ~580 times a day against BOTH databases: about 90% of all production
  query time, and dev's CPU at 99%. One agent added it inside a giant feature commit; another
  widened it from dev-only to dev + production inside a cleanup commit that called the change a
  "hook script rename". Nobody saw either change (see
  `docs/projects/active/DB_SNAPSHOT_REFRESH_LOAD_PLAN.md` §9).
  - **What counts:** hooks and permission rules in `.claude/settings*.json`; any script a hook
    runs; anything that runs by itself or against production; the database checks and gates. The
    watched list is `WATCHED_PATHS` in `scripts/check-agent-automation.mjs`.
  - **The rule:** change one only when the owner asked for that change in the current
    conversation; an earlier yes does not carry over. It goes in its OWN commit, and the message
    says what behavior changes (never "rename" for a behavior change).
  - **Safety nets, not approval ceremonies.** The owner ruled out permission prompts and approval
    steps: they "mean nothing to me" and slow development. The control is visibility:
    `npm run check:automation` lists every recent commit that touched a watched path, so nothing
    hides inside an unrelated commit again.
  - **A check is report-only.** "Check / verify / is X still working" means report and recommend.
    A defect found during a check is a finding, not a mandate to change shared automation.
  - **Watch the stack:** `npm run health` (`scripts/stack-health.mjs`) runs every morning at 7:30
    a.m. on the owner's PC (Windows task "FieldLogicHQ stack health") and in every `/release`
    (step 1c-1). It covers database load and vitals, Supabase's advisors (new findings only),
    traffic and errors, deployment builds, and agent tooling, including every commit that touched a
    watched path. It keeps its history in `.health/` (gitignored). On red it alerts with a desktop
    notification plus an email once `HEALTH_RESEND_API_KEY` is set, and sends a Monday digest
    (the heartbeat). `npm run check:db-load` is its slow-query part on its own. A red from it is a
    finding to report, not a mandate to change shared automation.

## One spelling, everywhere a customer can read it (incl. the clock)

- **One spelling, everywhere a customer can read it (owner ruling 2026-08-24, binding).** A word the
  product shows has exactly **one** spelling across every surface — screen copy, table and column
  headings (including `data-label` values, which render as visible text on a phone), empty states,
  button labels, toasts and API error messages, in-app help articles **and their `keywords` /
  `searchText` arrays**, and the demo sandboxes' dock lines and tour narration. Two spellings of one
  word is a product bug, not a typo: help search misses the article, and the same screen calls one
  thing two names.
  - **Build-enforced, and the gate is the list.** `npm run check:spelling` (part of
    `verify:changed`) fails on any enforced variant in customer-visible copy. **`installment` (two
    Ls) is settled and gated.** So is **"fiscal year"** for the club's period — never "financial
    year" (owner, Club Tier Stage 3c Ask 9, 2026-10-07; the club side only, the coach keeps "season"). Escape hatch for a genuine proper noun or a quoted external
    document: `spelling-ok` in a comment on that line or the one above.
  - **⏰ THE CLOCK IS SETTLED AND GATED TOO — "8:00 a.m.", lowercase, with periods** (owner +
    `/marketing`, 2026-08-26). It applies **everywhere a customer reads a time** — screens, tables,
    badges, exports, posters, family emails, help articles — with **no carve-out for a dense
    table**; if a schedule column is tight, the fix is the column. Not exceptions, because they
    are not our prose: a time a customer typed into a free-text field, and a time quoted from an
    external document. ⚠ The reasoning is **house language, NOT positioning** — the brand voice
    canon forbids claiming Canadian identity ("community sport", never "Canadian sport"), so this
    rests on the same ground as `colour` and `cheque`, and on the fact that `en-CA` returns it
    natively. That is also why the sweep was small: every screen formatting through the platform
    was already right, and only **seven hand-rolled builders** were wrong. **`formatTime()` in
    `lib/utils.ts` is now the only place the product builds a clock label by hand** — call it
    rather than writing the ternary again. The gate matches the uppercase token **only after a
    clock time** (bare `AM`/`PM` are ordinary capitals) and deliberately also catches a **narrow
    no-break space** before it, since a future platform version may emit one and it would be a
    third spelling that looks identical.
  - ⚠ **THERE IS NO BLANKET "HOUSE DICTIONARY" YET — do not assert one, and do not widen the gate
    without an owner ruling.** Building the gate surfaced **156 further customer-visible strings**
    (`npm run check:spelling:report`) in two piles that are *not* one decision:
    - **~126 `-our`/`-re`/`-ce`** (`colour` ×121, `behaviour` ×4) — **correct Canadian English** in a
      product built for Canadian clubs. Changing these is a **brand-voice** call for the owner and
      `/marketing`, not a typo fix. Shipping `installment` beside `colour` is coherent: Canadian
      usage accepts both spellings of the first and only one of the second.
    - **~31 `-ise`** (`customised` ×19, `organisation` ×6, `recognised` ×5) — **British-only**;
      Canadian English takes Oxford `-ize`, so these are wrong on their own terms. Still not swept,
      because `is_customised` is a real **column** (mig 083): this pile is part copy, part
      migration, and cannot be done as a spelling pass.
    - **Permanent exceptions even if those piles are ever settled:** `cheque` (a real payment method
      a Canadian treasurer picks from a list), `licence` as a noun, `grey` (load-bearing in
      design-token names — a rename is a token migration), `defence` (a sports term this product is
      built on), and `Centre` inside venue proper nouns.
  - **Before introducing a word with a known variant, grep the repo for the other spelling first.**
    If both already exist, that is drift — fix it in the same unit of work rather than adding a
    third instance. The one-L/two-L `instalment`/`installment` split reached ~220 occurrences and
    ~30 customer-visible strings before anyone noticed, because every single one read fine on its
    own.
  - **Fixing prose does not touch identifiers, columns, enum values, route segments, CSS class
    names, or `id`s** — a rename there is a migration, not a spelling fix. Applied migration files
    are history: correct a misspelling inside one with a **new** migration, never by editing the
    old file.
  - Applies to code comments and plan docs as a courtesy, not a requirement — they are not the
    product. Prefer consistency there too when you are already editing the line.
