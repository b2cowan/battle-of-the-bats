# Planning prompt — Tagging across the coaches portal: one experience, one home?

**For:** a fresh chat, `/plan` + `/design`, **planning and mockups only — nothing is built from this
prompt.** Written 2026-09-01 from a code inventory taken that day (appendix A). Owner brief verbatim:

> I want to make sure that the user has a simplified and consistent experience when
> creating/updating/deleting tags. I want to discuss if it makes sense to have a central place
> where they make these edits/deletes vs. scattered throughout the app. I also want to review
> where on screens this needs to be displayed (i.e. the Manage Tags button on the ledger takes
> up way too much space and doesn't seem to fit where it is located.

⚠ The item this grew out of — "Practice plan Staff & Equipment become real tag libraries" — is
**already shipped** (2026-08-27, on production in `7f21df47`); its plan doc was stale and has been
archived. What it deliberately left out is now this review's first concrete gap: those two
libraries have rename/merge/delete **routes but no screen**.

---

## 1. The gate (blocking — do these in order)

1. **Mockups, published as an Artifact, before any plan is finalised** — specimens listed in §5.
   Load the `artifact-design` skill first; frames use the real warm-theme tokens; captions carry
   NEW / RESTYLED / UNCHANGED; **one whole screen before/after** per placement decision.
2. Present the owner with the **questions in §4** and the **recommendations in §3** side by side —
   recommendations are a starting position to argue with, not decisions.
3. Only after rulings: write `COACH_TAGGING_PLAN.md` + `COACH_TAGGING_PM_BRIEF.md` in
   `docs/projects/active/`, add ONE line to `TODO.md`, and log accepted design rulings in the
   in-repo `memory/design_decisions.md` (the live log).

Standing rulings that bind this work (do not re-litigate; cite them in the plan):
- **One word everywhere a customer reads** (owner 2026-08-24) — today the same door is called
  "Manage tags", "Manage money tags", "Manage game tags", "Your tags", "Manage our items" and
  "Test types". That alone is a product bug under this ruling.
- **A modal is for a QUESTION, not a working surface** (2026-08-26) — the current tag manager IS
  a modal working surface (a list you rename/merge/delete in). This ruling is the strongest
  argument for a central *page*; the plan must confront it rather than keep the modal by habit.
- **Page-level actions** (2026-08-13): a tab's toolbar carries the *create* for that screen;
  chrome sits in fixed slots. Management of a rarely-touched vocabulary is neither.
- **Shared component beats shared class**; **form selects are dropdowns**; **required marked with
  a plain \***; **44px tap floor at ≤768** (rendered check enforces it); **`--text-tertiary` for
  meta ink**, never the alpha ladder; **sport-neutral vocabulary** via the Sport Pack.
- **Help docs and demo narration are swept in the same unit of work** as any flow change.

---

## 2. What is true today (short form — appendix A has file:line)

Eight things a coach meets as "a tag". Five are one backend (`rep_team_tags`, one route factory,
one cap of 50 per kind, one org-shared-vs-team-owned rule, one merge RPC):

| Vocabulary | Where a coach applies it | Create | Manage door (rename / merge / delete) | Delete when in use |
|---|---|---|---|---|
| **Money tags** | bills, expenses, drives, sponsors, the Ledger filter | inline "+ Create" in a search-combobox | **"Manage tags"** — a full secondary BUTTON in the Ledger toolbar beside Export (the one the owner flagged); modal titled "Manage money tags" | orphans silently |
| **Game tags** | the game edit form | inline "+ Create" chip | **"Manage tags"** — a text LINK under the picker; modal titled "Manage game tags" (default, never set); link shows even when the team owns nothing → opens to an empty state | orphans |
| **Focus tags** | drills, plan templates, practice plans, a player's focus area (single) | inline "+ Create" | **"Your tags"** — a button on the Plan Templates list ONLY; none on drills, the plan editor, or the player | orphans |
| **Staff / Equipment** (shipped 08-27) | practice plan header, block, station | inline "+ Create" (with a one-time "adopt this old free-text name" chip) | **NONE** — routes exist, no screen reaches them | orphans (with a jsonb re-point) |
| Drill "kit" | a drill's Equipment field | free text, "Add kit…" | none — it is not a library at all | n/a |

And three that *look* like tags but aren't the same thing:

| Vocabulary | What it is | Manage door | Delete when in use |
|---|---|---|---|
| **Budget category + item** | a taxonomy (categories admin-defined; items coach-mintable) | "Manage our items" button on the Budget tab; two-section modal (own words editable, shared words read-only with a tier chip) | **refused**; "fold into a shared word" is the only exit |
| **Test types** (development) | a coach list, retire/restore | "Test types" ghost button; hand-built manager on the tag-manager idiom | soft retire, no merge |
| **Scouting tags** | a **fixed** sport-pack list, owner-ratified not editable | none, by design | n/a |

Two visual pickers exist for the one job "search my words or mint one" (a search-box-with-dropdown
for money; a chip-row-with-suggestion-strip for focus/staff/equipment/drills), and the CSS class
`.tagChip` is defined twice in the portal stylesheet with conflicting treatments.

---

## 3. Recommendations (a position to argue with)

**R1 — One tag idiom, three pieces, one name each.** A single picker component (search or type →
"+ Create 'x'"), a single manager (rename · merge · delete, with a usage count per tag), and a single
door label. Today's two pickers do the same job in different clothes; merge them. Suggested house
words: the picker is just the field; the door is **"Manage tags"** everywhere it appears; the
manager's title names the library ("Money tags", "Game tags", "Focus tags", "Staff", "Equipment").

**R2 — A central home, plus a quiet contextual door — not one or the other.** Management is a
*rare* act (a typo, a merge after a drift, an end-of-season tidy); applying is the *frequent* one.
So: (a) a **Tags page** under Team settings (or the team hub's settings group) listing every
library with counts and the org-shared set explained once; (b) on every apply-screen, the manage
door moves **inside the picker** — a last row in the dropdown / suggestion strip reading "Manage
tags…" — so it is findable exactly where a coach is thinking about tags and costs the toolbar
nothing. The Ledger's toolbar button goes; Export stops having a twin.

**R3 — The modal question, answered by the ruling.** A rename/merge/delete list is a working
surface, so the central home is a **page**; the contextual door opens a **drawer** (the portal's
own side-sheet idiom) onto the same list, not a modal — or simply navigates to the page with the
library pre-selected. Draw both and let the owner pick.

**R4 — One delete grammar, borrowed from the money screens.** A tag in use is not refused (a label
is not money), but the delete names the count — "Used on 12 records — they keep everything but the
label" — and names the softer tool in the same breath: "Merge into another tag instead". (The §122
grammar: the refusal/consequence names the way out.) Budget items keep their *refuse* rule because
an item is a filing key with history, not a label — but they adopt the same manager shell, so the
coach learns one screen shape.

**R5 — Close the gaps this review exists to close.** Staff and Equipment get their door (R2 gives
it to them for free). The drill's free-text "kit" joins the Equipment library — the exact defect
the 08-27 work fixed for practice plans, one screen over. Game tags' door stops appearing when the
team owns nothing. Scouting tags stop dressing like a mintable picker (a plain segmented filter, or
a label saying it's fixed).

**R6 — Org-shared tags get one cue and one sentence.** The blue/lime dot legend exists; the
explanation of *why there is no pencil* on a shared tag lives only in the budget-items modal. Say
it once, the same way, on the Tags page and in the manager: "Shared by your club — ask an admin to
change it."

---

## 4. Questions for the owner (rulings needed before the plan)

1. **Where does the central home live** — Team settings, the team hub's settings group, or a
   first-class nav entry? (Recommendation: Team settings; it is configuration, not an operating
   screen.)
2. **Does every apply-screen keep a door at all**, or only the central page? (Recommendation:
   keep a quiet in-picker door — otherwise a typo mid-practice-plan costs a trip to settings.)
3. **Delete-in-use for tags: orphan-with-count, merge-only, or refuse like budget items?**
4. **Do budget items and test types adopt the same manager shell** (one screen shape, three
   vocabularies, their own rules), or stay visually distinct because they *are* different things?
5. **Drill kit → Equipment library: yes?** And do old free-text kit names get the same one-time
   "adopt" chip the practice plan got, or a silent import?
6. **The house word: "tag" or "label"?** (Recommendation: "tag" — it already carries the product,
   help and the demo.) And is "Manage tags" the one door name?
7. **Scouting tags:** keep fixed (ratified) — but should they stop looking like a tag picker?
8. **The 50-per-kind cap** — surface it in the manager, or leave it as a refusal only?
9. **Modal vs page vs drawer** for the manager (R3) — the owner's own ruling argues for page;
   confirm.

---

## 5. Mockup specimens (gate item one — draw the DECISIONS, not every control)

1. **The Tags page** (central home) — whole screen, desktop and phone: every library as a row
   with counts, org-shared explained once, one library opened for editing.
2. **The unified picker** — one component drawn twice (a money tag on a bill form; a staff tag on
   a practice station) with the in-picker "Manage tags…" door visible.
3. **The manager surface** — rename / merge / delete with usage counts and the delete sentence
   from R4; drawn as a page section AND as a drawer, for Q9.
4. **The Ledger toolbar, before and after** — whole screen; the button gone, Export standing
   alone beside "Add a bill".
5. **The practice editor station row** with staff + equipment pickers and the door — before and
   after.
6. **The drill's Equipment field** — free text today vs the library picker.
7. **The scouting filter** restyled so it no longer promises minting.
Captions: NEW / RESTYLED / UNCHANGED. True-size frames at 360/768/1440 where tap targets are the
question.

---

## 6. Deliverables from the planning chat

- The mockup Artifact (kept in `docs/projects/active/COACH_TAGGING_MOCKUP.html` too).
- `docs/projects/active/COACH_TAGGING_PLAN.md` + `_PM_BRIEF.md` — phases, the schema question for
  drill kit (id arrays like the practice plan), which routes already exist (all five tag kinds'
  CRUD + merge — reuse the factory), the help-doc and demo sweep, and the walk (a checkable
  walkthrough Artifact per house convention).
- A single TODO line linking the plan.
- Design-log entries for each accepted ruling (the in-repo log is the live one).

**Do not build.** Do not touch the other money panels' uncommitted work if any is present. The
`.tagChip` double definition and the game-tag door gating are defects the plan should schedule,
not fix on the way past.

---

## Appendix A — Inventory with file:line (2026-09-01)

**Shared backend.** `rep_team_tags` (migs 181, 184, 221, 266); `kind` ∈ game · expense · focus ·
staff · equipment (`lib/types.ts:1818`). One route factory `lib/coach-tag-routes.ts:197-361`
(collection GET/POST, item PATCH/DELETE, merge POST) with five descriptors (lines 60-164); cap 50
per team+kind (`:52`); case-insensitive unique name → 409 (`:177-185`); org-shared = `team_id NULL`,
never writable from a team route (`:271-273`). Staff/equipment ids live in plan jsonb, so their
merge/delete re-point via `lib/rep-practice-plan-tag-repoint.ts` (`coach-tag-routes.ts:288-306`,
`:340-347`).

**Money tags.** Picker `components/coaches/TagSearchCombobox.tsx`; apply sites
`accounting/CommitmentView.tsx:400`, `accounting/expenses/panel.tsx` (form + filter pill),
`fundraisers/DriveBand.tsx:481`, `fundraisers/SponsorBand.tsx:539,617`, `fundraisers/panel.tsx:559`.
Door: `expenses/panel.tsx:5549-5553` (`.btnSecondary`, `Settings2` icon, gated
`ownMoneyTags.length > 0`), in `.panelToolbarActions` after Export (`:5849-5926`); modal
`TagManagerModal` at `:7246-7257` titled "Manage money tags". Delete orphans
(`components/coaches/TagManagerModal.tsx:85`). Join tables `rep_team_expense_tags`,
`rep_team_fundraiser_tags` (mig 239).

**Game tags.** `schedule/page.tsx:3320-3358` (chip picker; text link `.tagManageLink` "Manage
tags", shown when `teamTags.length > 0` — the COMBINED list, so an org-only team opens an empty
manager); modal `:3472-3480` with no title → default "Manage game tags"
(`TagManagerModal.tsx:25`). Join `rep_team_event_tags` (mig 181).

**Focus tags.** Picker `components/coaches/TagPicker.tsx` (`.tagPick*`, `:101-143`); hook
`components/coaches/use-focus-tags.ts:28-34`; apply: `development/drills/page.tsx:100-107`,
`development/templates/[templateId]/page.tsx`, `practice/_PracticePlanEditor.tsx`,
`components/rep-teams/TryoutBaselineCard.tsx:172-177` (single). The ONLY door:
`development/templates/page.tsx:386-392` ("Your tags", `Tags` icon) → `:560-574`. Plural noun in
the cap message is bare "tags" (`coach-tag-routes.ts:126`).

**Staff / Equipment.** `components/coaches/PracticeTagPicker.tsx` (id-resolving wrapper, adopt
chips `:61-79`); apply `practice/_PracticePlanEditor.tsx:1396-1398, 889-891, 298-300, 287-289`.
Routes `staff-tags/**`, `equipment-tags/**` live; **no UI door anywhere**.

**Drill kit (free text).** `development/drills/page.tsx:77-87, 162-179` ("Add kit…", de-duped
only within the one drill).

**Budget category + item.** `budget/panel.tsx:1367-1374` ("Manage our items", gated
`ownItemCount > 0`) → `components/coaches/BudgetItemManagerModal.tsx` (refuse-in-use `:41, :207,
:559-561`; fold-into-shared `:44-48`; categories not coach-creatable `:38-42`).

**Test types.** `components/coaches/PlayerDevelopmentSection.tsx:521-526` → 
`components/coaches/TestTypesManager.tsx` (retire/restore, no merge; "not the tryout scorecard"
`:127`).

**Scouting tags.** `components/coaches/ScoutTagFilter.tsx` (`.scoutTagChip`); vocabulary
`lib/coach-opponents.ts:44-52` (fixed per sport pack); stored as text
(`225_opponent_scouting_book.sql:58`).

**Not vocabularies (checked):** positions (`components/coaches/PositionSelect.tsx` — sport pack +
"Custom…" free text, not remembered); announcement categories (none); practice rotation groups
(ephemeral); tryout labels (reuse focus tags).

**Defects seen in passing:** `.tagChip` defined twice in `coaches.module.css` (`:4696-4706` toggle
pill vs `:9864-9887` remove-X chip) — verify visually; game-tag door gating (above).
