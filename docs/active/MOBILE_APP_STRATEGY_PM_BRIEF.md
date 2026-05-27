# Mobile App Strategy PM Brief

**Created:** 2026-05-26  
**Status:** Strategy brief only; no technical implementation plan yet  
**Audience:** Product, leadership, and release planning

## Executive Recommendation

FieldLogicHQ should not launch a mobile app as a full clone of the website. The web app already supports mobile views across public tournament pages, tournament admin, scorekeeping, and the Coaches Portal. A store-distributed app should be positioned as a **FieldLogicHQ companion app for repeat, authenticated, time-sensitive work**.

Recommended direction:

- Keep the mobile web experience as the primary surface for public discovery, team registration, public schedules, results, marketing pages, billing, and full admin setup.
- Build a focused mobile app for coaches, scorekeepers, and tournament-day operators.
- Treat parents, players, and one-time tournament visitors as mobile web users for now; asking them to install an app is too much friction for a single event.
- Do not submit a simple website wrapper to the app stores. The app needs app-specific value such as a Today view, persistent login, role-aware quick actions, notifications, and offline-tolerant tournament-day access.

## Why This Makes Sense For FieldLogicHQ

FieldLogicHQ serves people working from fields, benches, parking lots, board meetings, and home offices. The current app already has strong mobile web foundations: public tournament navigation, tournament admin bottom navigation, Coaches Portal bottom navigation, and a dedicated scorekeeper route.

The mobile app should sharpen the moments where a browser is still weaker:

- Coaches checking tonight's schedule, roster, attendance, lineup, dues, or documents.
- Scorekeepers opening the right assigned game and submitting a score quickly.
- Tournament owners seeing urgent day-of registration, schedule, score, and publish status.
- Users receiving role-specific notifications instead of hunting through email.

This aligns with the brand promise: **Less admin. More sport.**

## App Versus Mobile Web

| Area | Mobile Web | Mobile App |
| --- | --- | --- |
| Best use | Public access, registration, search/discovery, full admin, billing, setup | Repeat authenticated workflows and day-of operations |
| Install required | No | Yes |
| Audience | Parents, players, visitors, organizers, coaches, admins | Coaches, scorekeepers, tournament operators first |
| Navigation | Mirrors website sections | Starts from "Today", assigned teams, assigned tournaments, and urgent tasks |
| Notifications | Email/in-app messaging | Push notifications with role-based preferences |
| Offline tolerance | Limited | Should cache key schedules, assignments, and recent records |
| Billing/upgrades | Web-owned | Avoid in-app purchase risk in MVP; app should not sell plans or send users to external checkout |
| Depth | Complete platform | Focused companion workflows |

## MVP Product Scope

The MVP should feel useful even if the user never visits the admin desktop that day.

Recommended MVP:

- **Home / Today:** user's current teams, tournaments, upcoming games, assigned scorekeeping games, pending tasks, and important alerts.
- **Coaches Portal Basic:** tournament registration history, current tournament status, schedules when published, announcements, and upgrade-neutral team identity.
- **Coaches Portal Premium:** team schedule, roster, attendance, lineup access, dues snapshot, document status, and key reminders.
- **Scorekeeper View:** assigned games, filters for date/field/division/team/status, large score entry, pending/finalized feedback.
- **Tournament Operator Quick View:** registrations needing action, schedule publish state, score review queue, current tournament switcher, and links back to full web admin for setup-heavy work.
- **Notifications:** schedule published/changed, game reminders, score submitted/finalized, registration status changed, dues/document reminders, and urgent organizer alerts.
- **Account:** org/team context switcher, notification preferences, profile, support, sign out.

Recommended MVP exclusions:

- Full tournament setup wizard.
- Advanced bracket/schedule generation.
- Branding/public-site editing.
- Billing, plan upgrades, downgrade/cancel flows, and Stripe checkout.
- Platform admin.
- Full accounting administration.
- Long-form exports and board-ready PDF workflows.
- Public tournament browsing for casual visitors.

## Level Of Effort

| Option | Scope | Estimated Effort | Recommendation |
| --- | --- | --- | --- |
| Mobile web + PWA hardening | Finish mobile UAT, improve install metadata, add basic app-like polish without app stores | 3-6 weeks after current mobile work is approved | Good near-term step |
| Store companion MVP | Focused app for coaches, scorekeepers, and tournament-day operators | 12-18 weeks, plus 2-4 weeks beta/review buffer | Recommended first app release |
| Full platform parity app | Native/mobile version of admin, public site, billing, accounting, League, Club, and platform admin | 6-12+ months | Not recommended |

The 12-18 week MVP assumes product scope is kept tight and existing FieldLogicHQ web workflows remain the system of record. If the app tries to cover full admin setup, billing, public browsing, and every module, the effort quickly becomes a separate product line rather than a companion app.

## Release Path

1. **Confirm product scope:** agree that the first app is for authenticated repeat users, not a public website replacement.
2. **Complete mobile web prerequisites:** finish current mobile sign-off work for public tournament, tournament owner/admin, scorekeeper, and Coaches Portal flows.
3. **Prepare app store assets:** app name, icon, screenshots, short description, full description, keywords/category, support URL, privacy policy URL, and demo account access.
4. **Complete compliance materials:** Apple app privacy details, Google Data Safety form, age rating, account deletion path, support contact, app review notes, and data handling review for youth/player information.
5. **Decide billing posture:** recommended MVP posture is a free companion app for existing accounts, with no in-app purchasing and no mobile calls to action that lead to external checkout.
6. **Run internal beta:** staff and trusted test accounts validate login, context switching, notifications, scorekeeping, coach workflows, and role boundaries.
7. **Run external beta:** 3-5 real organizations or teams use the app during a tournament or active team week.
8. **Submit for review:** use TestFlight for Apple beta, then submit selected build and metadata to App Review; use Google Play testing tracks, then production release when ready.
9. **Stage rollout:** release gradually, monitor crashes, failed logins, notification opt-outs, support tickets, and app store reviews.
10. **Operate the app:** plan a regular update cadence and avoid major app changes immediately before high-traffic tournament weekends.

## Store And Policy Considerations

- Apple expects apps to provide value beyond a repackaged website. A basic web wrapper is a rejection risk.
- Google Play also expects a stable, responsive, useful mobile app experience.
- Apple and Google both require privacy/data disclosures. FieldLogicHQ handles names, emails, player records, documents, schedules, financial/team data, and youth-sport context, so this cannot be treated as a generic app listing exercise.
- Billing needs an explicit policy decision. Current FieldLogicHQ subscriptions run through Stripe on the web. The safest MVP app posture is to let existing users sign in and use their paid/free entitlements, while keeping purchase, upgrade, and cancellation flows on the web and out of the app.
- If FieldLogicHQ later wants plan upgrades or Coach Portal purchases inside the app, app-store billing rules need a separate product and policy review.
- Use an organization developer account where possible. If Google Play is launched from a newly created personal developer account, Google requires a closed test with at least 12 opted-in testers for 14 continuous days before applying for production access.

## Key Product Decisions

1. Should the first app be named **FieldLogicHQ** or **FieldLogicHQ Coach & Scorekeeper**? Recommendation: FieldLogicHQ, with store copy emphasizing coach and tournament-day workflows.
2. Should parents/players be included in MVP? Recommendation: no; keep them on mobile web until usage proves recurring app value.
3. Should push notifications replace email? Recommendation: no; push should supplement email, with clear role-based preferences.
4. Should Tournament owners get full admin in app? Recommendation: no; provide alerts and quick actions, then deep-link to web admin for setup-heavy work.
5. Should the app support white-label org branding? Recommendation: no for MVP; use FieldLogicHQ brand with org/team context inside the app.
6. Should offline mode be promised? Recommendation: promise cached read access for key schedules and assignments, not full offline editing in MVP.

## Success Criteria

- Coaches and scorekeepers can complete their highest-frequency day-of tasks without opening the browser.
- At least 3 beta organizations or teams complete a real tournament or active team week using the app.
- Scorekeeper score submission and coach schedule/attendance usage show measurable adoption.
- Push notification opt-out rate stays low, and support tickets do not indicate notification confusion.
- App review passes without a policy-driven scope change.
- The app reduces support questions about schedules, scores, registration status, and team logistics.
- Web remains the complete administrative platform, with no regression in public registration or admin setup flows.

## Recommended Sequence

1. Finish the existing mobile web quality work already tracked for public tournament, tournament owner/admin, scorekeeper, and Coaches Portal.
2. Add PWA-level polish as a low-risk bridge for app-like use before store release.
3. Build the store app as a narrow companion MVP for coaches, scorekeepers, and tournament-day operators.
4. Reassess parent/player app value only after real usage shows recurring demand.

## Reference Sources

Release and policy requirements change over time. These sources were checked on 2026-05-26:

- [Apple App Store Connect workflow](https://developer.apple.com/help/app-store-connect/get-started/app-store-connect-workflow)
- [Apple TestFlight overview](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/)
- [Apple Submit an app](https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-app)
- [Apple App Privacy Details](https://developer.apple.com/app-store/app-privacy-details/)
- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Google Play create and set up your app](https://support.google.com/googleplay/android-developer/answer/9859152?hl=en-EN)
- [Google Play prepare and roll out a release](https://support.google.com/googleplay/android-developer/answer/9859348/prepare-and-roll-out-a-release?hl=en-GB)
- [Google Play app testing requirements for new personal developer accounts](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en)
- [Google Play Data Safety](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en-EN)
- [Google Play Payments policy](https://support.google.com/googleplay/android-developer/answer/9858738?hl=en)
