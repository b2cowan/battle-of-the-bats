import { previewBandText } from '@/lib/preview-org';
import styles from './PreviewBand.module.css';

/**
 * The band on every page of a preview club (Club Website Track P, Session P2; drawing Tx3So1rUqL6shn7CzM93Zr, tab 5).
 *
 * Mounted by the org layout, the frame every page of a club shares, so a deep link to a team page or a tournament page
 * carries it too. It sits above the club's own bar and is NOT pinned: it scrolls away with the bar, and the footer
 * repeats it (`ClubFrameClub.previewFoot`). The club's own notice slot is not used: that slot is the club's, and it does
 * not reach tournament pages. The words are /legal's (lib/preview-org.ts).
 *
 * "Claim it" joins the band with the claim page itself (Session P3): a button with nowhere to go is not drawn.
 */
export default function PreviewBand({ clubName }: { clubName: string }) {
  return (
    <aside className={styles.band} aria-label="About this preview" data-preview-band="">
      <p className={styles.words}>{previewBandText(clubName)}</p>
    </aside>
  );
}
