# PM Brief — A stop button for the second parent's emails (Signed-in family accounts, Stage 3b)

**What it does:** Every email that reaches a second parent gets a "Stop these emails" button at the bottom. One tap, then one
confirm on a short page, and that address is taken off the sign-up for good. Nobody at the club has to do anything.

**Why it matters:** The second parent's address is typed by someone else and never checked. Today a person who didn't want it,
or an ex-partner, can only email the club and wait. The `/legal` review (2026-11-06, `CASL_SECOND_PARENT_EMAIL.md`) named that
as the one real gap in an otherwise careful design. Canada's anti-spam law expects an easy way off for a person who never
agreed to receive mail.

**Who benefits:** The second parent (control over their own inbox). The first parent and the club registrar (fewer angry
replies and fewer "please remove me" emails). Every plan that has House League sign-ups; the button is on the second parent's
copies only, so first parents see nothing new.

**Expected impact:**
- A second parent can end the emails themselves, from any one email, without logging in.
- The club's record shows "Stopped by the address owner" with the date, in place of the address. The registrar can see it
  happened but cannot undo it for them, and the address cannot be added again to that club (the form says so in plain words).
- The "tell the club" line stops depending on the club having a contact email. The button is always there.
- The privacy policy draft gets an honest sentence about other people's addresses.

**Priority:** Medium-high. Stage 3 is built and walked; this closes its main legal exposure before Stage 4 (inviting that same
address to sign in) makes the address more valuable.

**Success criteria:**
- A second parent taps Stop on any of their copies and receives nothing further from that club's sign-up emails, in any
  season.
- A first parent's copies carry no new button and read exactly as before.
- Trying to add a stopped address (family form or registrar) is refused with a plain sentence, not silently ignored.
- Nothing about receipts, refunds or the first parent's mail changes.
