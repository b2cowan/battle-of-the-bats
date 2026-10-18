# Chat Consistency — one messaging app, everywhere chat exists

**⏸ SHELVED 2026-10-18: the owner ruled `CHAT_EVALUATION.md` E1 (chat pauses).** Nothing here is built. The
standard W1–W7 and the findings stay as the reference for the future Messages screens (E2, E4); the ladder and the 13
drawing asks are not pursued.

**Walked 2026-10-18** (four surfaces, 390 · 960 · 1280 wide, in a headless browser on the dev server). **Asks 0 and 1
ruled 2026-10-18.** The end state is drawn on the hub's Drawings tab, each changed part tagged with the stage that
delivers it. Nothing here is built. The build prompt is written once the owner rules the drawings.

Hub (walk, standard, ladder, drawings, asks): https://claude.ai/artifact/HsTsarRgc4fxjtLZ8Z3DVQ. Brief: `CHAT_CONSISTENCY_PM_BRIEF.md`. Kickoff: `CHAT_CONSISTENCY_REVIEW_PROMPT.md`. Umbrella: `PROGRAM_COACH_CHAT.md`.

## 1 · The ask, and the standard as ruled

Owner, 2026-10-18, on the organizer's Chat on a phone: *"I still don't like it, not sure why we deviated away but the
chat is supposed to mimic the whatsapp chat functionality everywhere that it exists (home, coaches portal,
tournament)… review all of these screens for functional consistency and make sure that they all behave as expected."*

**Ask 0 (ruled 2026-10-18): undo §333's phone layout, keep two.** The hidden room header, the framed card and search in
the pill row were undone in the working tree the same day. The message box's hint that names who a message reaches
("Write to all coaches…", "Write to U13 Boys…") and the disabled Send button's standard fade stay. §332's fix on the
same screen (New room closes the rooms list and covers the phone bar) was left alone.

**Ask 1 (ruled 2026-10-18): the standard, adopted with the session's amendments.** Every surface is measured against it.

- **W1 · A phone opens on the list.** The chats you can open, newest activity first, an unread count per row. A lone
  room may open straight into its conversation.
- **W2 · Tap a row and the conversation fills the screen.** No page title band, no picker, no banner above it.
  **The app's bottom bar hides inside an open conversation** (ruled 2026-10-18); back returns to the list, where it is.
- **W3 · The conversation's header is the only chrome.** Back on the left, the room's name with one line under it (who
  it reaches), its tools on the right (search). **Back is always there on a phone and always goes to the list**, even
  when a lone room opened by itself. **Tapping the room's name opens its details**: who is in it, Mute, and Manage for
  whoever moderates.
- **W4 · The message box sits on the bottom edge** and rides above the keyboard; its hint says who the message reaches.
- **W5 · A computer is the split:** the list on the left, the conversation on the right, the full width beside the
  portal's own side menu, no back.
- **W6 · One behaviour per gesture, everywhere.** Press and hold a message opens the same menu on every surface (what
  is in it varies by role, never where it lives). **On a computer, right-click opens that same menu.** Reply, react,
  mention, search, read receipts, the unread line and pins work the same everywhere.
- **W7 · One breakpoint** for list ↔ split on every surface. The walk's 960 check sets the number (§3, station 3).

**Settled, not reopened:** staff rooms are per team and nobody inherits staff-room history (CH-5); no chat email, push
and the Chat tab's count only; family chat was cut; the free plan's Chat stays behind the Tournament Plus wall (A60);
a lone room opens by itself on home.

## 2 · How the walk was run

- **Fixture (dev only):** a test event, *UAT Chat Review Cup*, on the Plus test club, with two rooms (**All coaches**
  and **U13 Boys**). In them: the organizer (the Plus club's owner, shown as Ellen Park), the Premium coach (shown as
  Chris Hadley, UAT Test Team, who also has three staff rooms) and the free coach (shown as Frankie Okafor, UAT Free
  Team). Two more teams have no coach signed up ("2 not joined"). The staff room has an assistant (Nadia Ferreira).
  Seeded by a throwaway probe; the rows stay in dev so the owner can walk the same rooms.
- **Widths:** 390 × 844 (phone), 960 × 800 (inside the gap where the breakpoints disagree) and 1280 × 800.
- **Behaviour:** on every surface the walk posted, replied, reacted, mentioned, searched and deleted, and posted from
  another account while each list was open, then into a room the person was not looking at.
- **What a headless browser cannot show** (marked "check on a real phone" below): the real keyboard, an iPhone's
  zoom on a small field, and how a phone holds a hover after a tap.
- **The hub** (`CHAT_CONSISTENCY_HUB.html`, this folder) is built from `.probe/chat-review/hub.src.html` by
  `.probe/chat-review/hub-build.mjs`, which inlines the captures and renders this plan and the brief into it. `.probe/`
  is gitignored scratch: if it is gone, edit the built hub directly.

## 3 · The walk, station by station

| Station | Home | Coaches portal (paid) | Coaches portal (free) | Organizer |
|---|---|---|---|---|
| 1 Arriving | Chat tab; a push opens the room here | Chat tab; no push lands here | Chat tab; no push lands here | Chat in the admin bar; a push opens **home**, not here |
| 2 The list | Flat rows under event and team headings; time; "Organizer:" prefix; olive count | Bordered cards; Staff tag; "Your coaching staff"; lime count; no time | Same cards | **None.** All coaches opens at once; rooms behind the olive pill |
| 3 Opening a room (phone) | 602 px of conversation; bottom bar stays | 646 px; bottom bar stays | 557 px; team banner stays; **scroll defect** | 464 px; event band, Chat title and pill row above |
| 4 The header | ‹ · name · search · event chip | ‹ (2+ rooms only) · stored name · search · ? | Same | No back · name · "Every coach with a team in this tournament" · search |
| 5 The conversation | Same panel everywhere: bubbles, date and "New messages" lines, "Read by N of M", pins | Same | Same | Same, but **no "New messages" line** |
| 6 Press and hold | Report to organizers · Mute this room · Cancel | Nothing | Nothing | Nothing |
| 7 The message box | "Write a message…" | Same | Same | "Write to all coaches…" |
| 8 Search | Header magnifier; recent messages | Same | Same | Same |
| 9 Room tools | Mute via a message's hold | None | None | Manage room off the page title; New room in the pill's list |
| 10 Leaving | ‹ back to the list | ‹ back (2+ rooms) | Same | The admin bar |

**Station 3, the breakpoint check at 960:** the organizer's page splits, and its conversation is **376 px wide**,
narrower than a phone; home and both portals show one pane (the list hidden) at the same width. Home and the portals
split at 1024; the organizer at 900. At 1024 the conversation beside a side menu is about 500 px. **W7's number is
1024.**

**Behaviour that matched everywhere:** posting, replying (the quote shows), @mentions (the picker and the highlight),
search ("parking" found 2 on every surface) and read receipts.

## 4 · Findings

### F01 — A push always opens the home chat
**Today:** every chat push links to `/chat?room=…` (`lib/chat-service.ts:1575`, `:1588`), for coaches and organizers
alike. Neither portal nor the organizer's page reads a room from its address. The walk opened the push link as the
organizer: it landed in home chat. **Effect:** an organizer who taps a push lands where they cannot moderate (F02); a
coach working in the portal is taken out of it. **Proposal:** keep the landing (Ask C4) and make home complete (C3);
no notification change. **Stage:** C.

### F02 — What you can do depends on the door you came through
**Today:** the organizer is a moderator member of every room, so the same rooms show in their home chat, where a tap
gives only react and reply: no pin, remove, poll or Manage (`app/(consumer)/chat/ChatConversation.tsx:78-85`). A staff
room's head coach pins and removes in the portal, not at home. Report and Mute exist only at home; the portals pass no
press-and-hold. **Proposal:** what you can do follows who you are in the room, on every door (R2). The server already
allows it; the hosts do not pass it. **Stage:** C.

### F03 — The organizer has no list
**Today:** the page always opens All coaches (`app/[orgSlug]/admin/tournaments/chat/page.tsx:110-114`). The other
rooms sit behind the olive pill on a phone and in a docked column at a desk; neither shows an unread count, the last
message or a time (`page.tsx:367-385`, `components/chat/ChatRoomsPanel.tsx:113-146`). Every other surface has all
three. **Proposal:** the organizer's phone opens on a list; the desk column is the same list. **Stage:** A.

### F04 — Three designs for one list, two names for one room
**Today:** home lists flat rows under event and team headings (time, sender prefix, olive count, a muted bell). The
portals list bordered cards (Staff and Closed tags, "Your coaching staff", a lime count, no time, no muted bell). The
All coaches room is "All coaches" at home and "UAT Chat Review Cup — Coaches" in the portals. The organizer's rooms
list says "members"; its pill and column say "coaches". Home repeats a division room's name as its line ("U13 Boys",
"U13 Boys"). Code note: the portal's "this team first" test looks for `/coaches/teams/`, so it never matches a free
address (`components/chat/CoachChatView.tsx:108`); harmless today, since free coaches have no staff rooms.
**Proposal:** one row recipe and one name (R3). **Stage:** A.

### F05 — No list updates while you look at it
**Today:** with each list open, a message arrived in All coaches. On home, paid and free the row's last message, its
count and its place stayed as they were; only the Chat tab's badge counted up. The portals' list never fetches again,
not even after Back (`CoachChatView.tsx:110-131`); home fetches again on Back only. **Proposal:** a new message moves
its row to the top and counts it (R3). **Stage:** A.

### F06 — The organizer's open room is boxed in
**Today (phone):** the event band, the Chat title band and the pill row take 190 px above the room. The conversation
gets 464 px between its header and the message box, against 557 (free), 602 (home) and 646 (paid). There is no back.
**Proposal:** the room fills the screen (R4). **Stage:** B.

### F07 — The bottom bar stays in an open room, and hides while typing on two surfaces only
**Today:** the 72 px bar stays under every open room. While the message box has focus, home and the free portal hide
it; the paid portal and the organizer do not. **Proposal:** hidden in an open room (W2, ruled). **Stage:** B.

### F08 — The free portal: opening a room with unread messages scrolls the page under the team banner
**Today (2 of 2 opens):** the page scrolls 89 px, so the room's header (back, name, search) sits under the team banner,
and a 90 px blank band opens between the message box and the bottom bar. The jump to the "New messages" line scrolls
every scrollable container, the page's included (`components/chat/ChatPanel.tsx:509`); a comment at `:360` warns of
exactly this for another scroll. It does not show on home or the paid portal, whose pages cannot scroll there.
**Proposal:** scroll the message list only. A defect: it can ship ahead of the rest. **Stage:** B.

### F09 — A banner over an open room on two surfaces
**Today:** the paid portal hides the team banner at 640 and under but shows it from 641 to 900; the free portal keeps
it (89 px). **Proposal:** nothing above an open room on a phone (W2). **Stage:** B.

### F10 — Four header recipes
**Today:** home: ‹ (40 px), name, search, an event chip (28 px, no accessible name on a phone); the organizer at home
also gets "Event admin" (28 px, no accessible name). Portals: ‹ (44 px) only with two or more rooms, the stored name,
search, "?" (32 px); the "Rooms" word beside ‹ is hidden at every width it shows. Organizer: no back; the name over
"Every coach with a team in this tournament" in code type; search; Manage room sits on the page title above.
**Proposal:** one header (R4). **Stage:** B.

### F11 — A message's buttons float over the message above it
**Today:** tapping a message shows react and reply (plus delete for your own, pin and remove for a moderator) in a
cluster above the bubble, covering the words of the message above. The same cluster shows on hover, and that hover
rule is not limited to devices that can hover (`components/chat/ChatPanel.module.css:472-497`), so on a phone a
message can keep its buttons up after another is tapped (seen in the walk; check on a real phone). **Proposal:** a
tap does nothing; press and hold opens one menu (R5). **Stage:** C.

### F12 — Press and hold means three different things
**Today:** at home, holding a message (or right-clicking it) opens Report to organizers · Mute this room · Cancel, with
no reply, react or delete. On the organizer's page and both portals, holding does nothing and right-click opens the
browser's own menu. Mute is a room setting, kept in a menu about one message. **Proposal:** one menu (R5); Mute moves
to room details (R6). **Stage:** C.

### F13 — The message box's text is 14 px
**Today:** an iPhone zooms the page when a field under 16 px is tapped, and the app does not prevent it
(`app/layout.tsx:50-59`; the box at `ChatPanel.module.css:792`). Every surface. Check on a real iPhone.
**Proposal:** 16 px. **Stage:** B.

### F14 — The organizer gets no "New messages" line
**Today:** the page passes no unread count to the conversation (`ChatPanel.tsx:496-500`), so an organizer coming back to
a busy room has no marker for where they left off. **Proposal:** the same line as every other surface. **Stage:** A.

### F15 — The reply quote is a heavy box
**Today:** every reply carries a grey box with a 2 px near-black border, on every surface. WhatsApp's quote is a tinted
strip with a coloured edge and the sender's name. **Proposal:** the tinted strip. **Stage:** C.

### F16 — Room tools live in three places
**Today:** the organizer's Manage room is a button on the page title; home's Mute is inside a message's hold; the
portals have no Mute, no Report and no members list. **Proposal:** tap the room's name to open its details (W3, R6).
**Stage:** C.

### F17 — Enter sends on a phone
**Today:** the return key sends (`ChatPanel.tsx:1272`). In WhatsApp the return key adds a line on a phone and the Send
button sends. **Proposal:** Ask B3. **Stage:** B.

### F18 — Two loose ends
**Today:** a poll's push carries no link and opens the home page (`chat-service.ts:2092-2100`, `public/sw.js:288`). A
signed-out coach opening the paid portal's Chat is sent to the portal's front page after signing in, not back to Chat
(`app/[orgSlug]/coaches/layout.tsx:79`). **Proposal:** both open the room. **Stage:** D.

### F19 — Two breakpoints
**Today:** 900 on the organizer's page, 1024 on home and the portals. At 960 the organizer's conversation is 376 px
wide; the others show one pane. **Proposal:** 1024 everywhere (W7). **Stage:** D.

### F20 — The portal's list column is too narrow at a desk
**Today:** at 1280 the paid portal's list column is 264 px, and room names wrap to two lines inside their cards.
**Proposal:** the list column matches home's (300 to 400 px) once its rows are the shared row. **Stage:** D.

## 5 · Standing back: the rules that cut across the stations

- **R1 · One chat, four doors.** The same three parts on every door: the list, the open room, and the room's details.
  A door decides which rooms are listed and the colours around them, nothing else.
- **R2 · What you can do follows who you are in the room.** A moderator moderates on every door; a staff room's head
  coach pins on every door; everyone can reply, react, delete their own and mute on every door, and everyone who does not moderate can report.
- **R3 · One list row, and a live list.** Avatar, the room's one name, time, the last message with its sender, the
  unread count; Staff and Closed tags; a muted bell. A new message moves its row to the top and counts it.
- **R4 · One open room on a phone.** It fills the screen. Header: ‹ · avatar · name over one line (who it reaches) ·
  search. Nothing above it and no bottom bar; the message box on the bottom edge, 16 px, a hint naming who it reaches.
- **R5 · One message menu.** Press and hold (phone), right-click or the hover ⌄ (computer) opens a row of reactions,
  then Reply · Copy · Pin (moderators) · Delete (your own) or Remove (moderators) · Report (someone else's, for
  anyone who does not moderate; a moderator removes instead). A tap does nothing.
- **R6 · One room-details screen.** Tap the room's name: who is in it, Mute notifications, and for a moderator the
  coaches not yet joined (copy their sign-up link), reports to review, Rename, Close and Delete. The organizer's
  Manage room becomes this screen.
- **R7 · One breakpoint, 1024.** Below it, list ↔ room; at 1024 and over, the split, full width beside the side menu.

## 6 · The ladder

Each stage changes one part of the app on **all four doors at once**, so no stage leaves the surfaces more different
than it found them. (The kickoff's draft built the organizer's phone first; built alone, that would have added a
fourth list design before the shared row existed.)

| Stage | Covers | Asks | State |
|---|---|---|---|
| **A · One list** | One row recipe and one room name on every door; the list stays live; the organizer's phone opens on a list and its desk column becomes that list; the organizer's "New messages" line; New room on the organizer's list (F03, F04, F05, F14) | A1–A4 | Drawn 2026-10-18 |
| **B · One open room** | Fills the phone screen on every door; one header with back always; no banner, title or pill above; bottom bar hidden; the message box on the bottom edge at 16 px with a "Write to…" hint everywhere; the return key on a phone; the free portal's scroll defect (F06–F10, F13, F17) | B1–B3 | Drawn 2026-10-18 |
| **C · One message menu, one room details** | Press and hold, right-click and the hover ⌄ open one menu; a tap does nothing; what you can do follows your role at home too; Mute, Report and Manage live in room details; the lighter reply quote (F01, F02, F11, F12, F15, F16) | C1–C4 | Drawn 2026-10-18 |
| **D · One computer split, and the loose ends** | 1024 everywhere; the organizer's split is list, room and a details panel; the portal's list column; a poll's push and the portal's sign-in both open the room (F18, F19, F20) | D1–D2 | Drawn 2026-10-18 |

**Recommended build order:** A, B, C, D. **F08 can ship first on its own**: it is a one-place defect in the shared
conversation, and free coaches meet it every time a room has unread messages.

## 7 · The end state, screen by screen

Drawn at true size on the hub's Drawings tab: before (a capture from the walk) beside after (drawn), every changed
part tagged A, B, C or D with a note behind it.

- **Organizer, phone:** the list (new), then the open room filling the screen.
- **Home, phone:** the list (one name; live), the open room (bar hidden, the event link moved to details).
- **Coaches portal (paid and free), phone:** the list as rows, not cards; the open room with nothing above it.
- **Every door:** the message menu (press and hold) and room details (tap the name), each with the organizer's extra
  rows marked.
- **Computer:** the organizer's split with details as a right-hand panel; home; the paid portal; the free portal.
- **Formatting check (the design review, 2026-10-18):** fourteen fixes applied to the drawings before the hand-off,
  listed at the foot of the hub's Drawings tab. They are proposals until the drawings are ruled; none went into the
  design log.

## 8 · Asks for the owner (each beside the drawing that answers it)

- **A1 · The organizer's list keeps the event band** (which event, and the switcher) and a "Chat" title row holding
  ＋ New room and "?". *Recommended.* What rides on it: the admin's event context stays one tap from the switcher.
- **A2 · "Not joined" lives in the room's line and its details**, not on the list row ("3 members · 2 not joined", the count as the amber waiting pill).
  *Recommended.* Two counts on one row compete; the unread count is the one a row exists for.
- **A3 · One name: "All coaches"**, with the event as its heading at home and its line in the portals.
  *Recommended.*
- **A4 · Each door keeps its grouping** (home by event and team; the portal: this team, its events, then your other
  teams; the organizer: this event's rooms) with one row recipe. *Recommended.*
- **B1 · "?" moves from the room's header to the list's title row.** *Recommended.* The header keeps its tools to
  search.
- **B2 · The event chip and "Event admin" leave the header for room details** ("Open the event", "Manage in event
  admin"). *Recommended.*
- **B3 · On a phone the return key adds a line; Send sends.** At a computer Enter still sends. *Recommended.*
- **C1 · The menu holds:** reactions, Reply, Copy, Pin (moderators), Delete (your own) or Remove (moderators), Report
  (someone else's, for anyone who does not moderate). *Recommended.* Copy is new.
- **C2 · A tap on a message does nothing; the floating buttons go.** *Recommended.* Swipe to reply is "Not yet".
- **C3 · What you can do follows your role on every door** (R2). *Recommended.* No permission change; the server
  already allows it.
- **C4 · A push still opens the home chat.** *Recommended.* With C3 nothing is missing there, and the seam (sign in,
  then the room) already works.
- **D1 · 1024 everywhere.** *Recommended.* Measured: at 960 the organizer's conversation is 376 px.
- **D2 · At a computer, room details open as a panel to the right of the conversation**, as WhatsApp's desktop does,
  not a separate page. *Recommended.*

**Not yet:** searching older messages (search reads the loaded messages today, the same on every surface); swipe to
reply; a typing indicator; editing a message.

## 9 · What this plan does not change, and the risks

- **No data, permission or notification change.** C3 uses permissions the server already enforces; C4 keeps every
  push's link. The two link fixes in D are the only notification-adjacent change, and both make an existing link open
  the room it names.
- **The shared conversation panel changes once per stage for four surfaces.** Each stage is walked on all four.
- **Demo sandboxes:** the build fails if a tour anchor disappears; check the coach and tournament tours' chat stops at
  build time (the organizer's chat changes shape in A).
- **Help content:** the chat guides on every door change (`/docs` after each stage).
- **Real-phone checks owed:** the iPhone zoom (F13), the sticky hover (F11), the keyboard riding the message box (W4).

## 10 · Related records

- Ledger **§333** (held; Ask 0 ruled: layout undone, hint and fade kept), **§332 W1** (New room over the phone bar;
  untouched), **§311** (chat posting "left no trace": this walk posted, replied, reacted and mentioned on every surface,
  in the test event above).
- TODO: the close-× follow-up for chat's panels (room details uses the plain ×); the Install banner over chat's confirm
  windows; F39 (Chat's paywall tab on the free phone bar); the Chat tab on a plan with no team chat (open owner call).
