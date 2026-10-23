# Club Tier Stage 4d: the words (club's sponsors)

> Written 2026-10-23 by `/marketing`, before any code. **Status: approved by the owner 2026-10-23 ("yes", including the three calls at the end of the chat: past last day allowed, editor row renamed "Contacts, documents and sponsors", alt text by layout).** Modelled on
> `CLUB_TIER_STAGE4C1_COPY.md`; where a row there already settled a sentence (the link refusal, the remove ask, the
> full-list line), this table reuses it word for word so the four lists read alike. House rules applied: sentence case,
> "Dec 31, 2027" dates, one spelling (`npm run check:spelling`), "mark required, not optional" (no "(optional)" tags),
> and **nothing on the About page says "approved", "verified", "certified", "compliant" or "player"**.
> Gate asks ruled 2026-10-23 ("yes to all"): name required; logo, link and last day optional; the last day is a whole
> day, inclusive; an ended sponsor leaves the public pages and stays in the editor; the strip is on the home page only,
> plus an About section; cap 20; no reordering (new sponsors go at the end); the logo is re-saved safely on upload.

## Calls this table makes (read before the rows)

1. **One name, "Sponsors", on every public surface.** The 2026-10-19 drawing headed the home strip "Our sponsors". This
   table drops "Our" so the home strip, the About section and the editor card are all **Sponsors** (the owner's word for the
   public side). Nothing says "partners", "supporters" or "backers".
2. **The editor must not borrow the coach money book's words.** No "sponsorship", "invoice", "amount", "paid" or
   "arrival" anywhere in this table. A club sponsor here is a name on a wall, not a payment.
3. **No "(optional)" tags.** Name is the only required field, so it alone carries the required marker. Logo, Link and Last day
   are plain; their hints say what happens when they are left empty.
4. **A past last day is allowed, not refused.** Picking yesterday simply makes the sponsor "Ended". Refusing it would
   stop a club from entering last year's sponsor to renew later. (The notice refuses a past time because it tells families
   something is happening now; a sponsor tells them nothing.)
5. **The logo's alt text depends on whether the name is also on screen.** On the strip, where a logo stands alone, its alt
   text is the sponsor's name. On the About page, where the name is written beside the logo, the alt text is empty (the
   logo is decoration), so a screen reader does not read the name twice. A sponsor with no logo shows the name as text.
6. **One deliberate rename to decide, in the editor only.** The builder's fourth row is called "Contacts and documents"
   and already leaves out questions. Putting sponsors under that name makes the preview say "Change in Contacts and
   documents" when you click the sponsor strip. Recommended: rename that **editor row** to **Contacts, documents and
   sponsors**. The public footer door keeps **Contacts and documents** (a sponsor alone does not open the About page, so
   that label stays true).

## A · The Sponsors card (editor, Admin › Public site)

| Element | Copy |
|---|---|
| Card title | Sponsors |
| Lead | The businesses and people who back your club. Families see them at the bottom of your home page and on your About page. Up to twenty. |
| Row | **{Name}** · sub: **Until {Dec 31, 2027}** (has a last day) · **No last day** (has none) · › opens the window |
| Row, ended | **{Name}** · quiet grey **Ended** pill (owner 2026-10-23 after /design: the over-and-done pill, not amber; amber is for what waits) · sub: **Last day was {Dec 31, 2026}** · the row dims |
| Add | **Add a sponsor** |
| Limit | You have twenty sponsors. Remove one to add another. |
| Empty | No sponsors yet. (the card shows only its title, lead and Add) |
| The row's summary, closed card | {n} sponsors · {n} ended, for example **3 sponsors · 1 ended**; one sponsor: **1 sponsor**. Joined with the other lists' counts: **2 contacts · 3 documents · 3 sponsors**. None at all: **Optional · none yet** (unchanged) |
| Editor row name (call 6) | Contacts, documents and sponsors |
| Toasts | Sponsor saved. · Sponsor removed. · Logo removed. |
| Save failed | Couldn't save your changes. Try again. (unchanged) |

## B · The sponsor window

| Element | Copy |
|---|---|
| Window title | Add a sponsor · Edit sponsor |
| Name | label **Name** (required marker) · placeholder Riverside Dental |
| Logo | label **Logo** · see the logo box below |
| Link | label **Link** · placeholder https://riversidedental.ca · hint Families who tap the sponsor go here. |
| Last day | label **Last day** · hint Families see the sponsor through this day, then it leaves by itself. Leave it empty to keep it up. |
| Window, sponsor has ended | A line above the fields: **This sponsor has ended, so families no longer see it. Pick a later last day to bring it back.** |
| Buttons | Save · Cancel · Remove sponsor |
| Remove confirm, no logo | Remove {name}? Families will no longer see it. |
| Remove confirm, has a logo | Remove {name}? Families will no longer see it, and its logo is deleted. |
| Keep button | Keep it |

### The logo box

| State | Copy |
|---|---|
| Empty | Button **Upload a logo** · hint JPG, PNG or WebP, up to 2 MB. Without a logo, families see the name. |
| Filled | The logo, then **Replace logo** · **Remove logo** (owner 2026-10-23: not a bare "Remove", the window also ends with Remove sponsor) |
| Uploading | Uploading… (button disabled, no hint change) |
| Wrong type | That file isn't a JPG, PNG or WebP image. Choose a different one. |
| Too big | That file is over 2 MB. Choose a smaller one. |
| Can't be read | We couldn't read that image. Try a different file. |
| Upload failed | Couldn't upload the logo. Try again. |
| Behaviour | A refused file is never kept. The red line stays under the box until a good file is chosen or the window closes. |

## C · Refusals (the window says them, the server says them the same way)

| Situation | Message |
|---|---|
| No name | Add the name first. (the existing "Add the {field} first." form) |
| Name too long | The name can be up to {max} characters. |
| Bad link | That isn't a web address. Paste the link, starting with https:// (unchanged) |
| Link too long | That link is too long. Paste a shorter one. (unchanged) |
| Bad last day | That isn't a date. Pick the last day from the calendar. |
| Logo address not ours | That logo didn't come from here. Upload it again. |
| Too many | You have twenty sponsors. Remove one to add another. |
| Not owner or admin | Only an owner or admin can change the public site. (unchanged) |
| Generic | Couldn't save your changes. Try again. (unchanged) |

## D · What families see

| Element | Copy |
|---|---|
| Home strip heading | **Sponsors** |
| Home strip, each sponsor | The logo alone (alt text: the name), or the name as text when there is no logo. With a link, the whole item is the link, opens in a new tab, and says to a screen reader: "{name}, opens in a new tab". |
| Strip, nothing to show | Absent. No heading, no placeholder. |
| Strip, where | Home page only, below the sections and above the footer. Not on team, tryout, Teams, league or tournament pages. |
| About section heading | **Sponsors** |
| About section, each sponsor | The logo (empty alt text) beside the name, as one link when there is a link, opening in a new tab ("{name}, opens in a new tab" to a screen reader). |
| About section, nothing to show | Absent, no placeholder. |
| Screen-reader name of both | Sponsors |
| Ended sponsor | Gone from both places the day after its last day. Nothing says "ended" to families. |
| About page's door | Unchanged. A club with only sponsors has a strip and no About page; the footer door stays **Contacts and documents** and shows only for a contact, a document or a question. |

## E · Words that leave or are never used

"Our sponsors" (the drawing's strip heading) · "Sponsorship", "amount", "invoice", "paid", "arrival" (the coach money book's words) ·
"partners", "supporters", "backers" · "tier", "gold", "silver" (no tiers) · "expired" (the editor says **Ended**) · "(optional)" tags.

## F · For `/docs`, not decided here

The `public-site-editor` help article, its `keywords` and `searchText`, and any hub checklist line need the Sponsors card
and the renamed row. Suggested search words: sponsors, logo, thank you, strip, last day.
