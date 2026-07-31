import styles from './GetAppQr.module.css';

/**
 * "Also on your phone" — the one QR unit (Desktop Public UX Phase 1, WI-11).
 *
 * Rendered in two places that look different but say the same thing: the site footer and the
 * Account settings card. They were built as two hand-maintained copies and the copy had already
 * drifted between them before this was extracted, which is the whole argument for one home.
 *
 * The QR carries its own white plate AND a 4-module quiet zone baked into the SVG, so it scans
 * on any ground — the dark marketing footer included — without depending on a CSS background
 * behind it. That is why there is no plate colour here to get wrong.
 *
 * Layout differences stay with the caller: this renders the image and the words, the caller's
 * wrapper decides how they sit. Colour comes from the surface, since every consumer of this
 * already publishes its own text tokens.
 */
export default function GetAppQr({ size = 78 }: { size?: number }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/get-the-app-qr.svg"
        alt="QR code linking to fieldlogichq.ca"
        className={styles.code}
        width={size}
        height={size}
        loading="lazy"
      />
      <p className={styles.copy}>
        <span className={styles.title}>Also on your phone</span>
        <span>
          Scan with your phone camera to open FieldLogicHQ — live scores and alerts for the
          teams you follow.
        </span>
      </p>
    </>
  );
}
