# PM Brief — App Icon "Logo Size" Control

**Status:** Planned · **Priority:** low / nice-to-have polish · **Effort:** ~half a day to a day

## What it is
Tournament Plus organizers can already customize the home-screen app icon fans get when they add an event to their phone — they set the background colour and the short app name. This adds **one more control: a "Logo size" slider** so they can make their logo sit larger or smaller inside that icon tile, with a **live preview** that updates as they drag.

## Why it matters
A common complaint with auto-generated icons is the logo looking too small and lost in the tile (or, for a busy logo, too tight). Today the size is fixed by us. This hands organizers the final bit of polish on their event's "app," which is the most premium-feeling part of the Plus branding set — and it's cheap to build because it reuses the exact pattern we just shipped for background colour and app name.

## What the organizer sees and does differently
- In **Public Site → Advanced Branding → App Icon**, a new **Logo size** slider (Small ↔ Large) under the existing Background options.
- The preview icon resizes live as they slide.
- They save with the same Save button as the rest of the branding panel. Free-tier orgs see the App Icon panel "Locked" exactly as today — no change for them.

## The one expectation to set in the copy
**Phones cache the icon once it's installed.** Changing the size later won't restyle an icon already sitting on someone's home screen — only fans who add the event *after* the change see the new look. So this is about getting the first impression right, and the live preview (not anyone's already-installed icon) is the source of truth. We'll say this in one short line in the panel.

## Tradeoffs / constraints
- **iPhone vs Android differ.** Android crops home-screen icons into a circle, so a logo can only grow so far before it would get clipped. The slider lets iPhone icons grow more freely and **automatically caps the Android version at a safe size** so a logo never gets its corners cut — the organizer doesn't have to think about it; it just stays safe.
- No new plan, price, or gate — it lives inside the Tournament Plus branding they already pay for.

## One decision for the owner
- **Slider vs preset chips.** Recommended: a smooth **slider** (Small ↔ Large) with a "Default" mark. Alternative: three preset buttons (e.g. Snug / Default / Roomy) to match the row of background-colour chips right above it. Recommend the slider since size is naturally continuous and the icon-caching caveat makes pinpoint precision unimportant.

## Success criteria
- A Plus organizer can make their logo visibly bigger/smaller and see it reflected in a fresh "Add to Home Screen" on both an iPhone and an Android phone.
- Android icons never ship a clipped logo at any slider position.
- Free tier and non-branding admins are unaffected.

## Not included (possible later)
A full drag-to-position / pinch-to-zoom **crop** editor (reframe *which part* of the logo shows). That's a multi-day build; we'd only do it if organizers specifically ask to crop rather than just resize.
