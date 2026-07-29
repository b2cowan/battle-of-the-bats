# Coach Portal Launch Batch 3 — Season's End — PM Brief

> **Created:** 2026-07-28 · Companion to `COACH_PORTAL_LAUNCH_BATCH3_PLAN.md` · Status: awaiting mockup approval + decisions D1–D5
> **Mockups:** `claude.ai/code/artifact/ddf75f7e-02b9-4ba9-af1f-304c2db5c11b` (rev 1 — approval = binding visual spec)

## What this is

When a season ends today, a paying coach's portal doesn't celebrate — it disappears. The moment a club admin marks the season complete, every coach on that team is met with "Not assigned to any teams" and loses access to their roster, results, money records, everything, with no way back except contacting support. The one screen the product built to say "season complete, nice work" can never actually appear, because it lives behind the door that just got locked. Standalone coaches are never locked out, but their finished season vanishes just as silently — the product's last impression of a season is nothing.

Batch 3 turns that moment into the best one in the product.

## What the coach sees and does differently

1. **Never locked out.** A coach whose season has been closed keeps a way into that team. Instead of the dead-end wall, they land on a **Season's End** screen: the final record, the season's highlights, and clear doorways into their read-only season history (results archive, money summaries). Nothing is editable — the season is honestly over — but nothing they built disappears. A standalone head coach gets a "Start next season" button right there; a club coach sees plainly that their club manages seasons and the team will reappear automatically when they're on next season's staff. Teams with a finished season show up in the team switcher under a quiet "Season complete" label instead of vanishing.

2. **Season Wrapped.** The Season's End screen leads with a shareable highlight card assembled from what the product already tracked all season: final record, longest win streak, closest game, attendance rate, top award-winner, and a standout lineup fact ("your Saturday lineup went 4-0"). One tap shares it as a polished image through the phone's share sheet — to the family group chat, social, wherever the coach chooses. A short season gets a smaller, honest card rather than padded stats.

3. **A "you're probably done" nudge.** Today the season just quietly stops. Now, once games have been played and nothing has been scheduled for a couple of weeks (and no tournament is coming), the Overview shows one quiet, dismissible note. For a standalone head coach it leads into closing out the season properly — which is what unlocks Wrapped. For club coaches it simply sets the expectation of what happens next. It never nags: any scheduled event silences it, a mid-season break won't trip it, and one dismiss ends it for the season.

4. **Honest close-out everywhere.** The club admin's "Mark Completed" button — currently a single instant click — gains a confirmation that says what actually happens to the coaches. The coach's "Start next season" dialog stops omitting two things families ask about: player development history (open goals get a per-player "bring forward" offer; measurements always start fresh) and awards (they stay on the team's all-time record). Its "you can always look back" promise — currently untrue — becomes true.

## Why it matters

- This is the readiness review's **scariest finding**: a paying customer stranded by the product working as designed. Trust, renewals, and support load all hang off this moment.
- Season's end is when renewal goodwill peaks. Right now the product's closing note is a locked door; after this batch it's a highlight reel the coach shows other people — the closest thing to built-in word of mouth the portal has.
- It's also the smaller of the two remaining launch blockers, which is why it jumped the queue ahead of tournament-game tools (Batch 4).

## Role differences

- **Club-owned team coach (head or assistant):** gains everything above; season closing stays the admin's job.
- **Standalone head coach:** was never locked out, but now gets the ceremony — Wrapped after rollover, the nudge before it.
- **Assistants:** same read-only Season's End view; no season-closing actions.
- **Club admin:** one new confirmation dialog; nothing else changes in their flow.

## Tradeoffs made (and why)

- **Closed seasons are read-only with a curated view, not a full frozen portal.** Every *record* stays readable; the day-to-day workflow screens (lineup builder, announcements, etc.) don't reopen for a dead season. A full read-only portal would be a much larger build for screens that have no purpose after the season — and carries real risk of accidental edits leaking into the wrong season.
- **Wrapped shares as an image, not a public link.** The image path reuses a proven pattern and ships now; a no-login web link for families would be the portal's first-ever public surface and deserves its own careful project.
- **No email/notification when an admin closes a season** (this batch). The harm was the lockout, and that's gone; a notification can ride a later batch if wanted.

## Success criteria

- No coach, on either team model, can ever hit the "not assigned" wall while having a completed season on record.
- The season-complete moment renders — for the first time ever — and leads with Wrapped.
- A coach can share their season image in under three taps from landing on Season's End.
- The nudge appears for a genuinely-finished test season and does NOT appear during a mid-season gap or before a registered tournament.
- Admin close-out requires one explicit confirmation; rollover copy mentions development and awards.

## What I need from you

- Approve/adjust the mockups (binding visual spec).
- Rule on D1–D5 in the plan — the big three: what a closed season shows (recommended: wrap-up + read-only history), image-only sharing for now (recommended: yes), and how quiet the "you're probably done" nudge should be (recommended: two quiet weeks + no upcoming tournament).
