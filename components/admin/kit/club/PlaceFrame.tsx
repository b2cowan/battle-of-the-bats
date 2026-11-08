'use client';
/**
 * A CLUB PLACE'S FRAME (⚖ Club Tier Stage 13i, "Places in the sidebar, pages on the page" — Asks 1, 3 and 6 = A, owner
 * 2026-11-06; drawing tab 6, NAV_STANDARD N11).
 *
 * Every place with more than one page — Rep teams, a team, a season, Accounting, Families, Organization — has ONE header
 * and the shared tab row (`HubTabBar`, never a copy: restyling it restyles the coaches portal) over the page you are on.
 * The tab's own page then drops its title, which would repeat the place's: `TabPageHeader` is the page's header outside a
 * place frame and only its ACTIONS inside one (a tab's own actions stay on that tab, at the right end of its action row —
 * drawing tab 6: "A create button sits in its tab's toolbar, never the place's header").
 *
 * ⚖ THE FRAME OWNS THE WIDTH (the Accounting frame's rule, `/simplify` 2026-10-07): the place is the wide column, and a
 * page's own narrower cap gives way inside it (`[data-place-frame] .page` in the page sheets), so the header and the tab
 * row never jump between one tab and the next.
 *
 * ⚖ THE PLACE'S NAME AND TABS LIVE IN THE ADMIN'S PINNED BAR (Admin header bar Phase 2, option 4, owner 2026-11-07; plan
 * `docs/projects/active/ADMIN_HEADER_BAR_PLAN.md`). The frame draws NOTHING on the paper above the page: it hands the bar
 * its name, way up, small line, chip, switcher and tab row (`useHandBarPlace`), and the bar draws them, the tabs pinned
 * inside it; before the frame's data arrives the bar draws the same placeholder from the address (`useClubPlaceAt`), so
 * nothing shifts. The bar's name is then the page's one `<h1>`. ⚠ The tab row is pinned on every place or none (the
 * 2026-08-19 reversal): there is no paper mode, and a place must never draw its title or tab row on the paper again.
 */
import { createContext, useContext, type ComponentProps, type ReactNode } from 'react';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import { useHandBarPlace, type AdminBarPlace } from '@/components/admin/AdminBarPlace';
import { repKit } from './RepKit';
import css from './PlaceFrame.module.css';

const InPlaceFrame = createContext(false);

/** Is this page drawn inside a place's frame (its title already said by the place)? */
export function useInPlaceFrame(): boolean {
  return useContext(InPlaceFrame);
}

export default function PlaceFrame({ place, children }: {
  /** Everything the pinned bar draws for this place (start from `useClubPlaceAt`, so the bar's first paint matches). */
  place: AdminBarPlace;
  children: ReactNode;
}) {
  useHandBarPlace(place);
  return (
    <div className={`${repKit.page} ${repKit.moneyFrame} ${css.underBar}`} data-place-frame>
      <InPlaceFrame.Provider value>{children}</InPlaceFrame.Provider>
    </div>
  );
}

/** A tab page's own actions, at the right end of their row above the tab's body — for a page that only ever renders inside
 *  its place (the place's header already names it). `lede` is a fact the page's title used to carry (a chip such as the
 *  season schedule's "Published"): it moves to the row's left, never dropped. Nothing to say or act on draws nothing. */
export function TabActions({ lede, children }: { lede?: ReactNode; children?: ReactNode }) {
  if (!lede && !children) return null;
  return (
    <div className={css.tabActions}>
      {lede && <span className={css.tabLede}>{lede}</span>}
      {children}
    </div>
  );
}

/**
 * A tab page's header, for a page that ALSO renders outside a place (the audit log and PDF settings, which the tournament
 * side re-exports). Outside a place frame (the same page reached from the tournament side, or before a place frames
 * it) it is the page's ordinary `AdminPageHeader`. Inside one, the place has already named the page, so the title, the
 * eyebrow, the chips and the back link go, and only the page's actions remain, as its action row.
 */
export function TabPageHeader(props: ComponentProps<typeof AdminPageHeader>) {
  const inPlace = useInPlaceFrame();
  if (!inPlace) return <AdminPageHeader {...props} />;
  return <TabActions>{props.actions}</TabActions>;
}
