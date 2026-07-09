-- 179_marketing_email_templates.sql
-- Brings the 10 founding-season MARKETING campaigns into the operator-editable
-- platform_email_templates system under a new "marketing" category. Their content is
-- stored as the block-markup understood by lib/email-markup.ts (paragraphs, **bold**,
-- - bullets, ::callout / ::button / ::link / ::if), reproducing the hand-built HTML in
-- lib/email.ts so operators can edit subject + body and preview/send from the console
-- with no deploy. cta_label / cta_url_pattern stay NULL — these campaigns carry their
-- CTAs inline in the body via ::button / ::link.
--
-- Data-only insert into an existing table (no schema change). Idempotent.

INSERT INTO platform_email_templates
  (key, label, description, subject, heading, body, cta_label, cta_url_pattern, variables, category)
VALUES

('founding_welcome', 'Founding — Welcome', 'Sent to each new founding org owner at signup (transactional). Confirms free Tournament Plus.',
  'Your founding season starts now — Tournament Plus is free through Dec 31',
  'Your founding season starts now.',
  'Hi {{firstName}},

You''re in. **{{orgName}}** is set up on FieldLogicHQ and running **Tournament Plus free through December 31, 2026** as a founding organization.

::callout Tournament Plus ($39/month) gives you
- Auto-scheduling across any number of fields and time slots
- Single and double-elimination brackets
- Team communications and announcements
- Tournament archives — every past event preserved
- Up to 3 active tournaments at once
::end

All of it, **free until January 1, 2027**. No credit card required.

::button Set up your first tournament → | {{setupUrl}}

If anything doesn''t work the way you''d expect, reply to this email. We read everything.

— The FieldLogicHQ team',
  NULL, NULL,
  '["firstName","orgName","setupUrl"]'::jsonb,
  'marketing'),

('founding_checkin', 'Founding — Season Check-in', 'Sent ~60 days after signup. Celebrates activity so far and nudges another tournament.',
  'How''s your season going? Update from FieldLogicHQ',
  'How''s your season going?',
  'Hi {{firstName}},

It''s been **{{weeksPhrase}}** since **{{orgName}}** joined FieldLogicHQ.

::if hasActivity
::callout Season so far
You''ve run **{{tournamentsPhrase}}** — **{{gamesPhrase}} played**.
That''s {{gameCount}} schedule exports and score entries you didn''t have to do in a spreadsheet.
::end
::button Set up another tournament → | {{setupUrl}}
::else
You haven''t run your first tournament yet — which means you still have plenty of free Tournament Plus before January 1.

If you''ve got an upcoming event, now''s the time to set it up:
::button Set up a tournament → | {{setupUrl}}
::end

We''re also curious: what''s working, and what isn''t? Reply and tell us.

Your founding season runs through December 31, 2026. Starting January 1, Tournament Plus is $39/month — or you can continue free on the Tournament plan (1 active tournament, manual scheduling).

— The FieldLogicHQ team',
  NULL, NULL,
  '["firstName","weeksPhrase","orgName","hasActivity","tournamentsPhrase","gamesPhrase","gameCount","setupUrl"]'::jsonb,
  'marketing'),

('founding_renewal', 'Founding — Renewal Notice', 'Sent Nov 1. Explains what happens Jan 1 and how the org’s tournaments carry over.',
  'Your founding season ends December 31 — here''s what happens next',
  'Your founding season ends December 31 — here''s what happens next.',
  'Hi {{firstName}},

Your FieldLogicHQ founding season ends December 31, 2026.

Starting January 1, Tournament Plus is $39/month. Here''s what that means for **{{orgName}}**:

::if hasHistory
::callout.blue What happens to {{orgName}}
::if hasActive
Your **{{activePhrase}}**, all registered teams, scores, and archives carry over automatically — nothing changes except the billing.
::end
::if hasPast
Your **{{pastPhrase}}** stay in your archives regardless of which plan you''re on.
::end
::end
::end

To continue on Tournament Plus starting January 1:
::button Add a payment method — takes 2 minutes → | {{billingUrl}}

If $39/month isn''t right for **{{orgName}}**, you can also continue free on the Tournament plan: 1 active tournament, manual scheduling, no cost.
::link See plan comparison → | {{planCompareUrl}}

Questions? Reply to this email.

— The FieldLogicHQ team',
  NULL, NULL,
  '["firstName","orgName","hasHistory","hasActive","activePhrase","hasPast","pastPhrase","billingUrl","planCompareUrl"]'::jsonb,
  'marketing'),

('founding_final', 'Founding — Final Reminder', 'Sent Dec 15. Two-weeks-left nudge to add a payment method.',
  '2 weeks left in your founding season',
  '2 weeks left in your founding season.',
  'Hi {{firstName}},

Quick reminder: your founding season ends in 16 days, on December 31.

::if hasCard
You''re all set — Tournament Plus continues at $39/month starting January 1. Nothing else to do.
::else
If you''d like to continue with Tournament Plus starting January 1 ($39/month), add a payment method now:
::button Add payment method → | {{billingUrl}}
::end

Either way, everything you''ve built on FieldLogicHQ stays with you.

— The FieldLogicHQ team',
  NULL, NULL,
  '["firstName","hasCard","billingUrl"]'::jsonb,
  'marketing'),

('spotlight_club', 'Spotlight — Club', 'Sent Aug 1. Pitches Club ahead of the September season.',
  'Before your September season starts — Club is free through December 31',
  'Before your September season starts — Club is free through December 31.',
  'Hi {{firstName}},

Most clubs are planning their September season right now.
Tryouts. Rep team rosters. League registrations. Budget prep.

If you''re managing all of that across multiple tools — this is worth 15 minutes.

::callout Club on FieldLogicHQ puts your entire organization in one place
- Tournaments: same tools you''re already using on your founding season
- House League: registration, draft, schedule, standings, parent notifications — no manual emails
- Rep Teams: tryouts, roster, lineups, and team budget — coaches run their own programs; your executive team gets the visibility
- Accounting: org ledger, team invoicing, budget vs. actual
::end

Your executive team sees everything. Your coaches run their own teams.
Nobody is sending weekly update emails.

Club is normally **from $219/month**, unlimited staff seats.
As a founding organization, **Club is free through December 31, 2026**.

If you''re starting a September season, the time to set this up is now — not after you''re three months in on the same old process.

::button Start on Club — free through December 31 → | {{setupUrl}}

Questions about whether Club is right for **{{orgName}}**? Reply to this email.

— The FieldLogicHQ team',
  NULL, NULL,
  '["firstName","setupUrl","orgName"]'::jsonb,
  'marketing'),

('spotlight_league', 'Spotlight — House League', 'Sent Sep 1. Shows what running a house league looks like; pitches League Plus / Club.',
  'What running a house league actually looks like on FieldLogicHQ',
  'What running a house league actually looks like on FieldLogicHQ.',
  'Hi {{firstName}},

You''re running tournaments. But if **{{orgName}}** also runs a house league season — or if that''s where you''re headed — here''s what that looks like.

::callout From opening registration to final standings
- Parents register players online. You set division limits; waitlists fill automatically.
- Draft day uses a live board — pick order, team builds, no spreadsheet.
- The schedule generates itself. Parents get automated game notifications without you sending a single email.
- Standings update the moment scores are entered.
::end

No parallel spreadsheets. No manual notifications. One dashboard.

Available on the League Plus plan (**$89/month**) and Club plan (**from $219/month**).
Both are **free through December 31, 2026** for founding organizations.

If you''re planning a league season:
::button Get set up on League Plus — free through December 31 → | {{setupUrl}}

— The FieldLogicHQ team',
  NULL, NULL,
  '["firstName","orgName","setupUrl"]'::jsonb,
  'marketing'),

('spotlight_coaches_org', 'Spotlight — Coaches Portal (to orgs)', 'Sent Oct 1 to org owners. Pitches the Coaches Portal for the coaches on their teams.',
  'For the coaches on your teams — a workspace that''s actually theirs',
  'For the coaches on your teams — a workspace that''s actually theirs.',
  'Hi {{firstName}},

The coaches managing teams in your tournaments are tracking rosters in group texts, lineups in notes apps, and team fees in someone''s head.

::callout The Coaches Portal gives them one place for all of it
- Full roster management with season history
- Lineup builder — plan your starting lineup, export to PDF
- Team budget and player dues tracking
- Document management: consent forms, medical notes, eligibility files
::end

It works whether or not a coach''s team is registered in a tournament you run on FieldLogicHQ. A coach can sign up independently, on their own billing, and manage their team year-round.

Standalone at **$29/month**, or included in League Plus and Club plans.

Know a coach who needs this?
::link Send them this link → | {{coachShareUrl}}

Or express your own interest:
::button I''m interested in the Coaches Portal → | {{interestUrl}}

— The FieldLogicHQ team',
  NULL, NULL,
  '["firstName","coachShareUrl","interestUrl"]'::jsonb,
  'marketing'),

('spotlight_coaches_coach', 'Spotlight — Coaches Portal (to coaches)', 'Sent Oct 1 to coach accounts. Pitches the standalone Coaches Portal.',
  'For the coaches on your teams — a workspace that''s actually theirs',
  'For the coaches on your teams — a workspace that''s actually theirs.',
  'Hi {{firstName}},

You''ve been through a tournament on FieldLogicHQ. But managing your team between tournaments is still probably spread across your phone, email, and memory.

::callout The Coaches Portal is built for exactly that
- Your full roster, season over season
- Lineups you can plan, save, and export to PDF
- Team budget: dues in, expenses out, who owes what
- Documents in one place — consent, medical, eligibility
::end

No organization account required. Your team workspace, on your timeline.
Standalone at **$29/month**.

Express your interest — we''ll reach out directly:
::button I want the Coaches Portal → | {{interestUrl}}

— The FieldLogicHQ team',
  NULL, NULL,
  '["firstName","interestUrl"]'::jsonb,
  'marketing'),

('spotlight_club_last', 'Spotlight — Club (last call)', 'Sent Oct 15 to orgs not yet on Club. Final Club nudge.',
  'Last reminder — Club is still free through December 31',
  'Last reminder — Club is still free through December 31.',
  'Hi {{firstName}},

A quick follow-up to our August note about Club.

If **{{orgName}}** is running a house league, rep teams, or both alongside your tournaments — Club is free through December 31, 2026 as part of your founding season.

After the new year, it''s **from $219/month**. Starting now, it costs nothing.

The longer you wait to set it up, the deeper into the season you go on separate systems.

::button Start on Club — free through December 31 → | {{setupUrl}}

— The FieldLogicHQ team',
  NULL, NULL,
  '["firstName","orgName","setupUrl"]'::jsonb,
  'marketing'),

('spotlight_full_picture', 'Spotlight — The Full Picture', 'Sent Nov 15. Founding-season wrap-up: what’s live, what’s coming, share + add payment.',
  'Where FieldLogicHQ is headed — a note from the founding season',
  'Where FieldLogicHQ is headed — a note from the founding season.',
  'Hi {{firstName}},

You''re one of the first organizations running on FieldLogicHQ. Here''s a brief update on where things are headed.

::callout What''s live today
- Tournament and Tournament Plus: free for your founding season through December 31
- House League, Rep Teams, and Accounting: available on League and Club (also free through December 31 for founding organizations)
- Coaches Portal for coaches tracking their teams
::end

::callout.blue What''s coming in 2027
- Coaches Portal standalone — a full season workspace for one team ($29/month)
- Expanded public org site tools
- And more, based on what this first season has taught us
::end

You''ve helped us build this — by running real events on the platform and telling us what worked and what didn''t.

If you know another tournament organizer, league admin, or coach who should be here:
::link Share FieldLogicHQ → | {{shareUrl}}

And if you haven''t added a payment method yet:
::button Continue after December 31 — takes 2 minutes → | {{billingUrl}}

See you in 2027.

— The FieldLogicHQ team',
  NULL, NULL,
  '["firstName","shareUrl","billingUrl"]'::jsonb,
  'marketing')

ON CONFLICT (key) DO NOTHING;
