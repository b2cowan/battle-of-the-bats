import { forwardToOwnAddress } from '@/lib/club-forward';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { computeStandings, getDivisionsForSeason, getLeagueSeasons } from '@/lib/db';
import { resolvePublicLeagueContext } from '@/lib/public-league';
import { clubPageMetadata, getClubSeason } from '@/lib/club-page-meta';
import { orgLinks } from '@/lib/org-links';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { LeagueDivision } from '@/lib/types';
import { bornFactsOf } from '@/lib/club-born-public';
import { formatStoredDate, tournamentToday } from '@/lib/timezone';
import { clubDay, promotesEarlyBird, publicRegistrationLine, seasonPageShape, takesSignups } from '@/lib/league-registration-state';
import { NEXT_SEASON_WORDS, dollarsLine, isOldSeason, nextSeasonDoor, publicSeasonState, saveWords, seasonDatesLine } from '@/lib/house-league-season';
import { earlyBirdOffer, leaguePrice, seasonPriceRange } from '@/lib/league-price';
import { STANDINGS_WORDS as W, recordWords, standingsTitle, type LeagueStandingsRow } from '@/lib/league-standings';
import column from '../league-column.module.css';
import kit from '@/components/public/ClubKit.module.css';
import parts from '@/components/public/PublicParts.module.css';
import PublicPage from '@/components/public/PublicPage';
import PublicSectionHead from '@/components/public/PublicSectionHead';

export const dynamic = 'force-dynamic';

// The tab names the season as the club stored it. A draft season is hidden by this page, so it is not named either.
export async function generateMetadata({ params }: { params: Promise<{ orgSlug: string; seasonSlug: string }> }): Promise<Metadata> {
  const { orgSlug, seasonSlug } = await params;
  return clubPageMetadata(orgSlug, async club => {
    const season = await getClubSeason(club.id, seasonSlug);
    return season && season.status !== 'draft' ? season.name : null;
  }, { path: `/league/${seasonSlug}` });
}

/** A stored day, read as stored (9b-1 Part 4): registration times are kept as the club typed them, so the first ten
 *  characters ARE the club's day — re-zoning them showed an early-morning close as the day before. */
function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return formatStoredDate(iso.slice(0, 10), { longMonth: true });
}

interface DivisionWithCount extends LeagueDivision {
  activeCount: number;
}

/** "$165" or "$165 – $175". */
const rangeLine = (r: { low: number; high: number }) => r.low === r.high ? dollarsLine(r.low) : `${dollarsLine(r.low)} – ${dollarsLine(r.high)}`;

/** A key-date or fee block: its band label over its value. */
const factValue: React.CSSProperties = { fontSize: '0.875rem', color: 'var(--club-text)', fontWeight: 600 };
const factBand: React.CSSProperties = { marginBottom: '0.2rem' };

/**
 * THE SEASON'S PUBLIC PAGE — TWO SHAPES (House league §0k, owner 2026-11-04; words HOUSE_LEAGUE_PUBLIC_SEASON_PAGE_COPY.md).
 *   - the SIGN-UP shape while the form opens soon or takes sign-ups: price, early bird, age groups with spots, Register now;
 *   - the SEASON shape from the day registration closes (P1): the dates line, each age group's top three (P2, P5), the
 *     next season's card on an old season's page (P3), Schedule. Price, registration dates, spots and the grey box are gone.
 * "Already signed up? Email me my link" is in both (P4).
 */
export default async function LeagueSeasonPage({
  params,
}: {
  params: Promise<{ orgSlug: string; seasonSlug: string }>;
}) {
  const { orgSlug, seasonSlug } = await params;
  await forwardToOwnAddress(orgSlug, `/league/${seasonSlug}`);
  const href = await orgLinks(orgSlug);

  const org = await resolvePublicLeagueContext(orgSlug);
  if (!org) notFound();

  const season = await getClubSeason(org.id, seasonSlug);
  if (!season) notFound();

  // Only show non-draft seasons publicly
  if (season.status === 'draft') notFound();

  const rawDivisions = await getDivisionsForSeason(season.id);
  const today = tournamentToday();
  // The header chip is the index row's tag (9f·3, 9f·4): Registration open · closed · Starts {date} · Playing now · Ended
  // {date}, and none on a finished season — one function, so a season is never named two ways.
  const chip = publicSeasonState(season, today);
  const registrationOpen = takesSignups(season);
  const chipRow = chip && (
    <div className={kit.chipRow}>
      <span className={`${kit.chip} ${registrationOpen || chip.tone === 'ok' ? kit.chipOk : kit.chipNeutral}`}>
        {chip.label}
      </span>
    </div>
  );

  // A family who already signed up finds their child's status here, whatever state the season is in. Hidden only before registration opens, when nobody can have signed up yet.
  const signedUp = !(season.registrationOpenAt && new Date(season.registrationOpenAt) > new Date()) && (
    <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--club-soft)' }}>
      Already signed up? <Link href={href(`/league/${seasonSlug}/status`)}>Email me my link</Link>
    </p>
  );

  // ── The season shape (§0k P1): from the day registration closes. ──
  if (seasonPageShape(season) === 'season') {
    // An age group is listed when the standings page would show its table: standings on and its schedule published (9e·4,
    // 9e·5). Their tables in parallel — the standings page's own read, one per age group — and the club's seasons for the card.
    const listed = rawDivisions.filter(d => d.showStandings && d.schedulePublishedAt);
    const [tables, seasons] = await Promise.all([
      Promise.all(listed.map(d => computeStandings(d.id, season.sport))),
      // The club's seasons only where the card can show: an old season's page.
      isOldSeason(season, today) ? getLeagueSeasons(org.id) : Promise.resolve([]),
    ]);
    // No table before the first score anywhere: the band is absent and Schedule is the one button.
    const anyScored = tables.some(t => t.scored);
    const door = nextSeasonDoor(season, seasons, today);
    const datesLine = seasonDatesLine(season, today);

    // The club page column (club round C2 + C5): on the logo edge, 960 at most, 24 between sections.
    return (
      <PublicPage frame="club">
        <div className={column.header}>
          {door && (
            <aside className={`${kit.door} ${column.nextDoor}`} aria-label={NEXT_SEASON_WORDS.region}>
              <p className={kit.doorTitle}>{door.head}</p>
              {door.line && <p className={kit.sub}>{door.line}</p>}
              <Link
                href={href(door.kind === 'one' ? `/league/${door.season.slug}` : '/league')}
                className={`${kit.btn} ${kit.btnSecondary} ${kit.btnSm}`}
              >
                {door.button}
              </Link>
            </aside>
          )}
          {chipRow}
          <h1 className={kit.pageName}>{season.name}</h1>
          {datesLine && <p className={kit.sub}>{datesLine}</p>}
          {season.description && (
            <p className={`${kit.body} ${parts.prose}`} style={{ marginTop: '0.5rem' }}>
              {season.description}
            </p>
          )}
        </div>

        {/* Each age group's top three (P2, P5): "Standings" while played or ended, "Final standings" once completed. */}
        {anyScored && (
          <section className={kit.section} aria-labelledby="season-standings">
            {/* R4: the standings are a section with the heading row (it was a 12 px capitals label). */}
            <PublicSectionHead id="season-standings" title={standingsTitle(season.status)} />
            <div className={column.topGrid}>
              {listed.map((d, i) => {
                const t = tables[i];
                const headId = `standings-${d.id}`;
                const more = t.rows.length - 3;
                return (
                  <div key={d.id} className={`${kit.card} ${column.topCard}`}>
                    <div className={column.topHead}>
                      <h3 id={headId} className={column.topName}>{d.name}</h3>
                      {t.scored && (
                        <Link href={href(`/league/${seasonSlug}/standings`) + `?d=${d.id}`} className={column.standLink}>
                          {W.card.link}<span className={kit.srOnly}> {W.card.linkFor(d.name)}</span> <span aria-hidden>→</span>
                        </Link>
                      )}
                    </div>
                    {t.scored ? (
                      <>
                        <table className={column.standTable} aria-labelledby={headId}>
                          <thead>
                            <tr>
                              <th scope="col" className={column.standLeft}>{W.col.rank}</th>
                              <th scope="col" className={column.standLeft}>{W.col.team}</th>
                              <th scope="col" title={W.tip.record} aria-label={W.tip.record}>{W.col.record}</th>
                              <th scope="col" title={W.tip.pts} aria-label={W.tip.pts}>{W.col.pts}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {t.rows.slice(0, 3).map(row => <TopRow key={row.team.id} row={row} />)}
                          </tbody>
                        </table>
                        {more > 0 && <p className={column.topMore}>{W.card.more(more)}</p>}
                      </>
                    ) : (
                      // W5: an age group with no scored game keeps its card, so a family's group is not silently missing.
                      <p className={kit.cardText}>{W.coach.none}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Each card's Full table link replaces the old "Final standings →" button; Schedule stays, the lead button when
            there is no table yet. */}
        <div className={kit.btnRow}>
          <Link
            href={href(`/league/${seasonSlug}/schedule`)}
            className={`${kit.btn} ${anyScored ? kit.btnSecondary : kit.btnPrimary}`}
          >
            Schedule
          </Link>
        </div>

        {signedUp}
      </PublicPage>
    );
  }

  // ── The sign-up shape: opens soon, or taking sign-ups (unchanged by §0k). ──
  const divisions: DivisionWithCount[] = await Promise.all(
    rawDivisions.map(async d => {
      const { count } = await supabaseAdmin
        .from('league_registrations')
        .select('id', { count: 'exact', head: true })
        .eq('division_id', d.id)
        // A spot is held by an accepted or a received child (mig 362).
        .in('status', ['active', 'pending_review']);
      return { ...d, activeCount: count ?? 0 };
    }),
  );

  // The dates and the status together (9b-1 Part 4, lib/league-registration-state.ts): the form, the chip and the line agree.
  const regLine = publicRegistrationLine(season);
  const priceRange = seasonPriceRange(divisions, season);
  // The early bird while it runs (owner 2026-10-25): the price a family pays today leads, with what it saves and until when.
  const offer = promotesEarlyBird(season) ? earlyBirdOffer(divisions, season, today) : null;
  const priceToday = (d: LeagueDivision) => leaguePrice(d, season, today);
  const earlyRange = offer ? seasonPriceRange(divisions.map(d => ({ price: priceToday(d)?.amount ?? null, earlyPrice: null })), { registrationFee: null }) : null;

  // The light ground, bar and footer come from the club's frame (Club Tier Stage 4b-1).
  // The club page column (club round C2 + C5): on the logo edge, 960 at most, 24 between sections.
  return (
    <PublicPage frame="club">
      {/* Season header */}
      <div className={column.header}>
        {chipRow}
        <h1 className={kit.pageName}>{season.name}</h1>
        {season.description && (
          <p className={`${kit.body} ${parts.prose}`} style={{ marginTop: '0.5rem' }}>
            {season.description}
          </p>
        )}

        {/* Key dates + fee */}
        <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
          {(season.registrationOpenAt || season.registrationCloseAt) && (
            <div>
              <div className={kit.band} style={factBand}>Registration</div>
              <div style={factValue}>
                {formatDate(season.registrationOpenAt)} — {formatDate(season.registrationCloseAt)}
              </div>
            </div>
          )}
          {(season.seasonStartDate || season.seasonEndDate) && (
            <div>
              <div className={kit.band} style={factBand}>Season dates</div>
              <div style={factValue}>
                {formatDate(season.seasonStartDate)} — {formatDate(season.seasonEndDate)}
              </div>
            </div>
          )}
          {priceRange && (
            <div>
              <div className={kit.band} style={factBand}>Price</div>
              <div style={{ ...factValue, fontWeight: 700 }}>
                {rangeLine(offer && earlyRange ? earlyRange : priceRange)}
              </div>
              {offer && (
                <span className={kit.rowSub}>{saveWords(offer)} through {clubDay(offer.until)}, then {rangeLine(priceRange)}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Divisions */}
      {divisions.length > 0 && (
        <section className={kit.section} aria-labelledby="season-divisions">
          {/* R4: Divisions is a section with the heading row and its count (it was a 12 px capitals label); the fact
              labels above (Registration, Season dates, Price) stay labels. */}
          <PublicSectionHead id="season-divisions" title="Divisions" count={divisions.length} />
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: '0.75rem',
            }}
          >
            {divisions.map(d => {
              const pct = d.capacity ? Math.min(1, d.activeCount / d.capacity) : 0;
              const isFull = d.capacity != null && d.activeCount >= d.capacity;
              // The division's birth years as families read them (Stage 4c-2), under the season's sport's cut-off.
              const born = bornFactsOf({ from: d.bornFromYear, to: d.bornToYear }, org.birthdayCutoffs, season.sport).line;
              const cardPrice = priceToday(d);
              // A saving only when the early amount is really lower, in whole cents (an early amount equal to or above the
              // price is not a discount; 165.55 − 125.55 is not 40.000000000000014).
              const cardSave = cardPrice?.early ? Math.max(0, Math.round((cardPrice.regular - cardPrice.amount) * 100) / 100) : 0;
              return (
                <div key={d.id} className={kit.card} style={{ padding: '1rem 1.25rem' }}>
                  <div style={{ marginBottom: '0.6rem' }}>
                    <div
                      style={{
                        fontSize: '1rem',
                        fontWeight: 700,
                        color: 'var(--club-text)',
                      }}
                    >
                      {d.name}
                    </div>
                    {born && <span className={kit.rowSub}>{born}</span>}
                    {d.note && <span className={kit.rowSub}>{d.note}</span>}
                    {offer && cardPrice && (
                      <div style={{ marginTop: '0.4rem' }}>
                        <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: cardSave > 0 ? 'var(--club-ok)' : 'var(--club-text)' }}>
                          {dollarsLine(cardPrice.amount)}{cardSave > 0 && ` · Save ${dollarsLine(cardSave)}`}
                        </div>
                        {cardSave > 0 && <span className={kit.rowSub}>Early bird through {clubDay(offer.until)}, then {dollarsLine(cardPrice.regular)}</span>}
                      </div>
                    )}
                  </div>
                  {d.capacity != null ? (
                    <>
                      <div
                        style={{
                          height: '6px',
                          background: 'var(--club-line)',
                          borderRadius: '3px',
                          overflow: 'hidden',
                          marginBottom: '0.5rem',
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            width: `${pct * 100}%`,
                            borderRadius: '3px',
                            background: isFull ? 'var(--danger)' : 'var(--club-fill)',
                          }}
                        />
                      </div>
                      <div style={{ fontSize: '0.875rem', color: 'var(--club-soft)', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span>{d.activeCount} / {d.capacity} spots filled</span>
                        {isFull && <span className={`${kit.chip} ${kit.chipNeutral}`}>Waitlist open</span>}
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: '0.875rem', color: 'var(--club-soft)' }}>
                      {d.activeCount} registered
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* CTA: Register now while the form takes sign-ups; before it opens, when it opens and the schedule (teams can be
          set before the first game). */}
      {registrationOpen ? (
        <div>
          <Link
            href={href(`/league/${seasonSlug}/register`)}
            className={`${kit.btn} ${kit.btnPrimary}`}
          >
            Register now
          </Link>
          {regLine && (
            <p style={{ marginTop: '0.75rem', fontSize: '0.875rem', color: 'var(--club-soft)' }}>{regLine}</p>
          )}
        </div>
      ) : (
        <div>
          <div
            className={kit.card}
            style={{
              padding: '1rem 1.25rem',
              fontSize: '0.875rem',
              color: 'var(--club-soft)',
              marginBottom: '1.25rem',
            }}
          >
            {regLine}
          </div>

          <div className={kit.btnRow}>
            <Link
              href={href(`/league/${seasonSlug}/schedule`)}
              className={`${kit.btn} ${kit.btnSecondary}`}
            >
              Schedule
            </Link>
          </div>
        </div>
      )}

      {signedUp}
    </PublicPage>
  );
}

/** One row of an age group's top three: the standings page's own cells — place (T-2 when shared), the team's dot and name
 *  (first place by weight alone, DC-02), W-L-T and points; a team with no counted game reads dashes, not zeros. */
function TopRow({ row }: { row: LeagueStandingsRow }) {
  const place = row.place!;
  const tip = row.tied ? W.placeTip(place) : undefined;
  const dash = <td className={column.standDash}><span aria-hidden>{W.dash}</span><span className={kit.srOnly}>{W.tip.dash}</span></td>;
  return (
    <tr>
      <td className={`${column.standLeft} ${column.standRank}`} title={tip} aria-label={tip}>{W.place(place, row.tied)}</td>
      <td className={column.standLeft}>
        <span className={`${column.standTeam}${place === 1 ? ` ${column.standLead}` : ''}`}>
          {row.team.color && <span className={column.standDot} style={{ background: row.team.color }} />}
          {row.team.name}
        </span>
      </td>
      {row.counted ? (
        <>
          <td>{recordWords(row)}</td>
          <td className={column.standStrong}>{row.points}</td>
        </>
      ) : (
        <>{dash}{dash}</>
      )}
    </tr>
  );
}
