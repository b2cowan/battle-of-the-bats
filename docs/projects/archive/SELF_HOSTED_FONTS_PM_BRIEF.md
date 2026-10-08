# Self-hosted fonts — PM brief

> **❌ NO-GO: owner ruling, 2026-10-07. Do not build this, and do not re-propose it.** Archived unbuilt.
> A build that fails on the Google Fonts download is re-run (a retry passed on 2026-10-07).


Plan: `SELF_HOSTED_FONTS_PLAN.md` · Status: proposed 2026-10-07, option not yet picked.

**What changes.** Nothing a customer can see. The product keeps its own copies of its five fonts
(Inter, Barlow Condensed, IBM Plex Mono, DM Serif Display, DM Sans) instead of downloading them
from Google every time the site is built. Every page, name and number looks exactly as it does
today, and a phone downloads the same amount.

**Why it matters.** On 2026-10-07 a staging release failed for no reason of ours. Google Fonts sent
the build a font address in an unusual format, and the build tool (Next.js) crashes on it. It's a
known, unfixed problem on Next.js's side that strikes at random, roughly 1 in 60 font downloads. A
production release can fail the same way. That never breaks the live site, but it stalls a release,
possibly a hotfix. The same dependency is why the local site briefly showed the wrong fonts and
sizes on 2026-10-05 after the computer woke from sleep. Owning the files removes both.

**The trade-off the owner picks.** Next.js's built-in way to keep fonts can't split a font by
alphabet the way Google does. Either every visitor downloads about twice the font data, or letters
like ł, ř and ş in a player's name show in a different font. The recommended option copies Google's
own arrangement by hand instead, so nothing changes. It costs a little one-time setup that Next.js
would otherwise do for us. A smaller stopgap (patching the build tool) fixes the crash but keeps the
dependency on Google.

**Customer impact.** None visible. Indirectly, releases stop failing at random.

**Priority.** Low urgency, high leverage: a failed build is harmless and a retry fixes it. One
session.

**Success criteria.** The site builds with Google unreachable. Before/after screenshots match in
both themes at phone and computer widths. A name with Polish, Czech or Turkish letters still renders
in the real font. A page downloads the same font data as before.
