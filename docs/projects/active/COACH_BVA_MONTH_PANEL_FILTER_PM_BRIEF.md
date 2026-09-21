# Money by Month plan panel — PM brief

**What changes for a coach:** Tapping a budgeted figure on the Budget vs. Actual report's Months
view — at either the category row or a single item's row — now opens a list scoped to that exact
month (or "no date yet"), instead of the whole season's items every time. If more than one budget
line genuinely falls in that month, a coach still sees all of them; lines that belong to other
months no longer appear at all.

**Why it matters:** The old panel answered "what's in February?" with the whole season's plan,
which read as a coincidence rather than an explanation — a coach tapping a $400 figure would see
seven items summing to well over that, most of them dated months away, with no way to tell which
one was actually February's money. The fix makes the number on screen and the list under it agree.

**The escape hatch:** The Total column — previously inert when tapped — now opens the same
"everything, whole season" list the old panel always showed by accident. A coach who wants the
full picture taps Total on purpose, instead of getting it no matter which month they meant to look
at. A quiet line in the narrowed panel ("N more lines are budgeted this season → tap Total to see
them") points there whenever something was left out, so the door isn't hidden.

**Who sees a difference:** Every coach and assistant viewing Budget vs. Actual under the Budget or
Difference reading. No role-based access changed — a read-only assistant still sees the identical
list a head coach does; only the ability to click through and edit a line's payment dates stays
gated the way it already was.

**Risk / scope:** Contained to one report component; no schema or migration involved, and nothing
about how budget items are stored moves — the fix reads dates the report already had. Verified
with a typecheck, a lint pass, and the two existing automated guards that already pin this panel's
behaviour, both still passing. Needs an owner browser walk before it's considered done.
