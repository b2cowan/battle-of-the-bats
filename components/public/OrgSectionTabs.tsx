'use client';
/**
 * components/public/OrgSectionTabs.tsx — Nav Unification Stage F (/design-gated, ruled 2026-08-01).
 *
 * An org's public site reads as ONE place: a row of section tabs (Home / League / Archives) under
 * the org's identity row, so a visitor can move between sections instead of reversing out through
 * the org home each time.
 *
 * THREE design rulings are baked in here — none of them are free choices:
 *
 * 1. A TAB ROW AT EVERY WIDTH, not the tournament's desktop left rail. The rail is a fixed 248px
 *    full-height column, justified for an event with six sections and live operational content.
 *    An org root is a directory page — mostly a hero banner and a few cards — so a permanent
 *    quarter-viewport column holding three words would fight the hero and commit a paying club's
 *    page to navigation furniture. (This narrows the plan's "reuse the rail/tab-row pair".)
 *
 * 2. LEAGUE/CLUB ONLY. The caller gates on the public-site module. On tournament tiers the only
 *    possible entries are Home and Archives — a whole chrome layer to hold two words, on the tier
 *    whose platform-plain org page is correct by design (BUSINESS_DECISIONS 2026-07-31, D3).
 *
 * 3. WHERE A TAB CARRIES THE ANSWER, THE STAGE E CRUMB RETIRES. `Org › League` and a tab row
 *    highlighting League answer the same question, and the row answers it better — so this
 *    component hides the crumb itself (--org-crumb-display) rather than routing a flag through nav
 *    context. But retirement is CONDITIONAL on a tab actually being current: on a section with no
 *    tab (a rep-team page) hiding the crumb too would leave the visitor with neither. The crumb
 *    also stays on tournament-tier org pages, which get archives but never a tab row.
 *
 * Skin comes from the org's own tokens (the layout's :root override) — no literal colour here, so
 * a branded club page tints its active tab with the club's colour for free.
 */
import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import { activeOrgSectionKey, type OrgSection } from '@/lib/org-public-sections';
import { showsOrgPublicChrome } from '@/lib/consumer-routes';
import styles from './OrgSectionTabs.module.css';

/**
 * This row's geometry, declared BY the row that costs it.
 *
 * `--nav-height` is the total fixed chrome above the page and every org page already pads by it,
 * so growing it here makes all of them clear the second row with no per-page edit. It is emitted
 * as markup (not an effect on documentElement) so it is present in the SSR payload — an effect
 * would repaint the padding one frame after hydration, which reads as the page jumping.
 *
 * It lives here rather than in the org layout's own `:root` block because that layout ALSO wraps
 * `/admin`, `/coaches`, `/scorekeeper` and every tournament page — declaring the growth there
 * would push every one of those surfaces down by 44px for a row they never render.
 */
const GEOMETRY = `:root{
  --org-sections-h: 44px;
  --nav-height: calc(var(--nav-height-base) + var(--org-sections-h));
}`;

/**
 * Retiring the crumb is conditional on the row actually ANSWERING the crumb's question.
 *
 * The rule is "one wayfinding device per page", not "the row always wins". On a section the row
 * can't offer a tab for — a rep-team page, where `teams` is nameable but has no index page to link
 * to — no tab reads as current, so hiding the crumb too would leave the visitor with NEITHER: no
 * highlighted tab and no "› Teams" trail. That is strictly worse than before this row existed.
 */
const RETIRE_CRUMB = `:root{ --org-crumb-display: none; }`;

export default function OrgSectionTabs({ sections }: { sections: OrgSection[] }) {
  const pathname = usePathname();
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) || '';

  // Self-gating on the PUBLIC org surfaces — the mounting layout wraps the operator shells and
  // every tournament page too, and a server component cannot read the pathname to tell them apart.
  if (!showsOrgPublicChrome(pathname)) return null;
  // The caller already applied the tier + count gates; this is the defensive floor.
  if (!orgSlug || sections.length < 2) return null;

  // null on an unnamed section (a tournament-shim route) — then NO tab reads as current, which is
  // honest: the visitor is inside the org but not inside any of these sections.
  const activeKey = activeOrgSectionKey(pathname, orgSlug);
  // Only retire the crumb where a tab actually carries the answer (see RETIRE_CRUMB).
  const aTabIsCurrent = sections.some(s => s.key === activeKey);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: GEOMETRY }} />
      {aTabIsCurrent && <style dangerouslySetInnerHTML={{ __html: RETIRE_CRUMB }} />}
      <nav className={styles.tabs} aria-label="Sections">
        <div className={styles.scroller}>
          {/* The global `container` class is what aligns these tabs with the org's name in the
              identity row above — the same content column every other nav uses. */}
          <div className={`container ${styles.track}`}>
            {sections.map(({ key, label }) => {
              const href = key ? `/${orgSlug}/${key}` : `/${orgSlug}`;
              const active = activeKey === key;
              return (
                <Link
                  key={key || 'home'}
                  href={href}
                  className={`${styles.tab} ${active ? styles.active : ''}`}
                  aria-current={active ? 'page' : undefined}
                >
                  {label}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </>
  );
}
