# Chat Consistency Review: one messaging app, everywhere chat exists (a measured walk, a ladder, and the end state drawn)

> Paste into a fresh session on `dev`. Written 2026-10-18 from the owner's ask, after a second look at the tournament
> admin's Chat on a phone: *"I still don't like it, not sure why we deviated away but the chat is supposed to mimic the
> whatsapp chat functionality everywhere that it exists (home, coaches portal, tournament). can you write up a planning
> session to review all of these screens for functional consistency and make sure that they all behave as expected?"*
>
> **This session walks, measures, draws and settles rulings. It does not build.** The build prompt is written only
> after the owner rules. Follow the deep-dive pattern (memory `feedback_deep_dive_is_walk_then_stages`): a measured
> walk, a stage ladder, and the END STATE drawn in the SAME first publish, each changed part tagged with the stage
> that delivers it. Never draw an intermediate state that looks like today.

## 1 · The standard you are reviewing against

**The owner's standard is WhatsApp: chat behaves like the messaging app people already know, on every surface.** No
single ruling says "copy WhatsApp" in those words. The record is a run of owner benchmarks, all pointing one way. Cite
these as the standard's history, and decide on merit (memory `feedback_past_decisions_are_reference_not_authority`):

- 2026-06-22, Tournament Chat: on a phone "the chat was a cramped box rather than a messaging app"
  (`archive/TOURNAMENT_CHAT_PLAN.md:92`). The UX review benchmarked against "iMessage, WhatsApp, and Slack/Discord"
  (`archive/TOURNAMENT_CHAT_UX_REVIEW_KICKOFF_PROMPT.md:7`): "fills the screen like iMessage/WhatsApp" (its PM brief).
- 2026-06-24, Division rooms: the rooms list is a "full-screen slide-over on mobile (WhatsApp-style)"
  (`archive/TOURNAMENT_CHAT_DIVISION_ROOMS_PLAN.md:9`).
- Phase 3, "Conversational depth (WhatsApp parity)": "owner benchmarked our chat against WhatsApp"
  (`archive/TOURNAMENT_CHAT_PHASE3_CONVERSATIONAL_DEPTH_PLAN.md:29`).
- 2026-07-18, Unified Home R3: "Tap → conversation; back → inbox" (`memory/design_decisions.md` ~8094).
- 2026-07-22, the seam: a signed-out tap on a chat push signs in, then opens the room, "the WhatsApp model"
  (`archive/TOURNAMENT_SEAM_P1_PLAN.md:43`).
- 2026-07-31, Desktop Phase 2: the split view is full screen width because the "owner compared against WhatsApp";
  phones stay list ↔ conversation, a full swap (`archive/DESKTOP_PHASE2_ACCOUNT_CHAT_PLAN.md:18-19, 78-80`).
- 2026-09-20, coaching from a phone, A2: no masthead over an open room; the room's header carries back on the LEFT
  (`archive/COACH_MOBILE_EXPERIENCE_PLAN.md:60, 68`).

**Write the standard down as rules before you walk** (§4 asks the owner to rule them). A starting draft, to argue
with rather than adopt:

- **W1 · A phone opens on the list.** The chats you belong to, newest activity first, an unread count per row. A lone
  room may open straight into its conversation (home and the coaches portal already do).
- **W2 · Tap a row → the conversation fills the screen.** No page title band, no picker and no masthead above it. The
  app's bottom bar: decide (WhatsApp hides its tabs inside a chat; ours keep them today).
- **W3 · The conversation's header is the only chrome:** back on the left, the room's name with one line under it (who
  it reaches), its tools at the right (search; Manage for whoever moderates).
- **W4 · The composer sits on the bottom edge** and rides above the keyboard; its hint says who the message reaches.
- **W5 · A computer is the split:** the list on the left, the conversation on the right, full screen width, no back.
- **W6 · One behaviour per gesture, everywhere:** press and hold a message is the same menu on every surface (what is
  IN it varies by role, never where it lives). Reply, react, mention, search, read receipts, the unread divider and
  pins work the same on every surface.
- **W7 · One breakpoint** for list ↔ split on every surface.

## 2 · Why the organizer's Chat drifted (so the drawing does not repeat it)

- Since June the organizer's chat has opened **conversation-first**: All coaches loads at once and the rooms sit behind
  a toggle. That is the only surface that never had a list screen.
- The tournament admin redesign (Stage 5 · E11, 2026-10-10) drew the room as an **olive pill**, borrowing "the olive
  pill chooses what is read" (2026-10-07). That rule came from a walk of the club Budget's filters, not from chat. The
  drawing was "ruled as drawn". **None of Stage 5's walks (§290–§293) walked Chat**, so nobody held it beside the home
  chat or the coaches portal.
- On 2026-10-18 the owner said the phone screen "is not what chat is supposed to look like". That session read it as
  "match the Stage 5 drawing" and built it (ledger §333, **uncommitted**): it hid the conversation's header on a phone,
  framed the conversation as a card in the page margins, and moved search into the pill row. **Against the WhatsApp
  standard, two of those moved the wrong way:** the header it hid is WhatsApp's conversation header, and the shared
  panel's full-bleed phone look it overrode is WhatsApp's. The hint that names who a message reaches, and the disabled
  Send fading like every other button, stand either way. **§4 Ask 0 decides what happens to it.**
- **The lesson for this session:** a chat screen is drawn beside the OTHER chat screens, not beside its own portal's
  admin screens. The station list in §3 enforces it.

## 3 · Read first

- What exists, surface by surface. Every surface runs on the same shared conversation panel; they differ in the frame
  around it:
  1. **Home chat** (`/chat`, any signed-in member; the consumer shell, warm). WhatsApp-shaped on a phone: the list
     grouped by event, then a full-screen conversation with back, name, division line, event chip and "Event admin".
     A computer splits at 1024. Only surface with press-and-hold (Report to organizers, Mute this room).
  2. **Coaches portal, paid** (`/{org}/coaches/teams/{teamId}/chat`). Same swap below 1024: "Your chats" (STAFF and
     Closed tags, "Your other teams" divider), "‹ Rooms" back only when there are two or more rooms, the "?" at right.
     The staff room's head coach can pin and remove.
  3. **Coaches portal, free** (`/coaches/team/{id}/chat`). The same, with a waiting screen before any room exists.
  4. **Tournament admin** (`/{org}/admin/tournaments/chat`, organizers). No list screen. The admin title band, the
     olive pill (opens a rooms drawer holding New room), the conversation under it. A computer docks the rooms at left
     and switches at **900**, not 1024. No unread count per room. Manage room (members, mute, invites, reports,
     rename, close, delete) is a side panel off the title band.
- The census of differences already found (verify each before you cite it):
  - press-and-hold menu: home only;
  - delete your own message: home and coach; the organizer deletes by moderation;
  - pin and remove any message: organizer always, coach only as a staff room's head coach, home never;
  - search: the conversation header everywhere, except the organizer's phone after §333;
  - a lone room opens by itself on home and coach; the organizer always lands in All coaches;
  - unread per room: home and coach, not the organizer;
  - breakpoints: 1024 on home and coach, 900 on the organizer;
  - look: warm on home; the coaches portal is warm by its own marker; the organizer is on the admin kit.
- Plans: `PROGRAM_COACH_CHAT.md` (the live umbrella), and the archived chat plans named in §1. The tournament admin
  redesign's E11 (`archive/TOURNAMENT_ADMIN_REDESIGN_PLAN.md:2192`, hub `archive/TOURNAMENT_ADMIN_REDESIGN_HUB.html`
  ~8244, the drawing).
- Ledger: §333 (built 2026-10-18, held by Ask 0); §332 W1 (Chat's New room over the phone bar, owed, another session's
  work); §311 (closed, but chat posting "left no trace" — re-check it); the close-× follow-up for chat's panels
  (~23871).
- TODO: the Chat tab on a plan with no team chat (open owner call); F39, Chat's paywall tab on the free phone bar.
- Memory: `feedback_deep_dive_is_walk_then_stages`, `feedback_project_hub_single_artifact`,
  `feedback_mockups_as_claude_artifacts`, `feedback_always_run_design_on_mockups`,
  `feedback_clickable_design_annotations`, `feedback_portal_is_the_formatting_benchmark`,
  `feedback_push_back_by_default`, `decision_drawer_layers_form_vs_menu`, `decision_one_toolbar_rare_tools_behind_tools`,
  `decision_close_x_is_plain_glyph`, `decision_disabled_btn_face`, `feedback_qa_walkthroughs_as_checkable_artifacts`,
  `reference_hub_script_parse_trap`, `reference_artifact_publish_needs_full_read`.

**Settled — do not reopen without a new reason:** staff rooms are per team, nobody inherits staff-room history (CH-5,
2026-07-29); no chat email, push and bell only; family chat was cut; the free plan's Chat stays behind the Tournament
Plus wall (A60); a lone room opening by itself on home.

## 4 · Step 0 · Asks before the walk (put them to the owner first, with a recommendation each)

- **Ask 0 · The uncommitted §333 fix.** Recommend: **revert its phone layout** (the hidden header, the framed card,
  search in the pill row) and **keep** the hint that names who a message reaches and the disabled Send fade. They can
  ship ahead of the review; the layout would be thrown away by it. ⚠ The same screen holds another session's
  uncommitted fix (New room closing the rooms drawer and covering the phone bar, §332 W1) — keep it; commit by exact
  hunks, never the whole file.
- **Ask 1 · The standard (§1, W1–W7).** Ruled, amended or cut, rule by rule. Everything after measures against it.

## 5 · Step 1 · The measured walk (the hub's first tab)

Walk each surface at **390** and **1280** wide (and one check at **960**, inside the 900–1023 gap where the
breakpoints disagree). Use the UAT fixtures: the Plus test club's owner for the organizer, the Premium coach and a free
coach for the portal, a coach's family-side sign-in for home. Capture each station; measure in the browser.

**Stations, in the order a person meets them, every surface side by side in one row per station:**
1. Arriving: from the bottom bar's Chat tab, from a push or bell notification, from a lone room.
2. The list: what a row shows (name, last message, time, unread), grouping, ordering, empty state.
3. Opening a room: what is left above the conversation; the back path; what the bottom bar does.
4. The conversation's header: back, name, line under it, tools at right.
5. The conversation: bubbles, the unread divider, date dividers, pins, read receipts, a deleted message.
6. Press and hold a message (and right-click at a desk): what opens, for each role.
7. The composer: hint, emoji, poll, mention, reply, the keyboard on a real phone, Send's states.
8. Search: where it is, what it finds.
9. Room tools: members, mute, invites, reports, rename, close, delete, New room — whose, where.
10. Leaving: back to the list, to the portal, to the event.

Each station: *as built* (captures and numbers), *my read*, and **shape questions** (Keep · Reshape · Not yet), each
with a recommendation and what rides on it. Put a shape question beside the drawing that answers it.

**Behave as expected, too:** the owner asked for functional consistency, not only a look. At each station, post,
reply, react, mention, search and delete on every surface. A behaviour that works on one surface and not another is a
finding with its own flag. Also check a realtime message arriving while the list is open (does the row move and count
up?), and one arriving in a room you are not in.

## 6 · Step 2 · Standing back, the ladder, and the end state drawn

- **Standing back:** the rules that cut across the stations. Expect at least: one list screen for the organizer, one
  header recipe, one press-and-hold menu, one breakpoint, unread per room everywhere.
- **The ladder** (stage · covers · asks · state). Likely shape, to argue with: A the organizer's phone becomes list →
  conversation; B one header and one press-and-hold menu everywhere; C one breakpoint and the computer split
  reconciled; D the behaviour gaps the walk finds.
- **The end state drawn** at true size, one proposal screen per surface per width (before = capture, after = drawn),
  each changed part tagged A/B/C/D with a clickable note. The organizer's phone list screen and its open room are the
  two screens the owner has not seen yet; draw them first.
- **Run `/design` on the drawings before the hand-off** (memory `feedback_always_run_design_on_mockups`).
- One hub artifact: Walk · Standard · Ladder · Drawings · Plan · Brief, with a paste-back summary. Write
  `CHAT_CONSISTENCY_PLAN.md` and `CHAT_CONSISTENCY_PM_BRIEF.md` in this folder and point the TODO line at them.

## 7 · What NOT to do

- Build nothing. Not even "obvious" fixes; record them as ladder items.
- Do not draw the organizer's chat beside the admin's other screens. Draw it beside home and the coaches portal.
- Do not open with a QA walk of §333 or §332 as a gate. Link them from the hub; carry on.
- Do not change the chat engine's data, permissions or notifications in the plan unless the walk finds a behaviour
  defect that needs it — this is a review of what people see and do.
