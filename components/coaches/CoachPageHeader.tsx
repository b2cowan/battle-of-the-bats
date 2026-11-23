'use client';
import type { ComponentType, ReactNode } from 'react';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import { ArrowLeft } from 'lucide-react';
import strip from '@/components/admin/AdminTopStrip.module.css';
import HelpButton from '@/components/help/HelpButton';
import { useCoachPageHelp } from '@/components/coaches/CoachPageHelpSlot';
import { useCoachDeskTitle } from '@/components/coaches/CoachDeskTitle';
import CoachDeskNudge from '@/components/coaches/CoachDeskNudge';
import CoachBarName, { useCoachBarNameSlot, useCoachRecordSlot } from '@/components/coaches/CoachBarName';
import type { HelpRequest } from '@/components/help/help-drawer-context';
import styles from '@/app/[orgSlug]/coaches/coaches.module.css';

/**
 * The ONE page header for every standard coach-portal page (ruling 2026-08-11; binding mockup
 * = COACH_PAGE_HEADER_CONSISTENCY_MOCKUP.html). Fixed slots, enforced by construction:
 *
 *   [icon 18 in the 36px tile] [h1 title] [titleChips] … [actions] [help "?"]
 *
 * ⚠ Those two numbers were 22-in-48 until 2026-08-18 (header vertical-space pass, direction E).
 * DENSITY ONLY — the slots, their order, the phone grid and the no-subtitle construction below are
 * exactly as the 2026-08-11 ruling left them. The band above a coach's first line of content went
 * from 80px to 52px on a desktop; the tile is what drives that row's height, so the tile is what
 * moved, and the icon and heading followed it down to keep the pair in proportion.
 *
 * Three shapes, all owned here so no caller hand-rolls a fourth, and selected by ONE `variant`
 * prop so the set stays exhaustive: `standard` (the page header above), `embedded` (a hub tab
 * whose page header is already on screen — actions only), and `nested` (a hub tab that has
 * drilled into ONE record — the same slots at h2, no "?").
 *
 * - NO SUBTITLE SLOT EXISTS. The masthead above owns the season; live facts live in the
 *   body they describe; required framing lines live in the card they frame. A page that wants
 *   a line under its title is a page trying to re-litigate the ruling.
 * - The help "?" is chrome, not an action: its own slot, always LAST, top-right at every width.
 *   ⚠⚠ **THAT SLOT MOVED OUT OF THIS COMPONENT ON 2026-08-25** (owner ruling; plan
 *   `COACH_PAGE_TITLE_BAND_PLAN.md` §5). Inside the team layout the "?" is now drawn by the
 *   MASTHEAD, last in its right slot — this header PUBLISHES the request rather than rendering it
 *   (`useCoachPageHelp`). The ruling's words are unchanged and now truer: one findable home, always
 *   last, top-right, **at every width**. ⚠ Approving it phone-only was the drift the owner caught —
 *   a phone-only move would have given the "?" two homes.
 *   **Outside a masthead** (team-picker hub, notifications, the no-auth early return) there is no
 *   host, so the "?" still renders HERE, exactly as before. That fallback is the default context
 *   value, not a branch: a page whose "?" is published to nobody would have no help at all.
 *   On phones (≤640px) the fallback holds the title line's corner while the actions drop to one
 *   right-pinned row beneath (the .pageHeaderStd grid in coaches.module.css).
 * - Secondary action buttons opt into phone icon-only by wrapping their label in
 *   `styles.headerBtnLabel` + carrying an aria-label; the one lime primary keeps its words.
 *   ⚠ Owner-ruled exception (2026-08-23): the Money hub's Record primary goes icon-only ("+")
 *   on phones too — its aria-label carries the words. Per-action phone visibility also exists
 *   now: `styles.headerActionWideOnly` hides ONE action at phone width while the row stays for
 *   its siblings (Money: Import hides, Record stays), where `actionsPhoneHidden` drops the row.
 * - ⚠ THE ARCHIVE CHIP IS GONE (P2, 2026-08-16). It rendered "2025 · Complete" inside the <h1>
 *   and doubled as the season SWITCHER, which is what it really was; both died with the archive
 *   as a place. A finished working season is signalled once, by the masthead's own "Complete"
 *   chip — where the season already lives, and where it costs no page its title line.
 *
 * ⚖ ON A COMPUTER THE STRIP NAMES THE PAGE (navigation Phase 4, E6, E11, C1, C3, C4; drawings tab 17). On a team's
 *   pages above 900 the strip carries the page's name (the sidebar's lit row), so this header drops its icon tile and its
 *   title (`data-desk-named`, CSS — the server's first paint is already right) and keeps its actions as the page's top
 *   row with the "?" LAST at its right end; a page with only its "?" keeps a row holding the "?" alone (C1); a header
 *   with no actions and no "?" draws nothing there. ONE LEVEL DOWN (C4, AMENDED 2026-11-11) the strip carries the way back AND
 *   the record's name and chips, as the club's record pages do ("← Families │ Avery Test"): this header PORTALS its title and
 *   chips into the strip's slot (`recordSlot`) and keeps only its buttons and "?" (`data-desk-drill='record'`). Until the slot
 *   exists it keeps its own title and drops only its arrow and its icon tile (`data-desk-drill`); a record still loading (no
 *   title yet) draws none — the chrome says the kind of place ("Player") until it is named (navigation Phase 5b, A5). ⚖ ONE HOME
 *   PER WIDTH (Phase 5b): the title goes to the strip above 900 and the bar at 900 and below, never both, so a title that is a
 *   control (the player's name ▾) is one element. The answer is the strip's own (`useCoachDeskTitle`) — one rule, never decided twice. Because
 *   the team bar is the phone's only (≤900), the "?" a page publishes is drawn by the strip above 900 and by the bar at 900
 *   and below — never here while hosted. The scouting reminder sits right under this row on a computer (`CoachDeskNudge`, C3).
 * ⚖ ON A PHONE THE BAR NAMES THE PAGE TOO (navigation Phase 5, E8, F1, owner 2026-11-12): a named page's paper title hides at
 *   EVERY width, and the header keeps only the phone's own buttons (`data-phone-row`; nothing at all when it has none). One
 *   level down (N13, owner 2026-11-12) the bar carries the way back AND the record's name: the title, chips and switcher (the
 *   player's name ▾) are portaled into the bar's slot (`CoachBarName`) — the record's title is the phone's `<h1>`.
 *   No call site changes: the mechanism is this component's.
 *
 * CoachModalHeader is this component's older sibling for modals; pages went years without the
 * equivalent and grew ~40 hand-rolled copies, two forked CSS blocks and one live bug.
 */
export default function CoachPageHeader({
  icon: Icon,
  title,
  titleChips,
  titleMenu,
  actions,
  actionsPhoneHidden,
  actionsPhoneInTitleRow,
  actionsPhoneOnly,
  help,
  helpLabel,
  variant = 'standard',
  backTo,
}: {
  /** Section icon, drawn at 18px in the shared 36px tile. Omit only where the ruling omits it (Overview). */
  icon?: ComponentType<{ size?: number | string }>;
  /** The page's name — a string on hub pages, an entity's name on detail pages. */
  title: ReactNode;
  /** Identity/state chips beside the title (premium badge, status badge, division). Never quantities. */
  titleChips?: ReactNode;
  /**
   * ⚖ THE RECORD'S SWITCH WINDOW, carried with its title (navigation Phase 5b, owner 2026-11-12): the player page's list of
   * players, opened by its name ▾ on a computer. Drawn wherever the title is — after it in the strip's slot, so the window sits in
   * the strip's own layer above the band and in its palette — and never inside the `<h1>`. Not drawn where the phone's bar holds
   * the title (a phone's switcher is a sheet, which the page renders itself).
   */
  titleMenu?: ReactNode;
  /** The action group — primary + secondaries. Rendered right of the title, left of help. */
  actions?: ReactNode;
  /**
   * This page's actions do not exist at phone width — drop the whole row, don't collapse it.
   *
   * Rule 11 of the page-level action ruling (2026-08-13): "phones get outputs, not files". The
   * Money hub's Import/Export menus produce spreadsheets and need a file picker, so at 390px the
   * header is title and "?" alone. Hiding only the BUTTONS would leave an empty grid row behind
   * and a ~12px dead band under the title, so the flag lives here, on the slot's owner, rather
   * than in each caller's stylesheet.
   *
   * ⚠ Only legal where the actions are genuinely absent on a phone — not as a way to tidy away
   * something a coach still needs there. Anything hidden this way must remain reachable at 390px
   * by another route (for Money, every empty state keeps its import offer).
   */
  actionsPhoneHidden?: boolean;
  /**
   * At phone width, the actions keep the TITLE ROW's corner — beside the "?" — instead of
   * dropping to their own right-pinned row beneath (owner ruling 2026-08-23, the Money hub's
   * Record "+"). ⚠ Only for an action set that is genuinely ONE compact control on a phone
   * (icon-only, or with its siblings hidden via `styles.headerActionWideOnly`): the corner has
   * room for one button next to the "?", and a row of three would shove the title. Composes
   * with `actionsPhoneHidden` (which wins — no actions, no corner).
   */
  actionsPhoneInTitleRow?: boolean;
  /**
   * ⚖ THE ACTIONS ARE A PHONE'S ONLY (navigation Phase 4b, owner 2026-11-12): the page draws them for a phone and shows its computer form
   * elsewhere (Schedule: the view menu and the create are the title row's glyphs at ≤640; the toolbar below is the computer's). Above
   * 900 the header then has no actions, so with the "?" in the strip its top row is EMPTY and draws nothing — without this it kept
   * a 0-height row and 16px of margin. Affects only the computer's row (`data-desk-*`); the phone is exactly as it was.
   */
  actionsPhoneOnly?: boolean;
  /** Help drawer request → the iconOnly "?" in its fixed corner slot. */
  help?: HelpRequest;
  /** The page name the help drawer opens under (falls back to the request's own label). */
  helpLabel?: string;
  /**
   * WHICH of the three shapes this is. One prop rather than a boolean per shape, so the shapes
   * stay exhaustive and the invalid combinations cannot be written: two flags meant
   * `embedded + nested` compiled cleanly and silently rendered the embedded one, and the fourth
   * shape would have made it 2³ nominal states for 4 real ones, disambiguated by branch order.
   *
   * - `standard` (default) — a page's own header: icon · h1 + archive chip · actions · help "?".
   * - `embedded` — hosted inside a hub whose header is already on screen (the Money tabs): ONLY
   *   the right-pinned actions row, same classes and same phone tap-floor, no identity chrome.
   *   The component owns this shape so seven panels can't hand-copy it apart (the budget/bva CSS
   *   forks were exactly that failure one level up).
   *   ⚠ **AS OF 2026-09-01 THIS SHAPE HAS ZERO CALL SITES** (cleanup tranche 6). Its only callers
   *   were the six Money panels, which passed no actions — so it drew nothing — and were deleted
   *   with the `embedded` prop that selected it. It is kept because it is the answer to "a hub tab
   *   needs a control row": deleting it is what invites the seventh hand-rolled copy this component
   *   exists to prevent. Retiring it is a design decision, not a sweep — and if it is ever retired,
   *   the `backTo`-on-`embedded` assertion in the page-actions guard goes with it.
   * - `nested` — a hub tab that has drilled into ONE record (Money → Fundraisers → one drive).
   *   Same slots one level down: a smaller tile and an `<h2>`, so the hub's `<h1>` keeps naming
   *   the screen and a screen reader gets a real heading hierarchy rather than two competing page
   *   titles. ⚠ `help` is IGNORED in this shape — the header above already carries the "?" for
   *   this screen, and a second copy is two doors to the same drawer one line apart. A drill-in
   *   that wants its own help topic is a page.
   */
  variant?: 'standard' | 'embedded' | 'nested';
  /**
   * ⚖⚖ THE WAY UP, ANCHORED IN THE HEADER'S LEADING CORNER — `{ href, label }`, e.g.
   * `{ href: '…/accounting?section=payables', label: 'Payables' }`.
   *
   * ⚠⚠ THIS AMENDS ONE CLAUSE OF THE 2026-08-11 PAGE-HEADER RULING, and only that clause. That
   * ruling put every drill-in's back link on its own row ABOVE this header, reasoning that "the
   * header carries the page's name and its actions, and a way back is neither." The owner asked
   * for it back (2026-08-26): the row pushes the whole page down and reads as a stray blue link.
   *
   * The argument for the amendment comes from the SAME ruling: it also decided the help "?" is
   * **chrome, not an action** — anchoring the top-RIGHT corner on every page at every width to give
   * help "one findable home portal-wide". A way UP is the same kind of thing at the opposite
   * corner. It is not a breadcrumb (no trail, and the retired `.breadcrumb` mechanism stays
   * retired), and it is not an action (it sits outside `pageHeaderActions`, behind a hairline).
   *
   * ⚠ THE OTHER HALF OF THE RULING STANDS: there is still exactly ONE back treatment. ⚖ THE PILOT
   * IS OVER — owner ruled the spread on 2026-08-26 after walking the real screen, and this is now
   * the portal's back treatment on **every drill-in that has a page header**. Twelve screens
   * carry it; there is no "second site is drift" clause left to trip over.
   *
   * ⚠⚠ `CoachBackLink` SURVIVES, ON EXACTLY TWO SURFACES, AND THAT IS THE PART TO READ BEFORE
   * DELETING IT. The arrow lives in a header, so a surface with no header cannot take one. Two
   * live back links have no header beside them, enumerated here so a third reads as drift (the
   * team board's failed-load branch was one until 2026-09-12, when that page became a redirect):
   *   1. Opponent detail, FAILED-LOAD branch — an error message and a way out, no title row.
   *   2. The awards CERTIFICATE screen       — a print surface whose back link sits in its own
   *      print toolbar beside "Print certificate"; it has never rendered a page header at all.
   * Giving an error state a page header is a separate decision about what a failed screen looks
   * like, and was deliberately NOT taken here (spread ruling §7: "no unrelated header tidying").
   *
   * ⚠ Also still separate, and still correct: the exempt FIELD surface (`.ppRunBackLink` in practice run mode) and
   * `.recordBackLink` on the free tournament record — a shell with no page header of its own. None of these are drill-ins.
   * (The game bench console's `.gdBack` went in navigation Phase 5, F7: its way back is the bar's and the strip's now.)
   *
   * ⚠ On a phone the label drops and the arrow stands alone — house rule 3, "words → symbols".
   * The accessible name keeps the destination either way.
   *
   * ⚠ IT WORKS ON THE `nested` SHAPE TOO, and that is where it is actually needed: a Money
   * drill-in is a SUB-VIEW of its tab (see `?fundraiser=`, `?bill=`), so it renders a nested
   * header under the hub's own — which is exactly the case that had to wear a separate back row.
   */
  backTo?: { href: string; label: string };
}) {
  const nested = variant === 'nested';
  /* ⚠ UNCONDITIONAL, and above every early return. The `embedded` and `nested` shapes own no "?"
     (nested is one line under a header that already carries this screen's), so they publish null —
     but a hook behind the `embedded` early return below is the classic ordering crash. */
  const helpHost = useCoachPageHelp(help && !nested && variant !== 'embedded' ? help : null, helpLabel);
  const helpHosted = helpHost === 'masthead';
  const { title: desk, offTeam } = useCoachDeskTitle();
  // The chrome's two slots one level down — each answers only at the widths its bar shows (the split at 900 lives with the chrome),
  // hooks above the early return.
  const barSlot = useCoachBarNameSlot();
  const recordSlot = useCoachRecordSlot();
  if (variant === 'embedded') {
    return actions ? (
      <div className={`${styles.pageHeader} ${styles.pageHeaderStd}`}>
        <div className={styles.pageHeaderActions}>{actions}</div>
      </div>
    ) : null;
  }
  // The strip's answer, for this page's ONE standard header (a nested header is a record inside a tab: never).
  const deskNamed = !nested && desk?.kind === 'name';
  const deskDrill = !nested && desk?.kind === 'back';
  const showHelp = !!help && !nested;
  // ⚖ Hosted, the "?" is NOT this row's at any width (navigation Phase 4b, owner 2026-11-12): the team bar draws it on a phone, the
  // strip above 900. So a hosted "?" alone no longer keeps a row; an unhosted page (outside the team layout) still draws its own.
  const helpOnRow = showHelp && !helpHosted;
  // ⚖ An off-team page's "?" is the strip's above 900 and the row's at 900 and below (host `strip`, navigation Phase 6b, T6·1):
  // the row's copy is hidden above 900 (CSS at the chrome's split, so the server's first paint is already right).
  const helpPhoneOnly = helpOnRow && helpHost === 'strip';
  // Whether the computer's top row has any content: buttons the page shows above 900, or a "?" the strip does not draw.
  const deskRowHas = (!!actions && !actionsPhoneOnly) || (showHelp && helpHost === 'own');
  // ⚖ ON A PHONE THE BAR NAMES THE PAGE TOO (navigation Phase 5, E8, owner 2026-11-12), so a named page's header keeps only its
  // buttons there as well — the ones each width shows. At 900 and below every action shows (`actionsPhoneOnly` buttons are
  // the phone's); `actionsPhoneHidden` drops them only at 640 and below (`.pageHeaderActionsWideOnly`), so a tablet keeps
  // them (/review 2026-11-12: a view-only coach's Money import row went missing at 768). With none, the header draws
  // nothing at that width (`data-phone-row`: 'empty' at 900 and below, 'tablet' at 640 and below).
  // ⚖ AN OFF-TEAM PAGE IS NAMED BY THE STRIP ABOVE 900 ONLY (owner 2026-11-23; `lib/coach-off-team-pages.ts`): a phone has no bar on
  // these pages, so the paper title stays there. Above 900 the header keeps its buttons as the page's top row, and nothing at all
  // when it has none (CSS at 901, so the server's first paint is already right).
  const deskOffTeam = !nested && !!offTeam;
  const tabletRowHas = !!actions || helpOnRow;
  const phoneRowHas = (!!actions && !actionsPhoneHidden) || helpOnRow;
  // ⚖ ONE TITLE, ONE HOME PER WIDTH (navigation Phase 5b, owner 2026-11-12). One level down the record's title and chips are drawn
  // in the CHROME — the strip's slot on a computer (`recordSlot`, "← Roster │ Avery Test"), the bar's on a phone and tablet
  // (`CoachBarName`; owner 2026-11-12: "the arrow is the only thing representing back and the bar always names the place you are
  // in") — as a portal of the page's own elements, never a copy. Both bars are in the DOM at every width (CSS hides one), so the
  // title goes to the ONE the chrome's split (900, `useIsPhoneNav`) shows: one element, so a title that is a control (the player's
  // name ▾, a button owning a ref and an open state) is one control, and the page holds one `<h1>` — not a visible one and a hidden
  // copy. Until the slot exists (the server's paint) the header keeps its own title, so a page is never left unnamed.
  const deskRecord = deskDrill && !!recordSlot; // `useCoachRecordSlot` answers only above 900
  const barNames = deskDrill && !!barSlot; // `useCoachBarNameSlot` answers only at 900 and below
  // ⚖ A RECORD STILL LOADING HAS NO NAME YET (navigation Phase 5b, A5): the chrome says the KIND of place ("Player",
  // `coachDrillBack().here`) at both widths until the page names it, so the header draws no empty title of its own — nothing on the
  // page's first rows moves when the name arrives.
  const untitled = deskDrill && (title == null || title === false || (typeof title === 'string' && !title.trim()));
  const titleAway = deskRecord || barNames || untitled; // the header's own title is not drawn: the chrome has it (or nothing does yet)
  return (
    <>
    {barNames && <CoachBarName title={title} chips={titleChips} />}
    {deskRecord && !untitled && createPortal(
      <>
        <h1 className={strip.name}>{title}</h1>
        {titleChips && <span className={strip.chip}>{titleChips}</span>}
        {titleMenu}
      </>,
      recordSlot,
    )}
    <div
      className={`${styles.pageHeader} ${styles.pageHeaderStd}${nested ? ` ${styles.pageHeaderNested}` : ''}${actionsPhoneInTitleRow ? ` ${styles.pageHeaderActionsCorner}` : ''}`}
      data-desk-named={deskNamed ? (deskRowHas ? 'actions' : 'empty') : undefined}
      data-desk-offteam={deskOffTeam ? (deskRowHas ? 'actions' : 'empty') : undefined}
      data-desk-drill={deskDrill ? (deskRecord || untitled ? (deskRowHas ? 'record' : 'empty') : '') : undefined}
      data-phone-row={deskNamed || barNames || untitled ? (!tabletRowHas ? 'empty' : !phoneRowHas ? 'tablet' : undefined) : undefined}
      data-phone-record={barNames || untitled || undefined}
    >
      <div className={styles.pageHeaderLeft}>
        {backTo && (
          <>
            <Link href={backTo.href} className={styles.pageHeaderBack} aria-label={`Back to ${backTo.label}`}>
              <ArrowLeft size={15} aria-hidden />
              <span className={styles.pageHeaderBackLabel}>{backTo.label}</span>
            </Link>
            {/* Chrome, not part of the record's name — the hairline is what says so. */}
            <span className={styles.pageHeaderBackRule} aria-hidden />
          </>
        )}
        {!titleAway && Icon && (
          <div className={`${styles.headerIcon}${nested ? ` ${styles.headerIconNested}` : ''}`}>
            <Icon size={nested ? 15 : 18} />
          </div>
        )}
        {!titleAway && (
          <div className={styles.pageTitleWrap}>
            {nested ? (
              <h2 className={`${styles.pageTitle} ${styles.pageTitleNested}`}>{title}</h2>
            ) : (
              <h1 className={styles.pageTitle}>{title}</h1>
            )}
            {titleChips}
            {titleMenu}
          </div>
        )}
      </div>
      {actions && (
        <div className={`${styles.pageHeaderActions}${actionsPhoneHidden ? ` ${styles.pageHeaderActionsWideOnly}` : ''}`}>
          {actions}
        </div>
      )}
      {/* `!nested` is the doc above made true rather than merely stated: a nested header sits one
          line under a header that already carries this screen's "?", and two of them would be two
          doors to the same drawer.
          Hosted (inside the team layout, the 2026-08-25 move), the team bar draws the "?" on a phone and the STRIP above 900
          (owner 2026-11-12, navigation Phase 4b), so this copy hides at every width. Unhosted, it is the row's, last. Off a team's
          pages (Phase 6b, T6·1) the strip draws it above 900 and this copy is the phone's. One "?" per width. */}
      {helpOnRow && (
        <span className={`${styles.pageHeaderHelp}${helpPhoneOnly ? ` ${styles.pageHeaderHelpPhone}` : ''}`}>
          <HelpButton iconOnly label={helpLabel} help={help} />
        </span>
      )}
    </div>
    {/* Under the page's ONE top row: the header the strip's answer names (or one level down, carries back for). */}
    {(deskNamed || deskDrill) && <CoachDeskNudge />}
    </>
  );
}
