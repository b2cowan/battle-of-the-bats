# BUILD PROMPT — Coach sidebar: five groups, and they collapse

**Plan of record:** `docs/projects/active/COACH_NAV_AND_PRACTICE_PLANS_PLAN.md` §8 + Phase 5b
(the §8 text holds the reasoning; this file is the instruction set).
**PM brief:** `COACH_NAV_AND_PRACTICE_PLANS_PM_BRIEF.md` (Phase 5 + 5b sections).
**Owner-approved from mockups 2026-08-18:** `https://claude.ai/code/artifact/93e1e3ef-0382-408b-ad45-1499e1b02580`

Every code claim below was read out of the working tree on 2026-08-18, not out of a plan. Build
prompts in this repo have carried false claims before — **if anything here disagrees with the code
you find, the code wins and you say so before proceeding.**

---

## ⚠⚠ PRECONDITION — DO NOT START UNTIL THE TREE IS CLEAN FOR THESE FILES

At the time of writing, another session's season-close work is **uncommitted** across ~25 coach files
and **mid-commit** (its own docs are staged, including a staged deletion of its build prompt). Three
of the files this build must edit were in that set:

- `components/coaches/CoachesSidebar.tsx`
- `components/coaches/CoachesBottomNav.tsx`
- `app/[orgSlug]/coaches/coaches.module.css`

Explicit-pathspec staging **does not help here** — the overlap is inside the same files, so a commit
of your work would carry their unfinished work with it, and the reverse.

**Before writing a line:**

```
git rev-parse --abbrev-ref HEAD          # must be dev
git status --short components/coaches/CoachesSidebar.tsx \
                    components/coaches/CoachesBottomNav.tsx \
                    app/[orgSlug]/coaches/coaches.module.css
```

If any of the three is `M`, **stop and report it.** Do not "work around" it.

⚠ Also re-read `withClosedSeasonNav` in `lib/coach-nav-visibility.ts` before starting. As of
2026-08-18 it makes a team with **no live season** render exactly one door (`Season's End`), with
every other group returning `[]`. That ruling may have moved. Your changes must not fight it.

---

## What to build — two changes, one pass

### Change 1 — five groups instead of six

In **both** navs, merge `Team` and `Team admin` into a single group headed **`Team`**:

| Group | Items, in this order |
| --- | --- |
| Team | Roster · Tryouts · Staff · Documents · Settings |

Everything else is untouched. Final group list, both navs:
**Season · Progress · Money · Communication · Team**

⚠ **No item is renamed, no route moves, and no item changes its position in the overall order.**
Roster, Tryouts, Staff, Documents and Settings are already consecutive, so this is one heading
deleted — nothing else.

### Change 2 — the five groups collapse (DESKTOP SIDEBAR ONLY)

Mirror `components/admin/AdminSidebar.tsx`. **Do not invent a second mechanism.** The parts to copy:

- **State:** `openGroups: Set<string>` + a `groupsReady` flag, hydrated inside a
  `requestAnimationFrame` so the server render is stable.
- **Persistence:** `localStorage`. ⚠ **Its own key — NOT admin's `fl_nav_groups`.** One shared key
  would let a tournament admin's Setup preference decide whether a coach's Team group is open.
- **Toggle:** `toggleGroup(key)` writes the new set straight to `localStorage`, wrapped in
  `try/catch` (admin's does; private-mode browsers throw).
- **⚠ The forced-open rule — NOT optional.** Admin's `isGroupOpen(groupKey, items)` returns `true`
  when any item matches the active path, *regardless of stored state*. This is what stops a coach
  closing a group, arriving there from a link, and finding their own location missing from the menu.
- **Markup:** a `<button type="button">` heading carrying the label plus a `ChevronRight` that gets
  a rotate class when open; items render only when open.
- **Styles:** admin's `AdminSidebar.module.css` lines ~223–270 define `.navGroup`,
  `.navGroupHeader`, `.navGroupHeaderActive`, `.navGroupChevron`, `.navGroupChevronOpen`,
  `.navGroupItems`. Port the equivalents into the coach stylesheet
  (`app/[orgSlug]/coaches/coaches.module.css`) — the coach sidebar imports that, not its own module.
  ⚠ That file has repeatedly carried other sessions' in-flight edits. Check it before and after.

#### Defaults — decided by the heat rule, not by taste

| Group | Rows | Starts |
| --- | --- | --- |
| Season | 4 | open |
| Progress | 2 | open |
| Money | 1 | open |
| Communication | 2 | open |
| **Team** | **5** | **closed** |

**Rule:** a group a coach opens weekly or more never starts closed. `Team` is the only group where
the trade is favourable. This takes the sidebar from **15 visible rows to 10**, which is the actual
fix for it running off the bottom of a laptop screen.

⚠ **A fixed default, not a phase-varying one.** Admin varies by tournament status
(`defaultOpenFor` in `admin-nav-config.ts`); the coach equivalent would be season state, and it is
**deliberately not built** — Phase 4 deleted the `conditional` mechanism precisely because a sidebar
that rearranges itself moves items a coach has already learned the position of. Auto-opening is a
softer form of the same thing.

#### ⚠⚠ The unread badge — the defect this change would otherwise introduce

`CoachesSidebar.tsx` renders `<ChatUnreadBadge count={chatUnread} />` on the **Chat** item, which
lives in **Communication**. Once that group can close, a coach who closes it stops seeing that anyone
messaged them — nothing errors, the signal just disappears. Admin doesn't hit this because its
collapsible groups carry no badges.

**Required:** a closed heading carries a **rolled-up badge** when anything inside it needs attention,
and a plain count of folded rows otherwise, so a closed group never reads as an empty one.

#### The ungrouped landing slot never gets a chevron

`TEAM_NAV_GROUPS[0]` is `{ items: [OVERVIEW_ITEM] }` with **no `label`**, and the render already
guards with `{group.label && …}`. Overview / Season's End must stay a plain row.

#### Empty groups already drop out — keep it that way

The sidebar computes `items` then `if (!items.length) return null`. **Preserve this.** A heading a
coach can open onto nothing is worse than no heading. It matters more now: an assistant without
Staff, Documents or Settings could otherwise get a `Team` heading over two rows, or none.

---

## Guard test — `tests/unit/coach-nav-groups.test.ts`

This file is the decision point and must be edited **deliberately**:

- `EXPECTED_ITEMS` — **unchanged.** The merge moves no item, so the label list and its order are
  identical. If your diff changes this array, you have moved something you shouldn't have.
- The heading assertion changes from
  `['Season','Progress','Money','Communication','Team','Team admin']` to
  `['Season','Progress','Money','Communication','Team']`, in **both** the sidebar and bottom-nav
  assertions (they are asserted equal to each other — keep that).
- `headersIn()` matches `{ label: '…', items:` / `{ header: '…', items:`. If you restructure the
  sidebar's group literal for the collapse state (e.g. adding a `key`), **this extractor must still
  find the headings** — a guard that silently matches nothing is worse than a failing one.
- ⚠ `labelsIn()`'s negative lookahead `(?!, items:)` distinguishes item labels from group headings.
  Do not reorder object keys so a heading reads as an item.

**Add coverage for the two new invariants** (they are exactly the kind that break invisibly):
1. Only `Team` is in the default-closed set.
2. A group containing the active path is open even when stored state says closed.

---

## ⚠⚠ VERIFICATION — a closed group is an UNMEASURED group

`check:layout` measures what is **rendered**. `Team` starting closed removes five doors from every
coach screen in the sweep, so those items silently leave the safety net.

**Handle this in the same unit of work, not as a follow-up.** Either the sweep opens every group
before measuring, or you accept and *record* the loss. This exact failure mode is already on record
for this rail ("collapsing BLINDS check:layout"). Do not discover it later.

Also required:
- `npm run typecheck`
- `npm run verify:changed`
- Full unit run — confirm the nav guard passes for the right reason, not because the extractor
  stopped matching.
- Render at **1440 and 390**. At 390 confirm the phone bar and More sheet are untouched.
- ⚠ `check:layout --changed` is a **false green** once work is committed — do not rely on it.
- ⚠ Restart the dev server before handing off (this touches shared modules and a stylesheet).

---

## Out of scope — do NOT build these

1. **Option B** (folding Progress up into Season, four headings). Reserved; decide after use.
2. **Season-state-varying defaults.** See above.
3. **Any bottom-bar change.** The phone's four tabs are evaluated and **kept** (plan Phase 5c). The
   More sheet takes the *grouping* change only — **no collapsing on phone**; it is opened in order
   to find something.
4. **The two findings that belong to other owners** (plan Phase 5c):
   - the closed-season "one door" change being **half-applied on phone** — `withClosedSeasonNav`
     filters `TEAM_TABS` but not `MORE_SECTIONS`, so desktop shows 1 door and the More sheet still
     lists 11. That is the other session's work; **raise it, do not fix it here.**
   - the **attendance** gap in the bottom bar. Needs its own look at the Overview card and the
     Schedule tab; a fifth tab is the wrong fix.

---

## Rules that outrank convenience

- ⚠⚠ **`isCoachNavItemVisible` is keyed by DISPLAY LABEL with `default: return true`.** Renaming an
  item silently hands an ungranted assistant the door. **Group headings are free; item labels are
  not.** Moving an item between groups is safe — the gate is per-label, not per-group.
- ⚠ **Both navs move together.** Changing one and not the other leaves desktop and phone telling
  different stories.
- ⚠ The portal tour (`CoachPortalTour.tsx`) and the help guide (`lib/help-content/coaches.tsx`) name
  the sidebar groups. Phase 4 had to correct a tour card naming a group that no longer existed
  ("Squad") and a guide describing a deleted shelf **as a feature**. Re-read both, and offer `/docs`.
- ⚠ Branch is `dev`. Stage explicit pathspecs only; never `git add -A`. After committing, run
  `git show --stat HEAD` and confirm only your files landed.
- ⚠ No commit or push without the owner's explicit go-ahead.

---

## Definition of done

- Sidebar and More sheet both show five groups: Season · Progress · Money · Communication · Team.
- No item renamed, no route changed, no item's position in the overall order changed.
- All five sidebar groups collapse; only Team starts closed; the setting persists per device.
- The group holding the current page is open regardless of stored state.
- A closed group shows its folded-row count, and an unread message inside it surfaces on the heading.
- An assistant missing a group's items sees no heading for it.
- Phone bar and More sheet: grouping updated, no collapsing.
- Layout sweep still measures the five folded doors — or the loss is recorded explicitly.
- Post-build: offer `/review`, and offer `/docs` (the guides name these groups).
