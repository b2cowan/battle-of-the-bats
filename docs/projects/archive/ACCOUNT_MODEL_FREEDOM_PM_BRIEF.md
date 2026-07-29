# Account Model Freedom — PM Brief

**Companion to:** `ACCOUNT_MODEL_FREEDOM_ANALYSIS.md` · **Status:** Analysis complete, awaiting owner ratification (nothing Decided yet)

## The question we set out to answer

You asked: *"What's the best balance between keeping the product simple and giving users freedom? Should someone be able to own two org subscriptions? Belong to two orgs? Coach two Premium teams? How manageable is each from billing and support? More subscriptions means more money — but I don't want to ruin the experience or make it hard to support."*

## What we found, in one picture

There are really **two different kinds of "freedom," and they behave completely differently:**

1. **Joining and coaching across organizations** — a coach helping two clubs, a parent following kids in two leagues, an admin who also coaches elsewhere. **This is already open, it's free, it works, and it's the network the platform grows on.** There's no good reason to restrict it, and restricting it would hurt the exact people who spread the product by word of mouth.

2. **Owning a second paid thing** — a second org subscription, or a second Premium Coaches Portal. **This is the part that's actually "more subscriptions = more money,"** and it's also the part that costs the most to support and carries cannibalization risk. Today it's mostly blocked, but inconsistently, with a few real bugs.

So the answer isn't "open everything" or "lock everything." It's: **keep the free/social side wide open, and put a light, deliberate gate on the paid-ownership side.**

## Why the timing matters

Right now, during Founding Season, **everything is free** (both Tournament Plus and the Premium Coaches Portal are comped to $0 until January 1, 2027) and there's essentially **one real customer org**. That means:

- Every freedom decision below **costs nothing in revenue in 2026.**
- The only real cost of being permissive today is that each extra free org/portal becomes a **separate account you have to convert by hand in January.**
- The money only becomes real in 2027 — so this is the perfect window to *watch who actually wants multi-org* before committing to how to price it.

## What we recommend

**Recommended: "Verified Network."** In plain terms:

- **The 95%+ of users who have one of everything see exactly what they see today** — no new buttons, no switchers, nothing. That promise is protected.
- **Joining/coaching across orgs is fully, officially open** — we stop treating it as an exception and just make it a clean rule.
- **Owning a second org or a second portal** requires a quick "tell us you actually run more than one organization" step. During the free period that's just a form (nothing is blocked — it's how we learn who these people are). It only becomes a real approval-and-billing gate in January.

**Why this one:** it gives freedom where freedom is free, keeps the product simple for everyone else, captures the one genuinely *new* revenue customer (someone running two separate associations) without accidentally encouraging a single club to split itself into two cheaper subscriptions, and it keeps the multi-org group small and known — which is exactly what makes support able to fix one org's problem without touching another.

**Runner-up: "Metered Freedom."** Leave everything open and simply bill each extra org/portal as its own subscription in January. Pick this if you'd rather maximize the number of subscriptions and avoid running any approval process — accepting that some clubs will split into two cheaper plans instead of buying one bigger Club plan, and that January's hand-conversion gets heavier per person.

## What it earns

- During 2026: nothing changes financially — it's all comped. The value is **cleaner data on who wants multi-org** and a **shorter, tidier January conversion.**
- From 2027: the genuine "two separate associations" operator becomes real, full-price, recurring revenue (small in number, high in referral value). The willing multi-team coach can be nudged toward the bigger Club sale rather than paying for two small portals.

## What it risks / costs

- **A few bugs must be fixed regardless of which direction you pick** — most importantly, a coach who owns a free Coaches Portal is currently *wrongly blocked* from starting their first real org, and a multi-org owner clicking "cancel" on one org's billing page could cancel the *wrong* org. These are code defects, not policy choices, and a couple are overdue.
- **Two support-side findings need a decision:** today a support agent can effectively log in as any customer through the "reset password" tool, and a support action taken on one org can cancel a *different* org's subscription. Neither is caused by the freedom question, but both should be closed before we hand support more multi-org work.
- **The one genuinely new build** (only needed if we ever let a coach hold two Premium portals) is a way to switch between portals inside the coach app — there's none today.

## What we need from you

A short, numbered decision list is in the analysis doc (Section 12). The first item is time-sensitive: it unblocks a database safeguard that's been parked waiting for exactly this analysis. The rest are pick-one/yes-no calls you can ratify one at a time. Nothing is being logged as a final decision until you say so.
