# PM Brief — the demo sandbox's mobile hat

**One line:** the demo's own banners were eating nearly half the phone screen before a prospect saw
any product; now the honesty claim stays put and everything else gets out of the way as they scroll.

**Status:** built, awaiting owner QA. Plan: `DEMO_SANDBOX_MOBILE_CHROME_PLAN.md`.

---

## Why this matters

Both no-login demos run the real product on fictional clubs, and the demo's whole argument is
*"this IS the product"*. On a phone that argument was undercut by the demo's own furniture: on the
game-day fan page, **42% of the screen was fixed chrome** — the demo's four bands, then the
product's event header, then the product's live score ticker — before a single fixture appeared.

A prospect opening the demo on their phone was mostly being shown a demo about a demo.

---

## What a visitor sees differently

**Arriving.** The top strip is tidier and shorter. "Live demo" now sits above the replay countdown
on the left, with **Start your own — free** pinned opposite it on the right, instead of the button
falling to a line of its own and leaving half a row empty.

**Scrolling into the product.** The season tabs and the guided-tour row fold up out of the way, and
the page carries on like any other app on their phone. **The "Live demo" claim and the signup door
never move** — they are on screen at every scroll position.

**Coming back.** Scrolling up returns everything. So does a small **2/6** button that appears beside
the signup door while the guidance is away, so a visitor can never lose the tour by scrolling.

**During a live game.** The demo used to announce the score in its own strip while the product's
score ticker announced the same score, about an inch below, with its own flashing dot. The demo's
copy now stands down and lets the product speak — except when it has something to say the ticker
cannot ("between games, final in four minutes"), where it stays.

**On a desktop.** Nothing changes at all. Verified unchanged before and after scrolling.

---

## The numbers

| | Before | On arrival | While scrolling |
|---|---:|---:|---:|
| Tournament demo chrome | 183px | 135px | **53px** |
| Coach demo chrome | 155px | 139px | **53px** |

On a 390 × 844 phone that is **130px handed back** — about a sixth of the screen — the moment a
visitor starts reading.

---

## Trade-offs made

- **The demo is still never dismissible.** That was a firm rule and it is intact: the folding applies
  only to navigation and the tour, never to "Live demo · nothing is saved · Start free".
- **One copy change needs your nod.** On a phone the coach demo's claim *"Changes show on screen, but
  nothing is saved."* no longer fits the narrower column and was being cut off mid-word. It now reads
  **"Nothing is saved."** on phones only; the full sentence stays everywhere else. Cutting an honesty
  claim in half by accident is worse than shortening it on purpose — but it is your call.
- **The tour stayed at the top.** A version that moved it to a floating button near the thumb was
  drawn and set aside: the bottom of the phone screen is already spoken for by the app's own tab bar
  and the game-day team dock.
- **Tablets keep all three bands.** They have the room, and adding a second screen-size rule to this
  component would be new complexity for a problem it does not have.

---

## How to test it

1. Open the tournament demo on a phone (or a 390px-wide browser window). Check the top strip reads
   as two tidy columns, and that the season tabs and tour row are present on arrival.
2. Scroll down. The tabs and tour should fold away; **"Live demo" and the green Start button must
   stay**. A small **2/6** button should appear next to Start.
3. Press **2/6** — everything comes back. Then scroll down and back up — it comes back that way too.
4. On game day, confirm the demo strip is not repeating the score the product's ticker is already
   scrolling. Tap the ticker's ✕ to minimise it; the demo's score reading should return.
5. Repeat 1–3 on the coach demo, and confirm the words **"Nothing is saved."** are visible at all
   times without being cut off.
6. On a laptop, confirm nothing about the demo strip has changed.

---

## Success criteria

- A prospect on a phone spends most of the screen looking at the product, not at chrome.
- No visitor can reach a state where the tour and season tabs are gone with no way back.
- The honesty claim is legible, complete, and on screen at every scroll position, in both demos.
