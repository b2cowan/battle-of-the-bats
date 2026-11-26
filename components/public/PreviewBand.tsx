import Link from 'next/link';
import { previewBandText } from '@/lib/preview-org';
import { CLAIM_WORDS, claimPath } from '@/lib/preview-claim';
import styles from './PreviewBand.module.css';

/**
 * The band on every page of a preview club (Club Website Track P, Session P2; drawing Tx3So1rUqL6shn7CzM93Zr, tab 5).
 *
 * Mounted by the org layout, the frame every page of a club shares, so a deep link to a team page or a tournament page
 * carries it too. It sits above the club's own bar and is NOT pinned: it scrolls away with the bar, and the footer
 * repeats it (`ClubFrameClub.previewFoot`). The club's own notice slot is not used: that slot is the club's, and it does
 * not reach tournament pages. The words are /legal's (lib/preview-org.ts).
 *
 * "Claim it" (Session P3, tab 6.1) opens our own code page. Anyone may tap it; only the code on the room card claims.
 */
export default function PreviewBand({ clubName, slug }: { clubName: string; slug: string }) {
  return (
    <aside className={styles.band} aria-label="About this preview" data-preview-band="">
      <p className={styles.words}>{previewBandText(clubName)}</p>
      <Link href={claimPath(slug)} className={styles.claim}>{CLAIM_WORDS.bandAction}</Link>
    </aside>
  );
}
