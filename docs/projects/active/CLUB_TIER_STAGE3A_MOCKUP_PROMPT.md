# Club Tier Readiness — Stage 3a mockup session prompt ("Club money: the bookkeeping core and the allocation / request loop")

> Paste into a fresh session on `dev`. Written 2026-09-30. **This session draws and settles rulings. It does not
> build.** Plan: `docs/projects/active/CLUB_TIER_PRODUCTION_READINESS_PLAN.md`. Read these sections:
> - §3 (the exit definition — the money points);
> - **§4C** (the money ledger C01–C19 with code anchors, and "The same figure, computed differently");
> - §5 **D1** (the coach's records are the source of truth for team money; the club READS them) and **D2** (the
>   club's year — 3c's, but 3a must not contradict it);
> - **§6 Stage 3** (3a's mockup list, server list and gates) and "Across every stage — formatting" (the benchmark,
>   Ask 8's rulings, ruling (5) as amended 2026-09-29: a row that opens, opens from anywhere);
> - §6 Stage 1 and Stage 2 as built — and the notes they left for 3a (below);
> - §7's joint-sequence bullet and the Admin Design Continuity hand-off paragraph.
>
> The PM brief sits beside the plan. Project hub (ONE artifact for the project's life; republish the SAME path):
> `docs/projects/active/CLUB_TIER_PRODUCTION_READINESS_HUB.html` = https://claude.ai/artifact/K4MPu4ni53Ct7yrDcmWJd9.
> Memory: `project_club_tier_readiness`, and the coach-money files the index lists under "Coach money" (read the
> ones this stage touches — the club panel, payables, the money centralization). J4's text:
> `docs/projects/archive/journeys/JOURNEY_J4_CLUB_PRESIDENT.md`; the older money plan it folds in:
> `docs/projects/archive/BILLING_ACCOUNTING_COHERENCE_PLAN.md`.
> **The tournament admin redesign's Stage 2 drawing session may be running at the same time.** Read "Working beside
> the other sessions" before touching the dev server or any shared file.

## Blocking gate — item ONE is the mockup

1. **Mockups on the hub's Mockups tab, before any code.** Nothing in 3a is built until the owner ratifies the
   drawings. Draw the DECISIONS, **always the whole screen, before and after**.
2. **Every highlight is clickable.** A finding flag (`C06`, `J4-013` …) opens what the code does today and what the
   drawing changes, with a per-instance `data-here` sentence. Every NEW / RESTYLED / UNCHANGED tag carries its
   own note. A findings dialog jumps to the matching Full Plan heading; add the heading if it's missing.
3. **True size** for anything about size: phone frames at 390px with the 44px reference block beside them. The
   hand-off tells the owner to open the hub on a phone.
4. **Both themes:** every "after" frame drawn Warm with a dark copy cloned at load (the hub's method). The "before"
   frames are **today's screens as they are now** (the admin's kit restyle — money tables restyled in place, F4 —
   not the old dark console).
5. **The formatting benchmark is checked BEFORE the owner sees a drawing** (plan §6 "Across every stage —
   formatting"): the table & list standard and its exception register, the portal kit, no action links inside
   table cells, one lime per screen, red only for destructive, the display face for titles / column headings /
   band rows, figures in the body face tabular, a right chevron opens and a down chevron expands, a row that opens
   opens from anywhere, **on a phone a list of short records is ONE frame** (S.7), forms as dropdowns with edit
   autosaves / create asks. Put the check on the hub as the Stage 2 session did ("Formatting check").
6. **Record every ruling on the Decisions tab as it happens.**

## Verify before drawing (the plan was written 2026-09-25; the code has moved)

- **Which C-rows are already fixed.** Stage 0's dead-control sweep fixed two money controls; Stages 1–2 changed who
  reaches what (D8: admin now holds accounting; a treasurer lands in Accounting at sign-in). Re-read C01–C19 against
  today's code and tag each on the hub: open / fixed (with the commit) / partly. Draw only what is open.
- **The notes earlier stages left for 3a:**
  - A treasurer's **allocations and payment-requests screens still live under Rep Teams**, whose layout bounces a
    treasurer — the data is open to them, the screens are not (§6 Stage 1 session 1).
  - **An admin can now approve a coach's payment request** (the route always allowed admin; D8 lets them reach it)
    — **C08 is 3a's to rule** (Ask 1).
  - **S1-02:** the Accounting rail's "Summary" entry has no screen until 3b.
  - The hub shows **no money figure until Stage 3** (C04): Net Position is known-wrong. 3a does not draw the
    whole-club summary either (3b) — say where it will go.
- **The coach's side of each club action.** Allocation installments and payment requests land in the coach's
  money pages (the portal's club panel under a team's accounting; the payables work). Read what the coach sees
  today when the club marks an installment paid, approves or denies a request, and what a pending request does to
  the coach's season close.

## What 3a changes (the brief for the drawings)

**Who does what, after 3a:** the treasurer (and the owner, and an admin with accounting) runs the club's books
and the allocation loop from **one place**, and every money move is confirmed, recorded with its method and
reference, and reversible by the club. Team ledgers are **the coach's records, read-only and labelled "held by
the team"** (D1) — never summed into the club's own position. The coach sees what the club did, in the portal.

## The specimens (draw these; nothing else)

1. **The ledger page, whole screen, before/after, desktop + phone.** An org ledger and a team ledger side by side
   in the drawing: the team one read-only and labelled (D1, C12 — no add/edit/void, no transfer in or out of a
   coach's books). The badge knows its four types (C14). **A transfer voids both sides** (C13) — draw the void's
   question window. **Payees managed** (C01: the picker that works, and where a payee is edited). Export says
   what it holds (signed amounts, void rows marked). ⚠ Leave a place in the source labels for a **tournament fee**
   entry: Club Stage 7 brings tournament fees to the ledger (C18) — a seam, drawn as today, tagged "owned by
   Stage 7".
2. **The allocations list, whole screen, before/after, desktop + phone.** An Allocated column, the team names, an
   overdue that is true (C06), each allocation's state in form and colour; one definition of "collected" behind the
   figure (tag the definition — "The same figure, computed differently").
3. **An allocation, whole screen, before/after.** Mark paid asks first and records the method and reference; an
   admin undo that reverses both sides with a reason; the team's name on the ledger line (C07, J4-013).
4. **Payment requests, whole screen, before/after, desktop + phone.** Approve asks first (Deny already does); a
   reversal; **the coach's own meaning visible** ("new money" or "money back", mig 271's classification); the
   club told when a pending request is blocking a team's season close (C15).
5. **Where these screens live for a treasurer (a delta, not a redraw).** The Accounting rail's entries and the
   screens' home, so a treasurer never meets a bounce (Ask 2).
6. **Reminders, only if Ask 4 keeps them in 3a:** a reminder wave goes to the coach, not the clicking admin,
   with a recipient preview and a confirm (C16, J4-030). Words tagged for `/marketing`.
7. **The coach's side, portal, phone, both themes:** what a head coach sees when the club marks an installment
   paid, approves or denies a request, or reverses either — and a request that blocks their season close. Nothing
   the club does may leave the coach on a figure the server no longer agrees with.

**Not drawn — listed on the hub as the build's server work:** transfer + stamp in one RPC (both mark-paid routes and
approval); the `status='pending'` guard; `accounting_entry_id` written; rep-group scope on money writes; the org day
for entry dates; the General-ledger creation race; ledger summaries paged (C14's 1,000-row cap); the build gates
(`check:club-money-arithmetic`, the "same figure, one definition" guard, the transfer-atomicity test); and **the old
look's retirement** — Stage 3's build deletes Accounting's, the allocations' and the payment requests' old-look code
(`npm run check:old-look:report` lists 12 files; colour debt `accounting` / `bva` / `budget`). 3b draws Budget,
Budget vs. Actual and the board summary; 3c the club year.

Each specimen gets a one-line design intent in the hub's `#intent` footer, tags per element with a note, and finding
flags per instance. Use ids `s3a-*` and class `s3a`, with a sub-nav entry per specimen.

## The asks (numbered, each with a recommendation; Decisions tab rows, `open`)

1. **C08 · Who approves, who marks paid.** Today: approve a request = owner / treasurer / admin; mark an installment
   paid = owner / treasurer; and a coach can self-post a transfer to the club's ledger by recording an installment
   paid. Recommend **one rule for both: whoever holds the club's accounting** (owner, treasurer, an admin with it),
   and **a coach can never post to the club's ledger** — the coach records, the club confirms.
2. **The screens' home.** Recommend Accounting owns allocations and payment requests (the treasurer's module);
   Rep Teams links to them from a team.
3. **Reversal.** Recommend an undo on mark-paid and on approval that voids both sides with a reason, shown on both
   ledgers and to the coach; no silent deletion.
4. **Reminders in 3a or later.** Recommend 3a (it's the allocation loop's last step), with preview and confirm.
5. **Anything the verification finds** that the plan's list misses — say so, don't force-fit.

## Working beside the other sessions

- **The tournament admin redesign's Stage 2 drawing** may run at the same time, and the release may be running in
  another chat. **One browser tester at a time:** before any probe, capture or `auth-setup`, ask the owner whether
  another session is measuring or sweeping (a second runner rotates the shared UAT sessions and revokes the other's
  mid-run). Draw "before" frames from the code where you can; take real screens from `uat-rep-club` only when the
  owner says the server is free.
- **A new shared pattern is an ask, not an invention.** The admin's rows and tables already have one recipe
  (`ClubRow*` in `components/admin/kit/club/RepKit`, extended by tournament Stage 1). If a money table needs a new
  variant (a right-aligned figure column, a signed amount, a band total), draw it as an ask tagged "shared — the
  tournament redesign draws tables too", so the two programs don't each invent one.
- **No code, no help files, no gates.** Your files: the hub's Mockups Stage 3a section, the `FINDINGS` you add, the
  `#intent` map, the sub-nav, the Decisions rows, the plan's Stage 3 section, the PM brief, your TODO line, memory.
  Read the hub fresh before every edit; parse its scripts before every publish; add FINDINGS / DECISIONS through a
  second `<script>`; never `force` a refused publish — merge onto what it hands back.
- **Git:** private index, explicit pathspecs; commit only when the owner says.

## Hand-off

Product-owner voice. Lead with what a treasurer, a club admin and a head coach each see differently. List the
specimens with the findings each closes and what it leaves to 3b / 3c / Stage 7. **Tell the owner to open the hub
on a phone** for specimens 1, 2, 4 and 7. Put the asks as numbered questions with a recommendation each, **Ask 1
first**. Offer `/design` for a review pass if the session has budget. Do not write the 3a build prompt until the
drawings are ratified; when it is written, it carries the old-look retirement (the gates above) in its definition
of done.

## Do not

- Build anything, or change routes, gates, seeds, help or copy files.
- Draw Budget, Budget vs. Actual or the board summary (3b), the club year (3c), tournament fees reaching the ledger
  (Stage 7 — the seam only), families' money (Stage 5 / Families P3), the public site, venues, permits.
- Sum a team's money into the club's position, or give the club a write to a coach's books.
- Change a price, a plan, a gate; write customer copy (draw the placement, tagged `/marketing`).
- Mint a second artifact. The hub is the only one.
