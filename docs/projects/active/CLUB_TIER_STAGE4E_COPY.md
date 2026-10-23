# Club Tier Stage 4e: the words (a club's own web address)

> **Written 2026-10-23 by `/marketing`, from the ruled drawings** (`CLUB_TIER_STAGE4E_DRAWINGS.html`, frames a–h, the share
> census, the build notes) **and the build prompt's seven rulings.** Draft for the owner's read. **Nothing here is code;**
> the build takes its strings from this file and from nowhere else.
>
> **How to read it.** Each block is the exact text a customer reads. `{curly}` is a value the product fills in
> (`{address}` = `www.lakeshorelynx.ca`, `{bare}` = `lakeshorelynx.ca`, `{club}` = the club's name, `{owner}` = the owner's
> name, `{date}` = a date like "May 9, 2027", `{time}` = a time like "2:14 p.m."). Backticked text is a value or a record
> the customer copies, never prose. Lines marked **NEW** were not drawn and are written here for the first time.
>
> **House rules applied to every line.** Sentence case. "8:00 a.m." (lowercase, periods). A name ending in s takes the bare
> apostrophe (FieldLogicHQ's). Never "DNS" on its own: where it must appear (it is the word the club will see at the place it
> bought the address) it comes with *where*. One spelling per word. A button says what happens. No system words, no codes.
> **Timing never promises more than:** "often minutes once both records are in; it can take up to two days."

---

## 0 · Four things for the owner before the build reads this

1. **The drawing promised checks the build does not make.** Frame g3 said "We check every few minutes", and the waiting
   frames said "every few minutes". The build prompt's status job reads a waiting connection every 15 minutes and a
   *connected* one **once a day**. So I wrote "every 15 minutes" while waiting, and "every day" everywhere after it connects
   (truth rule: copy says only what ships).
   **I disagree with the once-a-day check for record 2.** If a volunteer deletes it, the club's whole site, and with it
   every poster, is dead until the next daily tick: up to a day, and the email "at once" is really "on the next check". Record 2 is one
   lookup per connected club. **Recommendation: look at record 2 every hour, keep record 1 daily.** If you agree, g3 and the
   fourth email say "every hour"; as written they say "every day" and "when we noticed".
2. **The drawings left four things unwritten.** The "Use a name other than www" link and what opens under it; the
   refusals for a failed connect; the live-region texts a screen reader hears; the two tournament screens' fixed text. All
   written below, marked **NEW**.
3. **Five names for one thing became two.** *Web address* is the row, and the Settings field keeps it. *Your own address* is
   what the customer calls the connection, in every sentence, every button and every window. "The club's address" appears
   only where a third person is speaking (an admin's view, a family's page).
4. **Two phrasings reconciled.** Frame e said "Not forwarding to www yet"; ask 3 said "Not forwarding yet". The shorter one
   wins: **Forwards to www** and **Not forwarding yet**.

---

## 1 · The names

| Thing | The words |
|---|---|
| The row on Public site | **Web address** |
| The Settings field | **Web address** (unchanged) |
| The connection, in a sentence | **your own address** (owner view) · **the club's own address** (an admin's or a family's view) |
| The address FieldLogicHQ gives every club | **the FieldLogicHQ address** only when contrasting two addresses; otherwise just the address, `fieldlogichq.ca/lakeshore-lynx` |
| The two things to copy | **records** (never "DNS records" on its own: see the one place below) |
| Record 1 | **Padlock check** |
| Record 2 | **Your site** |
| Where the club bought it | **where you bought {bare}** (never "registrar" on a screen) |

---

## 2 · The row's states: the chip and the closed summary

A status is said once, by the chip. The summary under the title is only ever an address.

| State | Chip | Closed summary |
|---|---|---|
| Not connected, or stopped | none | `fieldlogichq.ca/{slug}` |
| Typing / loading the records | none | `fieldlogichq.ca/{slug}` while typing, `{address}` once loading |
| Waiting for the records | **Waiting** | `{address}` |
| Connected | none | `{address}` |
| Needs attention (padlock record gone) | **Needs attention** (amber) | `{address}` |
| Gave up after two days | **Not connected** (amber) | `{address}` |
| Held by another service | none | `fieldlogichq.ca/{slug}` |
| Not working (record 2 gone) | **Not working** (red) | `{address}` |

**Page header** ("Families see it at"): the club's address while **connected or needs attention**, the FieldLogicHQ address
otherwise. Buttons unchanged: **Copy link**, **Open**.

---

## 3 · Frame a: the door

**Open, owner**
- Fact label: **Families find your site at** → `fieldlogichq.ca/{slug}`
- Hint: **Change the last part in Settings.** ("Settings" is a link.)
- Block title: **Your own address**
- Body: **If your club owns an address like www.lakeshorelynx.ca, families can find this site there instead. It costs nothing extra. You will need the sign-in for the place you bought it, such as GoDaddy or Namecheap.**
- Button (outline): **Use your own address**

**Open, admin who is not the owner** (no button, not even a faded one)
- Fact label: **Families find your site at** → `fieldlogichq.ca/{slug}`
- Hint: **The owner can connect the club's own address, like www.lakeshorelynx.ca.**

**Visibility** loses its "Web address · Change it in Settings" line. Nothing replaces it.

---

## 4 · Frame b: typing the address

**The field**
- Label: **Your own address**
- Prefix (fixed, can't be deleted): `www.`
- Placeholder: `lakeshorelynx.ca`
- Hint: **Type the rest of your address. We show you how to send people who leave off www.**
- Quiet link under the field: **Use a name other than www** (**NEW**, see §4a)
- Replace warning (triangle): **If a website already lives at this address, this site replaces it once you add the records.**
- Buttons: **Cancel** · **Next**

**While the records load** (about ten seconds)
- Loading line: **Loading your two records…**
- **Next** fades; **Cancel** stays.

**A pasted link is cleaned without a word** (`https://WWW.LakeshoreLynx.ca/home` becomes `lakeshorelynx.ca`). No message.

### 4a · A name other than www (**NEW**)
- Link: **Use a name other than www**
- Opens the prefix as typeable. Placeholder: `teams.lakeshorelynx.ca`. Label stays **Your own address**.
- Hint: **Type the whole name, like teams.lakeshorelynx.ca. Use this when your club keeps its own website at www.**
- Replace warning becomes: **If something already uses this name, this site replaces it once you add the records.**
- Back link: **Use www instead**
- The forwarding box (§5) does not appear for any name but www.

### 4b · The refusals (each on **Next**, never while typing; the field takes the error state)

| When | The words |
|---|---|
| One of ours (`fieldlogichq.ca`, `.com`, any subdomain) | **That is FieldLogicHQ's address. Type the address your club bought, like lakeshorelynx.ca.** |
| Not a web address | **That is not a web address. It looks like lakeshorelynx.ca, with no spaces.** |
| Held by another club | **Another club on FieldLogicHQ uses this address. If it is yours, write to us from Help and we will sort it out.** |
| The demo club | **The demo club can't use its own address. Your club can, from this row.** |
| **NEW** · Another name is open and only the bare name was typed | **Add a name in front, like teams.lakeshorelynx.ca. The bare name can only forward.** |
| **NEW** · The club already has an address connected | **This club already has an address. Stop using it first, then connect a new one.** |
| **NEW** · A connection could not be started (any failure on our side) | **We couldn't start the connection. Nothing was changed. Try again in a few minutes.** |
| **NEW** · We have reached our limit of addresses | **We can't add another address right now. Write to us from Help and we will sort it out.** |
| **NEW** · The server is asked by someone who is not the owner (never shown; the button is absent) | **Only the owner can connect an address.** |

**Held by another service** (frame g2: shows right after **Next**, before any record; no chip)
- Title: **Another website service still has this address.**
- Body: **{address} is still set up with a service you used before, such as an old website builder. Remove it from that service's domain settings, then press Try again. Nothing has changed on your site.**
- Buttons: **Cancel** · **Try again**

---

## 5 · Frames c and d: the two records, and the waiting

**Lead line** (above the cards)
- **Add these two records where you bought {bare}. Sign in there and look for a setting called DNS, DNS records or Manage DNS.**
  *(The one place "DNS" appears: it is the word the club will see at the place it bought the address, and the sentence says where.)*

**Record 1 card**
- Number and title: **1 · Padlock check**
- Chip: **Not seen yet** · **Found** · **Missing**
- Labels: **Type** · **Name** · **Value**
- Why line: **Lets the certificate issuer confirm the address is yours, so your site has its padlock. Keep it for good: the padlock renews only while this record is there.**

**Record 2 card**
- Number and title: **2 · Your site**
- Chip: **Not seen yet** · **Points elsewhere** · **Missing**
- Labels: **Type** · **Name** · **Value**
- Why line: **Sends visitors to your site. If www already has a record (your old website), delete that one first.**
  *(For another name: "If {name} already has a record, delete that one first." `{name}` = `teams`.)*
- Note under the card: **Value provisional** (clickable, clears when the proof settles record 2's value; not shipped to a customer)

**Copy buttons.** At a desk: **Copy** (word and icon) on every Name and Value. On a phone: the symbol alone.
After a press the button reads **Copied** for two seconds, then returns.

**Under the cards, once**
- **Some places want the whole name, like `www.lakeshorelynx.ca`. If yours adds `lakeshorelynx.ca` by itself, type only the part shown.**

**Copy both as a message**
- Button (keeps its words on a phone): **Copy both as a message**
- Beside it: **For whoever looks after {bare}.**
- After a press: **Message copied**

**The forwarding box** (www only)
- Title: **And {bare} on its own?**
- Body: **Set it to forward to `https://{address}`, where you bought it. It is usually called Forwarding or Redirect, and it is free at most places.**
- Links line: **How to:** GoDaddy · Namecheap · Hover · Other places
- Hint: **If the place offers an ALIAS or ANAME record, the help article shows that route instead.**

**Reassurance**
- **Your email at {bare} is not affected. Change nothing else there.**

**The checking status**

| Situation | Title | Line |
|---|---|---|
| Just started | **Checking for your records** | **We look again every 15 minutes and email you when your site is live. Often that is minutes after both records are in. It can take up to two days. You can leave this page.** |
| Record 1 in, record 2 still the old website | **Checking for your records** | **Record 1 is in. Record 2 still sends people to your old website.** |
| **Check now** running | **Checking for your records** | **We look again every 15 minutes and email you when your site is live.** |
| Still waiting after a day | **Still waiting after a day** | **Record 1 is in. Record 2 is not yet. Check that it is saved exactly as shown. We keep looking until {weekday} at {time}.** |
| Admin who is not the owner | **Checking for your records** | **We look again every 15 minutes.** |

- Amber line under record 2 when it still points at the old website: **We see `www → {whatWeSee}`. Change it to `sites.fieldlogichq.ca`, or delete it and add the record above.**
  *(`{whatWeSee}` is a name like `ghs.googlehosted.com`. For another name: the left side reads `{name} → …`.)*
- **NEW** · If we cannot look just now: **We couldn't look just now. Try again in a minute.**

**Foot**
- **Last checked {time}** · button **Check now** (a phone: the symbol alone, accessible name **Check now**)
- While running, the button fades and reads **Checking…**
- Check now never says the site is live. It only updates the two cards.

**Owner's rare door** (ends the body, ghost button): **Cancel and start over**

**Admin who is not the owner**
- Sees the same cards, the copy buttons, the hint, the forwarding box and the reassurance.
- Sees **no** "Copy both as a message" and **no** "Cancel and start over".
- Sentence at the end of the body: **The owner connects and removes the address.**

### 5a · What "Copy both as a message" copies

Plain text, so it survives any email program or text message. Straight apostrophes on purpose.

```
Hi, could you add two records to {bare} where it is registered?
{club}'s website is moving to {address}.

1. Type CNAME
   Name  {record1Name}
   Value {record1Value}
   Keep this one for good. It renews the site's padlock.

2. Type CNAME
   Name  www
   Value sites.fieldlogichq.ca
   If www already has a record, delete that one first.

Then set {bare} (without www) to forward to https://{address}.
Please don't change anything else. Email keeps working.
How-to: fieldlogichq.ca/help/own-address

Thanks!
{owner}
```

- For another name (**NEW**): record 2's Name is `{name}`; its last line reads "If {name} already has a record, delete that one first."; the paragraph starting "Then set" is left out; the opening reads "{club}'s website is moving to {address}."
- The help link is provisional until the help article exists.

---

## 6 · Frame e: connected

**Open, owner and admin** (facts stack, label above value)
- **Families find your site at** → `{address}` + chip **Connected**
- **The old address** → `fieldlogichq.ca/{slug}` **forwards here**
- **{bare}** → **Forwards to www** · or · **Not forwarding yet** · **How** (a link)
- **Padlock** → **Renews by itself before {date}**
- Hint: **Keep both records where you bought {bare} for as long as you use this address. We check them every day.**
- Disclosure: **Show the two records**
- Owner's rare door (ends the body): **Stop using your own address**
- Admin: the same facts, the hint and the disclosure, then **The owner connects and removes the address.** No Stop door.

*(A club on another name has no "{bare}" fact; the line is left out.)*

**The preview strip** (a padlock icon before the address): `{address}`. Shown only while connected.

**Page notice, once, when it goes live** is not shown in the product; the owner is emailed (§11).

---

## 7 · Frames f and g: when something is wrong

### f · Needs attention (the padlock record is gone; amber; the site still works)
- Title: **The padlock check record is gone.**
- Body: **Your site still works today, but its padlock cannot renew without it. Put record 1 back where you bought {bare} before {date}, or visitors will see a security warning instead of your site. We noticed on {noticedDate} and emailed {owner}. This clears by itself once the record is back.**
- Record 1 card with chip **Missing** (the lead line is not repeated)
- Hint under it: the "whole name" hint from §5
- Foot: **We check every day. Last checked {time}** · **Check now**
- Owner's rare door: **Stop using your own address**

### g1 · Checking gave up after two days (amber chip **Not connected**; the site still works at its FieldLogicHQ address)
- Title: **We stopped checking after two days.**
- Body: **Record 1 was found. Record 2 never was. Check it is saved exactly as shown where you bought {bare}, then press Try again. The records stay the same.**
  *(Variants, same title, by what we saw: neither found — "Neither record was found."; record 2 found only — "Record 2 was found. Record 1 never was."; record 2 points elsewhere — "Record 2 still sends people to your old website. Change it to `sites.fieldlogichq.ca`, then press Try again.")*
- Cards with their chips; the "whole name" hint
- Primary button: **Try again**
- Owner's rare door: **Use a different address**

### g3 · Connected, then record 2 was removed (red chip **Not working**)
- Title: **{address} is not reaching your site.**
- Body: **Record 2 was changed or removed where you bought {bare}. Anyone who uses that address sees an error until it is back. Until then, every link we hand out uses `fieldlogichq.ca/{slug}`, which works. We emailed {owner} when we noticed, {time}; this clears by itself once record 2 is back.**
- Record 2 card with chip **Missing**; no record 1 card
- Foot: **We check every day. Last checked {time}** · **Check now** *(see §0, item 1: "every hour" if you take the recommendation)*
- Owner's rare door: **Stop using your own address**

*(Admin view of f, g1 and g3: the same warning, cards and Check now, then **The owner connects and removes the address.** No Try again, no Stop, no Use a different address.)*

---

## 8 · Frame h: stop

**The question window** (no ×; a tap outside means Keep it; buttons only, at the right)
- Title: **Stop using {address}?**
- Body: **Your site goes back to `fieldlogichq.ca/{slug}` at once, and links and posters with {address} stop working. For up to two years, browsers that visited it will open {address} only with a padlock, so whatever you put there next needs one too.**
- Buttons: **Keep it** (outline) · **Stop using it** (red)

**After** (a page notice that fades)
- **Your site is back at `fieldlogichq.ca/{slug}`. You can delete the two records where you bought {bare}.**

**Cancel and start over** (while waiting) has no window. It acts at once and the row returns to frame a, with no notice.

---

## 9 · Elsewhere: the words that change because the address did

### Settings · the Web address field (owner only)
- Hint, not connected: **Only lowercase letters, numbers, and hyphens. Changing it breaks existing links.** *(unchanged)*
- Hint, while connected: **Only lowercase letters, numbers, and hyphens. Links to {address} keep working if you change it. Links to `fieldlogichq.ca/{slug}` stop.**
- The warning under the field once it is changed, while connected (**NEW**): **Changing your web address immediately breaks every link that uses fieldlogichq.ca/{slug}. Links to {address} keep working.**

### The two screens that wrote `fieldlogichq.ca/` as fixed text (**NEW**)
Today these say the first part of every tournament link is `fieldlogichq.ca/{slug}`. Once a club's own address is connected, the first part is `{address}` and the slug is the old part. The product uses the first set of words while not connected, the second while connected or needs attention.

**Event settings · Public URL**
- Not connected (unchanged): **The first part, {slug}, is your web address, shared by every tournament.** · **Change it in Settings & access.** (Tournament, Tournament Plus) · **Change it in your organization's Settings.** (League, Club)
- Connected (**NEW**): **The first part, {address}, is your own address, shared by every tournament.** · **Change it on the Public site page.**

**The tournament Web address window** (the field that changes the slug)
- The fixed text before the field stays `fieldlogichq.ca/`.
- Hint, connected (**NEW**): **The last part of your FieldLogicHQ address. Links to {address} keep working if you change it.**
- Asking window body, connected (**NEW**): **Every link that uses fieldlogichq.ca/{from} stops working as soon as you change it. Links to {address} keep working. Nothing redirects to fieldlogichq.ca/{to}.**

### The copy-link lines
No words change. Only the address inside them. The screens that stay on FieldLogicHQ on purpose (the staff kit, the tryout evaluator's link, the chat invite, a coach's private calendar feed) keep theirs.

---

## 10 · On the club's own address: what families and coaches see

- The bar shows one plain link at the right: **Sign in**. The account menu, **Follow**, alerts and **My team** are hidden.
- Accessible name: **Sign in to FieldLogicHQ**
- It lands on the **same page** at `fieldlogichq.ca/{slug}/…`, signed in, with every piece back.
- No explanation next to it. A family who is already signed in on the FieldLogicHQ address is not forwarded, so never sees this.

---

## 11 · The four emails (to the owner only)

Warm envelope, Arial, the name line "FieldLogic**HQ**" in text. One lime button each, and it says what happens. An admin never gets these; an admin reads the row.

### 11.1 · It's live
- **Subject:** `{address} is live`
- **Preview line:** Families can find {club} there now.
- **Body:**
  Hi {ownerFirstName},

  {club}'s site now answers at **{address}**.

  Every link we hand out uses it. `fieldlogichq.ca/{slug}` forwards there, so posters and old links keep working.

  Keep both records where you bought {bare} for as long as you use this address. The padlock check record matters most: the padlock renews only while it is there. We check both every day and will write to you if one goes missing.

  *(Only if the bare name is not forwarding:)* One thing is left. {bare} on its own does not forward to {address} yet, so anyone who types it without www will not find you. How to forward it is on the same page.
- **Button:** Open Web address
- **Foot:** You are getting this because you are the owner of {club} on FieldLogicHQ.

### 11.2 · The padlock check record is missing: the day we notice, then 14 days before {date} if it is still missing
**On the day**
- **Subject:** The padlock check record for {address} is missing
- **Preview line:** Your site still works. Put the record back before {date}.
- **Body:**
  Hi {ownerFirstName},

  Today we could not find the padlock check record for **{address}**.

  Your site still works today, but its padlock cannot renew without that record. Put it back where you bought {bare} before **{date}**, or visitors will see a security warning instead of your site.

  This happens most often when someone tidies up the settings where the address was bought and removes an odd-looking record. The record, and what it is for, are on the Web address row. If someone else looks after {bare}, you can copy both records as a message to send them.

  This clears by itself once the record is back.
- **Button:** See the record

**Two weeks before {date}**
- **Subject:** Two weeks left: put the padlock check record back for {address}
- **Preview line:** Visitors see a security warning after {date}.
- **Body:**
  Hi {ownerFirstName},

  The padlock check record for **{address}** is still missing, and the padlock runs out on **{date}**, two weeks from now.

  After that date, visitors will see a security warning instead of {club}'s site. Putting the record back where you bought {bare} fixes it, and the row clears by itself once it is there.

  If you no longer want this address, you can stop using it from the Web address row instead.
- **Button:** See the record

### 11.3 · We stopped checking
- **Subject:** We stopped checking for your records
- **Preview line:** Your site still works at its FieldLogicHQ address.
- **Body:**
  Hi {ownerFirstName},

  We looked for the two records for **{address}** for two days and did not find {whichMissing}.

  Nothing has changed on your site. It still works at fieldlogichq.ca/{slug}, and every link we hand out still uses that address.

  Check that the records are saved exactly as shown where you bought {bare}, then press Try again on the Web address row. The records stay the same.
- **Button:** Open Web address
- `{whichMissing}` = "either one", "record 2" or "record 1".

### 11.4 · The club's address stopped working
- **Subject:** `{address}` is not reaching your site
- **Preview line:** Record 2 changed. Your FieldLogicHQ address still works.
- **Body:**
  Hi {ownerFirstName},

  On {noticedDate} at {time} we found that record 2 for **{address}** was changed or removed where you bought {bare}.

  Anyone who uses {address} sees an error until it is back. Until then, every link we hand out uses fieldlogichq.ca/{slug}, which works, and the old address has stopped forwarding so nobody lands on the error.

  Put record 2 back as shown on the Web address row and this clears by itself. If you meant to stop using the address, you can do that from the same row.
- **Button:** See the record

---

## 12 · What a screen reader hears and what flashes

| Where | The words |
|---|---|
| Copy buttons on a phone | **Copy record 1 name** · **Copy record 1 value** · **Copy record 2 name** · **Copy record 2 value** |
| Check now on a phone | **Check now** (while running: **Checking…**) |
| Header buttons on a phone | **Copy link** · **Open** |
| Result of Check now, said once, politely (**NEW**) | **Record 1 found.** · **Record 1 not seen yet.** · **Record 2 found.** · **Record 2 points elsewhere.** · **Record 2 not seen yet.** |
| Chip on a closed row | read with the title: "Web address, Waiting" |
| Copy pressed | **Copied** (a transient pill; it fades; only an error stays) |
| The public Sign in link | **Sign in to FieldLogicHQ** |

---

## 13 · Checked against the rules

- **Spelling.** One spelling throughout; run `npm run check:spelling` on the strings once they are in code. No installment, no
  financial year (the club's period is "fiscal year" and never appears here).
- **The clock.** Every time is "{time}" with "a.m." or "p.m.": "2:14 p.m.", "9:41 a.m."
- **Possessives.** FieldLogicHQ's, Lakeshore Lynx's, service's: the bare apostrophe only after an s.
- **No timing promise** beyond: "often minutes once both records are in; it can take up to two days."
- **Nothing promised that does not ship.** "Every 15 minutes" and "every day" are the build prompt's schedule; "up to two days"
  is the host's own limit; "emailed {owner}" is ruling 6.
- **No competitor named.** No "DNS" alone: the one use (§5) says where.
- **One lime button per view** (the emails' single button; in the product the door is outline, lime stays for Go live).
- **Never**: unlock, powerful, seamlessly, intuitive, streamline.
