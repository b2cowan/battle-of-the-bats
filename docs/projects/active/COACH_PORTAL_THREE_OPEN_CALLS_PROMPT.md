# DECISION PROMPT — three open calls left by the Insights reports portal

You are picking up **three small, unrelated decisions** the Insights reports portal surfaced and did
not settle. None of them blocks anything. Each will be decided by default if nobody decides it
deliberately, which is why they are written down.

**Read the mockups first — they are the brief.** Every screen in them is drawn from the product as
it stands, and the Sunday-digest examples are assembled from the live templates rather than invented:

**https://claude.ai/code/artifact/2b289cf9-faa8-4a5c-b27e-3a5b84c98982**

Then read `AGENTS.md` / `AGENCY_RULES.md` (no commit without explicit owner OK, explicit pathspecs
only, `dev` branch) and this file. **Every claim below was verified against commit `0ebd0ffa`.**

⚠ **THIS IS A SHARED WORKING COPY.** Another session is active in it. Run `git status` first, expect
files you did not touch to be modified, and grep `git diff --cached --name-only` for anything foreign
*before* committing — the shared git index swept three files into another session's commit during P1.

⚠ **All work stays local until the owner explicitly pushes.** Never `git push` — not to `dev`, not to
`master`. Any prompt you write for another chat must carry this same reminder forward.

---

## Your job, in order

1. **Get an owner decision on each of the three**, using the mockups. Do not start with code.
2. **Log the decisions** where they belong — see each call below. A decision nobody can find later
   gets re-litigated, which is how two of these three arose.
3. **Then implement**, smallest first. Call 3 is roughly an hour; call 1 is a few lines; call 2 is
   the only one with real design consequences.

If the owner picks the recommended option on all three, this is a half-day of work. Do not expand it.

---

## Call 1 — should the Sunday push stop mentioning money?

**The state of things.** Money left the Insights *page* by owner ruling (no dues tile, no money
findings, no money figures anywhere on it). The engine that composes those findings has a **second
consumer**: the Sunday "week in review" notification. That surface still sends money, deliberately —
P1 raised it rather than deleting the rules, because the ruling was about a page and deleting them
would have silently stripped dues warnings from a notification nobody asked to change.

**What the mockup shows, and the point of it.** The push takes one piece of good news plus the top
two attention items, drawn from a fixed ranking (safety → money → attendance → fairness →
development → good news), filtered per recipient by their own access. So removing money does not
shorten the push — **the slot is refilled from further down the ranking.** The mockup shows the same
two weeks with and without money so the owner can see it is a choice about *which fact reaches a
coach on a Sunday evening*, not about length.

**Who it changes:** head coaches and money-holding assistants only. An assistant without money access
never received a money line, and a helper receives nothing at all.

**Options** (A recommended): **A** leave it — a notification decides what is worth interrupting
someone for, and an unpaid instalment before a Friday deadline qualifies; **B** remove it, so "no
money in Insights" is true of everything the engine produces; **C** split it, giving money its own
line rather than a contested slot.

**If B is chosen**, the change is a single input at the digest's per-coach composition step. **Do not
delete the money rules from the findings engine** — they are pure, tested, and their absence is
better expressed by not supplying dues than by removing the rules. Update the engine's own header
comment, which currently states the digest is why they survive.

**Log it in** `docs/agents/strategy/BUSINESS_DECISIONS.md` via `/strategy` — it is a durable product
decision about what the platform proactively tells a coach about money.

---

## Call 2 — is the desktop sidebar too small to hit?

**The state of things.** The repo's rendered layout check flags **every row of the coach sidebar at
1440px** as under the 44px minimum: the home link at 22px, notifications 28px, account 30px, the team
switcher 33px, the five collapsible group headings 26px, and the nav rows themselves 39px. It
reproduces on **every coach screen**, including ones this project never touched — verified against an
untouched screen during P1's review. Two `content-overflow` findings sit alongside them.

**Why it is not simply "make them bigger".** The rail carries fifteen rows plus five headings.
Raising every one to 44px adds roughly 250px to its height — and commit `fb8345cf`, **this week**,
deliberately cut the portal's chrome to get content higher up the page. The two pull in opposite
directions. The honest question is which rule is wrong: the 44px floor at mouse-and-keyboard widths,
or the rail.

⚠ **Whatever is decided must also settle the ~25 similar desktop controls already sitting in
`scripts/.layout-baseline.json` as accepted exceptions — most with `reason: null`.** They were
bulk-accepted at some point and nobody wrote down why. Leaving them is how a guardrail becomes noise;
this is the chance to make the check honest again.

**Options** (A recommended): **A** keep the floor for touch widths, and write ONE reviewable
exception for mouse-driven widths covering the rail and those 25, replacing the unexplained entries;
**B** raise only the genuinely small controls (22–33px) and leave the 39px nav rows and the headings;
**C** raise everything to 44px, accepting that it partly reverses the slimdown.

⚠ **Group headings are real buttons** — they collapse their group — so they are targets, not labels.
Do not dismiss them as headings.

**If A or B is chosen**, re-sweep afterwards and confirm the check is green on a coach screen for the
first time. **Log it in** `memory/design_decisions.md` (and the repo's own `memory/MEMORY.md` index in
the same change) — it is a design rule about when the tap floor applies.

---

## Call 3 — which dash does a win–loss record use?

**The state of things.** The portal renders a record two ways:

- **En dash (`12–4–2`)** — the team masthead, the team Overview, Season's End, and opponent record
  chips. All go through the shared formatter in `lib/coach-season-record.ts`, which documents itself
  as "the one place the record is turned into a string" and exists because a real defect once had two
  surfaces disagreeing about the same record.
- **Hyphen (`12-4-2`)** — the Insights Dashboard tiles and the Results tab, each with its own local
  formatter, plus the public club site.

⚠ **The reports portal made this visible on ONE SCREEN.** The masthead sits directly above the
Insights tabs, so a coach reads `12–4–2` and then `12-4-2` an inch below it — and the Scouting Book
tab, inside the same portal, uses the en dash again. The mockup shows exactly this.

**Options** (A recommended): **A** en dash across the coach portal — the two Insights surfaces adopt
the shared formatter, deleting their local copies rather than adding a third; **B** hyphen
everywhere, which means changing four coach surfaces and abandoning the shared formatter; **C** leave
it deliberately.

⚠ **The public site is a separate decision.** It is a different audience with its own conventions;
do not sweep it in without asking.

**If A is chosen**, note the shared formatter takes `{w,l,t}` while the Insights panels hold their own
shapes — adopt it properly rather than wrapping it, and delete both local `recStr` helpers so a third
cannot appear. **Log it in** `memory/design_decisions.md`.

---

## Standing rules that bind any of this

- **CSS module purity** — a global rule in a `*.module.css` builds fine on dev and hard-fails the
  production webpack build.
- **The token guardrail runs on commit** and rejects raw hex in portal stylesheets. Never bypass it;
  it is the check that caught a portal-wide contrast defect that had survived months of review.
- **`npm run check:layout` renders pages** and needs a running dev server plus the seeded UAT fixture
  (`node scripts/seed-uat-coach-fixture.mjs`). ⚠ **A green sweep over an empty or unchanged screen is
  not evidence** — that trap has now bitten this project twice, most recently when seven Insights
  tabs of empty states swept clean and were reported as covered.
- **Deployment state has one home** — the release-history record and the Owner QA Ledger. Never write
  a perishable negative ("not on prod", "dev only") into a plan or a comment.

## Definition of done

Three decisions taken and logged in their stated homes; only the chosen changes implemented; the
layout baseline's unexplained entries either resolved or given a written reason; typecheck +
`verify:changed` + a focused layout sweep green, with anything left red stated as pre-existing and
shown to reproduce on an untouched screen. Add a QA ledger § entry only if a change is user-visible
(calls 2 and 3 are; call 1 is if the push changes). Commit only with explicit owner OK, on `dev`,
explicit pathspecs, and confirm with `git show --stat HEAD` that only your files landed.
