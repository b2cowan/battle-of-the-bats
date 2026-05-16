# Tournament Free-Tier UX Cleanup

- FieldLogicHQ should not process tournament registration payments. The product direction is external payment instructions and payment-status tracking.
- Existing tournament fee fields remain the source of truth: tournament-level `deposit/total fee` schedule by default, with division values used only when the tournament fee mode is `age_group`.
- Public registration copy should avoid "payment link" language. Teams should be told that payment is handled directly by the organizer and FieldLogicHQ records registration/payment status.
- Item 11 of `TOURNAMENT_FREE_TIER_UX_PM_BRIEF.md` was updated to reflect this model.
- Item 12 now routes admin Results score saves/finalization/reverts through `app/api/admin/games/route.ts` instead of direct client DB updates, so score finalization rules and playoff advancement stay consistent.
- Item 13 now labels tournament announcements as public News page posts, adds a public-post-only callout with a Communication link, and changes email composer placeholders away from "announcement" wording.
- Item 14 now gives Communication explicit team/status/division/team/contact-role targeting with a deduped recipient preview, and `app/api/send-message/route.ts` resolves targeting server-side before sending.
- Item 15 now adds Communication, Rules & Resources, and Past Tournaments to the mobile tournament More menu, and caps the drawer height so the larger menu scrolls on short screens.
