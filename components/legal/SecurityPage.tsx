import type { ReactNode } from 'react';
import kit from '@/components/marketing/MarketingKit.module.css';
import { fullCopyOffered } from '@/lib/full-copy-promise';
import type { LegalLinks } from '@/lib/legal-links';
import { DATA_TERMS_LINK, LEGAL_CONTENTS_LABEL, PRIVACY_TITLE, SUBPROCESSORS_LINK, TERMS_TITLE } from '@/lib/legal-words';
import { PRIVACY_EMAIL } from '@/lib/org-deletion-words';
import {
  SECURITY_AS_OF, SECURITY_BACKUPS, SECURITY_BREACH, SECURITY_BREACH_HELD, SECURITY_CERT_NOTE, SECURITY_CHECKS,
  SECURITY_CHECKS_INTRO, SECURITY_CLUB_SEES, SECURITY_CROSS_BORDER, SECURITY_EYEBROW, SECURITY_HANDLES_COLUMNS,
  SECURITY_HANDLES_ROWS, SECURITY_HELD_W2, SECURITY_HELD_W9, SECURITY_LEAD, SECURITY_NEVER_PUBLIC, SECURITY_OUR_STAFF,
  SECURITY_PROTECT, SECURITY_QUESTIONS_LEAD, SECURITY_ROLES_COLUMNS, SECURITY_ROLES_INTRO, SECURITY_ROLES_ROWS,
  SECURITY_SECTIONS, SECURITY_SHORT_ANSWER, SECURITY_TITLE, SECURITY_YOURS_CONTRACT, SECURITY_YOURS_DELETE,
  SECURITY_YOURS_DOWNLOAD, SECURITY_YOURS_FULL_COPY, SECURITY_YOURS_FULL_COPY_HELD, securityAsOfLine,
  type SecuritySectionKey,
} from '@/lib/security-page-words';
import { formatStoredDate } from '@/lib/timezone';
import { cn } from '@/lib/utils';
import legal from './LegalPage.module.css';
import styles from './SecurityPage.module.css';
import SecurityDiagram from './SecurityDiagram';

/**
 * THE PUBLIC SECURITY PAGE (Board Ready §0c, S3), as drawn and ruled 2026-11-21 (`claude.ai/artifact/9yp7PVd33SjyRQrSBqXZmv` v2).
 * A server component with no data reads: the route has already answered "not found" while the legal pages are off, and hands the
 * live links in. Words: `lib/security-page-words.ts`, their one home.
 *
 * VERSION B — the Data Terms AND the list of companies both published (S2 ruling 6): the four held lines switch on together (W2 and
 * W9 under the "not ours" sentence; W8 in place of the breach line; the 30-day line as the full-copy line), "Read more" grows to
 * four links, and W2/W9 link those two pages. Until then the full-copy line shows only when `fullCopyOffered()` says so — the rule
 * "Questions a board asks" answer 4 follows.
 */

/** Both pages a board reads but never accepts, published: the page's version B. */
export const securityVersionB = (links: LegalLinks): boolean => links.dataTermsHref !== null && links.subprocessorsHref !== null;

/** `**…**` opens a sentence in bold; nothing else is markup. */
function rich(text: string): ReactNode {
  return text.split(/\*\*(.+?)\*\*/).map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : part));
}

/** A heading's anchor: "What's never on a public page" → "whats-never-on-a-public-page". */
const anchorOf = (heading: string): string =>
  heading.toLowerCase().replace(/'/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const HEADINGS = Object.fromEntries(SECURITY_SECTIONS) as Record<SecuritySectionKey, string>;

function Section({ k, children }: { k: SecuritySectionKey; children: ReactNode }) {
  return (
    <section aria-labelledby={anchorOf(HEADINGS[k])}>
      <h2 id={anchorOf(HEADINGS[k])}>{HEADINGS[k]}</h2>
      {children}
    </section>
  );
}

/** The address a printed "Read more" link shows after it: the same href with the protocol dropped. */
const printedAddress = (href: string): string => href.replace(/^[a-z]+:\/\//i, '');

export default function SecurityPage({ links }: { links: LegalLinks }) {
  const versionB = securityVersionB(links);
  const fullCopy = versionB ? SECURITY_YOURS_FULL_COPY_HELD : fullCopyOffered(links) ? SECURITY_YOURS_FULL_COPY : null;
  const readMore: Array<[string, string]> = [[TERMS_TITLE, links.termsHref], [PRIVACY_TITLE, links.privacyHref]];
  if (versionB) readMore.push([DATA_TERMS_LINK, links.dataTermsHref!], [SUBPROCESSORS_LINK, links.subprocessorsHref!]);
  const yours = [SECURITY_YOURS_DOWNLOAD, fullCopy, SECURITY_YOURS_DELETE, SECURITY_YOURS_CONTRACT].filter((t): t is string => t !== null);

  return (
    <div className={cn(kit.page, legal.wrap, styles.root)}>
      <div className={cn('container', legal.layout)}>
        <article className={legal.prose}>
          <header className={legal.head}>
            <p className={cn(kit.eyebrow, styles.eyebrow)}>{SECURITY_EYEBROW}</p>
            <h1 className={cn(kit.heading, styles.title)}>{SECURITY_TITLE}</h1>
            <p className={styles.lead}>{SECURITY_LEAD}</p>
            <p className={kit.small}>{securityAsOfLine(formatStoredDate(SECURITY_AS_OF, { longMonth: true }))}</p>
          </header>

          <div className={cn(legal.text, styles.sections)}>
            <Section k="short">
              <div className={styles.card}>
                {SECURITY_SHORT_ANSWER.map(t => <p key={t}>{rich(t)}</p>)}
              </div>
            </Section>

            <Section k="never"><p>{SECURITY_NEVER_PUBLIC}</p></Section>

            <Section k="lives"><SecurityDiagram /></Section>

            <Section k="handles">
              <table>
                <thead><tr>{SECURITY_HANDLES_COLUMNS.map(c => <th key={c} scope="col">{c}</th>)}</tr></thead>
                <tbody>
                  {SECURITY_HANDLES_ROWS.map(row => (
                    <tr key={row[0]}>
                      {row.map((v, i) => <td key={i} data-label={SECURITY_HANDLES_COLUMNS[i]}>{v}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className={styles.note}>{SECURITY_CERT_NOTE}</p>
              {versionB && (
                <>
                  <p>{SECURITY_HELD_W2.before}<a href={links.subprocessorsHref!}>{SECURITY_HELD_W2.link}</a>{SECURITY_HELD_W2.after}</p>
                  <p>{SECURITY_HELD_W9.before}<a href={links.dataTermsHref!}>{SECURITY_HELD_W9.link}</a>{SECURITY_HELD_W9.after}</p>
                </>
              )}
              <p>{SECURITY_CROSS_BORDER}</p>
            </Section>

            <Section k="roles">
              <p>{SECURITY_ROLES_INTRO}</p>
              <table className={styles.keep}>
                <thead><tr>{SECURITY_ROLES_COLUMNS.map(c => <th key={c} scope="col">{c}</th>)}</tr></thead>
                <tbody>
                  {SECURITY_ROLES_ROWS.map(([role, opens]) => (
                    <tr key={role}>
                      <td data-label={SECURITY_ROLES_COLUMNS[0]}>{role}</td>
                      <td data-label={SECURITY_ROLES_COLUMNS[1]}>{opens}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p>{rich(SECURITY_CLUB_SEES)}</p>
              <p>{rich(SECURITY_OUR_STAFF)}</p>
            </Section>

            <Section k="protect">
              <ul>{SECURITY_PROTECT.map(t => <li key={t}>{rich(t)}</li>)}</ul>
            </Section>

            <Section k="backups">
              <ul>
                {[...SECURITY_BACKUPS, versionB ? SECURITY_BREACH_HELD : SECURITY_BREACH].map(t => <li key={t}>{rich(t)}</li>)}
              </ul>
            </Section>

            <Section k="yours">
              <ul>{yours.map(t => <li key={t}>{t}</li>)}</ul>
            </Section>

            <Section k="checks">
              <p>{SECURITY_CHECKS_INTRO}</p>
              <ul>{SECURITY_CHECKS.map(t => <li key={t}>{rich(t)}</li>)}</ul>
            </Section>

            <Section k="questions">
              <p>{SECURITY_QUESTIONS_LEAD}<a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a></p>
            </Section>

            <Section k="readmore">
              <ul className={styles.read}>
                {readMore.map(([label, href]) => (
                  <li key={label}>
                    <a href={href}>{label}</a>
                    <span className={styles.printAddress}> ({printedAddress(href)})</span>
                  </li>
                ))}
              </ul>
            </Section>
          </div>
        </article>

        <nav className={cn(legal.rail, styles.rail)} aria-label={LEGAL_CONTENTS_LABEL}>
          <p className={legal.railCap}>{LEGAL_CONTENTS_LABEL}</p>
          <ol className={legal.railList}>
            {SECURITY_SECTIONS.map(([k, heading]) => (
              <li key={k}><a className={legal.railLink} href={`#${anchorOf(heading)}`}>{heading}</a></li>
            ))}
          </ol>
        </nav>
      </div>
    </div>
  );
}
