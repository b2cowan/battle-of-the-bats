import { Fragment, type CSSProperties, type ReactNode } from 'react';
import Link from 'next/link';
import FollowOrgButton from './FollowOrgButton';
import { siteEdit } from '@/lib/site-edit-marks';
import kit from './ClubKit.module.css';
import styles from './ClubSiteHome.module.css';
import {
  teamGridOneColumn,
  TOURNAMENT_STATUS_WORD,
  type TeamBand,
  type TournamentHomeStatus,
} from '@/lib/club-site-home';
import { clubHomeSectionsFor, type ClubHomeSection, type SectionCarries, type SectionPrefs } from '@/lib/club-site-sections';

/**
 * A CLUB'S HOME (Club Tier Stage 4b-2a; End state 1, Ask 3A, ruled 2026-10-19) — the home of an org whose plan carries
 * the public site. The bar, footer and colours are the frame's (ClubFrame, 4b-1); this is everything between them:
 *
 *   Open now → Teams → House league → Tournaments → About the club
 *
 * by default; since Stage 4c-1 in the club's own order and show/hide from its editor, Open now always first. Each is
 * absent when the club has nothing for it — never a "check back soon". The page (app/[orgSlug]/page.tsx) reads the
 * club's data and hands it in already shaped; this only draws, so the order and the absences are decided once
 * (`clubHomeSectionsFor`, unit-tested).
 *
 * Every section is drawn ONCE, in the club's order — the order a phone reads. At a desk About the club stands in the
 * side column beside the others wherever it sits in that order (a grid places it; the DOM order does not change).
 *
 * What left the home with the old hero: the club's name (the bar carries it), its contact and socials (the footer
 * carries them — one place, 4b-1 leftover), the "Upcoming events" with "Live" on every card (S4-03), the Try out cards
 * (now Open now's rows) and the Past tournaments card (its own tab). The description moved into About the club, and the
 * Follow button with it (owner 2026-10-20: the drawings placed it nowhere; the About card keeps it off screen one).
 */

export interface OpenNowRow {
  key: string;
  href: string;
  title: string;
  sub: string | null;
}

export interface HomeTeam {
  name: string;
  slug: string;
  tryoutsOpen: boolean;
  /** The team's birth years as families read them (Stage 4c-2: "Born 2012–2013", from lib/born-years.ts); none, no line. */
  born?: { line: string | null };
}

export interface HomeTournament {
  id: string;
  href: string;
  name: string;
  dates: string | null;
  status: TournamentHomeStatus | null;
}

export interface ClubSiteHomeProps {
  orgSlug: string;
  orgName: string;
  /** The club's uploaded banner photo — a desk-only strip under the bar (Ask 7A), never behind the name. */
  bannerUrl: string | null;
  openNow: OpenNowRow[];
  teamBands: TeamBand<HomeTeam>[];
  league: { href: string; title: string; sub: string } | null;
  tournaments: HomeTournament[];
  about: string | null;
  /** The About page, when it says more than the about text (a contact, a document or a question). */
  aboutPageHref: string | null;
  showFollow: boolean;
  /** The club's order and show/hide (Stage 4c-1) and what its plan carries. */
  sectionPrefs: SectionPrefs;
  carries: SectionCarries;
}

export default function ClubSiteHome(p: ClubSiteHomeProps) {
  const teamCount = p.teamBands.reduce((n, b) => n + b.teams.length, 0);
  const sections = clubHomeSectionsFor({
    openNow: p.openNow.length,
    teams: teamCount,
    league: !!p.league,
    tournaments: p.tournaments.length,
    about: !!p.about || p.showFollow || !!p.aboutPageHref,
  }, p.sectionPrefs, p.carries);

  const openNow = sections.includes('openNow') && (
    <section className={kit.section} aria-labelledby="open-now" {...siteEdit('home')}>
      <h2 id="open-now" className={kit.sectionTitle}>Open now</h2>
      {/* The heading says "open" once, so the rows carry no chip; nearest deadline first (the page orders them). */}
      <div className={`${kit.list} ${kit.edge}`}>
        {p.openNow.map(r => (
          <Link key={r.key} href={r.href} className={kit.row}>
            <span className={kit.rowMain}>
              <span className={kit.rowName}>{r.title}</span>
              {r.sub && <span className={kit.rowSub}>{r.sub}</span>}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );

  const teams = sections.includes('teams') && (
    <section className={kit.section} aria-labelledby="teams" {...siteEdit('home')}>
      <h2 id="teams" className={kit.sectionTitle}>Teams</h2>
      {/* The home's team finder (DC-01): a grid of doors, its own treatment — no tile chevrons, no "All teams" link
          (the grid shows every team; the Teams tab is one tap away). */}
      <div className={`${kit.list} ${styles.grid}`}>
        {p.teamBands.map((band, i) => (
          <div key={i} className={`${styles.tiles} ${teamGridOneColumn(band.teams.map(t => t.name)) ? styles.one : ''}`}>
            {band.name && <div className={styles.tileBand}>{band.name}</div>}
            {band.teams.map(t => (
              <Link key={t.slug} href={`/${p.orgSlug}/teams/${t.slug}`} className={styles.tile}>
                {t.name}
                {t.born?.line && <span className={styles.tileBorn}>{t.born.line}</span>}
                {t.tryoutsOpen && <span className={`${kit.chip} ${kit.chipOk}`}>Tryouts open</span>}
              </Link>
            ))}
          </div>
        ))}
      </div>
    </section>
  );

  const league = sections.includes('league') && p.league && (
    <section className={kit.section} aria-labelledby="house-league" {...siteEdit('home')}>
      <h2 id="house-league" className={kit.sectionTitle}>House league</h2>
      <div className={kit.list}>
        <Link href={p.league.href} className={kit.row}>
          <span className={kit.rowMain}>
            <span className={kit.rowName}>{p.league.title}</span>
            <span className={kit.rowSub}>{p.league.sub}</span>
          </span>
        </Link>
      </div>
    </section>
  );

  const tournaments = sections.includes('tournaments') && (
    <section className={kit.section} aria-labelledby="tournaments" {...siteEdit('home')}>
      <h2 id="tournaments" className={kit.sectionTitle}>Tournaments</h2>
      <div className={kit.list}>
        {p.tournaments.map(t => (
          <Link key={t.id} href={t.href} className={`${kit.row} ${kit.rowStack}`}>
            <span className={kit.rowMain}>
              <span className={kit.rowName}>{t.name}</span>
              {t.dates && <span className={kit.rowSub}>{t.dates}</span>}
            </span>
            {/* The one green chip is a call to act or a thing happening now; a finished one is a neutral fact. */}
            {t.status && (
              <span className={`${kit.chip} ${t.status === 'finished' ? kit.chipNeutral : kit.chipOk}`}>{TOURNAMENT_STATUS_WORD[t.status]}</span>
            )}
          </Link>
        ))}
      </div>
    </section>
  );

  const about = sections.includes('about') && (
    <section className={`${kit.section} ${styles.about}`} aria-labelledby="about" {...siteEdit('about')}>
      <h2 id="about" className={kit.sectionTitle}>About the club</h2>
      <div className={kit.list}>
        {p.about && <p className={kit.cardText}>{p.about}</p>}
        {/* The About page's door (Stage 4c-1): only when the page says more than this paragraph. */}
        {p.aboutPageHref && (
          <Link href={p.aboutPageHref} className={kit.row}>
            <span className={kit.rowMain}><span className={kit.rowName}>About the club</span></span>
          </Link>
        )}
        {p.showFollow && (
          <div className={styles.follow}>
            <FollowOrgButton orgSlug={p.orgSlug} orgName={p.orgName} />
          </div>
        )}
      </div>
    </section>
  );

  const drawn: Record<ClubHomeSection, ReactNode> = {
    openNow, teams, league, tournaments, about,
  };
  const besideAbout = sections.filter(k => k !== 'about').length;
  const twoColumns = !!about && besideAbout > 0; // About alone takes the whole width

  return (
    <div>
      {/* The page's heading is the club's name, which the bar already shows: a screen reader hears it, the eye sees it
          once (the old hero drew it a second time). */}
      <h1 className={kit.srOnly}>{p.orgName}</h1>
      {/* Ask 7A: a desk-only strip under the bar, never repeating the name; a phone does not draw it, so Open now keeps
          screen one. Decoration — the bar already names the club.
          `data-site-edit` (here and on each section): the editor's preview opens the row that sets the part clicked
          (Public site builder A9, ruled 2026-10-21) — a name, no behaviour, nothing a family's page acts on. */}
      {p.bannerUrl && <div className={styles.bannerStrip} style={{ backgroundImage: `url(${p.bannerUrl})` }} aria-hidden="true" {...siteEdit('look')} />}
      {/* --home-rows: how many sections stand beside About at a desk (the grid gives About their full height). */}
      <div className={twoColumns ? `${styles.column} ${styles.withAbout}` : styles.column}
        style={twoColumns ? ({ '--home-rows': besideAbout } as CSSProperties) : undefined}>
        {sections.map(k => <Fragment key={k}>{drawn[k]}</Fragment>)}
      </div>
    </div>
  );
}
