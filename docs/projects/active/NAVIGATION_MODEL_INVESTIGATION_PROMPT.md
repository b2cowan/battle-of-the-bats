# Investigation prompt — platform navigation model

> Paste as the opening message of a fresh chat. Self-contained by design: it carries the state a new
> session needs so it doesn't re-propose work that already shipped.

---

I need a deep-dive investigation into how people navigate this platform, and a recommended model. **This is
an investigation and design task, not a build task — do not write feature code.**

## The goal

A user should be able to move between the screens their roles give them **simply and efficiently**, without
that machinery leaking into or complicating the experience of a member of the public who has no account and
no roles. Those two things are in tension, and resolving that tension is the point of this work.

## Read these first, and verify everything against the actual code

- `docs/projects/active/DESKTOP_PUBLIC_UX_PHASE1_PLAN.md` — Phase 1 is COMPLETE and committed (three chunks:
  `9f1a605e`, `90dc58cc`, `515da826`), on `dev`, **not on prod**. Its Phase 2 section carries the owner's
  rulings.
- `AGENCY_RULES.md` and `AGENTS.md` — workflow, branch policy, and the Next.js caveat.
- `memory/MEMORY.md`, then only the topic files the work actually touches.

**Treat every summary below as a starting hypothesis and confirm it in the code.** A prior session's notes in
this repo have been wrong before — including mine.

## What is already built (do not re-propose any of it)

Four navigation shells exist today, and **three of the four already have a left rail**:

| Shell | Desktop | Phone |
|---|---|---|
| Fan/consumer app | Top strip: Home · Scores · Chat · Account, plus Pricing, a "Run a Tournament" persona menu, and one operator pill | Bottom bar, same destinations; anonymous sees Home · Scores · Sign In |
| Public tournament page | Event side rail (Overview / News / Schedule / Standings / Teams / Rules) + a slim platform strip | Scrolling event tab row under the header + the platform bottom bar |
| Admin | Grouped sidebar: Operations / Setup / Admin | Bottom bar (4–5 primary) + a **More sheet** grouped by section headers |
| Coach portal | Grouped sidebar: Overview / Squad / Season / Money / Communication / Team admin | Bottom bar (Overview · Schedule · Chat · Roster) + a **More sheet** |

Phase 1 also shipped, in the last day: state-based nav (anonymous vs signed-in, on both desktop and mobile),
the persona menu, the operator pill, a footer on the app screens, a get-the-app QR, and a paid-tier
"Built on FieldLogicHQ" credit. **None of that is up for redesign here.**

## The finding this investigation starts from

There are **at least seven different ways to change context**, and which one a user meets depends on where
they are standing: a workspace switcher, a tournament switcher, a season switcher, a team switcher, a coach
door, the operator pill, and the roles chooser. Separately from all of those, "The Flip" (`⇄`) moves between
the operator side and the public side of the same event.

**Verify this list.** Find every mechanism that changes what a user is looking at, name it, say where it
appears, and say who sees it. If there are more than seven, that strengthens the case.

## The working model to test, argue with, or replace

A prior session proposed a **two-axis** model. Treat it as a hypothesis to be attacked, not a brief:

- **Axis 1 — which place am I in?** (an org, a tournament you host, a team you coach, or the public app as a
  fan). One control. Desktop: top of the rail. Phone: top of the More sheet. Absent entirely for users with
  only one place.
- **Axis 2 — which side of it?** (operator side vs public side). The existing flip control, unchanged in
  position.
- Everything else is movement *within* a place, which each shell already handles.

Reference artifacts (context, not gospel):
- Phase 2 proposals — `claude.ai/code/artifact/f2b33b25-e051-4396-9dd2-a4b1c64e2bd4`
- Navigation model — `claude.ai/code/artifact/9fdaec75-bce8-431a-b6bf-e691272b59ca`
- Two axes, desktop + phone, with journeys — `claude.ai/code/artifact/bee72c5c-49da-446a-8e16-1e316997f844`

## Questions I actually need answered

1. **Is the two-axis split right?** Where does it break? Specifically: a user who is an admin of one org and
   a coach at a *different* org; a user with two teams in two orgs; a scorekeeper; a platform admin; someone
   whose role was just revoked mid-session.
2. **What happens on a phone**, in detail, for each persona — and does the More sheet genuinely hold this, or
   is that wishful thinking on a screen that already has a lot in it?
3. **How does a user get to the public face of an ORG** (not an event)? The flip handles an event today.
   There appears to be no clean path for an org's own public page. Confirm and propose.
4. **How much of this can be done incrementally** without a big-bang navigation change? Name the smallest
   first step that makes the rest cheaper and is worth shipping on its own.
5. **What must never change for a member of the public?** Be concrete about what anonymous visitors see, and
   define the line that role machinery must not cross.
6. **What evidence would justify the expensive parts?** Phase 1 deliberately gated the desktop rail on data
   nobody has yet (how often people move between places). Say what to measure, and whether any of this can
   proceed without it.

## Constraints

- **The public experience is the priority.** Anonymous visitors must not pay — in clutter, in confusion, or
  in page weight — for machinery that exists to serve operators.
- **Mobile behaviour is not free to change.** Phones are the primary device for coaches and parents. Any
  mobile change needs an explicit argument.
- This is a **multi-tenant** platform with four paid tiers; navigation must not imply access a plan doesn't
  grant. Check `lib/plan-config.ts` and the module-entitlement helpers before assuming a destination exists.
- Sport-neutral vocabulary throughout.
- **Do not restyle anything.** Colour and spacing decisions live with `/design`; the colour-token guardrail
  is at a zero baseline and must stay there.

## What to produce

1. A **findings document** — every context-changing mechanism that exists today, who sees it, and where the
   seams are. Ground every claim in the code.
2. A **recommended model**, with the alternatives you rejected and why.
3. **Mockups** covering all four personas on **both desktop and phone**, plus the journeys — including the
   multi-hat case: run a league → run a tournament in it → view that tournament's public page → view the
   org's public page → coach a team.
4. A **staged plan**: what to build first, what to gate on evidence, and what to leave alone.
5. A plan doc in `docs/projects/active/` **and a plain-language PM brief**, per `AGENCY_RULES.md`.

Present the UX summary in plain language before proposing any implementation. Ask me about anything genuinely
ambiguous rather than assuming — but make ordinary judgement calls yourself and tell me what you decided.
