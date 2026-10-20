# One Window — PM brief

**Ruled 2026-10-18** (all sixteen asks as recommended). Hub: https://claude.ai/artifact/RDo1NhB9QmoMMKWCiADp48 ·
plan: `docs/projects/active/ONE_WINDOW_PLAN.md`

## What changes
Every form window, "are you sure" question and notice looks and behaves the same, whether you are in the club admin,
the tournament admin or the coaches portal.

- **The look is the coaches portal's:** paper-tone fields and a narrower window. Labels are in sentence case, as on the
  admin's settings pages, and that now applies to every form in the product.
- **The behaviour is the admin's:**
  - A stray tap outside a form does nothing. If something is typed, closing it asks first: in every coach window
    from stage 2, and in the admin's forms only if that is chosen later (ruled 2026-10-19).
  - Fields and buttons are full tap size on a phone.
  - A short sentence at the foot says what happens next, and a refused save says why beside the button.
- **One "are you sure" window everywhere**, a small centred card on a phone. The browser's grey boxes are gone.
- **"Saved" and "Done" fade on their own**, and a notice with news is a sentence at the top of the page that fades.

## Why it matters
Today the product has two form windows, three ways to ask "are you sure", and a handful of strays. A tournament
organizer meets two confirm styles on the same Schedule screen. A coach can lose a typed form to a stray tap that the
admin would have caught. Every new window gets built against whichever family its author happened to copy, which is
how the drift started. One window piece ends that.

## Customer impact
Everyone who opens a window.
- **Club and tournament admins:** about 84 form windows and 54 questions change look.
- **Coaches:** about 76 form windows change behaviour, and every labelled field changes from small capitals to
  sentence case.
- **House league:** 17 windows join for the first time.

Nothing about what any window asks or does changes. Coaches get their changes in the same release as the admin.

## Priority
Medium. It is polish, but it touches every screen, so it is cheapest before the Club release puts the club admin in
front of paying customers.

## Stages
1. **One look:** fields, widths, spacing, edge, labels, and the dimmed page.
2. **One behaviour:** coach windows, the hand-built ones included (moved up from stage 4, ruled 2026-10-19), gain the
   admin's behaviour. Built in parts: 2a and 2b (the shell windows and their foot, walked 2026-10-19); **2c (the 23
   hand-built coach windows, the tryouts' and the money tools' included) built 2026-10-19/20**, with every field in a
   coach window 36px on a computer whatever its stylesheet (owner 2026-10-20); **2d (the money, dues and practice
   windows that still asked in a second window, plus Budget vs. Actual's month windows and Subscribe) built 2026-10-20**:
   no coach money or practice window opens a second "are you sure" on top any more, except the dues player panel and
   the staff sheet, which keep it until rooms and records get the one foot (owner 2026-10-20). Its review also fixed
   three older defects across the coach portal: greyed-out buttons lit up on hover, the leave warning said "this player"
   on every screen, and Manage payees did nothing over most Money tabs. Walk C owed; 2e (the admin's forms ask) next.
3. **One question:** one confirm everywhere; notices fade.
4. **Strays join:** House league, the tournament's old windows, one-offs.

## Success criteria
- Open any form or question in any portal, in Warm and Dark, on a computer and a phone: you cannot tell which portal
  built it.
- No browser grey box anywhere, and no notice that needs a tap to dismiss.
- A build check fails if a new window is built outside the one piece.
