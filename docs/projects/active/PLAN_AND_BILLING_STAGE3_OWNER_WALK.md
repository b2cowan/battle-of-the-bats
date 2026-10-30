# Plan & billing Stage 3 owner walk

Use the existing standalone owner, a coach granted Run tournaments, an ungranted coach, a board admin,
and a club owner who coaches. Repeat the navigation checks at desktop and 390px. No production data
needs to be changed for this walk; cancellation and free-time checks use prepared fixtures.

1. Standalone owner with a live team: the rail foot reads Help, Plan & billing, Tournaments you run,
   Collapse sidebar. More → You reads Account, Home, Plan & billing, Tournaments you run. Neither has Admin.
   The trophy is quiet rather than active. The full label wraps naturally on the phone.
2. Follow Tournaments you run. The workspace tournaments list opens, including before the first hosted
   tournament exists. Open a hosted tournament; its setup and management still work. The computer menu
   and page heading say Staff & access. On a phone use More → Settings & access → Staff & access;
   there is no extra Members row in the tournament menu. Staff seats and invitations keep their behavior.
3. Return through Coaches Portal. For a zero-team owner this returns to Coaches Portal not ready.
   That wall offers Plan & billing as its existing lime button and Tournaments you run as a plain link.
   Follow each and return. The portal Staff page continues to manage coaching staff.
4. Repeat with closed seasons only and several teams. The workspace tournament door stays available;
   no live-season tools reappear on a closed team. The existing hosted section on a live team's
   Tournaments page remains as it was.
5. Type the old addresses: `/{org}/admin`, `/{org}/admin/onboarding?continueSetup=1`,
   `/{org}/admin/org/billing`, and `/{org}/admin/tournaments/settings/subscription`.
   Hub/setup arrive at the portal; billing aliases arrive at coach Plan & billing. Repeat a hard refresh,
   browser Back and an old billing email/bell link. Query flags such as `?card_saved=1` survive the alias.
6. Board admin without any live or closed assignment: ordinary sign-in, accepted invitation and
   `/{org}/admin` all open the workspace tournaments list. With a live or closed coaching assignment,
   the landing is the portal. No standalone role gets an Admin link in the portal.
7. Granted coach: the new tournament door opens the list. Ungranted coach: no new door. Neither receives
   Plan & billing or a new staff-management grant. A direct billing URL keeps its existing owner lock.
8. Cancelled and ended-free-time standalone fixtures: the existing wall and owner Reactivate/Keep Premium
   journey remain. No new tournament door appears on these walls. Test old billing aliases and refresh
   for loops. Recover through the existing flow, then check the tournament door returns when active.
9. Club owner who coaches: Admin and admin billing stay; no Tournaments you run foot/sheet link. Members
   keeps its name. Demo sandbox: no new tournament link, including closed-season More if available.

Automated routing/render evidence and any check limitations are recorded in the parent plan's §9.
Real Stripe payment-method/invoice management, card save, checkout success/cancel, next-season choice,
and applicable plan moves should return to coach billing through the existing flows. Those external
journeys and the browser refresh lifecycle are owner validation, not certified by unit tests.
