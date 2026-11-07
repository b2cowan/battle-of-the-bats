import { forwardToOwnAddress } from '@/lib/club-forward';
import { Fragment } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ExternalLink } from 'lucide-react';
import { requirePublicClubPage } from '@/lib/public-club-page';
import { clubPageMetadata, getClubSiteContent } from '@/lib/club-page-meta';
import { clubAboutPageShows, documentBands } from '@/lib/club-about';
import { sponsorsShowing } from '@/lib/club-sponsors';
import ClubAboutContacts from '@/components/public/ClubAboutContacts';
import { ClubSponsorList } from '@/components/public/ClubSponsors';
import ClubContactLine from '@/components/public/ClubContactLine';
import kit from '@/components/public/ClubKit.module.css';
import parts from '@/components/public/PublicParts.module.css';
import PublicPage from '@/components/public/PublicPage';
import styles from '@/components/public/ClubAbout.module.css';
import PublicSectionHead from '@/components/public/PublicSectionHead';

export const dynamic = 'force-dynamic';

/** "About us · Riverbend Girls Softball". */
export async function generateMetadata({ params }: { params: Promise<{ orgSlug: string }> }): Promise<Metadata> {
  const { orgSlug } = await params;
  return clubPageMetadata(orgSlug, () => 'About us', { path: '/about' });
}

/**
 * THE CLUB'S ABOUT PAGE (Club Tier Stage 4c-1; Ask 10 widened, drawings ~L1922–1949; words CLUB_TIER_STAGE4C1_COPY.md §J).
 *
 * The about text, Who to contact (a role and an address, each with Copy), Documents and policies (the club's links under
 * its own headings, each opening in a new tab), and Questions families ask — each section absent when empty, never a
 * placeholder. No meta line (owner gate 2026-10-21: no invented "since 1979"). No back link (owner 2026-10-21: the Home
 * tab is the way back — a back link stays only where the tab row does not go). Sponsors (Stage 4d) close the page.
 *
 * Reached from the home's About card and the footer's "Contacts and documents", both shown only when the page has a
 * contact, a document or a question (`clubAboutPageShows`). Opened directly with none, it still answers: the about text
 * if any, then "Questions? Email the club at". The site carries the club's documents; it never says the club is compliant.
 */
export default async function ClubAboutPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  await forwardToOwnAddress(orgSlug, '/about');
  // The one rule (Club Tier Stage 4a): the switch on, the club not cancelled, the plan carrying the public site.
  const org = await requirePublicClubPage(orgSlug, 'about');
  const content = await getClubSiteContent(org.id);
  const about = content?.description?.trim() || null;
  const contactEmail = content?.contactEmail?.trim() || null;
  // Nothing at all to say and no address to say it with: the club's "not found", never an empty page.
  if (!about && !clubAboutPageShows(content) && !contactEmail) notFound();

  const contacts = content?.contacts ?? [];
  const bands = documentBands(content?.documents);
  const questions = content?.questions ?? [];
  const sponsors = sponsorsShowing(content?.sponsors);

  // The club page column (club round C2 + C5): on the logo edge (it was a centred 760), 960 at most, the club's words held
  // to 720 inside their box (kit.cardText).
  return (
    <PublicPage frame="club">
      {/* About has no tab, so it keeps its name, at 24 (C4). */}
      <h1 className={kit.pageName}>About us</h1>

      {about && <div className={kit.list}><p className={`${kit.cardText} ${styles.about}`}>{about}</p></div>}

      {contacts.length > 0 && (
        <section className={kit.section} aria-labelledby="who-to-contact">
          <PublicSectionHead id="who-to-contact" title="Who to contact" />
          <ClubAboutContacts contacts={contacts} />
        </section>
      )}

      {bands.length > 0 && (
        <section className={kit.section} aria-labelledby="documents">
          <PublicSectionHead id="documents" title="Documents and policies" />
          <div className={kit.list}>
            {/* R7: each document is a link row (60 tall, 16/600) under its band, the open-in-a-new-tab symbol where the
                chevron would be. */}
            {bands.map(band => (
              <Fragment key={band.heading}>
                <div className={kit.listBand}>{band.heading}</div>
                {band.documents.map(d => (
                  <a key={d.id} href={d.url} target="_blank" rel="noopener noreferrer" className={`${kit.row} ${kit.rowExternal}`}>
                    <span className={kit.rowMain}><span className={kit.rowName}>{d.title}</span></span>
                    <ExternalLink size={16} aria-hidden />
                    <span className={kit.srOnly}> (opens in a new tab)</span>
                  </a>
                ))}
              </Fragment>
            ))}
          </div>
        </section>
      )}

      {questions.length > 0 && (
        <section className={kit.section} aria-labelledby="questions">
          <PublicSectionHead id="questions" title="Questions families ask" />
          <div className={kit.list}>
            {questions.map(q => (
              <div key={q.id} className={styles.qa}>
                <h3 className={styles.question}>{q.question}</h3>
                <p className={`${styles.answer} ${parts.prose}`}>{q.answer}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Sponsors (Stage 4d): last, after what families came for. Only those showing today; none opens this page by itself. */}
      <ClubSponsorList sponsors={sponsors} />

      {!clubAboutPageShows(content) && contactEmail && <ClubContactLine email={contactEmail} />}
    </PublicPage>
  );
}
