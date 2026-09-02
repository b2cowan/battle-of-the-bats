# PM brief — Exceptions First (the Set-dues preview)

**What it is.** When a coach sets dues for the whole roster, the confirmation screen stops
printing twelve identical rows and starts answering the questions a coach actually has at that
moment: what does everyone get (one sentence), who is different and why (named rows — money
already paid, credits being created, hand-set plans, due-date changes, refusals), and exactly
what pressing the button does (a count-by-count line, and a button that says "Set dues for 10
players" when two of the twelve are kept or refused).

**Why it matters.** Today the two most consequential facts arrive AFTER the coach presses
confirm: "this roster already has dues — keep the ones you set by hand?" (a second dialog), and
"this family was refused" (a result message). Both are knowable before the button. A commit step
that can still surprise you isn't a preview. This also fixes the screen's noise problem: a
uniform roster currently renders a grid where every row is the same — the information of one row
at twelve rows' cost — and it scrolls sideways on phones.

**Customer impact.** Fewer wrong bulk runs (the hand-set decision is made while looking at the
names, not after a rejection); no invisible refusals; the phone gets a list instead of a
sideways grid. No data or billing behavior changes — every guard stays; the screen just tells
the truth earlier.

**Owner rulings (2026-09-01, all recorded):** replace-question folds into the preview; a refusal
is a blocked row that never stops the other families; the per-player grid appears only when
amounts genuinely vary. Buffer tone and single-strip rules from the §124 walk apply.

**Priority.** BUILT ON DEV 2026-09-01, awaiting QA §128. Medium effort as estimated — a richer
preview read plus a recomposed modal; no migration, no new write paths, every server guard where
it was.

**Three calls made in the build that need the owner's word** (all recorded in QA §128): the
per-player table is *removed* rather than demoted, because this door cannot yet produce the
per-player variance the rule keeps it for; the plain "has paid" rows cap at six with a "+N more"
line, while hand-set and refused rows are never truncated; and the hand-set row's sentence follows
the keep-checkbox instead of standing fixed at "would replace it".

**Success.** A coach can say, before pressing the button, exactly what will happen to every
player named on screen — and nothing after the button ever contradicts the preview.
