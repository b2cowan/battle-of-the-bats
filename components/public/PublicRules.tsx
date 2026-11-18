import { BookOpen, Download } from 'lucide-react';
import type { Division, Resource, RuleSection } from '@/lib/types';
import { orgLinks } from '@/lib/org-links';
import { RULES_SUBJECT_TO_CHANGE, shapePublicRules } from '@/lib/public-rules-shape';
import DivisionFilterBar from '@/components/DivisionFilterBar';
import PublicTournamentState from './PublicTournamentState';
import PublicRuleSections from './PublicRuleSections';
import PublicPage from './PublicPage';
import kit from './ClubKit.module.css';
import styles from './PublicRules.module.css';

/** The Rules body, live and in the admin preview (the old RulesContent was deleted in Stage 8 Part 3a).
 *
 *  Stage 10 (printable rules): the body reads `shapePublicRules`, the one shape its printable copy (`rules/pdf`) prints,
 *  so the file can never show a section the page hides or number one differently. ⚠ `divisions` is the FULL list — the
 *  shape drops a held-back division's section itself and names only published divisions in the picker. */
export default async function PublicRules({
  orgSlug, tournamentSlug, pageEnabled, rules, resources, divisions, prefName, view, contactEmail, isPreview = false,
}: {
  orgSlug: string; tournamentSlug: string; pageEnabled: boolean;
  rules: RuleSection[]; resources: Resource[]; divisions: Division[];
  prefName: string | null; view?: string; contactEmail: string | null; isPreview?: boolean;
}) {
  const shape = shapePublicRules({ rules, resources, allDivisions: divisions, prefName, view });
  // The published book is empty exactly when nothing shows and nothing is narrowed away.
  const bookIsEmpty = shape.sections.length === 0 && !shape.narrowedTo;
  if (!pageEnabled || (bookIsEmpty && shape.resources.length === 0)) {
    return <PublicPage>
      <PublicTournamentState icon={<BookOpen size={24} />} eyebrow="Rules"
        title={pageEnabled ? 'Rules coming soon' : 'Rules unavailable'}
        description={pageEnabled
          ? 'Rules and resources have not been published yet. Check back before game day.'
          : 'The organizer has hidden public rules and resources for this tournament.'}
        contactEmail={isPreview ? null : contactEmail} />
    </PublicPage>;
  }

  const href = await orgLinks(orgSlug);
  const division = shape.narrowedTo?.name ?? null;
  // A10 + A1: the download prints what the page shows. It is a link to the file's own address (the same cookie narrows
  // it; View all is carried), opened in the PDF viewer in a new tab — so it works before the page's script loads, and an
  // installed app is never left on a PDF with no way back. It shows only when the visitor has sections: with none, the
  // file answers 404 (Part 1, "as built"), so the page never offers a link that dead-ends.
  const download = shape.sections.length > 0 && <RulesDownload division={division} isPreview={isPreview}
    href={href(`/${tournamentSlug}/rules/pdf${view === 'all' ? '?view=all' : ''}`)} />;

  return <PublicPage>
    <h1 className="sr-only">Tournament Rules</h1>
    <div className={styles.noteRow}>
      <p className={styles.note}>{RULES_SUBJECT_TO_CHANGE}
        {contactEmail && !isPreview && <> For questions or clarifications, contact the tournament office at{' '}
          <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.</>}
      </p>
      {download}
    </div>
    {shape.hasTaggedContent && prefName && shape.divisions.length > 0 && !isPreview && <div className={styles.filter}>
      <DivisionFilterBar orgSlug={orgSlug} divisions={shape.divisions} activeName={prefName} isFiltering={!!shape.narrowedTo}
        viewAllHref={href(`/${tournamentSlug}/rules?view=all`)} backHref={href(`/${tournamentSlug}/rules`)} />
    </div>}
    {/* A9: the division label is the file's only; the page sends the list nothing it does not show. */}
    <PublicRuleSections sections={shape.sections.map(({ anchor, number, title, icon, items }) => ({ anchor, number, title, icon, items }))}
      resources={shape.resources} isPreview={isPreview} shareAllDivisions={shape.hasTaggedContent} />
  </PublicPage>;
}

/** A10: on a desk the kit's white outlined small button (R11) — the icon, "Download rules" (or "Download U11 rules") and a
 *  dim "PDF"; under 1024 px the bare symbol, 44 px, at the note's first-line end. Each width carries its own name (the
 *  desk's is its visible words, so a voice user can say what they see; a phone's is spoken only). In the admin preview it
 *  is drawn, not live, like the preview's other doors. */
function RulesDownload({ href, division, isPreview }: { href: string; division: string | null; isPreview: boolean }) {
  const className = `${kit.btn} ${kit.btnSecondary} ${kit.btnSm} ${styles.download}`;
  const body = <>
    <Download aria-hidden />
    <span className={styles.downloadLabel}>{division ? `Download ${division} rules` : 'Download rules'} <small>PDF</small></span>
    <span className={`sr-only ${styles.downloadName}`}>{division ? `Download the ${division} rules as a PDF` : 'Download the rules as a PDF'}</span>
  </>;
  return isPreview
    ? <span className={className} data-inert>{body}</span>
    : <a className={className} href={href} target="_blank" rel="noopener">{body}</a>;
}
