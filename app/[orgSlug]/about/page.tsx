import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ExternalLink } from 'lucide-react';
import { requirePublicClubPage } from '@/lib/public-club-page';
import { clubPageMetadata, getClubSiteContent } from '@/lib/club-page-meta';
import { clubAboutPageShows, documentBands } from '@/lib/club-about';
import ClubAboutContacts from '@/components/public/ClubAboutContacts';
import ClubContactLine from '@/components/public/ClubContactLine';
import kit from '@/components/public/ClubKit.module.css';
import styles from '@/components/public/ClubAbout.module.css';

export const dynamic = 'force-dynamic';

/** "About the club · Riverbend Girls Softball". */
export async function generateMetadata({ params }: { params: Promise<{ orgSlug: string }> }): Promise<Metadata> {
  const { orgSlug } = await params;
  return clubPageMetadata(orgSlug, () => 'About the club');
}

/**
 * THE CLUB'S ABOUT PAGE (Club Tier Stage 4c-1; Ask 10 widened, drawings ~L1922–1949; words CLUB_TIER_STAGE4C1_COPY.md §J).
 *
 * The about text, Who to contact (a role and an address, each with Copy), Documents and policies (the club's links under
 * its own headings, each opening in a new tab), and Questions families ask — each section absent when empty, never a
 * placeholder. No meta line (owner gate 2026-10-21: no invented "since 1979"). No back link (owner 2026-10-21: the Home
 * tab is the way back — a back link stays only where the tab row does not go). Sponsors join in 4d.
 *
 * Reached from the home's About card and the footer's "Contacts and documents", both shown only when the page has a
 * contact, a document or a question (`clubAboutPageShows`). Opened directly with none, it still answers: the about text
 * if any, then "Questions? Email the club at". The site carries the club's documents; it never says the club is compliant.
 */
export default async function ClubAboutPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
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

  return (
    <div className={styles.column}>
      <div className={styles.head}>
        <h1 className={kit.title}>About the club</h1>
      </div>

      {about && <div className={kit.list}><p className={`${kit.cardText} ${styles.about}`}>{about}</p></div>}

      {contacts.length > 0 && (
        <section className={kit.section} aria-labelledby="who-to-contact">
          <h2 id="who-to-contact" className={kit.sectionTitle}>Who to contact</h2>
          <ClubAboutContacts contacts={contacts} />
        </section>
      )}

      {bands.length > 0 && (
        <section className={kit.section} aria-labelledby="documents">
          <h2 id="documents" className={kit.sectionTitle}>Documents and policies</h2>
          <div className={kit.list}>
            {bands.map(band => (
              <div key={band.heading}>
                <div className={kit.listBand}>{band.heading}</div>
                {band.documents.map(d => (
                  <a key={d.id} href={d.url} target="_blank" rel="noopener noreferrer" className={styles.doc}>
                    <span className={styles.docTitle}>{d.title}</span>
                    <ExternalLink size={16} aria-hidden />
                    <span className={kit.srOnly}> (opens in a new tab)</span>
                  </a>
                ))}
              </div>
            ))}
          </div>
        </section>
      )}

      {questions.length > 0 && (
        <section className={kit.section} aria-labelledby="questions">
          <h2 id="questions" className={kit.sectionTitle}>Questions families ask</h2>
          <div className={kit.list}>
            {questions.map(q => (
              <div key={q.id} className={styles.qa}>
                <h3 className={styles.question}>{q.question}</h3>
                <p className={styles.answer}>{q.answer}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {!clubAboutPageShows(content) && contactEmail && <ClubContactLine email={contactEmail} />}
    </div>
  );
}
