/**
 * THE PITCH DECK STUDIO — the library view. READ-ONLY (stage A).
 *
 * Plan: docs/projects/active/PITCH_DECK_STUDIO_PLAN.md · PM brief: …_PM_BRIEF.md
 * Parent (the library this reads): docs/projects/active/PITCH_SLIDE_LIBRARY_PLAN.md
 *
 * ⚠⚠ THIS ROOM WRITES NOTHING, AND THAT IS A RULING RATHER THAN AN UNFINISHED STATE. Composition
 * — which slides, in what order, for what audience — becomes owner-editable data in stage B. A
 * slide's headline, claim and picture stay in CODE and are never editable in a browser
 * (owner ruling 1, 2026-08-21). An editable-with-review-queue middle option was offered and
 * declined. Do not add an edit affordance "while you are in there".
 *
 * What it answers, none of which had a surface before: what do we own, which decks name it, where
 * is it published — and the number that paid for this screen: **how much of a deck the scrolling
 * page actually shows.** Twelve of twenty-three sit outside both pulls.
 *
 * ⚠ NOT "reachable nowhere" — that claim was made here and was FALSE. Present mode renders the
 * whole deck (P2b) and its trigger is unconditional in each page's hero, so a visitor is one
 * click from all of them. The real gap is the reader who never presses it.
 */
import { requirePlatformAreaView } from '@/lib/platform-auth';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { AUDIENCE_LABEL, buildPitchLibraryReport } from './report';
import SlideCard from './SlideCard';
import styles from './pitch-deck-studio.module.css';

/**
 * How a running-order chip reads when its number is not simply built. ⚠ A chip's meaning is never
 * carried by COLOUR alone — olive and danger are the same colour to a deutan eye (design ruling)
 * — so every one of these adds a glyph and a hover title, and a genuine hole also prints a full
 * sentence under the deck.
 */
const HOLE = new Set(['missing', 'held', 'retired']);

const CHIP_GLYPH: Record<string, string> = {
  missing: ' ✕',
  retired: ' ✕',
  held: ' ⌾',
  planned: ' …',
};

const CHIP_TITLE: Record<string, string> = {
  missing: 'Holds no slide — it would vanish silently from this order',
  retired: 'A retired number — spent, never to be reused',
  held: 'Held for a deck that does not exist yet',
  planned: 'Named here, artwork not built yet',
};

/**
 * Whether a picture file is really on disk — or `null` for "this process cannot tell".
 *
 * ⚠ THE `null` BRANCH IS THE WHOLE REASON THIS IS NOT A BARE `existsSync`. `public/` is served by
 * the platform's static layer and is not guaranteed to sit on a deployed request handler's
 * filesystem. A studio that read "cannot see it" as "missing" would paint thirteen red alarms on
 * a perfectly healthy production deploy, and a column that cries wolf once stops being read.
 *
 * So the directory is listed ONCE per render; if it is not there at all, every answer is "not
 * determined here" and the screen says the build check covers it. If it IS there, a file missing
 * from the listing is genuinely missing.
 */
function pictureFilePresence(): (publicPath: string) => boolean | null {
  const seen = new Map<string, Set<string> | null>();
  return (publicPath: string) => {
    const dir = path.posix.dirname(publicPath);
    if (!seen.has(dir)) {
      try {
        seen.set(dir, new Set(readdirSync(path.join(process.cwd(), 'public', ...dir.split('/').filter(Boolean)))));
      } catch {
        seen.set(dir, null);
      }
    }
    const listing = seen.get(dir);
    return listing ? listing.has(path.posix.basename(publicPath)) : null;
  };
}

export default async function PitchDeckStudioPage() {
  await requirePlatformAreaView('pitch_deck_studio');
  const report = buildPitchLibraryReport(pictureFilePresence());
  const { totals } = report;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerLabel}>Growth</div>
        <h1 className={styles.title}>Pitch Deck Studio</h1>
      </header>

      <p className={styles.desc}>
        Every pitch slide we own, every deck we compose them into, and where each one is actually
        published. Slides carry <strong>permanent numbers</strong> so they can be tracked as the
        product changes underneath them — which is why the number line has gaps.
      </p>

      <p className={styles.readOnly}>
        <strong>This room is read-only.</strong> Which slides go where becomes editable in a later
        phase. What a slide <em>says</em> never will — the build checks this copy, and nothing can
        watch a sentence once it is a row in a table. A wording change stays a one-line request in
        chat, and it goes through the check on the way.
        {' '}<strong>No plan, tier or price appears anywhere in this material</strong> (owner
        ruling 2026-08-21): the walkthrough creates desire, the pricing page qualifies, and a
        human answers in the room.
      </p>

      {/* ── The decks ─────────────────────────────────────────────────────── */}
      <h2 className={styles.sectionHeading}>The decks</h2>
      <p className={styles.sectionNote}>
        A deck is one audience in a running order. The public page shows a <em>short pull</em> from
        it — the lit numbers below — while the rest of the deck is only seen in present mode, with
        a human standing beside it.
      </p>

      <div className={styles.deckGrid}>
        {report.decks.map(deck => (
          <section key={deck.audience} className={styles.deckCard}>
            <h3 className={styles.deckName}>{AUDIENCE_LABEL[deck.audience] ?? deck.audience}</h3>
            <p className={styles.deckMeta}>
              {deck.built} slides built
              {deck.page ? (
                <>
                  {' · published on '}
                  <a href={deck.page.path} target="_blank" rel="noopener noreferrer">{deck.page.path}</a>
                  <br />
                  That page shows <strong>{deck.page.shows}</strong> of them, and its own line reads
                  “{deck.page.meta}”.
                </>
              ) : (
                <> · published on no page</>
              )}
            </p>

            <p className={styles.orderLabel}>Running order · lit = on the public page</p>
            <div className={styles.chips}>
              {deck.order.map(o => (
                <span
                  key={o.id}
                  className={`${styles.chip} ${o.onPage ? styles.chipOnPage : ''} ${HOLE.has(o.state) ? styles.chipMissing : ''}`}
                  title={CHIP_TITLE[o.state] ?? (o.onPage ? 'On the public page' : 'Deck only')}
                >
                  {o.id}
                  {CHIP_GLYPH[o.state] ?? ''}
                </span>
              ))}
            </div>

            {deck.problems.map(p => (
              <p key={p} className={styles.deckProblem}>⚠ {p}</p>
            ))}
          </section>
        ))}
      </div>

      {/* ── The library ───────────────────────────────────────────────────── */}
      <h2 className={styles.sectionHeading}>The library</h2>

      <div className={styles.totals}>
        <div className={styles.total}>
          <div className={styles.totalNum}>{totals.slides}</div>
          <div className={styles.totalLabel}>Slides built</div>
        </div>
        <div className={styles.total}>
          <div className={styles.totalNum}>{totals.photographed}</div>
          <div className={styles.totalLabel}>Photographed</div>
        </div>
        <div className={styles.total}>
          <div className={styles.totalNum}>{totals.drawn}</div>
          <div className={styles.totalLabel}>Hand-drawn</div>
        </div>
        <div className={styles.total}>
          <div className={`${styles.totalNum} ${totals.onNoPage > 0 ? styles.totalNumAlert : ''}`}>
            {totals.onNoPage}
          </div>
          <div className={styles.totalLabel}>Slideshow only</div>
        </div>
        <div className={styles.total}>
          <div className={`${styles.totalNum} ${totals.withProblems > 0 ? styles.totalNumAlert : ''}`}>
            {totals.withProblems}
          </div>
          <div className={styles.totalLabel}>Picture problems</div>
        </div>
        {/* ⚠ The worst case as a real number, not a count against an invented cutoff. Every
            picture is days old today, so a "3 are stale" tile would read 0 for months and teach
            the eye to skip it. This one stays informative from day one — and it is deliberately
            not coloured, because age alone does not decide staleness. */}
        <div className={styles.total}>
          <div className={styles.totalNum}>
            {totals.oldestPictureDays === null ? '—' : totals.oldestPictureDays}
            {totals.oldestPictureDays !== null && <span className={styles.totalUnit}>d</span>}
          </div>
          <div className={styles.totalLabel}>Oldest picture</div>
        </div>
      </div>

      <p className={styles.sectionNote}>
        In library-number order, so the gaps show. <strong>“Slideshow only”</strong> is the number
        worth watching: those slides are finished and in a deck, and the <em>scrolling</em> page
        never shows them — they appear only inside <em>Present the full deck</em>, which is public
        but takes a click most readers never make. ⚠ The picture column proves a picture is{' '}
        <em>declared</em> properly — it cannot prove one still looks like the screen it
        photographed. Nothing we run can — <strong>age tells you where to look, not what is
        wrong.</strong> Re-taking a picture is a one-line request in chat; it is a command that
        drives a real browser through the demo world, so it cannot be a button on this page.
      </p>

      {report.reserved.length > 0 && (
        <div className={styles.gaps}>
          {report.reserved.map(g => (
            <div key={g.id} className={styles.gapRow}>
              <span className={styles.gapNum}>{g.id}</span>
              <span>{g.why}</span>
            </div>
          ))}
        </div>
      )}

      <div className={styles.slides}>
        {report.slides.map(r => (
          <SlideCard key={r.slide.id} report={r} />
        ))}
      </div>
    </div>
  );
}
