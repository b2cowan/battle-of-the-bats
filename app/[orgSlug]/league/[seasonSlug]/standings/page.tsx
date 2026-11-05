import { forwardToOwnAddress } from '@/lib/club-forward';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { getDivisionsForSeason, computeStandings } from '@/lib/db';
import { resolvePublicLeagueContext } from '@/lib/public-league';
import { clubPageMetadata, getClubSeason } from '@/lib/club-page-meta';
import { orgLinks } from '@/lib/org-links';
import { SCHEDULE_PUBLIC_WORDS as P } from '@/lib/league-schedule-words';
import {
  STANDINGS_WORDS as W, diffWords, recordWords, standingsTitle,
  type LeagueStandings, type LeagueStandingsRow, type StandingsLabels,
} from '@/lib/league-standings';
import type { LeagueDivision } from '@/lib/types';
import column from '../../league-column.module.css';
import PublicPage from '@/components/public/PublicPage';
import kit from '@/components/public/ClubKit.module.css';

export const dynamic = 'force-dynamic';

// A draft season is hidden by this page, so the tab does not name it either.
export async function generateMetadata({ params }: { params: Promise<{ orgSlug: string; seasonSlug: string }> }): Promise<Metadata> {
  const { orgSlug, seasonSlug } = await params;
  return clubPageMetadata(orgSlug, async club => {
    const season = await getClubSeason(club.id, seasonSlug);
    return season && season.status !== 'draft' ? `${season.name} standings` : null;
  }, { path: `/league/${seasonSlug}/standings` });
}

/**
 * THE PUBLIC STANDINGS (House League 9e-1, frames s2/s3; words HOUSE_LEAGUE_STAGE9E_COPY.md §1).
 * ⚖ A DIVISION'S TABLE IS PUBLIC ONLY ONCE ITS SCHEDULE IS (9e·4, 9d2·1) AND ITS "SHOW STANDINGS" IS ON (9e·5):
 *   - switched off: no tab; a direct link says it doesn't keep standings and points to the Schedule;
 *   - not published: its tab keeps the Schedule page's "· coming" word, and the page says when the table shows;
 *   - published, nothing scored: the teams A–Z with dashes, nobody ranked (a table of zeros read like a result);
 *   - scored: ranked by `rankStandings` — the sport's column words, a shared place as "T-3", and the ranking box built
 *     from the same rules, so the words and the order cannot disagree.
 * Nothing 404s but a draft season, as before.
 */
export default async function PublicStandingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string; seasonSlug: string }>;
  searchParams: Promise<{ d?: string }>;
}) {
  const { orgSlug, seasonSlug } = await params;
  const { d: divisionIdParam } = await searchParams;
  await forwardToOwnAddress(orgSlug, `/league/${seasonSlug}/standings${divisionIdParam ? `?d=${encodeURIComponent(divisionIdParam)}` : ''}`);
  const href = await orgLinks(orgSlug);

  const org = await resolvePublicLeagueContext(orgSlug);
  if (!org) notFound();

  const season = await getClubSeason(org.id, seasonSlug);
  if (!season) notFound();
  if (season.status === 'draft') notFound();

  const divisions = await getDivisionsForSeason(season.id);
  const kept = divisions.filter(d => d.showStandings);
  const asked = divisions.find(d => d.id === divisionIdParam) ?? null;
  const active: LeagueDivision | null = asked ?? kept[0] ?? null;
  const published = !!active?.schedulePublishedAt;
  const standings = active && active.showStandings && published ? await computeStandings(active.id, season.sport) : null;
  const scheduleHref = (d: LeagueDivision | null) => href(`/league/${seasonSlug}/schedule`) + (d ? `?d=${d.id}` : '');

  // The light ground, bar and footer come from the club's frame (Club Tier Stage 4b-1).
  // The club page column (club round C2 + C5): on the logo edge, 960 at most (it was 800), 24 between sections.
  return (
    <PublicPage frame="club">
      <div>
        <Link href={href(`/league/${seasonSlug}`)} className={kit.back}>
          ← {season.name}
        </Link>
        {/* A page about one thing keeps its name at 24 (club round C4); the season under it, 8 px down. */}
        <div className={kit.nameBlock}>
          <h1 className={kit.pageName}>{standingsTitle(season.status)}</h1>
          <p className={kit.sub}>{season.name}</p>
        </div>
      </div>

      {/* Division tabs: a division that doesn't keep standings has none; a draft one says it is coming. */}
      {kept.length > 1 && (
        <div className={column.tabs}>
          {kept.map(d => (
            <Link
              key={d.id}
              href={href(`/league/${seasonSlug}/standings`) + `?d=${d.id}`}
              className={`${column.tab}${d.id === active?.id ? ` ${column.tabActive}` : ''}`}
            >
              {d.schedulePublishedAt ? d.name : P.comingTab(d.name)}
            </Link>
          ))}
        </div>
      )}

      {divisions.length === 0 ? (
        <div className={kit.empty}>{W.noDivisions}</div>
      ) : !active ? (
        <Said words={W.offAll} href={scheduleHref(null)} />
      ) : !active.showStandings ? (
        <Said words={W.off(active.name)} href={scheduleHref(active)} />
      ) : !standings ? (
        <div className={kit.empty}>{W.unpub}</div>
      ) : (
        <Table standings={standings} />
      )}
    </PublicPage>
  );
}

/** "{Division} doesn't keep standings. Its games are on the Schedule." with Schedule linked. */
function Said({ words, href }: { words: { before: string; link: string; after: string }; href: string }) {
  return (
    <div className={kit.empty}>
      {words.before}<Link href={href} className={column.standLink}>{words.link}</Link>{words.after}
    </div>
  );
}

type Col = 'rank' | 'team' | 'gp' | 'w' | 'l' | 't' | 'record' | 'pts' | 'for' | 'against' | 'diff';
/** The desk reads every column; the phone reads the record, points and differential first, the rest one swipe away. */
const DESK: readonly Col[] = ['rank', 'team', 'gp', 'w', 'l', 't', 'pts', 'for', 'against', 'diff'];
const PHONE: readonly Col[] = ['rank', 'team', 'record', 'pts', 'diff', 'gp', 'for', 'against'];
/** Nothing scored: no place, and the phone keeps team · record · points (frame s3). */
const DESK_UNRANKED = DESK.filter(c => c !== 'rank');
const PHONE_UNRANKED: readonly Col[] = ['team', 'record', 'pts'];

function head(c: Col, l: StandingsLabels): { text: string; tip: string | null } {
  switch (c) {
    case 'rank': return { text: W.col.rank, tip: null };
    case 'team': return { text: W.col.team, tip: null };
    case 'for': return { text: l.forAbbr, tip: l.forName };
    case 'against': return { text: l.againstAbbr, tip: l.againstName };
    case 'diff': return { text: l.diffAbbr, tip: W.tip.diff(l) };
    default: return { text: W.col[c], tip: W.tip[c] };
  }
}

function Table({ standings }: { standings: LeagueStandings }) {
  const { rows, scored, labels, rules } = standings;
  const one = (cols: readonly Col[], className: string) => (
    <div className={`${column.standScroll} ${className}`}>
      <table className={column.standTable}>
        <thead>
          <tr>
            {cols.map(c => {
              const h = head(c, labels);
              return (
                <th key={c} scope="col" className={c === 'rank' || c === 'team' ? column.standLeft : undefined}
                  title={h.tip ?? undefined} aria-label={h.tip ?? undefined}>{h.text}</th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => <tr key={row.team.id}>{cols.map(c => <Cell key={c} col={c} row={row} />)}</tr>)}
        </tbody>
      </table>
    </div>
  );
  // One section of the page: the table, its foot and "How the table is ranked" keep their own spacing inside it.
  return (
    <div>
      {one(scored ? DESK : DESK_UNRANKED, column.deskOnly)}
      {one(scored ? PHONE : PHONE_UNRANKED, column.phoneOnly)}
      {scored && <p className={`${column.standFoot} ${column.phoneOnly}`}>{W.swipe(labels)}</p>}
      {!scored ? (
        <p className={column.standFoot}>{W.noScore}</p>
      ) : (
        <>
          <div className={`${column.rankBox} ${column.deskOnly}`}>
            <b>{W.rank.title}</b>
            <p>{W.rank.points(rules.pointsPerWin, rules.pointsPerDraw)}</p>
            <ol>{rules.steps.map(step => <li key={step}>{W.rank.step(step, labels)}</li>)}</ol>
            <p>{W.rank.shared}</p>
          </div>
          <div className={`${column.rankBox} ${column.phoneOnly}`}>
            <b>{W.rank.title}</b>
            <p>{W.rank.short(rules.pointsPerWin, rules.pointsPerDraw, labels)}</p>
          </div>
        </>
      )}
    </div>
  );
}

function Cell({ col, row }: { col: Col; row: LeagueStandingsRow }) {
  if (col === 'rank') {
    const place = row.place!;
    const tip = row.tied ? W.placeTip(place) : undefined;
    return <td className={`${column.standLeft} ${column.standRank}`} title={tip} aria-label={tip}>{W.place(place, row.tied)}</td>;
  }
  if (col === 'team') {
    return (
      <td className={column.standLeft}>
        <span className={`${column.standTeam}${row.place === 1 ? ` ${column.standLead}` : ''}`}>
          {row.team.color && <span className={column.standDot} style={{ background: row.team.color }} />}
          {row.team.name}
        </span>
      </td>
    );
  }
  // A team with no counted game reads dashes, not zeros.
  if (!row.counted) {
    return <td className={column.standDash}><span aria-hidden>{W.dash}</span><span className={kit.srOnly}>{W.tip.dash}</span></td>;
  }
  switch (col) {
    case 'gp': return <td>{row.gamesPlayed}</td>;
    case 'w': return <td className={column.standStrong}>{row.wins}</td>;
    case 'l': return <td>{row.losses}</td>;
    case 't': return <td>{row.ties}</td>;
    case 'record': return <td>{recordWords(row)}</td>;
    case 'pts': return <td className={column.standStrong}>{row.points}</td>;
    case 'for': return <td>{row.runsFor}</td>;
    case 'against': return <td>{row.runsAgainst}</td>;
    default: {
      const d = row.runDifferential;
      return <td className={d > 0 ? column.standPos : d < 0 ? column.standNeg : column.standZero}>{diffWords(d)}</td>;
    }
  }
}
