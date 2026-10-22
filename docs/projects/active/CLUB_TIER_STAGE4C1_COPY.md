# Club Tier Stage 4c-1: the words (club's side)

> Written 2026-10-21 by `/marketing`, before any code. **Status: approved by the owner 2026-10-21** ("Go ahead"; two rows changed after /design the same day — Ends, Back link). Build from this table, not from the
> drawings, where they differ. House rules applied: sentence case, "8:00 a.m.", bare possessive ("families'"), one spelling
> (`npm run check:spelling`), "colours", and **the site carries the club's documents and never says the club is compliant**.

## Calls this table makes (read before the rows)

1. **Round 2 wins over round 1.** Round 1's "Club links" card (up to six footer links) is replaced by round 2's **Documents and
   policies** (grouped links on the About page). The editor has no "Club links" card.
2. **No meta line under "About the club".** The drawing's "A volunteer-run association since 1979" is invented; the page has none
   until a field exists.
3. **Social-link refusals name the network** ("your Facebook page"), so the reason always fits the field.
4. **A personal-looking contact address is nudged, never refused** (free-mail domains only; no guessing from names).
5. **Nothing says "approved", "verified", "compliant" or "required"** anywhere near documents. Group headings are the club's own words;
   the three suggestions are offered, not imposed.
6. **Limits proposed (builder confirms in `/db`):** notice 80 characters, notice detail 200, tagline 100 (as today), about 1000 (as
   today), contacts 12, documents 30, questions 10.

## A · The editor's header (Admin › Public site)

| Element | Copy |
|---|---|
| Page title | Public site |
| State chip | Online · Offline |
| Address row | Families see it at · `{address}` · **Copy link** · **Open** |
| Copy link, after tap | Copied (fades after two seconds) |
| Site on, owner | It is on. **Turn it off in Settings** |
| Site on, admin | It is on. The owner turns it on and off in Settings. |
| Site off, owner | Your site is off, so families can't see it. **Turn it on in Settings** |
| Site off, admin | Your site is off, so families can't see it. The owner turns it on and off in Settings. |
| Site off, Open | Absent (not disabled). Copy link stays. |
| Retired | "Your public site is online." / "…families who open it see that it isn't available." / "Preview your public page" / "Display Options" / "Save Changes" |
| Saved pill | Saved (fades). Error stays: Couldn't save your changes. Try again. |
| Loading | Loading the public site… |
| No access | Access restricted · You don't have access to the public site. Ask your organization's owner. |

## B · Home page card

| Element | Copy |
|---|---|
| Card title | Home page |
| Lead | What families see on your home page, in this order. Open now always comes first and shows only while something is open. |
| Row: Open now | **Open now** — Open tryouts and an open house-league sign-up, while they are open · right side: Always first (phone sub: Open tryouts and sign-ups) |
| Row: Teams | **Teams** — Your {n} teams in your groups, each with its tryout state · none yet: Shows once you add a team |
| Row: About the club | **About the club** — Your about text, with a way to your About page |
| Row: House league | **House league** — Your {season} sign-up and divisions · none yet: Shows once you publish a season |
| Row: Tournaments | **Tournaments** — Your upcoming tournaments · none yet: Shows once you host a tournament |
| Row: Past tournaments | **Past tournaments** — A way to your archived tournaments · none yet: Shows once you have an archived tournament |
| Switch off state line (any row) | Hidden from families |
| Switch label (screen reader) | Show {section} on the home page |
| Handle label (screen reader) | Move {section}. Hold and drag. Position {n} of {total}. |
| Locked handle label | Open now always comes first |
| Plan doesn't carry a section | Row absent. No explanation. |
| Reorder error | Couldn't save the new order. Try again. |

## C · About the club card

| Element | Copy |
|---|---|
| Card title | About the club |
| Tagline | label **Tagline** · placeholder Rep teams, ages 9 to 16 (was "Rep baseball", sport-neutral 2026-10-22) · hint One line under your name. {n} / 100 |
| About | label **About** · placeholder Who you are, who plays, and when your season runs. · hint {n} / 1000 |
| Contact | label **Families' questions go to** · placeholder info@yourclub.ca · hint Shown in your footer and on every team and tryout page. |
| Bad email | That doesn't look like an email address. |
| Past-year hint | Mentions 2025 — still true? · two years: Mentions 2024 and 2025 — still true? (amber, never blocks; any four-digit year before this calendar year, tagline and about here, the tryout blurb in 4c-2) |

## D · Social links card

| Element | Copy |
|---|---|
| Card title | Social links |
| Fields | Instagram · Facebook · X · Website |
| Placeholders | https://instagram.com/yourclub · https://facebook.com/yourclub · https://x.com/yourclub · https://yourclub.ca |
| Typed without https:// | Hint under the field: Saved as https://instagram.com/lakeshorelynx |
| Refused, per field | That isn't a web address. Paste the link to your {Instagram profile / Facebook page / X profile / website}, starting with https:// |
| Too long | That link is too long. Paste a shorter one. |
| Behaviour | A refused link is never saved and the red text stays until it is fixed. |

## E · Look card (read only)

| Element | Copy |
|---|---|
| Card title | Look |
| Lead, owner | Your logo, colours and font are set in Organization › Settings. This is how families see them. |
| Lead, admin | The owner sets your logo, colours and font in Organization › Settings. This is how families see them. |
| Summary | {Colour} and {colour} · {font name or "the default font"} |
| Readability | White text on navy, navy links. Readable on every page. |
| Platform darkened a colour | We made your gold a little darker on text and buttons so families can read it. |
| Action, owner | **Change in Settings** |
| Action, admin | The owner changes these in Settings. |

## F · Club notice card (never autosaved; it tells families)

| Element | Copy |
|---|---|
| Card title | Club notice |
| Lead | One line at the top of every public page, such as a field closure. It ends by itself. |
| Notice | label **Notice** · placeholder All fields are closed tonight (was "diamonds", sport-neutral 2026-10-22) · hint {n} / 80 |
| More detail | label **More detail** (optional) · placeholder Rain. Every game and practice tonight is cancelled. · hint {n} / 200 |
| Ends | label **Ends** · options: **Tonight** · **Tomorrow night** · **Pick a date and time** (date field, time field, default 8:00 p.m.). No "never". (Owner 2026-10-21, after /design: "Tomorrow at midnight" read as tonight; the banner's own words.) |
| Past time picked | Pick a time that hasn't passed yet. |
| Notice empty | Write the notice line first. |
| Button, nothing live | **Post notice** |
| Live state | Showing now · Posted 2:40 p.m. by the club · ends tonight |
| Buttons, live | **Update notice** · **End now** |
| Toasts | Notice posted. Families see it now. · Notice updated. · Notice ended. |
| Errors | Couldn't post the notice. Try again. · Couldn't end the notice. Try again. |
| Who | Owner and admin (as the editor). A staff member without it: the card is absent. |

### The banner families see (every public page and team page)

| Line | Copy |
|---|---|
| Heading (bold) | The notice, as written |
| Body | The detail, as written (absent if none) |
| Small line | Posted 2:40 p.m. by the club · ends tonight |
| Ends later today | …· ends 6:00 p.m. |
| Ends another day | …· ends Fri, Oct 23 at 6:00 p.m. |
| Posted on an earlier day | Posted Tue, Oct 20 at 2:40 p.m. by the club · … |
| Screen-reader name | Club notice |

The product never writes a notice for the club and never posts one by itself.

## G · Who to contact card (editor)

| Element | Copy |
|---|---|
| Card title | Who to contact |
| Lead | Up to twelve. Families see them on your About page. |
| Row | **{Role or name}** — {address} · › opens the window |
| Add | **Add a contact** |
| Window title | Add a contact · Edit contact |
| Fields | **Role or name** (placeholder Registration) · **Email** (placeholder registrar@yourclub.ca) |
| Nudge (free-mail domain only) | A role address such as registrar@ keeps working when a volunteer changes. You can use this one if you prefer. |
| Bad email | That doesn't look like an email address. |
| Limit | You have twelve contacts. Remove one to add another. |
| Buttons | Save · Cancel · Remove contact |
| Remove confirm | Remove {role}? Families will no longer see it. |
| Toasts | Contact saved. · Contact removed. |

## H · Documents and policies card (editor)

| Element | Copy |
|---|---|
| Card title | Documents and policies |
| Lead | Links to what you already publish. Families open them from your About page. |
| Row | **{Title}** — {Heading} · › opens the window |
| Add | **Add a document** |
| Window title | Add a document · Edit document |
| Fields | **Heading** (suggestions: Codes of conduct · Safety · The club; any words allowed) · **Title** (placeholder Parent code of conduct) · **Link** (placeholder https://yourclub.ca/conduct.pdf) |
| Bad link | That isn't a web address. Paste the link, starting with https:// |
| Limit | You have thirty documents. Remove one to add another. |
| Buttons | Save · Cancel · Remove document |
| Remove confirm | Remove {title}? Families will no longer see it. |
| Toasts | Document saved. · Document removed. |

## I · Questions families ask card (editor, drawn small)

| Element | Copy |
|---|---|
| Card title | Questions families ask |
| Lead | Short answers to what you get asked every spring. Up to ten. |
| Row | **{Question}** — first line of the answer · › |
| Add | **Add a question** |
| Window | Add a question · Edit question · **Question** (placeholder When do tryouts start?) · **Answer** (placeholder Tryouts run Sep 7–9. Dates are on the Tryouts page.) |
| Past-year hint | Same hint under Answer |
| Limit | You have ten questions. Remove one to add another. |
| Buttons | Save · Cancel · Remove question |
| Toasts | Question saved. · Question removed. |

## J · The About page (public) and the footer door

| Element | Copy |
|---|---|
| Footer door | **Contacts and documents** (shown only when the club has a contact, a document or a question) |
| Home About card | The about text, then a row: **About the club** › |
| Browser title | About the club · {Club name} |
| Back link | None (owner 2026-10-21: the Home tab is the way back — the 10-20 back-link rule) |
| Page title | About the club |
| About text | The club's words, as written. No meta line. |
| Section: contacts | **Who to contact** · row: role, address, Copy (icon on a phone; "Copy" on a desk) → Copied |
| Section: documents | **Documents and policies** · club's headings as bands · each link opens in a new tab · screen reader: "opens in a new tab" |
| Section: questions | **Questions families ask** · question bold, answer below |
| Section: sponsors | Absent until 4d |
| Section empty | Absent, no placeholder |
| Whole page empty (no text, contacts, documents or questions) | Not reachable (door hidden); a direct visit shows: Questions? Email the club at {address} (or the club name only if no address) |
| Site off | The same "not available" page as the rest of the site |

## K · API and system messages

| Situation | Message |
|---|---|
| Not owner or admin | Only an owner or admin can change the public site. |
| Notice too long | The notice can be up to 80 characters. |
| Detail too long | The detail can be up to 200 characters. |
| Ends in the past | Pick a time that hasn't passed yet. |
| Bad email | That doesn't look like an email address. |
| Bad link | That isn't a web address. Paste the link, starting with https:// |
| Too many | You have {n} {contacts / documents / questions}. Remove one to add another. |
| Generic | Couldn't save your changes. Try again. |

## K2 · The Public site builder's words (`/marketing` review, owner-approved 2026-10-22)

The builder's words are in `lib/public-site-words.ts` (the "builder" block) and the editor's help article
(`public-site-editor` in `lib/help-content/org.tsx`). Six changes approved and applied; a seventh was dropped on evidence.

| Where | Was | Now |
|---|---|---|
| Stock logo locked, in the window and in the server's refusal | Upgrade to {plan} to use this icon. | Upgrade to {plan} to use this logo. (one word for the thing) |
| No access to the editor | …Ask your organization's owner. | …Ask the owner. |
| Notice placeholder, help step and search text | All diamonds are closed tonight | All fields are closed tonight |
| Tagline placeholder | Rep baseball, ages 9 to 16 | Rep teams, ages 9 to 16 |
| Help: the colour sentence | a sentence says who reads what | a line tells you what colour your text and links will be |
| Help: Go live | a lime Go live button | a Go live button |
| Help: the preview | a window 1200 pixels wide or more | a computer or any wide window |
| Help: About's ready test | the questions address | the address families' questions go to |

**Dropped — apostrophes.** The four curly-apostrophe strings in the words file (the site-on and site-off hints, the
directory hint, the offline window's body) quote what families read on a club's "site isn't available" page, which is
curly and guarded by `club-stage4a-guard.test.ts`. The editor's own strings stay straight, like the rest of the product's
screens; help articles stay curly. The mix is by surface, not drift.

## L · Words that leave

Page Content · Social Links · Display Options · Show upcoming tournaments · Show past tournaments link · Save Changes · Preview your
public page · Public ledger (the admin's door becomes **Past tournaments**) · the Milton-specific placeholder text.
