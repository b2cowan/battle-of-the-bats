# PM brief — The Money Banner Standard

**Plan:** `COACH_MONEY_BANNER_STANDARD_PLAN.md` · **Mockup:** artifact
`2b5bd78b-cbc5-4c5c-b7e0-d3956121caf6` (rev 4) · **Approved:** owner, 2026-09-03 (D1–D6).

## What a coach sees differently

**Every money tab opens the same way.** Today five tabs summarise themselves five different ways — a
paragraph on Budget vs. Actual, three cells on Club, four cards on Fundraising, a titled panel on
Budget Plan, and on Player Dues nothing at the top at all. After this, each opens with one quiet
band of three or four tiles: a small label, one big figure, and at most a six-word caption. A coach
moving between tabs stops re-learning where the answer is.

**Budget vs. Actual stops being a paragraph.** ~25 words become ~12: Headroom, Spent, Off-plan and
Season end, each in its own column. Nothing is lost — the planned total and the "possible" money ride
captions. The off-plan tile only appears when there IS off-plan spending, so a well-run team sees a
clean three.

**Player Dues finally has an answer at the top.** Assessed, Collected, Balance owing and Past due
move from the bottom of a thirteen-row table to the top of the tab, on both views. Nothing is shown
twice: the table footers retire as the band arrives.

**A ten-instalment schedule stops being a wall.** The Collection schedule becomes a single row —
one small bar per instalment with its date, the next one ringed — and a sentence beneath naming what
is due next and how many families are still to pay. Roughly 330px of wrapped cells becomes ~100px,
and it behaves identically at three instalments or twelve. It folds away, remembering the choice per
device, and even shut it still says what is due next.

**Two real defects go with it.** A term covered by fundraising currently reads "$0.00 of $970.80"
beside a half-full bar — the figure counts cash, the bar counts cash plus credits. The bar becomes
two-tone so the difference is legible instead of contradictory. And on a long schedule the two
columns a coach acts on — Due next and Balance — are the two pushed off the right edge; they move
beside the player's name so they survive the sideways swipe.

## Why it matters

The product already learned this lesson one level down: a build-blocking check exists purely to stop
the money *tables* drifting into two type scales, written after they drifted twice in a single day.
The tab summaries are the same problem one layer up with nothing holding them together — which is why
this ships with its own check (D6), not just a convention.

The customer-facing gain is smaller and more concrete: a treasurer reads five money screens in a
sitting, and every one currently asks them to find the summary somewhere new.

## Role and plan differences

None. Every figure shown is one the screen already computes and already shows to whoever can open
that tab; nothing new is derived, no gate moves, no migration.

## Trade-offs taken knowingly

- **Two owner-approved designs are revised.** The Budget Plan card (approved 2026-08-13) loses its
  panel title and inline line-counts — everything ruled on individually survives. Player Dues' season
  totals leave the table foot they were deliberately moved into (also 2026-08-13); the owner's call is
  that five tabs opening alike beats per-table alignment.
- **Fundraising loses some colour.** Its green and purple figures become ordinary ink, because under
  the recipe colour marks a verdict, not a total.
- **Sequencing:** Fundraising and Player Dues are held until a concurrent refactor of those two files
  lands. Budget vs. Actual, Club and Budget Plan go first.

## Success criteria

1. All five tabs draw their summary through one shared component; the check fails a sixth way.
2. Budget vs. Actual's banner is ≤12 words with every figure preserved.
3. Player Dues shows its four figures once, at the top, on both views.
4. A 10-instalment header is ≤180px open and ≤115px shut, and legible at 361px.
5. A credits-covered instalment reads honestly — bar and figure agree.
6. Owner QA passes across five tabs, desktop and phone.
