# Help — article format + the topics the sweep missed (build prompt for the next chat)

**Paste the section below into a new chat.** Everything above the line is context for a human.

Written 2026-08-14 at the end of the session that built the scannable-help work. The work
described here is **not started** — nothing is half-finished and there is no branch state to
inherit beyond what is already committed on `dev`.

---

## THE PROMPT

You are picking up the FieldLogicHQ help system. Read
`docs/projects/active/HELP_SCANNABLE_FORMAT_PLAN.md` and its `_PM_BRIEF` first — they describe
what already exists and why. This prompt covers what is left.

### ⛔ BLOCKING GATE — MOCKUPS BEFORE ANY REBUILD

**The owner must sign off on the format before you change a single line of the help layout.**
Do not start Job 3 (below) by editing code. Build mockups first, publish them as a **Claude
Artifact** (the owner's standing preference — always Artifacts, never a local HTML file they
have to open), and wait for an explicit yes.

The mockups must show, at realistic content density using **real copy from the current guides**
(not lorem, not shortened):

1. **The article view itself** — one topic on screen, with the contents list as navigation.
   Show a LONG topic (use "Managing your team's money", which has 10 sub-topics) so the owner
   can judge it at its worst, not at its best.
2. **How you get between topics** — what the contents list looks like, whether it stays on
   screen, what "you are here" looks like, and how a reader moves to the next topic without
   going back to a menu.
3. **Desktop and phone**, because the current guide's contents behave very differently at the
   two sizes (a sticky column on desktop, a pinned bar with a drawer on a phone).
4. **The landing state** — what a reader sees when they open a guide without having picked a
   topic yet. This is a real design decision: a table of contents, or the first topic, or a
   short "start here". Show your recommendation and say why.
5. **At least two genuinely different options** for the overall shape, with a recommendation.
   The owner has said they dislike the current long run-on page and want something closer to
   the "?" drawer's article feel — that is the direction, not the specification.

Tag every element **NEW / RESTYLED / UNCHANGED** (house convention — the owner reads mockups as
the spec, so anything ambiguous gets built wrong).

Only after sign-off: build it, then `/simplify`, then `/review`.

---

### Where the help system is today

Committed on `dev` (2026-08-14): `77c465df`, `f335e83f`, `5a6399be`, `e0250fbf`, `dcf14ddd`,
plus `a963904a` and `0259825f`.

- **Long topics are sub-topics now.** 21 sections carry them, 109 sub-answers in all. In the
  "?" drawer they render as an expander list; in the full guide as anchored sub-headings with a
  jump-chip row. One shared renderer feeds both, so they cannot drift.
- **Content primitives exist** — numbered steps, term|meaning definition rows, and an inline
  tip/caution note. Use them; do not hand-roll markup.
- **Screenshots are possible** — a manifest declares each one, a script re-takes them all from
  the Riverdale demo world, and the tooling refuses any path outside a demo org. Two exist, in
  the Money topic.
- **The coach guide is a focused reading surface** — no portal sidebar, top strip or bottom
  nav, no chrome at all, pinned dark whatever the account's theme. Both doors into it force a
  new tab, which is why it carries no "back" control.
- **Owner QA:** ledger §18, batches 1–6.

### Job 1 — fix the standard, because it measures the wrong thing

`.claude/commands/docs.md` says a section longer than **~6 paragraphs** must become sub-topics.
That rule is why the sweep missed things: it counts `<p>` and ignores list items. "How to run
tryout day" is **1,481 words** — longer than any topic that was converted — but it is 3
paragraphs plus a single 16-item list, so it scored a 3 and was left alone. The owner found it
by spot-checking.

**Rewrite the rule to measure length, not paragraph count.** A workable line: a section over
roughly **350 words** of body copy, or with more than about **8 blocks** (paragraphs + list
items combined), must break into sub-topics. Put the counting method in the rule so the next
person measures the same way, and note the trap explicitly: *a long bulleted list is a wall
too.*

Also correct the same claim where it is repeated in `HELP_SCANNABLE_FORMAT_PLAN.md` (it records
"zero sections over the standard", which is true only under the flawed yardstick).

### Job 2 — convert the topics that miss, and only those

Measured by words of body copy, unconverted, worst first:

| Words | Topic | Guide |
|------:|-------|-------|
| 1,481 | How to run tryout day | coaches |
| 1,156 | Getting around your Premium portal | coaches |
| 816 | Build and adjust the tournament schedule | tournaments |
| 653 | How to chat with your tournament organizer | coaches |
| 412 | Your public organization page | org |
| 408 | Build a playoff bracket | tournaments |
| 394 | Shared library: tags, awards & opponent books | rep-teams |
| 384 | How to cancel a customer subscription | platform-admin |

⚠ **A crude count flags ~70 topics. Do not convert 70.** Everything below roughly 350 words is
a genuinely short section whose 5-item list is the right form already. Converting those
produces the failure mode the plan warns about: a topic split into one-line accordions the
reader must open to read a single sentence. **Short topics get left alone.**

Same discipline as every previous batch: **re-set the prose, never rewrite it.** Section ids,
keywords, searchText, links and FAQs stay byte-identical — support links, hub cards and the
search index all point at them.

### Job 3 — the guide becomes an article, one topic at a time

Today every guide renders **every topic on one page**, with a contents list that scrolls you
around inside it. Sub-topics made each topic scannable but the page is still thousands of words
long. The owner wants the full guide to read the way the "?" drawer does: **pick a topic, read
that topic, nothing else on screen.**

This is an information-architecture change, not a styling one. Expect to touch: the contents
list (becomes navigation, not anchors), the landing state, search results (must select a topic,
not scroll to one), and the scroll-spy machinery (probably goes away entirely).

⚠ **THE RISK IS THE DEEP LINKS, and it is the whole risk.** Roughly 52 files link into the
coach guide alone, plus the "?" drawer's "Open the full guide" on every work page, plus nine
Money screens that each target their own sub-topic, plus any link support has already emailed a
customer. Every one of those is a URL with an anchor in it. **After the change, each must still
land on the right topic AND open it.** Enumerate them before you start, and walk a sample in a
browser afterwards — a unit test cannot see this.

The drawer must keep working exactly as it does now; it is already the article view.

### Traps carried forward — all of these cost a run to find

- **A sub-topic title is plain text, not markup.** An HTML escape renders literally in the
  chip, the heading and the drawer row. Use the real character. Typecheck cannot see it.
- **Rendered checks earn their keep here.** `npm run check:layout -- --only=coach-help` (needs
  the dev server up). The help screen only enters a `--changed` sweep when shared styling is
  touched, which is why 84 jump chips sat under the tap-target floor unnoticed. Run it
  explicitly.
- **The 44px tap floor applies at desktop width too**, not just on phones.
- **Long labels must wrap.** A chip that cannot wrap pushed the whole guide sideways at phone
  width.
- **The demo door is rate-limited** (10 presses / 10 minutes — it is public). If you re-take
  screenshots, the script already presses it once per run; do not add per-shot presses.
- **The help surface pins dark by restoring 24 tokens by reference**, never by copying values.
  If help starts consuming another themed token, add it to both lists — the comment in
  `app/globals.css` says which.

### Verification expected

`npm run typecheck`, `npm run lint:focused -- <files>`, `npm test`, `npm run check:tokens`, and
— for anything touching help layout — `npm run check:layout`. Add QA steps to
`OWNER_QA_LEDGER.md` §18 as a new batch. Offer `/simplify` then `/review` after a substantive
change, per `CLAUDE.md`.

### House rules that bite on this work

- Work on `dev`. Stage **explicit pathspecs only** — another agent shares this working copy and
  has repeatedly swept shared files (`TODO.md` especially) into its own commits. Check
  `git show --stat HEAD` after every commit.
- **No commit or push without the owner's explicit go-ahead**, per action.
- Write completion summaries as a **product owner** would read them: what the user sees and
  does differently, not file paths or mechanics.
- There is a **pre-existing failing test** on the branch from another session's season-surplus
  work, and a pre-existing lint warning in the exports guide. Neither is yours; do not fix them
  silently and do not let them read as your breakage.
