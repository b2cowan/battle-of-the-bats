import Link from 'next/link';
import { PREVIEW_CLOSED_NEXT, PREVIEW_CLOSED_TITLE, previewClosedBody } from '@/lib/preview-org';
import kit from './ClubKit.module.css';
import parts from './PublicParts.module.css';
import PublicPage from './PublicPage';

/**
 * A form on a preview club (Club Website Track P, Session P2; drawing tab 5, "Register tapped in a preview"): every public
 * sign-up, tryout and registration form shows this in its place. The home still shows the season as open, as the club's
 * own site would; Register explains. The server refuses the form too (`lib/preview-write-refusal.ts`).
 */
export default function PreviewClosedForm({ clubName, homeHref, context }: {
  clubName: string;
  homeHref: string;
  /** What the form was for, as the page's kicker ("Sample House League 2027"). */
  context?: string | null;
}) {
  return (
    <PublicPage frame="club" width="form">
      <div className={kit.nameBlock}>
        {context && <p className={kit.sub}>{context}</p>}
        <h1 className={kit.pageName}>{PREVIEW_CLOSED_TITLE}</h1>
        <p className={`${kit.body} ${parts.prose}`} style={{ margin: 0 }}>{previewClosedBody(clubName)}</p>
        <p className={`${kit.body} ${parts.prose}`} style={{ margin: 0 }}>{PREVIEW_CLOSED_NEXT}</p>
      </div>
      <div className={kit.btnRow}>
        <Link href={homeHref} className={`${kit.btn} ${kit.btnSecondary} ${kit.btnPhoneFull}`}>{clubName} home</Link>
      </div>
    </PublicPage>
  );
}
