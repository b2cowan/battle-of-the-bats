# PM Brief — The Account Button Opens In Place

**What changes for the user.** Clicking the little avatar in the top-right corner of the coaches
portal (and the tournament admin area) no longer throws you out of your workspace onto the
consumer account pages. It opens a small menu right where you are: who you're signed in as, a
Warm/Dark appearance flip (coaches side), Notification settings, Send feedback, Account settings,
and Sign out. The everyday errands — check identity, flip the theme, send feedback, sign out —
now finish with zero navigation. The deeper doors still lead to the account pages, but they're
chosen knowingly, and a new "← Back to your Coaches Portal" (or Admin Area) bar at the top of
those pages brings you back to the exact screen you left.

**Why it matters.** The old button was a surprise eject: different shell, different nav, no way
back. The portal already removed its chat door for exactly this fault; the account door was the
last one left. Every control in the top strip now behaves the same way — opens in place,
navigates only when you pick a destination.

**Also in this change.** One sign-out everywhere it can be: the sidebar's bottom "Sign out"
comes off on desktop (the menu owns it, in the corner every product uses); phones keep their
sign-out in the More sheet, relabeled from "Logout" to "Sign out" so the product says it one
way. Signing out from the portal lands on the sign-in page — fastest way back in on a shared
machine. Help deliberately does NOT move into the menu: the sidebar keeps it, with its
what's-new dot, and each page's "?" keeps contextual help.

**Role/plan differences.** None — every signed-in coach and admin gets the same menu. The
billing-suspended and not-assigned walls keep the menu but without Send feedback (a wall keeps
identity and exits, not portal function). The public demo sandboxes hide the avatar entirely —
a demo visitor must never sign out the shared demo account.

**Success criteria.** A coach can flip the theme, send feedback, and sign out without leaving
the screen they're on; a trip to notification settings comes back to the same screen via the
return bar; no surface shows two doors to the same place; the demos are unaffected.

**How to test.** Owner QA Ledger §127.
