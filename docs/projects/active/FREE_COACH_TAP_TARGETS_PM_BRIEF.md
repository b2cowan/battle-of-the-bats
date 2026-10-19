# Free coach tap targets — PM brief

> Hub: https://claude.ai/artifact/Rne2oGZjtLyKp2S74MXfJS · Plan: `FREE_COACH_TAP_TARGETS_PLAN.md`
> Stage 0 drawn 2026-10-19; waiting on seven owner rulings.

**What changes for the coach.** On a phone, every control a free coach taps gets at least a fingertip-sized
(44px) tap area. On Roster, Schedule and Fees (recommended option): instead of a small pencil and trash on every
row, the coach taps the row to open it, and Remove sits inside the form that opens. Fees keeps its one-tap
"Mark paid" on the row. Undoing a payment moves inside the fee as "Mark unpaid". Everywhere else nothing moves:
small links and buttons get a bigger tap area at the same type size.

**Why it matters.** The free portal is the front door to Premium, and a free coach is most likely on a phone at the
field. Today they meet 334 undersized targets across 12 screens: the smallest is a 15px Undo, and the most common is
two 38px buttons on every player. Every release sweep reports all 334 as new, which buries a real regression in noise.

**Customer impact.** Free coaches get fewer mis-taps and more room for names: a paid fee's name has 52px today.
Premium coaches see three shared screens change. Fan view on Overview and Tournaments gets a taller tap area with
about 20px more space under the card, and Announcements' subject, Refresh and Send grow to 44, clearing known paid
debt. The roster, schedule and fees help lines are rewritten.

**Priority.** Medium. Nothing is broken, but the sweep noise lands on every promote until this does. It is a small
build once ruled.

**Success criteria.** The free screens sweep clean at 361/390/768/1440, and anything left is accepted with a written
reason. The paid screens the shared parts reach sweep no worse. A coach can add, open, edit, remove and reorder a
player, an event and a fee on a 390px phone without a missed tap.
