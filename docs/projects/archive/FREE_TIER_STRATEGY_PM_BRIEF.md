# Free Tier Strategy — PM Brief

> ⚠️ **Superseded for execution by [FREE_TIER_COACHES_UNIFIED_PM_BRIEF.md](FREE_TIER_COACHES_UNIFIED_PM_BRIEF.md)** + the [unified plan](FREE_TIER_COACHES_UNIFIED_PLAN.md). Retained as a detail reference.

**Status:** Scoped 2026-06-07 (planning only). Plan: [FREE_TIER_STRATEGY_PLAN.md](FREE_TIER_STRATEGY_PLAN.md)

## What we're doing

Today only tournament organizers get a real free product. Rep coaches, house-league admins, and club presidents all hit a "Coming soon / express interest" wall before they can do anything — so three of our four customer types convert to a mailing list, not a user. This project makes **every operator type able to start for free**, each with a floor sized to their job, all under **one login**.

## The model in plain words

- **One account per person.** You sign in once.
- **Three free floors:** Free Tournament (run one event), Free League Starter (run one small season), Free Basic Coaches Portal (manage one team's roster, schedule, messaging, and fee tracking).
- **Club stays paid** — it's the "whole club in one place" product; its free experience is the League Starter plus the free coach portals its coaches already have.
- You're **not** buying or juggling four subscriptions, and there's **no** single free plan that hands you every module. You get the floor for what you came to do, and you can add another later from the same account.
- **You pay when you outgrow the free scope** (a second division, a ninth team, taking fees online) or want the deeper paid tools — never on a countdown clock.

## Why it matters

- **We currently sit below the market floor.** The competitors we actually face in Canada all let an organization operate its core for free. A tournaments-only free tier reads as stingy to a budget-zero volunteer.
- **Coaches are our best organic growth engine.** Every free coach is a seed inside a future club — when their organization joins, their team carries over automatically, and the coach becomes an internal advocate. Giving coaches a real free way to manage their own team turns that engine on. This is the highest-leverage path to Club.
- **It removes our biggest trust bug:** persona pages that promise "this is for you" then say "you can't have it," and pricing cards that advertise trials we can't honor.

## What each customer sees differently

- **Tournament organizer:** roughly the same free floor, but the "free brackets" promise gets honest, and the account stops calling itself an "organization" when it's really one event.
- **Rep coach:** from a dead-end "Coming soon" to a real free team workspace they can start the same evening — roster, schedule, fee tracking — reachable directly, not only as a tournament by-product.
- **House-league admin:** from an email modal to a real free season builder; they watch a multi-division schedule build and standings update, and only hit a wall when they've outgrown the free size.
- **Club president:** in the first release, evaluates Club through a **guided demo / sample-data walkthrough and consultative onboarding** (a self-serve Club trial is a later project — it needs entitlement work that isn't built yet). They can still finally start a second workspace from an account they already have, and connect their existing tournament/coach contexts under one org.

## Priority & sequencing

High strategic priority, split into two rails so payments never block the free floors:

**Launch rail (the free floors — ships with NO payment processing):**
1. **Now:** trust/honesty + doc cleanup (kill the trial-vs-"Coming soon" conflict, the "14-day trial" copy, the Premium-as-free over-promise; reconcile README/PM/taxonomy).
2. **Keystone:** an account-first start front door so each persona lands on the right free entry, plus an existing-user "add another workspace" path.
3. **Enforce free limits server-side** (caps in the APIs, not just the UI) and **instrument** every floor so we can tell real activation from empty accounts.
4. **Coach free floor** rides on the Coaches Experience project finishing; **League Starter ships as a capped beta** before broad marketing.

**Future rail (monetization — explicitly off the launch path):**
- Online payment collection, the paid standalone Coaches Portal go-live (after the team module is fully tested), and the self-serve Club Activation Trial all wait on the payment-processing line + Stripe go-live and the entitlement work behind them.

## Success criteria

- Every operator type has a working free self-serve path.
- Coach and league-admin signups move off zero.
- Conversions happen at fair "you've grown" moments and when taking money online.
- Coach-to-club advocacy referrals are tracked.
- No marketing surface advertises something a visitor can't actually get.

## Role-based access

No new admin roles. The change is **which free entry each persona lands on at signup**, and **a logged-in user being able to add another free floor**. Existing org roles (Owner / Admin / League Admin / Registrar / Treasurer / Coach / Official / Staff) are unchanged.
