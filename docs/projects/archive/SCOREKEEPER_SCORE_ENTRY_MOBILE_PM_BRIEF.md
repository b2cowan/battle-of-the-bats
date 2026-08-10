# PM Brief — Scorekeeper score entry on mobile

**Status:** ✅ done on dev 2026-08-08 — owner QA passed, adversarial review run and acted on, and a
follow-up owner ruling on how the sheet is dismissed applied. **Not yet on production.**
**Priority:** high — this is the single screen a volunteer touches, and it has been broken on phones
since it shipped.
**Plan:** `SCOREKEEPER_SCORE_ENTRY_MOBILE_PLAN.md`
**Mockups:** https://claude.ai/code/artifact/f4bedded-de30-421f-b46c-89f35a674bed

---

## What was wrong

A volunteer at a field taps a game and gets a sheet to type the final score. The box holding that
number was **about 29 pixels wide** on a normal phone — narrower than a single digit at the size it
was drawn. The two "−" and "+" buttons either side had taken nearly the whole width for themselves.

The away team's box looked empty in the owner's screenshot because there was no room for a digit to
appear in it. This affected every phone, not an unlucky one.

Alongside it, tapping the box raised the **full text keyboard** instead of the number pad, and the
Finalize button sat five pixels clear of that keyboard — close enough that a long team name pushing
the title onto a second line would have hidden the only way to save.

## What changes for the volunteer

- **Two large score boxes**, side by side, roughly five times wider than before. The number is
  visible while it is typed.
- **The +/− buttons are gone.** Entering 11 is two taps instead of eleven.
- **The number pad appears**, not the alphabet.
- **Tapping a score selects it**, so typing replaces. Correcting a 5 to a 3 used to give you 53.
- **The keyboard's action key can no longer finalize a score.** It moves to the second team, then
  puts the keypad away. Committing a final result stays a deliberate press of the button.
- **The header names the game, not the teams** — "10:00 AM · Lab Field 1 · U13". The team names are
  already on the labels below; what a volunteer needs confirmed is that they opened the right game
  out of the eight on that field this morning.
- **Cancel and Finalize share one row**, and the sheet now measures itself against the space the
  keyboard actually leaves. Finalize cannot end up underneath it.

## Why it matters

This is the last screen between a game finishing and a parent in the stands seeing the result. It is
operated once per game by someone who has never been trained on it, often outdoors, one-handed,
under mild time pressure. A field they cannot read the number in is the worst possible place for the
product to be careless, and every wrong score entered here becomes a public standings error that an
admin has to chase.

## What was deliberately not done

- **Team names still sit above their box, not beside it.** An alternative layout paired each name
  with its own field on one line, which reads slightly safer for long club names. It was declined
  because it costs 40 pixels of the height that keeps Finalize clear of the keyboard on a small
  phone — and each name is already directly above its own box.
- **No live in-game scoring.** The +/− buttons only make sense for a running tally, and this screen
  saves once. If we ever build bench-side live scoring it gets its own screen with its own controls.

## Impact elsewhere

None. No pricing, plan, permission, notification or data change — the score that gets saved is
identical, and admins reviewing or finalizing results see no difference. Two automated tests that
identified the score fields by their old input type were updated in the same change.

## Success criteria

1. A volunteer can read the score they are typing on a 390px phone.
2. The number pad appears on first tap, on both iOS and Android.
3. Finalize is reachable with the keypad open on a 375×667 phone.
4. No score is ever committed by a keyboard key rather than the button.
5. A correction replaces the old value instead of appending to it.
