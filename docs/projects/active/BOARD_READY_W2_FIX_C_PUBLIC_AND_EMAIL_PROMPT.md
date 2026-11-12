# Prompt — Board Ready · fix C: public pages and the unsubscribe link (sweep 3, findings 6 + 7 + public smalls) · **Sonnet**

> One session, pasted into a fresh chat (`/clear` first). Written 2026-11-10. Report:
> `docs/projects/active/BOARD_READY_ACCESS_SWEEP_3.md`. Index: `BOARD_READY_PROMPTS_INDEX.md`. The owner asked for these fix sessions on
> 2026-11-10. These are display and email integrity items. Nothing here reads another club's people.

## The items (each traced in the report; re-read the lines before changing them)
1. **A hidden Schedule still sends games** (finding 6). In `lib/public-tournament-data.ts` (~L139-140 the section gate,
   ~L215-245 the branches), `teams-preview`, `standings-preview` and `playoffs` return `games` and `standingsByDivision`
   when the Schedule page is switched off. The fix: when Schedule is hidden, those branches send no games. Then decide,
   from what the screens render, whether standings stay. Standings are their own switch, so standings computed on the
   server may still show; only the game list goes.
2. **Unsubscribe writes on a plain visit** (finding 7). `GET /unsubscribe` (`app/unsubscribe/route.ts`) writes in all three
   branches, so mail scanners pre-opening links unsubscribe people. The fix: GET shows a confirm page, and the write
   happens on POST. Copy the pattern of `/second-parent-stop` and `/invitation-stop`. Keep a one-click POST for the
   `List-Unsubscribe-Post` mail header if the senders set one (check `lib/email-sender.ts`). **This changes what an email
   recipient does, so `/legal` (CASL) reviews it before hand-off. That review is required, not optional.**
3. **Smaller public items, same session:**
   - The draft season's name on the public league register and status pages: answer 404, as the other league pages do.
   - Overview and News show posts aimed at a held-back division: use the Schedule strip's filter (`publicNotices`).
   - The Rules section sends held-back divisions' settings: send only published divisions there. Register still needs all
     of them for sign-up.
   - `GET /api/pay/tournament/[id]` answers for any id: require a published, non-canceled tournament, and add
     `throttlePublicForm`.

Before code: present the plain-language **UX summary** (AGENCY_RULES, blocking). A family clicking Unsubscribe now sees a
confirm step, which is the visible change. Help-docs sync: offer `/docs` (the unsubscribe flow, and the Schedule switch's
help if it promises anything).

## Prove, guard, hand off
- An anonymous dev probe for each public item, covering both the hidden and the shown state. Extend the public-data guard
  tests so a hidden Schedule's games can't come back through another section. A guard that GET `/unsubscribe` never writes.
- `npm run verify:changed`. Restart the dev server if a shared module changed.
- `/review`, then `/legal` on the unsubscribe change; apply both.
- Record `→ Fixed <hash>` against each item in the report, and tick them off the 🧹 third-sweep TODO line, after the
  owner's yes.
- **No commit without the owner's yes.** Branch `dev`, explicit paths, TODO.md through a private index.
- A product-owner summary.
