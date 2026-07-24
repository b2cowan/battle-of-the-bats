-- 198_reseed_founding_season_campaign_copy.sql
--
-- FOUNDING_SEASON_COACHES_FREE_PLAN tail item (3): Phase 3 (commit 26380896) flipped the
-- CODE defaults for the three campaigns that pitch the Premium Coaches Portal / wrap-up to
-- the ratified $0-until-2027 Founding Season copy — but the LIVE campaign send-copy is the
-- platform_email_templates row (migration 179 seed), which still quoted "$29/month" as the
-- price today. Campaigns render from the row unconditionally (alwaysRenderFromTemplate), so
-- an October send would have contradicted the promo. This re-seeds ONLY those three rows,
-- generated verbatim from lib/marketing-email-defaults.ts (the canonical default), and only
-- while the row is NOT operator-customised — a saved override always wins.
--
-- Data-only: no schema change.

update platform_email_templates set
  label = $seed198$Spotlight — Coaches Portal (to orgs)$seed198$,
  description = $seed198$Sent Oct 1 to org owners. Pitches the live, Founding-Season-free Premium Coaches Portal for the coaches on their teams.$seed198$,
  subject = $seed198$For the coaches on your teams — a workspace that's actually theirs (free right now)$seed198$,
  heading = $seed198$For the coaches on your teams — a workspace that's actually theirs.$seed198$,
  body = $seed198$Hi {{firstName}},

The coaches managing teams in your tournaments are tracking rosters in group texts, lineups in notes apps, and team fees in someone's head.

::callout The Premium Coaches Portal gives them one place for all of it
- Full roster management with season history
- Lineup builder — plan your starting lineup, export to PDF
- Team budget and player dues tracking
- Document management: consent forms, medical notes, eligibility files
::end

It works whether or not a coach's team is registered in a tournament you run on FieldLogicHQ. A coach can sign up independently and manage their team year-round.

It's live now — and **free through the founding season: $0 until January 1, 2027**, then $29/month standalone (or included when your org is on Club). No credit card required to start.

Know a coach who'd use it? They can start free today:
::link Send them this link → | {{coachShareUrl}}

Want the details first?
::button See the Coaches Portal → | {{interestUrl}}

— The FieldLogicHQ team$seed198$,
  variables = $seed198$["firstName","coachShareUrl","interestUrl"]$seed198$::jsonb,
  updated_at = now(),
  updated_by = 'migration-198'
where key = $seed198$spotlight_coaches_org$seed198$
  and is_customised = false;

update platform_email_templates set
  label = $seed198$Spotlight — Coaches Portal (to coaches)$seed198$,
  description = $seed198$Sent Oct 1 to coach accounts. Pitches the live, Founding-Season-free standalone Premium Coaches Portal.$seed198$,
  subject = $seed198$Your team's season workspace — free until January 1, 2027$seed198$,
  heading = $seed198$Your team's season workspace — free right now.$seed198$,
  body = $seed198$Hi {{firstName}},

You've been through a tournament on FieldLogicHQ. But managing your team between tournaments is still probably spread across your phone, email, and memory.

::callout The Premium Coaches Portal is built for exactly that
- Your full roster, season over season
- Lineups you can plan, save, and export to PDF
- Team budget: dues in, expenses out, who owes what
- Documents in one place — consent, medical, eligibility
::end

No organization account required. Your team workspace, on your timeline — and it's **free through the founding season: $0 until January 1, 2027**, then $29/month. No credit card required to start.

::button Start your free Coaches Portal → | {{interestUrl}}

— The FieldLogicHQ team$seed198$,
  variables = $seed198$["firstName","interestUrl"]$seed198$::jsonb,
  updated_at = now(),
  updated_by = 'migration-198'
where key = $seed198$spotlight_coaches_coach$seed198$
  and is_customised = false;

update platform_email_templates set
  label = $seed198$Spotlight — The Full Picture$seed198$,
  description = $seed198$Sent Nov 15. Founding-season wrap-up: what’s live, what’s coming, share + add payment.$seed198$,
  subject = $seed198$Where FieldLogicHQ is headed — a note from the founding season$seed198$,
  heading = $seed198$Where FieldLogicHQ is headed — a note from the founding season.$seed198$,
  body = $seed198$Hi {{firstName}},

You're one of the first organizations running on FieldLogicHQ. Here's a brief update on where things are headed.

::callout What's live today
- Tournament and Tournament Plus: free for your founding season through December 31
- House League, Rep Teams, and Accounting: available on League and Club (also free through December 31 for founding organizations)
- The Premium Coaches Portal — a full season workspace for one team — now live and free through the founding season ($0 until January 1, 2027, then $29/month)
::end

::callout.blue What's coming in 2027
- Expanded public org site tools
- More ways for families to follow their teams
- And more, based on what this first season has taught us
::end

You've helped us build this — by running real events on the platform and telling us what worked and what didn't.

If you know another tournament organizer, league admin, or coach who should be here:
::link Share FieldLogicHQ → | {{shareUrl}}

And if you haven't added a payment method yet:
::button Continue after December 31 — takes 2 minutes → | {{billingUrl}}

See you in 2027.

— The FieldLogicHQ team$seed198$,
  variables = $seed198$["firstName","shareUrl","billingUrl"]$seed198$::jsonb,
  updated_at = now(),
  updated_by = 'migration-198'
where key = $seed198$spotlight_full_picture$seed198$
  and is_customised = false;

