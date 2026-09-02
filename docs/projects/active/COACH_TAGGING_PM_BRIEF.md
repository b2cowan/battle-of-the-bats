# PM Brief — One Tag Idiom (Tagging Across the Coaches Portal)

> Companion to `COACH_TAGGING_PLAN.md` · owner-ruled 2026-09-01
> Mockups: https://claude.ai/code/artifact/8879b68b-5b4d-4f10-8fe9-e7a1e9baac32 ·
> Approved drawer prototype: https://claude.ai/code/artifact/8e04e12d-ebc3-4e60-adcd-6f234e996e5d

**What it does:** Gives coaches one consistent way to create, fix and tidy their tags everywhere
tags exist. Every tag field works the same (type to find, "+ Create" to mint), every field has
one quiet "Manage tags…" door as the last row of its dropdown, and that door opens a side drawer
where a coach can rename, merge or delete — right over the form they're filling in, without
losing their typing. A Tags section under Team settings lists all five libraries with counts for
the end-of-season tidy.

**Why it matters:** Today the same door has six different names, two different pickers do one
job, staff and equipment tags can be created but never renamed or deleted (no screen exists), a
drill's equipment is still free text one screen away from the real library, and deleting a tag
never tells you how much history is wearing it. Each is small; together they make tags feel like
five features instead of one.

**Who benefits:** Every coach with write access to a surface that tags (money, schedule,
practice planning, development). Club admins benefit indirectly — shared tags now appear
(read-only, with "ask your club admin") instead of silently vanishing from coach screens. No
plan-gating change.

**Expected impact:**
- The oversized "Manage tags" button leaves the Ledger toolbar; nothing else is lost — the door
  moves inside the tag fields, where the coach's head already is.
- Deleting a tag in use says what it touches ("It's on 12 records — they keep everything but the
  label") and offers "Merge instead" as a one-click alternative.
- Staff, equipment and drill-kit vocabularies become fully manageable for the first time; old
  free-text kit names move over one deliberate tap at a time, never by silent import.
- One colour language: olive = your team's words, blue = the club's, everywhere.
- The scouting filter stops looking like something you can add to (it never was).

**Priority:** Medium-high — it closes shipped gaps (staff/equipment have routes with no screen)
and retires a flagged UX wart (the Ledger button), but nothing is broken for money or data.

**Success criteria:** One door label portal-wide (spelling gate green); a coach can rename a tag
mid-bill and land back in the form with typing intact; every library reachable for
rename/merge/delete from both a picker and Team settings; delete always states the count; the
owner QA walk passes on desktop and phone.
